/**
 * A `CalendarControls` paired with a `WebCalendar`, wired to one another and to an
 * `ApiClient` — a complete calendar page with no framework-specific rendering.
 *
 * `CalendarControls` already owns the rite select, calendar select and `ApiOptions`,
 * their wiring to each other and to a client, and the three-way fetch dispatch. This
 * class adds only the renderer and the one extra ordering rule that comes with it —
 * see `#applyWebCalendarBag()` and `listenTo()`'s doc comment below.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import CalendarControls from './CalendarControls.js';
import WebCalendar from '../WebCalendar/WebCalendar.js';
import {
    normalizeComponentOptions,
    assertPlainOptions,
    describeType,
} from '../OptionsValidation.js';

/**
 * The `WebCalendar` methods a `webCalendar` theme-style bag may name.
 *
 * Enumerated rather than reflected off the instance so that a typo is rejected
 * with the offending key named, instead of being silently ignored — the failure
 * mode a bag of unvalidated keys otherwise has.
 *
 * `rite` is deliberately ABSENT from this list, even though `WebCalendar` has a
 * `rite()` method. `WebCalendar.listenTo()` reassigns its rite from each fetch's
 * OWN metadata (`WebCalendar.js` around line 1761, `meta?.rite`), taking the rite
 * the REQUEST was made under rather than the client's current rite, precisely so
 * two in-flight requests landing out of order cannot caption one rite's data with
 * the other rite's name. A static `rite` supplied here would be overwritten by the
 * very first fetch, appearing to work right up until data actually arrived. Naming
 * it in this list would offer a setting this component cannot honour — the rite
 * comes from the rite select, through the client, not from a static bag value. Do
 * not "fix" this by adding it back.
 *
 * @type {Readonly<string[]>}
 */
const WEB_CALENDAR_KEYS = Object.freeze([
    'class',
    'id',
    'dateFormat',
    'removeCaption',
    'removeHeaderRow',
    'firstColumnGrouping',
    'columnOrder',
    'psalterWeekColumn',
    'eventColor',
    'seasonColor',
    'seasonColorColumns',
    'eventColorColumns',
    'monthHeader',
    'gradeDisplay',
    'latinInterface',
    'locale',
]);

export default class CalendarViewer {
    /** @type {CalendarControls} */
    #controls;

    /** @type {WebCalendar} */
    #webCalendar;

    /** @type {HTMLElement|null} */
    #calendarMount = null;

    /** @type {boolean} */
    #disposed = false;

    /**
     * @param {Object|string|Intl.Locale} [options] - Options bag, or a locale,
     *   forwarded to `CalendarControls` as-is.
     * @param {string|Intl.Locale} [options.locale] - The display locale.
     * @param {string} [options.filter] - Which `ApiOptions` inputs to show.
     * @param {Object} [options.theme] - The theme bag; see `Theme.js`.
     * @param {Object} [options.apiClient] - Binds to that client's API base.
     * @param {Object} [options.webCalendar] - `WebCalendar` methods to call, by
     *   name — see {@link WEB_CALENDAR_KEYS}. An unknown key throws, naming it.
     */
    constructor(options) {
        const bag = normalizeComponentOptions(options, 'CalendarViewer');
        // Validated, and the WebCalendar built, BEFORE `CalendarControls` is
        // constructed: a typo in `webCalendar` should reject before this class
        // does anything else, rather than after standing up three unused form
        // controls first.
        this.#webCalendar = new WebCalendar();
        CalendarViewer.#applyWebCalendarBag(this.#webCalendar, bag.webCalendar);
        this.#controls = new CalendarControls(bag);
    }

