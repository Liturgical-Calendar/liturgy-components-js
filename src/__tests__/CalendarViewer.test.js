/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import CalendarViewer from '../MetaComponents/CalendarViewer.js';
import { Grouping, DateFormat } from '../Enums.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

/**
 * One event, shaped like a real `/calendar` response entry — the same shape
 * `WebCalendarRiteCaption.test.js` uses. Every other fixture in this file
 * returns an EMPTY `litcal`, on which `WebCalendar` throws (see
 * `WebCalendar.js`'s `listenTo()`), so none of them can tell whether the
 * `calendar` slot actually renders anything. This one can.
 */
const NON_EMPTY_CALENDAR_DATA = {
    litcal: [
        {
            event_key: 'Advent1',
            event_idx: 1,
            name: 'Dominica I in Adventu Domini',
            color: ['morello'],
            color_lcl: ['violaceus'],
            grade: 7,
            grade_lcl: 'sollemnitas',
            grade_abbr: 'S',
            grade_display: '',
            common: [],
            common_lcl: '',
            type: 'mobile',
            date: '2026-11-15T00:00:00+00:00',
            year: 2026,
            month: 11,
            month_short: 'Nov.',
            month_long: 'November',
            day: 15,
            day_of_the_week_iso8601: 7,
            day_of_the_week_short: 'Sun',
            day_of_the_week_long: 'Sunday',
            liturgical_year: 'A',
            is_vigil_mass: false,
            psalter_week: 1,
            liturgical_season: 'ADVENT',
            liturgical_season_lcl: 'Advent',
            holy_day_of_obligation: false,
        },
    ],
    settings: { year: 2026, locale: 'en', year_type: 'LITURGICAL' },
    metadata: { version: 'test' },
    messages: [],
};

const captureRequests = () => {
    const urls = [];
    global.fetch = jest.fn((url) => {
        urls.push(String(url));
        return Promise.resolve({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: () =>
                Promise.resolve({
                    litcal: [],
                    settings: {},
                    metadata: {},
                    messages: [],
                }),
        });
    });
    return urls;
};

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.replaceChildren();
    for (const id of ['controls', 'calendar', 'messages']) {
        const el = document.createElement('div');
        el.id = id;
        document.body.appendChild(el);
    }
});

