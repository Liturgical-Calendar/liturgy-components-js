import {
    AcceptHeaderInput,
    AscensionInput,
    CorpusChristiInput,
    EpiphanyInput,
    LocaleInput,
    EternalHighPriestInput,
    YearInput,
    YearTypeInput
} from './Input/index.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import ApiClient from '../ApiClient/ApiClient.js';
import { ApiOptionsFilter, CalendarSelectFilter } from '../Enums.js';

/**
 * Class to generate an options form for the Liturgical Calendar API.
 *
 * The class contains methods to generate the form, form label, form wrapper, and form submit elements.
 * The form elements can be fully customized using the methods provided by the class.
 *
 * __ constructor()__ Initializes the ApiOptions object with default or provided settings:
 *                                             - __locale__: The locale to use for the API options form.
 *
 * The following properties are initialized on the object instance:
 * - ___epiphanyInput__: The seslect input with options for when the Epiphany is celebrated.
 * - ___ascensionInput__: The select input with options for when the Ascension is celebrated.
 * - ___corpusChristiInput__: The select input with options for when Corpus Christi is celebrated.
 * - ___eternalHighPriestInput__: The select input with options for whether the Eternal High Priest is celebrated.
 * - ___yearTypeInput__: The select input with options for the type of year to produce, whether liturgical or civil.
 * - ___localeInput__: The select input with options for the locale to use for the calendar response from the API.
 * - ___acceptHeaderInput__: The select input with options for the Accept header to use for the calendar response from the API.
 *
 * @example
 * const apiOptions = new ApiOptions();
 * apiOptions.localeInput.defaultValue( 'en' );
 * apiOptions.acceptHeaderInput.hide();
 *
 * @example
 * const apiOptions = new ApiOptions('it-IT');
 * apiOptions.localeInput.defaultValue( 'it' );
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 * @see https://github.com/Liturgical-Calendar/liturgy-components-js
 */
export default class ApiOptions {

    /** @type {boolean} */
    #linked                = false;

    /** @type {?Intl.Locale} */
    #locale                = null;

