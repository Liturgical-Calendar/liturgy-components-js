/**
 * The renderer half of `SubscriptionBuilder`: it turns the current rite,
 * calendar and locale selections into an iCal subscription URL, renders it, and
 * offers a copy control.
 *
 * Internal, and deliberately NOT exported from `src/index.js` — this component's
 * private renderer, the same relationship `CurrentEndpoint.js` has to
 * `PathBuilder.js`.
 *
 * It borrows `apiOptions._currentEndpoint` rather than constructing one, exactly
 * as `PathBuilder` does, so the URL model is shared between the two renderers
 * and cannot drift. What is NOT shared is the presentation: `PathBuilder`'s
 * button navigates to the API and its `return_type` is user-selectable, both of
 * which are wrong for a subscription.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import { CalendarType } from '../PathBuilder/CurrentEndpoint.js';

/** The schemes a subscription URL may be rendered under. */
const SCHEMES = Object.freeze(['https', 'webcal']);

export default class SubscriptionUrl {
    /** @type {Object} The ApiBase this renderer's URL is built against. */
    #base;

    /** @type {Object} Borrowed from ApiOptions; never constructed here. */
    #currentEndpoint;

    /** @type {HTMLElement} */
    #domElement;

    /** @type {HTMLElement} */
    #codeElement;

    /** @type {'https'|'webcal'} */
    #scheme;

    /** @type {Array<{element: HTMLElement, listener: function}>} */
    #subscriptions = [];

    /** @type {Array<function(string): void>} */
    #changeCallbacks = [];

    /** @type {Promise<void>|null} The coalesced notification this turn scheduled. */
    #pendingNotify = null;

