import SelectInput from "./SelectInput.js";
import ApiClient from "../../ApiClient/ApiClient.js";

export default class LocaleInput extends SelectInput {

    static #apiLocales        = null;
    static #apiLocalesDisplay = {};
    //#regionNames              = null;
    #languageNames            = null;
    /** @type {HTMLOptionElement[]} */
    #options                  = null;

    /**
     * Constructs a LocaleInput object.
     *
     * @param {string|Intl.Locale|null} locale - The locale to use for the select element.
     *                                          The locale should be a valid string that can be parsed by the
     *                                          Intl.getCanonicalLocales function or an instance of Intl.Locale.
     *                                          If the locale string contains an underscore, the underscore will be replaced
     *                                          with a hyphen.
     *
     * @throws {Error} If the locale is invalid.
     */
    constructor( locale = null) {
        super();
        this._domElement.name = 'locale';
        this._domElement.id = 'locale';
        this._labelElement.textContent = 'locale';
        if (ApiClient._metadata === null) {
            throw new Error('ApiClient has not yet been initialized. Please initialize with `ApiClient.init().then(() => { ... })`, and handle the LocaleInput instances within the callback.');
        }
        if (locale === null) {
            throw new Error('Locale cannot be null.');
        }
        if (false === locale instanceof Intl.Locale) {
            throw new Error('Invalid type for locale, must be of type `Intl.Locale` but found type: ' + typeof locale);
        }
        //this.#regionNames = new Intl.DisplayNames([locale.language], { type: 'region' });
        this.#languageNames = new Intl.DisplayNames([locale.language], { type: 'language' });
        if (LocaleInput.#apiLocales === null) {
            LocaleInput.#apiLocales = ApiClient._metadata.locales;
        }
        if (false === LocaleInput.#apiLocalesDisplay.hasOwnProperty(locale.language)) {
            LocaleInput.#apiLocalesDisplay[locale.language] = new Map();
            LocaleInput.#apiLocales.forEach((localeVal) => {
                LocaleInput.#apiLocalesDisplay[locale.language].set(localeVal, this.#languageNames.of(localeVal));
            });
            LocaleInput.#apiLocalesDisplay[locale.language] = new Map(
                [...LocaleInput.#apiLocalesDisplay[locale.language].entries()].sort((a, b) => a[1].localeCompare(b[1]))
            );
        }
        this.#options = Array.from(LocaleInput.#apiLocalesDisplay[locale.language]).map(([value, label]) => {
            const option = document.createElement('option');
            option.value = value;
            option.title = value;
            option.textContent = label;
            option.selected = this._defaultValue === value;
            return option;
        });
        this._domElement.replaceChildren(...this.#options);
    }

    /**
     * Updates the options for the calendar locales select input.
     *
     * This method takes an array of calendar locale identifiers and updates
     * the select input with corresponding option elements. Each option element
     * is created with the locale identifier as its value and display name.
     *
     * @param {string[]} calendarLocales - An array of calendar locale identifiers.
     * @throws {Error} If the `calendarLocales` array is empty.
     */
    setOptionsForCalendarLocales(calendarLocales = []) {
        if (calendarLocales.length === 0) {
            console.error('`calendarLocales` parameter passed to `LocaleInput.setOptionsForCalendarLocales()` cannot be empty.');
            console.error(this);
            throw new Error('`calendarLocales` parameter passed to `LocaleInput.setOptionsForCalendarLocales()` cannot be empty.');
        }
        const newChildren = calendarLocales.map((calendarLocale) => {
            const option = document.createElement('option');
            option.value = calendarLocale;
            option.title = calendarLocale;
            option.textContent = this.#languageNames.of(calendarLocale.replaceAll('_', '-'));
            return option;
        });
        this._domElement.replaceChildren(...newChildren);
    }

    /**
     * Resets the options for this LocaleInput instance.
     *
     * This method is typically called when the user selects a new calendar.
     * It will reset the options to the default locales supported by the API, and
     * set the selected value of the input to the value of the `selectedValue` property
     * of the LocaleInput instance, or to "la" if no value is set.
     */
    resetOptions() {
        this._domElement.replaceChildren(...this.#options);
        this._domElement.value = this._defaultValue !== '' ? this._defaultValue : 'la';
    }

}
