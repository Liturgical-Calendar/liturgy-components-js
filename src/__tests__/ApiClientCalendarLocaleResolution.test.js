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

/**
 * Snapshots of the `headers` object passed to `fetch` on each call, captured at
 * call time rather than read later off `fetch.mock.calls`.
 *
 * `ApiClient` passes `headers: this.#fetchCalendarHeaders` — the SAME object by
 * reference on every request — so `fetch.mock.calls[i][1].headers` for every `i`
 * all point at that one mutable object. Reading call 0's headers after call 1 has
 * run would therefore return call 1's (mutated) state. Capturing a shallow copy
 * inside the mock implementation, at the moment each call happens, is the only
 * way to observe what a given call actually sent.
 *
 * @type {object[]}
 */
let fetchHeaderSnapshots;

beforeEach( async () => {
    ApiBase.reset();
    ApiBase.fromMetadata( DEV, FULL_METADATA );
    fetchHeaderSnapshots = [];
    global.fetch = jest.fn( ( url, init ) => {
        fetchHeaderSnapshots.push( { ...init?.headers } );
        return Promise.resolve( {
            ok: true,
            json: () => Promise.resolve( { litcal: [], settings: {}, metadata: {}, messages: [] } )
        } );
    } );
    apiClient = await ApiClient.init( DEV );
} );

const headersOf = ( callIndex = 0 ) => fetchHeaderSnapshots[ callIndex ];

describe( 'ApiClient national/diocesan locale resolution', () => {

    it( 'accepts a locale the national calendar supports and sets Accept-Language', async () => {
        await apiClient.fetchNationalCalendar( 'IT', 'it-IT' );
        expect( headersOf()[ 'Accept-Language' ] ).toBe( 'it-IT' );
    } );

    it( 'accepts an Intl.Locale for a national calendar the same way as its string tag', async () => {
        await apiClient.fetchNationalCalendar( 'IT', new Intl.Locale( 'it-IT' ) );
        expect( headersOf()[ 'Accept-Language' ] ).toBe( 'it-IT' );
    } );

    it( 'falls back rather than setting a locale the national calendar does not support', async () => {
        await apiClient.fetchNationalCalendar( 'US', 'it-IT' );
        expect( headersOf()[ 'Accept-Language' ] ).not.toBe( 'it-IT' );
    } );

    it( 'accepts a locale the diocesan calendar supports and sets Accept-Language', async () => {
        await apiClient.fetchDiocesanCalendar( 'romamo_it', 'it-IT' );
        expect( headersOf()[ 'Accept-Language' ] ).toBe( 'it-IT' );
    } );

} );

/**
 * Covers `ApiClient#resolveCalendarLocale`'s stale-header fix: a locale set by one
 * request must not leak into a later request for a different calendar that cannot
 * serve it. Before the fix, an unusable locale left the previous `Accept-Language`
 * value in place instead of clearing it, so the SECOND calendar was silently
 * requested in the FIRST calendar's language.
 */
describe( 'ApiClient does not leak a stale Accept-Language to a later request', () => {

    it( 'sends no Accept-Language when a later request for a different calendar cannot use the requested locale', async () => {
        await apiClient.fetchNationalCalendar( 'IT', 'it-IT' );
        expect( headersOf( 0 )[ 'Accept-Language' ] ).toBe( 'it-IT' );

        // The response cache lives on the shared ApiBase, not on the ApiClient
        // instance — without clearing it, the second call below would be served
        // from cache and issue no request at all, observing nothing.
        ApiBase.resolve( DEV ).clearCache();

        // US only supports en_US; 'zz-!' is neither parseable nor supported.
        await apiClient.fetchNationalCalendar( 'US', 'zz-!' );
        expect( headersOf( 1 )[ 'Accept-Language' ] ).toBeUndefined();
    } );

    it( 'keys the cache entry by the locale actually sent, not the stale requested one', async () => {
        await apiClient.fetchNationalCalendar( 'IT', 'it-IT' );
        ApiBase.resolve( DEV ).clearCache();

        // First request populates the cache under whatever key was actually sent.
        await apiClient.fetchNationalCalendar( 'US', 'zz-!' );
        // A second call with the same (unusable) arguments must be a cache HIT —
        // i.e. no second fetch — which is only possible if both calls generated
        // the same cache key from what was actually sent ('', not 'it-IT' and not
        // 'zz-!').
        await apiClient.fetchNationalCalendar( 'US', 'zz-!' );
        expect( global.fetch ).toHaveBeenCalledTimes( 2 );
    } );

} );
