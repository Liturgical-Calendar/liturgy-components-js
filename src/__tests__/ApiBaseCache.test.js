import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import { FULL_METADATA, OTHER_METADATA } from '../__fixtures__/metadata.js';

beforeEach( () => {
    ApiBase.reset();
    ApiBase.cacheLimits( { maxEntries: 50, ttl: null } );
} );

afterEach( () => {
    jest.useRealTimers();
} );

describe( 'ApiBase cache', () => {

    it( 'returns null for a key never stored', () => {
        const base = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        expect( base.getCached( 'nope' ) ).toBeNull();
    } );

    it( 'round-trips stored data', () => {
        const base = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        const payload = { litcal: [ { event_key: 'Christmas' } ] };
        base.setCached( 'roman|general||2026|LITURGICAL|it', payload );
        expect( base.getCached( 'roman|general||2026|LITURGICAL|it' ) ).toBe( payload );
    } );

    it( 'keeps two bases isolated under an identical key', () => {
        const dev  = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        const prod = ApiBase.fromMetadata( 'https://example.org/api/dev', OTHER_METADATA );
        dev.setCached( 'same-key', { from: 'dev' } );
        prod.setCached( 'same-key', { from: 'prod' } );
        expect( dev.getCached( 'same-key' ) ).toEqual( { from: 'dev' } );
        expect( prod.getCached( 'same-key' ) ).toEqual( { from: 'prod' } );
    } );

    it( 'empties only its own cache on clearCache', () => {
        const dev  = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        const prod = ApiBase.fromMetadata( 'https://example.org/api/dev', OTHER_METADATA );
        dev.setCached( 'k', { from: 'dev' } );
        prod.setCached( 'k', { from: 'prod' } );
        dev.clearCache();
        expect( dev.getCached( 'k' ) ).toBeNull();
        expect( prod.getCached( 'k' ) ).toEqual( { from: 'prod' } );
    } );

    it( 'empties every base cache on clearAllCaches', () => {
        const dev  = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        const prod = ApiBase.fromMetadata( 'https://example.org/api/dev', OTHER_METADATA );
        dev.setCached( 'k', { from: 'dev' } );
        prod.setCached( 'k', { from: 'prod' } );
        ApiBase.clearAllCaches();
        expect( dev.getCached( 'k' ) ).toBeNull();
        expect( prod.getCached( 'k' ) ).toBeNull();
    } );

    it( 'evicts the least recently read entry beyond maxEntries', () => {
        ApiBase.cacheLimits( { maxEntries: 3 } );
        const base = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        base.setCached( 'a', { n: 1 } );
        base.setCached( 'b', { n: 2 } );
        base.setCached( 'c', { n: 3 } );
        base.getCached( 'a' );          // 'a' becomes the most recently read, so 'b' is now oldest
        base.setCached( 'd', { n: 4 } );
        expect( base.getCached( 'b' ) ).toBeNull();
        expect( base.getCached( 'a' ) ).toEqual( { n: 1 } );
        expect( base.getCached( 'c' ) ).toEqual( { n: 3 } );
        expect( base.getCached( 'd' ) ).toEqual( { n: 4 } );
    } );

    it( 'never expires entries when ttl is null', () => {
        jest.useFakeTimers();
        const base = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        base.setCached( 'k', { n: 1 } );
        jest.advanceTimersByTime( 1000 * 60 * 60 * 24 );
        expect( base.getCached( 'k' ) ).toEqual( { n: 1 } );
    } );

    it( 'treats an entry older than ttl as a miss and drops it', () => {
        jest.useFakeTimers();
        ApiBase.cacheLimits( { ttl: 5000 } );
        const base = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        base.setCached( 'k', { n: 1 } );
        jest.advanceTimersByTime( 4999 );
        expect( base.getCached( 'k' ) ).toEqual( { n: 1 } );
        jest.advanceTimersByTime( 2 );
        expect( base.getCached( 'k' ) ).toBeNull();
    } );

    it( 'rejects a non-positive maxEntries', () => {
        expect( () => ApiBase.cacheLimits( { maxEntries: 0 } ) ).toThrow( /maxEntries/ );
        expect( () => ApiBase.cacheLimits( { maxEntries: -1 } ) ).toThrow( /maxEntries/ );
    } );

    it( 'rejects a non-positive ttl that is not null', () => {
        expect( () => ApiBase.cacheLimits( { ttl: 0 } ) ).toThrow( /ttl/ );
        expect( () => ApiBase.cacheLimits( { ttl: -1 } ) ).toThrow( /ttl/ );
    } );

    it( 'rejects NaN and Infinity as ttl', () => {
        expect( () => ApiBase.cacheLimits( { ttl: NaN } ) ).toThrow( /ttl/ );
        expect( () => ApiBase.cacheLimits( { ttl: Infinity } ) ).toThrow( /ttl/ );
        expect( () => ApiBase.cacheLimits( { ttl: -Infinity } ) ).toThrow( /ttl/ );
    } );

    it( 'still accepts null and a finite positive ttl', () => {
        expect( () => ApiBase.cacheLimits( { ttl: null } ) ).not.toThrow();
        expect( () => ApiBase.cacheLimits( { ttl: 5000 } ) ).not.toThrow();
    } );

    it( 'trims an already-oversized cache immediately when maxEntries is lowered', () => {
        ApiBase.cacheLimits( { maxEntries: 5 } );
        const base = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        base.setCached( 'a', { n: 1 } );
        base.setCached( 'b', { n: 2 } );
        base.setCached( 'c', { n: 3 } );
        base.setCached( 'd', { n: 4 } );
        base.setCached( 'e', { n: 5 } );
        base.getCached( 'a' );          // 'a' becomes most recently read
        base.getCached( 'b' );          // 'b' becomes most recently read
        // Read order (least to most recently read) is now: c, d, e, a, b

        ApiBase.cacheLimits( { maxEntries: 2 } );

        expect( base.getCached( 'c' ) ).toBeNull();
        expect( base.getCached( 'd' ) ).toBeNull();
        expect( base.getCached( 'e' ) ).toBeNull();
        expect( base.getCached( 'a' ) ).toEqual( { n: 1 } );
        expect( base.getCached( 'b' ) ).toEqual( { n: 2 } );
    } );

} );
