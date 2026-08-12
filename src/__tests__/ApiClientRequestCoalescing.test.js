/** @jest-environment jsdom */
/**
 * `ApiClient.listenTo()` attaches a `change` listener per input, and each one
 * decided, on its own, to fetch. That is right for a user editing one field and
 * wrong for a single user action that moves several inputs at once — which both
 * the rite select and the calendar select do, because `ApiOptions` responds to
 * them by rewriting the year floor, the calendar path, the locale options and the
 * calendar select, each of which dispatches its own `change`.
 *
 * The listeners fired in attachment order while `ApiClient`'s own state was still
 * half-updated, so the leading requests described the state the user had just
 * LEFT: the previous rite, or the previous calendar. See issue #50 for the
 * measured tables these tests encode.
 *
 * Two symptoms, and the second is the one a user sees:
 *
 *   1. Wasted requests — two or three per action instead of one.
 *   2. A visible flash. `#requestRevision` drops a superseded response before the
 *      `calendarFetched` emit, so a slow stale response can never overwrite a
 *      fresh one. But a stale request served FROM CACHE emits synchronously, at
 *      an instant when it IS the newest revision, so the guard has nothing to
 *      catch. `WebCalendar` renders the rite the user just left, then re-renders.
 *      And the wasted requests are precisely the ones most likely to be cached.
 *
 * The fix coalesces the listener-driven refetches onto a microtask, so one user
 * action produces one request built from settled state. Requests in SEPARATE
 * turns must still be separate — the last test here is what stops the coalescing
 * from swallowing a second, genuine user action.
 *
 * These tests assert on what the API is actually ASKED for and on what the
 * client emits, in order, rather than on internal state: coalescing is only
 * observable as the work it does NOT do.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import { ApiOptionsFilter } from '../Enums.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

/** Request URLs the mock saw, in order, with the API base stripped. */
let sentUrls = [];
/** `Accept-Language` values the mock saw, in request order. */
let sentLocales = [];

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.innerHTML = '<div id="opts"></div>';
    sentUrls = [];
    sentLocales = [];
    global.fetch = jest.fn((url, init) => {
        const lang = init?.headers?.['Accept-Language'] ?? '';
        sentUrls.push(String(url).replace(API_URL, ''));
        sentLocales.push(lang);
        return Promise.resolve({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: () =>
                Promise.resolve({
                    litcal: [],
                    messages: [],
                    metadata: {},
                    settings: { locale: lang },
                }),
        });
    });
});

/** Lets the microtask flush run and any request it issues settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

/**
 * The wiring `main.js` and `CalendarControls` both build: rite and calendar
 * selects linked to `ApiOptions`, all three driving one `ApiClient`.
 *
 * @returns {Promise<Object>} The wired pieces.
 */
const buildForm = async () => {
    const apiClient = await ApiClient.init(API_URL);
    const riteSelect = new RiteSelect('it');
    const calendarSelect = new CalendarSelect({
        locale: 'it',
        allowNull: true,
    });
    const apiOptions = new ApiOptions('it');
    apiOptions._localeInput.defaultValue('it');
    apiOptions
        .linkToCalendarSelect(calendarSelect)
        .linkToRiteSelect(riteSelect);
    riteSelect.appendTo('#opts');
    calendarSelect.appendTo('#opts');
    apiOptions.filter(ApiOptionsFilter.ALL_CALENDARS).appendTo('#opts');
    apiClient
        .listenTo(calendarSelect)
        .listenTo(riteSelect)
        .listenTo(apiOptions);
    // Every `calendarFetched` this client emits, in order. Counting REQUESTS
    // alone would understate the problem: the wasted requests describe the state
    // the user just left, which is the state most likely to be in the cache
    // already, and a cache hit emits without touching `global.fetch`. The emits
    // are what `WebCalendar` renders, so they are what a user sees.
    const emits = [];
    apiClient.on('calendarFetched', (data, context) =>
        emits.push({ rite: context.rite, locale: data.settings.locale }),
    );
    return {
        apiClient,
        emits,
        calendarElement: calendarSelect._domElement,
        localeElement: apiOptions._localeInput._domElement,
        riteElement: riteSelect._domElement,
        yearElement: apiOptions._yearInput._domElement,
    };
};

