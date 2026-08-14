/** @jest-environment jsdom */
/**
 * Issue #70: a rite switch DISABLED the four temporal option inputs and never
 * SET them, so the form froze at whatever was last displayed and could
 * contradict the request it was about to produce.
 *
 * Two halves, and only the first is visible:
 *
 *   1. The form lies. Select Italy (`ascension: SUNDAY`), switch to Ambrosian,
 *      and the greyed-out select still reads `SUNDAY` while the Ambrosian Missal
 *      fixes Ascension to the fortieth day of Easter.
 *   2. The REQUEST lies. `ApiClient.fetchCalendar()` POSTs `epiphany`,
 *      `ascension`, `corpus_christi`, `eternal_high_priest` and
 *      `holydays_of_obligation` as the body for the rite-level calendar, and it
 *      learns them ONLY from `change` listeners on these inputs. A value the
 *      user picked by hand under the Roman rite therefore survived a rite switch
 *      inside the client and was sent to `/calendar/ambrosian` — the very
 *      request `#applyTemporalInputState()` disables the inputs to prevent.
 *
 * The metadata carries the answer: `/calendars` publishes `settings` under
 * `ambrosian_calendars[]` (LiturgicalCalendarAPI#776, shipped in PR 779), so the
 * fix reads them rather than hard-coding liturgical law into `RiteProperties`.
 *
 * These tests use LOCAL metadata wherever the case needs an `IT` that diverges
 * from the Ambrosian values on all five keys — the shared `FULL_METADATA` has no
 * `holydays_of_obligation` on its nations. The last describe block runs the same
 * path against the shared fixture, so a suite built on it exercises this code
 * rather than merely believing in it. Whether that fixture still matches what
 * `/calendars` serves is a human obligation, not something a unit test can reach.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import HolydaysOfObligationInput from '../ApiOptions/Input/HolydaysOfObligationInput.js';
import { Rite } from '../Enums.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

/**
 * Copied verbatim from `GET /calendars` on the dev API, 2026-08-14. Ten entries,
 * of which three (`Circoncisione`, `StAmbrose`, `DedicationDuomo`) do not exist
 * in the Roman list at all, and four Roman ones (`CorpusChristi`,
 * `MaryMotherOfGod`, `StJoseph`, `StsPeterPaulAp`) are absent from it.
 */
const AMBROSIAN_SETTINGS = {
    epiphany: 'JAN6',
    ascension: 'THURSDAY',
    corpus_christi: 'THURSDAY',
    eternal_high_priest: false,
    holydays_of_obligation: {
        Christmas: true,
        Circoncisione: true,
        Epiphany: true,
        Ascension: true,
        Pentecost: true,
        ImmaculateConception: true,
        Assumption: true,
        AllSaints: true,
        StAmbrose: true,
        DedicationDuomo: true,
    },
};

/**
 * `IT` here diverges from the Ambrosian values on ALL FIVE keys, which the real
 * Italy does on three of them. A test built on a nation that agrees with the
 * rite proves nothing: the General Roman defaults and the Ambrosian fixed values
 * coincide exactly, which is the whole reason this bug hid.
 */
const IT_SETTINGS = {
    epiphany: 'SUNDAY_JAN2_JAN8',
    ascension: 'SUNDAY',
    corpus_christi: 'SUNDAY',
    eternal_high_priest: true,
    holydays_of_obligation: {
        Christmas: true,
        Epiphany: true,
        Ascension: false,
        CorpusChristi: false,
        MaryMotherOfGod: true,
        ImmaculateConception: true,
        Assumption: true,
        StJoseph: false,
        StsPeterPaulAp: false,
        AllSaints: true,
    },
};

/**
 * @param {?Object} ambrosianSettings - The `settings` block to publish for the
 *   rite-level Ambrosian calendar, or `null` to publish none (the pre-#776 shape
 *   the library must still tolerate).
 * @returns {Object} A rite-aware metadata index.
 */
