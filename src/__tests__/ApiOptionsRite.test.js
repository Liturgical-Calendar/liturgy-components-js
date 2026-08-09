/** @jest-environment jsdom */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import {
    ApiOptionsFilter,
    CalendarSelectFilter,
    Rite,
    RiteProperties,
} from '../Enums.js';
import PathBuilder from '../PathBuilder/PathBuilder.js';
import Messages from '../Messages.js';

/**
 * Same fixture shape as CalendarSelect.test.js: a Roman diocese (romamo_it),
 * and two Ambrosian dioceses, one (milano_it) whose nation also has a Roman
 * national calendar and one (lugano_ch) whose nation does not.
 *
 * `boston_us` is a second Roman diocese in a DIFFERENT nation, so that
 * per-nation diocese filtering (`linkToNationsSelect`) has something to filter
 * out and can be asserted on.
 *
 * Local rather than the shared `FULL_METADATA`: these assertions need TWO
 * Ambrosian dioceses (one of them under a nation with no national calendar), a
 * `US` calendar whose `epiphany` is visibly non-default, and a `VA` with empty
 * settings. The shared fixture carries none of those.
 */
const METADATA = {
    // Read directly by LocaleInput (constructed by every `new ApiOptions()`),
    // independently of which calendar ends up selected.
    locales: ['en', 'it', 'la'],
    national_calendars: [
        { calendar_id: 'IT', locales: ['it-IT'], settings: {} },
        // Real settings, so a test can assert they reach the inputs. The others
        // stay empty so existing expectations are untouched.
        {
            calendar_id: 'US',
            locales: ['en-US'],
            settings: { epiphany: 'JAN6' },
        },
        // VA has no dioceses, so #addNationOption marks it `selected` by
        // default (CalendarSelect's built-in "General Roman falls back to
        // the Vatican" heuristic) — `settings` must be present so
        // ApiOptions#handleSingleLinkedCalendarSelect can read it at link
        // time without a RiteSelect in the loop.
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
            calendar_id: 'boston_us',
            nation: 'US',
            diocese: 'Archdiocese of Boston',
            locales: ['en-US'],
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
    ambrosian_calendars: [
        { calendar_id: 'ambrosian', rite: 'ambrosian', locales: ['it', 'la'] },
    ],
};

const API_URL = 'http://localhost:8000';

// A fresh registry per test, holding one base built straight from the fixture.
// No `global.fetch` mock at all: nothing here issues a request.
beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, METADATA);
});

// No `CurrentEndpoint` reset helper is needed: each `ApiOptions` constructs its
// own `CurrentEndpoint`, so the `new ApiOptions(...)` in every `beforeEach` below
// IS the reset. Endpoint state set by one test cannot reach the next, and — the
// point of that design — cannot reach another embed on the same page either.

