# Named theme presets — design

Issue: [#67](https://github.com/Liturgical-Calendar/liturgy-components-js/issues/67)

## The problem

Every page built on the meta-components rewrites the same mapping from HTML role to Bootstrap class:
`form-select` for a `<select>`, `form-control` for a text or number input, `form-label` for a label. The
mapping is not domain logic and it is not the consumer's decision — it is what the framework calls those
things — yet it is written out per consumer, per theme bag, per `Input.setGlobal*` call, and per per-input
override. `Liturgical-Calendar/examples`' `javascript/main.js` goes further and carries a runtime probe:

```javascript
const selectClass = isBS5 ? 'form-select' : 'form-control';
```

That conditional is the whole feature in miniature: the consumer knows which Bootstrap is on the page, and
the library knows what each Bootstrap calls a select. Today the consumer has to know both.

## What ships

A `preset` key on the theme bag, in two spellings:

```javascript
theme: 'bootstrap5'
theme: { preset: 'bootstrap5', riteSelect: { wrapperClass: 'col col-md-2' } }
```

and an exported `ThemePreset` enum (`BOOTSTRAP_4`, `BOOTSTRAP_5`) naming the two valid values.

The preset resolves to **flat role keys only**, plus — on the components that have an `ApiOptions` — an
empty `apiOptions` bundle that opens the existing gate:

| Preset       | `select`       | `input`        | `label`      |
| ------------ | -------------- | -------------- | ------------ |
| `bootstrap5` | `form-select`  | `form-control` | `form-label` |
| `bootstrap4` | `form-control` | `form-control` | _(none)_     |

## Decisions, and why

### 1. Both spellings are accepted, and they cannot be confused with the per-child string form

A bare string is **not** currently a valid `theme` — `assertTheme()` runs `assertPlainOptions()` on it and
throws — so reading one as a preset name is purely additive and can shadow nothing. A bare string _is_
already valid as a **per-child override** meaning `{ class }`, but that is one level down
(`theme.riteSelect`), and a preset is only ever read at the top level. `theme.apiOptions.preset` is not a
thing either: `assertApiOptionsTheme()` rejects `preset` by name, which is the behaviour we want.

### 2. The preset expands to a plain bag, and every existing rule then applies unchanged

`expandThemePreset()` returns `{ ...presetFlatKeys, ...callerKeysWithoutPreset }`. Two consequences:

- **Precedence is the existing resolution, not a parallel merge.** A caller's own flat key beats the
  preset's because it is spread second; a per-child override beats a flat key because
  `resolveChildTheme()` already says so; a per-input `apiOptions` override beats both because
  `resolveApiOptionsInputTheme()` already says so. The preset simply adds a tier _below_ the flat keys,
  expressed as a shallow spread rather than as new machinery.
- **The expansion is validated by `assertTheme()`, not trusted.** Expansion happens _inside_
  `assertTheme()` and _before_ its own loop, so every key a preset emits goes through the same
  `THEME_CHILD_KEYS` check a caller's key does. A preset emitting a key some component does not accept
  therefore throws, loudly, rather than being dropped. This is asserted per component, and
  mutation-verified by making the table emit a bogus key and confirming the guard goes red.

Expansion is applied at all four `Theme.js` entry points that receive a raw bag — `assertTheme()`,
`narrowTheme()`, `resolveChildTheme()` and `resolveApiOptionsInputTheme()` — rather than at the six
components' call sites. That is what keeps the change out of `CalendarControls.js` (owned by #68 in
parallel), and it also means an unknown preset name throws on **every** path rather than only on the one
that happens to run first — the "validation after the probe" trap this project has been bitten by twice.

### 3. A preset opens the `theme.apiOptions` gate, deliberately

The gate exists for one reason, stated in `CLAUDE.md`: letting the outer flat keys reach all ten inputs
automatically would restyle every **existing** consumer's form in a minor release. That reason does not
apply to `preset`, which is a key no existing bag contains. Nothing that renders today can change.

