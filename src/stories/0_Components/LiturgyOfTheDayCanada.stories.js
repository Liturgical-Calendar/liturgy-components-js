import { LiturgyOfTheDay, ApiClient, YearType } from 'liturgy-components-js';
import '../liturgyoftheday.css';

/**
 * LiturgyOfTheDay component
 *
 * This is an example of using the `LiturgyOfTheDay` component set to listen to the ApiClient instance,
 * and requesting the National Calendar for Canada from the ApiClient instance.
 */
const meta = {
  title: 'Components/LiturgyOfTheDay/National Calendar/Canada',
  tags: ['autodocs'],
  argTypes: {
    locale: {
      control: 'text',
      description: 'Locale code for UI elements',
      defaultValue: 'en-US'
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
    onChange: {
      action: 'onChange'
    }
  },
  render: (args, { loaded: { apiClient } }) => {
    const container = document.createElement('div');
    const liturgyOfTheDay = new LiturgyOfTheDay(args);
    const now = new Date();
    const dateToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const dec31st = new Date(now.getFullYear(), 11, 31, 0, 0, 0, 0);
    let refetched = false;

    // Initialize API client
    if (false === apiClient || false === apiClient instanceof ApiClient) {
        container.textContent = 'Error initializing the Liturgical Calendar API Client';
    } else {
        liturgyOfTheDay.listenTo(apiClient);

        // By default, the apiClient will fetch year_type = 'liturgical'
        // In order to see the full liturgical events between the end of the liturgical year and the next liturgical year,
        //  we need to check if today's date is greater than or equal to Saturday of the 34th week of Ordinary Time,
        //  and less than Monday of the First week of Advent,
        //  and if so we will refetch the calendar with year_type = 'civil'
        //  (this way we will get the Vigil Mass for the First Sunday of Advent on Saturday of the 34th week of Ordinary Time)
        // If instead today's date is greater than or equal to Monday of the First Week of Advent,
        //  and less than or equal to Dec 31st,
        //  we will refetch the calendar with year_type = 'liturgical' but adding a year
        if (false === refetched) {
            apiClient._eventBus.on('calendarFetched', (data) => {
                if (typeof data === 'object' && data.hasOwnProperty('litcal') && Array.isArray(data.litcal) && data.litcal.length > 0) {
                    const ChristKing = data.litcal.filter(event => {
                        return event.event_key === 'ChristKing';
                    });
                    const ChristKingDate = new Date(ChristKing[0].date * 1000);
                    const Saturday34OrdinaryTimeDate = new Date(ChristKingDate.getTime());
                    Saturday34OrdinaryTimeDate.setDate(ChristKingDate.getDate() + 6);
                    const MondayFirstWeekAdventDate = new Date(ChristKingDate.getTime());
                    MondayFirstWeekAdventDate.setDate(ChristKingDate.getDate() + 8);
                    if (dateToday >= Saturday34OrdinaryTimeDate && dateToday < MondayFirstWeekAdventDate) {
                        refetched = true;
                        apiClient.setYearType(YearType.CIVIL).refetchCalendarData();
                    }
                    else if (dateToday >= MondayFirstWeekAdventDate && dateToday <= dec31st) {
                        refetched = true;
                        apiClient.setYearType(YearType.LITURGICAL).setYear(now.getFullYear() + 1).refetchCalendarData();
                    }
                }
            });
            apiClient.fetchNationalCalendar('CA');
        }
        liturgyOfTheDay.appendTo(container);
    }
    return container;
  },
  args: {
    class: 'liturgy-of-the-day',
    titleClass: "liturgy-of-the-day-title",
    dateClass: "liturgy-of-the-day-date",
    eventsWrapperClass: "liturgy-of-the-day-events-wrapper",
    eventClass: "liturgy-of-the-day-event",
    eventGradeClass: "liturgy-of-the-day-event-grade",
    eventCommonClass: "liturgy-of-the-day-event-common",
    eventYearCycleClass: "liturgy-of-the-day-year-cycle"
  }
}

export default meta;

// Story definition using CSF3 format
export const English = {
  args: {
    locale: 'en-US'
  }
};

export const French = {
  args: {
    locale: 'fr-FR'
  }
}
