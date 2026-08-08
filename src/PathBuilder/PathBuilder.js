import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import Utils from '../Utils.js';
import ApiBase from '../ApiClient/ApiBase.js';
import { CurrentEndpoint, CalendarType, RequestPayload } from './CurrentEndpoint.js';

// `CurrentEndpoint`, `CalendarType` and `RequestPayload` are defined in
// `./CurrentEndpoint.js` — see the doc comment on the `CurrentEndpoint` class
// for why that split exists — and re-exported here so that `PathBuilder.js`
// remains the one module a caller needs to import to reach the whole
// path-building surface. Note that this is a NEW export, not a compatibility
// shim: before this branch `PathBuilder.js` exported only its default class,
// so there are no prior consumers of these three names to keep working.
export { CurrentEndpoint, CalendarType, RequestPayload };

export default class PathBuilder {

    #domElement;
    #buttonElement;
    #buttonWrapper;
    #pathWrapper;
    #pathCodeElement;
    /** @type {ApiBase} */
    #base;
    /**
     * The endpoint state this PathBuilder renders.
     *
     * Borrowed from — not created by — the `ApiOptions` passed to the constructor,
     * so that the rite/calendar mutations `ApiOptions` performs when a `RiteSelect`
     * is linked land on the very object serialized here. Because it belongs to that
     * one `ApiOptions`, a second PathBuilder/ApiOptions pair on the same page keeps
     * entirely separate state.
     *
     * @type {CurrentEndpoint}
     */
    #currentEndpoint;

    constructor(apiOptions, calendarSelect) {
        if (!apiOptions || false === apiOptions instanceof ApiOptions) {
            throw new Error('calendarPathInput must be an instance of CalendarPathInput');
        }
        if (!calendarSelect || false === calendarSelect instanceof CalendarSelect) {
            throw new Error('calendarSelect must be an instance of CalendarSelect');
        }
        if ( apiOptions._base !== calendarSelect._base ) {
            throw new Error(
                `PathBuilder: the apiOptions and calendarSelect passed to it are bound to different API bases — `
                + `${apiOptions._base.url} and ${calendarSelect._base.url}. A path built from one API's options and `
                + `another API's calendars would point at neither.`
            );
        }
        this.#base = apiOptions._base;

        this.#currentEndpoint = apiOptions._currentEndpoint;
        const currentEndpoint = this.#currentEndpoint;
        const requestPayload  = currentEndpoint.requestPayload;

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
        this.#pathCodeElement.textContent = this.#base.url;
        this.#pathCodeElement.style.marginRight = '1em';
        this.#pathWrapper.append(this.#pathCodeElement);

        this.#domElement.append(this.#pathWrapper);

        this.#domElement.append(this.#buttonWrapper);

        this.#updatePathValues();

        apiOptions._calendarPathInput._domElement.addEventListener('change', (ev) => {
            requestPayload.locale              = null;
            requestPayload.ascension           = null;
            requestPayload.corpus_christi      = null;
            requestPayload.epiphany            = null;
            requestPayload.year_type           = null;
            requestPayload.eternal_high_priest = null;
            const selectEl = calendarSelect._domElement;
            switch (ev.target.value) {
                case '/calendar':
                    currentEndpoint.calendarType       = null;
                    currentEndpoint.calendarId         = null;
                    break;
                case '/calendar/nation/':
                    if ( currentEndpoint.calendarType !== CalendarType.NATIONAL ) {
                        currentEndpoint.calendarId   = encodeURIComponent(selectEl.value);
                        currentEndpoint.calendarType = CalendarType.NATIONAL;
                    }
                    break;
                case '/calendar/diocese/':
                    if ( currentEndpoint.calendarType !== CalendarType.DIOCESAN ) {
                        currentEndpoint.calendarId   = encodeURIComponent(selectEl.value);
                        currentEndpoint.calendarType = CalendarType.DIOCESAN;
                    }
                    break;
            }
            this.#updatePathValues();
        });

        calendarSelect._domElement.addEventListener('change', (ev) => {
            // A select can legitimately have NOTHING selected: `allowNull(false)`
            // removes the empty option, and a rite change then resets the value
            // to '' with no option to match it. Reading `.getAttribute` off the
            // missing option throws inside the listener, which the DOM swallows
            // — so the endpoint would be updated correctly while the rendered
            // path below never repaints. Treat "nothing selected" as no calendar.
            const selectedOption = ev.target.selectedOptions[0];
            const calendarType = selectedOption?.getAttribute('data-calendartype') ?? null;
            switch (calendarType){
                case 'national':
                    currentEndpoint.calendarType = CalendarType.NATIONAL;
                    currentEndpoint.calendarId   = ev.target.value;
                    break;
                case 'diocesan': {
                    currentEndpoint.calendarType = CalendarType.DIOCESAN;
                    currentEndpoint.calendarId   = ev.target.value;
                    break;
                }
                default:
                    // The empty option carries no `data-calendartype`. It means
                    // the rite-level calendar, so the previous selection has to
                    // be cleared — without this the last chosen nation or
                    // diocese stays in the path forever and re-selecting the
                    // empty option appears to do nothing.
                    currentEndpoint.calendarType = null;
                    currentEndpoint.calendarId   = null;
                    break;
            }
            this.#updatePathValues();
        });

        apiOptions._acceptHeaderInput._domElement.addEventListener('change', (ev) => {
            requestPayload.return_type = ev.target.value;
            this.#updatePathValues();
        });

        apiOptions._yearTypeInput._domElement.addEventListener('change', (ev) => {
            requestPayload.year_type = ev.target.value;
            this.#updatePathValues();
        });

        apiOptions._yearInput._domElement.addEventListener('change', (ev) => {
            currentEndpoint.calendarYear = ev.target.value;
            this.#updatePathValues();
        });

        apiOptions._epiphanyInput._domElement.addEventListener('change', (ev) => {
            requestPayload.epiphany = ev.target.value;
            this.#updatePathValues();
        });

        apiOptions._ascensionInput._domElement.addEventListener('change', (ev) => {
            requestPayload.ascension = ev.target.value;
            this.#updatePathValues();
        });

        apiOptions._corpusChristiInput._domElement.addEventListener('change', (ev) => {
            requestPayload.corpus_christi = ev.target.value;
            this.#updatePathValues();
        });

        apiOptions._eternalHighPriestInput._domElement.addEventListener('change', (ev) => {
            requestPayload.eternal_high_priest = ev.target.value;
            this.#updatePathValues();
        });

        apiOptions._localeInput._domElement.addEventListener('change', (ev) => {
            requestPayload.locale = ev.target.value;
            this.#updatePathValues();
        });
    }

    /**
     * Gets the underlying DOM element of the PathBuilder instance.
     *
     * @returns {HTMLElement} The underlying DOM element of the PathBuilder instance.
     * @readonly
     */
    get _domElement() {
        return this.#domElement;
    }

    #updatePathValues() {
        const finalPath = (this.#base.url + this.#currentEndpoint.serialize());
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
