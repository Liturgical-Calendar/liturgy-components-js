/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import DayViewer from '../MetaComponents/DayViewer.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

/**
 * Records every URL requested, answering each with a well-formed calendar
 * payload carrying one event. The assertions are about which path was
 * requested, never about the response — but `LiturgyOfAnyDay.listenTo()`
 * throws on an EMPTY `litcal[]` (see `LiturgyOfAnyDay.test.js`), which would
 * otherwise turn every "successful" mount in this file into a rejected
 * `viewer.fetch()` and an unwanted `console.error`. Copied from
 * `DayViewerWiring.test.js` rather than imported across test files, and
 * extended with one event for the reason above.
 *
 * @returns {string[]} The live list of requested URLs.
 */
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
                    litcal: [
                        {
                            event_key: 'StJohnVianney',
                            event_idx: 1,
                            name: 'Saint John Mary Vianney, Priest',
                            color: ['white'],
                            color_lcl: ['white'],
                            grade: 3,
                            grade_lcl: 'Memorial',
                            grade_abbr: 'M',
                            grade_display: null,
                            common: ['Pastors'],
                            common_lcl: 'Pastors',
                            type: 'fixed',
                            date: '2026-06-15T00:00:00+00:00',
                            year: 2026,
                            month: 6,
                            month_short: 'Jun.',
                            month_long: 'June',
                            day: 15,
                            day_of_the_week_iso8601: 1,
                            day_of_the_week_short: 'Mon',
                            day_of_the_week_long: 'Monday',
                            liturgical_year: null,
                            is_vigil_mass: false,
                            psalter_week: 2,
                            liturgical_season: 'ORDINARY_TIME',
                            liturgical_season_lcl: 'Ordinary Time',
                            holy_day_of_obligation: false,
                        },
                    ],
                    settings: { year: 2026, locale: 'en', year_type: 'CIVIL' },
                    metadata: { version: 'test' },
                    messages: [],
                }),
        });
    });
    return urls;
};

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.innerHTML = '<div id="single"></div>';
});

describe('DayViewer.mountInto', () => {
    it('resolves to a mounted, wired viewer and performs the initial fetch', async () => {
        const urls = captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const viewer = await DayViewer.mountInto('#single', {
            locale: 'en',
            apiClient,
        });
        expect(viewer).toBeInstanceOf(DayViewer);
        expect(urls.some((url) => url.includes('/calendar'))).toBe(true);
    });

    it('rejects an unparseable locale', async () => {
        const apiClient = await ApiClient.init(API_URL);
        await expect(
            DayViewer.mountInto('#single', {
                locale: 'not a locale',
                apiClient,
            }),
        ).rejects.toThrow(/DayViewer/);
    });

    // M3: `#requireElement`'s thrown message must name the method the CALLER
    // actually used. `appendTo()` is invoked internally by `mountInto()`, so a bad
    // target reported here must say `mountInto`, not `appendTo` — which the caller
    // never called and would have no idea to look for.
    it('rejects a missing slot target naming mountInto, not appendTo', async () => {
        await expect(
            DayViewer.mountInto('#nope', { locale: 'en' }),
        ).rejects.toThrow(/DayViewer\.mountInto: Element not found/);
    });

    it('reports a failed initial fetch through onError rather than console', async () => {
        global.fetch = jest.fn(() => Promise.reject(new Error('network down')));
        const apiClient = await ApiClient.init(API_URL).catch(() => null);
        // The base is already loaded from the fixture, so init succeeded; only the
        // calendar fetch fails.
        const seen = [];
        const viewer = new DayViewer({ locale: 'en' });
        viewer.appendTo('#single');
        viewer.onError((error) => seen.push(error));
        viewer.listenTo(apiClient);
        await expect(viewer.fetch()).rejects.toThrow();

        expect(seen.length).toBeGreaterThan(0);
    });

    it('fires a callback registered before listenTo() exactly once', async () => {
        global.fetch = jest.fn(() => Promise.reject(new Error('network down')));
        const apiClient = await ApiClient.init(API_URL).catch(() => null);
        const seen = [];
        const viewer = new DayViewer({ locale: 'en' });
        viewer.appendTo('#single');
        // Registered BEFORE listenTo(): onError() cannot subscribe directly yet
        // because no client is wired, so listenTo() must replay it exactly once.
        viewer.onError((error) => seen.push(error));
        viewer.listenTo(apiClient);
        await expect(viewer.fetch()).rejects.toThrow();

        expect(seen.length).toBe(1);
    });

    // Finding 2 of fix round 1: the two tests above exercise onError/fetch()
    // through the MANUAL new DayViewer() + appendTo() + onError() + listenTo() +
    // fetch() sequence the brief specified, so `mountInto()`'s OWN internal
    // `viewer.fetch().catch(...)` — including its `console.error` suppression,
    // which is the entire reason `onError` exists — was never exercised at the
    // factory level. This pins it there directly.
    it('mountInto() routes a failed initial fetch to a registered onError without logging to console', async () => {
        global.fetch = jest.fn(() => Promise.reject(new Error('network down')));
        const apiClient = await ApiClient.init(API_URL).catch(() => null);
        const errorSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        const seen = [];

        const viewer = await DayViewer.mountInto('#single', {
            locale: 'en',
            apiClient,
            onError: (error) => seen.push(error),
        });
        // mountInto()'s initial fetch is fire-and-forget from the caller's side —
        // the returned promise resolves to the viewer, not to the fetch outcome.
        // `settled` is that fetch's own promise, resolving either way, so this
        // waits on the thing itself rather than on a timer assumed to outlast it.
        await viewer.settled;

        expect(viewer).toBeInstanceOf(DayViewer);
        expect(seen.length).toBeGreaterThan(0);
        expect(errorSpy).not.toHaveBeenCalled();
        errorSpy.mockRestore();
    });

    // The negative space of the test above: with no onError callback registered,
    // mountInto()'s fallback DOES log — proving the suppression above is actually
    // conditional on a registered callback, not just always-on.
    it('mountInto() falls back to console.error when no onError callback is registered', async () => {
        global.fetch = jest.fn(() => Promise.reject(new Error('network down')));
        const apiClient = await ApiClient.init(API_URL).catch(() => null);
        const errorSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        const viewer = await DayViewer.mountInto('#single', {
            locale: 'en',
            apiClient,
        });
        await viewer.settled;

        expect(viewer).toBeInstanceOf(DayViewer);
        expect(errorSpy).toHaveBeenCalled();
        errorSpy.mockRestore();
    });

    it('does not mount when the signal is already aborted', async () => {
        const apiClient = await ApiClient.init(API_URL);
        const controller = new AbortController();
        controller.abort();
        const viewer = await DayViewer.mountInto('#single', {
            locale: 'en',
            apiClient,
            signal: controller.signal,
        });
        expect(viewer).toBeNull();
        expect(document.querySelector('#single select')).toBeNull();
    });
});

