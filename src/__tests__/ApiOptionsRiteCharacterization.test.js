/** @jest-environment jsdom */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import { ApiOptionsFilter, CalendarSelectFilter, Rite, RiteProperties } from '../Enums.js';

/**
 * Local rather than the shared `FULL_METADATA`: these assertions name TWO
 * Ambrosian dioceses, `milano_it` and `lugano_ch`, and the shared fixture
 * carries only the first.
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
        '<div id="rite"></div><div id="nation"></div><div id="diocese"></div><div id="single"></div><div id="opts"></div>';
} );

/** The paired nation/diocese form, wired the way examples/RiteSelectChain does. */
const buildPaired = () => {
    const riteSelect = new RiteSelect( 'en' );
    riteSelect.appendTo( '#rite' );

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
    apiOptions.appendTo( '#opts' );

    return { riteSelect, nationSelect, dioceseSelect, apiOptions };
};

/** The single `none` filtered form, as index.js in the frontend builds it. */
const buildSingle = () => {
    const riteSelect = new RiteSelect( 'en' );
    riteSelect.appendTo( '#rite' );

    const calendarSelect = new CalendarSelect( 'en' ).allowNull( true );
    calendarSelect.appendTo( '#single' );

    const apiOptions = new ApiOptions( 'en' );
    apiOptions.filter( ApiOptionsFilter.PATH_BUILDER ).appendTo( '#opts' );
    apiOptions.linkToCalendarSelect( calendarSelect, riteSelect );

    return { riteSelect, calendarSelect, apiOptions };
};

const chooseRite = ( riteSelect, rite ) => {
    riteSelect._domElement.value = rite;
    riteSelect._domElement.dispatchEvent( new Event( 'change' ) );
};

describe( 'ApiOptions rite behaviour, paired nation/diocese form', () => {

    it( 'hides the nation select for a rite with no national tier, and shows it again', () => {
        const { riteSelect, nationSelect } = buildPaired();
        const target = () => nationSelect._wrapperElement ?? nationSelect._domElement;

        expect( RiteProperties[ Rite.AMBROSIAN ].hasNationalTier ).toBe( false );

        chooseRite( riteSelect, Rite.AMBROSIAN );
        expect( target().hidden ).toBe( true );

        chooseRite( riteSelect, Rite.ROMAN );
        expect( target().hidden ).toBe( false );
    } );

    it( 'rebuilds the diocese select for the chosen rite and clears the selection', () => {
        const { riteSelect, dioceseSelect } = buildPaired();

        chooseRite( riteSelect, Rite.AMBROSIAN );
        const values = [ ...dioceseSelect._domElement.options ].map( o => o.value );
        expect( values ).toContain( 'milano_it' );
        expect( values ).toContain( 'lugano_ch' );
        expect( values ).not.toContain( 'romamo_it' );
        expect( dioceseSelect._domElement.value ).toBe( '' );
    } );

    it( 'dispatches change on the diocese select but not on the nation select', () => {
        const { riteSelect, nationSelect, dioceseSelect } = buildPaired();
        let nationChanges = 0;
        let dioceseChanges = 0;
        nationSelect._domElement.addEventListener( 'change', () => { nationChanges++; } );
        dioceseSelect._domElement.addEventListener( 'change', () => { dioceseChanges++; } );

        chooseRite( riteSelect, Rite.AMBROSIAN );

        expect( dioceseChanges ).toBeGreaterThan( 0 );
        expect( nationChanges ).toBe( 0 );
    } );
} );

describe( 'ApiOptions rite behaviour, single linked form', () => {

    it( 'clamps a year below the new rite floor and notifies listeners', () => {
        const { riteSelect, apiOptions } = buildSingle();
        const yearElement = apiOptions._yearInput._domElement;
        const floor = RiteProperties[ Rite.AMBROSIAN ].minYear;

        yearElement.value = String( RiteProperties[ Rite.ROMAN ].minYear );
        let yearChanges = 0;
        yearElement.addEventListener( 'change', () => { yearChanges++; } );

        chooseRite( riteSelect, Rite.AMBROSIAN );

        expect( Number( yearElement.value ) ).toBe( floor );
        expect( Number( yearElement.min ) ).toBe( floor );
        expect( yearChanges ).toBeGreaterThan( 0 );
    } );

    it( 'rebuilds the single calendar select and clears its selection', () => {
        const { riteSelect, calendarSelect } = buildSingle();

        chooseRite( riteSelect, Rite.AMBROSIAN );

        expect( calendarSelect._domElement.value ).toBe( '' );
        expect( calendarSelect._rite ).toBe( Rite.AMBROSIAN );
    } );

    it( 'disables the temporal inputs for a rite that fixes them', () => {
        const { riteSelect, apiOptions } = buildSingle();

        expect( RiteProperties[ Rite.AMBROSIAN ].hasFixedTemporalOptions ).toBe( true );
        chooseRite( riteSelect, Rite.AMBROSIAN );

        expect( apiOptions._epiphanyInput._domElement.disabled ).toBe( true );
        expect( apiOptions._ascensionInput._domElement.disabled ).toBe( true );
        expect( apiOptions._corpusChristiInput._domElement.disabled ).toBe( true );
        expect( apiOptions._eternalHighPriestInput._domElement.disabled ).toBe( true );

        chooseRite( riteSelect, Rite.ROMAN );
        expect( apiOptions._epiphanyInput._domElement.disabled ).toBe( false );
    } );
} );
