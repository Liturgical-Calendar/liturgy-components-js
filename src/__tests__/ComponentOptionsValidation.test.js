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
import ApiClient from '../ApiClient/ApiClient.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import WebCalendar from '../WebCalendar/WebCalendar.js';
import LiturgyOfTheDay from '../LiturgyOfTheDay/LiturgyOfTheDay.js';
import LiturgyOfAnyDay from '../LiturgyOfAnyDay/LiturgyOfAnyDay.js';
import Messages from '../Messages.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const DEV = 'http://localhost:8000';

class BareThing {}

/**
 * A one-event `/calendar` payload, enough for `WebCalendar.buildTable()` to emit a
 * table. `WebCalendar` exposes no accessor for its table element, so the only way
 * to observe the options its constructor applied is to let it render.
 *
 * @returns {Object} A fresh payload — `buildTable()` mutates `litcal[].date` in place.
 */
const CALENDAR_DATA = () => ( {
    litcal: [ {
        event_key: 'Advent1',
        event_idx: 1,
        name: 'Dominica I in Adventu Domini',
        color: [ 'purple' ],
        color_lcl: [ 'viola' ],
        grade: 7,
        grade_lcl: 'solennità',
        grade_abbr: 'S',
        grade_display: '',
        common: [],
        common_lcl: '',
        type: 'mobile',
        date: '2026-11-29T00:00:00+00:00',
        year: 2026,
        month: 11,
        month_short: 'Nov.',
        month_long: 'November',
        day: 29,
        day_of_the_week_iso8601: 7,
        day_of_the_week_short: 'Sun',
        day_of_the_week_long: 'Sunday',
        liturgical_year: 'A',
        is_vigil_mass: false,
        psalter_week: 1,
        liturgical_season: 'ADVENT',
        liturgical_season_lcl: 'Advent',
        holy_day_of_obligation: false
    } ],
    settings: { year: 2026, locale: 'en', year_type: 'LITURGICAL' },
    metadata: { version: 'test' },
    messages: []
} );

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

/**
 * The two bag shapes on which `options.hasOwnProperty( key )` does not work.
 *
 * The first is the one `isPlainOptionsObject()` explicitly documents as accepted:
 * a null-prototype object inherits no `hasOwnProperty` to call, so every guarded
 * read threw `TypeError: options.hasOwnProperty is not a function` and the bag
 * never reached the component it was accepted for.
 *
 * The second is the one that matters more, and the one no prototype-based guard
 * can ever catch: an ORDINARY plain object that happens to carry a `hasOwnProperty`
 * key of its own. It has `Object.prototype`, so it passes every shape check there
 * is; the own property simply shadows the method the read relied on. Unusual, but
 * entirely legal — and the failure was a bare `TypeError` naming nothing useful.
 *
 * Both are fixed by reading with `Object.hasOwn( bag, key )`, which depends on
 * neither the bag's prototype nor its keys.
 *
 * Each case asserts that the option INSIDE the bag took effect, not merely that
 * construction did not throw: a component that swallowed the bag and defaulted
 * everything would also not throw.
 *
 * @type {Array<[string, (props: Object) => Object]>}
 */
const AWKWARD_BAGS = [
    [ 'a null-prototype bag', props => Object.assign( Object.create( null ), props ) ],
    [ 'a bag whose own `hasOwnProperty` key shadows the method', props => ( { ...props, hasOwnProperty: 'not a function' } ) ]
];

describe.each( AWKWARD_BAGS )( 'options carried by %s are read', ( _label, bag ) => {

    it( 'CalendarSelect applies the class the bag carries', () => {
        const select = new CalendarSelect( bag( { locale: 'it', class: 'form-select' } ) );
        expect( select._domElement.className ).toBe( 'form-select' );
    } );

    it( 'CalendarSelect.label() applies the label options the bag carries', () => {
        const container = document.createElement( 'div' );
        const select = new CalendarSelect( { locale: 'it' } );
        select.label( bag( { text: 'Calendario', class: 'form-label' } ) );
        select.appendTo( container );
        const label = container.querySelector( 'label' );
        expect( label.textContent ).toBe( 'Calendario' );
        expect( label.className ).toBe( 'form-label' );
    } );

    it( 'CalendarSelect.wrapper() applies the wrapper options the bag carries', () => {
        const select = new CalendarSelect( { locale: 'it' } );
        select.wrapper( bag( { as: 'td', class: 'wrap' } ) );
        expect( select._wrapperElement.tagName ).toBe( 'TD' );
        expect( select._wrapperElement.className ).toBe( 'wrap' );
    } );

    it( 'RiteSelect applies the class and locale the bag carries', () => {
        const select = new RiteSelect( bag( { locale: 'it', class: 'form-select' } ) );
        expect( select._domElement.className ).toBe( 'form-select' );
        expect( select._locale ).toBe( 'it' );
    } );

    it( 'RiteSelect.label() applies the label options the bag carries', () => {
        const container = document.createElement( 'div' );
        const select = new RiteSelect( { locale: 'it' } );
        select.label( bag( { text: 'Rito', class: 'form-label' } ) );
        select.appendTo( container );
        const label = container.querySelector( 'label' );
        expect( label.textContent ).toBe( 'Rito' );
        expect( label.className ).toBe( 'form-label' );
    } );

    it( 'ApiOptions applies the locale the bag carries', () => {
        const apiOptions = new ApiOptions( bag( { locale: 'it' } ) );
        const optionLabels = [ ...apiOptions._yearTypeInput._domElement.options ].map( option => option.textContent );
        expect( optionLabels ).toContain( Messages[ 'it' ][ 'LITURGICAL_YEAR' ] );
    } );

    it( 'LiturgyOfTheDay applies the locale and class the bag carries', () => {
        const widget = new LiturgyOfTheDay( bag( { locale: 'it', class: 'card' } ) );
        expect( widget._titleElement.textContent ).toBe( Messages[ 'it' ][ 'LITURGY_OF_THE_DAY' ] );
        expect( widget._domElement.className ).toBe( 'card' );
    } );

    it( 'LiturgyOfAnyDay applies the locale and class the bag carries', () => {
        const widget = new LiturgyOfAnyDay( bag( { locale: 'it', class: 'card' } ) );
        expect( widget._titleElement.textContent ).toBe( Messages[ 'it' ][ 'LITURGY_OF_THE_DAY' ] );
        expect( widget._domElement.className ).toBe( 'card' );
    } );

    it( 'WebCalendar applies the id and class the bag carries', async () => {
        const apiClient = await ApiClient.init( DEV );
        const container = document.createElement( 'div' );
        const webCalendar = new WebCalendar( bag( { id: 'litcal', class: 'table' } ) );
        webCalendar.appendTo( container );
        webCalendar.listenTo( apiClient );
        apiClient._eventBus.emit( 'calendarFetched', CALENDAR_DATA() );
        await new Promise( resolve => setTimeout( resolve, 0 ) );
        const table = container.querySelector( 'table' );
        expect( table.id ).toBe( 'litcal' );
        expect( table.className ).toBe( 'table' );
    } );

} );
