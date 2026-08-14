/** @jest-environment jsdom */
/**
 * `WebCalendar` replaces its whole table on every `calendarFetched`, and the
 * change is driven from a `<select>` that keeps focus. For a screen-reader user
 * that was silence: nothing said the several hundred rows underneath had been
 * replaced, and nothing distinguished a successful update from a request that
 * did nothing. See issue #65.
 *
 * These assertions are STRUCTURAL. jsdom has no accessibility tree and no
 * assistive technology, so nothing here proves a screen reader speaks; what it
 * proves is that the markup a screen reader needs is present, correctly
 * attributed, stable across a re-render, and written exactly once per update.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiClient from '../ApiClient/ApiClient.js';
import ApiBase from '../ApiClient/ApiBase.js';
import WebCalendar from '../WebCalendar/WebCalendar.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

/** One event, shaped like a real `/calendar` response entry. */
const event = (index) => ({
    event_key: `Advent${index}`,
    event_idx: index,
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
    date: `2026-11-${15 + index}T00:00:00+00:00`,
    year: 2026,
    month: 11,
    month_short: 'Nov.',
    month_long: 'November',
    day: 15 + index,
    day_of_the_week_iso8601: 7,
    day_of_the_week_short: 'Sun',
    day_of_the_week_long: 'Sunday',
    liturgical_year: 'A',
    is_vigil_mass: false,
    psalter_week: 1,
    liturgical_season: 'ADVENT',
    liturgical_season_lcl: 'Advent',
    holy_day_of_obligation: false,
});

