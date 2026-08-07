/** @jest-environment jsdom */
import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import ApiClient from '../ApiClient/ApiClient.js';
import { Rite } from '../Enums.js';

/**
 * The shape the LIVE v5 API returns: no `ambrosian_calendars` key, and no `rite`
 * on diocesan entries. v5 answers `/calendar/roman/nation/IT` with 400 on every
 * route, so a client pointed at it must omit the segment entirely rather than
 * break every request.
 *
 * Deliberately in its own test file: ApiClient caches metadata in a static field
 * with no reset, so a second fixture needs the fresh module registry Jest gives
 * per file. Same reason CalendarSelectLegacyMetadata.test.js exists.
 */
const V5_METADATA = {
    locales: [ 'en', 'it', 'la' ],
    national_calendars: [ { calendar_id: 'IT', locales: [ 'it-IT' ], settings: {} } ],
    diocesan_calendars: [ { calendar_id: 'roma_it', nation: 'IT', diocese: 'Diocesi di Roma', locales: [ 'it-IT' ] } ]
};

let apiClient;

beforeAll( async () => {
    global.fetch = jest.fn().mockResolvedValue( {
        ok: true,
        json: () => Promise.resolve( { litcal_metadata: V5_METADATA } )
    } );
    apiClient = await ApiClient.init();
} );

// Fresh client per test, for the same reason as in ApiClientRite.test.js.
beforeEach( async () => {
    ApiClient.clearCache();
    apiClient = await ApiClient.init();
    global.fetch.mockClear();
} );

describe( 'ApiClient against metadata with no ambrosian_calendars (live v5 API)', () => {

    it( 'omits the rite segment entirely for the Roman rite', () => {
        apiClient.rite( Rite.ROMAN );
        apiClient.fetchCalendar();
        expect( global.fetch.mock.calls[ 0 ][ 0 ] ).not.toContain( '/roman' );
    } );

    it( 'still serves national and diocesan routes unchanged', () => {
        apiClient.rite( Rite.ROMAN );
        apiClient.fetchNationalCalendar( 'IT' );
        expect( global.fetch.mock.calls[ 0 ][ 0 ] ).toContain( '/calendar/nation/IT' );
        expect( global.fetch.mock.calls[ 0 ][ 0 ] ).not.toContain( '/roman' );
    } );

    it( 'throws a labelled error rather than emitting a request the API will reject', () => {
        apiClient.rite( Rite.AMBROSIAN );
        expect( () => apiClient.fetchCalendar() ).toThrow( /does not support the ambrosian rite/ );
        expect( global.fetch ).not.toHaveBeenCalled();
    } );
} );
