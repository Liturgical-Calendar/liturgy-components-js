/** @jest-environment jsdom */
/**
 * `SubscriptionUrl` is `SubscriptionBuilder`'s private renderer. It borrows the
 * `CurrentEndpoint` instance `ApiOptions` owns — the same one `PathBuilder`
 * borrows — so the URL model is shared and only the presentation is not.
 *
 * Two pins are load-bearing and easy to lose:
 *   - `return_type = 'ICS'` is what makes the URL a subscription rather than a
 *     JSON request. It is not user-selectable, unlike `PathBuilder`'s.
 *   - `explicitRite = true` forces `/roman` into the path. Without it
 *     `CurrentEndpoint.path` omits the rite for Roman, and the frontend card
 *     this replaces emits it unconditionally.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import SubscriptionUrl from '../SubscriptionBuilder/SubscriptionUrl.js';
import { ApiOptionsFilter } from '../Enums.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.innerHTML = '<div id="mount"></div>';
});

/**
 * The three controls a SubscriptionUrl wires to, built the way
 * SubscriptionBuilder will build them.
 *
 * @param {Object} [options] - Forwarded to SubscriptionUrl.
 * @returns {Object} The controls and the renderer.
 */
const build = (options = {}) => {
    const riteSelect = new RiteSelect('en');
    const calendarSelect = new CalendarSelect({
        locale: 'en',
        allowNull: true,
    });
    const apiOptions = new ApiOptions('en').filter(
        ApiOptionsFilter.LOCALE_ONLY,
    );
    apiOptions
        .linkToCalendarSelect(calendarSelect)
        .linkToRiteSelect(riteSelect);
    const url = new SubscriptionUrl(
        apiOptions,
        calendarSelect,
        riteSelect,
        options,
    );
    return { apiOptions, calendarSelect, riteSelect, url };
};

describe('SubscriptionUrl serialization', () => {
    it('renders the rite-level calendar with ICS and CIVIL pinned', () => {
        const { url } = build();
        expect(url.url).toBe(
            `${API_URL}/calendar/roman?year_type=CIVIL&return_type=ICS`,
        );
    });

    it('renders the Ambrosian rite-level calendar', () => {
        const { url, riteSelect } = build();
        riteSelect._domElement.value = 'ambrosian';
        riteSelect._domElement.dispatchEvent(new Event('change'));
        expect(url.url).toContain('/calendar/ambrosian');
    });

    it('emits /roman explicitly rather than omitting it', () => {
        // `CurrentEndpoint.path` drops the rite for Roman unless `explicitRite`
        // is set. The card this replaces always emits it, and URLs already
        // pasted into calendar apps depend on the explicit form resolving.
        const { url } = build();
        expect(url.url).toContain('/calendar/roman');
    });

    it('rejects an unknown scheme', () => {
        expect(() => build({ scheme: 'ftp' })).toThrow(
            /must be 'https' or 'webcal'/,
        );
    });

    it('rewrites only the scheme for webcal', () => {
        const https = build().url.url;
        const webcal = build({ scheme: 'webcal' }).url.url;
        expect(webcal).toBe(https.replace(/^https?:/, 'webcal:'));
        expect(webcal.startsWith('webcal:')).toBe(true);
    });
});

describe('SubscriptionUrl control wiring', () => {
    /**
     * Selects a value the way a user would, notifying listeners.
     *
     * @param {HTMLSelectElement} element - The select to drive.
     * @param {string} value - The value to select.
     * @returns {void}
     */
    const userSelects = (element, value) => {
        element.value = value;
        element.dispatchEvent(new Event('change', { bubbles: true }));
    };

    it('repaints when the calendar select names a nation', () => {
        const { url, calendarSelect } = build();
        url.appendTo(document.getElementById('mount'));
        userSelects(calendarSelect._domElement, 'VA');
        expect(url._domElement.textContent).toContain('/nation/VA');
    });

    it('clears the calendar when the empty option is reselected', () => {
        // The empty option carries no `data-calendartype` and means the
        // rite-level calendar. Without clearing, the last nation stays in the
        // path forever and reselecting empty appears to do nothing.
        const { url, calendarSelect } = build();
        url.appendTo(document.getElementById('mount'));
        userSelects(calendarSelect._domElement, 'VA');
        userSelects(calendarSelect._domElement, '');
        expect(url._domElement.textContent).not.toContain('/nation/');
        expect(url._domElement.textContent).toContain('/calendar/roman');
    });

    it('repaints when the rite changes', () => {
        const { url, riteSelect } = build();
        url.appendTo(document.getElementById('mount'));
        userSelects(riteSelect._domElement, 'ambrosian');
        expect(url._domElement.textContent).toContain('/calendar/ambrosian');
    });

    it('carries the locale select into the query', () => {
        // A subscription URL cannot carry an Accept-Language header — a calendar
        // app just GETs it — so the chosen language has to travel as ?locale=.
        const { url, apiOptions } = build();
        url.appendTo(document.getElementById('mount'));
        userSelects(apiOptions._localeInput._domElement, 'it');
        expect(url._domElement.textContent).toContain('locale=it');
    });

    it('notifies onChange with the new URL', () => {
        // Two calls, not one: `ApiOptions.linkToCalendarSelect()` resyncs the
        // locale select's options for the newly chosen calendar and dispatches
        // a synthetic `change` on it (see ApiOptions.js `#applyCalendarSelection`),
        // and that fires synchronously, inside the calendar select's own
        // `change` handling, before SubscriptionUrl's own calendar listener
        // (registered after `linkToCalendarSelect()` in `build()`) gets to run.
        // The first callback therefore reflects only the locale resync; the
        // final one is the one callers care about, and it carries the nation.
        const seen = [];
        const { url, calendarSelect } = build();
        url.onChange((next) => seen.push(next));
        userSelects(calendarSelect._domElement, 'VA');
        expect(seen).toHaveLength(2);
        expect(seen.at(-1)).toContain('/nation/VA');
    });

    it('stops repainting after dispose', () => {
        const { url, calendarSelect } = build();
        url.appendTo(document.getElementById('mount'));
        const before = url._domElement.textContent;
        url.dispose();
        userSelects(calendarSelect._domElement, 'VA');
        expect(url._domElement.textContent).toBe(before);
    });
});
