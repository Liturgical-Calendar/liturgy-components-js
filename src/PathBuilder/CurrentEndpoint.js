import { Rite } from '../Enums.js';

/**
 * @typedef Epiphany
 * @type {'JAN6' | 'SUNDAY_JAN2_JAN8'}
 * @readonly
 */

/**
 * @typedef Ascension
 * @type {'THURSDAY' | 'SUNDAY'}
 */

/**
 * @typedef CorpusChristi
 * @type {'THURSDAY' | 'SUNDAY'}
 */

/**
 * @typedef EternalHighPriest
 * @type {true | false}
 */

/**
 * @typedef Locale
 * @type {string}
 */

/**
 * @typedef ReturnType
 * @type {'JSON' | 'XML' | 'YML' | 'ICS'}
 */

/**
 * @typedef YearType
 * @type {'CIVIL' | 'LITURGICAL'}
 */

/**
 * @type {{NATIONAL: "nation", DIOCESAN: "diocese"}}
 * @readonly
 * Used in building the endpoint URL for requests to the API /calendar endpoint
 */
const CalendarType = {
    NATIONAL: 'nation',
    DIOCESAN: 'diocese',
};
Object.freeze(CalendarType);

/**
 * Describes the URL parameters that can be set on the API /calendar endpoint.
 *
 * Instance state, not statics: one `RequestPayload` belongs to one
 * `CurrentEndpoint`, which in turn belongs to one `ApiOptions` — see the doc
 * comment on `CurrentEndpoint` for why that per-instance ownership matters.
 *
 * Every field is declared as a class field initialized to `null` so that it is
 * an own, enumerable property from construction onward. `CurrentEndpoint.serialize()`
 * discovers the parameters with a `for...in` over the instance, so a field that
 * only sprang into existence on first assignment would be invisible to a reset
 * loop and easy to miss when adding new parameters.
 */
class RequestPayload {
    /** @type {?Locale} - The locale in which the liturgical calendar should be produced */
    locale = null;
    /** @type {?Epiphany} - Whether Epiphany is to be celebrated on January 6 or on the Sunday between January 2 and January 8 */
    epiphany = null;
    /** @type {?Ascension} - Whether Ascension is to be celebrated on Thursday or on Sunday */
    ascension = null;
    /** @type {?CorpusChristi} - Whether Corpus Christi is to be celebrated on Thursday or on Sunday */
    corpus_christi = null;
    /** @type {?EternalHighPriest} - Whether Eternal High Priest is to be celebrated */
    eternal_high_priest = null;
    /** @type {?YearType} - Whether the liturgical calendar data should be for the liturgical year or the civil year */
    year_type = null;
    /** @type {?ReturnType} - The format of the response data */
    return_type = null;
}

/**
 * Used to build the full endpoint URL for the API /calendar endpoint
 *
 * Deliberately its own module, separate from `PathBuilder.js`'s default
 * export: `PathBuilder.js` imports `ApiOptions` (its default export), and
 * `ApiOptions` in turn needs `CurrentEndpoint`. Keeping `CurrentEndpoint` (and
 * its `CalendarType` / `RequestPayload` companions) in a module that imports
 * nothing from `PathBuilder.js` or `ApiOptions.js` avoids a require cycle
 * between the two — harmless today under Jest/Node because neither side
 * dereferences the other's binding at module-evaluation time, but silently
 * fatal for a consumer loading this package as raw ESM from a CDN, where
 * there is no bundler to paper over the cycle.
 *
 * **Per-instance, not a module-level singleton.** Each `ApiOptions` constructs
 * exactly one `CurrentEndpoint` (exposed as `apiOptions._currentEndpoint`) and
 * the `PathBuilder` built against that `ApiOptions` reads and writes that same
 * object. Two embeds on one page therefore keep entirely separate endpoint
 * state: a `RiteSelect` linked by one of them sets only its own `rite` and
 * `explicitRite`, so the other embed's displayed path is byte-identical to what
 * it was before rite awareness existed. When these fields were statics, any
 * embed that linked a `RiteSelect` silently rewrote every other embed's path on
 * the page.
 */
class CurrentEndpoint {
    calendarType = null;
    calendarId = null;
    calendarYear = null;
    rite = Rite.ROMAN;
    /**
     * Whether to spell out the rite segment even for Roman. `Router::extractRiteSegment()`
     * accepts `roman` explicitly, so `/calendar/roman/nation/IT` and `/calendar/nation/IT`
     * are the same request. Kept false unless a RiteSelect is linked, so embeds that never
     * opt into rite awareness emit byte-identical paths.
     */
    explicitRite = false;

    /**
     * The query parameters that accompany this endpoint's path.
     *
     * Owned by the endpoint rather than passed in, so that a caller holding a
     * `CurrentEndpoint` has the complete request state reachable from it and
     * cannot accidentally pair one embed's path with another embed's payload.
     *
     * @type {RequestPayload}
     */
    requestPayload = new RequestPayload();

    /**
     * Builds the current request path, WITHOUT query parameters.
     *
     * Composed from `/calendar`, an optional rite segment (emitted whenever
     * `rite` is not `Rite.ROMAN`, or `explicitRite` is `true`), an optional
     * `/{calendarType}/{calendarId}` segment, and an optional trailing
     * `/{calendarYear}` segment — each included only when its backing
     * fields are non-null.
     *
     * @returns {string} The request path, e.g. `/calendar`, `/calendar/roman`,
     *          `/calendar/nation/IT`, or `/calendar/ambrosian/diocese/lugano_ch/2026`.
     */
    get path() {
        let currentEndpoint = '/calendar';
        if (this.rite !== Rite.ROMAN || this.explicitRite) {
            currentEndpoint += `/${this.rite}`;
        }
        if (this.calendarType !== null && this.calendarId !== null) {
            currentEndpoint += `/${this.calendarType}/${this.calendarId}`;
        }
        if (this.calendarYear !== null) {
            currentEndpoint += `/${this.calendarYear}`;
        }
        return currentEndpoint;
    }

    /**
     * Builds the full request path, WITH query parameters serialized from the
     * non-null fields of this endpoint's `requestPayload`.
     *
     * Takes no parameters: it reads `this.path` and every field of
     * `this.requestPayload`.
     *
     * @returns {string} `path` followed by a `?`-prefixed, `&`-joined query
     *          string for every non-null, non-empty-string `requestPayload`
     *          field, or `path` unchanged when no such fields are set.
     */
    serialize() {
        let parameters = [];
        for (const key in this.requestPayload) {
            if (
                this.requestPayload[key] !== null &&
                this.requestPayload[key] !== ''
            ) {
                parameters.push(
                    key + '=' + encodeURIComponent(this.requestPayload[key]),
                );
            }
        }
        const urlParams = parameters.length ? `?${parameters.join('&')}` : '';
        return `${this.path}${urlParams}`;
    }
}

export { CurrentEndpoint, CalendarType, RequestPayload };
