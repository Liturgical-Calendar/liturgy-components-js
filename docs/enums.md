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
    LatinInterface,
    Rite,
    RiteProperties
} from '@liturgical-calendar/components-js';
```

## Grouping

Used with `WebCalendar.firstColumnGrouping()`:

| Value                           | Description                       |
| ------------------------------- | --------------------------------- |
| `Grouping.BY_MONTH`             | Group events by month             |
| `Grouping.BY_LITURGICAL_SEASON` | Group events by liturgical season |

## ColorAs

Used with `WebCalendar.seasonColor()` and `WebCalendar.eventColor()`:

| Value                | Description                             |
| -------------------- | --------------------------------------- |
| `ColorAs.CSS_CLASS`  | Apply color as a CSS class              |
| `ColorAs.BACKGROUND` | Apply color as inline background style  |
| `ColorAs.INDICATOR`  | Display color as a small colored circle |
| `ColorAs.NONE`       | Don't apply color                       |

## Column

Used with `WebCalendar.seasonColorColumns()` and `WebCalendar.eventColorColumns()`.
Values are bitfield and can be combined with `|`:

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

## ColumnOrder

Used with `WebCalendar.columnOrder()`:

| Value                             | Description                       |
| --------------------------------- | --------------------------------- |
| `ColumnOrder.GRADE_FIRST`         | Grade column before event details |
| `ColumnOrder.EVENT_DETAILS_FIRST` | Event details column before grade |

## DateFormat

Used with `WebCalendar.dateFormat()`:

| Value                 | Description                                             |
| --------------------- | ------------------------------------------------------- |
| `DateFormat.FULL`     | Full date format (e.g., "Wednesday, November 26, 2025") |
| `DateFormat.LONG`     | Long date format (e.g., "November 26, 2025")            |
| `DateFormat.MEDIUM`   | Medium date format (e.g., "Nov 26, 2025")               |
| `DateFormat.SHORT`    | Short date format (e.g., "11/26/25")                    |
| `DateFormat.DAY_ONLY` | Day and weekday only (e.g., "Wed 26")                   |

## GradeDisplay

Used with `WebCalendar.gradeDisplay()`:

| Value                      | Description                                 |
| -------------------------- | ------------------------------------------- |
| `GradeDisplay.FULL`        | Full grade text (e.g., "Optional Memorial") |
| `GradeDisplay.ABBREVIATED` | Abbreviated grade (e.g., "Opt. Mem.")       |

## ApiOptionsFilter

Used with `ApiOptions.filter()`:

| Value                            | Description                                          |
| -------------------------------- | ---------------------------------------------------- |
| `ApiOptionsFilter.NONE`          | Show all form controls                               |
| `ApiOptionsFilter.GENERAL_ROMAN` | Show only General Roman Calendar controls            |
| `ApiOptionsFilter.ALL_CALENDARS` | Show universal controls (year, locale, acceptHeader) |
| `ApiOptionsFilter.PATH_BUILDER`  | Show calendarPath and year controls                  |
| `ApiOptionsFilter.LOCALE_ONLY`   | Show only locale control                             |
| `ApiOptionsFilter.YEAR_ONLY`     | Show only year control                               |
| `ApiOptionsFilter.BASE_PATH`     | Base path controls                                   |
| `ApiOptionsFilter.ALL_PATHS`     | All path controls                                    |

## CalendarSelectFilter

Used with `CalendarSelect.filter()`:

| Value                                     | Description                  |
| ----------------------------------------- | ---------------------------- |
| `CalendarSelectFilter.NONE`               | Show all calendars           |
| `CalendarSelectFilter.NATIONAL_CALENDARS` | Show only national calendars |
| `CalendarSelectFilter.DIOCESAN_CALENDARS` | Show only diocesan calendars |

## YearType

Used with `ApiClient.yearType()`:

| Value                 | Description                                 |
| --------------------- | ------------------------------------------- |
| `YearType.LITURGICAL` | Liturgical year (Advent to Christ the King) |
| `YearType.CIVIL`      | Civil year (January 1 to December 31)       |

## LatinInterface

Used with `WebCalendar.latinInterface()`:

| Value                           | Description                        |
| ------------------------------- | ---------------------------------- |
| `LatinInterface.ECCLESIASTICAL` | Ecclesiastical Latin weekday names |
| `LatinInterface.CIVIL`          | Classical Latin weekday names      |

## Rite

The liturgical rite a calendar request is computed under. Used with `CalendarSelect`'s `rite`
constructor option and `.rite()` method, `RiteSelect`'s options, and `ApiOptions.linkToCalendarSelect()`:

| Value            | Description                                                                          |
| ---------------- | ------------------------------------------------------------------------------------ |
| `Rite.ROMAN`     | The Roman rite. The default for every component; applies to every pre-existing route |
| `Rite.AMBROSIAN` | The Ambrosian rite, celebrated in the dioceses of Milan, Bergamo, Novara, and Lugano |

## RiteProperties

A frozen map, keyed by `Rite` value, of structural facts about each rite — properties of the rite
itself, not user preferences. Read via `RiteProperties[rite]`:

| Property                  | Type    | Description                                                                                                                                                                                |
| ------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `hasNationalTier`         | boolean | Whether the rite has national calendars at all. `false` for Ambrosian: it has no `/calendar/ambrosian/nation/...` route, and a `CalendarSelect` built for it never shows a nation grouping |
| `hasFixedTemporalOptions` | boolean | Whether the rite's own liturgical books fix Epiphany, Ascension, Corpus Christi and the Eternal High Priest, making the corresponding API parameters meaningless. `true` for Ambrosian     |
| `minYear`                 | number  | The earliest year the rite can be computed for. `1970` for Roman; `1976` for Ambrosian, the first year of the reformed Ambrosian Missal                                                    |
| `emptyOptionLabelKey`     | string  | The `Messages` key for the rite-level calendar's label (e.g. `GENERAL_ROMAN_CALENDAR`, `AMBROSIAN_CALENDAR`), used for `CalendarSelect`'s empty option in rite-aware mode                  |
