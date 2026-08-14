# Plan: apply a rite's published settings to the option inputs (#70)

Spec: `docs/superpowers/specs/2026-08-14-rite-settings-to-option-inputs-design.md`

Baseline on `main`: 72 suites / 1350 tests.

## Step 1 — reconcile the fixture with the live API

`src/__fixtures__/metadata.js`: restore `FULL_METADATA.ambrosian_calendars[0].settings`, copied verbatim
from `GET /calendars` (four temporal keys plus the ten-entry `holydays_of_obligation`). Rewrite the
comment above it: it now records that the fixture tracks the live response, that `dab21b5` removed the
block when the API served none, and that a fixture ahead of OR behind the API is wrong either way.

Run `yarn test` and confirm nothing regresses from the added block alone.

## Step 2 — failing tests first

New suite `src/__tests__/ApiOptionsRiteTemporalSettings.test.js`, driven by local metadata (not
`FULL_METADATA`) wherever the case needs an `IT` that diverges from the Ambrosian values on all five
keys — the shared fixture's `IT` carries no `holydays_of_obligation`.

Cases, per the spec's Testing section:

1. divergent nation -> rite switch shows the RITE's four values (fails before the fix)
2. clean page -> rite switch shows the rite's values (passes before; labelled as the case that hid it)
3. Ambrosian -> Roman leaves the four values alone (Roman publishes no settings)
4. Ambrosian -> Roman restores the holydays option list to `BASE_OPTIONS`
5. the holydays list under Ambrosian is exactly the published one — no merged-in Roman leftovers
6. `ApiClient` request body follows the rite (fails before the fix)
7. an `ambrosian_calendars` entry with no `settings` is a no-op on all five inputs
8. a published value no `<option>` carries leaves the input unchanged, not blank

Plus, in the same run, a `HolydaysOfObligationInput` case for `setOptions( list, false )` replacing
exactly while the default still merges — put it in the same new suite, since it exists only to serve
this path.

Confirm the expected failures, and that they fail for the stated reason.

## Step 3 — `HolydaysOfObligationInput.setOptions( options, merge = true )`

`src/ApiOptions/Input/HolydaysOfObligationInput.js`: add the second parameter. When `false`, validate the
array the same way `mergeOptions()` does and use it as-is. Default keeps every existing call identical.

## Step 4 — `ApiOptions`: the lookup, then the application

`src/ApiOptions/ApiOptions.js`:

- extract `#riteLevelCalendar( rite )` from `#applyRiteToLocaleInput()`; have both call it;
- add a `static #riteTemporalSettingInputs` map from setting key to input name;
- add `#applyRiteToTemporalInputs( rite )`:
  - resolve `settings` (may be `null`),
  - for each of the four: skip when the key is absent or no `<option>` carries the value; otherwise
    assign and dispatch `change` if it moved,
  - holydays: published -> `setOptions( list, false )`; not published -> `setOptions( [] )`; dispatch
    `change` if the selected-state map moved;
- call it from `applyRite()`, immediately **before** `#applyTemporalInputState( false )`.

## Step 5 — gates and documentation

`yarn test`, `yarn compile && yarn lint:dts`, `yarn format:js`, `yarn format:md`, `yarn lint:md`.

Docs: `CLAUDE.md` (a paragraph under Rite Wiring recording the rule and the holydays asymmetry),
`docs/api-options.md` if it describes the rite behaviour, and `CHANGELOG.md` under `## [Unreleased]`.

## Step 6 — review

`superpowers:requesting-code-review`, then `superpowers:receiving-code-review` on the findings, then
commit signed.
