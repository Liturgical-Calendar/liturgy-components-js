/** @jest-environment jsdom */
import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import ApiClient from '../ApiClient/ApiClient.js';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import { CalendarSelectFilter, Rite } from '../Enums.js';
import { CurrentEndpoint } from '../PathBuilder/PathBuilder.js';

/**
 * Same fixture shape as CalendarSelect.test.js: a Roman diocese (roma_it),
 * and two Ambrosian dioceses, one (milano_it) whose nation also has a Roman
 * national calendar and one (lugano_ch) whose nation does not.
 */
const METADATA = {
    // Read directly by LocaleInput (constructed by every `new ApiOptions()`),
    // independently of which calendar ends up selected.
    locales: [ 'en', 'it', 'la' ],
    national_calendars: [
        { calendar_id: 'IT', locales: [ 'it-IT' ], settings: {} },
        // VA has no dioceses, so #addNationOption marks it `selected` by
        // default (CalendarSelect's built-in "General Roman falls back to
        // the Vatican" heuristic) — `settings` must be present so
        // ApiOptions#handleSingleLinkedCalendarSelect can read it at link
        // time without a RiteSelect in the loop.
        { calendar_id: 'VA', locales: [ 'la', 'it-IT' ], settings: {} }
    ],
    diocesan_calendars: [
        { calendar_id: 'roma_it',   nation: 'IT', diocese: 'Diocesi di Roma',    rite: 'roman' },
        { calendar_id: 'milano_it', nation: 'IT', diocese: 'Diocesi di Milano',  rite: 'ambrosian' },
        { calendar_id: 'lugano_ch', nation: 'CH', diocese: 'Diocesi di Lugano',  rite: 'ambrosian' }
    ],
    ambrosian_calendars: [ { calendar_id: 'ambrosian' } ]
};

beforeAll( async () => {
    global.fetch = jest.fn().mockResolvedValue( {
        ok: true,
        json: () => Promise.resolve( { litcal_metadata: METADATA } )
    } );
    await ApiClient.init();
} );

/**
 * Resets the module-level `CurrentEndpoint` singleton to its defaults before
 * every test, so state set by one test (rite, explicitRite, calendarType,
 * calendarId) can never leak into the next.
 */
function resetCurrentEndpoint() {
    CurrentEndpoint.rite         = Rite.ROMAN;
    CurrentEndpoint.explicitRite = false;
    CurrentEndpoint.calendarType = null;
    CurrentEndpoint.calendarId   = null;
}

