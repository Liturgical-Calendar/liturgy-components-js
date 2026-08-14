/** @jest-environment jsdom */
/**
 * #65 asks whether one user action can produce more than one render, since an
 * announcement per render would then be noisy. The request coalescing added in
 * 2.5.0 should make it exactly one, and this file is what CONFIRMS that rather
 * than assuming it: it counts the announcements a mounted `WebCalendar` writes,
 * driven through the same real `change` events and the same wiring
 * `ApiClientRequestCoalescing.test.js` uses.
 *
 * It counts what a screen reader would be handed rather than counting renders,
 * because that is what the issue is about — and because the two can differ: a
 * render that repeats the previous summary changes nothing a listener hears.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import WebCalendar from '../WebCalendar/WebCalendar.js';
import { ApiOptionsFilter } from '../Enums.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    ApiClient.clearCache();
    document.body.innerHTML = '<div id="opts"></div><div id="cal"></div>';
    global.fetch = jest.fn((url, init) => {
        const lang = init?.headers?.['Accept-Language'] ?? 'en';
        return Promise.resolve({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: () =>
                Promise.resolve({
                    // Non-empty: `WebCalendar` rejects an empty `litcal`.
                    litcal: [
                        {
                            event_key: 'Advent1',
                            event_idx: 1,
                            name: 'Prima Domenica di Avvento',
                            color: ['morello'],
                            color_lcl: ['viola'],
                            grade: 7,
                            grade_lcl: 'solennità',
                            grade_abbr: 'S',
                            grade_display: '',
                            common: [],
                            common_lcl: '',
                            type: 'mobile',
                            date: '2026-11-15T00:00:00+00:00',
                            year: 2026,
                            month: 11,
                            month_short: 'Nov.',
                            month_long: 'November',
                            day: 15,
                            day_of_the_week_iso8601: 7,
                            day_of_the_week_short: 'Sun',
                            day_of_the_week_long: 'Sunday',
                            liturgical_year: 'A',
                            is_vigil_mass: false,
                            psalter_week: 1,
                            liturgical_season: 'ADVENT',
                            liturgical_season_lcl: 'Avvento',
                            holy_day_of_obligation: false,
                        },
                    ],
                    messages: [],
                    metadata: {},
                    settings: { locale: lang, year: 2026 },
                }),
        });
    });
});

/** Lets the coalescing microtask flush and the request it issues settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

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

/**
 * The wiring `CalendarControls` builds, plus a mounted `WebCalendar`.
 *
 * @returns {Promise<Object>} The wired pieces and the announcement log.
 */
const buildPage = async () => {
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
    const webCalendar = new WebCalendar();
    webCalendar.appendTo('#cal');
    webCalendar.listenTo(apiClient);
    apiClient
        .listenTo(calendarSelect)
        .listenTo(riteSelect)
        .listenTo(apiOptions);

    // Every non-empty text the region has held, in order.
    const announced = [];
    const observer = new MutationObserver(() => {
        const text = webCalendar._liveRegion.textContent;
        if ('' !== text) {
            announced.push(text);
        }
    });
    observer.observe(webCalendar._liveRegion, {
        childList: true,
        characterData: true,
        subtree: true,
    });
    return { apiClient, announced, riteSelect, calendarSelect };
};

describe('one user action produces one announcement', () => {
    it('announces once for a rite change', async () => {
        const { apiClient, announced, riteSelect } = await buildPage();
        await apiClient.fetchCalendar('it');
        await settle();
        announced.length = 0;

        userSelects(riteSelect._domElement, 'ambrosian');
        await settle();

        expect(announced).toHaveLength(1);
    });

    it('announces once for a calendar change', async () => {
        const { apiClient, announced, calendarSelect } = await buildPage();
        await apiClient.fetchCalendar('it');
        await settle();
        announced.length = 0;

        userSelects(calendarSelect._domElement, 'VA');
        await settle();

        expect(announced).toHaveLength(1);
    });

    it('announces once per action across three separate actions', async () => {
        const { apiClient, announced, riteSelect, calendarSelect } =
            await buildPage();
        await apiClient.fetchCalendar('it');
        await settle();
        announced.length = 0;

        userSelects(riteSelect._domElement, 'ambrosian');
        await settle();
        userSelects(riteSelect._domElement, 'roman');
        await settle();
        userSelects(calendarSelect._domElement, 'VA');
        await settle();

        // Asserted as a SEQUENCE, not a count: a length of three would also be
        // satisfied by one action announcing nothing and another announcing
        // twice, which is exactly the failure this file exists to catch.
        //
        // The Vatican announcement reads as the rite-level calendar rather than
        // as a national one because the mock returns a fixed `settings` object
        // with no `national_calendar` key — a fixture artifact. Its language is
        // Latin because selecting Vatican rewrites the locale input, which is
        // real behaviour and part of why one action can move several inputs.
        expect(announced).toEqual([
            'Calendario Ambrosiano - 2026, 1 voce',
            'Calendario romano generale - 2026, 1 voce',
            'Calendarium Romanum Generale - 2026, 1 celebratio',
        ]);
    });
});
