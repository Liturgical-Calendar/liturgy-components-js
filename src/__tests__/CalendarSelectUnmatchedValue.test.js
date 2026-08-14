/** @jest-environment jsdom */
/**
 * A `<select>` whose value matches no option reports `selectedIndex === -1`, and
 * `ApiClient`'s own `change` listener read `selectedOptions[0].value` off that
 * missing option — a bare `TypeError` thrown from inside a listener, which the
 * DOM then swallows. See issue #66.
 *
 * Two facts settle what the fix must be, and both are asserted below rather than
 * merely asserted in prose:
 *
 *   1. `HTMLSelectElement.value` is `''` whenever nothing is selected. The
 *      unmatched value is DISCARDED by the DOM at assignment, so by the time any
 *      listener runs there is no offending value left to name. "Nothing selected"
 *      and "the empty option is selected" are one state at that point, and three
 *      other readers of the same shape already treat it so: `PathBuilder`,
 *      `SubscriptionUrl` and `CalendarControls.fetch()`. (`ApiOptions`' linked-
 *      select listener reaches the same conclusion by a different route — it
 *      branches on `value === ''` and never reads the option at all, which is
 *      why it was never affected.)
 *   2. The library PRODUCES this state itself. `CalendarSelect#applyLinkedRite()`
 *      sets `.value = ''` around the rebuild, and an `allowNull( false )` select
 *      has no empty option to match — so an ordinary rite change landed on
 *      `selectedIndex === -1` and then dispatched `change` into the crash.
 *
 * So the listener guards and treats it as the rite-level calendar; it does not
 * throw, and it does not warn, because on a rite change there is no consumer
 * mistake to report. The message naming the component and the offending value
 * lives instead at `CalendarSelect.value()` — the one place that still HAS the
 * value, and where a throw reaches the caller rather than the DOM's void.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import { CalendarSelectFilter } from '../Enums.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

/** Request URLs the mock saw, in order, with the API base stripped. */
let sentUrls = [];

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.innerHTML =
        '<div id="riteContainer"></div><div id="calendarContainer"></div>';
    sentUrls = [];
    global.fetch = jest.fn((url) => {
        sentUrls.push(String(url).replace(API_URL, ''));
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

/** Lets the coalescing microtask flush and any request it issues settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

/**
 * Dispatches `change` on `element` and returns whatever exception a listener
 * raised, or `null`.
 *
 * `expect( () => el.dispatchEvent( … ) ).not.toThrow()` would be VACUOUS here,
 * and measurably so: an exception raised inside a listener never propagates out
 * of `dispatchEvent`, so a `try`/`catch` around the dispatch sees nothing
 * whether the listener threw or not. Under jest the throw still fails the test,
 * but only through the environment's uncaught-error channel — which registering
 * any `window` `'error'` listener silences. A tidy-up elsewhere in the file
 * could therefore have quietly disarmed the regression tests below.
 *
 * Capturing the error on `window` is what makes the assertion real: it is the
 * channel the exception actually travels on, and it is also why issue #66 was
 * so hard to place from a minified bundle.
 */
const dispatchCapturingErrors = (element, event = new Event('change')) => {
    let raised = null;
    const record = (errorEvent) => {
        raised = errorEvent.error;
    };
    window.addEventListener('error', record);
    element.dispatchEvent(event);
    window.removeEventListener('error', record);
    return raised;
};

describe('a CalendarSelect whose value matches no option', () => {
    it('reports an empty value, having discarded the value assigned to it', () => {
        const calendarSelect = new CalendarSelect('en');
        calendarSelect.appendTo('#calendarContainer');

        calendarSelect._domElement.value = 'NOT_A_REAL_ID';

        expect(calendarSelect._domElement.selectedIndex).toBe(-1);
        expect(calendarSelect._domElement.value).toBe('');
    });

    it('issues no request from the assignment alone, which dispatches no change', async () => {
        // Pins the boundary the docs draw. Writing to `_domElement` bypasses
        // `value()`'s check AND fires no `change`, so NOTHING is requested at the
        // moment of assignment; the rite-level request below happens only once an
        // event actually arrives. Without this test, "yields a rite-level request"
        // reads as though the assignment itself issued one — the imprecision
        // CodeRabbit caught on PR #73.
        const calendarSelect = new CalendarSelect('en');
        calendarSelect.appendTo('#calendarContainer');
        const apiClient = await ApiClient.init(API_URL);
        apiClient.listenTo(calendarSelect);

        calendarSelect._domElement.value = 'NOT_A_REAL_ID';
        await settle();

        expect(sentUrls).toHaveLength(0);
    });

    it('raises nothing from inside the ApiClient change listener', async () => {
        const calendarSelect = new CalendarSelect('en');
        calendarSelect.appendTo('#calendarContainer');
        const apiClient = await ApiClient.init(API_URL);
        apiClient.listenTo(calendarSelect);

        calendarSelect._domElement.value = 'NOT_A_REAL_ID';

        // The issue's exact reproduction.
        const raised = dispatchCapturingErrors(
            calendarSelect._domElement,
            new Event('change', { bubbles: true }),
        );

        expect(raised).toBeNull();
        await settle();
    });

    it('requests the rite-level calendar, the one thing the DOM still reports', async () => {
        const calendarSelect = new CalendarSelect('en');
        calendarSelect.appendTo('#calendarContainer');
        const apiClient = await ApiClient.init(API_URL);
        apiClient.listenTo(calendarSelect);

        calendarSelect._domElement.value = 'NOT_A_REAL_ID';
        calendarSelect._domElement.dispatchEvent(new Event('change'));
        await settle();

        expect(sentUrls).toHaveLength(1);
        expect(sentUrls[0]).toContain('/calendar/roman');
        expect(sentUrls[0]).not.toContain('NOT_A_REAL_ID');
    });

    it('clears a category left over from the previous selection', async () => {
        // The category half of the guard, which the crash hid. Falling back to
        // the CURRENT category rather than to `''` would keep routing requests at
        // a diocese the select no longer names — a wrong request rather than a
        // loud one, which is the failure mode worth pinning down.
        const calendarSelect = new CalendarSelect('en').filter(
            CalendarSelectFilter.DIOCESAN_CALENDARS,
        );
        calendarSelect.appendTo('#calendarContainer');
        const apiClient = await ApiClient.init(API_URL);
        apiClient.listenTo(calendarSelect);

        const diocese = calendarSelect._domElement.options[0].value;
        calendarSelect._domElement.value = diocese;
        calendarSelect._domElement.dispatchEvent(new Event('change'));
        await settle();
        expect(sentUrls.at(-1)).toContain(`/diocese/${diocese}`);

        calendarSelect._domElement.value = 'NOT_A_REAL_ID';
        calendarSelect._domElement.dispatchEvent(new Event('change'));
        await settle();

        expect(sentUrls.at(-1)).not.toContain('/diocese/');
        expect(sentUrls.at(-1)).toContain('/calendar/roman');
    });

    it('survives the rite change that produces the state in the first place', async () => {
        const riteSelect = new RiteSelect('en');
        riteSelect.appendTo('#riteContainer');
        const calendarSelect = new CalendarSelect('en')
            .filter(CalendarSelectFilter.NATIONAL_CALENDARS)
            .linkToRiteSelect(riteSelect);
        calendarSelect.appendTo('#calendarContainer');
        const apiClient = await ApiClient.init(API_URL);
        apiClient.listenTo(calendarSelect).listenTo(riteSelect);

        // `allowNull( false )` is the default, so the rebuilt list carries no
        // empty option for the reset value to match.
        expect(
            [...calendarSelect._domElement.options].some(
                (option) => '' === option.value,
            ),
        ).toBe(false);

        riteSelect._domElement.value = 'ambrosian';
        const raised = dispatchCapturingErrors(riteSelect._domElement);
        expect(raised).toBeNull();
        await settle();

        expect(calendarSelect._domElement.selectedIndex).toBe(-1);
        expect(sentUrls.at(-1)).toContain('/calendar/ambrosian');
    });
});

describe('CalendarSelect.value()', () => {
    it('rejects a value no option carries, naming the component and the value', () => {
        const calendarSelect = new CalendarSelect('en');
        calendarSelect.appendTo('#calendarContainer');

        expect(() => calendarSelect.value('NOT_A_REAL_ID')).toThrow(
            /CalendarSelect\.value/,
        );
        expect(() => calendarSelect.value('NOT_A_REAL_ID')).toThrow(
            /NOT_A_REAL_ID/,
        );
    });

    it('reports how many options it does offer, and under which filter', () => {
        const calendarSelect = new CalendarSelect('en').filter(
            CalendarSelectFilter.NATIONAL_CALENDARS,
        );
        calendarSelect.appendTo('#calendarContainer');
        const count = calendarSelect._domElement.options.length;

        expect(() => calendarSelect.value('NOT_A_REAL_ID')).toThrow(
            new RegExp(`${count} option\\(s\\), filter 'nations'`),
        );
    });

    it('names the element id too, so one page with several selects is diagnosable', () => {
        const calendarSelect = new CalendarSelect('en').id('nationSelect');
        calendarSelect.appendTo('#calendarContainer');

        expect(() => calendarSelect.value('NOT_A_REAL_ID')).toThrow(
            /nationSelect/,
        );
    });

    it('leaves the previous selection untouched when it rejects', () => {
        const calendarSelect = new CalendarSelect('en');
        calendarSelect.appendTo('#calendarContainer');
        const before = calendarSelect._domElement.value;

        expect(() => calendarSelect.value('NOT_A_REAL_ID')).toThrow();

        expect(calendarSelect._domElement.value).toBe(before);
    });

    it('still accepts the empty value on a select that has no empty option', () => {
        // The documented way to select the rite-level calendar, and `allowNull`
        // is `false` by default — so this deliberately lands on
        // `selectedIndex === -1` and must not be mistaken for the error above.
        const calendarSelect = new CalendarSelect('en');
        calendarSelect.appendTo('#calendarContainer');

        expect(() => calendarSelect.value('')).not.toThrow();
        expect(calendarSelect._domElement.selectedIndex).toBe(-1);
        expect(calendarSelect.value()).toBe('');
    });

    it('still accepts a value an option does carry', () => {
        const calendarSelect = new CalendarSelect('en').filter(
            CalendarSelectFilter.NATIONAL_CALENDARS,
        );
        calendarSelect.appendTo('#calendarContainer');
        const existing = calendarSelect._domElement.options[0].value;

        expect(() => calendarSelect.value(existing)).not.toThrow();
        expect(calendarSelect.value()).toBe(existing);
    });

    it('finds an option nested inside an optgroup', () => {
        // A diocesan select groups its options by nation, so the match has to
        // see through `<optgroup>`. It does, because `HTMLSelectElement.options`
        // is flat — but that is the single property the check rests on, so it is
        // pinned here rather than assumed.
        const calendarSelect = new CalendarSelect('en').filter(
            CalendarSelectFilter.DIOCESAN_CALENDARS,
        );
        calendarSelect.appendTo('#calendarContainer');
        const nested =
            calendarSelect._domElement.querySelector('optgroup > option');

        expect(nested).not.toBeNull();
        expect(() => calendarSelect.value(nested.value)).not.toThrow();
        expect(calendarSelect.value()).toBe(nested.value);
    });

    it('rejects a non-string before it looks for a matching option', () => {
        const calendarSelect = new CalendarSelect('en');
        calendarSelect.appendTo('#calendarContainer');

        expect(() => calendarSelect.value(42)).toThrow(
            /must be of type string/,
        );
    });
});

describe('the sibling selects, which are already covered', () => {
    // `RiteSelect` has no `value()` of its own and its options come from the
    // `Rite` enum, so the only way to reach `selectedIndex === -1` is to write
    // to the element directly. Every reader of that element — `ApiClient.rite()`,
    // `CalendarSelect#applyLinkedRite()`, `ApiOptions`' rite handler — validates
    // the rite by name already, so this class of bug produces a NAMED error
    // there rather than the bare `TypeError` issue #66 reported. Locked down
    // here so a future "simplification" of that validation cannot reintroduce it.
    it('reports an unmatched rite by name rather than as a TypeError', async () => {
        const riteSelect = new RiteSelect('en');
        riteSelect.appendTo('#riteContainer');
        const apiClient = await ApiClient.init(API_URL);
        apiClient.listenTo(riteSelect);

        riteSelect._domElement.value = 'NOT_A_REAL_RITE';
        const raised = dispatchCapturingErrors(riteSelect._domElement);

        expect(raised).toBeInstanceOf(Error);
        expect(raised).not.toBeInstanceOf(TypeError);
        expect(raised.message).toContain('ApiClient.rite');
    });
});