Against that: the issue's own stated purpose. #67 says a preset is "most valuable after #60, since the
preset would otherwise still leave the `ApiOptions` inputs to the process-wide globals". A preset that
stopped at `riteSelect`/`calendarSelect`/`localeInput` would leave `Input.setGlobalInputClass()` and
friends exactly where they are, i.e. fail the issue it implements.

Mechanically the preset injects `apiOptions: {}` — nothing more. The existing four-tier resolver then
lets the preset's own flat keys reach the ten inputs as tier 4, which is precisely the documented meaning
of `apiOptions: {}` ("an explicit yes, style these too, with the defaults I already wrote"). If the caller
named `apiOptions` themselves, theirs is kept untouched.

The injection is **suppressed for a component whose `THEME_CHILD_KEYS` entry has no `apiOptions`** — today
`CalendarResourcePicker`. That registry, not a second list, is the authority.

### 4. A preset defines no `wrapper`, and that is what makes decision 3 safe

The gate's _second_ justification is that a flat `wrapper` consumes `Input.wrapper()`'s one-shot allowance
on ten inputs at construction time and marks their class as set, so a consumer's later
`wrapperClass()` calls throw. A preset that supplied a wrapper class would walk straight into that while
opening the gate. It does not, for three independent reasons:

- **Bootstrap has no single wrapper vocabulary.** BS4's `.form-group` was removed in BS5 in favour of
  spacing utilities (`mb-3`), and a form laid out on the grid wraps in `.col-md-*` instead. Which of the
  three is right is a layout decision, not a class name the framework renamed.
- **The spans are per input and per page.** The motivating example budgets each row to twelve columns —
  `2 + 4 + 2 + 2 + 2` on one row, `3 + 2 + 2 + 2 + 3` on the next. No preset can know those numbers.
- **`CLAUDE.md` says this library "takes no position on CSS".** A named Bootstrap preset is a bounded
  exception to that; bounding it at _what the framework calls a control_ and stopping short of _how the
  page is laid out_ is where the line falls naturally.

So of the two BS4/BS5 differences the issue names, the preset covers the first and deliberately declines
the second. They are not the same kind of difference: `.form-select` is a class Bootstrap 5 introduced for
selects (BS4 styles them with `.form-control`), whereas `col col-md-N` versus `col-md-N` is a choice about
how columns behave below the `md` breakpoint — `.col` and `.col-md-*` exist in both versions and mean the
same thing in both. A consumer keeps their own grid helper; what they stop writing is `isBS5 ? … : …`
around the control classes, which becomes `preset: isBS5 ? 'bootstrap5' : 'bootstrap4'` once.

A caller who _wants_ a flat wrapper alongside a preset can still write one; it then reaches the ten inputs
through the now-open gate, with the documented one-shot consequence. That is the existing rule, not a new
one.

### 5. `bootstrap4` emits no `label`, on purpose

`.form-label` is a Bootstrap 5 class. Bootstrap 4 form labels carry no class at all (its grid forms use
`.col-form-label`, which is a different thing and not what these labels are). Emitting `form-label` for
BS4 would be inventing CSS, which is the one thing this feature must not do. A BS4 consumer who wants
label utilities writes them: `{ preset: 'bootstrap4', label: 'd-block mb-1' }`.

### 6. A flat class no longer reaches a child that is not a control

This is a prerequisite, not a bonus. `resolveChildTheme()` reads its flat class key as
`CLASS_KEY_BY_ROLE[role] ?? 'select'`, so a role with no entry silently falls back to `theme.select`. Two
children have such a role:

- `DayViewer`'s `liturgy` (role `liturgy`) — a `LiturgyOfAnyDay` container `<div>`.
- `SubscriptionBuilder`'s `subscriptionUrl` (role defaulted to `select`) — the copy `<button>`.

Neither is a `<select>`, and the documentation has always said the flat key applies to "every `<select>`
child". With the fallback in place, `theme: 'bootstrap5'` would stamp `form-select` — border, padding and
the dropdown-arrow background image — onto a liturgy card and onto a copy button. The preset would be
unusable on two of the six components.

