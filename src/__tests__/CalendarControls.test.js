/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import CalendarControls from '../MetaComponents/CalendarControls.js';
import { ApiOptionsFilter } from '../Enums.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';
import Messages from '../Messages.js';

const API_URL = 'http://localhost:8000';

/**
 * Records every URL requested, answering each with an empty but well-formed
 * calendar payload. Assertions are about which path was requested, never about
 * the response.
 *
 * @returns {string[]} The live list of requested URLs.
 */
const captureRequests = () => {
    const urls = [];
    global.fetch = jest.fn((url) => {
        urls.push(String(url));
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
    return urls;
};

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.replaceChildren();
    const mount = document.createElement('div');
    mount.id = 'mount';
    document.body.appendChild(mount);
});

describe('CalendarControls construction', () => {
    it('builds all three children', () => {
        const controls = new CalendarControls({ locale: 'en' });
        expect(controls.riteSelect).not.toBeNull();
        expect(controls.calendarSelect).not.toBeNull();
        expect(controls.apiOptions).not.toBeNull();
    });

    it('rejects an unparseable locale, naming this component', () => {
        expect(() => new CalendarControls({ locale: 'not a locale' })).toThrow(
            /CalendarControls/,
        );
    });

    it('rejects a malformed theme, naming this component', () => {
        expect(
            () => new CalendarControls({ locale: 'en', theme: 'form-select' }),
        ).toThrow(/CalendarControls.*theme/);
    });

    it('applies the theme to the children', () => {
        const controls = new CalendarControls({
            locale: 'en',
            theme: {
                select: 'form-select',
                riteSelect: { class: 'form-select mb-2' },
            },
        });
        controls.appendTo('#mount');
        expect(controls.riteSelect._domElement.className).toBe(
            'form-select mb-2',
        );
        expect(controls.calendarSelect._domElement.className).toBe(
            'form-select',
        );
    });

    // Regression coverage for a Critical fix-round finding: theming only the
    // calendar select's labelClass (no labelText) used to assign `text:
    // undefined` as an OWN property, which CalendarSelect.label() rejects.
    it('themes the calendar select label class without a labelText, falling back to the catalogue text', () => {
        const controls = new CalendarControls({
            locale: 'en',
            theme: { calendarSelect: { labelClass: 'form-label' } },
        });
        controls.appendTo('#mount');
        const label =
            controls.calendarSelect._domElement.previousElementSibling;
        expect(label.tagName).toBe('LABEL');
        expect(label.className).toBe('form-label');
        expect(label.textContent).toBe(Messages['en']['SELECT_A_CALENDAR']);
    });

    // The flat `{ select, label }` bag is the simplest theme the API accepts —
    // the canonical first thing a Bootstrap consumer writes — and must not throw.
    it('themes both selects from the flat { select, label } bag without throwing', () => {
        const controls = new CalendarControls({
            locale: 'en',
            theme: { select: 'form-select', label: 'form-label' },
        });
        expect(() => controls.appendTo('#mount')).not.toThrow();
        const calendarLabel =
            controls.calendarSelect._domElement.previousElementSibling;
        expect(calendarLabel.className).toBe('form-label');
        expect(calendarLabel.textContent).toBe(
            Messages['en']['SELECT_A_CALENDAR'],
        );
    });

    // I1: `filter ?? ApiOptionsFilter.ALL_CALENDARS` used to default `null`
    // (== `ApiOptionsFilter.NONE`) exactly as it defaults `undefined`,
    // silently converting an explicitly-requested `NONE` into
    // `ALL_CALENDARS`. `NONE` renders EVERY `ApiOptions` input unfiltered —
    // both the ALL_CALENDARS set (locale, year type, accept header, year)
    // AND the GENERAL_ROMAN set (epiphany, ascension, corpus christi,
    // eternal high priest, holydays of obligation) — so the epiphany input
    // landing in the DOM is a fact ALL_CALENDARS alone can never produce.
    it('honours ApiOptionsFilter.NONE rather than silently defaulting to ALL_CALENDARS', () => {
        const controls = new CalendarControls({
            locale: 'en',
            filter: ApiOptionsFilter.NONE,
        });
        controls.appendTo('#mount');
        const mount = document.getElementById('mount');
        expect(
            mount.contains(controls.apiOptions._epiphanyInput._domElement),
        ).toBe(true);
    });

    it('still defaults an omitted filter to ALL_CALENDARS, not NONE', () => {
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#mount');
        const mount = document.getElementById('mount');
        expect(
            mount.contains(controls.apiOptions._epiphanyInput._domElement),
        ).toBe(false);
    });

    // I2: `ApiOptions.filter()`'s own thrown message ("Invalid filter: …")
    // names neither `ApiOptions` nor `CalendarControls` — validating locally
    // reports the failure under the class the caller actually constructed.
    it('rejects an invalid filter, naming this component', () => {
        expect(
            () => new CalendarControls({ locale: 'en', filter: 'bogus' }),
        ).toThrow(/CalendarControls.*filter/);
    });

    it('still applies a themed labelText on the calendar select', () => {
        const controls = new CalendarControls({
            locale: 'en',
            theme: {
                calendarSelect: {
                    labelClass: 'form-label',
                    labelText: 'Choose a calendar',
                },
            },
        });
        controls.appendTo('#mount');
        const label =
            controls.calendarSelect._domElement.previousElementSibling;
        expect(label.className).toBe('form-label');
        expect(label.textContent).toBe('Choose a calendar');
    });
});

