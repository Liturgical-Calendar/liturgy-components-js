# Message catalogue fallback (issue #69)

## The bug

`new ApiOptions( 'ceb' )` throws:

```text
TypeError: Cannot read properties of undefined (reading 'SUNDAY_JAN2_JAN8')
    at new EpiphanyInput (src/ApiOptions/Input/EpiphanyInput.js:48)
    at new ApiOptions (src/ApiOptions/ApiOptions.js:211)
```

`Messages` holds 84 locale blocks. `Messages['ceb']` is `undefined`, so the second index throws. The
message names neither the component, nor the locale, nor the fact that it is the message catalogue —
not the API — that lacks the language. Every meta-component constructs an `ApiOptions`, so all six
inherit the failure from a component the consumer never touched directly, and `locale` is commonly
wired straight from `document.documentElement.lang`.

Six sites reproduce, all confirmed by running them before any fix:

| File                                             | Line  | Key                             |
| ------------------------------------------------ | ----- | ------------------------------- |
| `src/ApiOptions/Input/EpiphanyInput.js`          | 48    | `SUNDAY_JAN2_JAN8`              |
| `src/ApiOptions/Input/EternalHighPriestInput.js` | 39-40 | `FALSE`, `TRUE`                 |
| `src/ApiOptions/Input/YearTypeInput.js`          | 36-37 | `LITURGICAL_YEAR`, `CIVIL_YEAR` |
| `src/ApiOptions/Input/CalendarPathInput.js`      | 30    | `SELECT_ROUTE`                  |
| `src/CalendarSelect/CalendarSelect.js`           | 969   | `SELECT_A_CALENDAR`             |
| `src/LiturgyOfTheDay/LiturgyOfTheDay.js`         | 176   | `LITURGY_OF_THE_DAY`            |

Issue #59 (PR #74) fixed the inputs' **label** text by centralizing it in
`src/ApiOptions/Input/InputLabels.js`'s `defaultLabelText()`, which applies
`Messages[language]?.[key] ?? Messages['en'][key]`. It deliberately left the **option** labels and the
four sites outside `ApiOptions/Input/` alone; `CLAUDE.md` records that gap as issue #69's.

Every key the six sites read is present in all 84 blocks, so no locale that merely lacks a translation
hits this. Only a language with **no block at all** does — which is the case the API can serve and the
catalogue cannot name.

## Design

### One shared implementation: `src/MessageLookup.js`

A new top-level internal module, a sibling of `LocaleValidation.js`, `OptionsValidation.js` and
`WrapperOptions.js`, and internal on the same reasoning: not exported from `src/index.js`.

```javascript
export function message(key, locale = null);
```

- `locale` accepts an `Intl.Locale`, a locale tag string, or `null`/`undefined` for "not supplied",
  which yields English. That mirrors the library-wide locale contract, and covers the two shapes the
  call sites actually hold: an `Intl.Locale` (the `ApiOptions` inputs, `CalendarSelect`,
  `LiturgyOfTheDay`) and a bare language subtag string (`RiteSelect`, `SubscriptionUrl`).
- A string is normalized through `LocaleValidation.js`'s `toIntlLocale()`, not a bare `new Intl.Locale()`,
  so `'en-US'`, `'en'` and the underscore form `'en_US'` resolve alike — a lookup must not be the one
  place in the library that rejects a form every other locale entry point accepts. An unparseable tag
  **throws**, per `CLAUDE.md`: "An unparseable locale throws and is never silently replaced with
  English. 'Absent' and 'invalid' are different things." Going through `toIntlLocale()` is also what
  makes that throw name the tag and the layer, instead of `Intl.Locale`'s own
  `Incorrect locale information provided`, which names neither — reintroducing that would be #69's
  original complaint moved onto the invalid-tag path. An `Intl.Locale` skips the round trip: it is
  already parsed, and its `language` is already canonical.
- A language with no block, or a block that lacks the key, falls back to `Messages['en'][key]`.
- **A key absent from English throws**, naming the key and saying it is the message catalogue that
  lacks it. That is a programmer error — the keys are string literals in the source, so a key missing
  from English is a typo that is broken in every locale, not a translation gap. Failing loudly there
  is strictly better than assigning `undefined` to a `textContent` and rendering the word "undefined".
  It is also deterministic: it cannot depend on which locale the page happens to run in.

