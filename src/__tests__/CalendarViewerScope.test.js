/** @jest-environment jsdom */
/**
 * `CalendarViewer` accepts a `scope` option and forwards it, unchanged, to
 * the `CalendarControls` it builds — see `src/MetaComponents/CalendarScope.js`
 * for the resolver, and `CalendarControlsScope.test.js` for the equivalent
 * coverage on `CalendarControls` itself. This file exists because the final
 * whole-branch review (F5) found no scope test anywhere for `CalendarViewer`,
 * `ApiExplorer` or `SubscriptionBuilder` — the gap that let F1 (`ApiExplorer`
 * shipping a scope bypass) reach the branch unnoticed.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import CalendarViewer from '../MetaComponents/CalendarViewer.js';

const API_URL = 'http://localhost:8000';

/**
 * Reproduces the real rite partition, with Lugano present so a nation scope
 * can be shown to exclude it. Copied verbatim from `CalendarControlsScope.test.js`
 * (itself copied from `CalendarScope.test.js`) rather than the shared
 * `FULL_METADATA` fixture, which CLAUDE.md requires stay byte-identical to
 * the live `/calendars` response — `lugano_ch` must not be invented there.
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
    document.body.innerHTML =
        '<div id="controls"></div><div id="calendar"></div>';
});

describe('CalendarViewer forwards scope to CalendarControls', () => {
    it('hides the rite and calendar selects for a diocese scope', () => {
        const viewer = new CalendarViewer({
            locale: 'en',
            scope: { diocese: 'romamo_it' },
        });
        viewer.appendTo({ controls: '#controls', calendar: '#calendar' });
        expect(viewer.controls.riteSelect._domElement.hidden).toBe(true);
        expect(viewer.controls.calendarSelect._domElement.hidden).toBe(true);
        expect(viewer.controls.calendarSelect._domElement.value).toBe(
            'romamo_it',
        );
    });

    it('shows the rite select, restricted to the rites in scope, for a two-rite national scope', () => {
        const viewer = new CalendarViewer({
            locale: 'en',
            scope: { nation: 'IT' },
        });
        viewer.appendTo({ controls: '#controls', calendar: '#calendar' });
        expect(viewer.controls.riteSelect._domElement.hidden).toBe(false);
        expect(
            [...viewer.controls.riteSelect._domElement.options].map(
                (o) => o.value,
            ),
        ).toEqual(['roman', 'ambrosian']);
    });

    it("restricts the calendar select's OPTIONS to the scope for the current rite, excluding Lugano under Ambrosian", () => {
        const viewer = new CalendarViewer({
            locale: 'en',
            scope: { nation: 'IT', includeDioceses: true },
        });
        viewer.appendTo({ controls: '#controls', calendar: '#calendar' });

        expect(
            [...viewer.controls.calendarSelect._domElement.options].map(
                (o) => o.value,
            ),
        ).toEqual(['IT', 'romamo_it']);

        viewer.controls.riteSelect._domElement.value = 'ambrosian';
        viewer.controls.riteSelect._domElement.dispatchEvent(
            new Event('change'),
        );

        // The rite-level stand-in (value '') plus Milan; Lugano (a Swiss
        // diocese) must NOT appear.
        expect(
            [...viewer.controls.calendarSelect._domElement.options].map(
                (o) => o.value,
            ),
        ).toEqual(['', 'milano_it']);
    });

    it('throws for an unknown scope key, naming CalendarViewer itself rather than CalendarControls (F8)', () => {
        expect(
            () =>
                new CalendarViewer({
                    locale: 'en',
                    scope: { natoin: 'IT' },
                }),
        ).toThrow(/^CalendarViewer.*natoin/s);
    });

    it('leaves an unscoped instance exactly as before', () => {
        const viewer = new CalendarViewer({ locale: 'en' });
        viewer.appendTo({ controls: '#controls', calendar: '#calendar' });
        expect(viewer.controls.riteSelect._domElement.hidden).toBe(false);
        expect(viewer.controls.calendarSelect._domElement.hidden).toBe(false);
    });
});
