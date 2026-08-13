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
import Messages from '../Messages.js';

/** The schemes a subscription URL may be rendered under. */
const SCHEMES = Object.freeze(['https', 'webcal']);

/**
 * The default clipboard glyph: an inline SVG, so the component depends on no
 * icon font, no stylesheet and no network request. A consumer already using an
 * icon set replaces it with `copyIcon`.
 */
const DEFAULT_COPY_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">' +
    '<path d="M4 1.5A1.5 1.5 0 0 1 5.5 0h5A1.5 1.5 0 0 1 12 1.5V2h.5A1.5 1.5 0 0 1 14 3.5v11a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 14.5v-11A1.5 1.5 0 0 1 3.5 2H4v-.5Zm1 .5h6v-.5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0-.5.5V2Z"/>' +
    '</svg>';

/** How long the copied state stays applied, in milliseconds. */
const COPIED_DURATION = 2000;

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

    /** @type {HTMLElement} */
    #liveRegion;

    /** @type {function(boolean, Error=): void|null} */
    #onCopy;

    /** @type {string} */
    #copiedText;

    /** @type {string} */
    #copiedClass;

    /** @type {number|null} */
    #copiedTimer = null;

    /**
     * @param {Object} apiOptions - The ApiOptions owning the CurrentEndpoint.
     * @param {Object} calendarSelect - The calendar select to follow.
     * @param {Object} riteSelect - The rite select to follow.
     * @param {Object} [options] - Renderer options.
     * @param {'https'|'webcal'} [options.scheme='https'] - The URL scheme.
     * @param {string} [options.language='en'] - The display language for the
     *   built-in copy strings, passed in by `SubscriptionBuilder`.
     * @param {string|null} [options.copyIcon] - HTML for the copy button's icon.
     *   Omit for the built-in SVG; pass `null` for no icon at all.
     * @param {string} [options.copyTitle] - Overrides the localized button title.
     * @param {string} [options.copiedText] - Overrides the localized
     *   copied-confirmation announcement.
     * @param {function(boolean, Error=): void} [options.onCopy] - Called after
     *   each copy attempt with whether it succeeded, and the error when not.
     * @param {string} [options.copiedClass='is-copied'] - The class applied to
     *   the button for `COPIED_DURATION` ms after a successful copy.
     * @param {Object} [options.urlTheme] - Resolved by `SubscriptionBuilder` via
     *   `resolveChildTheme(bag.theme, 'subscriptionUrl')`. `class` sets the
     *   button's class, `codeClass` sets the `<code>` element's class, and
     *   `copiedClass` overrides `options.copiedClass`.
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

        // Assigned here, BEFORE the theme block below, so that block's
        // `copiedClass` override can replace the default rather than being
        // clobbered by an assignment that ran after it.
        this.#copiedClass = options.copiedClass ?? 'is-copied';

        const urlTheme = options.urlTheme ?? {};
        if (Object.hasOwn(urlTheme, 'class')) {
            this.#domElement.className = urlTheme.class;
        }
        if (Object.hasOwn(urlTheme, 'codeClass')) {
            this.#codeElement.className = urlTheme.codeClass;
        }
        if (Object.hasOwn(urlTheme, 'copiedClass')) {
            this.#copiedClass = urlTheme.copiedClass;
        }

        // The display language for the two built-in strings. Taken from the
        // `language` option `SubscriptionBuilder` passes in — NOT from the
        // locale input, which exposes no locale accessor: `_localeInput._locale`
        // is `undefined`, so reading it would silently pin every locale to
        // English with no error to notice.
        const language = options.language ?? 'en';
        this.#domElement.setAttribute(
            'title',
            options.copyTitle ??
                Messages[language]?.['COPY_TO_CLIPBOARD'] ??
                Messages['en']['COPY_TO_CLIPBOARD'],
        );
        this.#copiedText =
            options.copiedText ??
            Messages[language]?.['COPIED_TO_CLIPBOARD'] ??
            Messages['en']['COPIED_TO_CLIPBOARD'];
        this.#onCopy =
            typeof options.onCopy === 'function' ? options.onCopy : null;

        // `copyIcon` accepts consumer HTML, injected with the same
        // `createContextualFragment` path `Input.labelAfter()` uses. `null`
        // means no glyph; omitted means the built-in SVG.
        const icon = Object.hasOwn(options, 'copyIcon')
            ? options.copyIcon
            : DEFAULT_COPY_ICON;
        if (null !== icon && undefined !== icon) {
            this.#domElement.append(
                document.createRange().createContextualFragment(icon),
            );
        }

        this.#liveRegion = document.createElement('span');
        this.#liveRegion.setAttribute('aria-live', 'polite');
        // Announced but not shown: the visible confirmation is the copied class,
        // which the consumer themes.
        this.#liveRegion.style.position = 'absolute';
        this.#liveRegion.style.width = '1px';
        this.#liveRegion.style.height = '1px';
        this.#liveRegion.style.overflow = 'hidden';
        this.#liveRegion.style.clip = 'rect(0 0 0 0)';
        this.#domElement.append(this.#liveRegion);

        this.#domElement.addEventListener('click', () => this.#copy());

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

    /**
     * Writes the URL to the clipboard, reporting the outcome.
     *
     * Never rejects and never throws: a clipboard refusal is a runtime
     * condition, not a programming error, and the caller has no promise to
     * catch — the click handler dropped it.
     *
     * @returns {Promise<void>} Resolves once the outcome has been reported.
     */
    async #copy() {
        const text = this.url;
        let error = null;
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                SubscriptionUrl.#execCommandCopy(text);
            }
        } catch (caught) {
            error = caught;
        }
        // Reported OUTSIDE the try: a consumer callback that throws on the
        // success path used to be caught by this same block and reported a
        // second time as a failure — for a copy that had already succeeded.
        this.#reportCopy(null === error, error ?? undefined);
    }

    /**
     * The pre-Clipboard-API fallback, for browsers and for insecure origins
     * where `navigator.clipboard` is absent.
     *
     * @param {string} text - The text to copy.
     * @returns {void}
     * @throws {Error} If the copy command reports failure.
     */
    static #execCommandCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            if (false === document.execCommand('copy')) {
                throw new Error('SubscriptionUrl: the copy command failed.');
            }
        } finally {
            document.body.removeChild(textarea);
        }
    }

    /**
     * Applies the transient copied state and notifies `onCopy`.
     *
     * @param {boolean} ok - Whether the copy succeeded.
     * @param {Error} [error] - The failure, when it did not.
     * @returns {void}
     */
    #reportCopy(ok, error) {
        if (ok) {
            this.#domElement.classList.add(this.#copiedClass);
            this.#liveRegion.textContent = this.#copiedText;
            if (null !== this.#copiedTimer) {
                clearTimeout(this.#copiedTimer);
            }
            this.#copiedTimer = setTimeout(() => {
                this.#domElement.classList.remove(this.#copiedClass);
                this.#liveRegion.textContent = '';
                this.#copiedTimer = null;
            }, COPIED_DURATION);
        }
        // Guarded separately from the clipboard attempt above: a consumer's
        // `onCopy` throwing is the consumer's bug, not a clipboard failure, and
        // must not turn into a rejection of `#copy()`'s promise — nothing holds
        // that promise, since the click handler drops it.
        try {
            this.#onCopy?.(ok, error);
        } catch (consumerError) {
            console.error(
                'SubscriptionUrl: the onCopy callback threw.',
                consumerError,
            );
        }
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
        if (null !== this.#copiedTimer) {
            clearTimeout(this.#copiedTimer);
            this.#copiedTimer = null;
        }
        this.#subscriptions = [];
        this.#changeCallbacks = [];
        this.#pendingNotify = null;
    }
}
