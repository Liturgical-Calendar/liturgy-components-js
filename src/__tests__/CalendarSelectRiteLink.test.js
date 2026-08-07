/** @jest-environment jsdom */
import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import ApiClient from '../ApiClient/ApiClient.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import { CalendarSelectFilter, Rite, RiteProperties } from '../Enums.js';

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

beforeAll( async () => {
    global.fetch = jest.fn().mockResolvedValue( {
        ok: true,
        json: () => Promise.resolve( { litcal_metadata: METADATA } )
    } );
    await ApiClient.init();
} );

beforeEach( async () => {
    ApiClient.clearCache();
    await ApiClient.init();
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
