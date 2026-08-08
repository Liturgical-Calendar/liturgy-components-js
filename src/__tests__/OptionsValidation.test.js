/**
 * Direct tests for the shared options guard.
 *
 * `assertPlainOptions` and `describeType` are shared contract across five
 * components, in the same way `resolveBase` and `assertSameBase` are, so they
 * are tested here on their own terms rather than only through their call sites.
 */
import { describe, it, expect } from '@jest/globals';
import { assertPlainOptions, describeType } from '../OptionsValidation.js';

class BareThing {}

describe( 'describeType', () => {

    it( 'distinguishes null from object', () => {
        expect( describeType( null ) ).toBe( 'null' );
    } );

    it( 'distinguishes an array from object', () => {
        expect( describeType( [ 'en' ] ) ).toBe( 'array' );
    } );

    /**
     * The case the whole guard exists for: `found type: object` would tell a
     * caller who passed an `Intl.Locale` nothing at all.
     */
    it( 'names a class instance by its constructor', () => {
        expect( describeType( new Intl.Locale( 'it' ) ) ).toBe( 'Locale' );
        expect( describeType( new BareThing() ) ).toBe( 'BareThing' );
    } );

    it( 'names a plain object `Object`', () => {
        expect( describeType( {} ) ).toBe( 'Object' );
    } );

    it( 'falls back to `object` for a null-prototype object, which has no constructor', () => {
        expect( describeType( Object.create( null ) ) ).toBe( 'object' );
    } );

    it( 'reports primitives by their typeof', () => {
        expect( describeType( 123 ) ).toBe( 'number' );
        expect( describeType( 'en' ) ).toBe( 'string' );
        expect( describeType( true ) ).toBe( 'boolean' );
        expect( describeType( undefined ) ).toBe( 'undefined' );
        expect( describeType( () => {} ) ).toBe( 'function' );
    } );

} );

describe( 'assertPlainOptions', () => {

    it( 'accepts a plain object', () => {
        expect( () => assertPlainOptions( {}, 'Component' ) ).not.toThrow();
        expect( () => assertPlainOptions( { locale: 'it' }, 'Component' ) ).not.toThrow();
    } );

    /**
     * A null-prototype object carries no inherited keys to collide with option
     * names, which is exactly the property the guard is protecting. Rejecting it
     * would be arbitrary.
     */
    it( 'accepts a null-prototype object', () => {
        expect( () => assertPlainOptions( Object.create( null ), 'Component' ) ).not.toThrow();
    } );

    it( 'rejects null', () => {
        expect( () => assertPlainOptions( null, 'Component' ) ).toThrow( /found type: null/ );
    } );

    it( 'rejects undefined', () => {
        expect( () => assertPlainOptions( undefined, 'Component' ) ).toThrow( /found type: undefined/ );
    } );

    it( 'rejects an array', () => {
        expect( () => assertPlainOptions( [ 'en' ], 'Component' ) ).toThrow( /found type: array/ );
    } );

    it( 'rejects a number', () => {
        expect( () => assertPlainOptions( 123, 'Component' ) ).toThrow( /found type: number/ );
    } );

    /**
     * `Object.getPrototypeOf( new Intl.Locale( 'it' ) ) !== Object.prototype`, which
     * is what a bare `typeof options === 'object' && !Array.isArray( options )` misses.
     */
    it( 'rejects an Intl.Locale', () => {
        expect( () => assertPlainOptions( new Intl.Locale( 'it' ), 'Component' ) ).toThrow( /found type: Locale/ );
    } );

    it( 'rejects any other class instance', () => {
        expect( () => assertPlainOptions( new BareThing(), 'Component' ) ).toThrow( /found type: BareThing/ );
    } );

    it( 'names the component in the message, so the caller knows which constructor rejected', () => {
        expect( () => assertPlainOptions( 123, 'CalendarSelect' ) )
            .toThrow( 'CalendarSelect: Invalid type for options, must be of type `object` but found type: number' );
    } );

} );
