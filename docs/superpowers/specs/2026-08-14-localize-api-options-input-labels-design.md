# Localize the `ApiOptions` input labels (issue #59)

## Problem

Ten of the twelve `Input` subclasses set their `<label>` text in the constructor. Nine of them set the raw
snake_case API parameter name — `ascension`, `corpus_christi`, `epiphany`, `eternal_high_priest`,
`holydays_of_obligation`, `year_type`, `year`, `day`, `month` — and the tenth, `LocaleInput`, sets the raw
string `locale`.

2.7.0 patched only `locale`, and only on the meta-component path: `Theme.js`'s `applyLocaleInputTheme()`
overwrites the label after construction with a caller-supplied `Messages[...]['LANGUAGE']` lookup. A consumer
who writes `new ApiOptions( 'it' )` directly — supported, documented, public API — still gets every raw key,
`locale` included.

The `<label>` is what a screen reader announces for the control, so this is an accessibility defect and not
only a cosmetic one.

## Decisions

### D1 — Localize in the `Input` subclass constructors, not in `Theme.js`

The issue's suggested direction was to generalize `applyLocaleInputTheme()` into
`applyInputTheme( input, childTheme, defaultLabelText )` and call it per input from each meta-component. That
is the wrong layer for the core fix:

- It only reaches consumers who mount a meta-component. `ApiOptions` is public API in its own right; a direct
  consumer would keep shipping raw keys.
- It would require every meta-component to know the label key of every input it mounts, duplicating a fact
  that belongs to the input.

Each input constructor already receives (or can receive) the locale, so the input is the one place that both
knows its own key and knows the locale.

**A theme-supplied `labelText` still wins**, unchanged, because all theming is applied _after_ construction —
`Theme.js` and `LiturgyOfAnyDay`'s `dayInputConfig()`/`monthInputConfig()`/`yearInputConfig()` both write
`_labelElement.textContent` on an already-constructed input.

### D2 — One shared lookup helper

New internal module `src/ApiOptions/Input/InputLabels.js`, exporting a single function:

```js
defaultLabelText( key, locale = null ) // -> Messages[ language ]?.[ key ] ?? Messages[ 'en' ][ key ]
```

`language` is `locale?.language ?? 'en'`. It is **not** exported from `src/index.js`, on the same reasoning as
`LocaleValidation.js`, `OptionsValidation.js` and `WrapperOptions.js`: internal contract between components.

The `??` fallback is mandatory and is the whole reason the helper exists rather than ten inlined lookups — it
makes the unguarded-read bug tracked as issue #69 structurally impossible for these labels. The name matches
the `defaultLabelText` parameter `Theme.js` already uses for the same idea.

### D3 — Message keys: reuse four, add six

Already present, reused as-is:

| Key        | Input         | Locale coverage today   |
| ---------- | ------------- | ----------------------- |
| `DAY`      | `DayInput`    | 12                      |
| `MONTH`    | `MonthInput`  | 84 (WebCalendar header) |
| `YEAR`     | `YearInput`   | 12                      |
| `LANGUAGE` | `LocaleInput` | 12                      |

`LANGUAGE` is the key `CalendarControls` and `DayViewer` already pass as `defaultLabelText` for the locale
input, so the constructor now produces exactly what the theme path was overwriting it with.

Six new keys:

| Key                      | English                   |
| ------------------------ | ------------------------- |
| `YEAR_TYPE`              | `Year Type`               |
| `EPIPHANY`               | `Epiphany`                |
| `ASCENSION`              | `Ascension`               |
| `CORPUS_CHRISTI`         | `Corpus Christi`          |
| `ETERNAL_HIGH_PRIEST`    | `Eternal High Priest`     |
| `HOLYDAYS_OF_OBLIGATION` | `Holy Days of Obligation` |

Populated for the same twelve locale blocks that already carry `SELECT_A_RITE`, `DAY`, `YEAR` and `LANGUAGE`
— `de en es fr hu id it la nl pt sk vi` — matching the existing precedent rather than inventing a second
coverage rule. The other 72 blocks are left alone and degrade to English through the `??`.

