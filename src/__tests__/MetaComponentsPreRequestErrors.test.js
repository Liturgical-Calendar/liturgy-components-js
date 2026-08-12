/** @jest-environment jsdom */
/**
 * Issue #43, second defect: a failure raised BEFORE the request goes out — an
 * unserviceable rite, an unusable locale — emits no `calendarFetchFailed`, by
 * `ApiClient`'s own deliberate design. `onError()` callbacks subscribe to exactly
 * that event, so they never fired for it; and `DayViewer.mountInto()` skipped its
 * console fallback whenever a callback was registered, on the assumption that the
 * callback would handle it.
 *
 * The three combined into total silence, and made passing `onError()` strictly
 * WORSE than omitting it: omit it and at least the console line appeared.
 *
 * These tests pin both halves of the contract — the callback fires, and nothing is
 * reported twice.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import DayViewer from '../MetaComponents/DayViewer.js';
import CalendarControls from '../MetaComponents/CalendarControls.js';
import CalendarViewer from '../MetaComponents/CalendarViewer.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

const DAY_VIEWER_SLOTS = {
    rite: '#rite',
    calendar: '#cal',
    locale: '#loc',
    liturgy: '#lit',
};

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.replaceChildren();
    for (const id of ['rite', 'cal', 'loc', 'lit', 'mount']) {
        const el = document.createElement('div');
        el.id = id;
        document.body.appendChild(el);
    }
    global.fetch = jest.fn(() =>
        Promise.resolve({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: () => Promise.resolve({ litcal: [] }),
        }),
    );
});

/**
 * Makes every fetch method reject BEFORE issuing a request, which is the shape
 * `ApiClient` documents as emitting no `calendarFetchFailed`.
 *
 * @param {ApiClient} apiClient - The client to sabotage.
 * @returns {void}
 */
const failBeforeRequest = (apiClient) => {
    const reject = () => Promise.reject(new Error('pre-request failure'));
    apiClient.fetchCalendar = reject;
    apiClient.fetchNationalCalendar = reject;
    apiClient.fetchDiocesanCalendar = reject;
};

describe('DayViewer: a pre-request failure with onError registered', () => {
    it('reaches the onError callback', async () => {
        const apiClient = await ApiClient.init(API_URL);
        failBeforeRequest(apiClient);
        const seen = [];
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await DayViewer.mountInto(DAY_VIEWER_SLOTS, {
            locale: 'en',
            apiClient,
            onError: (error) => seen.push(error),
        });
        await new Promise((resolve) => setTimeout(resolve, 10));
        spy.mockRestore();

        expect(seen.length).toBe(1);
        expect(seen[0].message).toBe('pre-request failure');
    });

    it('does not also log when a callback handled it', async () => {
        const apiClient = await ApiClient.init(API_URL);
        failBeforeRequest(apiClient);
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await DayViewer.mountInto(DAY_VIEWER_SLOTS, {
            locale: 'en',
            apiClient,
            onError: () => {},
        });
        await new Promise((resolve) => setTimeout(resolve, 10));
        const logged = spy.mock.calls.length;
        spy.mockRestore();

        expect(logged).toBe(0);
    });

    it('still logs when no callback was registered', async () => {
        const apiClient = await ApiClient.init(API_URL);
        failBeforeRequest(apiClient);
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await DayViewer.mountInto(DAY_VIEWER_SLOTS, {
            locale: 'en',
            apiClient,
        });
        await new Promise((resolve) => setTimeout(resolve, 10));
        const logged = spy.mock.calls.length;
        spy.mockRestore();

        expect(logged).toBeGreaterThan(0);
    });
});

