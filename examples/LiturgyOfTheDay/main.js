import { ApiClient, LiturgyOfTheDay, YearType} from 'https://cdn.jsdelivr.net/npm/@liturgical-calendar/components-js@latest/+esm';

const now = new Date();
const dateToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
const dec31st = new Date(now.getFullYear(), 11, 31, 0, 0, 0, 0);
let refetched = false;

ApiClient.init('http://localhost:8000').then(apiClient => {
    if (false === apiClient || false === apiClient instanceof ApiClient) {
        alert('Error initializing the Liturgical Calendar API Client');
    } else {
        const liturgyOfTheDay = new LiturgyOfTheDay('it-IT');
        liturgyOfTheDay.id('LiturgyOfTheDay')
            .class('liturgy-of-the-day')
            .titleClass('liturgy-of-the-day-title')
            .dateClass('liturgy-of-the-day-date')
            .eventsWrapperClass('liturgy-of-the-day-events-wrapper')
            .eventClass('liturgy-of-the-day-event p-4 mt-4 border rounded')
            .eventGradeClass('liturgy-of-the-day-event-grade')
            .eventCommonClass('liturgy-of-the-day-event-common')
            .eventYearCycleClass('liturgy-of-the-day-event-year-cycle')
            .listenTo(apiClient);

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
                    const ChristKing = data.litcal.find(event => {
                        return event.event_key === 'ChristKing';
                    });
                    const ChristKingDate = new Date(ChristKing.date * 1000);
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
            apiClient.fetchDiocesanCalendar('romamo_it');
        }
        liturgyOfTheDay.replace('#liturgyOfTheDay');
    }
});
