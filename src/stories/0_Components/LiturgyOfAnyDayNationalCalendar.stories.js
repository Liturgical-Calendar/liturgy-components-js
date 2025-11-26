import { LiturgyOfAnyDay, ApiClient } from '@liturgical-calendar/components-js';
import '../liturgyofanyday.css';

/**
 * LiturgyOfAnyDay component
 *
 * This is an example of using the `LiturgyOfAnyDay` component set to listen to the ApiClient instance,
 * and requesting the National Calendar indicated in the `calendar_id` parameter from the ApiClient instance.
 * The `calendar_id` and `locale` parameters are passed to the `ApiClient` instance's `fetchNationalCalendar()` method.
 * All other parameters are passed to the `LiturgyOfAnyDay` constructor or configuration methods.
 *
 * Unlike `LiturgyOfTheDay`, this component allows the user to select any date via day, month, and year input controls.
 * The component automatically handles the December 31st edge case by switching to `year_type=LITURGICAL` with `year+1`
 * to include the Vigil Mass for Mary Mother of God (and other vigil masses at the end of the liturgical year).
 */
const meta = {
  title: 'Components/LiturgyOfAnyDay/National Calendar',
  tags: ['autodocs'],
  argTypes: {
    locale: {
      control: 'text',
      description: 'Locale code for UI elements and also the locale used to fetch the National Calendar when the calendar supports more than one locale',
    },
    id: {
      control: 'text',
      description: 'ID for the widget\'s underlying HTML element'
    },
    class: {
      control: 'text',
      description: 'CSS class(es) for the widget\'s underlying HTML element'
    },
    titleClass: {
      control: 'text',
      description: 'CSS class(es) for the widget\'s Title HTML element'
    },
    dateClass: {
      control: 'text',
      description: 'CSS class(es) for the widget\'s Date display HTML element'
    },
    dateControlsClass: {
      control: 'text',
      description: 'CSS class(es) for the widget\'s Date controls wrapper HTML element'
    },
    eventsWrapperClass: {
      control: 'text',
      description: 'CSS class(es) for the widget\'s Events wrapper HTML element'
    },
    eventClass: {
      control: 'text',
      description: 'CSS class(es) for the widget\'s Events HTML element(s)'
    },
    eventGradeClass: {
      control: 'text',
      description: 'CSS class(es) for the widget\'s Events Grade HTML element(s)'
    },
    eventCommonClass: {
      control: 'text',
      description: 'CSS class(es) for the widget\'s Events Common HTML element(s)'
    },
    eventYearCycleClass: {
      control: 'text',
      description: 'CSS class(es) for the widget\'s Events Year Cycle HTML element(s)'
    },
    readingsWrapperClass: {
      control: 'text',
      description: 'CSS class(es) for the widget\'s Readings wrapper HTML element'
    },
    readingsLabelClass: {
      control: 'text',
      description: 'CSS class(es) for the widget\'s Readings label HTML element(s)'
    },
    readingClass: {
      control: 'text',
      description: 'CSS class(es) for individual reading HTML element(s)'
    },
    showReadings: {
      control: 'boolean',
      description: 'Whether to display lectionary readings'
    },
    onChange: {
      action: 'onChange'
    }
  },
  render: (args, { loaded: { apiClient } }) => {
    const container = document.createElement('div');

    // Initialize API client
    if (false === apiClient || false === apiClient instanceof ApiClient) {
        container.textContent = 'Error initializing the Liturgical Calendar API Client';
    } else {
        const liturgyOfAnyDay = new LiturgyOfAnyDay(args);

        // Configure date input styling
        if (args.dayInputClass) {
            liturgyOfAnyDay.dayInputConfig({ class: args.dayInputClass });
        }
        if (args.monthInputClass) {
            liturgyOfAnyDay.monthInputConfig({ class: args.monthInputClass });
        }
        if (args.yearInputClass) {
            liturgyOfAnyDay.yearInputConfig({ class: args.yearInputClass });
        }

        // Build date controls before appending to DOM
        liturgyOfAnyDay.buildDateControls();

        // Listen to the ApiClient for calendar data
        liturgyOfAnyDay.listenTo(apiClient);

        // Fetch the national calendar with the specified locale
        const nationalCalendarMetadata = apiClient._metadata.national_calendars.find(calendar => calendar.calendar_id === args.calendar_id);
        const locale = args.locale && args.locale !== '' && nationalCalendarMetadata.locales.includes(args.locale) ? args.locale : nationalCalendarMetadata.locales[0];
        apiClient.fetchNationalCalendar(args.calendar_id, locale);

        liturgyOfAnyDay.appendTo(container);
    }
    return container;
  },
  args: {
    class: "liturgy-of-any-day",
    titleClass: "liturgy-of-any-day-title",
    dateClass: "liturgy-of-any-day-date",
    dateControlsClass: "liturgy-of-any-day-date-controls",
    eventsWrapperClass: "liturgy-of-any-day-events-wrapper",
    eventClass: "liturgy-of-any-day-event",
    eventGradeClass: "liturgy-of-any-day-event-grade",
    eventCommonClass: "liturgy-of-any-day-event-common",
    eventYearCycleClass: "liturgy-of-any-day-year-cycle",
    readingsWrapperClass: "liturgy-of-any-day-readings-wrapper",
    readingsLabelClass: "liturgy-of-any-day-readings-label",
    readingClass: "liturgy-of-any-day-reading",
    showReadings: true
  }
}

export default meta;

export const Italy = {
  args: {
    locale: 'it-IT',
    calendar_id: 'IT'
  }
}

export const USA = {
  args: {
    locale: 'en-US',
    calendar_id: 'US'
  }
}

export const Netherlands = {
  args: {
    locale: 'nl-NL',
    calendar_id: 'NL'
  }
}

export const Canada_English = {
  args: {
    locale: 'en-CA',
    calendar_id: 'CA'
  }
}

export const Canada_French = {
  args: {
    locale: 'fr-CA',
    calendar_id: 'CA'
  }
}
