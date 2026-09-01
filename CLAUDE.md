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
- **Storybook 10.5.7** - Component documentation and interactive testing
- **Jest 30.4.2** - Unit testing framework
- **Yarn 4.6.0** - Package manager with PnP (Plug'n'Play)

## Project Structure

```text
liturgy-components-js/
├── src/                            # TypeScript source files
│   ├── index.js                    # Main entry point
│   ├── Enums.js                    # Type-safe enumerations
│   ├── Messages.js                 # Localized UI strings (84 locale blocks, unevenly populated)
│   ├── MessageLookup.js            # The one guarded read of Messages, falling back to English
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
│   ├── MetaComponents/
│   │   ├── CalendarResourcePicker.js # RiteSelect + filtered CalendarSelect, bundled
│   │   ├── DayViewer.js             # Rite, calendar, locale and LiturgyOfAnyDay, bundled
│   │   ├── CalendarControls.js      # Rite, calendar and ApiOptions, wired, no renderer
│   │   ├── CalendarViewer.js        # CalendarControls + WebCalendar
│   │   ├── ApiExplorer.js           # CalendarControls + PathBuilder, never fetches
│   │   ├── Theme.js                 # Internal theme-bag resolver, not exported
│   │   └── ThemePresets.js          # Framework preset table; only its names are exported
│   ├── SubscriptionBuilder/
│   │   ├── SubscriptionBuilder.js  # CalendarControls + a subscription URL, never fetches
│   │   └── SubscriptionUrl.js       # Private renderer, not exported
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
by confirming `yarn format:md` still reports no files needing changes. `endOfLine` is `"lf"`.

**Line endings are enforced by `.gitattributes`, and that is the only layer that can enforce them.**
`* text=auto eol=lf` normalizes on checkin, so no editor, script or platform default reintroduces CRLF.
The other two layers state the convention but cannot hold it: git never reads `.editorconfig`, and
prettier only touches the files it is pointed at, so a scripted rewrite or a `sed -i` slips past both.

That was not a theoretical gap. Before issue #84, seven tracked files carried CRLF **in the index**
(`.storybook/preview-head.html`, `DayInput.js`, `MonthInput.js`, `LiturgyOfAnyDay.js`, two
`LiturgyOfAnyDay*.stories.js`, `liturgyofanyday.css`) and `endOfLine` was `"auto"` specifically to
preserve them. The convention then broke twice in a single day's work — a whole-file rewrite in PR #74
and a scripted one in PR #82 — each caught only by a manual `file -b` check, because no test, linter or
formatter reports it and `yarn format:js` passes either way by design. #84 added the attributes file,
renormalized those seven in one dedicated commit, and flipped `endOfLine` to `"lf"`, which is now
meaningful: with normalization upstream, `"auto"` would only let a stray CRLF survive a formatting pass.

`.editorconfig` (4-space `[*.js]`, `end_of_line = lf`) remains the "get it right live" half, so an
editor's behaviour matches what git and prettier will enforce afterwards — it is simply no longer the
only line of defence, which is what it used to be and could not sustain.

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

| Component                | Purpose                                                                |
| ------------------------ | ---------------------------------------------------------------------- |
| `ApiClient`              | Manages API communication, emits events                                |
| `ApiBase`                | One API base: its URL, calendar index and cache                        |
| `ApiClientError`         | Error carrying url, status, statusText and body                        |
| `CalendarSelect`         | Dropdown for selecting calendars                                       |
| `ApiOptions`             | Form controls for API parameters                                       |
| `WebCalendar`            | Renders calendar as HTML table                                         |
| `LiturgyOfTheDay`        | Widget displaying today's liturgy                                      |
| `LiturgyOfAnyDay`        | Widget displaying liturgy for any selected date                        |
| `PathBuilder`            | Builds and displays API request URLs                                   |
| `CalendarResourcePicker` | Rite + filtered CalendarSelect, bundled and wired                      |
| `DayViewer`              | Complete "liturgy of any day" page in one mount                        |
| `CalendarControls`       | Rite + calendar + `ApiOptions`, wired, no renderer                     |
| `CalendarViewer`         | `CalendarControls` paired with a `WebCalendar`                         |
| `ApiExplorer`            | `CalendarControls` paired with a `PathBuilder`, never fetches          |
| `SubscriptionBuilder`    | `CalendarControls` paired with an iCal subscription URL, never fetches |

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

### How components take a wrapper

`CalendarSelect.wrapper()`, `RiteSelect.wrapper()` and `Input.wrapper()` all take an `{ as, class, id }` bag
through `src/WrapperOptions.js` — internal, and not exported from `src/index.js`, on the same reasoning as
the two validators above. `Input.wrapper()` additionally accepts the bare tag name it has always taken and
normalizes it to `{ as: tagName }`; that form is kept rather than deprecated because `DayViewer`,
`LiturgyOfAnyDay` and both example apps all pass one.

Two `Input`-only subtleties, both easy to "simplify" wrongly:

- **The one-shot guard counts explicit calls, via `#wrapperSet` — not `#hasWrapper`.** The constructor
  builds a wrapper of its own whenever `Input.setGlobalWrapper()` has been called, which
  `LiturgicalCalendarFrontend` and six examples do at module scope. Keying the guard on "a wrapper exists"
  would refuse the caller's **first** explicit `wrapper()` call on every such page, including this library's
  own call for `DayViewer`'s locale input. `CalendarSelect` has no equivalent constructor path, which is why
  its `#wrapperSet` can be simpler.
- **A bag's `class` beats `setGlobalWrapperClass()` and marks the class as set; an inherited global does
  not.** `buildWrapperElement()` knows nothing about the globals, so that precedence lives in
  `Input.wrapper()`. Leaving an inherited global unmarked is what keeps `wrapperClass()` free afterwards —
  the globals-plus-per-input-override pairing every consuming page is built on.

`setGlobalWrapper()` takes a bare tag name and must never accept an `id`: the globals apply to every `Input`
on the page, so one id would be stamped onto all of them and emit invalid HTML.

### How `ApiOptions` exposes its inputs, and what an underscore means there

Its ten form controls answer to canonical names — `epiphanyInput`, `ascensionInput`, `corpusChristiInput`,
`eternalHighPriestInput`, `holydaysOfObligationInput`, `localeInput`, `yearTypeInput`, `yearInput`,
`acceptHeaderInput`, `calendarPathInput` — **and**, unchanged, to those names with a leading underscore, the
only spelling that existed up to 2.7.0. Write the canonical form in docs, examples and new code.

- **The ten names are `API_OPTIONS_INPUT_ROLES`' keys, exactly.** That map is `theme.apiOptions`' public
  vocabulary and predates the accessors, so #62 adopted its spellings rather than minting an eleventh. Giving
  one input two public names would be worse than the single ugly one it had. `ApiOptionsPublicAccessors.test.js`
  asserts the two lists are equal, from two independently written literals.
- **The underscore forms are supported, not deprecated, and MUST NOT warn.** The library reads them itself at
  some thirty call sites (`ApiClient`, `PathBuilder`, `CalendarControls`, `DayViewer`, `ApiExplorer`,
  `SubscriptionUrl`, `SubscriptionBuilder`), so a warning would fire on the library's own behaviour before a
  consumer wrote a single underscore — and warning on the only spelling that ever existed would make every
  correct page noisy in a minor release. Those internal call sites were deliberately **not** migrated: they
  are churn against behaviour-tested code, and the aliases are permanent. `Theme.js` is the one exception,
  because its `apiOptions[ '_' + key ]` concatenation existed only for want of these names.
- **`_filter`, `_filtersSet`, `_currentEndpoint` and `_base` keep the prefix and have no canonical form**, which
  is what makes the prefix informative here. No production code outside the class reads the first two; the third is
  handed out by reference for `PathBuilder` to mutate. `_filter` could not have been aliased in any case:
  `filter()` is already the chainable setter, and `get filter()` in the same class body would replace it. The
  name to add, if a consumer ever needs it, is `currentFilter`.
- **The canonical getter is the implementation and the underscore one delegates**, so the pair cannot drift, and
  `type-fixtures/dts-consumer.ts` asserts all ten reach `dist/` at their aliases' types — a `.d.ts`-only class of
  bug `yarn test` cannot see.

`CalendarSelect._filter`/`._base`, `LiturgyOfAnyDay._yearInput` and `Input._domElement`/`._labelElement` have the
same shape and were left alone: #62 was scoped to `ApiOptions`.

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
`calendarFetchFailed` as `(error, { rite })`. Subscribe with the chainable `apiClient.on(event, listener)`,
and unsubscribe with `apiClient.off(event, listener)`, which removes that one registration and does so by
replacing the listener array rather than splicing it — a listener that unsubscribes itself while running
does not cause the next listener in the same `emit()` to be skipped. `off()` is what let `dispose()` on
the meta-components (below) become possible: without it, a component wiring `listenTo()` internally had
no way to undo that subscription later.

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

### Request coalescing

`listenTo()` attaches a `change` listener per input, and a single user action moves several of them: a rite
change makes `ApiOptions` rewrite the year floor, the calendar path, the locale options and the calendar
select, each dispatching its own `change`. Those listeners used to fetch individually, in attachment order,
while the client's own state was still half-updated — so the leading requests described the state the user
had just **left**.

They now mark the client dirty via `#scheduleRefetch()`, which runs one refetch on a microtask, built from
the state the batch settled on. A microtask is the right horizon because every dispatch in the batch is
synchronous (`dispatchEvent( new Event( 'change' ) )` in both `ApiOptions` and `CalendarSelect`), so the
whole burst has landed and nothing beyond the current turn is swallowed.

**Only the listener path coalesces.** `fetchCalendar()`, `fetchNationalCalendar()`,
`fetchDiocesanCalendar()` and `refetchCalendarData()` stay immediate, so consumers holding those promises —
`LiturgyOfAnyDay` calls `refetchCalendarData()` three times — see no timing change. This is the split every
data-fetching library draws between an automatic refetch and an explicit one; do not "unify" it by routing
the public methods through the scheduler.

