import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClientError from '../ApiClient/ApiClientError.js';
import { FULL_METADATA, OTHER_METADATA } from '../__fixtures__/metadata.js';

const okResponse = ( metadata ) => ( {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve( { litcal_metadata: metadata } )
} );

beforeEach( () => {
    ApiBase.reset();
} );

afterEach( () => {
    delete global.fetch;
} );

describe( 'ApiBase.normalizeUrl', () => {

    it( 'strips trailing slashes', () => {
        expect( ApiBase.normalizeUrl( 'http://localhost:8000/' ) ).toBe( 'http://localhost:8000' );
        expect( ApiBase.normalizeUrl( 'http://localhost:8000///' ) ).toBe( 'http://localhost:8000' );
    } );

    it( 'leaves protocol, host, port and path untouched', () => {
        expect( ApiBase.normalizeUrl( 'https://example.org/api/dev' ) ).toBe( 'https://example.org/api/dev' );
    } );

    it( 'treats hosts that merely resolve alike as distinct', () => {
        expect( ApiBase.normalizeUrl( 'http://localhost:8000' ) )
            .not.toBe( ApiBase.normalizeUrl( 'http://127.0.0.1:8000' ) );
    } );

    it( 'rejects a non-string or empty url', () => {
        expect( () => ApiBase.normalizeUrl( null ) ).toThrow( /non-empty string/ );
        expect( () => ApiBase.normalizeUrl( '   ' ) ).toThrow( /non-empty string/ );
    } );

} );

describe( 'ApiBase registry', () => {

    it( 'returns the same instance for urls differing only by trailing slash', () => {
        expect( ApiBase.resolve( 'http://localhost:8000' ) )
            .toBe( ApiBase.resolve( 'http://localhost:8000/' ) );
    } );

    it( 'returns different instances for different urls', () => {
        expect( ApiBase.resolve( 'http://localhost:8000' ) )
            .not.toBe( ApiBase.resolve( 'https://example.org/api/dev' ) );
    } );

    it( 'does not fetch when resolving', () => {
        global.fetch = jest.fn();
        ApiBase.resolve( 'http://localhost:8000' );
        expect( global.fetch ).not.toHaveBeenCalled();
    } );

    it( 'reports the first registered base as the default', () => {
        const first = ApiBase.resolve( 'http://localhost:8000' );
        ApiBase.resolve( 'https://example.org/api/dev' );
        expect( ApiBase.default ).toBe( first );
    } );

    it( 'reports null as the default when nothing is registered', () => {
        expect( ApiBase.default ).toBeNull();
    } );

    it( 'lists every base in registration order', () => {
        ApiBase.resolve( 'http://localhost:8000' );
        ApiBase.resolve( 'https://example.org/api/dev' );
        expect( ApiBase.all.map( base => base.url ) )
            .toEqual( [ 'http://localhost:8000', 'https://example.org/api/dev' ] );
    } );

    it( 'clears the registry on reset', () => {
        ApiBase.resolve( 'http://localhost:8000' );
        ApiBase.reset();
        expect( ApiBase.all ).toEqual( [] );
        expect( ApiBase.default ).toBeNull();
    } );

} );

describe( 'ApiBase.fromMetadata', () => {

    it( 'produces a loaded base with no network call', () => {
        global.fetch = jest.fn();
        const base = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        expect( base.isLoaded ).toBe( true );
        expect( base.metadata ).toBe( FULL_METADATA );
        expect( global.fetch ).not.toHaveBeenCalled();
    } );

    it( 'registers the base so resolve returns it', () => {
        const base = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        expect( ApiBase.resolve( 'http://localhost:8000' ) ).toBe( base );
    } );

    it( 'replaces an existing entry for the same url', () => {
        const first  = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        const second = ApiBase.fromMetadata( 'http://localhost:8000', OTHER_METADATA );
        expect( second ).not.toBe( first );
        expect( ApiBase.resolve( 'http://localhost:8000' ).metadata ).toBe( OTHER_METADATA );
        expect( ApiBase.all ).toHaveLength( 1 );
    } );

} );

