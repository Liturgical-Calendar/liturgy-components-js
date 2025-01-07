import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import Utils from '../Utils.js';
import ApiClient from '../ApiClient/ApiClient.js';

/**
 * @typedef Epiphany
 * @type {'JAN6' | 'SUNDAY_JAN2_JAN8'}
 * @readonly
 */

/**
 * @typedef Ascension
 * @type {'THURSDAY' | 'SUNDAY'}
 */

/**
 * @typedef CorpusChristi
 * @type {'THURSDAY' | 'SUNDAY'}
 */

/**
 * @typedef EternalHighPriest
 * @type {true | false}
 */

/**
 * @typedef Locale
 * @type {string}
 */

/**
 * @typedef ReturnType
 * @type {'JSON' | 'XML' | 'YML' | 'ICS'}
 */

/**
 * @typedef YearType
 * @type {'CIVIL' | 'LITURGICAL'}
 */

/**
 * @type {{NATIONAL: "nation", DIOCESAN: "diocese"}}
 * @readonly
 * Used in building the endpoint URL for requests to the API /calendar endpoint
 */
const CalendarType = {
    NATIONAL: 'nation',
    DIOCESAN: 'diocese'
}
Object.freeze(CalendarType);


/**
 * Describes the URL parameters that can be set on the API /calendar endpoint
 */
class RequestPayload {
    /** @type {?Locale} - The locale in which the liturgical calendar should be produced */
    static locale               = null;
    /** @type {?Epiphany} - Whether Epiphany is to be celebrated on January 6 or on the Sunday between January 2 and January 8 */
    static epiphany             = null;
    /** @type {?Ascension} - Whether Ascension is to be celebrated on Thursday or on Sunday */
    static ascension            = null;
    /** @type {?CorpusChristi} - Whether Corpus Christi is to be celebrated on Thursday or on Sunday */
    static corpus_christi       = null;
    /** @type {?EternalHighPriest} - Whether Eternal High Priest is to be celebrated */
    static eternal_high_priest  = null;
    /** @type {?YearType} - Whether the liturgical calendar data should be for the liturgical year or the civil year */
    static year_type            = null;
    /** @type {?ReturnType} - The format of the response data */
    static return_type          = null;
};


/**
 * Used to build the full endpoint URL for the API /calendar endpoint
 */
class CurrentEndpoint {

    static calendarType   = null;
    static calendarId     = null;
    static calendarYear   = null;

    static serialize = () => {
        let currentEndpoint = '/calendar';
        if ( CurrentEndpoint.calendarType !== null && CurrentEndpoint.calendarId !== null ) {
            currentEndpoint += `/${CurrentEndpoint.calendarType}/${CurrentEndpoint.calendarId}`;
        }
        if ( CurrentEndpoint.calendarYear !== null ) {
            currentEndpoint += `/${CurrentEndpoint.calendarYear}`;
        }
        let parameters = [];
        for (const key in RequestPayload) {
            if(RequestPayload[key] !== null && RequestPayload[key] !== ''){
                parameters.push(key + "=" + encodeURIComponent(RequestPayload[key]));
            }
        }
        const urlParams = parameters.length ? `?${parameters.join('&')}` : '';
        return `${currentEndpoint}${urlParams}`;
    }
}

export default class PathBuilder {

    #domElement;
    #buttonElement;
    #buttonWrapper;
    #pathWrapper;
    #pathCodeElement;