describe('CalendarViewer', () => {
    it('mounts controls and a calendar into their slots', async () => {
        captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const viewer = await CalendarViewer.mountInto(
            { controls: '#controls', calendar: '#calendar' },
            { locale: 'en', apiClient },
        );
        expect(
            document.querySelectorAll('#controls select').length,
        ).toBeGreaterThanOrEqual(2);
        expect(viewer.webCalendar).not.toBeNull();
        expect(viewer.controls).not.toBeNull();
    });

    it('forwards the webCalendar bag to the matching methods', async () => {
        captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const viewer = await CalendarViewer.mountInto(
            { controls: '#controls', calendar: '#calendar' },
            {
                locale: 'en',
                apiClient,
                webCalendar: {
                    id: 'LitCalTable',
                    firstColumnGrouping: Grouping.BY_LITURGICAL_SEASON,
                    dateFormat: DateFormat.DAY_ONLY,
                    psalterWeekColumn: true,
                },
            },
        );
        expect(viewer.webCalendar).not.toBeNull();
    });

    it('rejects an unknown webCalendar key, naming it', async () => {
        const apiClient = await ApiClient.init(API_URL);
        await expect(
            CalendarViewer.mountInto(
                { controls: '#controls', calendar: '#calendar' },
                { locale: 'en', apiClient, webCalendar: { notAMethod: 1 } },
            ),
        ).rejects.toThrow(/notAMethod/);
    });

    // This test passes for a reason worth recording, not just "it works":
    // the fixture below has an EMPTY `litcal`, which makes `WebCalendar`'s own
    // `calendarFetched` listener throw (see `WebCalendar.js`). `EventEmitter.emit()`
    // is a synchronous `forEach` over listeners in REGISTRATION order, so that
    // throw aborts the iteration for any listener registered after it. This test
    // only proves the messages renderer ran because `controls.listenTo()` (whose
    // subscriptions include the messages renderer) is wired ahead of
    // `webCalendar.listenTo()` in `CalendarViewer.mountInto()` — the messages
    // renderer's own listener never has a chance to be skipped by the throw that
    // comes after it. If a future fixture change here ever gave `litcal` a real
    // event, `WebCalendar` would stop throwing and this test would keep passing
    // for the RIGHT reason instead — but until then, it is quietly exercising
    // registration order, not "messages render alongside a working calendar".
    it('renders messages when the slot is named', async () => {
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: () =>
                    Promise.resolve({
                        litcal: [],
                        settings: {},
                        metadata: {},
                        messages: ['a message'],
                    }),
            }),
        );
        const apiClient = await ApiClient.init(API_URL);
        await CalendarViewer.mountInto(
            {
                controls: '#controls',
                calendar: '#calendar',
                messages: '#messages',
            },
            { locale: 'en', apiClient },
        );
        expect(document.querySelectorAll('#messages tr').length).toBe(1);
    });

    // C1: everything above uses fixtures with an EMPTY `litcal`, on which
    // `WebCalendar` throws — see the comment on the messages test above — so
    // none of them can tell whether `#webCalendar.appendTo()` and
    // `#webCalendar.listenTo()` in `CalendarViewer.mountInto()` actually do
    // anything. This is the one test in the suite that can: with a real event
    // in `litcal`, `WebCalendar` does not throw, and a `<table>` should
    // actually land in the `calendar` slot. Deleting either
    // `viewer.#webCalendar.appendTo( calendarElement )` or
    // `viewer.#webCalendar.listenTo( apiClient )` from `CalendarViewer.js`
    // leaves this assertion failing, with no table ever appearing.
    it('renders a table into the calendar slot when litcal has events', async () => {
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: () => Promise.resolve(NON_EMPTY_CALENDAR_DATA),
            }),
        );
        // Without this, ApiClient's cache — keyed on locale/year/yearType/rite/
        // mobile-feast settings, not on response content — would answer this
        // request from an earlier test's EMPTY-`litcal` response instead of
        // actually calling the mock above. See CLAUDE.md's caching section.
        ApiClient.clearCache();
        const apiClient = await ApiClient.init(API_URL);
        await CalendarViewer.mountInto(
            { controls: '#controls', calendar: '#calendar' },
            { locale: 'en', apiClient },
        );
        // `WebCalendar.buildTable()` populates its `<tbody>` from an internal,
        // un-awaited `(async () => { ... })()` (see `WebCalendar.js`) — the
        // table SHELL (colgroup/caption/thead) is attached synchronously, but
        // the row itself lands a tick or two later. `WebCalendarRiteCaption.test.js`
        // waits the same way for the same reason.
        await new Promise((resolve) => setTimeout(resolve, 0));

        const table = document.querySelector('#calendar table');
        expect(table).not.toBeNull();
        expect(table.textContent).toContain('Dominica I in Adventu Domini');
    });

    it('disposes both halves', async () => {
        captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const viewer = await CalendarViewer.mountInto(
            { controls: '#controls', calendar: '#calendar' },
            { locale: 'en', apiClient },
        );
        viewer.dispose();
        expect(() => viewer.controls).toThrow(/disposed/);
        expect(document.getElementById('controls').children.length).toBe(0);
    });

    // C1: dispose() must empty the `calendar` mount too, not only `controls`.
    it('empties the calendar mount on dispose', async () => {
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: () => Promise.resolve(NON_EMPTY_CALENDAR_DATA),
            }),
        );
        // Without this, ApiClient's cache — keyed on locale/year/yearType/rite/
        // mobile-feast settings, not on response content — would answer this
        // request from an earlier test's EMPTY-`litcal` response instead of
        // actually calling the mock above. See CLAUDE.md's caching section.
        ApiClient.clearCache();
        const apiClient = await ApiClient.init(API_URL);
        const viewer = await CalendarViewer.mountInto(
            { controls: '#controls', calendar: '#calendar' },
            { locale: 'en', apiClient },
        );
        expect(document.getElementById('calendar').children.length).toBe(1);
        viewer.dispose();
        expect(document.getElementById('calendar').children.length).toBe(0);
    });

    // I3: a bad target inside `slots.controls` must be reported under
    // `CalendarViewer.mountInto`, the method the caller actually used — not
    // `CalendarControls.appendTo`, a class the caller never directly touched.
    it('reports a missing controls target naming CalendarViewer.mountInto', async () => {
        const apiClient = await ApiClient.init(API_URL);
        await expect(
            CalendarViewer.mountInto(
                { controls: '#nope', calendar: '#calendar' },
                { locale: 'en', apiClient },
            ),
        ).rejects.toThrow(/CalendarViewer\.mountInto: Element not found/);
    });
    // Review of PR #44: `mountInto()` resolved `calendar` only AFTER mounting the
    // controls, so an unusable `calendar` selector threw with the controls already
    // in the document — a partial mount the caller cannot undo, since the rejected
    // promise hands back no viewer to `dispose()`. Measured before the fix: ten
    // control elements left mounted.
    it('mounts nothing when the calendar target is invalid', async () => {
        captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        await expect(
            CalendarViewer.mountInto(
                { controls: '#controls', calendar: '#nope' },
                { locale: 'en', apiClient },
            ),
        ).rejects.toThrow(/calendar/);
        expect(document.getElementById('controls').children.length).toBe(0);
    });

    // Review of PR #44: emptying the mount was undone by the very next fetch,
    // because `WebCalendar.listenTo()` had attached an anonymous `calendarFetched`
    // listener that nothing could unsubscribe. `WebCalendar.dispose()` now exists
    // for exactly this, and `CalendarViewer.dispose()` calls it.
    it('stays empty when a fetch lands after dispose', async () => {
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: () => Promise.resolve(NON_EMPTY_CALENDAR_DATA),
            }),
        );
        const apiClient = await ApiClient.init(API_URL);
        const viewer = await CalendarViewer.mountInto(
            { controls: '#controls', calendar: '#calendar' },
            { locale: 'en', apiClient },
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(
            document.getElementById('calendar').children.length,
        ).toBeGreaterThan(0);

        viewer.dispose();
        expect(document.getElementById('calendar').children.length).toBe(0);

        ApiClient.clearCache();
        await apiClient.fetchCalendar('en').catch(() => {});
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(document.getElementById('calendar').children.length).toBe(0);
    });
});
