import { LiturgyOfTheDay, ApiClient } from '@liturgical-calendar/components-js';
import '../liturgyoftheday.css';

/**
 * LiturgyOfTheDay component
 *
 * This is an example of using the `LiturgyOfTheDay` component set to listen to the ApiClient instance,
 * and requesting the Diocesan Calendar indicated in the `calendar_id` parameter from the ApiClient instance.
 * The `calendar_id` and `locale` parameters are passed to the `ApiClient` instance's `fetchDiocesanCalendar()` method.
 * All other parameters are passed to the `LiturgyOfTheDay` constructor.
 *
 * The component handles the December 31st edge case by switching to `year_type=LITURGICAL` with `year+1`
 * to include the Vigil Mass for Mary Mother of God (and other vigil masses at the end of the liturgical year).
 */
const meta = {
  title: 'Components/LiturgyOfTheDay/Diocesan Calendar',
  tags: ['autodocs'],
  argTypes: {
    locale: {
      control: 'text',
      description: 'Locale code for UI elements, and also the locale used to fetch the Diocesan Calendar when the calendar supports more than one locale'
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
      description: 'CSS class(es) for the widget\'s Date HTML element'
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
    if (!apiClient || !(apiClient instanceof ApiClient)) {
        container.textContent = 'Error initializing the Liturgical Calendar API Client';
    } else {
        const liturgyOfTheDay = new LiturgyOfTheDay(args);
        // listenTo() automatically handles December 31st by configuring year_type=LITURGICAL with year+1
        liturgyOfTheDay.listenTo(apiClient);

        // Fetch the diocesan calendar with the specified locale
        const diocesanCalendarMetadata = apiClient._metadata.diocesan_calendars.find(calendar => calendar.calendar_id === args.calendar_id);
        if (!diocesanCalendarMetadata) {
            container.textContent = `Diocesan calendar '${args.calendar_id}' not found in API metadata`;
        } else {
            const locale = args.locale && args.locale !== '' && diocesanCalendarMetadata.locales.includes(args.locale) ? args.locale : diocesanCalendarMetadata.locales[0];
            apiClient.fetchDiocesanCalendar(args.calendar_id, locale);
            liturgyOfTheDay.appendTo(container);
        }
    }
    return container;
  },
  args: {
    class: "liturgy-of-the-day",
    titleClass: "liturgy-of-the-day-title",
    dateClass: "liturgy-of-the-day-date",
    eventsWrapperClass: "liturgy-of-the-day-events-wrapper",
    eventClass: "liturgy-of-the-day-event",
    eventGradeClass: "liturgy-of-the-day-event-grade",
    eventCommonClass: "liturgy-of-the-day-event-common",
    eventYearCycleClass: "liturgy-of-the-day-year-cycle",
    readingsWrapperClass: "liturgy-of-the-day-readings-wrapper",
    readingsLabelClass: "liturgy-of-the-day-readings-label",
    readingClass: "liturgy-of-the-day-reading",
    showReadings: true
  }
}

export default meta;

// Story definition using CSF3 format
export const Diocese_of_Rome_Italy = {
  args: {
    locale: 'it-IT',
    calendar_id: 'romamo_it'
  }
};

export const Archdiocese_of_Boston_MA_USA = {
  args: {
    locale: 'en-US',
    calendar_id: 'boston_us'
  }
}

export const Diocese_of_Haarlem_Amsterdam_Netherlands = {
  args: {
    locale: 'nl-NL',
    calendar_id: 'haaams_nl'
  }
}
