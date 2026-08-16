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
import { resolveInputVisibility } from './InputVisibility.js';
import { isFilterKeyedControls, resolveControlSlots } from './ControlSlots.js';
import { assertTheme, narrowTheme } from './Theme.js';
import { assertScope } from './CalendarScope.js';
import { resolveBase } from '../ApiClient/ApiBase.js';
import WebCalendar from '../WebCalendar/WebCalendar.js';
import { normalizeSettled, deliverFetchFailure } from './Settled.js';
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

/**
 * The slot names `appendTo()` accepts.
 *
 * `controls` and `calendar` are both required — a viewer has two mandatory
 * mounts. `messages` is optional and is forwarded to `CalendarControls`, which
 * owns the renderer.
 *
 * @type {Readonly<string[]>}
 */
const SLOT_NAMES = Object.freeze(['controls', 'calendar', 'messages']);

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
     * The most recent fetch this component issued — `mountInto()`'s initial one,
     * or the caller's own `fetch()` — already resolved when none has been
     * issued. See the `settled` getter for the contract.
     *
     * @type {Promise<void>}
     * @private
     */
    #settled = Promise.resolve();

    /**
     * @param {(Object & {scope?: import('../typedefs.js').CalendarScopeOptions})|string|Intl.Locale} [options] - Options bag, or a locale,
     *   forwarded to `CalendarControls` as-is.
     * @param {string|Intl.Locale} [options.locale] - The display locale.
     * @param {string} [options.filter] - Which `ApiOptions` inputs to show.
     * @param {Object} [options.theme] - The theme bag; see `Theme.js`.
     * @param {Object} [options.inputs] - Which `ApiOptions` inputs to render;
     *   forwarded to `CalendarControls`, e.g. `{ acceptHeader: false }`.
     * @param {import('../typedefs.js').CalendarScopeOptions} [options.scope] - Restricts
     *   which calendars this viewer may show; forwarded to `CalendarControls`,
     *   see `CalendarScope.js`.
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
        // Validated here purely for ATTRIBUTION, and the result discarded:
        // `CalendarControls` validates and applies the same bag a line below,
        // but it would name ITSELF in the message — reporting a typo in an
        // option the caller passed to `CalendarViewer` under a class they never
        // touched. Same reasoning as `SubscriptionBuilder`'s own early locale
        // check. The function is pure, so running it twice costs nothing.
        resolveInputVisibility(bag.inputs, 'CalendarViewer');
        // The theme, for the same reason and by the same shape (#78). What is
        // FORWARDED is narrowed to the keys `CalendarControls` itself owns, so
        // this class stays free to gain a themed child of its own later without
        // the inner guard rejecting the key that child would read — see
        // `narrowTheme()`, and `SubscriptionBuilder`, where that case is real.
        assertTheme(bag.theme, 'CalendarViewer');
        // The scope, under THIS class' name and before forwarding (F8): left to
        // `CalendarControls`' own `assertScope()` call, a typo'd
        // `scope.natoin` would report as `"CalendarControls: scope.natoin …"`
        // — naming a class the caller never directly touched. Discarded here,
        // like `resolveInputVisibility()`/`assertTheme()` above: this call
        // exists only for attribution, and `CalendarControls` resolves the
        // same bag again for real use.
        assertScope(
            bag.scope,
            'CalendarViewer',
            resolveBase(bag.apiClient, 'CalendarViewer'),
        );
        this.#controls = new CalendarControls({
            ...bag,
            theme: narrowTheme(bag.theme, 'CalendarControls'),
        });
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
     * Resolves once the most recent fetch this viewer issued has settled —
     * `mountInto()`'s initial one, or the latest `fetch()` call.
     *
     * Always resolves with `undefined`, never rejects, and is already resolved
     * when nothing has been issued. `CalendarControls#settled` carries the full
     * contract and the reasoning; this is the same property on the viewer.
     *
     * Note that this factory, alone among the three, `await`s its initial fetch
     * before resolving — so by the time a caller of `mountInto()` can read this,
     * it has already settled. That is not a reason to drop it: a viewer built
     * with the constructor and mounted by hand still has one, tracking its own
     * `fetch()` calls, and code that awaits `settled` should not have to know
     * which construction path produced the instance.
     *
     * Throws once this viewer has been disposed; see [`dispose()`](#dispose).
     *
     * @returns {Promise<void>} Settles when the latest fetch has finished.
     * @throws {Error} If this viewer has been disposed.
     */
    get settled() {
        this.#assertUsable();
        // The rule, and the reason for it, live in `Settled.js` — one place
        // rather than three near-identical copies of the same nine-line
        // rationale.
        return normalizeSettled(this.#settled);
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
     * Mounts both halves: the controls into `slots.controls`, the calendar into
     * `slots.calendar`, and — when named — the messages table into
     * `slots.messages`, which `CalendarControls` renders.
     *
     * **Both required targets are resolved before either is mounted.** Resolving
     * `calendar` after mounting the controls meant an unusable `calendar`
     * selector threw with the controls already in the document — a partial mount
     * the caller never asked for and, from `mountInto()`, cannot easily undo,
     * since the rejected promise hands back no viewer to `dispose()`.
     *
     * Unlike `CalendarControls.appendTo()`, this does NOT accept a single bare
     * target. A viewer has two mandatory mounts, and a lone target would have to
     * choose one of them silently.
     *
     * Callable more than once; the children are moved rather than copied.
     *
     * @param {{controls: (string|HTMLElement|Object<string, (string|HTMLElement)>), calendar: (string|HTMLElement), messages?: (string|HTMLElement)}} slots - Where to mount each half.
     * @param {string} [caller='CalendarViewer.appendTo'] - Internal only: the
     *   `Class.method` prefix to report in a thrown message. `mountInto()`
     *   passes its own name so a bad target is reported under the entry point
     *   the caller actually used.
     * @returns {void}
     * @throws {Error} If this viewer has been disposed.
     * @throws {Error} If `slots` is not an object, names an unknown slot, omits
     *   `controls` or `calendar`, or names a target matching nothing.
     */
    appendTo(slots, caller = 'CalendarViewer.appendTo') {
        this.#assertUsable();
        CalendarViewer.#assertSlots(slots, caller);

        // Resolved BEFORE either half is mounted — see the doc comment above.
        const calendarElement = CalendarViewer.#requireElement(
            slots.calendar,
            'calendar',
            caller,
        );

        const controlsSlots = { controls: slots.controls };
        if (Object.hasOwn(slots, 'messages')) {
            controlsSlots.messages = slots.messages;
        }
        // The caller's own name is passed down so a bad `controls`/`messages`
        // target is reported as this class' method, not as
        // `CalendarControls.appendTo` — a class the caller never touched.
        this.#controls.appendTo(controlsSlots, caller);

        this.#calendarMount = calendarElement;
        this.#webCalendar.appendTo(calendarElement);
    }

    /**
     * Wires both halves to an `ApiClient`, controls first.
     *
     * **The order is the whole point of this method.** `EventEmitter.emit()` is
     * a synchronous `forEach` over listeners in registration order, and
     * `WebCalendar`'s own `calendarFetched` listener throws on malformed or
     * empty `litcal` (see `WebCalendar.js`) — a throw that aborts the iteration
     * for every listener registered after it. Registering the controls first
     * means their `calendarFetched` listeners, including the messages renderer
     * when a `messages` slot was named, always run before `WebCalendar`'s, so a
     * `WebCalendar` failure can never suppress a messages render that was
     * already due. A caller wiring `controls` and `webCalendar` by hand has to
     * know that and reproduce it; this method is what removes that trap, the
     * same way `CalendarControls.listenTo()` removes the rite's two-wire trap.
     *
     * @param {import('../ApiClient/ApiClient.js').default} apiClient - The client to drive.
     *   Written as an inline `import(...)` type rather than a top-level import: this
     *   file needs `ApiClient` only as a TYPE, and a real import would make it a
     *   runtime module dependency for nothing. `CalendarControls` and `DayViewer`
     *   import it properly because they also use it as a value.
     * @returns {CalendarViewer} This instance.
     * @throws {Error} If this viewer has been disposed, or if the controls are
     *   already wired to a client.
     */
    listenTo(apiClient) {
        this.#assertUsable();
        this.#controls.listenTo(apiClient);
        this.#webCalendar.listenTo(apiClient);
        return this;
    }

    /**
     * Fetches the calendar the select currently names, through the controls'
     * own three-way dispatch.
     *
     * The promise is returned to the caller and is never routed through
     * `ApiClient#_discardRequest` — the rule `CalendarControls.fetch()`'s own
     * doc comment states, which a delegate must not quietly change. A caller
     * holding this promise can `.catch()` or `await` it, so logging on top of
     * that would report a handled failure twice.
     *
     * @returns {Promise<Object>} The fetched calendar data.
     * @throws {Error} If this viewer has been disposed, or no client is wired.
     */
    fetch() {
        this.#assertUsable();
        const promise = this.#controls.fetch();
        // `settled` tracks the most recent fetch this viewer issued, so a
        // hand-constructed viewer publishes the same signal `mountInto()` does
        // (#61). Stored RAW and normalized in the getter — see
        // `CalendarControls.fetch()` for why attaching a handler here would
        // silence the caller's own unhandled-rejection report.
        this.#settled = promise;
        return promise;
    }

    /**
     * Registers a callback for successfully fetched calendar data.
     *
     * Callbacks registered before `listenTo()` are replayed by it, so the order
     * of the two calls does not matter.
     *
     * @param {function(Object): void} callback - Receives the calendar data.
     * @returns {CalendarViewer} This instance.
     * @throws {Error} If this viewer has been disposed.
     */
    onCalendarFetched(callback) {
        this.#assertUsable();
        this.#controls.onCalendarFetched(callback);
        return this;
    }

    /**
     * Registers a callback for calendar fetch failures.
     *
     * Subscribing is what stops `ApiClient` falling back to `console.error`: it
     * logs only when nothing is listening for `calendarFetchFailed`.
     *
     * @param {function(Error): void} callback - Receives the ApiClientError.
     * @returns {CalendarViewer} This instance.
     * @throws {Error} If this viewer has been disposed.
     */
    onError(callback) {
        this.#assertUsable();
        this.#controls.onError(callback);
        return this;
    }

    /**
     * Validates a `slots` argument: must be a plain object, name no key outside
     * {@link SLOT_NAMES}, and include both `controls` and `calendar`.
     *
     * Shared by `appendTo()` and `mountInto()` so the rules have a single source
     * of truth. `mountInto()` calls this BEFORE resolving any element or checking
     * for cancellation — a typo in `slots` must surface even on a mount the
     * caller already cancelled, per that method's own doc comment — and
     * `appendTo()` calls it again as its own first act, since it is a public
     * entry point in its own right and cannot assume its caller already
     * validated. Re-validating when `mountInto()` already did is harmless and
     * cheap.
     *
     * @param {unknown} slots - The candidate slots argument.
     * @param {string} caller - The `Class.method` prefix to report, so a bad
     *   `slots` names whichever entry point the caller actually used.
     * @returns {void}
     * @throws {Error} If `slots` is not an object, names an unknown slot, or
     *   omits `controls` or `calendar`.
     */
    static #assertSlots(slots, caller) {
        try {
            assertPlainOptions(slots, caller);
        } catch {
            throw new Error(
                `${caller}: slots must be an object naming { controls, calendar, messages } targets, but found type: ${describeType(slots)}`,
            );
        }

        const unknownKeys = Object.keys(slots).filter(
            (key) => false === SLOT_NAMES.includes(key),
        );
        if (unknownKeys.length > 0) {
            throw new Error(
                `${caller}: unknown slot name(s): ${unknownKeys.join(', ')}. Known slots are { controls, calendar, messages }.`,
            );
        }
        if (false === Object.hasOwn(slots, 'controls')) {
            throw new Error(`${caller}: slots must name a 'controls' target.`);
        }
        if (false === Object.hasOwn(slots, 'calendar')) {
            throw new Error(`${caller}: slots must name a 'calendar' target.`);
        }
    }

    /**
     * Resolves a mount target to an element.
     *
     * @param {string|HTMLElement} target - A CSS selector or an element.
     * @param {string} slot - The slot name, for the message.
     * @param {string} caller - The `Class.method` prefix to report, so a bad
     *   target names whichever entry point the caller actually used.
     * @returns {HTMLElement} The resolved element.
     * @throws {Error} If the target is neither, or matches nothing.
     */
    static #requireElement(target, slot, caller) {
        if (target instanceof HTMLElement) {
            return target;
        }
        if (typeof target !== 'string' || '' === target) {
            throw new Error(
                `${caller}: the ${slot} target must be a non-empty CSS selector or an HTMLElement.`,
            );
        }
        const element = document.querySelector(target);
        if (null === element) {
            throw new Error(
                `${caller}: Element not found for the ${slot} slot: ${target}`,
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
     * @param {{controls?: (string|HTMLElement|Object<string, (string|HTMLElement)>), calendar?: (string|HTMLElement)}} slots - The `mountInto()` slots argument.
     * @returns {HTMLElement|null} The first resolved element found, or `null`.
     */
    static #targetElement(slots) {
        // A filter-keyed `controls` slot has no single element; the first
        // container the caller named is the one the selects mount into, so it
        // is the right stand-in — the same choice `CalendarControls`' own
        // `#targetElement()` makes. Without this the disconnected check would
        // silently stop applying the moment a caller adopted that form.
        const controlsValue = isFilterKeyedControls(slots?.controls)
            ? Object.values(slots.controls)[0]
            : slots?.controls;
        const controlsCandidate =
            controlsValue instanceof HTMLElement ? controlsValue : null;
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
        // Ordered before the mount is emptied: `WebCalendar.dispose()` unsubscribes
        // its `calendarFetched` listener, without which emptying the mount was
        // undone by the very next fetch — measured, before this existed, as a
        // disposed viewer's calendar reappearing.
        this.#webCalendar.dispose();
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
     * ran. Registering the controls first means that throw — routed to the
     * controls' own error delivery below, exactly as `CalendarControls.mountInto()`
     * routes its own dropped initial fetch — can never suppress the messages
     * render; it can only ever affect listeners registered after `WebCalendar`'s
     * own, and none are.
     *
     * Modelled on `CalendarControls.mountInto()`: the viewer is constructed before
     * the cancellation check, so an invalid `webCalendar` key, theme or locale
     * rejects even on a mount the caller already cancelled. Slot validation runs
     * next — see `#assertSlots()` — BEFORE either cancellation check, so a typo
     * in `slots` still surfaces even on a mount the caller already cancelled.
     * Two cancellation checks follow, exactly as many as `#targetElement()`
     * alone can cover: the first, right after validation, catches an already-
     * disconnected `controls` or `calendar` element passed directly; the second,
     * after `calendar` is resolved, catches the case the first cannot —  a
     * CONNECTED `controls` paired with a DISCONNECTED `calendar`, since
     * `#targetElement()` returns whichever element it finds and prefers
     * `controls`. Only then does this factory call `appendTo()` to mount both
     * halves (re-validating and re-resolving `calendar` is harmless and cheap;
     * see `#assertSlots()`'s own doc comment), followed by this class' own
     * public `listenTo()`/`fetch()`/`onError()` to wire the client and perform
     * the initial fetch. That fetch's rejection is routed through the controls'
     * own deduplicated error delivery — NOT through `apiClient._discardRequest()`,
     * which this factory used to call and which cannot reach `onError()`; see the
     * comment at the call site for the full reasoning. `fetch()` itself never
     * routes through either path, because a caller holding that promise must be
     * able to handle it, so nothing is ever reported twice.
     *
     * @param {{controls: (string|HTMLElement|Object<string, (string|HTMLElement)>), calendar: (string|HTMLElement), messages?: (string|HTMLElement)}} slots - Where to mount each half.
     * @param {Object} [options] - As the constructor, plus those below.
     * @param {import('../typedefs.js').CalendarScopeOptions} [options.scope] - Restricts
     *   which calendars this viewer may show; forwarded to `CalendarControls`,
     *   see `CalendarScope.js`.
     * @param {Object} [options.apiClient] - The client to wire; when given, this
     *   instance is wired with `listenTo()` and, unless `initialFetch` is `false`,
     *   the initial fetch runs.
     * @param {boolean} [options.initialFetch=true] - Set `false` to wire the
     *   client without performing the initial fetch.
     * @param {AbortSignal} [options.signal] - Cancels the mount; see below.
     * @param {function(Error): void} [options.onError] - Registered before the
     *   initial fetch, so a failure of that very first request still reaches it.
     * @returns {Promise<CalendarViewer|null>} The viewer, or `null` if cancelled.
     * @throws {Error} If the options are invalid, if `slots` is not an object,
     *   names an unknown slot, or omits `controls` or `calendar`, or if the API
     *   metadata cannot be loaded.
     */
    static async mountInto(slots, options = {}) {
        const bag = normalizeComponentOptions(options, 'CalendarViewer');
        const { apiClient, signal, onError, initialFetch } = bag;

        const viewer = new CalendarViewer(bag);

        // A typo in `slots` must surface even on a mount the caller already
        // cancelled — validated BEFORE either cancellation check below.
        CalendarViewer.#assertSlots(slots, 'CalendarViewer.mountInto');

        // Validate a filter-keyed `controls` bag BEFORE the cancellation probe
        // below, not after. `#targetElement()` reads only the FIRST keyed value,
        // so a bag whose first container is a disconnected `HTMLElement` reached
        // the `return null` while an unknown, duplicate, overlapping or `none`
        // key inside it was still unexamined — `mountInto()` answered
        // "cancelled" to what is a programmer error, which is precisely the
        // inversion this library's reject-for-programmer-error rule exists to
        // prevent. Measured before fixing: all three of an unknown key, an
        // overlapping pair and `none` returned `null` instead of throwing
        // (CodeRabbit, PR #87).
        //
        // The result is discarded: this call is here for its throw. The real
        // resolution happens in `CalendarControls.appendTo()`, which re-runs it
        // against the same bag once the targets are known to be live.
        if (isFilterKeyedControls(slots?.controls)) {
            resolveControlSlots(slots.controls, 'CalendarViewer.mountInto');
        }

        const element = CalendarViewer.#targetElement(slots);
        if (
            true === signal?.aborted ||
            (null !== element && false === element.isConnected)
        ) {
            return null;
        }

        // BOTH required targets are resolved before EITHER is mounted, and this
        // SECOND cancellation check is what catches the case `#targetElement()`
        // cannot: a CONNECTED `controls` paired with a DISCONNECTED `calendar` —
        // `#targetElement()` returns whichever element it finds and prefers
        // `controls`, so the check above alone would miss it and mount the
        // `WebCalendar` into a detached node.
        const calendarElement = CalendarViewer.#requireElement(
            slots.calendar,
            'calendar',
            'CalendarViewer.mountInto',
        );
        if (true === signal?.aborted || false === calendarElement.isConnected) {
            return null;
        }

        // Passed explicitly so a bad target, an unknown slot name or a missing
        // required slot is reported as `CalendarViewer.mountInto` — the entry
        // point the caller actually used — rather than as `appendTo`.
        viewer.appendTo(slots, 'CalendarViewer.mountInto');

        if (apiClient !== undefined && apiClient !== null) {
            // Controls FIRST, so the messages renderer (if any) is registered
            // ahead of WebCalendar's listener on the same `calendarFetched`
            // event — see `listenTo()`'s own doc comment for why.
            viewer.listenTo(apiClient);
            if (typeof onError === 'function') {
                viewer.onError(onError);
            }
            if (false !== initialFetch) {
                // Routed through the controls' own error delivery, NOT through
                // `apiClient._discardRequest()` which this used to call. That seam
                // logs whatever the event bus never delivered — correct for a
                // dropped promise — but it cannot reach `onError()`, and a failure
                // raised BEFORE the request goes out never reaches the bus either,
                // so `onError()` silently missed that whole class of failure. This
                // is the same defect #43 closed in `CalendarControls.mountInto()`
                // and `DayViewer`; `CalendarViewer` was missed at the time and kept
                // the old seam, along with a comment claiming `CalendarControls`
                // still used it, which had stopped being true.
                //
                // `_deliverError()` tries the callbacks and reports whether any
                // received the error; only when nothing did does this fall back to
                // the console, so a failure is never silent and never double-reported.
                //
                // The `await` is retained deliberately and is not a second discard:
                // a viewer's reason to exist is its populated table, so this factory
                // must not resolve while the request — and, on an empty `litcal`,
                // the WebCalendar listener's throw and the messages render that must
                // precede it — are still pending.
                // Captured before being awaited, so `settled` reports the very
                // fetch this factory waits on rather than a second one
                // describing it. The getter normalizes what is stored here — see
                // `CalendarControls.mountInto()`.
                viewer.#settled = viewer
                    .fetch()
                    .catch((error) =>
                        deliverFetchFailure('CalendarViewer', error, (raised) =>
                            viewer.#controls._deliverError(raised),
                        ),
                    );
                await viewer.#settled;
            }
        }

        return viewer;
    }
}
