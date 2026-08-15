/** @jest-environment jsdom */
/**
 * The event-details cell built four API-supplied fields — `name`,
 * `liturgical_year`, `color_lcl` and `common_lcl` — into an HTML STRING and
 * passed it to `Range.createContextualFragment()`. That is an injection sink:
 * unlike `innerHTML` on a detached node it is not even resource-inert, and an
 * `<img onerror>` in any of those fields fires the moment the fragment is
 * appended.
 *
 * Unlike the API's `messages` array, these four fields are PLAIN TEXT in the
 * source data — no anchors, no emphasis, nothing to preserve — so the fix is to
 * build the nodes rather than to sanitize markup. `sanitizeHtml()` would also
 * have closed the hole, but it would have declared these fields rich text and
 * invited markup into them later; `textContent` says what is true.
 *
 * The first describe pins the rendered SHAPE, which nothing covered before, so
 * that the rewrite is provably output-identical for well-behaved data.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiClient from '../ApiClient/ApiClient.js';
import ApiBase from '../ApiClient/ApiBase.js';
import WebCalendar from '../WebCalendar/WebCalendar.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

/**
 * @param {Object} [overrides] - Fields to override on the single event.
 * @returns {Object} A payload shaped like a real `/calendar` response.
 */
const calendarData = (overrides = {}) => ({
    litcal: [
        {
            event_key: 'Advent1',
            event_idx: 1,
            name: 'Dominica I in Adventu Domini',
            color: ['morello'],
            color_lcl: ['violaceus'],
            grade: 7,
            grade_lcl: 'sollemnitas',
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
            liturgical_year: null,
            is_vigil_mass: false,
            psalter_week: 1,
            liturgical_season: 'ADVENT',
            liturgical_season_lcl: 'Advent',
            holy_day_of_obligation: false,
            ...overrides,
        },
    ],
    settings: { year: 2026, locale: 'en', year_type: 'LITURGICAL' },
    metadata: { version: 'test' },
    messages: [],
});

let apiClient;

beforeEach(async () => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    apiClient = await ApiClient.init(API_URL);
    document.body.innerHTML = '';
});

/**
 * @param {Object} [overrides] - Fields to override on the single event.
 * @returns {Promise<HTMLElement>} The rendered event-details cell.
 */
const renderCell = async (overrides = {}) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const webCalendar = new WebCalendar({ locale: 'en' });
    webCalendar.appendTo(container);
    webCalendar.listenTo(apiClient);
    apiClient._eventBus.emit('calendarFetched', calendarData(overrides));
    await new Promise((resolve) => setTimeout(resolve, 0));
    return container.querySelector('td.eventDetails');
};

describe('the event details cell, for well-behaved data', () => {
    it('renders the name, the colours in italics, a break, and the commons', async () => {
        const cell = await renderCell({
            name: 'Sanctorum Petri et Pauli',
            color_lcl: ['ruber', 'albus'],
            common_lcl: 'Pastorum',
        });
        // Anchored to the END rather than compared whole: the default
        // `eventColor` prepends a colour-indicator `<span>` carrying inline
        // styling, which this rewrite does not touch and should not be
        // coupled to. The tail is the exact region being changed.
        expect(cell.innerHTML).toMatch(
            /Sanctorum Petri et Pauli - <i>ruber or albus<\/i><br><i>Pastorum<\/i>$/,
        );
    });

    it('appends the liturgical year cycle in parentheses when present', async () => {
        const cell = await renderCell({
            name: 'Dominica I',
            liturgical_year: 'A',
            color_lcl: ['violaceus'],
        });
        expect(cell.textContent).toContain('Dominica I (A) - ');
    });

    it('joins a single colour without a separator', async () => {
        const cell = await renderCell({ color_lcl: ['violaceus'] });
        expect(cell.querySelector('i').textContent).toBe('violaceus');
    });
});

describe('the event details cell, for hostile data', () => {
    it('renders markup in the name as text, not as elements', async () => {
        const cell = await renderCell({
            name: '<img src=x onerror="globalThis.__xss = true">Advent',
        });
        expect(cell.querySelector('img')).toBeNull();
        expect(globalThis.__xss).toBeUndefined();
        expect(cell.textContent).toContain('<img src=x');
        expect(cell.textContent).toContain('Advent');
    });

    it('renders markup in common_lcl as text', async () => {
        const cell = await renderCell({
            common_lcl: '<img src=x onerror="globalThis.__xss2 = true">',
        });
        expect(cell.querySelector('img')).toBeNull();
        expect(globalThis.__xss2).toBeUndefined();
    });

    it('renders markup in color_lcl as text', async () => {
        const cell = await renderCell({
            color_lcl: ['<script>globalThis.__xss3 = true</script>', 'albus'],
        });
        expect(cell.querySelector('script')).toBeNull();
        expect(globalThis.__xss3).toBeUndefined();
        expect(cell.textContent).toContain('albus');
    });

    it('renders markup in the liturgical year as text', async () => {
        // The least obvious of the four: it reaches the string through
        // `currentCycle`, not directly.
        const cell = await renderCell({
            liturgical_year: '<img src=x onerror="globalThis.__xss4 = true">',
        });
        expect(cell.querySelector('img')).toBeNull();
        expect(globalThis.__xss4).toBeUndefined();
    });

    it('does not let a closing tag break out of the italics', async () => {
        // String interpolation's other failure mode: not injecting an element,
        // but ending one early and restructuring everything after it.
        const cell = await renderCell({
            color_lcl: ['</i><b>escaped</b><i>'],
        });
        expect(cell.querySelector('b')).toBeNull();
        expect(cell.querySelectorAll('i').length).toBe(2);
    });
});
