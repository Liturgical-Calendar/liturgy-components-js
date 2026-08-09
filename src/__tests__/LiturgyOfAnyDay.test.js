/** @jest-environment jsdom */
/**
 * `LiturgyOfAnyDay` has never had a suite of its own. It pins:
 *
 *  - the chainability contract (configuration methods return `this`, `appendTo()`
 *    does not),
 *  - what it renders from a `calendarFetched` payload, including the border it
 *    adds for a white background — a behaviour `LiturgyOfTheDay` deliberately
 *    does NOT have, see `LiturgyOfTheDay.test.js`,
 *  - the caching claim in CLAUDE.md: changing day or month re-renders from
 *    already-fetched data with NO api call, and only a year change (or a
 *    year_type change forced by the December 31st rule) triggers a refetch, and
 *  - the December 31st rule itself: `listenTo()` configures the initial
 *    year_type/year, crossing INTO December 31st switches to
 *    `year_type=LITURGICAL` with `year+1`, and crossing back out reverts to
 *    `year_type=CIVIL`.
 *
 * The locale argument matrix (string vs `Intl.Locale` vs options bag, null vs
 * undefined, canonicalization) is already covered for this component in
 * `ComponentOptionsValidation.test.js` and is deliberately not repeated here.
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import LiturgyOfAnyDay from '../LiturgyOfAnyDay/LiturgyOfAnyDay.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const DEV = 'http://localhost:8000';

beforeEach( () => {
    ApiBase.reset();
    ApiBase.fromMetadata( DEV, FULL_METADATA );
} );

afterEach( () => {
    jest.useRealTimers();
    delete global.fetch;
} );

/**
 * A single fully-shaped `/calendar` event, matching the fields the real API
 * sends and `#updateEventDetails` reads.
 *
 * @param {Object} [overrides] - Fields to override on the default event.
 * @returns {Object} One `litcal[]` entry.
 */
const buildEvent = ( overrides = {} ) => ( {
    event_key: 'StJohnVianney',
    event_idx: 1,
    name: 'Saint John Mary Vianney, Priest',
    color: [ 'white' ],
    color_lcl: [ 'white' ],
    grade: 3,
    grade_lcl: 'Memorial',
    grade_abbr: 'M',
    grade_display: null,
    common: [ 'Pastors' ],
    common_lcl: 'Pastors',
    type: 'fixed',
    date: '2026-06-15T00:00:00+00:00',
    year: 2026,
    month: 6,
    month_short: 'Jun.',
    month_long: 'June',
    day: 15,
    day_of_the_week_iso8601: 1,
    day_of_the_week_short: 'Mon',
    day_of_the_week_long: 'Monday',
    liturgical_year: null,
    is_vigil_mass: false,
    psalter_week: 2,
    liturgical_season: 'ORDINARY_TIME',
    liturgical_season_lcl: 'Ordinary Time',
    holy_day_of_obligation: false,
    ...overrides
} );

/**
 * A full `/calendar` response payload wrapping the given events.
 *
 * @param {Object[]} events - The `litcal[]` entries.
 * @param {Object} [settingsOverrides] - Overrides for the `settings` object.
 * @returns {Object} The payload `listenTo()`'s handler expects.
 */
const buildCalendarData = ( events, settingsOverrides = {} ) => ( {
    litcal: events,
    settings: { year: 2026, locale: 'en', year_type: 'CIVIL', ...settingsOverrides },
    metadata: { version: 'test' },
    messages: []
} );

/**
 * A fixed, mid-month, midday-UTC "today" for the tests that need a deterministic
 * — and deterministly non-December-31st — selected date, independent of both the
 * host machine's timezone and the day the suite happens to run on.
 */
const MID_JUNE = '2026-06-15T12:00:00Z';

