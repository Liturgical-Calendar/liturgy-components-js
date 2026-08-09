import ApiClientError from './ApiClientError.js';
import { Rite } from '../Enums.js';
import { describeType } from '../OptionsValidation.js';

/**
 * Component class names that have already been warned about an ambiguous fallback.
 *
 * Module-level so the ledger is per session rather than per call: the warning
 * reports a systemic misconfiguration of the page, not a per-instance event, and
 * a component that builds sub-components (`ApiOptions` building a `LocaleInput`)
 * would otherwise emit the identical line once per constructed part. Keyed by
 * component name so each class still gets its own first warning.
 *
 * Cleared by {@link ApiBase.reset}, which starts a fresh registry: warnings about
 * a registry that no longer exists should not silence warnings about the new one.
 *
 * @type {Set<string>}
 */
const warnedComponents = new Set();

/**
 * One Liturgical Calendar API base URL, and everything that belongs to it: the
 * calendar index served by its `/calendars` path, and the cache of calendar
 * responses fetched from it.
 *
 * A static registry keyed by normalized URL deduplicates bases, so two clients
 * pointed at the same API share one metadata fetch and one cache while remaining
 * independent objects themselves.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */
export default class ApiBase {

    /** @type {Map<string, ApiBase>} Registry keyed by normalized URL, in registration order. */
    static #registry = new Map();

    /** @type {string} */
    static #defaultUrl = 'https://litcal.johnromanodorazio.com/api/dev';

    /** @type {number} Maximum cached responses per base. */
    static #maxEntries = 50;

    /** @type {number|null} Cache entry lifetime in milliseconds, or null for no expiry. */
    static #ttl = null;

    /** @type {string} */
    #url;

    /** @type {import('../typedefs.js').CalendarIndex|null} */
    #metadata = null;

    /** @type {Promise<ApiBase>|null} The in-flight `/calendars` request, if any. */
    #loadPromise = null;

    /** @type {Map<string, {data: object, timestamp: number}>} Responses fetched from this base, in least-recently-read order. */
    #cache = new Map();

    /**
     * Not for direct use: obtain a base through {@link ApiBase.resolve} or
     * {@link ApiBase.fromMetadata} so that it is registered.
     *
     * @param {string} url - An already normalized base URL.
     */
    constructor( url ) {
        this.#url = url;
    }

    /**
     * The base URL used when none is supplied.
     *
     * @returns {string}
     */
    static get DEFAULT_URL() {
        return ApiBase.#defaultUrl;
    }

    /**
     * Normalizes a base URL for use as a registry key.
     *
     * Strips trailing slashes and surrounding whitespace, and nothing else: two
     * URLs that differ in host or port are two bases even when they happen to
     * resolve to the same server, because guessing otherwise would be worse than
     * the duplicate. In particular the scheme and host are NOT lowercased and the
     * path is not collapsed, so `HTTP://Example.org` and `http://example.org` stay
     * two keys.
     *
     * The result is then required to be an absolute `http:` or `https:` URL. It is
     * interpolated straight into `fetch( \`${url}/calendars\` )`, so anything else
     * resolves relative to the document and 404s — silently, and far from its cause.
     * Relative bases such as `/api` are deliberately not special-cased: a same-origin
     * deployment can pass an absolute URL, and admitting a relative form would
     * reintroduce the very ambiguity this check closes.
     *
     * @param {string} url - The URL to normalize.
     * @returns {string} The normalized URL.
     * @throws {Error} If the URL is not a non-empty string, or is not an absolute `http:` or `https:` URL.
     */
    static normalizeUrl( url ) {
        if ( typeof url !== 'string' || url.trim() === '' ) {
            throw new Error( 'ApiBase: url must be a non-empty string, but found: ' + String( url ) );
        }
        const trimmed    = url.trim();
        const normalized = trimmed.replace( /\/+$/, '' );
        ApiBase.#assertAbsoluteHttpUrl( normalized, trimmed );
        return normalized;
    }