The fallback is therefore removed: a role inherits a flat class only when `CLASS_KEY_BY_ROLE` names one.
`subscriptionUrl` gains its own `url` role (`class` only). **This is a behaviour change** for a bag that
today writes a flat `select` on a `DayViewer` or a `SubscriptionBuilder`; it is recorded as such, and the
per-child key (`liturgy: { class: … }`, `subscriptionUrl: { class: … }`) is and remains the way to style
those two.

### 7. Names are public; definitions are internal

- **`ThemePreset` is exported** from `src/index.js`. Every other closed set of magic strings in this
  library is an exported enum (`ApiOptionsFilter`, `CalendarSelectFilter`, `YearType`, `Grouping`…), and
  an exported enum turns a runtime throw into a `.d.ts` completion.
- **The class table is not exported.** It lives in `src/MetaComponents/ThemePresets.js`, internal on the
  same footing as `Theme.js`, `LocaleValidation.js` and `OptionsValidation.js`. The strings must stay free
  to be corrected in a patch release — when Bootstrap moves, or when a mapping here turns out to be wrong
  (decision 5 is exactly the sort of judgement that might need revisiting). Exporting them would freeze a
  mapping we specifically want to be able to fix.

Both live in the same file so that the enum's members and the table's keys cannot drift; a test asserts
the two lists are equal, from independently written literals, in the style of
`ApiOptionsPublicAccessors.test.js`.

### 8. An unknown preset throws, naming it and listing the valid ones

`CalendarViewer: theme preset 'bootstrap6' is not recognised. Valid presets are: bootstrap4, bootstrap5.`

Naming the component where one is known (`assertTheme()`, `narrowTheme()`), and prefixed `Theme:` on the
two resolver paths that are not component-aware. A non-string `preset` value is rejected the same way,
naming the type found, in the house style of `assertTheme()`'s other messages.

## What this does NOT do

- It does not detect which Bootstrap is loaded. That is a page fact the library cannot see, and the probe
  in the motivating example stays — it just chooses a preset name instead of a dozen class strings.
- It does not supply layout: no wrapper class, no grid spans, no spacing utilities.
- It does not ship CSS, a stylesheet, or a class the named framework does not itself define.
- It does not add a Tailwind or Bulma preset. `bootstrap4`/`bootstrap5` cover every consumer in this org
  today; a third is a new decision with its own vocabulary question, and adding one later is additive.
- It does not change what `DayViewer` does with its three date controls: they share one `dateControls`
  entry at the `input` role, so under `bootstrap5` the month `<select>` receives `form-control` rather
  than `form-select`. That is the pre-existing shared-entry design; the escape hatch is `viewer.liturgy`.

## Testing

New suite `src/__tests__/MetaComponentThemePresets.test.js`, plus additions where an existing suite
already owns the subject.

The properties that must fail if the implementation is wrong — each verified by mutation:

1. For each of the six components, constructing with `theme: 'bootstrap5'` renders the framework's class
   on the rite select, the calendar select and (where present) every `ApiOptions` input.
2. `theme: { preset: 'bootstrap5', select: 'x' }` renders `x`, not `form-select` — caller beats preset.
3. `theme: { preset: 'bootstrap5', riteSelect: { class: 'x' } }` renders `x` on the rite select and
   `form-select` on the calendar select — per key, most specific first.
4. The expansion for every (preset, component) pair passes `assertTheme()` under that component's name.
   Mutating the table to emit an unregistered key turns this red.
5. `CalendarResourcePicker` with a preset does not receive an `apiOptions` key and does not throw.
6. An unknown preset throws from `assertTheme()`, `narrowTheme()`, `resolveChildTheme()` **and**
   `resolveApiOptionsInputTheme()` — no path silently ignores it.
7. A bag with no `preset` is returned unchanged (identity), so no existing bag can change behaviour.
8. `theme: 'bootstrap5'` leaves `DayViewer`'s liturgy container and `SubscriptionBuilder`'s copy button
   without a `form-select` class (decision 6).