describe('ApiOptions rite orchestration', () => {
    let apiOptions, nationSelect, dioceseSelect, riteSelect;

    beforeEach(() => {
        // Deliberately NOT linked via `linkToNationsSelect()`: that mechanism
        // filters the diocese options down to whichever nation is currently
        // selected (here, the auto-selected VA, which has no dioceses at
        // all), which is an orthogonal concern to the rite chain under test.
        // Leaving them unlinked keeps `dioceseSelect` showing the full,
        // rite-filtered, nation-grouped diocese list.
        nationSelect = new CalendarSelect('en')
            .filter(CalendarSelectFilter.NATIONAL_CALENDARS)
            .allowNull();
        dioceseSelect = new CalendarSelect('en')
            .filter(CalendarSelectFilter.DIOCESAN_CALENDARS)
            .allowNull();

        riteSelect = new RiteSelect('en');
        apiOptions = new ApiOptions('en');
        apiOptions.linkToCalendarSelect(
            [nationSelect, dioceseSelect],
            riteSelect,
        );
    });

    it('hides the nation select for a rite with no national tier', () => {
        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent(new Event('change'));
        // _setHidden targets the wrapper when one was set via wrapper(), and the
        // select itself otherwise. This setup does not call wrapper(), so assert
        // on the select. The wrapper case is covered separately below, driven
        // through the same real ApiOptions + RiteSelect integration path.
        expect(nationSelect._domElement.hidden).toBe(true);
    });

    it('shows the nation select again when returning to Roman', () => {
        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent(new Event('change'));
        // Intermediate assertion: without this, switching Ambrosian -> Roman
        // and asserting only the final `false` would also pass if the
        // Ambrosian hide never fired at all.
        expect(nationSelect._domElement.hidden).toBe(true);

        riteSelect._domElement.value = Rite.ROMAN;
        riteSelect._domElement.dispatchEvent(new Event('change'));
        expect(nationSelect._domElement.hidden).toBe(false);
    });

    it('disables the four fixed temporal inputs under Ambrosian', () => {
        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent(new Event('change'));
        expect(apiOptions._epiphanyInput._domElement.disabled).toBe(true);
        expect(apiOptions._ascensionInput._domElement.disabled).toBe(true);
        expect(apiOptions._corpusChristiInput._domElement.disabled).toBe(true);
        expect(apiOptions._eternalHighPriestInput._domElement.disabled).toBe(
            true,
        );
    });

    it('re-enables them under Roman with no nation or diocese selected', () => {
        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent(new Event('change'));
        // Intermediate assertion, for the same reason as the nation-select
        // round trip above: pins the Ambrosian disabled=true state so this
        // test can actually fail if the Roman re-enable never happens.
        expect(apiOptions._epiphanyInput._domElement.disabled).toBe(true);

        riteSelect._domElement.value = Rite.ROMAN;
        riteSelect._domElement.dispatchEvent(new Event('change'));
        expect(apiOptions._epiphanyInput._domElement.disabled).toBe(false);
        expect(apiOptions._ascensionInput._domElement.disabled).toBe(false);
        expect(apiOptions._corpusChristiInput._domElement.disabled).toBe(false);
        expect(apiOptions._eternalHighPriestInput._domElement.disabled).toBe(
            false,
        );
    });

    it('raises the year floor to 1976 under Ambrosian and restores 1970 under Roman', () => {
        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent(new Event('change'));
        expect(apiOptions._yearInput._domElement.min).toBe('1976');

        riteSelect._domElement.value = Rite.ROMAN;
        riteSelect._domElement.dispatchEvent(new Event('change'));
        expect(apiOptions._yearInput._domElement.min).toBe('1970');
    });

    it('clamps a year below the new floor up to the floor when switching to Ambrosian', () => {
        // Decision 5 of the design: the component must pre-empt a request the
        // API would reject rather than let it through and surface the error.
        // 1970 is a valid Roman year but falls below the Ambrosian floor of
        // 1976 (`AMBROSIAN_YEAR_LOWER_LIMIT`), so simply raising `min` on the
        // input is not enough — an already-entered 1970 would sit below its own
        // floor, an invalid state the API would reject with a 400.
        apiOptions._yearInput._domElement.value = '1970';

        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent(new Event('change'));

        expect(apiOptions._yearInput._domElement.value).toBe('1976');
    });

    it('dispatches a change event on the year input when clamping it', () => {
        apiOptions._yearInput._domElement.value = '1970';
        let changeFired = false;
        apiOptions._yearInput._domElement.addEventListener('change', () => {
            changeFired = true;
        });

        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent(new Event('change'));

        expect(changeFired).toBe(true);
    });

    it('leaves the year value alone when it already meets the new floor', () => {
        apiOptions._yearInput._domElement.value = '2000';
        let changeFired = false;
        apiOptions._yearInput._domElement.addEventListener('change', () => {
            changeFired = true;
        });

        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent(new Event('change'));

        expect(apiOptions._yearInput._domElement.value).toBe('2000');
        expect(changeFired).toBe(false);
    });

    it('hides the wrapper rather than the select itself, on the real ApiOptions + RiteSelect integration path', () => {
        // Driven entirely through `linkToCalendarSelect` + a rite change —
        // not a direct `_setHidden` call — so this actually exercises
        // `#handleLinkedRiteSelect`'s wrapper-aware hiding, not just
        // `CalendarSelect._setHidden` in isolation.
        const wrappedNationSelect = new CalendarSelect('en')
            .filter(CalendarSelectFilter.NATIONAL_CALENDARS)
            .wrapper({ class: 'form-group' })
            .allowNull();
        const localDioceseSelect = new CalendarSelect('en')
            .filter(CalendarSelectFilter.DIOCESAN_CALENDARS)
            .allowNull();
        const localRiteSelect = new RiteSelect('en');
        const localApiOptions = new ApiOptions('en');
        localApiOptions.linkToCalendarSelect(
            [wrappedNationSelect, localDioceseSelect],
            localRiteSelect,
        );

        localRiteSelect._domElement.value = Rite.AMBROSIAN;
        localRiteSelect._domElement.dispatchEvent(new Event('change'));

        expect(wrappedNationSelect._domElement.hidden).toBe(false);
        expect(wrappedNationSelect._wrapperElement.hidden).toBe(true);
    });

    it('labels the empty option per rite in rite-aware mode', () => {
        // Derived from `Messages.en` via `RiteProperties[rite].emptyOptionLabelKey`
        // rather than hard-coded, so a key rename in either place cannot leave
        // this test asserting a stale string that the implementation no longer
        // produces.
        const ambrosianLabel =
            Messages.en[RiteProperties[Rite.AMBROSIAN].emptyOptionLabelKey];
        const romanLabel =
            Messages.en[RiteProperties[Rite.ROMAN].emptyOptionLabelKey];

        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent(new Event('change'));
        expect(dioceseSelect._domElement.innerHTML).toContain(
            `>${ambrosianLabel}<`,
        );

        riteSelect._domElement.value = Rite.ROMAN;
        riteSelect._domElement.dispatchEvent(new Event('change'));
        expect(dioceseSelect._domElement.innerHTML).toContain(
            `>${romanLabel}<`,
        );
    });

    it('resets the calendar selection to the rite-level calendar on rite change', () => {
        dioceseSelect._domElement.value = 'romamo_it';
        expect(dioceseSelect._domElement.value).toBe('romamo_it');

        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent(new Event('change'));
        expect(dioceseSelect._domElement.value).toBe('');
    });

    it("offers only the rite-level calendar's locales for a rite that restricts them", () => {
        // The Ambrosian rite has liturgical books in Italian and Latin only, and
        // the API's metadata says so. Before this, selecting Ambrosian left the
        // locale select offering every locale the API supports globally, so a
        // user could ask for an Ambrosian calendar in a language that has no
        // Ambrosian books behind it.
        const localeOptions = () =>
            [...apiOptions._localeInput._domElement.options].map(
                (o) => o.value,
            );
        expect(localeOptions()).toEqual(['en', 'it', 'la']);

        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent(new Event('change'));
        expect(localeOptions()).toEqual(['it', 'la']);
    });

    it('restores the full locale list for a rite that does not restrict them', () => {
        // The General Roman calendar is served in every locale the API supports,
        // and has no `roman_calendars` entry to narrow from, so the rite-level
        // Roman calendar falls back to the global list.
        const localeOptions = () =>
            [...apiOptions._localeInput._domElement.options].map(
                (o) => o.value,
            );

        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent(new Event('change'));
        expect(localeOptions()).toEqual(['it', 'la']);

        riteSelect._domElement.value = Rite.ROMAN;
        riteSelect._domElement.dispatchEvent(new Event('change'));
        expect(localeOptions()).toEqual(['en', 'it', 'la']);
    });

    it('sets explicitRite when a RiteSelect is linked', () => {
        expect(apiOptions._currentEndpoint.explicitRite).toBe(true);
    });

    it('emits the selected rite in the request path', () => {
        // Pins `apiOptions._currentEndpoint.rite = rite` inside `#handleLinkedRiteSelect`.
        // Asserting `explicitRite` alone does not: with that assignment deleted,
        // `explicitRite` is still true and an Ambrosian selection would silently
        // emit `/calendar/roman/...`.
        expect(apiOptions._currentEndpoint.path).toBe('/calendar/roman');

        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent(new Event('change'));
        expect(apiOptions._currentEndpoint.path).toBe('/calendar/ambrosian');

        riteSelect._domElement.value = Rite.ROMAN;
        riteSelect._domElement.dispatchEvent(new Event('change'));
        expect(apiOptions._currentEndpoint.path).toBe('/calendar/roman');
    });

    it('keeps the fixed temporal inputs disabled after a diocese is selected and then cleared under Ambrosian', () => {
        // The rule is: those four inputs are disabled if the RITE fixes them,
        // OR a nation/diocese is selected. Before this fix only the rite half
        // was implemented, so returning to the rite-level empty option
        // unconditionally re-enabled them — letting a user request
        // `/calendar/ambrosian?ascension=SUNDAY`, which the Ambrosian Missal
        // (praenotanda n. 22) forbids.
        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent(new Event('change'));
        expect(apiOptions._ascensionInput._domElement.disabled).toBe(true);

        dioceseSelect._domElement.value = 'lugano_ch';
        dioceseSelect._domElement.dispatchEvent(new Event('change'));
        expect(apiOptions._ascensionInput._domElement.disabled).toBe(true);

        dioceseSelect._domElement.value = '';
        dioceseSelect._domElement.dispatchEvent(new Event('change'));
        expect(apiOptions._epiphanyInput._domElement.disabled).toBe(true);
        expect(apiOptions._ascensionInput._domElement.disabled).toBe(true);
        expect(apiOptions._corpusChristiInput._domElement.disabled).toBe(true);
        expect(apiOptions._eternalHighPriestInput._domElement.disabled).toBe(
            true,
        );
    });

    it('keeps the fixed temporal inputs disabled after a nation is selected and then cleared under Ambrosian', () => {
        // Same rule, through the nation select's listener. The nation select is
        // hidden under Ambrosian, but hidden is not unreachable: its value can
        // still be set programmatically, and the listener is still attached.
        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent(new Event('change'));

        nationSelect._domElement.value = 'IT';
        nationSelect._domElement.dispatchEvent(new Event('change'));
        expect(apiOptions._ascensionInput._domElement.disabled).toBe(true);

        nationSelect._domElement.value = '';
        nationSelect._domElement.dispatchEvent(new Event('change'));
        expect(apiOptions._epiphanyInput._domElement.disabled).toBe(true);
        expect(apiOptions._ascensionInput._domElement.disabled).toBe(true);
        expect(apiOptions._corpusChristiInput._domElement.disabled).toBe(true);
        expect(apiOptions._eternalHighPriestInput._domElement.disabled).toBe(
            true,
        );
    });

    it('re-enables the fixed temporal inputs on the same round trip under Roman', () => {
        // The control for the two tests above: the nation/diocese half of the
        // rule must still release the inputs when the rite does not fix them.
        dioceseSelect._domElement.value = 'romamo_it';
        dioceseSelect._domElement.dispatchEvent(new Event('change'));
        expect(apiOptions._ascensionInput._domElement.disabled).toBe(true);

        dioceseSelect._domElement.value = '';
        dioceseSelect._domElement.dispatchEvent(new Event('change'));
        expect(apiOptions._epiphanyInput._domElement.disabled).toBe(false);
        expect(apiOptions._ascensionInput._domElement.disabled).toBe(false);
        expect(apiOptions._corpusChristiInput._domElement.disabled).toBe(false);
        expect(apiOptions._eternalHighPriestInput._domElement.disabled).toBe(
            false,
        );
    });
});

