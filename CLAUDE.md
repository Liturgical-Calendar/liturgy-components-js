# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**@liturgical-calendar/components-js** is a reusable ES6/JavaScript component library that provides user interface components
for interacting with the Liturgical Calendar API. It enables developers to easily integrate liturgical calendar functionality
into web applications without needing a build step.

**Key Capabilities:**

- Display and select from available Roman Catholic liturgical calendars (national, diocesan, General Roman)
- Configure API parameters (year, locale, date format, etc.)
- Render interactive liturgical calendar tables with customizable grouping and styling
- Display the liturgy of the day for a specific calendar
- Build and preview API request URLs

**Distribution:**

- NPM package: `@liturgical-calendar/components-js`
- CDN: `https://cdn.jsdelivr.net/npm/@liturgical-calendar/components-js/+esm`

This library is part of the coordinated API client libraries effort.
See the [API Client Libraries Roadmap](../docs/API_CLIENT_LIBRARIES_ROADMAP.md)
for the full coordination strategy across PHP, JavaScript, and React platforms.

## Main Technologies

- **TypeScript 5.7.2** - Source code written in TypeScript, compiled to ES modules
- **JavaScript ES6 Modules** - No build step required for CDN usage
- **Storybook 8.5** - Component documentation and interactive testing
- **Jest 29.7.0** - Unit testing framework
- **Yarn 4.6.0** - Package manager with PnP (Plug'n'Play)

## Project Structure

```text
liturgy-components-js/
├── src/                      # TypeScript source files
│   ├── index.js             # Main entry point
│   ├── ApiClient.js         # API communication, event emitter
│   ├── CalendarSelect.js    # Calendar dropdown component
│   ├── ApiOptions.js        # API parameter form controls
│   ├── WebCalendar.js       # Calendar table renderer
│   ├── LiturgyOfTheDay.js   # Daily liturgy widget
│   ├── PathBuilder.js       # API URL builder
│   ├── Enums.js             # Type-safe enumerations
│   ├── Messages.js          # Localized UI strings (13 languages)
│   ├── Utils.js             # Utility functions
│   ├── ApiOptions/Input/    # Form input components
│   ├── WebCalendar/         # Table rendering helpers
│   └── stories/             # Storybook stories
├── dist/                    # Compiled output
├── examples/                # Working example applications
└── .storybook/              # Storybook configuration
```

## Development Commands

```bash
# Compilation
yarn compile              # Compile TypeScript to JavaScript
yarn compile:watch        # Watch mode for continuous compilation

# Testing
yarn test                 # Run Jest unit tests

# Storybook
yarn storybook            # Launch on random free port (requires API at localhost:8000)
yarn storybook --port 6006  # Launch on specific port
yarn storybook:ci         # CI mode (fixed port 6006)
yarn build-storybook      # Build static Storybook

# Docker
yarn docker               # Run compile:watch and storybook:ci in parallel
```

**Environment Setup:**

1. Copy `.env.example` to `.env`
2. Set `STORYBOOK_API_PORT` if API runs on non-standard port (default: 8000)

## Code Standards

### TypeScript/JavaScript

- **Target:** ES2020 modules
- **Strict mode:** Enabled
- **Output:** `/dist/index.js` (ES module) and `/dist/index.d.ts` (type definitions)

**Key Patterns:**

- **Chainable methods** - Configuration methods return `this` for fluent interface
- **Non-chainable methods** - `appendTo()` is void and does NOT return `this`
- **JSDoc comments** - All public methods documented with parameter and return types
- **Private fields** - Uses `#` prefix for encapsulation

**Method Chainability:**

| Method Type        | Chainable | Returns     | Examples                                      |
|--------------------|-----------|-------------|-----------------------------------------------|
| Configuration      | Yes       | `this`      | `class()`, `id()`, `label()`, `filter()`      |
| DOM insertion      | No        | `void`      | `appendTo()`, `attachTo()`                    |
| Build/render       | No        | varies      | `buildTable()` returns Promise                |
| Event subscription | Yes       | `this`      | `listenTo()`                                  |

