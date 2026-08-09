/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase, { resolveBase, assertSameBase } from '../ApiClient/ApiBase.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import PathBuilder from '../PathBuilder/PathBuilder.js';
import ApiClient from '../ApiClient/ApiClient.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import { Rite, CalendarSelectFilter } from '../Enums.js';
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

describe( 'ApiOptions binding', () => {

    it( 'accepts a locale string as before', () => {
        ApiBase.fromMetadata( DEV, FULL_METADATA );
        const apiOptions = new ApiOptions( 'it-IT' );
        expect( apiOptions._base ).toBe( ApiBase.resolve( DEV ) );
    } );

    it( 'binds to the client it is given', () => {
        ApiBase.fromMetadata( DEV, FULL_METADATA );
        const prod = clientFor( PROD, OTHER_METADATA );
        const apiOptions = new ApiOptions( { locale: 'en', apiClient: prod } );
        expect( apiOptions._base ).toBe( ApiBase.resolve( PROD ) );
    } );

    it( 'offers the locales of its own base', () => {
        const dev  = clientFor( DEV, FULL_METADATA );
        const prod = clientFor( PROD, OTHER_METADATA );
        const devOptions  = new ApiOptions( { locale: 'en', apiClient: dev } );
        const prodOptions = new ApiOptions( { locale: 'en', apiClient: prod } );
        expect( devOptions._localeInput.options() ).toEqual( expect.arrayContaining( [ 'it' ] ) );
        expect( prodOptions._localeInput.options() ).toEqual( [ 'nl' ] );
    } );

    /**
     * Asserts ONCE, not merely that something was warned: `LocaleInput` receiving
     * its base from `ApiOptions` rather than resolving one itself is the whole
     * reason the warn-once dedupe was written. A `LocaleInput` that called
     * `resolveBase` would emit a second, identical line for a part the caller
     * never named, and a `toHaveBeenCalledWith` assertion would still pass.
     */
    it( 'warns on the fallback when more than one base is registered, exactly once', () => {
        const warn = jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
        ApiBase.fromMetadata( DEV, FULL_METADATA );
        ApiBase.fromMetadata( PROD, OTHER_METADATA );
        new ApiOptions( 'en' );
        expect( warn ).toHaveBeenCalledWith( expect.stringContaining( 'ApiOptions' ) );
        expect( warn ).toHaveBeenCalledTimes( 1 );
        warn.mockRestore();
    } );

    it( 'throws when no base is registered at all', () => {
        expect( () => new ApiOptions( 'en' ) ).toThrow( /has not been initialized/ );
    } );

} );

describe( 'ApiOptions keeps the bare locale string form intact', () => {

    beforeEach( () => {
        ApiBase.fromMetadata( DEV, FULL_METADATA );
    } );

    /**
     * Asserted on the RENDERED option labels rather than on `_base`, because a
     * constructor that ignored its argument and hardcoded `'en'` would satisfy a
     * `_base` assertion. `Intl.DisplayNames` in Italian names the API's locales
     * "italiano"; in English it names them "Italian".
     */
    it( 'applies the locale it is given rather than defaulting to English', () => {
        const apiOptions = new ApiOptions( 'it-IT' );
        const labels = Array.from( apiOptions._localeInput._domElement.options ).map( option => option.textContent );
        expect( labels ).toContain( 'italiano' );
        expect( labels ).not.toContain( 'Italian' );
    } );

    /** `it_IT` is not a canonical tag: unnormalized, `Intl.getCanonicalLocales` rejects it outright. */
    it( 'normalizes an underscored locale to hyphens', () => {
        const apiOptions = new ApiOptions( 'it_IT' );
        const labels = Array.from( apiOptions._localeInput._domElement.options ).map( option => option.textContent );
        expect( labels ).toContain( 'italiano' );
    } );

    it( 'still throws on an invalid locale', () => {
        expect( () => new ApiOptions( 'not a locale' ) ).toThrow( /Invalid locale/ );
    } );

    /**
     * `it__IT` normalizes to `it--IT`, which is what `Intl` rejects — so a message
     * naming `it--IT` proves the throw reports the string actually validated
     * rather than the raw argument.
     */
    it( 'names the normalized locale in the message, not the raw argument', () => {
        expect( () => new ApiOptions( 'it__IT' ) ).toThrow( 'Invalid locale: it--IT' );
    } );

} );

