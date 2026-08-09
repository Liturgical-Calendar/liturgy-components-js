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
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import ApiClientError from '../ApiClient/ApiClientError.js';
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
            .toThrow( 'CalendarSelect: Invalid type for locale, must be of type `string` or `Intl.Locale` but found type: number' );
    } );

    it( 'still defaults an absent locale to English', () => {
        expect( calendarSelectLocale( new CalendarSelect() ) ).toBe( 'en' );
        expect( calendarSelectLocale( new CalendarSelect( null ) ) ).toBe( 'en' );
        expect( calendarSelectLocale( new CalendarSelect( {} ) ) ).toBe( 'en' );
        expect( calendarSelectLocale( new CalendarSelect( { locale: undefined } ) ) ).toBe( 'en' );
        expect( calendarSelectLocale( new CalendarSelect( { locale: null } ) ) ).toBe( 'en' );
    } );

    it( 'accepts an Intl.Locale, bare or inside a bag', () => {
        expect( calendarSelectLocale( new CalendarSelect( new Intl.Locale( 'it-IT' ) ) ) ).toBe( 'it-IT' );
        expect( calendarSelectLocale( new CalendarSelect( { locale: new Intl.Locale( 'it-IT' ) } ) ) ).toBe( 'it-IT' );
    } );

    it( 'canonicalizes an Intl.Locale built from a non-canonical tag', () => {
        expect( calendarSelectLocale( new CalendarSelect( new Intl.Locale( 'EN-us' ) ) ) ).toBe( 'en-US' );
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
            .toThrow( 'RiteSelect: Invalid type for locale, must be of type `string` or `Intl.Locale` but found type: number' );
    } );

    it( 'still defaults an absent locale to English', () => {
        expect( new RiteSelect()._locale ).toBe( 'en' );
        expect( new RiteSelect( null )._locale ).toBe( 'en' );
        expect( new RiteSelect( {} )._locale ).toBe( 'en' );
        expect( new RiteSelect( { locale: undefined } )._locale ).toBe( 'en' );
        expect( new RiteSelect( { locale: null } )._locale ).toBe( 'en' );
    } );

    it( 'accepts an Intl.Locale, bare or inside a bag', () => {
        expect( new RiteSelect( new Intl.Locale( 'it-IT' ) )._locale ).toBe( 'it-IT' );
        expect( new RiteSelect( { locale: new Intl.Locale( 'it-IT' ) } )._locale ).toBe( 'it-IT' );
        expect( new RiteSelect( new Intl.Locale( 'EN-us' ) )._locale ).toBe( 'en-US' );
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
            .toThrow( 'ApiOptions: Invalid type for locale, must be of type `string` or `Intl.Locale` but found type: number' );
    } );

    /**
     * `ApiOptions` alone defaulted through a destructuring default rather than an
     * explicit branch, so `{ locale: undefined }` and `{}` took the same path while
     * `{ locale: null }` was rejected as a non-string. Issue #32 removed that
     * asymmetry: all four spellings of "absent" now default.
     */
    it( 'defaults an absent locale to English, however the absence is spelled', () => {
        expect( localeLabels( new ApiOptions() ) ).toContain( 'Italian' );
        expect( localeLabels( new ApiOptions( {} ) ) ).toContain( 'Italian' );
        expect( localeLabels( new ApiOptions( { locale: undefined } ) ) ).toContain( 'Italian' );
        expect( localeLabels( new ApiOptions( { locale: null } ) ) ).toContain( 'Italian' );
        expect( localeLabels( new ApiOptions( null ) ) ).toContain( 'Italian' );
    } );

    it( 'accepts an Intl.Locale, bare or inside a bag', () => {
        expect( localeLabels( new ApiOptions( new Intl.Locale( 'it-IT' ) ) ) ).toContain( 'italiano' );
        expect( localeLabels( new ApiOptions( { locale: new Intl.Locale( 'it-IT' ) } ) ) ).toContain( 'italiano' );
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
            .toThrow( 'WebCalendar.locale: Invalid type for locale, must be of type `string` or `Intl.Locale` but found type: number' );
    } );

    /**
     * The empty string still gets a message of its own, but from the shared
     * helper rather than from a guard hand-rolled in this one setter — so the
     * setter is named with the space its old message was missing, and the other
     * five components report a blank tag the same way.
     */
    it( 'gives the empty string its own message, from the shared helper', () => {
        expect( () => new WebCalendar().locale( '' ) )
            .toThrow( 'WebCalendar.locale: Invalid locale, cannot be an empty or blank string' );
        expect( () => new WebCalendar().locale( '   ' ) )
            .toThrow( 'WebCalendar.locale: Invalid locale, cannot be an empty or blank string' );
    } );

    /**
     * `locale()` is a setter, not a constructor option: "absent" means never
     * called, and the field default is `en-US` rather than `en`.
     */
    it( 'still defaults to en-US when the setter is never called', () => {
        expect( new WebCalendar()._locale ).toBe( 'en-US' );
    } );

    it( 'accepts an Intl.Locale and stores its canonical tag', () => {
        expect( new WebCalendar().locale( new Intl.Locale( 'it-IT' ) )._locale ).toBe( 'it-IT' );
        expect( new WebCalendar().locale( new Intl.Locale( 'EN-us' ) )._locale ).toBe( 'en-US' );
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
            .toThrow( `${name}: Invalid type for locale, must be of type \`string\` or \`Intl.Locale\` but found type: number` );
    } );

    /**
     * Both used to read the key with `Object.hasOwn`, so a bag WITHOUT `locale`
     * defaulted while a bag carrying `locale: null` or `locale: undefined` did
     * not — it was passed through and rejected as a non-string. Issue #32 made
     * the read nullish instead: the key's presence is not the question.
     */
    it( 'defaults an absent locale to English, however the absence is spelled', () => {
        expect( titleText( build() ) ).toBe( Messages[ 'en' ][ 'LITURGY_OF_THE_DAY' ] );
        expect( titleText( build( {} ) ) ).toBe( Messages[ 'en' ][ 'LITURGY_OF_THE_DAY' ] );
        expect( titleText( build( null ) ) ).toBe( Messages[ 'en' ][ 'LITURGY_OF_THE_DAY' ] );
        expect( titleText( build( undefined ) ) ).toBe( Messages[ 'en' ][ 'LITURGY_OF_THE_DAY' ] );
        expect( titleText( build( { locale: null } ) ) ).toBe( Messages[ 'en' ][ 'LITURGY_OF_THE_DAY' ] );
        expect( titleText( build( { locale: undefined } ) ) ).toBe( Messages[ 'en' ][ 'LITURGY_OF_THE_DAY' ] );
    } );

    it( 'accepts an Intl.Locale, bare or inside a bag, region subtag intact', () => {
        expect( titleText( build( new Intl.Locale( 'it-IT' ) ) ) ).toBe( Messages[ 'it' ][ 'LITURGY_OF_THE_DAY' ] );
        expect( titleText( build( { locale: new Intl.Locale( 'it-IT' ) } ) ) ).toBe( Messages[ 'it' ][ 'LITURGY_OF_THE_DAY' ] );
        expect( dateText( build( new Intl.Locale( 'en-GB' ) ) ) ).toBe( dateText( build( 'en-GB' ) ) );
        expect( dateText( build( new Intl.Locale( 'en-GB' ) ) ) ).not.toBe( dateText( build( 'en-US' ) ) );
    } );

} );

