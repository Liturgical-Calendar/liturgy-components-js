import {
    ApiClient,
    CalendarSelect,
    RiteSelect,
    ApiOptions,
    Input,
    WebCalendar,
    Grouping,
    ColorAs,
    Column,
    ColumnOrder,
    DateFormat,
    GradeDisplay,
} from 'liturgy-components-js';

Input.setGlobalInputClass('form-select');
Input.setGlobalLabelClass('form-label d-block mb-1');
Input.setGlobalWrapper('div');
Input.setGlobalWrapperClass('form-group col col-md-3');

ApiClient.init('http://localhost:8000')
    .then((apiClient) => {
        const riteSelect = new RiteSelect('en-US')
            .class('form-select')
            .id('riteSelect')
            .label({ text: 'Select a rite', class: 'form-label d-block mb-1' });
        riteSelect.appendTo('#riteSelectWrapper');

        const calendarSelect = new CalendarSelect('en-US').allowNull();
        calendarSelect
            .label({
                class: 'form-label d-block mb-1',
                text: 'Select a calendar',
            })
            .wrapper({
                class: 'form-group col col-md-3',
            })
            .id('calendarSelect')
            .class('form-select')
            .appendTo('#calendarOptions');

        const apiOptions = new ApiOptions('en-US');
        apiOptions._yearInput.class('form-control');
        apiOptions._acceptHeaderInput.hide();
        apiOptions._holydaysOfObligationInput.class('d-none');
        apiOptions
            .linkToCalendarSelect(calendarSelect)
            .linkToRiteSelect(riteSelect);
        apiOptions.appendTo('#calendarOptions');

        const webCalendar = new WebCalendar();
        webCalendar
            .id('LitCalTable')
            .firstColumnGrouping(Grouping.BY_LITURGICAL_SEASON)
            .psalterWeekColumn()
            .removeHeaderRow()
            .seasonColor(ColorAs.CSS_CLASS)
            .seasonColorColumns(Column.LITURGICAL_SEASON)
            .eventColor(ColorAs.INDICATOR)
            .eventColorColumns(Column.EVENT_DETAILS)
            .monthHeader()
            .dateFormat(DateFormat.DAY_ONLY)
            .columnOrder(ColumnOrder.GRADE_FIRST)
            .gradeDisplay(GradeDisplay.ABBREVIATED)
            .listenTo(apiClient);
        webCalendar.appendTo('#litcalWebcalendar');

        // The rite select is wired to the client directly, alongside the calendar
        // select and the options, so that changing the rite refetches. Note that
        // this produces two requests per rite change: ApiOptions resets the calendar
        // selection and dispatches `change` on it before ApiClient's own rite
        // listener runs. See ApiClient#listenToRiteSelect for why that is tolerated.
        apiClient
            .listenTo(calendarSelect)
            .listenTo(apiOptions)
            .listenTo(riteSelect);

        // The promise returned by a fetch method belongs to the caller: the library only
        // suppresses the rejections of the fire-and-forget requests it issues itself
        // (those driven by the selects above), so this one has to be handled here.
        apiClient.fetchCalendar().catch((error) => {
            document.querySelector('#litcalWebcalendar').textContent =
                `Could not load the calendar from ${error.url ?? 'the configured base'}: ${error.message}`;
        });
    })
    .catch((error) => {
        document.querySelector('#litcalWebcalendar').textContent =
            `Could not reach the Liturgical Calendar API at ${error.url ?? 'the configured base'}: ${error.message}`;
    });
