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
    DIOCESAN: 'diocese'
}
Object.freeze(CalendarType);


/**
 * Describes the URL parameters that can be set on the API /calendar endpoint
 */
class RequestPayload {
    /** @type {?Locale} - The locale in which the liturgical calendar should be produced */
    static locale               = null;
    /** @type {?Epiphany} - Whether Epiphany is to be celebrated on January 6 or on the Sunday between January 2 and January 8 */
    static epiphany             = null;
    /** @type {?Ascension} - Whether Ascension is to be celebrated on Thursday or on Sunday */
    static ascension            = null;
    /** @type {?CorpusChristi} - Whether Corpus Christi is to be celebrated on Thursday or on Sunday */
    static corpus_christi       = null;
    /** @type {?EternalHighPriest} - Whether Eternal High Priest is to be celebrated */
    static eternal_high_priest  = null;
    /** @type {?YearType} - Whether the liturgical calendar data should be for the liturgical year or the civil year */
    static year_type            = null;
    /** @type {?ReturnType} - The format of the response data */
    static return_type          = null;
};


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
 */
class CurrentEndpoint {

    static calendarType   = null;
    static calendarId     = null;
    static calendarYear   = null;
    static rite           = Rite.ROMAN;
    /**
     * Whether to spell out the rite segment even for Roman. `Router::extractRiteSegment()`
     * accepts `roman` explicitly, so `/calendar/roman/nation/IT` and `/calendar/nation/IT`
     * are the same request. Kept false unless a RiteSelect is linked, so embeds that never
     * opt into rite awareness emit byte-identical paths.
     */
    static explicitRite   = false;

    /**
     * Builds the current request path, WITHOUT query parameters.
     *
     * Composed from `/calendar`, an optional rite segment (emitted whenever
     * `rite` is not `Rite.ROMAN`, or `explicitRite` is `true`), an optional
     * `/{calendarType}/{calendarId}` segment, and an optional trailing
     * `/{calendarYear}` segment — each included only when its backing static
     * fields are non-null.
     *
     * @returns {string} The request path, e.g. `/calendar`, `/calendar/roman`,
     *          `/calendar/nation/IT`, or `/calendar/ambrosian/diocese/lugano_ch/2026`.
     * @readonly
     */
    static get path() {
        let currentEndpoint = '/calendar';
        if ( CurrentEndpoint.rite !== Rite.ROMAN || CurrentEndpoint.explicitRite ) {
            currentEndpoint += `/${CurrentEndpoint.rite}`;
        }
        if ( CurrentEndpoint.calendarType !== null && CurrentEndpoint.calendarId !== null ) {
            currentEndpoint += `/${CurrentEndpoint.calendarType}/${CurrentEndpoint.calendarId}`;
        }
        if ( CurrentEndpoint.calendarYear !== null ) {
            currentEndpoint += `/${CurrentEndpoint.calendarYear}`;
        }
        return currentEndpoint;
    }

    /**
     * Builds the full request path, WITH query parameters serialized from the
     * non-null fields of `RequestPayload`.
     *
     * Takes no parameters: it reads `CurrentEndpoint.path` and every field of
     * `RequestPayload` directly from module state.
     *
     * @returns {string} `path` followed by a `?`-prefixed, `&`-joined query
     *          string for every non-null, non-empty-string `RequestPayload`
     *          field, or `path` unchanged when no such fields are set.
     */
    static serialize = () => {
        let parameters = [];
        for (const key in RequestPayload) {
            if(RequestPayload[key] !== null && RequestPayload[key] !== ''){
                parameters.push(key + "=" + encodeURIComponent(RequestPayload[key]));
            }
        }
        const urlParams = parameters.length ? `?${parameters.join('&')}` : '';
        return `${CurrentEndpoint.path}${urlParams}`;
    }
}

export { CurrentEndpoint, CalendarType, RequestPayload };