The four feast keys carry the feast's proper name (`Fronleichnam`, `Corpus Domini`, …) rather than a
paraphrase, because that is what the control is asking about and what the API's own i18n uses.

### D4 — Three constructors gain an optional locale

`DayInput`, `YearInput` and `HolydaysOfObligationInput` take no locale today.

| Class                       | New signature                                |
| --------------------------- | -------------------------------------------- |
| `DayInput`                  | `constructor( locale = null )`               |
| `YearInput`                 | `constructor( locale = null )`               |
| `HolydaysOfObligationInput` | `constructor( options = [], locale = null )` |

`null` means "not supplied" and yields the English label — the only sane default for a directly-constructed
input with no locale, and backward compatible with `new DayInput()`. A non-null, non-`Intl.Locale` argument
throws, with the same message shape `MonthInput` already uses.

Call sites updated: `ApiOptions` (`yearInput`, `holydaysOfObligationInput`) and `LiturgyOfAnyDay` (`dayInput`,
`yearInput`) — both already hold an `Intl.Locale`.

### D5 — `Theme.js`: comment only, no behaviour change

`applyLocaleInputTheme()`'s doc comment and inline comment justify setting the label _unconditionally_ by
citing `LocaleInput.js:48`'s hardcoded `'locale'`. That justification becomes false, so both comments are
rewritten.

The **code** is left exactly as it is. `CalendarControls.#language` is `new Intl.Locale( locale ).language`,
which is the same `locale.language` `ApiOptions` hands `LocaleInput`, so the unconditional set now writes the
identical string the constructor already produced. Removing it would be pure churn in a file issue #60 owns.

### D6 — This is a deliberate behaviour change, and there is no new opt-out

Rendered label text changes for every consumer who never set one. Existing escape hatches are unchanged: the
meta-component theme's `labelText`, `LiturgyOfAnyDay`'s three `*InputConfig({ labelText })` bags, and direct
assignment to `input._labelElement.textContent` (which the library itself uses).

`Input` has **no public `labelText()` setter** and this change does not add one. That is a real gap, but
adding public API to `Input` overlaps issues #60 and #62 and is left for its own PR.

### D7 — Constructor ordering

In the five constructors that validate the locale _after_ setting the label, only the label assignment moves
below the validation. `_domElement.name` and `_claimDefaultId()` stay where they are, so which ids a throwing
constructor has already claimed is unchanged.

## Explicitly out of scope

- **`AcceptHeaderInput`** ships `'return_type'` / `'Accept Header'` raw and takes no locale. It is not in the
  issue's table, its label flips at runtime in `asReturnTypeParam()`, and it is `PathBuilder`-only. Reported,
  not fixed.
- **`CalendarPathInput`**'s unguarded `Messages[ locale.language ][ 'SELECT_ROUTE' ]` read — issue #69.
- The `applyInputTheme()` generalization the issue suggested. `Theme.js`'s per-child override resolution is
  issue #60's.

## Testing

New `src/__tests__/InputLabelLocalization.test.js`:

- every one of the ten inputs renders the English label for `en` and the translated label for `it`;
- a locale outside the catalogue (`zz`) falls back to English rather than throwing;
- `DayInput`/`YearInput`/`HolydaysOfObligationInput` with no locale render the English label;
- those three throw on a non-`Intl.Locale` locale;
- a theme-supplied `labelText` still wins over the constructor's value, through
  `applyLocaleInputTheme()` and through `LiturgyOfAnyDay.dayInputConfig()`.

Extended `src/__tests__/Messages.test.js`: the six new keys exist in English and carry exactly the same
twelve-locale coverage as `SELECT_A_RITE`.

## Documentation

`CHANGELOG.md` (`## [Unreleased]`, scoped to #59), `CLAUDE.md`'s Internationalization section (key counts),
`docs/api-options.md`, and `docs/meta-components.md` where it describes `applyLocaleInputTheme()`'s rationale.
