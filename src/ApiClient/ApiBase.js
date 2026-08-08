import ApiClientError from './ApiClientError.js';

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
     * the duplicate.
     *
     * @param {string} url - The URL to normalize.
     * @returns {string} The normalized URL.
     * @throws {Error} If the URL is not a non-empty string.
     */
    static normalizeUrl( url ) {
        if ( typeof url !== 'string' || url.trim() === '' ) {
            throw new Error( 'ApiBase: url must be a non-empty string, but found: ' + String( url ) );
        }
        return url.trim().replace( /\/+$/, '' );
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
     * Replaces any base already registered for the URL. The replacement is
     * deliberate: fixture setup that had to clear the registry first would be a
     * trap in a `beforeEach`.
     *
     * @param {string} url - The base URL.
     * @param {import('../typedefs.js').CalendarIndex} metadata - The calendar index.
     * @returns {ApiBase}
     */
    static fromMetadata( url, metadata ) {
        const base = new ApiBase( ApiBase.normalizeUrl( url ) );
        base.#metadata = metadata;
        ApiBase.#registry.set( base.url, base );
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
     * Empties the registry.
     *
     * @returns {void}
     */
    static reset() {
        ApiBase.#registry.clear();
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
     * @throws {ApiClientError} If the request fails or the response carries no `litcal_metadata`.
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
            this.#metadata    = data.litcal_metadata;
            this.#loadPromise = null;
            return this;
        } ).catch( error => {
            this.#loadPromise = null;
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
        }
        if ( ttl !== undefined ) {
            if ( ttl !== null && ( typeof ttl !== 'number' || ttl <= 0 ) ) {
                throw new Error( 'ApiBase.cacheLimits: ttl must be null or a positive number of milliseconds, but found: ' + String( ttl ) );
            }
            ApiBase.#ttl = ttl;
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

}