describe( 'ApiOptions rejects an argument that is neither a locale string nor an options object', () => {

    const BAD_OPTIONS = /Invalid type for options, must be of type `object` but found type/;

    beforeEach( () => {
        ApiBase.fromMetadata( DEV, FULL_METADATA );
    } );

    /**
     * `null` used to be rejected here, alone among the five components. Issue #32
     * settled that in the other direction: `null` and `undefined` alike mean "no
     * options given", so the form is accepted and the defaults apply — including
     * the fallback base, which is what this suite is really about.
     */
    it( 'accepts null as "no options given", binding to the fallback base', () => {
        expect( new ApiOptions( null )._base ).toBe( ApiBase.resolve( DEV ) );
    } );

    it( 'rejects a number', () => {
        expect( () => new ApiOptions( 123 ) ).toThrow( BAD_OPTIONS );
    } );

    it( 'rejects an array', () => {
        expect( () => new ApiOptions( [ 'en' ] ) ).toThrow( /found type: array/ );
    } );

    /**
     * The other half of issue #32: an `Intl.Locale` is now a locale rather than a
     * mistyped options bag. It carries no `apiClient`, so the fallback base still
     * applies — and unlike the pre-#31 behaviour that motivated rejecting it, the
     * locale is now actually USED rather than silently discarded.
     */
    it( 'accepts a bare Intl.Locale as the locale, on the fallback base', () => {
        const apiOptions = new ApiOptions( new Intl.Locale( 'it-IT' ) );
        expect( apiOptions._base ).toBe( ApiBase.resolve( DEV ) );
        const labels = [ ...apiOptions._localeInput._domElement.options ].map( option => option.textContent );
        expect( labels ).toContain( 'italiano' );
    } );

    it( 'rejects any OTHER class instance', () => {
        class Whatever {}
        expect( () => new ApiOptions( new Whatever() ) ).toThrow( BAD_OPTIONS );
    } );

    it( 'rejects a non-string, non-Intl.Locale locale inside a valid options object', () => {
        expect( () => new ApiOptions( { locale: 123 } ) ).toThrow( /Invalid type for locale, must be of type `string` or `Intl.Locale`/ );
        expect( () => new ApiOptions( { locale: [ 'it' ] } ) ).toThrow( /Invalid type for locale/ );
    } );

    it( 'still accepts an options object carrying only an apiClient', () => {
        const prod = clientFor( PROD, OTHER_METADATA );
        expect( new ApiOptions( { apiClient: prod } )._base ).toBe( ApiBase.resolve( PROD ) );
    } );

    it( 'still accepts no argument at all', () => {
        expect( () => new ApiOptions() ).not.toThrow();
    } );

} );

describe( 'PathBuilder binding', () => {

    it( 'renders the url of the base its arguments share', () => {
        ApiBase.fromMetadata( DEV, FULL_METADATA );
        const prodClient = clientFor( PROD, OTHER_METADATA );
        const apiOptions     = new ApiOptions( { locale: 'en', apiClient: prodClient } );
        const calendarSelect = new CalendarSelect( { locale: 'en', apiClient: prodClient } );
        const pathBuilder    = new PathBuilder( apiOptions, calendarSelect );
        expect( pathBuilder._domElement.textContent ).toContain( PROD );
        expect( pathBuilder._domElement.textContent ).not.toContain( DEV );
    } );

    it( 'throws when its arguments are bound to different bases, naming both', () => {
        const devClient  = clientFor( DEV, FULL_METADATA );
        const prodClient = clientFor( PROD, OTHER_METADATA );
        const apiOptions     = new ApiOptions( { locale: 'en', apiClient: devClient } );
        const calendarSelect = new CalendarSelect( { locale: 'en', apiClient: prodClient } );
        expect( () => new PathBuilder( apiOptions, calendarSelect ) ).toThrow( /different API bases/ );
        expect( () => new PathBuilder( apiOptions, calendarSelect ) ).toThrow( new RegExp( DEV.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ) ) );
        expect( () => new PathBuilder( apiOptions, calendarSelect ) ).toThrow( /example\.org/ );
    } );

} );