describe( 'LiturgyOfAnyDay configuration methods are chainable', () => {

    let widget;
    let apiClient;

    beforeEach( async () => {
        widget = new LiturgyOfAnyDay( 'en' );
        apiClient = await ApiClient.init( DEV );
    } );

    /**
     * Every one of these returns `this` in the source; if any lost its
     * `return this` the corresponding row would fail with `undefined`.
     */
    const CHAINABLE = [
        [ 'id', () => widget.id( 'any-day' ) ],
        [ 'class', () => widget.class( 'card' ) ],
        [ 'titleClass', () => widget.titleClass( 'h1' ) ],
        [ 'dateClass', () => widget.dateClass( 'card-header' ) ],
        [ 'dateControlsClass', () => widget.dateControlsClass( 'row' ) ],
        [ 'eventsWrapperClass', () => widget.eventsWrapperClass( 'events' ) ],
        [ 'eventClass', () => widget.eventClass( 'event' ) ],
        [ 'eventGradeClass', () => widget.eventGradeClass( 'grade' ) ],
        [ 'eventCommonClass', () => widget.eventCommonClass( 'common' ) ],
        [ 'eventYearCycleClass', () => widget.eventYearCycleClass( 'cycle' ) ],
        [ 'readingsWrapperClass', () => widget.readingsWrapperClass( 'readings' ) ],
        [ 'readingsLabelClass', () => widget.readingsLabelClass( 'reading-label' ) ],
        [ 'readingClass', () => widget.readingClass( 'reading' ) ],
        [ 'showReadings', () => widget.showReadings( false ) ],
        [ 'dayInputConfig', () => widget.dayInputConfig( { class: 'form-control' } ) ],
        [ 'monthInputConfig', () => widget.monthInputConfig( { class: 'form-select' } ) ],
        [ 'yearInputConfig', () => widget.yearInputConfig( { class: 'form-control' } ) ],
        [ 'buildDateControls', () => widget.buildDateControls() ],
        [ 'listenTo', () => widget.listenTo( apiClient ) ]
    ];

    it.each( CHAINABLE )( '%s returns the instance for chaining', ( _name, call ) => {
        expect( call() ).toBe( widget );
    } );

} );

describe( 'LiturgyOfAnyDay.appendTo', () => {

    it( 'returns undefined, unlike the configuration methods, and still inserts the element', () => {
        const widget = new LiturgyOfAnyDay( 'en' );
        const container = document.createElement( 'div' );
        expect( widget.appendTo( container ) ).toBeUndefined();
        expect( container.contains( widget._domElement ) ).toBe( true );
    } );

} );

