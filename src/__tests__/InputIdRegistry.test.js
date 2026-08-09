/** @jest-environment jsdom */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import Input from '../ApiOptions/Input/Input.js';
import YearInput from '../ApiOptions/Input/YearInput.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

// Every Input subclass's default id comes from a registry that is global to the
// module (see `Input.#issuedIds`). Without a reset, ids claimed by an earlier test
// in this file would leak into the next one, and assertions about bare ids
// (`'locale'`, `'year'`, ...) would stop matching from the second test onward.
beforeEach( () => {
    ApiBase.reset();
    ApiBase.fromMetadata( API_URL, FULL_METADATA );
    Input.reset();
    document.body.innerHTML = '<div id="first"></div><div id="second"></div>';
} );

/** The complete set of Input getters that `ApiOptions` (with the default filter) renders. */
const inputGetters = [
    '_localeInput',
    '_yearTypeInput',
    '_acceptHeaderInput',
    '_yearInput',
    '_epiphanyInput',
    '_ascensionInput',
    '_corpusChristiInput',
    '_eternalHighPriestInput',
    '_holydaysOfObligationInput'
];

/** The bare default id each of the above getters is expected to claim, in order. */
const bareIds = [
    'locale',
    'year_type',
    'return_type',
    'year',
    'epiphany',
    'ascension',
    'corpus_christi',
    'eternal_high_priest',
    'holydays_of_obligation'
];

describe( 'Input default id registry', () => {

    it( 'lets a single ApiOptions keep bare ids, exactly as before the registry existed', () => {
        const apiOptions = new ApiOptions( 'en' );
        apiOptions.appendTo( '#first' );

        inputGetters.forEach( ( getter, i ) => {
            expect( apiOptions[ getter ]._domElement.id ).toBe( bareIds[ i ] );
            expect( apiOptions[ getter ]._labelElement.htmlFor ).toBe( bareIds[ i ] );
        } );
    } );

    it( 'suffixes the second ApiOptions on the same page, keeping the id sets disjoint', () => {
        const first  = new ApiOptions( 'en' );
        first.appendTo( '#first' );
        const second = new ApiOptions( 'en' );
        second.appendTo( '#second' );

        inputGetters.forEach( ( getter, i ) => {
            expect( first[ getter ]._domElement.id ).toBe( bareIds[ i ] );
            expect( second[ getter ]._domElement.id ).toBe( `${ bareIds[ i ] }-2` );
        } );

        // The DOM itself must never hold two elements sharing an id.
        bareIds.forEach( id => {
            expect( document.querySelectorAll( `#${ id }` ).length ).toBe( 1 );
            expect( document.querySelectorAll( `#${ id }-2` ).length ).toBe( 1 );
        } );
    } );

    it( "resolves each second-instance label's htmlFor to an element inside that same instance", () => {
        // This is the assertion that actually encodes the bug: before the fix, the
        // second panel's <label for="locale"> resolved to the FIRST panel's <select>,
        // because both panels' inputs shared the id "locale".
        new ApiOptions( 'en' ).appendTo( '#first' );
        const second = new ApiOptions( 'en' );
        second.appendTo( '#second' );
        const secondContainer = document.getElementById( 'second' );

        inputGetters.forEach( ( getter ) => {
            const input = second[ getter ];
            const labelFor = input._labelElement.htmlFor;
            const resolved = document.getElementById( labelFor );
            expect( resolved ).toBe( input._domElement );
            expect( secondContainer.contains( resolved ) ).toBe( true );
        } );
    } );

    it( 'still lets an explicit .id() call win, without any numeric suffix', () => {
        const yearInput = new YearInput();
        expect( yearInput._domElement.id ).toBe( 'year' );

        yearInput.id( 'my-custom-year' );
        expect( yearInput._domElement.id ).toBe( 'my-custom-year' );
        expect( yearInput._labelElement.htmlFor ).toBe( 'my-custom-year' );

        // A later default claim of the SAME base id must still suffix off the
        // registry's bare "year" (claimed by the first construction above), and
        // must not collide with the explicitly claimed "my-custom-year" either.
        const anotherYearInput = new YearInput();
        expect( anotherYearInput._domElement.id ).toBe( 'year-2' );
    } );

    it( 'restores bare ids for a subsequent construction after Input.reset()', () => {
        const before = new YearInput();
        expect( before._domElement.id ).toBe( 'year' );

        const collides = new YearInput();
        expect( collides._domElement.id ).toBe( 'year-2' );

        Input.reset();

        const after = new YearInput();
        expect( after._domElement.id ).toBe( 'year' );
    } );

} );