    /**
     * Asserts that a normalized base URL is an absolute `http:` or `https:` URL.
     *
     * Parsing alone is not enough, and in one case is actively harmful: `new URL()`
     * happily accepts `localhost:8000`, yielding a URL whose protocol is
     * `localhost:` and whose host is empty. A caller who omitted the scheme —
     * a plausible typo, since every example here writes `http://localhost:8000` —
     * would pass a `URL.canParse()` test and then get a silent 404. `javascript:`,
     * `data:`, `mailto:` and `ftp://` parse just as happily. So the protocol is
     * asserted, not merely the parse.
     *
     * The rejections are told apart rather than collapsed into one message, because
     * they call for different corrections. A caller who omitted the scheme is shown
     * the URL they almost certainly meant; a caller who chose `javascript:` is told
     * which scheme was found, and must not be advised to write
     * `http://javascript:alert(1)`.
     *
     * @param {string} normalized - The trimmed, trailing-slash-stripped URL.
     * @param {string} original - The trimmed URL as the caller wrote it, for the message.
     * @returns {void}
     * @throws {Error} If the URL is not an absolute `http:` or `https:` URL.
     * @private
     */
    static #assertAbsoluteHttpUrl( normalized, original ) {
        let parsed = null;
        try {
            parsed = new URL( normalized );
        } catch {
            parsed = null;
        }

        if ( null !== parsed && ( 'http:' === parsed.protocol || 'https:' === parsed.protocol ) ) {
            return;
        }

        const suggestion = ApiBase.#httpSuggestion( normalized );
        if ( null !== suggestion ) {
            throw new Error( `ApiBase: url must be an absolute http: or https: URL, but found: ${original} — which carries no scheme. Did you mean ${suggestion}?` );
        }

        if ( null !== parsed ) {
            throw new Error( `ApiBase: url must be an absolute http: or https: URL, but found: ${original} — whose scheme is ${parsed.protocol}. The base is fetched over HTTP; no other scheme can serve /calendars.` );
        }

