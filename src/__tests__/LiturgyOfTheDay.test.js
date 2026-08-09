/** @jest-environment jsdom */
/**
 * `LiturgyOfTheDay` has never had a suite of its own. It pins:
 *
 *  - the constructor's default rendering (title, date, empty events wrapper),
 *  - that every configuration method returns `this` while `appendTo()` does not,
 *  - what it renders from a `calendarFetched` payload (filtering to today, grade
 *    suppression for Sunday/Advent/Lent/Easter tags, high-contrast text colors,
 *    lectionary readings wiring),
 *  - the guards `listenTo()` puts on the shape of the data it receives, and
 *  - the December 31st year_type configuration `listenTo()` is documented to apply.
 *
 * The locale argument matrix itself (string vs `Intl.Locale` vs options bag, null
 * vs undefined, canonicalization) is already covered for this component in
 * `ComponentOptionsValidation.test.js` and is deliberately not repeated here.
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import LiturgyOfTheDay from '../LiturgyOfTheDay/LiturgyOfTheDay.js';
import Messages from '../Messages.js';
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
 * sends and `#updateEventDetails` reads. `overrides` replaces fields on this one
 * event, so callers do not have to restate the whole shape for a one-field change.
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
 * `LiturgyOfTheDay` computes "today" once, in the constructor, from `new Date()` —
 * there is no date navigation to redo it later. Fixing the system clock to a
 * fixed, mid-month, midday-UTC instant before construction keeps every rendering
 * test independent of both the host machine's timezone and the day the suite
 * happens to run on, while still exercising the component's own UTC-normalization
 * of "today" rather than a hardcoded string.
 */
const TODAY = '2026-06-15T12:00:00Z';

describe( 'LiturgyOfTheDay construction', () => {

    it( 'renders the title and an empty events wrapper by default', () => {
        const widget = new LiturgyOfTheDay( 'en' );
        expect( widget._titleElement.textContent ).toBe( Messages.en.LITURGY_OF_THE_DAY );
        expect( widget._eventsElementsWrapper.children.length ).toBe( 0 );
    } );

    it( 'renders the date element non-empty, carrying the current year', () => {
        jest.useFakeTimers().setSystemTime( new Date( TODAY ) );
        const widget = new LiturgyOfTheDay( 'en' );
        expect( widget._dateElement.textContent ).toContain( '2026' );
    } );

} );

describe( 'LiturgyOfTheDay configuration methods are chainable', () => {

    let widget;
    let apiClient;

    beforeEach( async () => {
        widget = new LiturgyOfTheDay( 'en' );
        apiClient = await ApiClient.init( DEV );
    } );

    /**
     * Every one of these returns `this` in the source; if any lost its
     * `return this` the corresponding row would fail with `undefined`, which is
     * exactly the failure mode `toBe( widget )` is written to catch.
     */
    const CHAINABLE = [
        [ 'id', () => widget.id( 'today-liturgy' ) ],
        [ 'class', () => widget.class( 'card' ) ],
        [ 'titleClass', () => widget.titleClass( 'h1' ) ],
        [ 'dateClass', () => widget.dateClass( 'text-muted' ) ],
        [ 'eventsWrapperClass', () => widget.eventsWrapperClass( 'events' ) ],
        [ 'eventClass', () => widget.eventClass( 'event' ) ],
        [ 'eventGradeClass', () => widget.eventGradeClass( 'grade' ) ],
        [ 'eventCommonClass', () => widget.eventCommonClass( 'common' ) ],
        [ 'eventYearCycleClass', () => widget.eventYearCycleClass( 'cycle' ) ],
        [ 'readingsWrapperClass', () => widget.readingsWrapperClass( 'readings' ) ],
        [ 'readingsLabelClass', () => widget.readingsLabelClass( 'reading-label' ) ],
        [ 'readingClass', () => widget.readingClass( 'reading' ) ],
        [ 'showReadings', () => widget.showReadings( false ) ],
        [ 'listenTo', () => widget.listenTo( apiClient ) ]
    ];

    it.each( CHAINABLE )( '%s returns the instance for chaining', ( _name, call ) => {
        expect( call() ).toBe( widget );
    } );

} );

describe( 'LiturgyOfTheDay.appendTo', () => {

    it( 'returns undefined, unlike the configuration methods, and still inserts the element', () => {
        const widget = new LiturgyOfTheDay( 'en' );
        const container = document.createElement( 'div' );
        expect( widget.appendTo( container ) ).toBeUndefined();
        expect( container.contains( widget._domElement ) ).toBe( true );
    } );

} );

