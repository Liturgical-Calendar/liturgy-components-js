/** @jest-environment jsdom */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import { CalendarSelectFilter, Rite, RiteProperties } from '../Enums.js';

/**
 * Local rather than the shared `FULL_METADATA`: these assertions need two
 * Ambrosian dioceses and exactly one Roman one (`romamo_it`), so that
 * `not.toContain( 'romamo_it' )` after a rite change is not satisfied by some
 * other Roman diocese still being present.
 */
const METADATA = {
    locales: [ 'en', 'it', 'la' ],
    national_calendars: [
        { calendar_id: 'IT', locales: [ 'it-IT' ], settings: {} },
        { calendar_id: 'VA', locales: [ 'la', 'it-IT' ], settings: {} }
    ],
    diocesan_calendars: [
        { calendar_id: 'romamo_it', nation: 'IT', diocese: 'Diocesi di Roma',   locales: [ 'it-IT' ], rite: 'roman' },
        { calendar_id: 'milano_it', nation: 'IT', diocese: 'Diocesi di Milano', locales: [ 'it-IT' ], rite: 'ambrosian' },
        { calendar_id: 'lugano_ch', nation: 'CH', diocese: 'Diocesi di Lugano', locales: [ 'it-IT' ], rite: 'ambrosian' }
    ],
    ambrosian_calendars: [ { calendar_id: 'ambrosian', rite: 'ambrosian', locales: [ 'it', 'la' ] } ]
};

const API_URL = 'http://localhost:8000';

// A fresh registry per test, holding one base built straight from the fixture.
// No `global.fetch` mock at all: nothing here issues a request.
beforeEach( () => {
    ApiBase.reset();
    ApiBase.fromMetadata( API_URL, METADATA );
    document.body.innerHTML =
        '<div id="rite"></div><div id="nation"></div><div id="diocese"></div><div id="single"></div>';
} );

describe( 'CalendarSelect dependent diocese registration', () => {

    it( 'reports no dependents on a standalone nation select', () => {
        const nationSelect = new CalendarSelect( 'en' )
            .filter( CalendarSelectFilter.NATIONAL_CALENDARS );
        nationSelect.appendTo( '#nation' );

        expect( nationSelect._hasDependentDioceseSelects ).toBe( false );
    } );

    it( 'reports a dependent once a diocese select links to it', () => {
        const nationSelect = new CalendarSelect( 'en' )
            .filter( CalendarSelectFilter.NATIONAL_CALENDARS );
        nationSelect.appendTo( '#nation' );

        const dioceseSelect = new CalendarSelect( 'en' )
            .filter( CalendarSelectFilter.DIOCESAN_CALENDARS )
            .linkToNationsSelect( nationSelect );
        dioceseSelect.appendTo( '#diocese' );

        expect( nationSelect._hasDependentDioceseSelects ).toBe( true );
        expect( dioceseSelect._hasDependentDioceseSelects ).toBe( false );
    } );
} );

const buildRiteSelect = () => {
    const riteSelect = new RiteSelect( 'en' );
    riteSelect.appendTo( '#rite' );
    return riteSelect;
};

const chooseRite = ( riteSelect, rite ) => {
    riteSelect._domElement.value = rite;
    riteSelect._domElement.dispatchEvent( new Event( 'change' ) );
};

