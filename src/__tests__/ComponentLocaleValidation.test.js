/** @jest-environment jsdom */
/**
 * The six components that sanitise a caller-supplied locale now share one
 * helper. This suite pins, per component, the four things that must not drift:
 *
 * 1. a valid locale still produces the canonical tag it produced before;
 * 2. an underscored form still normalises;
 * 3. an unparseable string throws, naming the component AND the tag — the part
 *    that is new, since `Intl`'s own `RangeError` names neither;
 * 4. an ABSENT locale still defaults exactly as that component defaulted before.
 *
 * (4) matters most. An omission is not a failure and must keep meaning "use
 * English"; a locale that is present but unparseable must throw rather than
 * silently become English, which is the failure mode issue #31 removed. The
 * components deliberately disagree about what `null` OPTIONS mean — that is
 * issue #32 and `ComponentOptionsValidation.test.js` pins it — so nothing here
 * touches that question.
 *
 * The stored tag is read through whatever each component already exposes rather
 * than through new accessors: `_locale` on `RiteSelect` and `WebCalendar`, an
 * error message that embeds it on `CalendarSelect`, and rendered output on the
 * two liturgy widgets. `ApiOptions` alone exposes no accessor and passes only
 * `locale.language` to its sub-inputs, so its region subtag is unobservable
 * from outside; what can be checked is checked, and the canonical tag itself is
 * covered by `LocaleValidation.test.js` against the same helper it calls.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import WebCalendar from '../WebCalendar/WebCalendar.js';
import LiturgyOfTheDay from '../LiturgyOfTheDay/LiturgyOfTheDay.js';
import LiturgyOfAnyDay from '../LiturgyOfAnyDay/LiturgyOfAnyDay.js';
import Messages from '../Messages.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

beforeEach( () => {
    ApiBase.reset();
    ApiBase.fromMetadata( API_URL, FULL_METADATA );
} );

/**
 * `CalendarSelect` keeps its locale private and offers no getter, but embeds it
 * verbatim in several of its own error messages. Reading it back through one of
 * them beats adding public surface for a test.
 */
function calendarSelectLocale( select ) {
    try {
        select.class( 123 );
    } catch ( error ) {
        return error.message.match( /with locale (.+?),/ )[ 1 ];
    }
    throw new Error( 'CalendarSelect.class( 123 ) was expected to throw' );
}

describe( 'CalendarSelect', () => {

    it( 'stores the canonical tag for a valid locale', () => {
        expect( calendarSelectLocale( new CalendarSelect( 'it-IT' ) ) ).toBe( 'it-IT' );
        expect( calendarSelectLocale( new CalendarSelect( 'EN-us' ) ) ).toBe( 'en-US' );
    } );

    it( 'normalizes an underscored locale', () => {
        expect( calendarSelectLocale( new CalendarSelect( 'it_IT' ) ) ).toBe( 'it-IT' );
    } );

    it( 'throws on an unparseable locale, naming itself and the tag', () => {
        expect( () => new CalendarSelect( 'not a locale' ) )
            .toThrow( 'CalendarSelect: Invalid locale: not a locale' );
        expect( () => new CalendarSelect( { locale: 'it__IT' } ) )
            .toThrow( 'CalendarSelect: Invalid locale: it--IT' );
    } );

    it( 'rejects a non-string locale, naming itself and the type', () => {
        expect( () => new CalendarSelect( { locale: 123 } ) )
            .toThrow( 'CalendarSelect: Invalid type for locale, must be of type `string` but found type: number' );
    } );

    it( 'still defaults an absent locale to English', () => {
        expect( calendarSelectLocale( new CalendarSelect() ) ).toBe( 'en' );
        expect( calendarSelectLocale( new CalendarSelect( {} ) ) ).toBe( 'en' );
        expect( calendarSelectLocale( new CalendarSelect( { locale: undefined } ) ) ).toBe( 'en' );
        expect( calendarSelectLocale( new CalendarSelect( { locale: null } ) ) ).toBe( 'en' );
    } );

} );

