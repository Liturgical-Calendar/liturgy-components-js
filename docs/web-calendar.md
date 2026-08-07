# WebCalendar

The `WebCalendar` component generates a Liturgical Calendar as an HTML table element.

![WebCalendar Screenshot](images/webcalendar.png)

## Basic Usage

```javascript
import { ApiClient, WebCalendar } from '@liturgical-calendar/components-js';

ApiClient.init('http://localhost:8000').then((apiClient) => {
    const webCalendar = new WebCalendar();
    webCalendar.listenTo(apiClient).appendTo('#litcalWebcalendar');
    apiClient.fetchCalendar('en');
});
```

## Configuration Methods

All methods are chainable:

```javascript
import {
    WebCalendar,
    Grouping,
    ColorAs,
    Column,
    ColumnOrder,
    DateFormat,
    GradeDisplay,
    LatinInterface
} from '@liturgical-calendar/components-js';

const webCalendar = new WebCalendar()
    .id('liturgical-calendar')
    .class('table table-striped')
    .firstColumnGrouping(Grouping.BY_MONTH)
    .psalterWeekColumn(true)
    .removeHeaderRow(false)
    .removeCaption(false)
    .monthHeader(true)
    .seasonColor(ColorAs.CSS_CLASS)
    .seasonColorColumns(Column.LITURGICAL_SEASON)
    .eventColor(ColorAs.INDICATOR)
    .eventColorColumns(Column.EVENT_DETAILS)
    .dateFormat(DateFormat.DAY_ONLY)
    .columnOrder(ColumnOrder.GRADE_FIRST)
    .gradeDisplay(GradeDisplay.ABBREVIATED)
    .latinInterface(LatinInterface.ECCLESIASTICAL)
    .listenTo(apiClient);

webCalendar.appendTo('#calendar-container');
```

## Configuration Reference

### Basic Settings

| Method                       | Description               |
| ---------------------------- | ------------------------- |
| `id(id)`                     | Set table ID              |
| `class(className)`           | Set table CSS class(es)   |
| `removeHeaderRow(bool=true)` | Hide the table header row |
| `removeCaption(bool=true)`   | Hide the table caption    |

### Grouping and Layout

| Method                          | Values                                           | Description                      |
| ------------------------------- | ------------------------------------------------ | -------------------------------- |
| `firstColumnGrouping(grouping)` | `Grouping.BY_MONTH`, `BY_LITURGICAL_SEASON`      | Group events in first column     |
| `psalterWeekColumn(bool=true)`  | boolean                                          | Show psalter week rightmost col  |
| `monthHeader(bool=true)`        | boolean                                          | Show month header at month start |
| `columnOrder(order)`            | `ColumnOrder.GRADE_FIRST`, `EVENT_DETAILS_FIRST` | Order of details and grade cols  |

### Color Settings

| Method                        | Values                                         | Description               |
| ----------------------------- | ---------------------------------------------- | ------------------------- |
| `seasonColor(colorAs)`        | `ColorAs.CSS_CLASS`, `BACKGROUND`, `INDICATOR` | How to apply season color |
| `seasonColorColumns(columns)` | `Column.*`                                     | Columns for season color  |
| `eventColor(colorAs)`         | `ColorAs.CSS_CLASS`, `BACKGROUND`, `INDICATOR` | How to apply event color  |
| `eventColorColumns(columns)`  | `Column.*`                                     | Columns for event color   |

### Column Values

Column values can be combined with bitwise OR (`|`):

```javascript
// Apply to multiple columns
webCalendar.eventColorColumns(Column.EVENT_DETAILS | Column.GRADE);
```

| Value                      | Description              |
| -------------------------- | ------------------------ |
| `Column.LITURGICAL_SEASON` | Liturgical season column |
| `Column.MONTH`             | Month column             |
| `Column.DATE`              | Date column              |
| `Column.EVENT_DETAILS`     | Event details column     |
| `Column.GRADE`             | Liturgical grade column  |
| `Column.PSALTER_WEEK`      | Psalter week column      |
| `Column.ALL`               | All columns              |
| `Column.NONE`              | No columns               |

### Date and Display Format

| Method                  | Values                                                   | Description                                        |
| ----------------------- | -------------------------------------------------------- | -------------------------------------------------- |
| `dateFormat(format)`    | `DateFormat.FULL`, `LONG`, `MEDIUM`, `SHORT`, `DAY_ONLY` | Date display format                                |
| `gradeDisplay(display)` | `GradeDisplay.FULL`, `ABBREVIATED`                       | Liturgical grade display                           |
| `latinInterface(type)`  | `LatinInterface.ECCLESIASTICAL`, `CIVIL`                 | Latin weekday names style                          |
| `rite(rite)`            | `Rite.ROMAN`, `Rite.AMBROSIAN`                           | Rite the calendar belongs to, used for the caption |

`rite()` affects only the caption of a **rite-level** calendar, which is otherwise indistinguishable from
the General Roman calendar: the payload carries no rite field and has neither a `national_calendar` nor a
`diocesan_calendar` setting. Without it an Ambrosian calendar is captioned "General Roman Calendar".
National and diocesan captions are named after the calendar itself and need no rite.

Calling it is unnecessary when the instance uses `listenTo(apiClient)`: the rite is taken from the client
on every fetch, so it follows a linked `RiteSelect` automatically.

### Event Handling

| Method                | Description                                       |
| --------------------- | ------------------------------------------------- |
| `listenTo(apiClient)` | Listen to `calendarFetched` events from ApiClient |
| `appendTo(selector)`  | Set target element and render when data arrives   |

## Reactive Behavior

Unlike other components where `appendTo()` performs a one-time DOM insertion,
`WebCalendar.appendTo()` stores a reference to the target element.
When calendar data is fetched, the table is rebuilt and the target element's children are _replaced_.
This means the calendar updates automatically whenever new data arrives from the ApiClient.

## Styling with CSS Classes

The `WebCalendar` component adds CSS classes to table elements reflecting liturgical grades:

```css
/* Style events by grade */
.grade-0 { /* Commemoration */ }
.grade-1 { /* Optional Memorial */ }
.grade-2 { /* Memorial */ }
.grade-3 { /* Feast */ }
.grade-4 { /* Feast of the Lord */ }
.grade-5 { /* Solemnity */ }
.grade-6 { /* Higher Solemnity */ }
```

## Full Example

See the `examples/WebCalendar` folder for a complete working example with:

- CalendarSelect for calendar selection
- ApiOptions for API parameters
- WebCalendar listening to ApiClient
- CSS styling based on liturgical grades
