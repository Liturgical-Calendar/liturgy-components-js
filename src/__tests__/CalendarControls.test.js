/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import CalendarControls from '../MetaComponents/CalendarControls.js';
import { ApiOptionsFilter } from '../Enums.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

/**
 * Records every URL requested, answering each with an empty but well-formed
 * calendar payload. Assertions are about which path was requested, never about
 * the response.
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
    document.body.replaceChildren();
    const mount = document.createElement('div');
    mount.id = 'mount';
    document.body.appendChild(mount);
});

describe('CalendarControls construction', () => {
    it('builds all three children', () => {
        const controls = new CalendarControls({ locale: 'en' });
        expect(controls.riteSelect).not.toBeNull();
        expect(controls.calendarSelect).not.toBeNull();
        expect(controls.apiOptions).not.toBeNull();
    });

    it('rejects an unparseable locale, naming this component', () => {
        expect(() => new CalendarControls({ locale: 'not a locale' })).toThrow(
            /CalendarControls/,
        );
    });

    it('rejects a malformed theme, naming this component', () => {
        expect(
            () => new CalendarControls({ locale: 'en', theme: 'form-select' }),
        ).toThrow(/CalendarControls.*theme/);
    });

    it('applies the theme to the children', () => {
        const controls = new CalendarControls({
            locale: 'en',
            theme: {
                select: 'form-select',
                riteSelect: { class: 'form-select mb-2' },
            },
        });
        controls.appendTo('#mount');
        expect(controls.riteSelect._domElement.className).toBe(
            'form-select mb-2',
        );
        expect(controls.calendarSelect._domElement.className).toBe(
            'form-select',
        );
    });
});

describe('CalendarControls mounting', () => {
    it('mounts the rite select before the calendar select', () => {
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#mount');
        const selects = document.querySelectorAll('#mount select');
        expect(selects[0]).toBe(controls.riteSelect._domElement);
    });

    it('returns undefined from appendTo', () => {
        const controls = new CalendarControls({ locale: 'en' });
        expect(controls.appendTo('#mount')).toBeUndefined();
    });

    it('throws when the target matches nothing, naming this component', () => {
        const controls = new CalendarControls({ locale: 'en' });
        expect(() => controls.appendTo('#nope')).toThrow(
            /CalendarControls.*nope/,
        );
    });

    it('is callable more than once without duplicating children', () => {
        const other = document.createElement('div');
        other.id = 'other';
        document.body.appendChild(other);
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#mount');
        controls.appendTo('#other');
        expect(document.querySelectorAll('#mount select').length).toBe(0);
        expect(
            document.querySelectorAll('#other select').length,
        ).toBeGreaterThanOrEqual(2);
    });
});

describe('CalendarControls rite wiring', () => {
    // The regression this whole family exists to prevent. Wire only
    // linkToRiteSelect() and the form reads `ambrosian` while every request
    // still goes to /calendar/roman/.
    it('requests the ambrosian path after a rite change', async () => {
        const urls = captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#mount');
        controls.listenTo(apiClient);

        controls.riteSelect._domElement.value = 'ambrosian';
        controls.riteSelect._domElement.dispatchEvent(
            new Event('change', { bubbles: true }),
        );
        await new Promise((resolve) => setTimeout(resolve, 0));

        const calendarRequests = urls.filter((u) => u.includes('/calendar'));
        expect(calendarRequests.length).toBeGreaterThan(0);
        expect(calendarRequests.at(-1)).toContain('/calendar/ambrosian');
        expect(calendarRequests.at(-1)).not.toContain('/calendar/roman');
    });

    it('is chainable', async () => {
        captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#mount');
        expect(controls.listenTo(apiClient)).toBe(controls);
    });

    it('refuses to rebind to a second client, naming this component', async () => {
        captureRequests();
        const first = await ApiClient.init(API_URL);
        const second = await ApiClient.init(API_URL);
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#mount');
        controls.listenTo(first);
        expect(() => controls.listenTo(second)).toThrow(
            /CalendarControls.*already wired/,
        );
    });

    it('honours the filter option', () => {
        const controls = new CalendarControls({
            locale: 'en',
            filter: ApiOptionsFilter.LOCALE_ONLY,
        });
        controls.appendTo('#mount');
        expect(controls.apiOptions._localeInput).not.toBeNull();
    });
});
