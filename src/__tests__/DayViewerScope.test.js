/** @jest-environment jsdom */
/**
 * `DayViewer` accepts a `scope` option and derives its rite select, calendar
 * select and locale input's visibility from it. `DayViewer` builds its
 * selects DIRECTLY rather than through `CalendarControls`, which is why it
 * needs its own copy of the wiring `CalendarControlsScope.test.js` already
 * covers for that class — see `src/MetaComponents/CalendarScope.js` for the
 * resolver both consume.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import DayViewer from '../MetaComponents/DayViewer.js';

const API_URL = 'http://localhost:8000';

/**
 * Reproduces the real rite partition, with Lugano present so a nation scope
 * can be shown to exclude it. `US` has a Roman diocese and no Ambrosian one,
 * which is what makes the derived-rites rule observable. `CA` carries two
 * locales on its national calendar, which is what makes a pinned
 * `scope.locale` observably different from an unpinned one. Copied verbatim
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

describe('DayViewer with a scope', () => {
    it('hides both selects and selects the scoped calendar for a diocese scope', () => {
        const viewer = new DayViewer({
            locale: 'en',
            scope: { diocese: 'romamo_it' },
        });
        viewer.appendTo('#mount');
        expect(viewer.riteSelect._domElement.hidden).toBe(true);
        expect(viewer.calendarSelect._domElement.hidden).toBe(true);
        expect(viewer.calendarSelect._domElement.value).toBe('romamo_it');
    });

    it('restricts the rite select to the rites in scope', () => {
        const viewer = new DayViewer({
            locale: 'en',
            scope: { nation: 'US' },
        });
        viewer.appendTo('#mount');
        expect(
            [...viewer.riteSelect._domElement.options].map((o) => o.value),
        ).toEqual(['roman']);
    });

    it('throws for an unknown scope key, naming the component', () => {
        expect(
            () => new DayViewer({ locale: 'en', scope: { natoin: 'IT' } }),
        ).toThrow(/DayViewer.*natoin/s);
    });

    it("restricts the calendar select's OPTIONS to the scope for the current rite, excluding Lugano under Ambrosian", () => {
        const viewer = new DayViewer({
            locale: 'en',
            scope: { nation: 'IT', includeDioceses: true },
        });
        viewer.appendTo('#mount');

        expect(
            [...viewer.calendarSelect._domElement.options].map((o) => o.value),
        ).toEqual(['IT', 'romamo_it']);

        viewer.riteSelect._domElement.value = 'ambrosian';
        viewer.riteSelect._domElement.dispatchEvent(new Event('change'));

        // The rite-level stand-in (value '') plus Milan; Lugano (a Swiss
        // diocese) must NOT appear.
        expect(
            [...viewer.calendarSelect._domElement.options].map((o) => o.value),
        ).toEqual(['', 'milano_it']);
    });

    it('leaves an unscoped instance exactly as before', () => {
        const viewer = new DayViewer({ locale: 'en' });
        viewer.appendTo('#mount');
        expect(viewer.riteSelect._domElement.hidden).toBe(false);
        expect(viewer.calendarSelect._domElement.hidden).toBe(false);
        expect(viewer.localeInput._domElement.hidden).toBe(false);
    });

    it('hides the locale input when scope.locale is pinned', () => {
        // Unpinned: CA's national calendar carries two locales, so the
        // locale input has a real choice to offer.
        const unpinned = new DayViewer({
            locale: 'en',
            scope: { nation: 'CA' },
        });
        unpinned.appendTo('#mount');
        expect(unpinned.localeInput._domElement.hidden).toBe(false);

        // Pinned: the same calendar, but the scope has already decided the
        // locale — the input has nothing left to offer.
        const secondMount = document.createElement('div');
        secondMount.id = 'mount2';
        document.body.appendChild(secondMount);
        const pinned = new DayViewer({
            locale: 'en',
            scope: { nation: 'CA', locale: 'fr-CA' },
        });
        pinned.appendTo('#mount2');
        expect(pinned.localeInput._domElement.hidden).toBe(true);
    });
});