describe('CalendarControls: a pre-request failure with onError registered', () => {
    it('reaches the onError callback', async () => {
        const apiClient = await ApiClient.init(API_URL);
        failBeforeRequest(apiClient);
        const seen = [];
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await CalendarControls.mountInto('#mount', {
            locale: 'en',
            apiClient,
            onError: (error) => seen.push(error),
        });
        await new Promise((resolve) => setTimeout(resolve, 10));
        spy.mockRestore();

        expect(seen.length).toBe(1);
        expect(seen[0].message).toBe('pre-request failure');
    });

    it('does not also log when a callback handled it', async () => {
        const apiClient = await ApiClient.init(API_URL);
        failBeforeRequest(apiClient);
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await CalendarControls.mountInto('#mount', {
            locale: 'en',
            apiClient,
            onError: () => {},
        });
        await new Promise((resolve) => setTimeout(resolve, 10));
        const logged = spy.mock.calls.length;
        spy.mockRestore();

        expect(logged).toBe(0);
    });

    it('still logs when no callback was registered', async () => {
        const apiClient = await ApiClient.init(API_URL);
        failBeforeRequest(apiClient);
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await CalendarControls.mountInto('#mount', { locale: 'en', apiClient });
        await new Promise((resolve) => setTimeout(resolve, 10));
        const logged = spy.mock.calls.length;
        spy.mockRestore();

        expect(logged).toBeGreaterThan(0);
    });

    // A failure that DID travel the bus must not be delivered twice.
    it('delivers a request failure exactly once', async () => {
        const apiClient = await ApiClient.init(API_URL);
        const seen = [];
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        global.fetch = jest.fn(() => Promise.reject(new Error('network down')));

        await CalendarControls.mountInto('#mount', {
            locale: 'en',
            apiClient,
            onError: (error) => seen.push(error),
        });
        await new Promise((resolve) => setTimeout(resolve, 10));
        spy.mockRestore();

        expect(seen.length).toBe(1);
    });
});

/**
 * `CalendarViewer` was MISSED when #43's second defect was fixed: the fix landed on
 * `CalendarControls` and `DayViewer`, while this factory kept routing its dropped
 * initial fetch through `apiClient._discardRequest()` — the very seam that cannot
 * reach `onError()`. Its comment even claimed `CalendarControls.mountInto()` still
 * used that seam, which had stopped being true in the same commit.
 *
 * Same contract as the two above, so the same four cases.
 */
describe('CalendarViewer: a pre-request failure with onError registered', () => {
    const SLOTS = { controls: '#mount', calendar: '#cal' };

    it('reaches the onError callback', async () => {
        const apiClient = await ApiClient.init(API_URL);
        failBeforeRequest(apiClient);
        const seen = [];
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await CalendarViewer.mountInto(SLOTS, {
            locale: 'en',
            apiClient,
            onError: (error) => seen.push(error),
        });
        await new Promise((resolve) => setTimeout(resolve, 10));
        spy.mockRestore();

        expect(seen.length).toBe(1);
        expect(seen[0].message).toBe('pre-request failure');
    });

    it('does not also log when a callback handled it', async () => {
        const apiClient = await ApiClient.init(API_URL);
        failBeforeRequest(apiClient);
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await CalendarViewer.mountInto(SLOTS, {
            locale: 'en',
            apiClient,
            onError: () => {},
        });
        await new Promise((resolve) => setTimeout(resolve, 10));
        const logged = spy.mock.calls.length;
        spy.mockRestore();

        expect(logged).toBe(0);
    });

    it('still logs when no callback was registered', async () => {
        const apiClient = await ApiClient.init(API_URL);
        failBeforeRequest(apiClient);
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await CalendarViewer.mountInto(SLOTS, { locale: 'en', apiClient });
        await new Promise((resolve) => setTimeout(resolve, 10));
        const logged = spy.mock.calls.length;
        spy.mockRestore();

        expect(logged).toBeGreaterThan(0);
    });

    // A failure that DID travel the bus must not be delivered twice.
    it('delivers a request failure exactly once', async () => {
        const apiClient = await ApiClient.init(API_URL);
        const seen = [];
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        global.fetch = jest.fn(() => Promise.reject(new Error('network down')));

        await CalendarViewer.mountInto(SLOTS, {
            locale: 'en',
            apiClient,
            onError: (error) => seen.push(error),
        });
        await new Promise((resolve) => setTimeout(resolve, 10));
        spy.mockRestore();

        expect(seen.length).toBe(1);
    });
});