    constructor(apiOptions, calendarSelect) {
        if (!apiOptions || false === apiOptions instanceof ApiOptions) {
            throw new Error('calendarPathInput must be an instance of CalendarPathInput');
        }
        if (!calendarSelect || false === calendarSelect instanceof CalendarSelect) {
            throw new Error('calendarSelect must be an instance of CalendarSelect');
        }

        this.#domElement = document.createElement('div');
        this.#buttonWrapper = document.createElement('div');
        this.#buttonElement = document.createElement('a');
        this.#buttonElement.setAttribute('target', '_blank');
        this.#buttonElement.textContent = 'Liturgical Calendar API';
        this.#buttonWrapper.append(this.#buttonElement);

        this.#pathWrapper = document.createElement('div');

        const getReqEl = document.createElement('code');
        getReqEl.textContent = 'GET';
        getReqEl.style.color = 'green';
        getReqEl.style.marginRight = '1em';
        this.#pathWrapper.append(getReqEl);

        this.#pathCodeElement = document.createElement('code');
        this.#pathCodeElement.textContent = ApiClient._apiUrl;
        this.#pathCodeElement.style.marginRight = '1em';
        this.#pathWrapper.append(this.#pathCodeElement);

        this.#domElement.append(this.#pathWrapper);

        this.#domElement.append(this.#buttonWrapper);

        this.#updatePathValues();

        apiOptions._calendarPathInput._domElement.addEventListener('change', (ev) => {
            RequestPayload.locale              = null;
            RequestPayload.ascension           = null;
            RequestPayload.corpus_christi      = null;
            RequestPayload.epiphany            = null;
            RequestPayload.year_type           = null;
            RequestPayload.eternal_high_priest = null;
            const selectEl = calendarSelect._domElement;
            switch (ev.target.value) {
                case '/calendar':
                    CurrentEndpoint.calendarType       = null;
                    CurrentEndpoint.calendarId         = null;
                    break;
                case '/calendar/nation/':
                    if ( CurrentEndpoint.calendarType !== CalendarType.NATIONAL ) {
                        CurrentEndpoint.calendarId   = encodeURIComponent(selectEl.value);
                        CurrentEndpoint.calendarType = CalendarType.NATIONAL;
                    }
                    break;
                case '/calendar/diocese/':
                    if ( CurrentEndpoint.calendarType !== CalendarType.DIOCESAN ) {
                        CurrentEndpoint.calendarId   = encodeURIComponent(selectEl.value);
                        CurrentEndpoint.calendarType = CalendarType.DIOCESAN;
                    }
                    break;
            }
            this.#updatePathValues();
        });

        calendarSelect._domElement.addEventListener('change', (ev) => {
            const selectedOption = ev.target.selectedOptions[0];
            const calendarType = selectedOption.getAttribute("data-calendartype");
            switch (calendarType){
                case 'national':
                    CurrentEndpoint.calendarType = CalendarType.NATIONAL;
                    CurrentEndpoint.calendarId   = ev.target.value;
                    break;
                case 'diocesan': {
                    CurrentEndpoint.calendarType = CalendarType.DIOCESAN;
                    CurrentEndpoint.calendarId   = ev.target.value;
                    break;
                }
            }
            this.#updatePathValues();
        });

        apiOptions._acceptHeaderInput._domElement.addEventListener('change', (ev) => {
            RequestPayload.return_type = ev.target.value;
            this.#updatePathValues();
        });

        apiOptions._yearTypeInput._domElement.addEventListener('change', (ev) => {
            RequestPayload.year_type = ev.target.value;
            this.#updatePathValues();
        });

        apiOptions._yearInput._domElement.addEventListener('change', (ev) => {
            CurrentEndpoint.calendarYear = ev.target.value;
            this.#updatePathValues();
        });

        apiOptions._epiphanyInput._domElement.addEventListener('change', (ev) => {
            RequestPayload.epiphany = ev.target.value;
            this.#updatePathValues();
        });

        apiOptions._ascensionInput._domElement.addEventListener('change', (ev) => {
            RequestPayload.ascension = ev.target.value;
            this.#updatePathValues();
        });

        apiOptions._corpusChristiInput._domElement.addEventListener('change', (ev) => {
            RequestPayload.corpus_christi = ev.target.value;
            this.#updatePathValues();
        });

        apiOptions._eternalHighPriestInput._domElement.addEventListener('change', (ev) => {
            RequestPayload.eternal_high_priest = ev.target.value;
            this.#updatePathValues();
        });

        apiOptions._localeInput._domElement.addEventListener('change', (ev) => {
            RequestPayload.locale = ev.target.value;
            this.#updatePathValues();
        });
    }