describe( 'CalendarSelect.linkToRiteSelect', () => {

    it( 'is chainable and rejects a non-RiteSelect', () => {
        const riteSelect = buildRiteSelect();
        const calendarSelect = new CalendarSelect( 'en' );
        calendarSelect.appendTo( '#single' );

        expect( calendarSelect.linkToRiteSelect( riteSelect ) ).toBe( calendarSelect );

        const other = new CalendarSelect( 'en' );
        other.appendTo( '#diocese' );
        expect( () => other.linkToRiteSelect( {} ) ).toThrow( /must be of type `RiteSelect`/ );
    } );

    it( 'throws when linked to a rite select twice', () => {
        const riteSelect = buildRiteSelect();
        const calendarSelect = new CalendarSelect( 'en' );
        calendarSelect.appendTo( '#single' );
        calendarSelect.linkToRiteSelect( riteSelect );

        expect( () => calendarSelect.linkToRiteSelect( riteSelect ) ).toThrow( /already linked to a RiteSelect/ );
    } );

    it( 'rebuilds a dioceses filtered select on a rite change and clears the selection', () => {
        const riteSelect = buildRiteSelect();
        const dioceseSelect = new CalendarSelect( 'en' )
            .filter( CalendarSelectFilter.DIOCESAN_CALENDARS )
            .linkToRiteSelect( riteSelect );
        dioceseSelect.appendTo( '#diocese' );

        chooseRite( riteSelect, Rite.AMBROSIAN );

        const values = [ ...dioceseSelect._domElement.options ].map( o => o.value );
        expect( values ).toContain( 'milano_it' );
        expect( values ).not.toContain( 'romamo_it' );
        expect( dioceseSelect._domElement.value ).toBe( '' );
    } );

    it( 'rebuilds a none filtered select, clears its value, and dispatches change exactly once', () => {
        // The `none` filter is what the public frontend forms use, and until now its
        // standalone behaviour was only ever exercised through `ApiOptions`. Covered
        // here directly, so a regression in the standalone path cannot hide behind
        // `ApiOptions` still passing.
        const riteSelect = buildRiteSelect();
        const calendarSelect = new CalendarSelect( 'en' )
            .allowNull( true )
            .linkToRiteSelect( riteSelect );
        calendarSelect.appendTo( '#single' );

        // Select a real option so the reset below is observable rather than vacuous.
        const preset = [ ...calendarSelect._domElement.options ]
            .map( option => option.value )
            .find( value => value !== '' );
        calendarSelect._domElement.value = preset;
        expect( calendarSelect._domElement.value ).not.toBe( '' );

        let changes = 0;
        calendarSelect._domElement.addEventListener( 'change', () => { changes++; } );

        chooseRite( riteSelect, Rite.AMBROSIAN );

        const values = [ ...calendarSelect._domElement.options ].map( option => option.value );
        expect( values ).toContain( 'milano_it' );
        expect( values ).not.toContain( 'romamo_it' );
        expect( calendarSelect._domElement.value ).toBe( '' );
        expect( changes ).toBe( 1 );
    } );

    it( 'hides a nations filtered select for a rite with no national tier, and shows it again', () => {
        const riteSelect = buildRiteSelect();
        const nationSelect = new CalendarSelect( 'en' )
            .filter( CalendarSelectFilter.NATIONAL_CALENDARS )
            .linkToRiteSelect( riteSelect );
        nationSelect.appendTo( '#nation' );
        const target = () => nationSelect._wrapperElement ?? nationSelect._domElement;

        expect( RiteProperties[ Rite.AMBROSIAN ].hasNationalTier ).toBe( false );

        chooseRite( riteSelect, Rite.AMBROSIAN );
        expect( target().hidden ).toBe( true );

        chooseRite( riteSelect, Rite.ROMAN );
        expect( target().hidden ).toBe( false );
    } );

    it( 'dispatches change on a standalone nation select, but not on one with a dependent', () => {
        const riteSelect = buildRiteSelect();

        const lone = new CalendarSelect( 'en' )
            .filter( CalendarSelectFilter.NATIONAL_CALENDARS )
            .linkToRiteSelect( riteSelect );
        lone.appendTo( '#nation' );

        const paired = new CalendarSelect( 'en' )
            .filter( CalendarSelectFilter.NATIONAL_CALENDARS );
        paired.appendTo( '#single' );
        const dependent = new CalendarSelect( 'en' )
            .filter( CalendarSelectFilter.DIOCESAN_CALENDARS )
            .linkToNationsSelect( paired );
        dependent.appendTo( '#diocese' );
        paired.linkToRiteSelect( riteSelect );

        let loneChanges = 0;
        let pairedChanges = 0;
        lone._domElement.addEventListener( 'change', () => { loneChanges++; } );
        paired._domElement.addEventListener( 'change', () => { pairedChanges++; } );

        chooseRite( riteSelect, Rite.AMBROSIAN );

        expect( loneChanges ).toBeGreaterThan( 0 );
        expect( pairedChanges ).toBe( 0 );
    } );
} );