`defaultLabelText( key, locale )` stays where it is and becomes a one-line delegate. It keeps its own
name and doc comment because it carries a label-specific rationale (theming applies after
construction, so a theme's `labelText` still wins) and ten call sites already use it.

Alternatives weighed:

- **Guard at each call site.** Rejected: that is the shape that produced this bug. Six copies of
  `Messages[x]?.[k] ?? Messages['en'][k]` already exist and six more sites forgot it.
- **Generalize `InputLabels.js` in place.** Rejected: four of the six broken sites are not inputs and
  not labels. A module under `ApiOptions/Input/` is the wrong home for `CalendarSelect` and
  `LiturgyOfTheDay`.

### No `console.warn`

The issue suggests warning when the catalogue lacks the locale. Declined, deliberately:

- `CLAUDE.md`'s Internationalization section documents the catalogue as **unevenly populated by
  design**: keys such as `SELECT_A_RITE` and the six #59 label keys live in exactly twelve of the 84
  blocks, and "every other locale reaches English through the `??` fallback ... so an unpopulated
  block degrades to English for that key rather than throwing." A warning would fire for the normal,
  documented case on 72 of 84 locales — noise proportional to catalogue sparseness, not to error.
- It would be a behaviour change on the paths that already fall back **silently** and are documented
  to do so (`RiteSelect`, `CalendarSelect.#riteLevelOptionHtml()`, `SubscriptionUrl`,
  `defaultLabelText`). Fixing a throw should not make four working paths start logging.
- Per construction, not per page: `ApiOptions` builds ten inputs, so one page would emit a burst.

The gap stays visible where it belongs — `src/__tests__/Messages.test.js` already asserts key coverage
per locale, and a missing-from-English key now throws by name.

### Consolidating the guards that were already correct

Four files carry a hand-written equivalent of the guard. Three of them move onto `message()` so the
library has exactly one implementation, and so the regression test below can be absolute rather than
approximate:

- `src/ApiOptions/Input/InputLabels.js`
- `src/RiteSelect/RiteSelect.js` (two sites)
- `src/CalendarSelect/CalendarSelect.js` (`#riteLevelOptionHtml()`)
- `src/SubscriptionBuilder/SubscriptionUrl.js` (two sites)

`src/MetaComponents/` (`CalendarControls.js`, `CalendarResourcePicker.js`, `DayViewer.js`) keeps its
inline guards for now: issue #78 is editing those files in parallel. They are correct as written; the
migration is a follow-up, noted here so it is not mistaken for an oversight.

### Regression test: no unguarded read may come back

`src/__tests__/MessageLookup.test.js` scans every `.js` under `src/` (excluding `Messages.js` and
`__tests__/`) for a read of the form `Messages[ EXPR ][` where `EXPR` is not the literal `'en'`, and
fails on any hit. `Messages['en'][key]` is the terminal fallback and is allowed; a locale-dependent
index must be written `?.[` or go through `message()`.

Two files are allow-listed with the reason spelled out in the test: `src/WebCalendar/WebCalendar.js`
and `src/LiturgyOfAnyDay/LiturgyOfAnyDay.js` carry the same unguarded pattern and belong to issue
\#65, which is editing them in parallel. The allow-list is a ceiling, not a floor: if #65 guards them,
the test still passes.

**Leaving those two out means #69's symptom is not fully gone, and the docs must say so.**
`LiturgyOfAnyDay` throws in its constructor, so `DayViewer` — which builds one — still throws for a
no-block locale; `WebCalendar` throws inside `buildTable()`, so a `CalendarViewer` constructs but
still fails to render. Five of the six meta-components are fixed at construction, one is not, and one
is fixed only up to render. `CLAUDE.md` and `CHANGELOG.md` name both remaining routes rather than
claiming all six.

The pattern also matches `Messages?.[lang][KEY]`, which looks guarded and is not — the `?.` guards
`Messages` itself being nullish, which it never is. It is a **shape check, not a proof**: a nested
index, an aliased default import, a two-statement form and a line break inside the first bracket all
pass it. The test's doc comment lists these; widening the pattern to cover them would cost more in
false positives than the shapes are worth.

## Testing

- `src/__tests__/MessageLookup.test.js` carries the whole story: the helper's contract (`Intl.Locale`,
  tag string, `null`, no block, sparse block, unparseable tag, key missing from English), a
  constructor-level case per broken site proving each now renders the English string for `ceb`, and
  the source scan. Four of the six sites are outside `ApiOptions/Input/`, so splitting the
  constructor cases across two files would have told half the story in each.
- `src/__tests__/InputLabelLocalization.test.js` — its comment documents #69's gap as deliberate;
  that comment is rewritten to point at the file above.
- Existing suites cover the migrated guards; they must stay green unchanged.

## Out of scope

- `src/WebCalendar/WebCalendar.js` and `src/LiturgyOfAnyDay/LiturgyOfAnyDay.js` (issue #65).
- `src/MetaComponents/*` guard consolidation (issue #78 is editing those files).
- Adding any translation to `src/Messages.js`. No key is added or changed.
