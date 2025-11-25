import Messages from '../Messages.js';
import ApiClient from '../ApiClient/ApiClient.js';

export default class LiturgyOfTheDay {

    /**
     * @type {RegExp[]}
     * @static
     * @private
     * @readonly
     */
    static #filterTagsDisplayGrade = Object.freeze([
        /OrdSunday[0-9]{1,2}(_vigil){0,1}/,
        /Advent[1-4](_vigil){0,1}/,
        /Lent[1-5](_vigil){0,1}/,
        /Easter[1-7](_vigil){0,1}/
    ]);

    /**
     * @type {['geeen', 'red', 'purple']}
     * @static
     * @private
     * @readonly
     */
    static #highContrast = Object.freeze([ 'green', 'red', 'purple' ]);

    /** @type {Date} */
    #date = null;

    /** @type {Intl.Locale} */
    #locale = null;

    /** @type {HTMLElement} */
    #domElement = null;

    /** @type {HTMLElement} */
    #titleElement = null;

    /** @type {HTMLElement} */
    #dateElement = null;

    /** @type {HTMLElement} */
    #eventsElementsWrapper = null;

    /** @type {string} */
    #eventClassName = '';

    /** @type {string} */
    #eventGradeClassName = '';

    /** @type {string} */
    #eventCommonClassName = '';

    /** @type {string} */
    #eventYearCycleClassName = '';

    /**
     * Validates the given class name to ensure it is a valid CSS class name.
     *
     * A valid CSS class name is a string that starts with a letter, underscore or dash,
     * followed by any number of alphanumeric characters, dashes or underscores.
     *
     * @param {string} className - The class name to validate.
     * @returns {boolean} True if the class name is valid, false otherwise.
     * @static
     * @private
     */
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

    /**
     * Validates the given ID to ensure it is a valid HTML ID.
     *
     * A valid HTML ID is a string that starts with a letter, underscore or dash,
     * followed by any number of alphanumeric characters, dashes or underscores.
     *
     * @param {string} id - The ID to validate.
     * @returns {boolean} True if the ID is valid, false otherwise.
     * @static
     * @private
     */
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

    /**
     * Validates the given element selector to ensure it is a valid HTML element selector.
     *
     * @param {string} element - The element selector to validate.
     * @returns {Element} The DOM element that the selector matches.
     * @throws {Error} If the element selector is invalid or does not match any elements.
     * @static
     * @private
     */
    static #validateElementSelector( element ) {
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
     * Constructs a LiturgyOfTheDay object.
     *
     * @param {string|Object|null} [options=null] - The locale to use for formatting the date and the titles.
     *                                  The locale should be a valid string that can be parsed by the Intl.getCanonicalLocales function.
     *                                  If the locale string contains an underscore, the underscore will be replaced with a hyphen.
     *                                  The default is 'en' (English). Locales with region extensions are also supported, such as 'en-US', 'en-GB', 'en-CA', etc.
     *
     * @throws {Error} If the locale is invalid.
     */
    constructor(options = null) {
        if (typeof options === 'string') {
            this.#validateLocale(options);
        }
        else if (typeof options === 'object') {
            if (options.hasOwnProperty('locale')) {
                this.#validateLocale(options.locale);
            } else {
                this.#validateLocale('en');
            }
        } else {
            throw new Error('LiturgyOfTheDay: Invalid options passed to constructor, must be of type string or object but found type: ' + typeof options);
        }
        const now = new Date();
        this.#date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0));
        this.#domElement = document.createElement('div');

        this.#titleElement = document.createElement('h1');
        this.#titleElement.textContent = Messages[this.#locale.language]['LITURGY_OF_THE_DAY'];
        this.#domElement.appendChild(this.#titleElement);

        this.#dateElement = document.createElement('div');
        this.#dateElement.textContent = new Intl.DateTimeFormat(this.#locale.baseName, {dateStyle: 'full'}).format(this.#date);
        this.#domElement.appendChild(this.#dateElement);

        this.#eventsElementsWrapper = document.createElement('div');
        this.#domElement.appendChild(this.#eventsElementsWrapper);

        if (typeof options === 'object') {
            if (options.hasOwnProperty('id')) {
                this.id(options.id);
            }
            if (options.hasOwnProperty('class')) {
                this.class(options.class);
            }
            if (options.hasOwnProperty('titleClass')) {
                this.titleClass(options.titleClass);
            }
            if (options.hasOwnProperty('dateClass')) {
                this.dateClass(options.dateClass);
            }
            if (options.hasOwnProperty('eventClass')) {
                this.eventClass(options.eventClass);
            }
            if (options.hasOwnProperty('eventGradeClass')) {
                this.eventGradeClass(options.eventGradeClass);
            }
            if (options.hasOwnProperty('eventCommonClass')) {
                this.eventCommonClass(options.eventCommonClass);
            }
            if (options.hasOwnProperty('eventYearCycleClass')) {
                this.eventYearCycleClass(options.eventYearCycleClass);
            }
            if (options.hasOwnProperty('eventsWrapperClass')) {
                this.eventsWrapperClass(options.eventsWrapperClass);
            }
        }
    }

    /**
     * Validates the given locale string to ensure it is a valid locale.
     *
     * The locale string should be a valid string that can be parsed by the Intl.getCanonicalLocales function.
     * If the locale string contains an underscore, the underscore will be replaced with a hyphen.
     * Locales with region extensions are also supported, such as 'en-US', 'en-GB', 'en-CA', etc.
     *
     * @param {string} locale - The locale string to validate.
     * @throws {Error} If the locale is invalid.
     * @private
     */
    #validateLocale(locale) {
        if (typeof locale !== 'string') {
            throw new Error('LiturgyOfTheDay: Invalid locale');
        }
        locale = locale.replaceAll('_', '-');
        try {
            this.#locale = new Intl.Locale(locale);
        } catch (e) {
            throw new Error('LiturgyOfTheDay: Invalid locale');
        }
    }

    /**
     * Updates the DOM elements with the details of the events for the current day.
     *
     * @param {import('../typedefs').CalendarEvent[]} todaysEvents - The liturgical events for the current day.
     * @private
     */
    #updateEventDetails(todaysEvents) {
        todaysEvents.forEach((celebration) => {
            const lclzdGrade = celebration.grade < 7 ? celebration.grade_lcl : '';
            const isSundayOrdAdvLentEaster = LiturgyOfTheDay.#filterTagsDisplayGrade.some(pattern => pattern.test(celebration.event_key));
            const celebrationGrade = celebration.grade_display !== null
                ? celebration.grade_display
                : (!isSundayOrdAdvLentEaster && celebration.grade !== 0 ? lclzdGrade : '');
            const celebrationColor = celebration.color;
            const litEventElement = document.createElement('div');
            if (this.#eventClassName !== '') {
                litEventElement.classList.add(...this.#eventClassName.split(' '));
            }
            litEventElement.style.backgroundColor = celebrationColor[0];
            litEventElement.style.color = LiturgyOfTheDay.#highContrast.includes(celebrationColor[0]) ? "white" : "black";

            const eventNameElement = document.createElement('h3');
            eventNameElement.textContent = celebration.name;
            litEventElement.appendChild(eventNameElement);

            if (celebrationGrade !== '') {
                const celebrationGradeElement = document.createElement('div');
                if (this.#eventGradeClassName !== '') {
                    celebrationGradeElement.classList.add(...this.#eventGradeClassName.split(' '));
                }
                celebrationGradeElement.classList.add(`grade-${celebration.grade}`);
                celebrationGradeElement.textContent = celebrationGrade;
                litEventElement.appendChild(celebrationGradeElement);
            }

            if (celebration.common.length) {
                const celebrationCommonElement = document.createElement('div');
                if (this.#eventCommonClassName !== '') {
                    celebrationCommonElement.classList.add(...this.#eventCommonClassName.split(' '));
                }
                celebrationCommonElement.textContent = celebration.common_lcl;
                //celebrationCommonElement.style.fontStyle = 'italic';
                litEventElement.appendChild(celebrationCommonElement);
            }

            if (celebration.hasOwnProperty('liturgical_year')) {
                const celebrationLiturgicalYearElement = document.createElement('div');
                if (this.#eventYearCycleClassName !== '') {
                    celebrationLiturgicalYearElement.classList.add(...this.#eventYearCycleClassName.split(' '));
                }
                celebrationLiturgicalYearElement.textContent = celebration.liturgical_year;
                litEventElement.appendChild(celebrationLiturgicalYearElement);
            }

            this.#eventsElementsWrapper.appendChild(litEventElement);
        });
    }

    /**
     * Sets the id of the element.
     *
     * @param {string} id The id of the element
     * @throws {Error} if id is not a string
     * @throws {Error} if id is not a valid CSS selector
     * @returns {LiturgyOfTheDay} The current instance of LiturgyOfTheDay, allowing method chaining
     */
    id(id) {
        if (typeof id !== 'string') {
            throw new Error('LiturgyOfTheDay: Invalid type for id, must be of type string but found type: ' + typeof id);
        }
        if (false === LiturgyOfTheDay.#isValidId(id)) {
            throw new Error(`LiturgyOfTheDay: Invalid id ${id}, must be a valid CSS selector`);
        }
        this.#domElement.id = id;
        return this;
    }

    /**
     * Sets the class attribute for the LiturgyOfTheDay instance's DOM element.
     *
     * Validates the input class name(s) to ensure they are strings and conform to
     * CSS class naming conventions. If the class name is valid, it is sanitized
     * and assigned to the element.
     *
     * @param {string} className - A space-separated string of class names to be
     * assigned to the DOM element.
     * @throws {Error} If the className is not a string, or if any class name is
     * invalid.
     * @returns {LiturgyOfTheDay} The current LiturgyOfTheDay instance for chaining.
     */
    class(className) {
        if (typeof className !== 'string') {
            throw new Error('LiturgyOfTheDay: Invalid type for className, must be of type string but found type: ' + typeof className);
        }
        const classNames = className.split(/\s+/);
        classNames.forEach(className => {
            if (false === LiturgyOfTheDay.#isValidClassName(className)) {
                throw new Error('LiturgyOfTheDay: Invalid class name: ' + className);
            }
        });
        this.#domElement.classList.add(...classNames);
        return this;
    }

    /**
     * Sets the class attribute for the title element of the LiturgyOfTheDay instance.
     *
     * Validates the input class name(s) to ensure they are strings and conform to
     * CSS class naming conventions. If the class name is valid, it is sanitized
     * and added to the title element.
     *
     * @param {string} className - A space-separated string of class names to be
     * assigned to the title element.
     * @throws {Error} If the className is not a string, or if any class name is
     * invalid.
     * @returns {LiturgyOfTheDay} The current LiturgyOfTheDay instance for chaining.
     */
    titleClass(className) {
        if (typeof className !== 'string') {
            throw new Error('LiturgyOfTheDay.titleClass: Invalid type for className, must be of type string but found type: ' + typeof className);
        }
        const classNames = className.split(/\s+/);
        classNames.forEach(className => {
            if (false === LiturgyOfTheDay.#isValidClassName(className)) {
                throw new Error('LiturgyOfTheDay: Invalid class name: ' + className);
            }
        });
        this.#titleElement.classList.add(...classNames);
        return this;
    }

    /**
     * Sets the class attribute for the date element of the LiturgyOfTheDay instance.
     *
     * Validates the input class name(s) to ensure they are strings and conform to
     * CSS class naming conventions. If the class name is valid, it is sanitized
     * and added to the date element.
     *
     * @param {string} className - A space-separated string of class names to be
     * assigned to the date element.
     * @throws {Error} If the className is not a string, or if any class name is
     * invalid.
     * @returns {LiturgyOfTheDay} The current LiturgyOfTheDay instance for chaining.
     */
    dateClass(className) {
        if (typeof className !== 'string') {
            throw new Error('LiturgyOfTheDay.dateClass: Invalid type for className, must be of type string but found type: ' + typeof className);
        }
        const classNames = className.split(/\s+/);
        classNames.forEach(className => {
            if (false === LiturgyOfTheDay.#isValidClassName(className)) {
                throw new Error('LiturgyOfTheDay: Invalid class name: ' + className);
            }
        });
        this.#dateElement.classList.add(...classNames);
        return this;
    }

    /**
     * Sets the class attribute for the wrapper element of the LiturgyOfTheDay instance's events.
     *
     * Validates the input class name(s) to ensure they are strings and conform to
     * CSS class naming conventions. If the class name is valid, it is sanitized
     * and assigned to the element.
     *
     * @param {string} className - A space-separated string of class names to be
     * assigned to the events wrapper element.
     * @throws {Error} If the className is not a string, or if any class name is
     * invalid.
     * @returns {LiturgyOfTheDay} The current LiturgyOfTheDay instance for chaining.
     */
    eventsWrapperClass(className) {
        if (typeof className !== 'string') {
            throw new Error('LiturgyOfTheDay.eventsWrapperClass: Invalid type for className, must be of type string but found type: ' + typeof className);
        }
        const classNames = className.split(/\s+/);
        classNames.forEach(className => {
            if (false === LiturgyOfTheDay.#isValidClassName(className)) {
                throw new Error('LiturgyOfTheDay: Invalid class name: ' + className);
            }
        });
        this.#eventsElementsWrapper.classList.add(...classNames);
        return this;
    }

    /**
     * Sets the class attribute for the event elements of the LiturgyOfTheDay instance.
     *
     * Validates the input class name(s) to ensure they are strings and conform to
     * CSS class naming conventions. If the class name is valid, it is sanitized
     * and assigned to the event elements wrapper.
     *
     * @param {string} className - A space-separated string of class names to be
     * assigned to the event elements.
     * @throws {Error} If the className is not a string, or if any class name is
     * invalid.
     * @returns {LiturgyOfTheDay} The current LiturgyOfTheDay instance for chaining.
     */
    eventClass(className) {
        if (typeof className !== 'string') {
            throw new Error('LiturgyOfTheDay.eventsClass: Invalid type for className, must be of type string but found type: ' + typeof className);
        }
        const classNames = className.split(/\s+/);
        classNames.forEach(className => {
            if (false === LiturgyOfTheDay.#isValidClassName(className)) {
                throw new Error('LiturgyOfTheDay: Invalid class name: ' + className);
            }
        });
        this.#eventClassName = classNames.join(' ');
        return this;
    }

    eventGradeClass(className) {
        if (typeof className !== 'string') {
            throw new Error('LiturgyOfTheDay.eventGradeClass: Invalid type for className, must be of type string but found type: ' + typeof className);
        }
        const classNames = className.split(/\s+/);
        classNames.forEach(className => {
            if (false === LiturgyOfTheDay.#isValidClassName(className)) {
                throw new Error('LiturgyOfTheDay: Invalid class name: ' + className);
            }
        });
        this.#eventGradeClassName = classNames.join(' ');
        return this;
    }

    eventCommonClass(className) {
        if (typeof className !== 'string') {
            throw new Error('LiturgyOfTheDay.eventCommonClass: Invalid type for className, must be of type string but found type: ' + typeof className);
        }
        const classNames = className.split(/\s+/);
        classNames.forEach(className => {
            if (false === LiturgyOfTheDay.#isValidClassName(className)) {
                throw new Error('LiturgyOfTheDay: Invalid class name: ' + className);
            }
        });
        this.#eventCommonClassName = classNames.join(' ');
        return this;
    }

    eventYearCycleClass(className) {
        if (typeof className !== 'string') {
            throw new Error('LiturgyOfTheDay.eventYearCycleClass: Invalid type for className, must be of type string but found type: ' + typeof className);
        }
        const classNames = className.split(/\s+/);
        classNames.forEach(className => {
            if (false === LiturgyOfTheDay.#isValidClassName(className)) {
                throw new Error('LiturgyOfTheDay: Invalid class name: ' + className);
            }
        });
        this.#eventYearCycleClassName = classNames.join(' ');
        return this;
    }

    /**
     * Sets the LiturgyOfTheDay instance to listen to the `calendarFetched` event emitted by the ApiClient.
     *
     * Upon receiving the event, it processes the liturgical calendar data and updates the liturgical events
     * section of the component. The method will validate that the `apiClient` is an instance of ApiClient and
     * listen to the `calendarFetched` event on the client's event bus. When the event is triggered, it checks
     * the integrity of the received data, ensuring it contains the necessary properties and is of the correct type.
     * It then filters the liturgical calendar data to only include events that match the current date and updates
     * the internal state of the component.
     *
     * @param {ApiClient} apiClient - The API client to listen to for calendar data events.
     * @throws {Error} If the provided `apiClient` is not an instance of ApiClient or if the received
     * data is invalid or malformed.
     * @return {LiturgyOfTheDay} - Returns the instance of LiturgyOfTheDay for method chaining.
     */
    listenTo(apiClient) {
        if (false === apiClient instanceof ApiClient) {
            throw new Error('LiturgyOfTheDay.listenTo(apiClient) requires an instance of ApiClient, but found: ' + typeof apiClient + '.');
        }
        apiClient._eventBus.on('calendarFetched', async (data) => {
            if (typeof data !== 'object') {
                throw new Error('LiturgyOfTheDay: Invalid type for data received in `calendarFetched` event, must be of type object but found type: ' + typeof data);
            }
            if (!data.hasOwnProperty('litcal') || !Array.isArray(data.litcal) || data.litcal.length === 0) {
                throw new Error('LiturgyOfTheDay: Invalid liturgical calendar data received in `calendarFetched` event');
            }
            if (!data.hasOwnProperty('settings') || !data.hasOwnProperty('metadata') || !data.hasOwnProperty('messages')) {
                throw new Error('LiturgyOfTheDay: data received in `calendarFetched` event should have litcal, settings, metadata and messages properties');
            }
            const todaysTimestamp = this.#date.getTime();
            const todaysEvents = data.litcal.filter(event => {
                return new Date(event.date).getTime() === todaysTimestamp;
            });
            console.log('todaysEvents: ', todaysEvents);
            this.#updateEventDetails(todaysEvents);
        });
        return this;
    }

    /**
     * Appends the LiturgyOfTheDay instance to the element matched by the provided element selector.
     * This method does NOT return `this` - call it separately after configuring the component.
     *
     * @param {string|HTMLElement} elementSelector - The CSS selector for the element to which the LiturgyOfTheDay instance will be appended.
     * @throws {Error} If the type of elementSelector is not a string.
     * @throws {Error} If the element selector is invalid.
     * @throws {Error} If the element selector does not match any element.
     */
    appendTo(elementSelector) {
        if (elementSelector instanceof HTMLElement) {
            elementSelector.appendChild(this.#domElement);
        }
        else if (typeof elementSelector === 'string') {
            const element = LiturgyOfTheDay.#validateElementSelector(elementSelector);
            element.appendChild(this.#domElement);
        } else {
            throw new Error('LiturgyOfTheDay.appendTo(): invalid type for parameter, must be an instance of HTMLElement or a valid CSS selector');
        }
    }

    /**
     * Replaces the element matched by the provided element selector with the LiturgyOfTheDay instance.
     * This method does NOT return `this` - call it separately after configuring the component.
     *
     * @param {string|HTMLElement} elementSelector - The CSS selector for the element to be replaced.
     * @throws {Error} If the type of elementSelector is not a string.
     * @throws {Error} If the element selector is invalid.
     * @throws {Error} If the element selector does not match any element.
     */
    replace(elementSelector) {
        if (elementSelector instanceof HTMLElement) {
            elementSelector.replaceWith(this.#domElement);
        }
        else if (typeof elementSelector === 'string') {
            const element = LiturgyOfTheDay.#validateElementSelector(elementSelector);
            element.replaceWith(this.#domElement);
        } else {
            throw new Error('LiturgyOfTheDay.replaceWith(): invalid type for parameter, must be an instance of HTMLElement or a valid CSS selector');
        }
    }

    /**
     * Retrieves the underlying DOM element of the LiturgyOfTheDay instance.
     *
     * @returns {HTMLElement} The DOM element associated with the LiturgyOfTheDay instance.
     * @readonly
     */
    get _domElement() {
        return this.#domElement;
    }

    /**
     * Retrieves the underlying title element associated with the LiturgyOfTheDay instance.
     *
     * @returns {HTMLElement} The title element.
     * @readonly
     */
    get _titleElement() {
        return this.#titleElement;
    }

    /**
     * Retrieves the underlying date element associated with the LiturgyOfTheDay instance.
     *
     * @returns {HTMLElement} The date element.
     * @readonly
     */
    get _dateElement() {
        return this.#dateElement;
    }

    /**
     * Retrieves the underlying wrapper element for the liturgical events list.
     *
     * @returns {HTMLElement} The wrapper element for the liturgical events list.
     * @readonly
     */
    get _eventsElementsWrapper() {
        return this.#eventsElementsWrapper;
    }
}
