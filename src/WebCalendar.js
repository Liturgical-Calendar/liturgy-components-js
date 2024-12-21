import { Grouping, ColumnOrder, Column, ColorAs, DateFormat, GradeDisplay } from './WebCalendar/Enums.js';
import ColumnSet from './WebCalendar/ColumnSet.js';
import LitCalApiClient from './LitCalApiClient.js';
import Messages from './Messages.js';

export default class WebCalendar {
    #domElement = null;
    #locale = 'en-US';
    #baseLocale = 'en';
    /**
     * @type {{litcal: import('./typedefs.js').CalendarEvent[], settings: import('./typedefs.js').CalendarSettings, metadata: import('./typedefs.js').CalendarMetadata, messages: string[]}}
     */
    #calendarData = null;
    #daysCreated = 0;
    #firstColumnGrouping = Grouping.BY_MONTH;
    #eventColor = ColorAs.INDICATOR;
    #seasonColor = ColorAs.BACKGROUND;
    #seasonColorColumns = new ColumnSet(Column.LITURGICAL_SEASON | Column.MONTH | Column.DATE | Column.PSALTER_WEEK);
    #eventColorColumns = new ColumnSet(Column.EVENT | Column.GRADE);
    #columnOrder = ColumnOrder.EVENT_DETAILS_FIRST;
    /**
     * @type {DateFormat}
     */
    #dateFormat = DateFormat.FULL;
    /**
     * @type {GradeDisplay}
     */
    #gradeDisplay = GradeDisplay.FULL;
    #removeHeaderRow = false;
    #removeCaption = false;
    #psalterWeekGrouping = false;
    #monthHeader = false;
    #attachedElement = null;
    #lastSeasonCell = null;
    #lastPsalterWeekCell = null;
    #monthFmt = new Intl.DateTimeFormat(this.#locale, { month: 'long', timeZone: 'UTC' });
    #dateFmt = new Intl.DateTimeFormat(this.#locale, { dateStyle: this.#dateFormat, timeZone: 'UTC' });

    static #HIGH_CONTRAST = Object.freeze(['purple', 'red', 'green']);

