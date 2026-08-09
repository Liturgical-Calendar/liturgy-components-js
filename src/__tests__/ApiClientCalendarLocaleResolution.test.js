/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiClient from '../ApiClient/ApiClient.js';
import ApiBase from '../ApiClient/ApiBase.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

/**
 * Covers `ApiClient#resolveCalendarLocale`'s SUCCESS path: a requested locale that
 * IS among the calendar's own `locales` (underscored, as the live API serves them —
 * see `FULL_METADATA`) must be accepted and set as the `Accept-Language` header.
 *
 * Before the fixture carried underscored locales, `calendarMetadata.locales`
 * never matched the underscored `phpLocale` derived from the requested tag, so
 * every fixture-based request silently fell back — this file is what would have
 * caught that.
 */

const DEV = 'http://localhost:8000';

let apiClient;

beforeEach( async () => {
    ApiBase.reset();
    ApiBase.fromMetadata( DEV, FULL_METADATA );
    global.fetch = jest.fn().mockResolvedValue( {
        ok: true,
        json: () => Promise.resolve( { litcal: [], settings: {}, metadata: {}, messages: [] } )
    } );
    apiClient = await ApiClient.init( DEV );
} );

const headersOf = ( callIndex = 0 ) => global.fetch.mock.calls[ callIndex ][ 1 ].headers;

describe( 'ApiClient national/diocesan locale resolution', () => {

    it( 'accepts a locale the national calendar supports and sets Accept-Language', () => {
        apiClient.fetchNationalCalendar( 'IT', 'it-IT' );
        expect( headersOf()[ 'Accept-Language' ] ).toBe( 'it-IT' );
    } );

    it( 'accepts an Intl.Locale for a national calendar the same way as its string tag', () => {
        apiClient.fetchNationalCalendar( 'IT', new Intl.Locale( 'it-IT' ) );
        expect( headersOf()[ 'Accept-Language' ] ).toBe( 'it-IT' );
    } );

    it( 'falls back rather than setting a locale the national calendar does not support', () => {
        apiClient.fetchNationalCalendar( 'US', 'it-IT' );
        expect( headersOf()[ 'Accept-Language' ] ).not.toBe( 'it-IT' );
    } );

    it( 'accepts a locale the diocesan calendar supports and sets Accept-Language', () => {
        apiClient.fetchDiocesanCalendar( 'romamo_it', 'it-IT' );
        expect( headersOf()[ 'Accept-Language' ] ).toBe( 'it-IT' );
    } );

} );
