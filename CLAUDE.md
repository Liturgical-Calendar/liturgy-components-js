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
├── src/                            # TypeScript source files
│   ├── index.js                    # Main entry point
│   ├── Enums.js                    # Type-safe enumerations
│   ├── Messages.js                 # Localized UI strings (13 languages)
│   ├── Utils.js                    # Utility functions
│   ├── typedefs.js                 # Shared JSDoc typedefs
│   ├── ApiClient/
│   │   ├── ApiClient.js            # API communication, per-base client
│   │   ├── ApiBase.js              # One object per API base URL: registry, metadata, cache
│   │   ├── ApiClientError.js       # Error carrying url/status/statusText/body/cause
│   │   └── EventEmitter.js         # Event bus used by ApiClient
│   ├── ApiOptions/
│   │   ├── ApiOptions.js           # API parameter form controls
│   │   └── Input/                  # Form input components
│   ├── CalendarSelect/             # Calendar dropdown component
│   ├── RiteSelect/                 # Rite dropdown component
│   ├── PathBuilder/
│   │   ├── PathBuilder.js          # API URL builder
│   │   └── CurrentEndpoint.js      # Endpoint state a PathBuilder renders
│   ├── WebCalendar/                # Calendar table renderer and helpers
│   ├── LiturgyOfTheDay/            # Daily liturgy widget
│   ├── LiturgyOfAnyDay/            # Liturgy of any selected date widget
│   ├── ReadingsRenderer/           # Lectionary readings renderer
│   ├── __fixtures__/               # Metadata fixtures for the tests
│   ├── __tests__/                  # Jest unit tests
│   └── stories/                    # Storybook stories
├── dist/                           # Compiled output
├── docs/                           # Component and API documentation
├── examples/                       # Working example applications
└── .storybook/                     # Storybook configuration
```

## Development Commands

```bash
# Compilation
yarn compile              # Compile TypeScript to JavaScript
yarn compile:watch        # Watch mode for continuous compilation
yarn lint:dts             # Type-check dist/*.d.ts under --strict, as a downstream consumer would

# Testing
yarn test                 # Run Jest unit tests

# Markdown — two tools, different jobs (see the Markdown section under Code Standards)
yarn lint:md              # markdownlint-cli2: check against .markdownlint.yml
yarn lint:md:fix          # markdownlint-cli2 --fix (cannot fix MD060 table alignment)
yarn format:md            # prettier: check formatting, changes nothing
yarn format:md:fix        # prettier: reformat in place (this is what fixes MD060)

# JavaScript formatting (see the JavaScript section under Code Standards)
yarn format:js            # prettier: check src/ and examples/, changes nothing
yarn format:js:fix        # prettier: reformat src/ and examples/ in place

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

- **Target:** ES2022 modules
- **Strict mode:** Enabled
- **Output:** `/dist/index.js` (ES module) and `/dist/index.d.ts` (type definitions)

**ES2022 is a floor, not a preference.** The sources use `static #` private fields — ES2022 _syntax_ —
and, more decisively, `Object.hasOwn()` and `Error`'s `cause` option, which are ES2022 **runtime APIs**
that no `target` setting can transpile away. Lowering `target` would therefore produce output that still
fails on an older engine, just less obviously. `tsconfig.json` pins `ES2022` rather than `esnext`, which
drifts with every TypeScript release and so states no contract at all.

**The build cannot catch a false target claim.** `allowJs` is on but **`checkJs` is off**, so TypeScript
parses the JS sources and emits them but never type-checks them, and it does not flag a runtime API that
postdates the target. The project compiles clean at ES2020 and ES2022 alike — which is how the earlier
ES2020 claim survived unnoticed. Any change to the ECMAScript floor must be verified by reading the
emitted `dist/`, not by trusting a green `yarn compile`. (Turning `checkJs` on is a much larger change
and deliberately out of scope.)

