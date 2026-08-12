/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import CalendarControls from '../MetaComponents/CalendarControls.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.replaceChildren();
    const mount = document.createElement('div');
    mount.id = 'mount';
    document.body.appendChild(mount);
});

// C3: `CalendarControls` used to ignore its own `locale` option entirely for
// requests — the locale select showed `la` and the initial request carried no
// `Accept-Language` even when constructed with `locale: 'it'`. Ported from
// `DayViewer.#matchLocale()` (see `DayViewerWiring.test.js`'s own "DayViewer
// locale cascade" describe block, which this mirrors) so the two components
// behave alike rather than inventing separate cascades for the same rule.
describe('CalendarControls locale cascade', () => {
    it('prefers an exact locale match', () => {
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#mount');
        expect(controls.selectedLocale).toBe('en');
    });

    it('falls back to a language match when there is no exact one', () => {
        const controls = new CalendarControls({ locale: 'it-CH' });
        controls.appendTo('#mount');
        expect(controls.selectedLocale.split(/[-_]/)[0]).toBe('it');
    });

    it('falls back to the first available option when neither matches', () => {
        const controls = new CalendarControls({ locale: 'ja' });
        controls.appendTo('#mount');
        expect(controls.apiOptions._localeInput.options()).toContain(
            controls.selectedLocale,
        );
    });

    it('selects the cascade result in the locale input', () => {
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#mount');
        expect(controls.apiOptions._localeInput._domElement.value).toBe(
            controls.selectedLocale,
        );
    });
});

describe('CalendarControls locale cascade drives the request', () => {
    /**
     * Snapshots of the `headers` object passed to `fetch` on each call,
     * captured at call time — `ApiClient` passes the SAME mutable headers
     * object by reference on every request, so reading `fetch.mock.calls`
     * after the fact would show only the latest state. See
     * `ApiClientCalendarLocaleResolution.test.js` for the same pattern.
     *
     * @type {object[]}
     */
    let fetchHeaderSnapshots;

    beforeEach(() => {
        fetchHeaderSnapshots = [];
        global.fetch = jest.fn((url, init) => {
            fetchHeaderSnapshots.push({ ...init?.headers });
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
    });

    it('shows the constructed locale in the select, not `la`', async () => {
        const apiClient = await ApiClient.init(API_URL);
        const controls = await CalendarControls.mountInto('#mount', {
            locale: 'it',
            apiClient,
        });
        expect(controls.apiOptions._localeInput._domElement.value).toBe('it');
    });

    it('sends Accept-Language for the constructed locale on the initial fetch', async () => {
        const apiClient = await ApiClient.init(API_URL);
        await CalendarControls.mountInto('#mount', {
            locale: 'it',
            apiClient,
        });
        expect(fetchHeaderSnapshots[0]?.['Accept-Language']).toBe('it');
    });

    it('sends Accept-Language for the constructed locale via fetch() called directly', async () => {
        const apiClient = await ApiClient.init(API_URL);
        const controls = new CalendarControls({ locale: 'it' });
        controls.appendTo('#mount');
        controls.listenTo(apiClient);
        await controls.fetch();
        expect(fetchHeaderSnapshots[0]?.['Accept-Language']).toBe('it');
    });
});
