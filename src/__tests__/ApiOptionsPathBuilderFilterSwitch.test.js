/** @jest-environment jsdom */
import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import ApiClient from '../ApiClient/ApiClient.js';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import { ApiOptionsFilter, CalendarSelectFilter } from '../Enums.js';

/**
 * Enough metadata for a national and a diocesan calendar to exist, so both
 * filters have something to render.
 */
const METADATA = {
    locales: [ 'en', 'it', 'la' ],
    national_calendars: [
        { calendar_id: 'IT', locales: [ 'it-IT' ], settings: {} },
        { calendar_id: 'VA', locales: [ 'la', 'it-IT' ], settings: {} }
    ],
    diocesan_calendars: [
        { calendar_id: 'romamo_it', nation: 'IT', diocese: 'Diocesi di Roma', locales: [ 'it-IT' ], rite: 'roman' }
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

let apiOptions;
let calendarSelect;
let pathElement;

beforeEach( async () => {
    ApiClient.clearCache();
    await ApiClient.init();

    document.body.innerHTML = '<div id="pathBuilder"></div><div id="calSelect"></div>';

    apiOptions = new ApiOptions( 'it' );
    apiOptions.filter( ApiOptionsFilter.PATH_BUILDER ).appendTo( '#pathBuilder' );

    calendarSelect = new CalendarSelect( 'it' );
    calendarSelect.appendTo( '#calSelect' );

    apiOptions.linkToCalendarSelect( calendarSelect );
    pathElement = apiOptions._calendarPathInput._domElement;
} );

/** Drive the path select the way a user clicking through the builder does. */
const selectPath = ( value ) => {
    pathElement.value = value;
    pathElement.dispatchEvent( new Event( 'change' ) );
};

describe( 'PathBuilder switching between the nation and diocese paths', () => {

    /**
     * Regression: the duplicate-filter guard in `CalendarSelect.filter()` was
     * dead code for its whole life — it compared `filter !== this.#filter` AFTER
     * assigning, so `#filterSet` never became true. ApiOptions' path builder was
     * written against that, and re-filters ONE CalendarSelect every time the
     * path changes. Making the guard live turned the second switch into
     * "Filter has already been set to `nations`".
     */
    it( 'switches from the nation path to the diocese path without throwing', () => {
        selectPath( '/calendar/nation/' );
        expect( calendarSelect._filter ).toBe( CalendarSelectFilter.NATIONAL_CALENDARS );

        expect( () => selectPath( '/calendar/diocese/' ) ).not.toThrow();
        expect( calendarSelect._filter ).toBe( CalendarSelectFilter.DIOCESAN_CALENDARS );
    } );

    it( 'switches back and forth repeatedly', () => {
        expect( () => {
            selectPath( '/calendar/nation/' );
            selectPath( '/calendar/diocese/' );
            selectPath( '/calendar/nation/' );
            selectPath( '/calendar' );
            selectPath( '/calendar/diocese/' );
        } ).not.toThrow();

        expect( calendarSelect._filter ).toBe( CalendarSelectFilter.DIOCESAN_CALENDARS );
    } );

    /**
     * The escape hatch this fix introduces. The public `filter()` guard is
     * already pinned in CalendarSelect.test.js ('filter() duplicate guard'); what
     * is untested is `_applyFilter` itself, so both halves of the split are
     * covered: it must skip the one-shot guard WITHOUT also becoming a hole in
     * validation.
     */
    it( '_applyFilter bypasses the one-shot guard but still validates', () => {
        const cs = new CalendarSelect( 'it' ).filter( CalendarSelectFilter.NATIONAL_CALENDARS );

        // The asymmetry with filter() is deliberate, and is the whole fix.
        expect( () => cs._applyFilter( CalendarSelectFilter.DIOCESAN_CALENDARS ) ).not.toThrow();
        expect( cs._filter ).toBe( CalendarSelectFilter.DIOCESAN_CALENDARS );

        // Skipping the guard must not mean skipping the enum check too.
        expect( () => cs._applyFilter( 'byzantine' ) ).toThrow( /Invalid filter/ );
        expect( cs._filter ).toBe( CalendarSelectFilter.DIOCESAN_CALENDARS );
    } );

    it( 'actually re-renders the options for the newly chosen path', () => {
        selectPath( '/calendar/nation/' );
        const nationValues = [ ...calendarSelect._domElement.options ].map( o => o.value );

        selectPath( '/calendar/diocese/' );
        const dioceseValues = [ ...calendarSelect._domElement.options ].map( o => o.value );

        // Not merely "no throw": the select must genuinely swap its contents.
        expect( nationValues ).toContain( 'IT' );
        expect( dioceseValues ).toContain( 'romamo_it' );
        expect( dioceseValues ).not.toContain( 'IT' );
    } );
} );