    /**
     * Applies a `webCalendar` bag to a `WebCalendar` instance, key by key.
     *
     * Two passes, deliberately: every key is checked against
     * {@link WEB_CALENDAR_KEYS} FIRST, before any setter runs, so a bag naming one
     * good key and one bad key never partially applies — it always rejects with
     * nothing changed. A key present with an explicit `undefined` value is treated
     * as absent, matching `resolveChildTheme()` in `Theme.js`: this codebase's
     * setters read `Object.hasOwn()` then a `typeof` check, so calling one with
     * `undefined` would reach that check and throw, rather than being silently
     * skipped the way an actually-absent key is.
     *
     * @param {WebCalendar} webCalendar - The instance to configure.
     * @param {unknown} bag - The candidate `webCalendar` option.
     * @returns {void}
     * @throws {Error} If `bag` is not a plain object, or names a key outside
     *   {@link WEB_CALENDAR_KEYS}.
     */
    static #applyWebCalendarBag(webCalendar, bag) {
        if (undefined === bag || null === bag) {
            return;
        }
        assertPlainOptions(bag, 'CalendarViewer: webCalendar');
        for (const key of Object.keys(bag)) {
            if (false === WEB_CALENDAR_KEYS.includes(key)) {
                throw new Error(
                    `CalendarViewer: unknown webCalendar option \`${key}\``,
                );
            }
        }
        for (const key of WEB_CALENDAR_KEYS) {
            if (Object.hasOwn(bag, key) && undefined !== bag[key]) {
                webCalendar[key](bag[key]);
            }
        }
    }

    /**
     * Guards every method a disposed viewer cannot honour.
     *
     * @returns {void}
     * @throws {Error} If this viewer has been disposed.
     */
    #assertUsable() {
        if (true === this.#disposed) {
            throw new Error(
                'CalendarViewer: this viewer has been disposed and can no longer be used.',
            );
        }
    }

    /** @returns {CalendarControls} The wired controls. */
    get controls() {
        this.#assertUsable();
        return this.#controls;
    }

    /** @returns {WebCalendar} The wired calendar renderer. */
    get webCalendar() {
        this.#assertUsable();
        return this.#webCalendar;
    }

    /**
     * Resolves a mount target to an element.
     *
     * @param {string|HTMLElement} target - A CSS selector or an element.
     * @param {string} slot - The slot name, for the message.
     * @returns {HTMLElement} The resolved element.
     * @throws {Error} If the target is neither, or matches nothing.
     */
    static #requireElement(target, slot) {
        if (target instanceof HTMLElement) {
            return target;
        }
        if (typeof target !== 'string' || '' === target) {
            throw new Error(
                `CalendarViewer.mountInto: the ${slot} target must be a non-empty CSS selector or an HTMLElement.`,
            );
        }
        const element = document.querySelector(target);
        if (null === element) {
            throw new Error(
                `CalendarViewer.mountInto: Element not found for the ${slot} slot: ${target}`,
            );
        }
        return element;
    }

    /**
     * Resolves the slots argument to an already-attached element, for the
     * cancellation check in `mountInto()` only — same narrow purpose as
     * `CalendarControls.#targetElement()`: it recognises an `HTMLElement` given
     * directly for `controls` or `calendar`, and returns `null` for a selector
     * string, which is resolved fresh (and reported as "not found" rather than
     * "cancelled" if it no longer matches anything) by `#requireElement()` and
     * `CalendarControls.appendTo()` themselves.
     *
     * @param {{controls?: (string|HTMLElement), calendar?: (string|HTMLElement)}} slots - The `mountInto()` slots argument.
     * @returns {HTMLElement|null} The first resolved element found, or `null`.
     */
    static #targetElement(slots) {
        const controlsCandidate =
            slots?.controls instanceof HTMLElement ? slots.controls : null;
        const calendarCandidate =
            slots?.calendar instanceof HTMLElement ? slots.calendar : null;
        return controlsCandidate ?? calendarCandidate;
    }

    /**
     * Releases the controls' listeners and subscriptions, and empties both mounts.
     *
     * Delegates entirely to `CalendarControls.dispose()` for its own half — see
     * that method's own doc comment for exactly what is and is not released there.
     * This adds only the calendar mount: `WebCalendar` has no `dispose()` of its
     * own and no way to unsubscribe the anonymous `calendarFetched` listener
     * `listenTo()` attaches, so — exactly as `CalendarControls.dispose()` and
     * `DayViewer.dispose()` document for their own similarly-anonymous
     * subscriptions — that listener keeps running against a detached client
     * event bus entry if the same `ApiClient` is still driven from elsewhere.
     * Only the mounted DOM can be reclaimed from here, and it is.
     *
     * Idempotent; further use throws.
     *
     * @returns {void}
     */
    dispose() {
        if (true === this.#disposed) {
            return;
        }
        this.#controls.dispose();
        this.#calendarMount?.replaceChildren();
        this.#calendarMount = null;
        this.#disposed = true;
    }

    /**
     * Builds a viewer, mounts both halves, wires them to `options.apiClient` when
     * given, and performs the initial fetch.
     *
     * Registration order is deliberate and is what keeps `messages` rendering safe
     * to combine with an empty `litcal` (see the fixtures in
     * `CalendarViewer.test.js`, which all use one): `this.#controls.listenTo()` is
     * called BEFORE `this.#webCalendar.listenTo()`, so the controls' own
     * `calendarFetched` listeners — including the messages renderer, when a
     * `messages` slot was named — are registered, and therefore run, first.
     * `EventEmitter.emit()` is a synchronous `forEach`; `WebCalendar`'s listener
     * throws on a malformed or empty `litcal` (see `WebCalendar.js`), which would
     * otherwise abort the iteration before a listener registered AFTER it ever
     * ran. Registering the controls first means that throw — routed to
     * `apiClient._discardRequest()` below, exactly as `CalendarControls.mountInto()`
     * routes its own dropped initial fetch — can never suppress the messages
     * render; it can only ever affect listeners registered after `WebCalendar`'s
     * own, and none are.
     *
     * Modelled on `CalendarControls.mountInto()`: the viewer is constructed before
     * the cancellation check, so an invalid `webCalendar` key, theme or locale
     * rejects even on a mount the caller already cancelled. This factory calls
     * `this.#controls`'s own `appendTo()`/`listenTo()`/`fetch()` directly — the
     * exact same instance `CalendarControls.mountInto()` would have built and
     * driven internally — rather than delegating to that factory itself, so that
     * `controls` never resolves to a second, separately-constructed instance from
     * the one this viewer already holds. `apiClient._discardRequest()` is called
     * exactly once, on `this.#controls.fetch()`'s own promise: `fetch()` itself
     * never routes through it (a caller holding the promise must be able to handle
     * it), so a second discard or catch layered on top here would be exactly the
     * duplicate `CalendarControls.fetch()`'s own doc comment warns against.
     *
     * @param {{controls: (string|HTMLElement), calendar: (string|HTMLElement), messages?: (string|HTMLElement)}} slots - Where to mount each half.
     * @param {Object} [options] - As the constructor, plus those below.
     * @param {Object} [options.apiClient] - The client to wire; when given, this
     *   instance is wired with `listenTo()` and, unless `initialFetch` is `false`,
     *   the initial fetch runs.
     * @param {boolean} [options.initialFetch=true] - Set `false` to wire the
     *   client without performing the initial fetch.
     * @param {AbortSignal} [options.signal] - Cancels the mount; see below.
     * @param {function(Error): void} [options.onError] - Registered before the
     *   initial fetch, so a failure of that very first request still reaches it.
     * @returns {Promise<CalendarViewer|null>} The viewer, or `null` if cancelled.
     * @throws {Error} If the options or `slots` are invalid, or if the API
     *   metadata cannot be loaded.
     */
    static async mountInto(slots, options = {}) {
        const bag = normalizeComponentOptions(options, 'CalendarViewer');
        const { apiClient, signal, onError, initialFetch } = bag;

        const viewer = new CalendarViewer(bag);

        try {
            assertPlainOptions(slots, 'CalendarViewer.mountInto');
        } catch {
            throw new Error(
                `CalendarViewer.mountInto: slots must be an object naming { controls, calendar, messages } targets, but found type: ${describeType(slots)}`,
            );
        }
        if (false === Object.hasOwn(slots, 'controls')) {
            throw new Error(
                "CalendarViewer.mountInto: slots must name a 'controls' target.",
            );
        }
        if (false === Object.hasOwn(slots, 'calendar')) {
            throw new Error(
                "CalendarViewer.mountInto: slots must name a 'calendar' target.",
            );
        }

        const element = CalendarViewer.#targetElement(slots);
        if (
            true === signal?.aborted ||
            (null !== element && false === element.isConnected)
        ) {
            return null;
        }

        const controlsSlots = { controls: slots.controls };
        if (Object.hasOwn(slots, 'messages')) {
            controlsSlots.messages = slots.messages;
        }
        // Passed explicitly so a bad `controls`/`messages` target is reported
        // as `CalendarViewer.mountInto`, not `CalendarControls.appendTo` — a
        // class the caller of THIS factory never directly touched.
        viewer.#controls.appendTo(controlsSlots, 'CalendarViewer.mountInto');

        const calendarElement = CalendarViewer.#requireElement(
            slots.calendar,
            'calendar',
        );
        viewer.#calendarMount = calendarElement;
        viewer.#webCalendar.appendTo(calendarElement);

        if (apiClient !== undefined && apiClient !== null) {
            // See this method's own doc comment above: controls FIRST, so the
            // messages renderer (if any) is registered ahead of WebCalendar's
            // listener on the same `calendarFetched` event.
            viewer.#controls.listenTo(apiClient);
            viewer.#webCalendar.listenTo(apiClient);
            if (typeof onError === 'function') {
                viewer.#controls.onError(onError);
            }
            if (false !== initialFetch) {
                // `_discardRequest` is what CalendarControls.mountInto() itself
                // uses for this exact promise, and it is called exactly once here
                // — see the doc comment above for why a second discard would be
                // wrong. The `.catch(() => {})` below is NOT a second discard: it
                // is a second, independent subscriber on the SAME promise, added
                // only so this factory can `await` the request's settlement —
                // success or failure — before resolving, rather than resolving
                // while the request (and, on the fixtures every test here uses, the
                // WebCalendar listener's throw on an empty `litcal`, and the
                // messages render that must complete before it) is still pending.
                // It changes nothing about whether `_discardRequest` logs: that
                // decision is already made, independently, by its own `.catch`.
                const fetchPromise = viewer.#controls.fetch();
                apiClient._discardRequest(fetchPromise);
                await fetchPromise.catch(() => {});
            }
        }

        return viewer;
    }
}
