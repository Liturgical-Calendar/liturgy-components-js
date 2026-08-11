/**
 * A rite select and a filtered calendar select, wired together as one control.
 *
 * Exists because three separate admin call sites in `LiturgicalCalendarFrontend`
 * built this pairing by hand, identically, including the comments — and because
 * the pairing has ordering and re-application requirements that the underlying
 * components document but cannot enforce.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import Messages from '../Messages.js';
import { CalendarSelectFilter } from '../Enums.js';
import { normalizeComponentOptions } from '../OptionsValidation.js';
import { canonicalizeLocale } from '../LocaleValidation.js';
import { assertTheme, resolveChildTheme } from './Theme.js';

/**
 * The filters this picker accepts. `CalendarSelectFilter.NONE` is excluded on
 * purpose: an unfiltered select mixes national and diocesan calendars, and a
 * resource id has to be one or the other.
 *
 * @type {Readonly<string[]>}
 */
const ACCEPTED_FILTERS = Object.freeze([
    CalendarSelectFilter.NATIONAL_CALENDARS,
    CalendarSelectFilter.DIOCESAN_CALENDARS,
]);

export default class CalendarResourcePicker {
    /** @type {CalendarSelect|null} */
    #calendarSelect = null;

    /** @type {RiteSelect|null} */
    #riteSelect = null;

    /** @type {HTMLElement|null} */
    #mount = null;

    /** @type {boolean} */
    #failed = false;

    /** @type {string|null} */
    #placeholderText = null;

    /**
     * The theme bag, kept only for a failed picker so that a later `appendTo()` can
     * re-render the same failure control it started with. Unused on a working
     * picker, whose children have already had the theme applied.
     *
     * @type {Object|undefined}
     */
    #theme = undefined;

    /**
     * The failure control's message, kept for the same reason as `#theme`.
     *
     * @type {string|undefined}
     */
    #errorText = undefined;

    /** @type {function|null} */
    #riteChangeListener = null;

    /** @type {boolean} */
    #disposed = false;

    /** @type {Array<{target: EventTarget, type: string, listener: function}>} */
    #listeners = [];

