# Meta-components phase 2: controls, viewer and explorer — design

Phase 2 of the family begun in
[phase 1](./2026-08-11-meta-components-design.md), which shipped
`CalendarResourcePicker` and `DayViewer` in 2.2.0. This spec covers three more:
`CalendarControls`, `CalendarViewer` and `ApiExplorer`.

## Problem

Phase 1 named `CalendarViewer` as "`ApiOptions` + selects + `ApiClient` + `WebCalendar` + messages".
Surveying the consumers before writing this spec showed that decomposition is wrong, and the evidence
is a fourth consumer phase 1 never catalogued.

The shared block is **form plus client wiring**, and it appears in four places — but only one of them
renders with `WebCalendar`:

| Consumer                          | Shared wiring block               | Renders via            | Fetches? |
| --------------------------------- | --------------------------------- | ---------------------- | -------- |
| `examples/javascript/main.js`     | lines 111-156                     | `WebCalendar`          | yes      |
| `examples/fullcalendar/script.js` | lines 111-156, **byte-identical** | FullCalendar           | yes      |
| `assets/js/index.js`              | lines 16-86, `PATH_BUILDER`       | `PathBuilder`          | **no**   |
| `assets/js/usage.js`              | —                                 | hand-rolled URL string | no       |

Bundling `WebCalendar` into the shared wiring would serve `main.js` and exclude
`fullcalendar/script.js`, even though the FullCalendar example needs the identical 45-line block. The
renderer is the axis of variation; the wiring is not.

Two further duplications the survey turned up:

- **Both examples reach for `apiClient._eventBus.on( 'calendarFetched', … )`** — `main.js:97`,
  `fullcalendar/script.js:156` — although `ApiClient.on()` has been public since 2.0.0
  (`src/ApiClient/ApiClient.js:1093`). The private reach was never necessary. A meta-component should
  make the supported path the obvious one.
- **Both render the messages table with byte-identical code** — `main.js:98-104`,
  `fullcalendar/script.js:182-188` — same `#LitCalMessages tbody` target, same row shape, and both
  build rows with `innerHTML` from API-supplied strings.

## Approach

Split the renderer from the wiring:

- **`CalendarControls`** — `RiteSelect` + `CalendarSelect` + `ApiOptions`, wired to an `ApiClient`,
  with **no renderer**. All four consumers can use it.
- **`CalendarViewer`** — `CalendarControls` + `WebCalendar`. A thin composition for the common case.
- **`ApiExplorer`** — `CalendarControls` + `PathBuilder`. The same core with fetching turned off.

The alternative — following phase 1's spec literally and bundling `WebCalendar` into a single
`CalendarViewer` — was rejected for the reason above: it would leave the FullCalendar example's
identical wiring hand-written, which is the exact problem this family exists to remove.

Everything phase 1 settled applies unchanged, and deliberately so: three new components in one family
must not invent a second set of rules. The theme bag and its role vocabulary; the relaxed class-name
validator; `mountInto()` rejecting on programmer error; `dispose()` idempotent, throwing on further
use, with its two documented gaps; `#assertUsable()` on every public member; `appendTo()` callable
more than once; `assertTheme()` validating nested override values.

## `CalendarControls`

New file `src/MetaComponents/CalendarControls.js`.

```javascript
const controls = await CalendarControls.mountInto('#calendarOptions', {
    locale,
    apiClient,
    filter: ApiOptionsFilter.ALL_CALENDARS,
    theme: {
        select: 'form-select',
        label: 'form-label d-block mb-1',
        wrapper: 'form-group col col-md-3',
    },
});
controls.onCalendarFetched((data) => calendar.refetchEvents());
```

### What it owns

- **The rite's two wires** — `ApiOptions.linkToRiteSelect()` for the calendar-list rebuild, and
  `ApiClient.listenTo( riteSelect )` for the path segment. This is the trap the whole family exists
  for: wire only the first and the form reads `ambrosian` while every request goes to
  `/calendar/roman/`.
