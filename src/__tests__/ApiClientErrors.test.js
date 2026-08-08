/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import ApiClient from '../ApiClient/ApiClient.js';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClientError from '../ApiClient/ApiClientError.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const DEV = 'http://localhost:8000';

/**
 * A base whose index is already loaded from the fixture, but whose every
 * calendar request 500s. Hoisted to module scope because both the
 * direct-rejection describe and the discarded-caller describe below need it.
 *
 * Only the calendar half is mocked. The index no longer arrives over `fetch` at
 * all, so a `/calendars` request reaching the mock would itself be the failure —
 * which is why the mock has no branch for one.
 */
const loadBaseThenFailEveryCalendarRequest = () => {
    ApiBase.fromMetadata( DEV, FULL_METADATA );
    global.fetch = jest.fn( () => Promise.resolve( {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve( 'boom' )
    } ) );
};

beforeEach( () => {
    ApiBase.reset();
} );

afterEach( () => {
    delete global.fetch;
} );

describe( 'ApiClient.init failure', () => {

    it( 'rejects with an ApiClientError naming the url and status', async () => {
        global.fetch = jest.fn().mockResolvedValue( {
            ok: false,
            status: 502,
            statusText: 'Bad Gateway',
            text: () => Promise.resolve( '' )
        } );
        await expect( ApiClient.init( DEV ) ).rejects.toBeInstanceOf( ApiClientError );
        await expect( ApiClient.init( DEV ) ).rejects.toMatchObject( {
            url: `${DEV}/calendars`,
            status: 502
        } );
    } );

    it( 'rejects rather than resolving false when the API is unreachable', async () => {
        global.fetch = jest.fn().mockRejectedValue( new TypeError( 'Failed to fetch' ) );
        await expect( ApiClient.init( DEV ) ).rejects.toBeInstanceOf( ApiClientError );
    } );

    it( 'leaves a healthy base usable when another base is down', async () => {
        global.fetch = jest.fn( url => url.startsWith( DEV )
            ? Promise.reject( new TypeError( 'Failed to fetch' ) )
            : Promise.resolve( {
                ok: true,
                status: 200,
                statusText: 'OK',
                json: () => Promise.resolve( { litcal_metadata: FULL_METADATA } )
            } )
        );
        await expect( ApiClient.init( DEV ) ).rejects.toBeInstanceOf( ApiClientError );
        const healthy = await ApiClient.init( 'https://example.org/api/dev' );
        expect( healthy.base.metadata ).toEqual( FULL_METADATA );
    } );

} );

describe( 'ApiClient calendar fetch failure', () => {

    it( 'rejects with an ApiClientError carrying the status', async () => {
        loadBaseThenFailEveryCalendarRequest();
        const client = await ApiClient.init( DEV );
        await expect( client.fetchCalendar() ).rejects.toMatchObject( {
            status: 500,
            statusText: 'Internal Server Error'
        } );
    } );

    it( 'emits calendarFetchFailed with the error and the request rite', async () => {
        loadBaseThenFailEveryCalendarRequest();
        const client = await ApiClient.init( DEV );
        const onFailure = jest.fn();
        client.on( 'calendarFetchFailed', onFailure );
        await expect( client.fetchCalendar() ).rejects.toBeInstanceOf( ApiClientError );
        expect( onFailure ).toHaveBeenCalledTimes( 1 );
        expect( onFailure.mock.calls[ 0 ][ 0 ] ).toBeInstanceOf( ApiClientError );
        expect( onFailure.mock.calls[ 0 ][ 1 ] ).toEqual( { rite: 'roman' } );
    } );

    it( 'does not emit calendarFetched on a failure', async () => {
        loadBaseThenFailEveryCalendarRequest();
        const client = await ApiClient.init( DEV );
        const onFetched = jest.fn();
        client.on( 'calendarFetched', onFetched );
        await expect( client.fetchCalendar() ).rejects.toBeInstanceOf( ApiClientError );
        expect( onFetched ).not.toHaveBeenCalled();
    } );

    it( 'does not cache a failed response', async () => {
        loadBaseThenFailEveryCalendarRequest();
        const client = await ApiClient.init( DEV );
        await expect( client.fetchCalendar() ).rejects.toBeInstanceOf( ApiClientError );
        await expect( client.fetchCalendar() ).rejects.toBeInstanceOf( ApiClientError );
        const calendarCalls = global.fetch.mock.calls.filter( ( [ url ] ) => false === url.endsWith( '/calendars' ) );
        expect( calendarCalls.length ).toBe( 2 );
    } );

    it( 'rejects from fetchNationalCalendar too', async () => {
        loadBaseThenFailEveryCalendarRequest();
        const client = await ApiClient.init( DEV );
        await expect( client.fetchNationalCalendar( 'IT' ) ).rejects.toBeInstanceOf( ApiClientError );
    } );

    it( 'rejects from fetchDiocesanCalendar too', async () => {
        loadBaseThenFailEveryCalendarRequest();
        const client = await ApiClient.init( DEV );
        await expect( client.fetchDiocesanCalendar( 'romamo_it' ) ).rejects.toBeInstanceOf( ApiClientError );
    } );

} );