describe( 'ApiOptions rite orchestration', () => {

    let apiOptions, nationSelect, dioceseSelect, riteSelect;

    beforeEach( () => {
        resetCurrentEndpoint();

        // Deliberately NOT linked via `linkToNationsSelect()`: that mechanism
        // filters the diocese options down to whichever nation is currently
        // selected (here, the auto-selected VA, which has no dioceses at
        // all), which is an orthogonal concern to the rite chain under test.
        // Leaving them unlinked keeps `dioceseSelect` showing the full,
        // rite-filtered, nation-grouped diocese list.
        nationSelect = new CalendarSelect( 'en' ).filter( CalendarSelectFilter.NATIONAL_CALENDARS ).allowNull();
        dioceseSelect = new CalendarSelect( 'en' ).filter( CalendarSelectFilter.DIOCESAN_CALENDARS ).allowNull();

        riteSelect = new RiteSelect( 'en' );
        apiOptions = new ApiOptions( 'en' );
        apiOptions.linkToCalendarSelect( [ nationSelect, dioceseSelect ], riteSelect );
    } );

    it( 'hides the nation select for a rite with no national tier', () => {
        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent( new Event( 'change' ) );
        // _setHidden targets the wrapper when one was set via wrapper(), and the
        // select itself otherwise. This setup does not call wrapper(), so assert
        // on the select. The wrapper case is covered separately below, driven
        // through the same real ApiOptions + RiteSelect integration path.
        expect( nationSelect._domElement.hidden ).toBe( true );
    } );

    it( 'shows the nation select again when returning to Roman', () => {
        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent( new Event( 'change' ) );
        // Intermediate assertion: without this, switching Ambrosian -> Roman
        // and asserting only the final `false` would also pass if the
        // Ambrosian hide never fired at all.
        expect( nationSelect._domElement.hidden ).toBe( true );

        riteSelect._domElement.value = Rite.ROMAN;
        riteSelect._domElement.dispatchEvent( new Event( 'change' ) );
        expect( nationSelect._domElement.hidden ).toBe( false );
    } );

    it( 'disables the four fixed temporal inputs under Ambrosian', () => {
        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent( new Event( 'change' ) );
        expect( apiOptions._epiphanyInput._domElement.disabled ).toBe( true );
        expect( apiOptions._ascensionInput._domElement.disabled ).toBe( true );
        expect( apiOptions._corpusChristiInput._domElement.disabled ).toBe( true );
        expect( apiOptions._eternalHighPriestInput._domElement.disabled ).toBe( true );
    } );

    it( 're-enables them under Roman with no nation or diocese selected', () => {
        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent( new Event( 'change' ) );
        // Intermediate assertion, for the same reason as the nation-select
        // round trip above: pins the Ambrosian disabled=true state so this
        // test can actually fail if the Roman re-enable never happens.
        expect( apiOptions._epiphanyInput._domElement.disabled ).toBe( true );

        riteSelect._domElement.value = Rite.ROMAN;
        riteSelect._domElement.dispatchEvent( new Event( 'change' ) );
        expect( apiOptions._epiphanyInput._domElement.disabled ).toBe( false );
        expect( apiOptions._ascensionInput._domElement.disabled ).toBe( false );
        expect( apiOptions._corpusChristiInput._domElement.disabled ).toBe( false );
        expect( apiOptions._eternalHighPriestInput._domElement.disabled ).toBe( false );
    } );

    it( 'raises the year floor to 1976 under Ambrosian and restores 1970 under Roman', () => {
        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent( new Event( 'change' ) );
        expect( apiOptions._yearInput._domElement.min ).toBe( '1976' );

        riteSelect._domElement.value = Rite.ROMAN;
        riteSelect._domElement.dispatchEvent( new Event( 'change' ) );
        expect( apiOptions._yearInput._domElement.min ).toBe( '1970' );
    } );

    it( 'hides the wrapper rather than the select itself, on the real ApiOptions + RiteSelect integration path', () => {
        // Driven entirely through `linkToCalendarSelect` + a rite change —
        // not a direct `_setHidden` call — so this actually exercises
        // `#handleLinkedRiteSelect`'s wrapper-aware hiding, not just
        // `CalendarSelect._setHidden` in isolation.
        const wrappedNationSelect = new CalendarSelect( 'en' )
            .filter( CalendarSelectFilter.NATIONAL_CALENDARS )
            .wrapper( { class: 'form-group' } )
            .allowNull();
        const localDioceseSelect = new CalendarSelect( 'en' ).filter( CalendarSelectFilter.DIOCESAN_CALENDARS ).allowNull();
        const localRiteSelect = new RiteSelect( 'en' );
        const localApiOptions = new ApiOptions( 'en' );
        localApiOptions.linkToCalendarSelect( [ wrappedNationSelect, localDioceseSelect ], localRiteSelect );

        localRiteSelect._domElement.value = Rite.AMBROSIAN;
        localRiteSelect._domElement.dispatchEvent( new Event( 'change' ) );

        expect( wrappedNationSelect._domElement.hidden ).toBe( false );
        expect( wrappedNationSelect._wrapperElement.hidden ).toBe( true );
    } );

    it( 'labels the empty option per rite in rite-aware mode', () => {
        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent( new Event( 'change' ) );
        expect( dioceseSelect._domElement.innerHTML ).toContain( '>Ambrosian Calendar<' );

        riteSelect._domElement.value = Rite.ROMAN;
        riteSelect._domElement.dispatchEvent( new Event( 'change' ) );
        expect( dioceseSelect._domElement.innerHTML ).toContain( '>General Roman Calendar<' );
    } );

    it( 'resets the calendar selection to the rite-level calendar on rite change', () => {
        dioceseSelect._domElement.value = 'roma_it';
        expect( dioceseSelect._domElement.value ).toBe( 'roma_it' );

        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent( new Event( 'change' ) );
        expect( dioceseSelect._domElement.value ).toBe( '' );
    } );

    it( 'sets explicitRite when a RiteSelect is linked', () => {
        expect( CurrentEndpoint.explicitRite ).toBe( true );
    } );
} );

