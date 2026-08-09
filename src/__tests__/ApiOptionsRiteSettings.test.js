/** @jest-environment jsdom */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import { Rite } from '../Enums.js';

/**
 * The national-settings lookup for a DIOCESAN selection, one layer up from the
 * `CalendarSelect` crash this branch fixes.
 *
 * `IT` carries settings that are visibly non-default, so an Ambrosian Italian
 * diocese wrongly inheriting them is observable rather than merely suspected:
 * `milano_it` is Ambrosian but its nation is `IT`, which DOES have a Roman
 * national calendar. `lugano_ch` is the loud case — nation `CH` has no Roman
 * national calendar at all, so the lookup returns `undefined` and dereferencing
 * `.settings` throws.
 *
 * Local rather than the shared `FULL_METADATA`: both of those cases need a
 * diocese under a nation with no national calendar, and an `IT` whose four
 * temporal settings are visibly non-default. The shared fixture has neither.
 */
const METADATA = {
    locales: ['en', 'it', 'la'],
    national_calendars: [
        {
            calendar_id: 'IT',
            locales: ['it-IT'],
            settings: {
                epiphany: 'SUNDAY_JAN2_JAN8',
                ascension: 'SUNDAY',
                corpus_christi: 'SUNDAY',
                eternal_high_priest: true,
            },
        },
        { calendar_id: 'VA', locales: ['la', 'it-IT'], settings: {} },
    ],
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
            diocese: 'Diocesi di Milano',
            locales: ['it-IT'],
            rite: 'ambrosian',
        },
        {
            calendar_id: 'lugano_ch',
            nation: 'CH',
            diocese: 'Diocesi di Lugano',
            locales: ['it-IT'],
            rite: 'ambrosian',
        },
    ],
    ambrosian_calendars: [{ calendar_id: 'ambrosian' }],
};

const API_URL = 'http://localhost:8000';

// A fresh registry per test, holding one base built straight from the fixture.
// No `global.fetch` mock at all: nothing here issues a request.
beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, METADATA);
});

// No `CurrentEndpoint` reset is needed here: each `ApiOptions` constructs its
// own, so endpoint state cannot leak between tests.

/**
 * Runs `fn` and returns whatever errors were thrown from inside DOM event
 * listeners while it ran.
 *
 * An exception thrown inside a `change` listener does NOT propagate out of
 * `dispatchEvent()` — the DOM reports it to the global error handler instead.
 * That is precisely why this crash surfaced as an unlabelled unhandled
 * exception in the frontend, and it is why asserting `not.toThrow()` around a
 * `dispatchEvent()` call would be a test that cannot fail. Listening for the
 * `error` event is what makes the assertion real.
 *
 * @param {Function} fn
 * @returns {Error[]}
 */
function errorsThrownInListeners(fn) {
    const errors = [];
    const handler = (ev) => {
        errors.push(ev.error ?? new Error(ev.message));
        ev.preventDefault();
    };
    window.addEventListener('error', handler);
    try {
        fn();
    } finally {
        window.removeEventListener('error', handler);
    }
    return errors;
}

/**
 * Builds a rite-aware single-select setup: one `none` filtered CalendarSelect
 * driven by a RiteSelect through ApiOptions, which is the path that reads a
 * diocese's national settings.
 */
function buildRiteAwareSetup() {
    const calendarSelect = new CalendarSelect('en').allowNull();
    const riteSelect = new RiteSelect('en');
    const apiOptions = new ApiOptions('en');
    apiOptions.linkToCalendarSelect(calendarSelect, riteSelect);
    return { calendarSelect, riteSelect, apiOptions };
}

describe('ApiOptions national settings lookup for a rite with no national tier', () => {
    it('does not throw when an Ambrosian diocese whose nation has no national calendar is selected', () => {
        const { calendarSelect, riteSelect } = buildRiteAwareSetup();

        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent(new Event('change'));

        calendarSelect._domElement.value = 'lugano_ch';
        expect(calendarSelect._domElement.value).toBe('lugano_ch');

        const errors = errorsThrownInListeners(() => {
            calendarSelect._domElement.dispatchEvent(new Event('change'));
        });
        expect(errors).toEqual([]);
    });

    it('does not throw when a preselected Ambrosian diocese is read at link time', () => {
        // The same lookup, in the branch that runs during `linkToCalendarSelect`
        // rather than in the change listener. Here the rite comes from the
        // constructor option rather than from a RiteSelect, so this also pins
        // that the fix is keyed on the select's rite and not on the presence of
        // a linked RiteSelect.
        const calendarSelect = new CalendarSelect({
            locale: 'en',
            rite: Rite.AMBROSIAN,
        }).allowNull();
        calendarSelect._domElement.value = 'lugano_ch';
        // Guards the assignment above: if `lugano_ch` were not a valid option
        // on this select (e.g. rite filtering excluded it), the assignment
        // would silently no-op and leave the value at '', and the
        // `not.toThrow()` below would then be exercising the EMPTY-selection
        // branch of `linkToCalendarSelect` rather than the diocesan-settings
        // lookup this test is actually about.
        expect(calendarSelect._domElement.value).toBe('lugano_ch');
        const apiOptions = new ApiOptions('en');

        expect(() =>
            apiOptions.linkToCalendarSelect(calendarSelect),
        ).not.toThrow();
    });

    it("does not apply the nation's Roman settings to an Ambrosian diocese of that nation", () => {
        const { calendarSelect, riteSelect, apiOptions } =
            buildRiteAwareSetup();

        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent(new Event('change'));

        calendarSelect._domElement.value = 'milano_it';
        calendarSelect._domElement.dispatchEvent(new Event('change'));

        // Italy's Roman settings are epiphany=SUNDAY_JAN2_JAN8, ascension=SUNDAY,
        // corpus_christi=SUNDAY, eternal_high_priest=true. None of them may reach
        // an Ambrosian diocese: the Ambrosian rite has no national tier to inherit
        // from, and its Missal fixes all four celebrations itself.
        expect(apiOptions._epiphanyInput._domElement.value).toBe('');
        expect(apiOptions._ascensionInput._domElement.value).toBe('');
        expect(apiOptions._corpusChristiInput._domElement.value).toBe('');
        // `EternalHighPriestInput` has no empty option — its untouched value is
        // the literal 'false' — so the assertion is that Italy's `true` never
        // reached it.
        expect(apiOptions._eternalHighPriestInput._domElement.value).toBe(
            'false',
        );
    });

    it("still applies the nation's settings to a Roman diocese of that nation", () => {
        // The control for the two tests above: skipping the lookup must be
        // conditional on the rite having no national tier, not unconditional.
        const { calendarSelect, apiOptions } = buildRiteAwareSetup();

        calendarSelect._domElement.value = 'romamo_it';
        calendarSelect._domElement.dispatchEvent(new Event('change'));

        expect(apiOptions._epiphanyInput._domElement.value).toBe(
            'SUNDAY_JAN2_JAN8',
        );
        expect(apiOptions._ascensionInput._domElement.value).toBe('SUNDAY');
        expect(apiOptions._corpusChristiInput._domElement.value).toBe('SUNDAY');
        expect(apiOptions._eternalHighPriestInput._domElement.value).toBe(
            'true',
        );
    });
});
