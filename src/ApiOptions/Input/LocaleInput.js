import SelectInput from "../SelectInput.js";
import LitCalApiClient from "../../LitCalApiClient.js";

export default class LocaleInput extends SelectInput {

    static #apiLocales        = null;
    static #apiLocalesDisplay = {};
    //#regionNames              = null;
    #languageNames            = null;
    /** @type {HTMLOptionElement[]} */
    #options                  = null;

    constructor( locale = null) {
        super();
        this._domElement.name = 'locale';
        this._domElement.id = 'locale';
        this._labelElement.textContent = 'locale';
        if (LitCalApiClient._metadata === null) {
            throw new Error('LitCalApiClient has not yet been initialized. Please initialize with `LitCalApiClient.init().then(() => { ... })`, and handle the LocaleInput instances within the callback.');
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
            LocaleInput.#apiLocales = LitCalApiClient._metadata.locales;
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
            option.selected = this._selectedValue === value;
            return option;
        });
        this._domElement.replaceChildren(...this.#options);
    }

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

    resetOptions() {
        console.log('resetting options for LocaleInput');
        console.log(this);
        this._domElement.replaceChildren(...this.#options);
        console.log(this._selectedValue);
        this._domElement.value = this._selectedValue !== '' ? this._selectedValue : 'la';
    }

}
