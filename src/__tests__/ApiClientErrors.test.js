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

/**
 * The mirror image: a base already loaded from the fixture, whose every calendar
 * request succeeds. Hoisted to module scope because both listener-failure
 * describes below need it — the cache-miss one and the cache-hit one.
 */
const loadBaseThenServeEveryCalendarRequest = () => {
    ApiBase.fromMetadata( DEV, FULL_METADATA );
    global.fetch = jest.fn( () => Promise.resolve( {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve( { litcal: [], settings: {}, metadata: {} } )
    } ) );
};

/**
 * The three fetch methods, so that every contract below is asserted of all of
 * them rather than of whichever one happened to be written first.
 */
const fetchCases = [
    [ 'fetchCalendar', client => client.fetchCalendar() ],
    [ 'fetchNationalCalendar', client => client.fetchNationalCalendar( 'IT' ) ],
    [ 'fetchDiocesanCalendar', client => client.fetchDiocesanCalendar( 'romamo_it' ) ]
];

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

    it.each( fetchCases )( '%s rejects with the listener\'s own error, unwrapped', async ( _name, fetchWith ) => {
        loadBaseThenServeEveryCalendarRequest();
        const client        = await ApiClient.init( DEV );
        const listenerError = new Error( 'listener blew up' );
        client.on( 'calendarFetched', () => { throw listenerError; } );
        // One call only, so that this exercises the cache-MISS path specifically.
        // The cache-hit path reaches the caller the same way, and is covered
        // separately in the describe below.
        let caught = null;
        try {
            await fetchWith( client );
        } catch ( error ) {
            caught = error;
        }
        expect( caught ).toBe( listenerError );
        expect( caught ).not.toBeInstanceOf( ApiClientError );
    } );

    it.each( fetchCases )( '%s emits no calendarFetchFailed when a calendarFetched listener throws', async ( _name, fetchWith ) => {
        loadBaseThenServeEveryCalendarRequest();
        const client    = await ApiClient.init( DEV );
        const onFailure = jest.fn();
        client.on( 'calendarFetched', () => { throw new Error( 'listener blew up' ); } );
        client.on( 'calendarFetchFailed', onFailure );
        await expect( fetchWith( client ) ).rejects.toThrow( 'listener blew up' );
        expect( onFailure ).not.toHaveBeenCalled();
    } );

} );

/**
 * The same contract, on the cached branch.
 *
 * A cache hit returns early, before the promise chain that carries the `.catch`
 * above the emit stage exists at all. `EventEmitter.emit` being a synchronous
 * `forEach`, a throwing `calendarFetched` listener used to throw straight OUT of
 * the fetch method on a hit — `apiClient.fetchCalendar().catch( handler )` never
 * ran `handler`, because no promise had been returned for `.catch` to attach to.
 * The identical listener on a cache miss arrived as a rejection. One method thus
 * had two different failure contracts, selected by whether the response happened
 * to be cached — which a caller neither controls nor can observe. The cached
 * branch now wraps its emit and returns `Promise.reject( error )`.
 *
 * Every rejection assertion below calls the fetch method OUTSIDE any `try`, as
 * the argument to `expect()`, so that a synchronous throw fails the test at the
 * call rather than being caught by the assertion. That is the whole point: an
 * assertion that tolerated both would not distinguish the fix from the bug.
 */
describe( 'ApiClient rejects rather than throwing synchronously on a cache hit', () => {

    /**
     * Fetches once with no listeners attached, so the response lands in the cache
     * and a second identical call is served from it, then clears the fetch mock so
     * that a later `not.toHaveBeenCalled()` proves the second call was a cache hit.
     *
     * @param {ApiClient} client - The client to prime.
     * @param {Function} fetchWith - The fetch method under test, applied to `client`.
     * @returns {Promise<object>} The data the priming call resolved to.
     */
    const primeTheCache = async ( client, fetchWith ) => {
        const data = await fetchWith( client );
        global.fetch.mockClear();
        return data;
    };

    it.each( fetchCases )( '%s serves an identical second call from the cache', async ( _name, fetchWith ) => {
        loadBaseThenServeEveryCalendarRequest();
        const client = await ApiClient.init( DEV );
        await primeTheCache( client, fetchWith );
        await fetchWith( client );
        expect( global.fetch ).not.toHaveBeenCalled();
    } );

    it.each( fetchCases )( '%s rejects with the listener\'s own error, unwrapped, on a cache hit', async ( _name, fetchWith ) => {
        loadBaseThenServeEveryCalendarRequest();
        const client        = await ApiClient.init( DEV );
        await primeTheCache( client, fetchWith );
        const listenerError = new Error( 'listener blew up on cached data' );
        client.on( 'calendarFetched', () => { throw listenerError; } );
        await expect( fetchWith( client ) ).rejects.toBe( listenerError );
        await expect( fetchWith( client ) ).rejects.not.toBeInstanceOf( ApiClientError );
        // Still the cached branch, not a silent refetch that happened to fail.
        expect( global.fetch ).not.toHaveBeenCalled();
    } );

    it.each( fetchCases )( '%s emits no calendarFetchFailed on a cache hit whose listener throws', async ( _name, fetchWith ) => {
        loadBaseThenServeEveryCalendarRequest();
        const client    = await ApiClient.init( DEV );
        await primeTheCache( client, fetchWith );
        const onFailure = jest.fn();
        client.on( 'calendarFetched', () => { throw new Error( 'listener blew up on cached data' ); } );
        client.on( 'calendarFetchFailed', onFailure );
        await expect( fetchWith( client ) ).rejects.toThrow( 'listener blew up on cached data' );
        expect( onFailure ).not.toHaveBeenCalled();
    } );

    it.each( fetchCases )( '%s still resolves to the cached data and still emits calendarFetched', async ( _name, fetchWith ) => {
        loadBaseThenServeEveryCalendarRequest();
        const client    = await ApiClient.init( DEV );
        const cached    = await primeTheCache( client, fetchWith );
        const onFetched = jest.fn();
        client.on( 'calendarFetched', onFetched );
        await expect( fetchWith( client ) ).resolves.toBe( cached );
        expect( onFetched ).toHaveBeenCalledTimes( 1 );
        expect( onFetched.mock.calls[ 0 ][ 0 ] ).toBe( cached );
        expect( onFetched.mock.calls[ 0 ][ 1 ] ).toEqual( { rite: 'roman' } );
        expect( global.fetch ).not.toHaveBeenCalled();
    } );

    it.each( fetchCases )( '%s notifies a cache-hit listener before the call returns', async ( _name, fetchWith ) => {
        loadBaseThenServeEveryCalendarRequest();
        const client    = await ApiClient.init( DEV );
        await primeTheCache( client, fetchWith );
        const onFetched = jest.fn();
        client.on( 'calendarFetched', onFetched );
        // The emit on a hit is deliberately still synchronous: wrapping it in a
        // `try` fixes the returned promise's contract and nothing else. Deferring
        // it into a microtask would also have made the throw a rejection, but would
        // have moved this assertion's ground out from under any consumer relying on
        // a cached call having already notified its listeners.
        const pending = fetchWith( client );
        expect( onFetched ).toHaveBeenCalledTimes( 1 );
        await pending;
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
