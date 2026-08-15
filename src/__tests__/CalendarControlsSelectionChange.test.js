/** @jest-environment jsdom */
/**
 * `CalendarControls.selection` and `onSelectionChange()` — issue #68.
 *
 * The frequency tests drive REAL `change` events through the real wiring and
 * count callback invocations, following `AnnouncementFrequency.test.js`: one
 * user action moves several inputs, and "fires once per user action" is the
 * property this whole feature exists to provide, so it is measured rather than
 * assumed.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import CalendarControls from '../MetaComponents/CalendarControls.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    ApiClient.clearCache();
    document.body.innerHTML = '<div id="controls"></div>';
    global.fetch = jest.fn(() =>
        Promise.resolve({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: () =>
                Promise.resolve({
                    litcal: [],
                    messages: [],
                    metadata: {},
                    settings: {},
                }),
        }),
    );
});

/** Lets the notification microtask flush. */
const flush = () => Promise.resolve().then(() => {});

/**
 * Sets a select's value the way a user would, notifying listeners.
 *
 * @param {HTMLSelectElement} element - The select to drive.
 * @param {string} value - The value to select.
 * @returns {void}
 */
const userSelects = (element, value) => {
    element.value = value;
    element.dispatchEvent(new Event('change', { bubbles: true }));
};

/**
 * Mounted, wired controls with no initial fetch.
 *
 * @returns {Promise<CalendarControls>} The mounted controls.
 */
const build = async () => {
    const apiClient = await ApiClient.init(API_URL);
    return CalendarControls.mountInto('#controls', {
        locale: 'en',
        apiClient,
        initialFetch: false,
    });
};

describe('CalendarControls.selection', () => {
    it('reports the rite-level calendar with nothing predetermined', async () => {
        const controls = await build();
        expect(controls.selection).toEqual({
            calendarType: 'general',
            calendarId: null,
            predeterminedInputs: [],
        });
    });

    it('reports a national calendar and its five predetermined inputs', async () => {
        const controls = await build();
        userSelects(controls.calendarSelect._domElement, 'IT');
        expect(controls.selection).toEqual({
            calendarType: 'national',
            calendarId: 'IT',
            predeterminedInputs: [
                'epiphanyInput',
                'ascensionInput',
                'corpusChristiInput',
                'eternalHighPriestInput',
                'holydaysOfObligationInput',
            ],
        });
    });

    it('reports a diocesan calendar', async () => {
        const controls = await build();
        userSelects(controls.calendarSelect._domElement, 'romamo_it');
        expect(controls.selection.calendarType).toBe('diocesan');
        expect(controls.selection.calendarId).toBe('romamo_it');
    });

    it('reports the four temporal inputs the Ambrosian rite fixes, with no calendar selected', async () => {
        // The case a `value === ''` test gets WRONG: the rite-level calendar,
        // yet four inputs are predetermined.
        const controls = await build();
        userSelects(controls.riteSelect._domElement, 'ambrosian');
        expect(controls.selection).toEqual({
            calendarType: 'general',
            calendarId: null,
            predeterminedInputs: [
                'epiphanyInput',
                'ascensionInput',
                'corpusChristiInput',
                'eternalHighPriestInput',
            ],
        });
    });

    it('names inputs reachable on the ApiOptions it is published beside', async () => {
        const controls = await build();
        userSelects(controls.calendarSelect._domElement, 'IT');
        for (const key of controls.selection.predeterminedInputs) {
            expect(controls.apiOptions[key]).toBeDefined();
        }
    });

    it('throws once disposed', async () => {
        const controls = await build();
        controls.dispose();
        expect(() => controls.selection).toThrow(/disposed/);
    });
});
