/** @jest-environment jsdom */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiClient from '../ApiClient/ApiClient.js';
import ApiBase from '../ApiClient/ApiBase.js';
import WebCalendar from '../WebCalendar/WebCalendar.js';
import { Rite } from '../Enums.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

/**
 * One event, shaped like a real `/calendar` response entry. Only the fields
 * `buildTable()` reads are kept — the point of the fixture is the caption, not
 * the rows.
 */
const calendarData = ( settings = {} ) => ( {
    litcal: [ {
        event_key: 'Advent1',
        event_idx: 1,
        name: 'Dominica I in Adventu Domini',
        color: [ 'morello' ],
        color_lcl: [ 'violaceus' ],
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
        liturgical_year: 'A',
        is_vigil_mass: false,
        psalter_week: 1,
        liturgical_season: 'ADVENT',
        liturgical_season_lcl: 'Advent',
        holy_day_of_obligation: false
    } ],
    settings: { year: 2026, locale: 'en', year_type: 'LITURGICAL', ...settings },
    metadata: { version: 'test' },
    messages: []
} );

let apiClient;

// A fresh registry and client per test, built straight from the shared fixture.
// No `global.fetch` mock at all: every payload below is handed to the client
// directly, through the same `calendarFetched` event a real response would take.
beforeEach( async () => {
    ApiBase.reset();
    ApiBase.fromMetadata( API_URL, FULL_METADATA );
    apiClient = await ApiClient.init( API_URL );
} );

/**
 * Pushes calendar data through the same path a real fetch takes, so the rite is
 * picked up exactly as it is in production rather than by poking the instance.
 *
 * `buildTable()` is async and the `calendarFetched` handler is not awaited by
 * `emit`, so yield to the microtask queue before reading the DOM.
 *
 * The caption's language comes from the PAYLOAD, not from `locale()`:
 * `buildTable()` reassigns the locale from `settings.locale` on every build. So
 * the fixture drives it, and calling `locale()` here would be misleading.
 */
const renderVia = async ( webCalendar, data ) => {
    const container = document.createElement( 'div' );
    webCalendar.appendTo( container );
    webCalendar.listenTo( apiClient );
    apiClient._eventBus.emit( 'calendarFetched', data );
    await new Promise( resolve => setTimeout( resolve, 0 ) );
    return container.querySelector( 'caption' )?.textContent ?? null;
};

describe( 'WebCalendar caption for a rite-level calendar', () => {

    it( 'captions the General Roman calendar as before', async () => {
        const caption = await renderVia( new WebCalendar(), calendarData() );
        expect( caption ).toBe( 'General Roman Calendar - 2026' );
    } );

    it( 'captions the Ambrosian calendar by its own name, not General Roman', async () => {
        // The payload cannot distinguish the two: neither carries a
        // national_calendar or diocesan_calendar setting, and there is no rite
        // field in the response. Before the rite was plumbed through, an
        // Ambrosian calendar was captioned "General Roman Calendar".
        apiClient.rite( Rite.AMBROSIAN );
        const caption = await renderVia( new WebCalendar(), calendarData() );
        expect( caption ).toBe( 'Ambrosian Calendar - 2026' );
    } );

    it( 'uses the Italian caption for an Italian locale', async () => {
        apiClient.rite( Rite.AMBROSIAN );
        const caption = await renderVia( new WebCalendar(), calendarData( { locale: 'it' } ) );
        expect( caption ).toBe( 'Calendario Ambrosiano - 2026' );
    } );

    it( 'uses the Dutch caption for a Dutch locale', async () => {
        apiClient.rite( Rite.AMBROSIAN );
        const caption = await renderVia( new WebCalendar(), calendarData( { locale: 'nl' } ) );
        expect( caption ).toBe( 'Ambrosiaanse kalender - 2026' );
    } );

    it( 'falls back to English for a locale with no rite-specific caption', async () => {
        // Rite captions exist for the twelve locales this project maintains
        // (en, it, la, es, fr, de, pt, nl, hu, id, sk, vi). Polish is one of the
        // many locales that carry the other messages but not yet the rite ones,
        // so it still exercises the English fallback.
        apiClient.rite( Rite.AMBROSIAN );
        const caption = await renderVia( new WebCalendar(), calendarData( { locale: 'pl' } ) );
        expect( caption ).toBe( 'Ambrosian Calendar - 2026' );
    } );

    it( 'leaves a diocesan caption alone, since it is named after the calendar', async () => {
        apiClient.rite( Rite.AMBROSIAN );
        const data = calendarData( { diocesan_calendar: 'lugano_ch' } );
        data.metadata.diocese_name = 'Diocesi di Lugano';
        const caption = await renderVia( new WebCalendar(), data );
        expect( caption ).toContain( 'Diocesi di Lugano' );
    } );

    it( 'captions data by the rite its request was made under, not the current rite', async () => {
        // A rite change can leave two requests in flight — one fired through the
        // calendar select by ApiOptions, one through ApiClient's rite listener.
        // If the earlier, Roman one lands LAST, reading apiClient._currentRite
        // at render time would caption Roman data as Ambrosian.
        const webCalendar = new WebCalendar();
        const container = document.createElement( 'div' );
        webCalendar.appendTo( container );
        webCalendar.listenTo( apiClient );

        // The client has already moved on to Ambrosian...
        apiClient.rite( Rite.AMBROSIAN );
        // ...but this response belongs to the earlier Roman request.
        apiClient._eventBus.emit( 'calendarFetched', calendarData(), { rite: Rite.ROMAN } );
        await new Promise( resolve => setTimeout( resolve, 0 ) );

        expect( container.querySelector( 'caption' ).textContent ).toBe( 'General Roman Calendar - 2026' );
    } );

    it( 'can be set directly, without an ApiClient', () => {
        const webCalendar = new WebCalendar();
        expect( webCalendar.rite( Rite.AMBROSIAN ) ).toBe( webCalendar );
        expect( () => webCalendar.rite( 'byzantine' ) ).toThrow( /Invalid rite/ );
    } );
} );