describe('ApiOptions paired nation/diocese selects apply the calendar to the inputs', () => {
    // Regression cover for issue #7: the paired form used to update only the
    // temporal input state, leaving the locale select offering every locale the
    // API supports no matter which calendar was chosen, and never applying the
    // calendar's own settings. Pre-existing and not rite-specific.
    let apiOptions, nationSelect, dioceseSelect;

    const localeOptions = () =>
        [...apiOptions._localeInput._domElement.options].map((o) => o.value);

    beforeEach(() => {
        nationSelect = new CalendarSelect('en')
            .filter(CalendarSelectFilter.NATIONAL_CALENDARS)
            .allowNull();
        dioceseSelect = new CalendarSelect('en')
            .filter(CalendarSelectFilter.DIOCESAN_CALENDARS)
            .allowNull();
        apiOptions = new ApiOptions('en');
        apiOptions.linkToCalendarSelect([nationSelect, dioceseSelect]);
    });

    it('narrows the locales to the selected nation', () => {
        nationSelect._domElement.value = 'US';
        nationSelect._domElement.dispatchEvent(new Event('change'));
        expect(localeOptions()).toEqual(['en-US']);
    });

    it('narrows the locales to the selected diocese, which wins over the nation', () => {
        nationSelect._domElement.value = 'US';
        nationSelect._domElement.dispatchEvent(new Event('change'));
        expect(localeOptions()).toEqual(['en-US']);

        // A diocese is the more specific calendar, so its locales take over.
        dioceseSelect._domElement.value = 'romamo_it';
        dioceseSelect._domElement.dispatchEvent(new Event('change'));
        expect(localeOptions()).toEqual(['it-IT']);
    });

    it('falls back from the diocese to the nation when only the diocese is cleared', () => {
        // CalendarSelect auto-selects VA (its "General Roman falls back to the
        // Vatican" heuristic), so clearing the diocese does not leave the pair
        // empty — the nation is still selected and its locales apply.
        dioceseSelect._domElement.value = 'romamo_it';
        dioceseSelect._domElement.dispatchEvent(new Event('change'));
        expect(localeOptions()).toEqual(['it-IT']);

        dioceseSelect._domElement.value = '';
        dioceseSelect._domElement.dispatchEvent(new Event('change'));
        expect(nationSelect._domElement.value).toBe('VA');
        expect(localeOptions()).toEqual(['la', 'it-IT']);
    });

    it('returns to the rite-level locales when both selections are cleared', () => {
        dioceseSelect._domElement.value = 'romamo_it';
        dioceseSelect._domElement.dispatchEvent(new Event('change'));
        expect(localeOptions()).toEqual(['it-IT']);

        dioceseSelect._domElement.value = '';
        dioceseSelect._domElement.dispatchEvent(new Event('change'));
        nationSelect._domElement.value = '';
        nationSelect._domElement.dispatchEvent(new Event('change'));
        expect(localeOptions()).toEqual(['en', 'it', 'la']);
    });

    it("applies the selected calendar's settings to the option inputs", () => {
        // US declares epiphany JAN6 in the fixture. The paired form used to
        // ignore a calendar's settings entirely, so the input kept whatever it
        // held before.
        expect(apiOptions._epiphanyInput._domElement.value).not.toBe('JAN6');

        nationSelect._domElement.value = 'US';
        nationSelect._domElement.dispatchEvent(new Event('change'));

        expect(apiOptions._epiphanyInput._domElement.value).toBe('JAN6');
    });
});

