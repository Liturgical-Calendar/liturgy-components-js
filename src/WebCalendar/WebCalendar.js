import {
    Grouping,
    ColumnOrder,
    Column,
    ColorAs,
    DateFormat,
    GradeDisplay,
    LatinInterface,
    Rite,
    RiteProperties,
} from '../Enums.js';
import ColumnSet from './ColumnSet.js';
import ApiClient from '../ApiClient/ApiClient.js';
import LiveAnnouncer from '../LiveAnnouncer.js';
import Messages from '../Messages.js';
import { formatPluralMessage } from '../MessageFormat.js';
import { canonicalizeLocale } from '../LocaleValidation.js';

export default class WebCalendar {
    /**
     * @type {HTMLElement}
     * @private
     */
    #domElement = null;

    #locale = 'en-US';

    #baseLocale = 'en';

    /**
     * @type {import('../typedefs.js').CalendarData}
     */
    #calendarData = null;

    #daysCreated = 0;

    /**
     * @type {Grouping}
     * @private
     */
    #firstColumnGrouping = Grouping.BY_MONTH;

    /**
     * @type {ColorAs}
     * @private
     */
    #eventColor = ColorAs.INDICATOR;

    /**
     * @type {ColorAs}
     * @private
     */
    #seasonColor = ColorAs.BACKGROUND;

