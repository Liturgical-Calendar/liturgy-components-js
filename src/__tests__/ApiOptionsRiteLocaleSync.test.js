/** @jest-environment jsdom */
/**
 * A rite change rebuilds the locale input's options, and doing so changes which
 * locale is selected — `setOptionsForCalendarLocales()` calls `replaceChildren()`
 * and lets the DOM fall to the first option, `resetOptions()` assigns the default.
 * Neither is a user edit, so neither fires `change` on its own.
 *
 * `ApiClient` learns the locale ONLY from a `change` listener on that element
 * (`ApiClient.js`, in `listenTo( apiOptions )`), so without a synthetic dispatch its
 * `Accept-Language` kept whatever the user last picked BY HAND — and diverged from
 * the select for good. Reported symptom: pick French under the Roman rite, switch to
 * Ambrosian, and the select reads Italian while the calendar arrives in another
 * language entirely.
 *
 * `applyRite()` already does exactly this for the year input, which it clamps to the
 * rite's floor and then notifies "matching how a user edit would", and the
 * calendar-selection path does it for this very input via `#applyCalendarToInputs()`'s
 * `notify` flag. Only the rite path was missed.
 *
 * These tests assert on what the API is actually ASKED for, not on internal state:
 * the fetch mock echoes the `Accept-Language` it received back as `settings.locale`,
 * so a disconnect between the select and the request is directly observable.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import ApiExplorer from '../MetaComponents/ApiExplorer.js';
import { ApiOptionsFilter } from '../Enums.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

/** `Accept-Language` values the mock saw, in request order. */
let sentLocales = [];
/** Request URLs the mock saw, in order, API base stripped. */
let sentUrls = [];

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.innerHTML = '<div id="opts"></div>';
    sentLocales = [];
    sentUrls = [];
    global.fetch = jest.fn((url, init) => {
        const lang = init?.headers?.['Accept-Language'] ?? '';
        sentLocales.push(lang);
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
                    settings: { locale: lang },
                }),
        });
    });
});

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
    return {
        apiClient,
        riteSelect,
        apiOptions,
        localeElement: apiOptions._localeInput._domElement,
        riteElement: riteSelect._domElement,
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

describe('a rite change keeps the locale select and Accept-Language in sync', () => {
    it('asks for the locale the select shows once the rite narrows the options', async () => {
        const { apiClient, localeElement, riteElement } = await buildForm();
        await apiClient.fetchCalendar('it');

        // `en` is offered by the Roman rite and NOT by the Ambrosian one — the
        // fixture's stand-in for the reporter's French.
        userSelects(localeElement, 'en');
        await settle();
        expect(localeElement.value).toBe('en');
        expect(sentLocales.at(-1)).toBe('en');

        userSelects(riteElement, 'ambrosian');
        await settle();

        // The rite narrowed the options, so the select now shows something else.
        expect([...localeElement.options].map((o) => o.value)).not.toContain(
            'en',
        );
        // THE REGRESSION: the request must carry what the select shows.
        expect(sentLocales.at(-1)).toBe(localeElement.value);
    });

    it('stays in sync when the rite is switched back', async () => {
        const { apiClient, localeElement, riteElement } = await buildForm();
        await apiClient.fetchCalendar('it');
        userSelects(localeElement, 'en');
        await settle();

        userSelects(riteElement, 'ambrosian');
        await settle();
        userSelects(riteElement, 'roman');
        await settle();

        expect(sentLocales.at(-1)).toBe(localeElement.value);
    });

    it('does not notify when the rite leaves the locale untouched', async () => {
        const { apiClient, localeElement, riteElement } = await buildForm();
        await apiClient.fetchCalendar('it');

        // Already `it`, which the Ambrosian rite also offers, so the rebuild
        // cannot change the value and must not fire a synthetic `change`.
        userSelects(localeElement, 'it');
        await settle();

        let changes = 0;
        localeElement.addEventListener('change', () => {
            changes += 1;
        });
        userSelects(riteElement, 'ambrosian');
        await settle();

        expect(localeElement.value).toBe('it');
        expect(changes).toBe(0);
    });
});

/**
 * The SAME root cause, seen through a second consumer. `PathBuilder` learns the
 * locale from the very same `change` listener on the locale input that `ApiClient`
 * uses, so before the fix its rendered URL kept the stale query parameter:
 * `/calendar/ambrosian?locale=fr` while the form read Italian. `ApiExplorer` never
 * fetches, so this half of the defect was visible purely in the rendered path.
 *
 * Kept beside the `ApiClient` cases deliberately: one dispatch serves both consumers,
 * and a future change that satisfies only one of them should fail here.
 */
describe("a rite change keeps PathBuilder's rendered locale in sync", () => {
    beforeEach(() => {
        document.body.innerHTML =
            '<div id="pb"></div><div id="out"></div><div id="rite"></div>';
    });

    /**
     * The rendered API path, read out of whatever element carries it.
     *
     * @returns {string} The rendered path, or '' when none was found.
     */
    const renderedPath = () =>
        [...document.querySelectorAll('#out *')]
            .map((element) => element.textContent)
            .filter((text) => text && text.includes('/calendar'))
            .pop() ?? '';

    it('renders the locale the select shows once the rite narrows the options', async () => {
        const explorer = await ApiExplorer.mountInto(
            { pathBuilder: '#pb', builder: '#out', riteSelect: '#rite' },
            { locale: 'en' },
        );
        const localeElement =
            explorer.controls.apiOptions._localeInput._domElement;
        const riteElement = explorer.controls.riteSelect._domElement;

        // `en` is offered by the Roman rite and not by the Ambrosian one.
        userSelects(localeElement, 'en');
        expect(renderedPath()).toContain('locale=en');

        userSelects(riteElement, 'ambrosian');

        expect([...localeElement.options].map((o) => o.value)).not.toContain(
            'en',
        );
        expect(renderedPath()).toContain('/calendar/ambrosian');
        // THE REGRESSION: the rendered locale must be the one on display, not the
        // one the rite just made unavailable.
        expect(renderedPath()).toContain(`locale=${localeElement.value}`);
        expect(renderedPath()).not.toContain('locale=en');
    });
});

/**
 * What a rite change actually puts on the wire. Pinned because the fix's cost was
 * initially reported — wrongly — as "no additional requests", and because the shape
 * below is easy to regress in either direction.
 *
 * `ApiClient` refetches on every input `change`, and a rite switch legitimately moves
 * several inputs at once, so a rite change that ALSO changes the locale issues more
 * than one request. What must hold is that the LAST one is correct in both respects,
 * and that a rite change which leaves the locale alone stays at exactly one.
 */
describe('what a rite change puts on the wire', () => {
    it('ends on the new rite carrying the displayed locale', async () => {
        const { apiClient, localeElement, riteElement } = await buildForm();
        await apiClient.fetchCalendar('it');
        userSelects(localeElement, 'en');
        await settle();

        sentUrls.length = 0;
        sentLocales.length = 0;
        userSelects(riteElement, 'ambrosian');
        await settle();

        expect(sentUrls.at(-1)).toContain('/calendar/ambrosian');
        expect(sentLocales.at(-1)).toBe(localeElement.value);
        // No request may end on the OLD rite — whatever precedes the last one,
        // the settled state is what the user is left looking at.
        expect(sentUrls.at(-1)).not.toContain('/calendar/roman');
    });

    it('issues exactly one request when the rite leaves the locale alone', async () => {
        const { apiClient, localeElement, riteElement } = await buildForm();
        await apiClient.fetchCalendar('it');
        userSelects(localeElement, 'it');
        await settle();

        sentUrls.length = 0;
        userSelects(riteElement, 'ambrosian');
        await settle();

        expect(localeElement.value).toBe('it');
        expect(sentUrls).toEqual(['/calendar/ambrosian/2026']);
    });
});
