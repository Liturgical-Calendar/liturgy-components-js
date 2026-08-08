/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import ApiClient from '../ApiClient/ApiClient.js';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClientError from '../ApiClient/ApiClientError.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const DEV = 'http://localhost:8000';

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
