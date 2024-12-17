import Input from "../Input.js";
import { LitCalApiClient, ApiOptions } from "../../index.js";

export default class LocaleInput extends Input {

    static #apiLocales        = null;
    static #apiLocalesDisplay = {};
    //#regionNames              = null;
    #languageNames            = null;
    #options                  = null;

    constructor( locale = null) {
        super();
        this._domElement.name = 'locale';
        this._domElement.id = 'locale';
        if (LitCalApiClient.metadata === null) {
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
            LocaleInput.#apiLocales = LitCalApiClient.metadata.locales;
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
        this.#options = Array.from(LocaleInput.#apiLocalesDisplay[locale.language]);
    }

    #processInput() {
        this._labelElement.textContent = 'locale';
        this.#options.forEach(([value, label]) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            option.selected = this._selectedValue === value;
            this._domElement.appendChild(option);
        });
    }

    appendTo( elementSelector = '' ) {
        if (typeof elementSelector !== 'string') {
            throw new Error('Invalid type for elementSelector, must be of type string but found type: ' + typeof elementSelector);
        }
        if (elementSelector === '') {
            throw new Error('Element selector cannot be empty.');
        }
        const element = document.querySelector(elementSelector);
        if (element === null) {
            throw new Error('Element not found: ' + elementSelector);
        }
        this.#processInput();
        if (null !== this._wrapperElement) {
            this._wrapperElement.appendChild(this._labelElement);
            this._wrapperElement.appendChild(this._domElement);
            element.appendChild(this._wrapperElement);
        } else {
            element.appendChild(this._labelElement);
            element.appendChild(this._domElement);
        }
    }
}