describe( 'LiturgyOfAnyDay renders events from a calendarFetched payload', () => {

    let apiClient;
    let widget;

    beforeEach( async () => {
        jest.useFakeTimers().setSystemTime( new Date( MID_JUNE ) );
        apiClient = await ApiClient.init( DEV );
        widget = new LiturgyOfAnyDay( 'en' )
            .eventClass( 'event' )
            .eventGradeClass( 'grade' )
            .eventCommonClass( 'common' )
            .eventYearCycleClass( 'cycle' )
            .readingsWrapperClass( 'readings' )
            .buildDateControls()
            .listenTo( apiClient );
    } );

    it( 'renders only the event matching the selected date, not other days on the same payload', () => {
        apiClient._eventBus.emit( 'calendarFetched', buildCalendarData( [
            buildEvent( { event_key: 'Yesterday', name: 'Not Today', date: '2026-06-14T00:00:00+00:00', day: 14 } ),
            buildEvent()
        ] ) );
        expect( widget._eventsElementsWrapper.children.length ).toBe( 1 );
        expect( widget._eventsElementsWrapper.textContent ).toContain( 'Saint John Mary Vianney' );
        expect( widget._eventsElementsWrapper.textContent ).not.toContain( 'Not Today' );
    } );

    it( 'shows a placeholder message when no event matches the selected date', () => {
        apiClient._eventBus.emit( 'calendarFetched', buildCalendarData( [
            buildEvent( { date: '2026-06-14T00:00:00+00:00', day: 14 } )
        ] ) );
        expect( widget._eventsElementsWrapper.textContent ).toContain( 'No liturgical events found for this date.' );
    } );

    it( 'renders name, grade and common of the celebration', () => {
        apiClient._eventBus.emit( 'calendarFetched', buildCalendarData( [ buildEvent() ] ) );
        const eventEl = widget._eventsElementsWrapper.firstElementChild;
        expect( eventEl.classList.contains( 'event' ) ).toBe( true );
        expect( eventEl.querySelector( 'h3' ).textContent ).toBe( 'Saint John Mary Vianney, Priest' );
        const gradeEl = eventEl.querySelector( '.grade' );
        expect( gradeEl.textContent ).toBe( 'Memorial' );
        expect( gradeEl.classList.contains( 'grade-3' ) ).toBe( true );
        expect( eventEl.querySelector( '.common' ).textContent ).toBe( 'Pastors' );
    } );

    /**
     * Mirrors the identical filter in LiturgyOfTheDay: see that suite for the
     * two-sided rationale, and for why grade must be < 7 here — grade >= 7
     * collapses `lclzdGrade` to '' on its own, which would make this pass even
     * with the OrdSunday/Advent/Lent/Easter filter itself gutted.
     */
    it( 'suppresses the grade text for an Ordinary Sunday event_key', () => {
        apiClient._eventBus.emit( 'calendarFetched', buildCalendarData( [
            buildEvent( { event_key: 'OrdSunday15', name: 'Fifteenth Sunday in Ordinary Time', grade: 4, grade_lcl: 'Sunday', grade_display: null } )
        ] ) );
        expect( widget._eventsElementsWrapper.firstElementChild.querySelector( '.grade' ) ).toBeNull();
    } );

    /**
     * High-contrast white text on green/red/purple backgrounds, black text
     * everywhere else — the SAME rule LiturgyOfTheDay applies.
     */
    it.each( [
        [ 'purple', 'white' ],
        [ 'red', 'white' ],
        [ 'green', 'white' ],
        [ 'pink', 'black' ],
        [ 'white', 'black' ]
    ] )( 'colors a %s background with %s text', ( bgColor, expectedTextColor ) => {
        apiClient._eventBus.emit( 'calendarFetched', buildCalendarData( [ buildEvent( { color: [ bgColor ] } ) ] ) );
        const eventEl = widget._eventsElementsWrapper.firstElementChild;
        expect( eventEl.style.backgroundColor ).toBe( bgColor );
        expect( eventEl.style.color ).toBe( expectedTextColor );
    } );

    /**
     * The behaviour CLAUDE.md calls out specifically for THIS component: "Border
     * added for white backgrounds to distinguish from parent". `LiturgyOfTheDay`
     * has no such border (pinned in its own suite), so this is where that claim
     * actually needs to hold.
     */
    it( 'adds a border for a white background', () => {
        apiClient._eventBus.emit( 'calendarFetched', buildCalendarData( [ buildEvent( { color: [ 'white' ] } ) ] ) );
        // jsdom's CSSOM normalizes the hex color the source assigns to an rgb()
        // triplet, so the assertion matches on that normalized form rather than
        // the literal string the source writes.
        expect( widget._eventsElementsWrapper.firstElementChild.style.border ).toBe( '1px solid rgb(222, 226, 230)' );
    } );

    it( 'adds no border for a non-white background', () => {
        apiClient._eventBus.emit( 'calendarFetched', buildCalendarData( [ buildEvent( { color: [ 'green' ] } ) ] ) );
        expect( widget._eventsElementsWrapper.firstElementChild.style.border ).toBe( '' );
    } );

    it( 'renders lectionary readings when present and showReadings is enabled', () => {
        apiClient._eventBus.emit( 'calendarFetched', buildCalendarData( [
            buildEvent( { readings: { first_reading: 'Gn 1:1', gospel: 'Jn 1:1' } } )
        ] ) );
        const readingsEl = widget._eventsElementsWrapper.firstElementChild.querySelector( '.readings' );
        expect( readingsEl.textContent ).toContain( 'First Reading: Gn 1:1' );
        expect( readingsEl.textContent ).toContain( 'Gospel: Jn 1:1' );
    } );

    it( 'omits lectionary readings when showReadings( false ) has been called', () => {
        widget.showReadings( false );
        apiClient._eventBus.emit( 'calendarFetched', buildCalendarData( [
            buildEvent( { readings: { first_reading: 'Gn 1:1' } } )
        ] ) );
        expect( widget._eventsElementsWrapper.firstElementChild.querySelector( '.readings' ) ).toBeNull();
    } );

} );

