import {
    AcceptHeaderInput,
    AscensionInput,
    CorpusChristiInput,
    EpiphanyInput,
    LocaleInput,
    EternalHighPriestInput,
    HolydaysOfObligationInput,
    YearInput,
    YearTypeInput,
    CalendarPathInput
} from './Input/index.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import ApiClient from '../ApiClient/ApiClient.js';
import { ApiOptionsFilter, CalendarSelectFilter } from '../Enums.js';
import Utils from '../Utils.js';

/**
 * Class to generate form controls for request options to the Liturgical Calendar API.
 *
 * The form controls can be fully customized using the methods provided by the class.
 *
 * - __constructor()__ Initializes the ApiOptions object with default or provided settings:
 *   - __locale__: The locale to use for the API options form.
 *
 * The following properties are initialized on the object instance:
 * - ___epiphanyInput__: The select input with options for when the Epiphany is celebrated.
 * - ___ascensionInput__: The select input with options for when the Ascension is celebrated.
 * - ___corpusChristiInput__: The select input with options for when Corpus Christi is celebrated.
 * - ___eternalHighPriestInput__: The select input with options for whether the Eternal High Priest is celebrated.
 * - ___holydaysOfObligationInput__: The select input with options for which holy days of obligation are observed.
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

    /** @type {string[]} */
    static #expectedSettingsKeys = [
        'year',
        'year_type',
        'locale',
        'epiphany',
        'ascension',
        'corpus_christi',
        'eternal_high_priest',
        'holydays_of_obligation'
    ];

    /** @type {boolean} */
    #linked                = false;

    /** @type {?Intl.Locale} */
    #locale                = null;

    /** @type {boolean} */
    #pathBuilderEnabled    = false;

    /**
     * @type {{
     *  epiphanyInput: ?EpiphanyInput,
     *  ascensionInput: ?AscensionInput,
     *  corpusChristiInput: ?CorpusChristiInput,
     *  eternalHighPriestInput: ?EternalHighPriestInput,
     *  holydaysOfObligationInput: ?HolydaysOfObligationInput,
     *  localeInput: ?LocaleInput,
     *  yearInput: ?YearInput,
     *  yearTypeInput: ?YearTypeInput,
     *  acceptHeaderInput: ?AcceptHeaderInput,
     *  calendarPathInput: ?CalendarPathInput
     * }}
     */
    #inputs                = {
        epiphanyInput: null,
        ascensionInput: null,
        corpusChristiInput: null,
        eternalHighPriestInput: null,
        holydaysOfObligationInput: null,
        localeInput: null,
        yearInput: null,
        yearTypeInput: null,
        acceptHeaderInput: null,
        calendarPathInput: null
    };

    #filter                = ApiOptionsFilter.NONE;
    #filtersSet            = [];

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
        this.#inputs.holydaysOfObligationInput = new HolydaysOfObligationInput();
        this.#inputs.localeInput = new LocaleInput(this.#locale);
        this.#inputs.yearInput = new YearInput();
        this.#inputs.yearTypeInput = new YearTypeInput(this.#locale);
        this.#inputs.acceptHeaderInput = new AcceptHeaderInput();
        this.#inputs.calendarPathInput = new CalendarPathInput(this.#locale);
    }

    /**
     * Basic heuristic to make Holy Days of Obligation select options labels human-friendly
     *
     * TODO: It would be even better to retrieve the actual "name" of the corresponding liturgical events from the current calendar,
     *       but this would require fetching the calendar data first, which is not ideal.
     *       So for now, this private method just applies some basic transformations to make the keys more readable.
     *       We don't have access to any calendar data in ApiClient._calendarData, because it is not a static property, it is an instance property.
     *       Had we access to that instance property, and calendar data had been fetched,
     *       we could filter the calendar data to find the corresponding localized event names.
     *
     * @param {string} key
     * @returns {string}
     */
    static #prettifyLabel(key) {
        return key
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, s => s.toUpperCase())
            .trim()
            .replace(/^(St(?:s?))/, '$1.')
            .replace('Mary Mother Of God', 'Mary, Mother of God')
            .replace('Peter Paul Ap', 'Peter and Paul, Apostles');
    }

    /**
     * Applies the given settings to the corresponding input components.
     *
     * @param {Object} settings - An object containing key-value pairs representing the settings to apply.
     *                            The keys should correspond to the expected settings keys defined in {@link ApiOptions.#expectedSettingsKeys}.
     *                            Boolean values will be converted to 'true' or 'false' strings.
     *                            For the 'holydays_of_obligation' key, the value should be an object where each key is an option key
     *                            and the value is a boolean indicating whether the option is selected.
     *                            Any keys not in the expected settings keys will be ignored.
     * @see {@link ApiOptions.#expectedSettingsKeys}
     * @private
     */
    #applySettingsToInputs(settings) {
        Object.entries(settings).forEach(([key, value]) => {
            // skip keys that are not expected, so that the script doesn't break when an unexpected key is encountered
            if (!ApiOptions.#expectedSettingsKeys.includes(key)) {
                return;
            }
            // transform the key from snake_case to camelCase
            key = key.replaceAll('_', ' ');
            key = key.split(' ').map((word, index) => index === 0 ? word.charAt(0).toLowerCase() + word.slice(1) : word.charAt(0).toUpperCase() + word.slice(1)).join('');
            //console.log(`national settings: transformed key: ${key}, value type: ${typeof value}`);
            if (typeof value === 'boolean') {
                value = (value ? 'true' : 'false');
            }
            if (key === 'holydaysOfObligation' && typeof value === 'object') {
                const optionsArray = Object.entries(value).map(([optionKey, optionSelected]) => ({
                    label: ApiOptions.#prettifyLabel(optionKey),
                    value: optionKey,
                    selected: Boolean(optionSelected)
                }));
                this.#inputs[`${key}Input`].setOptions(optionsArray);
            } else {
                this.#inputs[`${key}Input`]._domElement.value = value;
            }
        });
    }

    // TODO: add support for multiple linked calendar selects
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
                this.#inputs.holydaysOfObligationInput.disabled(false);
            } else {
                // all API options disabled
                this.#inputs.epiphanyInput.disabled(true);
                this.#inputs.ascensionInput.disabled(true);
                this.#inputs.corpusChristiInput.disabled(true);
                this.#inputs.eternalHighPriestInput.disabled(true);
                this.#inputs.holydaysOfObligationInput.disabled(true);
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
                this.#inputs.holydaysOfObligationInput.disabled(false);
            } else {
                // all API options disabled
                this.#inputs.epiphanyInput.disabled(true);
                this.#inputs.ascensionInput.disabled(true);
                this.#inputs.corpusChristiInput.disabled(true);
                this.#inputs.eternalHighPriestInput.disabled(true);
                this.#inputs.holydaysOfObligationInput.disabled(true);
            }
        });
    }


    /**
     * Handles the events for a single linked calendar select.
     *
     * This function is called whenever the select element of the single linked calendar select changes.
     * It takes the value of the currently selected calendar and a boolean indicating whether the select element is disabled.
     *
     * @param {CalendarSelect} calendarSelect - The single linked calendar select to handle events for.
     * @private
     */
    #handleSingleLinkedCalendarSelect(calendarSelect) {
        //console.log('handling single linked calendar select', calendarSelect, this.#filtersSet);
        if (this.#filtersSet.includes(ApiOptionsFilter.PATH_BUILDER)) {
            calendarSelect.allowNull(false).disabled()._domElement.innerHTML = '<option value="">GENERAL ROMAN</option>';
            let lastCalendarPathValue = this.#inputs.calendarPathInput._domElement.value;
            let lastCalendarSelectValue = calendarSelect._domElement.value;
            this.#inputs.calendarPathInput._domElement.addEventListener('change', (ev) => {
                if (ev.target.value !== lastCalendarPathValue) {
                    lastCalendarPathValue = ev.target.value;
                    switch (ev.target.value) {
                        case '/calendar':
                            calendarSelect.disabled(true)._domElement.innerHTML = '<option value="">GENERAL ROMAN</option>';
                            break;
                        case '/calendar/nation/':
                            calendarSelect.disabled(false).filter(CalendarSelectFilter.NATIONAL_CALENDARS);
                            break;
                        case '/calendar/diocese/':
                            calendarSelect.disabled(false).filter(CalendarSelectFilter.DIOCESAN_CALENDARS);
                            break;
                    }
                    if (calendarSelect._domElement.firstChild.getAttribute('value') !== lastCalendarSelectValue) {
                        lastCalendarSelectValue = calendarSelect._domElement.value;
                        calendarSelect._domElement.dispatchEvent(new Event('change'));
                    }
                }
            });
        }

        let currentSelectedCalendarId = calendarSelect._domElement.value;
        if (currentSelectedCalendarId !== '') {
            let currentSelectedCalendarType = calendarSelect._domElement.querySelector(':checked').getAttribute('data-calendartype');
            switch(currentSelectedCalendarType) {
                case 'national': {
                    const selectedNationalCalendar = ApiClient._metadata.national_calendars.find(nationCalendarObj => nationCalendarObj.calendar_id === currentSelectedCalendarId);
                    const {settings, locales} = selectedNationalCalendar;
                    //console.info('handling national calendar settings while linking to calendar select:', settings);
                    this.#applySettingsToInputs(settings);
                    this.#inputs.localeInput.setOptionsForCalendarLocales(locales);
                    break;
                }
                case 'diocesan': {
                    const selectedDiocesanCalendar = ApiClient._metadata.diocesan_calendars.find(dioceseObj => dioceseObj.calendar_id === currentSelectedCalendarId);
                    const {nation, locales} = selectedDiocesanCalendar;
                    const nationalCalendarForDiocese = ApiClient._metadata.national_calendars.find(nationCalendarObj => nationCalendarObj.calendar_id === nation);
                    const nationalCalendarForDioceseSettings = nationalCalendarForDiocese.settings;
                    //console.info('handling national calendar settings for diocesan calendar while linking to calendar select:', nationalCalendarForDioceseSettings);
                    this.#applySettingsToInputs(nationalCalendarForDioceseSettings);
                    if (selectedDiocesanCalendar.hasOwnProperty('settings')) {
                        const {settings} = selectedDiocesanCalendar;
                        //console.info('handling diocesan calendar settings while linking to calendar select:', settings);
                        this.#applySettingsToInputs(settings);
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
            this.#inputs.holydaysOfObligationInput.disabled(true);
        } else {
            this.#inputs.epiphanyInput.disabled(false);
            this.#inputs.ascensionInput.disabled(false);
            this.#inputs.corpusChristiInput.disabled(false);
            this.#inputs.eternalHighPriestInput.disabled(false);
            this.#inputs.holydaysOfObligationInput.disabled(false);
            this.#inputs.localeInput.resetOptions();
        }
        calendarSelect._domElement.addEventListener('change', (ev) => {
            if (ev.target.value === '') {
                // all API options enabled
                this.#inputs.epiphanyInput.disabled(false);
                this.#inputs.ascensionInput.disabled(false);
                this.#inputs.corpusChristiInput.disabled(false);
                this.#inputs.eternalHighPriestInput.disabled(false);
                this.#inputs.holydaysOfObligationInput.disabled(false);
                this.#inputs.localeInput.resetOptions();
            } else {
                const selectedCalendarType = calendarSelect._domElement.querySelector(':checked').getAttribute('data-calendartype');
                switch(selectedCalendarType) {
                    case 'national': {
                        const selectedNationalCalendar = ApiClient._metadata.national_calendars.find(nationCalendarObj => nationCalendarObj.calendar_id === ev.target.value);
                        const {settings, locales} = selectedNationalCalendar;
                        //console.info('handling national calendar settings following change event:', settings);
                        this.#applySettingsToInputs(settings);
                        this.#inputs.localeInput.setOptionsForCalendarLocales(locales);
                        this.#inputs.localeInput._domElement.dispatchEvent(new Event('change'));
                        break;
                    }
                    case 'diocesan': {
                        const selectedDiocese = ApiClient._metadata.diocesan_calendars.find(dioceseObj => dioceseObj.calendar_id === ev.target.value);
                        const {nation, locales} = selectedDiocese;
                        const nationalCalendarForDiocese = ApiClient._metadata.national_calendars.find(nationCalendarObj => nationCalendarObj.calendar_id === nation);
                        const nationalCalendarForDioceseSettings = nationalCalendarForDiocese.settings;
                        //console.info('handling national calendar settings for diocesan calendar following change event:', nationalCalendarForDioceseSettings);
                        this.#applySettingsToInputs(nationalCalendarForDioceseSettings);
                        if (selectedDiocese.hasOwnProperty('settings')) {
                            const {settings} = selectedDiocese;
                            //console.info('handling diocesan calendar settings following change event:', settings);
                            this.#applySettingsToInputs(settings);
                        }
                        this.#inputs.localeInput.setOptionsForCalendarLocales(locales);
                        this.#inputs.localeInput._domElement.dispatchEvent(new Event('change'));
                        break;
                    }
                }
                // all API options disabled
                this.#inputs.epiphanyInput.disabled(true);
                this.#inputs.ascensionInput.disabled(true);
                this.#inputs.corpusChristiInput.disabled(true);
                this.#inputs.eternalHighPriestInput.disabled(true);
                this.#inputs.holydaysOfObligationInput.disabled(true);
            }
        });
    }

    /**
     * Sets the filter for the ApiOptions instance.
     *
     * The filter can be either `ApiOptionsFilter.ALL_CALENDARS`, `ApiOptionsFilter.GENERAL_ROMAN`, `ApiOptionsFilter.PATH_BUILDER`, `ApiOptionsFilter.LOCALE_ONLY`, `ApiOptionsFilter.YEAR_ONLY`, or `ApiOptionsFilter.NONE`.
     * - `ApiOptionsFilter.ALL_CALENDARS` will show only the form controls that are useful for all calendars: locale, yearType, year, and conditionally acceptHeader inputs.
     * - `ApiOptionsFilter.GENERAL_ROMAN` will show only the form controls that are useful for the General Roman Calendar: epiphany, ascension, corpusChristi, and eternalHighPriest inputs.
     * - `ApiOptionsFilter.PATH_BUILDER` will show only the form controls that are useful for the Path Builder: calendarPath and year inputs.
     * - `ApiOptionsFilter.LOCALE_ONLY` will show only the locale input, useful when you only need language selection.
     * - `ApiOptionsFilter.YEAR_ONLY` will show only the year input, useful when used with LiturgyOfAnyDay component.
     * - `ApiOptionsFilter.NONE` will show all possible form controls.
     *
     * If the filter is set to a value that is not a valid value for the `ApiOptionsFilter` enum,
     * an error will be thrown.
     *
     * If the filter has been previously set to a value that is not ApiOptionsFilter.NONE,
     * the select elements will be filtered accordingly, but a value of ApiOptionsFilter.NONE cannot be set.
     *
     * If the filter has been previously set to ApiOptionsFilter.NONE,
     * the select elements will be filtered accordingly, but a value other than ApiOptionsFilter.NONE cannot be set.
     *
     * @param {string} [filter=ApiOptionsFilter.NONE] The filter to set.
     * @throws {Error} If the filter is set to a value that is not a valid value for the `ApiOptionsFilter` enum.
     * @throws {Error} If the filter is set to a value that is different from the current filter.
     * @returns {ApiOptions} The ApiOptions instance.
     */
    filter( filter = ApiOptionsFilter.NONE ) {
        if (
            ApiOptionsFilter.ALL_CALENDARS !== filter
            && ApiOptionsFilter.GENERAL_ROMAN !== filter
            && ApiOptionsFilter.PATH_BUILDER !== filter
            && ApiOptionsFilter.LOCALE_ONLY !== filter
            && ApiOptionsFilter.YEAR_ONLY !== filter
            && ApiOptionsFilter.NONE !== filter
        ) {
            throw new Error('Invalid filter: ' + filter + ', must be one of `ApiOptionsFilter.ALL_CALENDARS`, `ApiOptionsFilter.GENERAL_ROMAN`, `ApiOptionsFilter.PATH_BUILDER`, `ApiOptionsFilter.LOCALE_ONLY`, `ApiOptionsFilter.YEAR_ONLY`, or `ApiOptionsFilter.NONE`');
        }
        if (
            filter === ApiOptionsFilter.NONE
            && [ApiOptionsFilter.ALL_CALENDARS, ApiOptionsFilter.GENERAL_ROMAN, ApiOptionsFilter.PATH_BUILDER, ApiOptionsFilter.LOCALE_ONLY, ApiOptionsFilter.YEAR_ONLY].includes(this.#filter)
        ) {
            throw new Error('Cannot set filter to `ApiOptionsFilter.NONE` when filter has already been set to a value that is not `ApiOptionsFilter.NONE`');
        }
        if (
            [ApiOptionsFilter.ALL_CALENDARS, ApiOptionsFilter.GENERAL_ROMAN, ApiOptionsFilter.PATH_BUILDER, ApiOptionsFilter.LOCALE_ONLY, ApiOptionsFilter.YEAR_ONLY].includes(filter)
            && this.#filtersSet.includes(ApiOptionsFilter.NONE)
        ) {
            throw new Error('Cannot set filter to a value that is not `ApiOptionsFilter.NONE` when filter has already been set explicitly to `ApiOptionsFilter.NONE`');
        }
        this.#filter = filter;
        this.#filtersSet.push(filter);
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
     * an array of two CalendarSelect instances (one for nations and one for dioceses) to link to the ApiOptions instance.
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
                    throw new Error('ApiOptions.linkToCalendarSelect: Invalid type for items passed in parameter, must be of type `CalendarSelect` but found type: ' + typeof calendarSelect);
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
                throw new Error('ApiOptions.linkToCalendarSelect: Invalid type for parameter, must be of type `CalendarSelect` but found type: ' + typeof calendarSelect);
            }
            if (calendarSelect._filter !== 'none') {
                throw new Error('ApiOptions.linkToCalendarSelect: When linking a single CalendarSelect instance, it must be a `none` filtered CalendarSelect, instead we found: ' + calendarSelect._filter);
            }
            if (calendarSelect._domElement.children.length === 0) {
                throw new Error('ApiOptions.linkToCalendarSelect: You seem to be attempting to link to a CalendarSelect instance that is not fully initialized.');
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
            domNode = Utils.validateElementSelector( elementSelector );
        }
        else if(elementSelector instanceof HTMLElement) {
            domNode = elementSelector;
        } else {
            throw new Error('ApiOptions.appendTo: parameter must be a valid CSS selector or an instance of HTMLElement');
        }
        if (ApiOptionsFilter.PATH_BUILDER === this.#filter) {
            this.#inputs.calendarPathInput.appendTo(domNode);
            this.#inputs.yearInput.appendTo(domNode);
            this.#pathBuilderEnabled = true;
        }
        if (ApiOptionsFilter.LOCALE_ONLY === this.#filter) {
            this.#inputs.localeInput.appendTo(domNode);
        }
        if (ApiOptionsFilter.YEAR_ONLY === this.#filter) {
            this.#inputs.yearInput.appendTo(domNode);
        }
        if (ApiOptionsFilter.NONE === this.#filter || ApiOptionsFilter.ALL_CALENDARS === this.#filter) {
            this.#inputs.localeInput.appendTo(domNode);
            this.#inputs.yearTypeInput.appendTo(domNode);
            if (false === this.#inputs.acceptHeaderInput._hidden) {
                this.#inputs.acceptHeaderInput.appendTo(domNode);
            }
            // If we have implemented a Path builder, it will have already appended the year input,
            // so we shouldn't append it again
            if (false === this.#pathBuilderEnabled) {
                this.#inputs.yearInput.appendTo(domNode);
            }
        }
        if (ApiOptionsFilter.NONE === this.#filter || ApiOptionsFilter.GENERAL_ROMAN === this.#filter) {
            this.#inputs.epiphanyInput.appendTo(domNode);
            this.#inputs.ascensionInput.appendTo(domNode);
            this.#inputs.corpusChristiInput.appendTo(domNode);
            this.#inputs.eternalHighPriestInput.appendTo(domNode);
            this.#inputs.holydaysOfObligationInput.appendTo(domNode);
        }
        // This should only be the case when no filter has been set explicitly via the filter method,
        // and therefore this.#filter = ApiOptionsFilter.NONE
        if (this.#filtersSet.length === 0) {
            this.#filtersSet.push(this.#filter);
        }
    }

    /**
     * Gets the Epiphany input element.
     *
     * @returns {EpiphanyInput} The Epiphany input element.
     * @readonly
     */
    get _epiphanyInput() {
        return this.#inputs.epiphanyInput;
    }

    /**
     * Gets the Ascension input element.
     *
     * @returns {AscensionInput} The Ascension input element.
     * @readonly
     */
    get _ascensionInput() {
        return this.#inputs.ascensionInput;
    }

    /**
     * Gets the Corpus Christi input element.
     *
     * @returns {CorpusChristiInput} The Corpus Christi input element.
     * @readonly
     */
    get _corpusChristiInput() {
        return this.#inputs.corpusChristiInput;
    }

    /**
     * Gets the Eternal High Priest input element.
     *
     * @returns {EternalHighPriestInput} The Eternal High Priest input element.
     * @readonly
     */
    get _eternalHighPriestInput() {
        return this.#inputs.eternalHighPriestInput;
    }

    /**
     * Gets the Holydays of Obligation input element.
     *
     * @returns {HolydaysOfObligationInput} The Holydays of Obligation input element.
     * @readonly
     */
    get _holydaysOfObligationInput() {
        return this.#inputs.holydaysOfObligationInput;
    }

    /**
     * Gets the locale input element.
     *
     * @returns {LocaleInput} The locale input element.
     * @readonly
     */
    get _localeInput() {
        return this.#inputs.localeInput;
    }

    /**
     * Gets the year type input element.
     *
     * @returns {YearTypeInput} The year type input element.
     * @readonly
     */
    get _yearTypeInput() {
        return this.#inputs.yearTypeInput;
    }

    /**
     * Gets the year input element.
     *
     * @returns {YearInput} The year input element.
     * @readonly
     */
    get _yearInput() {
        return this.#inputs.yearInput;
    }

    /**
     * Gets the Accept header input element.
     *
     * @returns {AcceptHeaderInput} The Accept header input element.
     * @readonly
     */
    get _acceptHeaderInput() {
        return this.#inputs.acceptHeaderInput;
    }

    /**
     * Gets the calendar path input element.
     *
     * @returns {CalendarPathInput} The calendar path input element.
     * @readonly
     */
    get _calendarPathInput() {
        return this.#inputs.calendarPathInput;
    }

    /**
     * Gets the CURRENT filter of the ApiOptions instance.
     * The filter can be set explicitly multiple times, and the last set filter will be returned.
     *
     * The filter can be either `ApiOptionsFilter.GENERAL_ROMAN`, `ApiOptionsFilter.ALL_CALENDARS`, `ApiOptionsFilter.PATH_BUILDER`, `ApiOptionsFilter.LOCALE_ONLY`, `ApiOptionsFilter.YEAR_ONLY`, or `ApiOptionsFilter.NONE`.
     * - `ApiOptionsFilter.ALL_CALENDARS` will show only the form controls that are useful for all calendars: locale, yearType, year, and conditionally acceptHeader inputs.
     * - `ApiOptionsFilter.GENERAL_ROMAN` will show only the form controls that are useful for the General Roman Calendar: epiphany, ascension, corpusChristi, and eternalHighPriest inputs.
     * - `ApiOptionsFilter.PATH_BUILDER` will show only the form controls that are useful for the Path Builder: calendarPath and year inputs.
     * - `ApiOptionsFilter.LOCALE_ONLY` will show only the locale input, useful when you only need language selection.
     * - `ApiOptionsFilter.YEAR_ONLY` will show only the year input, useful when used with LiturgyOfAnyDay component.
     * - `ApiOptionsFilter.NONE` will show all possible form controls.
     *
     * @returns {string} The current filter of the ApiOptions instance.
     * @readonly
     */
    get _filter() {
        return this.#filter;
    }

    /**
     * Gets the set of filters that have been applied to the ApiOptions instance.
     *
     * This is a list of filter values that have been set, and may contain multiple
     * entries if filters have been set in succession.
     *
     * @returns {Array<string>} An array of filter values applied to the ApiOptions instance.
     * @readonly
     */
    get _filtersSet() {
        return this.#filtersSet;
    }
}