This is also what removed a visible flicker, and the reason it could not be fixed by filtering instead.
`#requestRevision` drops a superseded response before the `calendarFetched` emit, but a wasted request
answered **from cache** emits synchronously, at an instant when it _is_ the newest revision — so the guard
has nothing to catch, and the wasted requests were the ones most likely to be cached. The waste had to be
removed at the source. `#requestRevision` still earns its place for the remaining overlap: a user acting
again before the previous response lands.

Requests are not aborted when superseded. That was weighed and declined: after coalescing the overlap is
small, the response is already ignored, and letting it land populates the cache. Tests that drive an input
programmatically must `await Promise.resolve()` before asserting on `fetch`. See
`src/__tests__/ApiClientRequestCoalescing.test.js`, whose last test is what keeps coalescing from swallowing
a second, genuine user action.

### Deprecated Methods

The following methods are deprecated and will show console warnings:

| Deprecated      | Use Instead  |
| --------------- | ------------ |
| `setYear()`     | `year()`     |
| `setYearType()` | `yearType()` |

## Meta-Components

Five components in `src/MetaComponents/` — `CalendarResourcePicker`, `DayViewer`, `CalendarControls`,
`CalendarViewer` and `ApiExplorer` — bundle a fixed, tested wiring of the library's existing components
behind a single mount call. They exist because several `LiturgicalCalendarFrontend` call sites were
re-deriving the same wiring by hand — including its ordering requirements and its silent-failure traps
(see "Rite Wiring" above) — and the library is a better place for that logic than every consumer's own
code. The library owns wiring, ordering, failure behaviour and defaults; it ships nothing
framework-specific and takes no position on CSS.

