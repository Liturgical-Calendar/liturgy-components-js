/** @jest-environment jsdom */
/**
 * `LiturgyOfAnyDay` replaces its whole event list when the date or the calendar
 * changes, while focus stays on the control that changed. For a screen-reader
 * user that was silence — see issue #65 and `WebCalendarAnnouncements.test.js`,
 * which covers the same defect on the other renderer.
 *
 * These assertions are STRUCTURAL: jsdom has no accessibility tree and no
 * assistive technology, so what is proven here is the presence, attribution,
 * stability and update frequency of the markup, not that anything is spoken.
 */
import {
    describe,
    it,
    expect,
    beforeEach,
    afterEach,
    jest,
} from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import LiturgyOfAnyDay from '../LiturgyOfAnyDay/LiturgyOfAnyDay.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const DEV = 'http://localhost:8000';

/** A fixed, deterministically non-December-31st "today". */
const MID_JUNE = '2026-06-15T12:00:00Z';

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(DEV, FULL_METADATA);
    document.body.innerHTML = '';
    jest.useFakeTimers({ doNotFake: ['queueMicrotask'] }).setSystemTime(
        new Date(MID_JUNE),
    );
    global.fetch = jest.fn(() =>
        Promise.resolve({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: () => Promise.resolve(payloadFor(new Date('2026-06-15'))),
        }),
    );
});

afterEach(() => {
    jest.useRealTimers();
    delete global.fetch;
});

/**
 * A `/calendar` payload carrying one event on the given date.
 *
 * @param {Date} date - The UTC midnight the event falls on.
 * @returns {Object} The payload the `calendarFetched` handler expects.
 */
const payloadFor = (date) => ({
    litcal: [
        {
            event_key: 'Test',
            event_idx: 1,
            name: 'Test Celebration',
            color: ['white'],
            color_lcl: ['white'],
            grade: 3,
            grade_lcl: 'Memorial',
            grade_abbr: 'M',
            grade_display: null,
            common: [],
            common_lcl: '',
            type: 'fixed',
            date: date.toISOString(),
            year: date.getUTCFullYear(),
            month: date.getUTCMonth() + 1,
            day: date.getUTCDate(),
            liturgical_year: null,
            is_vigil_mass: false,
            psalter_week: 2,
            liturgical_season: 'ORDINARY_TIME',
            liturgical_season_lcl: 'Ordinary Time',
            holy_day_of_obligation: false,
        },
    ],
    settings: { year: date.getUTCFullYear(), locale: 'en', year_type: 'CIVIL' },
    metadata: { version: 'test' },
    messages: [],
});

/**
 * A mounted, listening widget.
 *
 * @param {Object} [options] - Forwarded to the constructor.
 * @returns {Promise<{widget: LiturgyOfAnyDay, apiClient: ApiClient}>} The pair.
 */
const mounted = async (options = {}) => {
    const apiClient = await ApiClient.init(DEV);
    const widget = new LiturgyOfAnyDay({ locale: 'en', ...options })
        .buildDateControls()
        .listenTo(apiClient);
    widget.appendTo(document.body);
    return { widget, apiClient };
};

/** The UTC midnight the widget's date controls currently name. */
const selectedDate = (widget) =>
    new Date(
        Date.UTC(
            Number(widget._yearInput._domElement.value),
            Number(widget._monthInput._domElement.value) - 1,
            Number(widget._dayInput._domElement.value),
        ),
    );

describe('LiturgyOfAnyDay live region', () => {
    it('mounts a polite, atomic status region inside its own element', async () => {
        const { widget } = await mounted();
        const region = widget._domElement.querySelector('[role="status"]');
        expect(region).not.toBeNull();
        expect(region.getAttribute('aria-live')).toBe('polite');
        expect(region.getAttribute('aria-atomic')).toBe('true');
        expect(region.textContent).toBe('');
    });

    it('says nothing on the first render', async () => {
        const { widget, apiClient } = await mounted();
        apiClient._eventBus.emit(
            'calendarFetched',
            payloadFor(selectedDate(widget)),
        );
        expect(widget._liveRegion.textContent).toBe('');
    });

    it('announces the new date when the day changes', async () => {
        const { widget, apiClient } = await mounted();
        apiClient._eventBus.emit(
            'calendarFetched',
            payloadFor(selectedDate(widget)),
        );

        const dayInput = widget._dayInput._domElement;
        dayInput.value = String(Number(dayInput.value) === 1 ? 2 : 1);
        dayInput.dispatchEvent(new Event('change'));

        expect(widget._liveRegion.textContent).toBe(
            `Liturgy for ${widget._dateElement.textContent} updated`,
        );
    });

    it('keeps the same region node across renders', async () => {
        const { widget, apiClient } = await mounted();
        const region = widget._liveRegion;
        apiClient._eventBus.emit(
            'calendarFetched',
            payloadFor(selectedDate(widget)),
        );
        apiClient._eventBus.emit(
            'calendarFetched',
            payloadFor(selectedDate(widget)),
        );
        expect(widget._domElement.querySelector('[role="status"]')).toBe(
            region,
        );
    });

    it('stays silent through the stale render a year change forces', async () => {
        // The year listener renders the CACHED payload immediately and only
        // THEN refetches, so one user action produces two renders. The first
        // describes the year the user has already left — the events on screen
        // at that instant are the previous year's — so announcing it would say
        // "updated" about content that is about to be replaced again.
        const { widget, apiClient } = await mounted();
        apiClient._eventBus.emit(
            'calendarFetched',
            payloadFor(selectedDate(widget)),
        );

        const yearInput = widget._yearInput._domElement;
        yearInput.value = String(Number(yearInput.value) + 1);
        yearInput.dispatchEvent(new Event('change'));

        // The immediate, stale render has happened by now.
        expect(widget._liveRegion.textContent).toBe('');

        apiClient._eventBus.emit(
            'calendarFetched',
            payloadFor(selectedDate(widget)),
        );
        expect(widget._liveRegion.textContent).toBe(
            `Liturgy for ${widget._dateElement.textContent} updated`,
        );
    });

    it('mounts no region when announcements are turned off', async () => {
        const { widget } = await mounted({ announceUpdates: false });
        expect(widget._domElement.querySelector('[role="status"]')).toBeNull();
        expect(widget._liveRegion).toBeNull();
    });

    it('removes a mounted region when turned off later, and is chainable', async () => {
        const { widget } = await mounted();
        expect(widget.announceUpdates(false)).toBe(widget);
        expect(widget._domElement.querySelector('[role="status"]')).toBeNull();
    });

    it('rejects a non-boolean', () => {
        expect(() => new LiturgyOfAnyDay('en').announceUpdates('yes')).toThrow(
            /LiturgyOfAnyDay/,
        );
    });
});
