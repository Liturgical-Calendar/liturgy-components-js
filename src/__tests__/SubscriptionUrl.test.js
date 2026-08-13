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

    it('notifies onChange exactly once per action, with settled state', async () => {
        // `ApiOptions.linkToCalendarSelect()`'s listener is registered before
        // this class's and synchronously dispatches a synthetic `change` on the
        // locale input, so without coalescing a subscriber is notified twice —
        // the first time with the calendar the user just left.
        const seen = [];
        const { url, calendarSelect } = build();
        url.onChange((next) => seen.push(next));
        userSelects(calendarSelect._domElement, 'VA');
        await Promise.resolve();
        expect(seen).toHaveLength(1);
        expect(seen[0]).toContain('/nation/VA');
    });

    it('does not notify onChange for a change made after dispose', async () => {
        const seen = [];
        const { url, calendarSelect } = build();
        url.onChange((next) => seen.push(next));
        url.dispose();
        userSelects(calendarSelect._domElement, 'VA');
        await Promise.resolve();
        expect(seen).toHaveLength(0);
    });

    it('cancels an already-pending notification when disposed mid-turn', async () => {
        // Dispose can land between the synchronous `change` handling that
        // schedules the microtask and the microtask actually running. The
        // pending notification must not fire into callbacks that are gone.
        const seen = [];
        const { url, calendarSelect } = build();
        url.onChange((next) => seen.push(next));
        userSelects(calendarSelect._domElement, 'VA');
        url.dispose();
        await Promise.resolve();
        expect(seen).toHaveLength(0);
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

describe('SubscriptionUrl copy control', () => {
    /**
     * Replaces navigator.clipboard with a recording stub.
     *
     * @param {boolean} succeeds - Whether writeText resolves or rejects.
     * @returns {Array<string>} The texts the stub was asked to write.
     */
    const stubClipboard = (succeeds) => {
        const written = [];
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {
                writeText: (text) => {
                    written.push(text);
                    return succeeds
                        ? Promise.resolve()
                        : Promise.reject(new Error('denied'));
                },
            },
        });
        return written;
    };

    it('is a real button, not a div with role=button', () => {
        // `role="button"` on a div with no tabindex and no key handler announces
        // a button that cannot be focused or activated. A real <button> gets
        // keyboard focus, Enter/Space and the correct accessibility tree free.
        const { url } = build();
        expect(url._domElement.tagName).toBe('BUTTON');
        expect(url._domElement.getAttribute('type')).toBe('button');
        expect(url._domElement.hasAttribute('role')).toBe(false);
    });

    it('carries a localized title', () => {
        const { url } = build();
        expect(url._domElement.getAttribute('title')).toBe(
            'Click to copy to the clipboard!',
        );
    });

    it('renders an inline SVG icon by default', () => {
        const { url } = build();
        expect(url._domElement.querySelector('svg')).not.toBeNull();
    });

    it('accepts a consumer icon and renders no SVG', () => {
        const { url } = build({
            copyIcon: '<i class="fas fa-clipboard"></i>',
        });
        expect(url._domElement.querySelector('i.fa-clipboard')).not.toBeNull();
        expect(url._domElement.querySelector('svg')).toBeNull();
    });

    it('renders no icon at all for copyIcon: null', () => {
        const { url } = build({ copyIcon: null });
        expect(url._domElement.querySelector('svg')).toBeNull();
        expect(url._domElement.querySelector('i')).toBeNull();
    });

    it('copies the URL and reports success', async () => {
        const written = stubClipboard(true);
        const seen = [];
        const { url } = build({ onCopy: (ok) => seen.push(ok) });
        url._domElement.click();
        await Promise.resolve();
        await Promise.resolve();
        expect(written).toEqual([url.url]);
        expect(seen).toEqual([true]);
    });

    it('reports failure without throwing', async () => {
        stubClipboard(false);
        const seen = [];
        const { url } = build({
            onCopy: (ok, error) => seen.push([ok, error]),
        });
        url._domElement.click();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        expect(seen[0][0]).toBe(false);
        expect(seen[0][1]).toBeInstanceOf(Error);
    });

    it('announces the copy through an aria-live region', async () => {
        stubClipboard(true);
        const { url } = build();
        url.appendTo(document.getElementById('mount'));
        url._domElement.click();
        await Promise.resolve();
        await Promise.resolve();
        const live = document.querySelector('[aria-live="polite"]');
        expect(live).not.toBeNull();
        expect(live.textContent).toBe('URL copied to clipboard');
    });
});
