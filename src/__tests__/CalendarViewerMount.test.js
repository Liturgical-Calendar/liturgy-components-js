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
});