        throw new Error( `ApiBase: url must be an absolute http: or https: URL, but found: ${original} — which is not a URL. A relative base is not supported: it would resolve /calendars against the document and 404 silently.` );
    }

    /**
     * The `http://` URL a scheme-less base URL was probably meant to be, if it was
     * meant to be one at all.
     *
     * Recognizes the three shapes that are an omitted scheme rather than a chosen
     * one: a bare `host:port` (`localhost:8000`), a bare host with an optional path
     * (`example.org/api`), and a protocol-relative URL (`//example.org/api`). A
     * value that already carries `scheme://` is excluded, so `ftp://x/y` is reported
     * as the wrong scheme rather than as a missing one. So is a bare `scheme:`
     * prefix whose remainder is not a port — `mailto:someone@example.org` is a
     * scheme the caller chose, whereas `localhost:8000` is a host and a port.
     *
     * A single leading slash (`/api`) yields null: it is a relative path, and
     * neither `http:///api` nor `http://api` is what the caller meant, so there is
     * nothing honest to suggest.
     *
     * @param {string} normalized - The trimmed, trailing-slash-stripped URL.
     * @returns {string|null} The suggested absolute URL, or null if none can be inferred.
     * @private
     */
    static #httpSuggestion( normalized ) {
        // Already carries an explicit scheme and authority: the scheme was chosen, not omitted.
        if ( /^[a-zA-Z][a-zA-Z0-9+.\-]*:\/\//.test( normalized ) ) {
            return null;
        }
        // A bare `something:` prefix is an omitted scheme only when what follows is a port.
        if ( /^[^/:?#]+:/.test( normalized ) && false === /^[^/:?#]+:\d+(?:[/?#]|$)/.test( normalized ) ) {
            return null;
        }
        // A single leading slash is a relative path, not an authority.
        if ( normalized.startsWith( '/' ) && false === normalized.startsWith( '//' ) ) {
            return null;
        }
        const candidate = normalized.startsWith( '//' ) ? `http:${normalized}` : `http://${normalized}`;
        try {
            return '' === new URL( candidate ).hostname ? null : candidate;
        } catch {
            return null;
        }
    }

    /**
     * Asserts that a calendar index carries the fields every component reads, as
     * the arrays every component reads them as.
     *
     * Both entry points that install metadata run this, because an index missing
     * `national_calendars`, `diocesan_calendars` or `locales` is not a usable
     * calendar index: without the check it reaches a component and surfaces as a
     * bare `TypeError: undefined is not iterable` — or, for `locales`, as
     * `Cannot read properties of undefined (reading 'includes')` from
     * `ApiClient.fetchCalendar` on the request path — naming neither the missing
     * field nor the API that omitted it. `fromMetadata` needs it as much as `load`
     * does — it is how every fixture in the test suite is built, so an incomplete
     * fixture would otherwise fail far from its cause.
     *
     * Presence alone is not enough, and the gap reproduces the very failure the
     * check exists to prevent, one step further down: an index carrying
     * `locales: {}` passes a presence test, and then `this.#base.locales()` hands
     * that object to `ApiClient.fetchCalendar`, where `.includes( … )` throws the
     * same anonymous `TypeError` — now with a field that IS present, so the message
     * would have been actively misleading had it named absence. The three are
     * therefore required to be arrays, and the message names the field, the base
     * URL and the type actually found.
     *
     * The index ITSELF is an object, not an array — `litcal_metadata` is a keyed
     * record of calendar lists — which is why the outer check rejects arrays
     * outright rather than requiring one.
     *
     * @param {unknown} metadata - The candidate calendar index.
     * @param {string} url - The normalized base URL, for the message.
     * @returns {void}
     * @throws {Error} If the index is not an object, or omits a required field, or carries one that is not an array.
     * @private
     */
    static #assertValidIndex( metadata, url ) {
        if ( null === metadata || typeof metadata !== 'object' || Array.isArray( metadata ) ) {
            throw new Error( `ApiBase: the calendar index of the base at ${url} must be an object, but found: ${Array.isArray( metadata ) ? 'array' : typeof metadata}.` );
        }
        [ 'national_calendars', 'diocesan_calendars', 'locales' ].forEach( field => {
            if ( false === Object.hasOwn( metadata, field ) ) {
                throw new Error( `ApiBase: the calendar index of the base at ${url} carries no \`${field}\` field. Every component reads it; an index without it is not a usable calendar index.` );
            }
            if ( false === Array.isArray( metadata[ field ] ) ) {
                throw new Error( `ApiBase: the \`${field}\` field of the calendar index of the base at ${url} must be an array, but found: ${describeType( metadata[ field ] )}. Every component iterates it; anything else surfaces later as a bare TypeError naming neither the field nor the API that served it.` );
            }
        } );
    }

    /**
     * Returns the registered base for a URL, registering an unloaded one if absent.
     *
     * Never performs a network request; call {@link ApiBase#load} for that.
     *
     * @param {string} [url] - The base URL. Defaults to {@link ApiBase.DEFAULT_URL}.
     * @returns {ApiBase}
     */
    static resolve( url = ApiBase.#defaultUrl ) {
        const normalized = ApiBase.normalizeUrl( url );
        if ( false === ApiBase.#registry.has( normalized ) ) {
            ApiBase.#registry.set( normalized, new ApiBase( normalized ) );
        }
        return ApiBase.#registry.get( normalized );
    }

    /**
     * Registers an already loaded base from a metadata object, without any network
     * request.
     *
     * Hydrates the base **in place**. The object registered for a URL is created
     * once and never replaced, so a component that resolved the base earlier reads
     * an index installed later. Registering a fresh object instead would leave every
     * earlier reference holding an orphan — same URL, its own metadata, its own
     * response cache — which is precisely the divergence the registry exists to
     * prevent.
     *
     * The index supplied wins whether or not the base already carried one, so
     * fixture setup needs no {@link ApiBase.reset} first: requiring one would be a
     * trap in a `beforeEach`, where forgetting it once silently reuses the previous
     * index. The base's response cache is emptied for the same reason it would have
     * started empty before — a base whose index has just been redefined must not
     * answer from the one it replaced.
     *
     * The index is validated BEFORE the base is resolved, so a rejected call neither
     * registers a new base nor half-hydrates an existing one.
     *
     * @param {string} url - The base URL.
     * @param {import('../typedefs.js').CalendarIndex} metadata - The calendar index.
     * @returns {ApiBase} The base registered for the URL — the same object on every call for a given URL.
     * @throws {Error} If the metadata is not an object, or omits `national_calendars`, `diocesan_calendars` or `locales`, or carries any of the three as something other than an array.
     */
    static fromMetadata( url, metadata ) {
        const normalized = ApiBase.normalizeUrl( url );
        ApiBase.#assertValidIndex( metadata, normalized );
        const base = ApiBase.resolve( normalized );
        base.#metadata = metadata;
        base.clearCache();
        return base;
    }

    /**
     * The first base registered, which unbound components fall back to.
     *
     * @returns {ApiBase|null} Null when no base is registered.
     */
    static get default() {
        const first = ApiBase.#registry.values().next();
        return first.done ? null : first.value;
    }

    /**
     * Every registered base, in registration order.
     *
     * @returns {ApiBase[]}
     */
    static get all() {
        return Array.from( ApiBase.#registry.values() );
    }

    /**
     * Empties the registry, and the ledger of components already warned about an
     * ambiguous fallback.
     *
     * @returns {void}
     */
    static reset() {
        ApiBase.#registry.clear();
        warnedComponents.clear();
    }

    /**
     * The normalized base URL.
     *
     * @returns {string}
     */
    get url() {
        return this.#url;
    }

    /**
     * The calendar index served by this base's `/calendars` path.
     *
     * @returns {import('../typedefs.js').CalendarIndex|null} Null until loaded.
     */
    get metadata() {
        return this.#metadata;
    }

    /**
     * Whether this base's metadata has been loaded.
     *
     * @returns {boolean}
     */
    get isLoaded() {
        return this.#metadata !== null;
    }

    /**
     * Loads this base's calendar index, once.
     *
     * Idempotent, and safe to call concurrently: a load already in flight is
     * returned rather than duplicated, so two panes on one base issue a single
     * request. On failure the in-flight promise is cleared so that a later call
     * can retry.
     *
     * @returns {Promise<ApiBase>} Resolves to this base once its metadata is loaded.
     * @throws {ApiClientError} If the request fails or the response carries no `litcal_metadata` — unless
     *         an index was installed by {@link ApiBase.fromMetadata} while the request was open, in which
     *         case the promise resolves to the loaded base.
     */
    load() {
        if ( this.#metadata !== null ) {
            return Promise.resolve( this );
        }
        if ( this.#loadPromise !== null ) {
            return this.#loadPromise;
        }

        const requestUrl = `${this.#url}/calendars`;

        this.#loadPromise = fetch( requestUrl ).then( response => {
            if ( false === response.ok ) {
                return response.text()
                    .catch( () => null )
                    .then( body => {
                        throw new ApiClientError(
                            `GET ${requestUrl} failed: ${response.status} ${response.statusText}`,
                            { url: requestUrl, status: response.status, statusText: response.statusText, body }
                        );
                    } );
            }
            return response.json();
        } ).then( data => {
            if ( null === data || typeof data !== 'object' || false === Object.hasOwn( data, 'litcal_metadata' ) ) {
                throw new ApiClientError(
                    `GET ${requestUrl} returned no litcal_metadata property`,
                    { url: requestUrl }
                );
            }
            // A plain Error here is deliberate: the `catch` below wraps anything
            // that is not already an ApiClientError, so the message survives and
            // callers still see the ApiClientError that `load()` promises.

            // An index may have been installed by `fromMetadata()` — a fixture, or a
            // server-rendered payload — while this request was in flight. It wins: an
            // explicit call outranks a background fetch. The response is dropped without
            // being validated as a calendar index — `#assertValidIndex` below is skipped —
            // because it is no longer what anyone will read, and rejecting here would fail
            // a `load()` on a base that is loaded.
            if ( this.#metadata !== null ) {
                this.#loadPromise = null;
                return this;
            }

            ApiBase.#assertValidIndex( data.litcal_metadata, this.#url );
            this.#metadata    = data.litcal_metadata;
            this.#loadPromise = null;
            return this;
        } ).catch( error => {
            this.#loadPromise = null;
            // An index installed by `fromMetadata()` while this request was open
            // outranks the request, and outranks its failure too: the base is
            // loaded, so `load()`'s contract — resolve once the metadata is
            // there — is satisfied, and rejecting would report a base as
            // unloadable while it is loaded.
            if ( this.#metadata !== null ) {
                return this;
            }
            if ( error instanceof ApiClientError ) {
                throw error;
            }
            throw new ApiClientError(
                `GET ${requestUrl} failed: ${error.message}`,
                { url: requestUrl, cause: error }
            );
        } );

        return this.#loadPromise;
    }

    /**
     * Configures the response cache for every base.
     *
     * Global rather than per-base: no use case has asked for one base to cache
     * differently from another.
     *
     * @param {object} [limits] - The limits to apply. Omitted keys are left unchanged.
     * @param {number} [limits.maxEntries] - Maximum cached responses per base. Must be a positive integer.
     * @param {number|null} [limits.ttl] - Entry lifetime in milliseconds, or null for no expiry.
     * @returns {void}
     * @throws {Error} If a supplied limit is out of range.
     */
    static cacheLimits( { maxEntries, ttl } = {} ) {
        if ( maxEntries !== undefined ) {
            if ( false === Number.isInteger( maxEntries ) || maxEntries < 1 ) {
                throw new Error( 'ApiBase.cacheLimits: maxEntries must be a positive integer, but found: ' + String( maxEntries ) );
            }
            ApiBase.#maxEntries = maxEntries;
            // A lowered limit must apply immediately: a base that is never written to
            // again would otherwise stay over the new limit indefinitely, since
            // `setCached()` is the only other place trimming happens.
            ApiBase.#registry.forEach( base => base.#trimCache() );
        }
        if ( ttl !== undefined ) {
            if ( ttl !== null && ( false === Number.isFinite( ttl ) || ttl <= 0 ) ) {
                throw new Error( 'ApiBase.cacheLimits: ttl must be null or a positive number of milliseconds, but found: ' + String( ttl ) );
            }
            ApiBase.#ttl = ttl;
        }
    }

    /**
     * Evicts the least recently read entries beyond the current `maxEntries` limit.
     *
     * Shared by {@link ApiBase#setCached}, which trims as it writes, and
     * {@link ApiBase.cacheLimits}, which must trim every registered base immediately
     * when `maxEntries` is lowered — otherwise a base that is never written to again
     * stays over the new limit indefinitely. The cache `Map` is kept in
     * least-recently-read order by {@link ApiBase#getCached} and
     * {@link ApiBase#setCached}, so eviction is always from the front.
     *
     * @returns {void}
     * @private
     */
    #trimCache() {
        while ( this.#cache.size > ApiBase.#maxEntries ) {
            const oldest = this.#cache.keys().next().value;
            this.#cache.delete( oldest );
        }
    }

    /**
     * Empties the response cache of every registered base.
     *
     * @returns {void}
     */
    static clearAllCaches() {
        ApiBase.#registry.forEach( base => base.clearCache() );
    }

    /**
     * Reads a cached response.
     *
     * A read moves the entry to the end of the insertion order, so that the map's
     * own ordering is least-recently-read first and eviction needs no separate
     * bookkeeping.
     *
     * @param {string} key - The cache key.
     * @returns {object|null} The cached data, or null on a miss or an expired entry.
     */
    getCached( key ) {
        if ( false === this.#cache.has( key ) ) {
            return null;
        }
        const entry = this.#cache.get( key );
        if ( ApiBase.#ttl !== null && Date.now() - entry.timestamp > ApiBase.#ttl ) {
            this.#cache.delete( key );
            return null;
        }
        this.#cache.delete( key );
        this.#cache.set( key, entry );
        return entry.data;
    }

    /**
     * Stores a response, evicting the least recently read entries beyond the limit.
     *
     * @param {string} key - The cache key.
     * @param {object} data - The response data to cache.
     * @returns {void}
     */
    setCached( key, data ) {
        this.#cache.delete( key );
        this.#cache.set( key, { data, timestamp: Date.now() } );
        while ( this.#cache.size > ApiBase.#maxEntries ) {
            const oldest = this.#cache.keys().next().value;
            this.#cache.delete( oldest );
        }
    }

    /**
     * Empties this base's response cache.
     *
     * @returns {void}
     */
    clearCache() {
        this.#cache.clear();
    }

    /**
     * Asserts that this base's metadata has been loaded.
     *
     * Query methods throw rather than returning an empty result, because an empty
     * calendar list is indistinguishable from an API that genuinely serves none and
     * would surface as an empty select with no explanation.
     *
     * @param {string} method - The name of the calling method, for the message.
     * @returns {void}
     * @throws {Error} If the metadata has not been loaded.
     * @private
     */
    #assertLoaded( method ) {
        if ( null === this.#metadata ) {
            throw new Error( `ApiBase.${method}: the base at ${this.#url} has not been loaded. Await load() — or ApiClient.init() — before querying its metadata.` );
        }
    }

    /**
     * Every locale this API supports.
     *
     * @returns {string[]}
     * @throws {Error} If the metadata has not been loaded.
     */
    locales() {
        this.#assertLoaded( 'locales' );
        return this.#metadata.locales;
    }

    /**
     * Every national calendar this API serves.
     *
     * Takes no rite: whether a rite has a national tier at all is a property of the
     * rite (`RiteProperties[ rite ].hasNationalTier`), not of the metadata.
     *
     * @returns {import('../typedefs.js').NationalCalendar[]}
     * @throws {Error} If the metadata has not been loaded.
     */
    nationalCalendars() {
        this.#assertLoaded( 'nationalCalendars' );
        return this.#metadata.national_calendars;
    }

    /**
     * The diocesan calendars belonging to a rite.
     *
     * A diocesan entry with no `rite` field is Roman: the field is a v6 addition,
     * and everything the v5 API ever served was Roman. Filtering on a strict
     * equality against `rite` would drop every diocese on a v5 API.
     *
     * @param {'roman'|'ambrosian'} [rite] - The rite to filter by. Defaults to `Rite.ROMAN`.
     * @returns {import('../typedefs.js').DiocesanCalendar[]}
     * @throws {Error} If the metadata has not been loaded.
     */
    diocesanCalendars( rite = Rite.ROMAN ) {
        this.#assertLoaded( 'diocesanCalendars' );
        return this.#metadata.diocesan_calendars.filter(
            diocesanCalendar => ( diocesanCalendar.rite ?? Rite.ROMAN ) === rite
        );
    }

    /**
     * A rite's own rite-level calendars, announced under the `{rite}_calendars` key.
     *
     * The Roman rite has no such key, because its rite-level calendar is the General
     * Roman Calendar, served in every locale the API supports. The absence of the key
     * is therefore not an error and yields an empty list.
     *
     * @param {'roman'|'ambrosian'} rite - The rite whose own calendars are wanted.
     * @returns {import('../typedefs.js').NationalCalendar[]}
     * @throws {Error} If the metadata has not been loaded.
     */
    riteCalendars( rite ) {
        this.#assertLoaded( 'riteCalendars' );
        const riteCalendars = this.#metadata[ `${rite}_calendars` ];
        return Array.isArray( riteCalendars ) ? riteCalendars : [];
    }

    /**
     * Whether this API understands the rite path segment.
     *
     * There is no version field in `/calendars`, so this is feature-detected: the
     * rite-aware API announces `ambrosian_calendars`, v5 does not. v5 answers any
     * path carrying a rite segment with a bare 400 — on EVERY route, not only
     * Ambrosian ones — so emitting the segment unconditionally would break every
     * request this library makes against it.
     *
     * @returns {boolean}
     */
    get supportsRite() {
        return Array.isArray( this.#metadata?.ambrosian_calendars );
    }

    /**
     * Whether a diocese belongs to a nation according to this API's metadata.
     *
     * @param {string} dioceseId - The diocesan calendar ID.
     * @param {string} nation - The national calendar ID (ISO 3166-1 alpha-2).
     * @returns {boolean} False when the diocese is unknown to this API.
     * @throws {Error} If the metadata has not been loaded.
     */
    isValidDioceseForNation( dioceseId, nation ) {
        this.#assertLoaded( 'isValidDioceseForNation' );
        const diocese = this.#metadata.diocesan_calendars.find(
            diocesanCalendar => diocesanCalendar.calendar_id === dioceseId
        );
        return undefined !== diocese && diocese.nation === nation;
    }

}