describe( 'linkToRiteSelect and ApiOptions together', () => {

    it( 'throws when a select linked by ApiOptions is also linked directly', async () => {
        const { default: ApiOptions } = await import( '../ApiOptions/ApiOptions.js' );

        const riteSelect = buildRiteSelect();
        const calendarSelect = new CalendarSelect( 'en' ).allowNull( true );
        calendarSelect.appendTo( '#single' );

        const apiOptions = new ApiOptions( 'en' );
        apiOptions.linkToCalendarSelect( calendarSelect, riteSelect );

        // ApiOptions has already linked it; a second, direct link would put two rite
        // listeners on one select and apply the rite twice per change.
        expect( () => calendarSelect.linkToRiteSelect( riteSelect ) ).toThrow( /already linked to a RiteSelect/ );
    } );

    it( 'dispatches change exactly once per calendar select per rite change under ApiOptions', async () => {
        // Regression pin: `linkToRiteSelect()` used to always dispatch its own
        // `change`, and `ApiOptions` added a second dispatch once its endpoint state
        // caught up, so a select with no dependent diocese selects received two
        // `change` events per rite change instead of one — each one independently
        // triggering a refetch in anything (e.g. `ApiClient`) that treats `change`
        // as "refetch". `ApiOptions` now passes `dispatchChange: false` to
        // `linkToRiteSelect()` so it alone owns the single dispatch, fired once
        // `#currentEndpoint` is current.
        const { default: ApiOptions } = await import( '../ApiOptions/ApiOptions.js' );

        const riteSelect = buildRiteSelect();
        const calendarSelect = new CalendarSelect( 'en' ).allowNull( true );
        calendarSelect.appendTo( '#single' );

        const apiOptions = new ApiOptions( 'en' );
        apiOptions.linkToCalendarSelect( calendarSelect, riteSelect );

        let changes = 0;
        calendarSelect._domElement.addEventListener( 'change', () => { changes++; } );

        chooseRite( riteSelect, Rite.AMBROSIAN );

        expect( changes ).toBe( 1 );
    } );

    it( 'dispatches change exactly once on a linked diocese select, and not at all on its nation select', async () => {
        const { default: ApiOptions } = await import( '../ApiOptions/ApiOptions.js' );

        const riteSelect = buildRiteSelect();
        const nationSelect = new CalendarSelect( 'en' )
            .filter( CalendarSelectFilter.NATIONAL_CALENDARS )
            .allowNull( true );
        nationSelect.appendTo( '#nation' );
        const dioceseSelect = new CalendarSelect( 'en' )
            .filter( CalendarSelectFilter.DIOCESAN_CALENDARS )
            .linkToNationsSelect( nationSelect )
            .allowNull( true );
        dioceseSelect.appendTo( '#diocese' );

        const apiOptions = new ApiOptions( 'en' );
        apiOptions.linkToCalendarSelect( [ nationSelect, dioceseSelect ], riteSelect );

        let nationChanges = 0;
        let dioceseChanges = 0;
        nationSelect._domElement.addEventListener( 'change', () => { nationChanges++; } );
        dioceseSelect._domElement.addEventListener( 'change', () => { dioceseChanges++; } );

        chooseRite( riteSelect, Rite.AMBROSIAN );

        expect( dioceseChanges ).toBe( 1 );
        expect( nationChanges ).toBe( 0 );
    } );

    it( 'normalizes a [diocese, nation] pair to nation-first, matching the [nation, diocese] order', async () => {
        // Regression pin: `linkToCalendarSelect` accepts a nation/diocese pair in
        // either array order (see its own validation), but `#handleLinkedRiteSelect`
        // used to link them in the caller's order. `CalendarSelect#applyLinkedRite`
        // clears, applies, and clears each select in turn, and a diocese select's
        // apply step re-derives its per-nation narrowing from the nation select's
        // CURRENT value. With a nation select preset to 'IT', linking `[diocese,
        // nation]` used to process the diocese select first, while the nation select
        // still held 'IT', narrowing the diocese options to `["", "romamo_it"]` —
        // out of sync with the nation select, which ends up cleared to ''. Linking
        // `[nation, diocese]` processed the nation select first, so by the time the
        // diocese select rebuilt, the nation value was already '', giving `[""]`.
        // Both orders must now produce the same, nation-first result.
        const { default: ApiOptions } = await import( '../ApiOptions/ApiOptions.js' );

        // Build the [nation, diocese] order first, to know what "correct" looks like.
        const riteSelectA = buildRiteSelect();
        const nationA = new CalendarSelect( 'en' )
            .filter( CalendarSelectFilter.NATIONAL_CALENDARS )
            .allowNull( true );
        nationA.appendTo( '#nation' );
        const dioceseA = new CalendarSelect( 'en' )
            .filter( CalendarSelectFilter.DIOCESAN_CALENDARS )
            .linkToNationsSelect( nationA )
            .allowNull( true );
        dioceseA.appendTo( '#diocese' );
        nationA.value( 'IT' );

        const apiOptionsA = new ApiOptions( 'en' );
        apiOptionsA.linkToCalendarSelect( [ nationA, dioceseA ], riteSelectA );

        const expectedDioceseValues = [ ...dioceseA._domElement.options ].map( o => o.value );
        const expectedNationValue = nationA._domElement.value;

        // Reset the DOM and build the [diocese, nation] order with the same preset.
        document.body.innerHTML =
            '<div id="rite"></div><div id="nation"></div><div id="diocese"></div><div id="single"></div>';

        const riteSelectB = buildRiteSelect();
        const nationB = new CalendarSelect( 'en' )
            .filter( CalendarSelectFilter.NATIONAL_CALENDARS )
            .allowNull( true );
        nationB.appendTo( '#nation' );
        const dioceseB = new CalendarSelect( 'en' )
            .filter( CalendarSelectFilter.DIOCESAN_CALENDARS )
            .linkToNationsSelect( nationB )
            .allowNull( true );
        dioceseB.appendTo( '#diocese' );
        nationB.value( 'IT' );

        const apiOptionsB = new ApiOptions( 'en' );
        apiOptionsB.linkToCalendarSelect( [ dioceseB, nationB ], riteSelectB );

        const actualDioceseValues = [ ...dioceseB._domElement.options ].map( o => o.value );

        expect( nationB._domElement.value ).toBe( expectedNationValue );
        expect( actualDioceseValues ).toEqual( expectedDioceseValues );
    } );
} );
