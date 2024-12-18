import { AcceptHeaderInput, AscensionInput, CorpusChristiInput, EpiphanyInput, LocaleInput, EternalHighPriestInput, YearTypeInput } from './ApiOptions/Input/index.js';
import { CalendarSelect, LitCalApiClient } from './index.js';

export default class ApiOptions {

    /** @type {boolean} */
    #linked                = false;
    /** @type {?Intl.Locale} */
    #locale                = null;
    /** @type {?EpiphanyInput} */
    epiphanyInput          = null;
    /** @type {?AscensionInput} */
    ascensionInput         = null;
    /** @type {?CorpusChristiInput} */
    corpusChristiInput     = null;
    /** @type {?EternalHighPriestInput} */
    eternalHighPriestInput = null;
    /** @type {?LocaleInput} */
    localeInput            = null;
    /** @type {?YearTypeInput} */
    yearTypeInput          = null;
    /** @type {?AcceptHeaderInput} */
    acceptHeaderInput      = null;

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
        this.epiphanyInput = new EpiphanyInput(this.#locale);
        this.ascensionInput = new AscensionInput(this.#locale);
        this.corpusChristiInput = new CorpusChristiInput(this.#locale);
        this.eternalHighPriestInput = new EternalHighPriestInput(this.#locale);
        this.localeInput = new LocaleInput(this.#locale);
        this.yearTypeInput = new YearTypeInput(this.#locale);
        this.acceptHeaderInput = new AcceptHeaderInput();
    }

    #handleMultipleLinkedCalendarSelects(calendarSelects) {
        const nationSelector = calendarSelect[0]._filter === 'nations' ? calendarSelect[0] : calendarSelect[1];
        const dioceseSelector = calendarSelect[0]._filter === 'dioceses' ? calendarSelect[0] : calendarSelect[1];
        nationSelector._domElement.addEventListener('change', (ev) => {
            // TODO: set selected values based on selected calendar
            // TODO: set available options for locale select based on selected calendar
            if (ev.target.value === '' && dioceseSelector._domElement.value === '') {
                // all API options enabled
                this.epiphanyInput.disabled(false);
                this.ascensionInput.disabled(false);
                this.corpusChristiInput.disabled(false);
                this.eternalHighPriestInput.disabled(false);
            } else {
                // all API options disabled
                this.epiphanyInput.disabled(true);
                this.ascensionInput.disabled(true);
                this.corpusChristiInput.disabled(true);
                this.eternalHighPriestInput.disabled(true);
            }
        });
        dioceseSelector._domElement.addEventListener('change', (ev) => {
            // TODO: set selected values based on selected calendar
            // TODO: set available options for locale select based on selected calendar
            if (ev.target.value === '' && nationSelector._domElement.value === '') {
                // all API options enabled
                this.epiphanyInput.disabled(false);
                this.ascensionInput.disabled(false);
                this.corpusChristiInput.disabled(false);
                this.eternalHighPriestInput.disabled(false);
            } else {
                // all API options disabled
                this.epiphanyInput.disabled(true);
                this.ascensionInput.disabled(true);
                this.corpusChristiInput.disabled(true);
                this.eternalHighPriestInput.disabled(true);
            }
        });
    }

    #handleSingleLinkedCalendarSelect(calendarSelect) {
        let currentSelectedCalendarId = calendarSelect._domElement.value;
        if (currentSelectedCalendarId !== '') {
            let currentSelectedCalendarType = calendarSelect._domElement.querySelector(':checked').getAttribute('data-calendartype');
            switch(currentSelectedCalendarType) {
                case 'national': {
                    const selectedNationalCalendar = LitCalApiClient.metadata.national_calendars.filter(nationCalendarObj => nationCalendarObj.calendar_id === currentSelectedCalendarId)[0];
                    const {settings, locales} = selectedNationalCalendar;
                    Object.entries(settings).forEach(([key, value]) => {
                        // transform the key from snake_case to camelCase
                        key = key.replaceAll('_', ' ');
                        key = key.split(' ').map((word, index) => index === 0 ? word.charAt(0).toLowerCase() + word.slice(1) : word.charAt(0).toUpperCase() + word.slice(1)).join('');
                        if (typeof value === 'boolean') {
                            value = value ? 'true' : 'false';
                        }
                        this[key + 'Input']._domElement.value = value;
                    });
                    this.localeInput.setOptionsForCalendarLocales(locales);
                    break;
                }
                case 'diocesan': {
                    const selectedDiocesanCalendar = LitCalApiClient.metadata.diocesan_calendars.filter(dioceseObj => dioceseObj.calendar_id === currentSelectedCalendarId)[0];
                    const {nation, locales} = selectedDiocesanCalendar;
                    const nationalCalendarForDiocese = LitCalApiClient.metadata.national_calendars.filter(nationCalendarObj => nationCalendarObj.calendar_id === nation)[0];
                    const nationalCalendarForDioceseSettings = nationalCalendarForDiocese.settings;
                    Object.entries(nationalCalendarForDioceseSettings).forEach(([key, value]) => {
                        // transform the key from snake_case to camelCase
                        key = key.replaceAll('_', ' ');
                        key = key.split(' ').map((word, index) => index === 0 ? word.charAt(0).toLowerCase() + word.slice(1) : word.charAt(0).toUpperCase() + word.slice(1)).join('');
                        if (typeof value === 'boolean') {
                            value = value ? 'true' : 'false';
                        }
                        this[key + 'Input']._domElement.value = value;
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
                            this[key + 'Input']._domElement.value = value;
                        });
                    }
                    this.localeInput.setOptionsForCalendarLocales(locales);
                    break;
                }
                default:
                    throw new Error('Unknown calendar type: ' + currentSelectedCalendarType);
            }
            this.epiphanyInput.disabled(true);
            this.ascensionInput.disabled(true);
            this.corpusChristiInput.disabled(true);
            this.eternalHighPriestInput.disabled(true);
        } else {
            this.epiphanyInput.disabled(false);
            this.ascensionInput.disabled(false);
            this.corpusChristiInput.disabled(false);
            this.eternalHighPriestInput.disabled(false);
            this.localeInput.resetOptions();
        }
        calendarSelect._domElement.addEventListener('change', (ev) => {
            // TODO: set selected values based on selected calendar
            // TODO: set available options for locale select based on selected calendar
            if (ev.target.value === '') {
                // all API options enabled
                this.epiphanyInput.disabled(false);
                this.ascensionInput.disabled(false);
                this.corpusChristiInput.disabled(false);
                this.eternalHighPriestInput.disabled(false);
                this.localeInput.resetOptions();
            } else {
                const selectedCalendarType = calendarSelect._domElement.querySelector(':checked').getAttribute('data-calendartype');
                switch(selectedCalendarType) {
                    case 'national': {
                        const selectedNationalCalendar = LitCalApiClient.metadata.national_calendars.filter(nationCalendarObj => nationCalendarObj.calendar_id === ev.target.value)[0];
                        const {settings, locales} = selectedNationalCalendar;
                        Object.entries(settings).forEach(([key, value]) => {
                            // transform the key from snake_case to camelCase
                            key = key.replaceAll('_', ' ');
                            key = key.split(' ').map((word, index) => index === 0 ? word.charAt(0).toLowerCase() + word.slice(1) : word.charAt(0).toUpperCase() + word.slice(1)).join('');
                            if (typeof value === 'boolean') {
                                value = value ? 'true' : 'false';
                            }
                            this[key + 'Input']._domElement.value = value;
                        });
                        this.localeInput.setOptionsForCalendarLocales(locales);
                        break;
                    }
                    case 'diocesan': {
                        const selectedDiocese = LitCalApiClient.metadata.diocesan_calendars.filter(dioceseObj => dioceseObj.calendar_id === ev.target.value)[0];
                        const {nation, locales} = selectedDiocese;
                        const nationalCalendarForDiocese = LitCalApiClient.metadata.national_calendars.filter(nationCalendarObj => nationCalendarObj.calendar_id === nation)[0];
                        const nationalCalendarForDioceseSettings = nationalCalendarForDiocese.settings;
                        Object.entries(nationalCalendarForDioceseSettings).forEach(([key, value]) => {
                            // transform the key from snake_case to camelCase
                            key = key.replaceAll('_', ' ');
                            key = key.split(' ').map((word, index) => index === 0 ? word.charAt(0).toLowerCase() + word.slice(1) : word.charAt(0).toUpperCase() + word.slice(1)).join('');
                            if (typeof value === 'boolean') {
                                value = value ? 'true' : 'false';
                            }
                            this[key + 'Input']._domElement.value = value;
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
                                this[key + 'Input']._domElement.value = value;
                            });
                        }
                        this.localeInput.setOptionsForCalendarLocales(locales);
                        break;
                    }
                }
                // all API options disabled
                this.epiphanyInput.disabled(true);
                this.ascensionInput.disabled(true);
                this.corpusChristiInput.disabled(true);
                this.eternalHighPriestInput.disabled(true);
            }
        });
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
     * Appends input elements to the specified DOM element based on the specified path type.
     *
     * @param {string} elementSelector - The CSS selector for the DOM element to which the input elements will be appended.
     * @param {string|null} [pathType=null] - The type of path to append. If 'basePath', appends
     *      epiphany, ascension, corpusChristi, and eternalHighPriest inputs. If 'allPaths', appends
     *      locale, yearType, and conditionally acceptHeader inputs. If null, appends all inputs.
     */
    appendTo(elementSelector, pathType = null) {
        if (null === pathType || pathType === 'allPaths') {
            this.localeInput.appendTo(elementSelector);
            this.yearTypeInput.appendTo(elementSelector);
            if (false === this.acceptHeaderInput.isHidden()) {
                this.acceptHeaderInput.appendTo(elementSelector);
            }
        }
        if (null === pathType || pathType === 'basePath') {
            this.epiphanyInput.appendTo(elementSelector);
            this.ascensionInput.appendTo(elementSelector);
            this.corpusChristiInput.appendTo(elementSelector);
            this.eternalHighPriestInput.appendTo(elementSelector);
        }
    }
}
