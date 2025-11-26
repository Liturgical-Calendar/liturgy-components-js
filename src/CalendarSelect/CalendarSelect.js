import ApiClient from '../ApiClient/ApiClient.js';
import Messages from '../Messages.js';
import Input from '../ApiOptions/Input/Input.js';
import { CalendarSelectFilter } from '../Enums.js';
import Utils from '../Utils.js';

/**
 * Creates a select menu populated with available liturgical calendars from the Liturgical Calendar API
 *
 * @example
 * const calendarSelect = new CalendarSelect();
 * calendarSelect.appendTo( '#calendar-select' );
 *
 * @example
 * const calendarSelect = new CalendarSelect('it-IT');
 * calendarSelect.allowNull().label({
        class: 'form-label d-block mb-1',
        id: 'liturgicalCalendarSelectItaLabel',
        text: 'Seleziona calendario'
    }).wrapper({
        class: 'form-group col col-md-3',
        id: 'liturgicalCalendarSelectItaWrapper'
    }).id('liturgicalCalendarSelectEng').class('form-select').replace( '#calendar-select' );
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 * @see https://github.com/Liturgical-Calendar/liturgy-components-js
 */
export default class CalendarSelect {
    static #metadata                    = null;
    static #nationalCalendars             = [];
    static #diocesanCalendars             = [];
    static #nationalCalendarsWithDioceses = [];
    #nationOptions                        = [];
    #dioceseOptions                       = {};
    #dioceseOptionsGrouped                = [];
    #countryNames                         = null;
    #locale                               = 'en';
    #filter                               = CalendarSelectFilter.NONE;
    #domElement                           = null;
    #afterElement                         = null;
    #hasAfter                             = false;
    #afterSet                             = false;
    #labelElement                         = null;
    #hasLabel                             = false;
    #labelSet                             = false;
    #wrapperElement                       = null;
    #hasWrapper                           = false;
    #wrapperSet                           = false;
    #filterSet                            = false;
    #linked                               = false;
    #idSet                                = false;
    #nameSet                              = false;
    #allowNull                            = false;


