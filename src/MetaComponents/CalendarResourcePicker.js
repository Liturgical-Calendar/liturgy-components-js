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
    /** @type {CalendarSelect} */
    #calendarSelect;

    /** @type {RiteSelect|null} */
    #riteSelect = null;

    /** @type {HTMLElement|null} */
    #mount = null;

    /** @type {boolean} */
    #failed = false;

    /** @type {string|null} */
    #placeholderText = null;

    /** @type {function|null} */
    #riteChangeListener = null;

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

        if (false === ACCEPTED_FILTERS.includes(filter)) {
            throw new Error(
                `CalendarResourcePicker: the filter option must be CalendarSelectFilter.NATIONAL_CALENDARS or CalendarSelectFilter.DIOCESAN_CALENDARS, but found: ${String(filter)}`,
            );
        }
        assertTheme(theme, 'CalendarResourcePicker');

        // Set only by `mountInto()`, and only when the real construction already
        // threw. The instance exists to answer `failed` and `value`; it builds no
        // children, because building them is exactly what just failed.
        if (true === options._failed) {
            this.#failed = true;
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
            if (Object.hasOwn(riteTheme, 'labelClass')) {
                // No `text`: omitting it lets RiteSelect supply its own localized
                // label rather than forcing the caller to hardcode English.
                this.#riteSelect.label({ class: riteTheme.labelClass });
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
        if (Object.hasOwn(calendarTheme, 'labelClass')) {
            this.#calendarSelect.label({ class: calendarTheme.labelClass });
        }
        if (Object.hasOwn(calendarTheme, 'wrapperClass')) {
            this.#calendarSelect.wrapper({
                class: calendarTheme.wrapperClass,
            });
        }
    }

    /**
     * The wired `CalendarSelect`. Public so a consumer can reach anything the theme
     * bag does not cover — an id, a data attribute — without touching a private field.
     *
     * @returns {CalendarSelect} The calendar select.
     */
    get calendarSelect() {
        return this.#calendarSelect;
    }

    /**
     * The wired `RiteSelect`, or `null` for a national filter.
     *
     * @returns {RiteSelect|null} The rite select, when there is one.
     */
    get riteSelect() {
        return this.#riteSelect;
    }

    /**
     * The selected calendar id, or the empty string when the placeholder is
     * selected or the picker failed to build.
     *
     * @returns {string} The selected calendar id.
     */
    get value() {
        return this.#calendarSelect?._domElement.value ?? '';
    }

    /**
     * Whether the picker is showing its failure control instead of a working select.
     *
     * @returns {boolean} True when construction failed at runtime.
     */
    get failed() {
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
     * The rite select is appended FIRST, and that ordering is load-bearing twice
     * over: it reads first in the form, and `linkToRiteSelect()` requires the rite
     * select to already be in the DOM, because it reads the element to attach its
     * change listener.
     *
     * Returns `undefined`, matching every other component in this library.
     *
     * @param {string|HTMLElement} target - Where to mount.
     * @returns {void}
     */
    appendTo(target) {
        const element = CalendarResourcePicker.#requireElement(
            target,
            'appendTo',
        );
        this.#mount = element;
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
     * Chainable, unlike `appendTo()`.
     *
     * @param {function(string): void} callback - Receives the selected calendar id.
     * @returns {CalendarResourcePicker} This instance.
     */
    onChange(callback) {
        this.#calendarSelect._domElement.addEventListener('change', () =>
            callback(this.value),
        );
        return this;
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
        const { errorText, signal, theme, filter } = bag;

        // Validated up front, ahead of the try below, so that every throw inside it
        // is a runtime failure by construction.
        if (false === ACCEPTED_FILTERS.includes(filter)) {
            throw new Error(
                `CalendarResourcePicker: the filter option must be CalendarSelectFilter.NATIONAL_CALENDARS or CalendarSelectFilter.DIOCESAN_CALENDARS, but found: ${String(filter)}`,
            );
        }
        assertTheme(theme, 'CalendarResourcePicker');

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
            return new CalendarResourcePicker({ filter, theme, _failed: true });
        }
    }
}
