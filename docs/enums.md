# Enums

The library exports several enums for type-safe configuration of components.

## Import

```javascript
import {
    Grouping,
    ColorAs,
    Column,
    ColumnOrder,
    DateFormat,
    GradeDisplay,
    ApiOptionsFilter,
    CalendarSelectFilter,
    YearType,
    LatinInterface
} from '@liturgical-calendar/components-js';
```

## Grouping

Used with `WebCalendar.firstColumnGrouping()`:

| Value | Description |
|-------|-------------|
| `Grouping.BY_MONTH` | Group events by month |
| `Grouping.BY_LITURGICAL_SEASON` | Group events by liturgical season |

## ColorAs

Used with `WebCalendar.seasonColor()` and `WebCalendar.eventColor()`:

| Value | Description |
|-------|-------------|
| `ColorAs.CSS_CLASS` | Apply color as a CSS class |
| `ColorAs.BACKGROUND` | Apply color as inline background style |
| `ColorAs.INDICATOR` | Display color as a small colored circle |
| `ColorAs.NONE` | Don't apply color |

## Column

Used with `WebCalendar.seasonColorColumns()` and `WebCalendar.eventColorColumns()`.
Values are bitfield and can be combined with `|`:

```javascript
// Apply to multiple columns
webCalendar.eventColorColumns(Column.EVENT_DETAILS | Column.GRADE);
```

| Value | Description |
|-------|-------------|
| `Column.LITURGICAL_SEASON` | Liturgical season column |
| `Column.MONTH` | Month column |
| `Column.DATE` | Date column |
| `Column.EVENT_DETAILS` | Event details column |
| `Column.GRADE` | Liturgical grade column |
| `Column.PSALTER_WEEK` | Psalter week column |
| `Column.ALL` | All columns |
| `Column.NONE` | No columns |

## ColumnOrder

Used with `WebCalendar.columnOrder()`:

| Value | Description |
|-------|-------------|
| `ColumnOrder.GRADE_FIRST` | Grade column before event details |
| `ColumnOrder.EVENT_DETAILS_FIRST` | Event details column before grade |

## DateFormat

Used with `WebCalendar.dateFormat()`:

| Value | Description |
|-------|-------------|
| `DateFormat.FULL` | Full date format (e.g., "Wednesday, November 26, 2025") |
| `DateFormat.LONG` | Long date format (e.g., "November 26, 2025") |
| `DateFormat.MEDIUM` | Medium date format (e.g., "Nov 26, 2025") |
| `DateFormat.SHORT` | Short date format (e.g., "11/26/25") |
| `DateFormat.DAY_ONLY` | Day and weekday only (e.g., "Wed 26") |

## GradeDisplay

Used with `WebCalendar.gradeDisplay()`:

| Value | Description |
|-------|-------------|
| `GradeDisplay.FULL` | Full grade text (e.g., "Optional Memorial") |
| `GradeDisplay.ABBREVIATED` | Abbreviated grade (e.g., "Opt. Mem.") |

## ApiOptionsFilter

Used with `ApiOptions.filter()`:

| Value | Description |
|-------|-------------|
| `ApiOptionsFilter.NONE` | Show all form controls |
| `ApiOptionsFilter.GENERAL_ROMAN` | Show only General Roman Calendar controls |
| `ApiOptionsFilter.ALL_CALENDARS` | Show only universal controls (year, yearType, locale, acceptHeader) |
| `ApiOptionsFilter.PATH_BUILDER` | Show calendarPath and year controls |
| `ApiOptionsFilter.LOCALE_ONLY` | Show only locale control |
| `ApiOptionsFilter.YEAR_ONLY` | Show only year control |
| `ApiOptionsFilter.BASE_PATH` | Base path controls |
| `ApiOptionsFilter.ALL_PATHS` | All path controls |

## CalendarSelectFilter

Used with `CalendarSelect.filter()`:

| Value | Description |
|-------|-------------|
| `CalendarSelectFilter.NONE` | Show all calendars |
| `CalendarSelectFilter.NATIONAL_CALENDARS` | Show only national calendars |
| `CalendarSelectFilter.DIOCESAN_CALENDARS` | Show only diocesan calendars |

## YearType

Used with `ApiClient.yearType()`:

| Value | Description |
|-------|-------------|
| `YearType.LITURGICAL` | Liturgical year (Advent to Christ the King) |
| `YearType.CIVIL` | Civil year (January 1 to December 31) |

## LatinInterface

Used with `WebCalendar.latinInterface()`:

| Value | Description |
|-------|-------------|
| `LatinInterface.ECCLESIASTICAL` | Ecclesiastical Latin weekday names |
| `LatinInterface.CIVIL` | Classical Latin weekday names |