    /**
     * Returns true if we have already stored a national calendar with dioceses for the given nation,
     * that is when diocesan calendars belong to the same national calendar, and false otherwise.
     *
     * @param {string} nation - The nation to check.
     * @returns {boolean} True if we have stored a national calendar with dioceses for the given nation, false otherwise.
     * @private
     * @static
     */
    static #hasNationalCalendarWithDioceses( nation ) {
        return CalendarSelect.#nationalCalendarsWithDioceses.filter(item => item?.calendar_id === nation).length > 0;
    }

    /**
     * Adds a national calendar with dioceses for the given nation.
     *
     * This internal method is used to add a national calendar with dioceses to the list of national calendars with dioceses.
     * This will also initialize diocese select options for the given nation.
     *
     * @param {string} nation - The nation for which we should add the national calendar.
     * @private
     * @static
     */
    static #addNationalCalendarWithDioceses( nation ) {
        const nationalCalendar = CalendarSelect.#nationalCalendars.find(item => item.calendar_id === nation);
        CalendarSelect.#nationalCalendarsWithDioceses.push( nationalCalendar );
    }

    /**
     * Initializes the CalendarSelect class.
     *
     * This method initializes the CalendarSelect class by storing the metadata obtained from the ApiClient
     * class in a private class property. This method must be called before any CalendarSelect instances are created.
     * If the ApiClient class has not been initialized, or failed to initialize, an error will be thrown.
     *
     * @throws {Error} If the ApiClient class has not been initialized.
     * @throws {Error} If the ApiClient class failed to initialize.
     * @throws {Error} If the ApiClient class initialized with an invalid object.
     * @throws {Error} If the ApiClient class initialized with an object that does not contain the expected properties.
     * @static
     * @private
     */
    static #init() {
        if ( null === ApiClient._metadata ) {
            throw new Error('ApiClient has not been initialized. Please initialize with `ApiClient.init().then(() => { ... })`, and handle the CalendarSelect instances within the callback.');
        } else {
            if (ApiClient._metadata === false) {
                throw new Error('The ApiClient class was unable to initialize.');
            }
            if (typeof ApiClient._metadata !== 'object') {
                throw new Error('The ApiClient class was unable to initialize: expected object, found ' + typeof ApiClient._metadata + '.');
            }
            if (false === ApiClient._metadata.hasOwnProperty('national_calendars') || false === ApiClient._metadata.hasOwnProperty('diocesan_calendars')) {
                throw new Error('The ApiClient class was unable to initialize: expected object with `national_calendars` and `diocesan_calendars` properties.');
            }
            CalendarSelect.#metadata = ApiClient._metadata;
            CalendarSelect.#nationalCalendars =  CalendarSelect.#metadata.national_calendars;
            CalendarSelect.#diocesanCalendars = CalendarSelect.#metadata.diocesan_calendars;
        }
    }

    /**
     * Constructor for the CalendarSelect class.
     *
     * @param {Object|string} [options] - The options object or locale string. An options object can have the following properties:
     *                                  - `locale`: The locale to use for the `CalendarSelect` UI elements.
     *                                  - `id`: The ID of the `CalendarSelect` DOM input.
     *                                  - `class`: The class name for the `CalendarSelect` DOM input.
     *                                  - `name`: The name for the `CalendarSelect` DOM input.
     *                                  - `filter`: The `CalendarSelectFilter` to apply to the `CalendarSelect` component.
     *                                  - `after`: an html string to append after the `CalendarSelect` element.
     *                                  - `allowNull`: a boolean to indicate whether the `CalendarSelect` element should allow `null` values.
     *                                  - `disabled`: a boolean to indicate whether the `CalendarSelect` DOM input element should be disabled.
     *                                  - `label`: The label for the `CalendarSelect` DOM input (an object with a `text` property, and optionally `class` and `id` properties).
     *                                  - `wrapper`: The wrapper for the `CalendarSelect` component (an object with an `as` property, and optionally `class` and `id` properties).
     *                                  If a string is passed, it is expected to be the locale code to use for the `CalendarSelect` UI elements.
     *                                  The locale should be a valid ISO 639-1 code that can be parsed by the Intl.getCanonicalLocales function.
     *                                  If the locale string contains an underscore, the underscore will be replaced with a hyphen.
     *
     * @throws {Error} If the locale is invalid.
     */
    constructor(options) {
        if (typeof options === 'string') {
            options = { locale: options };
        }
        else if (null === options || typeof options === 'undefined') {
            options = { locale: 'en' };
        }
        else if (typeof options !== 'object' || Array.isArray(options)) {
            const optionsType = Array.isArray(options) ? 'array' : typeof options;
            throw new Error('Invalid type for options, must be of type `object` but found type: ' + optionsType);
        }
        const { locale: inputLocale, id, name, filter, after, label, wrapper, allowNull, disabled } = options;
        if (inputLocale !== undefined && inputLocale !== null) {
            if (typeof inputLocale !== 'string') {
                throw new Error('Invalid type for locale, must be of type `string` but found type: ' + typeof inputLocale);
            }
            let locale = inputLocale;
            if (locale.includes('_')) {
                locale = locale.replaceAll('_', '-');
            }
            try {
                const canonicalLocales = Intl.getCanonicalLocales(locale);
                if (canonicalLocales.length === 0) {
                    throw new Error('Invalid locale: ' + locale);
                }
                this.#locale = canonicalLocales[0];
                this.#countryNames = new Intl.DisplayNames( [ this.#locale ], { type: 'region' } );
            } catch (e) {
                throw new Error('Invalid locale: ' + locale);
            }
        } else {
            this.#locale = 'en';
            this.#countryNames = new Intl.DisplayNames( [ this.#locale ], { type: 'region' } );
        }

        if (null === CalendarSelect.#metadata) {
            CalendarSelect.#init();
        }
        this.#buildAllOptions();
        this.#domElement = document.createElement('select');

        if (options.hasOwnProperty('class')) {
            this.class(options.class);
        }
        if (id) {
            this.id(id);
        }
        if (name) {
            this.name(name);
        }
        if (filter) {
            this.filter(filter);
        } else {
            this.filter(this.#filter);
        }
        if (after) {
            this.after(after);
        }
        if (label) {
            this.label(label);
        }
        if (wrapper) {
            this.wrapper(wrapper);
        }
        if (allowNull) {
            this.allowNull(allowNull);
        }
        if (disabled) {
            this.disabled(disabled);
        }
    }

    /**
     * Filters and updates the diocese options for the specified nation.
     *
     * If the nation has no associated diocese options, the select element will display a placeholder option.
     * Otherwise, it populates the select element with the diocese options for the specified nation.
     *
     * @param {string} nation - The nation for which to filter diocese options.
     * @private
     */
    #filterDioceseOptionsForNation(nation) {
        if (false === this.#dioceseOptions.hasOwnProperty(nation)) {
            this.#domElement.innerHTML = '<option value="">---</option>';
        } else {
            const firstElement = this.#allowNull ? '<option value="">---</option>' : '';
            this.#domElement.innerHTML = firstElement + this.#dioceseOptions[nation].join('');
        }
    }

    /**
     * Adds an option for a national calendar to the select element.
     *
     * @param {Object} nationalCalendar - The national calendar object containing calendar information.
     * @param {boolean} [selected=false] - Indicates if the option should be selected by default.
     * @private
     */
    #addNationOption(nationalCalendar, selected = false) {
        const option = `<option data-calendartype="national" value="${nationalCalendar.calendar_id}"${selected ? ' selected' : ''}>${this.#countryNames.of(nationalCalendar.calendar_id)}</option>`;
        this.#nationOptions.push( option );
    }

    /**
     * Adds a select option for a diocesan calendar to the list of diocese options for the given nation.
     *
     * @param {Object} item - The diocesan calendar object containing calendar information.
     * @param {string} item.calendar_id - The ID for the calendar (corresponding to the unique id of the diocese).
     * @param {string} item.nation - The nation that the diocesan calendar belongs to.
     * @param {string} item.diocese - The name of the diocese.
     * @private
     */
    #addDioceseOption(item) {
        const option = `<option data-calendartype="diocesan" value="${item.calendar_id}">${item.diocese}</option>`;
        this.#dioceseOptions[item.nation].push(option);
    }

    /**
     * Builds all options for the calendar select element.
     *
     * This method builds the options for the calendar select element by iterating over the diocesan calendars,
     * adding options for each diocesan calendar, and adding options for each national calendar.
     *
     * @private
     */
    #buildAllOptions() {
        CalendarSelect.#diocesanCalendars.forEach( diocesanCalendarObj => {
            if ( false === CalendarSelect.#hasNationalCalendarWithDioceses( diocesanCalendarObj.nation ) ) {
                // we add all nations with dioceses to the nations list
                CalendarSelect.#addNationalCalendarWithDioceses( diocesanCalendarObj.nation );
            }
            if ( false === this.#dioceseOptions.hasOwnProperty( diocesanCalendarObj.nation ) ) {
                this.#dioceseOptions[ diocesanCalendarObj.nation ] = [];
            }
            this.#addDioceseOption( diocesanCalendarObj );
        } );

        CalendarSelect.#nationalCalendars.sort( ( a, b ) => this.#countryNames.of( a.calendar_id ).localeCompare( this.#countryNames.of( b.calendar_id ) ) );
        CalendarSelect.#nationalCalendars.forEach( nationalCalendar => {
            if ( false === CalendarSelect.#hasNationalCalendarWithDioceses( nationalCalendar.calendar_id ) ) {
                // This is the first time we call CalendarSelect.#addNationOption().
                // This will ensure that the VATICAN (a nation without any diocese) will be added as the first option.
                // In theory any other nation for whom no dioceses are defined will be added here too,
                // so we will ensure that the VATICAN is always the default selected option
                if ( 'VA' === nationalCalendar.calendar_id ) {
                    this.#addNationOption( nationalCalendar, true );
                } else {
                    this.#addNationOption( nationalCalendar );
                }
            }
        } );

        // now we can add the options for the nations in the #calendarNationsWithDiocese list
        // that is to say, nations that have dioceses
        CalendarSelect.#nationalCalendarsWithDioceses.sort( ( a, b ) => this.#countryNames.of( a.calendar_id ).localeCompare( this.#countryNames.of( b.calendar_id ) ) );
        CalendarSelect.#nationalCalendarsWithDioceses.forEach( nationalCalendar => {
            this.#addNationOption( nationalCalendar );
            let optGroup = `<optgroup label="${this.#countryNames.of( nationalCalendar.calendar_id )}">${this.#dioceseOptions[ nationalCalendar.calendar_id ].join( '' )}</optgroup>`;
            this.#dioceseOptionsGrouped.push( optGroup );
        } );
        return this;
    }

    /**
     * Retrieves the HTML string for the nation options.
     *
     * This getter method concatenates all the nation options into a single HTML string,
     * which can be used to populate a select element with nation options.
     *
     * @returns {string} A concatenated string of all nation options in HTML format.
     */
    get nationsInnerHtml() {
        return this.#nationOptions.join( '' );
    }

    /**
     * Retrieves the HTML string for the diocese options grouped by nation.
     *
     * This getter method concatenates all the diocese options grouped by nation into a single HTML string,
     * which can be used to populate a select element with diocese options for each nation.
     *
     * @returns {string} A concatenated string of all diocese options grouped by nation in HTML format.
     */
    get diocesesInnerHtml() {
        return this.#dioceseOptionsGrouped.join( '' );
    }

    /**
     * Sets the filter for the select element.
     *
     * The filter can be either `CalendarSelectFilter.NATIONAL_CALENDARS`, `CalendarSelectFilter.DIOCESAN_CALENDARS`, or `CalendarSelectFilter.NONE`.
     * - `CalendarSelectFilter.NATIONAL_CALENDARS` will show only the nation options.
     * - `CalendarSelectFilter.DIOCESAN_CALENDARS` will show only the diocese options grouped by nation.
     * - `CalendarSelectFilter.NONE` will show all options, that is, for all calendars whether national or diocesan.
     *
     * If the filter is set to a value that is not a valid value for the `CalendarSelectFilter` enum,
     * an error will be thrown.
     *
     * If the filter is set to a value that is different from the current filter,
     * the innerHTML of the select element will be updated accordingly, and will not be able to be set again.
     *
     * @param {string} [filter=CalendarSelectFilter.NONE] The filter to set.
     * @returns {this}
     */
    filter( filter = CalendarSelectFilter.NONE ) {
        if ( this.#filterSet && this.#filter !== filter ) {
            throw new Error('Filter has already been set to `' + this.#filter + '` on CalendarSelect instance with locale ' + this.#locale + '.');
        }
        if ( CalendarSelectFilter.NATIONAL_CALENDARS !== filter && CalendarSelectFilter.DIOCESAN_CALENDARS !== filter && CalendarSelectFilter.NONE !== filter ) {
            throw new Error('Invalid filter: ' + filter);
        }
        this.#filter = filter;
        const firstElement = this.#allowNull ? '<option value="">---</option>' : '';
        if ( this.#filter === CalendarSelectFilter.NATIONAL_CALENDARS ) {
            this.#domElement.innerHTML = firstElement + this.nationsInnerHtml;
        } else if ( this.#filter === CalendarSelectFilter.DIOCESAN_CALENDARS ) {
            this.#domElement.innerHTML = firstElement + this.diocesesInnerHtml;
        } else {
            this.#domElement.innerHTML = firstElement + this.nationsInnerHtml + this.diocesesInnerHtml;
        }
        if ( filter !== this.#filter ) {
            this.#filterSet = true;
        }
        return this;
    }

    /**
     * Sets the class attribute for the CalendarSelect instance's DOM element.
     *
     * Validates the input class name(s) to ensure they are strings and conform to
     * CSS class naming conventions. If the class name is valid, it is sanitized
     * and assigned to the element. If the class name is an empty string, the
     * class attribute is removed.
     *
     * @param {string} className - A space-separated string of class names to be assigned to the DOM element.
     * @throws {Error} If the className is not a string, or if any class name is invalid.
     * @returns {CalendarSelect} The current `CalendarSelect` instance for chaining.
     */
    class( className ) {
        if ( typeof className !== 'string' ) {
            throw new Error('Invalid type for class name on CalendarSelect instance with locale ' + this.#locale + ', must be of type string but found type: ' + typeof className);
        }
        let classNames = className.split( /\s+/ );
        classNames = classNames.map( className => Utils.sanitizeInput( className ) );
        classNames.forEach(className => {
            if ( false === Utils.validateClassName( className ) ) {
                throw new Error('Invalid class name: ' + className);
            }
        });
        className = classNames.join( ' ' );
        if ( className === '' ) {
            this.#domElement.removeAttribute( 'class' );
        } else {
            this.#domElement.setAttribute( 'class', className );
        }
        return this;
    }

    /**
     * Sets the `id` attribute of the select element.
     *
     * Validates the input id to ensure it is a string and conforms to
     * HTML id attribute naming conventions. If the id is valid, it is sanitized
     * and assigned to the element. If the id is an empty string, the
     * id attribute is removed.
     *
     * If the id has already been set, an error will be thrown.
     *
     * If the label has already been set, the for attribute of the label element
     * will be updated to match the new id.
     *
     * @param {string} id The id attribute of the select element.
     * @throws {Error} If the id is not a string, or if the id is invalid.
     * @returns {CalendarSelect} The current CalendarSelect instance for chaining.
     */
    id( id ) {
        if ( this.#idSet && this.#domElement.id !== id ) {
            throw new Error('ID has already been set to `' + this.#domElement.id + '` on CalendarSelect instance with locale ' + this.#locale + '.');
        }
        if ( typeof id !== 'string' ) {
            throw new Error('Invalid type for id, must be of type string but found type: ' + typeof id);
        }
        id = Utils.sanitizeInput( id );
        if (Utils.validateId( id ) === false) {
            throw new Error('Invalid id, cannot contain any kind of whitespace character: ' + id);
        }
        this.#domElement.id = id;
        if (this.#hasLabel) {
            this.#labelElement.setAttribute( 'for', this.#domElement.id );
            if (this.#labelElement.hasAttribute( 'id' )) {
                this.#domElement.setAttribute( 'aria-labelledby', this.#labelElement.id );
            }
        }
        this.#idSet = true;
        return this;
    }

    /**
     * Sets the `name` attribute of the select element.
     *
     * Validates the input name to ensure it is a string. If the name is valid,
     * it is sanitized and assigned to the element. If the name is an empty
     * string, the name attribute is removed.
     *
     * If the name has already been set, an error will be thrown.
     *
     * @param {string} name The name attribute of the select element.
     * @throws {Error} If the name is not a string, or if the name has already been set.
     * @returns {CalendarSelect} The current CalendarSelect instance for chaining.
     */
    name( name ) {
        if ( this.#nameSet && this.#domElement.name !== name ) {
            throw new Error('Name has already been set to `' + this.#domElement.name + '` on CalendarSelect instance with locale ' + this.#locale + '.');
        }
        if ( typeof name !== 'string' ) {
            throw new Error('Invalid type for name, must be of type string but found type: ' + typeof name);
        }
        this.#domElement.name = name;
        this.#nameSet = true;
        return this;
    }

    /**
     * Configures the `label` element for the `CalendarSelect` DOM input.
     *
     * If label options are not provided, the label will not be created and
     * any existing label will be removed. If an object is provided, it
     * can specify label attributes such as class, id, and text. The method
     * validates the options and sets the label accordingly.
     *
     * @param {Object|null} labelOptions An object specifying label options or null to disable the label.
     * @param {string} [labelOptions.class] CSS classes to apply to the label element.
     * @param {string} [labelOptions.id] The id attribute for the label element.
     * @param {string} [labelOptions.text] The text content for the label element.
     *
     * @throws {Error} If the label options are not an object, or if the class, id, or text are not valid strings.
     *
     * @returns {CalendarSelect} The current CalendarSelect instance for chaining.
     */
    label( labelOptions = null ) {
        if ( this.#labelSet ) {
            throw new Error('Label has already been set on CalendarSelect instance with locale ' + this.#locale + '.');
        }
        if ( null === labelOptions ) {
            this.#hasLabel = false;
            this.#labelElement = null;
            this.#domElement.removeAttribute( 'aria-labelledby' );
            this.#labelSet = true;
            return this;
        }
        else if ( typeof labelOptions !== 'object' || Array.isArray(labelOptions) ) {
            const labelOptionsType = Array.isArray(labelOptions) ? 'array' : typeof labelOptions;
            throw new Error('Invalid type for label options, must be of type object (not null or array) but found type: ' + labelOptionsType);
        }
        else if ( Object.keys( labelOptions ).length === 0 || false === Object.keys( labelOptions ).some( key => ['class', 'id', 'text'].includes( key ) ) ) {
            throw new Error('Invalid label options, must be an object with at least a `text`, `class` or `id` property');
        }

        this.#labelElement = document.createElement( 'label' );
        this.#hasLabel = true;
        this.#labelSet = true;

        if ( this.#domElement.hasAttribute( 'id' ) ) {
            this.#labelElement.setAttribute( 'for', this.#domElement.id );
        }

        if ( labelOptions.hasOwnProperty( 'class') ) {
            if ( typeof labelOptions.class !== 'string' ) {
                throw new Error('Invalid type for label class, must be of type string but found type: ' + typeof labelOptions.class);
            }
            let classNames = labelOptions.class.split( /\s+/ );
            classNames = classNames.map( className => Utils.sanitizeInput( className ) );
            classNames.forEach(className => {
                if ( false === Utils.validateClassName( className ) ) {
                    throw new Error('Invalid class name: ' + className);
                }
            });
            labelOptions.class = classNames.join( ' ' );
            this.#labelElement.className = labelOptions.class;
        }

        if (labelOptions.hasOwnProperty('id')) {
            if (typeof labelOptions.id !== 'string') {
                throw new Error('Invalid type for label id, must be of type string but found type: ' + typeof labelOptions.id);
            }
            labelOptions.id = Utils.sanitizeInput( labelOptions.id );
            if (false === Utils.validateId( labelOptions.id )) {
                throw new Error('Invalid id, cannot contain any kind of whitespace character and must be a valid CSS selector: ' + labelOptions.id);
            }
            this.#labelElement.id = labelOptions.id;
            this.#domElement.setAttribute( 'aria-labelledby', this.#labelElement.id );
        }

        if ( labelOptions.hasOwnProperty( 'text' ) ) {
            if ( typeof labelOptions.text !== 'string' ) {
                throw new Error('Invalid type for label text, must be of type string but found type: ' + typeof labelOptions.text);
            }
            labelOptions.text = Utils.sanitizeInput( labelOptions.text );
            this.#labelElement.textContent = labelOptions.text;
        } else {
            const locale = new Intl.Locale( this.#locale );
            this.#labelElement.textContent = Messages[locale.language]['SELECT_A_CALENDAR'];
        }

        /*
        if ( labelOptions.hasOwnProperty( 'after' ) ) {
            if ( typeof labelOptions.after !== 'string' ) {
                throw new Error('Invalid type for label after, must be of type string but found type: ' + typeof labelOptions.after);
            }
        }
        */
        return this;
    }

    /**
     * Sets the wrapper element for the calendar select element.
     *
     * The wrapper element is an HTML element that will wrap the select element.
     * The wrapper element can be an HTML element of type `div` or `td`.
     *
     * If the `wrapperOptions` argument is not provided, the wrapper element will be set to `null`.
     * If the `wrapperOptions` argument is provided but is not an object, an error will be thrown.
     *
     * The `wrapperOptions` object can contain the following properties:
     * - `as`: The type of HTML element to use as the wrapper element.
     *   Must be one of `div` or `td`.
     *   If not provided, defaults to `div`.
     * - `class`: The class attribute for the wrapper element.
     *   If not provided, no class will be set.
     * - `id`: The id attribute for the wrapper element.
     *   If not provided, no id will be set.
     *
     * @param {object|null} [wrapperOptions=null]
     * @returns {CalendarSelect}
     * @throws {Error} If the `wrapperOptions` argument is not an object or is an array.
     * @throws {Error} If the `wrapperOptions.as` property is not a string.
     * @throws {Error} If the `wrapperOptions.as` property is not one of `div` or `td`.
     * @throws {Error} If the `wrapperOptions.class` property is not a string.
     * @throws {Error} If the `wrapperOptions.id` property is not a string.
     * @throws {Error} If the `wrapperOptions.id` property is not a valid CSS selector.
     */
    wrapper( wrapperOptions = null ) {
        if ( this.#wrapperSet ) {
            throw new Error('Wrapper has already been set on CalendarSelect instance with locale ' + this.#locale + '.');
        }
        if ( null === wrapperOptions ) {
            this.#hasWrapper = false;
            this.#wrapperElement = null;
            this.#wrapperSet = true;
            return this;
        }
        else if ( typeof wrapperOptions !== 'object' || Array.isArray(wrapperOptions) ) {
            const wrapperOptionsType = Array.isArray(wrapperOptions) ? 'array' : typeof wrapperOptions;
            throw new Error('Invalid type for wrapper options, must be of type object (not null or array) but found type: ' + wrapperOptionsType);
        }
        else if ( Object.keys( wrapperOptions ).length === 0 || false === Object.keys( wrapperOptions ).some( key => ['as', 'class', 'id'].includes( key ) ) ) {
            throw new Error('Invalid wrapper options, must be an object with at least an `as`, `class` or `id` property');
        }

        if (wrapperOptions.hasOwnProperty('as')) {
            if (typeof wrapperOptions.as !== 'string') {
                throw new Error('Invalid type for wrapper `as` property, must be of type string but found type: ' + typeof wrapperOptions.as);
            }
            if (false === ['div', 'td'].includes(wrapperOptions.as)) {
                throw new Error('Invalid value for wrapper `as` property, must be one of `div` or `td` but found: ' + wrapperOptions.as);
            }
        } else {
            wrapperOptions.as = 'div';
        }

        this.#wrapperElement = document.createElement( wrapperOptions.as );
        this.#hasWrapper = true;
        this.#wrapperSet = true;

        if ( wrapperOptions.hasOwnProperty( 'class' ) ) {
            if ( typeof wrapperOptions.class !== 'string' ) {
                throw new Error('Invalid type for wrapper class, must be of type string but found type: ' + typeof wrapperOptions.class);
            }
            let classNames = wrapperOptions.class.split( /\s+/ );
            classNames = classNames.map( className => Utils.sanitizeInput( className ) );
            classNames.forEach(className => {
                if ( false === Utils.validateClassName( className ) ) {
                    throw new Error('Invalid class name: ' + className);
                }
            });
            wrapperOptions.class = classNames.join( ' ' );
            this.#wrapperElement.className = wrapperOptions.class;
        }

        if ( wrapperOptions.hasOwnProperty( 'id' ) ) {
            if ( typeof wrapperOptions.id !== 'string' ) {
                throw new Error('Invalid type for wrapper id, must be of type string but found type: ' + typeof wrapperOptions.id);
            }
            wrapperOptions.id = Utils.sanitizeInput( wrapperOptions.id );
            if (false === Utils.validateId( wrapperOptions.id )) {
                throw new Error('Invalid id, cannot contain any kind of whitespace character and must be a valid CSS selector: ' + wrapperOptions.id);
            }
            this.#wrapperElement.id = wrapperOptions.id;
        }
        return this;
    }

    /**
     * Sets content to be inserted after the current element.
     *
     * This method allows appending content after the current element by creating
     * a DocumentFragment from the provided content string. The content string is
     * sanitized to remove PHP and script tags for security purposes. If no content
     * is provided (null), it removes any previously set content. Throws an error
     * if the method is called more than once since the content can only be set once.
     *
     * @param {string|null} contents - The content to be set after the current element.
     *                                 If null, any existing content is cleared.
     * @throws {Error} If content is attempted to be set more than once.
     * @returns {CalendarSelect} The current instance for method chaining.
     */
    after( contents = null ) {
        if ( this.#afterSet ) {
            throw new Error('After has already been set.');
        }
        if ( null === contents ) {
            this.#hasAfter = false;
            this.#afterElement = null;
            this.#afterSet = true;
            return this;
        }

        // remove php tags and script tags from contents
        // the regex is doing the following:
        //  - `<\?(?:php)?` matches the start of a php tag, optionally with the word "php" after the "?"
        //  - `|` is a logical OR operator
        //  - `\?>` matches the end of a php tag
        //  - `|` is a logical OR operator
        //  - `<script(.*?)>.*?<\/script>` matches the start of a script tag, any attributes, the contents of the script tag, and the end of the script tag
        //  - `g` flag makes the regex replacement global, so it will replace all occurrences of the regex, not just the first one
        contents = contents.replace(/<\?(?:php)?|\?>|<script(.*?)>.*?<\/script>/g, '');


        const fragment = document.createRange().createContextualFragment(contents);
        this.#afterElement = fragment;
        this.#hasAfter = true;
        this.#afterSet = true;

        return this;
    }

    /**
     * Set whether the select element should include an empty option as the first option.
     *
     * If set to true, the select element will include an empty option as the first option.
     * This can be useful when you want to allow the user to select no option.
     * This also represents a value of "General Roman Calendar" for the API,
     * since no national or diocesan calendar is selected.
     * Selecting this empty value will enable the ApiOptions that can be set for the General Roman Calendar,
     * but not for national or diocesan calendars, when an ApiOptions instance is listening to the current WebCalendar instance.
     *
     * If set to false, the select element will not include an empty option as the first option.
     *
     * If not provided, defaults to true.
     *
     * @param {boolean} [allowNull=true] - Whether the select element should include an empty option as the first option.
     * @returns {CalendarSelect} The current instance for method chaining.
     * @throws {Error} If allowNull has already been set on the CalendarSelect instance.
     * @throws {Error} If the type of allowNull is not a boolean.
     */
    allowNull( allowNull = true ) {
        if ( typeof allowNull !== 'boolean' ) {
            throw new Error('Invalid type for allowNull on CalendarSelect instance with locale ' + this.#locale + ', must be of type boolean but found type: ' + typeof allowNull);
        }
        this.#allowNull = allowNull;
        this.filter( this.#filter );
        return this;
    }

    /**
     * Sets the disabled property on the select element.
     *
     * If set to true, the select element will be disabled and the user will not be able to interact with it.
     * If set to false, the select element will be enabled and the user will be able to interact with it.
     *
     * If not provided, defaults to true.
     *
     * @param {boolean} [disabled=true] - Whether the select element should be disabled.
     * @returns {CalendarSelect} The current instance for method chaining.
     * @throws {Error} If the type of disabled is not a boolean.
     */
    disabled( disabled = true ) {
        if (typeof disabled !== 'boolean') {
            throw new Error('Invalid type for disabled, must be of type boolean but found type: ' + typeof disabled);
        }
        this.#domElement.disabled = disabled;
        return this;
    }

    /**
     * Replaces the element matched by the provided element selector with the select element.
     *
     * If a wrapper element has been set, the wrapper element is used to replace the element,
     * and the select element is appended to the wrapper element.
     * If a label element has been set, the label element is inserted before the select element.
     * If an after element has been set, the after element is inserted after the select element.
     *
     * @param {string|HTMLElement} element - The element or elector of the element to be replaced.
     * @throws {Error} If the type of element is not a string.
     * @throws {Error} If the element selector is invalid.
     */
    replace( element ) {
        let domNode;
        if (typeof element === 'string') {
            domNode = Utils.validateElementSelector( element );
        }
        else if (element instanceof HTMLElement) {
            domNode = element;
        } else {
            throw new Error('CalendarSelect.replace: parameter must be a valid CSS selector or an instance of HTMLElement');
        }
        if ( this.#hasWrapper ) {
            domNode.replaceWith( this.#wrapperElement );
            this.#wrapperElement.appendChild( this.#domElement );
        } else {
            domNode.replaceWith( this.#domElement );
        }
        if ( this.#hasLabel ) {
            this.#domElement.insertAdjacentElement( 'beforebegin', this.#labelElement );
        }
        if ( this.#hasAfter ) {
            if (this.#domElement.parentNode) {
                this.#domElement.parentNode.insertBefore( this.#afterElement, this.#domElement.nextSibling );
            }
        }
    }

    /**
     * Appends the select element to the element matched by the provided element selector (or the element provided directly).
     *
     * If a wrapper element has been set, the wrapper element is used to append the select element,
     * and the select element is appended to the wrapper element.
     * If a label element has been set, the label element is inserted before the select element.
     * If an after element has been set, the after element is inserted after the select element.
     *
     * @param {string|HTMLElement} element - The element selector of the element to append the select element to.
     * @throws {Error} If the type of element is not a string.
     * @throws {Error} If the element selector is invalid.
     */
    appendTo( element ) {
        let domNode;
        if (typeof element === 'string') {
            domNode = Utils.validateElementSelector( element );
        }
        else if (element instanceof HTMLElement) {
            domNode = element;
        } else {
            throw new Error('CalendarSelect.appendTo: parameter must be a valid CSS selector or an instance of HTMLElement');
        }
        if ( this.#hasWrapper ) {
            domNode.appendChild( this.#wrapperElement );
            this.#wrapperElement.appendChild( this.#domElement );
        } else {
            domNode.appendChild( this.#domElement );
        }
        if ( this.#hasLabel ) {
            this.#domElement.insertAdjacentElement( 'beforebegin', this.#labelElement );
        }
        if ( this.#hasAfter ) {
            if (this.#domElement.parentNode) {
                this.#domElement.parentNode.insertBefore( this.#afterElement, this.#domElement.nextSibling );
            }
        }
    }

    /**
     * Inserts the select element before the element matched by the provided element selector (or the element provided directly).
     *
     * If a wrapper element has been set, the wrapper element is used to insert the select element,
     * and the select element is appended to the wrapper element.
     * If a label element has been set, the label element is inserted before the select element.
     * If an after element has been set, the after element is inserted after the select element.
     *
     * @param {string|HTMLElement|Input} element - The element selector of the element to insert the select element before.
     * @throws {Error} If the type of element is not a string.
     * @throws {Error} If the element selector is invalid.
     */
    insertBefore( element ) {
        let domNode;
        if (typeof element === 'string') {
            domNode = Utils.validateElementSelector( element );
        }
        else if (element instanceof HTMLElement) {
            domNode = element;
        }
        else if (element instanceof Input) {
            if (element._hasWrapper) {
                domNode = element._wrapperElement;
            } else {
                domNode = element._domElement;
            }
        }
        else {
            throw new Error('CalendarSelect.insertBefore: parameter must be a valid CSS selector or an instance of HTMLElement');
        }
        if ( this.#hasWrapper ) {
            domNode.insertAdjacentElement( 'beforebegin', this.#wrapperElement );
            this.#wrapperElement.appendChild( this.#domElement );
        } else {
            domNode.insertAdjacentElement( 'beforebegin', this.#domElement );
        }
        if ( this.#hasLabel ) {
            this.#domElement.insertAdjacentElement( 'beforebegin', this.#labelElement );
        }
        if ( this.#hasAfter ) {
            if (this.#domElement.parentNode) {
                this.#domElement.parentNode.insertBefore( this.#afterElement, this.#domElement.nextSibling );
            }
        }
    }

    /**
     * Inserts the select element after the element matched by the provided element selector (or the element provided directly).
     *
     * If a wrapper element has been set, the wrapper element is used to insert the select element,
     * and the select element is appended to the wrapper element.
     * If a label element has been set, the label element is inserted before the select element.
     * If an after element has been set, the after element is inserted after the select element.
     *
     * @param {string|HTMLElement|Input} element - The element selector of the element to insert the select element after.
     * @throws {Error} If the type of element is not a string.
     * @throws {Error} If the element selector is invalid.
     */
    insertAfter( element ) {
        let domNode;
        if (typeof element === 'string') {
            //console.log(`element is a CSS selector: ${element}`);
            domNode = Utils.validateElementSelector( element );
        }
        else if (element instanceof HTMLElement) {
            //console.log(`element is an HTMLElement:`, element);
            domNode = element;
        }
        else if (element instanceof Input) {
            //console.log(`element is an ApiOptions Input:`, element);
            if (element._hasWrapper) {
                //console.log(`element has a wrapper element:`, element._wrapperElement);
                domNode = element._wrapperElement;
            } else {
                domNode = element._domElement;
            }
        }
        else {
            throw new Error('CalendarSelect.insertAfter: parameter must be a valid CSS selector or an instance of HTMLElement');
        }
        //console.log(`domNode:`, domNode);

        if ( this.#hasWrapper ) {
            domNode.insertAdjacentElement( 'afterend', this.#wrapperElement );
            this.#wrapperElement.appendChild( this.#domElement );
        } else {
            domNode.insertAdjacentElement( 'afterend', this.#domElement );
        }
        if ( this.#hasLabel ) {
            this.#domElement.insertAdjacentElement( 'beforebegin', this.#labelElement );
        }
        if ( this.#hasAfter ) {
            if (this.#domElement.parentNode) {
                this.#domElement.parentNode.insertBefore( this.#afterElement, this.#domElement.nextSibling );
            }
        }
    }

    /**
     * Gets the underlying DOM element of the CalendarSelect instance.
     *
     * @returns {HTMLElement} The underlying DOM element of the CalendarSelect instance.
     * @readonly
     */
    get _domElement() {
        return this.#domElement;
    }

    /**
     * Gets the current filter of the CalendarSelect instance.
     *
     * The filter can be either `CalendarSelectFilter.NATIONAL_CALENDARS`, `CalendarSelectFilter.DIOCESAN_CALENDARS`, or `CalendarSelectFilter.NONE`.
     * - `CalendarSelectFilter.NATIONAL_CALENDARS` will show only the nation options.
     * - `CalendarSelectFilter.DIOCESAN_CALENDARS` will show only the diocese options grouped by nation.
     * - `CalendarSelectFilter.NONE` will show all options, that is, both nation and diocese options.
     *
     * @returns {string} The current filter of the CalendarSelect instance.
     * @readonly
     */
    get _filter() {
        return this.#filter;
    }

    /**
     * Retrieves the status of whether a wrapper element has been set for the CalendarSelect instance.
     *
     * @returns {boolean} True if a wrapper element has been set; otherwise, false.
     * @readonly
     */
    get _hasWrapper() {
        return this.#hasWrapper;
    }

    /**
     * Gets the wrapper element for the CalendarSelect instance.
     *
     * The wrapper element is an HTML element that will wrap the select element.
     * The wrapper element can be an HTML element of type `div` or `td`.
     *
     * If the `wrapperOptions` argument was not provided when calling the `wrapper` method,
     * this will be `null`.
     *
     * @returns {HTMLElement|null} The wrapper element for the CalendarSelect instance, or `null` if no wrapper element was set.
     * @readonly
     */
    get _wrapperElement() {
        return this.#wrapperElement;
    }

    /**
     * Gets the status of whether the current CalendarSelect instance allows a null selected value.
     *
     * When `true`, the CalendarSelect instance will have an option for "None" or "No selection", and the `value` property
     * will return `null` when this option is selected.
     *
     * When `false`, the CalendarSelect instance will not have an option for "None" or "No selection", and the `value` property
     * will return an empty string when no option is selected.
     *
     * @returns {boolean} True if the current CalendarSelect instance allows a null selected value; otherwise, false.
     * @readonly
     */
    get _allowNull() {
        return this.#allowNull;
    }

    /**
     * Links the current `dioceses` filtered CalendarSelect instance to a `nations` filtered CalendarSelect instance.
     * When the selected nation is changed in the linked `nations` filtered CalendarSelect instance, the diocese options
     * of the current `dioceses` filtered CalendarSelect instance will be filtered accordingly.
     * @param {CalendarSelect} calendarSelectInstance - The `nations` filtered CalendarSelect instance to link to the current `dioceses` filtered CalendarSelect instance.
     * @returns {CalendarSelect} - The current `dioceses` filtered CalendarSelect instance.
     * @throws {Error} If the current `dioceses` filtered CalendarSelect instance is already linked to another `nations` filtered CalendarSelect instance.
     * @throws {Error} If the type of calendarSelectInstance is not a `CalendarSelect`.
     * @throws {Error} If the filter of the current `dioceses` filtered CalendarSelect instance is not `dioceses`.
     * @throws {Error} If the filter of the linked `nations` filtered CalendarSelect instance is not `nations`.
     */
    linkToNationsSelect( calendarSelectInstance ) {
        if (this.#linked) {
            throw new Error('Current `dioceses` filtered CalendarSelect instance already linked to another `nations` filtered CalendarSelect instance');
        }
        if (false === calendarSelectInstance instanceof CalendarSelect) {
            throw new Error('Invalid type for parameter passed to linkToNationsSelect, must be of type `CalendarSelect` but found type: ' + typeof calendarSelectInstance);
        }
        if ( this.#filter !== CalendarSelectFilter.DIOCESAN_CALENDARS ) {
            throw new Error('Can only link a `CalendarSelectFilter.DIOCESAN_CALENDARS` filtered CalendarSelect instance to a `CalendarSelectFilter.NATIONAL_CALENDARS` filtered CalendarSelect instance. Instead of expected `dioceses` filter, found filter: ' + this.#filter);
        }
        if ( calendarSelectInstance._filter !== CalendarSelectFilter.NATIONAL_CALENDARS ) {
            throw new Error('Can only link a `CalendarSelectFilter.DIOCESAN_CALENDARS` filtered CalendarSelect instance to a `CalendarSelectFilter.NATIONAL_CALENDARS` filtered CalendarSelect instance. Instead of expected `nations` filter for the linked CalendarSelect instance, found filter: ' + calendarSelectInstance._filter);
        }
        const linkedDomElement = calendarSelectInstance._domElement;
        this.#filterDioceseOptionsForNation( linkedDomElement.value );
        linkedDomElement.addEventListener( 'change', (ev) => {
            const newNationValue = ev.target.value;
            this.#filterDioceseOptionsForNation( newNationValue );
        });
        this.#linked = true;
        return this;
    }
}
