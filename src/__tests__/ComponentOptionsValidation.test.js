/** @jest-environment jsdom */
/**
 * Every component that takes an options bag must reject one that is not a plain
 * object, rather than destructuring it to nothing and silently building itself
 * in English on every default.
 *
 * `new Intl.Locale( 'it' )` is the case that motivated issue #31: it is an object
 * and not an array, so the old `typeof options !== 'object' || Array.isArray()`
 * check passed it through, and it collides with none of the option names — so
 * the locale came out `undefined`, the existing `typeof inputLocale !== 'string'`
 * check was never reached, and the component rendered in English unwarned.
 *
 * The `null` expectations differ per component ON PURPOSE. Whether `null` should
 * mean "use defaults" or "wrong argument" is issue #32; this suite pins the
 * behaviour each component already has so that answering #32 is a visible,
 * deliberate change rather than a silent one. `LiturgyOfTheDay` is the exception:
 * it previously CRASHED on `null` with `TypeError: Cannot read properties of null`,
 * so it had no behaviour to preserve and takes its sibling's.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import LiturgyOfTheDay from '../LiturgyOfTheDay/LiturgyOfTheDay.js';
import LiturgyOfAnyDay from '../LiturgyOfAnyDay/LiturgyOfAnyDay.js';
import Messages from '../Messages.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const DEV = 'http://localhost:8000';

class BareThing {}

beforeEach( () => {
    ApiBase.reset();
    ApiBase.fromMetadata( DEV, FULL_METADATA );
} );

/**
 * The four arguments that must be rejected by every component, whatever each one
 * does with `null`.
 *
 * @type {Array<[string, () => unknown, RegExp]>}
 */
const REJECTED = [
    [ 'an Intl.Locale', () => new Intl.Locale( 'it' ), /found type: Locale/ ],
    [ 'a bare class instance', () => new BareThing(), /found type: BareThing/ ],
    [ 'an array', () => [ 'en' ], /found type: array/ ],
    [ 'a number', () => 123, /found type: number/ ]
];

/**
 * @type {Array<{name: string, build: (options: unknown) => unknown}>}
 */
const COMPONENTS = [
    { name: 'CalendarSelect', build: options => new CalendarSelect( options ) },
    { name: 'RiteSelect', build: options => new RiteSelect( options ) },
    { name: 'ApiOptions', build: options => new ApiOptions( options ) },
    { name: 'LiturgyOfTheDay', build: options => new LiturgyOfTheDay( options ) },
    { name: 'LiturgyOfAnyDay', build: options => new LiturgyOfAnyDay( options ) }
];

describe.each( COMPONENTS )( '$name rejects a non-plain-object options argument', ( { name, build } ) => {

    it.each( REJECTED )( 'rejects %s, naming the type it found', ( _label, make, typeMatcher ) => {
        expect( () => build( make() ) ).toThrow( typeMatcher );
    } );

    it.each( REJECTED )( 'names itself in the message when rejecting %s', ( _label, make ) => {
        expect( () => build( make() ) ).toThrow( new RegExp( `^${name}: Invalid type for options` ) );
    } );

} );

describe( 'existing null semantics are unchanged (see issue #32)', () => {

    it( 'CalendarSelect treats null as "no options given"', () => {
        expect( () => new CalendarSelect( null ) ).not.toThrow();
        expect( () => new CalendarSelect( undefined ) ).not.toThrow();
    } );

    it( 'RiteSelect treats null as "no options given"', () => {
        expect( new RiteSelect( null )._locale ).toBe( 'en' );
        expect( new RiteSelect( undefined )._locale ).toBe( 'en' );
    } );

    it( 'ApiOptions rejects null', () => {
        expect( () => new ApiOptions( null ) ).toThrow( /found type: null/ );
    } );

    it( 'LiturgyOfAnyDay treats null as "no options given", defaulting the locale to English', () => {
        const widget = new LiturgyOfAnyDay( null );
        expect( widget._domElement.querySelector( 'h1' ).textContent ).toBe( Messages[ 'en' ][ 'LITURGY_OF_THE_DAY' ] );
    } );

    /**
     * Previously `TypeError: Cannot read properties of null (reading 'hasOwnProperty')`,
     * despite `constructor( options = null )` advertising the no-argument form.
     */
    it( 'LiturgyOfTheDay takes its sibling\'s behaviour: null means "no options given"', () => {
        const widget = new LiturgyOfTheDay( null );
        expect( widget._domElement.querySelector( 'h1' ).textContent ).toBe( Messages[ 'en' ][ 'LITURGY_OF_THE_DAY' ] );
    } );

    it( 'LiturgyOfTheDay supports the no-argument form its default parameter advertises', () => {
        expect( () => new LiturgyOfTheDay() ).not.toThrow();
    } );

} );

describe( 'a plain options object is still accepted everywhere', () => {

    it.each( COMPONENTS )( '$name accepts { locale }', ( { build } ) => {
        expect( () => build( { locale: 'it' } ) ).not.toThrow();
    } );

    it.each( COMPONENTS )( '$name accepts a locale string', ( { build } ) => {
        expect( () => build( 'it' ) ).not.toThrow();
    } );

} );
