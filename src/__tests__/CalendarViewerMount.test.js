/** @jest-environment jsdom */
/**
 * The constructor path — `new CalendarViewer()`, `appendTo()`, `listenTo()`,
 * `fetch()` — as distinct from `mountInto()`, which `CalendarViewer.test.js`
 * covers. That path was documented in `docs/meta-components.md` before it
 * existed: the constructor built both halves and nothing could mount them.
 *
 * The case that motivated it is `hides the Accept header input` below.
 * `AcceptHeaderInput.hide()` sets a flag that `ApiOptions.appendTo()` reads
 * (`ApiOptions.js:1149`), so it is only meaningful between construction and
 * the append — a window `mountInto()` does not have.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import CalendarViewer from '../MetaComponents/CalendarViewer.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

/**
 * An EMPTY `litcal` with a non-empty `messages`. `WebCalendar`'s
 * `calendarFetched` listener throws on this (see `WebCalendar.js`), which is
 * exactly what the listener-ordering test needs: the messages renderer must
 * have run before that throw aborts `EventEmitter.emit()`'s synchronous
 * `forEach`.
 */
const EMPTY_WITH_MESSAGES = {
    litcal: [],
    settings: {},
    metadata: {},
    messages: ['First message', 'Second message'],
};

/**
 * One real `litcal` entry alongside the same two messages, shaped like
 * `CalendarViewer.test.js`'s own `NON_EMPTY_CALENDAR_DATA`. Unlike
 * `EMPTY_WITH_MESSAGES`, `WebCalendar`'s `calendarFetched` listener does not
 * throw on this payload, so the promise `fetch()` hands back actually
 * resolves — needed by the tests below that assert on that promise's
 * resolution, or on a callback registered AFTER `listenTo()` (and therefore
 * after `WebCalendar`'s own listener on the same event bus): with an empty
 * `litcal`, `WebCalendar`'s throw would abort `EventEmitter.emit()`'s
 * synchronous `forEach` before such a late-registered callback ever ran.
 */
const NON_EMPTY_WITH_MESSAGES = {
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
    messages: ['First message', 'Second message'],
};

