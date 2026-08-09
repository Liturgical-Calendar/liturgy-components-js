import ApiOptions from '../ApiOptions/ApiOptions.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import ApiBase, { assertSameBase } from './ApiBase.js';
import ApiClientError from './ApiClientError.js';
import EventEmitter from './EventEmitter.js';
import { YearType, Rite, RiteProperties } from '../Enums.js';
import { canonicalizeLocale } from '../LocaleValidation.js';

/**
 * Errors that were delivered to at least one `calendarFetchFailed` listener at
 * the moment they were emitted.
 *
 * `#discardRequest` needs to answer "did anyone actually receive this error?",
 * not "is anyone subscribed right now?" — those two questions diverge for a
 * throwing `calendarFetched` listener and for an argument/state error such as an
 * unserviceable rite, both of which reject WITHOUT ever emitting
 * `calendarFetchFailed`. Checking the current listener list at catch time answered
 * the wrong question for exactly those two cases: it read "someone is subscribed"
 * as "someone has this error", when no emit had happened for them to receive.
 * Recording the answer at the one place it is actually known — the emit site —
 * and reading it back at the catch site removes that inference entirely.
 *
 * A module-level `WeakSet`, deliberately not a field on `ApiClientError`: that
 * would add public surface for a single internal bookkeeping decision, would not
 * work for the plain `Error`s the argument/state guards reject with, and
 * `ApiClientError` already has a subtle `cause`/`JSON.stringify` interaction that
 * a new enumerable field could disturb. `WeakSet` membership does not keep an
 * error alive once nothing else references it, so this holds no memory beyond
 * the errors already in play.
 *
 * @type {WeakSet<object>}
 */
const deliveredFailures = new WeakSet();

/**
 * A client for interacting with the Liturgical Calendar API.
 * This class provides methods to fetch and manage liturgical calendar data,
 * including the General Roman Calendar, National Calendars, and Diocesan Calendars.
 *
 * @class
 * @description The ApiClient handles all API interactions for retrieving liturgical calendar data.
 * It supports fetching calendar metadata, managing calendar settings, and retrieving specific calendar types
 * (General Roman, National, or Diocesan). The class maintains internal state for calendar data and request parameters,
 * and provides methods to listen to UI component changes.
 *
 * @example
 * // Initialize against the default API base
 * const client = await ApiClient.init();
 * // Fetch General Roman Calendar
 * client.fetchCalendar();
 *
 * @example
 * // Fetch a National Calendar
 * const client = await ApiClient.init();
 * client.fetchNationalCalendar('IT');
 */
