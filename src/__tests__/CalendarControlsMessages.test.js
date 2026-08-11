/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import CalendarControls from '../MetaComponents/CalendarControls.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

/**
 * @param {string[]} messages - The messages the API should return.
 * @returns {string[]} The live list of requested URLs.
 */
const captureRequests = (messages) => {
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
                    messages,
                }),
        });
    });
    return urls;
};

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.replaceChildren();
    for (const id of ['mount', 'messages']) {
        const el = document.createElement('div');
        el.id = id;
        document.body.appendChild(el);
    }
});

describe('CalendarControls messages slot', () => {
    it('renders one row per message when the slot is named', async () => {
        captureRequests(['first', 'second']);
        const apiClient = await ApiClient.init(API_URL);
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo({ controls: '#mount', messages: '#messages' });
        controls.listenTo(apiClient);
        await controls.fetch();

        const rows = document.querySelectorAll('#messages tr');
        expect(rows.length).toBe(2);
        expect(rows[0].textContent).toContain('first');
    });

    it('renders nothing when the slot is omitted', async () => {
        captureRequests(['first']);
        const apiClient = await ApiClient.init(API_URL);
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#mount');
        controls.listenTo(apiClient);
        await controls.fetch();
        expect(document.querySelectorAll('#messages tr').length).toBe(0);
    });

    // Both examples build these rows with innerHTML from API-supplied strings.
    it('renders a message containing markup as text, not as elements', async () => {
        captureRequests(['<img src=x onerror=alert(1)> plain']);
        const apiClient = await ApiClient.init(API_URL);
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo({ controls: '#mount', messages: '#messages' });
        controls.listenTo(apiClient);
        await controls.fetch();

        expect(document.querySelectorAll('#messages img').length).toBe(0);
        expect(document.querySelector('#messages').textContent).toContain(
            '<img',
        );
    });

    it('replaces earlier messages rather than appending on a refetch', async () => {
        captureRequests(['first', 'second']);
        const apiClient = await ApiClient.init(API_URL);
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo({ controls: '#mount', messages: '#messages' });
        controls.listenTo(apiClient);
        await controls.fetch();
        captureRequests(['only']);
        // Without this, the second fetch() call has identical parameters to the
        // first (same locale, year, yearType, rite, mobile-feast settings), so
        // ApiClient's cache — keyed on those parameters, not on response content
        // — answers it from the first response instead of re-fetching. See
        // ApiClient's caching section in CLAUDE.md.
        ApiClient.clearCache();
        await controls.fetch();

        const rows = document.querySelectorAll('#messages tr');
        expect(rows.length).toBe(1);
        expect(rows[0].textContent).toContain('only');
    });
});