describe('ApiOptions rite-level locales on a single linked CalendarSelect', () => {
    // The paired-select tests above exercise #handleMultipleLinkedCalendarSelects,
    // which never touches the locale input. This describe uses the SINGLE select
    // path, whose change listener resets the locale options whenever the
    // selection is empty — and `applyRite` dispatches exactly that `change` after
    // resetting the selection. Narrowing the locales without making that reset
    // rite-aware is silently undone a moment later, which the paired-select tests
    // cannot see.
    let apiOptions, calendarSelect, riteSelect;

    const localeOptions = () =>
        [...apiOptions._localeInput._domElement.options].map((o) => o.value);

    beforeEach(() => {
        calendarSelect = new CalendarSelect('en').allowNull();
        riteSelect = new RiteSelect('en');
        apiOptions = new ApiOptions('en');
        apiOptions.linkToCalendarSelect(calendarSelect, riteSelect);
    });

    it('survives the change dispatch that applyRite fires after resetting the selection', () => {
        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent(new Event('change'));
        expect(localeOptions()).toEqual(['it', 'la']);
    });

    it('restores the rite-level locales when a calendar is selected and then cleared', () => {
        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent(new Event('change'));

        calendarSelect._domElement.value = 'lugano_ch';
        calendarSelect._domElement.dispatchEvent(new Event('change'));
        expect(localeOptions()).toEqual(['it-IT']);

        calendarSelect._domElement.value = '';
        calendarSelect._domElement.dispatchEvent(new Event('change'));
        expect(localeOptions()).toEqual(['it', 'la']);
    });

    it('leaves the Roman rite offering every locale the API supports', () => {
        expect(localeOptions()).toEqual(['en', 'it', 'la']);

        calendarSelect._domElement.value = '';
        calendarSelect._domElement.dispatchEvent(new Event('change'));
        expect(localeOptions()).toEqual(['en', 'it', 'la']);
    });
});