- **`onCalendarFetched( cb )` and `onError( cb )`**, replacing the `_eventBus` reach in both examples.
- **The initial fetch, dispatched three ways.** `CalendarSelect` marks each option with
  `data-calendartype="national"` or `"diocesan"` (`CalendarSelect.js:369,383`), and an empty value
  means the General Roman Calendar. So the correct dispatch is empty → `fetchCalendar()`, national →
  `fetchNationalCalendar()`, diocesan → `fetchDiocesanCalendar()`.
  `fullcalendar/script.js:230-241` writes only the first two by hand, so a diocesan initial selection
  calls `fetchNationalCalendar()` with a diocese id. Nothing tests any of it.
- **Mount ordering** — the rite select is appended first so it reads first in the form.
- **An optional `messages` slot.** Named, it renders the API's `messages` array; omitted, nothing is
  rendered. It lives here rather than on `CalendarViewer` because the FullCalendar example wants it
  and will never use `CalendarViewer`. Rows are built with `textContent`, not `innerHTML`.

### Options

| Option         | Type                    | Notes                                                       |
| -------------- | ----------------------- | ----------------------------------------------------------- |
| `locale`       | `string \| Intl.Locale` | As every component; `null`/`undefined` take `'en'`.         |
| `apiClient`    | `ApiClient`             | Binds to that client's base and drives it.                  |
| `filter`       | `ApiOptionsFilter`      | Which `ApiOptions` inputs to show. Default `ALL_CALENDARS`. |
| `theme`        | `Object`                | The phase 1 theme bag, unchanged.                           |
| `initialFetch` | `boolean`               | Default `true`. `ApiExplorer` sets `false` — see below.     |
| `signal`       | `AbortSignal`           | `mountInto()` only, as phase 1.                             |

### Two deliberate non-goals

- **It does not call `Input.setGlobalInputClass()`** or its siblings. Those are process-wide
  mutations that leak onto every other component on the page; the theme bag is the scoped
  replacement. Both examples currently call them.
- **It does not absorb the jQuery `multiselect` treatment** of the holydays-of-obligation input
  (`main.js:124-137`, with its helper at `:38-44`). That is a Bootstrap-plugin concern, not a liturgy
  concern, and it stays with the consumer, reached through
  `controls.apiOptions._holydaysOfObligationInput`. This is a stated limit, not an oversight:
  `main.js` keeps roughly twenty lines because of it.

## `CalendarViewer`

New file `src/MetaComponents/CalendarViewer.js`. `CalendarControls` plus a `WebCalendar`, forwarding
a config bag and wiring `listenTo`.

```javascript
const viewer = await CalendarViewer.mountInto(
    {
        controls: '#calendarOptions',
        calendar: '#litcalWebcalendar',
        messages: '#LitCalMessages tbody',
    },
    {
        locale,
        apiClient,
        theme,
        webCalendar: {
            firstColumnGrouping: Grouping.BY_LITURGICAL_SEASON,
            psalterWeekColumn: true,
            removeHeaderRow: true,
            seasonColor: ColorAs.CSS_CLASS,
            eventColor: ColorAs.INDICATOR,
            dateFormat: DateFormat.DAY_ONLY,
            columnOrder: ColumnOrder.GRADE_FIRST,
            gradeDisplay: GradeDisplay.ABBREVIATED,
        },
    },
);
```

The `webCalendar` bag is forwarded key-by-key to the matching `WebCalendar` methods, so the component
does not need to know the enum values. `viewer.webCalendar` exposes the instance for anything the bag
does not reach.

## `ApiExplorer`

New file `src/MetaComponents/ApiExplorer.js`. `CalendarControls` plus a `PathBuilder`, and the one
composition that makes the core bend.

`assets/js/index.js` appends the **same** `ApiOptions` instance three times under three different
filters:

