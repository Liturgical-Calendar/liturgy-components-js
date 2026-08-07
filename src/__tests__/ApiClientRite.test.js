/** @jest-environment jsdom */
import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import ApiClient from '../ApiClient/ApiClient.js';
import { Rite } from '../Enums.js';

/**
 * v6-shaped metadata: `ambrosian_calendars` is present, which is the capability
 * probe for rite support. The v5 shape (no such key) is exercised in
 * ApiClientRiteLegacyMetadata.test.js — ApiClient caches metadata in a static
 * field, so a second fixture needs the fresh module registry Jest gives per file.
 */
const METADATA = {
    locales: [ 'en', 'it', 'la' ],
    national_calendars: [ { calendar_id: 'IT', locales: [ 'it-IT' ], settings: {} } ],
    diocesan_calendars: [
        { calendar_id: 'roma_it',   nation: 'IT', diocese: 'Diocesi di Roma',   locales: [ 'it-IT' ], rite: 'roman' },
        { calendar_id: 'lugano_ch', nation: 'CH', diocese: 'Diocesi di Lugano', locales: [ 'it-IT' ], rite: 'ambrosian' }
    ],
    ambrosian_calendars: [ { calendar_id: 'ambrosian' } ]
};

let apiClient;

beforeAll( async () => {
    global.fetch = jest.fn().mockResolvedValue( {
        ok: true,
        json: () => Promise.resolve( { litcal_metadata: METADATA } )
    } );
    apiClient = await ApiClient.init();
} );

// A FRESH client per test. ApiClient carries per-request state (#currentCategory,
// #currentCalendarId, #currentRite) that would otherwise leak between tests and
// make them order-dependent — a national fetch in one test changes what
// refetchCalendarData() does in the next. init() is cheap here: #metadata is
// already cached, so it resolves a new instance without fetching.
beforeEach( async () => {
    ApiClient.clearCache();
    apiClient = await ApiClient.init();
    global.fetch.mockClear();
} );

describe( 'ApiClient rite state', () => {

    it( 'defaults to the Roman rite', () => {
        expect( apiClient._currentRite ).toBe( Rite.ROMAN );
    } );

    it( 'sets the rite and returns this for chaining', () => {
        expect( apiClient.rite( Rite.AMBROSIAN ) ).toBe( apiClient );
        expect( apiClient._currentRite ).toBe( Rite.AMBROSIAN );

        apiClient.rite( Rite.ROMAN );
        expect( apiClient._currentRite ).toBe( Rite.ROMAN );
    } );

    it( 'throws on a value that is not a Rite', () => {
        expect( () => apiClient.rite( 'byzantine' ) ).toThrow( /must be a valid Rite/ );
        expect( () => apiClient.rite( null ) ).toThrow( /must be a valid Rite/ );
    } );
} );