describe('ApiOptions rite orchestration with a nation-linked diocese select', () => {
    let apiOptions, nationSelect, dioceseSelect, riteSelect;

    beforeEach(() => {
        nationSelect = new CalendarSelect('en')
            .filter(CalendarSelectFilter.NATIONAL_CALENDARS)
            .allowNull();
        dioceseSelect = new CalendarSelect('en')
            .filter(CalendarSelectFilter.DIOCESAN_CALENDARS)
            .allowNull();
        dioceseSelect.linkToNationsSelect(nationSelect);

        riteSelect = new RiteSelect('en');
        apiOptions = new ApiOptions('en');
        apiOptions.linkToCalendarSelect(
            [nationSelect, dioceseSelect],
            riteSelect,
        );
    });

    it('keeps per-nation diocese filtering after a rite change', () => {
        nationSelect._domElement.value = 'IT';
        nationSelect._domElement.dispatchEvent(new Event('change'));
        expect(dioceseSelect._domElement.innerHTML).toContain(
            'value="romamo_it"',
        );
        expect(dioceseSelect._domElement.innerHTML).not.toContain(
            'value="boston_us"',
        );

        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent(new Event('change'));
        // A rite with no national tier has no per-nation filtering to apply:
        // its dioceses are listed flat.
        expect(dioceseSelect._domElement.innerHTML).toContain(
            'value="lugano_ch"',
        );
        expect(dioceseSelect._domElement.innerHTML).toContain(
            'value="milano_it"',
        );

        riteSelect._domElement.value = Rite.ROMAN;
        riteSelect._domElement.dispatchEvent(new Event('change'));
        // The rite change resets the nation selection, so the diocese select
        // must be back to its no-nation-selected state rather than showing the
        // full, unfiltered, every-nation list.
        expect(nationSelect._domElement.value).toBe('');
        expect(dioceseSelect._domElement.innerHTML).not.toContain(
            'value="boston_us"',
        );
        expect(dioceseSelect._domElement.innerHTML).not.toContain(
            'value="romamo_it"',
        );

        nationSelect._domElement.value = 'US';
        nationSelect._domElement.dispatchEvent(new Event('change'));
        expect(dioceseSelect._domElement.innerHTML).toContain(
            'value="boston_us"',
        );
        expect(dioceseSelect._domElement.innerHTML).not.toContain(
            'value="romamo_it"',
        );
    });
});

