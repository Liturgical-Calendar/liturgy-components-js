/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import ApiExplorer from '../MetaComponents/ApiExplorer.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    global.fetch = jest.fn(() =>
        Promise.resolve({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: () => Promise.resolve({ litcal: [] }),
        }),
    );
    document.body.replaceChildren();
    for (const id of [
        'pathBuilder',
        'basePath',
        'allPaths',
        'rite',
        'builder',
    ]) {
        const el = document.createElement('div');
        el.id = id;
        document.body.appendChild(el);
    }
});

/** @returns {Promise<ApiExplorer>} A mounted explorer. */
const mountExplorer = async () => {
    const apiClient = await ApiClient.init(API_URL);
    return ApiExplorer.mountInto(
        {
            pathBuilder: '#pathBuilder',
            basePath: '#basePath',
            allPaths: '#allPaths',
            riteSelect: '#rite',
            builder: '#builder',
        },
        { locale: 'en', apiClient },
    );
};

describe('ApiExplorer', () => {
    it('mounts the option groups into their three slots', async () => {
        await mountExplorer();
        expect(
            document.querySelector('#pathBuilder').children.length,
        ).toBeGreaterThan(0);
        expect(
            document.querySelector('#basePath').children.length,
        ).toBeGreaterThan(0);
        expect(
            document.querySelector('#allPaths').children.length,
        ).toBeGreaterThan(0);
    });

    it('mounts the rite select into its own slot', async () => {
        const explorer = await mountExplorer();
        expect(document.querySelector('#rite select')).toBe(
            explorer.controls.riteSelect._domElement,
        );
    });

    it('never fetches a calendar', async () => {
        await mountExplorer();
        const calls = global.fetch.mock.calls.map((c) => String(c[0]));
        expect(calls.some((u) => /\/calendar(\/|\?|$)/.test(u))).toBe(false);
    });

    it('rebuilds the calendar list on a rite change without ever fetching a calendar', async () => {
        const explorer = await mountExplorer();
        const calendarSelectEl = explorer.controls.calendarSelect._domElement;
        const riteSelectEl = explorer.controls.riteSelect._domElement;

        const beforeOptions = Array.from(calendarSelectEl.options).map(
            (option) => option.value,
        );

        riteSelectEl.value = 'ambrosian';
        riteSelectEl.dispatchEvent(new Event('change'));

        const afterOptions = Array.from(calendarSelectEl.options).map(
            (option) => option.value,
        );

        // The replacement wiring (`linkToCalendarSelect().linkToRiteSelect()`,
        // called directly rather than through `CalendarControls.listenTo()`)
        // must still rebuild the calendar list for the new rite ...
        expect(afterOptions).not.toEqual(beforeOptions);

        // ... while issuing no `/calendar/...` request at any point, even after
        // the interaction. `/calendars` (the metadata index, requested once by
        // `ApiClient.init()` in `mountExplorer()` above) is legitimate and must
        // still be permitted — the regex below only rejects a `/calendar` segment
        // followed by `/`, `?`, or end of string, never `/calendars`.
        const calls = global.fetch.mock.calls.map((c) => String(c[0]));
        expect(calls.some((u) => /\/calendar(\/|\?|$)/.test(u))).toBe(false);
    });

    it('exposes the path builder', async () => {
        const explorer = await mountExplorer();
        expect(explorer.pathBuilder).not.toBeNull();
    });

    it('throws on use after dispose', async () => {
        const explorer = await mountExplorer();
        explorer.dispose();
        expect(() => explorer.controls).toThrow(/disposed/);
    });
});
