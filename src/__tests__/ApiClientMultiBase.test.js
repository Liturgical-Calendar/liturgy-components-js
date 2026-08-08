/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import ApiClient from '../ApiClient/ApiClient.js';
import ApiBase from '../ApiClient/ApiBase.js';
import { Rite } from '../Enums.js';
import { FULL_METADATA, OTHER_METADATA } from '../__fixtures__/metadata.js';

const DEV  = 'http://localhost:8000';
const PROD = 'https://example.org/api/dev';

beforeEach( () => {
    ApiBase.reset();
    global.fetch = jest.fn( url => Promise.resolve( {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve(
            url.endsWith( '/calendars' )
                ? { litcal_metadata: url.startsWith( DEV ) ? FULL_METADATA : OTHER_METADATA }
                : { litcal: [], settings: {}, metadata: {}, messages: [] }
        )
    } ) );
} );

afterEach( () => {
    delete global.fetch;
} );

describe( 'ApiClient bound to a base', () => {

    it( 'exposes the base it is bound to', async () => {
        const client = await ApiClient.init( DEV );
        expect( client.base ).toBe( ApiBase.resolve( DEV ) );
        expect( client.base.url ).toBe( DEV );
    } );

    it( 'normalizes a trailing slash to the same base', async () => {
        const withSlash    = await ApiClient.init( `${DEV}/` );
        const withoutSlash = await ApiClient.init( DEV );
        expect( withSlash.base ).toBe( withoutSlash.base );
    } );

    it( 'returns a new client on every init, even for one base', async () => {
        const first  = await ApiClient.init( DEV );
        const second = await ApiClient.init( DEV );
        expect( second ).not.toBe( first );
        expect( second.base ).toBe( first.base );
    } );

    it( 'keeps two clients on one base independent', async () => {
        const roman     = await ApiClient.init( DEV );
        const ambrosian = await ApiClient.init( DEV );
        ambrosian.rite( Rite.AMBROSIAN );
        expect( roman._currentRite ).toBe( Rite.ROMAN );
        expect( ambrosian._currentRite ).toBe( Rite.AMBROSIAN );
    } );

    it( 'fetches metadata once per base regardless of client count', async () => {
        await ApiClient.init( DEV );
        await ApiClient.init( DEV );
        const calendarsCalls = global.fetch.mock.calls.filter( ( [ url ] ) => url.endsWith( '/calendars' ) );
        expect( calendarsCalls ).toHaveLength( 1 );
    } );

    it( 'gives each base its own metadata', async () => {
        const dev  = await ApiClient.init( DEV );
        const prod = await ApiClient.init( PROD );
        expect( dev.base.metadata ).toEqual( FULL_METADATA );
        expect( prod.base.metadata ).toEqual( OTHER_METADATA );
    } );

    it( 'refetches metadata when a second base is initialized', async () => {
        await ApiClient.init( DEV );
        await ApiClient.init( PROD );
        const calendarsCalls = global.fetch.mock.calls.filter( ( [ url ] ) => url.endsWith( '/calendars' ) );
        expect( calendarsCalls.map( ( [ url ] ) => url ) ).toEqual( [
            `${DEV}/calendars`,
            `${PROD}/calendars`
        ] );
    } );

    it( 'issues calendar requests against its own base url', async () => {
        const prod = await ApiClient.init( PROD );
        await ApiClient.init( DEV );
        global.fetch.mockClear();
        prod.fetchCalendar();
        await Promise.resolve();
        expect( global.fetch.mock.calls[ 0 ][ 0 ] ).toContain( PROD );
        expect( global.fetch.mock.calls[ 0 ][ 0 ] ).not.toContain( DEV );
    } );

    it( 'does not answer one base from another base cache', async () => {
        const dev  = await ApiClient.init( DEV );
        const prod = await ApiClient.init( PROD );
        dev.fetchCalendar();
        await new Promise( resolve => setTimeout( resolve, 0 ) );
        global.fetch.mockClear();
        prod.fetchCalendar();
        await Promise.resolve();
        expect( global.fetch ).toHaveBeenCalled();
    } );

    it( 'resolves the constant default url when init is called with no argument', async () => {
        await ApiClient.init( DEV );
        const client = await ApiClient.init();
        expect( client.base.url ).toBe( ApiBase.DEFAULT_URL );
        expect( client.base.url ).not.toBe( DEV );
    } );

    it( 'resolves the deprecated statics to the first registered base', async () => {
        await ApiClient.init( DEV );
        await ApiClient.init( PROD );
        expect( ApiClient._apiUrl ).toBe( DEV );
        expect( ApiClient._metadata ).toEqual( FULL_METADATA );
    } );

    it( 'warns when a deprecated static is read with more than one base registered', async () => {
        const warn = jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
        await ApiClient.init( DEV );
        warn.mockClear();
        void ApiClient._apiUrl;
        expect( warn ).not.toHaveBeenCalled();
        await ApiClient.init( PROD );
        void ApiClient._apiUrl;
        expect( warn ).toHaveBeenCalledWith( expect.stringContaining( DEV ) );
        warn.mockRestore();
    } );

    // The call sits outside any try, as the argument to expect(): a synchronous
    // throw would fail these at the call rather than at the assertion, which is
    // what distinguishes "rejects" from "throws before a promise exists".
    it( 'rejects rather than throwing synchronously on an empty url', async () => {
        await expect( ApiClient.init( '' ) ).rejects.toThrow( /non-empty string/ );
    } );

    it( 'rejects rather than throwing synchronously on a non-string url', async () => {
        await expect( ApiClient.init( 42 ) ).rejects.toThrow( /non-empty string/ );
    } );

    it( 'registers nothing and requests nothing for an invalid url', async () => {
        await expect( ApiClient.init( '' ) ).rejects.toThrow();
        expect( ApiBase.all ).toHaveLength( 0 );
        expect( global.fetch ).not.toHaveBeenCalled();
    } );

    it( 'clears every base cache on the static clearCache', async () => {
        const dev  = await ApiClient.init( DEV );
        const prod = await ApiClient.init( PROD );
        dev.base.setCached( 'k', { n: 1 } );
        prod.base.setCached( 'k', { n: 2 } );
        ApiClient.clearCache();
        expect( dev.base.getCached( 'k' ) ).toBeNull();
        expect( prod.base.getCached( 'k' ) ).toBeNull();
    } );

} );