const metadataWith = (ambrosianSettings) => ({
    locales: ['en', 'it', 'la'],
    national_calendars: [
        { calendar_id: 'IT', locales: ['it-IT'], settings: IT_SETTINGS },
    ],
    national_calendars_keys: ['IT'],
    diocesan_calendars: [
        {
            calendar_id: 'romamo_it',
            nation: 'IT',
            diocese: 'Diocesi di Roma',
            locales: ['it-IT'],
            rite: 'roman',
        },
        {
            calendar_id: 'milano_it',
            nation: 'IT',
            diocese: 'Arcidiocesi di Milano',
            locales: ['it-IT'],
            rite: 'ambrosian',
        },
    ],
    diocesan_calendars_keys: ['romamo_it', 'milano_it'],
    diocesan_groups: [],
    wider_regions: [],
    wider_regions_keys: [],
    ambrosian_calendars: [
        {
            calendar_id: 'ambrosian',
            rite: 'ambrosian',
            locales: ['it', 'la'],
            ...(ambrosianSettings === null
                ? {}
                : { settings: ambrosianSettings }),
        },
    ],
});

beforeEach(() => {
    ApiBase.reset();
    document.body.innerHTML = '';
});

/** Loads a fresh base from the given index and wires a rite-aware form onto it. */
const buildForm = (metadata) => {
    ApiBase.fromMetadata(API_URL, metadata);
    const calendarSelect = new CalendarSelect('en').allowNull();
    const riteSelect = new RiteSelect('en');
    const apiOptions = new ApiOptions('en');
    apiOptions
        .linkToCalendarSelect(calendarSelect)
        .linkToRiteSelect(riteSelect);
    return { calendarSelect, riteSelect, apiOptions };
};

/** Drives the rite select the way a user would. */
const chooseRite = (riteSelect, rite) => {
    riteSelect._domElement.value = rite;
    riteSelect._domElement.dispatchEvent(new Event('change'));
};

/** The four temporal inputs' current values, as the form displays them. */
const temporalValues = (apiOptions) => ({
    epiphany: apiOptions._epiphanyInput._domElement.value,
    ascension: apiOptions._ascensionInput._domElement.value,
    corpus_christi: apiOptions._corpusChristiInput._domElement.value,
    eternal_high_priest: apiOptions._eternalHighPriestInput._domElement.value,
});

/** The holydays multi-select as a `{ key: selected }` map, in DOM order. */
const holydayStates = (apiOptions) =>
    Object.fromEntries(
        Array.from(
            apiOptions._holydaysOfObligationInput._domElement.options,
            (option) => [option.value, option.selected],
        ),
    );

describe('a rite that publishes settings applies them to the option inputs', () => {
    it("replaces a previously selected nation's settings with the rite's", () => {
        const { calendarSelect, riteSelect, apiOptions } = buildForm(
            metadataWith(AMBROSIAN_SETTINGS),
        );

        calendarSelect._domElement.value = 'IT';
        calendarSelect._domElement.dispatchEvent(new Event('change'));
        // The nation's settings really are in the form before the switch —
        // without this the assertion below could pass on a form that never
        // showed anything at all.
        expect(temporalValues(apiOptions)).toEqual({
            epiphany: 'SUNDAY_JAN2_JAN8',
            ascension: 'SUNDAY',
            corpus_christi: 'SUNDAY',
            eternal_high_priest: 'true',
        });

        chooseRite(riteSelect, Rite.AMBROSIAN);

        expect(temporalValues(apiOptions)).toEqual({
            epiphany: 'JAN6',
            ascension: 'THURSDAY',
            corpus_christi: 'THURSDAY',
            eternal_high_priest: 'false',
        });
    });

    it('applies them on an untouched form too', () => {
        // The case that hid the bug: the four inputs start at their own empty
        // "--" option, so before the fix this read `''` and LOOKED harmless,
        // because `''` and the Ambrosian fixed values compute the same calendar.
        // The form still has to say what the rite fixes.
        const { riteSelect, apiOptions } = buildForm(
            metadataWith(AMBROSIAN_SETTINGS),
        );
        expect(temporalValues(apiOptions).epiphany).toBe('');

        chooseRite(riteSelect, Rite.AMBROSIAN);

        expect(temporalValues(apiOptions)).toEqual({
            epiphany: 'JAN6',
            ascension: 'THURSDAY',
            corpus_christi: 'THURSDAY',
            eternal_high_priest: 'false',
        });
    });

    it('gives the holydays input exactly the published list, with no Roman leftovers', () => {
        // `HolydaysOfObligationInput.setOptions()` MERGES with its ten Roman base
        // options by default. Merging here would leave `CorpusChristi`,
        // `MaryMotherOfGod`, `StJoseph` and `StsPeterPaulAp` selected, so the
        // form would assert they are Ambrosian holy days of obligation. They are
        // not — the API's published list omits them.
        const { riteSelect, apiOptions } = buildForm(
            metadataWith(AMBROSIAN_SETTINGS),
        );

        chooseRite(riteSelect, Rite.AMBROSIAN);

        expect(holydayStates(apiOptions)).toEqual(
            AMBROSIAN_SETTINGS.holydays_of_obligation,
        );
    });

    it("replaces a nation's holydays list rather than merging with it", () => {
        const { calendarSelect, riteSelect, apiOptions } = buildForm(
            metadataWith(AMBROSIAN_SETTINGS),
        );

        calendarSelect._domElement.value = 'IT';
        calendarSelect._domElement.dispatchEvent(new Event('change'));
        expect(holydayStates(apiOptions)).toEqual(
            IT_SETTINGS.holydays_of_obligation,
        );

        chooseRite(riteSelect, Rite.AMBROSIAN);

        expect(holydayStates(apiOptions)).toEqual(
            AMBROSIAN_SETTINGS.holydays_of_obligation,
        );
    });
});