describe( 'RiteSelect', () => {

    it( 'stores the canonical tag for a valid locale', () => {
        expect( new RiteSelect( 'it-IT' )._locale ).toBe( 'it-IT' );
        expect( new RiteSelect( 'EN-us' )._locale ).toBe( 'en-US' );
    } );

    it( 'normalizes an underscored locale', () => {
        expect( new RiteSelect( 'it_IT' )._locale ).toBe( 'it-IT' );
    } );

    it( 'throws on an unparseable locale, naming itself and the tag', () => {
        expect( () => new RiteSelect( 'not a locale' ) )
            .toThrow( 'RiteSelect: Invalid locale: not a locale' );
    } );

    it( 'rejects a non-string locale, naming itself and the type', () => {
        expect( () => new RiteSelect( { locale: 123 } ) )
            .toThrow( 'RiteSelect: Invalid type for locale, must be of type `string` but found type: number' );
    } );

    it( 'still defaults an absent locale to English', () => {
        expect( new RiteSelect()._locale ).toBe( 'en' );
        expect( new RiteSelect( {} )._locale ).toBe( 'en' );
        expect( new RiteSelect( { locale: undefined } )._locale ).toBe( 'en' );
        expect( new RiteSelect( { locale: null } )._locale ).toBe( 'en' );
    } );

} );

describe( 'ApiOptions', () => {

    /** `Intl.DisplayNames` names the API's locales "italiano" in Italian, "Italian" in English. */
    const localeLabels = ( apiOptions ) =>
        Array.from( apiOptions._localeInput._domElement.options ).map( option => option.textContent );

    it( 'applies a valid locale rather than defaulting to English', () => {
        expect( localeLabels( new ApiOptions( 'it-IT' ) ) ).toContain( 'italiano' );
    } );

    it( 'normalizes an underscored locale to the same result as the hyphenated form', () => {
        expect( localeLabels( new ApiOptions( 'it_IT' ) ) ).toEqual( localeLabels( new ApiOptions( 'it-IT' ) ) );
    } );

    it( 'throws on an unparseable locale, naming itself and the tag', () => {
        expect( () => new ApiOptions( 'not a locale' ) )
            .toThrow( 'ApiOptions: Invalid locale: not a locale' );
        expect( () => new ApiOptions( 'it__IT' ) )
            .toThrow( 'ApiOptions: Invalid locale: it--IT' );
    } );

    it( 'rejects a non-string locale, naming itself and the type', () => {
        expect( () => new ApiOptions( { locale: 123 } ) )
            .toThrow( 'ApiOptions: Invalid type for locale, must be of type `string` but found type: number' );
    } );

    /**
     * `ApiOptions` alone defaults through a destructuring default rather than an
     * explicit branch, so `{ locale: undefined }` and `{}` take the same path;
     * `{ locale: null }` does NOT, and is rejected as a non-string. That asymmetry
     * predates this refactor and is left exactly as it was.
     */
    it( 'still defaults an absent locale to English', () => {
        expect( localeLabels( new ApiOptions() ) ).toContain( 'Italian' );
        expect( localeLabels( new ApiOptions( {} ) ) ).toContain( 'Italian' );
        expect( localeLabels( new ApiOptions( { locale: undefined } ) ) ).toContain( 'Italian' );
    } );

    it( 'still rejects an explicitly null locale rather than defaulting it', () => {
        expect( () => new ApiOptions( { locale: null } ) ).toThrow( /Invalid type for locale/ );
    } );

} );