/**
 * A throwing `calendarFetched` listener is the listener's bug, not the API's.
 *
 * `EventEmitter.emit` is a synchronous `forEach`, and `WebCalendar`'s
 * `calendarFetched` handler throws on malformed data — so with the `.catch`
 * attached after the emit stage, a rendering bug propagated into it, was
 * relabelled `POST <url> failed: …`, and was re-emitted as `calendarFetchFailed`
 * even though the HTTP request had succeeded. A subscriber then saw BOTH events
 * for one request. The `.catch` now sits between the response-handling stage and
 * the cache/emit stage, so a listener's throw reaches the caller unwrapped and
 * emits nothing.
 */
describe( 'ApiClient does not report a listener failure as a fetch failure', () => {

    const loadBaseThenServeEveryCalendarRequest = () => {
        ApiBase.fromMetadata( DEV, FULL_METADATA );
        global.fetch = jest.fn( () => Promise.resolve( {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: () => Promise.resolve( { litcal: [], settings: {}, metadata: {} } )
        } ) );
    };

    const cases = [
        [ 'fetchCalendar', client => client.fetchCalendar() ],
        [ 'fetchNationalCalendar', client => client.fetchNationalCalendar( 'IT' ) ],
        [ 'fetchDiocesanCalendar', client => client.fetchDiocesanCalendar( 'romamo_it' ) ]
    ];

    it.each( cases )( '%s rejects with the listener\'s own error, unwrapped', async ( _name, fetchWith ) => {
        loadBaseThenServeEveryCalendarRequest();
        const client        = await ApiClient.init( DEV );
        const listenerError = new Error( 'listener blew up' );
        client.on( 'calendarFetched', () => { throw listenerError; } );
        // One call only: a second would be served from the cache, whose emit is
        // synchronous and outside the promise chain under test.
        let caught = null;
        try {
            await fetchWith( client );
        } catch ( error ) {
            caught = error;
        }
        expect( caught ).toBe( listenerError );
        expect( caught ).not.toBeInstanceOf( ApiClientError );
    } );

    it.each( cases )( '%s emits no calendarFetchFailed when a calendarFetched listener throws', async ( _name, fetchWith ) => {
        loadBaseThenServeEveryCalendarRequest();
        const client    = await ApiClient.init( DEV );
        const onFailure = jest.fn();
        client.on( 'calendarFetched', () => { throw new Error( 'listener blew up' ); } );
        client.on( 'calendarFetchFailed', onFailure );
        await expect( fetchWith( client ) ).rejects.toThrow( 'listener blew up' );
        expect( onFailure ).not.toHaveBeenCalled();
    } );

} );