describe( 'CalendarSelect.linkToNationsSelect binding', () => {

    it( 'throws when the dioceses select and the nations select are bound to different bases, naming both', () => {
        const devClient  = clientFor( DEV, FULL_METADATA );
        const prodClient = clientFor( PROD, OTHER_METADATA );
        const nationSelect = new CalendarSelect( { locale: 'en', apiClient: devClient } )
            .filter( CalendarSelectFilter.NATIONAL_CALENDARS );
        const dioceseSelect = new CalendarSelect( { locale: 'en', apiClient: prodClient } )
            .filter( CalendarSelectFilter.DIOCESAN_CALENDARS );
        expect( () => dioceseSelect.linkToNationsSelect( nationSelect ) ).toThrow( /different API bases/ );
        expect( () => dioceseSelect.linkToNationsSelect( nationSelect ) ).toThrow( new RegExp( DEV.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ) ) );
        expect( () => dioceseSelect.linkToNationsSelect( nationSelect ) ).toThrow( /example\.org/ );
    } );

    it( 'does not link when it throws, leaving both selects unlinked', () => {
        const devClient  = clientFor( DEV, FULL_METADATA );
        const prodClient = clientFor( PROD, OTHER_METADATA );
        const nationSelect = new CalendarSelect( { locale: 'en', apiClient: devClient } )
            .filter( CalendarSelectFilter.NATIONAL_CALENDARS );
        const dioceseSelect = new CalendarSelect( { locale: 'en', apiClient: prodClient } )
            .filter( CalendarSelectFilter.DIOCESAN_CALENDARS );
        expect( () => dioceseSelect.linkToNationsSelect( nationSelect ) ).toThrow();
        expect( dioceseSelect._hasDependentDioceseSelects ).toBe( false );
        expect( nationSelect._hasDependentDioceseSelects ).toBe( false );
    } );

} );