describe('a rite that publishes no settings', () => {
    it('leaves the four temporal VALUES alone', () => {
        // The Roman rite has no `roman_calendars` key at all, so
        // `ApiBase.riteCalendars( 'roman' )` correctly returns `[]`. Blanking
        // the inputs here would break every Roman page.
        const { riteSelect, apiOptions } = buildForm(
            metadataWith(AMBROSIAN_SETTINGS),
        );

        chooseRite(riteSelect, Rite.AMBROSIAN);
        chooseRite(riteSelect, Rite.ROMAN);

        expect(temporalValues(apiOptions)).toEqual({
            epiphany: 'JAN6',
            ascension: 'THURSDAY',
            corpus_christi: 'THURSDAY',
            eternal_high_priest: 'false',
        });
    });

    it("restores the holydays option LIST to the input's own defaults", () => {
        // Not the same rule as the four values, deliberately. Holy days of
        // obligation are an option list the rite defines, exactly as locales
        // are — and `#applyRiteToLocaleInput()` already resets that list for a
        // rite that publishes none. Leaving the list alone here would carry
        // `Circoncisione`, `StAmbrose` and `DedicationDuomo` into a General
        // Roman Calendar form, and into its request body.
        const { riteSelect, apiOptions } = buildForm(
            metadataWith(AMBROSIAN_SETTINGS),
        );

        chooseRite(riteSelect, Rite.AMBROSIAN);
        expect(Object.keys(holydayStates(apiOptions))).toContain('StAmbrose');

        chooseRite(riteSelect, Rite.ROMAN);

        expect(Object.keys(holydayStates(apiOptions))).toEqual(
            HolydaysOfObligationInput.BASE_OPTIONS.map(
                (option) => option.value,
            ),
        );
        expect(Object.values(holydayStates(apiOptions)).every(Boolean)).toBe(
            true,
        );
    });

    it('is a no-op on all five inputs when the rite entry carries no settings key', () => {
        // The pre-#776 shape. An API that has not shipped the settings must not
        // make the library worse than it was.
        const { riteSelect, apiOptions } = buildForm(metadataWith(null));

        chooseRite(riteSelect, Rite.AMBROSIAN);

        expect(temporalValues(apiOptions)).toEqual({
            epiphany: '',
            ascension: '',
            corpus_christi: '',
            eternal_high_priest: 'false',
        });
        expect(Object.keys(holydayStates(apiOptions))).toEqual(
            HolydaysOfObligationInput.BASE_OPTIONS.map(
                (option) => option.value,
            ),
        );
    });
});

describe('a published value the input has no option for', () => {
    it('leaves that input unchanged rather than blanking it', () => {
        // Assigning an unmatched value to a `<select>` leaves
        // `selectedIndex === -1` and the DOM DISCARDS the value, so the input
        // would read `''`. API drift has to degrade to "unchanged", never to
        // "empty" — see CalendarSelect.value()'s throw, filed for the same trap.
        const { riteSelect, apiOptions } = buildForm(
            metadataWith({
                ...AMBROSIAN_SETTINGS,
                epiphany: 'SOME_FUTURE_TOKEN',
            }),
        );

        apiOptions._epiphanyInput._domElement.value = 'SUNDAY_JAN2_JAN8';
        chooseRite(riteSelect, Rite.AMBROSIAN);

        expect(apiOptions._epiphanyInput._domElement.value).toBe(
            'SUNDAY_JAN2_JAN8',
        );
        // The other three still applied: one unknown token must not abort the
        // whole pass.
        expect(apiOptions._ascensionInput._domElement.value).toBe('THURSDAY');
    });
});

