# `theme.apiOptions` — a themeable `ApiOptions` bundle

The answer to
[issue #60](https://github.com/Liturgical-Calendar/liturgy-components-js/issues/60).

The meta-components' theme bag reaches `riteSelect`, `calendarSelect` and — since 2.7.0 — `localeInput`,
and nothing else. This adds one nested `apiOptions` key that extends the same role vocabulary to all ten
of an `ApiOptions`' inputs, removing the last reason a consumer has to call the process-wide
`Input.setGlobal*` setters.

## The problem

Every consumer of the meta-components still opens with four process-wide mutations:

```javascript
Input.setGlobalInputClass(selectClass);
Input.setGlobalLabelClass('form-label d-block mb-1');
Input.setGlobalWrapper('div');
Input.setGlobalWrapperClass(formGroupClass(2));
```

They are mutations on the `Input` **class**: they leak onto every other component on the page, and two
embeds wanting different styling cannot coexist behind them. `docs/meta-components.md` said both of these
things at once, which is the problem in one sentence:

> **`apiOptions` is not a themeable child.** Neither the flat `select`/`label` keys nor a per-child
> `apiOptions` override key reach any of the `ApiOptions` inputs.

and, of the alternative, a few hundred lines earlier:

> this class does not call `Input.setGlobalInputClass()` or its siblings — those are process-wide
> mutations that leak onto every other component on the page, and the theme bag is the scoped replacement

The scoped replacement did not cover the form, so the leak stayed mandatory.

### The stated reason not to fix it, and why it does not hold

> `ApiOptions` bundles a variable number of inputs depending on `filter`, so there is no fixed set of
> per-child keys to name the way `riteSelect`/`calendarSelect` are named.

`filter` varies which inputs **render**, not which **exist**. `ApiOptions`' constructor builds all ten
unconditionally (`ApiOptions.js:211-223`); `filter` is consulted only by `appendTo()`
(`ApiOptions.js:1146-1192`). The set is fixed at ten and is already enumerated by `ApiOptions`' own
accessors and by its private `#inputs` bag. `OVERRIDE_KEYS_BY_ROLE` in `Theme.js` already demonstrates
that per-role key lists scale to a `liturgy` role with eight keys.

## The shape

```javascript
theme: {
    select: 'form-select',            // outer flat defaults (unchanged meaning)
    label: 'form-label',
    apiOptions: {                     // opt-in gate for the ApiOptions bundle
        select: 'form-select',        // flat defaults for this bundle
        input: 'form-control',        // number inputs (yearInput)
        label: 'form-label d-block mb-1',
        wrapper: 'form-group col col-md-2',
        epiphanyInput: { wrapperClass: 'form-group col col-md-3' },   // per-input override
        holydaysOfObligationInput: { wrapperClass: 'form-group col col-md-3' },
    },
}
```

## Decisions

### D1 — Per-input key names are `ApiOptions`' accessor names, underscore stripped

The ten keys are `epiphanyInput`, `ascensionInput`, `corpusChristiInput`, `eternalHighPriestInput`,
`holydaysOfObligationInput`, `localeInput`, `yearTypeInput`, `yearInput`, `acceptHeaderInput` and
`calendarPathInput`.

Rejected: the issue's `epiphany` / `holydaysOfObligation` spelling. The established rule is "per-child
keys are named for the component's public getters", and `theme.localeInput` — shipped in 2.7.0 — is
already `_localeInput` minus the underscore. `epiphany` would make `localeInput` the odd one out, and it
collides conceptually with the API query parameter of the same name (`epiphany=JAN6`), which is a
different thing entirely. These names are also exactly the keys of `ApiOptions`' private `#inputs` bag,
and exactly what issue #62's non-underscore aliases would be called, so nothing has to be renamed if #62
lands.

Only one spelling is accepted per input. No aliases: an alias defeats the typo check.

### D2 — `theme.apiOptions` is an opt-in gate

Naming the key at all — `{}` included — opts the bundle in. While it is absent, nothing changes for any
existing consumer, including one who already passes flat `select`/`label`/`wrapper` keys and pairs them
with `Input.setGlobal*` calls.

Letting the outer flat keys reach all ten inputs automatically would silently restyle those pages in a
**minor** release, and worse: a flat `theme.wrapper` would call `Input.wrapper({ as, class })` on ten
inputs at construction, and because a bag naming a class sets `#wrapperClassSet` (`Input.js:669-671`),
every consuming page's later `wrapperClass()` call would begin to throw. Relaxing the gate later is
backward compatible; tightening it would not be.

`localeInput` keeps its 2.7.0 behaviour exactly — it does receive the outer flat keys with or without the
gate. See D3.

### D3 — Resolution is per key, most specific first, over four tiers

For an input key `k` with role `r` (`select` for nine, `input` for `yearInput`):

| Tier | Source                   | Applies to                                    |
| ---- | ------------------------ | --------------------------------------------- |
| 1    | `theme.apiOptions[ k ]`  | that input                                    |
| 2    | `theme[ k ]`             | `localeInput` only — the legacy top-level key |
| 3    | `theme.apiOptions`' flat | every input, once the gate is open            |
| 4    | `theme`'s own flat keys  | every input, once the gate is open            |

Tiers 3 and 4 are skipped entirely for the other nine while the gate is closed, which is what makes D2
true. For `localeInput` with the gate closed the formula collapses to `theme.localeInput` over `theme`
flat — byte-for-byte today's behaviour, which is why the existing `DayViewerLocaleInputTheme.test.js`
characterization suite must keep passing untouched.

There are not two competing paths: `theme.localeInput` and `theme.apiOptions.localeInput` are two tiers
of ONE resolution, merged per key exactly as flat-vs-per-child already merges. No warning and no throw
when both are present — per-key merging is the library's existing answer to that question everywhere
else.

Tiers 3 and 4 arrive together: opening the gate for one narrow reason also lets the outer flat keys reach
all ten. A bundle key can override an outer one but cannot cancel it.

### D4 — `assertTheme()` keeps its typo-catching property at the new depth

`theme.apiOptions` becomes a third kind of top-level key, validated by its own branch:

- must be a plain object. A **class string is rejected** (`theme.apiOptions: 'form-select'` is ambiguous
  between the `select` and `input` roles), with a message naming the object form.
- each of its keys must be a flat role key (string value) or one of the ten input keys; anything else
  throws, naming the key and listing all valid ones. This catches the issue's own `epiphany` spelling and
  points at `epiphanyInput`.
- an input key's value may be a class string, or an object whose keys must be in
  `{class, labelClass, labelText, wrapperClass, wrapper}` with string (or explicitly `undefined`) values.
  This is **stricter than the two-level check**, which accepts any key any role uses: at this depth the
  role is known, so `apiOptions.epiphanyInput.titleClass` is rejected where `theme.riteSelect.titleClass`
  cannot be.

### D5 — All ten inputs are themed, regardless of `filter`; never throws

They all exist. Theming one the current filter does not render is inert, not an error — the same rule as
"`filter` decides what renders". A single bag can therefore be written once and reused across filters.

### D6 — `resolveWrapperBag()` is reused, not re-inlined

Per input: `class` → `Input.class()`, `labelClass` → `Input.labelClass()`, `resolveWrapperBag()` →
`Input.wrapper()` when non-null, `labelText` → `_labelElement.textContent`.

`resolveWrapperBag()` always supplies `as: 'div'` when only a class was named, so the "Wrapper has not
been set" crash that `DayViewer`'s `dateControls` path had to work around cannot occur here. It omits
`class` entirely rather than passing `undefined`, because a bag's `class` beats
`setGlobalWrapperClass()` **and** closes `wrapperClass()` afterwards.

`labelText` is applied **only when named** — unlike `localeInput`, whose label is set unconditionally
because `LocaleInput` hardcodes the raw string `'locale'`. Default label text is untouched: issue #59
owns that.

### D7 — Two call sites, one helper

`Theme.js` gains `applyApiOptionsTheme( apiOptions, theme, localeLabelText )`, which loops the ten
inputs, resolves each, and delegates `localeInput` to the existing `applyLocaleInputTheme()`.
`CalendarControls` and `DayViewer` each replace their current locale-input block with one call to it.
`CalendarViewer`, `ApiExplorer` and `SubscriptionBuilder` construct a `CalendarControls` and inherit the
behaviour with no code change.

`CalendarResourcePicker` has no `ApiOptions`, so `theme.apiOptions` there is accepted-and-dropped — the
existing, documented "`assertTheme()` catches a misspelling but not a misplacement" limitation, unchanged
and out of scope.

On `DayViewer` the bundle is `LOCALE_ONLY`-filtered, so only `localeInput` renders; the other nine keys
resolve and apply to inputs that are never appended.

### D8 — Left open for issue #67 (named presets)

A `bootstrap5` preset is exactly a frozen bag of this shape with an `apiOptions` block. Nothing here
forecloses it, and nothing here implements it.

## Amendments made during implementation

Two changes to this spec, both from code review, both verified before acting:

### A1 — A top-level input key is rejected, not dropped

`assertTheme({ yearInput: { class: 'form-control' } })` passed the original design's validation and was
then resolved by nothing, since tier 2 consults the top level only for `localeInput`. That is the
issue #43 failure mode arriving by a new route, and this change is precisely what makes the misplacement
plausible: it ships ten names that work nested while ONE of them, `localeInput`, also works at the top
level, so `theme: { localeInput: …, yearInput: … }` written by analogy would have had half of it silently
ignored.

`assertTheme()` now rejects any of the other nine input names at the top level, pointing at the nested
spelling. Verified first that no meta-component has a per-child key sharing any of the ten names
(`riteSelect`, `calendarSelect`, `liturgy`, `dateControls`, `subscriptionUrl`, `webCalendar`), so nothing
legitimate is caught.

### A2 — The `Input.setGlobal*` interaction is pinned by tests

The design reasoned about the globals pairing (`#wrapperSet` vs `#hasWrapper`, and a bag class beating
`setGlobalWrapperClass()`) but planned no test for it. A regression there would break ten inputs at once
on every `LiturgicalCalendarFrontend` page and six examples, with no test signal.
`MetaComponentThemeApiOptionsGlobals.test.js` covers it, in its own file because the statics have no
reset — the same reason `InputWrapperGlobals.test.js` is separate.

Two documentation-only points also came out of review: the bundle's flat `wrapper` names a class whose
element type is always `div` (so it overrides a global `'td'`), and
`AcceptHeaderInput.asReturnTypeParam()` rewrites its own label text after the theme has applied.

## Testing

`src/__tests__/MetaComponentThemeApiOptions.test.js`:

- `assertTheme()`: accepts the new shape; rejects a class-string `apiOptions`, an unknown key inside it
  (naming it), an unknown per-input key, a non-string flat value, a non-string override value, and a
  non-legacy input key at the top level.
- Resolution: per-input override beats bundle flat beats outer flat; `theme.localeInput` still beats
  bundle flat; `theme.apiOptions.localeInput` beats `theme.localeInput`; explicit `undefined` falls
  through; the flat `wrapper` maps to a class and the per-input one to a type.
- The gate: with no `apiOptions` key, nine inputs are untouched and `localeInput` behaves as in 2.7.0.
- Application: classes, label classes, label text, wrapper element type and wrapper class land on the
  real DOM; `yearInput` takes `input` not `select`; theming an input the filter hides does not throw.
- End to end through `CalendarControls`, and inheritance by `CalendarViewer`, `ApiExplorer`,
  `SubscriptionBuilder` and `DayViewer`.

`src/__tests__/MetaComponentThemeApiOptionsGlobals.test.js` covers A2.

`DayViewerLocaleInputTheme.test.js` and the `MetaComponentTheme*` suites must pass **unmodified**.

## Documentation

- `docs/meta-components.md`: replace "**`apiOptions` as a whole is still not a themeable child.**" and
  its stated reason; generalize the escape-hatch-throws paragraph from `localeInput` to any themed input;
  correct the `CalendarViewer` multi-row paragraph, which described the asymmetric row this key fixes;
  add the key to the `CalendarControls` and `DayViewer` theme sections and note it in the shared role
  vocabulary.
- `CLAUDE.md`: extend the "theme bag's role vocabulary" contract point.
- `README.md`: one sentence in the meta-components summary.
- `CHANGELOG.md`: one `## [Unreleased]` entry, scoped to #60.

## Out of scope

`src/Messages.js` and default label text (#59); `ApiOptions` accessor renaming or aliasing (#62); named
theme presets (#67); meta-component constructor options, `mountInto()` and `settled` (#61); a `controls`
slot keyed by filter (#63); `CalendarControls.onSelectionChange()` (#68).