describe( 'ApiOptions.linkToCalendarSelect binding', () => {

    it( 'throws when the single linked CalendarSelect is bound to another base, naming both', () => {
        const devClient  = clientFor( DEV, FULL_METADATA );
        const prodClient = clientFor( PROD, OTHER_METADATA );
        const apiOptions     = new ApiOptions( { locale: 'en', apiClient: devClient } );
        const calendarSelect = new CalendarSelect( { locale: 'en', apiClient: prodClient } );
        expect( () => apiOptions.linkToCalendarSelect( calendarSelect ) ).toThrow( /different API bases/ );
        expect( () => apiOptions.linkToCalendarSelect( calendarSelect ) ).toThrow( new RegExp( DEV.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ) ) );
        expect( () => apiOptions.linkToCalendarSelect( calendarSelect ) ).toThrow( /example\.org/ );
    } );

    it( 'throws when either half of a linked nation/diocese pair is bound to another base', () => {
        const devClient  = clientFor( DEV, FULL_METADATA );
        const prodClient = clientFor( PROD, OTHER_METADATA );

        const strayNation = new CalendarSelect( { locale: 'en', apiClient: prodClient } )
            .filter( CalendarSelectFilter.NATIONAL_CALENDARS );
        const ownDiocese  = new CalendarSelect( { locale: 'en', apiClient: devClient } )
            .filter( CalendarSelectFilter.DIOCESAN_CALENDARS );
        expect( () => new ApiOptions( { locale: 'en', apiClient: devClient } )
            .linkToCalendarSelect( [ strayNation, ownDiocese ] ) ).toThrow( /different API bases/ );

        const ownNation     = new CalendarSelect( { locale: 'en', apiClient: devClient } )
            .filter( CalendarSelectFilter.NATIONAL_CALENDARS );
        const strayDiocese  = new CalendarSelect( { locale: 'en', apiClient: prodClient } )
            .filter( CalendarSelectFilter.DIOCESAN_CALENDARS );
        expect( () => new ApiOptions( { locale: 'en', apiClient: devClient } )
            .linkToCalendarSelect( [ ownNation, strayDiocese ] ) ).toThrow( /different API bases/ );
    } );

    it( 'does not throw when every linked select shares the ApiOptions base', () => {
        const devClient = clientFor( DEV, FULL_METADATA );
        const nation  = new CalendarSelect( { locale: 'en', apiClient: devClient } )
            .filter( CalendarSelectFilter.NATIONAL_CALENDARS );
        const diocese = new CalendarSelect( { locale: 'en', apiClient: devClient } )
            .filter( CalendarSelectFilter.DIOCESAN_CALENDARS );
        expect( () => new ApiOptions( { locale: 'en', apiClient: devClient } )
            .linkToCalendarSelect( [ nation, diocese ] ) ).not.toThrow();
        expect( () => new ApiOptions( { locale: 'en', apiClient: devClient } )
            .linkToCalendarSelect( new CalendarSelect( { locale: 'en', apiClient: devClient } ) ) ).not.toThrow();
    } );

    /**
     * The guard belongs with the other validation, and validation runs before any
     * side effect: a rejected link must leave the instance linkable, and must not
     * have flipped `explicitRite` or attached a rite listener on the way out.
     */
    it( 'leaves the ApiOptions unlinked when it throws', () => {
        const devClient  = clientFor( DEV, FULL_METADATA );
        const prodClient = clientFor( PROD, OTHER_METADATA );
        const apiOptions = new ApiOptions( { locale: 'en', apiClient: devClient } );
        const stray      = new CalendarSelect( { locale: 'en', apiClient: prodClient } );
        expect( () => apiOptions.linkToCalendarSelect( stray, new RiteSelect( 'en' ) ) ).toThrow( /different API bases/ );
        expect( apiOptions._currentEndpoint.explicitRite ).toBe( false );
        expect( () => apiOptions.linkToCalendarSelect(
            new CalendarSelect( { locale: 'en', apiClient: devClient } )
        ) ).not.toThrow();
    } );

} );

describe( 'ApiClient.listenTo binding', () => {

    it( 'throws when the CalendarSelect is bound to another base, naming both', () => {
        const dev    = ApiBase.fromMetadata( DEV, FULL_METADATA );
        const prod   = ApiBase.fromMetadata( PROD, OTHER_METADATA );
        const client = new ApiClient( dev );
        const select = new CalendarSelect( { locale: 'en', apiClient: { base: prod } } );
        expect( () => client.listenTo( select ) ).toThrow( /different API bases/ );
        expect( () => client.listenTo( select ) ).toThrow( new RegExp( DEV.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ) ) );
        expect( () => client.listenTo( select ) ).toThrow( /example\.org/ );
    } );

    it( 'throws when the ApiOptions is bound to another base', () => {
        const dev    = ApiBase.fromMetadata( DEV, FULL_METADATA );
        const prod   = ApiBase.fromMetadata( PROD, OTHER_METADATA );
        const client = new ApiClient( dev );
        const apiOptions = new ApiOptions( { locale: 'en', apiClient: { base: prod } } );
        expect( () => client.listenTo( apiOptions ) ).toThrow( /different API bases/ );
    } );

    it( 'does not throw for components bound to the client own base', () => {
        const dev    = ApiBase.fromMetadata( DEV, FULL_METADATA );
        const client = new ApiClient( dev );
        expect( () => client.listenTo( new CalendarSelect( { locale: 'en', apiClient: { base: dev } } ) ) ).not.toThrow();
        expect( () => client.listenTo( new ApiOptions( { locale: 'en', apiClient: { base: dev } } ) ) ).not.toThrow();
    } );

    /**
     * A `RiteSelect` builds its options from the `Rite` enum and reads no metadata,
     * so it holds no base at all. The guard must skip it rather than compare against
     * an invented one.
     */
    it( 'accepts a RiteSelect, which holds no base', () => {
        const dev = ApiBase.fromMetadata( DEV, FULL_METADATA );
        ApiBase.fromMetadata( PROD, OTHER_METADATA );
        const client = new ApiClient( dev );
        expect( () => client.listenTo( new RiteSelect( 'en' ) ) ).not.toThrow();
    } );

} );