describe( 'WebCalendar', () => {

    it( 'stores the canonical tag for a valid locale', () => {
        expect( new WebCalendar().locale( 'it-IT' )._locale ).toBe( 'it-IT' );
    } );

    /**
     * The one deliberate behaviour change of this refactor. `locale()` used to
     * store the merely underscore-normalized argument, so `'EN-us'` was kept as
     * `'EN-us'`; it now stores the canonical `'en-US'`, as the other five have
     * always done. Formatting is unaffected — `Intl` canonicalises internally —
     * so only the `_locale` getter's string differs, and only for an argument
     * that was not already canonical.
     */
    it( 'canonicalizes rather than merely normalizing, unlike before', () => {
        expect( new WebCalendar().locale( 'EN-us' )._locale ).toBe( 'en-US' );
        expect( new WebCalendar().locale( 'en_us' )._locale ).toBe( 'en-US' );
    } );

    it( 'normalizes an underscored locale', () => {
        expect( new WebCalendar().locale( 'it_IT' )._locale ).toBe( 'it-IT' );
    } );

    it( 'throws on an unparseable locale, naming the setter and the tag', () => {
        expect( () => new WebCalendar().locale( 'not a locale' ) )
            .toThrow( 'WebCalendar.locale: Invalid locale: not a locale' );
        expect( () => new WebCalendar().locale( 'it__IT' ) )
            .toThrow( 'WebCalendar.locale: Invalid locale: it--IT' );
    } );

    it( 'rejects a non-string locale, naming the setter and the type', () => {
        expect( () => new WebCalendar().locale( 123 ) )
            .toThrow( 'WebCalendar.locale: Invalid type for locale, must be of type `string` but found type: number' );
    } );

    /** Kept ahead of the shared helper, whose message would name nothing at all. */
    it( 'still gives the empty string its own message', () => {
        expect( () => new WebCalendar().locale( '' ) )
            .toThrow( 'WebCalendar.locale:Invalid locale identifier, cannot be an empty string' );
    } );

    /**
     * `locale()` is a setter, not a constructor option: "absent" means never
     * called, and the field default is `en-US` rather than `en`.
     */
    it( 'still defaults to en-US when the setter is never called', () => {
        expect( new WebCalendar()._locale ).toBe( 'en-US' );
    } );

} );

/**
 * Both widgets store an `Intl.Locale` and expose it only through rendered
 * output: the title comes from `Messages[ locale.language ]`, and the date is
 * formatted with `locale.baseName` at `dateStyle: 'full'` — a style whose
 * pattern differs by REGION, so `en-GB` and `en-US` are distinguishable and the
 * region subtag is proven to survive normalisation.
 */
describe.each( [
    [ 'LiturgyOfTheDay', options => new LiturgyOfTheDay( options ) ],
    [ 'LiturgyOfAnyDay', options => new LiturgyOfAnyDay( options ) ]
] )( '%s', ( name, build ) => {

    const dateText = ( widget ) => widget._dateElement.textContent;
    const titleText = ( widget ) => widget._titleElement.textContent;

    it( 'stores the canonical tag for a valid locale', () => {
        expect( titleText( build( 'it-IT' ) ) ).toBe( Messages[ 'it' ][ 'LITURGY_OF_THE_DAY' ] );
        expect( dateText( build( 'en-GB' ) ) ).not.toBe( dateText( build( 'en-US' ) ) );
    } );

    it( 'normalizes an underscored locale, region subtag intact', () => {
        expect( dateText( build( 'en_GB' ) ) ).toBe( dateText( build( 'en-GB' ) ) );
        expect( dateText( build( 'en_GB' ) ) ).not.toBe( dateText( build( 'en-US' ) ) );
        expect( titleText( build( 'it_IT' ) ) ).toBe( Messages[ 'it' ][ 'LITURGY_OF_THE_DAY' ] );
    } );

    it( 'throws on an unparseable locale, naming itself and the tag', () => {
        expect( () => build( 'not a locale' ) ).toThrow( `${name}: Invalid locale: not a locale` );
        expect( () => build( { locale: 'it__IT' } ) ).toThrow( `${name}: Invalid locale: it--IT` );
    } );

    it( 'rejects a non-string locale, naming itself and the type', () => {
        expect( () => build( { locale: 123 } ) )
            .toThrow( `${name}: Invalid type for locale, must be of type \`string\` but found type: number` );
    } );

    /**
     * Both read the key with `Object.hasOwn`, so a bag WITHOUT `locale` defaults
     * while a bag carrying `locale: null` or `locale: undefined` does not — it is
     * passed through and rejected as a non-string. Unchanged by this refactor.
     */
    it( 'still defaults an absent locale to English', () => {
        expect( titleText( build() ) ).toBe( Messages[ 'en' ][ 'LITURGY_OF_THE_DAY' ] );
        expect( titleText( build( {} ) ) ).toBe( Messages[ 'en' ][ 'LITURGY_OF_THE_DAY' ] );
        expect( titleText( build( null ) ) ).toBe( Messages[ 'en' ][ 'LITURGY_OF_THE_DAY' ] );
    } );

    it( 'still rejects an explicitly null locale inside a bag rather than defaulting it', () => {
        expect( () => build( { locale: null } ) ).toThrow( /Invalid type for locale/ );
    } );

} );
