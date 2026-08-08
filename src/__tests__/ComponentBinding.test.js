/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase, { resolveBase } from '../ApiClient/ApiBase.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import { Rite } from '../Enums.js';
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

describe( 'CalendarSelect leaves the base metadata unmutated', () => {

    /**
     * `#buildAllOptions()` sorts the national list IN PLACE, by the instance's own
     * localised country names. Read straight from the base, that sort would
     * permanently reorder the array every other client of the base reads — a second
     * select in the other pane, or `ApiOptions`. Italian collation reorders the
     * fixture (Città del Vaticano, Italia, Stati Uniti => VA, IT, US) where English
     * leaves it alone, so an Italian select is what makes the mutation observable.
     *
     * Asserted on ORDER, not identity: `nationalCalendars()` hands back the same
     * array object on every call, so a `toBe` comparison would pass either way.
     */
    it( 'does not reorder the base national calendars when sorting its own copy', () => {
        const base = ApiBase.fromMetadata( DEV, FULL_METADATA );
        new CalendarSelect( { locale: 'it', apiClient: { base } } );
        expect( base.nationalCalendars().map( calendar => calendar.calendar_id ) ).toEqual( [ 'IT', 'US', 'VA' ] );
    } );

    /** `_applyRite()` rebuilds, and every rebuild sorts again — on the copy, not the base. */
    it( 'still leaves it unmutated after a rite change rebuilds the options', () => {
        const base = ApiBase.fromMetadata( DEV, FULL_METADATA );
        const select = new CalendarSelect( { locale: 'it', apiClient: { base } } );
        select.rite( Rite.AMBROSIAN );
        expect( base.nationalCalendars().map( calendar => calendar.calendar_id ) ).toEqual( [ 'IT', 'US', 'VA' ] );
    } );

    it( 'leaves it unmutated however many selects in however many locales read it', () => {
        const base = ApiBase.fromMetadata( DEV, FULL_METADATA );
        [ 'it', 'en', 'nl', 'hu' ].forEach( locale => new CalendarSelect( { locale, apiClient: { base } } ) );
        expect( base.nationalCalendars().map( calendar => calendar.calendar_id ) ).toEqual( [ 'IT', 'US', 'VA' ] );
    } );

} );

describe( 'resolveBase rejects an apiClient that is not an ApiClient', () => {

    const NAMED = /must be an ApiClient obtained from ApiClient\.init\(\)/;

    beforeEach( () => {
        ApiBase.fromMetadata( DEV, FULL_METADATA );
    } );

    it( 'rejects an object carrying no base', () => {
        expect( () => new CalendarSelect( { locale: 'en', apiClient: {} } ) ).toThrow( NAMED );
    } );

    it( 'rejects a string', () => {
        expect( () => new CalendarSelect( { locale: 'en', apiClient: 'not-a-client' } ) ).toThrow( NAMED );
    } );

    it( 'rejects an ApiBase passed where an ApiClient was expected', () => {
        const base = ApiBase.resolve( DEV );
        expect( () => new CalendarSelect( { locale: 'en', apiClient: base } ) ).toThrow( NAMED );
    } );

    it( 'names the component in the rejection', () => {
        expect( () => new CalendarSelect( { locale: 'en', apiClient: {} } ) ).toThrow( /CalendarSelect/ );
    } );

    it( 'does not fall back to the registered base instead of throwing', () => {
        expect( () => new CalendarSelect( { locale: 'en', apiClient: {} } ) ).toThrow();
    } );

} );

describe( 'the ambiguous fallback warns once per component', () => {

    beforeEach( () => {
        ApiBase.fromMetadata( DEV, FULL_METADATA );
        ApiBase.fromMetadata( PROD, OTHER_METADATA );
    } );

    it( 'warns exactly once however many instances are constructed', () => {
        const warn = jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
        new CalendarSelect( 'en' );
        new CalendarSelect( 'en' );
        new CalendarSelect( 'it' );
        expect( warn ).toHaveBeenCalledTimes( 1 );
        warn.mockRestore();
    } );

    it( 'warns separately for a different component class', () => {
        const warn = jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
        resolveBase( null, 'CalendarSelect' );
        resolveBase( null, 'ApiOptions' );
        resolveBase( null, 'ApiOptions' );
        expect( warn ).toHaveBeenCalledTimes( 2 );
        expect( warn ).toHaveBeenCalledWith( expect.stringContaining( 'ApiOptions' ) );
        warn.mockRestore();
    } );

    it( 'warns again after a reset, which starts a fresh registry', () => {
        const warn = jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
        new CalendarSelect( 'en' );
        ApiBase.reset();
        ApiBase.fromMetadata( DEV, FULL_METADATA );
        ApiBase.fromMetadata( PROD, OTHER_METADATA );
        new CalendarSelect( 'en' );
        expect( warn ).toHaveBeenCalledTimes( 2 );
        warn.mockRestore();
    } );

} );