describe( 'ApiBase.assertSameBase', () => {

    it( 'does not throw when both bases are the same', () => {
        const base = ApiBase.fromMetadata( DEV, FULL_METADATA );
        expect( () => assertSameBase( base, base, 'Test: a and b', 'Nothing would break.' ) ).not.toThrow();
    } );

    it( 'throws naming both URLs when the bases differ', () => {
        const dev  = ApiBase.fromMetadata( DEV, FULL_METADATA );
        const prod = ApiBase.fromMetadata( PROD, OTHER_METADATA );
        expect( () => assertSameBase( dev, prod, 'Test: a and b', 'Something would break.' ) )
            .toThrow( /different API bases/ );
        expect( () => assertSameBase( dev, prod, 'Test: a and b', 'Something would break.' ) )
            .toThrow( new RegExp( DEV.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ) ) );
        expect( () => assertSameBase( dev, prod, 'Test: a and b', 'Something would break.' ) )
            .toThrow( /example\.org/ );
    } );

    it( 'includes the given pairing and consequence text in the message', () => {
        const dev  = ApiBase.fromMetadata( DEV, FULL_METADATA );
        const prod = ApiBase.fromMetadata( PROD, OTHER_METADATA );
        expect( () => assertSameBase( dev, prod, 'Test: a and b', 'Something would break.' ) )
            .toThrow( /^Test: a and b are bound to different API bases/ );
        expect( () => assertSameBase( dev, prod, 'Test: a and b', 'Something would break.' ) )
            .toThrow( /Something would break\.$/ );
    } );

    /**
     * Every caller reads the other side's base off a component property, so a
     * caller passing the wrong type hands in `undefined`. Dereferencing `.url` on
     * it produced a bare `TypeError: Cannot read properties of undefined (reading
     * 'url')` from inside this helper, naming neither the pairing nor the side at
     * fault.
     */
    it( 'reports a missing first base rather than throwing a TypeError on .url', () => {
        const base = ApiBase.fromMetadata( DEV, FULL_METADATA );
        expect( () => assertSameBase( undefined, base, 'Test: a and b', 'Something would break.' ) )
            .toThrow( /the first carries no API base/ );
        expect( () => assertSameBase( undefined, base, 'Test: a and b', 'Something would break.' ) )
            .not.toThrow( TypeError );
    } );

    it( 'reports a missing second base', () => {
        const base = ApiBase.fromMetadata( DEV, FULL_METADATA );
        expect( () => assertSameBase( base, undefined, 'Test: a and b', 'Something would break.' ) )
            .toThrow( /the second carries no API base/ );
    } );

    it( 'reports both sides when neither carries a base', () => {
        expect( () => assertSameBase( undefined, null, 'Test: a and b', 'Something would break.' ) )
            .toThrow( /the first carries no API base \(found undefined\), and the second carries no API base \(found null\)/ );
    } );

    it( 'rejects an object that merely looks like a base', () => {
        const base = ApiBase.fromMetadata( DEV, FULL_METADATA );
        expect( () => assertSameBase( base, { url: DEV }, 'Test: a and b', 'Something would break.' ) )
            .toThrow( /the second carries no API base/ );
    } );

    it( 'names the pairing in the missing-base message', () => {
        const base = ApiBase.fromMetadata( DEV, FULL_METADATA );
        expect( () => assertSameBase( base, undefined, 'Test: a and b', 'Something would break.' ) )
            .toThrow( /^Test: a and b cannot be checked for a shared API base/ );
    } );

} );