**IMPORTANT:** Since `appendTo()` does not return `this`, you must NOT chain it with other methods.
Call it separately after configuring the component:

```javascript
import { CalendarSelect, ApiOptions } from 'liturgy-components-js';

// CORRECT - appendTo() called separately
const calendarSelect = new CalendarSelect('en-US')
    .filter(CalendarSelectFilter.NATIONAL_CALENDARS)
    .class('form-control')
    .id('calendar-select');
calendarSelect.appendTo('#container');

// WRONG - appendTo() chained returns undefined
const calendarSelect = new CalendarSelect('en-US')
    .class('form-control')
    .appendTo('#container');  // Returns undefined, not the CalendarSelect instance!
```

### Markdown

All markdown files must conform to `.markdownlint.yml`:

- **Line length:** Maximum 180 characters (code blocks and tables excluded)
- **Tables:** Columns must be vertically aligned (MD060)
- **Code blocks:** Use fenced style with language specifiers
- **Lists:** Must be surrounded by blank lines

## Key Components

| Component         | Purpose                                           |
|-------------------|---------------------------------------------------|
| `ApiClient`       | Manages API communication, emits events           |
| `CalendarSelect`  | Dropdown for selecting calendars                  |
| `ApiOptions`      | Form controls for API parameters                  |
| `WebCalendar`     | Renders calendar as HTML table                    |
| `LiturgyOfTheDay` | Widget displaying today's liturgy                 |
| `LiturgyOfAnyDay` | Widget displaying liturgy for any selected date   |
| `PathBuilder`     | Builds and displays API request URLs              |

## Enums

Type-safe enumerations for component configuration:

- `Grouping` - BY_MONTH, BY_LITURGICAL_SEASON
- `ColorAs` - BACKGROUND, CSS_CLASS, INDICATOR
- `Column` - EVENT, GRADE, COMMON, etc.
- `ColumnOrder` - GRADE_FIRST, EVENT_DETAILS_FIRST
- `DateFormat` - FULL, LONG, MEDIUM, SHORT, DAY_ONLY
- `GradeDisplay` - FULL, ABBREVIATED
- `CalendarSelectFilter` - NATIONAL_CALENDARS, DIOCESAN_CALENDARS, NONE
- `ApiOptionsFilter` - GENERAL_ROMAN, ALL_CALENDARS, PATH_BUILDER, LOCALE_ONLY, YEAR_ONLY, NONE
- `YearType` - LITURGICAL, CIVIL

## Internationalization

Supports 13 languages via message catalogs in `Messages.js`:
en, it, la, es, fr, de, pt, nl, hu, id, sk, vi

## Important Notes

- **No build step for production** - Components work as-is with ES6 module imports
- **API dependency** - Components require access to Liturgical Calendar API
- **Default API URL** - `https://litcal.johnromanodorazio.com/api/dev`
- **Browser support** - Modern browsers with ES6 module support

## Component Wiring Patterns

### Basic Wiring

Components communicate through the `ApiClient` which acts as a central hub:

```javascript
// ApiClient listens to UI components for changes
apiClient.listenTo(calendarSelect).listenTo(apiOptions);

// Display components listen to ApiClient for data
webCalendar.listenTo(apiClient);
liturgyOfTheDay.listenTo(apiClient);
liturgyOfAnyDay.listenTo(apiClient);
```

### LiturgyOfAnyDay Component

The `LiturgyOfAnyDay` component provides a complete widget for viewing liturgy on any date:

**Key Features:**

- Internal `DayInput`, `MonthInput`, and `YearInput` controls
- Automatic year_type handling for December 31st (switches to LITURGICAL to include vigil masses)
- Caches calendar data and re-renders when day/month changes (no API call)
- Triggers API refetch only when year changes or year_type needs to change
- High-contrast text colors based on liturgical color backgrounds
- Border added for white backgrounds to distinguish from parent

**Configuration Methods:**

