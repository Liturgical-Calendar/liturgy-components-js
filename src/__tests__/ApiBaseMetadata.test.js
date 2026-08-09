import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import { Rite } from '../Enums.js';
import { FULL_METADATA, V5_METADATA } from '../__fixtures__/metadata.js';

beforeEach( () => {
    ApiBase.reset();
} );

describe( 'ApiBase metadata queries', () => {

    it( 'returns the locales the API supports', () => {
        const base = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        expect( base.locales() ).toEqual( [ 'en', 'it', 'la' ] );
    } );

    it( 'returns every national calendar', () => {
        const base = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        expect( base.nationalCalendars().map( c => c.calendar_id ) ).toEqual( [ 'IT', 'US', 'VA' ] );
    } );

    it( 'filters diocesan calendars by rite', () => {
        const base = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        expect( base.diocesanCalendars( Rite.ROMAN ).map( c => c.calendar_id ) )
            .toEqual( [ 'romamo_it', 'boston_us' ] );
        expect( base.diocesanCalendars( Rite.AMBROSIAN ).map( c => c.calendar_id ) )
            .toEqual( [ 'milano_it' ] );
    } );

    it( 'treats a diocese with no rite field as Roman', () => {
        const base = ApiBase.fromMetadata( 'http://localhost:8000', V5_METADATA );
        expect( base.diocesanCalendars( Rite.ROMAN ).map( c => c.calendar_id ) )
            .toEqual( [ 'romamo_it', 'boston_us' ] );
    } );

    it( 'defaults diocesanCalendars to the Roman rite', () => {
        const base = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        expect( base.diocesanCalendars() ).toEqual( base.diocesanCalendars( Rite.ROMAN ) );
    } );

    it( 'returns a rite own calendars under the {rite}_calendars convention', () => {
        const base = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        expect( base.riteCalendars( Rite.AMBROSIAN ).map( c => c.calendar_id ) )
            .toEqual( [ 'ambrosian' ] );
    } );

    it( 'returns an empty list for a rite with no own calendars', () => {
        const base = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        expect( base.riteCalendars( Rite.ROMAN ) ).toEqual( [] );
    } );

    it( 'reports rite support from the presence of ambrosian_calendars', () => {
        expect( ApiBase.fromMetadata( 'http://a', FULL_METADATA ).supportsRite ).toBe( true );
        expect( ApiBase.fromMetadata( 'http://b', V5_METADATA ).supportsRite ).toBe( false );
    } );

    it( 'validates a diocese against its nation', () => {
        const base = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        expect( base.isValidDioceseForNation( 'romamo_it', 'IT' ) ).toBe( true );
        expect( base.isValidDioceseForNation( 'romamo_it', 'US' ) ).toBe( false );
        expect( base.isValidDioceseForNation( 'nonexistent', 'IT' ) ).toBe( false );
    } );

    it( 'throws a query on an unloaded base rather than returning an empty result', () => {
        const base = ApiBase.resolve( 'http://localhost:8000' );
        expect( () => base.locales() ).toThrow( /has not been loaded/ );
        expect( () => base.nationalCalendars() ).toThrow( /has not been loaded/ );
        expect( () => base.diocesanCalendars() ).toThrow( /has not been loaded/ );
        expect( () => base.riteCalendars( Rite.ROMAN ) ).toThrow( /has not been loaded/ );
        expect( () => base.isValidDioceseForNation( 'romamo_it', 'IT' ) ).toThrow( /has not been loaded/ );
    } );

    it( 'names the base in the unloaded error', () => {
        const base = ApiBase.resolve( 'http://localhost:8000' );
        expect( () => base.locales() ).toThrow( /http:\/\/localhost:8000/ );
    } );

} );