describe('ApiOptions PATH_BUILDER filter with a linked RiteSelect', () => {
    let apiOptions, calendarSelect, riteSelect;

    beforeEach(() => {
        calendarSelect = new CalendarSelect('en').allowNull();
        riteSelect = new RiteSelect('en');
        apiOptions = new ApiOptions('en').filter(ApiOptionsFilter.PATH_BUILDER);
        apiOptions.linkToCalendarSelect(calendarSelect, riteSelect);
    });

    const nationPathOption = () =>
        apiOptions._calendarPathInput._domElement.querySelector(
            'option[value="/calendar/nation/"]',
        );

    it('disables the nation route for a rite with no national tier', () => {
        expect(nationPathOption().disabled).toBe(false);

        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent(new Event('change'));
        // There is no /calendar/ambrosian/nation/... route: the API rejects a
        // non-null NationalCalendar for the Ambrosian rite outright.
        expect(nationPathOption().disabled).toBe(true);

        riteSelect._domElement.value = Rite.ROMAN;
        riteSelect._domElement.dispatchEvent(new Event('change'));
        expect(nationPathOption().disabled).toBe(false);
    });

    it('falls back to the rite-level route when the nation route was already selected', () => {
        apiOptions._calendarPathInput._domElement.value = '/calendar/nation/';
        apiOptions._calendarPathInput._domElement.dispatchEvent(
            new Event('change'),
        );
        expect(apiOptions._calendarPathInput._domElement.value).toBe(
            '/calendar/nation/',
        );

        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent(new Event('change'));
        expect(apiOptions._calendarPathInput._domElement.value).toBe(
            '/calendar',
        );
    });
});