/**
 * An index missing these fields used to be caught by `CalendarSelect.#init()`.
 * With per-base binding that method is gone, so the check belongs here, where
 * every component benefits from it: unvalidated, an incomplete index surfaces
 * far from its cause as a bare `TypeError` naming neither the field nor the API.
 * `fromMetadata` is validated as well as `load`, because it is how the whole
 * test suite builds its fixtures.
 */
describe( 'ApiBase rejects an unusable calendar index', () => {

    const { national_calendars, ...NO_NATIONS  } = FULL_METADATA;
    const { diocesan_calendars, ...NO_DIOCESES } = FULL_METADATA;
    const { locales,            ...NO_LOCALES  } = FULL_METADATA;

    it( 'rejects metadata with no national_calendars from fromMetadata', () => {
        expect( () => ApiBase.fromMetadata( 'http://localhost:8000', NO_NATIONS ) ).toThrow( /national_calendars/ );
    } );

    it( 'rejects metadata with no diocesan_calendars from fromMetadata', () => {
        expect( () => ApiBase.fromMetadata( 'http://localhost:8000', NO_DIOCESES ) ).toThrow( /diocesan_calendars/ );
    } );

    /**
     * `locales` is required for the same reason as the other two, but it fails on
     * the request path rather than at construction: `ApiClient.fetchCalendar`
     * calls `this.#base.locales().includes( … )`, so an index without it produces
     * a bare `TypeError: Cannot read properties of undefined (reading 'includes')`
     * — exactly the failure mode this validation exists to prevent.
     */
    it( 'rejects metadata with no locales from fromMetadata', () => {
        expect( () => ApiBase.fromMetadata( 'http://localhost:8000', NO_LOCALES ) ).toThrow( /locales/ );
    } );

    it( 'rejects metadata with no locales from load, as an ApiClientError', async () => {
        global.fetch = jest.fn().mockResolvedValue( okResponse( NO_LOCALES ) );
        const base = ApiBase.resolve( 'http://localhost:8000' );
        await expect( base.load() ).rejects.toBeInstanceOf( ApiClientError );
        await expect( base.load() ).rejects.toThrow( /locales/ );
        expect( base.isLoaded ).toBe( false );
    } );

    it( 'names the base url in the message', () => {
        expect( () => ApiBase.fromMetadata( 'http://localhost:8000', NO_NATIONS ) ).toThrow( /http:\/\/localhost:8000/ );
    } );

    it( 'rejects metadata that is not an object', () => {
        expect( () => ApiBase.fromMetadata( 'http://localhost:8000', null ) ).toThrow( /must be an object/ );
        expect( () => ApiBase.fromMetadata( 'http://localhost:8000', 'nope' ) ).toThrow( /must be an object/ );
        expect( () => ApiBase.fromMetadata( 'http://localhost:8000', [] ) ).toThrow( /must be an object/ );
    } );

    it( 'registers nothing when it rejects', () => {
        expect( () => ApiBase.fromMetadata( 'http://localhost:8000', NO_NATIONS ) ).toThrow();
        expect( ApiBase.all ).toHaveLength( 0 );
    } );

    it( 'rejects an incomplete index from load, as an ApiClientError', async () => {
        global.fetch = jest.fn().mockResolvedValue( okResponse( NO_NATIONS ) );
        const base = ApiBase.resolve( 'http://localhost:8000' );
        await expect( base.load() ).rejects.toBeInstanceOf( ApiClientError );
        await expect( base.load() ).rejects.toThrow( /national_calendars/ );
    } );

    it( 'leaves the base unloaded when load rejects an incomplete index', async () => {
        global.fetch = jest.fn().mockResolvedValue( okResponse( NO_DIOCESES ) );
        const base = ApiBase.resolve( 'http://localhost:8000' );
        await expect( base.load() ).rejects.toThrow( /diocesan_calendars/ );
        expect( base.isLoaded ).toBe( false );
    } );

} );