/**
 * Resolves the API base a component should read its metadata from.
 *
 * Prefers the base of an explicitly supplied client. Falling back to the first
 * registered base keeps every page written before per-base binding working
 * untouched — but the fallback announces itself once more than one base exists,
 * because a component silently reading the wrong API's calendars is the exact
 * failure this release removes.
 *
 * That announcement is made at most ONCE per component class per session, and is
 * reset only by {@link ApiBase.reset}. It reports a systemic misconfiguration of
 * the page rather than a per-instance event, and a component that builds
 * sub-components would otherwise repeat the identical line once per part.
 *
 * @param {{base: ApiBase}|null|undefined} apiClient - The client to bind to, if any.
 * @param {string} componentName - The binding component's class name, for messages.
 * @returns {ApiBase} The resolved base.
 * @throws {Error} If no client is given and no base is registered.
 */
export function resolveBase( apiClient, componentName ) {
    if ( apiClient !== null && apiClient !== undefined ) {
        if ( false === apiClient.base instanceof ApiBase ) {
            throw new Error( `${componentName}: the apiClient option must be an ApiClient obtained from ApiClient.init().` );
        }
        return apiClient.base;
    }
    const fallback = ApiBase.default;
    if ( null === fallback ) {
        throw new Error( `${componentName}: ApiClient has not been initialized. Please initialize with \`ApiClient.init().then(() => { ... })\`, and construct ${componentName} instances within the callback.` );
    }
    if ( ApiBase.all.length > 1 && false === warnedComponents.has( componentName ) ) {
        warnedComponents.add( componentName );
        console.warn( `${componentName} was constructed without an apiClient while ${ApiBase.all.length} API bases are registered, and bound to ${fallback.url}. Pass \`apiClient\` explicitly to choose.` );
    }
    return fallback;
}

