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

describe('CalendarResourcePicker placeholder', () => {
    /**
     * @returns {CalendarResourcePicker} A mounted diocesan picker with a placeholder.
     */
    const mountDiocesan = () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
            placeholderText: 'Select calendar ID...',
        });
        picker.appendTo('#mount');
        return picker;
    };

    it('renders the placeholder as a disabled, selected empty option', () => {
        const picker = mountDiocesan();
        const option =
            picker.calendarSelect._domElement.querySelector('option[value=""]');
        expect(option).not.toBeNull();
        expect(option.textContent).toBe('Select calendar ID...');
        expect(option.disabled).toBe(true);
        expect(option.selected).toBe(true);
    });

    // linkToRiteSelect() rebuilds the option list from scratch, which discards the
    // placeholder customization. Three frontend files re-register this by hand.
    it('re-applies the placeholder after a rite change', () => {
        const picker = mountDiocesan();
        picker.riteSelect._domElement.value = 'ambrosian';
        picker.riteSelect._domElement.dispatchEvent(
            new Event('change', { bubbles: true }),
        );

        const option =
            picker.calendarSelect._domElement.querySelector('option[value=""]');
        expect(option).not.toBeNull();
        expect(option.textContent).toBe('Select calendar ID...');
        expect(option.disabled).toBe(true);
    });

    it('rebuilds the calendar options for the selected rite', () => {
        const picker = mountDiocesan();
        const idsBefore = Array.from(
            picker.calendarSelect._domElement.options,
        ).map((o) => o.value);
        expect(idsBefore).toContain('romamo_it');

        picker.riteSelect._domElement.value = 'ambrosian';
        picker.riteSelect._domElement.dispatchEvent(
            new Event('change', { bubbles: true }),
        );

        const idsAfter = Array.from(
            picker.calendarSelect._domElement.options,
        ).map((o) => o.value);
        expect(idsAfter).not.toContain('romamo_it');
        expect(idsAfter).toContain('milano_it');
    });

    it('leaves no placeholder text when none was supplied', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        picker.appendTo('#mount');
        const option =
            picker.calendarSelect._domElement.querySelector('option[value=""]');
        expect(option.disabled).toBe(false);
    });
});

describe('CalendarResourcePicker onChange', () => {
    it('fires with the selected id when the calendar select changes', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        picker.appendTo('#mount');
        const seen = [];
        picker.onChange((value) => seen.push(value));

        picker.calendarSelect._domElement.value = 'IT';
        picker.calendarSelect._domElement.dispatchEvent(
            new Event('change', { bubbles: true }),
        );

        expect(seen).toEqual(['IT']);
    });

    it('is chainable', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        expect(picker.onChange(() => {})).toBe(picker);
    });

    // admin-tests.js:692 listens on the mount, not on the select.
    it('lets change events bubble to the mount', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        picker.appendTo('#mount');
        let bubbled = false;
        document
            .getElementById('mount')
            .addEventListener('change', () => (bubbled = true));

        picker.calendarSelect._domElement.dispatchEvent(
            new Event('change', { bubbles: true }),
        );
        expect(bubbled).toBe(true);
    });
});

// I3: `labelText` is the theme bag's escape hatch for a themed child's label TEXT.
// `CalendarSelect.label()`/`RiteSelect.label()` are one-shot, so once the theme bag
// has already called `label()` (because `label`/`labelClass` was themed), reaching
// `picker.calendarSelect.label({ text: … })` afterwards throws — `labelText` is the
// only way to set custom text on an already-themed child.
describe('CalendarResourcePicker theme labelText', () => {
    it('overrides the calendar select label text', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
            theme: {
                label: 'form-label',
                calendarSelect: { labelText: 'Choose a calendar' },
            },
        });
        picker.appendTo('#mount');
        expect(
            picker.calendarSelect._domElement.previousElementSibling
                .textContent,
        ).toBe('Choose a calendar');
    });

    it('overrides the rite select label text', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
            theme: {
                label: 'form-label',
                riteSelect: { labelText: 'Choose a rite' },
            },
        });
        picker.appendTo('#mount');
        expect(
            picker.riteSelect._domElement.previousElementSibling.textContent,
        ).toBe('Choose a rite');
    });
});

// I4: `CalendarSelect.label()` used to have no English fallback of its own — it
// read `Messages[language]['SELECT_A_CALENDAR']` directly, which threw for a
// locale outside the catalogue until issue #69 routed it through `message()`.
// The picker must still never reach that code path with no `text`, whatever
// locale it was built with: the assertion here is about the picker's own
// contract, not about the throw that used to back it.
// I7: an explicitly-`undefined` per-child override key is the ordinary shape
// `theme: { riteSelect: { class: config.riteClass } }` takes when `config.riteClass`
// is absent — not a contrived input. It must fall back to the flat default rather
// than reach `RiteSelect.class( undefined )`, which throws.
describe('CalendarResourcePicker with an explicitly-undefined theme override', () => {
    it('falls back to the flat class default instead of throwing', () => {
        expect(() => {
            const picker = new CalendarResourcePicker({
                locale: 'en',
                filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
                theme: {
                    select: 'form-select',
                    riteSelect: { class: undefined },
                },
            });
            picker.appendTo('#mount');
        }).not.toThrow();
    });

    it('applies the flat class to the rite select in that case', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
            theme: { select: 'form-select', riteSelect: { class: undefined } },
        });
        picker.appendTo('#mount');
        expect(picker.riteSelect._domElement.className).toBe('form-select');
    });
});

describe('CalendarResourcePicker with a locale outside the message catalogue', () => {
    it('does not throw when the theme sets a flat label class', () => {
        expect(() => {
            const picker = new CalendarResourcePicker({
                locale: 'ceb',
                filter: CalendarSelectFilter.NATIONAL_CALENDARS,
                theme: { label: 'form-label' },
            });
            picker.appendTo('#mount');
        }).not.toThrow();
    });

    it('falls back to the English label text', () => {
        const picker = new CalendarResourcePicker({
            locale: 'ceb',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
            theme: { label: 'form-label' },
        });
        picker.appendTo('#mount');
        expect(
            picker.calendarSelect._domElement.previousElementSibling
                .textContent,
        ).toBe('Select a calendar');
    });
});