/**
 * See `LiturgyOfTheDay.test.js`, "LiturgyOfTheDay.listenTo validates the shape of
 * calendarFetched payloads", for why these go through the listener directly
 * rather than through `_eventBus.emit()`: this handler is also `async` with no
 * `await`, so a throw inside it is a promise rejection nothing awaits when routed
 * through `emit()`'s bare `forEach` — verified, while writing that suite, to
 * hard-crash the Node process running the tests rather than merely fail a test.
 * The identical `it.skip` documenting that as a product bug is not repeated here
 * to avoid two live descriptions of one root cause; the finding applies to this
 * component exactly as written there.
 */
describe( 'LiturgyOfAnyDay.listenTo validates the shape of calendarFetched payloads', () => {

    let apiClient;
    let listener;

    beforeEach( async () => {
        apiClient = await ApiClient.init( DEV );
        new LiturgyOfAnyDay( 'en' ).listenTo( apiClient );
        const listeners = apiClient._eventBus._events.calendarFetched;
        listener = listeners[ listeners.length - 1 ];
    } );

    it( 'rejects when litcal is missing', async () => {
        await expect( listener( {} ) ).rejects.toThrow( /Invalid liturgical calendar data/ );
    } );

    it( 'rejects when litcal is empty', async () => {
        await expect( listener( { litcal: [] } ) ).rejects.toThrow( /Invalid liturgical calendar data/ );
    } );

} );

describe( 'LiturgyOfAnyDay caching: day and month changes render without a refetch', () => {

    let apiClient;
    let widget;

    beforeEach( async () => {
        jest.useFakeTimers().setSystemTime( new Date( MID_JUNE ) );
        apiClient = await ApiClient.init( DEV );
        widget = new LiturgyOfAnyDay( 'en' ).buildDateControls().listenTo( apiClient );
        widget.appendTo( document.createElement( 'div' ) );
        // Seeds the widget with data covering two distinct June days, exactly as a
        // real fetch response landing through `calendarFetched` would, so that
        // navigating within that range needs no request at all.
        apiClient._eventBus.emit( 'calendarFetched', buildCalendarData( [
            buildEvent( { name: 'The 15th', date: '2026-06-15T00:00:00+00:00', day: 15 } ),
            buildEvent( { name: 'The 20th', date: '2026-06-20T00:00:00+00:00', day: 20 } )
        ] ) );
        global.fetch = jest.fn().mockResolvedValue( { ok: true, json: async () => buildCalendarData( [ buildEvent() ] ) } );
    } );

    /**
     * The substance of the caching claim: NOT "the right day rendered" alone —
     * that would pass even if a refetch fired on every change — but that no
     * network call happened at all. `global.fetch` is asserted un-called, not
     * merely that the promise resolved a particular way.
     */
    it( 'changing the day re-renders from already-fetched data and calls no fetch', () => {
        widget._dayInput._domElement.value = '20';
        widget._dayInput._domElement.dispatchEvent( new Event( 'change' ) );
        expect( global.fetch ).not.toHaveBeenCalled();
        expect( widget._eventsElementsWrapper.textContent ).toContain( 'The 20th' );
        expect( widget._eventsElementsWrapper.textContent ).not.toContain( 'The 15th' );
    } );

    it( 'changing the month, without crossing into or out of December 31st, calls no fetch', () => {
        widget._monthInput._domElement.value = '7';
        widget._monthInput._domElement.dispatchEvent( new Event( 'change' ) );
        expect( global.fetch ).not.toHaveBeenCalled();
    } );

    it( 'changing the year triggers exactly one refetch', () => {
        widget._yearInput._domElement.value = '2028';
        widget._yearInput._domElement.dispatchEvent( new Event( 'change' ) );
        expect( global.fetch ).toHaveBeenCalledTimes( 1 );
    } );

} );

