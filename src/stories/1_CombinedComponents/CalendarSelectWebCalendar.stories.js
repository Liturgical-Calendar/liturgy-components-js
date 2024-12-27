import { CalendarSelect, WebCalendar, Grouping, Column, ColumnOrder, ColorAs, DateFormat, GradeDisplay, ApiClient } from 'liturgy-components-js';
import { fn } from '@storybook/test';
import { withActions } from '@storybook/addon-actions/decorator';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../webcalendar.css';

// Meta configuration
const meta = {
  title: 'Combined Components/CalendarSelect - WebCalendar',
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
        const calendarSelect = new CalendarSelect('en-US');
        calendarSelect.class('form-select').label({
            text: 'Select a calendar',
            class: 'form-label'
        }).wrapper({
            class: 'form-group col col-md-4'
        }).after('<small class="text-muted"><i>The WebCalendar will update based on the selected calendar</i></small>')
        .appendTo(container);

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
        apiClient.listenTo(calendarSelect);
        webCalendar.listenTo(apiClient).attachTo(webCalendarContainer);
    }
    return container;
  },
  parameters: {
    actions: {
      handles: ['change', 'change #calendarSelectContainer select'],
    },
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