describe('DayViewer.dispose', () => {
    // dispose() unsubscribes exactly what DayViewer itself subscribed via on() —
    // the calendarFetchFailed listeners onError()/listenTo() registered. It cannot
    // reach the calendarFetched listener LiturgyOfAnyDay.listenTo() attaches
    // internally: that closure is private to LiturgyOfAnyDay and never exposed to
    // DayViewer, exactly the same kind of gap as ApiClient's own unreachable DOM
    // listeners (see the dispose() JSDoc). This test therefore checks the
    // subscription DayViewer actually owns, not one it never captured.
    it('unsubscribes its onError callback from the event bus', async () => {
        captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const viewer = await DayViewer.mountInto('#single', {
            locale: 'en',
            apiClient,
        });
        viewer.onError(() => {});
        const before =
            apiClient._eventBus._events['calendarFetchFailed'].length;
        viewer.dispose();
        const after = apiClient._eventBus._events['calendarFetchFailed'].length;
        expect(after).toBeLessThan(before);
    });

    it('empties its mounts, so nothing it rendered remains visible', async () => {
        captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const viewer = await DayViewer.mountInto('#single', {
            locale: 'en',
            apiClient,
        });
        expect(
            document.getElementById('single').children.length,
        ).toBeGreaterThan(0);
        viewer.dispose();
        expect(document.getElementById('single').children.length).toBe(0);
    });

    it('is idempotent and throws on use after dispose', async () => {
        captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const viewer = await DayViewer.mountInto('#single', {
            locale: 'en',
            apiClient,
        });
        viewer.dispose();
        expect(() => viewer.dispose()).not.toThrow();
        expect(() => viewer.listenTo(apiClient)).toThrow(/disposed/);
    });

    it('throws on every getter and method after dispose, not only listenTo', async () => {
        captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const viewer = await DayViewer.mountInto('#single', {
            locale: 'en',
            apiClient,
        });
        viewer.dispose();
        expect(() => viewer.calendarSelect).toThrow(/disposed/);
        expect(() => viewer.riteSelect).toThrow(/disposed/);
        expect(() => viewer.localeInput).toThrow(/disposed/);
        expect(() => viewer.liturgy).toThrow(/disposed/);
        expect(() => viewer.selectedLocale).toThrow(/disposed/);
        expect(() => viewer.appendTo('#single')).toThrow(/disposed/);
        expect(() => viewer.onError(() => {})).toThrow(/disposed/);
        expect(() => viewer.fetch()).toThrow(/disposed/);
    });
});
