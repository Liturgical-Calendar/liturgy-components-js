/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import CalendarControls from '../MetaComponents/CalendarControls.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

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
    const mount = document.createElement('div');
    mount.id = 'mount';
    document.body.appendChild(mount);
});

describe('CalendarControls.mountInto', () => {
    it('resolves to mounted controls and performs the initial fetch', async () => {
        const urls = captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const controls = await CalendarControls.mountInto('#mount', {
            locale: 'en',
            apiClient,
        });
        expect(controls).toBeInstanceOf(CalendarControls);
        expect(urls.some((u) => u.includes('/calendar'))).toBe(true);
    });

    it('skips the initial fetch when initialFetch is false', async () => {
        const urls = captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        await CalendarControls.mountInto('#mount', {
            locale: 'en',
            apiClient,
            initialFetch: false,
        });
        expect(urls.some((u) => u.includes('/calendar/'))).toBe(false);
    });

    // I3: `mountInto()` calls `appendTo()` internally, and a bad target must
    // be reported under the name the caller actually used — `mountInto` —
    // not under `appendTo`, which the caller of `mountInto()` never called.
    it('reports a missing target naming mountInto, not appendTo', async () => {
        const apiClient = await ApiClient.init(API_URL);
        await expect(
            CalendarControls.mountInto('#nope', { locale: 'en', apiClient }),
        ).rejects.toThrow(/CalendarControls\.mountInto: Element not found/);
    });

    it('rejects an unparseable locale', async () => {
        const apiClient = await ApiClient.init(API_URL);
        await expect(
            CalendarControls.mountInto('#mount', {
                locale: 'not a locale',
                apiClient,
            }),
        ).rejects.toThrow(/CalendarControls/);
    });

    it('rejects when the metadata cannot be loaded', async () => {
        ApiBase.reset();
        await expect(
            CalendarControls.mountInto('#mount', { locale: 'en' }),
        ).rejects.toThrow();
    });

    it('resolves to null when the signal is already aborted', async () => {
        const controller = new AbortController();
        controller.abort();
        const apiClient = await ApiClient.init(API_URL);
        const controls = await CalendarControls.mountInto('#mount', {
            locale: 'en',
            apiClient,
            signal: controller.signal,
        });
        expect(controls).toBeNull();
    });

    it('does not produce an unhandled rejection when the initial fetch fails, and reaches onError', async () => {
        const apiClient = await ApiClient.init(API_URL);
        global.fetch = jest.fn(() => Promise.reject(new Error('network down')));
        const seen = [];
        const controls = await CalendarControls.mountInto('#mount', {
            locale: 'en',
            apiClient,
            onError: (error) => seen.push(error),
        });
        expect(controls).toBeInstanceOf(CalendarControls);
        // Give the dropped initial-fetch promise a turn to settle and reach onError.
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(seen.length).toBeGreaterThan(0);
    });
});

describe('CalendarControls.dispose', () => {
    // dispose() unsubscribes exactly what CalendarControls itself subscribed via
    // #subscribe() — nothing is registered on 'calendarFetched' by mountInto()'s
    // default flow alone (no messages slot was named, and nothing called
    // onCalendarFetched()), so this registers one explicitly first. Mirrors
    // DayViewerMount.test.js's own "unsubscribes its onError callback" test,
    // which needs the same explicit registration for the same reason.
    it('stops the viewer reacting to further client events', async () => {
        captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const controls = await CalendarControls.mountInto('#mount', {
            locale: 'en',
            apiClient,
        });
        controls.onCalendarFetched(() => {});
        const before = apiClient._eventBus._events['calendarFetched'].length;
        controls.dispose();
        const after = apiClient._eventBus._events['calendarFetched'].length;
        expect(after).toBeLessThan(before);
    });

    it('is idempotent and throws on use after dispose', async () => {
        captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const controls = await CalendarControls.mountInto('#mount', {
            locale: 'en',
            apiClient,
        });
        controls.dispose();
        expect(() => controls.dispose()).not.toThrow();
        expect(() => controls.riteSelect).toThrow(/disposed/);
        expect(() => controls.listenTo(apiClient)).toThrow(/disposed/);
    });

    it('empties the mount', async () => {
        captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const controls = await CalendarControls.mountInto('#mount', {
            locale: 'en',
            apiClient,
        });
        controls.dispose();
        expect(document.getElementById('mount').children.length).toBe(0);
    });
});
