/** @jest-environment jsdom */
import { describe, it, expect } from '@jest/globals';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import { Rite } from '../Enums.js';

describe( 'RiteSelect', () => {

    it( 'renders one option per rite, Roman first', () => {
        const rs = new RiteSelect( 'en' );
        expect( rs._domElement.innerHTML ).toContain( 'value="roman"' );
        expect( rs._domElement.innerHTML ).toContain( 'value="ambrosian"' );
        expect( rs._domElement.innerHTML.indexOf( 'value="roman"' ) )
            .toBeLessThan( rs._domElement.innerHTML.indexOf( 'value="ambrosian"' ) );
    } );

    it( 'defaults to Roman', () => {
        const rs = new RiteSelect( 'en' );
        expect( rs._domElement.value ).toBe( Rite.ROMAN );
    } );

    it( 'has no empty option — a request always has a rite', () => {
        const rs = new RiteSelect( 'en' );
        expect( rs._domElement.innerHTML ).not.toContain( 'value=""' );
    } );

    it( 'supports the same chainable surface as CalendarSelect', () => {
        const rs = new RiteSelect( 'en' ).class( 'form-select' ).id( 'riteSelect' );
        expect( rs._domElement.className ).toBe( 'form-select' );
        expect( rs._domElement.id ).toBe( 'riteSelect' );
    } );

    it( 'rejects an invalid locale with the same message CalendarSelect uses', () => {
        // Without running the locale through `Intl.getCanonicalLocales`, this
        // surfaces as a raw `RangeError: Incorrect locale information provided`
        // from `new Intl.Locale()` instead of the library's own message.
        expect( () => new RiteSelect( 'this is not a locale' ) ).toThrow( /Invalid locale/ );
    } );

    it( 'canonicalizes the locale, underscores included', () => {
        expect( new RiteSelect( 'it_IT' )._locale ).toBe( 'it-IT' );
        expect( new RiteSelect( 'EN-us' )._locale ).toBe( 'en-US' );
    } );
} );

import YearInput from '../ApiOptions/Input/YearInput.js';

describe( 'YearInput minimum', () => {

    it( 'defaults to 1970', () => {
        expect( new YearInput()._domElement.min ).toBe( '1970' );
    } );

    it( 'can be raised and lowered again', () => {
        const yi = new YearInput();
        yi.min( 1976 );
        expect( yi._domElement.min ).toBe( '1976' );
        yi.min( 1970 );
        expect( yi._domElement.min ).toBe( '1970' );
    } );
} );
