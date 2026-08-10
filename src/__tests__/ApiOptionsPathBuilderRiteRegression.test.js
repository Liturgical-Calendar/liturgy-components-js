/** @jest-environment jsdom */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import { ApiOptionsFilter, Rite } from '../Enums.js';
import Messages from '../Messages.js';

/**
 * Reproduces what the frontend's API explorer (index.php) builds: ONE `none`
 * filtered, `allowNull` CalendarSelect with a wrapper, driven by both a
 * PATH_BUILDER filtered ApiOptions and a RiteSelect.
 *
 * The wrapper matters: `CalendarSelect._setHidden()` prefers it over the select
 * element, so the reported "the CalendarSelect disappears" is a hidden WRAPPER.
 */
const METADATA = {
    locales: ['en', 'it', 'la'],
    national_calendars: [
        { calendar_id: 'IT', locales: ['it-IT'], settings: {} },
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
    ],
    ambrosian_calendars: [
        { calendar_id: 'ambrosian', rite: 'ambrosian', locales: ['it', 'la'] },
    ],
};

const API_URL = 'http://localhost:8000';

let apiOptions;
let calendarSelect;
let riteSelect;
let pathElement;
let wrapperElement;

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, METADATA);

    document.body.innerHTML =
        '<div id="pathBuilder"></div><div id="rite"></div>';

    apiOptions = new ApiOptions('en');
    apiOptions.filter(ApiOptionsFilter.PATH_BUILDER).appendTo('#pathBuilder');

    calendarSelect = new CalendarSelect('en').allowNull();
    calendarSelect
        .label({ text: 'Select a calendar' })
        .wrapper({ class: 'form-group', id: 'calendarSelectWrapper' })
        .id('APICalendarSelect')
        .insertAfter(apiOptions._calendarPathInput);

    riteSelect = new RiteSelect('en');
    riteSelect.appendTo('#rite');

    apiOptions
        .linkToCalendarSelect(calendarSelect)
        .linkToRiteSelect(riteSelect);

    pathElement = apiOptions._calendarPathInput._domElement;
    wrapperElement = document.getElementById('calendarSelectWrapper');
});

/** Drive the path select the way a user clicking through the builder does. */
const selectPath = (value) => {
    pathElement.value = value;
    pathElement.dispatchEvent(new Event('change'));
};

/** Drive the rite select the same way. */
const selectRite = (value) => {
    riteSelect._domElement.value = value;
    riteSelect._domElement.dispatchEvent(new Event('change'));
};

/** What the user actually sees in the closed select. */
const displayedText = () => {
    const el = calendarSelect._domElement;
    return el.selectedIndex === -1
        ? null
        : el.options[el.selectedIndex].textContent;
};

describe('PathBuilder + RiteSelect: the rite-level calendar option', () => {
    /**
     * Regression, first half. `#handleSingleLinkedCalendarSelect` collapsed the
     * select at link time but ALSO called `allowNull(false)`. The rite wiring
     * runs afterwards (the calendar select is linked first) and rebuilt the
     * options from scratch, which dropped the empty option entirely now that
     * `allowNull` was false; `#applyLinkedRite` then set `value = ''`, matching
     * no option, so `selectedIndex` was -1 and the select rendered blank until
     * the user happened to switch routes and come back.
     */
    it('shows the rite-level calendar on load, not a blank select', () => {
        expect(pathElement.value).toBe('/calendar');
        expect(displayedText()).toBe(Messages['en'].GENERAL_ROMAN_CALENDAR);
    });

    /**
     * Regression, second half. Returning to `/calendar` re-injected a hardcoded,
     * unlocalized English `GENERAL ROMAN` option regardless of the selected rite,
     * so an Ambrosian request announced itself as the General Roman Calendar.
     */
    it('names the Ambrosian rite-level calendar when Ambrosian is selected', () => {
        selectRite(Rite.AMBROSIAN);
        selectPath('/calendar/diocese/');
        selectPath('/calendar');

        expect(displayedText()).toBe(Messages['en'].AMBROSIAN_CALENDAR);
    });

    it('still names the General Roman calendar under the Roman rite', () => {
        selectPath('/calendar/diocese/');
        selectPath('/calendar');

        expect(displayedText()).toBe(Messages['en'].GENERAL_ROMAN_CALENDAR);
    });
});

describe('PathBuilder + RiteSelect: switching to a rite with no national tier', () => {
    /**
     * Regression. From `/calendar/nation/`, selecting Ambrosian hid the select —
     * correct in itself, as there is no Ambrosian national tier. ApiOptions then
     * forced the path back to `/calendar` and the filter off NATIONAL_CALENDARS,
     * and nothing unhid it again: `_setHidden(false)` was reachable only from the
     * NATIONAL_CALENDARS branch of `#applyLinkedRite`, and the nation route that
     * would return there is disabled under precisely this rite. The select was
     * gone for good.
     */
    it('does not leave the calendar select hidden after the forced fallback', () => {
        selectPath('/calendar/nation/');
        expect(wrapperElement.hidden).toBe(false);

        selectRite(Rite.AMBROSIAN);

        // The path input falls back, since /calendar/ambrosian/nation/ has no
        // route behind it.
        expect(pathElement.value).toBe('/calendar');
        // ...and having fallen back, the select is showing the rite-level
        // calendar, so it must be visible.
        expect(wrapperElement.hidden).toBe(false);
    });

    it('is recoverable: going back to the Roman rite restores a usable select', () => {
        selectPath('/calendar/nation/');
        selectRite(Rite.AMBROSIAN);
        selectRite(Rite.ROMAN);

        expect(wrapperElement.hidden).toBe(false);
    });

    it('can still reach the diocese path after the forced fallback', () => {
        selectPath('/calendar/nation/');
        selectRite(Rite.AMBROSIAN);
        selectPath('/calendar/diocese/');

        expect(wrapperElement.hidden).toBe(false);
        const values = [...calendarSelect._domElement.options].map(
            (o) => o.value,
        );
        expect(values).toContain('milano_it');
        expect(values).not.toContain('romamo_it');
    });
});
