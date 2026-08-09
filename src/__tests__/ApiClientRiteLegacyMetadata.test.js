/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiClient from '../ApiClient/ApiClient.js';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClientError from '../ApiClient/ApiClientError.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
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

    /**
     * The refusal REJECTS the returned promise rather than throwing at the call
     * site. Every call below is therefore made OUTSIDE any `try`, as the argument to
     * `expect()`, so that a synchronous throw fails the test at the call rather than
     * being caught by the assertion.
     */
    it.each( [
        [ 'fetchCalendar', client => client.fetchCalendar() ],
        [ 'fetchNationalCalendar', client => client.fetchNationalCalendar( 'IT' ) ],
        [ 'fetchDiocesanCalendar', client => client.fetchDiocesanCalendar( 'romamo_it' ) ]
    ] )( '%s rejects with a labelled error rather than emitting a request the API will reject', async ( _name, fetchWith ) => {
        apiClient.rite( Rite.AMBROSIAN );
        await expect( fetchWith( apiClient ) ).rejects.toThrow( /does not support the ambrosian rite/ );
        expect( global.fetch ).not.toHaveBeenCalled();
    } );

    it( 'rejects with a plain Error and emits no calendarFetchFailed', async () => {
        // No request was made, so there is no request context for an ApiClientError
        // to carry and nothing for the failed-request event to report.
        const onFailure = jest.fn();
        apiClient.on( 'calendarFetchFailed', onFailure );
        apiClient.rite( Rite.AMBROSIAN );
        let caught;
        try {
            await apiClient.fetchCalendar();
        } catch ( error ) {
            caught = error;
        }
        expect( caught ).toBeInstanceOf( Error );
        expect( caught ).not.toBeInstanceOf( ApiClientError );
        expect( onFailure ).not.toHaveBeenCalled();
        expect( global.fetch ).not.toHaveBeenCalled();
    } );

    /**
     * The same refusal, reached the way a user reaches it: through the rite select's
     * change listener, which discards the promise. Before the refusal became a
     * rejection it threw out of the DOM event dispatch entirely and never reached
     * `#discardRequest`; it now arrives there like any other discarded failure, and
     * must neither go unhandled nor vanish silently.
     */
    it( 'routes the refusal through the discarded-request path when a rite select drives it', async () => {
        const riteSelect = new RiteSelect( 'en' );
        apiClient.listenTo( riteSelect );

        const reasons      = [];
        const record       = reason => reasons.push( reason );
        const consoleError = jest.spyOn( console, 'error' ).mockImplementation( () => {} );
        process.on( 'unhandledRejection', record );
        try {
            riteSelect._domElement.value = Rite.AMBROSIAN;
            riteSelect._domElement.dispatchEvent( new Event( 'change' ) );
            // Node reports an unhandled rejection only once the microtask queue has
            // drained and control returns to the event loop, so two turns are taken:
            // the first lets the rejection settle, the second lets Node's check run.
            await new Promise( resolve => setTimeout( resolve, 0 ) );
            await new Promise( resolve => setTimeout( resolve, 0 ) );

            // Asserted before `mockRestore()`, which clears the recorded calls.
            expect( reasons ).toEqual( [] );
            expect( global.fetch ).not.toHaveBeenCalled();
            expect( consoleError ).toHaveBeenCalledTimes( 1 );
            expect( consoleError.mock.calls[ 0 ][ 0 ].message ).toMatch( /does not support the ambrosian rite/ );
        } finally {
            process.off( 'unhandledRejection', record );
            consoleError.mockRestore();
        }
    } );
} );
