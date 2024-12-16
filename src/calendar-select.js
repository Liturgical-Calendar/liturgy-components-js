/**
 * Calendars Select
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 * @version 1.0.0
 * @see https://github.com/Liturgical-Calendar/liturgy-components-js
 *
 * Description: Creates a select menu populated with available liturgical calendars from the Liturgical Calendar API
 */

import LitCalApiClient from './litcal-api-client.js';

class CalendarSelect {
    static #apiResults                    = null;
    static #nationalCalendars             = [];
    static #diocesanCalendars             = [];
    static #nationalCalendarsWithDioceses = [];
    #nationOptions                        = [];
    #dioceseOptions                       = {};
    #dioceseOptionsGrouped                = [];
    #countryNames                         = null;
    #locale                               = 'en';
    #filter                               = 'none';
    #className                            = 'calendar-select';
    #domElement                           = null;
    #filterSet                            = false;
    #linked                               = false;

    static hasNationalCalendarWithDioceses( nation ) {
        return CalendarSelect.#nationalCalendarsWithDioceses.filter(item => item?.calendar_id === nation).length > 0;
    }
    static addNationalCalendarWithDioceses( nation ) {
        const nationalCalendar = CalendarSelect.#nationalCalendars.find(item => item.calendar_id === nation);
        CalendarSelect.#nationalCalendarsWithDioceses.push( nationalCalendar );
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

        if (null === CalendarSelect.#apiResults) {
            CalendarSelect.init();
        }
        this.buildAllOptions();
        this.#domElement = document.createElement('select');
        this.#domElement.innerHTML = this.nationsInnerHtml + this.diocesesInnerHtml;
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
            CalendarSelect.#apiResults = LitCalApiClient.metadata;
            console.log(`CalendarSelect.#apiResults = ${JSON.stringify(CalendarSelect.#apiResults)}`);
            CalendarSelect.#nationalCalendars =  CalendarSelect.#apiResults.national_calendars;
            CalendarSelect.#diocesanCalendars = CalendarSelect.#apiResults.diocesan_calendars;
        }
    }

    addNationOption( nationalCalendar, selected = false ) {
        let option = `<option data-calendartype="national" value="${nationalCalendar.calendar_id}"${selected ? ' selected' : ''}>${this.#countryNames.of( nationalCalendar.calendar_id )}</option>`;
        this.#nationOptions.push( option );
    }
    addDioceseOption( item ) {
        let option = `<option data-calendartype="diocesan" value="${item.calendar_id}">${item.diocese}</option>`;
        this.#dioceseOptions[ item.nation ].push( option );
    }
    buildAllOptions() {
        CalendarSelect.#diocesanCalendars.forEach( diocesanCalendarObj => {
            if ( false === CalendarSelect.hasNationalCalendarWithDioceses( diocesanCalendarObj.nation ) ) {
                // we add all nations with dioceses to the nations list
                CalendarSelect.addNationalCalendarWithDioceses( diocesanCalendarObj.nation );
            }
            if ( false === this.#dioceseOptions.hasOwnProperty( diocesanCalendarObj.nation ) ) {
                this.#dioceseOptions[ diocesanCalendarObj.nation ] = [];
            }
            this.addDioceseOption( diocesanCalendarObj );
        } );

        CalendarSelect.#nationalCalendars.sort( ( a, b ) => this.#countryNames.of( a.calendar_id ).localeCompare( this.#countryNames.of( b.calendar_id ) ) );
        CalendarSelect.#nationalCalendars.forEach( nationalCalendar => {
            if ( false === CalendarSelect.hasNationalCalendarWithDioceses( nationalCalendar.calendar_id ) ) {
                // This is the first time we call CalendarSelect.addNationOption().
                // This will ensure that the VATICAN (a nation without any diocese) will be added as the first option.
                // In theory any other nation for whom no dioceses are defined will be added here too,
                // so we will ensure that the VATICAN is always the default selected option
                if ( 'VA' === nationalCalendar.calendar_id ) {
                    this.addNationOption( nationalCalendar, true );
                } else {
                    this.addNationOption( nationalCalendar );
                }
            }
        } );

        // now we can add the options for the nations in the #calendarNationsWithDiocese list
        // that is to say, nations that have dioceses
        CalendarSelect.#nationalCalendarsWithDioceses.sort( ( a, b ) => this.#countryNames.of( a.calendar_id ).localeCompare( this.#countryNames.of( b.calendar_id ) ) );
        CalendarSelect.#nationalCalendarsWithDioceses.forEach( nationalCalendar => {
            this.addNationOption( nationalCalendar );
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

    filter( filter = null ) {
        if ( this.#filterSet ) {
            throw new Error('Filter has already been set to `' + this.#filter + '`.');
        }
        if ( 'nations' !== filter && 'dioceses' !== filter ) {
            throw new Error('Invalid filter: ' + filter);
        }
        this.#filter = filter;
        if ( this.#filter === 'nations' ) {
            this.#domElement.innerHTML = this.nationsInnerHtml;
        } else if ( this.#filter === 'dioceses' ) {
            this.#domElement.innerHTML = this.diocesesInnerHtml;
        }
        this.#filterSet = true;
        return this;
    }

    class( className ) {
        if ( typeof className !== 'string' ) {
            throw new Error('Invalid type for class name, must be of type string but found type: ' + typeof className);
        }
        const classNames = className.split( ' ' );
        classNames = classNames.map( className => this.#sanitizeInput( className ) );
        classNames.forEach(className => {
            if ( false === this.#isValidClassName( className ) ) {
                throw new Error('Invalid class name: ' + className);
            }
        });
        this.#className = classNames.join( ' ' );
        if ( this.#className === '' ) {
            this.#domElement.removeAttribute( 'class' );
        } else {
            this.#domElement.setAttribute( 'class', this.#className );
        }
        return this;
    }

    //kudos to https://stackoverflow.com/a/47140708/394921 for the idea
    #sanitizeInput (input) {
        let doc = new DOMParser().parseFromString(input, 'text/html');
        return doc.body.textContent || "";
    }

    #isValidClassName ( className ) {
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

    #filterDioceseOptionsForNation( nation ) {
        if ( false === this.#dioceseOptions.hasOwnProperty( nation ) ) {
            this.#domElement.innerHTML = '<option value="">---</option>';
        } else {
            this.#domElement.innerHTML = '<option value="">---</option>' + this.#dioceseOptions[ nation ].join( '' );
        }
    }

    replace( element ) {
        if (typeof element !== 'string') {
            throw new Error('Invalid type for element selector, must be of type string but found type: ' + typeof element);
        }
        const domNode = document.querySelector( element );
        if ( null === domNode ) {
            throw new Error('Invalid element selector: ' + element);
        }
        domNode.replaceWith( this.#domElement );
    }

    appendTo( element ) {
        if (typeof element !== 'string') {
            throw new Error('Invalid type for element selector, must be of type string but found type: ' + typeof element);
        }
        const domNode = document.querySelector( element );
        if ( null === domNode ) {
            throw new Error('Invalid element selector: ' + element);
        }
        domNode.appendChild( this.#domElement );
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

export default CalendarSelect;
