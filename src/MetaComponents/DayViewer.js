/**
 * A complete "liturgy of any day" page: a rite select, a calendar select, a locale
 * input and the `LiturgyOfAnyDay` widget, wired to one another and to an `ApiClient`.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import LiturgyOfAnyDay from '../LiturgyOfAnyDay/LiturgyOfAnyDay.js';
import Messages from '../Messages.js';
import { ApiOptionsFilter } from '../Enums.js';
import { normalizeComponentOptions } from '../OptionsValidation.js';
import { canonicalizeLocale } from '../LocaleValidation.js';
import { assertTheme, resolveChildTheme } from './Theme.js';

/** The slots a caller may name, in mount order. @type {Readonly<string[]>} */
const SLOT_NAMES = Object.freeze(['rite', 'calendar', 'locale', 'liturgy']);

export default class DayViewer {
    /** @type {string} */
    #locale = 'en';

    /** @type {string} */
    #language = 'en';

    /** @type {CalendarSelect} */
    #calendarSelect;

    /** @type {RiteSelect} */
    #riteSelect;

    /** @type {ApiOptions} */
    #apiOptions;

    /** @type {LiturgyOfAnyDay} */
    #liturgy;

    /** @type {string} */
    #selectedLocale = '';

    /** @type {HTMLElement[]} */
    #mounts = [];

    /**
     * @param {Object|string|Intl.Locale} [options] - Options bag, or a locale.
     * @param {string|Intl.Locale} [options.locale] - The display locale.
     * @param {Object} [options.theme] - The theme bag; see `Theme.js`.
     * @param {boolean} [options.showTitle=true] - Whether to show the widget's own heading.
     * @param {Object} [options.apiClient] - Binds this viewer to that client's API base.
     */
    constructor(options) {
        options = normalizeComponentOptions(options, 'DayViewer');
        const { locale, theme, showTitle, apiClient } = options;

        // Validated here, by name, rather than left to whichever child happens to
        // construct first: each child would reject an invalid locale under its OWN
        // name, misattributing the failure to a component the caller never
        // directly touched. Canonicalising once and handing the canonical tag to
        // every child also means none of them re-derives it.
        if (locale !== undefined && locale !== null) {
            this.#locale = canonicalizeLocale(locale, 'DayViewer');
        }
        this.#language = new Intl.Locale(this.#locale).language;
        assertTheme(theme, 'DayViewer');

        // No `text` on the rite label: omitting it lets RiteSelect supply its own
        // localized label rather than forcing a hardcoded English one.
        const riteTheme = resolveChildTheme(theme, 'riteSelect');
        this.#riteSelect = new RiteSelect({ locale: this.#locale });
        if (Object.hasOwn(riteTheme, 'class')) {
            this.#riteSelect.class(riteTheme.class);
        }
        if (Object.hasOwn(riteTheme, 'labelClass')) {
            this.#riteSelect.label({ class: riteTheme.labelClass });
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
        if (Object.hasOwn(calendarTheme, 'labelClass')) {
            this.#calendarSelect.label({
                class: calendarTheme.labelClass,
                text: this.#message('SELECT_A_CALENDAR'),
            });
        }
        if (Object.hasOwn(calendarTheme, 'wrapperClass')) {
            this.#calendarSelect.wrapper({ class: calendarTheme.wrapperClass });
        }

