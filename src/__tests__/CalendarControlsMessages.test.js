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

    /**
     * Mounts, fetches, and hands back the messages container.
     *
     * @param {string[]} messages - The messages the API should return.
     * @returns {Promise<HTMLElement>} The `#messages` element, populated.
     */
    const renderMessages = async (messages) => {
        captureRequests(messages);
        const apiClient = await ApiClient.init(API_URL);
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo({ controls: '#mount', messages: '#messages' });
        controls.listenTo(apiClient);
        await controls.fetch();
        return document.querySelector('#messages');
    };

    // The API's messages genuinely carry markup — anchors to Vatican decrees,
    // `<i>`/`<b>` emphasis, highlighted `<span>`s. This renderer used to use
    // `textContent`, which was safe but showed the reader literal `<a href=…>`
    // tags. It now goes through `sanitizeHtml()`. The allowlist itself is
    // specified in `SanitizeHtml.test.js`; these tests prove the RENDERER is
    // wired to it, which no test of the sanitizer alone can show.
    it('renders an anchor in a message as a real link', async () => {
        const container = await renderMessages([
            'See the <a href="https://www.vatican.va/d.html" target="_blank">decree</a>.',
        ]);
        const anchor = container.querySelector('a');
        expect(anchor).not.toBeNull();
        expect(anchor.getAttribute('href')).toBe(
            'https://www.vatican.va/d.html',
        );
        expect(anchor.getAttribute('rel')).toBe('noopener noreferrer');
        expect(container.textContent).toContain('See the decree.');
    });

    it('drops an executable payload instead of rendering it', async () => {
        const container = await renderMessages([
            '<img src=x onerror=alert(1)> plain',
        ]);
        expect(container.querySelectorAll('img').length).toBe(0);
        // It is no longer shown as literal text either — that was the old
        // `textContent` behaviour, and it is what this change replaces.
        expect(container.textContent).not.toContain('<img');
        expect(container.textContent).toContain('plain');
    });

    it('neutralizes a javascript: href while keeping the link text', async () => {
        const container = await renderMessages([
            '<a href="javascript:alert(1)">Decree</a>',
        ]);
        expect(container.querySelector('a').hasAttribute('href')).toBe(false);
        expect(container.textContent).toContain('Decree');
    });

    it('leaves the index cell as plain text', async () => {
        // The index is a number this renderer generates, so it has nothing to
        // sanitize; asserted so a later refactor does not route it through the
        // parser and imply otherwise.
        const container = await renderMessages(['<b>one</b>', '<b>two</b>']);
        const firstCells = container.querySelectorAll('tr')[1].children;
        expect(firstCells[0].textContent).toBe('1');
        expect(firstCells[1].innerHTML).toBe('<b>two</b>');
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
    // Review of PR #44: `appendTo()` only ever ASSIGNED `#messagesMount`, never
    // cleared it, so re-mounting to a target that omits `messages` left the
    // permanent renderer subscription writing into a container the caller had
    // stopped naming. Only `dispose()` ever emptied it.
    it('stops rendering into the previous mount when remounted without the slot', async () => {
        captureRequests(['a message']);
        const apiClient = await ApiClient.init(API_URL);
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo({ controls: '#mount', messages: '#messages' });
        controls.listenTo(apiClient);
        await controls.fetch();
        expect(document.querySelectorAll('#messages tr').length).toBe(1);

        controls.appendTo('#mount');
        ApiClient.clearCache();
        await controls.fetch();
        expect(document.querySelectorAll('#messages tr').length).toBe(0);
    });
});
