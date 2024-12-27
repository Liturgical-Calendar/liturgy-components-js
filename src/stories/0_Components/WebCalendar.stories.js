import { WebCalendar, ApiClient, Column, Grouping, DateFormat, ColumnOrder, GradeDisplay, ColorAs } from "liturgy-components-js";
import { fn } from '@storybook/test';
import { withActions } from '@storybook/addon-actions/decorator';
import '../webcalendar.css';

/**
 * WebCalendar component
 *
 * Instances of the `WebCalendar` component can be tailored with different layout options.
 * The examples provided are a progressive transformation from the default layout to a slightly more refined layout.
 *
 * The styling of the `WebCalendar` component can be handled with CSS styling rules (see the `webcalendar.css` file).
 *
 * The `WebCalendar` component will only produce an actual calendar by "listening" to an instance of the `ApiClient` class,
 * and will update the calendar when the `calendarFetched` event is triggered.
 *
 * The `calendarFetched` event can be emitted by an instance of the `ApiClient` class
 * in response to interactions with instances of the `CalendarSelect` and `ApiOptions` classes,
 * but a request can also be triggered via the `fetchCalendar` (or `fetchNationalCalendar`, `fetchDiocesanCalendar`) method(s) of the `ApiClient` instance.
 *
 * In this simple example without instances of the `CalendarSelect` and `ApiOptions` classes,
 * we are using the `fetchCalendar` method of the `ApiClient` instance to fetch the calendar data.
 */