    #updatePathValues() {
        const finalPath = (ApiClient._apiUrl + CurrentEndpoint.serialize());
        this.#pathCodeElement.textContent = finalPath;
        this.#buttonElement.setAttribute('href', finalPath);
    }

    class(className = '') {
        if (typeof className !== 'string') {
            throw new Error('Invalid type for value passed to PathBuilder.class(), must be of type string but found type: ' + typeof className);
        }
        className = Utils.sanitizeInput(className);
        const classNames = className.split(/\s+/);
        classNames.forEach(token => {
            if (false === Utils.validateClassName(token)) {
                throw new Error('Invalid class value passed to buttonClass: ' + token);
            }
        });
        this.#domElement.className = classNames.join(' ');
        return this;
    }

    id(id) {
        if (typeof id !== 'string') {
            throw new Error('Invalid type for value passed to PathBuilder.id(), must be of type string but found type: ' + typeof id);
        }
        id = Utils.sanitizeInput(id);
        if (Utils.validateId(id)) {
            this.#domElement.id = id;
        } else {
            throw new Error('PathBuilder.id: Invalid id');
        }
        return this;
    }

    buttonClass(className = '') {
        if (typeof className !== 'string') {
            throw new Error('Invalid type for value passed to buttonClass, must be of type string but found type: ' + typeof className);
        }
        className = Utils.sanitizeInput(className);
        const classNames = className.split(/\s+/);
        classNames.forEach(token => {
            if (false === Utils.validateClassName(token)) {
                throw new Error('Invalid class value passed to buttonClass: ' + token);
            }
        });
        this.#buttonElement.className = classNames.join(' ');
        return this;
    }

    buttonText(text) {
        text = Utils.sanitizeInput(text);
        this.#buttonElement.textContent = text;
        return this;
    }

    buttonWrapperClass(className = '') {
        if (typeof className !== 'string') {
            throw new Error('Invalid type for value passed to buttonClass, must be of type string but found type: ' + typeof className);
        }
        className = Utils.sanitizeInput(className);
        const classNames = className.split(/\s+/);
        classNames.forEach(token => {
            if (false === Utils.validateClassName(token)) {
                throw new Error('Invalid class value passed to buttonClass: ' + token);
            }
        });
        this.#buttonWrapper.className = classNames.join(' ');
        return this;
    }

    pathWrapperClass(className = '') {
        if (typeof className !== 'string') {
            throw new Error('Invalid type for value passed to buttonClass, must be of type string but found type: ' + typeof className);
        }
        className = Utils.sanitizeInput(className);
        const classNames = className.split(/\s+/);
        classNames.forEach(token => {
            if (false === Utils.validateClassName(token)) {
                throw new Error('Invalid class value passed to buttonClass: ' + token);
            }
        });
        this.#pathWrapper.className = classNames.join(' ');
        return this;
    }

    appendTo(elementSelector) {
        let domNode;
        if (typeof elementSelector === 'string') {
            domNode = Utils.validateElementSelector( elementSelector );
        }
        else if(elementSelector instanceof HTMLElement) {
            domNode = elementSelector;
        } else {
            throw new Error('PathBuilder.appendTo: parameter must be a valid CSS selector or an instance of HTMLElement');
        }
        domNode.append(this.#domElement);
    }

    replace(elementSelector) {
        let domNode;
        if (typeof elementSelector === 'string') {
            domNode = Utils.validateElementSelector( elementSelector );
        }
        else if (elementSelector instanceof HTMLElement) {
            domNode = elementSelector;
        } else {
            throw new Error('PathBuilder.replace: parameter must be a valid CSS selector or an instance of HTMLElement');
        }
        domNode.replaceWith(this.#domElement);
    }
}