describe('ApiOptions without a linked RiteSelect (back-compat)', () => {
    it('leaves the empty option as --- when no RiteSelect is linked', () => {
        const plainSelect = new CalendarSelect('en').allowNull();
        const plainApiOptions = new ApiOptions('en');
        plainApiOptions.linkToCalendarSelect(plainSelect);
        expect(plainSelect._domElement.innerHTML).toContain(
            '<option value="">---</option>',
        );
    });

    it('leaves explicitRite false when no RiteSelect is linked', () => {
        const plainSelect = new CalendarSelect('en').allowNull();
        const plainApiOptions = new ApiOptions('en');
        plainApiOptions.linkToCalendarSelect(plainSelect);
        expect(plainApiOptions._currentEndpoint.explicitRite).toBe(false);
    });

    it("keeps a plain embed's path byte-identical when a rite-aware embed is linked alongside it", () => {
        // The reason `CurrentEndpoint` is per-instance rather than a module-level
        // singleton. With statics, `explicitRite` was a global one-way latch: the
        // moment ANY ApiOptions on the page linked a RiteSelect, every other
        // embed — including ones that never opted into rite awareness — started
        // emitting the explicit `/calendar/roman/...` form instead of `/calendar/...`.
        const plainSelect = new CalendarSelect('en').allowNull();
        const plainApiOptions = new ApiOptions('en');
        plainApiOptions.linkToCalendarSelect(plainSelect);

        const riteAwareSelect = new CalendarSelect('en').allowNull();
        const riteAwareApiOptions = new ApiOptions('en');
        riteAwareApiOptions.linkToCalendarSelect(
            riteAwareSelect,
            new RiteSelect('en'),
        );

        expect(riteAwareApiOptions._currentEndpoint.path).toBe(
            '/calendar/roman',
        );
        expect(plainApiOptions._currentEndpoint.explicitRite).toBe(false);
        expect(plainApiOptions._currentEndpoint.path).toBe('/calendar');
    });

    it("keeps a plain embed's path unchanged when a rite-aware embed switches rite", () => {
        const plainSelect = new CalendarSelect('en').allowNull();
        const plainApiOptions = new ApiOptions('en');
        plainApiOptions.linkToCalendarSelect(plainSelect);

        const riteAwareSelect = new CalendarSelect('en').allowNull();
        const riteAwareApiOptions = new ApiOptions('en');
        const riteAwareRiteSelect = new RiteSelect('en');
        riteAwareApiOptions.linkToCalendarSelect(
            riteAwareSelect,
            riteAwareRiteSelect,
        );

        riteAwareRiteSelect._domElement.value = Rite.AMBROSIAN;
        riteAwareRiteSelect._domElement.dispatchEvent(new Event('change'));

        expect(riteAwareApiOptions._currentEndpoint.path).toBe(
            '/calendar/ambrosian',
        );
        expect(plainApiOptions._currentEndpoint.rite).toBe(Rite.ROMAN);
        expect(plainApiOptions._currentEndpoint.path).toBe('/calendar');
    });

    it('hides no nation select and disables no input by rite when no RiteSelect is linked', () => {
        // Structurally guaranteed today by the `if (null !== riteSelect)` gate
        // in `linkToCalendarSelect` — this test exists so a future refactor
        // that moves rite side effects out from behind that gate breaks a
        // test, not just an invariant nobody is checking.
        const plainNationSelect = new CalendarSelect('en')
            .filter(CalendarSelectFilter.NATIONAL_CALENDARS)
            .allowNull();
        const plainDioceseSelect = new CalendarSelect('en')
            .filter(CalendarSelectFilter.DIOCESAN_CALENDARS)
            .allowNull();
        const plainApiOptions = new ApiOptions('en');
        plainApiOptions.linkToCalendarSelect([
            plainNationSelect,
            plainDioceseSelect,
        ]);

        expect(plainNationSelect._domElement.hidden).toBe(false);
        expect(plainApiOptions._epiphanyInput._domElement.disabled).toBe(false);
        expect(plainApiOptions._ascensionInput._domElement.disabled).toBe(
            false,
        );
        expect(plainApiOptions._corpusChristiInput._domElement.disabled).toBe(
            false,
        );
        expect(
            plainApiOptions._eternalHighPriestInput._domElement.disabled,
        ).toBe(false);
    });
});

describe('ApiOptions.linkToCalendarSelect validation order', () => {
    it('throws the existing calendarSelect validation error, and leaves CurrentEndpoint untouched, when riteSelect is valid but calendarSelect is not', () => {
        const validRiteSelect = new RiteSelect('en');
        const notACalendarSelect = {};
        const apiOptionsUnderTest = new ApiOptions('en');

        expect(() =>
            apiOptionsUnderTest.linkToCalendarSelect(
                [notACalendarSelect],
                validRiteSelect,
            ),
        ).toThrow(/Invalid type for items passed in parameter/);

        // Proves the rite side effects (CurrentEndpoint mutation, listener
        // attachment, _applyRite) never fired before the throw: had they run
        // first, explicitRite would already be true by the time the
        // calendarSelect validation rejected the array.
        expect(apiOptionsUnderTest._currentEndpoint.explicitRite).toBe(false);
    });
});