const meta = {
    title: 'Components/WebCalendar',
    tags: [ 'autodocs' ],
    argTypes: {
        id: {
            control: 'text',
            description: 'Id for the WebCalendar instance',
            defaultValue: 'litcalWebcalendar'
        },
        class: {
            control: 'text',
            description: 'Class for the WebCalendar instance',
            defaultValue: ''
        },
        firtColumnGrouping: {
            control: { type: 'select' },
            options: [ Grouping.BY_MONTH, Grouping.BY_LITURGICAL_SEASON ],
            labels: {
                [ Grouping.BY_MONTH ]: 'By month',
                [ Grouping.BY_LITURGICAL_SEASON ]: 'By liturgical season'
            },
            description: 'First column grouping',
            defaultValue: Grouping.BY_MONTH
        },
        removeHeaderRow: {
            control: 'boolean',
            description: 'Remove the header row from the WebCalendar instance',
            defaultValue: false
        },
        removeCaption: {
            control: 'boolean',
            description: 'Remove the caption from the WebCalendar instance',
            defaultValue: false
        },
        psalterWeekColumn: {
            control: 'boolean',
            description: 'Add a column for psalter weeks',
            defaultValue: true
        },
        eventColor: {
            control: { type: 'select' },
            options: [ ColorAs.CSS_CLASS, ColorAs.INDICATOR, ColorAs.BACKGROUND ],
            labels: {
                [ ColorAs.CSS_CLASS ]: 'ColorAs.CSS_CLASS',
                [ ColorAs.INDICATOR ]: 'ColorAs.INDICATOR',
                [ ColorAs.BACKGROUND ]: 'ColorAs.BACKGROUND'
            },
            description: 'Color to apply to events',
            defaultValue: ColorAs.CSS_CLASS
        },
        eventColorColumns: {
            control: { type: 'check' },
            options: [ Column.LITURGICAL_SEASON, Column.MONTH, Column.DATE, Column.EVENT_DETAILS, Column.GRADE, Column.PSALTER_WEEK ],
            labels: {
                [ Column.LITURGICAL_SEASON ]: 'Column.LITURGICAL_SEASON',
                [ Column.MONTH ]: 'Column.MONTH',
                [ Column.DATE ]: 'Column.DATE',
                [ Column.EVENT_DETAILS ]: 'Column.EVENT_DETAILS',
                [ Column.GRADE ]: 'Column.GRADE',
                [ Column.PSALTER_WEEK ]: 'Column.PSALTER_WEEK'
            },
            description: 'Columns to which the Liturgical event color(s) should be applied',
        },
        seasonColor: {
            control: { type: 'select' },
            options: [ ColorAs.CSS_CLASS, ColorAs.INDICATOR, ColorAs.BACKGROUND ],
            labels: {
                [ ColorAs.CSS_CLASS ]: 'ColorAs.CSS_CLASS',
                [ ColorAs.INDICATOR ]: 'ColorAs.INDICATOR',
                [ ColorAs.BACKGROUND ]: 'ColorAs.BACKGROUND'
            },
            description: 'Color to apply to seasons',
            defaultValue: ColorAs.INDICATOR
        },
        seasonColorColumns: {
            control: { type: 'check' },
            options: [ Column.LITURGICAL_SEASON, Column.MONTH, Column.DATE, Column.EVENT_DETAILS, Column.GRADE, Column.PSALTER_WEEK ],
            labels: {
                [ Column.LITURGICAL_SEASON ]: 'Column.LITURGICAL_SEASON',
                [ Column.MONTH ]: 'Column.MONTH',
                [ Column.DATE ]: 'Column.DATE',
                [ Column.EVENT_DETAILS ]: 'Column.EVENT_DETAILS',
                [ Column.GRADE ]: 'Column.GRADE',
                [ Column.PSALTER_WEEK ]: 'Column.PSALTER_WEEK'
            },
            description: 'Columns to which the Season color should be applied',
        },
        monthHeader: {
            control: 'boolean',
            description: 'Add a month header row at the start of each month',
            defaultValue: true
        },
        dateFormat: {
            control: { type: 'select' },
            options: [ DateFormat.FULL, DateFormat.LONG, DateFormat.MEDIUM, DateFormat.SHORT, DateFormat.DAY_ONLY ],
            labels: {
                [ DateFormat.FULL ]: 'DateFormat.FULL',
                [ DateFormat.LONG ]: 'DateFormat.LONG',
                [ DateFormat.MEDIUM ]: 'DateFormat.MEDIUM',
                [ DateFormat.SHORT ]: 'DateFormat.SHORT',
                [ DateFormat.DAY_ONLY ]: 'DateFormat.DAY_ONLY'
            },
            description: 'Date format for the WebCalendar instance',
            defaultValue: DateFormat.FULL
        },
        columnOrder: {
            control: { type: 'select' },
            options: [ ColumnOrder.GRADE_FIRST, ColumnOrder.EVENT_DETAILS_FIRST ],
            labels: {
                [ ColumnOrder.GRADE_FIRST ]: 'Grade first',
                [ ColumnOrder.EVENT_DETAILS_FIRST ]: 'Event details first'
            },
            description: 'Column order for the WebCalendar instance',
            defaultValue: ColumnOrder.EVENT_DETAILS_FIRST
        },
        gradeDisplay: {
            control: { type: 'select' },
            options: [ GradeDisplay.FULL, GradeDisplay.ABBREVIATED ],
            labels: {
                [ GradeDisplay.FULL ]: 'GradeDisplay.FULL',
                [ GradeDisplay.ABBREVIATED ]: 'GradeDisplay.ABBREVIATED'
            },
            description: 'Grade display for the WebCalendar instance',
            defaultValue: GradeDisplay.FULL
        },
        locale: {
            control: 'text',
            description: 'Locale code for UI elements',
            defaultValue: 'en-US'
        },
        onChange: {
            action: 'onChange'
        }
    },
    decorators: [withActions],
    parameters: {
        actions: {
            handles: [ 'change', 'change #webCalendarContainer select' ],
        },
    },
    render: (args, { loaded: { apiClient } }) => {
        const container = document.createElement('div');
        container.id = 'webCalendarContainer';
        if (false === apiClient || false === apiClient instanceof ApiClient) {
            container.textContent = 'Error initializing the Liturgical Calendar API Client, check that the API is running at ' + ApiClient._apiUrl;
        } else {
            const { onChange, locale, ...rest } = args;
            const webCalendar = new WebCalendar(rest);
            if (locale) {
                webCalendar.locale(locale);
            }
            webCalendar.listenTo(apiClient).attachTo(container);
            apiClient.fetchCalendar(locale);
        }
        return container;
    },
    args: {
        locale: 'en-US',
        id: 'LitCalTable',
        eventColor: ColorAs.BACKGROUND,
        onChange: fn()
    }
};

// Story configuration
export default meta;

export const Default = {
    args: {}
}

export const NoCaption = {
    args: {
        removeCaption: true
    }
}

export const NoHeaderRow = {
    args: {
        removeHeaderRow: true
    }
}

