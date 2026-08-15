# A filter-keyed `controls` slot for `CalendarControls` and `CalendarViewer`

Issue: [#63](https://github.com/Liturgical-Calendar/liturgy-components-js/issues/63)

## Problem

2.5.0 documented a two-pass idiom for splitting a controls form across rows:

```javascript
viewer.appendTo({ controls: '#calendarOptions', calendar: '#litcalWebcalendar' });
viewer.controls.apiOptions
    .filter(ApiOptionsFilter.GENERAL_ROMAN)
    .appendTo('#generalRomanOptions');
```

It works, and both migrated examples use it, but it makes the consumer reach through the component —
`viewer.controls.apiOptions` is the same `ApiOptions` instance, and `appendTo()` **moves** rather than
copies — to lay out a form the viewer itself owns. It also rests on three rules the docs list and nothing
enforces:

1. the second pass must run **after** `appendTo()`, or it races the mount;
2. the filters must **not overlap**, or an input lands in whichever container went last;
3. `ApiOptionsFilter.NONE` **cannot participate**.

Get any wrong and the failure is silent or confusing rather than an error.

## Solution

The `controls` slot may now hold, instead of a single target, an object keyed by `ApiOptions` filter:

```javascript
viewer.appendTo({
    controls: { allCalendars: '#calendarOptions', generalRoman: '#generalRomanOptions' },
    calendar: '#litcalWebcalendar',
    messages: '#LitCalMessages tbody',
});
```

The component performs the passes itself, in an order it chooses, and validates all three rules before
mounting anything.

**A bare target keeps meaning exactly what it means today.** This widens what a slot VALUE may be; it does
not touch what the slot NAMES are, nor the reject/resolve asymmetry the family already documents.

## Decisions

### D1 — Key spelling: camelCase member names, with the enum's own two aliases

Canonical keys are the camelCase forms of the `ApiOptionsFilter` member names, as the issue writes them:

| Key            | Filter                           |
| -------------- | -------------------------------- |
| `generalRoman` | `ApiOptionsFilter.GENERAL_ROMAN` |
| `allCalendars` | `ApiOptionsFilter.ALL_CALENDARS` |
| `pathBuilder`  | `ApiOptionsFilter.PATH_BUILDER`  |
| `localeOnly`   | `ApiOptionsFilter.LOCALE_ONLY`   |
| `yearOnly`     | `ApiOptionsFilter.YEAR_ONLY`     |

`basePath` and `allPaths` are accepted as **aliases** of `generalRoman` and `allCalendars`. Three reasons,
none of them "be permissive":

- The enum itself already ships `BASE_PATH`/`ALL_PATHS` as alias members of exactly those two, and their
  runtime **values** are `'basePath'`/`'allPaths'`. Rejecting them would make
  `{ [ApiOptionsFilter.GENERAL_ROMAN]: '#x' }` — a computed key a reader would expect to work, since the
  enum value _is_ the string — throw.
- `pathBuilder`, `localeOnly` and `yearOnly` are already identical under both schemes. Only two keys
  diverge, and the enum has already named both.
- `ApiExplorer`'s existing slot names are literally `basePath` and `allPaths`. Accepting them keeps one
  vocabulary across the library.

Naming the same filter twice — `{ generalRoman: '#a', basePath: '#b' }` — is rejected as a duplicate. An
unrecognised key throws **by name**, listing the valid keys, following `assertTheme()`'s established
"not recognised, here is what is valid" shape.

### D2 — Which components take it, and why `ApiExplorer` stays clear

`CalendarViewer` forwards `{ controls: slots.controls }` verbatim to `CalendarControls.appendTo()`, so one
implementation serves both.

**`ApiExplorer` is deliberately untouched.** It already solves this problem with dedicated, ordered,
validated slots (`pathBuilder`, `basePath`, `allPaths`, `riteSelect`, `builder`), it bypasses
`CalendarControls.appendTo()` entirely, and its `pathBuilder` slot carries a relationship no filter key can
express — the calendar select is `insertAfter()`'d the calendar-path input rather than mounted into a
container of its own. Subsuming it would mean introducing a `controls` slot name it has never had, which
this change is specifically not allowed to do, and would leave two ways to say one thing on one component.
The shared vocabulary is preserved instead, via D1's aliases.

**`SubscriptionBuilder` and `DayViewer` are out of scope.** `SubscriptionBuilder` mounts the three children
itself rather than through `CalendarControls.appendTo()`, and `DayViewer` takes a single target and pins its
`ApiOptions` to `LOCALE_ONLY`, which has exactly one input and so nothing to split.

### D3 — The filter→inputs mapping is EXTRACTED, not copied

Overlap detection needs to know which inputs each filter renders. That mapping already exists, imperatively,
in `ApiOptions.appendTo()`'s five `if` branches. Rather than write a second copy beside it — which would
drift the first time a filter gained an input — the mapping moves into a new internal module,
`src/ApiOptions/FilterInputs.js`, and `ApiOptions.appendTo()` iterates it. There is one mapping and both
consumers read it.

The module is internal and NOT exported from `src/index.js`, on the same reasoning as `Theme.js`,
`InputVisibility.js`, `LocaleValidation.js` and `OptionsValidation.js`.

`appendTo()`'s two runtime gates stay runtime gates, because they are not properties of the mapping:

- `acceptHeaderInput` is skipped when `AcceptHeaderInput.hide()` has been called;
- `yearInput` is skipped under `ALL_CALENDARS`/`NONE` when a `PATH_BUILDER` pass has already claimed it
  (`#pathBuilderEnabled`).

### D4 — Overlap is computed from that mapping, with one exemption that mirrors `#pathBuilderEnabled`

Two keys overlap when the input-key sets their filters render intersect. `localeOnly` + `allCalendars`
overlap on `localeInput`; `yearOnly` + `allCalendars` overlap on `yearInput`; `allCalendars` +
`generalRoman` do not.

The single exemption: when `pathBuilder` is among the keys, `allCalendars` does not claim `yearInput`,
because `ApiOptions.appendTo()` will not append it a second time. This is not a special case invented here —
it is the `#pathBuilderEnabled` rule the library already relies on, and it is what makes
`{ pathBuilder, allCalendars }` a legal, useful pairing rather than a spurious error.

The error names both keys and the inputs they share.

### D5 — Ordering is the component's, and is canonical rather than the caller's

Passes run in a fixed order — `pathBuilder`, `allCalendars`, `localeOnly`, `yearOnly`, `generalRoman` —
regardless of the order the caller wrote the keys in. Only one constraint is real: `pathBuilder` must run
before `allCalendars`, so `#pathBuilderEnabled` is set before the pass that would otherwise duplicate
`yearInput`. `ApiExplorer` already hard-codes that same precedence.

**Corrected during verification — the first draft of this decision overclaimed.** The final DOM would be
the same under caller order too, because `ApiOptions.appendTo()` MOVES its inputs: a later `pathBuilder`
pass simply takes the year input off an earlier `allCalendars` one. What the fixed order actually buys is
narrower — it removes that wasted append-and-move, and it makes D4's exemption literally true (the
`allCalendars` pass really does not append the year input) rather than true only in its outcome.