    static #DAYS_OF_THE_WEEK_LATIN = Object.freeze([
        "dies Solis",
        "dies Lunæ",
        "dies Martis",
        "dies Mercurii",
        "dies Iovis",
        "dies Veneris",
        "dies Saturni"
    ]);

    static #MONTHS_LATIN = Object.freeze([
        "",
        "Ianuarius",
        "Februarius",
        "Martius",
        "Aprilis",
        "Maius",
        "Iunius",
        "Iulius",
        "Augustus",
        "September",
        "October",
        "November",
        "December"
    ]);

    static #PSALTER_WEEK = Object.freeze([
        '', 'I', 'II', 'III', 'IV'
    ]);

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

    constructor(options = {}) {
        this.#domElement = document.createElement('table');
        if (typeof options !== 'object') {
            throw new Error('Invalid type for options on WebCalendar instance, must be of type object but found type: ' + typeof options);
        }
        if (options.hasOwnProperty('class')) {
            this.className(options.class);
        }
        if (options.hasOwnProperty('id')) {
            this.id(options.id);
        }
        if (options.hasOwnProperty('firstColumnGrouping')) {
            this.firstColumnGrouping(options.firstColumnGrouping);
        }
        if (options.hasOwnProperty('removeHeaderRow')) {
            this.removeHeaderRow(options.removeHeaderRow);
        }
        if (options.hasOwnProperty('removeCaption')) {
            this.removeCaption(options.removeCaption);
        }
        if (options.hasOwnProperty('psalterWeekGrouping')) {
            this.psalterWeekGrouping(options.psalterWeekGrouping);
        }
        if (options.hasOwnProperty('eventColor')) {
            this.eventColor(options.eventColor);
        }
        if (options.hasOwnProperty('seasonColor')) {
            this.seasonColor(options.seasonColor);
        }
        if (options.hasOwnProperty('seasonColorColumns')) {
            this.seasonColorColumns(options.seasonColorColumns);
        }
        if (options.hasOwnProperty('eventColorColumns')) {
            this.eventColorColumns(options.eventColorColumns);
        }
        if (options.hasOwnProperty('monthHeader')) {
            this.monthHeader(options.monthHeader);
        }
        if (options.hasOwnProperty('dateFormat')) {
            this.dateFormat(options.dateFormat);
        }
        if (options.hasOwnProperty('columnOrder')) {
            this.columnOrder(options.columnOrder);
        }
        if (options.hasOwnProperty('gradeDisplay')) {
            this.gradeDisplay(options.gradeDisplay);
        }
    }

    /**
     * Sets the class attribute for the WebCalendar instance's DOM element.
     *
     * Validates the input class name(s) to ensure they are strings and conform to
     * CSS class naming conventions. If the class name is valid, it is sanitized
     * and assigned to the element. If the class name is an empty string, the
     * class attribute is removed.
     *
     * @param {string} className - A space-separated string of class names to be
     * assigned to the DOM element.
     * @throws {Error} If the className is not a string, or if any class name is
     * invalid.
     * @returns {WebCalendar} The current WebCalendar instance for chaining.
     */
    className( className ) {
        if ( typeof className !== 'string' ) {
            throw new Error('Invalid type for class name on WebCalendar instance, must be of type string but found type: ' + typeof className);
        }
        if ( this.#domElement === null ) {
            throw new Error('Cannot set class name before dom element is initialized');
        }
        let classNames = className.split( /\s+/ );
        classNames = classNames.map( className => WebCalendar.#sanitizeInput( className ) );
        classNames.forEach(className => {
            if ( false === WebCalendar.#isValidClassName( className ) ) {
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
     * Sets the id attribute for the WebCalendar instance's DOM element.
     *
     * Validates the input id to ensure it is a string and conforms to
     * HTML id attribute naming conventions. If the id is valid, it is sanitized
     * and assigned to the element. If the id is an empty string, the
     * id attribute is removed.
     *
     * @param {string} id - A string to be assigned to the id attribute of the DOM element.
     * @throws {Error} If the id is not a string, or if the id is invalid.
     * @returns {WebCalendar} The current WebCalendar instance for chaining.
     */
    id( id ) {
        if ( typeof id !== 'string' ) {
            throw new Error('Invalid type for id, must be of type string but found type: ' + typeof id);
        }
        if ( this.#domElement === null ) {
            throw new Error('Cannot set class name before dom element is initialized');
        }
        id = WebCalendar.#sanitizeInput( id );
        if (WebCalendar.#isValidId( id ) === false) {
            throw new Error('Invalid id, cannot contain any kind of whitespace character: ' + id);
        }
        this.#domElement.id = id;
        return this;
    }

    /**
     * Sets the date format for the table.
     *
     * This method sets the format for the dates in the table. The following formats are supported:
     * - FULL: The full date format for the locale, e.g. "Friday, March 3, 2023" or "venerdì 3 marzo 2023".
     * - LONG: The long date format for the locale, e.g. "March 3, 2023" or "3 marzo 2023".
     * - MEDIUM: The medium date format for the locale, e.g. "Mar 3, 2023" or "3 mar 2023".
     * - SHORT: The short date format for the locale, e.g. "3/3/23" or "03/03/23".
     * - DAY_ONLY: Only the day of the month and the weekday, e.g. "3 Friday" or "3 venerdì".
     *
     * The default is DateFormat::FULL.
     *
     * @param {DateFormat} dateFormat The date format to use.
     * @throws {Error} If the input is not a string, or if the date format is not recognized.
     * @returns {WebCalendar} The current instance of the class.
     */
    dateFormat(dateFormat) {
        if (typeof dateFormat !== 'string') {
            throw new Error('Invalid type for date format, must be of type string but found type: ' + typeof dateFormat);
        }
        if (!Object.values(DateFormat).includes(dateFormat)) {
            throw new Error('Invalid date format: ' + dateFormat);
        }
        this.#dateFormat = dateFormat;
        if (this.#dateFormat === DateFormat.DAY_ONLY) {
            this.#dateFmt = new Intl.DateTimeFormat(this.#locale, { day: 'numeric', weekday: 'long', timeZone: 'UTC' });
        } else {
            this.#dateFmt = new Intl.DateTimeFormat(this.#locale, { dateStyle: this.#dateFormat, timeZone: 'UTC' });
        }
        return this;
    }

    /**
     * Sets whether or not the caption should be removed from the table.
     *
     * This method controls whether or not the caption element is
     * generated by the {@link WebCalendar.buildTable()} method. The default is true, meaning
     * that the caption should not be generated (= should be removed).
     *
     * @param {boolean} removeCaption Whether the caption should be removed or not.
     *
     * @throws {Error} If the input is not a boolean.
     * @returns {WebCalendar} The current instance of the class.
     */
    removeCaption(removeCaption = true) {
        if (typeof removeCaption !== 'boolean') {
            throw new Error('Invalid type for remove caption, must be of type boolean but found type: ' + typeof removeCaption);
        }
        this.#removeCaption = removeCaption;
        return this;
    }

    /**
     * Sets whether or not the header row should be removed from the table.
     *
     * This method controls whether or not the header row is
     * generated by the {@link WebCalendar.buildTable()} method. The default is true, meaning
     * that the header row should not be generated (= should be removed).
     *
     * @param {boolean} removeHeaderRow Whether the header row should be removed or not.
     *
     * @throws {Error} If the input is not a boolean.
     * @returns {WebCalendar} The current instance of the class.
     */
    removeHeaderRow(removeHeaderRow = true) {
        if (typeof removeHeaderRow !== 'boolean') {
            throw new Error('Invalid type for remove header row, must be of type boolean but found type: ' + typeof removeHeaderRow);
        }
        this.#removeHeaderRow = removeHeaderRow;
        return this;
    }

    /**
     * Sets the grouping for the first column.
     *
     * This method sets the grouping for the first column of the table.
     * The following groupings are supported:
     * - Grouping.BY_MONTH: the first column will contain month groupings
     * - Grouping.BY_LITURGICAL_SEASON: the first column will contain liturgical season groupings
     *
     * The default is Grouping.BY_LITURGICAL_SEASON.
     *
     * @param {Grouping} firstColumnGrouping The grouping to use for the first column.
     * @throws {Error} If the input is not a valid Grouping.
     * @returns {WebCalendar} The current instance of the class.
     */
    firstColumnGrouping(firstColumnGrouping) {
        if (!Object.values(Grouping).includes(firstColumnGrouping)) {
            throw new Error('Invalid first column grouping: ' + firstColumnGrouping);
        }
        this.#firstColumnGrouping = firstColumnGrouping;
        return this;
    }

    /**
     * Sets the order of the third and fourth columns.
     *
     * This method sets the order of the third and fourth columns of the table.
     * The following orders are supported:
     * - ColumnOrder.GRADE_FIRST: the third column will contain the liturgical grade and the fourth column the event details
     * - ColumnOrder.EVENT_DETAILS_FIRST: the third column will contain the event details and the fourth column the liturgical grade
     *
     * The default is ColumnOrder.EVENT_DETAILS_FIRST.
     *
     * @param {ColumnOrder} columnOrder The order of the third and fourth columns.
     * @throws {Error} If the input is not a valid ColumnOrder.
     * @returns {WebCalendar} The current instance of the class.
     */
    columnOrder(columnOrder) {
        if (!Object.values(ColumnOrder).includes(columnOrder)) {
            throw new Error('Invalid column order: ' + columnOrder);
        }
        this.#columnOrder = columnOrder;
        return this;
    }

    /**
     * Sets whether or not the psalter week grouping should be applied.
     *
     * This method sets whether or not the psalter week grouping should be applied
     * to the table. The psalter week grouping groups events by psalter week.
     * The psalter week is a number from 1 to 4 that indicates the week of Ordinary Time
     * or the week of a seasonal week (Advent, Christmas, Lent, Easter).
     *
     * The default is true, meaning that the psalter week grouping should be applied.
     *
     * @param {boolean} psalterWeekGrouping Whether the psalter week grouping should be applied or not.
     *
     * @throws {Error} If the input is not a boolean.
     * @returns {WebCalendar} The current instance of the class.
     */
    psalterWeekGrouping(psalterWeekGrouping = true) {
        if (typeof psalterWeekGrouping !== 'boolean') {
            throw new Error('Invalid type for psalter week grouping, must be of type boolean but found type: ' + typeof psalterWeekGrouping);
        }
        this.#psalterWeekGrouping = psalterWeekGrouping;
        return this;
    }

    /**
     * Sets how the color of a single liturgical event is applied to the table.
     *
     * This method sets how the color of a single liturgical event is applied to the table.
     * The following options are supported:
     * - ColorAs.BACKGROUND: the color of the event is applied as the background color of the table cells
     * - ColorAs.CSS_CLASS: the color of the event is applied as a CSS class to the table cells
     * - ColorAs.INDICATOR: the color of the event is applied as a small 10px inline block element with radius 5px
     *
     * The default is ColorAs.INDICATOR.
     *
     * @param {ColorAs} eventColor The color representation to use for the events.
     * @throws {Error} If the input is not a valid ColorAs.
     * @returns {WebCalendar} The current instance of the class.
     */
    eventColor(eventColor) {
        if (!Object.values(ColorAs).includes(eventColor)) {
            throw new Error('Invalid event color: ' + eventColor);
        }
        this.#eventColor = eventColor;
        return this;
    }

    /**
     * Sets how the color of a liturgical season is applied to the table.
     *
     * This method sets how the color of a liturgical season is applied to the table.
     * The following options are supported:
     * - ColorAs.BACKGROUND: the color of the season is applied as the background color of the table cells
     * - ColorAs.CSS_CLASS: the color of the season is applied as a CSS class to the table cells
     * - ColorAs.INDICATOR: the color of the season is applied as a small 10px inline block element with radius 5px
     *
     * The default is ColorAs.BACKGROUND.
     *
     * @param {ColorAs} seasonColor The color representation to use for the seasons.
     * @throws {Error} If the input is not a valid ColorAs.
     * @returns {WebCalendar} The current instance of the class.
     */
    seasonColor(seasonColor) {
        if (!Object.values(ColorAs).includes(seasonColor)) {
            throw new Error('Invalid season color: ' + seasonColor);
        }
        this.#seasonColor = seasonColor;
        return this;
    }

    /**
     * Sets which columns to apply the season color to.
     *
     * This method sets the columns to which the season color will be applied.
     * The input should be a number representing a bitfield of column flags.
     * The following columns are supported:
     * - Column.LITURGICAL_SEASON
     * - Column.MONTH
     * - Column.DATE
     * - Column.EVENT
     * - Column.GRADE
     * - Column.PSALTER_WEEK
     * - Column.ALL
     * - Column.NONE
     *
     * The default is Column.ALL.
     *
     * @param {number} seasonColorColumns The column flags to set.
     * @throws {Error} If the input is not a valid column flags.
     * @returns {WebCalendar} The current instance of the class.
     */
    seasonColorColumns(seasonColorColumns) {
        if (typeof seasonColorColumns !== 'number') {
            throw new Error('Invalid type for season color columns, must be of type number but found type: ' + typeof seasonColorColumns);
        }
        if ((seasonColorColumns & Column.ALL) === 0) {
            throw new Error('Invalid season color columns: ' + seasonColorColumns);
        }
        this.#seasonColorColumns.set(seasonColorColumns);
        return this;
    }

    /**
     * Sets which columns are affected by the event color settings.
     *
     * This method configures the columns to which the event color will be applied in the calendar.
     * The input should be a number representing a bitfield of column flags. The method ensures
     * that the provided flag is valid and sets it for event color application.
     *
     * @param {number} eventColorColumns The column flags to apply event color to.
     * @throws {Error} If the input is not a number or if it does not represent valid column flags.
     * @returns {WebCalendar} The current instance of the class for chaining.
     */
    eventColorColumns(eventColorColumns) {
        if (typeof eventColorColumns !== 'number') {
            throw new Error('Invalid type for event color columns, must be of type number but found type: ' + typeof eventColorColumns);
        }
        if ((eventColorColumns & Column.ALL) === 0) {
            throw new Error('Invalid event color columns: ' + eventColorColumns);
        }
        this.#eventColorColumns.set(eventColorColumns);
        return this;
    }

    /**
     * Controls whether or not month headers are displayed in the table.
     *
     * This method controls whether or not month headers are displayed
     * in the calendar table.
     * The default is true, meaning that month headers should be included.
     *
     * @param {boolean} [monthHeader=true] Whether or not to include month headers in the table.
     *
     * @throws {Error} If the input is not a boolean.
     * @returns {WebCalendar} The current instance of the class.
     */
    monthHeader(monthHeader = true) {
        if (typeof monthHeader !== 'boolean') {
            throw new Error('Invalid type for month header, must be of type boolean but found type: ' + typeof monthHeader);
        }
        this.#monthHeader = monthHeader;
        return this;
    }

    /**
     * Sets how the liturgical grade is displayed in the table.
     *
     * The liturgical grade can be displayed in full or abbreviated form.
     * The following options are supported:
     * - GradeDisplay.FULL: the grade is displayed with its full rank
     * - GradeDisplay.ABBREVIATED: the grade is displayed with an abbreviated rank
     *
     * The default is GradeDisplay.FULL.
     *
     * @param {GradeDisplay} gradeDisplay The grade display.
     * @throws {Error} If the input is not a valid GradeDisplay.
     * @returns {WebCalendar} The current instance of the class.
     */
    gradeDisplay(gradeDisplay) {
        if (!Object.values(GradeDisplay).includes(gradeDisplay)) {
            throw new Error('Invalid grade display: ' + gradeDisplay);
        }
        this.#gradeDisplay = gradeDisplay;
        return this;
    }

    /**
     * Sets the locale for the WebCalendar instance.
     *
     * The locale determines the language and regional settings for date formatting
     * within the calendar. It configures month and date formatters based on the
     * specified locale. If the date format is set to DAY_ONLY, it will format the
     * date to show the day of the month and the full weekday name; otherwise, it
     * uses the configured date style.
     *
     * @param {string} locale - The locale identifier to set, following BCP 47 language tag format.
     * @throws {Error} If the provided locale is not a string or an invalid locale identifier.
     * @returns {WebCalendar} The current instance of the class for method chaining.
     */
    locale(locale) {
        if (typeof locale !== 'string') {
            throw new Error('Invalid type for locale, must be of type string but found type: ' + typeof locale);
        }
        try {
            const testLocale = new Intl.Locale(locale);
            this.#locale = locale;
            this.#baseLocale = testLocale.language;
            this.#monthFmt = new Intl.DateTimeFormat(this.#locale, { month: 'long', timeZone: 'UTC' });
            if (this.#dateFormat === DateFormat.DAY_ONLY) {
                this.#dateFmt = new Intl.DateTimeFormat(this.#locale, { day: 'numeric', weekday: 'long', timeZone: 'UTC' });
            } else {
                this.#dateFmt = new Intl.DateTimeFormat(this.#locale, { dateStyle: this.#dateFormat, timeZone: 'UTC' });
            }
        } catch (e) {
            throw new Error('Invalid locale identifier: ' + locale);
        }
        return this;
    }

    /**
     * Recursively counts the number of subsequent liturgical events in the same day.
     *
     * @param {int} eventIdx The current position in the array of liturgical events on the given day.
     * @param {import('./typedefs.js').Counter} counter [counter.cd] The count of subsequent liturgical events in the same day.
     */
    #countSameDayEvents(eventIdx, counter) {
        return new Promise((resolve) => {
            const currentEvent = this.#calendarData.litcal[eventIdx];
            const nextEventIdx = eventIdx + 1;
            if (nextEventIdx < this.#calendarData.litcal.length) {
                const nextEvent = this.#calendarData.litcal[nextEventIdx];
                if (nextEvent.date.getTime() === currentEvent.date.getTime()) {
                    counter.cd++;
                    this.#countSameDayEvents(nextEventIdx, counter).then(resolve);
                } else {
                    resolve();
                }
            } else {
                resolve();
            }
        });
    }

    /**
     * Recursively counts the number of subsequent liturgical events in the same month.
     *
     * @param {int} eventIdx  The current position in the array of liturgical events on the given month.
     * @param {import('./typedefs.js').Counter} counter [counter.cm] The count of subsequent liturgical events in the same month
     */
    #countSameMonthEvents(eventIdx, counter) {
        return new Promise((resolve) => {
            const currentEvent = this.#calendarData.litcal[eventIdx];
            const nextEventIdx = eventIdx + 1;
            if (nextEventIdx < this.#calendarData.litcal.length) {
                const nextEvent = this.#calendarData.litcal[nextEventIdx];
                if (nextEvent.date.getMonth() === currentEvent.date.getMonth()) {
                    counter.cm++;
                    this.#countSameMonthEvents(nextEventIdx, counter).then(resolve);
                } else {
                    resolve();
                }
            } else {
                resolve();
            }
        });
    }

    /**
     * Recursively counts the number of subsequent liturgical events in the same liturgical season.
     *
     * @param {int} eventIdx The current position in the array of liturgical events in the given liturgical season.
     * @param {import('./typedefs.js').Counter} counter [counter.cs] The count of subsequent liturgical events in the same liturgical season.
     */
    #countSameSeasonEvents(eventIdx, counter) {
        return new Promise((resolve) => {
            const currentEvent = this.#calendarData.litcal[eventIdx];
            const nextEventIdx = eventIdx + 1;
            if (nextEventIdx < this.#calendarData.litcal.length) {
                const nextEvent = this.#calendarData.litcal[nextEventIdx];
                const currentEventLiturgicalSeason = currentEvent.liturgical_season ?? this.#determineSeason(currentEvent);
                const nextEventLiturgicalSeason = nextEvent.liturgical_season ?? this.#determineSeason(nextEvent);
                if (nextEventLiturgicalSeason === currentEventLiturgicalSeason) {
                    counter.cs++;
                    this.#countSameSeasonEvents(nextEventIdx, counter).then(resolve);
                } else {
                    resolve();
                }
            } else {
                resolve();
            }
        });
    }

    /**
     * Recursively counts the number of subsequent liturgical events in the same psalter week.
     *
     * @param {int} eventIdx The current position in the array of liturgical events on the given psalter week.
     * @param {import('./typedefs.js').Counter} counter [counter.cw] The count of subsequent liturgical events in the same psalter week.
     */
    #countSamePsalterWeekEvents(eventIdx, counter) {
        return new Promise((resolve) => {
            const currentEvent = this.#calendarData.litcal[eventIdx];
            const nextEventIdx = eventIdx + 1;
            if (nextEventIdx < this.#calendarData.litcal.length ) {
                const nextEvent = this.#calendarData.litcal[nextEventIdx];
                // cepsw = current event psalter week
                const cepsw = currentEvent.psalter_week;
                // nepsw = next event psalter week
                const nepsw = nextEvent.psalter_week;
                // We try to keep together valid psalter week values,
                // while we break up invalid psalter week values
                // unless the invalid values fall on the same day
                // IF the next event's psalter week is the same as the current event's psalter week
                // AND either:
                //      * the next event's psalter week is within the valid Psalter week values of 1-4 (is not 0)
                //      * OR the next event is on the same day as the current event
                if (nepsw === cepsw && (nepsw !== 0 || currentEvent.date.getTime() === nextEvent.date.getTime())) {
                    counter.cw++;
                    this.#countSamePsalterWeekEvents(nextEventIdx, counter).then(resolve);
                } else {
                    // resolve the promise
                    resolve();
                }
            } else {
                // resolve the promise
                resolve();
            }
        });
    }

    /**
     *
     * @param {import('./typedefs.js').CalendarEvent} litevent
     * @returns
     */
    #determineSeason(litevent) {
        if (litevent.date >= this.#calendarData.litcal.AshWednesday.date && litevent.date < this.#calendarData.litcal.HolyThurs.date) {
            return 'LENT';
        }
        if (litevent.date >= this.#calendarData.litcal.HolyThurs.date && litevent.date < this.#calendarData.litcal.Easter.date) {
            return 'EASTER_TRIDUUM';
        }
        if (litevent.date >= this.#calendarData.litcal.Easter.date && litevent.date < this.#calendarData.litcal.Pentecost.date) {
            return 'EASTER';
        }
        if (litevent.date >= this.#calendarData.litcal.Advent1.date && litevent.date < this.#calendarData.litcal.Christmas.date) {
            return 'ADVENT';
        }
        if (litevent.date > this.#calendarData.litcal.BaptismLord.date && litevent.date < this.#calendarData.litcal.AshWednesday.date) {
            return 'ORDINARY_TIME';
        }

        // Handle Saturday of 34th week of Ordinary Time
        let Saturday34thWeekOrdTime = new Date(this.#calendarData.litcal.ChristKing.date);
        Saturday34thWeekOrdTime.setDate(Saturday34thWeekOrdTime.getDate() + (6 - Saturday34thWeekOrdTime.getDay()));

        if (litevent.date > this.#calendarData.litcal.Pentecost.date && litevent.date <= Saturday34thWeekOrdTime) {
            return 'ORDINARY_TIME';
        }

        // Handle Liturgical year type edge case
        if (this.#calendarData.settings.year_type === 'LITURGICAL') {
            if (litevent.date.getTime() === this.#calendarData.litcal.Advent1_vigil.date.getTime()) {
                return 'ADVENT';
            }
        }

        return 'CHRISTMAS';
    }

    #getSeasonColor(litEvent) {
        switch (litEvent.liturgical_season) {
            case 'ADVENT':
            case 'LENT':
            case 'EASTER_TRIDUUM':
                return 'purple';
            case 'EASTER':
            case 'CHRISTMAS':
                return 'white';
            case 'ORDINARY_TIME':
            default:
                return 'green';
        }
    }

    #handleSeasonColorForColumn(seasonColor, cell, columnFlag) {
        if (this.#seasonColorColumns.has(columnFlag)) {
            switch(this.#seasonColor) {
                case ColorAs.BACKGROUND:
                    cell.style.backgroundColor = seasonColor;
                    if (WebCalendar.#HIGH_CONTRAST.includes(seasonColor)) {
                        cell.style.color = 'white';
                    }
                    break;
                case ColorAs.CSS_CLASS:
                    cell.classList.add(seasonColor);
                    break;
                case ColorAs.INDICATOR:
                    let colorSpan = document.createElement('span');
                    colorSpan.style.backgroundColor = seasonColor;
                    colorSpan.style.width = '10px';
                    colorSpan.style.height = '10px';
                    colorSpan.style.display = 'inline-block';
                    colorSpan.style.border = '1px solid black';
                    colorSpan.style.borderRadius = '5px';
                    colorSpan.style.marginRight = '5px';
                    cell.insertBefore(colorSpan, cell.firstChild);
                    break;
            }
        }
    }

    #handleEventColorForColumn(eventColor, cell, columnFlag) {
        if (typeof eventColor === 'string') {
            eventColor = [eventColor];
        }
        if (this.#eventColorColumns.has(columnFlag)) {
            switch(this.#eventColor) {
                case ColorAs.BACKGROUND:
                    cell.style.backgroundColor = eventColor[0];
                    if (WebCalendar.#HIGH_CONTRAST.includes(eventColor[0])) {
                        cell.style.color = 'white';
                    }
                    break;
                case ColorAs.CSS_CLASS:
                    cell.classList.add(eventColor[0]);
                    break;
                case ColorAs.INDICATOR:
                    eventColor.forEach(color => {
                        let colorSpan = document.createElement('span');
                        colorSpan.style.backgroundColor = color;
                        colorSpan.style.width = '10px';
                        colorSpan.style.height = '10px';
                        colorSpan.style.display = 'inline-block';
                        colorSpan.style.border = '1px solid black';
                        colorSpan.style.borderRadius = '5px';
                        colorSpan.style.marginRight = '5px';
                        cell.insertBefore(colorSpan, cell.firstChild);
                    });
                    break;
            }
        }
    }

    #buildTableRow(litevent, newCheck, counter, ev) {
        const seasonColor = this.#getSeasonColor(litevent);
        let monthHeaderRow = null;
        const tr = document.createElement('tr');

        // First column in Month or Liturgical Season
        if (newCheck.newMonth || newCheck.newSeason) {
            if (newCheck.newMonth && this.#firstColumnGrouping === Grouping.BY_MONTH) {
                let firstColRowSpan = counter.cm + 1;
                if (this.#monthHeader) {
                    firstColRowSpan++;
                    monthHeaderRow = document.createElement('tr');
                    const monthHeaderCell = document.createElement('td');
                    monthHeaderCell.setAttribute('colspan', 3);
                    monthHeaderCell.setAttribute('class', 'monthHeader');
                    monthHeaderCell.appendChild(document.createTextNode(this.#monthFmt.format(litevent.date)));
                }
                const firstColCell = document.createElement('td');
                firstColCell.setAttribute('rowspan', firstColRowSpan);
                firstColCell.setAttribute('class', 'rotate month');
                this.#handleSeasonColorForColumn(seasonColor, firstColCell, Column.MONTH);
                this.#handleEventColorForColumn(litevent.color, firstColCell, Column.MONTH);
                const textNode = this.#baseLocale === 'la'
                    ? WebCalendar.#MONTHS_LATIN[litevent.date.getMonth() + 1].toUpperCase()
                    : this.#monthFmt.format(litevent.date).toUpperCase();
                const div = document.createElement('div');
                div.appendChild(document.createTextNode(textNode));
                firstColCell.appendChild(div);
                if (this.#monthHeader) {
                    monthHeaderRow.appendChild(firstColCell);
                    monthHeaderRow.appendChild(monthHeaderCell);
                } else {
                    tr.appendChild(firstColCell);
                }
            }
            if (newCheck.newSeason && this.#firstColumnGrouping === Grouping.BY_LITURGICAL_SEASON) {
                let firstColRowSpan = counter.cs + 1;
                const firstColCell = document.createElement('td');
                if (this.#monthHeader) {
                    this.#lastSeasonCell = firstColCell;
                }
                firstColCell.setAttribute('rowspan', firstColRowSpan);
                firstColCell.setAttribute('class', `rotate season ${litevent.liturgical_season}`);
                this.#handleSeasonColorForColumn(seasonColor, firstColCell, Column.LITURGICAL_SEASON);
                this.#handleEventColorForColumn(litevent.color, firstColCell, Column.LITURGICAL_SEASON);
                const div = document.createElement('div');
                div.appendChild(document.createTextNode(litevent.liturgical_season_lcl ?? ''));
                firstColCell.appendChild(div);
                if (this.#monthHeader && newCheck.newMonth) {
                    firstColRowSpan++;
                    firstColCell.setAttribute('rowspan', firstColRowSpan);
                    monthHeaderRow = document.createElement('tr');
                    const monthHeaderCell = document.createElement('td');
                    monthHeaderCell.setAttribute('colspan', 3);
                    monthHeaderCell.setAttribute('class', 'monthHeader');
                    monthHeaderCell.appendChild(document.createTextNode(this.#monthFmt.format(litevent.date)));
                    monthHeaderRow.appendChild(firstColCell);
                    monthHeaderRow.appendChild(monthHeaderCell);
                } else {
                    tr.appendChild(firstColCell);
                }
            }
            if (false === newCheck.newSeason && newCheck.newMonth && this.#monthHeader && this.#firstColumnGrouping === Grouping.BY_LITURGICAL_SEASON) {
                const firstColCellRowSpan = this.#lastSeasonCell.getAttribute('rowspan');
                this.#lastSeasonCell.setAttribute('rowspan', parseInt(firstColCellRowSpan) + 1);
                monthHeaderRow = document.createElement('tr');
                const monthHeaderCell = document.createElement('td');
                monthHeaderCell.setAttribute('colspan', 3);
                monthHeaderCell.setAttribute('class', 'monthHeader');
                monthHeaderCell.appendChild(document.createTextNode(this.#monthFmt.format(litevent.date)));
                monthHeaderRow.appendChild(monthHeaderCell);
            }
            newCheck.newMonth = false;
            newCheck.newSeason = false;
        }

        // Second column is Date
        let dateStr = '';
        switch (this.#baseLocale) {
            case 'la':
                let dayOfTheWeek = litevent.date.getDay(); // 0-Sunday to 6-Saturday
                let dayOfTheWeekLatin = WebCalendar.#DAYS_OF_THE_WEEK_LATIN[dayOfTheWeek];
                let month = litevent.date.getMonth() + 1; // 0-January to 11-December
                let monthLatin = WebCalendar.#MONTHS_LATIN[month];
                dateStr = `${dayOfTheWeekLatin} ${litevent.date.getDate()} ${monthLatin} ${litevent.date.getFullYear()}`;
                break;
            default:
                dateStr = this.#dateFmt.format(litevent.date);
        }

        // We only need to "create" the dateEntry cell on first iteration of events within the same day (0 === $ev),
        // or when there is only one event for the day (null === $ev).
        // When there is only one event for the day, we need not set the rowspan.
        // When there are multiple events, we set the rowspan based on the total number of events within the day ($cd "count day events").
        if (0 === ev || null === ev) {
            const dateCell = document.createElement('td');
            dateCell.setAttribute('class', 'dateEntry');
            this.#handleSeasonColorForColumn(seasonColor, dateCell, Column.DATE);
            this.#handleEventColorForColumn(litevent.color, dateCell, Column.DATE);
            dateCell.appendChild(document.createTextNode(dateStr));
            if (0 === ev) {
                dateCell.setAttribute('rowspan', counter.cd + 1);
            }
            tr.appendChild(dateCell);
        }

        // Third column is Event Details
        let currentCycle = litevent.hasOwnProperty('liturgical_year') && litevent.liturgical_year !== null
            ? ' (' + litevent.liturgical_year + ')'
            : '';
        const eventDetailsCell = document.createElement('td');
        eventDetailsCell.setAttribute('class', 'eventDetails liturgicalGrade_' + litevent.grade);
        this.#handleSeasonColorForColumn(seasonColor, eventDetailsCell, Column.EVENT_DETAILS);
        this.#handleEventColorForColumn(litevent.color, eventDetailsCell, Column.EVENT_DETAILS);
        const fragmentContents = `${litevent.name}${currentCycle} - <i>${litevent.color_lcl.join(` ${Messages[this.#baseLocale]['OR']} `)}</i><br><i>${litevent.common_lcl}</i>`;
        const eventDetailsContents = document.createRange().createContextualFragment(fragmentContents);
        eventDetailsCell.appendChild(eventDetailsContents);

        // Fourth column is Liturgical Grade
        let displayGrade = litevent.grade_display !== null ? litevent.grade_display : litevent.grade_lcl;
        if (this.#gradeDisplay === GradeDisplay.ABBREVIATED && litevent.grade_display !== '') {
            displayGrade = litevent.grade_abbr;
        }
        const liturgicalGradeCell = document.createElement('td');
        liturgicalGradeCell.setAttribute('class', 'liturgicalGrade liturgicalGrade_' + litevent.grade);
        this.#handleSeasonColorForColumn(seasonColor, liturgicalGradeCell, Column.GRADE);
        this.#handleEventColorForColumn(litevent.color, liturgicalGradeCell, Column.GRADE);
        liturgicalGradeCell.appendChild(document.createTextNode(displayGrade));

        // Third and fourth column order depends on the column order setting
        switch (this.#columnOrder) {
            case ColumnOrder.GRADE_FIRST:
                tr.appendChild(liturgicalGradeCell);
                tr.appendChild(eventDetailsCell);
                break;
            case ColumnOrder.EVENT_DETAILS_FIRST:
                tr.appendChild(eventDetailsCell);
                tr.appendChild(liturgicalGradeCell);
                break;
        }

        // Fifth column is Psalter Week if Psalter week grouping is enabled
        if (this.#psalterWeekGrouping && false === newCheck.newPsalterWeek && null !== monthHeaderRow) {
            const psalterWeekCellRowSpan = this.#lastPsalterWeekCell.getAttribute('rowspan');
            this.#lastPsalterWeekCell.setAttribute('rowspan', parseInt(psalterWeekCellRowSpan) + 1);
        }
        if (this.#psalterWeekGrouping && newCheck.newPsalterWeek) {
            const psalterWeekCell = document.createElement('td');
            psalterWeekCell.setAttribute('class', 'psalterWeek');
            this.#lastPsalterWeekCell = psalterWeekCell;
            /** @type {string} The Roman numeral version of the Psalter week */
            const romNumPsalterWeek = WebCalendar.#PSALTER_WEEK[litevent.psalter_week];
            this.#handleSeasonColorForColumn(seasonColor, psalterWeekCell, Column.PSALTER_WEEK);
            this.#handleEventColorForColumn(litevent.color, psalterWeekCell, Column.PSALTER_WEEK);
            psalterWeekCell.appendChild(document.createTextNode(romNumPsalterWeek));
            let psalterWeekCellRowspan = counter.cw + 1;
            if (null !== monthHeaderRow) {
                psalterWeekCellRowspan++;
                psalterWeekCell.setAttribute('rowspan', psalterWeekCellRowspan);
                monthHeaderRow.appendChild(psalterWeekCell);
            } else {
                psalterWeekCell.setAttribute('rowspan', psalterWeekCellRowspan);
                tr.appendChild(psalterWeekCell);
            }
            newCheck.newPsalterWeek = false;
        }
        if (null !== monthHeaderRow) {
            return [monthHeaderRow, tr];
        }
        return [tr];
    }

    async buildTable() {
        this.locale(this.#calendarData.settings.locale.replaceAll('_', '-'));

        // In the PHP version we create the table element here,
        // but in this JS version we create the table element in the constructor.
        // Likewise, we set the id and the class name in the constructor,
        // or directly on the table element itself using the provided methods.

        const colGroup = document.createElement('colgroup');
        const colCount = this.#psalterWeekGrouping ? 5 : 4;

        for (let i = 0; i < colCount; i++) {
            const col = document.createElement('col');
            col.setAttribute('class', 'col' + (i + 1));
            colGroup.appendChild(col);
        }
        this.#domElement.appendChild(colGroup);

        if (false === this.#removeCaption) {
            const caption = document.createElement('caption');
            let captionText;
            if (this.#calendarData.settings.hasOwnProperty('diocesan_calendar')) {
                const replacements = {
                    'diocese': this.#calendarData.metadata.diocese_name,
                    'year': this.#calendarData.settings.year
                };
                captionText = Messages[this.#baseLocale]['DIOCESAN_CALENDAR_CAPTION'].replace(/{(.*?)}/g, (match, p1) => {
                    return replacements[p1];
                });
            } else if (this.#calendarData.settings.hasOwnProperty('national_calendar')) {
                const nation = new Intl.DisplayNames([this.#locale], { type: 'region' }).of(this.#calendarData.settings.national_calendar);
                const replacements = {
                    'nation': nation,
                    'year': this.#calendarData.settings.year
                };
                captionText = Messages[this.#baseLocale]['NATIONAL_CALENDAR_CAPTION'].replace(/{(.*?)}/g, (match, p1) => {
                    return replacements[p1];
                });
            } else {
                const replacements = {
                    'year': this.#calendarData.settings.year
                };
                captionText = Messages[this.#baseLocale]['GENERAL_CALENDAR_CAPTION'].replace(/{(.*?)}/g, (match, p1) => {
                    return replacements[p1];
                });
            }
            caption.appendChild(document.createTextNode(captionText));
            this.#domElement.appendChild(caption);
        }

        if (false === this.#removeHeaderRow) {
            const thead = document.createElement('thead');

            const theadRow = document.createElement('tr');

            const th1 = document.createElement('th');
            let textNode;
            if (this.#firstColumnGrouping === Grouping.BY_MONTH) {
                textNode = document.createTextNode(Messages[this.#baseLocale]['MONTH']);
            } else if (this.#firstColumnGrouping === Grouping.BY_LITURGICAL_SEASON) {
                textNode = document.createTextNode(Messages[this.#baseLocale]['LITURGICAL_SEASON']);
            }
            th1.appendChild(textNode);
            theadRow.appendChild(th1);

            const th2 = document.createElement('th');
            th2.appendChild(document.createTextNode(Messages[this.#baseLocale]['DATE']));
            theadRow.appendChild(th2);

            const th3 = document.createElement('th');
            th3.appendChild(document.createTextNode(Messages[this.#baseLocale]['LITURGICAL_CELEBRATION']));

            const th4 = document.createElement('th');
            th4.appendChild(document.createTextNode(Messages[this.#baseLocale]['LITURGICAL_GRADE']));

            // Third and fourth column order depends on the column order setting
            switch (this.#columnOrder) {
                case ColumnOrder.GRADE_FIRST:
                    theadRow.appendChild(th4);
                    theadRow.appendChild(th3);
                    break;
                case ColumnOrder.EVENT_DETAILS_FIRST:
                    theadRow.appendChild(th3);
                    theadRow.appendChild(th4);
                    break;
            }

            if (this.#psalterWeekGrouping) {
                const th5 = document.createElement('th');
                th5.appendChild(document.createTextNode('Psalter'));
                theadRow.appendChild(th5);
            }

            thead.appendChild(theadRow);
            this.#domElement.appendChild(thead);
        }

        const tbody = document.createElement('tbody');
        this.#domElement.appendChild(tbody);

        let currentMonth = -1;
        let currentSeason = '';
        let currentPsalterWeek = 5;

        const newCheck = {
            newMonth: false,
            newSeason: false,
            newPsalterWeek: false
        };

        /**
         * @type {import('./typedefs.js').Counter}
         */
        const counter = {
            cm: 0,
            cs: 0,
            cw: 0,
            cd: 0
        };
        (async () => {
            for (let eventIdx = 0; eventIdx < this.#calendarData.litcal.length; eventIdx++) {
                let litevent = this.#calendarData.litcal[eventIdx];
                this.#daysCreated++;

                // Check if we are at the start of a new month, and if so count how many events we have in that same month,
                // so we can display the Month table cell with the correct colspan when firstColumnGrouping is BY_MONTH.
                const eventMonth = litevent.date.getMonth();
                if (eventMonth !== currentMonth) {
                    newCheck.newMonth = true;
                    currentMonth = eventMonth;
                    counter.cm = 0;
                    await this.#countSameMonthEvents(eventIdx, counter);
                }

                // Check if we are at the start of a new season, and if so count how many events we have in that same season,
                // so we can display the Season table cell with the correct colspan when firstColumnGrouping is BY_LITURGICAL_SEASON.
                if (litevent.liturgical_season !== currentSeason) {
                    newCheck.newSeason = true;
                    currentSeason = litevent.liturgical_season;
                    counter.cs = 0;
                    await this.#countSameSeasonEvents(eventIdx, counter);
                }

                // Check if we are at the start of a new Psalter week, and if so count how many events we have with the same Psalter week,
                // so we can display the Psalter week table cell with the correct colspan
                if (litevent.psalter_week !== currentPsalterWeek) {
                    newCheck.newPsalterWeek = true;
                    counter.cw = 0;
                    currentPsalterWeek = litevent.psalter_week;
                    await this.#countSamePsalterWeekEvents(eventIdx, counter);
                }

                // Check if we have more than one event on the same day, such as optional memorials,
                // so we can display the Date table cell with the correct colspan.
                counter.cd = 0;
                await this.#countSameDayEvents(eventIdx, counter);

                if (counter.cd > 0) {
                    for (let ev = 0; ev <= counter.cd; ev++) {
                        litevent = this.#calendarData.litcal[eventIdx];

                        // Check if we are at the start of a new season, and if so count how many events we have in that same season,
                        // so we can display the Season table cell with the correct colspan when firstColumnGrouping is BY_LITURGICAL_SEASON.
                        if (litevent.liturgical_season !== currentSeason) {
                            newCheck.newSeason = true;
                            currentSeason = litevent.liturgical_season;
                            counter.cs = 0;
                            await this.#countSameSeasonEvents(eventIdx, counter);
                        }

                        // Check if we are at the start of a new Psalter week, and if so count how many events we have with the same Psalter week,
                        // so we can display the Psalter week table cell with the correct colspan
                        if (litevent.psalter_week !== currentPsalterWeek) {
                            newCheck.newPsalterWeek = true;
                            counter.cw = 0;
                            currentPsalterWeek = litevent.psalter_week;
                            await this.#countSamePsalterWeekEvents(eventIdx, counter);
                        }

                        let trs = this.#buildTableRow(litevent, newCheck, counter, ev);
                        trs.forEach(tr => tbody.appendChild(tr));
                        eventIdx++;
                    }
                    eventIdx--;
                } else {
                    let trs = this.#buildTableRow(litevent, newCheck, counter, null);
                    trs.forEach(tr => {
                        tbody.appendChild(tr)
                    });
                }
            }
        })();
        return this;
    }

    attachTo( element ) {
        const domNode = WebCalendar.#validateElementSelector( element );
        this.#attachedElement = domNode;
        return this;
    }

    listenTo( apiClient ) {
        if ( false === apiClient instanceof LitCalApiClient ) {
            throw new Error( 'WebCalendar.listenTo(apiClient) requires an instance of LitCalApiClient, but found: ' + typeof apiClient + '.' );
        }
        apiClient._eventBus.on('calendarFetched', async (data) => {
            if (typeof data !== 'object') {
                throw new Error('WebCalendar: Invalid type for data received in `calendarFetched` event, must be of type object but found type: ' + typeof data);
            }
            if (!data.hasOwnProperty('litcal') || !Array.isArray(data.litcal) || data.litcal.length === 0) {
                throw new Error('WebCalendar: Invalid liturgical calendar data received in `calendarFetched` event');
            }
            if (!data.hasOwnProperty('settings') || !data.hasOwnProperty('metadata') || !data.hasOwnProperty('messages')) {
                throw new Error('WebCalendar: data received in `calendarFetched` event should have litcal, settings, metadata and messages properties');
            }
            console.log('Received data in WebCalendar Component:', data);
            data.litcal = data.litcal.map(event => {
                event.date = new Date(Date.UTC(0, 0, 0, 0, 0, event.date));
                return event;
            });
            this.#calendarData = data;

            await this.buildTable();
            if (this.#attachedElement && this.#domElement) {
                this.#attachedElement.replaceChildren(this.#domElement);
            } else {
                if (null === this.#attachedElement) {
                    console.error('WebCalendar: No element to attach to.');
                }
                if (null === this.#domElement) {
                    console.error('WebCalendar: No table to attach.');
                }
            }
        });
        return this;
    }

    get _locale() {
        return this.#locale;
    }

    /**
     * The number of days on which liturgical events take place in the current WebCalendar.
     * This value is only available after {@link WebCalendar.buildTable()} has been called.
     * @type {number}
     */
    get _daysCreated() {
        return this.#daysCreated;
    }

    /**
     * Get the number of days on which liturgical events take place in the current WebCalendar.
     * @returns {number} The number of days on which liturgical events take place in the current WebCalendar. This value is only available after {@link WebCalendar.buildTable()} has been called.
     */
    daysCreated() {
        return this.#daysCreated;
    }
}