/**
 * `ApiClient.fetchCalendar()` is not one of the six — it takes a locale as a
 * per-request argument rather than as construction-time configuration — but it
 * used to hand-roll the same three checks, so it now calls the same helper. Its
 * own sentinels are unchanged: `null` means "no locale given, keep the one in
 * force", and a well-formed tag the API does not serve is silently kept out of
 * the header rather than rejected.
 *
 * An unusable locale REJECTS the returned promise; it does not throw at the call
 * site. Each assertion below therefore calls `fetchCalendar()` OUTSIDE any `try`,
 * as the argument to `expect()`, so that a synchronous throw fails the test at
 * the call rather than being caught by the assertion — the same shape
 * `ApiClientErrors.test.js` uses for the cache-hit contract, and the only shape
 * that tells the fix apart from the bug.
 */
describe( 'ApiClient.fetchCalendar locale argument', () => {

    let apiClient;

    beforeEach( async () => {
        global.fetch = jest.fn().mockResolvedValue( {
            ok: true,
            json: () => Promise.resolve( { litcal: [], settings: {}, metadata: {}, messages: [] } )
        } );
        apiClient = await ApiClient.init( API_URL );
    } );

    it( 'rejects an empty or blank locale, naming the method', async () => {
        await expect( apiClient.fetchCalendar( '' ) )
            .rejects.toThrow( 'ApiClient.fetchCalendar: Invalid locale, cannot be an empty or blank string' );
        await expect( apiClient.fetchCalendar( '   ' ) )
            .rejects.toThrow( 'ApiClient.fetchCalendar: Invalid locale, cannot be an empty or blank string' );
        // `init()` issues no request — the outer `beforeEach` has already loaded the
        // base from the fixture — so every call counted here is a calendar request,
        // and there must be none of them.
        expect( global.fetch ).not.toHaveBeenCalled();
    } );

    it( 'rejects a non-string locale, naming the method and the type', async () => {
        await expect( apiClient.fetchCalendar( 123 ) )
            .rejects.toThrow( 'ApiClient.fetchCalendar: Invalid type for locale, must be of type `string` or `Intl.Locale` but found type: number' );
    } );

    it( 'emits no calendarFetchFailed for an unusable locale', async () => {
        // `calendarFetchFailed` reports a request that failed. No request was made,
        // so a subscriber must hear nothing — and the rejection must still be a
        // plain `Error`, not an `ApiClientError` with no request context to carry.
        const onFailure = jest.fn();
        apiClient.on( 'calendarFetchFailed', onFailure );
        await expect( apiClient.fetchCalendar( '' ) ).rejects.not.toBeInstanceOf( ApiClientError );
        expect( onFailure ).not.toHaveBeenCalled();
        expect( global.fetch ).not.toHaveBeenCalled();
    } );

    it( 'still treats null as "no locale given"', async () => {
        await expect( apiClient.fetchCalendar( null ) ).resolves.toBeDefined();
        expect( global.fetch ).toHaveBeenCalled();
    } );

    it( 'normalizes an underscored locale into the Accept-Language header', () => {
        apiClient.fetchCalendar( 'it_IT' );
        expect( global.fetch.mock.calls[ 0 ][ 1 ].headers[ 'Accept-Language' ] ).toBe( 'it-IT' );
    } );

    it( 'accepts an Intl.Locale, producing the same header as the tag would', () => {
        apiClient.fetchCalendar( new Intl.Locale( 'it-IT' ) );
        expect( global.fetch.mock.calls[ 0 ][ 1 ].headers[ 'Accept-Language' ] ).toBe( 'it-IT' );
    } );

} );