Pass order becomes directly observable only when a caller names ONE container for two filters, which is
legal. That is what the ordering test asserts, since the year input's final placement alone cannot
distinguish caller order from canonical order — a point only found by disabling the canonical order and
watching the original test still pass.

### D6 — The rite and calendar selects mount into the FIRST key the caller named

Insertion order, not canonical order. `{ allCalendars: '#row1', generalRoman: '#row2' }` puts the rite
select and calendar select in `#row1`, which is what the two-pass idiom produces today and what a caller
listing containers in page order means. Object key insertion order is specified for string keys, so this is
deterministic.

No new slot name is introduced for them: that would be a change to the slot names, which is out of bounds.

### D7 — Every target is resolved before anything is mounted

All pass elements, the selects' element and the messages element are resolved up front, so a typo in the
last container does not leave a half-mounted form. This is the rule `CalendarViewer.appendTo()` already
applies to its `calendar` slot, for the same reason.

### D8 — `NONE` is rejected twice over

As a key (`none`) it throws with its own message: `NONE` renders every input, so it cannot be one of several
passes. And a `CalendarControls` **constructed** with `filter: ApiOptionsFilter.NONE` rejects a filter-keyed
bag up front, because `ApiOptions.filter()` refuses to move off an explicit `NONE` and would otherwise throw
from a class the caller never touched, with a message naming neither.

