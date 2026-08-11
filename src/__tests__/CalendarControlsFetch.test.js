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
                    messages: ['first message'],
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

/**
 * @param {string} value - The value to select in the calendar select.
 * @returns {Promise<{controls: CalendarControls, urls: string[]}>} Wired controls.
 */
const wiredWith = async (value) => {
    const urls = captureRequests();
    const apiClient = await ApiClient.init(API_URL);
    const controls = new CalendarControls({ locale: 'en' });
    controls.appendTo('#mount');
    // listenTo() performs the (first-time) rite/calendar-select link, and
    // CalendarSelect#applyLinkedRite unconditionally resets the select's value
    // to '' as part of that linkage — so the value must be set AFTER wiring,
    // not before, or it is silently discarded.
    controls.listenTo(apiClient);
    controls.calendarSelect._domElement.value = value;
    return { controls, urls };
};

describe('CalendarControls initial fetch dispatch', () => {
    // An empty value means the General Roman Calendar, not a nation.
    it('uses the general path for an empty selection', async () => {
        const { controls, urls } = await wiredWith('');
        await controls.fetch();
        const last = urls.filter((u) => u.includes('/calendar')).at(-1);
        expect(last).not.toMatch(/\/calendar\/(nation|diocese)\//);
    });

    it('uses the nation path for a national calendar', async () => {
        const { controls, urls } = await wiredWith('IT');
        await controls.fetch();
        const last = urls.filter((u) => u.includes('/calendar')).at(-1);
        expect(last).toContain('/nation/IT');
    });

    // fullcalendar/script.js only handles empty-vs-national, so a diocesan
    // selection there calls fetchNationalCalendar() with a diocese id.
    it('uses the diocese path for a diocesan calendar', async () => {
        const { controls, urls } = await wiredWith('romamo_it');
        await controls.fetch();
        const last = urls.filter((u) => u.includes('/calendar')).at(-1);
        expect(last).toContain('/diocese/romamo_it');
        expect(last).not.toContain('/nation/');
    });

    it('throws when no client is wired', () => {
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#mount');
        expect(() => controls.fetch()).toThrow(/listenTo/);
    });
});

describe('CalendarControls event hooks', () => {
    it('delivers fetched data to onCalendarFetched', async () => {
        const { controls } = await wiredWith('');
        const seen = [];
        controls.onCalendarFetched((data) => seen.push(data));
        await controls.fetch();
        expect(seen.length).toBe(1);
        expect(seen[0]).toHaveProperty('litcal');
    });

    it('is chainable', async () => {
        const { controls } = await wiredWith('');
        expect(controls.onCalendarFetched(() => {})).toBe(controls);
        expect(controls.onError(() => {})).toBe(controls);
    });

    it('routes a failed fetch to onError and suppresses console.error', async () => {
        const apiClient = await ApiClient.init(API_URL);
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#mount');
        controls.listenTo(apiClient);
        const seen = [];
        controls.onError((error) => seen.push(error));

        global.fetch = jest.fn(() => Promise.reject(new Error('network down')));
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        await expect(controls.fetch()).rejects.toThrow();
        expect(seen.length).toBeGreaterThan(0);
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('falls back to console.error when nothing is listening', async () => {
        const apiClient = await ApiClient.init(API_URL);
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#mount');
        controls.listenTo(apiClient);

        global.fetch = jest.fn(() => Promise.reject(new Error('network down')));
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        await expect(controls.fetch()).rejects.toThrow();
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });
});
