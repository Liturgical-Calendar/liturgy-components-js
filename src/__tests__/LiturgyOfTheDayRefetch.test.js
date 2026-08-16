/** @jest-environment jsdom */
/**
 * `#updateEventDetails()` appended without clearing, so a second
 * `calendarFetched` rendered today's liturgy twice. CLAUDE.md recorded this as
 * a separate defect; it stops being separate once `TodayViewer` can expose a
 * control whose change triggers a refetch.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiClient from '../ApiClient/ApiClient.js';
import ApiBase from '../ApiClient/ApiBase.js';
import LiturgyOfTheDay from '../LiturgyOfTheDay/LiturgyOfTheDay.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

const today = new Date();
const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

const payload = () => ({
    litcal: [
        {
            event_key: 'Advent1',
            event_idx: 1,
            name: 'Dominica I in Adventu Domini',
            color: ['white'],
            color_lcl: ['albus'],
            grade: 7,
            grade_lcl: 'sollemnitas',
            grade_abbr: 'S',
            grade_display: '',
            common: [],
            common_lcl: '',
            type: 'mobile',
            date: `${iso}T00:00:00+00:00`,
            year: today.getFullYear(),
            month: today.getMonth() + 1,
            month_short: 'Nov.',
            month_long: 'November',
            day: today.getDate(),
            day_of_the_week_iso8601: 7,
            day_of_the_week_short: 'Sun',
            day_of_the_week_long: 'Sunday',
            liturgical_year: 'A',
            is_vigil_mass: false,
            psalter_week: 1,
            liturgical_season: 'ADVENT',
            liturgical_season_lcl: 'Advent',
            holy_day_of_obligation: false,
        },
    ],
    settings: { year: today.getFullYear(), locale: 'en', year_type: 'CIVIL' },
    metadata: { version: 'test' },
    messages: [],
});

let apiClient;

beforeEach(async () => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    apiClient = await ApiClient.init(API_URL);
    document.body.innerHTML = '<div id="host"></div>';
});

describe('LiturgyOfTheDay on a refetch', () => {
    it('replaces its events rather than appending a second copy', () => {
        const liturgy = new LiturgyOfTheDay({ locale: 'en' });
        liturgy.listenTo(apiClient);
        liturgy.appendTo('#host');

        apiClient._eventBus.emit('calendarFetched', payload());
        const afterFirst = document.querySelectorAll('#host h3').length;
        expect(afterFirst).toBe(1);

        apiClient._eventBus.emit('calendarFetched', payload());
        expect(document.querySelectorAll('#host h3').length).toBe(1);
    });

    it('shows the new events, not the old ones, after a refetch', () => {
        const liturgy = new LiturgyOfTheDay({ locale: 'en' });
        liturgy.listenTo(apiClient);
        liturgy.appendTo('#host');

        apiClient._eventBus.emit('calendarFetched', payload());
        const second = payload();
        second.litcal[0].name = 'Sanctorum Petri et Pauli';
        apiClient._eventBus.emit('calendarFetched', second);

        const headings = [...document.querySelectorAll('#host h3')].map(
            (h) => h.textContent,
        );
        expect(headings).toEqual(['Sanctorum Petri et Pauli']);
    });
});
