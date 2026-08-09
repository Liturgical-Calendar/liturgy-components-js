import {
    ApiClient,
    CalendarSelect,
    ApiOptions,
    WebCalendar,
    ApiOptionsFilter,
    Grouping,
    ColorAs,
} from 'liturgy-components-js';

const BASES = [
    {
        url: 'http://localhost:8000',
        controls: '#devControls',
        calendar: '#devCalendar',
    },
    {
        url: 'https://litcal.johnromanodorazio.com/api/dev',
        controls: '#prodControls',
        calendar: '#prodCalendar',
    },
];

/**
 * Builds one independent pane: its own client, its own controls, its own table.
 *
 * Nothing is shared between panes but the DOM they are appended to, so a base that
 * is down fails inside its own pane only.
 *
 * @param {{url: string, controls: string, calendar: string}} pane - The pane's base URL and target selectors.
 * @returns {Promise<void>}
 */
const buildPane = async (pane) => {
    try {
        const apiClient = await ApiClient.init(pane.url);

        const calendarSelect = new CalendarSelect({ locale: 'en', apiClient })
            .class('form-select')
            .label({ text: 'Calendar', class: 'form-label' })
            .wrapper({ as: 'div', class: 'col-md-6' })
            .allowNull(true);
        calendarSelect.appendTo(pane.controls);

        const apiOptions = new ApiOptions({ locale: 'en', apiClient })
            .filter(ApiOptionsFilter.LOCALE_ONLY)
            .linkToCalendarSelect(calendarSelect);
        apiOptions.appendTo(pane.controls);

        const webCalendar = new WebCalendar()
            .class('table table-sm table-striped')
            .firstColumnGrouping(Grouping.BY_MONTH)
            .seasonColor(ColorAs.CSS_CLASS)
            .listenTo(apiClient);
        webCalendar.appendTo(pane.calendar);

        apiClient.on('calendarFetchFailed', (error) => {
            document.querySelector(pane.calendar).textContent =
                `Request failed: ${error.message}`;
        });

        apiClient.listenTo(calendarSelect).listenTo(apiOptions);

        // The promise of a fetch called from here belongs to this page, not to the
        // library, so it is handled rather than discarded. The rendering is left to
        // the `calendarFetchFailed` subscriber above, which also covers the requests
        // the client issues on its own when the controls change. Swallowing it here
        // also keeps it out of the `catch` below, which reports only a base that
        // could not be initialized at all.
        apiClient.fetchCalendar('en').catch(() => {});
    } catch (error) {
        // `textContent` for the message, since an API failure can carry a response
        // body into `error.message` and this is a page, not a console.
        const warning = document.createElement('div');
        warning.className = 'alert alert-warning mb-0';
        warning.textContent = `Could not reach ${pane.url}: ${error.message}`;
        document.querySelector(pane.calendar).replaceChildren(warning);
    }
};

BASES.forEach(buildPane);
