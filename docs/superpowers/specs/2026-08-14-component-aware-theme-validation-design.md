# Component-aware theme validation (issue #78)

Date: 2026-08-14
Branch: `fix/component-aware-theme-validation`
Issue: [#78](https://github.com/Liturgical-Calendar/liturgy-components-js/issues/78)

## Problem

`assertTheme()` validates a theme bag without knowing which children the component it is validating for
actually has. It catches a **misspelling** but not a **misplacement**: any key that is not a reserved flat
key is read as a per-child override, accepted, and then silently dropped by `resolveChildTheme()` when no
child of that name exists.

```javascript
// Accepted, dropped in silence. CalendarResourcePicker bundles no ApiOptions at all.
await CalendarResourcePicker.mountInto('#picker', {
    theme: { apiOptions: { select: 'form-select' } },
});

// Same shape, same silence: CalendarViewer has no LiturgyOfAnyDay.
new CalendarViewer({ theme: { liturgy: { eventClass: 'card' } } });
```

That is the issue-#43 failure mode — a key accepted by the guard, discarded by the resolver, markup
rendered with library defaults, no throw and no warning.

A second, related defect at the same boundary: a bad theme key passed to `CalendarViewer` is reported
today under the name **`CalendarControls`**, because `CalendarViewer`, `ApiExplorer` and
`SubscriptionBuilder` do not call `assertTheme()` at all — they forward `theme` to `CalendarControls`,
which validates under its own name. PR #76 deliberately had `CalendarViewer` and `ApiExplorer` validate
their `inputs` bag under their own names _before forwarding_, for exactly this reason.

## Goals

1. A theme key naming a child the receiving component does not have **throws**, naming the rejecting
   component and the offending key, and pointing at where the key would be valid.
2. A theme key rejected on a forwarding component (`CalendarViewer`, `ApiExplorer`,
   `SubscriptionBuilder`) is reported under **that** component's name, not `CalendarControls`'.
3. Every key that is legitimate today on the component it is written for keeps working — in particular
   `SubscriptionBuilder`'s `subscriptionUrl`, which `CalendarControls` has never heard of.

## Non-goals

- Making the nested `apiOptions` bag reject an input the current `filter` never renders. PR #75 settled
  that all ten inputs exist regardless of `filter`, so theming a filtered-out input is inert rather than
  an error, and a caller should not need to know which filter renders which input. There is a passing
  test pinning that; it does not change.
- Named theme presets (`bootstrap4`/`bootstrap5`) — that is issue #67, held and running next in this
  same file.

## The per-component child-key sets

Derived by reading every `resolveChildTheme()` / `applyApiOptionsTheme()` call in each component:

| Component                | Child keys it actually resolves                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| `CalendarResourcePicker` | `riteSelect`, `calendarSelect`                                                                 |
| `CalendarControls`       | `riteSelect`, `calendarSelect`, `apiOptions`, `localeInput`                                    |
| `CalendarViewer`         | `CalendarControls`' set (its `WebCalendar` is configured by the separate `webCalendar` option) |
| `ApiExplorer`            | `CalendarControls`' set (its `PathBuilder` reads no theme)                                     |
| `DayViewer`              | `riteSelect`, `calendarSelect`, `liturgy`, `dateControls`, `apiOptions`, `localeInput`         |
| `SubscriptionBuilder`    | `CalendarControls`' set plus `subscriptionUrl`                                                 |

Two entries the issue's own table left implicit and which the code requires:

- **`apiOptions`** is a reserved nested key rather than a per-child override, but it is still a key the
  receiving component either has a use for or does not. `CalendarResourcePicker` bundles no `ApiOptions`,
  so it must reject it — that is the issue's first worked example.
- **`localeInput`** is the one `ApiOptions` input that also answers to a top-level key
  (`LEGACY_TOP_LEVEL_INPUT_KEYS`, shipped as public API in 2.7.0). It belongs to the same five components
  that have an `ApiOptions`, and must be rejected on `CalendarResourcePicker` for the same reason.

## Design

### D1 — one frozen registry in `Theme.js`

`THEME_CHILD_KEYS`, a frozen object keyed by component name whose values are frozen arrays, following the
shape of the existing `FLAT_KEYS` / `OVERRIDE_KEYS_BY_ROLE` / `API_OPTIONS_INPUT_KEYS` constants. Entries
that repeat another entry are composed from it (`CalendarViewer` is `CalendarControls`' array, spread), so
the five-way relationship is stated once.

A derived reverse map, `COMPONENTS_BY_CHILD_KEY`, answers "where would this key be valid" for the error
message. Deriving it rather than writing it by hand keeps it from drifting.

### D2 — the set is looked up by component name, not passed as an argument

`assertTheme( theme, componentName )` keeps its two-argument signature and looks the allowed set up in
`THEME_CHILD_KEYS[ componentName ]`. An unrecognised name **throws an internal error** rather than falling
back to the permissive behaviour.

The alternative — a third `childKeys` argument, which is what the issue sketched — was weighed and
declined on three grounds:

1. **The name and the set can never disagree.** Defect 2 in this very issue _is_ a name/owner mismatch at
   a forwarding boundary; a signature that lets a call site pair `'CalendarViewer'` with `DayViewer`'s set
   reintroduces the same class of mistake in a new place.
2. **A registry is needed anyway** for the "valid on …" hint, so the argument form would not avoid the
   coupling between `Theme.js` and the component names — it would only add a second place to state the
   sets.
3. **No call-site churn.** `assertTheme()` is called from 35 places in the test suite; a required third
   argument would rewrite all of them and bury the behaviour change in plumbing.

The cost is that the `componentName` string, previously only message text, becomes semantically
significant. The parameter's doc comment says so explicitly, and the unknown-name throw makes a typo
loud rather than silently permissive — which is the failure the argument form was meant to avoid.

### D3 — the forwarding wrinkle: validate at the outermost layer, narrow before forwarding

Two halves, and both are needed:

- **Validate before forwarding.** `CalendarViewer`, `ApiExplorer` and `SubscriptionBuilder` each call
  `assertTheme( bag.theme, '<own name>' )` before constructing their `CalendarControls`. This is exactly
  PR #76's shape for the `inputs` bag ("validated here purely for ATTRIBUTION, and the result discarded"),
  and it is what fixes defect 2.
- **Narrow before forwarding.** Each of the three forwards
  `narrowTheme( bag.theme, 'CalendarControls' )` rather than the caller's bag: a new `Theme.js` helper
  returning a bag that keeps every flat key and only those child keys `CalendarControls` itself owns.
  Without it, `SubscriptionBuilder`'s legitimate `subscriptionUrl` would be rejected by the inner
  `CalendarControls` validation under a class that has never heard of it.

Narrowing is applied by all three, not only by `SubscriptionBuilder` whose set differs today, so the rule
is mechanical: _a key naming this component's own child is not the controls' business_. For
`CalendarViewer` and `ApiExplorer` it is a no-op copy; if either ever gains a theme child of its own, the
rule already holds.

`SubscriptionBuilder` resolves its own `subscriptionUrl` theme from the **unnarrowed** bag, before
narrowing — the existing `resolveChildTheme( bag.theme, 'subscriptionUrl' )` line already runs at that
point and keeps doing so.

`DayViewer` and `CalendarResourcePicker` forward nothing and need neither half.

### D4 — error messages

Three shapes, in this order of preference:

1. An `ApiOptions` input name written at the top level, on a component that **has** an `ApiOptions` —
   unchanged from PR #75: `theme.yearInput is an ApiOptions input, which the theme bag reaches through
the nested key. Write it as theme.apiOptions.yearInput instead.`
2. Any other key not in the component's set, which **is** valid on some other component:
   `CalendarResourcePicker: theme.apiOptions is not a recognised theme key for this component. Valid keys
are: select, input, label, wrapper, riteSelect, calendarSelect. theme.apiOptions is valid on
CalendarControls, CalendarViewer, ApiExplorer, DayViewer, SubscriptionBuilder.`
3. A key valid nowhere — the same sentence without the final hint.

The existing per-child and per-input override messages are unchanged.

### D5 — evaluation order inside `assertTheme()`

For each top-level key:

1. Not in `FLAT_KEYS ∪ THEME_CHILD_KEYS[ componentName ]` → one of the three messages above. **This check
   moves ahead of everything else**, so a component with no `ApiOptions` reports `theme.epiphanyInput` as
   an unknown key rather than advising a nested spelling it also does not accept.
2. `apiOptions` → the existing `assertApiOptionsTheme()`.
3. A flat key → the existing string type check.
4. Otherwise a per-child override → the existing shape and per-key checks, unchanged.

## Backward compatibility

This turns silently-accepted keys into throws. A consumer passing a misplaced key gets a new exception
where it previously got library-default styling. That is the intent — a key that styles nothing is a bug
the consumer cannot otherwise see — but it is a behaviour change and goes under `### Behaviour changes`
in the CHANGELOG with this reasoning.

Nothing that styles something today stops styling it: the sets are derived from what each component
actually resolves.

## Testing

New suite `src/__tests__/MetaComponentThemeComponentAware.test.js`:

- `theme.apiOptions` and `theme.localeInput` throw on `CalendarResourcePicker`, naming it and the key.
- `theme.liturgy` and `theme.dateControls` throw on `CalendarControls`, `CalendarViewer`, `ApiExplorer`
  and `SubscriptionBuilder`; they are accepted on `DayViewer`.
- `theme.subscriptionUrl` throws on `CalendarControls`, `CalendarViewer`, `ApiExplorer` and `DayViewer`;
  it is accepted on `SubscriptionBuilder`, and a `SubscriptionBuilder` carrying one still constructs and
  still styles the URL control.
- The hint names the components where the key is valid.
- Attribution: a bad key passed to `CalendarViewer` / `ApiExplorer` / `SubscriptionBuilder` reports that
  component's name, never `CalendarControls`.
- `assertTheme()` with an unknown component name throws.
- The out-of-scope rule still holds: `theme.apiOptions.acceptHeaderInput` is accepted under a filter that
  never renders it.

## Interaction with held issues

- **#67 (theme presets)** — this makes presets _easier_: `THEME_CHILD_KEYS` is the authoritative list of
  what a preset may legally emit per component, so a preset can be expanded and then validated by the
  same guard rather than trusted. No preset is implemented here.
- **#63 / #68** — edits to `CalendarControls.js` are confined to theme validation.