    /**
     * @type {ColumnSet}
     * @private
     */
    #seasonColorColumns = new ColumnSet(
        Column.LITURGICAL_SEASON |
            Column.MONTH |
            Column.DATE |
            Column.PSALTER_WEEK,
    );

    /**
     * @type {ColumnSet}
     * @private
     */
    #eventColorColumns = new ColumnSet(Column.EVENT_DETAILS | Column.GRADE);

    /**
     * @type {ColumnOrder}
     * @private
     */
    #columnOrder = ColumnOrder.EVENT_DETAILS_FIRST;

    /**
     * @type {DateFormat}
     * @private
     */
    #dateFormat = DateFormat.FULL;

    /**
     * @type {GradeDisplay}
     * @private
     */
    #gradeDisplay = GradeDisplay.FULL;

    /**
     * @type {LatinInterface}
     * @private
     */
    #latinInterface = LatinInterface.ECCLESIASTICAL;

    #removeHeaderRow = false;

    #removeCaption = false;

    #psalterWeekColumn = false;

    #monthHeader = false;

    /**
     * @type {HTMLElement}
     * @private
     */
    #attachedElement = null;

    /**
     * The hidden live region, or `null` when `announceUpdates( false )` was set.
     *
     * @type {LiveAnnouncer|null}
     * @private
     */
    #announcer = new LiveAnnouncer();

    /**
     * Whether a render has already happened.
     *
     * The FIRST render is deliberately silent: it is the page loading, not a
     * user action, and a live region firing then talks over whatever the page is
     * already announcing. It is also the render that MOUNTS the region, and a
     * live region has to be in the DOM before its content changes to be
     * announced at all — so skipping it is not merely a matter of manners.
     *
     * @type {boolean}
     * @private
     */
    #hasRendered = false;

    /**
     * The client this calendar is listening to, held so `dispose()` can reach its
     * event bus. `null` until `listenTo()` runs.
     *
     * @type {ApiClient|null}
     * @private
     */
    #apiClient = null;

    /**
     * The exact `calendarFetched` listener `listenTo()` registered, held so
     * `dispose()` can pass the same reference to `EventEmitter.off()`.
     *
     * @type {function|null}
     * @private
     */
    #calendarFetchedListener = null;

    /**
     * The liturgical rite the rendered calendar belongs to.
     *
     * Cannot be derived from the calendar data: the API response carries no rite
     * field, and the rite-level Ambrosian calendar has neither a
     * `national_calendar` nor a `diocesan_calendar` setting, so it is
     * indistinguishable from the General Roman calendar by its payload alone.
     * It is therefore taken from the linked `ApiClient` on each fetch, or set
     * explicitly with `rite()`.
     *
     * @type {'roman' | 'ambrosian'}
     * @private
     */
    #rite = Rite.ROMAN;

    /**
     * @type {HTMLElement}
     * @private
     */
    #lastSeasonCell = null;

    /**
     * @type {HTMLElement}
     * @private
     */
    #lastPsalterWeekCell = null;

    #monthFmt = new Intl.DateTimeFormat(this.#locale, {
        month: 'long',
        timeZone: 'UTC',
    });

    #dateFmt = new Intl.DateTimeFormat(this.#locale, {
        dateStyle: this.#dateFormat,
        timeZone: 'UTC',
    });

    /**
     * @type {['purple', 'red', 'green']}
     * @private
     * @readonly
     */
    static #HIGH_CONTRAST = Object.freeze(['purple', 'red', 'green']);

    /**
     * @type {['', 'I', 'II', 'III', 'IV']}
     * @private
     * @readonly
     */
    static #PSALTER_WEEK = Object.freeze(['', 'I', 'II', 'III', 'IV']);

    /**
     * Sanitizes the given input string to prevent XSS attacks.
     *
     * It uses the DOMParser to parse the string as HTML and then extracts the
     * text content of the parsed HTML document. This effectively strips any HTML
     * tags from the input string.
     *
     * @param {string} input - The input string to sanitize.
     * @returns {string} The sanitized string.
     * @private
     * @see https://stackoverflow.com/a/47140708/394921
     */
    static #sanitizeInput(input) {
        let doc = new DOMParser().parseFromString(input, 'text/html');
        return doc.body.textContent || '';
    }

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
    static #isValidClassName(className) {
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
    static #isValidId(id) {
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
        const pattern =
            /^(?!\d|--|-?\d)(?:[_-][a-zA-Z][\w\-]*|[a-zA-Z][\w\-]*)$/;
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
    static #validateElementSelector(element) {
        if (typeof element !== 'string') {
            throw new Error(
                'Invalid type for element selector, must be of type string but found type: ' +
                    typeof element,
            );
        }
        const domNode = document.querySelector(element);
        if (null === domNode) {
            throw new Error('Invalid element selector: ' + element);
        }
        return domNode;
    }

    /**
     * Constructor for the WebCalendar class.
     *
     * Creates a new instance of the WebCalendar class.
     *
     * The options object is optional and can contain any of the following properties:
     * - class: string, the class to apply to the table element
     * - id: string, the id to apply to the table element
     * - firstColumnGrouping: Grouping, the grouping for the first column
     * - removeHeaderRow: boolean, whether to remove the header row
     * - removeCaption: boolean, whether to remove the caption element
     * - psalterWeekColumn: boolean, whether to group events by psalter week
     * - eventColor: ColorAs, the color to apply to events
     * - seasonColor: ColorAs, the color to apply to seasons
     * - seasonColorColumns: Column, the columns to apply the season color to
     * - eventColorColumns: Column, the columns to apply the event color to
     * - monthHeader: boolean, whether to include a month header
     * - dateFormat: DateFormat, the format to use for dates
     * - columnOrder: ColumnOrder, the order of the columns
     * - gradeDisplay: GradeDisplay, the display of grades
     * - latinInterface: LatinInterface, the Latin weekday-name style
     * - announceUpdates: boolean, whether to announce each replacement in the
     *   live region (default true)
     *
     * @param {Object} [options] - An object containing any of the above properties.
     * @throws {Error} If any of the properties in the options object are invalid.
     */
    constructor(options = {}) {
        this.#domElement = document.createElement('table');
        if (typeof options !== 'object') {
            throw new Error(
                'Invalid type for options on WebCalendar instance, must be of type object but found type: ' +
                    typeof options,
            );
        }
        if (Object.hasOwn(options, 'class')) {
            this.class(options.class);
        }
        if (Object.hasOwn(options, 'id')) {
            this.id(options.id);
        }
        if (Object.hasOwn(options, 'firstColumnGrouping')) {
            this.firstColumnGrouping(options.firstColumnGrouping);
        }
        if (Object.hasOwn(options, 'removeHeaderRow')) {
            this.removeHeaderRow(options.removeHeaderRow);
        }
        if (Object.hasOwn(options, 'removeCaption')) {
            this.removeCaption(options.removeCaption);
        }
        if (Object.hasOwn(options, 'psalterWeekColumn')) {
            this.psalterWeekColumn(options.psalterWeekColumn);
        }
        if (Object.hasOwn(options, 'eventColor')) {
            this.eventColor(options.eventColor);
        }
        if (Object.hasOwn(options, 'seasonColor')) {
            this.seasonColor(options.seasonColor);
        }
        if (Object.hasOwn(options, 'seasonColorColumns')) {
            this.seasonColorColumns(options.seasonColorColumns);
        }
        if (Object.hasOwn(options, 'eventColorColumns')) {
            this.eventColorColumns(options.eventColorColumns);
        }
        if (Object.hasOwn(options, 'monthHeader')) {
            this.monthHeader(options.monthHeader);
        }
        if (Object.hasOwn(options, 'dateFormat')) {
            this.dateFormat(options.dateFormat);
        }
        if (Object.hasOwn(options, 'columnOrder')) {
            this.columnOrder(options.columnOrder);
        }
        if (Object.hasOwn(options, 'gradeDisplay')) {
            this.gradeDisplay(options.gradeDisplay);
        }
        if (Object.hasOwn(options, 'latinInterface')) {
            this.latinInterface(options.latinInterface);
        }
        if (Object.hasOwn(options, 'announceUpdates')) {
            this.announceUpdates(options.announceUpdates);
        }
    }

    /**
     * Turns the live-region announcement on or off.
     *
     * Default `true`. An accessibility fix that is off by default fixes nobody:
     * the consumers who need it are the least likely to know the option exists.
     * Turn it off when the surrounding page already owns a live region for this
     * content, so the update is not announced twice.
     *
     * @param {boolean} enabled - Whether to announce each replacement.
     * @throws {Error} If `enabled` is not a boolean.
     * @returns {WebCalendar} The current instance of the class, for chaining.
     */
    announceUpdates(enabled) {
        if (typeof enabled !== 'boolean') {
            throw new Error(
                'Invalid type for announceUpdates on WebCalendar instance, must be of type boolean but found type: ' +
                    typeof enabled,
            );
        }
        if (false === enabled) {
            this.#announcer?.dispose();
            this.#announcer = null;
        } else if (null === this.#announcer) {
            this.#announcer = new LiveAnnouncer();
            // A NEW region, which the next render will insert — and a region
            // written in the same task it is inserted in is not reliably
            // announced. So the same silent-first-render rule a fresh instance
            // gets applies here too.
            this.#hasRendered = false;
        }
        return this;
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
    class(className) {
        if (typeof className !== 'string') {
            throw new Error(
                'Invalid type for class name on WebCalendar instance, must be of type string but found type: ' +
                    typeof className,
            );
        }
        if (this.#domElement === null) {
            throw new Error(
                'Cannot set class name before dom element is initialized',
            );
        }
        let classNames = className.split(/\s+/);
        classNames = classNames.map((className) =>
            WebCalendar.#sanitizeInput(className),
        );
        for (className of classNames) {
            if (false === WebCalendar.#isValidClassName(className)) {
                throw new Error('Invalid class name: ' + className);
            }
        }
        className = classNames.join(' ');
        if (className === '') {
            this.#domElement.removeAttribute('class');
        } else {
            this.#domElement.setAttribute('class', className);
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
    id(id) {
        if (typeof id !== 'string') {
            throw new Error(
                'Invalid type for id, must be of type string but found type: ' +
                    typeof id,
            );
        }
        if (this.#domElement === null) {
            throw new Error(
                'Cannot set class name before dom element is initialized',
            );
        }
        id = WebCalendar.#sanitizeInput(id);
        if (WebCalendar.#isValidId(id) === false) {
            throw new Error(
                'Invalid id, cannot contain any kind of whitespace character: ' +
                    id,
            );
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
            throw new Error(
                'Invalid type for date format, must be of type string but found type: ' +
                    typeof dateFormat,
            );
        }
        if (!Object.values(DateFormat).includes(dateFormat)) {
            throw new Error('Invalid date format: ' + dateFormat);
        }
        this.#dateFormat = dateFormat;
        if (this.#dateFormat === DateFormat.DAY_ONLY) {
            this.#dateFmt = new Intl.DateTimeFormat(this.#locale, {
                day: 'numeric',
                weekday: 'long',
                timeZone: 'UTC',
            });
        } else {
            this.#dateFmt = new Intl.DateTimeFormat(this.#locale, {
                dateStyle: this.#dateFormat,
                timeZone: 'UTC',
            });
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
            throw new Error(
                'Invalid type for remove caption, must be of type boolean but found type: ' +
                    typeof removeCaption,
            );
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
            throw new Error(
                'Invalid type for remove header row, must be of type boolean but found type: ' +
                    typeof removeHeaderRow,
            );
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
            throw new Error(
                'Invalid first column grouping: ' + firstColumnGrouping,
            );
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
     * @param {boolean} boolVal Whether the psalter week grouping should be applied or not.
     *
     * @throws {Error} If the input is not a boolean.
     * @returns {WebCalendar} The current instance of the class.
     */
    psalterWeekColumn(boolVal = true) {
        if (typeof boolVal !== 'boolean') {
            throw new Error(
                'Invalid type for psalter week grouping, must be of type boolean but found type: ' +
                    typeof psalterWeekColumn,
            );
        }
        this.#psalterWeekColumn = boolVal;
        return this;
    }

    /**
     * Sets how the color of a single liturgical event is applied to the table.
     *
     * This method sets how the color of a single liturgical event is applied to the table.
     * The following options are supported:
     * - `ColorAs.BACKGROUND`: the color of the event is applied as the background color of the table cells
     * - `ColorAs.CSS_CLASS`: the color of the event is applied as a CSS class to the table cells
     * - `ColorAs.INDICATOR`: the color of the event is applied as a small 10px inline block element with radius 5px
     *
     * The default is `ColorAs.INDICATOR`.
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
     * - Column.EVENT_DETAILS
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
            throw new Error(
                'Invalid type for season color columns, must be of type number but found type: ' +
                    typeof seasonColorColumns,
            );
        }
        if ((seasonColorColumns & Column.ALL) === 0) {
            throw new Error(
                'Invalid season color columns: ' + seasonColorColumns,
            );
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
            throw new Error(
                'Invalid type for event color columns, must be of type number but found type: ' +
                    typeof eventColorColumns,
            );
        }
        if ((eventColorColumns & Column.ALL) === 0) {
            throw new Error(
                'Invalid event color columns: ' + eventColorColumns,
            );
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
            throw new Error(
                'Invalid type for month header, must be of type boolean but found type: ' +
                    typeof monthHeader,
            );
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
     * Sets the Latin interface for the WebCalendar instance.
     *
     * The Latin interface determines which set of month and weekday names to use
     * for the calendar. The following options are supported:
     * - LatinInterface.ECCLESIASTICAL: month and weekday names are based on the ecclesiastical calendar
     * - LatinInterface.CIVIL: month and weekday names are based on the civil calendar
     *
     * The default is LatinInterface.ECCLESIASTICAL.
     *
     * @param {LatinInterface} latinInterface The Latin interface to use.
     * @throws {Error} If the input is not a valid LatinInterface.
     * @returns {WebCalendar} The current instance of the class.
     */
    latinInterface(latinInterface) {
        if (!Object.values(LatinInterface).includes(latinInterface)) {
            throw new Error('Invalid Latin interface: ' + latinInterface);
        }
        this.#latinInterface = latinInterface;
        return this;
    }

    /**
     * Sets the liturgical rite the rendered calendar belongs to.
     *
     * Only affects the caption of a rite-level calendar, which is otherwise
     * indistinguishable from the General Roman calendar: the payload has no
     * rite field and no national or diocesan setting. National and diocesan
     * captions are named after the calendar itself and need no rite.
     *
     * Calling this is unnecessary when the instance listens to an `ApiClient`,
     * which supplies the rite on every fetch.
     *
     * @param {'roman' | 'ambrosian'} rite - A value of the `Rite` enum.
     * @throws {Error} If the value is not a member of the `Rite` enum.
     * @returns {WebCalendar} The current instance of the class for method chaining.
     */
    rite(rite) {
        if (!Object.values(Rite).includes(rite)) {
            throw new Error('Invalid rite: ' + rite);
        }
        this.#rite = rite;
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
     * The tag is normalized (`_` to `-`) and canonicalized before it is stored, so
     * `'en_us'` and `'EN-us'` both become `'en-US'`.
     *
     * An `Intl.Locale` is accepted in place of the tag, and unwrapped to its
     * canonical string by the shared helper before anything else happens.
     *
     * @param {string|Intl.Locale} locale - The locale to set, as a BCP 47 language tag or an `Intl.Locale`.
     * @throws {Error} If the provided locale is neither a string nor an `Intl.Locale`, is empty or blank, or is an invalid locale identifier.
     * @returns {WebCalendar} The current instance of the class for method chaining.
     */
    locale(locale) {
        // The empty string needs no guard here: the shared helper rejects an empty or
        // blank tag with a message of its own, naming this setter, so the check that
        // used to sit ahead of this line bought nothing that the helper does not.
        // Named for the method rather than the class: `locale()` is a setter a caller
        // invokes by name, so `WebCalendar.locale:` points straight at the call.
        this.#locale = canonicalizeLocale(locale, 'WebCalendar.locale');
        this.#baseLocale = new Intl.Locale(this.#locale).language;
        this.#monthFmt = new Intl.DateTimeFormat(this.#locale, {
            month: 'long',
            timeZone: 'UTC',
        });
        if (this.#dateFormat === DateFormat.DAY_ONLY) {
            this.#dateFmt = new Intl.DateTimeFormat(this.#locale, {
                day: 'numeric',
                weekday: 'long',
                timeZone: 'UTC',
            });
        } else {
            this.#dateFmt = new Intl.DateTimeFormat(this.#locale, {
                dateStyle: this.#dateFormat,
                timeZone: 'UTC',
            });
        }
        return this;
    }

    /**
     * Recursively counts the number of subsequent liturgical events in the same day.
     *
     * @param {int} eventIdx The current position in the array of liturgical events on the given day.
     * @param {import('../typedefs.js').Counter} counter [counter.cd] The count of subsequent liturgical events in the same day.
     * @private
     * @returns
     */
    #countSameDayEvents(eventIdx, counter) {
        return new Promise((resolve) => {
            const currentEvent = this.#calendarData.litcal[eventIdx];
            const nextEventIdx = eventIdx + 1;
            if (nextEventIdx < this.#calendarData.litcal.length) {
                const nextEvent = this.#calendarData.litcal[nextEventIdx];
                if (nextEvent.date.getTime() === currentEvent.date.getTime()) {
                    counter.cd++;
                    this.#countSameDayEvents(nextEventIdx, counter).then(
                        resolve,
                    );
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
     * @param {import('../typedefs.js').Counter} counter [counter.cm] The count of subsequent liturgical events in the same month
     * @private
     * @returns
     */
    #countSameMonthEvents(eventIdx, counter) {
        return new Promise((resolve) => {
            const currentEvent = this.#calendarData.litcal[eventIdx];
            const nextEventIdx = eventIdx + 1;
            if (nextEventIdx < this.#calendarData.litcal.length) {
                const nextEvent = this.#calendarData.litcal[nextEventIdx];
                if (
                    nextEvent.date.getMonth() === currentEvent.date.getMonth()
                ) {
                    counter.cm++;
                    this.#countSameMonthEvents(nextEventIdx, counter).then(
                        resolve,
                    );
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
     * @param {import('../typedefs.js').Counter} counter [counter.cs] The count of subsequent liturgical events in the same liturgical season.
     * @private
     * @returns
     */
    #countSameSeasonEvents(eventIdx, counter) {
        return new Promise((resolve) => {
            const currentEvent = this.#calendarData.litcal[eventIdx];
            const nextEventIdx = eventIdx + 1;
            if (nextEventIdx < this.#calendarData.litcal.length) {
                const nextEvent = this.#calendarData.litcal[nextEventIdx];
                const currentEventLiturgicalSeason =
                    currentEvent.liturgical_season ??
                    this.#determineSeason(currentEvent);
                const nextEventLiturgicalSeason =
                    nextEvent.liturgical_season ??
                    this.#determineSeason(nextEvent);
                if (
                    nextEventLiturgicalSeason === currentEventLiturgicalSeason
                ) {
                    counter.cs++;
                    this.#countSameSeasonEvents(nextEventIdx, counter).then(
                        resolve,
                    );
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
     * @param {import('../typedefs.js').Counter} counter [counter.cw] The count of subsequent liturgical events in the same psalter week.
     * @private
     * @returns
     */
    #countSamePsalterWeekEvents(eventIdx, counter) {
        return new Promise((resolve) => {
            const currentEvent = this.#calendarData.litcal[eventIdx];
            const nextEventIdx = eventIdx + 1;
            if (nextEventIdx < this.#calendarData.litcal.length) {
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
                if (
                    nepsw === cepsw &&
                    (nepsw !== 0 ||
                        currentEvent.date.getTime() ===
                            nextEvent.date.getTime())
                ) {
                    counter.cw++;
                    this.#countSamePsalterWeekEvents(
                        nextEventIdx,
                        counter,
                    ).then(resolve);
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
     * Determines the liturgical season for a given liturgical event.
     * @param {import('../typedefs.js').CalendarEvent} litevent
     * @private
     * @returns
     */
    #determineSeason(litevent) {
        if (
            litevent.date >= this.#calendarData.litcal.AshWednesday.date &&
            litevent.date < this.#calendarData.litcal.HolyThurs.date
        ) {
            return 'LENT';
        }
        if (
            litevent.date >= this.#calendarData.litcal.HolyThurs.date &&
            litevent.date < this.#calendarData.litcal.Easter.date
        ) {
            return 'EASTER_TRIDUUM';
        }
        if (
            litevent.date >= this.#calendarData.litcal.Easter.date &&
            litevent.date < this.#calendarData.litcal.Pentecost.date
        ) {
            return 'EASTER';
        }
        if (
            litevent.date >= this.#calendarData.litcal.Advent1.date &&
            litevent.date < this.#calendarData.litcal.Christmas.date
        ) {
            return 'ADVENT';
        }
        if (
            litevent.date > this.#calendarData.litcal.BaptismLord.date &&
            litevent.date < this.#calendarData.litcal.AshWednesday.date
        ) {
            return 'ORDINARY_TIME';
        }

        // Handle Saturday of 34th week of Ordinary Time
        let Saturday34thWeekOrdTime = new Date(
            this.#calendarData.litcal.ChristKing.date,
        );
        Saturday34thWeekOrdTime.setDate(
            Saturday34thWeekOrdTime.getDate() +
                (6 - Saturday34thWeekOrdTime.getDay()),
        );

        if (
            litevent.date > this.#calendarData.litcal.Pentecost.date &&
            litevent.date <= Saturday34thWeekOrdTime
        ) {
            return 'ORDINARY_TIME';
        }

        // Handle Liturgical year type edge case
        if (this.#calendarData.settings.year_type === 'LITURGICAL') {
            if (
                litevent.date.getTime() ===
                this.#calendarData.litcal.Advent1_vigil.date.getTime()
            ) {
                return 'ADVENT';
            }
        }

        return 'CHRISTMAS';
    }

    /**
     * Given a liturgical event, returns the liturgical color for the liturgical season.
     * @param {import('../typedefs.js').CalendarEvent} litEvent
     * @private
     * @returns
     */
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

    /**
     * Given a cell, column flag, and season color, applies the season color
     * to the cell based on the value of the `seasonColor` property,
     * if the column in which it is found (indicated by `columnFlag`)
     * is enabled in the `#seasonColorColumns` private class field,
     * and in the manner specified by the private class field `this.#seasonColor`.
     * @param {string} seasonColor The color representing the liturgical season
     * @param {HTMLTableCellElement} cell The table cell to which the color should be applied
     * @param {Column} columnFlag The column for which the color should be applied
     * @private
     */
    #handleSeasonColorForColumn(seasonColor, cell, columnFlag) {
        if (this.#seasonColorColumns.has(columnFlag)) {
            switch (this.#seasonColor) {
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

    /**
     * Given a cell, column flag, and event color, applies the event color
     * to the cell based on the value of the `eventColor` property,
     * if the column in which it is found (indicated by `columnFlag`)
     * is enabled in the `#eventColorColumns` private class field,
     * and in the manner specified by the private class field `#eventColor`.
     * @param {string|string[]} eventColor The color(s) representing the event color(s)
     * @param {HTMLTableCellElement} cell The table cell to which the color should be applied
     * @param {Column} columnFlag The column for which the color should be applied
     * @private
     */
    #handleEventColorForColumn(eventColor, cell, columnFlag) {
        if (typeof eventColor === 'string') {
            eventColor = [eventColor];
        }
        if (this.#eventColorColumns.has(columnFlag)) {
            switch (this.#eventColor) {
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
                    for (const color of eventColor) {
                        let colorSpan = document.createElement('span');
                        colorSpan.style.backgroundColor = color;
                        colorSpan.style.width = '10px';
                        colorSpan.style.height = '10px';
                        colorSpan.style.display = 'inline-block';
                        colorSpan.style.border = '1px solid black';
                        colorSpan.style.borderRadius = '5px';
                        colorSpan.style.marginRight = '5px';
                        cell.insertBefore(colorSpan, cell.firstChild);
                    }
                    break;
            }
        }
    }

    /**
     * Builds a table row for a liturgical event.
     *
     * @param {LiturgicalEvent} litevent - The liturgical event to display.
     * @param {{newMonth: boolean, newSeason: boolean, newPsalterWeek: boolean}} newCheck - Flags indicating new month or season.
     * @param {import('../typedefs.js').Counter} counter - Counts of celebrations in different scopes (month, liturgical season, psalter week, liturgical day).
     * @param {?number} ev - Index of liturgical events within the same day.
     *                        If null, there's only one event for the day and rowspan is not set on the dateCell.
     *                        If zero, we are on the first iteration of events within the same day, so we must create a dateCell and set the rowspan.
     *                        Otherwise, we are on a subsequent iteration of events within the same day, so there is no need to create a dateCell.
     * @returns {HTMLTableRowElement | HTMLTableRowElement[]} The table row for the given liturgical event.
     * @private
     */
    #buildTableRow(litevent, newCheck, counter, ev) {
        const seasonColor = this.#getSeasonColor(litevent);
        let monthHeaderRow = null;
        const tr = document.createElement('tr');

        // First column in Month or Liturgical Season
        if (newCheck.newMonth || newCheck.newSeason) {
            if (
                newCheck.newMonth &&
                this.#firstColumnGrouping === Grouping.BY_MONTH
            ) {
                let firstColRowSpan = counter.cm + 1;
                if (this.#monthHeader) {
                    firstColRowSpan++;
                    monthHeaderRow = document.createElement('tr');
                    const monthHeaderCell = document.createElement('td');
                    monthHeaderCell.setAttribute('colspan', 3);
                    monthHeaderCell.setAttribute('class', 'monthHeader');
                    monthHeaderCell.appendChild(
                        document.createTextNode(
                            this.#monthFmt.format(litevent.date),
                        ),
                    );
                }
                const firstColCell = document.createElement('td');
                firstColCell.setAttribute('rowspan', firstColRowSpan);
                firstColCell.setAttribute('class', 'rotate month');
                this.#handleSeasonColorForColumn(
                    seasonColor,
                    firstColCell,
                    Column.MONTH,
                );
                this.#handleEventColorForColumn(
                    litevent.color,
                    firstColCell,
                    Column.MONTH,
                );
                const textNode =
                    this.#baseLocale === 'la'
                        ? this.#latinInterface
                              .month(litevent.date.getMonth() + 1)
                              .toUpperCase()
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
            if (
                newCheck.newSeason &&
                this.#firstColumnGrouping === Grouping.BY_LITURGICAL_SEASON
            ) {
                let firstColRowSpan = counter.cs + 1;
                const firstColCell = document.createElement('td');
                if (this.#monthHeader) {
                    this.#lastSeasonCell = firstColCell;
                }
                firstColCell.setAttribute('rowspan', firstColRowSpan);
                firstColCell.setAttribute(
                    'class',
                    `rotate season ${litevent.liturgical_season}`,
                );
                this.#handleSeasonColorForColumn(
                    seasonColor,
                    firstColCell,
                    Column.LITURGICAL_SEASON,
                );
                this.#handleEventColorForColumn(
                    litevent.color,
                    firstColCell,
                    Column.LITURGICAL_SEASON,
                );
                const div = document.createElement('div');
                div.appendChild(
                    document.createTextNode(
                        litevent.liturgical_season_lcl ?? '',
                    ),
                );
                firstColCell.appendChild(div);
                if (this.#monthHeader && newCheck.newMonth) {
                    firstColRowSpan++;
                    firstColCell.setAttribute('rowspan', firstColRowSpan);
                    monthHeaderRow = document.createElement('tr');
                    const monthHeaderCell = document.createElement('td');
                    monthHeaderCell.setAttribute('colspan', 3);
                    monthHeaderCell.setAttribute('class', 'monthHeader');
                    monthHeaderCell.appendChild(
                        document.createTextNode(
                            this.#monthFmt.format(litevent.date),
                        ),
                    );
                    monthHeaderRow.appendChild(firstColCell);
                    monthHeaderRow.appendChild(monthHeaderCell);
                } else {
                    tr.appendChild(firstColCell);
                }
            }
            if (
                false === newCheck.newSeason &&
                newCheck.newMonth &&
                this.#monthHeader &&
                this.#firstColumnGrouping === Grouping.BY_LITURGICAL_SEASON
            ) {
                const firstColCellRowSpan =
                    this.#lastSeasonCell.getAttribute('rowspan');
                this.#lastSeasonCell.setAttribute(
                    'rowspan',
                    parseInt(firstColCellRowSpan) + 1,
                );
                monthHeaderRow = document.createElement('tr');
                const monthHeaderCell = document.createElement('td');
                monthHeaderCell.setAttribute('colspan', 3);
                monthHeaderCell.setAttribute('class', 'monthHeader');
                monthHeaderCell.appendChild(
                    document.createTextNode(
                        this.#monthFmt.format(litevent.date),
                    ),
                );
                monthHeaderRow.appendChild(monthHeaderCell);
            }
            newCheck.newMonth = false;
            newCheck.newSeason = false;
        }

        // Second column is Date
        let dateStr = '';
        switch (this.#baseLocale) {
            case 'la': {
                const dayOfTheWeek = litevent.date.getDay(); // 0-Sunday to 6-Saturday
                const dayOfTheWeekLatin =
                    this.#latinInterface.dayOfTheWeek(dayOfTheWeek);
                const month = litevent.date.getMonth() + 1; // 0-January to 11-December
                const monthLatin = this.#latinInterface.month(month);
                dateStr = `${dayOfTheWeekLatin} ${litevent.date.getDate()} ${monthLatin} ${litevent.date.getFullYear()}`;
                break;
            }
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
            this.#handleSeasonColorForColumn(
                seasonColor,
                dateCell,
                Column.DATE,
            );
            this.#handleEventColorForColumn(
                litevent.color,
                dateCell,
                Column.DATE,
            );
            dateCell.appendChild(document.createTextNode(dateStr));
            if (0 === ev) {
                dateCell.setAttribute('rowspan', counter.cd + 1);
            }
            tr.appendChild(dateCell);
        }

        // Third column is Event Details
        let currentCycle =
            Object.hasOwn(litevent, 'liturgical_year') &&
            litevent.liturgical_year !== null
                ? ' (' + litevent.liturgical_year + ')'
                : '';
        const eventDetailsCell = document.createElement('td');
        eventDetailsCell.setAttribute(
            'class',
            'eventDetails liturgicalGrade_' + litevent.grade,
        );
        this.#handleSeasonColorForColumn(
            seasonColor,
            eventDetailsCell,
            Column.EVENT_DETAILS,
        );
        this.#handleEventColorForColumn(
            litevent.color,
            eventDetailsCell,
            Column.EVENT_DETAILS,
        );
        const fragmentContents = `${litevent.name}${currentCycle} - <i>${litevent.color_lcl.join(` ${Messages[this.#baseLocale]['OR']} `)}</i><br><i>${litevent.common_lcl}</i>`;
        const eventDetailsContents = document
            .createRange()
            .createContextualFragment(fragmentContents);
        eventDetailsCell.appendChild(eventDetailsContents);

        // Fourth column is Liturgical Grade
        let displayGrade =
            litevent.grade_display !== null
                ? litevent.grade_display
                : litevent.grade_lcl;
        if (
            this.#gradeDisplay === GradeDisplay.ABBREVIATED &&
            litevent.grade_display !== ''
        ) {
            displayGrade = litevent.grade_abbr;
        }
        const liturgicalGradeCell = document.createElement('td');
        liturgicalGradeCell.setAttribute(
            'class',
            'liturgicalGrade liturgicalGrade_' + litevent.grade,
        );
        this.#handleSeasonColorForColumn(
            seasonColor,
            liturgicalGradeCell,
            Column.GRADE,
        );
        this.#handleEventColorForColumn(
            litevent.color,
            liturgicalGradeCell,
            Column.GRADE,
        );
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
        if (
            this.#psalterWeekColumn &&
            false === newCheck.newPsalterWeek &&
            null !== monthHeaderRow
        ) {
            const psalterWeekCellRowSpan =
                this.#lastPsalterWeekCell.getAttribute('rowspan');
            this.#lastPsalterWeekCell.setAttribute(
                'rowspan',
                parseInt(psalterWeekCellRowSpan) + 1,
            );
        }
        if (this.#psalterWeekColumn && newCheck.newPsalterWeek) {
            const psalterWeekCell = document.createElement('td');
            psalterWeekCell.setAttribute('class', 'psalterWeek');
            this.#lastPsalterWeekCell = psalterWeekCell;
            /** @type {string} The Roman numeral version of the Psalter week */
            const romNumPsalterWeek =
                WebCalendar.#PSALTER_WEEK[litevent.psalter_week];
            this.#handleSeasonColorForColumn(
                seasonColor,
                psalterWeekCell,
                Column.PSALTER_WEEK,
            );
            this.#handleEventColorForColumn(
                litevent.color,
                psalterWeekCell,
                Column.PSALTER_WEEK,
            );
            psalterWeekCell.appendChild(
                document.createTextNode(romNumPsalterWeek),
            );
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

    /**
     * The calendar's own name and year, as the `<caption>` states it.
     *
     * Extracted from `buildTable()` so the live-region announcement can reuse
     * the exact string the caption carries rather than deriving the calendar's
     * name a second time — which would mean a second set of translations, free
     * to drift from these. Called even when `removeCaption( true )` suppresses
     * the element, because the announcement is not the caption.
     *
     * @returns {string} The caption text.
     * @private
     */
    #captionText() {
        if (Object.hasOwn(this.#calendarData.settings, 'diocesan_calendar')) {
            const replacements = {
                diocese: this.#calendarData.metadata.diocese_name,
                year: this.#calendarData.settings.year,
            };
            // Guarded like the rite branch below. Before `#announce()` existed
            // this ran only when a caption was rendered; it now runs under
            // `removeCaption( true )` too, and a throw here would escape the
            // synchronous `calendarFetched` emit. No locale the API serves lacks
            // a block, so this is defence for a surface that widened, not a
            // reachable bug.
            return (
                Messages[this.#baseLocale]?.['DIOCESAN_CALENDAR_CAPTION'] ??
                Messages['en']['DIOCESAN_CALENDAR_CAPTION']
            ).replace(/{(.*?)}/g, (match, p1) => {
                return replacements[p1];
            });
        }
        if (Object.hasOwn(this.#calendarData.settings, 'national_calendar')) {
            const nation = new Intl.DisplayNames([this.#locale], {
                type: 'region',
            }).of(this.#calendarData.settings.national_calendar);
            const replacements = {
                nation: nation,
                year: this.#calendarData.settings.year,
            };
            return (
                Messages[this.#baseLocale]?.['NATIONAL_CALENDAR_CAPTION'] ??
                Messages['en']['NATIONAL_CALENDAR_CAPTION']
            ).replace(/{(.*?)}/g, (match, p1) => {
                return replacements[p1];
            });
        }
        // The rite-level calendar. Which rite it is cannot be read from the
        // payload — it has neither a national nor a diocesan setting, and the
        // response carries no rite field — so it comes from `#rite`, set by
        // `listenTo()` or `rite()`.
        //
        // The caption key is derived from the rite's own `emptyOptionLabelKey`,
        // so `GENERAL_ROMAN_CALENDAR` gives `GENERAL_ROMAN_CALENDAR_CAPTION` and
        // `AMBROSIAN_CALENDAR` gives `AMBROSIAN_CALENDAR_CAPTION`. Adding a rite
        // then needs only the matching message, no branch here.
        const captionKey = `${RiteProperties[this.#rite].emptyOptionLabelKey}_CAPTION`;
        const replacements = {
            year: this.#calendarData.settings.year,
        };
        // Rite-specific captions exist only for the twelve maintained locales,
        // following the same policy as the other rite messages, so fall back to
        // English before falling back to the General Roman caption.
        const captionTemplate =
            Messages[this.#baseLocale]?.[captionKey] ??
            Messages['en'][captionKey] ??
            Messages[this.#baseLocale]?.['GENERAL_ROMAN_CALENDAR_CAPTION'] ??
            Messages['en']['GENERAL_ROMAN_CALENDAR_CAPTION'];
        return captionTemplate.replace(/{(.*?)}/g, (match, p1) => {
            return replacements[p1];
        });
    }

    /**
     * @description Builds the HTML table from the JSON data for the Liturgical Calendar.
     * @async
     * @returns {WebCalendar} The current instance of the WebCalendar class
     */
    async buildTable() {
        // The API returns `en_US`-style tags; `locale()` normalizes the underscores
        // itself now, so the caller no longer repeats the replacement here.
        this.locale(this.#calendarData.settings.locale);

        // In the PHP version we create the table element here,
        // but in this JS version we create the table element in the constructor.
        // Likewise, we set the id and the class name in the constructor,
        // or directly on the table element itself using the provided methods.

        const colGroup = document.createElement('colgroup');
        const colCount = this.#psalterWeekColumn ? 5 : 4;

        for (let i = 0; i < colCount; i++) {
            const col = document.createElement('col');
            col.setAttribute('class', 'col' + (i + 1));
            colGroup.appendChild(col);
        }
        this.#domElement.replaceChildren(colGroup);

        if (false === this.#removeCaption) {
            const caption = document.createElement('caption');
            caption.appendChild(document.createTextNode(this.#captionText()));
            this.#domElement.appendChild(caption);
        }

        if (false === this.#removeHeaderRow) {
            const thead = document.createElement('thead');

            const theadRow = document.createElement('tr');

            const th1 = document.createElement('th');
            let textNode;
            if (this.#firstColumnGrouping === Grouping.BY_MONTH) {
                textNode = document.createTextNode(
                    Messages[this.#baseLocale]['MONTH'],
                );
            } else if (
                this.#firstColumnGrouping === Grouping.BY_LITURGICAL_SEASON
            ) {
                textNode = document.createTextNode(
                    Messages[this.#baseLocale]['LITURGICAL_SEASON'],
                );
            }
            th1.appendChild(textNode);
            theadRow.appendChild(th1);

            const th2 = document.createElement('th');
            th2.appendChild(
                document.createTextNode(Messages[this.#baseLocale]['DATE']),
            );
            theadRow.appendChild(th2);

            const th3 = document.createElement('th');
            th3.appendChild(
                document.createTextNode(
                    Messages[this.#baseLocale]['LITURGICAL_CELEBRATION'],
                ),
            );

            const th4 = document.createElement('th');
            th4.appendChild(
                document.createTextNode(
                    Messages[this.#baseLocale]['LITURGICAL_GRADE'],
                ),
            );

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

            if (this.#psalterWeekColumn) {
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

        /**
         * @type {{newMonth: boolean, newSeason: boolean, newPsalterWeek: boolean}}
         */
        const newCheck = {
            newMonth: false,
            newSeason: false,
            newPsalterWeek: false,
        };

        /**
         * @type {import('../typedefs.js').Counter}
         */
        const counter = {
            cm: 0,
            cs: 0,
            cw: 0,
            cd: 0,
        };
        (async () => {
            for (
                let eventIdx = 0;
                eventIdx < this.#calendarData.litcal.length;
                eventIdx++
            ) {
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
                if (
                    litevent.psalter_week !== currentPsalterWeek ||
                    litevent.psalter_week === 0
                ) {
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
                            await this.#countSameSeasonEvents(
                                eventIdx,
                                counter,
                            );
                        }

                        // Check if we are at the start of a new Psalter week, and if so count how many events we have with the same Psalter week,
                        // so we can display the Psalter week table cell with the correct colspan
                        if (litevent.psalter_week !== currentPsalterWeek) {
                            newCheck.newPsalterWeek = true;
                            counter.cw = 0;
                            currentPsalterWeek = litevent.psalter_week;
                            await this.#countSamePsalterWeekEvents(
                                eventIdx,
                                counter,
                            );
                        }

                        let trs = this.#buildTableRow(
                            litevent,
                            newCheck,
                            counter,
                            ev,
                        );
                        for (const tr of trs) {
                            tbody.appendChild(tr);
                        }
                        eventIdx++;
                    }
                    eventIdx--;
                } else {
                    let trs = this.#buildTableRow(
                        litevent,
                        newCheck,
                        counter,
                        null,
                    );
                    trs.forEach((tr) => {
                        tbody.appendChild(tr);
                    });
                }
            }
        })();
        return this;
    }

    /**
     * Appends the WebCalendar to a given element. If the element does not yet exist in the DOM, the WebCalendar will be appended when the element is inserted.
     * @param {string|HTMLElement} elementSelector - DOM element, or Element selector for the DOM element, to append the WebCalendar to
     */
    appendTo(elementSelector = '') {
        if (this.#attachedElement === null) {
            if (typeof elementSelector === 'string') {
                if (elementSelector === '') {
                    throw new Error(
                        'WebCalendar.appendTo: Element selector cannot be empty.',
                    );
                }
                this.#attachedElement =
                    WebCalendar.#validateElementSelector(elementSelector);
            } else if (elementSelector instanceof HTMLElement) {
                this.#attachedElement = elementSelector;
            } else {
                throw new Error(
                    'WebCalendar.appendTo: Invalid type for elementSelector, must be either a valid CSS selector or an instance of HTMLElement but found type: ' +
                        typeof elementSelector,
                );
            }
        }
    }

    /**
     * @deprecated Use appendTo() instead. This method will be removed in a future version.
     * @param {string|HTMLElement} elementSelector - DOM element, or Element selector for the DOM element
     */
    attachTo(elementSelector = '') {
        console.warn(
            'WebCalendar.attachTo() is deprecated. Use WebCalendar.appendTo() instead.',
        );
        this.appendTo(elementSelector);
    }

    /**
     * Subscribes the WebCalendar instance to the `calendarFetched` event emitted by the ApiClient.
     *
     * Upon receiving the event, it processes the liturgical calendar data and updates the calendar display.
     * The method will validate that the `apiClient` is an instance of ApiClient and listen to
     * the `calendarFetched` event on the client's event bus. When the event is triggered, it checks
     * the integrity of the received data, ensuring it contains the necessary properties and is of the correct type.
     * It then converts event dates from UNIX timestamps to Date objects, updates the internal calendar data,
     * and rebuilds the calendar table. If the WebCalendar is attached to a DOM element, the new calendar table
     * replaces the current content of the attached element.
     *
     * @param {ApiClient} apiClient - The API client to listen to for calendar data events.
     * @throws {Error} If the provided `apiClient` is not an instance of ApiClient or if the received
     * data is invalid or malformed.
     * @return {WebCalendar} - Returns the instance of WebCalendar for method chaining.
     */
    listenTo(apiClient) {
        if (false === apiClient instanceof ApiClient) {
            throw new Error(
                'WebCalendar.listenTo(apiClient) requires an instance of ApiClient, but found: ' +
                    typeof apiClient +
                    '.',
            );
        }
        // Any previous subscription is released BEFORE the two references are
        // overwritten. Assigning over them would orphan the old listener on the old
        // client's bus with nothing left holding its reference — measured: after
        // `listenTo(a)` then `listenTo(b)`, client `a` kept its listener, and
        // `dispose()` could then only ever remove `b`'s, so `a` stayed subscribed
        // for the lifetime of the page and would keep rendering into this calendar.
        this.#unsubscribe();

        // Kept, along with the client, so `dispose()` can hand the exact same
        // reference back to `EventEmitter.off()`. Before this the closure was
        // unreachable, so nothing could ever stop a mounted `WebCalendar`
        // re-rendering — a meta-component's `dispose()` could empty the mount and
        // the next fetch would silently refill it.
        this.#apiClient = apiClient;
        this.#calendarFetchedListener = (data, meta) => {
            // Take the rite the REQUEST was made under, not the client's current
            // rite. A rite change can leave two requests in flight — one through
            // the calendar select, one through the rite listener — and if the
            // earlier one lands last, reading the current rite would caption one
            // rite's data with the other rite's name. Falls back to the client's
            // rite for an emitter that supplies no meta.
            this.#rite = meta?.rite ?? apiClient._currentRite;
            if (typeof data !== 'object') {
                throw new Error(
                    'WebCalendar: Invalid type for data received in `calendarFetched` event, must be of type object but found type: ' +
                        typeof data,
                );
            }
            if (
                !Object.hasOwn(data, 'litcal') ||
                !Array.isArray(data.litcal) ||
                data.litcal.length === 0
            ) {
                throw new Error(
                    'WebCalendar: Invalid liturgical calendar data received in `calendarFetched` event',
                );
            }
            if (
                !Object.hasOwn(data, 'settings') ||
                !Object.hasOwn(data, 'metadata') ||
                !Object.hasOwn(data, 'messages')
            ) {
                throw new Error(
                    'WebCalendar: data received in `calendarFetched` event should have litcal, settings, metadata and messages properties',
                );
            }
            data.litcal = data.litcal.map((event) => {
                event.date = new Date(event.date);
                return event;
            });
            this.#calendarData = data;

            this.buildTable();
            if (this.#attachedElement && this.#domElement) {
                this.#swapIn();
                this.#announce();
            } else {
                if (null === this.#attachedElement) {
                    console.error('WebCalendar: No element to attach to.');
                }
                if (null === this.#domElement) {
                    console.error('WebCalendar: No table to attach.');
                }
            }
        };
        apiClient._eventBus.on(
            'calendarFetched',
            this.#calendarFetchedListener,
        );
        return this;
    }

    /**
     * Stops this calendar reacting to its client, and forgets its mount.
     *
     * Purely additive, and added because a meta-component's `dispose()` could
     * previously empty the mounted DOM only for the next `calendarFetched` to
     * refill it: the listener `listenTo()` attached was an anonymous closure with
     * no reference stored anywhere, so nothing could unsubscribe it.
     * `EventEmitter.off()` needs the exact same function reference, which is now
     * retained.
     *
     * Idempotent, and safe on an instance that never called `listenTo()`.
     *
     * @returns {void}
     */
    dispose() {
        this.#unsubscribe();
        this.#announcer?.dispose();
        this.#attachedElement = null;
        // Forgetting the mount detaches the live region with it, so the next
        // render RE-INSERTS the region — and a region written in the same task
        // it is inserted in is not reliably announced. A remounted calendar
        // therefore has to be silent on its first render, exactly as a fresh
        // one is.
        this.#hasRendered = false;
    }

    /**
     * Puts the freshly built table into the mount, leaving the live region be.
     *
     * `replaceChildren()` would remove the region along with the old table, and
     * a live region that is removed and re-inserted is not reliably announced —
     * assistive technology needs it present BEFORE its content changes. So every
     * child EXCEPT the region goes, the region is mounted if it is not there
     * yet, and the table is inserted before it. With announcements off this is
     * exactly the `replaceChildren( table )` it replaces, including clearing
     * whatever placeholder content the consumer left in the target.
     *
     * @returns {void}
     * @private
     */
    #swapIn() {
        const region = this.#announcer?.element ?? null;
        for (const child of Array.from(this.#attachedElement.childNodes)) {
            if (child !== region) {
                child.remove();
            }
        }
        if (null !== this.#announcer) {
            this.#announcer.mountInto(this.#attachedElement);
        }
        // A null reference node appends, which is what is wanted when there is
        // no region; otherwise the region stays last.
        this.#attachedElement.insertBefore(this.#domElement, region);
    }

    /**
     * Announces the calendar just rendered, as a summary and never the content.
     *
     * A live region carrying the table itself would be catastrophic, so this
     * says only which calendar is now shown and how large it is.
     *
     * Silent on the first render — see `#hasRendered`. Reads `#calendarData`
     * rather than the DOM, so it is unaffected both by `removeCaption()` and by
     * the asynchronous tail of `buildTable()`, which fills the tbody after this
     * has run.
     *
     * @returns {void}
     * @private
     */
    #announce() {
        if (null === this.#announcer) {
            return;
        }
        if (false === this.#hasRendered) {
            this.#hasRendered = true;
            return;
        }
        const count = this.#calendarData.litcal.length;
        this.#announcer.announce(
            formatPluralMessage(
                'CALENDAR_UPDATED_ANNOUNCEMENT',
                this.#baseLocale,
                count,
                {
                    calendar: this.#captionText(),
                    count: new Intl.NumberFormat(this.#locale).format(count),
                },
            ),
        );
    }

    /**
     * Releases the `calendarFetched` subscription, if there is one, and clears the
     * two references it needed.
     *
     * Shared by `dispose()` and by `listenTo()`, which must release a previous
     * subscription before overwriting the references that identify it. Deliberately
     * does NOT touch `#attachedElement`: forgetting the mount is `dispose()`'s
     * business, while re-listening keeps rendering to the same place.
     *
     * Idempotent, and safe when `listenTo()` was never called.
     *
     * @returns {void}
     * @private
     */
    #unsubscribe() {
        if (
            null !== this.#apiClient &&
            null !== this.#calendarFetchedListener
        ) {
            this.#apiClient._eventBus.off(
                'calendarFetched',
                this.#calendarFetchedListener,
            );
        }
        this.#apiClient = null;
        this.#calendarFetchedListener = null;
    }

    /**
     * The locale used by the WebCalendar instance.
     * @type {string}
     */
    get _locale() {
        return this.#locale;
    }

    /**
     * The live region element, or `null` when announcements are turned off.
     *
     * Non-null does NOT mean mounted: the element exists from construction and
     * is inserted by the first `#swapIn()`, so before any render this returns an
     * element the mount does not yet contain.
     *
     * @type {HTMLSpanElement|null}
     */
    get _liveRegion() {
        return this.#announcer?.element ?? null;
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
