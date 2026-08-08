import { describe, it, expect } from '@jest/globals';
import ApiClientError from '../ApiClient/ApiClientError.js';

describe( 'ApiClientError', () => {

    it( 'is an Error with a distinguishable name', () => {
        const err = new ApiClientError( 'boom' );
        expect( err ).toBeInstanceOf( Error );
        expect( err.name ).toBe( 'ApiClientError' );
        expect( err.message ).toBe( 'boom' );
    } );

    it( 'carries the request context', () => {
        const err = new ApiClientError( 'failed', {
            url: 'http://localhost:8000/calendars',
            status: 503,
            statusText: 'Service Unavailable',
            body: '{"error":"down"}'
        } );
        expect( err.url ).toBe( 'http://localhost:8000/calendars' );
        expect( err.status ).toBe( 503 );
        expect( err.statusText ).toBe( 'Service Unavailable' );
        expect( err.body ).toBe( '{"error":"down"}' );
    } );

    it( 'defaults every context field to null when omitted', () => {
        const err = new ApiClientError( 'failed' );
        expect( err.url ).toBeNull();
        expect( err.status ).toBeNull();
        expect( err.statusText ).toBeNull();
        expect( err.body ).toBeNull();
    } );

    it( 'preserves the underlying error as cause', () => {
        const inner = new TypeError( 'fetch failed' );
        const err = new ApiClientError( 'wrapped', { cause: inner } );
        expect( err.cause ).toBe( inner );
    } );

} );