| Call          | Filter         | Target                       |
| ------------- | -------------- | ---------------------------- |
| `index.js:30` | `PATH_BUILDER` | `#pathBuilder`               |
| `index.js:59` | `BASE_PATH`    | `#requestParametersBasePath` |
| `index.js:60` | `ALL_PATHS`    | `#requestParametersAllPaths` |

So `ApiExplorer` takes slots mirroring that, plus `riteSelect`, plus `pathBuilder` for the builder
itself. The calendar select is positioned with `insertAfter( apiOptions._calendarPathInput )` rather
than into a container of its own, which the component reproduces.

**`ApiExplorer` never fetches.** It builds URLs; `index.js` initialises an `ApiClient` only for the
metadata its selects read. This is why `CalendarControls` needs `initialFetch: false` — the one place
the shared core bends for a composition, stated here rather than discovered mid-implementation.

Two things it does **not** absorb, staying with the consumer through getters: the per-input `id()`
calls (page-specific anchors), and the label-after tooltip nodes `index.js:73-78` splices into label
elements.

## Error handling

Phase 1's rule, with one asymmetry made explicit rather than left to look like drift.

| Kind                               | Behaviour                           |
| ---------------------------------- | ----------------------------------- |
| Invalid options, unusable target   | **Rejects**                         |
| Calendar metadata cannot be loaded | **Rejects**                         |
| A calendar _fetch_ fails           | **Resolves**; routed to `onError()` |

All three components reject when the metadata cannot load, following `DayViewer` rather than
`CalendarResourcePicker`. The picker is the exception in this family, and for a specific reason: it
substitutes for a **single required form field**, where an empty slot is indistinguishable from
"still loading" and produces an end-to-end timeout with nothing to point at. A whole form has no
equivalent — if the metadata is gone there is no meaningful partial form to render. The docs must
state this, so a later reader does not read the difference as inconsistency and "fix" it.

## Testing

Jest with jsdom, `ApiBase.fromMetadata()` and `ApiBase.reset()` in `beforeEach`, no network — as
phase 1. Three tests pin bugs that exist in the code being replaced:

1. **A rite change produces `/calendar/ambrosian/…`, not `/calendar/roman/…`.** Mutation-verified, as
   in phase 1, where this was the single most valuable artifact on the branch.
2. **An empty calendar id must not reach `fetchNationalCalendar()`.** Guarded by hand in
   `fullcalendar/script.js:230-241`, untested anywhere.
3. **A message containing markup renders as text.** Both examples build message rows with
   `innerHTML` from API-supplied strings; the library version uses `textContent`.

`yarn lint:dts` is a real gate again — three new classes enter the public type surface.

### A jest configuration fix, folded in

Add `testPathIgnorePatterns` for `.claude/` and `.worktrees/`. Jest currently has no such config, so
running `yarn test` from the repo root while a worktree exists under `.claude/worktrees/` discovers
**both** copies of every test: measured during the 2.2.0 release as 43 of 86 discovered files coming
from the worktree, producing a phantom 1818-test run. CI is unaffected — it has no worktree — but any
local run during worktree-based work silently doubles, and it already caused one incorrect
implementation report during phase 1.

## Delivery

Ships as **2.3.0**: additive, no existing component API changes.

## Non-goals

- `SubscriptionBuilder` — phase 3. It is the only member of the family that is a new feature rather
  than an extraction (`usage.js` hand-rolls a URL builder against a PHP-rendered select), and it
  carries its own design questions: the `webcal://` scheme, which parameters belong in a subscription
  URL, and ICS defaults.
- The `LiturgicalCalendarFrontend` migration. It is now **unblocked** — 2.2.0 published while phase 1
  was being finished — but it belongs in that repository with its own review cycle.
- Relaxing `Input.setGlobal*` into something scoped. The theme bag supersedes it for meta-components;
  changing the globals themselves is a separate decision.
