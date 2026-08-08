/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiClient from '../ApiClient/ApiClient.js';
import ApiBase from '../ApiClient/ApiBase.js';
import { Rite } from '../Enums.js';
import { V5_METADATA } from '../__fixtures__/metadata.js';

/**
 * The shape the LIVE v5 API returns: no `ambrosian_calendars` key, and no `rite`
 * on diocesan entries. v5 answers `/calendar/roman/nation/IT` with 400 on every
 * route, so a client pointed at it must omit the segment entirely rather than
 * break every request.
 */

const API_URL = 'http://localhost:8000';

let apiClient;

// Fresh base and client per test, for the same reason as in ApiClientRite.test.js.
// `global.fetch` stays mocked for the CALENDAR requests these tests inspect; the
// index comes from the fixture, with no `/calendars` request at all.
beforeEach( async () => {
    ApiBase.reset();
    ApiBase.fromMetadata( API_URL, V5_METADATA );
    global.fetch = jest.fn().mockResolvedValue( {
        ok: true,
        json: () => Promise.resolve( { litcal: [], settings: {}, metadata: {}, messages: [] } )
    } );
    apiClient = await ApiClient.init( API_URL );
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