### D9 — The two-pass idiom stays supported, undeprecated and unwarned

It is `ApiOptions` public API (`filter().appendTo()`), both migrated examples use it, and `ApiExplorer` uses
it internally. It also remains the only way to reach a container the component does not own. What changes is
the documentation's emphasis: `docs/meta-components.md` leads with the declarative form and keeps the idiom
as the escape hatch, rather than presenting it as the only way.

## Public surface

`CalendarControls.appendTo()` / `mountInto()`, and `CalendarViewer.appendTo()` / `mountInto()`:

```text
controls: string | HTMLElement | {
    generalRoman?: string | HTMLElement,
    allCalendars?: string | HTMLElement,
    pathBuilder?:  string | HTMLElement,
    localeOnly?:   string | HTMLElement,
    yearOnly?:     string | HTMLElement,
    basePath?:     string | HTMLElement,   // alias of generalRoman
    allPaths?:     string | HTMLElement,   // alias of allCalendars
}
```

Throws, all before any DOM is touched:

| Condition                                | Message names                                           |
| ---------------------------------------- | ------------------------------------------------------- |
| empty object                             | that at least one filter must be named, and which exist |
| unknown key                              | the key, and the valid keys                             |
| `none` key                               | the key, and why `NONE` cannot participate              |
| same filter twice (alias)                | both keys                                               |
| overlapping filters                      | both keys and the shared inputs                         |
| component's own filter is `NONE`         | the filter, and the two ways out                        |
| a value that is not a target / not found | the slot as `controls.<key>`                            |

## Error handling

Every new failure is a programmer error and throws synchronously from `appendTo()`, so `mountInto()`
**rejects** — consistent with the family's documented "reject for programmer error, resolve for runtime
failure" rule. No new runtime-failure mode is introduced.

## Testing

New suite `src/__tests__/ControlsSlotByFilter.test.js`, plus `src/__tests__/FilterInputs.test.js` guarding
the extracted mapping.

**Corrected during verification.** That second file was first written as a conformance test comparing the
table against the mounted DOM. Once `ApiOptions.appendTo()` iterates the table, that comparison agrees with
itself and catches nothing — confirmed by widening the table and watching it still pass. It is now a
hand-written second statement of the intent, so widening a filter is a deliberate two-place edit, plus
pins for the two runtime skips that are deliberately not in the table.

Each of the three rules gets its own proof:

1. **ordering** — the component mounts everything itself in one call, and a `pathBuilder` +
   `allCalendars` bag written in either key order puts `yearInput` in the `pathBuilder` container;
2. **overlap** — `{ localeOnly, allCalendars }` throws naming both keys and `localeInput`;
   `{ allCalendars, generalRoman }` does not;
3. **`NONE`** — the `none` key throws, and so does a filter-keyed bag on a `filter: NONE` component.

Plus: bare target unchanged (regression), alias equivalence, duplicate-alias rejection, unknown key by name,
resolution-before-mount, `dispose()` empties every container, and `CalendarViewer` forwarding.

## Out of scope

- `ApiExplorer`, `SubscriptionBuilder`, `DayViewer` (D2).
- Deprecating the two-pass idiom (D9).
- `ApiOptions` accessor naming (owned by #62).
- `CalendarControls.onSelectionChange()` (#68).
