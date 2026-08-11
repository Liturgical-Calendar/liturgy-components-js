/**
 * The rite select, calendar select and API options of a calendar page, wired to
 * one another and to an `ApiClient` — with no renderer.
 *
 * The renderer is the axis of variation and the wiring is not: the same 45-line
 * block appears byte-for-byte in a `WebCalendar` example and a FullCalendar one,
 * and again, minus the fetching, in the API explorer. This class is that block.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import ApiClient from '../ApiClient/ApiClient.js';
import { resolveBase, assertSameBase } from '../ApiClient/ApiBase.js';
import { ApiOptionsFilter } from '../Enums.js';
import { normalizeComponentOptions } from '../OptionsValidation.js';
import { canonicalizeLocale } from '../LocaleValidation.js';
import { assertTheme, resolveChildTheme } from './Theme.js';

export default class CalendarControls {
    /** @type {string} */
    #locale = 'en';

    /** @type {RiteSelect} */
    #riteSelect;

    /** @type {CalendarSelect} */
    #calendarSelect;

    /** @type {ApiOptions} */
    #apiOptions;

    /** @type {ApiClient|null} */
    #apiClient = null;

    /** @type {import('../ApiClient/ApiBase.js').default} */
    #base;

    /** @type {HTMLElement|null} */
    #mount = null;

    /** @type {boolean} */
    #disposed = false;

    /** @type {boolean} */
    #riteLinked = false;

    /**
     * @param {Object|string|Intl.Locale} [options] - Options bag, or a locale.
     * @param {string|Intl.Locale} [options.locale] - The display locale.
     * @param {string} [options.filter] - Which `ApiOptions` inputs to show.
     * @param {Object} [options.theme] - The theme bag; see `Theme.js`.
     * @param {Object} [options.apiClient] - Binds to that client's API base.
     */
    constructor(options) {
        options = normalizeComponentOptions(options, 'CalendarControls');
        const { locale, filter, theme, apiClient } = options;

        if (locale !== undefined && locale !== null) {
            this.#locale = canonicalizeLocale(locale, 'CalendarControls');
        }
        assertTheme(theme, 'CalendarControls');
        this.#base = resolveBase(apiClient, 'CalendarControls');

        const riteTheme = resolveChildTheme(theme, 'riteSelect');
        this.#riteSelect = new RiteSelect({ locale: this.#locale });
        if (Object.hasOwn(riteTheme, 'class')) {
            this.#riteSelect.class(riteTheme.class);
        }
        if (
            Object.hasOwn(riteTheme, 'labelClass') ||
            Object.hasOwn(riteTheme, 'labelText')
        ) {
            const labelOptions = {};
            if (Object.hasOwn(riteTheme, 'labelClass')) {
                labelOptions.class = riteTheme.labelClass;
            }
            if (Object.hasOwn(riteTheme, 'labelText')) {
                labelOptions.text = riteTheme.labelText;
            }
            this.#riteSelect.label(labelOptions);
        }

        const calendarTheme = resolveChildTheme(theme, 'calendarSelect');
        this.#calendarSelect = new CalendarSelect({
            locale: this.#locale,
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
            const labelOptions = {};
            if (Object.hasOwn(calendarTheme, 'labelClass')) {
                labelOptions.class = calendarTheme.labelClass;
            }
            labelOptions.text = Object.hasOwn(calendarTheme, 'labelText')
                ? calendarTheme.labelText
                : undefined;
            this.#calendarSelect.label(labelOptions);
        }
        if (Object.hasOwn(calendarTheme, 'wrapperClass')) {
            this.#calendarSelect.wrapper({
                class: calendarTheme.wrapperClass,
            });
        }

        this.#apiOptions = new ApiOptions({
            locale: this.#locale,
            apiClient,
        }).filter(filter ?? ApiOptionsFilter.ALL_CALENDARS);
    }

    /** @returns {RiteSelect} The wired rite select. */
    get riteSelect() {
        this.#assertUsable();
        return this.#riteSelect;
    }

    /** @returns {CalendarSelect} The wired calendar select. */
    get calendarSelect() {
        this.#assertUsable();
        return this.#calendarSelect;
    }

    /** @returns {ApiOptions} The wired ApiOptions. */
    get apiOptions() {
        this.#assertUsable();
        return this.#apiOptions;
    }

    /**
     * Guards every method a disposed instance cannot honour.
     *
     * @returns {void}
     * @throws {Error} If this instance has been disposed.
     */
    #assertUsable() {
        if (true === this.#disposed) {
            throw new Error(
                'CalendarControls: these controls have been disposed and can no longer be used.',
            );
        }
    }

    /**
     * Resolves a mount target to an element.
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
                `CalendarControls.${caller}: target must be a non-empty CSS selector or an HTMLElement.`,
            );
        }
        const element = document.querySelector(target);
        if (null === element) {
            throw new Error(
                `CalendarControls.${caller}: Element not found: ${target}`,
            );
        }
        return element;
    }

    /**
     * Mounts the three children into the target, rite select first so it reads
     * first in the form.
     *
     * `linkToRiteSelect()` does NOT require the select to be in the document —
     * it only calls `addEventListener` and reads `.value`, both fine detached —
     * so the ordering is for form layout, nothing else.
     *
     * Callable more than once; the children are moved rather than copied.
     *
     * @param {string|HTMLElement} target - Where to mount.
     * @returns {void}
     */
    appendTo(target) {
        this.#assertUsable();
        const element = CalendarControls.#requireElement(target, 'appendTo');
        this.#mount = element;
        this.#riteSelect.appendTo(element);
        this.#calendarSelect.appendTo(element);
        this.#apiOptions.appendTo(element);
    }

    /**
     * Wires the controls to an `ApiClient`.
     *
     * The rite needs BOTH wires: `ApiOptions.linkToRiteSelect()` rebuilds the
     * calendar list and disables the temporal options the rite fixes, while only
     * `ApiClient.listenTo( riteSelect )` turns the rite into a URL path segment.
     * Wire just the first and the failure is silent — the form reads `ambrosian`
     * while every request still goes to `/calendar/roman/`.
     *
     * Rebinding is refused before anything is wired, so a rejected call leaves
     * the previous client and its subscriptions untouched.
     *
     * @param {ApiClient} apiClient - The client to drive.
     * @returns {CalendarControls} This instance.
     */
    listenTo(apiClient) {
        this.#assertUsable();
        if (null !== this.#apiClient) {
            throw new Error(
                'CalendarControls.listenTo: these controls are already wired to an ApiClient. Build a second CalendarControls to drive a second client.',
            );
        }
        assertSameBase(
            this.#base,
            apiClient?.base,
            'CalendarControls.listenTo: these controls and the ApiClient passed to them',
            'Controls filled from one API while their requests go to another would describe neither.',
        );

        if (false === this.#riteLinked) {
            this.#apiOptions
                .linkToCalendarSelect(this.#calendarSelect)
                .linkToRiteSelect(this.#riteSelect);
            this.#riteLinked = true;
        }
        apiClient
            .listenTo(this.#calendarSelect)
            .listenTo(this.#riteSelect)
            .listenTo(this.#apiOptions);
        this.#apiClient = apiClient;
        return this;
    }
}