/**
 * Sets a select's value the way a user would, notifying listeners.
 *
 * @param {HTMLSelectElement} element - The select to drive.
 * @param {string} value - The value to select.
 * @returns {void}
 */
const userSelects = (element, value) => {
    element.value = value;
    element.dispatchEvent(new Event('change', { bubbles: true }));
};

describe('one user action produces one calendar', () => {
    it('coalesces a rite change that also changes the locale', async () => {
        const { apiClient, emits, localeElement, riteElement } =
            await buildForm();
        await apiClient.fetchCalendar('it');

        // `en` is offered by the Roman rite and NOT by the Ambrosian one, so
        // switching rite forces the locale input to rebuild and re-notify. That
        // second notification is what used to buy an extra refetch.
        userSelects(localeElement, 'en');
        await settle();
        sentUrls = [];
        sentLocales = [];
        emits.length = 0;

        userSelects(riteElement, 'ambrosian');
        await settle();

        expect(emits).toEqual([
            { rite: 'ambrosian', locale: localeElement.value },
        ]);
        expect(sentUrls).toHaveLength(1);
        expect(sentUrls[0]).toContain('/calendar/ambrosian');
        expect(sentLocales[0]).toBe(localeElement.value);
    });

    it('coalesces a nation selection', async () => {
        const { apiClient, emits, calendarElement } = await buildForm();
        await apiClient.fetchCalendar('it');
        sentUrls = [];
        emits.length = 0;

        userSelects(calendarElement, 'VA');
        await settle();

        expect(emits).toHaveLength(1);
        expect(emits[0].rite).toBe('roman');
        expect(sentUrls).toHaveLength(1);
        expect(sentUrls[0]).toContain('/calendar/roman/nation/VA');
    });

    it('still fetches once when the rite leaves the locale alone', async () => {
        const { apiClient, emits, localeElement, riteElement } =
            await buildForm();
        await apiClient.fetchCalendar('it');

        // `it` is offered by both rites, so the rebuild cannot change the value
        // and fires no synthetic `change`. This case was already correct; it is
        // here so that coalescing cannot regress it into zero requests.
        userSelects(localeElement, 'it');
        await settle();
        sentUrls = [];
        emits.length = 0;

        userSelects(riteElement, 'ambrosian');
        await settle();

        expect(emits).toHaveLength(1);
        expect(sentUrls).toHaveLength(1);
        expect(sentUrls[0]).toContain('/calendar/ambrosian');
    });
});

describe('no stale state reaches the renderer', () => {
    it('never emits the rite the user switched away from', async () => {
        const { apiClient, emits, localeElement, riteElement } =
            await buildForm();

        // Warm the cache for the state the user is about to LEAVE. This is what
        // turns a wasted request into a visible flash rather than mere traffic:
        // served from cache it emits synchronously, at an instant when it IS the
        // newest revision, so `#requestRevision` has nothing to catch.
        await apiClient.fetchCalendar('it');
        userSelects(localeElement, 'en');
        await settle();
        emits.length = 0;

        userSelects(riteElement, 'ambrosian');
        await settle();

        expect(emits.map((emit) => emit.rite)).toEqual(['ambrosian']);
    });
});

describe('coalescing does not swallow a separate user action', () => {
    it('issues one request per action when actions are in separate turns', async () => {
        const { apiClient, emits, calendarElement, riteElement } =
            await buildForm();
        await apiClient.fetchCalendar('it');
        sentUrls = [];
        emits.length = 0;

        userSelects(riteElement, 'ambrosian');
        await settle();
        userSelects(riteElement, 'roman');
        await settle();
        userSelects(calendarElement, 'VA');
        await settle();

        // Three actions, three calendars delivered. Asserted on the EMITS rather
        // than on `sentUrls`, because the switch back to Roman is answered from
        // the cache the first fetch populated — one action legitimately costing
        // zero requests is the cache working, not coalescing over-reaching.
        expect(emits.map((emit) => emit.rite)).toEqual([
            'ambrosian',
            'roman',
            'roman',
        ]);
        expect(sentUrls).toEqual([
            '/calendar/ambrosian/2026',
            '/calendar/roman/nation/VA/2026',
        ]);
    });
});
