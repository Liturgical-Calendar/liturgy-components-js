/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import DayViewer from '../MetaComponents/DayViewer.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

/**
 * Records every URL requested, answering each with an empty but well-formed
 * calendar payload. The assertions are about which path was requested, never
 * about the response.
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
    document.body.innerHTML = '<div id="single"></div>';
});

describe('DayViewer rite wiring', () => {
    // THE regression this phase exists to prevent. Wire only linkToRiteSelect and
    // the form reads `ambrosian` while every request still goes to /calendar/roman/.
    it('requests the ambrosian path after a rite change', async () => {
        const urls = captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const viewer = new DayViewer({ locale: 'en' });
        viewer.appendTo('#single');
        viewer.listenTo(apiClient);

        viewer.riteSelect._domElement.value = 'ambrosian';
        viewer.riteSelect._domElement.dispatchEvent(
            new Event('change', { bubbles: true }),
        );
        await new Promise((resolve) => setTimeout(resolve, 0));

        const calendarRequests = urls.filter((url) =>
            url.includes('/calendar'),
        );
        expect(calendarRequests.length).toBeGreaterThan(0);
        expect(calendarRequests.at(-1)).toContain('/calendar/ambrosian');
        expect(calendarRequests.at(-1)).not.toContain('/calendar/roman');
    });

    it('rebuilds the calendar options on a rite change', async () => {
        captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const viewer = new DayViewer({ locale: 'en' });
        viewer.appendTo('#single');
        viewer.listenTo(apiClient);

        const before = viewer.calendarSelect._domElement.innerHTML;
        viewer.riteSelect._domElement.value = 'ambrosian';
        viewer.riteSelect._domElement.dispatchEvent(
            new Event('change', { bubbles: true }),
        );
        expect(viewer.calendarSelect._domElement.innerHTML).not.toBe(before);
    });

    it('is chainable', async () => {
        captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const viewer = new DayViewer({ locale: 'en' });
        viewer.appendTo('#single');
        expect(viewer.listenTo(apiClient)).toBe(viewer);
    });
});

describe('DayViewer locale cascade', () => {
    it('prefers an exact locale match', () => {
        const viewer = new DayViewer({ locale: 'en' });
        viewer.appendTo('#single');
        expect(viewer.selectedLocale).toBe('en');
    });

    it('falls back to a language match when there is no exact one', () => {
        const viewer = new DayViewer({ locale: 'it-CH' });
        viewer.appendTo('#single');
        expect(viewer.selectedLocale.split(/[-_]/)[0]).toBe('it');
    });

    it('falls back to the first available option when neither matches', () => {
        const viewer = new DayViewer({ locale: 'ja' });
        viewer.appendTo('#single');
        expect(viewer.localeInput.options()).toContain(viewer.selectedLocale);
    });

    it('selects the cascade result in the locale input', () => {
        const viewer = new DayViewer({ locale: 'en' });
        viewer.appendTo('#single');
        expect(viewer.localeInput._domElement.value).toBe(
            viewer.selectedLocale,
        );
    });
});
