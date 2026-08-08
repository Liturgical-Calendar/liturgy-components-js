/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiClient from '../ApiClient/ApiClient.js';
import ApiBase from '../ApiClient/ApiBase.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import { FULL_METADATA, OTHER_METADATA } from '../__fixtures__/metadata.js';

const DEV  = 'http://localhost:8000';
const PROD = 'https://example.org/api/dev';

beforeEach( () => {
    ApiBase.reset();
} );

/** Builds a client bound to a fixture base without any network call. */
const clientFor = ( url, metadata ) => {
    const base = ApiBase.fromMetadata( url, metadata );
    return { base };
};

describe( 'CalendarSelect binding', () => {

    it( 'reads the metadata of the base it is bound to', () => {
        const dev  = clientFor( DEV, FULL_METADATA );
        const prod = clientFor( PROD, OTHER_METADATA );
        const devSelect  = new CalendarSelect( { locale: 'en', apiClient: dev } );
        const prodSelect = new CalendarSelect( { locale: 'en', apiClient: prod } );
        expect( devSelect.nationsInnerHtml ).toContain( 'value="IT"' );
        expect( devSelect.nationsInnerHtml ).not.toContain( 'value="NL"' );
        expect( prodSelect.nationsInnerHtml ).toContain( 'value="NL"' );
        expect( prodSelect.nationsInnerHtml ).not.toContain( 'value="IT"' );
    } );

    it( 'exposes the base it resolved', () => {
        const dev = clientFor( DEV, FULL_METADATA );
        const select = new CalendarSelect( { locale: 'en', apiClient: dev } );
        expect( select._base ).toBe( ApiBase.resolve( DEV ) );
    } );

    it( 'falls back to the first registered base when no client is given', () => {
        ApiBase.fromMetadata( DEV, FULL_METADATA );
        const select = new CalendarSelect( 'en' );
        expect( select._base ).toBe( ApiBase.resolve( DEV ) );
    } );

    it( 'does not warn on the fallback when only one base is registered', () => {
        const warn = jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
        ApiBase.fromMetadata( DEV, FULL_METADATA );
        new CalendarSelect( 'en' );
        expect( warn ).not.toHaveBeenCalled();
        warn.mockRestore();
    } );

    it( 'warns on the fallback when more than one base is registered, naming its choice', () => {
        const warn = jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
        ApiBase.fromMetadata( DEV, FULL_METADATA );
        ApiBase.fromMetadata( PROD, OTHER_METADATA );
        new CalendarSelect( 'en' );
        expect( warn ).toHaveBeenCalledWith( expect.stringContaining( DEV ) );
        expect( warn ).toHaveBeenCalledWith( expect.stringContaining( 'CalendarSelect' ) );
        warn.mockRestore();
    } );

    it( 'throws when no base is registered at all', () => {
        expect( () => new CalendarSelect( 'en' ) ).toThrow( /has not been initialized/ );
    } );

    it( 'names the component in the uninitialized error', () => {
        expect( () => new CalendarSelect( 'en' ) ).toThrow( /CalendarSelect/ );
    } );

} );
