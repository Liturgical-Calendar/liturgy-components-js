/** @jest-environment jsdom */
/**
 * `CalendarResourcePicker` accepts a `scope` option and derives its rite
 * select and calendar select's visibility from it. `CalendarResourcePicker`
 * builds its selects DIRECTLY rather than through `CalendarControls`, which
 * is why it needs its own copy of the wiring `CalendarControlsScope.test.js`
 * already covers for that class — see `src/MetaComponents/CalendarScope.js`
 * for the resolver both consume.
 *
 * Unlike `CalendarControls` and `DayViewer`, this picker has no locale input
 * — `deriveVisibility()`'s third field is simply never applied here.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import CalendarResourcePicker from '../MetaComponents/CalendarResourcePicker.js';
import { CalendarSelectFilter } from '../Enums.js';

const API_URL = 'http://localhost:8000';

/**
 * Reproduces the real rite partition, with Lugano present so a nation scope
 * can be shown to exclude it. `US` has a Roman diocese and no Ambrosian one,
 * which is what makes the derived-rites rule observable. Copied verbatim
 * from `CalendarControlsScope.test.js` (itself copied from Task 4's
 * `CalendarScope.test.js`) rather than the shared `FULL_METADATA` fixture,
 * which CLAUDE.md requires stay byte-identical to the live `/calendars`
 * response — `lugano_ch` must not be invented there.
 */
const METADATA = {
    locales: ['en', 'it', 'fr', 'la'],
    national_calendars: [
        { calendar_id: 'IT', locales: ['it'] },
        { calendar_id: 'US', locales: ['en'] },
        { calendar_id: 'CA', locales: ['fr-CA', 'en-CA'] },
        { calendar_id: 'CH', locales: ['de', 'fr', 'it'] },
    ],
    diocesan_calendars: [
        {
            calendar_id: 'romamo_it',
            nation: 'IT',
            diocese: 'Roma',
            locales: ['it'],
            rite: 'roman',
        },
        {
            calendar_id: 'milano_it',
            nation: 'IT',
            diocese: 'Milano',
            locales: ['it'],
            rite: 'ambrosian',
        },
        {
            calendar_id: 'lugano_ch',
            nation: 'CH',
            diocese: 'Lugano',
            locales: ['it'],
            rite: 'ambrosian',
        },
        {
            calendar_id: 'boston_us',
            nation: 'US',
            diocese: 'Boston',
            locales: ['en'],
            rite: 'roman',
        },
    ],
    ambrosian_calendars: [{ calendar_id: 'AMBROSIAN', locales: ['it', 'la'] }],
};

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, METADATA);
    document.body.replaceChildren();
    const mount = document.createElement('div');
    mount.id = 'mount';
    document.body.appendChild(mount);
});

describe('CalendarResourcePicker with a scope', () => {
    it('hides both selects and selects the scoped calendar for a diocese scope', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
            scope: { diocese: 'romamo_it' },
        });
        picker.appendTo('#mount');
        expect(picker.riteSelect._domElement.hidden).toBe(true);
        expect(picker.calendarSelect._domElement.hidden).toBe(true);
        expect(picker.calendarSelect._domElement.value).toBe('romamo_it');
    });

    it('restricts the rite select to the rites in scope', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
            scope: { nation: 'US' },
        });
        picker.appendTo('#mount');
        expect(
            [...picker.riteSelect._domElement.options].map((o) => o.value),
        ).toEqual(['roman']);
    });

    it('throws for an unknown scope key, naming the component', () => {
        expect(
            () =>
                new CalendarResourcePicker({
                    locale: 'en',
                    filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
                    scope: { natoin: 'IT' },
                }),
        ).toThrow(/CalendarResourcePicker.*natoin/s);
    });

    it("restricts the calendar select's OPTIONS to the scope for the current rite, excluding Lugano under Ambrosian", () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
            scope: { nation: 'IT', includeDioceses: true },
        });
        picker.appendTo('#mount');

        expect(
            [...picker.calendarSelect._domElement.options].map((o) => o.value),
        ).toEqual(['IT', 'romamo_it']);

        picker.riteSelect._domElement.value = 'ambrosian';
        picker.riteSelect._domElement.dispatchEvent(new Event('change'));

        // The rite-level stand-in (value '') plus Milan; Lugano (a Swiss
        // diocese) must NOT appear.
        expect(
            [...picker.calendarSelect._domElement.options].map((o) => o.value),
        ).toEqual(['', 'milano_it']);
    });

    it('leaves an unscoped instance exactly as before', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
        });
        picker.appendTo('#mount');
        expect(picker.riteSelect._domElement.hidden).toBe(false);
        expect(picker.calendarSelect._domElement.hidden).toBe(false);
    });
});
