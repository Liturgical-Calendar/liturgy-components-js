import { ApiClient, CalendarSelect, ApiOptions, ApiOptionsFilter, LiturgyOfTheDay, Utils } from 'liturgy-components-js';

const userLanguages = Utils.getUserLanguages();
const initialLang = userLanguages[0] || 'en';

ApiClient.init('http://localhost:8000').then(apiClient => {
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
    calendarSelect.value('');

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
    const localeOptions = apiOptions._localeInput.options();
    const selectedLocale = Utils.findBestLocale(userLanguages, localeOptions);
    apiOptions._localeInput.value(selectedLocale);

    // Create LiturgyOfTheDay component
    // listenTo() automatically handles December 31st by configuring year_type=LITURGICAL with year+1
    const liturgyOfTheDay = new LiturgyOfTheDay(selectedLocale);
    liturgyOfTheDay
        .id('LiturgyOfTheDay')
        .class('liturgy-of-the-day card shadow-sm')
        .titleClass('d-none') // Hide title since we have a page heading
        .dateClass('liturgy-of-the-day-date card-header py-3')
        .eventsWrapperClass('liturgy-of-the-day-events-wrapper card-body')
        .eventClass('liturgy-of-the-day-event p-3 mb-3 rounded')
        .eventGradeClass('liturgy-of-the-day-event-grade small')
        .eventCommonClass('liturgy-of-the-day-event-common small fst-italic')
        .eventYearCycleClass('liturgy-of-the-day-event-year-cycle small')
        // Configure readings display
        .readingsWrapperClass('liturgy-of-the-day-readings-wrapper mt-3 pt-2')
        .readingsLabelClass('liturgy-of-the-day-readings-label')
        .readingClass('liturgy-of-the-day-reading small')
        .showReadings(true)
        .listenTo(apiClient);

    liturgyOfTheDay.replace('#liturgyOfTheDay');

    // Wire ApiClient to listen to CalendarSelect and ApiOptions
    apiClient.listenTo(calendarSelect).listenTo(apiOptions);

    // Fetch the General Roman Calendar with the selected locale.
    // The promise returned by a fetch method belongs to the caller: the library only
    // suppresses the rejections of the fire-and-forget requests it issues itself, so
    // this one has to be handled here. The message is prepended to the widget rather
    // than written over `#liturgyOfTheDay`, which `replace()` has already consumed.
    apiClient.fetchCalendar(selectedLocale).catch(error => {
        const banner = document.createElement('div');
        banner.className = 'alert alert-warning m-3';
        banner.textContent = `Could not load the calendar from ${error.url ?? 'the configured base'}: ${error.message}`;
        liturgyOfTheDay._domElement.prepend(banner);
    });
}).catch(error => {
    document.querySelector('#liturgyOfTheDay').textContent =
        `Could not reach the Liturgical Calendar API at ${error.url ?? 'the configured base'}: ${error.message}`;
});