describe( 'ApiClient fire-and-forget callers', () => {

    /**
     * Collects every unhandled rejection raised while `run` settles.
     *
     * Node reports an unhandled rejection only once the microtask queue has drained
     * and control returns to the event loop, so a rejection created inside `run` is
     * not visible until at least one macrotask later. Two `setTimeout` turns are
     * taken: the first lets the request settle, the second lets Node's check run.
     * (`setImmediate` is not defined in Jest's jsdom environment.)
     *
     * @param {Function} run - The code to observe.
     * @returns {Promise<unknown[]>} The rejection reasons, in order.
     */
    const unhandledRejectionsDuring = async ( run ) => {
        const reasons = [];
        const record  = reason => reasons.push( reason );
        process.on( 'unhandledRejection', record );
        try {
            run();
            await new Promise( resolve => setTimeout( resolve, 0 ) );
            await new Promise( resolve => setTimeout( resolve, 0 ) );
        } finally {
            process.off( 'unhandledRejection', record );
        }
        return reasons;
    };

    it( 'returns the promise from refetchCalendarData rather than dropping it', async () => {
        loadBaseThenFailEveryCalendarRequest();
        const client = await ApiClient.init( DEV );
        const returned = client.refetchCalendarData();
        expect( returned ).toBeInstanceOf( Promise );
        await expect( returned ).rejects.toBeInstanceOf( ApiClientError );
    } );

    it( 'suppresses the unhandled rejection of a discarded refetch without losing the error', async () => {
        loadBaseThenFailEveryCalendarRequest();
        const client     = await ApiClient.init( DEV );
        const riteSelect = new RiteSelect( 'en' );
        const onFailure  = jest.fn();
        client.on( 'calendarFetchFailed', onFailure );
        client.listenTo( riteSelect );

        // The change listener calls refetchCalendarData() for its side effects and
        // discards the promise, which is precisely the path under test.
        const reasons = await unhandledRejectionsDuring( () => {
            riteSelect._domElement.dispatchEvent( new Event( 'change' ) );
        } );

        // The promise must not go unhandled...
        expect( reasons ).toEqual( [] );
        // ...and yet the error must still reach subscribers, so that suppression is
        // distinguishable from swallowing the failure outright.
        expect( onFailure ).toHaveBeenCalledTimes( 1 );
        expect( onFailure.mock.calls[ 0 ][ 0 ] ).toBeInstanceOf( ApiClientError );
        expect( onFailure.mock.calls[ 0 ][ 0 ].status ).toBe( 500 );
    } );

    it( 'logs a discarded failure when nothing is subscribed to calendarFetchFailed', async () => {
        loadBaseThenFailEveryCalendarRequest();
        const client     = await ApiClient.init( DEV );
        const riteSelect = new RiteSelect( 'en' );
        client.listenTo( riteSelect );

        const consoleError = jest.spyOn( console, 'error' ).mockImplementation( () => {} );
        try {
            const reasons = await unhandledRejectionsDuring( () => {
                riteSelect._domElement.dispatchEvent( new Event( 'change' ) );
            } );
            expect( reasons ).toEqual( [] );
            // With no subscriber the error has nowhere else to go. Staying silent here
            // would be a regression on the pre-2.0 unconditional console.error.
            expect( consoleError ).toHaveBeenCalledTimes( 1 );
            expect( consoleError.mock.calls[ 0 ][ 0 ] ).toBeInstanceOf( ApiClientError );
        } finally {
            consoleError.mockRestore();
        }
    } );

    it( 'stays silent when a calendarFetchFailed subscriber is handling the error', async () => {
        loadBaseThenFailEveryCalendarRequest();
        const client     = await ApiClient.init( DEV );
        const riteSelect = new RiteSelect( 'en' );
        client.on( 'calendarFetchFailed', jest.fn() );
        client.listenTo( riteSelect );

        const consoleError = jest.spyOn( console, 'error' ).mockImplementation( () => {} );
        try {
            await unhandledRejectionsDuring( () => {
                riteSelect._domElement.dispatchEvent( new Event( 'change' ) );
            } );
            expect( consoleError ).not.toHaveBeenCalled();
        } finally {
            consoleError.mockRestore();
        }
    } );

} );
