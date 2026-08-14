import Messages from '../Messages.js';
import ApiClient from '../ApiClient/ApiClient.js';
import { DayInput, MonthInput, YearInput } from '../ApiOptions/Input/index.js';
import { YearType } from '../Enums.js';
import ReadingsRenderer from '../ReadingsRenderer/ReadingsRenderer.js';
import { normalizeComponentOptions } from '../OptionsValidation.js';
import { toIntlLocale } from '../LocaleValidation.js';
import LiveAnnouncer from '../LiveAnnouncer.js';
import { formatMessage } from '../MessageFormat.js';
import Utils from '../Utils.js';

export default class LiturgyOfAnyDay {
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
        /Easter[1-7](_vigil){0,1}/,
    ]);

    /**
     * @type {['green', 'red', 'purple']}
     * @static
     * @private
     * @readonly
     */
    static #highContrast = Object.freeze(['green', 'red', 'purple']);

    /** @type {Date} */
    #selectedDate = null;

    /** @type {Intl.Locale} */
    #locale = null;

    /** @type {HTMLElement} */
    #domElement = null;

    /**
     * The hidden live region, or `null` when `announceUpdates( false )` was set.
     *
     * @type {LiveAnnouncer|null}
     */
    #announcer = new LiveAnnouncer();

    /**
     * Whether a render carrying data has already happened.
     *
     * The FIRST one is deliberately silent: it is the page loading, not a user
     * action, and a live region firing then talks over whatever the page is
     * already announcing.
     *
     * @type {boolean}
     */
    #hasRendered = false;

    /**
     * Whether this widget has a refetch of its own in flight.
     *
     * A year change renders the CACHED payload immediately and only THEN
     * refetches, so one user action produces two renders. The first describes
     * the year the user has just left, so it is rendered but not announced.
     *
     * @type {boolean}
     */
    #refetchPending = false;

    /** @type {HTMLElement} */
    #titleElement = null;

    /** @type {HTMLElement} */
    #dateElement = null;

    /** @type {HTMLElement} */
    #dateControlsWrapper = null;

    /** @type {HTMLElement} */
    #eventsElementsWrapper = null;

    /** @type {DayInput} */
    #dayInput = null;

    /** @type {MonthInput} */
    #monthInput = null;

    /** @type {YearInput} */
    #yearInput = null;

    /** @type {Object|null} */
    #calendarData = null;

    /** @type {ApiClient|null} */
    #apiClient = null;

    /** @type {string} */
    #eventClassName = '';

    /** @type {string} */
    #eventGradeClassName = '';

    /** @type {string} */
    #eventCommonClassName = '';

    /** @type {string} */
    #eventYearCycleClassName = '';

    /** @type {string} */
    #currentYearType = YearType.CIVIL;

    /** @type {ReadingsRenderer} */
    #readingsRenderer = new ReadingsRenderer();

    /** @type {boolean} */
    #showReadings = true;

    /**
     * Validates the given class name to ensure it is usable in a `class` attribute.
     *
     * Delegates to {@link Utils.validateClassName} rather than carrying its own copy
     * of the pattern. It used to inline an identical regex, and `LiturgyOfTheDay`
     * inlined a third — so widening the rule to accept utility-framework classes
     * (`md:w-1/2`, `p-1.5`, `bg-[#1da1f2]`) meant changing the same expression in
     * three places, and a component that missed the change would reject classes its
     * siblings accepted. One definition, one behaviour.
     *
     * @param {string} className - The class name to validate.
     * @returns {boolean} True if the class name is valid, false otherwise.
     * @static
     * @private
     */
    static #isValidClassName(className) {
        return Utils.validateClassName(className);
    }

    /**
     * Validates the given ID to ensure it is a valid HTML ID.
     *
     * @param {string} id - The ID to validate.
     * @returns {boolean} True if the ID is valid, false otherwise.
     * @static
     * @private
     */
    static #isValidId(id) {
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
     * Constructs a LiturgyOfAnyDay object.
     *
     * @param {string|Intl.Locale|Object|null} [options=null] - A locale (a string or an `Intl.Locale`),
     *        or an options object carrying one as its `locale`. `null` and `undefined` mean "not
     *        supplied" both as the argument itself and as the `locale` property.
     * @throws {Error} If `options` is none of a string, an `Intl.Locale`, a plain object or nullish, or if the locale is invalid.
     */
    constructor(options = null) {
        options = normalizeComponentOptions(options, 'LiturgyOfAnyDay');
        // A nullish READ, not `Object.hasOwn`: see the identical note in
        // `LiturgyOfTheDay`. The key's presence is not the question — its value is.
        this.#validateLocale(options.locale ?? 'en');

        const now = new Date();
        this.#selectedDate = new Date(
            Date.UTC(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                0,
                0,
                0,
                0,
            ),
        );

        // Initialize year_type based on current date - use LITURGICAL for December 31st
        const isDecember31st = now.getMonth() === 11 && now.getDate() === 31;
        this.#currentYearType = isDecember31st
            ? YearType.LITURGICAL
            : YearType.CIVIL;

        this.#domElement = document.createElement('div');

        this.#titleElement = document.createElement('h1');
        this.#titleElement.textContent =
            Messages[this.#locale.language]['LITURGY_OF_THE_DAY'] ||
            'Liturgy of the Day';
        this.#domElement.appendChild(this.#titleElement);

        this.#dateElement = document.createElement('div');
        this.#updateDateDisplay();
        this.#domElement.appendChild(this.#dateElement);

        // Create date controls wrapper
        this.#dateControlsWrapper = document.createElement('div');
        this.#domElement.appendChild(this.#dateControlsWrapper);

        // Create day, month, year inputs
        this.#dayInput = new DayInput(this.#locale);
        this.#monthInput = new MonthInput(this.#locale);
        this.#yearInput = new YearInput(this.#locale);

        // Set up event listeners for date changes
        this.#dayInput._domElement.addEventListener('change', () =>
            this.#handleDateChange(),
        );
        this.#monthInput._domElement.addEventListener('change', () => {
            this.#updateDaysInMonth();
            this.#handleDateChange();
        });
        this.#yearInput._domElement.addEventListener('change', () => {
            // A year change always ends in a refetch, either through
            // `#handleDateChange()`'s year_type branch or through the explicit
            // one below. Marking it HERE — before the immediate, stale render —
            // is what keeps that intermediate render silent.
            if (this.#apiClient) {
                this.#refetchPending = true;
            }
            this.#updateDaysInMonth();
            // handleDateChange returns true if it triggered a refetch (year_type change)
            const refetchTriggered = this.#handleDateChange();
            // Year change requires refetching calendar data (if not already triggered)
            if (this.#apiClient && !refetchTriggered) {
                const newYear = parseInt(this.#yearInput._domElement.value, 10);
                // Use the appropriate year based on December 31st check
                const day = parseInt(this.#dayInput._domElement.value, 10);
                const month = parseInt(this.#monthInput._domElement.value, 10);
                const isDecember31st = month === 12 && day === 31;
                const yearToFetch = isDecember31st ? newYear + 1 : newYear;
                // Dropping the promise here would surface as an unhandled rejection. The client
                // suppresses it when a 'calendarFetchFailed' subscriber exists and logs it when
                // none does; delegating keeps that rule identical across modules.
                this.#apiClient._discardRequest(
                    this.#apiClient.year(yearToFetch).refetchCalendarData(),
                );
            }
        });

        this.#eventsElementsWrapper = document.createElement('div');
        this.#domElement.appendChild(this.#eventsElementsWrapper);

        // Mounted once, as the last child, and never removed: `#renderEvents()`
        // only clears `#eventsElementsWrapper`, so the region stays in the DOM
        // across every re-render — which is what assistive technology needs in
        // order to announce a change to it at all.
        this.#announcer.mountInto(this.#domElement);

        if (typeof options === 'object' && options !== null) {
            if (Object.hasOwn(options, 'id')) {
                this.id(options.id);
            }
            if (Object.hasOwn(options, 'class')) {
                this.class(options.class);
            }
            if (Object.hasOwn(options, 'titleClass')) {
                this.titleClass(options.titleClass);
            }
            if (Object.hasOwn(options, 'dateClass')) {
                this.dateClass(options.dateClass);
            }
            if (Object.hasOwn(options, 'dateControlsClass')) {
                this.dateControlsClass(options.dateControlsClass);
            }
            if (Object.hasOwn(options, 'eventClass')) {
                this.eventClass(options.eventClass);
            }
            if (Object.hasOwn(options, 'eventGradeClass')) {
                this.eventGradeClass(options.eventGradeClass);
            }
            if (Object.hasOwn(options, 'eventCommonClass')) {
                this.eventCommonClass(options.eventCommonClass);
            }
            if (Object.hasOwn(options, 'eventYearCycleClass')) {
                this.eventYearCycleClass(options.eventYearCycleClass);
            }
            if (Object.hasOwn(options, 'eventsWrapperClass')) {
                this.eventsWrapperClass(options.eventsWrapperClass);
            }
            if (Object.hasOwn(options, 'readingsWrapperClass')) {
                this.readingsWrapperClass(options.readingsWrapperClass);
            }
            if (Object.hasOwn(options, 'readingsLabelClass')) {
                this.readingsLabelClass(options.readingsLabelClass);
            }
            if (Object.hasOwn(options, 'readingClass')) {
                this.readingClass(options.readingClass);
            }
            if (Object.hasOwn(options, 'showReadings')) {
                this.showReadings(options.showReadings);
            }
            if (Object.hasOwn(options, 'announceUpdates')) {
                this.announceUpdates(options.announceUpdates);
            }
        }
    }

    /**
     * Validates the given locale string.
     *
     * @param {string|Intl.Locale} locale - The locale to validate.
     * @throws {Error} If the locale is invalid.
     * @private
     */
    #validateLocale(locale) {
        this.#locale = toIntlLocale(locale, 'LiturgyOfAnyDay');
    }

    /**
     * Updates the date display element.
     * @private
     */
    #updateDateDisplay() {
        const formatter = new Intl.DateTimeFormat(this.#locale.baseName, {
            dateStyle: 'full',
            timeZone: 'UTC',
        });
        this.#dateElement.textContent = formatter.format(this.#selectedDate);
    }

    /**
     * Updates the max days in the day input based on the current month/year.
     * @private
     */
    #updateDaysInMonth() {
        const year = parseInt(this.#yearInput._domElement.value, 10);
        const month = parseInt(this.#monthInput._domElement.value, 10);
        this.#dayInput.updateMaxDay(month, year);
    }

    /**
     * Handles date control changes.
     * Checks for December 31st to switch to LITURGICAL year type for vigil masses.
     * @private
     * @returns {boolean} True if a refetch was triggered due to year_type change, false otherwise.
     */
    #handleDateChange() {
        const day = parseInt(this.#dayInput._domElement.value, 10);
        const month = parseInt(this.#monthInput._domElement.value, 10);
        const year = parseInt(this.#yearInput._domElement.value, 10);

        this.#selectedDate = new Date(
            Date.UTC(year, month - 1, day, 0, 0, 0, 0),
        );
        this.#updateDateDisplay();

        // Check if we need to switch year_type for December 31st (vigil mass support)
        const isDecember31st = month === 12 && day === 31;

        if (this.#apiClient) {
            if (
                isDecember31st &&
                this.#currentYearType !== YearType.LITURGICAL
            ) {
                // Switch to LITURGICAL year type with year+1 to get vigil masses
                this.#currentYearType = YearType.LITURGICAL;
                // Dropping the promise here would surface as an unhandled rejection — see the
                // year input listener above; ApiClient owns the log-or-suppress rule.
                this.#apiClient._discardRequest(
                    this.#apiClient
                        .yearType(YearType.LITURGICAL)
                        .year(year + 1)
                        .refetchCalendarData(),
                );
                return true; // Refetch triggered, wait for calendarFetched event to render
            } else if (
                !isDecember31st &&
                this.#currentYearType !== YearType.CIVIL
            ) {
                // Switch back to CIVIL year type
                this.#currentYearType = YearType.CIVIL;
                // Dropping the promise here would surface as an unhandled rejection — see the
                // year input listener above; ApiClient owns the log-or-suppress rule.
                this.#apiClient._discardRequest(
                    this.#apiClient
                        .yearType(YearType.CIVIL)
                        .year(year)
                        .refetchCalendarData(),
                );
                return true; // Refetch triggered, wait for calendarFetched event to render
            }
        }

        this.#renderEvents();
        return false;
    }

    /**
     * Renders the liturgical events for the selected date.
     * @private
     */
    #renderEvents() {
        // Clear previous events
        this.#eventsElementsWrapper.innerHTML = '';

        if (!this.#calendarData || !this.#calendarData.litcal) {
            return;
        }

        const selectedTimestamp = this.#selectedDate.getTime();
        const todaysEvents = this.#calendarData.litcal.filter((event) => {
            return new Date(event.date).getTime() === selectedTimestamp;
        });

        if (todaysEvents.length === 0) {
            const noEventsEl = document.createElement('p');
            noEventsEl.textContent =
                'No liturgical events found for this date.';
            this.#eventsElementsWrapper.appendChild(noEventsEl);
        } else {
            this.#updateEventDetails(todaysEvents);
        }

        this.#announce();
    }

    /**
     * Announces the date just rendered, as a summary and never the content.
     *
     * Silent on the first render, and silent while this widget's own refetch is
     * in flight — see `#hasRendered` and `#refetchPending`. Reuses the string
     * already in `#dateElement`, so the announcement and the visible date cannot
     * drift.
     *
     * The announcement names the date but NOT the calendar, so changing only the
     * calendar or the rite while the date stays put produces identical text, and
     * a screen reader may not repeat it. Naming the calendar would mean giving
     * this widget `WebCalendar`'s three-branch caption derivation AND its rite
     * tracking, neither of which it has; that is recorded as a follow-up rather
     * than done under #65.
     *
     * @returns {void}
     * @private
     */
    #announce() {
        if (null === this.#announcer || this.#refetchPending) {
            return;
        }
        if (false === this.#hasRendered) {
            this.#hasRendered = true;
            return;
        }
        this.#announcer.announce(
            formatMessage(
                'LITURGY_UPDATED_ANNOUNCEMENT',
                this.#locale.language,
                { date: this.#dateElement.textContent },
            ),
        );
    }

    /**
     * Updates the DOM elements with the details of the events.
     *
     * @param {import('../typedefs').CalendarEvent[]} events - The liturgical events.
     * @private
     */
    #updateEventDetails(events) {
        events.forEach((celebration) => {
            const lclzdGrade =
                celebration.grade < 7 ? celebration.grade_lcl : '';
            const isSundayOrdAdvLentEaster =
                LiturgyOfAnyDay.#filterTagsDisplayGrade.some((pattern) =>
                    pattern.test(celebration.event_key),
                );
            const celebrationGrade =
                celebration.grade_display !== null
                    ? celebration.grade_display
                    : !isSundayOrdAdvLentEaster && celebration.grade !== 0
                      ? lclzdGrade
                      : '';
            const celebrationColor = celebration.color;
            const litEventElement = document.createElement('div');
            if (this.#eventClassName !== '') {
                litEventElement.classList.add(
                    ...this.#eventClassName.split(' '),
                );
            }
            litEventElement.style.backgroundColor = celebrationColor[0];
            litEventElement.style.color =
                LiturgyOfAnyDay.#highContrast.includes(celebrationColor[0])
                    ? 'white'
                    : 'black';
            // Add border for white backgrounds to distinguish from parent background
            if (celebrationColor[0] === 'white') {
                litEventElement.style.border = '1px solid #dee2e6';
            }

            const eventNameElement = document.createElement('h3');
            eventNameElement.textContent = celebration.name;
            litEventElement.appendChild(eventNameElement);

            if (celebrationGrade !== '') {
                const celebrationGradeElement = document.createElement('div');
                if (this.#eventGradeClassName !== '') {
                    celebrationGradeElement.classList.add(
                        ...this.#eventGradeClassName.split(' '),
                    );
                }
                celebrationGradeElement.classList.add(
                    `grade-${celebration.grade}`,
                );
                celebrationGradeElement.textContent = celebrationGrade;
                litEventElement.appendChild(celebrationGradeElement);
            }

            if (celebration.common && celebration.common.length) {
                const celebrationCommonElement = document.createElement('div');
                if (this.#eventCommonClassName !== '') {
                    celebrationCommonElement.classList.add(
                        ...this.#eventCommonClassName.split(' '),
                    );
                }
                celebrationCommonElement.textContent = celebration.common_lcl;
                litEventElement.appendChild(celebrationCommonElement);
            }

            if (Object.hasOwn(celebration, 'liturgical_year')) {
                const celebrationLiturgicalYearElement =
                    document.createElement('div');
                if (this.#eventYearCycleClassName !== '') {
                    celebrationLiturgicalYearElement.classList.add(
                        ...this.#eventYearCycleClassName.split(' '),
                    );
                }
                celebrationLiturgicalYearElement.textContent =
                    celebration.liturgical_year;
                litEventElement.appendChild(celebrationLiturgicalYearElement);
            }

            // Render lectionary readings if enabled and available
            if (
                this.#showReadings &&
                Object.prototype.hasOwnProperty.call(celebration, 'readings')
            ) {
                this.#readingsRenderer.renderReadings(
                    celebration.readings,
                    litEventElement,
                );
            }

            this.#eventsElementsWrapper.appendChild(litEventElement);
        });
    }

    /**
     * Sets the id of the element.
     *
     * @param {string} id The id of the element
     * @throws {Error} if id is not a string or not a valid CSS selector
     * @returns {LiturgyOfAnyDay} The current instance for method chaining
     */
    id(id) {
        if (typeof id !== 'string') {
            throw new Error(
                'LiturgyOfAnyDay: Invalid type for id, must be of type string but found type: ' +
                    typeof id,
            );
        }
        if (false === LiturgyOfAnyDay.#isValidId(id)) {
            throw new Error(
                `LiturgyOfAnyDay: Invalid id ${id}, must be a valid CSS selector`,
            );
        }
        this.#domElement.id = id;
        return this;
    }

    /**
     * Sets the class attribute for the LiturgyOfAnyDay instance's DOM element.
     *
     * @param {string} className - A space-separated string of class names.
     * @throws {Error} If the className is not a string or invalid.
     * @returns {LiturgyOfAnyDay} The current instance for chaining.
     */
    class(className) {
        if (typeof className !== 'string') {
            throw new Error(
                'LiturgyOfAnyDay: Invalid type for className, must be of type string but found type: ' +
                    typeof className,
            );
        }
        const classNames = className.split(/\s+/);
        classNames.forEach((className) => {
            if (false === LiturgyOfAnyDay.#isValidClassName(className)) {
                throw new Error(
                    'LiturgyOfAnyDay: Invalid class name: ' + className,
                );
            }
        });
        this.#domElement.classList.add(...classNames);
        return this;
    }

    /**
     * Sets the class attribute for the title element.
     *
     * @param {string} className - A space-separated string of class names.
     * @returns {LiturgyOfAnyDay} The current instance for chaining.
     */
    titleClass(className) {
        if (typeof className !== 'string') {
            throw new Error(
                'LiturgyOfAnyDay.titleClass: Invalid type for className',
            );
        }
        const classNames = className.split(/\s+/);
        classNames.forEach((className) => {
            if (false === LiturgyOfAnyDay.#isValidClassName(className)) {
                throw new Error(
                    'LiturgyOfAnyDay: Invalid class name: ' + className,
                );
            }
        });
        this.#titleElement.classList.add(...classNames);
        return this;
    }

    /**
     * Sets the class attribute for the date element.
     *
     * @param {string} className - A space-separated string of class names.
     * @returns {LiturgyOfAnyDay} The current instance for chaining.
     */
    dateClass(className) {
        if (typeof className !== 'string') {
            throw new Error(
                'LiturgyOfAnyDay.dateClass: Invalid type for className',
            );
        }
        const classNames = className.split(/\s+/);
        classNames.forEach((className) => {
            if (false === LiturgyOfAnyDay.#isValidClassName(className)) {
                throw new Error(
                    'LiturgyOfAnyDay: Invalid class name: ' + className,
                );
            }
        });
        this.#dateElement.classList.add(...classNames);
        return this;
    }

    /**
     * Sets the class attribute for the date controls wrapper element.
     *
     * @param {string} className - A space-separated string of class names.
     * @returns {LiturgyOfAnyDay} The current instance for chaining.
     */
    dateControlsClass(className) {
        if (typeof className !== 'string') {
            throw new Error(
                'LiturgyOfAnyDay.dateControlsClass: Invalid type for className',
            );
        }
        const classNames = className.split(/\s+/);
        classNames.forEach((className) => {
            if (false === LiturgyOfAnyDay.#isValidClassName(className)) {
                throw new Error(
                    'LiturgyOfAnyDay: Invalid class name: ' + className,
                );
            }
        });
        this.#dateControlsWrapper.classList.add(...classNames);
        return this;
    }

    /**
     * Sets the class attribute for the events wrapper element.
     *
     * @param {string} className - A space-separated string of class names.
     * @returns {LiturgyOfAnyDay} The current instance for chaining.
     */
    eventsWrapperClass(className) {
        if (typeof className !== 'string') {
            throw new Error(
                'LiturgyOfAnyDay.eventsWrapperClass: Invalid type for className',
            );
        }
        const classNames = className.split(/\s+/);
        classNames.forEach((className) => {
            if (false === LiturgyOfAnyDay.#isValidClassName(className)) {
                throw new Error(
                    'LiturgyOfAnyDay: Invalid class name: ' + className,
                );
            }
        });
        this.#eventsElementsWrapper.classList.add(...classNames);
        return this;
    }

    /**
     * Sets the class attribute for the event elements.
     *
     * @param {string} className - A space-separated string of class names.
     * @returns {LiturgyOfAnyDay} The current instance for chaining.
     */
    eventClass(className) {
        if (typeof className !== 'string') {
            throw new Error(
                'LiturgyOfAnyDay.eventClass: Invalid type for className',
            );
        }
        const classNames = className.split(/\s+/);
        classNames.forEach((className) => {
            if (false === LiturgyOfAnyDay.#isValidClassName(className)) {
                throw new Error(
                    'LiturgyOfAnyDay: Invalid class name: ' + className,
                );
            }
        });
        this.#eventClassName = classNames.join(' ');
        return this;
    }

    /**
     * Sets the class for event grade elements.
     *
     * @param {string} className - A space-separated string of class names.
     * @returns {LiturgyOfAnyDay} The current instance for chaining.
     */
    eventGradeClass(className) {
        if (typeof className !== 'string') {
            throw new Error(
                'LiturgyOfAnyDay.eventGradeClass: Invalid type for className',
            );
        }
        const classNames = className.split(/\s+/);
        classNames.forEach((className) => {
            if (false === LiturgyOfAnyDay.#isValidClassName(className)) {
                throw new Error(
                    'LiturgyOfAnyDay: Invalid class name: ' + className,
                );
            }
        });
        this.#eventGradeClassName = classNames.join(' ');
        return this;
    }

    /**
     * Sets the class for event common elements.
     *
     * @param {string} className - A space-separated string of class names.
     * @returns {LiturgyOfAnyDay} The current instance for chaining.
     */
    eventCommonClass(className) {
        if (typeof className !== 'string') {
            throw new Error(
                'LiturgyOfAnyDay.eventCommonClass: Invalid type for className',
            );
        }
        const classNames = className.split(/\s+/);
        classNames.forEach((className) => {
            if (false === LiturgyOfAnyDay.#isValidClassName(className)) {
                throw new Error(
                    'LiturgyOfAnyDay: Invalid class name: ' + className,
                );
            }
        });
        this.#eventCommonClassName = classNames.join(' ');
        return this;
    }

    /**
     * Sets the class for event year cycle elements.
     *
     * @param {string} className - A space-separated string of class names.
     * @returns {LiturgyOfAnyDay} The current instance for chaining.
     */
    eventYearCycleClass(className) {
        if (typeof className !== 'string') {
            throw new Error(
                'LiturgyOfAnyDay.eventYearCycleClass: Invalid type for className',
            );
        }
        const classNames = className.split(/\s+/);
        classNames.forEach((className) => {
            if (false === LiturgyOfAnyDay.#isValidClassName(className)) {
                throw new Error(
                    'LiturgyOfAnyDay: Invalid class name: ' + className,
                );
            }
        });
        this.#eventYearCycleClassName = classNames.join(' ');
        return this;
    }

    /**
     * Sets the class attribute for the readings wrapper element.
     *
     * @param {string} className - A space-separated string of class names.
     * @returns {LiturgyOfAnyDay} The current instance for chaining.
     */
    readingsWrapperClass(className) {
        if (typeof className !== 'string') {
            throw new Error(
                'LiturgyOfAnyDay.readingsWrapperClass: Invalid type for className',
            );
        }
        const classNames = className.split(/\s+/);
        classNames.forEach((className) => {
            if (false === LiturgyOfAnyDay.#isValidClassName(className)) {
                throw new Error(
                    'LiturgyOfAnyDay: Invalid class name: ' + className,
                );
            }
        });
        this.#readingsRenderer.setReadingsWrapperClassName(
            classNames.join(' '),
        );
        return this;
    }

    /**
     * Sets the class attribute for the readings label elements.
     *
     * @param {string} className - A space-separated string of class names.
     * @returns {LiturgyOfAnyDay} The current instance for chaining.
     */
    readingsLabelClass(className) {
        if (typeof className !== 'string') {
            throw new Error(
                'LiturgyOfAnyDay.readingsLabelClass: Invalid type for className',
            );
        }
        const classNames = className.split(/\s+/);
        classNames.forEach((className) => {
            if (false === LiturgyOfAnyDay.#isValidClassName(className)) {
                throw new Error(
                    'LiturgyOfAnyDay: Invalid class name: ' + className,
                );
            }
        });
        this.#readingsRenderer.setReadingsLabelClassName(classNames.join(' '));
        return this;
    }

    /**
     * Sets the class attribute for the individual reading elements.
     *
     * @param {string} className - A space-separated string of class names.
     * @returns {LiturgyOfAnyDay} The current instance for chaining.
     */
    readingClass(className) {
        if (typeof className !== 'string') {
            throw new Error(
                'LiturgyOfAnyDay.readingClass: Invalid type for className',
            );
        }
        const classNames = className.split(/\s+/);
        classNames.forEach((className) => {
            if (false === LiturgyOfAnyDay.#isValidClassName(className)) {
                throw new Error(
                    'LiturgyOfAnyDay: Invalid class name: ' + className,
                );
            }
        });
        this.#readingsRenderer.setReadingClassName(classNames.join(' '));
        return this;
    }

    /**
     * Sets whether to show lectionary readings.
     *
     * @param {boolean} show - Whether to display lectionary readings.
     * @returns {LiturgyOfAnyDay} The current instance for chaining.
     */
    showReadings(show = true) {
        if (typeof show !== 'boolean') {
            throw new Error(
                'LiturgyOfAnyDay.showReadings: Invalid type for show, must be of type boolean',
            );
        }
        this.#showReadings = show;
        return this;
    }

    /**
     * Configures the day input element.
     *
     * @param {Object} options - Configuration options for the day input.
     * @param {string} [options.class] - CSS class for the input element.
     * @param {string} [options.labelClass] - CSS class for the label element.
     * @param {string} [options.labelText] - Custom label text.
     * @param {string} [options.wrapper] - Wrapper element type ('div' or 'td').
     * @param {string} [options.wrapperClass] - CSS class for the wrapper element.
     * @returns {LiturgyOfAnyDay} The current instance for chaining.
     */
    dayInputConfig(options) {
        if (options.wrapper) {
            this.#dayInput.wrapper(options.wrapper);
        }
        if (options.wrapperClass) {
            this.#dayInput.wrapperClass(options.wrapperClass);
        }
        if (options.class) {
            this.#dayInput.class(options.class);
        }
        if (options.labelClass) {
            this.#dayInput.labelClass(options.labelClass);
        }
        if (options.labelText) {
            this.#dayInput._labelElement.textContent = options.labelText;
        }
        return this;
    }

    /**
     * Configures the month input element.
     *
     * @param {Object} options - Configuration options for the month input.
     * @param {string} [options.class] - CSS class for the input element.
     * @param {string} [options.labelClass] - CSS class for the label element.
     * @param {string} [options.labelText] - Custom label text.
     * @param {string} [options.wrapper] - Wrapper element type ('div' or 'td').
     * @param {string} [options.wrapperClass] - CSS class for the wrapper element.
     * @returns {LiturgyOfAnyDay} The current instance for chaining.
     */
    monthInputConfig(options) {
        if (options.wrapper) {
            this.#monthInput.wrapper(options.wrapper);
        }
        if (options.wrapperClass) {
            this.#monthInput.wrapperClass(options.wrapperClass);
        }
        if (options.class) {
            this.#monthInput.class(options.class);
        }
        if (options.labelClass) {
            this.#monthInput.labelClass(options.labelClass);
        }
        if (options.labelText) {
            this.#monthInput._labelElement.textContent = options.labelText;
        }
        return this;
    }

    /**
     * Configures the year input element.
     *
     * @param {Object} options - Configuration options for the year input.
     * @param {string} [options.class] - CSS class for the input element.
     * @param {string} [options.labelClass] - CSS class for the label element.
     * @param {string} [options.labelText] - Custom label text.
     * @param {string} [options.wrapper] - Wrapper element type ('div' or 'td').
     * @param {string} [options.wrapperClass] - CSS class for the wrapper element.
     * @returns {LiturgyOfAnyDay} The current instance for chaining.
     */
    yearInputConfig(options) {
        if (options.wrapper) {
            this.#yearInput.wrapper(options.wrapper);
        }
        if (options.wrapperClass) {
            this.#yearInput.wrapperClass(options.wrapperClass);
        }
        if (options.class) {
            this.#yearInput.class(options.class);
        }
        if (options.labelClass) {
            this.#yearInput.labelClass(options.labelClass);
        }
        if (options.labelText) {
            this.#yearInput._labelElement.textContent = options.labelText;
        }
        return this;
    }

    /**
     * Sets the LiturgyOfAnyDay instance to listen to the ApiClient for calendar data.
     * Also configures the ApiClient with the correct year_type based on the selected date
     * (LITURGICAL for December 31st to include vigil masses, CIVIL otherwise).
     *
     * @param {ApiClient} apiClient - The API client to listen to.
     * @throws {Error} If the provided apiClient is not an instance of ApiClient.
     * @returns {LiturgyOfAnyDay} The current instance for chaining.
     */
    listenTo(apiClient) {
        if (false === apiClient instanceof ApiClient) {
            throw new Error(
                'LiturgyOfAnyDay.listenTo(apiClient) requires an instance of ApiClient, but found: ' +
                    typeof apiClient +
                    '.',
            );
        }
        this.#apiClient = apiClient;

        // Configure ApiClient with the correct year_type based on the initial selected date
        // This ensures the first fetch includes vigil masses if needed (December 31st)
        const day = parseInt(this.#dayInput._domElement.value, 10);
        const month = parseInt(this.#monthInput._domElement.value, 10);
        const year = parseInt(this.#yearInput._domElement.value, 10);
        const isDecember31st = month === 12 && day === 31;

        if (isDecember31st) {
            // Use LITURGICAL year type with year+1 to get vigil masses
            apiClient.yearType(YearType.LITURGICAL).year(year + 1);
        } else {
            // Use CIVIL year type with the selected year
            apiClient.yearType(YearType.CIVIL).year(year);
        }

        apiClient._eventBus.on('calendarFetched', (data) => {
            if (typeof data !== 'object') {
                throw new Error(
                    'LiturgyOfAnyDay: Invalid type for data received in `calendarFetched` event',
                );
            }
            if (
                !Object.hasOwn(data, 'litcal') ||
                !Array.isArray(data.litcal) ||
                data.litcal.length === 0
            ) {
                throw new Error(
                    'LiturgyOfAnyDay: Invalid liturgical calendar data received',
                );
            }
            this.#calendarData = data;
            // Whatever refetch this widget had in flight has landed, so the
            // render below is the settled one and may be announced.
            this.#refetchPending = false;
            this.#renderEvents();
        });
        return this;
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
     * @returns {LiturgyOfAnyDay} The current instance for chaining.
     */
    announceUpdates(enabled) {
        if (typeof enabled !== 'boolean') {
            throw new Error(
                'LiturgyOfAnyDay.announceUpdates(): invalid type for parameter, must be of type boolean but found type: ' +
                    typeof enabled,
            );
        }
        if (false === enabled) {
            this.#announcer?.dispose();
            this.#announcer = null;
        } else if (null === this.#announcer) {
            this.#announcer = new LiveAnnouncer();
            this.#announcer.mountInto(this.#domElement);
        }
        return this;
    }

    /**
     * Appends the date control inputs to the date controls wrapper.
     * Call this after configuring the inputs but before appending to DOM.
     *
     * @returns {LiturgyOfAnyDay} The current instance for chaining.
     */
    buildDateControls() {
        this.#dayInput.appendTo(this.#dateControlsWrapper);
        this.#monthInput.appendTo(this.#dateControlsWrapper);
        this.#yearInput.appendTo(this.#dateControlsWrapper);
        return this;
    }

    /**
     * Appends the LiturgyOfAnyDay instance to the element matched by the selector.
     *
     * @param {string|HTMLElement} elementSelector - The CSS selector or HTMLElement.
     */
    appendTo(elementSelector) {
        if (elementSelector instanceof HTMLElement) {
            elementSelector.appendChild(this.#domElement);
        } else if (typeof elementSelector === 'string') {
            const element =
                LiturgyOfAnyDay.#validateElementSelector(elementSelector);
            element.appendChild(this.#domElement);
        } else {
            throw new Error(
                'LiturgyOfAnyDay.appendTo(): invalid type for parameter',
            );
        }
    }

    /**
     * Replaces the element matched by the selector with this component.
     *
     * @param {string|HTMLElement} elementSelector - The CSS selector or HTMLElement.
     */
    replace(elementSelector) {
        if (elementSelector instanceof HTMLElement) {
            elementSelector.replaceWith(this.#domElement);
        } else if (typeof elementSelector === 'string') {
            const element =
                LiturgyOfAnyDay.#validateElementSelector(elementSelector);
            element.replaceWith(this.#domElement);
        } else {
            throw new Error(
                'LiturgyOfAnyDay.replace(): invalid type for parameter',
            );
        }
    }

    /**
     * Retrieves the underlying DOM element.
     *
     * @returns {HTMLElement} The DOM element.
     */
    get _domElement() {
        return this.#domElement;
    }

    /**
     * The live region element, or `null` when announcements are turned off.
     *
     * @type {HTMLSpanElement|null}
     */
    get _liveRegion() {
        return this.#announcer?.element ?? null;
    }

    /**
     * Retrieves the title element.
     *
     * @returns {HTMLElement} The title element.
     */
    get _titleElement() {
        return this.#titleElement;
    }

    /**
     * Retrieves the date element.
     *
     * @returns {HTMLElement} The date element.
     */
    get _dateElement() {
        return this.#dateElement;
    }

    /**
     * Retrieves the date controls wrapper element.
     *
     * @returns {HTMLElement} The date controls wrapper element.
     */
    get _dateControlsWrapper() {
        return this.#dateControlsWrapper;
    }

    /**
     * Retrieves the events wrapper element.
     *
     * @returns {HTMLElement} The events wrapper element.
     */
    get _eventsElementsWrapper() {
        return this.#eventsElementsWrapper;
    }

    /**
     * Retrieves the day input component.
     *
     * @returns {DayInput} The day input component.
     */
    get _dayInput() {
        return this.#dayInput;
    }

    /**
     * Retrieves the month input component.
     *
     * @returns {MonthInput} The month input component.
     */
    get _monthInput() {
        return this.#monthInput;
    }

    /**
     * Retrieves the year input component.
     *
     * @returns {YearInput} The year input component.
     */
    get _yearInput() {
        return this.#yearInput;
    }
}
