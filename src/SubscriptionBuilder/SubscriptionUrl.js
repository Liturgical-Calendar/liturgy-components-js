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
import LiveAnnouncer from '../LiveAnnouncer.js';
import { message } from '../MessageLookup.js';

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

    /**
     * Releases this class's `ApiOptions.onSettled()` registration.
     *
     * @type {?function(): void}
     */
    #unsubscribeSettled = null;

    /** @type {string|null} The URL most recently handed to the callbacks. */
    #lastNotified = null;

    /** @type {LiveAnnouncer} The hidden region the copy outcome is announced through. */
    #announcer;

    /** @type {function(boolean, Error=): void|null} */
    #onCopy;

    /** @type {string} */
    #copiedText;

    /** @type {string} */
    #copiedClass;

    /** @type {number|null} */
    #copiedTimer = null;

    /** @type {function(): void} The click listener, stored so dispose() can remove it. */
    #clickListener;

    /**
     * @param {Object} apiOptions - The ApiOptions owning the CurrentEndpoint.
     * @param {Object} calendarSelect - The calendar select to follow.
     * @param {Object} riteSelect - The rite select to follow.
     * @param {Object} [options] - Renderer options.
     * @param {'https'|'webcal'} [options.scheme='https'] - The URL scheme.
     * @param {string} [options.language='en'] - The display language for the
     *   built-in copy strings, passed in by `SubscriptionBuilder`.
     * @param {string|null} [options.copyIcon] - HTML for the copy button's icon.
     *   Omit, or pass `undefined` explicitly, for the built-in SVG; pass
     *   `null` for no icon at all.
     * @param {string} [options.copyTitle] - Overrides the localized button title.
     * @param {string} [options.copiedText] - Overrides the localized
     *   copied-confirmation announcement.
     * @param {function(boolean, Error=): void} [options.onCopy] - Called after
     *   each copy attempt with whether it succeeded, and the error when not.
     * @param {string} [options.copiedClass='is-copied'] - The class applied to
     *   the button for `COPIED_DURATION` ms after a successful copy.
     * @param {Object} [options.urlTheme] - Resolved by `SubscriptionBuilder` via
     *   `resolveChildTheme(bag.theme, 'subscriptionUrl')`. Only `class` is
     *   read, setting the button's class — `Theme.js`'s per-child key lists
     *   (`ALL_OVERRIDE_KEYS` and `OVERRIDE_KEYS_BY_ROLE.select`) do not carry
     *   a `codeClass` or `copiedClass` key, so neither would ever reach here;
     *   style the inner `<code>` element with a descendant selector on the
     *   button's class instead, and use the top-level `copiedClass` option
     *   below for the copied state, which is unaffected by this restriction.
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

        // Only `class` is read here — see the constructor's own doc comment
        // for why `codeClass` and a per-child `copiedClass` are deliberately
        // absent rather than merely unimplemented: `Theme.js` rejects both
        // key names before this constructor is ever reached, so branches
        // reading them from `urlTheme` would be dead code.
        const urlTheme = options.urlTheme ?? {};
        if (Object.hasOwn(urlTheme, 'class')) {
            this.#domElement.className = urlTheme.class;
        }

        // The display language for the two built-in strings. Taken from the
        // `language` option `SubscriptionBuilder` passes in — NOT from the
        // locale input, which exposes no locale accessor: `_localeInput._locale`
        // is `undefined`, so reading it would silently pin every locale to
        // English with no error to notice.
        const language = options.language ?? 'en';
        this.#domElement.setAttribute(
            'title',
            options.copyTitle ?? message('COPY_TO_CLIPBOARD', language),
        );
        this.#copiedText =
            options.copiedText ?? message('COPIED_TO_CLIPBOARD', language);
        this.#copiedClass = options.copiedClass ?? 'is-copied';
        this.#onCopy =
            typeof options.onCopy === 'function' ? options.onCopy : null;

        // `copyIcon` accepts consumer HTML, injected with the same
        // `createContextualFragment` path `Input.labelAfter()` uses. `null`
        // means no glyph; omitted OR explicitly `undefined` means the
        // built-in SVG — the library-wide contract is that `undefined` means
        // "not supplied", and an options bag built by spreading (as
        // `SubscriptionBuilder` does) can carry an explicit `undefined` key,
        // which `Object.hasOwn` alone would have mistaken for `null`.
        const icon =
            undefined === options.copyIcon
                ? DEFAULT_COPY_ICON
                : options.copyIcon;
        if (null !== icon && undefined !== icon) {
            this.#domElement.append(
                document.createRange().createContextualFragment(icon),
            );
        }

        // Announced but not shown: the visible confirmation is the copied class,
        // which the consumer themes. `LiveAnnouncer` owns the markup and the
        // hiding technique this component introduced in 2.7.0, now shared with
        // `WebCalendar` and `LiturgyOfAnyDay` — and corrected there, since the
        // `clip` written here was in a syntax a strict CSS parser discards.
        this.#announcer = new LiveAnnouncer();
        // A SIBLING of the button, not a child: a button's accessible name is
        // computed from its whole subtree, so a live region nested inside it
        // would make the control announce as "<url> URL copied to clipboard"
        // for the ~2 seconds after every copy. `appendTo()` mounts both.

        this.#clickListener = () => this.#copy();
        this.#domElement.addEventListener('click', this.#clickListener);

        // Seeded from the locale input's CURRENT value, not merely from its
        // future `change` events: without this, a consumer who mounts and
        // copies immediately — the primary path for this component — gets a
        // URL with no `?locale=` at all, subscribing in the API's default
        // language while the select already displays something else. Guarded
        // against an empty value so an unset input does not write `locale=`
        // onto the query string.
        const initialLocale = apiOptions._localeInput._domElement.value;
        if ('' !== initialLocale) {
            this.#currentEndpoint.requestPayload.locale = initialLocale;
        }

        // Seeded from the calendar select's CURRENT value, not merely from its
        // future `change` events — the same reasoning as the locale seeding
        // immediately above, and the gap that let a SCOPED `SubscriptionBuilder`
        // (`CalendarControls` sets the calendar select's value to the scope's
        // own pin at construction, via `.value()`, which dispatches no `change`)
        // render an initial URL for the General Roman Calendar instead of the
        // scope's own diocese or nation. `ApiClient`-driven components
        // (`CalendarControls.fetch()` among them) never had this gap: they read
        // the calendar select's value directly at fetch time rather than
        // waiting on a prior `change`; this renderer had no equivalent step
        // until now.
        this.#applyCalendarSelection(calendarSelect._domElement);

        this.#render();
        // Seeded here, not left `null`: without this, the very first no-op
        // `change` after mounting would compare the unchanged URL against
        // `null`, find them different, and notify — the exact bug this field
        // exists to close.
        this.#lastNotified = this.url;

        this.#unsubscribeSettled = apiOptions.onSettled(() =>
            this.#notifyIfChanged(),
        );

        // See `#applyCalendarSelection()`'s own doc comment for what this reads
        // off the select and why. A throw inside a listener is swallowed by
        // the DOM, which would leave the endpoint updated and the rendering
        // stale — `#applyCalendarSelection()` reads `selectedOptions[0]`
        // optionally for exactly that reason: a select can legitimately have
        // nothing selected.
        this.#listen(calendarSelect._domElement, (ev) => {
            this.#applyCalendarSelection(ev.target);
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
            this.#announcer.announce(this.#copiedText);
            if (null !== this.#copiedTimer) {
                clearTimeout(this.#copiedTimer);
            }
            this.#copiedTimer = setTimeout(() => {
                this.#domElement.classList.remove(this.#copiedClass);
                this.#announcer.clear();
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
     * Applies a calendar select's CURRENT state to the endpoint — shared by
     * the constructor's initial seeding call and the `change` listener below,
     * so the two can never drift apart.
     *
     * The select's option carries `data-calendartype`; the empty option
     * carries none and means the rite-level calendar. Reading
     * `selectedOptions[0]` optionally matters: a select can legitimately have
     * nothing selected — `allowNull(false)` removes the empty option and a
     * rite change then resets the value to '' with no option to match.
     *
     * @param {HTMLSelectElement} domElement - The calendar select's element.
     * @returns {void}
     */
    #applyCalendarSelection(domElement) {
        const selected = domElement.selectedOptions[0];
        const type = selected?.getAttribute('data-calendartype') ?? null;
        if ('national' === type) {
            this.#currentEndpoint.calendarType = CalendarType.NATIONAL;
            this.#currentEndpoint.calendarId = domElement.value;
        } else if ('diocesan' === type) {
            this.#currentEndpoint.calendarType = CalendarType.DIOCESAN;
            this.#currentEndpoint.calendarId = domElement.value;
        } else {
            this.#currentEndpoint.calendarType = null;
            this.#currentEndpoint.calendarId = null;
        }
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
     * The live region is mounted as a SIBLING of the button, not a child of
     * it — see the constructor's comment by `#announcer`'s construction for
     * why nesting it inside the button would corrupt the button's accessible
     * name.
     *
     * @param {HTMLElement} target - The element to mount into.
     * @returns {void}
     */
    appendTo(target) {
        target.replaceChildren(this.#domElement, this.#announcer.element);
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
            // The repaint stays SYNCHRONOUS: both firings of a single user action share
            // one task, so the browser never paints between them and the intermediate
            // write is unobservable. Only the NOTIFICATION is deferred, and that is now
            // `ApiOptions.onSettled()`'s job rather than this class's.
            this.#render();
        };
        element.addEventListener('change', listener);
        this.#subscriptions.push({ element, listener });
    }

    /**
     * Notifies subscribers when the serialized URL has changed.
     *
     * Called from `ApiOptions.onSettled()`, which is what guarantees the whole
     * synthetic cascade has landed before this reads `this.url`. Until issue #55 this
     * class scheduled its own microtask for exactly that reason; the scheduling now
     * belongs to the layer that causes the cascade, and only the dedupe — which is
     * specific to what THIS class derives — remains here.
     *
     * @returns {void}
     * @private
     */
    #notifyIfChanged() {
        const next = this.url;
        // The documented contract is that this fires when the URL CHANGES. Compared
        // against the LAST NOTIFIED value, not a set of every URL ever seen, so
        // changing away and back still notifies both times.
        if (next === this.#lastNotified) {
            return;
        }
        this.#lastNotified = next;
        this.#changeCallbacks.forEach((callback) => callback(next));
    }

    /**
     * Registers a callback fired whenever the rendered URL changes, i.e. when
     * the freshly-serialized URL differs from the one last handed to
     * callbacks. A `change` event that leaves the URL unaltered — a raw
     * dispatch, reselecting the currently-selected option — notifies nobody.
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
        this.#domElement.removeEventListener('click', this.#clickListener);
        if (null !== this.#copiedTimer) {
            clearTimeout(this.#copiedTimer);
            this.#copiedTimer = null;
        }
        this.#subscriptions = [];
        this.#changeCallbacks = [];
        this.#unsubscribeSettled?.();
        this.#unsubscribeSettled = null;
    }
}
