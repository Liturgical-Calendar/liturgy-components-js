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

describe('CalendarControls.onSelectionChange', () => {
    it('is chainable', async () => {
        const controls = await build();
        expect(controls.onSelectionChange(() => {})).toBe(controls);
    });

    it('rejects a non-function callback, naming the component', async () => {
        const controls = await build();
        expect(() => controls.onSelectionChange('nope')).toThrow(
            /CalendarControls\.onSelectionChange/,
        );
    });

    it('does not fire on subscribe', async () => {
        const controls = await build();
        const seen = [];
        controls.onSelectionChange((payload) => seen.push(payload));
        await flush();
        expect(seen).toEqual([]);
    });

    it('fires exactly once for one calendar change', async () => {
        const controls = await build();
        const seen = [];
        controls.onSelectionChange((payload) => seen.push(payload));

        userSelects(controls.calendarSelect._domElement, 'IT');
        await flush();

        expect(seen).toHaveLength(1);
        expect(seen[0].calendarType).toBe('national');
        expect(seen[0].calendarId).toBe('IT');
        expect(seen[0].predeterminedInputs).toHaveLength(5);
    });

    it('fires exactly once for one calendar change on controls with no ApiClient', async () => {
        // `apiClient` is OPTIONAL on `mountInto()`, and it is `listenTo()` that
        // links `ApiOptions` to the two selects — so on an unwired instance
        // nothing in the form ever dispatches a `change`, and
        // `ApiOptions.onSettled()` never fires at all. The fallback microtask
        // scheduled from `#listenForSelection()`'s own listener is the only
        // thing that notifies here. Every other test in this file goes through
        // `build()`, which always passes a client, which is how this path
        // reached 23 green tests while silently notifying nobody.
        const controls = await CalendarControls.mountInto('#controls', {
            locale: 'en',
        });
        const seen = [];
        controls.onSelectionChange((payload) => seen.push(payload));

        userSelects(controls.calendarSelect._domElement, 'IT');
        await flush();

        expect(seen).toHaveLength(1);
        expect(seen[0].calendarType).toBe('national');
        expect(seen[0].calendarId).toBe('IT');
        // Empty, not five: with no `ApiClient` the form is unlinked, so
        // `ApiOptions` predetermines nothing — the caveat the last test in this
        // file pins for `selection`, holding here too.
        expect(seen[0].predeterminedInputs).toEqual([]);
    });

    it('fires exactly once for one rite change, which moves several inputs', async () => {
        const controls = await build();
        const seen = [];
        controls.onSelectionChange((payload) => seen.push(payload));

        userSelects(controls.riteSelect._domElement, 'ambrosian');
        await flush();

        expect(seen).toHaveLength(1);
        expect(seen[0].predeterminedInputs).toEqual([
            'epiphanyInput',
            'ascensionInput',
            'corpusChristiInput',
            'eternalHighPriestInput',
        ]);
    });

    it('does not fire for a locale change, which moves nothing it reports', async () => {
        const controls = await build();
        const seen = [];
        controls.onSelectionChange((payload) => seen.push(payload));

        userSelects(controls.apiOptions.localeInput._domElement, 'it');
        await flush();

        expect(seen).toEqual([]);
    });

    it('fires once per action across three separate actions', async () => {
        const controls = await build();
        const seen = [];
        controls.onSelectionChange((payload) => seen.push(payload));

        userSelects(controls.calendarSelect._domElement, 'IT');
        await flush();
        userSelects(controls.calendarSelect._domElement, '');
        await flush();
        userSelects(controls.riteSelect._domElement, 'ambrosian');
        await flush();

        // Asserted as a SEQUENCE, not a count: a length of three would also be
        // satisfied by one action notifying nothing and another notifying twice,
        // which is exactly the failure this file exists to catch.
        expect(
            seen.map(({ calendarType, calendarId, predeterminedInputs }) => [
                calendarType,
                calendarId,
                predeterminedInputs.length,
            ]),
        ).toEqual([
            ['national', 'IT', 5],
            ['general', null, 0],
            ['general', null, 4],
        ]);
    });

    it('does not fire when a change leaves the selection unaltered', async () => {
        const controls = await build();
        const seen = [];
        controls.onSelectionChange((payload) => seen.push(payload));

        // A raw dispatch with no value change: nothing to restyle.
        controls.calendarSelect._domElement.dispatchEvent(new Event('change'));
        await flush();

        expect(seen).toEqual([]);
    });

    it('reports a throwing subscriber via console.error rather than an unhandled rejection', async () => {
        // Regression test: `#scheduleSelectionNotification()`'s microtask body
        // used to have no try/catch, so a throwing `onSelectionChange()`
        // callback propagated out of the `.then()` and became an unhandled
        // promise rejection instead of a reported console error — on a WIRED
        // instance too, since this fallback is scheduled first (in the
        // constructor) and deterministically wins over
        // `ApiOptions.onSettled()`.
        const controls = await build();
        const errors = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        controls.onSelectionChange(() => {
            throw new Error('subscriber blew up');
        });

        userSelects(controls.calendarSelect._domElement, 'IT');
        await flush();

        expect(errors).toHaveBeenCalled();
        errors.mockRestore();
    });

    it('notifies every registered callback', async () => {
        const controls = await build();
        const first = [];
        const second = [];
        controls
            .onSelectionChange((payload) => first.push(payload))
            .onSelectionChange((payload) => second.push(payload));

        userSelects(controls.calendarSelect._domElement, 'IT');
        await flush();

        expect(first).toHaveLength(1);
        expect(second).toHaveLength(1);
    });

    it('stops notifying after dispose()', async () => {
        const controls = await build();
        const select = controls.calendarSelect._domElement;
        const seen = [];
        controls.onSelectionChange((payload) => seen.push(payload));

        controls.dispose();
        userSelects(select, 'IT');
        await flush();

        expect(seen).toEqual([]);
    });

    it('removes its change listeners on dispose, not only its callbacks', async () => {
        // Asserted separately from the test above, which clearing the callback
        // list alone would satisfy: the listeners are this class' own named
        // closures — unlike the ones `ApiClient.listenTo()` attaches — so they
        // can be, and are, removed.
        const controls = await build();
        const removed = jest.spyOn(
            controls.calendarSelect._domElement,
            'removeEventListener',
        );

        controls.dispose();

        expect(removed).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('throws on onSelectionChange() once disposed', async () => {
        const controls = await build();
        controls.dispose();
        expect(() => controls.onSelectionChange(() => {})).toThrow(/disposed/);
    });

    it('does not notify when dispose() lands between the change and the flush', async () => {
        // The listener has already scheduled the microtask when `dispose()`
        // runs, so the flush executes on a disposed instance. It must do
        // nothing, and above all must not throw into an unhandled rejection.
        const controls = await build();
        const seen = [];
        controls.onSelectionChange((payload) => seen.push(payload));

        userSelects(controls.calendarSelect._domElement, 'IT');
        controls.dispose();
        await flush();

        expect(seen).toEqual([]);
    });

    it('does not fire a callback registered by another callback in the same flush', async () => {
        // Registering during a notification must behave like any other
        // subscription: it does not fire on subscribe, so the earliest it can
        // hear anything is the NEXT action.
        const controls = await build();
        const late = [];
        controls.onSelectionChange(() => {
            controls.onSelectionChange((payload) => late.push(payload));
        });

        userSelects(controls.calendarSelect._domElement, 'IT');
        await flush();

        expect(late).toEqual([]);
    });
});

describe('what predeterminedInputs describes', () => {
    it('reports the holydays input that ApiOptions has actually made read-only', async () => {
        // The apply half of the one-source claim, for the input this whole
        // issue is about. `HolydaysOfObligationInput.disabled()` does not touch
        // `_domElement.disabled` — it sets a `readonly` expando and disables
        // each option — so nothing else in the suite would notice if the rule
        // stopped naming it.
        const controls = await build();
        userSelects(controls.calendarSelect._domElement, 'IT');

        const input = controls.apiOptions.holydaysOfObligationInput;
        expect(controls.selection.predeterminedInputs).toContain(
            'holydaysOfObligationInput',
        );
        expect(input._domElement.readonly).toBe(true);
        expect(
            [...input._domElement.options].every((option) => option.disabled),
        ).toBe(true);
    });

    it('reports the four temporal inputs that ApiOptions has actually disabled', async () => {
        const controls = await build();
        userSelects(controls.riteSelect._domElement, 'ambrosian');

        for (const key of controls.selection.predeterminedInputs) {
            expect(controls.apiOptions[key]._domElement.disabled).toBe(true);
        }
        expect(
            controls.apiOptions.holydaysOfObligationInput._domElement.readonly,
        ).toBe(false);
    });

    it('reports the empty set for controls that were never wired to an ApiClient', async () => {
        // `mountInto()` permits omitting `apiClient`, which leaves `ApiOptions`
        // unlinked: nothing in the form reacts to the calendar select, so
        // nothing is predetermined in it either. Pinned so the documented
        // caveat cannot quietly stop being true.
        const controls = await CalendarControls.mountInto('#controls', {
            locale: 'en',
        });
        userSelects(controls.calendarSelect._domElement, 'IT');

        expect(controls.selection).toEqual({
            calendarType: 'national',
            calendarId: 'IT',
            predeterminedInputs: [],
        });
        expect(
            controls.apiOptions.holydaysOfObligationInput._domElement.readonly,
        ).toBeFalsy();
    });
});