**`checkJs` being off also means a green `yarn compile` says nothing about whether the emitted `.d.ts`
files are themselves valid TypeScript.** JSDoc mistakes in `src/` — a `@readonly` tag on a getter (which
`tsc` emits as the syntactically invalid `readonly get foo(): T;`), a type name that never resolves in the
declaration file's own scope — compile cleanly as JS but break every downstream TypeScript consumer.
`yarn lint:dts` is the check that catches this class of bug: it runs `tsc -p tsconfig.dts-check.json`,
a config isolated from `tsconfig.json` that starts from `dist/index.d.ts` and sets its own `target`/`lib`
under `strict`, i.e. it checks the declarations the way a consumer's own `tsconfig.json` would, not the
way this package's build does. Run `yarn compile` first — `lint:dts` checks whatever is already in `dist/`,
it does not rebuild it.

**Formatting: prettier owns `src/` and `examples/`.** `.prettierrc` sets `tabWidth: 4` and
`singleQuote: true` — 4-space indent, single-quoted strings, prettier's other defaults otherwise
(trailing commas, no forced parens beyond what prettier already adds around a sole arrow-function
parameter). Check with `yarn format:js`, rewrite in place with `yarn format:js:fix`; both are also
CLI flags-free, unlike the markdown scripts, because the JS-specific options live in `.prettierrc`
rather than being passed on the command line. CI runs `yarn format:js` — an unformatted file fails
the build the same way an unformatted markdown file does.