    /** @type {{epiphanyInput: ?EpiphanyInput, ascensionInput: ?AscensionInput, corpusChristiInput: ?CorpusChristiInput, eternalHighPriestInput: ?EternalHighPriestInput, localeInput: ?LocaleInput, yearInput: ?YearInput, yearTypeInput: ?YearTypeInput, acceptHeaderInput: ?AcceptHeaderInput}} */
    #inputs                = {
        epiphanyInput: null,
        ascensionInput: null,
        corpusChristiInput: null,
        eternalHighPriestInput: null,
        localeInput: null,
        yearInput: null,
        yearTypeInput: null,
        acceptHeaderInput: null
    };

    #filter                = ApiOptionsFilter.NONE;
    #filterSet             = false;

    /**
     * Constructs an instance of the ApiOptions class, initializing various input components
     * with the given locale. Throws an error if the locale is invalid.
     *
     * @param {string} locale - The locale to use for initialization, defaults to 'en'.
     *                          Underscores in the locale string are replaced with hyphens.
     *
     * @throws {Error} If the locale is invalid or not recognized.
     */

    constructor( locale = 'en' ) {
        locale = locale.replaceAll('_', '-');
        const canonicalLocales = Intl.getCanonicalLocales(locale);
        if (canonicalLocales.length === 0) {
            throw new Error('Invalid locale: ' + locale);
        }
        this.#locale = new Intl.Locale(canonicalLocales[0]);
        this.#inputs.epiphanyInput = new EpiphanyInput(this.#locale);
        this.#inputs.ascensionInput = new AscensionInput(this.#locale);
        this.#inputs.corpusChristiInput = new CorpusChristiInput(this.#locale);
        this.#inputs.eternalHighPriestInput = new EternalHighPriestInput(this.#locale);
        this.#inputs.localeInput = new LocaleInput(this.#locale);
        this.#inputs.yearInput = new YearInput();
        this.#inputs.yearTypeInput = new YearTypeInput(this.#locale);
        this.#inputs.acceptHeaderInput = new AcceptHeaderInput();
    }

    #handleMultipleLinkedCalendarSelects(calendarSelects) {
        const nationSelector = calendarSelects[0]._filter === CalendarSelectFilter.NATIONAL_CALENDARS ? calendarSelects[0] : calendarSelects[1];
        const dioceseSelector = calendarSelects[0]._filter === CalendarSelectFilter.DIOCESAN_CALENDARS ? calendarSelects[0] : calendarSelects[1];
        nationSelector._domElement.addEventListener('change', (ev) => {
            // TODO: set selected values based on selected calendar
            // TODO: set available options for locale select based on selected calendar
            if (ev.target.value === '' && dioceseSelector._domElement.value === '') {
                // all API options enabled
                this.#inputs.epiphanyInput.disabled(false);
                this.#inputs.ascensionInput.disabled(false);
                this.#inputs.corpusChristiInput.disabled(false);
                this.#inputs.eternalHighPriestInput.disabled(false);
            } else {
                // all API options disabled
                this.#inputs.epiphanyInput.disabled(true);
                this.#inputs.ascensionInput.disabled(true);
                this.#inputs.corpusChristiInput.disabled(true);
                this.#inputs.eternalHighPriestInput.disabled(true);
            }
        });
        dioceseSelector._domElement.addEventListener('change', (ev) => {
            // TODO: set selected values based on selected calendar
            // TODO: set available options for locale select based on selected calendar
            if (ev.target.value === '' && nationSelector._domElement.value === '') {
                // all API options enabled
                this.#inputs.epiphanyInput.disabled(false);
                this.#inputs.ascensionInput.disabled(false);
                this.#inputs.corpusChristiInput.disabled(false);
                this.#inputs.eternalHighPriestInput.disabled(false);
            } else {
                // all API options disabled
                this.#inputs.epiphanyInput.disabled(true);
                this.#inputs.ascensionInput.disabled(true);
                this.#inputs.corpusChristiInput.disabled(true);
                this.#inputs.eternalHighPriestInput.disabled(true);
            }
        });
    }

    #handleSingleLinkedCalendarSelect(calendarSelect) {
        let currentSelectedCalendarId = calendarSelect._domElement.value;
        if (currentSelectedCalendarId !== '') {
            let currentSelectedCalendarType = calendarSelect._domElement.querySelector(':checked').getAttribute('data-calendartype');
            switch(currentSelectedCalendarType) {
                case 'national': {
                    const selectedNationalCalendar = ApiClient._metadata.national_calendars.filter(nationCalendarObj => nationCalendarObj.calendar_id === currentSelectedCalendarId)[0];
                    const {settings, locales} = selectedNationalCalendar;
                    Object.entries(settings).forEach(([key, value]) => {
                        // transform the key from snake_case to camelCase
                        key = key.replaceAll('_', ' ');
                        key = key.split(' ').map((word, index) => index === 0 ? word.charAt(0).toLowerCase() + word.slice(1) : word.charAt(0).toUpperCase() + word.slice(1)).join('');
                        if (typeof value === 'boolean') {
                            value = value ? 'true' : 'false';
                        }
                        this.#inputs[`${key}Input`]._domElement.value = value;
                    });
                    this.#inputs.localeInput.setOptionsForCalendarLocales(locales);
                    break;
                }
                case 'diocesan': {
                    const selectedDiocesanCalendar = ApiClient._metadata.diocesan_calendars.filter(dioceseObj => dioceseObj.calendar_id === currentSelectedCalendarId)[0];
                    const {nation, locales} = selectedDiocesanCalendar;
                    const nationalCalendarForDiocese = ApiClient._metadata.national_calendars.filter(nationCalendarObj => nationCalendarObj.calendar_id === nation)[0];
                    const nationalCalendarForDioceseSettings = nationalCalendarForDiocese.settings;
                    Object.entries(nationalCalendarForDioceseSettings).forEach(([key, value]) => {
                        // transform the key from snake_case to camelCase
                        key = key.replaceAll('_', ' ');
                        key = key.split(' ').map((word, index) => index === 0 ? word.charAt(0).toLowerCase() + word.slice(1) : word.charAt(0).toUpperCase() + word.slice(1)).join('');
                        if (typeof value === 'boolean') {
                            value = value ? 'true' : 'false';
                        }
                        this.#inputs[`${key}Input`]._domElement.value = value;
                    });
                    if (selectedDiocesanCalendar.hasOwnProperty('settings')) {
                        const {settings} = selectedDiocesanCalendar;
                        Object.entries(settings).forEach(([key, value]) => {
                            // transform the key from snake_case to camelCase
                            key = key.replaceAll('_', ' ');
                            key = key.split(' ').map((word, index) => index === 0 ? word.charAt(0).toLowerCase() + word.slice(1) : word.charAt(0).toUpperCase() + word.slice(1)).join('');
                            if (typeof value === 'boolean') {
                                value = value ? 'true' : 'false';
                            }
                            this.#inputs[`${key}Input`]._domElement.value = value;
                        });
                    }
                    this.#inputs.localeInput.setOptionsForCalendarLocales(locales);
                    break;
                }
                default:
                    throw new Error('Unknown calendar type: ' + currentSelectedCalendarType);
            }
            this.#inputs.epiphanyInput.disabled(true);
            this.#inputs.ascensionInput.disabled(true);
            this.#inputs.corpusChristiInput.disabled(true);
            this.#inputs.eternalHighPriestInput.disabled(true);
        } else {
            this.#inputs.epiphanyInput.disabled(false);
            this.#inputs.ascensionInput.disabled(false);
            this.#inputs.corpusChristiInput.disabled(false);
            this.#inputs.eternalHighPriestInput.disabled(false);
            this.#inputs.localeInput.resetOptions();
        }
        calendarSelect._domElement.addEventListener('change', (ev) => {
            // TODO: set selected values based on selected calendar
            // TODO: set available options for locale select based on selected calendar
            if (ev.target.value === '') {
                // all API options enabled
                this.#inputs.epiphanyInput.disabled(false);
                this.#inputs.ascensionInput.disabled(false);
                this.#inputs.corpusChristiInput.disabled(false);
                this.#inputs.eternalHighPriestInput.disabled(false);
                this.#inputs.localeInput.resetOptions();
            } else {
                const selectedCalendarType = calendarSelect._domElement.querySelector(':checked').getAttribute('data-calendartype');
                switch(selectedCalendarType) {
                    case 'national': {
                        const selectedNationalCalendar = ApiClient._metadata.national_calendars.filter(nationCalendarObj => nationCalendarObj.calendar_id === ev.target.value)[0];
                        const {settings, locales} = selectedNationalCalendar;
                        Object.entries(settings).forEach(([key, value]) => {
                            // transform the key from snake_case to camelCase
                            key = key.replaceAll('_', ' ');
                            key = key.split(' ').map((word, index) => index === 0 ? word.charAt(0).toLowerCase() + word.slice(1) : word.charAt(0).toUpperCase() + word.slice(1)).join('');
                            if (typeof value === 'boolean') {
                                value = value ? 'true' : 'false';
                            }
                            this.#inputs[`${key}Input`]._domElement.value = value;
                        });
                        this.#inputs.localeInput.setOptionsForCalendarLocales(locales);
                        break;
                    }
                    case 'diocesan': {
                        const selectedDiocese = ApiClient._metadata.diocesan_calendars.filter(dioceseObj => dioceseObj.calendar_id === ev.target.value)[0];
                        const {nation, locales} = selectedDiocese;
                        const nationalCalendarForDiocese = ApiClient._metadata.national_calendars.filter(nationCalendarObj => nationCalendarObj.calendar_id === nation)[0];
                        const nationalCalendarForDioceseSettings = nationalCalendarForDiocese.settings;
                        Object.entries(nationalCalendarForDioceseSettings).forEach(([key, value]) => {
                            // transform the key from snake_case to camelCase
                            key = key.replaceAll('_', ' ');
                            key = key.split(' ').map((word, index) => index === 0 ? word.charAt(0).toLowerCase() + word.slice(1) : word.charAt(0).toUpperCase() + word.slice(1)).join('');
                            if (typeof value === 'boolean') {
                                value = value ? 'true' : 'false';
                            }
                            this.#inputs[`${key}Input`]._domElement.value = value;
                        });
                        if (selectedDiocese.hasOwnProperty('settings')) {
                            const {settings} = selectedDiocese;
                            Object.entries(settings).forEach(([key, value]) => {
                                // transform the key from snake_case to camelCase
                                key = key.replaceAll('_', ' ');
                                key = key.split(' ').map((word, index) => index === 0 ? word.charAt(0).toLowerCase() + word.slice(1) : word.charAt(0).toUpperCase() + word.slice(1)).join('');
                                if (typeof value === 'boolean') {
                                    value = value ? 'true' : 'false';
                                }
                                this.#inputs[`${key}Input`]._domElement.value = value;
                            });
                        }
                        this.#inputs.localeInput.setOptionsForCalendarLocales(locales);
                        break;
                    }
                }
                // all API options disabled
                this.#inputs.epiphanyInput.disabled(true);
                this.#inputs.ascensionInput.disabled(true);
                this.#inputs.corpusChristiInput.disabled(true);
                this.#inputs.eternalHighPriestInput.disabled(true);
            }
        });
    }

    /**
     * Validates a given element selector and returns the corresponding DOM element.
     *
     * If the element selector is not a string, an error is thrown.
     * If the element selector is a string, it is validated against the DOM and if the element is not found, an error is thrown.
     *
     * @private
     * @param {string} element - The element selector to be validated.
     * @returns {Element} The DOM element corresponding to the element selector.
     * @throws {Error} If the type of element is not a string.
     * @throws {Error} If the element selector is not found in the DOM.
     */
    #validateElementSelector( element ) {
        if (typeof element !== 'string') {
            throw new Error('Invalid type for element selector, must be of type string but found type: ' + typeof element);
        }
        const domNode = document.querySelector( element );
        if ( null === domNode ) {
            throw new Error('Invalid element selector: ' + element);
        }
        return domNode;
    }

    /**
     * Sets the filter for the ApiOptions instance.
     *
     * The filter can be either `ApiOptionsFilter.ALL_CALENDARS`, `ApiOptionsFilter.GENERAL_ROMAN`, or `ApiOptionsFilter.NONE`.
     * - `ApiOptionsFilter.ALL_CALENDARS` will show only the form controls that are useful for all calendars: locale, yearType, and conditionally acceptHeader inputs.
     * - `ApiOptionsFilter.GENERAL_ROMAN` will show only the form controls that are useful for the General Roman Calendar: epiphany, ascension, corpusChristi, and eternalHighPriest inputs.
     * - `ApiOptionsFilter.NONE` will show all possible form controls.
     *
     * If the filter is set to a value that is not a valid value for the `ApiOptionsFilter` enum,
     * an error will be thrown.
     *
     * If the filter is set to a value that is different from the current filter,
     * the select elements will be filtered accordingly, and the filter will not be able to be set again.
     *
     * @param {string} [filter=ApiOptionsFilter.NONE] The filter to set.
     * @throws {Error} If the filter is set to a value that is not a valid value for the `ApiOptionsFilter` enum.
     * @throws {Error} If the filter is set to a value that is different from the current filter.
     * @returns {ApiOptions} The ApiOptions instance.
     */
    filter( filter = ApiOptionsFilter.NONE ) {
        if ( this.#filterSet && this.#filter !== filter ) {
            throw new Error('Filter has already been set to `' + this.#filter + '` on ApiOptions instance with locale ' + this.#locale + '.');
        }
        if ( ApiOptionsFilter.ALL_CALENDARS !== filter && ApiOptionsFilter.GENERAL_ROMAN !== filter && ApiOptionsFilter.NONE !== filter ) {
            throw new Error('Invalid filter: ' + filter + ', must be one of `ApiOptionsFilter.ALL_CALENDARS`, `ApiOptionsFilter.GENERAL_ROMAN`, or `ApiOptionsFilter.NONE`');
        }
        this.#filter = filter;
        this.#filterSet = true;
        return this;
    }

    /**
     * Link the ApiOptions instance to a CalendarSelect instance or an array of two CalendarSelect instances.
     * When a CalendarSelect instance is linked, the selected calendar's settings will be used to populate the
     * API options. When the selected calendar is changed, the API options will be updated accordingly.
     * If two CalendarSelect instances are linked, one must be a `nations` filtered CalendarSelect and the other a
     * `dioceses` filtered CalendarSelect. When the selected calendar is changed in either of the two CalendarSelect
     * instances, the API options will be updated accordingly.
     * @param {CalendarSelect | [CalendarSelect, CalendarSelect]} calendarSelect - The CalendarSelect instance or
     * an array of two CalendarSelect instances to link to the ApiOptions instance.
     * @returns {ApiOptions} - The ApiOptions instance.
     */
    linkToCalendarSelect(calendarSelect) {
        if (this.#linked) {
            throw new Error('Current ApiOptions instance already linked to another CalendarSelect instance');
        }
        if (Array.isArray(calendarSelect)) {
            if (calendarSelect.length > 2) {
                throw new Error('Cannot link more than two CalendarSelect instances');
            }
            calendarSelect.forEach(calendarSelectInstance => {
                if (false === calendarSelectInstance instanceof CalendarSelect) {
                    throw new Error('Invalid type for items passed to linkToCalendarSelect, must be of type `CalendarSelect` but found type: ' + typeof calendarSelect);
                }
            });
            if (
                (calendarSelect[0]._filter === 'nations' && calendarSelect[1]._filter !== 'dioceses')
                ||
                (calendarSelect[0]._filter === 'dioceses' && calendarSelect[1]._filter !== 'nations')
            ) {
                throw new Error('When linking two CalendarSelect instances, one instance must be a `nations` filtered CalendarSelect and the other a `dioceses` filtered CalendarSelect, instead we found: ' + calendarSelect[0]._filter + ' and ' + calendarSelect[1]._filter);
            }
            this.#handleMultipleLinkedCalendarSelects(calendarSelect);
        } else {
            if (false === calendarSelect instanceof CalendarSelect) {
                throw new Error('Invalid type for parameter passed to linkToCalendarSelect, must be of type `CalendarSelect` but found type: ' + typeof calendarSelect);
            }
            if (calendarSelect._filter !== 'none') {
                throw new Error('When linking a single CalendarSelect instance, it must be a `none` filtered CalendarSelect, instead we found: ' + calendarSelect._filter);
            }
            if (calendarSelect._domElement.children.length === 0) {
                throw new Error('You seem to be attempting to link to a CalendarSelect instance that is not fully initialized.');
            }
            this.#handleSingleLinkedCalendarSelect(calendarSelect);
        }
        this.#linked = true;
        return this;
    }

    /**
     * Appends input elements to the specified DOM element, optionally filtered based on the ApiOptionsFilter.
     *
     * @param {string|HTMLElement} elementSelector - The CSS selector for the DOM element to which the input elements will be appended.
     */
    appendTo(elementSelector) {
        let domNode;
        if (typeof elementSelector === 'string') {
            domNode = this.#validateElementSelector( elementSelector );
        }
        else if(elementSelector instanceof HTMLElement) {
            domNode = elementSelector;
        } else {
            throw new Error('ApiOptions.appendTo: parameter must be a valid CSS selector or an instance of HTMLElement');
        }
        if (ApiOptionsFilter.NONE === this.#filter || ApiOptionsFilter.ALL_CALENDARS === this.#filter) {
            this.#inputs.localeInput.appendTo(domNode);
            this.#inputs.yearTypeInput.appendTo(domNode);
            if (false === this.#inputs.acceptHeaderInput._hidden) {
                this.#inputs.acceptHeaderInput.appendTo(domNode);
            }
            this.#inputs.yearInput.appendTo(domNode);
        }
        if (ApiOptionsFilter.NONE === this.#filter || ApiOptionsFilter.GENERAL_ROMAN === this.#filter) {
            this.#inputs.epiphanyInput.appendTo(domNode);
            this.#inputs.ascensionInput.appendTo(domNode);
            this.#inputs.corpusChristiInput.appendTo(domNode);
            this.#inputs.eternalHighPriestInput.appendTo(domNode);
        }
    }

    get _epiphanyInput() {
        return this.#inputs.epiphanyInput;
    }

    get _ascensionInput() {
        return this.#inputs.ascensionInput;
    }

    get _corpusChristiInput() {
        return this.#inputs.corpusChristiInput;
    }

    get _eternalHighPriestInput() {
        return this.#inputs.eternalHighPriestInput;
    }

    get _localeInput() {
        return this.#inputs.localeInput;
    }

    get _yearTypeInput() {
        return this.#inputs.yearTypeInput;
    }

    get _yearInput() {
        return this.#inputs.yearInput;
    }

    get _acceptHeaderInput() {
        return this.#inputs.acceptHeaderInput;
    }
}