describe('a malformed or empty published holydays list', () => {
    it('falls back to the defaults when the list is an array', () => {
        // `Object.entries( ['x'] )` would otherwise produce an option keyed `'0'`.
        // The value path deliberately degrades to "unchanged" on this kind of API
        // drift; the list path degrades to "the defaults".
        const { riteSelect, apiOptions } = buildForm(
            metadataWith({
                ...AMBROSIAN_SETTINGS,
                holydays_of_obligation: ['Christmas'],
            }),
        );

        chooseRite(riteSelect, Rite.AMBROSIAN);

        expect(Object.keys(holydayStates(apiOptions))).toEqual(
            HolydaysOfObligationInput.BASE_OPTIONS.map(
                (option) => option.value,
            ),
        );
    });

    it('empties the select when the rite publishes an empty list', () => {
        // Distinct from "publishes none", which restores the defaults. An empty
        // object is a positive statement — this rite observes no holy days of
        // obligation — so it is rendered as one.
        const { riteSelect, apiOptions } = buildForm(
            metadataWith({
                ...AMBROSIAN_SETTINGS,
                holydays_of_obligation: {},
            }),
        );

        chooseRite(riteSelect, Rite.AMBROSIAN);

        expect(Object.keys(holydayStates(apiOptions))).toEqual([]);
    });
});

describe('the conditional-dispatch rule', () => {
    /**
     * Attaches a counting `change` listener to all five inputs.
     *
     * @param {ApiOptions} apiOptions
     * @returns {Function} Returns the total count when called.
     */
    const countChanges = (apiOptions) => {
        const listener = jest.fn();
        [
            apiOptions._epiphanyInput,
            apiOptions._ascensionInput,
            apiOptions._corpusChristiInput,
            apiOptions._eternalHighPriestInput,
            apiOptions._holydaysOfObligationInput,
        ].forEach((input) =>
            input._domElement.addEventListener('change', listener),
        );
        return () => listener.mock.calls.length;
    };

    it('dispatches nothing when the rite publishes what the inputs already show', () => {
        // `ApiClient` treats a `change` on any of these as "refetch", so a rite
        // change that moves nothing must stay silent. Covered incidentally by
        // ApiClientRequestCoalescing's request counts, but that suite is about a
        // different feature and could be rewritten without noticing this.
        const { riteSelect, apiOptions } = buildForm(
            metadataWith(AMBROSIAN_SETTINGS),
        );
        chooseRite(riteSelect, Rite.AMBROSIAN);

        const changes = countChanges(apiOptions);
        // Re-applying the SAME rite re-runs the whole pass over inputs that
        // already hold its values.
        chooseRite(riteSelect, Rite.AMBROSIAN);

        expect(changes()).toBe(0);
    });

    it('dispatches nothing at link time on a Roman page', () => {
        // `applyRite()` runs once during linking. On the Roman rite it publishes
        // no settings, and the holydays restore lands on the list already there,
        // so the whole pass must be inert — otherwise every Roman page using a
        // RiteSelect would fire a spurious refetch before the user touched
        // anything.
        ApiBase.fromMetadata(API_URL, metadataWith(AMBROSIAN_SETTINGS));
        const calendarSelect = new CalendarSelect('en').allowNull();
        const riteSelect = new RiteSelect('en');
        const apiOptions = new ApiOptions('en');
        const changes = countChanges(apiOptions);

        apiOptions
            .linkToCalendarSelect(calendarSelect)
            .linkToRiteSelect(riteSelect);

        expect(changes()).toBe(0);
    });

    it('dispatches once per input that actually moved', () => {
        const { riteSelect, apiOptions } = buildForm(
            metadataWith(AMBROSIAN_SETTINGS),
        );
        const changes = countChanges(apiOptions);

        chooseRite(riteSelect, Rite.AMBROSIAN);

        // epiphany, ascension and corpus_christi move off `--`; the holydays list
        // is replaced. `eternal_high_priest` is already `'false'`, which is what
        // the rite publishes, so it must NOT dispatch.
        expect(changes()).toBe(4);
    });
});

