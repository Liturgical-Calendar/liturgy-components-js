/** @jest-environment jsdom */
/**
 * `CalendarSelect` assembles its `<option>` markup as STRINGS and assigns them
 * to `innerHTML`, interpolating values that come from the API's `/calendars`
 * metadata: a national calendar's `calendar_id`, a diocesan calendar's
 * `calendar_id`, and a diocese's free-text `diocese` name. Two of those land
 * inside a quoted attribute, where a `"` ends the attribute and everything
 * after it is parsed as further attributes on the same tag.
 *
 * The string architecture is deliberate and stays: `nationsInnerHtml` and
 * `diocesesInnerHtml` are PUBLIC getters returning markup, so rebuilding this
 * component around nodes would be a breaking API change rather than a security
 * fix. Escaping at the interpolation sites closes the hole without touching the
 * shape. That is the difference from `WebCalendar`'s event-details cell, where
 * nothing public depended on the string and building nodes was cheaper.
 *
 * The blast radius is narrower than it first looks — the HTML parser's "in
 * select" insertion mode discards most elements injected between `<select>`
 * and `<option>` — which is exactly why the ATTRIBUTE cases below matter more
 * than the element ones, and why this needed a test rather than an eyeball.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import { CalendarSelectFilter } from '../Enums.js';

const API_URL = 'http://localhost:8000';

/**
 * @param {Object} [overrides] - Fields to merge onto the hostile diocese.
 * @returns {Object} A `/calendars` metadata index.
 */
const metadata = (overrides = {}) => ({
    locales: ['en'],
    national_calendars: [{ calendar_id: 'IT', locales: ['it'] }],
    diocesan_calendars: [
        {
            calendar_id: 'romamo_it',
            nation: 'IT',
            diocese: 'Diocesi di Roma',
            locales: ['it'],
            rite: 'roman',
            ...overrides,
        },
    ],
});

/**
 * @param {Object} [overrides] - Fields to merge onto the hostile diocese.
 * @returns {HTMLSelectElement} The mounted select element.
 */
const mount = (overrides = {}) => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, metadata(overrides));
    const container = document.createElement('div');
    container.id = 'container';
    document.body.appendChild(container);
    const select = new CalendarSelect('en').filter(
        CalendarSelectFilter.DIOCESAN_CALENDARS,
    );
    select.appendTo('#container');
    return container.querySelector('select');
};

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('a hostile diocese name', () => {
    it('does not become markup', () => {
        const select = mount({ diocese: '<img src=x onerror="alert(1)">Roma' });
        expect(select.querySelector('img')).toBeNull();
        expect(select.querySelector('option').textContent).toContain(
            '<img src=x',
        );
    });

    it('cannot close the option early and inject a sibling', () => {
        const select = mount({
            diocese: '</option><option value="injected">Injected',
        });
        const values = [...select.options].map((option) => option.value);
        expect(values).not.toContain('injected');
    });
});

describe('a hostile calendar_id', () => {
    it('cannot break out of the value attribute to add an event handler', () => {
        // The case the "in select" insertion mode does NOT defuse: this is not
        // an injected element, it is an extra attribute on an option tag the
        // parser already accepts.
        const select = mount({
            calendar_id: 'romamo_it" onmouseover="globalThis.__xss = true',
        });
        const option = select.querySelector('option[data-calendartype]');
        expect(option.hasAttribute('onmouseover')).toBe(false);
        expect(option.getAttribute('value')).toBe(
            'romamo_it" onmouseover="globalThis.__xss = true',
        );
    });

    it('cannot inject a selected attribute onto another option', () => {
        const select = mount({ calendar_id: 'x" selected="selected' });
        expect(select.querySelectorAll('option[selected]').length).toBe(0);
    });
});

describe('a hostile nation, reaching the optgroup label', () => {
    // This vector turned out to be closed UPSTREAM, and the reason is worth
    // recording so nobody re-derives it. The nation code reaches the
    // `label="…"` attribute only through `Intl.DisplayNames.of()`, whose
    // argument grammar is two ASCII letters or three digits: it returns a
    // localized display name for a well-formed code and THROWS `RangeError`
    // for anything else. So a value capable of ending the attribute cannot
    // reach it.
    //
    // `escapeHtml()` is applied to that label regardless, as defence in depth:
    // the safety above is a property of a platform API's argument validation,
    // not of this component, and it would evaporate if the label ever came
    // from somewhere else. `escapeHtml()`'s own behaviour is pinned directly
    // in `SanitizeHtml.test.js` rather than through this unreachable path.
    it('cannot reach the label, because Intl rejects the code first', () => {
        const NATION = 'ZZ" onmouseover="globalThis.__xss2 = true';
        ApiBase.reset();
        ApiBase.fromMetadata(API_URL, {
            locales: ['en'],
            national_calendars: [{ calendar_id: NATION, locales: ['en'] }],
            diocesan_calendars: [
                {
                    calendar_id: 'x_zz',
                    nation: NATION,
                    diocese: 'Somewhere',
                    locales: ['en'],
                    rite: 'roman',
                },
            ],
        });

        // KNOWN ROUGH EDGE, not a security issue: this surfaces as a bare
        // `RangeError: invalid_argument` from deep inside `Intl`, where the
        // sibling inconsistency (a diocese whose nation has no national
        // calendar) gets an explicit message naming the component and the
        // offending value. Worth improving; out of scope for an escaping fix.
        expect(() => {
            new CalendarSelect('en').filter(
                CalendarSelectFilter.DIOCESAN_CALENDARS,
            );
        }).toThrow(RangeError);
        expect(globalThis.__xss2).toBeUndefined();
    });

    it('renders an unassigned but well-formed code as an inert display name', () => {
        // `ZZ` is syntactically valid, so it is accepted — and mapped to a
        // LOCALIZED display name ("Unknown Region" under the ICU this runs
        // against) rather than echoed. Asserting the security property rather
        // than that string, which is ICU-version dependent: whatever comes
        // back, it carries no character that could end an attribute.
        ApiBase.reset();
        ApiBase.fromMetadata(API_URL, {
            locales: ['en'],
            national_calendars: [{ calendar_id: 'ZZ', locales: ['en'] }],
            diocesan_calendars: [
                {
                    calendar_id: 'x_zz',
                    nation: 'ZZ',
                    diocese: 'Somewhere',
                    locales: ['en'],
                    rite: 'roman',
                },
            ],
        });
        const container = document.createElement('div');
        container.id = 'container';
        document.body.appendChild(container);
        const select = new CalendarSelect('en').filter(
            CalendarSelectFilter.DIOCESAN_CALENDARS,
        );
        select.appendTo('#container');
        const label = container.querySelector('optgroup').label;
        expect(typeof label).toBe('string');
        expect(label.length).toBeGreaterThan(0);
        expect(label).not.toMatch(/["'<>]/);
    });
});

describe('well-behaved metadata is unchanged', () => {
    it('renders the diocese name and value exactly as given', () => {
        const select = mount();
        const option = select.querySelector('option[data-calendartype]');
        expect(option.textContent).toBe('Diocesi di Roma');
        expect(option.value).toBe('romamo_it');
        expect(option.dataset.calendartype).toBe('diocesan');
    });

    it('leaves a name containing an apostrophe alone', () => {
        // `Côte d'Ivoire` and similar are ordinary data, and escaping must not
        // turn them into entity soup in the rendered text.
        const select = mount({ diocese: "Diocèse d'Abidjan" });
        expect(select.querySelector('option').textContent).toBe(
            "Diocèse d'Abidjan",
        );
    });
});