```javascript
const liturgyOfAnyDay = new LiturgyOfAnyDay({ locale: 'en' })
    .id('liturgyOfAnyDay')
    .class('card shadow')
    .titleClass('h3')
    .dateClass('card-header')
    .dateControlsClass('row g-3 p-3')
    .eventsWrapperClass('card-body')
    .eventClass('p-3 mb-2 rounded')
    .eventGradeClass('small')
    .eventCommonClass('small fst-italic')
    .eventYearCycleClass('small')
    .dayInputConfig({ wrapper: 'div', wrapperClass: 'col-md', class: 'form-control', labelClass: 'form-label', labelText: 'Day' })
    .monthInputConfig({ wrapper: 'div', wrapperClass: 'col-md', class: 'form-select', labelClass: 'form-label', labelText: 'Month' })
    .yearInputConfig({ wrapper: 'div', wrapperClass: 'col-md', class: 'form-control', labelClass: 'form-label', labelText: 'Year' })
    .buildDateControls()
    .listenTo(apiClient);
liturgyOfAnyDay.appendTo('#container');
```

**December 31st Handling:**

The component automatically handles the special case of December 31st:

- When the selected date is December 31st, it fetches with `year_type=LITURGICAL` and `year=selectedYear+1`
- This ensures the Vigil Mass for Mary Mother of God (January 1st) is included
- When switching away from December 31st, it reverts to `year_type=CIVIL`
- The `listenTo(apiClient)` method configures ApiClient with the correct initial year_type

### Typical Page Setup (Liturgy of Any Day)

```javascript
// 1. Initialize ApiClient
const apiClient = await ApiClient.init(BaseUrl);

// 2. Create CalendarSelect with General Roman Calendar as default
const calendarSelect = new CalendarSelect(lang)
    .class('form-select')
    .allowNull(true);
calendarSelect.appendTo('#calendarContainer');
calendarSelect._domElement.value = ''; // Select General Roman Calendar

// 3. Create ApiOptions with locale filter, linked to CalendarSelect
const apiOptions = new ApiOptions(lang)
    .filter(ApiOptionsFilter.LOCALE_ONLY)
    .linkToCalendarSelect(calendarSelect);
apiOptions.appendTo('#localeContainer');

// 4. Select appropriate locale (exact match > language match > first option)
const localeOptions = Array.from(apiOptions._localeInput._domElement.options);
const exactMatch = localeOptions.find(opt => opt.value === lang);
const languageMatch = localeOptions.find(opt => opt.value.split(/[-_]/)[0] === lang);
let selectedLocale = exactMatch?.value || languageMatch?.value || localeOptions[0]?.value || lang;
apiOptions._localeInput._domElement.value = selectedLocale;

// 5. Create LiturgyOfAnyDay (configures ApiClient year_type automatically)
const liturgyOfAnyDay = new LiturgyOfAnyDay({ locale: lang })
    .buildDateControls()
    .listenTo(apiClient);
liturgyOfAnyDay.appendTo('#liturgyContainer');

// 6. Wire ApiClient to listen to UI components
apiClient.listenTo(calendarSelect).listenTo(apiOptions);

// 7. Initial fetch with the matched locale
apiClient.fetchCalendar(selectedLocale);
```

### CalendarSelect Default Value

By default, `CalendarSelect` selects Vatican as the first option. To select the General Roman Calendar instead:

```javascript
calendarSelect.appendTo('#container');
calendarSelect._domElement.value = ''; // Empty value = General Roman Calendar
```

### LocaleInput Selection Logic

When setting up LocaleInput, match the user's locale with available options:

```javascript
const localeOptions = Array.from(apiOptions._localeInput._domElement.options);
// Try exact match first (e.g., "en" matches "en")
const exactMatch = localeOptions.find(opt => opt.value === userLang);
// Then try language match (e.g., "en" matches "en_US")
const languageMatch = localeOptions.find(opt => opt.value.split(/[-_]/)[0] === userLang);
// Fallback to first available option
const selectedLocale = exactMatch?.value || languageMatch?.value || localeOptions[0]?.value;
```
