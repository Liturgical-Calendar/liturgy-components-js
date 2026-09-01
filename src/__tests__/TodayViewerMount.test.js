/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import TodayViewer from '../MetaComponents/TodayViewer.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

/**
 * Records every URL requested, answering each with a well-formed calendar
 * payload carrying one event. `LiturgyOfTheDay.listenTo()` throws on an EMPTY
 * `litcal[]` (it only checks the payload is non-empty before filtering to
 * today's date, so the event's own date is irrelevant here), which would
 * otherwise turn every "successful" mount in this file into a rejected
 * `viewer.fetch()` and an unwanted `console.error`. Copied from
 * `DayViewerMount.test.js`'s identical helper.
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

describe('TodayViewer.mountInto', () => {
    it('resolves to a mounted, wired viewer and performs the initial fetch', async () => {
        const urls = captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const viewer = await TodayViewer.mountInto('#single', {
            locale: 'en',
            apiClient,
        });
        expect(viewer).toBeInstanceOf(TodayViewer);
        expect(urls.some((url) => url.includes('/calendar'))).toBe(true);
    });

    it('resolves to a mounted viewer with a slots object', async () => {
        captureRequests();
        document.body.innerHTML = `
            <div id="rite"></div>
            <div id="calendar"></div>
            <div id="locale"></div>
            <div id="liturgy"></div>
        `;
        const apiClient = await ApiClient.init(API_URL);
        const viewer = await TodayViewer.mountInto(
            {
                rite: '#rite',
                calendar: '#calendar',
                locale: '#locale',
                liturgy: '#liturgy',
            },
            { locale: 'en', apiClient },
        );
        expect(viewer).toBeInstanceOf(TodayViewer);
        expect(document.querySelector('#calendar select')).not.toBeNull();
        expect(
            document.querySelector('#liturgy').children.length,
        ).toBeGreaterThan(0);
    });

    it('rejects an unparseable locale', async () => {
        const apiClient = await ApiClient.init(API_URL);
        await expect(
            TodayViewer.mountInto('#single', {
                locale: 'not a locale',
                apiClient,
            }),
        ).rejects.toThrow(/TodayViewer/);
    });

    it('rejects a missing slot target naming mountInto, not appendTo', async () => {
        await expect(
            TodayViewer.mountInto('#nope', { locale: 'en' }),
        ).rejects.toThrow(/TodayViewer\.mountInto: Element not found/);
    });

    it('reports a failed initial fetch through onError rather than console, and still mounts', async () => {
        global.fetch = jest.fn(() => Promise.reject(new Error('network down')));
        const apiClient = await ApiClient.init(API_URL).catch(() => null);
        const seen = [];
        const viewer = new TodayViewer({ locale: 'en' });
        viewer.appendTo('#single');
        viewer.onError((error) => seen.push(error));
        viewer.listenTo(apiClient);
        await expect(viewer.fetch()).rejects.toThrow();

        expect(seen.length).toBeGreaterThan(0);
        // The component is still a working, mounted viewer despite the failure.
        expect(document.querySelector('#single select')).not.toBeNull();
    });

    it('mountInto() routes a failed initial fetch to a registered onError without logging to console', async () => {
        global.fetch = jest.fn(() => Promise.reject(new Error('network down')));
        const apiClient = await ApiClient.init(API_URL).catch(() => null);
        const errorSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        const seen = [];

        const viewer = await TodayViewer.mountInto('#single', {
            locale: 'en',
            apiClient,
            onError: (error) => seen.push(error),
        });
        await viewer.settled;

        expect(viewer).toBeInstanceOf(TodayViewer);
        expect(seen.length).toBeGreaterThan(0);
        expect(errorSpy).not.toHaveBeenCalled();
        errorSpy.mockRestore();
    });

    it('mountInto() falls back to console.error when no onError callback is registered', async () => {
        global.fetch = jest.fn(() => Promise.reject(new Error('network down')));
        const apiClient = await ApiClient.init(API_URL).catch(() => null);
        const errorSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        const viewer = await TodayViewer.mountInto('#single', {
            locale: 'en',
            apiClient,
        });
        await viewer.settled;

        expect(viewer).toBeInstanceOf(TodayViewer);
        expect(errorSpy).toHaveBeenCalled();
        errorSpy.mockRestore();
    });

    it('settled resolves once the initial fetch has finished', async () => {
        captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const viewer = await TodayViewer.mountInto('#single', {
            locale: 'en',
            apiClient,
        });
        await expect(viewer.settled).resolves.toBeUndefined();
    });

    it('does not mount when the signal is already aborted', async () => {
        const apiClient = await ApiClient.init(API_URL);
        const controller = new AbortController();
        controller.abort();
        const viewer = await TodayViewer.mountInto('#single', {
            locale: 'en',
            apiClient,
            signal: controller.signal,
        });
        expect(viewer).toBeNull();
        expect(document.querySelector('#single select')).toBeNull();
    });
});

describe('TodayViewer.onCalendarFetched', () => {
    it('receives the fetched payload', async () => {
        captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const viewer = new TodayViewer({ locale: 'en' });
        viewer.appendTo('#single');
        const seen = [];
        viewer.onCalendarFetched((data) => seen.push(data));
        viewer.listenTo(apiClient);
        await viewer.fetch();
        expect(seen.length).toBeGreaterThan(0);
        expect(seen[0]).toHaveProperty('litcal');
    });
});

describe('TodayViewer.dispose', () => {
    it('unsubscribes its onError callback from the event bus', async () => {
        captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const viewer = await TodayViewer.mountInto('#single', {
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
        const viewer = await TodayViewer.mountInto('#single', {
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
        const viewer = await TodayViewer.mountInto('#single', {
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
        const viewer = await TodayViewer.mountInto('#single', {
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
        expect(() => viewer.onCalendarFetched(() => {})).toThrow(/disposed/);
        expect(() => viewer.fetch()).toThrow(/disposed/);
    });
});