describe('ApiOptions + PathBuilder: displayed path refreshes after a rite change', () => {
    /**
     * `PathBuilder` renders its `<code>` path from a `change` listener on the
     * calendar select it was constructed with. `#handleLinkedRiteSelect` resets
     * the selection with `cs._domElement.value = ''`, a direct property
     * assignment that the DOM does NOT turn into a `change` event on its own —
     * so without dispatching one explicitly, the rendered path stays stale,
     * still showing whatever was selected before the rite change.
     */
    let apiOptions, calendarSelect, riteSelect, pathBuilder, container;

    beforeEach(() => {
        calendarSelect = new CalendarSelect('en').allowNull();
        riteSelect = new RiteSelect('en');
        apiOptions = new ApiOptions('en');
        apiOptions.linkToCalendarSelect(calendarSelect, riteSelect);
        pathBuilder = new PathBuilder(apiOptions, calendarSelect);
        container = document.createElement('div');
        pathBuilder.appendTo(container);
    });

    // The second <code> element in PathBuilder's markup is the rendered path;
    // the first is the static "GET" label.
    const displayedPath = () =>
        container.querySelectorAll('code')[1].textContent;

    it('drops the calendar from the path when the empty option is selected', () => {
        // PathBuilder's calendar-select listener switches on data-calendartype
        // with cases for `national` and `diocesan`. The empty option carries
        // neither, so without a default branch the previously selected calendar
        // stayed in the endpoint forever. Independent of rite: reproduced on
        // main by picking a diocese in examples/PathBuilder and then
        // re-selecting the empty option, which left the diocese in the path.
        calendarSelect._domElement.value = 'romamo_it';
        calendarSelect._domElement.dispatchEvent(new Event('change'));
        expect(displayedPath()).toContain('/diocese/romamo_it');

        calendarSelect._domElement.value = '';
        calendarSelect._domElement.dispatchEvent(new Event('change'));
        expect(displayedPath()).not.toContain('/diocese/');
        expect(displayedPath()).toContain('/calendar/roman');
    });

    it('still repaints the path when the select has no option matching its value', () => {
        // `allowNull(false)` (which the PATH_BUILDER filter applies) removes the
        // empty option, so after a rite change the select's value is '' with no
        // option to match — `selectedOptions[0]` is undefined. Reading
        // `.getAttribute` off it threw inside the listener, and because the DOM
        // swallows listener exceptions the endpoint updated while the rendered
        // path silently kept its previous value.
        calendarSelect._domElement.value = 'romamo_it';
        calendarSelect._domElement.dispatchEvent(new Event('change'));
        expect(displayedPath()).toContain('/diocese/romamo_it');

        // Drop every option, so nothing can be selected.
        calendarSelect._domElement.innerHTML = '';
        expect(calendarSelect._domElement.selectedOptions.length).toBe(0);

        expect(() =>
            calendarSelect._domElement.dispatchEvent(new Event('change')),
        ).not.toThrow();
        expect(displayedPath()).not.toContain('/diocese/');
    });

    it('refreshes the displayed path after a rite change resets the selection', () => {
        calendarSelect._domElement.value = 'romamo_it';
        calendarSelect._domElement.dispatchEvent(new Event('change'));
        expect(displayedPath()).toContain('/calendar/roman/diocese/romamo_it');

        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent(new Event('change'));

        expect(calendarSelect._domElement.value).toBe('');
        expect(apiOptions._currentEndpoint.path).toBe('/calendar/ambrosian');
        expect(displayedPath()).toContain('/calendar/ambrosian');
        expect(displayedPath()).not.toContain('romamo_it');
    });

    it('does not undo the reset: the calendar selection stays empty after the refresh dispatch', () => {
        calendarSelect._domElement.value = 'romamo_it';
        calendarSelect._domElement.dispatchEvent(new Event('change'));

        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent(new Event('change'));

        expect(calendarSelect._domElement.value).toBe('');
    });

    it('does not re-enter applyRite: a rite change settles on a stable rite rather than looping', () => {
        // Dispatching `change` on the CALENDAR select must not, in turn,
        // trigger the RITE select's `change` listener (the only trigger for
        // `applyRite`). If it did, `apiOptions._currentEndpoint.rite` could not be trusted
        // to hold the rite that was just selected.
        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent(new Event('change'));
        expect(apiOptions._currentEndpoint.rite).toBe(Rite.AMBROSIAN);
        expect(riteSelect._domElement.value).toBe(Rite.AMBROSIAN);
    });
});