    /**
     * @param {Object} apiOptions - The ApiOptions owning the CurrentEndpoint.
     * @param {Object} calendarSelect - The calendar select to follow.
     * @param {Object} riteSelect - The rite select to follow.
     * @param {Object} [options] - Renderer options.
     * @param {'https'|'webcal'} [options.scheme='https'] - The URL scheme.
     * @throws {Error} If `scheme` is neither 'https' nor 'webcal'.
     */
    constructor(apiOptions, calendarSelect, riteSelect, options = {}) {
        const scheme = options.scheme ?? 'https';
        if (false === SCHEMES.includes(scheme)) {
            throw new Error(
                `SubscriptionUrl: the scheme option must be 'https' or 'webcal', but found: ${String(scheme)}`,
            );
        }
        this.#scheme = scheme;
        this.#base = apiOptions._base;
        this.#currentEndpoint = apiOptions._currentEndpoint;

        // `return_type` is what makes this a subscription rather than a JSON
        // request, so it is pinned here and never wired to an input — unlike
        // `PathBuilder`, which lets the accept-header input drive it.
        this.#currentEndpoint.requestPayload.return_type = 'ICS';
        this.#currentEndpoint.requestPayload.year_type = 'CIVIL';
        // Without this, `CurrentEndpoint.path` omits the rite whenever it is
        // Roman, and the card this replaces emits `/roman` unconditionally.
        this.#currentEndpoint.explicitRite = true;

        this.#domElement = document.createElement('button');
        this.#domElement.setAttribute('type', 'button');
        this.#codeElement = document.createElement('code');
        this.#domElement.append(this.#codeElement);

        this.#render();

        // The calendar select's option carries `data-calendartype`; the empty
        // option carries none and means the rite-level calendar. Reading
        // `selectedOptions[0]` optionally matters: a select can legitimately
        // have nothing selected — `allowNull(false)` removes the empty option
        // and a rite change then resets the value to '' with no option to match
        // — and a throw inside a listener is swallowed by the DOM, which would
        // leave the endpoint updated and the rendering stale.
        this.#listen(calendarSelect._domElement, (ev) => {
            const selected = ev.target.selectedOptions[0];
            const type = selected?.getAttribute('data-calendartype') ?? null;
            if ('national' === type) {
                this.#currentEndpoint.calendarType = CalendarType.NATIONAL;
                this.#currentEndpoint.calendarId = ev.target.value;
            } else if ('diocesan' === type) {
                this.#currentEndpoint.calendarType = CalendarType.DIOCESAN;
                this.#currentEndpoint.calendarId = ev.target.value;
            } else {
                this.#currentEndpoint.calendarType = null;
                this.#currentEndpoint.calendarId = null;
            }
        });

        // `ApiOptions` already writes the rite onto the endpoint through
        // `linkToRiteSelect()`, so this listener only has to repaint. Attached
        // AFTER the link, so the endpoint is current by the time this runs.
        this.#listen(riteSelect._domElement, () => {});

        this.#listen(apiOptions._localeInput._domElement, (ev) => {
            this.#currentEndpoint.requestPayload.locale = ev.target.value;
        });
    }

    /** @returns {string} The serialized subscription URL. */
    get url() {
        const full = `${this.#base.url}${this.#currentEndpoint.serialize()}`;
        return 'webcal' === this.#scheme
            ? full.replace(/^https?:/, 'webcal:')
            : full;
    }

    /** @returns {HTMLElement} The rendered control, for tests and mounting. */
    get _domElement() {
        return this.#domElement;
    }

    /**
     * Repaints the rendered URL.
     *
     * @returns {void}
     */
    #render() {
        this.#codeElement.textContent = this.url;
    }

    /**
     * Mounts the control, replacing whatever the target held.
     *
     * @param {HTMLElement} target - The element to mount into.
     * @returns {void}
     */
    appendTo(target) {
        target.replaceChildren(this.#domElement);
    }

    /**
     * Attaches a `change` listener that updates the endpoint and repaints, and
     * records it so `dispose()` can remove it.
     *
     * @param {HTMLElement} element - The element to listen to.
     * @param {function(Event): void} update - Applies the change to the endpoint.
     * @returns {void}
     */
    #listen(element, update) {
        const listener = (ev) => {
            update(ev);
            // The repaint stays SYNCHRONOUS: both firings of a single user
            // action share one task, so the browser never paints between them
            // and the intermediate write is unobservable. Deferring it would
            // only make the DOM lag the state by a microtask, for no gain.
            this.#render();
            this.#scheduleNotify();
        };
        element.addEventListener('change', listener);
        this.#subscriptions.push({ element, listener });
    }

    /**
     * Collapses the `onChange` notifications one user action provokes into one,
     * on a microtask.
     *
     * One selection moves several inputs: `ApiOptions.linkToCalendarSelect()`'s
     * own listener is registered BEFORE this class's and synchronously dispatches
     * a synthetic `change` on the locale input, so without this a subscriber is
     * notified while `calendarType`/`calendarId` are still stale — an
     * intermediate URL carrying the calendar the user just left. Every dispatch
     * in that burst is synchronous, so a microtask flush reads settled state.
     *
     * The same shape as `ApiClient.#scheduleRefetch()`, added for the
     * structurally identical problem in issue #50. Only the NOTIFICATION is
     * coalesced, not the repaint: a callback hands a value to consumer code that
     * acts on it at once, whereas the DOM write is idempotent and invisible until
     * the task settles.
     *
     * @returns {void}
     */
    #scheduleNotify() {
        if (null !== this.#pendingNotify) {
            return;
        }
        this.#pendingNotify = Promise.resolve().then(() => {
            this.#pendingNotify = null;
            const next = this.url;
            this.#changeCallbacks.forEach((callback) => callback(next));
        });
    }

    /**
     * Registers a callback fired whenever the rendered URL changes.
     *
     * @param {function(string): void} callback - Receives the new URL.
     * @returns {SubscriptionUrl} This instance, for chaining.
     * @throws {Error} If `callback` is not a function.
     */
    onChange(callback) {
        if (typeof callback !== 'function') {
            throw new Error(
                `SubscriptionUrl.onChange: callback must be a function, but found type: ${typeof callback}`,
            );
        }
        this.#changeCallbacks.push(callback);
        return this;
    }

    /**
     * Removes every listener this renderer attached.
     *
     * Idempotent.
     *
     * @returns {void}
     */
    dispose() {
        for (const { element, listener } of this.#subscriptions) {
            element.removeEventListener('change', listener);
        }
        this.#subscriptions = [];
        this.#changeCallbacks = [];
        this.#pendingNotify = null;
    }
}
