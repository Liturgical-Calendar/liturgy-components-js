import { describe, it, expect, beforeAll, jest } from '@jest/globals';
import ApiClient from '../ApiClient/ApiClient.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';

/**
 * Minimal metadata shape reproducing the real-world rite-partition case:
 * `lugano_ch` is a diocesan calendar whose `nation` is `CH` (Switzerland),
 * but Lugano is served under the Ambrosian rite, not the Roman rite, and
 * Ambrosian dioceses have no national tier at all. As a result `CH` has
 * NO corresponding entry in `national_calendars`.
 *
 * `roma_it` is included as a normal, non-orphaned control case: `IT` does
 * have a matching entry in `national_calendars`.
 */
const METADATA = {
    national_calendars: [
        { calendar_id: 'IT', locales: ['it-IT'] },
        { calendar_id: 'VA', locales: ['la', 'it-IT'] }
    ],
    diocesan_calendars: [
        { calendar_id: 'roma_it', nation: 'IT', diocese: 'Diocesi di Roma' },
        { calendar_id: 'lugano_ch', nation: 'CH', diocese: 'Diocesi di Lugano' }
    ]
};

// The CalendarSelect constructor builds all of its select options (including
// the crash under test) before it ever touches `document.createElement`, but
// it does reach that call afterwards, so we provide the minimal stub needed
// for the constructor to complete without pulling in a full DOM environment.
global.document = {
    createElement: () => ( {} )
};

beforeAll(async () => {
    global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve( { litcal_metadata: METADATA } )
    });
    await ApiClient.init();
});

describe( 'CalendarSelect: diocese whose nation has no national calendar (e.g. lugano_ch / CH)', () => {

    it( 'does not crash the constructor', () => {
        // Before the fix: CalendarSelect.#addNationalCalendarWithDioceses('CH') pushes
        // `undefined` (the result of a missed `.find()`) into #nationalCalendarsWithDioceses,
        // and #buildAllOptions later dereferences `.calendar_id` on it, throwing:
        //   TypeError: Cannot read properties of undefined (reading 'calendar_id')
        expect( () => new CalendarSelect() ).not.toThrow();
    } );

    it( 'keeps the orphaned diocese reachable, grouped under its bare nation code', () => {
        const calendarSelect = new CalendarSelect();

        // The diocese must still be present in the grouped diocese markup.
        expect( calendarSelect.diocesesInnerHtml ).toContain( 'value="lugano_ch"' );

        // It must be grouped under its nation code, even though CH is not a
        // Roman national calendar in its own right.
        expect( calendarSelect.diocesesInnerHtml ).toMatch( /<optgroup label="[^"]*">[^<]*<option[^>]*value="lugano_ch"/ );

        // A nation option for CH must exist so the group is actually selectable.
        expect( calendarSelect.nationsInnerHtml ).toContain( 'value="CH"' );
    } );

    it( 'does not affect a diocese whose nation does have a national calendar', () => {
        const calendarSelect = new CalendarSelect();
        expect( calendarSelect.diocesesInnerHtml ).toContain( 'value="roma_it"' );
        expect( calendarSelect.nationsInnerHtml ).toContain( 'value="IT"' );
    } );
} );