export default class ApiClient {
  /**
   * @type {{calendars: '/calendars', calendar: '/calendar', events: '/events', easter: '/easter', decrees: '/decrees', data: '/data', missals: '/missals', tests: '/tests', schemas: '/schemas'}}
   * @private
   * @constant
   */
  static #paths = Object.freeze({
    calendars: '/calendars',
    calendar: '/calendar',
    events: '/events',
    easter: '/easter',
    decrees: '/decrees',
    data: '/data',
    missals: '/missals',
    tests: '/tests',
    schemas: '/schemas'
  });

  /**
   * @type {import('../typedefs.js').CalendarData}
   * @private
   */
  #calendarData = {};

  /**
   * @type {{'Content-Type': 'application/json', Accept: 'application/json', ['Accept-Language']: string}}
   */
  #fetchCalendarHeaders = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };

  /**
   * Parameters for the API request sent as a JSON object representing key - value pairs, in the body of the request
   * @type {{year: number, epiphany: string, ascension: string, corpus_christi: string, year_type: string, eternal_high_priest: boolean, holydays_of_obligation: {[key: string]: boolean}}}
   */
  #params = {
    year: new Date().getFullYear(),
    epiphany: 'JAN6',
    ascension: 'THURSDAY',
    corpus_christi: 'THURSDAY',
    eternal_high_priest: false,
    holydays_of_obligation: {
      "Christmas": true,
      "Epiphany": true,
      "Ascension": true,
      "CorpusChristi": true,
      "MaryMotherOfGod": true,
      "ImmaculateConception": true,
      "Assumption": true,
      "StJoseph": true,
      "StsPeterPaulAp": true,
      "AllSaints": true
    },
    year_type: YearType.LITURGICAL
  };

  /**
   * An empty value for category means the General Roman Calendar.
   * A value of 'national' means a national calendar, based on a Roman Missal as published in the given country / nation.
   * A value of 'diocesan' means a diocesan calendar, which is based on the national calendar,
   *  with the addition of a few local celebrations.
   * @type {'' | 'national' | 'diocesan'}
   * @private
   */
  #currentCategory = '';

  /**
   * The current calendar ID, which is used to fetch the corresponding calendar data.
   * @type {string}
   * @private
   */
  #currentCalendarId = '';

  /**
   * The liturgical rite the current request is computed under.
   *
   * Instance state, deliberately: per-request state in this class is
   * instance-level, and only genuinely shared things (`#paths`, and the base's
   * own metadata and cache) live outside the instance. A static rite would let
   * two ApiClients on one page overwrite each other's requests.
   *
   * @type {'roman' | 'ambrosian'}
   * @private
   */
  #currentRite = Rite.ROMAN;

  /**
   * Monotonic counter identifying the most recently STARTED calendar request.
   *
   * Requests are fire-and-forget, so several can be in flight at once — a rite
   * change alone starts two, one through the calendar select and one through the
   * rite listener. Responses are not guaranteed to arrive in the order they were
   * issued, and without this an older one landing last would overwrite the newer
   * calendar and emit it, leaving the UI showing data the user has already moved
   * on from.
   *
   * @type {number}
   * @private
   */
  #requestRevision = 0;

  /**
   * The API base this client is bound to: its URL, its calendar index, and its
   * response cache.
   *
   * Instance state, deliberately. Holding the base statically is what allowed a
   * second `init()` to leave a client pointing at one API while reporting
   * another's calendars.
   *
   * @type {ApiBase}
   * @private
   */
  #base = null;

  /**
   * The event bus that can be used to subscribe to events emitted by the ApiClient.
   * @type {EventEmitter}
   * @private
   */
  #eventBus = null;

  /**
   * Initializes an ApiClient against an API base, loading that base's calendar
   * index if it has not been loaded already.
   *
   * Returns a NEW client on every call, including for a base already registered:
   * only the per-base state is shared. Two clients on one base is a supported
   * arrangement — it is what lets one page compare two rites served by a single
   * API — and it works because every per-request field on this class is instance
   * state.
   *
   * Every failure mode is reported by rejecting the returned promise, never by
   * throwing synchronously — including a malformed `url`, which `ApiBase.resolve`
   * rejects before any request is made. An `init()` that threw at the call site
   * would escape past the `.catch()` a consumer wrote around it.
   *
   * @param {string|null} [url] - The API base URL. When null, the constant default
   *                              base is used, NOT the first base already registered:
   *                              a call that means "the public API" must not resolve
   *                              to localhost because a comparison page registered it
   *                              first. An empty string is rejected rather than
   *                              treated as "unspecified".
   * @returns {Promise<ApiClient>} Resolves to a new client once the base is loaded.
   *                               Rejects with an `ApiClientError` if the base's
   *                               `/calendars` request fails, or with a plain `Error`
   *                               if `url` is not a non-empty string.
   * @static
   */
  static init( url = null ) {
    try {
      const base = ApiBase.resolve( url ?? ApiBase.DEFAULT_URL );
      return base.load().then( () => new ApiClient( base ) );
    } catch ( error ) {
      return Promise.reject( error );
    }
  }

  /**
   * Instantiates an ApiClient bound to an API base.
   *
   * Use {@link ApiClient.init} rather than calling this directly: `init()`
   * guarantees the base's calendar index is loaded before any component reads it.
   * A constructor cannot do the same, because loading a base is asynchronous and a
   * constructor cannot await — so this rejects a missing or wrong-typed base
   * immediately rather than defaulting it, which would only move the failure to
   * the first metadata read, and unhelpfully: without this guard, `new
   * ApiClient()` left `#base` as `undefined`, and the first fetch failed with a
   * bare `TypeError: Cannot read properties of undefined (reading 'getCached')`.
   *
   * @param {ApiBase} base - The API base this client issues its requests against.
   * @throws {Error} If `base` is not an `ApiBase`.
   */
  constructor( base ) {
    if ( false === base instanceof ApiBase ) {
      throw new Error( 'ApiClient: the base passed to the constructor must be an ApiBase. Use ApiClient.init() to obtain a client, rather than constructing one directly.' );
    }
    this.#base     = base;
    this.#eventBus = new EventEmitter();
  }

  /**
   * The API base this client is bound to.
   *
   * @returns {ApiBase}
   */
  get base() {
    return this.#base;
  }

  /**
   * Generates a cache key based on calendar parameters.
   * @param {string} category - The calendar category ('', 'national', or 'diocesan')
   * @param {string} calendarId - The calendar ID
   * @param {number} year - The year
   * @param {string} yearType - The year type (LITURGICAL or CIVIL)
   * @param {string} locale - The locale
   * @param {object} params - Additional parameters (epiphany, ascension, etc.)
   * @param {'roman' | 'ambrosian'} rite - The liturgical rite. Without this in the
   *   key, switching rite at the same year, locale and calendar id would be
   *   answered from the previous rite's cache entry with no request at all.
   * @returns {string} A unique cache key
   * @private
   */
  #generateCacheKey(category, calendarId, year, yearType, locale, params = {}, rite = Rite.ROMAN) {
    const keyParts = [
      rite,
      category || 'general',
      calendarId || '',
      year,
      yearType,
      locale || ''
    ];
    // For general Roman calendar, include mobile feast settings
    if (!category) {
      keyParts.push(
        params.epiphany || '',
        params.ascension || '',
        params.corpus_christi || '',
        params.eternal_high_priest || false
      );
    }
    return keyParts.join('|');
  }

  /**
   * Refuses a request for a non-Roman rite against an API that cannot serve one.
   *
   * Pre-empts the API's rejection rather than surfacing it: v5 answers any path
   * carrying a rite segment with a bare 400, which tells the integrator nothing
   * about why. The Roman rite is always allowed, since it is served by every API
   * version — on v5 simply without the segment.
   *
   * Throws, rather than returning a rejected promise, because it is a guard and not
   * a request: the three fetch methods call it inside the `try` that turns every
   * synchronous throw of theirs into a rejection, so no caller of theirs ever sees
   * this leave the call site.
   *
   * @throws {Error} If a non-Roman rite is selected and the API is not rite-aware.
   * @private
   */
  #assertRiteSupported() {
    if ( this.#currentRite !== Rite.ROMAN && false === this.#base.supportsRite ) {
      throw new Error( `ApiClient: the API at ${this.#base.url} does not support the ${this.#currentRite} rite. Rite support was added in API v6; this API announces no ambrosian_calendars in its metadata.` );
    }
  }

  /**
   * Gets cached calendar data if available and valid.
   * @param {string} cacheKey - The cache key to look up
   * @returns {object|null} The cached data or null if not found
   * @private
   */
  #getCachedData(cacheKey) {
    return this.#base.getCached( cacheKey );
  }

  /**
   * Stores calendar data in the cache.
   * @param {string} cacheKey - The cache key
   * @param {object} data - The calendar data to cache
   * @private
   */
  #setCachedData(cacheKey, data) {
    this.#base.setCached( cacheKey, data );
  }

  /**
   * Clears all cached calendar data.
   * Useful when you want to force fresh data from the API.
   * @static
   * @returns {void}
   */
  static clearCache() {
    ApiBase.clearAllCaches();
  }

  /**
   * Resolves and validates a locale for a national or diocesan calendar.
   * Sets the Accept-Language header when the requested locale is one the calendar
   * supports; clears it when a locale was requested but cannot be used, so a locale
   * left over from an earlier request never leaks into this one.
   *
   * @param {'national'|'diocesan'} category - The calendar category
   * @param {string} calendar_id - The calendar identifier
   * @param {string|Intl.Locale} locale - The locale to resolve
   * @returns {string} The JS-format (hyphenated) locale that was set as Accept-Language;
   *          the current Accept-Language header value, unchanged, when no locale was
   *          requested for this call; or `''` when a requested locale could not be used
   *          for this calendar and the header was cleared.
   * @private
   */
  #resolveCalendarLocale(category, calendar_id, locale) {
    const resolvedLocale = this.#fetchCalendarHeaders['Accept-Language'] || '';

    // Guard against uninitialized metadata
    if (!this.#base.metadata) {
      return resolvedLocale;
    }

    // An `Intl.Locale` is accepted here as everywhere else a locale is (issue #32).
    // Unwrapped rather than run through `canonicalizeLocale`: unlike `fetchCalendar`,
    // this resolver does not THROW on a locale it cannot use — routing it through
    // the throwing helper would change that contract for strings too.
    const tag = locale instanceof Intl.Locale ? locale.toString() : locale;

    // No tag at all means no locale was requested for THIS call — e.g. an internal
    // refetch triggered by a year or year_type change, which passes no locale — so
    // whatever Accept-Language is already in force is left exactly as it is.
    if (typeof tag !== 'string' || tag === '') {
      return resolvedLocale;
    }

    const phpLocale = tag.replace(/-/g, '_');
    const jsLocale = phpLocale.replace(/_/g, '-');
    const metadataArray = category === 'national'
      ? this.#base.metadata.national_calendars
      : this.#base.metadata.diocesan_calendars;

    const calendarMetadata = metadataArray?.find(
      calendar => calendar.calendar_id === calendar_id
    );
    if (calendarMetadata?.locales?.includes(phpLocale)) {
      this.#fetchCalendarHeaders['Accept-Language'] = jsLocale;
      return jsLocale;
    }

    // A locale WAS requested but this calendar cannot serve it — unparseable, or
    // valid but not among the calendar's own supported locales. Clear any
    // Accept-Language left by a previous request rather than leaving it in place:
    // sending it would both ask the API for a locale this request never asked for,
    // and key the cache entry by a locale that was not actually sent. Sending no
    // Accept-Language makes the API fall back to the calendar's own first supported
    // locale, so no client-side fallback is computed here.
    delete this.#fetchCalendarHeaders['Accept-Language'];
    return '';
  }

  /**
   * Emits `calendarFetchFailed` and records, in {@link deliveredFailures}, whether
   * the error was actually handed to at least one listener.
   *
   * The three fetch methods are otherwise identical at this point, and were
   * repeating this same two-line sequence — emit, then decide what
   * `#discardRequest` needs to know about it — once each. Factored into one place
   * so that a mistake in the bookkeeping cannot be made in one copy and not the
   * others.
   *
   * @param {ApiClientError} apiError - The error to emit.
   * @param {'roman' | 'ambrosian'} requestRite - The rite of the request that failed.
   * @returns {void}
   * @private
   */
  #emitCalendarFetchFailed( apiError, requestRite ) {
    const hadListeners = this.#eventBus._events[ 'calendarFetchFailed' ]?.length > 0;
    this.#eventBus.emit( 'calendarFetchFailed', apiError, { rite: requestRite } );
    if ( hadListeners ) {
      deliveredFailures.add( apiError );
    }
  }

  /**
   * Discards the outcome of a request issued for its side effects alone.
   *
   * The change listeners this class attaches to UI components fire a request and have
   * no caller to hand the promise back to, so the rejection would surface as an
   * unhandled rejection. What happens to it depends on whether it was actually
   * DELIVERED to a `calendarFetchFailed` listener — tracked in
   * {@link deliveredFailures}, written at the point of emission — rather than on
   * whether a listener merely exists when this `.catch` runs:
   *
   * - **Delivered** — some listener already received it, so this stays silent. It is
   *   a suppressor, not error handling.
   * - **Not delivered** — the error would otherwise vanish entirely, leaving no trace
   *   that the calendar simply never arrived. It is logged with `console.error`,
   *   which is what these methods did unconditionally before they learned to reject.
   *   Silence here would be a regression for anyone upgrading without subscribing.
   *
   * Two kinds of error reach here without ever having been emitted, so for them
   * `deliveredFailures` never gained an entry and this always logs: a throw from a
   * `calendarFetched` listener, and — since the fetch methods stopped throwing
   * synchronously — an argument or state error such as an unserviceable rite. Both
   * used to escape this method entirely, the first as an uncaught throw out of the
   * emit and the second as an uncaught throw out of the DOM change handler that
   * started the request. A subscriber checked only for its OWN existence at catch
   * time used to read both as "handled" — on a page that subscribes to
   * `calendarFetchFailed`, both vanished with no log and no event, which is the
   * defect this method now avoids.
   *
   * @param {Promise<*>} request - The request whose outcome is being discarded.
   * @returns {void}
   */
  #discardRequest( request ) {
    request.catch( error => {
      if ( false === deliveredFailures.has( error ) ) {
        console.error( error );
      }
    } );
  }

  /**
   * Discards the outcome of a request on behalf of a component in this package.
   *
   * Package-internal. Components such as `LiturgyOfAnyDay` drive the client for its
   * side effects and drop the promise, and need the same handling as the listeners
   * inside this class — see {@link ApiClient#discardRequest} for what that is. They
   * delegate here rather than reimplementing the subscriber check, so that behaviour
   * cannot drift between modules.
   *
   * @param {Promise<*>} request - The request whose outcome is being discarded.
   * @returns {void}
   */
  _discardRequest( request ) {
    this.#discardRequest( request );
  }

  /**
   * Refetches calendar data based on the current category and calendar ID.
   *
   * This method determines the current category of the calendar (national, diocesan, or general)
   * and fetches the corresponding calendar data.
   *
   * If the current category is 'national', it fetches the national calendar using the current
   * calendar ID. If the category is 'diocesan', it fetches the diocesan calendar. For any other
   * category, it fetches the General Roman Calendar.
   *
   * @returns {Promise<import('../typedefs.js').CalendarData>} The promise of whichever fetch
   *                                                           method the current category
   *                                                           selects, with that method's
   *                                                           behaviour. Resolves to THIS
   *                                                           request's calendar data — unless a
   *                                                           newer request has superseded it
   *                                                           while it was in flight, in which
   *                                                           case it resolves to the client's
   *                                                           current calendar data instead:
   *                                                           another request's data, or `{}` if
   *                                                           none has landed yet. Rejects with an
   *                                                           `ApiClientError` if the request
   *                                                           fails, after emitting
   *                                                           `calendarFetchFailed`. A caller that
   *                                                           discards it must attach a handler,
   *                                                           since the rejection would otherwise
   *                                                           go unhandled. Nothing is thrown
   *                                                           synchronously, because none of the
   *                                                           three throws synchronously: the
   *                                                           argument and state errors that used to
   *                                                           escape this method at the call site now
   *                                                           reject the promise it hands back.
   */
  refetchCalendarData() {
    if ( this.#currentCategory === 'national' ) {
      return this.fetchNationalCalendar( this.#currentCalendarId );
    } else if ( this.#currentCategory === 'diocesan' ) {
      return this.fetchDiocesanCalendar( this.#currentCalendarId );
    } else {
      return this.fetchCalendar();
    }
  }

  /**
   * Fetches the General Roman Calendar data from the API for a given year.
   *
   * @param {string|Intl.Locale|null} locale The locale for the General Roman Calendar, as a tag or an `Intl.Locale`. If null, the default or last set locale is used.
   *
   * This method sends a POST request to the calendar endpoint with the configured parameters.
   * The year parameter is extracted from the request body and placed in the URL path.
   * The remaining parameters are sent in the request body as JSON.
   *
   * If the same calendar with identical parameters was previously fetched, the cached data
   * is returned without making a new API request.
   *
   * @returns {Promise<import('../typedefs.js').CalendarData>} Resolves to THIS request's calendar
   *                                                           data — unless a newer request has
   *                                                           superseded it while it was in
   *                                                           flight, in which case it resolves to
   *                                                           the client's current calendar data
   *                                                           instead: another request's data, or
   *                                                           `{}` if none has landed yet. The
   *                                                           superseded response is still cached
   *                                                           under its own key, but it never
   *                                                           overwrites newer data and no
   *                                                           `calendarFetched` is emitted for it.
   *                                                           Rejects with an `ApiClientError` if
   *                                                           the request fails, after emitting
   *                                                           `calendarFetchFailed`. Rejects with a
   *                                                           plain `Error`, and emits nothing, when
   *                                                           the API cannot serve the current rite,
   *                                                           or when `locale` is given as anything
   *                                                           other than a parseable locale tag or an
   *                                                           `Intl.Locale` — a value that is
   *                                                           neither, an empty or blank string, or
   *                                                           an unparseable one. A well-formed
   *                                                           locale the calendar does not support is
   *                                                           not an error at all: the request is
   *                                                           made with the locale already in force.
   *                                                           NOTHING is thrown synchronously, so one
   *                                                           `.catch()` covers every failure mode.
   */
  fetchCalendar(locale = null) {
    // Every failure of this method is reported by rejecting the returned promise,
    // never by throwing synchronously. It is the contract `init()` already states,
    // extended to the rest of the class for the same reason: a caller who wrote
    // `fetchCalendar( userLocale ).catch( handler )` must have `handler` run for an
    // unusable argument or an unserviceable rite too, not only for a failed request.
    // An error raised before any request goes out rejects with exactly the value it
    // threw — a plain `Error`, never wrapped in an `ApiClientError`, which carries
    // request context there is none of — and emits no `calendarFetchFailed`, which
    // reports a request that failed and not one that was never made.
    //
    // The whole body is enclosed rather than the guards alone, so that a synchronous
    // throw added to this method later cannot escape the contract by sitting outside
    // a narrower `try`.
    try {
      this.#assertRiteSupported();
      // Pin the rite for THIS request. `#currentRite` can change while the
      // request is in flight — a rite change fires one fetch through the calendar
      // select and another through the rite listener — so a listener reading the
      // client's current rite when the response lands could pair one rite's data
      // with the other rite's name.
      const requestRite = this.#currentRite;
      const requestRevision = ++this.#requestRevision;
      // Since the year parameter will be placed in the path, we extract it from the body params.
      const { year, ...params } = this.#params;
      let resolvedLocale = this.#fetchCalendarHeaders['Accept-Language'] || '';

      if (locale !== null) {
        // The same shared guard the six components use, rather than a hand-rolled
        // type check, a hand-rolled empty-string check and a hand-rolled `_` to `-`
        // normalization: it rejects a non-string, an empty or blank tag and an
        // unparseable one, naming this method in every message. A tag that parses
        // but names a language the API does not serve is NOT an error — the request
        // simply goes out with the locale already in force, as it always has.
        const canonicalLocale = canonicalizeLocale(locale, 'ApiClient.fetchCalendar');
        if (this.#base.locales().includes(new Intl.Locale(canonicalLocale).language)) {
          this.#fetchCalendarHeaders['Accept-Language'] = canonicalLocale;
          resolvedLocale = canonicalLocale;
        }
      }

      // Check cache first
      const cacheKey = this.#generateCacheKey('', '', year, params.year_type, resolvedLocale, params, requestRite);
      const cachedData = this.#getCachedData(cacheKey);
      if (cachedData) {
        this.#calendarData = cachedData;
        // The emit stays synchronous, exactly as before: on a hit, listeners have
        // always run before this statement returns, and callers may depend on that.
        // The `try` changes only what the RETURNED PROMISE does. `EventEmitter.emit`
        // is a synchronous `forEach`, so a `calendarFetched` listener that throws —
        // WebCalendar does, on malformed data — used to throw straight out of the
        // fetch method, before any promise existed, and `.catch()` on the call could
        // never see it. On a cache MISS the same throw reaches the caller as a
        // rejection, because the `.catch` below sits above the emit stage. A
        // listener's throw is the listener's bug, but it must reach the caller the
        // same way on a hit as on a miss: cache state is not something a caller
        // controls or can even observe. Do not "simplify" this `try` away — not even
      // now that it sits inside the method-wide `try` above, which would catch the
      // same throw and reject with it identically. This one is what states, at the
      // emit itself, that a listener's throw on a hit is a rejection; it is also
      // what keeps that true if the outer `try` is ever narrowed.
        try {
          this.#eventBus.emit('calendarFetched', cachedData, { rite: requestRite });
        } catch ( error ) {
          return Promise.reject( error );
        }
        return Promise.resolve( cachedData );
      }

      const riteSegment = this.#base.supportsRite ? `/${requestRite}` : '';
      const requestUrl  = `${this.#base.url}${ApiClient.#paths.calendar}${riteSegment}${year ? `/${year}` : ''}`;
      return fetch( requestUrl, {
        method: 'POST',
        headers: this.#fetchCalendarHeaders,
        body: JSON.stringify( params )
      }).then( response => {
        if ( false === response.ok ) {
          return response.text()
            .catch( () => null )
            .then( body => {
              throw new ApiClientError(
                `POST ${requestUrl} failed: ${response.status} ${response.statusText}`,
                { url: requestUrl, status: response.status, statusText: response.statusText, body }
              );
            } );
        }
        return response.json();
      }).catch( error => {
        // Deliberately BEFORE the cache/emit stage, not after it. `EventEmitter.emit`
        // is a synchronous `forEach`, so a `calendarFetched` listener that throws —
        // WebCalendar does, on malformed data — used to land in this catch, get
        // relabelled `POST <url> failed: …`, and be re-emitted as
        // `calendarFetchFailed`, handing subscribers both events for one request
        // whose HTTP call had succeeded. A listener's throw is the listener's bug;
        // it now propagates to the returned promise unwrapped and emits nothing.
        const apiError = error instanceof ApiClientError
          ? error
          : new ApiClientError( `POST ${requestUrl} failed: ${error.message}`, { url: requestUrl, cause: error } );
        this.#emitCalendarFetchFailed( apiError, requestRite );
        throw apiError;
      }).then( data => {
        // Cache regardless: the response is valid for its own key even if a newer
        // request has superseded it, and caching it saves refetching later.
        this.#setCachedData(cacheKey, data);
        if ( requestRevision !== this.#requestRevision ) {
          return this.#calendarData;
        }
        this.#calendarData = data;
        this.#eventBus.emit( 'calendarFetched', data, { rite: requestRite } );
        return this.#calendarData;
      });
    } catch ( error ) {
      return Promise.reject( error );
    }
  }

  /**
   * Fetches a national liturgical calendar from the API
   * @param {string} calendar_id - The identifier for the national calendar to fetch
   * @param {string|Intl.Locale} [locale] - The locale for the national calendar
   * @returns {Promise<import('../typedefs.js').CalendarData>} Resolves to THIS request's calendar
   *                                                           data — unless a newer request has
   *                                                           superseded it while it was in
   *                                                           flight, in which case it resolves to
   *                                                           the client's current calendar data
   *                                                           instead: another request's data, or
   *                                                           `{}` if none has landed yet. The
   *                                                           superseded response is still cached
   *                                                           under its own key, but it never
   *                                                           overwrites newer data and no
   *                                                           `calendarFetched` is emitted for it.
   *                                                           Rejects with an `ApiClientError` if
   *                                                           the request fails, after emitting
   *                                                           `calendarFetchFailed`. Rejects with a
   *                                                           plain `Error`, and emits nothing, when
   *                                                           the current rite has no national tier,
   *                                                           or when the API cannot serve the
   *                                                           current rite. NOTHING is thrown
   *                                                           synchronously, so one `.catch()` covers
   *                                                           every failure mode.
   * @description This method fetches a national liturgical calendar by its ID, and optionally a supported locale. It extracts the year from params
   * to use in the URL path and sends other relevant parameters in the request body. Parameters that determine the dates for
   * epiphany, ascension, corpus_christi, eternal_high_priest are excluded from the request parameters,
   * as these options are built into the National calendar being requested.
   *
   * If the same calendar with identical parameters was previously fetched, the cached data
   * is returned without making a new API request.
   */
  fetchNationalCalendar( calendar_id, locale = '' ) {
    // Every failure of this method is reported by rejecting the returned promise,
    // never by throwing synchronously. It is the contract `init()` already states,
    // extended to the rest of the class for the same reason: a caller who wrote
    // `fetchCalendar( userLocale ).catch( handler )` must have `handler` run for an
    // unusable argument or an unserviceable rite too, not only for a failed request.
    // An error raised before any request goes out rejects with exactly the value it
    // threw — a plain `Error`, never wrapped in an `ApiClientError`, which carries
    // request context there is none of — and emits no `calendarFetchFailed`, which
    // reports a request that failed and not one that was never made.
    //
    // The whole body is enclosed rather than the guards alone, so that a synchronous
    // throw added to this method later cannot escape the contract by sitting outside
    // a narrower `try`.
    try {
      this.#assertRiteSupported();
      if ( false === RiteProperties[ this.#currentRite ].hasNationalTier ) {
        throw new Error( `ApiClient.fetchNationalCalendar: the ${this.#currentRite} rite has no national calendars, so there is no route to request. Use fetchCalendar() for the rite-level calendar, or fetchDiocesanCalendar() for one of its dioceses.` );
      }
      // Pin the rite for THIS request — see fetchCalendar() for why.
      const requestRite = this.#currentRite;
      const requestRevision = ++this.#requestRevision;
      // Since the year parameter will be placed in the path, we extract it from the body params.
      // However, the only body param we need in this case is year_type,
      // so we also extract out all other params in order to discard them.
      const { year, epiphany, ascension, corpus_christi, eternal_high_priest, holydays_of_obligation, ...params } = this.#params;
      this.#currentCategory   = 'national';
      this.#currentCalendarId = calendar_id;
      const resolvedLocale = this.#resolveCalendarLocale('national', calendar_id, locale);

      // Check cache first
      const cacheKey = this.#generateCacheKey('national', calendar_id, year, params.year_type, resolvedLocale, {}, requestRite);
      const cachedData = this.#getCachedData(cacheKey);
      if (cachedData) {
        this.#calendarData = cachedData;
        // The emit stays synchronous, exactly as before: on a hit, listeners have
        // always run before this statement returns, and callers may depend on that.
        // The `try` changes only what the RETURNED PROMISE does. `EventEmitter.emit`
        // is a synchronous `forEach`, so a `calendarFetched` listener that throws —
        // WebCalendar does, on malformed data — used to throw straight out of the
        // fetch method, before any promise existed, and `.catch()` on the call could
        // never see it. On a cache MISS the same throw reaches the caller as a
        // rejection, because the `.catch` below sits above the emit stage. A
        // listener's throw is the listener's bug, but it must reach the caller the
        // same way on a hit as on a miss: cache state is not something a caller
        // controls or can even observe. Do not "simplify" this `try` away — not even
      // now that it sits inside the method-wide `try` above, which would catch the
      // same throw and reject with it identically. This one is what states, at the
      // emit itself, that a listener's throw on a hit is a rejection; it is also
      // what keeps that true if the outer `try` is ever narrowed.
        try {
          this.#eventBus.emit('calendarFetched', cachedData, { rite: requestRite });
        } catch ( error ) {
          return Promise.reject( error );
        }
        return Promise.resolve( cachedData );
      }

      const riteSegment = this.#base.supportsRite ? `/${requestRite}` : '';
      const requestUrl  = `${this.#base.url}${ApiClient.#paths.calendar}${riteSegment}/nation/${calendar_id}${year ? `/${year}` : ''}`;
      return fetch( requestUrl, {
        method: 'POST',
        headers: this.#fetchCalendarHeaders,
        body: JSON.stringify( params )
      }).then( response => {
        if ( false === response.ok ) {
          return response.text()
            .catch( () => null )
            .then( body => {
              throw new ApiClientError(
                `POST ${requestUrl} failed: ${response.status} ${response.statusText}`,
                { url: requestUrl, status: response.status, statusText: response.statusText, body }
              );
            } );
        }
        return response.json();
      }).catch( error => {
        // Deliberately BEFORE the cache/emit stage, not after it. `EventEmitter.emit`
        // is a synchronous `forEach`, so a `calendarFetched` listener that throws —
        // WebCalendar does, on malformed data — used to land in this catch, get
        // relabelled `POST <url> failed: …`, and be re-emitted as
        // `calendarFetchFailed`, handing subscribers both events for one request
        // whose HTTP call had succeeded. A listener's throw is the listener's bug;
        // it now propagates to the returned promise unwrapped and emits nothing.
        const apiError = error instanceof ApiClientError
          ? error
          : new ApiClientError( `POST ${requestUrl} failed: ${error.message}`, { url: requestUrl, cause: error } );
        this.#emitCalendarFetchFailed( apiError, requestRite );
        throw apiError;
      }).then( data => {
        // Cache regardless: the response is valid for its own key even if a newer
        // request has superseded it, and caching it saves refetching later.
        this.#setCachedData(cacheKey, data);
        if ( requestRevision !== this.#requestRevision ) {
          return this.#calendarData;
        }
        this.#calendarData = data;
        this.#eventBus.emit( 'calendarFetched', data, { rite: requestRite } );
        return this.#calendarData;
      });
    } catch ( error ) {
      return Promise.reject( error );
    }
  }

  /**
   * Fetches a diocesan liturgical calendar from the API
   * @param {string} calendar_id - The identifier for the diocesan calendar to fetch
   * @param {string|Intl.Locale} [locale] - The locale for the diocesan calendar
   * @returns {Promise<import('../typedefs.js').CalendarData>} Resolves to THIS request's calendar
   *                                                           data — unless a newer request has
   *                                                           superseded it while it was in
   *                                                           flight, in which case it resolves to
   *                                                           the client's current calendar data
   *                                                           instead: another request's data, or
   *                                                           `{}` if none has landed yet. The
   *                                                           superseded response is still cached
   *                                                           under its own key, but it never
   *                                                           overwrites newer data and no
   *                                                           `calendarFetched` is emitted for it.
   *                                                           Rejects with an `ApiClientError` if
   *                                                           the request fails, after emitting
   *                                                           `calendarFetchFailed`. Rejects with a
   *                                                           plain `Error`, and emits nothing, when
   *                                                           the API cannot serve the current rite.
   *                                                           NOTHING is thrown synchronously, so one
   *                                                           `.catch()` covers every failure mode.
   * @description This method fetches a diocesan liturgical calendar by its ID, and optionally a supported locale. It extracts the year from params
   * to use in the URL path and sends other relevant parameters in the request body. Parameters that determine the dates for
   * epiphany, ascension, corpus_christi, eternal_high_priest are excluded from the request parameters,
   * as these options are built into the Diocesan calendar being requested.
   *
   * If the same calendar with identical parameters was previously fetched, the cached data
   * is returned without making a new API request.
   */
  fetchDiocesanCalendar( calendar_id, locale = '' ) {
    // Every failure of this method is reported by rejecting the returned promise,
    // never by throwing synchronously. It is the contract `init()` already states,
    // extended to the rest of the class for the same reason: a caller who wrote
    // `fetchCalendar( userLocale ).catch( handler )` must have `handler` run for an
    // unusable argument or an unserviceable rite too, not only for a failed request.
    // An error raised before any request goes out rejects with exactly the value it
    // threw — a plain `Error`, never wrapped in an `ApiClientError`, which carries
    // request context there is none of — and emits no `calendarFetchFailed`, which
    // reports a request that failed and not one that was never made.
    //
    // The whole body is enclosed rather than the guards alone, so that a synchronous
    // throw added to this method later cannot escape the contract by sitting outside
    // a narrower `try`.
    try {
      this.#assertRiteSupported();
      // Pin the rite for THIS request. `#currentRite` can change while the
      // request is in flight — a rite change fires one fetch through the calendar
      // select and another through the rite listener — so a listener reading the
      // client's current rite when the response lands could pair one rite's data
      // with the other rite's name.
      const requestRite = this.#currentRite;
      const requestRevision = ++this.#requestRevision;
      // Since the year parameter will be placed in the path, we extract it from the body params.
      // However, the only body param we need in this case is year_type,
      // so we also extract out all other params in order to discard them.
      const { year, epiphany, ascension, corpus_christi, eternal_high_priest, holydays_of_obligation, ...params } = this.#params;
      this.#currentCategory = 'diocesan';
      this.#currentCalendarId = calendar_id;
      const resolvedLocale = this.#resolveCalendarLocale('diocesan', calendar_id, locale);

      // Check cache first
      const cacheKey = this.#generateCacheKey('diocesan', calendar_id, year, params.year_type, resolvedLocale, {}, requestRite);
      const cachedData = this.#getCachedData(cacheKey);
      if (cachedData) {
        this.#calendarData = cachedData;
        // The emit stays synchronous, exactly as before: on a hit, listeners have
        // always run before this statement returns, and callers may depend on that.
        // The `try` changes only what the RETURNED PROMISE does. `EventEmitter.emit`
        // is a synchronous `forEach`, so a `calendarFetched` listener that throws —
        // WebCalendar does, on malformed data — used to throw straight out of the
        // fetch method, before any promise existed, and `.catch()` on the call could
        // never see it. On a cache MISS the same throw reaches the caller as a
        // rejection, because the `.catch` below sits above the emit stage. A
        // listener's throw is the listener's bug, but it must reach the caller the
        // same way on a hit as on a miss: cache state is not something a caller
        // controls or can even observe. Do not "simplify" this `try` away — not even
      // now that it sits inside the method-wide `try` above, which would catch the
      // same throw and reject with it identically. This one is what states, at the
      // emit itself, that a listener's throw on a hit is a rejection; it is also
      // what keeps that true if the outer `try` is ever narrowed.
        try {
          this.#eventBus.emit('calendarFetched', cachedData, { rite: requestRite });
        } catch ( error ) {
          return Promise.reject( error );
        }
        return Promise.resolve( cachedData );
      }

      const riteSegment = this.#base.supportsRite ? `/${requestRite}` : '';
      const requestUrl  = `${this.#base.url}${ApiClient.#paths.calendar}${riteSegment}/diocese/${calendar_id}${year ? `/${year}` : ''}`;
      return fetch( requestUrl, {
        method: 'POST',
        headers: this.#fetchCalendarHeaders,
        body: JSON.stringify( params )
      }).then( response => {
        if ( false === response.ok ) {
          return response.text()
            .catch( () => null )
            .then( body => {
              throw new ApiClientError(
                `POST ${requestUrl} failed: ${response.status} ${response.statusText}`,
                { url: requestUrl, status: response.status, statusText: response.statusText, body }
              );
            } );
        }
        return response.json();
      }).catch( error => {
        // Deliberately BEFORE the cache/emit stage, not after it. `EventEmitter.emit`
        // is a synchronous `forEach`, so a `calendarFetched` listener that throws —
        // WebCalendar does, on malformed data — used to land in this catch, get
        // relabelled `POST <url> failed: …`, and be re-emitted as
        // `calendarFetchFailed`, handing subscribers both events for one request
        // whose HTTP call had succeeded. A listener's throw is the listener's bug;
        // it now propagates to the returned promise unwrapped and emits nothing.
        const apiError = error instanceof ApiClientError
          ? error
          : new ApiClientError( `POST ${requestUrl} failed: ${error.message}`, { url: requestUrl, cause: error } );
        this.#emitCalendarFetchFailed( apiError, requestRite );
        throw apiError;
      }).then( data => {
        // Cache regardless: the response is valid for its own key even if a newer
        // request has superseded it, and caching it saves refetching later.
        this.#setCachedData(cacheKey, data);
        if ( requestRevision !== this.#requestRevision ) {
          return this.#calendarData;
        }
        this.#calendarData = data;
        this.#eventBus.emit( 'calendarFetched', data, { rite: requestRite } );
        return this.#calendarData;
      });
    } catch ( error ) {
      return Promise.reject( error );
    }
  }

  /**
   * Subscribes a listener to one of this client's events.
   *
   * Events: `calendarFetched` — `( data, { rite } )` — and `calendarFetchFailed`
   * — `( error, { rite } )`.
   *
   * @param {string} event - The event name.
   * @param {Function} listener - The listener to invoke.
   * @returns {ApiClient} This client, for chaining.
   */
  on( event, listener ) {
    this.#eventBus.on( event, listener );
    return this;
  }

  /**
   * Subscribes this client to changes in a UI component, so that the calendar is
   * refetched when the user changes the selection.
   *
   * Dispatches on the component's type:
   * - `CalendarSelect` — refetches for the selected nation or diocese, or for the
   *   rite-level calendar when the empty option is chosen.
   * - `RiteSelect` — sets the rite and re-issues the request. Any current calendar
   *   selection is dropped first, since a `calendar_id` from one rite is never
   *   valid under another.
   * - `ApiOptions` — refetches when any of the request parameter inputs change.
   *
   * Chainable, so several components can be wired in one expression:
   * `apiClient.listenTo( calendarSelect ).listenTo( riteSelect )`.
   *
   * @param {CalendarSelect|RiteSelect|ApiOptions} uiComponent - The component to listen to.
   * @returns {ApiClient} This instance, for chaining.
   * @throws {Error} If the argument is not one of the three supported types.
   * @throws {Error} If a `CalendarSelect` or `ApiOptions` is bound to a different API base
   *                 than this client.
   */
  listenTo( uiComponent = null ) {
    if ( false === uiComponent instanceof CalendarSelect
      && false === uiComponent instanceof ApiOptions
      && false === uiComponent instanceof RiteSelect ) {
      throw new Error( 'ApiClient.listenTo(): Expected an instance of CalendarSelect, RiteSelect or ApiOptions' );
    }
    // A `RiteSelect` is deliberately not checked: it builds its options from the
    // `Rite` enum, reads no metadata and therefore holds no base, so there is
    // nothing to compare it against.
    if ( uiComponent instanceof CalendarSelect || uiComponent instanceof ApiOptions ) {
      const componentName = uiComponent instanceof CalendarSelect ? 'CalendarSelect' : 'ApiOptions';
      assertSameBase(
        this.#base, uiComponent._base,
        `ApiClient.listenTo(): this ApiClient and the ${componentName} passed to it`,
        'Every change in that component would send this client after a calendar_id the other API serves, against an API that does not.'
      );
    }
    if (uiComponent instanceof CalendarSelect) {
      return this.#listenToCalendarSelect( uiComponent );
    } else if (uiComponent instanceof RiteSelect) {
      return this.#listenToRiteSelect( uiComponent );
    } else if (uiComponent instanceof ApiOptions) {
      return this.#listenToApiOptions( uiComponent );
    }
  }

  /**
   * Listens to changes in the CalendarSelect instance and fetches the corresponding calendar from the API.
   * @param {CalendarSelect} calendarSelect - The CalendarSelect instance to listen to
   * @throws {Error} If the provided argument is not an instance of CalendarSelect
   * @returns {ApiClient} The current instance
   */
  #listenToCalendarSelect( calendarSelect = null ) {
    if ( false === calendarSelect instanceof CalendarSelect ) {
      throw new Error( 'Expected an instance of CalendarSelect' );
    }
    if ( null === calendarSelect ) {
      throw new Error( 'Expected an instance of CalendarSelect' );
    }
    calendarSelect._domElement.addEventListener( 'change', () => {
      const selectedOption = calendarSelect._domElement.selectedOptions[0];
      this.#currentCalendarId = selectedOption.value;
      this.#currentCategory = selectedOption.dataset.calendartype ?? '';
      if ( this.#currentCategory === 'national' ) {
        this.#discardRequest( this.fetchNationalCalendar( this.#currentCalendarId ) );
      } else if ( this.#currentCategory === 'diocesan' ) {
        this.#discardRequest( this.fetchDiocesanCalendar( this.#currentCalendarId ) );
      } else {
        this.#discardRequest( this.fetchCalendar() );
      }
    });
    return this;
  }

  /**
   * Attaches a change listener to a RiteSelect, so that changing the rite
   * re-issues the request under the new rite.
   *
   * Any current selection is dropped and the request re-targeted at the
   * incoming rite-level calendar. A calendar_id from one rite is never valid
   * under another — the same rule ApiOptions applies when it resets the
   * calendar selection — and that holds for dioceses in BOTH directions, not
   * only for the national tier: `/calendar/ambrosian/diocese/romamo_it` and
   * `/calendar/roman/diocese/lugano_ch` are both 400.
   *
   * This falls back rather than throwing: a user switching rites is not a
   * programming error. The throw in `fetchNationalCalendar()` still covers the
   * programmatic case.
   *
   * Note that wiring both an ApiOptions and an ApiClient to the same RiteSelect
   * produces two requests per rite change. `ApiOptions#handleLinkedRiteSelect`
   * resets the calendar selection and dispatches `change` on it synchronously,
   * which fetches under the outgoing rite before this listener runs. The final
   * state is correct and the cache absorbs part of the cost.
   *
   * @param {RiteSelect} riteSelect - The RiteSelect instance to listen to.
   * @returns {ApiClient} This instance, for chaining.
   * @throws {Error} If the argument is not a RiteSelect.
   * @private
   */
  #listenToRiteSelect( riteSelect = null ) {
    if ( false === riteSelect instanceof RiteSelect ) {
      throw new Error( 'Expected an instance of RiteSelect' );
    }
    riteSelect._domElement.addEventListener( 'change', ( ev ) => {
      this.rite( ev.target.value );
      this.#currentCategory   = '';
      this.#currentCalendarId = '';
      this.#discardRequest( this.refetchCalendarData() );
    });
    return this;
  }

  /**
   * Listens to changes in the API options and updates the parameters accordingly.
   *
   * This function attaches event listeners to various inputs within the ApiOptions instance.
   * When the user changes the value of these inputs, the corresponding parameter in the
   * request configuration is updated. If the current category is not set, it triggers
   * a refetch of the calendar data.
   *
   * @param {ApiOptions} apiOptions - The ApiOptions instance containing inputs to listen to
   * @throws {Error} If the provided argument is not an instance of ApiOptions
   * @returns {ApiClient} The current instance
   */
  #listenToApiOptions(apiOptions = null) {
    if (false === apiOptions instanceof ApiOptions) {
      throw new Error('Expected an instance of ApiOptions');
    }
    if (null === apiOptions) {
      throw new Error('Expected an instance of ApiOptions');
    }
    apiOptions._epiphanyInput._domElement.addEventListener( 'change', event => {
      this.#params.epiphany = event.target.value;
      //console.log(`updated epiphany to ${this.#params.epiphany}`);
      if (this.#currentCategory === '') {
        this.#discardRequest( this.refetchCalendarData() );
      }
    });
    apiOptions._ascensionInput._domElement.addEventListener( 'change', event => {
      this.#params.ascension = event.target.value;
      //console.log(`updated ascension to ${this.#params.ascension}`);
      if (this.#currentCategory === '') {
        this.#discardRequest( this.refetchCalendarData() );
      }
    });
    apiOptions._corpusChristiInput._domElement.addEventListener( 'change', event => {
      this.#params.corpus_christi = event.target.value;
      //console.log(`updated corpus_christi to ${this.#params.corpus_christi}`);
      if (this.#currentCategory === '') {
        this.#discardRequest( this.refetchCalendarData() );
      }
    });
    apiOptions._eternalHighPriestInput._domElement.addEventListener( 'change', event => {
      this.#params.eternal_high_priest = event.target.value === 'true';
      //console.log(`updated eternal_high_priest to ${this.#params.eternal_high_priest}`);
      if (this.#currentCategory === '') {
        this.#discardRequest( this.refetchCalendarData() );
      }
    });
    apiOptions._holydaysOfObligationInput._domElement.addEventListener( 'change', event => {
      const selectedStates = Object.fromEntries(
        Array.from(event.target.options, opt => [opt.value, opt.selected])
      );
      this.#params.holydays_of_obligation = selectedStates;
      //console.log('updated holydays_of_obligation to:', this.#params.holydays_of_obligation);
      if (this.#currentCategory === '') {
        this.#discardRequest( this.refetchCalendarData() );
      }
    });
    apiOptions._yearInput._domElement.addEventListener( 'change', event => {
      this.#params.year = parseInt(event.target.value, 10);
      //console.log(`updated year to ${this.#params.year}`);
      this.#discardRequest( this.refetchCalendarData() );
    });
    apiOptions._yearTypeInput._domElement.addEventListener( 'change', event => {
      this.#params.year_type = event.target.value;
      //console.log(`updated year_type to ${this.#params.year_type}`);
      this.#discardRequest( this.refetchCalendarData() );
    });
    apiOptions._localeInput._domElement.addEventListener( 'change', event => {
      this.#fetchCalendarHeaders['Accept-Language'] = event.target.value;
      //console.log(`updated locale to ${this.#fetchCalendarHeaders['Accept-Language']}`);
      this.#discardRequest( this.refetchCalendarData() );
    });
    return this;
  }

  /**
   * Set the year for which the calendar is to be retrieved.
   * @param {number} yearValue - The year for which to retrieve the calendar. Must be a number and be between 1970 and 9999.
   * @throws {Error} If no year is given, or if the year is not a number, or if the year is not between 1970 and 9999.
   * @returns {ApiClient} The current instance for method chaining.
   */
  year( yearValue ) {
    if (yearValue !== undefined) {
      if (typeof yearValue !== 'number' || !Number.isInteger(yearValue) || yearValue < 1970 || yearValue > 9999) {
        throw new Error('year must be a number and be between 1970 and 9999');
      }
      this.#params.year = yearValue;
    } else {
      throw new Error('year parameter is required');
    }
    return this;
  }

  /**
   * Set the type of the year for which the calendar is to be retrieved.
   * @param {YearType} yearTypeValue - The type of the year for which to retrieve the calendar. Must be either LITURGICAL or CIVIL.
   * @throws {Error} If no year_type is given, or if the year_type is not either LITURGICAL or CIVIL.
   * @returns {ApiClient} The current instance for method chaining.
   */
  yearType( yearTypeValue ) {
    if (yearTypeValue !== undefined) {
      if (yearTypeValue !== YearType.LITURGICAL && yearTypeValue !== YearType.CIVIL) {
        throw new Error('year_type must be either LITURGICAL or CIVIL');
      }
      this.#params.year_type = yearTypeValue;
    }
    return this;
  }

  /**
   * Sets the liturgical rite for subsequent calendar requests.
   *
   * The rite is a path segment rather than a query parameter, so it is kept out
   * of `#params` and composed into the URL by the fetch methods.
   *
   * @param {'roman' | 'ambrosian'} riteValue - A value of the `Rite` enum.
   * @returns {ApiClient} This instance, for chaining.
   * @throws {Error} If `riteValue` is not a value of the `Rite` enum.
   */
  rite( riteValue ) {
    if ( false === Object.values( Rite ).includes( riteValue ) ) {
      throw new Error( `ApiClient.rite: value must be a valid Rite, one of ${Object.values( Rite ).join( ', ' )}, but found: ${String( riteValue )}` );
    }
    this.#currentRite = riteValue;
    return this;
  }

  /**
   * @deprecated Use year() instead. This method will be removed in a future version.
   * @param {number} year - The year for which to retrieve the calendar.
   * @returns {ApiClient} The current instance for method chaining.
   */
  setYear( year ) {
    console.warn('ApiClient.setYear() is deprecated. Use ApiClient.year() instead.');
    return this.year(year);
  }

  /**
   * @deprecated Use yearType() instead. This method will be removed in a future version.
   * @param {YearType} year_type - The type of the year.
   * @returns {ApiClient} The current instance for method chaining.
   */
  setYearType( year_type ) {
    console.warn('ApiClient.setYearType() is deprecated. Use ApiClient.yearType() instead.');
    return this.yearType(year_type);
  }

  /**
   * The calendar index of the first registered base.
   *
   * @deprecated Read `apiClient.base.metadata` instead. With more than one base
   *             registered this getter cannot know which one the caller means, and
   *             answers with the first.
   * @returns {import('../typedefs.js').CalendarIndex|null}
   * @static
   */
  static get _metadata() {
    ApiClient.#warnAmbiguousStatic( '_metadata' );
    return ApiBase.default?.metadata ?? null;
  }

  /**
   * The URL of the first registered base.
   *
   * @deprecated Read `apiClient.base.url` instead.
   * @returns {string|null}
   * @static
   */
  static get _apiUrl() {
    ApiClient.#warnAmbiguousStatic( '_apiUrl' );
    return ApiBase.default?.url ?? null;
  }

  /**
   * Warns that a deprecated static was read while more than one base was registered.
   *
   * Silent only in the single-base case, which is every page written before this
   * release. Silent ambiguity is the failure this release removes; a fallback that
   * never says which base it picked would reintroduce it.
   *
   * @param {string} accessor - The name of the accessor being read.
   * @returns {void}
   * @private
   */
  static #warnAmbiguousStatic( accessor ) {
    if ( ApiBase.all.length > 1 ) {
      console.warn( `ApiClient.${accessor} is ambiguous: ${ApiBase.all.length} API bases are registered, and it resolved to ${ApiBase.default.url}. Read it from a specific client instead, as apiClient.base.` );
    }
  }

  /**
   * The calendar index of the base this client is bound to.
   *
   * @returns {import('../typedefs.js').CalendarIndex|null}
   */
  get _metadata() {
    return this.#base.metadata;
  }

  /**
   * The liturgical rite the current request is computed under.
   *
   * @type {'roman' | 'ambrosian'}
   */
  get _currentRite() {
    return this.#currentRite;
  }

  /**
   * The URL of the base this client is bound to, which it issues its requests against.
   *
   * @returns {string} The API URL.
   */
  get _apiUrl() {
    return this.#base.url;
  }

  /**
   * @returns {import('../typedefs.js').CalendarData} The currently cached calendar data.
   * This property can be used to retrieve the current liturgical calendar data.
   * Note that the data is only available after `fetchCalendar()`, `fetchNationalCalendar()`,
   * or `fetchDiocesanCalendar()` has been called.
   */
  get _calendarData() {
    return this.#calendarData;
  }

  /**
   * The event bus that can be used to subscribe to events emitted by the ApiClient.
   *
   * The event bus emits events of type `calendarFetched` when a new calendar is fetched
   * from the API. The event detail is an object of type `CalendarData` containing the
   * liturgical events of the fetched calendar.
   * @type {EventEmitter}
   */
  get _eventBus() {
    return this.#eventBus;
  }
}