export const GroupByLiturgicalSeason = {
    args: {
        removeHeaderRow: true,
        firstColumnGrouping: Grouping.BY_LITURGICAL_SEASON
    }
}

export const PsalterWeekColumn = {
    args: {
        removeHeaderRow: true,
        firstColumnGrouping: Grouping.BY_LITURGICAL_SEASON,
        psalterWeekColumn: true
    }
}

export const SeasonColorAsCssClass = {
    args: {
        removeHeaderRow: true,
        firstColumnGrouping: Grouping.BY_LITURGICAL_SEASON,
        psalterWeekColumn: true,
        seasonColor: ColorAs.CSS_CLASS,
        seasonColorColumn: Column.LITURGICAL_SEASON
    }
}

export const EventColorAsIndicator = {
    args: {
        removeHeaderRow: true,
        firstColumnGrouping: Grouping.BY_LITURGICAL_SEASON,
        psalterWeekColumn: true,
        seasonColor: ColorAs.CSS_CLASS,
        seasonColorColumn: Column.LITURGICAL_SEASON,
        eventColor: ColorAs.INDICATOR,
        eventColorColumns: Column.EVENT_DETAILS
    }
}

export const MonthHeader = {
    args: {
        removeHeaderRow: true,
        firstColumnGrouping: Grouping.BY_LITURGICAL_SEASON,
        psalterWeekColumn: true,
        seasonColor: ColorAs.CSS_CLASS,
        seasonColorColumn: Column.LITURGICAL_SEASON,
        eventColor: ColorAs.INDICATOR,
        eventColorColumns: Column.EVENT_DETAILS,
        monthHeader: true
    }
}

export const DateFormatLong = {
    args: {
        removeHeaderRow: true,
        firstColumnGrouping: Grouping.BY_LITURGICAL_SEASON,
        psalterWeekColumn: true,
        seasonColor: ColorAs.CSS_CLASS,
        seasonColorColumn: Column.LITURGICAL_SEASON,
        eventColor: ColorAs.INDICATOR,
        eventColorColumns: Column.EVENT_DETAILS,
        monthHeader: true,
        dateFormat: DateFormat.LONG
    }
}

export const DateFormatMedium = {
    args: {
        removeHeaderRow: true,
        firstColumnGrouping: Grouping.BY_LITURGICAL_SEASON,
        psalterWeekColumn: true,
        seasonColor: ColorAs.CSS_CLASS,
        seasonColorColumn: Column.LITURGICAL_SEASON,
        eventColor: ColorAs.INDICATOR,
        eventColorColumns: Column.EVENT_DETAILS,
        monthHeader: true,
        dateFormat: DateFormat.MEDIUM
    }
}

export const DateFormatShort = {
    args: {
        removeHeaderRow: true,
        firstColumnGrouping: Grouping.BY_LITURGICAL_SEASON,
        psalterWeekColumn: true,
        seasonColor: ColorAs.CSS_CLASS,
        seasonColorColumn: Column.LITURGICAL_SEASON,
        eventColor: ColorAs.INDICATOR,
        eventColorColumns: Column.EVENT_DETAILS,
        monthHeader: true,
        dateFormat: DateFormat.SHORT
    }
}

export const DateformatDayOnly = {
    args: {
        removeHeaderRow: true,
        firstColumnGrouping: Grouping.BY_LITURGICAL_SEASON,
        psalterWeekColumn: true,
        seasonColor: ColorAs.CSS_CLASS,
        seasonColorColumn: Column.LITURGICAL_SEASON,
        eventColor: ColorAs.INDICATOR,
        eventColorColumns: Column.EVENT_DETAILS,
        monthHeader: true,
        dateFormat: DateFormat.DAY_ONLY
    }
}

export const GradeColumnBeforeEventDetails = {
    args: {
        removeHeaderRow: true,
        firstColumnGrouping: Grouping.BY_LITURGICAL_SEASON,
        psalterWeekColumn: true,
        seasonColor: ColorAs.CSS_CLASS,
        seasonColorColumn: Column.LITURGICAL_SEASON,
        eventColor: ColorAs.INDICATOR,
        eventColorColumns: Column.EVENT_DETAILS,
        monthHeader: true,
        dateFormat: DateFormat.DAY_ONLY,
        columnOrder: ColumnOrder.GRADE_FIRST
    }
}

export const GradeDisplayAbbreviated = {
    args: {
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
    }
}