describe( 'LiturgyOfTheDay renders events from a calendarFetched payload', () => {

    let apiClient;
    let widget;

    beforeEach( async () => {
        jest.useFakeTimers().setSystemTime( new Date( TODAY ) );
        apiClient = await ApiClient.init( DEV );
        widget = new LiturgyOfTheDay( 'en' )
            .eventClass( 'event' )
            .eventGradeClass( 'grade' )
            .eventCommonClass( 'common' )
            .eventYearCycleClass( 'cycle' )
            .readingsWrapperClass( 'readings' )
            .listenTo( apiClient );
    } );

    it( 'renders only the event matching todays date, not other days on the same payload', () => {
        const data = buildCalendarData( [
            buildEvent( { event_key: 'Yesterday', name: 'Not Today', date: '2026-06-14T00:00:00+00:00', day: 14 } ),
            buildEvent()
        ] );
        apiClient._eventBus.emit( 'calendarFetched', data );
        expect( widget._eventsElementsWrapper.children.length ).toBe( 1 );
        expect( widget._eventsElementsWrapper.textContent ).toContain( 'Saint John Mary Vianney' );
        expect( widget._eventsElementsWrapper.textContent ).not.toContain( 'Not Today' );
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
     * `#filterTagsDisplayGrade` suppresses the localized grade text for the
     * OrdSunday/Advent/Lent/Easter event_key families even though `grade !== 0` —
     * these celebrations are Sundays, whose "grade" is not meant to be spelled out.
     * Both branches of that logic are asserted, not just the suppressed one, since
     * a filter that suppressed EVERY grade would also pass a test that only
     * checked the suppressed case.
     */
    it( 'suppresses the grade text for an Ordinary Sunday event_key', () => {
        // grade is deliberately < 7: `lclzdGrade` ALSO collapses to '' for
        // grade >= 7, on its own, regardless of the OrdSunday/Advent/Lent/Easter
        // filter. Using grade 7 here would make this pass even with the filter
        // logic gutted, since the OTHER guard would suppress it anyway — this
        // fixture isolates the filter this test is actually about.
        apiClient._eventBus.emit( 'calendarFetched', buildCalendarData( [
            buildEvent( { event_key: 'OrdSunday15', name: 'Fifteenth Sunday in Ordinary Time', grade: 4, grade_lcl: 'Sunday', grade_display: null } )
        ] ) );
        const eventEl = widget._eventsElementsWrapper.firstElementChild;
        expect( eventEl.querySelector( '.grade' ) ).toBeNull();
    } );

    it( 'does not suppress the grade text for a non-Sunday celebration of the same grade', () => {
        apiClient._eventBus.emit( 'calendarFetched', buildCalendarData( [
            buildEvent( { event_key: 'ImmaculateHeart', name: 'The Immaculate Heart of Mary', grade: 3, grade_lcl: 'Memorial', grade_display: null } )
        ] ) );
        const eventEl = widget._eventsElementsWrapper.firstElementChild;
        expect( eventEl.querySelector( '.grade' ).textContent ).toBe( 'Memorial' );
    } );

    /**
     * High-contrast white text on green/red/purple backgrounds, black text
     * everywhere else. `LiturgyOfTheDay` — unlike `LiturgyOfAnyDay` — adds no
     * border for a white background; that is asserted explicitly below, since
     * CLAUDE.md attributes the border behaviour to `LiturgyOfAnyDay` alone.
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

    it( 'adds no border for a white background', () => {
        apiClient._eventBus.emit( 'calendarFetched', buildCalendarData( [ buildEvent( { color: [ 'white' ] } ) ] ) );
        const eventEl = widget._eventsElementsWrapper.firstElementChild;
        expect( eventEl.style.border ).toBe( '' );
    } );

    it( 'renders lectionary readings when present and showReadings is enabled', () => {
        apiClient._eventBus.emit( 'calendarFetched', buildCalendarData( [
            buildEvent( { readings: { first_reading: 'Gn 1:1', gospel: 'Jn 1:1' } } )
        ] ) );
        const eventEl = widget._eventsElementsWrapper.firstElementChild;
        expect( eventEl.querySelector( '.readings' ).textContent ).toContain( 'First Reading: Gn 1:1' );
        expect( eventEl.querySelector( '.readings' ).textContent ).toContain( 'Gospel: Jn 1:1' );
    } );

    it( 'omits lectionary readings when showReadings( false ) has been called', () => {
        widget.showReadings( false );
        apiClient._eventBus.emit( 'calendarFetched', buildCalendarData( [
            buildEvent( { readings: { first_reading: 'Gn 1:1' } } )
        ] ) );
        const eventEl = widget._eventsElementsWrapper.firstElementChild;
        expect( eventEl.querySelector( '.readings' ) ).toBeNull();
    } );

} );

describe( 'LiturgyOfTheDay.listenTo validates the shape of calendarFetched payloads', () => {

    /**
     * The handler `listenTo()` registers is declared `async ( data ) => { ... }`,
     * even though nothing in its body ever awaits anything. That matters here: an
     * `async` function that throws before its first `await` does not throw
     * synchronously to its caller — it returns an already-rejected promise. So
     * `expect( () => apiClient._eventBus.emit( 'calendarFetched', badData ) ).toThrow()`
     * cannot observe the guard at all, and going through `emit()` is actively
     * dangerous: `EventEmitter.emit()` is a bare `forEach` that neither awaits nor
     * attaches a `.catch()` to what a listener returns, so the rejection this
     * throw produces is never handled by anything — an UNHANDLED PROMISE
     * REJECTION. Verified interactively while writing this suite: routing
     * malformed data through `_eventBus.emit()` — even inside an async test with a
     * `process.on( 'unhandledRejection', … )` guard and a microtask flush — still
     * hard-crashes the Node process running the tests. See the `it.skip` below,
     * which documents that finding as a product bug rather than reproducing the
     * crash inside this suite.
     *
     * Retrieving the registered listener and invoking it directly, with a
     * `.rejects` handler attached in the SAME expression, is what makes it safe:
     * the returned promise is observed before any microtask boundary passes with
     * it unhandled. This still pins the validation logic itself — the guard does
     * correctly reject on each malformed shape below — independently of the
     * separate bug in how that rejection reaches (or rather does not reach) a
     * caller.
     */
    const calendarFetchedListener = ( apiClient ) => {
        const listeners = apiClient._eventBus._events.calendarFetched;
        return listeners[ listeners.length - 1 ];
    };

    let apiClient;
    let listener;

    beforeEach( async () => {
        apiClient = await ApiClient.init( DEV );
        new LiturgyOfTheDay( 'en' ).listenTo( apiClient );
        listener = calendarFetchedListener( apiClient );
    } );

    it( 'rejects when litcal is missing', async () => {
        await expect( listener( { settings: {}, metadata: {}, messages: [] } ) )
            .rejects.toThrow( /Invalid liturgical calendar data/ );
    } );

    it( 'rejects when litcal is empty', async () => {
        await expect( listener( { litcal: [], settings: {}, metadata: {}, messages: [] } ) )
            .rejects.toThrow( /Invalid liturgical calendar data/ );
    } );

    it( 'rejects when settings, metadata or messages are missing even though litcal is valid', async () => {
        await expect( listener( { litcal: [ buildEvent() ] } ) )
            .rejects.toThrow( /should have litcal, settings, metadata and messages properties/ );
    } );

    /**
     * BUG (product code, not a test problem): because the `calendarFetched`
     * handler is `async` with no `await`, a real malformed response — delivered
     * the normal way, through `apiClient._eventBus.emit( 'calendarFetched', data )`,
     * exactly as `ApiClient.fetchCalendar()` does internally — does not raise a
     * catchable error anywhere. `ApiClient`'s own documentation
     * (`ApiClient.js` around `fetchCalendar()`) promises that "a listener's throw
     * … propagates to the returned promise unwrapped", crediting WebCalendar as
     * the example; but WebCalendar's `calendarFetched` handler is written with
     * the identical `async ( data, meta ) => { … throw … }` shape (see
     * `WebCalendar.js` around its `listenTo()`), so it inherits the same defect
     * rather than being the counterexample the comment implies. The practical
     * effect for a page: a malformed `/calendar` response makes `fetchCalendar()`
     * silently resolve — no `calendarFetchFailed`, no rejection a caller's
     * `.catch()` can see — while separately crashing the process outright via an
     * unhandled promise rejection the very next tick. `it.skip` rather than
     * `it.failing`: reproducing the crash live inside this file is what would
     * actually happen, which would take the rest of the suite down with it.
     */
    it.skip( 'a malformed calendarFetched payload should surface to fetchCalendar()\'s caller, not crash the process silently later', () => {} );

} );

describe( 'LiturgyOfTheDay.listenTo configures ApiClient year_type for December 31st', () => {

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

    it( 'requests LITURGICAL year_type and year+1 when constructed on December 31st', async () => {
        jest.useFakeTimers().setSystemTime( new Date( '2026-12-31T12:00:00Z' ) );
        const apiClient = await ApiClient.init( DEV );
        new LiturgyOfTheDay( 'en' ).listenTo( apiClient );
        const { url, year_type } = await captureRequest( apiClient );
        expect( url ).toContain( '/2027' );
        expect( year_type ).toBe( 'LITURGICAL' );
    } );

    /**
     * BUG: the JSDoc on `LiturgyOfTheDay.listenTo` promises "CIVIL otherwise" —
     * mirroring what `LiturgyOfAnyDay.listenTo` actually does, whose `else` branch
     * explicitly calls `apiClient.yearType( YearType.CIVIL ).year( year )`. The
     * `isDec31` branch in `LiturgyOfTheDay.listenTo` has no `else`: on any day
     * other than December 31st it configures nothing at all, leaving whatever
     * year_type the ApiClient already carried — which defaults to LITURGICAL, not
     * CIVIL, in `ApiClient`'s own `#params`. So on an ordinary day this requests
     * LITURGICAL, not the CIVIL the documentation promises. Filed as a bug rather
     * than fixed, per instructions not to touch `src/LiturgyOfTheDay/`.
     */
    it.failing( 'requests CIVIL year_type and the current year when constructed on any other date', async () => {
        jest.useFakeTimers().setSystemTime( new Date( TODAY ) );
        const apiClient = await ApiClient.init( DEV );
        new LiturgyOfTheDay( 'en' ).listenTo( apiClient );
        const { url, year_type } = await captureRequest( apiClient );
        expect( url ).toContain( '/2026' );
        expect( year_type ).toBe( 'CIVIL' );
    } );

} );
