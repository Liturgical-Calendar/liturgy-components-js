/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import ApiClient from '../ApiClient/ApiClient.js';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClientError from '../ApiClient/ApiClientError.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const DEV = 'http://localhost:8000';

/**
 * A base whose `/calendars` index loads, but whose every calendar request 500s.
 * Hoisted to module scope because both the direct-rejection describe and the
 * discarded-caller describe below need it.
 */
const mockMetadataThenFailure = () => {
    global.fetch = jest.fn( url => url.endsWith( '/calendars' )
        ? Promise.resolve( {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: () => Promise.resolve( { litcal_metadata: FULL_METADATA } )
        } )
        : Promise.resolve( {
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            text: () => Promise.resolve( 'boom' )
        } )
    );
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
        mockMetadataThenFailure();
        const client = await ApiClient.init( DEV );
        await expect( client.fetchCalendar() ).rejects.toMatchObject( {
            status: 500,
            statusText: 'Internal Server Error'
        } );
    } );

    it( 'emits calendarFetchFailed with the error and the request rite', async () => {
        mockMetadataThenFailure();
        const client = await ApiClient.init( DEV );
        const onFailure = jest.fn();
        client.on( 'calendarFetchFailed', onFailure );
        await expect( client.fetchCalendar() ).rejects.toBeInstanceOf( ApiClientError );
        expect( onFailure ).toHaveBeenCalledTimes( 1 );
        expect( onFailure.mock.calls[ 0 ][ 0 ] ).toBeInstanceOf( ApiClientError );
        expect( onFailure.mock.calls[ 0 ][ 1 ] ).toEqual( { rite: 'roman' } );
    } );

    it( 'does not emit calendarFetched on a failure', async () => {
        mockMetadataThenFailure();
        const client = await ApiClient.init( DEV );
        const onFetched = jest.fn();
        client.on( 'calendarFetched', onFetched );
        await expect( client.fetchCalendar() ).rejects.toBeInstanceOf( ApiClientError );
        expect( onFetched ).not.toHaveBeenCalled();
    } );

    it( 'does not cache a failed response', async () => {
        mockMetadataThenFailure();
        const client = await ApiClient.init( DEV );
        await expect( client.fetchCalendar() ).rejects.toBeInstanceOf( ApiClientError );
        await expect( client.fetchCalendar() ).rejects.toBeInstanceOf( ApiClientError );
        const calendarCalls = global.fetch.mock.calls.filter( ( [ url ] ) => false === url.endsWith( '/calendars' ) );
        expect( calendarCalls.length ).toBe( 2 );
    } );

    it( 'rejects from fetchNationalCalendar too', async () => {
        mockMetadataThenFailure();
        const client = await ApiClient.init( DEV );
        await expect( client.fetchNationalCalendar( 'IT' ) ).rejects.toBeInstanceOf( ApiClientError );
    } );

    it( 'rejects from fetchDiocesanCalendar too', async () => {
        mockMetadataThenFailure();
        const client = await ApiClient.init( DEV );
        await expect( client.fetchDiocesanCalendar( 'romamo_it' ) ).rejects.toBeInstanceOf( ApiClientError );
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
        mockMetadataThenFailure();
        const client = await ApiClient.init( DEV );
        const returned = client.refetchCalendarData();
        expect( returned ).toBeInstanceOf( Promise );
        await expect( returned ).rejects.toBeInstanceOf( ApiClientError );
    } );

    it( 'suppresses the unhandled rejection of a discarded refetch without losing the error', async () => {
        mockMetadataThenFailure();
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

} );