`CalendarControls` bundles a `RiteSelect`, a `CalendarSelect` and an `ApiOptions`, wired to one another and
(via `listenTo()`) to an `ApiClient` — with no renderer. `CalendarViewer` is `CalendarControls` plus a
`WebCalendar`; `ApiExplorer` is `CalendarControls`' construction plus a `PathBuilder`, with `listenTo()`
never called so it never fetches. The renderer was kept out of `CalendarControls` itself because a fourth,
unbundled consumer (`LiturgicalCalendarFrontend`'s FullCalendar-based page) renders with FullCalendar
instead of `WebCalendar` — bundling `WebCalendar` into the shared wiring would have excluded it.

Full documentation, including worked examples, lives in `docs/meta-components.md` — this section
summarizes the contract points that a change to any of the five must not violate.

**The theme bag's role vocabulary.** All five take an optional `theme` option written in HTML roles
(`select`, `input`, `label`, `wrapper`), never framework names, plus per-child override keys named for the
component's own public getters (e.g. `riteSelect`, `calendarSelect`). Resolution is per-key and most
specific first: a per-child override supplies whichever keys it names, and every key it does not name
falls back to the flat default. `src/MetaComponents/Theme.js` is the shared resolver every one of them
calls — it is internal and deliberately **not exported** from `src/index.js`, the same as
`LocaleValidation.js` and `OptionsValidation.js`.

**`apiOptions` is the one NESTED key, and the only one, deliberately.** It carries the same four flat role
keys for a whole `ApiOptions` form plus per-input overrides named for `ApiOptions`' canonical accessors
(`epiphanyInput` … `calendarPathInput`; `yearInput` alone takes the `input` role) — these ten spellings came
first, and #62 took them as the accessor names rather than minting an eleventh vocabulary. It
is what removed the last reason a consumer had to call the process-wide `Input.setGlobal*` setters, which
the theme bag exists to replace. Four things about it are load-bearing and easy to undo by accident:

- **It is an OPT-IN GATE.** While the key is absent, the flat keys reach `riteSelect`, `calendarSelect`
  and `localeInput` and no further — exactly 2.7.0's behaviour. Do not "simplify" this into letting the
  flat keys always cascade into the form: that would restyle every existing consumer's page in a minor
  release, and would consume `Input.wrapper()`'s one-shot allowance on ten inputs at construction time, so
  the `setGlobalWrapperClass()`-plus-per-input-`wrapperClass()` pairing those pages are built on would
  start throwing. Widening the gate later is backward compatible; closing it again is not.
- **`theme.localeInput` is a TIER, not a rival path.** It shipped as public API in 2.7.0 and still works.
  Precedence, per key: `theme.apiOptions[ input ]` > `theme.localeInput` (that input only) >
  `theme.apiOptions` flat > outer flat. One resolver, four layers; nothing merges twice.
- **`assertTheme()` catches typos at the new depth too**, both for a key inside `apiOptions` and for a key
  inside a per-input override, AND it rejects any of the other nine input names written at the top level,
  pointing at the nested spelling. The per-input check is deliberately STRICTER than the two-level one,
  because the role is known there. Silently dropping an unrecognised key is the exact failure mode issue
  #43 was filed about, and shipping ten names that work nested while one of them also works at the top
  level is what would otherwise have made that misplacement easy to write.
- **Every one of the ten inputs is themed regardless of `filter`.** They all exist; `filter` decides only
  which are appended. Theming one the filter hides must stay inert rather than throwing.

**A `preset` names the role-to-class mapping instead of writing it out, and it is a bounded exception to
"takes no position on CSS" (#67).** `theme: 'bootstrap5'` and `theme: { preset: 'bootstrap5', … }` are the
same call; `bootstrap4`/`bootstrap5` are the two names, exported as `ThemePreset` from `src/index.js`
while the class table in `src/MetaComponents/ThemePresets.js` stays internal — the names are public API,
the strings must stay free to change in a patch release, and both live in one file so they cannot drift.
Six points are load-bearing:

- **Expansion lives in `Theme.js`, at all four entry points that take a raw bag** (`assertTheme()`,
  `narrowTheme()`, `resolveChildTheme()`, `resolveApiOptionsInputTheme()`), never at the six components'
  call sites. That is what keeps every meta-component file unchanged — each holds its `theme` local
  exactly as the caller wrote it — and it is what makes an unknown preset throw on **every** path rather
  than on whichever runs first. `assertTheme()` does precede the resolvers in all six constructors today;
  relying on that is the ordering assumption that has silently disabled a check here before, and it costs
  one moved line to break.
- **`assertTheme()` expands BEFORE validating**, so what a preset emits goes through the same
  `THEME_CHILD_KEYS` check a caller's key does. A preset emitting a key some component does not accept
  fails loudly rather than being dropped. `MetaComponentThemePresets.test.js` asserts this for every
  (preset, component) pair, and it is mutation-verified.
- **A preset opens the `theme.apiOptions` gate, deliberately.** It injects `apiOptions: {}` and nothing
  more; the existing four tiers then carry its flat keys down as tier 4. The gate exists so no bag written
  before that key restyles a form on upgrade, and `preset` is a key no such bag contains — while #67's own
  stated purpose is that a preset stopping short of the form would leave the ten inputs to the
  `Input.setGlobal*` setters. Whether to inject is read from `THEME_CHILD_KEYS`, never a second list, so
  `CalendarResourcePicker` gets no such key.
- **A preset supplies no `wrapper`, and that is what makes the point above safe.** The gate's other
  justification is that a flat wrapper consumes `Input.wrapper()`'s one-shot allowance on ten inputs. It
  is also why only ONE of the two Bootstrap differences #67 names is covered: `.form-select` is a class
  BS5 introduced, `col col-md-N` versus `col-md-N` is a sub-breakpoint layout choice with no renaming
  behind it. Do not "complete" the preset by adding a wrapper class.
- **`bootstrap4` emits no `label`.** `.form-label` is a BS5 class; BS4 form labels carry none. Adding one
  for symmetry would be inventing CSS.
- **A bare string `theme` is a preset name**, which is purely additive — a string was previously rejected
  by `assertPlainOptions()`. It cannot collide with the per-child string form (`{ class }`), which is one
  level down.
- **`preset: undefined` means no preset**, per the library-wide nullish rule, and does not open the gate —
  hence `namesThemePreset()` beside `hasThemePreset()`. The two differ on that one input and both are
  needed: the bag must still reach the expansion so the dead key is stripped before `assertTheme()`'s
  unknown-key check, while the gate must stay shut. An empty string still throws; supplied-and-invalid is
  not absent.

**A flat class reaches CONTROLS only, since #67.** `collectFlatDefaults()` read
`CLASS_KEY_BY_ROLE[ role ] ?? 'select'`, so the two roles with no entry — `liturgy`, and the `url` role
`SubscriptionBuilder` now passes — inherited `theme.select` and got a `<select>`'s styling on a
`LiturgyOfAnyDay` card and on a copy `<button>`. The fallback is gone; `label`/`wrapper` are gated on the
role's own key list for the same reason. This was a prerequisite, not a tidy-up: the preset is unusable on
those two components otherwise. It IS a behaviour change for a bag writing a flat `select` on either, and
the per-child `class` is how both are styled.

**Theme keys are validated PER COMPONENT, and the forwarding boundary owns its own attribution (#78).**
`THEME_CHILD_KEYS` in `Theme.js` maps each of the six theme-taking components to the child keys it
actually resolves, and `assertTheme()` looks its allowed set up by the `componentName` it is already
given — so the name and the set cannot disagree, which a third `childKeys` argument would have left a
call site free to get wrong at exactly the boundary where the second half of #78 went wrong. An
unregistered name throws rather than falling back to the old permissive behaviour, which would silently
restore the bug. `theme.apiOptions` on a `CalendarResourcePicker`, or `theme.liturgy` on a
`CalendarViewer`, now throw naming the component, the key, the keys that component does accept and the
components the key IS valid on, instead of being accepted and dropped by `resolveChildTheme()`. Two
consequences a change here must preserve:

- **`CalendarViewer`, `ApiExplorer` and `SubscriptionBuilder` validate under their OWN names before
  forwarding** — PR #76's shape for the `inputs` bag, applied to `theme` — and forward
  `narrowTheme( theme, 'CalendarControls' )`, which keeps the flat keys and drops the outer component's
  own child keys. Without the narrowing, `SubscriptionBuilder`'s legitimate `subscriptionUrl` would be
  rejected by a class that has never heard of it; widening `CalendarControls`' own set instead would
  re-admit that key on a bare `CalendarControls` and reopen the hole. All three narrow, not only the one
  whose set differs today, so the rule holds if either of the other two gains a themed child.
- **What is deliberately NOT validated is whether the current `filter` renders a themed `ApiOptions`
  input.** All ten exist regardless, so theming a hidden one stays inert — see the last bullet above.

Adding a themed child to a meta-component means adding its key to `THEME_CHILD_KEYS`, or the bag will
reject the very key the new child reads.

`applyApiOptionsTheme()` is the single application helper — `CalendarControls` and `DayViewer` each call
it once, and `CalendarViewer`/`ApiExplorer`/`SubscriptionBuilder` inherit it through `CalendarControls`.
It reuses `resolveWrapperBag()` rather than re-inlining the type-vs-class reconciliation, for the reason
that helper's own doc comment gives.

**`mountInto()` versus the constructor.** Like every component in this library, each meta-component has a
synchronous constructor — usable when an `ApiBase` is already known to be ready, paired with an
`appendTo()` — plus a static async `mountInto()`, which resolves the target(s), constructs the component
and mounts it. **What those two take differs by component, and the difference is load-bearing.**
`CalendarResourcePicker` and `DayViewer` take a single target. `CalendarControls` takes either a single
target or a `{ controls, messages }` slots object. `CalendarViewer` and `ApiExplorer` take a slots object
**only** — `{ controls, calendar, messages? }` and `{ pathBuilder, basePath?, allPaths?, riteSelect?,
builder? }` respectively — and reject a bare target, because each has more than one mandatory mount and a
lone target would have to pick one of them silently. All of them reject an unknown slot name, naming it.
Three of the five then wire an `ApiClient` and perform an
initial calendar fetch: `CalendarControls`, `CalendarViewer` and `DayViewer`. `CalendarResourcePicker`
never fetches at all — it is a form field, and has no `listenTo()` — and `ApiExplorer` deliberately
does not, because it composes request URLs rather than issuing them. `appendTo()` returns `undefined`, per the library-wide
contract: nothing can be chained off it, and its result must never be assigned.

**The `controls` slot's VALUE may be a single target or an object keyed by `ApiOptions` filter; the slot
NAMES are unchanged.** `CalendarControls` and `CalendarViewer` accept
`controls: { allCalendars: '#row1', generalRoman: '#row2' }`, which mounts one pass per filter and
replaces the two-pass `filter().appendTo()` idiom 2.5.0 documented (#63). Four points are load-bearing:

- **The filter -> inputs mapping has ONE copy**, `src/ApiOptions/FilterInputs.js`, which
  `ApiOptions.appendTo()` iterates and `src/MetaComponents/ControlSlots.js` reads for its overlap check.
  It used to be five `if` branches inside `appendTo()`; a second copy beside them would drift the first
  time a filter gained an input, and overlap cannot be computed from key names — `localeOnly` and
  `allCalendars` are different names that both mount the locale input.
  **`src/__tests__/FilterInputs.test.js` guards it with a hand-written second statement of the intent,
  not by reading the mounted DOM back.** Since `appendTo()` iterates the table, comparing the two agrees
  with itself — widen the table and the append widens with it. That comparison was meaningful for exactly
  one commit, the one that extracted the table before `appendTo()` consumed it. The literal is what makes
  widening a filter a deliberate two-place edit, which matters twice over now that the same table decides
  which meta-component layouts are accepted. The file also pins the two runtime skips, which are
  deliberately NOT in the table. Both new modules are internal and not exported from `src/index.js`, like
  `Theme.js` and `InputVisibility.js`.
- **Ordering is the component's, and canonical rather than the caller's.** `PATH_BUILDER` runs before
  `ALL_CALENDARS` so `ApiOptions`' `#pathBuilderEnabled` is set before the pass that would otherwise
  append the year input twice — the precedence `ApiExplorer.appendTo()` already hard-codes. **Do not
  overclaim what that buys.** The final DOM would match under caller order too, because
  `ApiOptions.appendTo()` MOVES: a later `PATH_BUILDER` pass just takes the year input off an earlier
  `ALL_CALENDARS` one. What the fixed order removes is the wasted append-and-move, and it is what makes
  the overlap exemption (`allCalendars` does not claim `yearInput` when `pathBuilder` is present)
  literally true rather than true only in its outcome. Pass order becomes directly observable only when
  a caller names ONE container for two filters, which is legal — and that, not the year input's
  placement, is what the ordering test asserts, because the placement alone cannot tell the two apart.
  The rite and calendar selects follow the caller's FIRST key instead: that is layout intent, not
  ordering.
- **Key spelling is the camelCase member names, with `basePath`/`allPaths` as aliases.** The enum already
  ships `BASE_PATH`/`ALL_PATHS` as alias members of exactly those two, their runtime values ARE those
  strings (so a computed `{ [ApiOptionsFilter.GENERAL_ROMAN]: t }` key must work), and `ApiExplorer`'s
  slot names are literally `basePath`/`allPaths`. Naming one filter under both spellings is rejected as a
  duplicate rather than silently collapsed.
- **`ApiExplorer` and `SubscriptionBuilder` are deliberately untouched.** `ApiExplorer` already has
  dedicated ordered slots, bypasses `CalendarControls.appendTo()` entirely, and positions its calendar
  select with `insertAfter()` rather than into a container — giving it a `controls` slot would be a new
  slot name and a second way to say one thing. `SubscriptionBuilder` mounts the three children itself
  rather than through `CalendarControls.appendTo()`. The two-pass idiom stays supported and unwarned: it
  is `ApiOptions` public API, `ApiExplorer` uses it internally, `examples/PathBuilder/` and
  `examples/RiteSelectPathBuilder/` drive a raw `ApiOptions` with it, and it is still the only way to
  reach a container the component does not own.

**Reject for programmer error, resolve for runtime failure — except where there is no form left to
resolve with.** `mountInto()` **rejects** on invalid options — an unparseable locale, an unknown filter, a
target that matches nothing — because a typo should not be silently papered over, on all five components.
Where they diverge is a runtime failure (the API down, metadata unparseable):

- `CalendarResourcePicker.mountInto()` **resolves** with a disabled, `is-invalid` select carrying
  `errorText` and `dataset.loadFailed = 'true'`, keeping the theme's marker classes so form validation and
  end-to-end test selectors still find the control.
- `DayViewer.mountInto()` **resolves** with a mounted, fully working viewer and routes the failure to
  `onError()` (or `console.error` if none was registered) — no failure control, because `DayViewer` has no
  runtime-metadata failure mode of its own beyond the one `CalendarResourcePicker` already covers through
  its child selects.
- `CalendarControls.mountInto()`, `CalendarViewer.mountInto()` and `ApiExplorer.mountInto()` **reject**
  when the metadata cannot be loaded at all, with no failure control. This is deliberate, not an
  inconsistency to "fix" into agreement with `CalendarResourcePicker`: that picker substitutes for a
  **single required form field**, where an empty slot is indistinguishable from "still loading" and a
  disabled stand-in select is a meaningful thing to render in its place. These three bundle a **whole
  form** — a `RiteSelect` and `CalendarSelect` with no calendars to list are not a smaller working form,
  they are no form at all, so there is no meaningful partial stand-in and construction is simply left to
  throw. Do not add a failure control to `CalendarControls`/`CalendarViewer`/`ApiExplorer` to match
  `CalendarResourcePicker` — the asymmetry is the correct behaviour, not a gap.

A failed initial fetch (as opposed to unloadable metadata) is a separate case and behaves the same way
across `DayViewer`, `CalendarControls` and `CalendarViewer`: **resolves** with a mounted, working
component, routing the failure to `onError()`. `CalendarViewer.mountInto()` additionally `await`s that
dropped fetch promise before resolving — `CalendarControls.mountInto()` and `DayViewer.mountInto()` do
not, and resolve immediately while the fetch keeps running — because a viewer's whole reason to exist is
its populated table, and resolving before the fetch's promise chain has run at all would hand back a
`CalendarViewer` whose table is still empty for a caller who assumed otherwise. See
`docs/meta-components.md`'s `CalendarViewer` "Reject versus resolve" section for the full reasoning; this
is a deliberate divergence, not something to reconcile by removing the `await`. `ApiExplorer` never
fetches, so it has no such case at all.

**`settled` observes a fetch; it does not report its outcome.** `mountInto()` resolves to the component and
drops the initial fetch's promise, so `CalendarControls`, `CalendarViewer` and `DayViewer` each expose a
`settled` promise that resolves once that fetch has finished. Since #61 it observes **the most recent fetch
the component issued** — the initial one, and every `fetch()` call on either construction path, each
replacing the last — so a hand-constructed instance publishes the same signal and callers need not know
which path produced the instance. It does not observe the refetches `ApiClient`'s own `listenTo()` change
listeners drive; those promises never reach the component. It **always resolves and never rejects**, with
`undefined`: a property present on every mounted instance that could reject would produce an unhandled
rejection for every caller who never reads it, which is the very trap `mountInto()` avoids by discarding.
**The normalization lives in the getter, not in `fetch()`, and that placement is load-bearing twice over.**
The getter derives a fresh `promise.then( () => {}, () => {} )` on every read, which is what makes the
contract structural: it resolves with `undefined` rather than the payload `.catch( handler )` alone passes
straight through (the bug that made `settled` a second data channel on the success path), and it cannot
reject even when an `onError()` callback throws inside a factory's rejection handler. Deriving eagerly in
`fetch()` instead would attach a handler to the very promise object handed to the caller — rejection
tracking is per promise object — silently removing the platform's unhandled-rejection report for anyone
who calls `fetch()` and ignores the result, which is the report `fetch()` relies on when it declines to
log a promise the caller holds. The cost is that `settled` is a fresh object per read, settling at the
same instant; do not "optimize" it back into a stored branch. The factories keep their `.catch( handler )`
assignment, which runs after `fetch()`'s own store and so keeps `await x.settled` ordered after
`onError()` delivery. **That handler must not be able to throw**, which is why it goes through
`Settled.js`'s `deliverFetchFailure()` rather than calling the delivery directly: the delivery invokes
consumer callbacks, and a throwing `onError()` used to reject the stored branch — making
`CalendarViewer.mountInto()` (which awaits it) reject and hand back no viewer at all, and producing on the
other two paths exactly the unhandled rejection the "never rejects" clause rules out. `normalizeSettled()`
cannot cover that second case, because it only attaches a handler when somebody actually _reads_ `settled`.
A callback that throws is still reported to the console, never swallowed. Outcomes stay with `onError()` and `onCalendarFetched()`. It
is always a promise, already resolved when nothing has been issued (`initialFetch: false`, no `apiClient`,
or a hand-constructed instance that has not fetched; a `fetch()` that throws synchronously issues nothing
and leaves it untouched). `CalendarResourcePicker` and `ApiExplorer` do not have it, because neither
fetches — the same asymmetry, on the same grounds, as their reject/resolve behaviour above. On
`CalendarViewer` it is the very promise `mountInto()` already awaits, so it has settled by the time a caller
of that factory can read it; do not remove it there on that account.

**`onSelectionChange()` publishes state consumers were deriving by hand, and `predeterminedInputs` is the
part that carries domain knowledge.** `CalendarControls.selection` reports
`{ calendarType, calendarId, predeterminedInputs }`, and `onSelectionChange( callback )` — chainable, and
released by `dispose()` — fires once per user action, on a microtask, and only when that payload changed.
Four points are load-bearing:

- **The rule has ONE copy**, `src/ApiOptions/PredeterminedInputs.js`, which
  `ApiOptions.#applyTemporalInputState()` APPLIES and `ApiOptions._predeterminedInputs` REPORTS — the same
  one-source-two-readers shape `FilterInputs.js` has for the filter -> inputs mapping. **Do not
  reconstruct it by reading `_domElement.disabled` back:** `HolydaysOfObligationInput.disabled()`
  overrides the base method and sets a `readonly` expando plus per-`<option>` flags instead of the
  element's own `disabled` property, so the one input this feature exists for would need a special case —
  a second hand-rolled copy under another name. `PredeterminedInputs.test.js` asserts the five candidates
  equal `inputKeysForFilter( ApiOptionsFilter.GENERAL_ROMAN )`, so the two lists cannot drift apart
  silently either.
- **The coalescing is `SubscriptionUrl.#scheduleNotify()`'s, and both guards earn their place.** A rite
  change dispatches on the rite select, the calendar select and several `ApiOptions` inputs within one
  synchronous burst; notifying per event would describe the state the user just left, and would read
  `predeterminedInputs` before `ApiOptions`' own listener had applied it. The dedupe against the last
  notified payload is what makes a locale or year change cost nothing, not the choice of listeners:
  measured by mutation in `CalendarControlsSelectionChange.test.js`, adding a locale-input listener leaves
  every test green.
- **It deliberately does NOT fire on subscribe**, matching `onCalendarFetched()`, `onError()` and
  `SubscriptionBuilder.onChange()`. `selection` is a synchronous, race-free read, so the initial paint is
  `paint( controls.selection ); controls.onSelectionChange( paint );` — the two lines both migrated
  examples already write. The notify loop is `forEach`, not `for...of`, so a callback registered by
  another callback does not fire inside that same flush, which would contradict exactly that rule;
  `SubscriptionUrl` and `EventEmitter.emit()` both notify this way.
- **The payload is a named typedef, `CalendarSelection` in `src/typedefs.js`, and that is not cosmetic.**
  Typed inline as `function(Object): void`, the library's OWN documented two-line recipe failed to compile
  for every TypeScript consumer (TS2345 — `Object` "is assignable to very few other types"), while
  `yarn compile` and `yarn test` stayed green: the same `.d.ts`-only blind spot as the `@readonly`-on-a-getter
  and `VERSION`-literal traps. `calendarType` is a union rather than `string` for the same reason.
  `type-fixtures/dts-consumer.ts` now compiles that exact recipe.
- **`predeterminedInputs` reports what `ApiOptions` has APPLIED**, which a `change` event is the only thing
  that updates. So unwired controls (`mountInto()` without `apiClient`) report the empty set, and a
  programmatic `CalendarSelect.value()` — which dispatches no `change`, and which `ApiClient` equally
  ignores — is not observed until a `change` is dispatched. Both are documented and pinned; do not "fix"
  them by deriving the key live from the DOM, which would make this one key react to a select the rest of
  an unwired form ignores, and could not derive the rite half at all.
- **`SubscriptionBuilder.onChange()` was weighed and left alone.** It publishes a serialized URL built from
  a `CurrentEndpoint` that also tracks year, locale, return type, rite and path, so it watches a different
  set of inputs and carries a different payload; routing it through this would either change that payload
  or make it a consumer of a mechanism that does not carry what it needs. `CalendarViewer`, `ApiExplorer`
  and `SubscriptionBuilder` reach the new API through their existing `.controls` getter, so none of them
  gains a forwarding method.

**The `inputs` bag says which `ApiOptions` inputs render, and exists so `mountInto()` can express what
only the constructor path could.** `AcceptHeaderInput.hide()` sets a flag `ApiOptions.appendTo()` reads,
so it was meaningful only between construction and the append — a window `mountInto()` does not open, which
put every real consumer on the constructor path and out of reach of `settled` (#61). `CalendarControls`,
`CalendarViewer` and `ApiExplorer` now take `inputs: { acceptHeader: boolean }`, resolved in
`CalendarControls`' constructor by `src/MetaComponents/InputVisibility.js` — internal, not exported from
`src/index.js`, like `Theme.js`. An unknown key is rejected by name, as is a non-boolean value, before
anything is mounted. `acceptHeader: true` is the default reasserted, not an un-hide: `hide()` is
irreversible. `DayViewer` and `SubscriptionBuilder` pin their `ApiOptions` to `LOCALE_ONLY` and never
render the input, so the option does not reach them. **`ApiExplorer` renders it by default and must keep
doing so** — `PathBuilder` turns that select's `change` into the composed URL's `return_type`.

**`wrapper` means a CLASS flat and a TYPE per-child, and `resolveWrapperBag()` is the only place that
reconciles them.** `resolveChildTheme()` maps the flat `theme.wrapper` onto `wrapperClass`; a per-child
`wrapper` names the element type (`OVERRIDE_KEYS_BY_ROLE` accepts it for the `select` and `input` roles).
Either alone is a complete instruction. Every meta-component used to gate its `wrapper()` call on
`wrapperClass` alone across six near-identical call sites, so a type-only theme was accepted by the
resolver, carried all the way to the call site and dropped there in silence — which is exactly how a rule
ends up honoured for some children and not others. `Theme.js`'s `resolveWrapperBag()` now returns the
`{ as, class }` bag or `null`, and seven sites call it — those six, plus `DayViewer`'s locale input, which
had the same gap; do not re-inline the check. It omits `class`
entirely rather than passing `undefined`, because `Input.wrapper()` rejects a non-string class **and**
treats a class named in the bag as final, closing `wrapperClass()` afterwards.

`DayViewer`'s `dateControls` block is deliberately not routed through it: that path feeds a config bag to
`LiturgyOfAnyDay`'s `dayInputConfig()`/`monthInputConfig()`/`yearInputConfig()`, which call `wrapper()` and
`wrapperClass()` separately, and already handles both keys.

**`dispose()` is incomplete, and the docs say so.** Every one of the five has an idempotent `dispose()` —
calling it twice is safe, and further use of a disposed instance throws rather than failing quietly. What
it releases: every listener the meta-component itself attached, plus (for the four that fetch) the
subscriptions made through `onError()`/`onCalendarFetched()`/`listenTo()`, unsubscribed via the
`EventEmitter.off()` described above — which had to exist before `dispose()` could be written at all. What
it does **not** and cannot release: the anonymous `change` listeners `ApiClient.listenTo()` attaches
internally to the selects it's given, and the anonymous `calendarFetched` listener
`LiturgyOfAnyDay.listenTo()`/`WebCalendar.listenTo()` attaches to the client's event bus. Neither closure
is exposed anywhere `dispose()` — or even `ApiClient` itself, for the first case — could
reach it. This is a pre-existing gap in the wired components, not something `dispose()` papers over by
claiming completeness; if a caller keeps a separate reference to the child selects and the client after
disposing, those selects can still drive fetches through that client.

**`SubscriptionBuilder` is a sixth composed component, built the same way but living outside `src/MetaComponents/`.**
It lives in `src/SubscriptionBuilder/`, not among the five above, because it pairs a `CalendarControls` with its
own private renderer (`SubscriptionUrl.js`, never exported — the same relationship `Theme.js` has to the five)
rather than reusing one of the library's existing renderers. It otherwise follows every convention documented
above: the theme bag, `mountInto()` versus the constructor, reject-for-programmer-error, and an idempotent
`dispose()` with the same documented gap around `ApiOptions`' internal listeners. Four points are specific to it:

- **It never fetches**, exactly as `ApiExplorer` never does — its constructor links the rite -> calendar chain
  directly (`apiOptions.linkToCalendarSelect().linkToRiteSelect()`) and never calls `CalendarControls.listenTo()`.
  It therefore has no `settled`, no `onError` and no `initialFetch`: all three concern a fetch this class never
  performs.
- **Both slots — `{ controls, url }` — are required.** Like `CalendarViewer` and `ApiExplorer`, this bundles more
  than one mandatory mount, so a bare target is rejected rather than silently picking one of the two.
- **The copy control's wrapper IS the `<button>` itself**, not a separate button placed beside the URL text. Do
  not "fix" this into a `<div>` wrapping a nested button: a `div[role="button"]` with no `tabindex` and no key
  handler announces a control that can be neither focused nor activated by keyboard, which is a regression this
  shape specifically avoids.
- **`return_type` is pinned to `ICS` and `explicitRite` is set to `true`.** `return_type` is what makes this a
  subscription URL rather than a JSON request, so it is set once and never wired to an input, unlike `PathBuilder`.
  `explicitRite` is needed because `CurrentEndpoint.path` otherwise omits the rite segment whenever it is Roman,
  and a subscription URL must always read `/roman` or `/ambrosian` explicitly.

Full documentation lives in `docs/meta-components.md`'s `SubscriptionBuilder` section.

### Calendar scope

A `scope` option lets a consumer declare which calendars a widget may show — the Diocese of Rome wants its
own calendar and nothing else on screen; the Italian Bishops' Conference wants Italy, with a rite switch
because Italy has an Ambrosian diocese. `scope` is a **restriction on the calendar space**, not a default
value: controls are then **derived** from it, appearing only when they have a real choice to offer, rather
than separately configured. Full reasoning lives in
`docs/superpowers/specs/2026-08-16-calendar-scope-design.md`; this section is the summary a change to any
scoped component must not violate. The resolver, `src/MetaComponents/CalendarScope.js`, is internal and not
exported from `src/index.js`, on the same reasoning as `Theme.js` and `FilterInputs.js`.

**The shape.** `scope: { rite, nation, diocese, locale, includeDioceses }`, every key optional.
`scope: undefined` and `scope: {}` both mean "no scope" — every existing code path untouched — per the
library-wide nullish rule. `includeDioceses` defaults to **`false`**: `{ nation: 'IT' }` alone means the
Italian national calendar and nothing else, one calendar, no controls. Widening to dioceses is the rarer,
more deliberate act, so it is the opt-in.

**`scope.rite` is the allowed SET, not an initial value, and takes a string or an array.** A string is a
singleton set. **The initial rite is the set's first element** — `'roman'` and `['roman']` behave
identically, and `['ambrosian', 'roman']` starts on Ambrosian. With only `roman` and `ambrosian` in `Rite`
today, `['roman', 'ambrosian']` equals omitting the key entirely, so the _restriction_ aspect of the array
form is not yet observable — only the _ordering_ is. This is deliberate future-proofing: it earns its place
the day a third rite is added, at which point `rite: ['roman', 'ambrosian']` on an Italian site would keep a
future Melkite or Ruthenian option from ever appearing.

**Which rites are in scope for a nation is DERIVED, never assumed to be all of them:**

> A rite is in scope for a nation iff that nation has a national calendar for it, **or** at least one
> diocese of it.

`{ nation: 'US' }` therefore yields Roman alone — the United States has no Ambrosian diocese — and hides the
rite select, rather than offering an Ambrosian option that leads only to the bare Ambrosian calendar with
nothing American behind it. `{ nation: 'IT' }` yields both, because Italy has an Ambrosian diocese (Milan)
even though Ambrosian has no national tier (`RiteProperties.ambrosian.hasNationalTier === false`) — a rite
lacking a national tier falls back to its rite-level stand-in calendar (the bare Ambrosian calendar) rather
than being excluded, but only where the nation has at least one diocese of it. `scope.rite` then intersects
with this derived set; an empty intersection throws at construction, naming both the requested rites and
those actually available.

**Controls are derived, and re-derivation is RUNTIME-dependent, not a mount-time constant:**

```text
riteSelect      shown iff  the scope yields > 1 rite
calendarSelect  shown iff  the scope yields > 1 calendar FOR THE CURRENT RITE
localeInput     shown iff  the CURRENT CALENDAR supports > 1 locale
```

Switching rite changes the calendar set; switching calendar changes the locale set. This is exactly the
situation `CalendarSelect._setHidden()`'s doc comment already warns about: deriving visibility from the rite
side alone leaked before, because `ApiOptions`' path builder can re-filter a select with no rite change to
re-evaluate it. Every scoped component (`CalendarControls`, `DayViewer`, `CalendarResourcePicker`,
`TodayViewer`) therefore attaches **one** `change` listener to **both** the rite select and the calendar
select — the single place a rite change and a calendar change both land — and re-derives all three flags
from there via `deriveVisibility()`, applying them with `_setHidden()`. `Input` and `RiteSelect` both gained
`_setHidden()` for this. A hidden control still holds its value and still drives the fetch — that is what
makes the Rome case work: the calendar select is hidden, and is still what tells `ApiClient` to fetch
`romamo_it`.

**The calendar select's OPTION LIST is narrowed, not merely its value.** `CalendarSelect._restrictToScope()`
rebuilds the `<option>`s from the resolved scope's calendars for the current rite, so `{ nation: 'IT',
includeDioceses: true }` offers Italy plus its Roman dioceses under Roman, and the bare Ambrosian calendar
plus Milan — but never Lugano — under Ambrosian. `_restrictToScope()` always runs before `value()` is set:
the select's own unrestricted, Roman-built default option list may not even carry the scope's actual initial
calendar id, and `value()` throws for any id no current option carries.

**The `inputs` bag gained three keys — `riteSelect`, `calendarSelect`, `localeInput` — alongside the
pre-existing `acceptHeader`, but only on `CalendarControls` and the components built from it
(`CalendarViewer`, `ApiExplorer`, `SubscriptionBuilder`).** `DayViewer`, `CalendarResourcePicker` and
`TodayViewer` build their rite and calendar selects directly rather than through `CalendarControls`, take no
`inputs` option at all, and call `deriveVisibility()` with no override argument — the derived answer is
always final on those three. The two `inputs` families that DO exist are NOT the same kind of flag. `acceptHeader` is an
irreversible `hide()` call: `true` reasserts the default rather than un-hiding. The three new keys instead
**override `deriveVisibility()`'s own derived answer, in both directions**, and carry no default of their
own — they are simply absent from the resolved bag until a caller names one, which is what lets the resolver
tell "not overridden" from "overridden to `true`". `inputs: { riteSelect: false }` on a two-rite scope does
**not** remove Ambrosian from the space; it only makes it unreachable by the user, leaving the rite at
whatever the scope resolved. `scope.rite` is the honest way to say "Roman only" — pin with `scope`, present
with `inputs`.

**`scope` combined with `ApiOptionsFilter.PATH_BUILDER` throws, in `CalendarControls`'s own constructor.**
`CalendarPathInput` composes _any_ API route the metadata allows, entirely outside `deriveVisibility()`'s
reach — a full bypass of a scope's contract, not a cosmetic gap. This was considered and rejected as a thing
to make `CalendarPathInput` scope-aware instead: composing an unrestricted route is that input's entire
reason to exist. **The practical consequence is that `ApiExplorer` cannot take a `scope` at all — but not
through that `CalendarControls` guard.** `ApiExplorer` rejects `scope` in **its own constructor** instead,
because `CalendarControls`' scope+`PATH_BUILDER` guard reads the `filter` given to ITS constructor, and
`ApiExplorer.appendTo()` applies `PATH_BUILDER` to `#controls.apiOptions` only AFTER construction (see the
three-filter layout doc comment there) — so a `scope` forwarded into the `CalendarControls` `ApiExplorer`
builds would sail straight past that guard, never throw, and ship a scoped `RiteSelect`/`CalendarSelect`
beside an unscoped `CalendarPathInput` that still composes any route the metadata allows. `ApiExplorer`'s own
constructor check is what actually closes that hole; leaving it to `CalendarControls` would not. `CalendarViewer`
and `SubscriptionBuilder` build a `CalendarControls` too, but never render `PATH_BUILDER`, so both inherit
`scope` cleanly through the `CalendarControls` guard as documented. (An earlier draft of the design claimed
`ApiExplorer` inherits scope "for free" the same way; that claim was wrong and has been corrected in the
spec file.)

**A scoped `CalendarResourcePicker` narrows its own rites to whatever its `filter` can actually surface, and
throws only when the scope DEMANDS a rite the filter cannot show.** Under
`CalendarSelectFilter.NATIONAL_CALENDARS` there is no rite select and no national calendar for a rite with
no national tier, so `CalendarResourcePicker.#narrowScopeToNationalTier()` drops Ambrosian from a resolved
scope's rites _silently_ when the scope only **permitted** it (`{ nation: 'IT' }` — Italy's Ambrosian diocese
was never reachable through this filter regardless of scope). It throws instead whenever narrowing leaves
NOTHING reachable — which is not only when `scope.rite` pinned the rite explicitly. A `scope.diocese` demands
its rite just as effectively: `resolveScope()` derives `rites` from the diocese's own rite and never consults
`rawScope.rite` at all, so `{ diocese: 'milano_it' }` (an Ambrosian diocese) reaches the guard having never
set `scope.rite`, yet must throw exactly as `{ rite: 'ambrosian' }` does — silently substituting a different
rite for one the caller asked for, explicitly or by naming a diocese, would be exactly the silent-narrowing
failure this component exists to avoid (issue #43). The thrown message names whichever of `scope.rite` or
`scope.diocese` the caller actually wrote, rather than misreporting a diocese scope as a `rite` pin.
`DayViewer` and `TodayViewer` have no such narrowing: both build their own `RiteSelect`, so every rite the
scope resolves is genuinely reachable.

**`TodayViewer`** is a new meta-component, sibling to `DayViewer`, wrapping `LiturgyOfTheDay` — the name
carries the whole distinction: `DayViewer` renders any day and owns day/month/year date controls;
`TodayViewer` always renders today and has no date controls at all. It otherwise follows every existing
meta-component convention (synchronous constructor plus static async `mountInto()`, `appendTo()` returning
`undefined`, `settled`, `onError()`/`onCalendarFetched()`, an idempotent `dispose()`, the theme bag, and its
own scope wiring identical in shape to `DayViewer`'s). It has **no `announceUpdates` option of its own** —
the wrapped `LiturgyOfTheDay` is exposed via a `liturgy` getter, so a consumer writes
`viewer.liturgy.announceUpdates( false )`, the same pattern `CalendarViewer.webCalendar` and
`DayViewer.liturgy` already use.

**`LiturgyOfTheDay` prerequisite fix, landed alongside this feature.** It used to _append_ on every
`calendarFetched`, so a second fetch duplicated the day's events rather than replacing them — harmless while
nothing could trigger a refetch on this component, but `TodayViewer` can, the moment a scope leaves a rite or
calendar select on screen. `#updateEventDetails()` now calls `replaceChildren()` before appending. It also
gained the same visually-hidden `role="status"` live region `WebCalendar` and `LiturgyOfAnyDay` already have,
through `LiveAnnouncer.js`, with the same `announceUpdates` option (default `true`) and the same
silent-first-render rule — withheld before only because "updated" would have misdescribed a duplication bug,
so removing the cause removed the reason. A stray `console.log` left over from development was also removed.
Both are recorded as **behaviour changes** in the CHANGELOG, not slid in as an invisible fix.

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
- `ThemePreset` - BOOTSTRAP_4, BOOTSTRAP_5 (defined in `src/MetaComponents/ThemePresets.js`, not
  `Enums.js`, so its names and its internal class table cannot drift)

## Internationalization

`Messages.js` holds 84 locale blocks, unevenly populated: not every key exists in every block. Newer keys —
`COPY_TO_CLIPBOARD`/`COPIED_TO_CLIPBOARD` for `SubscriptionUrl`'s copy control, and the six `ApiOptions`
input labels added for #59 (`YEAR_TYPE`, `EPIPHANY`, `ASCENSION`, `CORPUS_CHRISTI`, `ETERNAL_HIGH_PRIEST`,
`HOLYDAYS_OF_OBLIGATION`) — are present in exactly twelve of the 84, the same twelve that carry
`SELECT_A_RITE`. Every other locale reaches English through a fallback, so an unpopulated block degrades to
English for that key rather than throwing.

**`src/MessageLookup.js`'s `message( key, locale )` is the one place that fallback lives.** It is internal and
not exported from `src/index.js`, on the same reasoning as `LocaleValidation.js`, `OptionsValidation.js` and
`WrapperOptions.js`. It takes an `Intl.Locale`, a locale tag string (`'it'`, `'it-IT'` and `'it_IT'` alike,
since a string goes through `toIntlLocale()` rather than a bare `new Intl.Locale()`) or `null`/`undefined` for
"not supplied", and returns the English message when the catalogue has no block for the language, or a block
without the key. Two things it does **not** do, both deliberate:

- **It does not warn.** A sparse block is the documented normal case, not an anomaly — the twelve-locale keys
  above mean a warning would fire for 72 working locales, once per input constructed, and would start logging
  on four paths that already fell back silently. Coverage is asserted instead, for the keys that are only
  partly translated, in `src/__tests__/Messages.test.js`.
- **It does not tolerate a key missing from English**, which it throws on by name. A key is a string literal in
  the source, so one absent from English is a typo broken in every locale rather than a translation gap, and
  failing loudly beats assigning `undefined` to a `textContent`.

This replaced the hand-written `Messages[language]?.[KEY] ?? Messages['en'][KEY]` that each call site used to
apply for itself — the shape that produced issue #69, where six sites had remembered the guard and six had
forgotten it, so `new ApiOptions( 'ceb' )` threw a bare `TypeError` naming neither the component, the locale,
nor the catalogue. Since every meta-component builds an `ApiOptions`, all six inherited that.

**#69 closed the `ApiOptions` route and #83 closed the remaining two files.** #69 left
`WebCalendar.js` and `LiturgyOfAnyDay.js` unguarded because issue #65 was already editing them, and
`src/__tests__/MessageLookup.test.js`'s scan allow-listed exactly those two — a ceiling its own comment
said #65 would lift. #65 shipped without touching those reads, at which point the ceiling had become a
permanent exemption carving two files out of a guard the other call sites obeyed. #83 routed all seven
remaining reads through `message()` and **deleted the allow-list rather than emptying it**: an empty
exemption array is an invitation to add the next file to it, so the scan now has no exemption mechanism
at all. Do not reintroduce one — a file that cannot be guarded yet is a reason to fix it, not to list it.

`LiturgyOfAnyDay`'s read is the one worth remembering, because it **looked** defended:
`Messages[ lang ][ 'LITURGY_OF_THE_DAY' ] || 'Liturgy of the Day'` guards the VALUE the second index
yields, while the throw happens at the FIRST index, before the `||` can apply. That shape is now pinned
in the scan's own self-test beside `Messages?.[lang][KEY]`, which fails the same way for the same reason.

`src/MetaComponents/` still carries a correct inline guard rather than calling `message()` — a
consolidation, not a bug — as do `WebCalendar.#captionText()`'s three caption reads, whose rite-level
lookup falls back across TWO keys (`AMBROSIAN_CALENDAR_CAPTION` then `GENERAL_ROMAN_CALENDAR_CAPTION`)
and so must not throw when English lacks the first, which is exactly what `message()` does. That scan is
a tripwire, not a proof: it is written against the shape the bug took, and its doc comment lists what it
knowingly does not see.

**Input labels are localized by the input's own constructor**, through
`src/ApiOptions/Input/InputLabels.js`'s `defaultLabelText( key, locale )` — internal, and not exported from
`src/index.js`, on the same reasoning as `LocaleValidation.js`. That layer, and not a meta-component's theming
pass, is what reaches a consumer who writes `new ApiOptions( 'it' )` with no meta-component anywhere; 2.7.0
fixed only `LocaleInput`, and only on the theming path, which such a consumer never runs. `DayInput`,
`YearInput` and `HolydaysOfObligationInput` therefore take an optional `Intl.Locale` (`null` means "not
supplied" and yields the English label; anything else non-`Intl.Locale` throws). The four keys `DAY`, `MONTH`,
`YEAR` and `LANGUAGE` are reused rather than duplicated. A theme-supplied `labelText` still wins, because all
theming is applied after construction — which is also why `Theme.js`'s `applyLocaleInputTheme()` keeps writing
the label unconditionally even though that write is now a no-op.

`defaultLabelText()` is now a one-line delegate to `message()` and is kept rather than inlined, because it
carries a rationale `message()` does not — the `null`-means-English default that is right for a **label** — and
because ten call sites read better naming what they look up. The inputs' **option** labels, which #59 left
reading `Messages[locale.language][KEY]` unguarded, go through `message()` too since #69, as do
`CalendarPathInput`'s label, `CalendarSelect`'s default label and `LiturgyOfTheDay`'s title.

## API-supplied markup

The API's `messages` array carries real markup — anchors to Vatican decrees, `<i>`/`<b>` emphasis,
highlighted `<span>`s. `src/SanitizeHtml.js`'s `sanitizeHtml()` is the one place it becomes DOM, and
`CalendarControls.#renderMessages()` is its only caller. Internal, not exported from `src/index.js`, on
the same reasoning as `LocaleValidation.js` and `MessageLookup.js`.

**"Trust the API" is not available, and that is structural rather than cautious.** The API interpolates
calendar SOURCE DATA into an href without escaping it — `'<a href="' . $metadata->url . '" …'` in
`CalendarHandler.php` and the same shape in two model classes. Those fields ARE marked `format: uri` in
`DiocesanCalendar.json`, `NationalCalendar.json` and `WiderRegionCalendar.json`, which is weaker than it
looks: JSON Schema treats `format` as an annotation rather than an assertion unless a validator opts in,
and `javascript:alert(1)` is a valid RFC 3986 URI regardless — scheme plus opaque path — so `format: uri`
does not exclude the one scheme that matters. Only a scheme allowlist does. Independently,
`ApiClient.init( url )` accepts ANY base URL and multi-base is a documented feature, so the library cannot
assume a response came from an origin the consumer trusts. Tracked API-side as Liturgical-Calendar/LiturgicalCalendarAPI#789.

Five properties are load-bearing:

- **The allowlist is CONSTRUCTIVE, not destructive.** It never adopts a parsed node: it walks the parse and
  BUILDS fresh elements in the caller's document, copying only approved attributes. A destructive
  sanitizer — parse, then remove what you dislike — lets anything it failed to think of survive, which is
  what every historical bypass is a variation on. Here nothing survives by default, which is why `on*`,
  `style`, `id` and `ping` need no enumeration. `ownerDocument` is asserted in the tests to pin this.
- **The parse goes through a `<template>`, NOT through `DOMParser`, and the difference is subresources.**
  Both mark `<script>` non-executable, so both are safe against script execution. But MDN is explicit that
  a `DOMParser` document "can download resources specified in `<iframe>` and `<img>` elements", so an
  `<img src="https://attacker.test/log?…">` in a response would hit the network at parse time — leaking
  the visitor's IP and user agent — even though the element is discarded microseconds later and never
  rendered. A `<template>`'s `content` belongs to the template contents owner document, which has no
  browsing context, so nothing in it is fetched. This is the primitive DOMPurify parses into.
  **This was got wrong on the first pass**: the original comment asserted `DOMParser` fetched nothing,
  which is the kind of confident-and-wrong security note that stops the next reader from checking.
  **jsdom cannot test it** — it performs no subresource loading at all, so a unit test passes under either
  implementation. `SanitizeHtml.test.js` therefore pins the PRIMITIVE (spying that
  `DOMParser.prototype.parseFromString` is never called), which is implementation-coupled on purpose,
  since no assertion about the output can see this. `Utils.sanitizeInput()` still uses `DOMParser` and is
  deliberately unchanged: it sanitizes CONSUMER-supplied class names and ids, not API markup.
- **`href` is validated by PARSING, never by prefix-matching.** `href.startsWith( 'javascript:' )` is
  defeated three ways, all pinned in the tests: `JaVaScRiPt:`, `java\tscript:` (the HTML parser strips
  tabs and newlines from attribute values), and leading whitespace. `new URL()` normalizes exactly as the
  browser does before navigating. Only `http:`/`https:` pass. The ORIGINAL string is written back, so a
  relative link stays relative.
- **Unknown elements are UNWRAPPED, not deleted** — the element goes, the prose stays, because a message
  is information. The exceptions in `DROPPED_ELEMENTS` are the ones whose text is not prose (`script`,
  `style`, `title`, `textarea`, `noscript`); unwrapping those would print CSS rules or JS source as
  visible copy, which is harmless but reads exactly like a sanitizer that failed. `<img>`/`<iframe>` need
  no entry — they are not allowed and have no children, so unwrapping already yields nothing.
- **It returns a `DocumentFragment`, never a string.** A string return would invite the caller to reach
  for `innerHTML`, which is the sink the function exists to remove.

**`style` is stripped even though the API emits it** on twelve highlighted spans. The library documents
that it takes no position on CSS, so an API response must not inject declarations into a consumer's page —
and CSS is not inert regardless (`background:url()` exfiltrates, `position:fixed` redresses). The `<span>`
survives, so no text is lost. If that highlight matters, the fix is a class the consumer can style, not an
inline declaration.

**`Element.setHTML()` was weighed and rejected, though it is the right long-term answer.** As of August
2026: Chrome/Edge 146+, Firefox 148+, 68% global support, and MDN still labels it "Limited availability —
not Baseline". **Safari has not implemented it in any version, on macOS or iOS.** Since every iOS browser
is WebKit-backed, adopting it would exclude every iOS user regardless of the browser they chose — not
merely users on old versions — so the floor cannot simply be raised to reach it. Feature-detecting with a
fallback was rejected on a narrower ground: jsdom implements no `setHTML`, so the native branch cannot be
covered by this suite at all, and shipping an untested path to the majority while testing the minority
path is backwards. Revisit when Safari ships and it reaches Baseline, at which point the module becomes a
one-line delegate.

**`WebCalendar`'s event-details cell is built as NODES, and deliberately does NOT use `sanitizeHtml()`.**
It previously interpolated `litevent.name`, `liturgical_year`, `color_lcl` and `common_lcl` into an HTML
string for `createContextualFragment()` — a sink that is not even resource-inert. All four are plain text
in the source data, so `textContent` says what is true; routing them through the sanitizer would have
closed the same hole while declaring those fields rich text and inviting markup into them later. **The
rule: sanitize where markup is expected and wanted (`messages`), build nodes where it is not (everything
else).** `WebCalendarEventDetails.test.js` pins both the unchanged output and the closed hole, including
the `</i>` breakout, which injects no element and so is easy to forget.

**`CalendarSelect` ESCAPES rather than building nodes, and that asymmetry is deliberate.** It interpolates
`/calendars` metadata into `<option>` strings assigned to `innerHTML`, and `nationsInnerHtml` /
`diocesesInnerHtml` are PUBLIC getters returning that markup — so rebuilding it around nodes would be a
breaking API change rather than a security fix. `escapeHtml()` (also in `SanitizeHtml.js`) is applied at
the three interpolation sites instead. **The distinction to keep: `sanitizeHtml()` where markup is wanted
and must be filtered, node-building where it is not, `escapeHtml()` only where a public string API forces
the string to stay.** Escaping is correct for text and QUOTED attributes only — never for an unquoted
attribute, a `javascript:`-capable one such as `href`, or anything inside `<script>`/`<style>`.

Two findings there are worth not re-deriving. The `value="…"` breakout was the real vector: an unescaped
`"` in `calendar_id` ends the attribute and the rest is parsed as further attributes on a tag the parser
already accepts, which is why it survives the "in select" insertion mode that discards most injected
ELEMENTS. The `<optgroup label="…">` was NOT reachable: the nation code passes through
`Intl.DisplayNames.of()`, which throws `RangeError` for a malformed region code and returns a localized
display name otherwise, so nothing capable of ending the attribute gets through. It is escaped anyway,
since that safety belongs to a platform API's argument validation rather than to this component.
`escapeHtml()` is therefore unit-tested directly, not only through the component.

**Known rough edge, not security:** an invalid nation code in metadata surfaces as a bare
`RangeError: invalid_argument` from inside `Intl`, where the sibling inconsistency (a diocese whose nation
has no national calendar) gets an explicit message naming the component and the value.

`Input.labelAfter()` and `CalendarSelect.after()` also use `createContextualFragment()`, but on
CONSUMER-supplied strings — that is their documented purpose and not the same boundary.

## Live-region announcements

`WebCalendar` and `LiturgyOfAnyDay` each own a visually-hidden `role="status"` / `aria-live="polite"` /
`aria-atomic="true"` region and announce a **short summary** — never their content — whenever they replace it.
`announceUpdates` (constructor option and chainable setter, default `true`) turns it off. Six points are
load-bearing:

- **Default on.** An accessibility fix that is off by default fixes nobody: the consumers who need it are the
  least likely to know the option exists. The opt-out exists for a page that already owns a live region for
  this content and would otherwise announce it twice. A boolean rather than a bag, because the wording is
  already localized through `Messages`; widening it later is backward compatible.
- **The first render is silent**, and "first" is per REGION, not per instance. It is the page loading, not a
  user action, and a region firing then talks over whatever else is being announced. It is also the render
  that MOUNTS the region, and a live region has to be in the DOM before its content changes to be announced
  at all — so skipping it is not merely manners. That is why `#hasRendered` is reset wherever a region is
  detached or replaced: `WebCalendar.dispose()`, and `announceUpdates( true )` after a `( false )` on either
  component. Both rebuild or re-insert the region, so the render that does so has to be silent again.
- **`WebCalendar`'s region must survive the table swap.** Its `calendarFetched` handler used
  `replaceChildren( table )`, which would take the region with it; `#swapIn()` removes every child except the
  region instead, then inserts the table before it. Do not "simplify" that back into `replaceChildren()` — a
  region that is removed and re-inserted is not reliably announced. With announcements off the two are
  equivalent, including clearing the consumer's placeholder content.
- **`WebCalendar` announces the caption's own string**, via `#captionText()`, extracted from `buildTable()`
  for exactly that reason. Deriving the calendar's name a second time would mean a second set of translations
  free to drift from the captions. It is called even when `removeCaption( true )` hides the element.
- **`LiturgyOfAnyDay` renders twice for one year change** — once from the cached payload, once from the
  refetch — so `#refetchPending` keeps the first, stale one silent. This is the ONE path where coalescing
  does not already give one render per action; `src/__tests__/AnnouncementFrequency.test.js` confirms the
  `ApiClient` path does, by counting announcements through real `change` events rather than assuming.
- **No meta-component option.** `CalendarViewer` and `DayViewer` expose the child, so
  `viewer.webCalendar.announceUpdates( false )` reaches it without a further key in their option bags.

`src/MessageFormat.js` is where a `Messages` key with `{placeholders}` is resolved, interpolated and — via
`Intl.PluralRules`, with only `_ONE`/`_OTHER` populated — pluralized. Internal, like `LocaleValidation.js`.
The three caption sites in `WebCalendar.js` still inline the same regex; converting them is a refactor for
its own change. `src/LiveAnnouncer.js` owns the hidden-region markup, shared with `SubscriptionUrl`, and holds
no policy about **when** to announce — that belongs to each caller, since `SubscriptionUrl` must announce on
its first use while the two renderers must not.

Two known gaps, both recorded rather than papered over: `LiturgyOfAnyDay`'s announcement names the date and
not the calendar, so changing only the calendar or the rite leaves the text identical and a screen reader may
not repeat it; and `LiturgyOfAnyDay.listenTo()` — unlike `WebCalendar.listenTo()` — does not release a
previous subscription, so calling it twice announces twice per fetch. Both predate or fall outside #65.

`LiturgyOfTheDay` has no region, deliberately: `#updateEventDetails()` appends without clearing, so a second
fetch duplicates rather than replaces, and "updated" would misdescribe that. Fixing the duplication is a
separate defect.

**The tests are structural.** jsdom has no accessibility tree and no assistive technology, so nothing in
`WebCalendarAnnouncements.test.js`, `LiturgyOfAnyDayAnnouncements.test.js` or `AnnouncementFrequency.test.js`
proves a screen reader speaks. They prove the markup is present, correctly attributed, stable across a
re-render, and written exactly once per action. Verifying the announcement itself needs a real browser and a
real screen reader.

## Important Notes

- **No build step for production** - Components work as-is with ES6 module imports
- **API dependency** - Components require access to Liturgical Calendar API
- **Default API URL** - `https://litcal.johnromanodorazio.com/api/dev`
- **Browser support** - Browsers with ES2022 support (see the Target section under Code Standards): Chrome/Edge 94+, Firefox 93+, Safari 15.4+. ES6 module support alone is not sufficient
- **Version** - `VERSION` is exported from `src/index.js` so a page can report which build it is running. See Releasing below: bumping a release means editing **two** files

## Releasing

**A version bump is a two-file edit: `package.json` and `src/Version.js`.** Forgetting the second is not
silent — `src/__tests__/Version.test.js` reads `package.json` off disk and fails on drift, which is the
whole point of the arrangement: the failure #64 described was a version claim nobody could trust, so an
untrue claim has to be loud rather than merely wrong.

The constant is hand-maintained rather than generated, and the two obvious alternatives were both measured
and rejected:

- **A build-time generator** would have to write into `src/`, because `dist/` is gitignored. The result is
  either committed (identical to what exists now, plus a generator to maintain) or gitignored (breaking
  `yarn test` and `yarn storybook` on a fresh clone, before a first `yarn compile`). `compile:watch` also
  cannot regenerate on a `package.json` change, so the watch build would drift exactly where a developer is
  least likely to look.
- **Importing `package.json` with `with { type: 'json' }`** does not survive the emit: `tsc` passes the
  import through **verbatim** into `dist/`, inlining nothing, so every consumer evaluates a real JSON module
  import at run time. Import attributes need Chrome 123+/Firefox 121+/Safari 17.2+/Node 20.10+, against this
  package's documented floor of Chrome 94+/Firefox 93+/Safari 15.4+/Node 16.11+.

`VERSION` carries a JSDoc `@type {string}`. **Do not remove it.** Without it `tsc` infers the `const` at its
literal type and declares `export const VERSION: "2.7.0"`, which makes a consumer's version-floor check —
`VERSION === '2.8.0'`, the comparison the constant exists for — a TS2367 error rather than a boolean. This is
the same class of `.d.ts`-only bug as the `@readonly`-on-a-getter trap: invisible to `yarn compile`, because
`checkJs` is off, and invisible to `yarn lint:dts` on its own, because a narrowed literal is perfectly valid
TypeScript.

`type-fixtures/dts-consumer.ts` is what actually enforces it. **This is the general home for compile-time
assertions about the emitted declarations** — things no runtime test can reach, because they are properties of
the `.d.ts` rather than of any value. `tsconfig.dts-check.json` lists it alongside `dist/index.d.ts`, so it is
checked against `dist/` the way a consumer's own `tsconfig.json` would check it, and `tsconfig.json` — which
includes only `./src/**/*` and excludes `**/*.ts` — cannot pull it into the build. Run `yarn compile` before
`yarn lint:dts`: the fixture imports from `dist/`, which `lint:dts` checks but does not rebuild.

The `VERSION` assertion there is written as an assignment (`const x: typeof VERSION = '' as string`) rather
than as the version-floor comparison it protects. The comparison only errors while its literal differs from
the current version, so it would go quiet the moment someone bumped the package to the very version being
compared against — silently retiring the guard. The assignment fails for any literal type, so it stays honest
across releases.

There is deliberately no `ApiClient.version`. `ApiClient` and `ApiBase` deal in the API's own versioned base
URLs (`/api/dev`), so a `version` on the client would read as the API's version rather than this package's.
The bare `VERSION` export carries the package name at its import site, which is the disambiguation a static
property would lack.

### What ships in the tarball

**`package.json`'s `files` array is an ALLOWLIST, and there is no `.npmignore`.** The denylist it replaced
(#37, #38) shipped whatever nobody thought to exclude: `tsconfig.dts-check.json` and `debug-storybook.log`
reached the published 2.0.0, and by the time #38 was acted on four more root entries had joined them —
`.claude/settings.local.json`, `.serena/project.yml`, `.gitattributes` and `type-fixtures/dts-consumer.ts`.
Every one was a file added after the denylist was last audited, which is the point: a denylist fails open,
recurs on its own, and is visible only to someone who thinks to run `npm pack --dry-run`. `.npmignore` was
deleted outright rather than kept for the `src/` carve-outs, which `files` expresses as negated entries —
two mechanisms describing one boundary is how the original confusion started.

Four things about the array are load-bearing, and two of them are surprises rather than conventions:

- **`src/` must stay.** `tsconfig.json` sets `declarationMap: true` and every `.d.ts.map` in `dist/` points
  at `../src/<name>.js`, which is what gives a consumer "Go to Definition" into the real source instead of a
  `.d.ts` stub. Dropping it degrades every consumer's editor and raises no error anywhere.
- **`dist/` is GITIGNORED and ships only because `files` outranks `.gitignore`.** Verified against npm
  11.18.0. Reverse that precedence and the package publishes with no code in it.
- **`CHANGELOG.md` is NOT on npm's always-included list** — only `package.json`, `README.md` and `LICENSE`
  are — so it ships only because it is named explicitly. Also verified rather than assumed; #38 flagged it
  as the entry most likely to be dropped as redundant.
- **The negated `!src/stories/`, `!src/__tests__/`, `!src/__fixtures__/` entries** are what keep the test
  tree out. Negation inside `files` is what made deleting `.npmignore` possible.

`src/__tests__/PackageManifest.test.js` pins these by asking `npm pack --dry-run --json` what it would
actually ship. It deliberately does NOT pin the full 232-path manifest: that would need regenerating for
every new source file, and a check that is noisy on ordinary work stops being read. It asserts the
top-level entry set exactly (which is what catches a stray), that the entry points are present, that
`src/*.js` and `dist/*.d.ts.map` counts match (which states the dependency making `src/` non-optional
without pinning a number), and that no test tree leaked. It runs under `yarn test`, so CI already covers
it with no extra workflow step.

**It needs `yarn compile` to have run first**, exactly as `yarn lint:dts` does and for the same reason:
`dist/` is gitignored, so a fresh clone has none. It fails with that instruction by name rather than
skipping — a skip would let the guard pass vacuously the day a change dropped the compile step from CI,
which is precisely when it should object — and rather than compiling for itself, which would make every
`yarn test` pay for a full `tsc` and make the file something other than a test.

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

### Rite Wiring

A `RiteSelect` is inert on its own, and on a fetching page it takes **two** wires, because two different
consumers act on a rite change:

```javascript
apiOptions.linkToCalendarSelect(calendarSelect).linkToRiteSelect(riteSelect);
apiClient.listenTo(calendarSelect).listenTo(riteSelect).listenTo(apiOptions);
```

`ApiOptions` rebuilds the calendar list, disables the temporal options the rite fixes, and adjusts the year
floor. Only the **client** turns the rite into a path segment. Wire just the first and the failure is silent:
the form reads `ambrosian` while every request still goes to `/calendar/roman/`.

`linkToRiteSelect()` is chainable and may be called before or after `linkToCalendarSelect()` — whichever
arrives second completes the pairing. Passing the rite select as a **second argument** to
`linkToCalendarSelect()` is deprecated and warns: it did the same thing, but read as if it were the whole
wiring.

A page that only renders a form, with no `ApiClient`, needs no second wire — use
`CalendarSelect.linkToRiteSelect()` directly, which works for any filter.

**A rite change SETS the five settings inputs, not only disables four of them, and the two halves of
that rule are not the same rule.** `#applyTemporalInputState()` disables; `#applyRiteToTemporalInputs()`
(called from `applyRite()` immediately before it) applies the rite's own `settings` block, which the API
publishes under `ambrosian_calendars[0]`. Before #70 nothing ever set them, so selecting Italy and then
switching to Ambrosian left a greyed-out select reading `SUNDAY` for a feast the Missal fixes to
Thursday — and, worse, left `ApiClient.#params` carrying that `SUNDAY` into the `/calendar/ambrosian`
request body, since the client learns those five parameters only from `change` listeners on the inputs.
Four points a change here must not undo:

- **The values come from `/calendars`, never from `RiteProperties`.** Putting them in `src/Enums.js`
  would ship without an API change and `minYear` is already calendar data sitting there, but it copies
  liturgical law into the client where it drifts from the API in silence.
- **A rite that publishes no settings changes no VALUE.** The Roman rite has no `roman_calendars` key at
  all, so `ApiBase.riteCalendars( 'roman' )` returns `[]` and this is a no-op on every Roman page.
  "Absent" is not "empty", and blanking here would break every one of them.
- **Holy days of obligation follow the LOCALE input's rule, not the four values' rule.** They are an
  option list the rite defines rather than a value drawn from a fixed list, so the list is replaced when
  the rite publishes one and restored to `HolydaysOfObligationInput.BASE_OPTIONS` when it does not.
  Leaving it alone for the Roman rite is what would carry `Circoncisione`, `StAmbrose` and
  `DedicationDuomo` out of an Ambrosian form and into a General Roman Calendar one. That replacement
  needs `setOptions( list, false )`: the merging default is right for a **nation** (every national list
  the API serves names all ten base keys) and wrong for a **rite**, whose list omits four base entries
  and adds three of its own — merging would assert `StJoseph` is an Ambrosian holy day of obligation.
- **The `change` dispatches are conditional**, on the same rule as the year clamp and the locale rebuild
  beside them, and a published value no `<option>` carries is skipped rather than assigned — assigning
  an unmatched value to a `<select>` leaves `selectedIndex === -1` and blanks it, so API drift has to
  degrade to "unchanged", never to "empty".

`src/__fixtures__/metadata.js`'s `ambrosian_calendars[0].settings` has been wrong in **both** directions
— invented before the API served it (`dab21b5` removed it), then missing after the API shipped it. Keep
it byte-identical to the live `/calendars` response, and re-check it whenever the API's metadata moves.

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
const localeOptions = apiOptions.localeInput.options();
const exactMatch = localeOptions.find(val => val === lang);
const languageMatch = localeOptions.find(val => val.split(/[-_]/)[0] === lang);
let selectedLocale = exactMatch || languageMatch || localeOptions[0] || lang;
apiOptions.localeInput.value(selectedLocale);

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

`value( val )` **throws** for any other value no option carries, naming the select and the value. That
throw sits there because it is the last place the mistake is nameable: assigning an unmatched value to a
`<select>` leaves `selectedIndex === -1` and the DOM **discards the value**, so every later reader —
`value()`, `ApiClient`'s `change` listener, `PathBuilder` — sees only `''`. `''` is exempt and must stay
exempt: `#allowNull` is `false` by default and `#applyLinkedRite()` writes `''` on every rite change, so
on most selects the documented recipe above lands on `selectedIndex === -1` deliberately.

Downstream of that, `selectedIndex === -1` is read as the rite-level calendar and never throws — the
listeners cannot distinguish it from the empty option being selected, and a throw inside a `change`
listener is swallowed by the DOM anyway. `ApiClient`, `PathBuilder`, `SubscriptionUrl` and
`CalendarControls.fetch()` all agree on this; do not "harden" one of them into throwing (issue #66).

### LocaleInput Selection Logic

When setting up LocaleInput, match the user's locale with available options:

```javascript
const localeOptions = apiOptions.localeInput.options();
// Try exact match first (e.g., "en" matches "en")
const exactMatch = localeOptions.find(val => val === userLang);
// Then try language match (e.g., "en" matches "en_US")
const languageMatch = localeOptions.find(val => val.split(/[-_]/)[0] === userLang);
// Fallback to first available option
const selectedLocale = exactMatch || languageMatch || localeOptions[0];
```
