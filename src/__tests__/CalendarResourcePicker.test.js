/** @jest-environment jsdom */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import CalendarResourcePicker from '../MetaComponents/CalendarResourcePicker.js';
import { CalendarSelectFilter } from '../Enums.js';

// Two Ambrosian dioceses and one Roman one, so that a rite change is observable
// as a change of options rather than merely a change of count.
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

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, METADATA);
    document.body.innerHTML = '<div id="mount"></div>';
});

describe('CalendarResourcePicker construction', () => {
    it('builds a rite select for a diocesan filter', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
        });
        expect(picker.riteSelect).not.toBeNull();
        expect(picker.calendarSelect).not.toBeNull();
    });

    // The Ambrosian rite has no national tier: a nations-filtered select under it
    // holds only the rite-level calendar and hides itself, stranding the user with
    // a required field they cannot fill.
    it('builds no rite select for a national filter', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        expect(picker.riteSelect).toBeNull();
    });

    it('rejects a filter that is neither national nor diocesan', () => {
        expect(
            () =>
                new CalendarResourcePicker({
                    locale: 'en',
                    filter: CalendarSelectFilter.NONE,
                }),
        ).toThrow(/CalendarResourcePicker.*filter/);
    });

    it('rejects an unparseable locale rather than falling back to English', () => {
        expect(
            () =>
                new CalendarResourcePicker({
                    locale: 'not a locale',
                    filter: CalendarSelectFilter.NATIONAL_CALENDARS,
                }),
        ).toThrow(/CalendarResourcePicker/);
    });

    it('applies the theme to both children', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
            theme: {
                select: 'form-select',
                riteSelect: { class: 'form-select mb-2' },
            },
        });
        picker.appendTo('#mount');
        expect(
            document.querySelector('#mount select.form-select.mb-2'),
        ).not.toBeNull();
        const calendarEl = picker.calendarSelect._domElement;
        expect(calendarEl.className).toBe('form-select');
    });
});

describe('CalendarResourcePicker mounting', () => {
    it('mounts the rite select before the calendar select', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
        });
        picker.appendTo('#mount');
        const selects = document.querySelectorAll('#mount select');
        expect(selects.length).toBeGreaterThanOrEqual(2);
        expect(selects[0]).toBe(picker.riteSelect._domElement);
    });

    it('returns undefined from appendTo, per library convention', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        expect(picker.appendTo('#mount')).toBeUndefined();
    });

    it('accepts an HTMLElement as well as a selector', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        picker.appendTo(document.getElementById('mount'));
        expect(document.querySelector('#mount select')).not.toBeNull();
    });

    it('throws when the mount target matches nothing', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        expect(() => picker.appendTo('#nope')).toThrow(/nope/);
    });

    it('reports the selected calendar id through value', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        picker.appendTo('#mount');
        picker.calendarSelect._domElement.value = 'IT';
        expect(picker.value).toBe('IT');
    });

    it('starts out not failed', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        expect(picker.failed).toBe(false);
    });
});