    /**
     * @param {Object|string|Intl.Locale} [options] - Options bag, or a locale.
     * @param {string|Intl.Locale} [options.locale] - The display locale.
     * @param {string} options.filter - `CalendarSelectFilter.NATIONAL_CALENDARS` or `.DIOCESAN_CALENDARS`.
     * @param {Object} [options.theme] - The theme bag; see `Theme.js`.
     * @param {Object} [options.apiClient] - Binds this picker to that client's API base.
     * @param {string} [options.placeholderText] - Text for a disabled placeholder option.
     * @throws {Error} If the filter is absent or not one of the two accepted values.
     */
    constructor(options) {
        options = normalizeComponentOptions(options, 'CalendarResourcePicker');
        const { locale, filter, theme, apiClient, placeholderText } = options;

        // Validated here, by name, rather than left to whichever child happens to
        // construct first: `CalendarSelect` and `RiteSelect` each reject an invalid
        // locale under their OWN name, which would misattribute the failure to a
        // child the caller never directly touched. Canonicalising once and handing
        // the canonical tag to both children also means neither re-derives it.
        const resolvedLocale =
            locale === undefined || locale === null
                ? locale
                : canonicalizeLocale(locale, 'CalendarResourcePicker');

        // Used only to compute the fallback label text below (`#message`,
        // I4) — the children themselves receive `resolvedLocale` directly and
        // derive their own language.
        const language = resolvedLocale
            ? new Intl.Locale(resolvedLocale).language
            : 'en';

        if (false === ACCEPTED_FILTERS.includes(filter)) {
            throw new Error(
                `CalendarResourcePicker: the filter option must be CalendarSelectFilter.NATIONAL_CALENDARS or CalendarSelectFilter.DIOCESAN_CALENDARS, but found: ${String(filter)}`,
            );
        }
        assertTheme(theme, 'CalendarResourcePicker');

        // Set only by `mountInto()`, and only when the real construction already
        // threw. The instance exists to answer `failed`, `value`, `onChange()` and
        // `appendTo()`; it builds no children, because building them is exactly
        // what just failed. `theme`/`errorText` are kept so a later `appendTo()`
        // call (see below) can render the same failure control this picker started
        // with, rather than crashing or rendering an unstyled default.
        if (true === options._failed) {
            this.#failed = true;
            this.#theme = theme;
            this.#errorText = options.errorText;
            return;
        }

        if (typeof placeholderText === 'string' && '' !== placeholderText) {
            this.#placeholderText = placeholderText;
        }

        // The rite select is offered for diocesan filters ONLY. The Ambrosian rite
        // has no national tier, so a `nations` filtered select under it holds only
        // the rite-level calendar and hides itself — which would strand the user
        // with a required field and no way to fill it. Derived here rather than
        // left for each caller to remember.
        const wantsRite = filter === CalendarSelectFilter.DIOCESAN_CALENDARS;

        if (wantsRite) {
            const riteTheme = resolveChildTheme(theme, 'riteSelect');
            this.#riteSelect = new RiteSelect({ locale: resolvedLocale });
            if (Object.hasOwn(riteTheme, 'class')) {
                this.#riteSelect.class(riteTheme.class);
            }
            if (
                Object.hasOwn(riteTheme, 'labelClass') ||
                Object.hasOwn(riteTheme, 'labelText')
            ) {
                const riteLabelOptions = {};
                if (Object.hasOwn(riteTheme, 'labelClass')) {
                    riteLabelOptions.class = riteTheme.labelClass;
                }
                if (Object.hasOwn(riteTheme, 'labelText')) {
                    riteLabelOptions.text = riteTheme.labelText;
                }
                // No `text` when `labelText` was not themed: omitting it lets
                // `RiteSelect` supply its own localized label (which already falls
                // back to English for a locale outside the catalogue) rather than
                // forcing the caller to hardcode one.
                this.#riteSelect.label(riteLabelOptions);
            }
        }

        const calendarTheme = resolveChildTheme(theme, 'calendarSelect');
        this.#calendarSelect = new CalendarSelect({
            locale: resolvedLocale,
            filter,
            apiClient,
            allowNull: true,
        });
        if (Object.hasOwn(calendarTheme, 'class')) {
            this.#calendarSelect.class(calendarTheme.class);
        }
        if (
            Object.hasOwn(calendarTheme, 'labelClass') ||
            Object.hasOwn(calendarTheme, 'labelText')
        ) {
            const calendarLabelOptions = {};
            if (Object.hasOwn(calendarTheme, 'labelClass')) {
                calendarLabelOptions.class = calendarTheme.labelClass;
            }
            // `text` is ALWAYS supplied here, unlike the rite select above:
            // `CalendarSelect.label()`, unlike `RiteSelect.label()`, has no English
            // fallback of its own when `text` is omitted — it reads
            // `Messages[language]['SELECT_A_CALENDAR']` directly, which throws for
            // any locale outside the catalogue (e.g. `ceb`). Supplying `text`
            // unconditionally sidesteps that gap here rather than in
            // `CalendarSelect` itself.
            calendarLabelOptions.text = Object.hasOwn(
                calendarTheme,
                'labelText',
            )
                ? calendarTheme.labelText
                : (Messages[language]?.['SELECT_A_CALENDAR'] ??
                  Messages['en']['SELECT_A_CALENDAR']);
            this.#calendarSelect.label(calendarLabelOptions);
        }
        if (Object.hasOwn(calendarTheme, 'wrapperClass')) {
            this.#calendarSelect.wrapper({
                class: calendarTheme.wrapperClass,
            });
        }
    }

    /**
     * The wired `CalendarSelect`, or `null` on a failed picker — `mountInto()`
     * builds no children once construction has thrown, so there is nothing to
     * return. Mirrors `riteSelect`'s nullability rather than leaving this getter
     * the only one a failed picker's caller cannot trust.
     *
     * Public so a consumer can reach anything the theme bag does not cover — an
     * id, a data attribute — without touching a private field.
     *
     * Throws once this picker has been disposed, exactly like every other public
     * member: `dispose()` nulls out the field first, so a caller holding this
     * getter's previous return value still holds a live, still-working
     * `CalendarSelect` — the disposed picker cannot revoke that reference. Throwing
     * here closes the other half: it stops the picker itself from handing out a
     * fresh one after teardown.
     *
     * @returns {CalendarSelect|null} The calendar select, or `null` on a failed picker.
     * @throws {Error} If this picker has been disposed.
     */
    get calendarSelect() {
        this.#assertUsable();
        return this.#calendarSelect;
    }

    /**
     * The wired `RiteSelect`, or `null` for a national filter.
     *
     * Throws once this picker has been disposed; see `calendarSelect` above.
     *
     * @returns {RiteSelect|null} The rite select, when there is one.
     * @throws {Error} If this picker has been disposed.
     */
    get riteSelect() {
        this.#assertUsable();
        return this.#riteSelect;
    }

    /**
     * The selected calendar id, or the empty string when the placeholder is
     * selected or the picker failed to build.
     *
     * Throws once this picker has been disposed; see `calendarSelect` above.
     *
     * @returns {string} The selected calendar id.
     * @throws {Error} If this picker has been disposed.
     */
    get value() {
        this.#assertUsable();
        return this.#calendarSelect?._domElement.value ?? '';
    }

    /**
     * Whether the picker is showing its failure control instead of a working select.
     *
     * Throws once this picker has been disposed; see `calendarSelect` above.
     *
     * @returns {boolean} True when construction failed at runtime.
     * @throws {Error} If this picker has been disposed.
     */
    get failed() {
        this.#assertUsable();
        return this.#failed;
    }

    /**
     * Resolves a mount target to an element.
     *
     * Static because `mountInto()` needs it before any instance exists — it
     * resolves the target ahead of construction so that an unusable target is
     * reported as the programmer error it is, rather than surfacing later as a
     * failure control.
     *
     * @param {string|HTMLElement} target - A CSS selector or an element.
     * @param {string} caller - The calling method's name, for the message.
     * @returns {HTMLElement} The resolved element.
     * @throws {Error} If the target is neither, or matches nothing.
     */
    static #requireElement(target, caller) {
        if (target instanceof HTMLElement) {
            return target;
        }
        if (typeof target !== 'string' || '' === target) {
            throw new Error(
                `CalendarResourcePicker.${caller}: target must be a non-empty CSS selector or an HTMLElement.`,
            );
        }
        const element = document.querySelector(target);
        if (null === element) {
            throw new Error(
                `CalendarResourcePicker.${caller}: Element not found: ${target}`,
            );
        }
        return element;
    }

    /**
     * Mounts the picker's children into the target element.
     *
     * On a FAILED picker (see `mountInto()`), there are no children to mount: this
     * re-renders the same failure control the picker started with into the new
     * target instead, using the `theme`/`errorText` the failed instance was built
     * with. This is what keeps `appendTo()` safe to call on whatever `mountInto()`
     * resolved to — the documented worked example guards only `null !== picker`,
     * not `picker.failed`.
     *
     * On a working picker, the rite select is appended FIRST — form reading order
     * is one reason, and `linkToRiteSelect()` right below reads the rite select's
     * element to attach its change listener, so the ordering is load-bearing there
     * too.
     *
     * Returns `undefined`, matching every other component in this library.
     *
     * @param {string|HTMLElement} target - Where to mount.
     * @returns {void}
     */
    appendTo(target) {
        this.#assertUsable();
        const element = CalendarResourcePicker.#requireElement(
            target,
            'appendTo',
        );
        this.#mount = element;

        if (true === this.#failed) {
            CalendarResourcePicker.#renderFailure(
                element,
                this.#theme,
                this.#errorText,
            );
            return;
        }

        if (null !== this.#riteSelect) {
            this.#riteSelect.appendTo(element);
        }
        this.#calendarSelect.appendTo(element);

        // Linked only AFTER both children are in the DOM: linkToRiteSelect() reads
        // the rite select's element to attach its change listener.
        if (null !== this.#riteSelect) {
            this.#calendarSelect.linkToRiteSelect(this.#riteSelect);
            this.#riteChangeListener = () => this.#applyPlaceholder();
            this.#riteSelect._domElement.addEventListener(
                'change',
                this.#riteChangeListener,
            );
            this.#listeners.push({
                target: this.#riteSelect._domElement,
                type: 'change',
                listener: this.#riteChangeListener,
            });
        }
        this.#applyPlaceholder();
    }

    /**
     * Turns the calendar select's empty option into a disabled placeholder.
     *
     * `allowNull` adds an empty option whose meaning is "no nation or diocese",
     * i.e. the General Roman Calendar — which is never a valid national or diocesan
     * resource id. Disabling it forces a concrete choice while keeping the select
     * unselected until the user makes one.
     *
     * Idempotent, and re-run after every rite change: `linkToRiteSelect()` rebuilds
     * the option list from scratch and discards this customization.
     *
     * @returns {void}
     */
    #applyPlaceholder() {
        if (null === this.#placeholderText) {
            return;
        }
        const option =
            this.#calendarSelect._domElement.querySelector('option[value=""]');
        if (null === option) {
            return;
        }
        option.textContent = this.#placeholderText;
        option.disabled = true;
        option.selected = true;
    }

    /**
     * Registers a callback for changes to the selected calendar.
     *
     * A no-op on a FAILED picker: its failure control is a disabled `<select>`
     * (see `mountInto()`), which the user cannot interact with, so there is no
     * change to observe. It still returns `this` rather than throwing — a caller
     * following the documented `if ( null !== picker )` guard must be able to call
     * this unconditionally on whatever `mountInto()` resolved to.
     *
     * Chainable, unlike `appendTo()`.
     *
     * @param {function(string): void} callback - Receives the selected calendar id.
     * @returns {CalendarResourcePicker} This instance.
     */
    onChange(callback) {
        this.#assertUsable();
        if (true === this.#failed) {
            return this;
        }
        const listener = () => callback(this.value);
        this.#calendarSelect._domElement.addEventListener('change', listener);
        this.#listeners.push({
            target: this.#calendarSelect._domElement,
            type: 'change',
            listener,
        });
        return this;
    }

    /**
     * Guards every method that a disposed picker cannot honour.
     *
     * A disposed component that quietly does nothing is worse than one that
     * throws: the caller's next assertion fails somewhere unrelated.
     *
     * @returns {void}
     * @throws {Error} If this picker has been disposed.
     */
    #assertUsable() {
        if (true === this.#disposed) {
            throw new Error(
                'CalendarResourcePicker: this picker has been disposed and can no longer be used.',
            );
        }
    }

    /**
     * Releases this picker's listeners and empties its mount.
     *
     * Needed because all three known call sites rebuild their picker whenever the
     * selected scope changes, and the library previously had no teardown of any
     * kind. Idempotent; further use throws rather than failing quietly — and that
     * promise covers every public member, not only `appendTo()` and `onChange()`:
     * the wired children are dropped here too, so a caller cannot dodge disposal
     * by having read `calendarSelect` or `riteSelect` beforehand and kept the
     * reference.
     *
     * @returns {void}
     */
    dispose() {
        if (true === this.#disposed) {
            return;
        }
        for (const { target, type, listener } of this.#listeners) {
            target.removeEventListener(type, listener);
        }
        this.#listeners = [];
        this.#mount?.replaceChildren();
        this.#mount = null;
        this.#calendarSelect = null;
        this.#riteSelect = null;
        this.#disposed = true;
    }

    /**
     * Renders the stand-in control shown when the picker cannot be built.
     *
     * It deliberately keeps the theme's classes, so the control the rest of the
     * form — and the E2E suite — waits for does appear. It is disabled and carries
     * no selectable value, so submit validation still blocks, but the failure now
     * reads as "this broke" rather than as an element that never arrived.
     *
     * @param {HTMLElement} element - The mount.
     * @param {Object|undefined} theme - The theme bag.
     * @param {string} [errorText] - The message to show.
     * @returns {void}
     */
    static #renderFailure(element, theme, errorText) {
        const { class: themedClass } = resolveChildTheme(
            theme,
            'calendarSelect',
        );
        const select = document.createElement('select');
        select.className = `${themedClass ?? ''} is-invalid`.trim();
        select.disabled = true;
        select.required = true;
        select.dataset.loadFailed = 'true';

        const option = document.createElement('option');
        option.value = '';
        option.selected = true;
        option.textContent =
            errorText ?? 'Could not load calendars — try reloading the page';
        select.appendChild(option);

        element.replaceChildren(select);
    }

    /**
     * Builds a picker and mounts it, handling the two things every real call site
     * needs and none of them should re-derive: the failure control, and cancellation.
     *
     * Programmer error and runtime failure are answered differently, on purpose:
     *
     * - Invalid options, or a target that matches nothing, REJECT. Absent and
     *   invalid are different things, and a typo should not be papered over.
     * - A runtime failure — the API down, metadata unparseable — RESOLVES with a
     *   picker whose `failed` is true and whose failure control is in the DOM.
     *   These mount into forms where an empty container is indistinguishable from
     *   "still loading"; the only symptom is a Playwright `waitFor` timing out ten
     *   seconds later with nothing to point at.
     *
     * Resolves to `null` when the mount was cancelled, either by an aborted signal
     * or because the target left the DOM while the client was resolving. The three
     * known call sites all guard against a scope change landing mid-await, each
     * differently; a standard `AbortSignal` covers all three.
     *
     * @param {string|HTMLElement} target - Where to mount.
     * @param {Object} [options] - As the constructor, plus those below.
     * @param {string} [options.errorText] - Text for the failure control.
     * @param {AbortSignal} [options.signal] - Cancels the mount.
     * @returns {Promise<CalendarResourcePicker|null>} The picker, or `null` if cancelled.
     * @throws {Error} If the options or the target are invalid.
     */
    static async mountInto(target, options = {}) {
        const bag = normalizeComponentOptions(
            options,
            'CalendarResourcePicker',
        );
        const { errorText, signal, theme, filter, locale } = bag;

        // Validated up front, ahead of the try below, so that every throw inside it
        // is a runtime failure by construction. `locale` belongs in this list for
        // the same reason `filter` and `theme` do: canonicalizeLocale() would
        // otherwise run for the first time inside the constructor, inside the try,
        // which would turn a caller's typo into a reported "API is down" instead
        // of a rejection. Mirrors the constructor's own absent-vs-invalid check;
        // the canonical tag itself is discarded here and recomputed by the
        // constructor, since this call exists only to let an invalid tag throw
        // before the try.
        if (false === ACCEPTED_FILTERS.includes(filter)) {
            throw new Error(
                `CalendarResourcePicker: the filter option must be CalendarSelectFilter.NATIONAL_CALENDARS or CalendarSelectFilter.DIOCESAN_CALENDARS, but found: ${String(filter)}`,
            );
        }
        assertTheme(theme, 'CalendarResourcePicker');
        if (locale !== undefined && locale !== null) {
            canonicalizeLocale(locale, 'CalendarResourcePicker');
        }

        const element = CalendarResourcePicker.#requireElement(
            target,
            'mountInto',
        );

        if (true === signal?.aborted || false === element.isConnected) {
            return null;
        }

        try {
            const picker = new CalendarResourcePicker(bag);
            // Re-checked after construction: the scope may have changed while the
            // base was being read.
            if (true === signal?.aborted || false === element.isConnected) {
                return null;
            }
            element.replaceChildren();
            picker.appendTo(element);
            return picker;
        } catch (error) {
            console.error(
                'CalendarResourcePicker: could not build the calendar select:',
                error,
            );
            CalendarResourcePicker.#renderFailure(element, theme, errorText);
            // `errorText` is threaded through alongside `theme` so that a later
            // `appendTo()` call on the returned picker (see C1) re-renders the
            // SAME failure control, rather than one that has silently lost its
            // message.
            return new CalendarResourcePicker({
                filter,
                theme,
                errorText,
                _failed: true,
            });
        }
    }
}