        this.#apiOptions = new ApiOptions({
            locale: this.#locale,
            apiClient,
        }).filter(ApiOptionsFilter.LOCALE_ONLY);
        const localeTheme = resolveChildTheme(theme, 'localeInput');
        if (Object.hasOwn(localeTheme, 'class')) {
            this.#apiOptions._localeInput.class(localeTheme.class);
        }
        if (Object.hasOwn(localeTheme, 'labelClass')) {
            this.#apiOptions._localeInput.labelClass(localeTheme.labelClass);
        }
        this.#apiOptions._localeInput._labelElement.textContent =
            this.#message('LANGUAGE');
        this.#apiOptions._localeInput.defaultValue(this.#language);

        this.#liturgy = new LiturgyOfAnyDay({ locale: this.#locale });
        const liturgyTheme = resolveChildTheme(theme, 'liturgy');
        if (Object.hasOwn(liturgyTheme, 'class')) {
            this.#liturgy.class(liturgyTheme.class);
        }
        for (const key of [
            'titleClass',
            'dateClass',
            'dateControlsClass',
            'eventsWrapperClass',
            'eventClass',
            'eventGradeClass',
            'eventCommonClass',
            'eventYearCycleClass',
        ]) {
            if (Object.hasOwn(liturgyTheme, key)) {
                this.#liturgy[key](liturgyTheme[key]);
            }
        }

        // The three date controls share one theme entry and differ only by label,
        // because a consumer styling them differently from one another is a case
        // nobody has needed; `liturgy` getter access covers it if that changes.
        const controls = resolveChildTheme(theme, 'dateControls', 'input');
        this.#liturgy
            .dayInputConfig({ ...controls, labelText: this.#message('DAY') })
            .monthInputConfig({
                ...controls,
                labelText: this.#message('MONTH'),
            })
            .yearInputConfig({ ...controls, labelText: this.#message('YEAR') })
            .buildDateControls();

        if (false === showTitle) {
            this.#liturgy._titleElement.style.display = 'none';
        }
    }

    /**
     * Reads a message key for this viewer's language, falling back to English.
     *
     * The fallback is per-KEY, not per-locale: `DAY`, `YEAR` and `LANGUAGE` are
     * translated for the same 12 locales that carry `SELECT_A_RITE`, while `MONTH`
     * and `SELECT_A_CALENDAR` are translated for all 84 — so a single locale can
     * legitimately hit the fallback for one key and not another.
     *
     * @param {string} key - The message key.
     * @returns {string} The translated string, or the English one.
     */
    #message(key) {
        return Messages[this.#language]?.[key] ?? Messages['en'][key];
    }

    /**
     * Chooses the locale to request, from those the selected calendar supports.
     *
     * Exact match, then language-prefix match, then the first available option,
     * then the configured locale. Written once here because every consumer wrote it
     * out by hand, and because the order is not self-evident: a page asking for
     * `it-CH` should get Italian rather than English.
     *
     * @returns {string} The locale to request.
     */
    #matchLocale() {
        const options = this.#apiOptions._localeInput.options();
        const exact = options.find((value) => value === this.#locale);
        const language = options.find(
            (value) => value.split(/[-_]/)[0] === this.#language,
        );
        return exact ?? language ?? options[0] ?? this.#locale;
    }

    /** @returns {CalendarSelect} The wired calendar select. */
    get calendarSelect() {
        return this.#calendarSelect;
    }

    /** @returns {RiteSelect} The wired rite select. */
    get riteSelect() {
        return this.#riteSelect;
    }

    /** @returns {Object} The `ApiOptions` locale input. */
    get localeInput() {
        return this.#apiOptions._localeInput;
    }

    /** @returns {LiturgyOfAnyDay} The wired liturgy widget. */
    get liturgy() {
        return this.#liturgy;
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
                `DayViewer.appendTo: the ${slot} target must be a non-empty CSS selector or an HTMLElement.`,
            );
        }
        const element = document.querySelector(target);
        if (null === element) {
            throw new Error(
                `DayViewer.appendTo: Element not found for the ${slot} slot: ${target}`,
            );
        }
        return element;
    }

    /**
     * Mounts the viewer's children.
     *
     * Takes either a slots object naming a target per child, or a single target
     * receiving all of them. The page this was extracted from mounts its parts into
     * four separate containers, which a single target cannot express; a third party
     * embedding the widget wants the single target.
     *
     * An omitted slot means that child is not rendered.
     *
     * Returns `undefined`, matching every other component in this library.
     *
     * @param {string|HTMLElement|Object<string, string|HTMLElement>} target - Slots, or one target.
     * @returns {void}
     */
    appendTo(target) {
        const single =
            typeof target === 'string' || target instanceof HTMLElement;
        const slots = single
            ? Object.fromEntries(SLOT_NAMES.map((name) => [name, target]))
            : target;

        const children = {
            rite: this.#riteSelect,
            calendar: this.#calendarSelect,
            locale: this.#apiOptions,
            liturgy: this.#liturgy,
        };

        for (const name of SLOT_NAMES) {
            if (false === Object.hasOwn(slots, name)) {
                continue;
            }
            const element = DayViewer.#requireElement(slots[name], name);
            this.#mounts.push(element);
            children[name].appendTo(element);
        }

        // Selecting Vatican would silently force Latin. The General Roman Calendar
        // is the universal calendar and is available in every supported locale, so
        // it is the honest default for a page that offers a language picker.
        this.#calendarSelect._domElement.value = '';

        // After the locale input is populated: its options come from the metadata
        // and are not present until it is built.
        this.#selectedLocale = this.#matchLocale();
        this.#apiOptions._localeInput._domElement.value = this.#selectedLocale;
    }
}