describe('the request the form produces', () => {
    /** @type {Object[]} */
    let bodies = [];

    beforeEach(() => {
        bodies = [];
        global.fetch = jest.fn((url, init) => {
            bodies.push(JSON.parse(init.body));
            return Promise.resolve({
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
            });
        });
    });

    /** Lets the coalesced refetch microtask run and its request settle. */
    const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

    it("follows the rite instead of the user's earlier hand-picked value", async () => {
        ApiBase.fromMetadata(API_URL, metadataWith(AMBROSIAN_SETTINGS));
        const apiClient = await ApiClient.init(API_URL);
        const calendarSelect = new CalendarSelect('en').allowNull();
        const riteSelect = new RiteSelect('en');
        const apiOptions = new ApiOptions('en');
        apiOptions
            .linkToCalendarSelect(calendarSelect)
            .linkToRiteSelect(riteSelect);
        apiClient
            .listenTo(calendarSelect)
            .listenTo(riteSelect)
            .listenTo(apiOptions);

        // A deliberate user edit under the Roman rite, dispatched the way the
        // browser would: this is what reaches `ApiClient`'s own params.
        apiOptions._ascensionInput._domElement.value = 'SUNDAY';
        apiOptions._ascensionInput._domElement.dispatchEvent(
            new Event('change'),
        );
        await settle();

        chooseRite(riteSelect, Rite.AMBROSIAN);
        await settle();

        const lastBody = bodies.at(-1);
        expect(lastBody.ascension).toBe('THURSDAY');
        expect(lastBody.holydays_of_obligation).toEqual(
            AMBROSIAN_SETTINGS.holydays_of_obligation,
        );
    });
});

describe('HolydaysOfObligationInput.setOptions', () => {
    it('merges with the base options by default, as it always has', () => {
        const input = new HolydaysOfObligationInput();
        input.setOptions([{ value: 'StAmbrose', label: 'x', selected: true }]);
        const values = Array.from(
            input._domElement.options,
            (option) => option.value,
        );
        expect(values).toContain('StJoseph');
        expect(values).toContain('StAmbrose');
    });

    it('replaces them exactly when told not to merge', () => {
        const input = new HolydaysOfObligationInput();
        input.setOptions(
            [{ value: 'StAmbrose', label: 'x', selected: true }],
            false,
        );
        const values = Array.from(
            input._domElement.options,
            (option) => option.value,
        );
        expect(values).toEqual(['StAmbrose']);
    });
});

describe('the shared FULL_METADATA fixture', () => {
    it('carries an Ambrosian settings block, and it reaches the inputs', () => {
        // What this CAN check: that the shared fixture publishes a settings block
        // at all, and that whatever it publishes reaches all five inputs — so a
        // suite built on `FULL_METADATA` exercises this path rather than merely
        // believing in it.
        //
        // What no unit test can check: that the block still matches what
        // `/calendars` serves. That is a human obligation, restated in
        // `src/__fixtures__/metadata.js` beside the block itself. The block was
        // removed in `dab21b5` when the API served none and restored once it did;
        // a fixture ahead of OR behind the API turns a green test into a claim
        // about nothing, which is exactly what happened the first time.
        expect(FULL_METADATA.ambrosian_calendars[0].settings).toBeDefined();

        ApiBase.fromMetadata(API_URL, FULL_METADATA);
        const calendarSelect = new CalendarSelect('en').allowNull();
        const riteSelect = new RiteSelect('en');
        const apiOptions = new ApiOptions('en');
        apiOptions
            .linkToCalendarSelect(calendarSelect)
            .linkToRiteSelect(riteSelect);

        chooseRite(riteSelect, Rite.AMBROSIAN);

        const { holydays_of_obligation, ...temporal } =
            FULL_METADATA.ambrosian_calendars[0].settings;
        expect(temporalValues(apiOptions)).toEqual({
            ...temporal,
            eternal_high_priest: String(temporal.eternal_high_priest),
        });
        expect(holydayStates(apiOptions)).toEqual(holydays_of_obligation);
    });
});