describe( 'LiturgyOfAnyDay: December 31st year_type handling', () => {

    /**
     * Issues one calendar request and reports the URL (which carries the
     * requested year as a path segment) and the decoded request body (which
     * carries `year_type`), without a real network call.
     *
     * @param {ApiClient} apiClient
     * @returns {Promise<{url: string, year_type: string}>}
     */
    const captureRequest = async ( apiClient ) => {
        global.fetch = jest.fn().mockResolvedValue( { ok: true, json: async () => buildCalendarData( [ buildEvent() ] ) } );
        await apiClient.refetchCalendarData();
        const [ url, options ] = global.fetch.mock.calls[ 0 ];
        return { url, year_type: JSON.parse( options.body ).year_type };
    };

    it( 'listenTo requests LITURGICAL year_type and year+1 when constructed on December 31st', async () => {
        jest.useFakeTimers().setSystemTime( new Date( '2026-12-31T12:00:00Z' ) );
        const apiClient = await ApiClient.init( DEV );
        new LiturgyOfAnyDay( 'en' ).listenTo( apiClient );
        const { url, year_type } = await captureRequest( apiClient );
        expect( url ).toContain( '/2027' );
        expect( year_type ).toBe( 'LITURGICAL' );
    } );

    it( 'listenTo requests CIVIL year_type and the current year when constructed on any other date', async () => {
        jest.useFakeTimers().setSystemTime( new Date( MID_JUNE ) );
        const apiClient = await ApiClient.init( DEV );
        new LiturgyOfAnyDay( 'en' ).listenTo( apiClient );
        const { url, year_type } = await captureRequest( apiClient );
        expect( url ).toContain( '/2026' );
        expect( year_type ).toBe( 'CIVIL' );
    } );

    /**
     * The whole documented lifecycle in one flow: crossing INTO December 31st
     * switches to LITURGICAL/year+1 with exactly one refetch, and crossing back
     * OUT reverts to CIVIL/year with exactly one more — asserted as a sequence
     * because CLAUDE.md itself states the pair as one rule ("switching away from
     * December 31st reverts to year_type=CIVIL").
     */
    it( 'switching to December 31st and back triggers exactly the two expected refetches', async () => {
        jest.useFakeTimers().setSystemTime( new Date( MID_JUNE ) );
        const apiClient = await ApiClient.init( DEV );
        const widget = new LiturgyOfAnyDay( 'en' ).buildDateControls().listenTo( apiClient );
        global.fetch = jest.fn().mockResolvedValue( { ok: true, json: async () => buildCalendarData( [ buildEvent() ] ) } );

        // Cross into December 31st: set the day directly (no dispatch needed — the
        // month change handler below reads whatever the day input currently holds)
        // then dispatch the month change that actually triggers `#handleDateChange`.
        widget._dayInput._domElement.value = '31';
        widget._monthInput._domElement.value = '12';
        widget._monthInput._domElement.dispatchEvent( new Event( 'change' ) );

        expect( global.fetch ).toHaveBeenCalledTimes( 1 );
        const [ intoUrl, intoOptions ] = global.fetch.mock.calls[ 0 ];
        expect( intoUrl ).toContain( '/2027' );
        expect( JSON.parse( intoOptions.body ).year_type ).toBe( 'LITURGICAL' );

        // Cross back out: `#updateDaysInMonth` clamps day 31 down to June's 30
        // before `#handleDateChange` reads it, so December 31st is left cleanly.
        widget._monthInput._domElement.value = '6';
        widget._monthInput._domElement.dispatchEvent( new Event( 'change' ) );

        expect( global.fetch ).toHaveBeenCalledTimes( 2 );
        const [ outUrl, outOptions ] = global.fetch.mock.calls[ 1 ];
        expect( outUrl ).toContain( '/2026' );
        expect( JSON.parse( outOptions.body ).year_type ).toBe( 'CIVIL' );
    } );

} );
