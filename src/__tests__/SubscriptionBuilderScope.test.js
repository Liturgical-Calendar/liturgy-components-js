/** @jest-environment jsdom */
/**
 * `SubscriptionBuilder` accepts a `scope` option and forwards it to the
 * `CalendarControls` it builds — see `src/MetaComponents/CalendarScope.js`
 * for the resolver, and `CalendarControlsScope.test.js` for the equivalent
 * coverage on `CalendarControls` itself. This file exists because the final
 * whole-branch review (F5) found no scope test anywhere for
 * `SubscriptionBuilder`, `CalendarViewer` or `ApiExplorer` — the gap that let
 * F1 (`ApiExplorer` shipping a scope bypass) reach the branch unnoticed.
 *
 * Unlike `ApiExplorer`, `SubscriptionBuilder` genuinely inherits `scope` "for
 * free" through `CalendarControls` — see `docs/meta-components.md`'s
 * `ApiExplorer` Scope section for why the two differ.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import SubscriptionBuilder from '../SubscriptionBuilder/SubscriptionBuilder.js';

const API_URL = 'http://localhost:8000';

/**
 * Reproduces the real rite partition, with Lugano present so a nation scope
 * can be shown to exclude it. Copied verbatim from `CalendarControlsScope.test.js`
 * (itself copied from `CalendarScope.test.js`) rather than the shared
 * `FULL_METADATA` fixture, which CLAUDE.md requires stay byte-identical to
 * the live `/calendars` response — `lugano_ch` must not be invented there.
 *
 * Every entry carries an (empty) `settings` object, unlike the
 * `CalendarControlsScope.test.js`/`CalendarResourcePickerScope.test.js` copies
 * of this literal: unlike `CalendarControls`, `SubscriptionBuilder` calls
 * `apiOptions.linkToCalendarSelect()` directly in its OWN constructor (see the
 * class doc comment on wiring the rite -> calendar chain without
 * `listenTo()`), and `ApiOptions#applyCalendarToInputs()` reads
 * `nationalCalendar.settings` unconditionally (`Object.entries()` on it) —
 * the same pre-existing gap `DayViewerScope.test.js` works around, since
 * `DayViewer` links the same way.
 */
const METADATA = {
    locales: ['en', 'it', 'fr', 'la'],
    national_calendars: [
        { calendar_id: 'IT', locales: ['it'], settings: {} },
        { calendar_id: 'US', locales: ['en'], settings: {} },
        { calendar_id: 'CA', locales: ['fr-CA', 'en-CA'], settings: {} },
        { calendar_id: 'CH', locales: ['de', 'fr', 'it'], settings: {} },
    ],
    diocesan_calendars: [
        {
            calendar_id: 'romamo_it',
            nation: 'IT',
            diocese: 'Roma',
            locales: ['it'],
            rite: 'roman',
            settings: {},
        },
        {
            calendar_id: 'milano_it',
            nation: 'IT',
            diocese: 'Milano',
            locales: ['it'],
            rite: 'ambrosian',
            settings: {},
        },
        {
            calendar_id: 'lugano_ch',
            nation: 'CH',
            diocese: 'Lugano',
            locales: ['it'],
            rite: 'ambrosian',
            settings: {},
        },
        {
            calendar_id: 'boston_us',
            nation: 'US',
            diocese: 'Boston',
            locales: ['en'],
            rite: 'roman',
            settings: {},
        },
    ],
    ambrosian_calendars: [
        { calendar_id: 'AMBROSIAN', locales: ['it', 'la'], settings: {} },
    ],
};

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, METADATA);
    document.body.innerHTML = '<div id="controls"></div><div id="url"></div>';
    // Never fetches (`SubscriptionBuilder` never calls `listenTo()`), but the
    // mock is in place anyway, matching `SubscriptionBuilder.test.js`.
    global.fetch = jest.fn(() =>
        Promise.resolve({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: () => Promise.resolve({ litcal: [] }),
        }),
    );
});

describe('SubscriptionBuilder forwards scope to CalendarControls', () => {
    it('hides the rite and calendar selects for a diocese scope', () => {
        const sub = new SubscriptionBuilder({
            locale: 'en',
            scope: { diocese: 'romamo_it' },
        });
        expect(sub.riteSelect._domElement.hidden).toBe(true);
        expect(sub.calendarSelect._domElement.hidden).toBe(true);
    });

    it('shows the rite select, restricted to the rites in scope, for a two-rite national scope', () => {
        const sub = new SubscriptionBuilder({
            locale: 'en',
            scope: { nation: 'IT' },
        });
        expect(sub.riteSelect._domElement.hidden).toBe(false);
        expect(
            [...sub.riteSelect._domElement.options].map((o) => o.value),
        ).toEqual(['roman', 'ambrosian']);
    });

    it("restricts the calendar select's OPTIONS to the scope for the current rite, excluding Lugano under Ambrosian", () => {
        const sub = new SubscriptionBuilder({
            locale: 'en',
            scope: { nation: 'IT', includeDioceses: true },
        });

        expect(
            [...sub.calendarSelect._domElement.options].map((o) => o.value),
        ).toEqual(['IT', 'romamo_it']);

        sub.riteSelect._domElement.value = 'ambrosian';
        sub.riteSelect._domElement.dispatchEvent(new Event('change'));

        // The rite-level stand-in (value '') plus Milan; Lugano (a Swiss
        // diocese) must NOT appear.
        expect(
            [...sub.calendarSelect._domElement.options].map((o) => o.value),
        ).toEqual(['', 'milano_it']);
    });

    it('throws for an unknown scope key, naming SubscriptionBuilder itself rather than CalendarControls (F8)', () => {
        expect(
            () =>
                new SubscriptionBuilder({
                    locale: 'en',
                    scope: { natoin: 'IT' },
                }),
        ).toThrow(/^SubscriptionBuilder.*natoin/s);
    });

    it('leaves an unscoped instance exactly as before', () => {
        const sub = new SubscriptionBuilder({ locale: 'en' });
        expect(sub.riteSelect._domElement.hidden).toBe(false);
        expect(sub.calendarSelect._domElement.hidden).toBe(false);
    });
});

describe("SubscriptionBuilder's generated URL reflects the scoped calendar", () => {
    it("selects the scope's own diocese and the URL composes its path", () => {
        const sub = new SubscriptionBuilder({
            locale: 'en',
            scope: { diocese: 'romamo_it' },
        });
        expect(sub.calendarSelect._domElement.value).toBe('romamo_it');
        expect(sub.url).toContain('/calendar/roman/diocese/romamo_it');
    });

    it('reflects a rite change made through a narrowed, scoped calendar select', () => {
        const sub = new SubscriptionBuilder({
            locale: 'en',
            scope: { nation: 'IT', includeDioceses: true },
        });
        expect(sub.url).toContain('/calendar/roman/nation/IT');

        sub.riteSelect._domElement.value = 'ambrosian';
        sub.riteSelect._domElement.dispatchEvent(new Event('change'));
        sub.calendarSelect._domElement.value = 'milano_it';
        sub.calendarSelect._domElement.dispatchEvent(new Event('change'));

        expect(sub.url).toContain('/calendar/ambrosian/diocese/milano_it');
        expect(sub.url).not.toContain('lugano_ch');
    });
});