describe( 'ApiBase.load', () => {

    it( 'requests the /calendars path of its own base', async () => {
        global.fetch = jest.fn().mockResolvedValue( okResponse( FULL_METADATA ) );
        const base = ApiBase.resolve( 'http://localhost:8000/' );
        await base.load();
        expect( global.fetch ).toHaveBeenCalledWith( 'http://localhost:8000/calendars' );
        expect( base.metadata ).toEqual( FULL_METADATA );
        expect( base.isLoaded ).toBe( true );
    } );

    it( 'fetches only once across repeated loads', async () => {
        global.fetch = jest.fn().mockResolvedValue( okResponse( FULL_METADATA ) );
        const base = ApiBase.resolve( 'http://localhost:8000' );
        await base.load();
        await base.load();
        expect( global.fetch ).toHaveBeenCalledTimes( 1 );
    } );

    it( 'collapses concurrent loads into one request', async () => {
        global.fetch = jest.fn().mockResolvedValue( okResponse( FULL_METADATA ) );
        const base = ApiBase.resolve( 'http://localhost:8000' );
        await Promise.all( [ base.load(), base.load(), base.load() ] );
        expect( global.fetch ).toHaveBeenCalledTimes( 1 );
    } );

    it( 'keeps two bases isolated', async () => {
        global.fetch = jest.fn( url => Promise.resolve(
            url.startsWith( 'http://localhost:8000' )
                ? okResponse( FULL_METADATA )
                : okResponse( OTHER_METADATA )
        ) );
        const dev  = ApiBase.resolve( 'http://localhost:8000' );
        const prod = ApiBase.resolve( 'https://example.org/api/dev' );
        await Promise.all( [ dev.load(), prod.load() ] );
        expect( dev.metadata ).toEqual( FULL_METADATA );
        expect( prod.metadata ).toEqual( OTHER_METADATA );
    } );

    it( 'rejects with an ApiClientError naming the url and status on a non-ok response', async () => {
        global.fetch = jest.fn().mockResolvedValue( {
            ok: false,
            status: 503,
            statusText: 'Service Unavailable',
            text: () => Promise.resolve( 'down for maintenance' )
        } );
        const base = ApiBase.resolve( 'http://localhost:8000' );
        await expect( base.load() ).rejects.toBeInstanceOf( ApiClientError );
        await expect( base.load() ).rejects.toMatchObject( {
            url: 'http://localhost:8000/calendars',
            status: 503,
            statusText: 'Service Unavailable',
            body: 'down for maintenance'
        } );
    } );

    it( 'rejects with an ApiClientError wrapping a transport failure', async () => {
        const transport = new TypeError( 'Failed to fetch' );
        global.fetch = jest.fn().mockRejectedValue( transport );
        const base = ApiBase.resolve( 'http://localhost:8000' );
        await expect( base.load() ).rejects.toBeInstanceOf( ApiClientError );
        await expect( base.load() ).rejects.toMatchObject( {
            url: 'http://localhost:8000/calendars',
            status: null,
            cause: transport
        } );
    } );

    it( 'rejects when the response carries no litcal_metadata property', async () => {
        global.fetch = jest.fn().mockResolvedValue( {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: () => Promise.resolve( { unexpected: true } )
        } );
        const base = ApiBase.resolve( 'http://localhost:8000' );
        await expect( base.load() ).rejects.toThrow( /litcal_metadata/ );
    } );

    it( 'allows a retry after a failed load', async () => {
        global.fetch = jest.fn()
            .mockRejectedValueOnce( new TypeError( 'Failed to fetch' ) )
            .mockResolvedValueOnce( okResponse( FULL_METADATA ) );
        const base = ApiBase.resolve( 'http://localhost:8000' );
        await expect( base.load() ).rejects.toBeInstanceOf( ApiClientError );
        await base.load();
        expect( base.metadata ).toEqual( FULL_METADATA );
        expect( global.fetch ).toHaveBeenCalledTimes( 2 );
    } );

} );
