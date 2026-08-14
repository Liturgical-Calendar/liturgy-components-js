# Plan: message catalogue fallback (issue #69)

Spec: `docs/superpowers/specs/2026-08-14-message-catalogue-fallback-design.md`

Each step is test-first: write the failing test, watch it fail for the right reason, then implement.

## 1. `src/MessageLookup.js`

- **Test** `src/__tests__/MessageLookup.test.js`, contract cases only at this stage:
  - `message( 'YEAR_TYPE' )` and `message( 'YEAR_TYPE', null )` return English.
  - `message( 'YEAR_TYPE', new Intl.Locale( 'it-IT' ) )` returns `Messages['it']['YEAR_TYPE']`.
  - `message( 'YEAR_TYPE', 'it-IT' )` returns the same — a tag string is normalized.
  - `message( 'SUNDAY_JAN2_JAN8', new Intl.Locale( 'ceb' ) )` returns English (no block).
  - `message( 'YEAR_TYPE', new Intl.Locale( 'zh' ) )` returns English (sparse block).
  - `message( 'MONTH', new Intl.Locale( 'zh' ) )` returns the `zh` string (present key).
  - `message( 'X', 'not a tag!' )` throws.
  - `message( 'NO_SUCH_KEY' )` throws naming the key and the catalogue.
- **Implement** `message( key, locale = null )`.

## 2. Six unguarded sites

- **Test** `src/__tests__/InputLabelLocalization.test.js`: replace the block comment that documents
  \#69's gap with a `describe` proving each of the six constructors survives `ceb` and renders the
  English string. Cover `new ApiOptions( 'ceb' )` as the headline case, and
  `new CalendarSelect( 'ceb' ).label( { class: 'form-label' } )`.
- **Implement**, one file at a time:
  1. `EpiphanyInput.js` — `SUNDAY_JAN2_JAN8`; drop the now-unused `Messages` import.
  2. `EternalHighPriestInput.js` — `FALSE`, `TRUE`; drop the import.
  3. `YearTypeInput.js` — `LITURGICAL_YEAR`, `CIVIL_YEAR`; drop the import.
  4. `CalendarPathInput.js` — `SELECT_ROUTE`; drop the import and the misplaced
     `?? 'Select route'`, whose `??` sat outside the throwing index and so never ran. A missing
     `locale` now also yields English rather than a `TypeError`, matching the constructor's own
     permissive `if ( locale && ... )` check.
  5. `CalendarSelect.js` line 969 — `SELECT_A_CALENDAR`.
  6. `LiturgyOfTheDay.js` line 176 — `LITURGY_OF_THE_DAY`.

## 3. Consolidate the correct guards

No behaviour change, so no new test; the existing suites are the regression net.

- `InputLabels.js` — `defaultLabelText()` delegates to `message()`.
- `RiteSelect.js` — the rite option labels and the `SELECT_A_RITE` label.
- `CalendarSelect.js` — `#riteLevelOptionHtml()`.
- `SubscriptionUrl.js` — `COPY_TO_CLIPBOARD`, `COPIED_TO_CLIPBOARD`.

## 4. Source-scan regression test

Add to `src/__tests__/MessageLookup.test.js`: no `Messages[ EXPR ][` with `EXPR !== "'en'"` anywhere
under `src/`, excluding `Messages.js`, `__tests__/`, and the two allow-listed files owned by #65.
Confirm it fails when the scan's allow-list is emptied.

## 5. Documentation

- `CLAUDE.md` — rewrite the Internationalization paragraph that describes this bug as outstanding;
  document `src/MessageLookup.js` and the declined warning. Add the module to the project-structure
  tree.
- `docs/api-options.md`, `docs/calendar-select.md`, `docs/liturgy-components.md` — only if they state
  behaviour this changes.
- `CHANGELOG.md` — `## [Unreleased]`, scoped to #69.

## 6. Gates

`yarn test`; `yarn compile && yarn lint:dts`; `yarn format:js`; `yarn format:md`; `yarn lint:md`.