This reverses an earlier decision (visible in git history) to keep prettier markdown-only, on the
grounds that prettier's _defaults_ — double quotes, 2-space indent — contradicted this project's
style. That objection is gone now that `.prettierrc` overrides those two defaults; nothing else
about the project's style depends on a prettier option, so there was no remaining reason to hand-
enforce formatting instead of letting the formatter do it. `.prettierrc` scopes the JS options to
JS/TS via an `overrides` block for `*.md` that resets `tabWidth`/`singleQuote` back to prettier's
own defaults, so `yarn format:md` output is unaffected — verify this after touching `.prettierrc`
by confirming `yarn format:md` still reports no files needing changes. `endOfLine` is `"auto"` for
JS (preserve each file's existing line ending) rather than the default `"lf"`, because 5 of the 91
tracked JS files under `src/` and `examples/` are CRLF (see `.editorconfig`) and a formatting pass
should not silently rewrite line endings as a side effect.

There is now an `.editorconfig` (4-space `[*.js]`, `end_of_line = lf` to match the repo's dominant
convention) so an editor's live indentation matches what prettier will enforce after the fact.

**Key Patterns:**

- **Chainable methods** - Configuration methods return `this` for fluent interface
- **Non-chainable methods** - `appendTo()` is void: it may terminate a chain, but nothing can be chained off it
- **JSDoc comments** - All public methods documented with parameter and return types
- **Private fields** - Uses `#` prefix for encapsulation

**Method Chainability:**

| Method Type        | Chainable | Returns | Examples                                 |
| ------------------ | --------- | ------- | ---------------------------------------- |
| Configuration      | Yes       | `this`  | `class()`, `id()`, `label()`, `filter()` |
| DOM insertion      | No        | `void`  | `appendTo()`                             |
| Build/render       | No        | varies  | `buildTable()` returns Promise           |
| Event subscription | Yes       | `this`  | `listenTo()`                             |

**Note:** `WebCalendar.attachTo()` is deprecated. Use `appendTo()` instead for consistency with other components.

**WebCalendar appendTo() Behavior:** Unlike other components where `appendTo()` performs a one-time DOM insertion,
`WebCalendar.appendTo()` stores a reference to the target element. When calendar data is fetched (via `listenTo()`),
the table content is rebuilt and the target element's children are _replaced_ (not appended). This reactive behavior
means the calendar updates automatically whenever new data arrives from the ApiClient.

**IMPORTANT:** `appendTo()` returns `undefined` rather than `this`. Two things follow, and only two:
nothing can be chained _off_ it, and its result must never be assigned. It may still **terminate** a
chain — the receiver is whatever the preceding configuration method returned, and the `undefined` is
simply discarded as a statement.

```javascript
import { CalendarSelect, ApiOptions } from 'liturgy-components-js';

// CORRECT - configure, then insert
const calendarSelect = new CalendarSelect('en-US')
    .filter(CalendarSelectFilter.NATIONAL_CALENDARS)
    .class('form-control')
    .id('calendar-select');
calendarSelect.appendTo('#container');

// ALSO CORRECT - appendTo() ends the chain. class() returned the CalendarSelect,
// so appendTo() runs on that instance and nothing consumes its undefined.
new CalendarSelect('en-US').class('form-control').appendTo('#container');

// WRONG - the const is undefined, not the component
const calendarSelect = new CalendarSelect('en-US')
    .class('form-control')
    .appendTo('#container');

// WRONG - nothing can be chained off appendTo()
new CalendarSelect('en-US')
    .appendTo('#container')
    .class('form-control'); // TypeError: Cannot read properties of undefined
```

### Markdown

All markdown files must conform to `.markdownlint.yml`:

- **Line length:** Maximum 180 characters (code blocks and tables excluded)
- **Tables:** Columns must be vertically aligned (MD060)
- **Code blocks:** Use fenced style with language specifiers
- **Lists:** Must be surrounded by blank lines

**Two tools, deliberately kept separate — do not merge them into one script name.**

| Tool                | Script                       | Fixes                                                 |
| ------------------- | ---------------------------- | ----------------------------------------------------- |
| `markdownlint-cli2` | `lint:md`, `lint:md:fix`     | the `.markdownlint.yml` rules — MD013, MD029, MD040 … |
| `prettier`          | `format:md`, `format:md:fix` | formatting — table alignment (MD060), MD032           |

They are complementary, not alternatives, because **`markdownlint-cli2 --fix` cannot repair MD060.**
Run it on a misaligned table and it reports the error but changes nothing; alignment would otherwise have
to be done by hand. `yarn format:md:fix` does it mechanically, and its output passes `lint:md` with zero
errors — so prettier owns formatting and markdownlint owns everything else. Prettier does **not** fix
MD013 or MD029; those still need a human edit.

Both share the same names in the monorepo's other (PHP) projects, where only markdownlint exists. Here
`lint:md` is markdownlint and `format:md` is prettier. Defining prettier as `lint:md` would silently
shadow the markdownlint scripts — JSON takes the last duplicate key — so keep the names distinct.

**Prettier now formats both markdown and JavaScript** (see the JavaScript section above), but the
`format:md` scripts still pass `--embedded-language-formatting=off` so that fenced JavaScript samples
inside the docs are left exactly as written — reformatting a code sample inside prose is a separate,
not-yet-made decision from reformatting `src/` itself. The markdown-specific options
(`--prose-wrap=preserve`, `--embedded-language-formatting=off`) stay as CLI flags on the `format:md`
scripts rather than moving into `.prettierrc`, and `.prettierrc`'s JS-specific `tabWidth`/`singleQuote`
are scoped away from `*.md` via an `overrides` block, so the two configurations don't interfere with
each other.

## Key Components

| Component         | Purpose                                         |
| ----------------- | ----------------------------------------------- |
| `ApiClient`       | Manages API communication, emits events         |
| `ApiBase`         | One API base: its URL, calendar index and cache |
| `ApiClientError`  | Error carrying url, status, statusText and body |
| `CalendarSelect`  | Dropdown for selecting calendars                |
| `ApiOptions`      | Form controls for API parameters                |
| `WebCalendar`     | Renders calendar as HTML table                  |
| `LiturgyOfTheDay` | Widget displaying today's liturgy               |
| `LiturgyOfAnyDay` | Widget displaying liturgy for any selected date |
| `PathBuilder`     | Builds and displays API request URLs            |

### How components take a locale

One contract, everywhere a locale is accepted — the bare constructor argument, the `locale` property of an
options bag, `WebCalendar.locale()`, and the `locale` argument of the `ApiClient` fetch methods:

- **`string` or `Intl.Locale`, interchangeably.** The tag stored is the locale's canonical form, so
  `new CalendarSelect('it-IT')` and `new CalendarSelect(new Intl.Locale('it-IT'))` are the same call. Unicode
  extensions survive, including ones given as `Intl.Locale` constructor options rather than written in the tag.
- **`null` and `undefined` both mean "not supplied"**, as the argument itself and as the `locale` property
  alike, and take the component's default (`'en'` for the five constructors, `'en-US'` for `WebCalendar`).
- **Anything else is rejected**, naming the component and the type it found — an array, a number, or any class
  instance other than `Intl.Locale`. The three accepted forms disambiguate in this order: `Intl.Locale` is a
  locale, any other object is an options bag, a string is a locale.
- **An unparseable locale throws** and is never silently replaced with English. "Absent" and "invalid" are
  different things.

The shared implementations are `src/LocaleValidation.js` (what a locale is) and `src/OptionsValidation.js`
(what shape an options argument may take). Neither is exported from `src/index.js`: they are internal contract
between the components, not public API.

## ApiClient

The `ApiClient` is the central hub for API communication. It fetches calendar data and emits events that other components listen to.

### Initialization and Failure

`ApiClient.init()` **rejects** — it never resolves to `false`, and never throws synchronously:

- an `ApiClientError` (with `url`, `status`, `statusText`, `body`, `cause`) when the base's `/calendars` request fails
- a plain `Error` when the `url` argument is not a non-empty string, or is not an absolute `http:`/`https:` URL

```javascript
const apiClient = await ApiClient.init(BaseUrl); // wrap in try/catch, or use .catch()
```

The fetch methods — `fetchCalendar()`, `fetchNationalCalendar()`, `fetchDiocesanCalendar()` and
`refetchCalendarData()` — also return promises that reject with an `ApiClientError`, after emitting
`calendarFetchFailed` as `(error, { rite })`. Subscribe with the chainable `apiClient.on(event, listener)`.

Failures are logged only when nobody could have handled them: a promise the caller holds rejects and is not
logged, while the requests the library issues for itself (the `listenTo()` listeners, `LiturgyOfAnyDay`'s year
handling) fall back to `console.error` only when nothing is subscribed to `calendarFetchFailed`.

### Configuration Methods

```javascript
const apiClient = await ApiClient.init(BaseUrl);

// Set year (chainable)
apiClient.year(2025);

// Set year type (chainable)
apiClient.yearType(YearType.LITURGICAL);

// Chain multiple configuration methods
apiClient.year(2025).yearType(YearType.CIVIL);

// Fetch methods
apiClient.fetchCalendar(locale);
apiClient.fetchNationalCalendar(calendarId, locale);
apiClient.fetchDiocesanCalendar(calendarId, locale);
apiClient.refetchCalendarData();
```

### Caching

The ApiClient implements parameter-based caching to avoid redundant API requests. Calendar data is cached based on:

- Category (general, national, diocesan)
- Calendar ID
- Year
- Year type (LITURGICAL or CIVIL)
- Locale
- Rite (roman or ambrosian)
- Mobile feast settings (epiphany, ascension, corpus_christi, eternal_high_priest)

When a fetch method is called with the same parameters, cached data is returned immediately without making an HTTP request.

The cache belongs to the `ApiBase`, not to the `ApiClient` class: two clients on one base share it, and two
bases never see each other's responses. It holds 50 entries per base by default, evicting the
least-recently-**read** first, with optional expiry — both set through `ApiBase.cacheLimits({ maxEntries, ttl })`.

```javascript
// First call fetches from API
apiClient.year(2025).yearType(YearType.LITURGICAL);
await apiClient.fetchCalendar('en');

// Second call with same parameters returns cached data (no HTTP request)
await apiClient.fetchCalendar('en');

// Different parameters trigger a new fetch
apiClient.year(2026);
await apiClient.fetchCalendar('en'); // Fetches from API

// Clear all cached data when needed
ApiClient.clearCache();
```

### Deprecated Methods

The following methods are deprecated and will show console warnings:

| Deprecated      | Use Instead  |
| --------------- | ------------ |
| `setYear()`     | `year()`     |
| `setYearType()` | `yearType()` |

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
- **Browser support** - Browsers with ES2022 support (see the Target section under Code Standards): Chrome/Edge 94+, Firefox 93+, Safari 15.4+. ES6 module support alone is not sufficient

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

### Multi-base Wiring

Each `ApiClient` is bound to an `ApiBase` — one object per API base URL, owning that base's calendar index and
response cache. `CalendarSelect` and `ApiOptions` take an `apiClient` option that binds them to that client's
base:

```javascript
const dev = await ApiClient.init('http://localhost:8000');
const prod = await ApiClient.init('https://litcal.johnromanodorazio.com/api/dev');

const devSelect = new CalendarSelect({ locale: 'en', apiClient: dev });
const devOptions = new ApiOptions({ locale: 'en', apiClient: dev }).linkToCalendarSelect(devSelect);
const prodSelect = new CalendarSelect({ locale: 'en', apiClient: prod });
```

- Omitting `apiClient` binds to the first base registered, so single-base pages need no change. Once more than
  one base is registered, an unbound component warns once per component class and names the base it chose.
- `PathBuilder` has no `apiClient` option: it takes its base from the `ApiOptions` and `CalendarSelect` passed
  to it, and throws when those two are bound to different bases. `CalendarSelect.linkToNationsSelect()` throws
  on the same mismatch.
- `WebCalendar`, `LiturgyOfTheDay` and `LiturgyOfAnyDay` bind through `listenTo(apiClient)` as before.
- `ApiClient.init()` returns a **new** client on every call, including for a base already registered — only the
  metadata and cache are shared, which is what lets two clients on one API hold different rites.

`examples/CompareBases/` is a complete two-pane page. In tests, build a loaded base with no network call using
`ApiBase.fromMetadata(url, metadata)`, and call `ApiBase.reset()` in `beforeEach`.

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
calendarSelect.value(''); // Select General Roman Calendar

// 3. Create ApiOptions with locale filter, linked to CalendarSelect
const apiOptions = new ApiOptions(lang)
    .filter(ApiOptionsFilter.LOCALE_ONLY)
    .linkToCalendarSelect(calendarSelect);
apiOptions.appendTo('#localeContainer');

// 4. Select appropriate locale (exact match > language match > first option)
const localeOptions = apiOptions._localeInput.options();
const exactMatch = localeOptions.find(val => val === lang);
const languageMatch = localeOptions.find(val => val.split(/[-_]/)[0] === lang);
let selectedLocale = exactMatch || languageMatch || localeOptions[0] || lang;
apiOptions._localeInput.value(selectedLocale);

// 5. Create LiturgyOfAnyDay (configures ApiClient year_type automatically)
const liturgyOfAnyDay = new LiturgyOfAnyDay({ locale: lang })
    .buildDateControls()
    .listenTo(apiClient);
liturgyOfAnyDay.appendTo('#liturgyContainer');

// 6. Wire ApiClient to listen to UI components
apiClient.listenTo(calendarSelect).listenTo(apiOptions);

// 7. Initial fetch with the matched locale (the promise is yours: handle its rejection)
apiClient.fetchCalendar(selectedLocale).catch((error) => {
    console.error(`Could not load the calendar: ${error.message}`);
});
```

### CalendarSelect Default Value

By default, `CalendarSelect` selects Vatican as the first option. To select the General Roman Calendar instead:

```javascript
calendarSelect.appendTo('#container');
calendarSelect.value(''); // Empty value = General Roman Calendar
```

### LocaleInput Selection Logic

When setting up LocaleInput, match the user's locale with available options:

```javascript
const localeOptions = apiOptions._localeInput.options();
// Try exact match first (e.g., "en" matches "en")
const exactMatch = localeOptions.find(val => val === userLang);
// Then try language match (e.g., "en" matches "en_US")
const languageMatch = localeOptions.find(val => val.split(/[-_]/)[0] === userLang);
// Fallback to first available option
const selectedLocale = exactMatch || languageMatch || localeOptions[0];
```