/**
 * Asserts that two bases involved in a component pairing are the same one.
 *
 * Shared by every pairing that must agree on their API base — `PathBuilder` binding the
 * `ApiOptions`/`CalendarSelect` it was constructed with, `CalendarSelect.linkToNationsSelect()`
 * binding a dioceses select to a nations select, and any future pairing — so the message
 * shape cannot drift between call sites while a mismatch is still reported with the specific
 * pairing that failed and both concrete URLs, not just "somewhere, two bases disagreed".
 *
 * Every caller reads the other side's base off a property of the component handed to it —
 * `calendarSelectInstance._base`, `apiOptions._base`. When that argument is not the component
 * type the pairing expects, the property is `undefined`, and reading `.url` off it threw a bare
 * `TypeError: Cannot read properties of undefined (reading 'url')` from inside this helper —
 * hiding the real cause, which is that one side was never a component with a base at all. Both
 * arguments are therefore checked before either is dereferenced, and the message names which
 * side was absent.
 *
 * @param {ApiBase} a - The first base, in the order the `pairing` text names the two sides.
 * @param {ApiBase} b - The second base.
 * @param {string} pairing - Identifies the failing pairing, e.g. `"PathBuilder: the apiOptions
 *        and calendarSelect passed to it"`. Prefixed to the message, before the shared "are bound
 *        to different API bases" clause.
 * @param {string} consequence - Explains what the mismatch would cause. Appended after both URLs.
 * @returns {void}
 * @throws {Error} If either argument is not an `ApiBase`, or if `a` and `b` are not the same base.
 */
export function assertSameBase( a, b, pairing, consequence ) {
    const absent = [];
    if ( false === a instanceof ApiBase ) {
        absent.push( `the first carries no API base (found ${String( a )})` );
    }
    if ( false === b instanceof ApiBase ) {
        absent.push( `the second carries no API base (found ${String( b )})` );
    }
    if ( absent.length > 0 ) {
        throw new Error( `${pairing} cannot be checked for a shared API base: ${absent.join( ', and ' )}. Pass the component type this pairing expects — one constructed with an \`apiClient\`, or bound to the default base — rather than an object that holds no base.` );
    }
    if ( a !== b ) {
        throw new Error( `${pairing} are bound to different API bases — ${a.url} and ${b.url}. ${consequence}` );
    }
}