const calendarData = (settings = {}, count = 1) => ({
    litcal: Array.from({ length: count }, (unused, index) => event(index)),
    settings: {
        year: 2026,
        locale: 'en',
        year_type: 'LITURGICAL',
        ...settings,
    },
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
 * Pushes one payload through the same path a real fetch takes.
 *
 * `buildTable()` is async and the handler does not await it, so yield to the
 * microtask queue before reading the DOM.
 *
 * @param {Object} data - The payload to emit.
 * @returns {Promise<void>} Resolves once the render has settled.
 */
const render = async (data) => {
    apiClient._eventBus.emit('calendarFetched', data);
    await new Promise((resolve) => setTimeout(resolve, 0));
};

/**
 * A mounted, listening calendar and its container.
 *
 * @param {Object} [options] - Forwarded to the WebCalendar constructor.
 * @returns {{webCalendar: WebCalendar, container: HTMLElement}} The pair.
 */
const mounted = (options = {}) => {
    const webCalendar = new WebCalendar(options);
    const container = document.createElement('div');
    document.body.appendChild(container);
    webCalendar.appendTo(container);
    webCalendar.listenTo(apiClient);
    return { webCalendar, container };
};

describe('WebCalendar live region', () => {
    it('mounts a polite, atomic status region as the last child', async () => {
        const { container } = mounted();
        await render(calendarData());
        const region = container.querySelector('[role="status"]');
        expect(region).not.toBeNull();
        expect(region.getAttribute('aria-live')).toBe('polite');
        expect(region.getAttribute('aria-atomic')).toBe('true');
        expect(container.lastElementChild).toBe(region);
        expect(container.firstElementChild.tagName).toBe('TABLE');
    });

    it('says nothing on the first render', async () => {
        // A live region that fires during page load talks over whatever else is
        // being announced, and the user did not act.
        const { container } = mounted();
        await render(calendarData());
        expect(container.querySelector('[role="status"]').textContent).toBe('');
    });

    it('announces the calendar and its entry count on a later render', async () => {
        const { container } = mounted();
        await render(calendarData());
        await render(calendarData({}, 3));
        expect(container.querySelector('[role="status"]').textContent).toBe(
            'General Roman Calendar - 2026, 3 entries',
        );
    });

    it('uses the singular form for a single entry', async () => {
        const { container } = mounted();
        await render(calendarData());
        await render(calendarData({ year: 2027 }));
        expect(container.querySelector('[role="status"]').textContent).toBe(
            'General Roman Calendar - 2027, 1 entry',
        );
    });

    it('announces in the payload locale', async () => {
        const { container } = mounted();
        await render(calendarData());
        await render(calendarData({ locale: 'it' }, 2));
        expect(container.querySelector('[role="status"]').textContent).toBe(
            'Calendario romano generale - 2026, 2 voci',
        );
    });

    it('announces even when the caption element is removed', async () => {
        // The announcement is not the caption; it only reuses its text.
        const { container } = mounted({ removeCaption: true });
        await render(calendarData());
        await render(calendarData({}, 2));
        expect(container.querySelector('caption')).toBeNull();
        expect(container.querySelector('[role="status"]').textContent).toBe(
            'General Roman Calendar - 2026, 2 entries',
        );
    });

    it('keeps the very same region node across the table swap', async () => {
        // Removing and re-inserting a live region is what stops it being
        // announced, so this is the property the swap exists to hold.
        const { container } = mounted();
        await render(calendarData());
        const first = container.querySelector('[role="status"]');
        await render(calendarData({}, 2));
        expect(container.querySelector('[role="status"]')).toBe(first);
    });

    it('still clears whatever the consumer left in the container', async () => {
        const { container } = mounted();
        container.appendChild(document.createElement('p'));
        await render(calendarData());
        expect(container.querySelector('p')).toBeNull();
    });

    it('mounts no region when announcements are turned off', async () => {
        const { container } = mounted({ announceUpdates: false });
        await render(calendarData());
        await render(calendarData({}, 2));
        expect(container.querySelector('[role="status"]')).toBeNull();
        expect(container.children).toHaveLength(1);
    });

    it('removes a mounted region when turned off later, and is chainable', async () => {
        const { webCalendar, container } = mounted();
        await render(calendarData());
        expect(webCalendar.announceUpdates(false)).toBe(webCalendar);
        expect(container.querySelector('[role="status"]')).toBeNull();
    });

    it('is silent on the first render after announcements are turned back on', async () => {
        // Re-enabling builds a NEW region, which the next render inserts. The
        // "silent on the render that inserts the region" rule applies to it
        // exactly as it applies to a fresh instance.
        const { webCalendar, container } = mounted();
        await render(calendarData());
        await render(calendarData({}, 2));
        webCalendar.announceUpdates(false);
        webCalendar.announceUpdates(true);

        await render(calendarData({}, 3));
        expect(container.querySelector('[role="status"]').textContent).toBe('');

        await render(calendarData({}, 4));
        expect(container.querySelector('[role="status"]').textContent).toBe(
            'General Roman Calendar - 2026, 4 entries',
        );
    });

    it('rejects a non-boolean', () => {
        expect(() => new WebCalendar().announceUpdates('yes')).toThrow(
            /WebCalendar/,
        );
    });

    it('is silent again on the first render after being remounted', async () => {
        // `dispose()` detaches the region and forgets the mount, so the next
        // render re-inserts it — and a live region written in the same task it
        // is inserted in is not reliably announced. A remounted calendar has to
        // behave like a fresh one.
        const { webCalendar, container } = mounted();
        await render(calendarData());
        await render(calendarData({}, 2));
        webCalendar.dispose();

        const second = document.createElement('div');
        document.body.appendChild(second);
        webCalendar.appendTo(second);
        webCalendar.listenTo(apiClient);
        await render(calendarData({}, 3));

        expect(second.querySelector('[role="status"]').textContent).toBe('');
        expect(container.querySelector('[role="status"]')).toBeNull();
    });

    it('removes the region on dispose', async () => {
        const { webCalendar, container } = mounted();
        await render(calendarData());
        webCalendar.dispose();
        expect(container.querySelector('[role="status"]')).toBeNull();
    });
});
