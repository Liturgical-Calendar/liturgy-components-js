/**
 * Calendars Select
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 * @version 1.0.0
 * @see https://github.com/Liturgical-Calendar/liturgy-components-js
 *
 * Description: Creates a select menu populated with available liturgical calendars from the Liturgical Calendar API
 */

import { LitCalApiClient } from './index.js';

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
    #filter                               = 'none';
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
    #allowNullSet                         = false;

    //kudos to https://stackoverflow.com/a/47140708/394921 for the idea
    static #sanitizeInput(input) {
        let doc = new DOMParser().parseFromString(input, 'text/html');
        return doc.body.textContent || "";
    }

    static #isValidClassName( className ) {
        /**
         * The regex pattern used to validate class names:
         *   - `^` asserts the start of a line
         *   - `(?!\d|--|-?\d)` is a negative look ahead that prevents the class name
         *                  from starting with a digit, or a sequence of dashes, or a number with a leading dash
         *   - `[a-zA-Z_-]` matches any character that is a letter, a dash or an underscore
         *   - `[a-zA-Z\d_-]{1,}` matches any alphanumeric character, a dash or an underscore at least once
         *   - `$` asserts the end of a line
         */
        const pattern = /^(?!\d|--|-?\d)[a-zA-Z_-][a-zA-Z\d_-]{1,}$/;
        return pattern.test(className);
    }

    static #isValidId( id ) {
        /**
         * The regex pattern used to validate IDs:
         *   - `^` asserts the start of a line
         *   - `(?!\d|--|-?\d)` is a negative lookahead that prevents the ID
         *     from starting with a digit, a sequence of dashes, or a number with a leading dash
         *   - `(?:[_-][a-zA-Z][\w\-]*|[a-zA-Z][\w\-]*)` matches either a sequence starting with an underscore or dash
         *      followed by a letter followed by zero or more word characters or dashes,
         *      or it matches a letter followed by zero or more word characters or dashes
         *   - `$` asserts the end of a line
         *
         * >> Technically, the value for an ID attribute may contain any other Unicode character.
         * >> However, when used in CSS selectors,
         * >>  either from JavaScript using APIs like Document.querySelector()
         * >>  or in CSS stylesheets, ID attribute values must be valid CSS identifiers.
         * https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/id
         */
        const pattern = /^(?!\d|--|-?\d)(?:[_-][a-zA-Z][\w\-]*|[a-zA-Z][\w\-]*)$/;
        return pattern.test(id);
    }

    static #hasNationalCalendarWithDioceses( nation ) {
        return CalendarSelect.#nationalCalendarsWithDioceses.filter(item => item?.calendar_id === nation).length > 0;
    }
    static #addNationalCalendarWithDioceses( nation ) {
        const nationalCalendar = CalendarSelect.#nationalCalendars.find(item => item.calendar_id === nation);
        CalendarSelect.#nationalCalendarsWithDioceses.push( nationalCalendar );
    }

    static init() {
        console.log('Initializing CalendarSelect');
        if ( null === LitCalApiClient.metadata ) {
            throw new Error('LitCalApiClient has not been initialized. Please initialize with `LitCalApiClient.init().then(() => { ... })`, and handle the CalendarSelect instances within the callback.');
        } else {
            console.log(`LitCalApiClient already initialized`);
            if (LitCalApiClient.metadata === false) {
                throw new Error('The LitCalApiClient class was unable to initialize.');
            }
            if (typeof LitCalApiClient.metadata !== 'object') {
                throw new Error('The LitCalApiClient class was unable to initialize: expected object, found ' + typeof LitCalApiClient.metadata + '.');
            }
            if (false === LitCalApiClient.metadata.hasOwnProperty('national_calendars') || false === LitCalApiClient.metadata.hasOwnProperty('diocesan_calendars')) {
                throw new Error('The LitCalApiClient class was unable to initialize: expected object with `national_calendars` and `diocesan_calendars` properties.');
            }
            CalendarSelect.#metadata = LitCalApiClient.metadata;
            CalendarSelect.#nationalCalendars =  CalendarSelect.#metadata.national_calendars;
            CalendarSelect.#diocesanCalendars = CalendarSelect.#metadata.diocesan_calendars;
        }
    }

    constructor(locale = 'en') {
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
            console.log(`Locale set to ${this.#locale}`);
        } catch (e) {
            throw new Error('Invalid locale: ' + locale);
        }

        if (null === CalendarSelect.#metadata) {
            CalendarSelect.init();
        }
        this.#buildAllOptions();
        this.#domElement = document.createElement('select');
    }

    #filterDioceseOptionsForNation( nation ) {
        if ( false === this.#dioceseOptions.hasOwnProperty( nation ) ) {
            this.#domElement.innerHTML = '<option value="">---</option>';
        } else {
            const firstElement = this.#allowNull ? '<option value="">---</option>' : '';
            this.#domElement.innerHTML = firstElement + this.#dioceseOptions[ nation ].join( '' );
        }
    }

    #addNationOption( nationalCalendar, selected = false ) {
        let option = `<option data-calendartype="national" value="${nationalCalendar.calendar_id}"${selected ? ' selected' : ''}>${this.#countryNames.of( nationalCalendar.calendar_id )}</option>`;
        this.#nationOptions.push( option );
    }

    #addDioceseOption( item ) {
        let option = `<option data-calendartype="diocesan" value="${item.calendar_id}">${item.diocese}</option>`;
        this.#dioceseOptions[ item.nation ].push( option );
    }

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

    get nationsInnerHtml() {
        return this.#nationOptions.join( '' );
    }

    get diocesesInnerHtml() {
        return this.#dioceseOptionsGrouped.join( '' );
    }

    filter( filter = 'none' ) {
        if ( this.#filterSet ) {
            throw new Error('Filter has already been set to `' + this.#filter + '`.');
        }
        if ( 'nations' !== filter && 'dioceses' !== filter && 'none' !== filter ) {
            throw new Error('Invalid filter: ' + filter);
        }
        this.#filter = filter;
        const firstElement = this.#allowNull ? '<option value="">---</option>' : '';
        if ( this.#filter === 'nations' ) {
            this.#domElement.innerHTML = firstElement + this.nationsInnerHtml;
        } else if ( this.#filter === 'dioceses' ) {
            this.#domElement.innerHTML = firstElement + this.diocesesInnerHtml;
        } else {
            this.#domElement.innerHTML = firstElement + this.nationsInnerHtml + this.diocesesInnerHtml;
        }
        this.#filterSet = true;
        return this;
    }

    class( className ) {
        if ( typeof className !== 'string' ) {
            throw new Error('Invalid type for class name, must be of type string but found type: ' + typeof className);
        }
        let classNames = className.split( /\s+/ );
        classNames = classNames.map( className => CalendarSelect.#sanitizeInput( className ) );
        classNames.forEach(className => {
            if ( false === CalendarSelect.#isValidClassName( className ) ) {
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

    id( id ) {
        if ( this.#idSet ) {
            throw new Error('ID has already been set to `' + this.#domElement.id + '`.');
        }
        if ( typeof id !== 'string' ) {
            throw new Error('Invalid type for id, must be of type string but found type: ' + typeof id);
        }
        id = CalendarSelect.#sanitizeInput( id );
        if (CalendarSelect.#isValidId( id ) === false) {
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

    name( name ) {
        if ( this.#nameSet ) {
            throw new Error('Name has already been set to `' + this.#domElement.name + '`.');
        }
        if ( typeof name !== 'string' ) {
            throw new Error('Invalid type for name, must be of type string but found type: ' + typeof name);
        }
        this.#domElement.name = name;
        this.#nameSet = true;
        return this;
    }

    label( labelOptions = null ) {
        if ( this.#labelSet) {
            throw new Error('Label has already been set.');
        }
        if ( null === labelOptions ) {
            this.#hasLabel = false;
            this.#labelElement = null;
            this.#domElement.removeAttribute( 'aria-labelledby' );
            this.#afterSet = true;
            return this;
        }
        else if ( typeof labelOptions !== 'object' || Array.isArray(labelOptions) ) {
            const labelOptionsType = Array.isArray(labelOptions) ? 'array' : typeof labelOptions;
            throw new Error('Invalid type for label options, must be of type object (not null or array) but found type: ' + labelOptionsType);
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
            classNames = classNames.map( className => CalendarSelect.#sanitizeInput( className ) );
            classNames.forEach(className => {
                if ( false === CalendarSelect.#isValidClassName( className ) ) {
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
            labelOptions.id = CalendarSelect.#sanitizeInput( labelOptions.id );
            if (false === CalendarSelect.#isValidId( labelOptions.id )) {
                throw new Error('Invalid id, cannot contain any kind of whitespace character and must be a valid CSS selector: ' + labelOptions.id);
            }
            this.#labelElement.id = labelOptions.id;
            this.#domElement.setAttribute( 'aria-labelledby', this.#labelElement.id );
        }

        if ( labelOptions.hasOwnProperty( 'text' ) ) {
            if ( typeof labelOptions.text !== 'string' ) {
                throw new Error('Invalid type for label text, must be of type string but found type: ' + typeof labelOptions.text);
            }
            labelOptions.text = CalendarSelect.#sanitizeInput( labelOptions.text );
            this.#labelElement.innerText = labelOptions.text;
        } else {
            this.#labelElement.innerText = 'Select a calendar';
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

    wrapper( wrapperOptions = null ) {
        if ( this.#wrapperSet ) {
            throw new Error('Wrapper has already been set.');
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
            classNames = classNames.map( className => CalendarSelect.#sanitizeInput( className ) );
            classNames.forEach(className => {
                if ( false === CalendarSelect.#isValidClassName( className ) ) {
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
            wrapperOptions.id = CalendarSelect.#sanitizeInput( wrapperOptions.id );
            if (false === CalendarSelect.#isValidId( wrapperOptions.id )) {
                throw new Error('Invalid id, cannot contain any kind of whitespace character and must be a valid CSS selector: ' + wrapperOptions.id);
            }
            this.#wrapperElement.id = wrapperOptions.id;
        }
        return this;
    }

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

    allowNull( allowNull = true ) {
        if ( this.#allowNullSet ) {
            throw new Error('AllowNull has already been set to `' + this.#domElement.allowNull + '`.');
        }
        if ( typeof allowNull !== 'boolean' ) {
            throw new Error('Invalid type for allowNull, must be of type boolean but found type: ' + typeof allowNull);
        }
        this.#allowNull = allowNull;
        this.#allowNullSet = true;
        return this;
    }

    disabled( disabled = true ) {
        if (typeof disabled !== 'boolean') {
            throw new Error('Invalid type for disabled, must be of type boolean but found type: ' + typeof disabled);
        }
        this.#domElement.disabled = disabled;
        return this;
    }

    #validateElementSelector( element ) {
        if (typeof element !== 'string') {
            throw new Error('Invalid type for element selector, must be of type string but found type: ' + typeof element);
        }
        if ( this.#filter === 'none' ) {
            this.filter();
        }
        const domNode = document.querySelector( element );
        if ( null === domNode ) {
            throw new Error('Invalid element selector: ' + element);
        }
        return domNode;
    }

    replace( element ) {
        const domNode = this.#validateElementSelector( element );
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

    appendTo( element ) {
        const domNode = this.#validateElementSelector( element );
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

    getDomElement() {
        return this.#domElement;
    }

    getFilter() {
        return this.#filter;
    }

    linkToNationsSelect( calendarSelectInstance ) {
        if (this.#linked) {
            throw new Error('Current `dioceses` filtered CalendarSelect instance already linked to another `nations` filtered CalendarSelect instance');
        }
        if (false === calendarSelectInstance instanceof CalendarSelect) {
            throw new Error('Invalid type for parameter passed to linkToNationsSelect, must be of type `CalendarSelect` but found type: ' + typeof calendarSelectInstance);
        }
        if ( this.#filter !== 'dioceses' ) {
            throw new Error('Can only link a `dioceses` filtered CalendarSelect instance to a `nations` filtered CalendarSelect instance. Instead of expected `dioceses` filter, found filter: ' + this.#filter);
        }
        if ( calendarSelectInstance.getFilter() !== 'nations' ) {
            throw new Error('Can only link a `dioceses` filtered CalendarSelect instance to a `nations` filtered CalendarSelect instance. Instead of expected `nations` filter for the linked CalendarSelect instance, found filter: ' + calendarSelectInstance.getFilter());
        }
        const linkedDomElement = calendarSelectInstance.getDomElement();
        this.#filterDioceseOptionsForNation( linkedDomElement.value );
        linkedDomElement.addEventListener( 'change', (ev) => {
            const newNationValue = ev.target.value;
            this.#filterDioceseOptionsForNation( newNationValue );
        });
        this.#linked = true;
        return this;
    }
}
