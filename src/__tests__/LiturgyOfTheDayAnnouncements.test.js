/** @jest-environment jsdom */
/**
 * `LiturgyOfTheDay` had no live region because its `calendarFetched` handler
 * used to append rather than replace, so a second fetch would have doubled
 * the announced content. That duplication is gone (see
 * `LiturgyOfTheDayRefetch.test.js`), so the region can be added — mirroring
 * `WebCalendar` and `LiturgyOfAnyDay`.
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

describe('LiturgyOfTheDay live region', () => {
    it('mounts a polite, atomic status region', () => {
        const liturgy = new LiturgyOfTheDay({ locale: 'en' });
        liturgy.listenTo(apiClient);
        liturgy.appendTo('#host');
        apiClient._eventBus.emit('calendarFetched', payload());

        const region = document.querySelector('#host [role="status"]');
        expect(region).not.toBeNull();
        expect(region.getAttribute('aria-live')).toBe('polite');
        expect(region.getAttribute('aria-atomic')).toBe('true');
    });

    it('says nothing on the first render', () => {
        const liturgy = new LiturgyOfTheDay({ locale: 'en' });
        liturgy.listenTo(apiClient);
        liturgy.appendTo('#host');
        apiClient._eventBus.emit('calendarFetched', payload());
        expect(
            document.querySelector('#host [role="status"]').textContent,
        ).toBe('');
    });

    it('announces on a later render', () => {
        const liturgy = new LiturgyOfTheDay({ locale: 'en' });
        liturgy.listenTo(apiClient);
        liturgy.appendTo('#host');
        apiClient._eventBus.emit('calendarFetched', payload());
        apiClient._eventBus.emit('calendarFetched', payload());
        expect(
            document.querySelector('#host [role="status"]').textContent.length,
        ).toBeGreaterThan(0);
    });

    it('stays silent when announceUpdates is false', () => {
        const liturgy = new LiturgyOfTheDay({
            locale: 'en',
            announceUpdates: false,
        });
        liturgy.listenTo(apiClient);
        liturgy.appendTo('#host');
        apiClient._eventBus.emit('calendarFetched', payload());
        apiClient._eventBus.emit('calendarFetched', payload());
        expect(document.querySelector('#host [role="status"]')).toBeNull();
    });
});