// Issue #56: `CalendarControls` previously had no notion of the `ApiOptions`
// inputs it wraps, so `theme.localeInput` — and the flat `select`/`label`/
// `wrapper` defaults — reached `riteSelect` and `calendarSelect` but never the
// locale input. Both behaviour changes below are new in this release; see
// `DayViewerLocaleInputTheme.test.js` for the same theming pinned as
// characterization on `DayViewer`, which has themed this input since before
// this component existed.
describe('CalendarControls locale input theme', () => {
    it('gives the locale input a localized label by default, not the raw "locale" hardcoded by LocaleInput', () => {
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#mount');
        expect(
            controls.apiOptions._localeInput._labelElement.textContent,
        ).not.toBe('locale');
        expect(controls.apiOptions._localeInput._labelElement.textContent).toBe(
            Messages['en']['LANGUAGE'],
        );
    });

    it('localizes the default label per the message catalogue, for a non-English locale', () => {
        const controls = new CalendarControls({ locale: 'it' });
        controls.appendTo('#mount');
        expect(controls.apiOptions._localeInput._labelElement.textContent).toBe(
            Messages['it']['LANGUAGE'],
        );
    });

    it('a theme-supplied labelText wins over the localized default', () => {
        const controls = new CalendarControls({
            locale: 'en',
            theme: { localeInput: { labelText: 'Preferred language' } },
        });
        controls.appendTo('#mount');
        expect(controls.apiOptions._localeInput._labelElement.textContent).toBe(
            'Preferred language',
        );
    });

    it('applies a per-child class override to the locale input', () => {
        const controls = new CalendarControls({
            locale: 'en',
            theme: { localeInput: { class: 'form-select-sm' } },
        });
        controls.appendTo('#mount');
        expect(controls.apiOptions._localeInput._domElement.className).toBe(
            'form-select-sm',
        );
    });

    // The larger of the two behaviour changes: previously no wrapper was ever
    // created for this input, since `CalendarControls` never themed it at all.
    it('reaches the locale input via the flat theme.wrapper key', () => {
        const controls = new CalendarControls({
            locale: 'en',
            theme: { wrapper: 'col-md-3' },
        });
        controls.appendTo('#mount');
        expect(
            controls.apiOptions._localeInput._domElement.closest('.col-md-3'),
        ).not.toBeNull();
    });

    it('reaches the locale input via a per-child wrapperClass override', () => {
        const controls = new CalendarControls({
            locale: 'en',
            theme: { localeInput: { wrapperClass: 'col-lg-6' } },
        });
        controls.appendTo('#mount');
        expect(
            controls.apiOptions._localeInput._domElement.closest('.col-lg-6'),
        ).not.toBeNull();
    });
});

describe('CalendarControls mounting', () => {
    it('mounts the rite select before the calendar select', () => {
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#mount');
        const selects = document.querySelectorAll('#mount select');
        expect(selects[0]).toBe(controls.riteSelect._domElement);
    });

    it('returns undefined from appendTo', () => {
        const controls = new CalendarControls({ locale: 'en' });
        expect(controls.appendTo('#mount')).toBeUndefined();
    });

    it('throws when the target matches nothing, naming this component', () => {
        const controls = new CalendarControls({ locale: 'en' });
        expect(() => controls.appendTo('#nope')).toThrow(
            /CalendarControls.*nope/,
        );
    });

    it('is callable more than once without duplicating children', () => {
        const other = document.createElement('div');
        other.id = 'other';
        document.body.appendChild(other);
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#mount');
        controls.appendTo('#other');
        expect(document.querySelectorAll('#mount select').length).toBe(0);
        expect(
            document.querySelectorAll('#other select').length,
        ).toBeGreaterThanOrEqual(2);
    });
});

describe('CalendarControls rite wiring', () => {
    // The regression this whole family exists to prevent. Wire only
    // linkToRiteSelect() and the form reads `ambrosian` while every request
    // still goes to /calendar/roman/.
    it('requests the ambrosian path after a rite change', async () => {
        const urls = captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#mount');
        controls.listenTo(apiClient);

        controls.riteSelect._domElement.value = 'ambrosian';
        controls.riteSelect._domElement.dispatchEvent(
            new Event('change', { bubbles: true }),
        );
        await new Promise((resolve) => setTimeout(resolve, 0));

        const calendarRequests = urls.filter((u) => u.includes('/calendar'));
        expect(calendarRequests.length).toBeGreaterThan(0);
        expect(calendarRequests.at(-1)).toContain('/calendar/ambrosian');
        expect(calendarRequests.at(-1)).not.toContain('/calendar/roman');
    });

    it('is chainable', async () => {
        captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#mount');
        expect(controls.listenTo(apiClient)).toBe(controls);
    });

    it('refuses to rebind to a second client, naming this component', async () => {
        captureRequests();
        const first = await ApiClient.init(API_URL);
        const second = await ApiClient.init(API_URL);
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#mount');
        controls.listenTo(first);
        expect(() => controls.listenTo(second)).toThrow(
            /CalendarControls.*already wired/,
        );
    });

    it('honours the filter option', () => {
        const controls = new CalendarControls({
            locale: 'en',
            filter: ApiOptionsFilter.LOCALE_ONLY,
        });
        controls.appendTo('#mount');
        expect(controls.apiOptions._localeInput).not.toBeNull();
    });
});
