/** @jest-environment jsdom */
import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import ApiClient from '../ApiClient/ApiClient.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import { CalendarSelectFilter } from '../Enums.js';

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
