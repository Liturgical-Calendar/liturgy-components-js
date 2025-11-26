import { ApiClient, CalendarSelect, ApiOptions, ApiOptionsFilter, LiturgyOfAnyDay } from 'liturgy-components-js';

/**
 * Get user's preferred languages from browser settings.
 * Returns an array of language codes in order of preference.
 * @returns {string[]}
 */
function getUserLanguages() {
    if (navigator.languages && navigator.languages.length > 0) {
        return [...navigator.languages];
    }
    if (navigator.language) {
        return [navigator.language];
    }
    return ['en'];
}

/**
 * Find the best matching locale from available options based on user's language preferences.
 * Tries exact match first, then language prefix match, for each preferred language in order.
 * @param {string[]} userLanguages - User's preferred languages in order of preference
 * @param {HTMLOptionElement[]} localeOptions - Available locale options from the select element
 * @returns {string} The best matching locale value, or the first available option
 */
function findBestLocale(userLanguages, localeOptions) {
    const availableLocales = localeOptions.map(opt => opt.value);

    for (const userLang of userLanguages) {
        // Try exact match first (e.g., "en-US" matches "en-US")
        const exactMatch = availableLocales.find(locale => locale.toLowerCase() === userLang.toLowerCase());
        if (exactMatch) {
            return exactMatch;
        }

        // Try language prefix match (e.g., "en-US" matches "en" or "en_GB")
        const userLangPrefix = userLang.split(/[-_]/)[0].toLowerCase();
        const prefixMatch = availableLocales.find(locale => locale.split(/[-_]/)[0].toLowerCase() === userLangPrefix);
        if (prefixMatch) {
            return prefixMatch;
        }
    }

    // Fall back to first available locale
    return availableLocales[0] || 'en';
}

const userLanguages = getUserLanguages();
const initialLang = userLanguages[0] || 'en';

ApiClient.init('http://localhost:8000').then(apiClient => {
    if (false === apiClient || false === apiClient instanceof ApiClient) {
        alert('Error initializing the Liturgical Calendar API Client');
        return;
    }

    // Create CalendarSelect with General Roman Calendar as default
    const calendarSelect = new CalendarSelect(initialLang);
    calendarSelect
        .allowNull()
        .class('form-select')
        .label({
            text: 'Calendar',
            class: 'form-label'
        })
        .wrapper({
            as: 'div',
            class: 'col-md-6'
        })
        .appendTo('#calendarOptions');

    // Set General Roman Calendar as default (empty value)
    calendarSelect._domElement.value = '';

    // Create ApiOptions with locale filter only, linked to CalendarSelect
    const apiOptions = new ApiOptions(initialLang);
    apiOptions
        .filter(ApiOptionsFilter.LOCALE_ONLY)
        .linkToCalendarSelect(calendarSelect);

    // Style the locale input before appending
    apiOptions._localeInput
        .wrapper('div')
        .wrapperClass('col-md-6')
        .class('form-select')
        .labelClass('form-label');

    apiOptions.appendTo('#calendarOptions');

    // Find best matching locale based on user's browser language preferences
    const localeOptions = Array.from(apiOptions._localeInput._domElement.options);
    const selectedLocale = findBestLocale(userLanguages, localeOptions);
    apiOptions._localeInput._domElement.value = selectedLocale;

    // Create LiturgyOfAnyDay component
    const liturgyOfAnyDay = new LiturgyOfAnyDay(selectedLocale);
    liturgyOfAnyDay
        .id('LiturgyOfAnyDay')
        .class('liturgy-of-any-day card shadow-sm')
        .titleClass('d-none') // Hide title since we have a page heading
        .dateClass('liturgy-of-any-day-date card-header py-3')
        .dateControlsClass('liturgy-of-any-day-date-controls row g-3 p-3 bg-light border-bottom')
        .eventsWrapperClass('liturgy-of-any-day-events-wrapper card-body')
        .eventClass('liturgy-of-any-day-event p-3 mb-3 rounded')
        .eventGradeClass('liturgy-of-any-day-event-grade small')
        .eventCommonClass('liturgy-of-any-day-event-common small fst-italic')
        .eventYearCycleClass('liturgy-of-any-day-event-year-cycle small')
        // Configure readings display
        .readingsWrapperClass('liturgy-of-any-day-readings-wrapper mt-3 pt-2')
        .readingsLabelClass('liturgy-of-any-day-readings-label')
        .readingClass('liturgy-of-any-day-reading small')
        .showReadings(true)
        // Configure date input controls with Bootstrap styling
        .dayInputConfig({
            wrapper: 'div',
            wrapperClass: 'col-4 col-md-3',
            class: 'form-control',
            labelClass: 'form-label',
            labelText: 'Day'
        })
        .monthInputConfig({
            wrapper: 'div',
            wrapperClass: 'col-8 col-md-5',
            class: 'form-select',
            labelClass: 'form-label',
            labelText: 'Month'
        })
        .yearInputConfig({
            wrapper: 'div',
            wrapperClass: 'col-12 col-md-4',
            class: 'form-control',
            labelClass: 'form-label',
            labelText: 'Year'
        })
        .buildDateControls()
        .listenTo(apiClient);

    liturgyOfAnyDay.replace('#liturgyOfAnyDay');

    // Wire ApiClient to listen to CalendarSelect and ApiOptions
    apiClient.listenTo(calendarSelect).listenTo(apiOptions);

    // Fetch the General Roman Calendar with the selected locale
    apiClient.fetchCalendar(selectedLocale);
});