describe( 'ApiOptions without a linked RiteSelect (back-compat)', () => {

    beforeEach( () => {
        resetCurrentEndpoint();
    } );

    it( 'leaves the empty option as --- when no RiteSelect is linked', () => {
        const plainSelect = new CalendarSelect( 'en' ).allowNull();
        const plainApiOptions = new ApiOptions( 'en' );
        plainApiOptions.linkToCalendarSelect( plainSelect );
        expect( plainSelect._domElement.innerHTML ).toContain( '<option value="">---</option>' );
    } );

    it( 'leaves explicitRite false when no RiteSelect is linked', () => {
        const plainSelect = new CalendarSelect( 'en' ).allowNull();
        const plainApiOptions = new ApiOptions( 'en' );
        plainApiOptions.linkToCalendarSelect( plainSelect );
        expect( CurrentEndpoint.explicitRite ).toBe( false );
    } );

    it( 'hides no nation select and disables no input by rite when no RiteSelect is linked', () => {
        // Structurally guaranteed today by the `if (null !== riteSelect)` gate
        // in `linkToCalendarSelect` — this test exists so a future refactor
        // that moves rite side effects out from behind that gate breaks a
        // test, not just an invariant nobody is checking.
        const plainNationSelect = new CalendarSelect( 'en' ).filter( CalendarSelectFilter.NATIONAL_CALENDARS ).allowNull();
        const plainDioceseSelect = new CalendarSelect( 'en' ).filter( CalendarSelectFilter.DIOCESAN_CALENDARS ).allowNull();
        const plainApiOptions = new ApiOptions( 'en' );
        plainApiOptions.linkToCalendarSelect( [ plainNationSelect, plainDioceseSelect ] );

        expect( plainNationSelect._domElement.hidden ).toBe( false );
        expect( plainApiOptions._epiphanyInput._domElement.disabled ).toBe( false );
        expect( plainApiOptions._ascensionInput._domElement.disabled ).toBe( false );
        expect( plainApiOptions._corpusChristiInput._domElement.disabled ).toBe( false );
        expect( plainApiOptions._eternalHighPriestInput._domElement.disabled ).toBe( false );
    } );
} );

describe( 'ApiOptions.linkToCalendarSelect validation order', () => {

    beforeEach( () => {
        resetCurrentEndpoint();
    } );

    it( 'throws the existing calendarSelect validation error, and leaves CurrentEndpoint untouched, when riteSelect is valid but calendarSelect is not', () => {
        const validRiteSelect = new RiteSelect( 'en' );
        const notACalendarSelect = {};
        const apiOptionsUnderTest = new ApiOptions( 'en' );

        expect( () => apiOptionsUnderTest.linkToCalendarSelect( [ notACalendarSelect ], validRiteSelect ) )
            .toThrow( /Invalid type for items passed in parameter/ );

        // Proves the rite side effects (CurrentEndpoint mutation, listener
        // attachment, _applyRite) never fired before the throw: had they run
        // first, explicitRite would already be true by the time the
        // calendarSelect validation rejected the array.
        expect( CurrentEndpoint.explicitRite ).toBe( false );
    } );
} );
