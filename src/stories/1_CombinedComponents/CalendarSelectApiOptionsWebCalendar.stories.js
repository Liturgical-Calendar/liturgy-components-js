import { CalendarSelect, WebCalendar, Grouping, Column, ColumnOrder, ColorAs, DateFormat, GradeDisplay, ApiClient, ApiOptions, ApiOptionsFilter, Input } from 'liturgy-components-js';
import { fn } from '@storybook/test';
import { withActions } from '@storybook/addon-actions/decorator';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../webcalendar.css';

// Meta configuration
const meta = {
  title: 'Combined Components/CalendarSelect - ApiOptions - WebCalendar',
  tags: ['autodocs'],
  argTypes: {
    onChange: {
      action: 'onChange'
    }
  },
  render: (args, { loaded: { apiClient } }) => {
    const container = document.createElement('div');
    container.id = 'calendarSelectContainer';

    if (false === apiClient || false === apiClient instanceof ApiClient) {
        container.textContent = 'Error initializing the Liturgical Calendar API Client';
    } else {
        container.classList.add('row');
        Input.setGlobalInputClass('form-select');
        Input.setGlobalLabelClass('form-label d-block mb-1');
        Input.setGlobalWrapper('div');
        Input.setGlobalWrapperClass('form-group col col-md-3');

        const calendarSelect = new CalendarSelect('en-US');
        calendarSelect.class('form-select').label({
            text: 'Select a calendar',
            class: 'form-label'
        }).wrapper({
            class: 'form-group col col-md-3'
        }).after('<small class="text-muted"><i>The WebCalendar will update based on the selected calendar</i></small>')
        .appendTo(container);

        const apiOptions = new ApiOptions('en-US');
        apiOptions._yearInput.class('form-control'); // override the global input class
        apiOptions._acceptHeaderInput.hide(); // prevent the Accept header form control from being appended to the form
        apiOptions.filter(ApiOptionsFilter.ALL_CALENDARS).linkToCalendarSelect(calendarSelect).appendTo(container);

        const webCalendarContainer = document.createElement('div');
        container.append(webCalendarContainer);

        const webCalendar = new WebCalendar({
            id: 'LitCalTable',
            removeHeaderRow: true,
            firstColumnGrouping: Grouping.BY_LITURGICAL_SEASON,
            psalterWeekColumn: true,
            seasonColor: ColorAs.CSS_CLASS,
            seasonColorColumn: Column.LITURGICAL_SEASON,
            eventColor: ColorAs.INDICATOR,
            eventColorColumns: Column.EVENT_DETAILS,
            monthHeader: true,
            dateFormat: DateFormat.DAY_ONLY,
            columnOrder: ColumnOrder.GRADE_FIRST,
            gradeDisplay: GradeDisplay.ABBREVIATED
        });
        apiClient.listenTo(calendarSelect).listenTo(apiOptions);
        webCalendar.listenTo(apiClient).attachTo(webCalendarContainer);
    }
    return container;
  },
  parameters: {
    actions: {
      handles: ['change', 'change #calendarSelectContainer select'],
    },
    //layout: 'fullscreen'
  },
  decorators: [withActions],
  args: {
    onChange: fn()
  }
}

export default meta;

export const Default = {
  args: {}
}