const respondWith = (payload) => {
    global.fetch = jest.fn(() =>
        Promise.resolve({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: () => Promise.resolve(payload),
        }),
    );
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

describe('CalendarViewer — the constructor path', () => {
    it('mounts both halves through appendTo()', () => {
        const viewer = new CalendarViewer({ locale: 'en' });
        viewer.appendTo({ controls: '#controls', calendar: '#calendar' });
        expect(
            document.querySelectorAll('#controls select').length,
        ).toBeGreaterThanOrEqual(2);
    });

    it('returns undefined from appendTo(), per the library-wide contract', () => {
        const viewer = new CalendarViewer({ locale: 'en' });
        expect(
            viewer.appendTo({ controls: '#controls', calendar: '#calendar' }),
        ).toBeUndefined();
    });

    it('hides the Accept header input when hide() runs before appendTo()', () => {
        const viewer = new CalendarViewer({ locale: 'en' });
        viewer.controls.apiOptions._acceptHeaderInput.hide();
        viewer.appendTo({ controls: '#controls', calendar: '#calendar' });

        const acceptHeaderElement =
            viewer.controls.apiOptions._acceptHeaderInput._domElement;
        expect(
            document.getElementById('controls').contains(acceptHeaderElement),
        ).toBe(false);
    });

    it('mounts the Accept header input when hide() is not called', () => {
        const viewer = new CalendarViewer({ locale: 'en' });
        viewer.appendTo({ controls: '#controls', calendar: '#calendar' });

        const acceptHeaderElement =
            viewer.controls.apiOptions._acceptHeaderInput._domElement;
        expect(
            document.getElementById('controls').contains(acceptHeaderElement),
        ).toBe(true);
    });

    it('renders messages before WebCalendar throws on an empty litcal', async () => {
        respondWith(EMPTY_WITH_MESSAGES);
        const apiClient = await ApiClient.init(API_URL);
        const viewer = new CalendarViewer({ locale: 'en' });
        viewer.appendTo({
            controls: '#controls',
            calendar: '#calendar',
            messages: '#messages',
        });
        viewer.listenTo(apiClient);
        // `viewer.controls.fetch()` and not `viewer.fetch()`: the delegate
        // arrives in Task 7, and this test must pass at the end of Task 6.
        // Task 7 adds `fetch()`'s own coverage; this line stays as it is.
        await viewer.controls.fetch().catch(() => {});

        const rows = document.querySelectorAll('#messages tr');
        expect(rows.length).toBe(2);
        expect(rows[0].textContent).toContain('First message');
    });

    it('returns this from listenTo(), for chaining', async () => {
        respondWith(EMPTY_WITH_MESSAGES);
        const apiClient = await ApiClient.init(API_URL);
        const viewer = new CalendarViewer({ locale: 'en' });
        viewer.appendTo({ controls: '#controls', calendar: '#calendar' });
        expect(viewer.listenTo(apiClient)).toBe(viewer);
    });

    it('rejects an unknown slot name, naming it', () => {
        const viewer = new CalendarViewer({ locale: 'en' });
        expect(() =>
            viewer.appendTo({
                controls: '#controls',
                calender: '#calendar',
            }),
        ).toThrow(/unknown slot name\(s\): calender/);
    });

    it('rejects slots missing controls or calendar', () => {
        const viewer = new CalendarViewer({ locale: 'en' });
        expect(() => viewer.appendTo({ calendar: '#calendar' })).toThrow(
            /must name a 'controls' target/,
        );
        expect(() => viewer.appendTo({ controls: '#controls' })).toThrow(
            /must name a 'calendar' target/,
        );
    });

    it('rejects a non-object slots argument', () => {
        const viewer = new CalendarViewer({ locale: 'en' });
        expect(() => viewer.appendTo('#controls')).toThrow(
            /slots must be an object naming/,
        );
    });

    it('mounts nothing when the calendar target is unusable', () => {
        const viewer = new CalendarViewer({ locale: 'en' });
        expect(() =>
            viewer.appendTo({
                controls: '#controls',
                calendar: '#nonexistent',
            }),
        ).toThrow(/Element not found for the calendar slot/);
        expect(document.querySelectorAll('#controls select').length).toBe(0);
    });

    it('is callable twice, moving the children rather than copying them', () => {
        const second = document.createElement('div');
        second.id = 'controls2';
        document.body.appendChild(second);

        const viewer = new CalendarViewer({ locale: 'en' });
        viewer.appendTo({ controls: '#controls', calendar: '#calendar' });
        const firstCount = document.querySelectorAll('#controls select').length;
        viewer.appendTo({ controls: '#controls2', calendar: '#calendar' });

        expect(document.querySelectorAll('#controls select').length).toBe(0);
        expect(document.querySelectorAll('#controls2 select').length).toBe(
            firstCount,
        );
    });

    it('fetch() hands its promise to the caller', async () => {
        respondWith(NON_EMPTY_WITH_MESSAGES);
        const apiClient = await ApiClient.init(API_URL);
        const viewer = new CalendarViewer({ locale: 'en' });
        viewer.appendTo({ controls: '#controls', calendar: '#calendar' });
        viewer.listenTo(apiClient);
        await expect(viewer.fetch()).resolves.toBeDefined();
    });

    it('fetch() throws when no client is wired', () => {
        const viewer = new CalendarViewer({ locale: 'en' });
        viewer.appendTo({ controls: '#controls', calendar: '#calendar' });
        expect(() => viewer.fetch()).toThrow(/no ApiClient is wired/);
    });

    it('onError() and onCalendarFetched() return this', async () => {
        respondWith(EMPTY_WITH_MESSAGES);
        const apiClient = await ApiClient.init(API_URL);
        const viewer = new CalendarViewer({ locale: 'en' });
        viewer.appendTo({ controls: '#controls', calendar: '#calendar' });
        viewer.listenTo(apiClient);
        expect(viewer.onError(() => {})).toBe(viewer);
        expect(viewer.onCalendarFetched(() => {})).toBe(viewer);
    });

    it('onCalendarFetched() receives the fetched data', async () => {
        respondWith(NON_EMPTY_WITH_MESSAGES);
        const apiClient = await ApiClient.init(API_URL);
        const viewer = new CalendarViewer({ locale: 'en' });
        viewer.appendTo({ controls: '#controls', calendar: '#calendar' });
        viewer.onCalendarFetched(() => {});
        viewer.listenTo(apiClient);

        const seen = [];
        viewer.onCalendarFetched((data) => seen.push(data));
        await viewer.fetch().catch(() => {});
        expect(seen.length).toBe(1);
        expect(seen[0].messages).toEqual(['First message', 'Second message']);
    });

    it('throws from every public member once disposed', async () => {
        respondWith(EMPTY_WITH_MESSAGES);
        const apiClient = await ApiClient.init(API_URL);
        const viewer = new CalendarViewer({ locale: 'en' });
        viewer.appendTo({ controls: '#controls', calendar: '#calendar' });
        viewer.listenTo(apiClient);
        viewer.dispose();

        const disposed = /has been disposed/;
        expect(() => viewer.controls).toThrow(disposed);
        expect(() => viewer.webCalendar).toThrow(disposed);
        expect(() =>
            viewer.appendTo({ controls: '#controls', calendar: '#calendar' }),
        ).toThrow(disposed);
        expect(() => viewer.listenTo(apiClient)).toThrow(disposed);
        expect(() => viewer.fetch()).toThrow(disposed);
        expect(() => viewer.onError(() => {})).toThrow(disposed);
        expect(() => viewer.onCalendarFetched(() => {})).toThrow(disposed);
    });

    it('dispose() is idempotent', () => {
        const viewer = new CalendarViewer({ locale: 'en' });
        viewer.appendTo({ controls: '#controls', calendar: '#calendar' });
        viewer.dispose();
        expect(() => viewer.dispose()).not.toThrow();
    });
});

/**
 * `mountInto()`'s two cancellation checks and their ordering relative to slot
 * validation — the regression this describe block exists to guard. `#targetElement()`
 * returns whichever of `controls`/`calendar` it finds an `HTMLElement` for,
 * preferring `controls`, so a CONNECTED `controls` paired with a DISCONNECTED
 * `calendar` is invisible to the first cancellation check alone; only the
 * SECOND check, made after `calendar` is resolved, catches it. Slot validation
 * must run before EITHER check, so an invalid `slots` still rejects even on an
 * already-cancelled mount.
 */
describe('CalendarViewer.mountInto — cancellation and slot validation ordering', () => {
    it('resolves to null and mounts nothing when a connected controls target pairs with a disconnected calendar target', async () => {
        const connectedControls = document.getElementById('controls');
        // Deliberately never appended to the document.
        const disconnectedCalendar = document.createElement('div');

        const viewer = await CalendarViewer.mountInto(
            { controls: connectedControls, calendar: disconnectedCalendar },
            { locale: 'en' },
        );

        expect(viewer).toBeNull();
        expect(connectedControls.children.length).toBe(0);
    });

    it('rejects invalid slots even when the signal is already aborted', async () => {
        const controller = new AbortController();
        controller.abort();

        await expect(
            CalendarViewer.mountInto('not-an-object', {
                locale: 'en',
                signal: controller.signal,
            }),
        ).rejects.toThrow(/slots must be an object naming/);
    });

    it('resolves to null when the signal is already aborted, with valid slots', async () => {
        const controller = new AbortController();
        controller.abort();

        const viewer = await CalendarViewer.mountInto(
            { controls: '#controls', calendar: '#calendar' },
            { locale: 'en', signal: controller.signal },
        );

        expect(viewer).toBeNull();
    });
});
