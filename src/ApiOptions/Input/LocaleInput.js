import SelectInput from "./SelectInput.js";

export default class LocaleInput extends SelectInput {

    /**
     * The API base whose supported locales this input offers.
     *
     * Supplied by the `ApiOptions` that constructs this input, which has already
     * resolved it. Deliberately NOT resolved here: `resolveBase` warns once per
     * component name when it falls back ambiguously, and resolving in both places
     * would emit that warning for a part the caller never named.
     *
     * @type {import('../../ApiClient/ApiBase.js').default}
     */
    #base                     = null;

    /**
     * The locales of the bound base, cached per instance.
     *
     * Was static, which was safe only while every input on the page read one API.
     *
     * @type {string[]}
     */
    #apiLocales               = null;

    /** @type {Object<string, Map<string, string>>} */
    #apiLocalesDisplay        = {};
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
     * @param {import('../../ApiClient/ApiBase.js').default} base - The API base whose supported locales this input offers.
     *
     * @throws {Error} If the locale is invalid, or the base has not been loaded.
     */
    constructor( locale = null, base = null ) {
        super();
        this._domElement.name = 'locale';
        this._domElement.id = 'locale';
        this._labelElement.textContent = 'locale';
        this._labelElement.htmlFor = this._domElement.id;
        if ( null === base ) {
            throw new Error( 'LocaleInput requires an ApiBase. It is constructed by ApiOptions, which supplies one; construct an ApiOptions rather than a LocaleInput directly, or pass the base of a client explicitly as `new LocaleInput( locale, apiClient.base )`.' );
        }
        this.#base = base;
        if (locale === null) {
            throw new Error('Locale cannot be null.');
        }
        if (false === locale instanceof Intl.Locale) {
            throw new Error('Invalid type for locale, must be of type `Intl.Locale` but found type: ' + typeof locale);
        }
        //this.#regionNames = new Intl.DisplayNames([locale.language], { type: 'region' });
        this.#languageNames = new Intl.DisplayNames([locale.language], { type: 'language' });
        if (this.#apiLocales === null) {
            this.#apiLocales = this.#base.locales();
        }
        if (false === this.#apiLocalesDisplay.hasOwnProperty(locale.language)) {
            this.#apiLocalesDisplay[locale.language] = new Map();
            this.#apiLocales.forEach((localeVal) => {
                this.#apiLocalesDisplay[locale.language].set(localeVal, this.#languageNames.of(localeVal));
            });
            this.#apiLocalesDisplay[locale.language] = new Map(
                [...this.#apiLocalesDisplay[locale.language].entries()].sort((a, b) => a[1].localeCompare(b[1]))
            );
        }
        this.#options = Array.from(this.#apiLocalesDisplay[locale.language]).map(([value, label]) => {
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
