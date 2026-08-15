# Changelog

Releases up to and including 1.5.0 are not recorded here; see the git history. There is no 1.6.0 — the release
prepared under that number was skipped, and everything it was to have delivered ships in 2.0.0 instead. The
2.0.0 entry therefore covers the whole span since 1.5.0, not only the work that forced the major.

## [Unreleased]

### Behaviour changes

- **A meta-component theme key naming a child that component does not have now throws**, closing #78.
  `assertTheme()` validated a theme bag without knowing which children the receiving component actually
  had, so any key outside the four flat role keys was read as a per-child override, accepted, and then
  dropped in silence by `resolveChildTheme()` — `theme.apiOptions` on a `CalendarResourcePicker`, which
  bundles no `ApiOptions`, or `theme.liturgy` on a `CalendarViewer`, which has no `LiturgyOfAnyDay`. That
  is the issue-#43 failure mode by a different route: markup rendered with library defaults, no throw and
  no warning, and nothing to notice until an end-to-end selector broke. **A consumer currently passing a
  misplaced key gets a new exception where it previously got silently unstyled markup.** That is the
  intent — a key that styles nothing is a bug the consumer cannot otherwise see — but it is a behaviour
  change, and the fix is to move the key to the component that owns it or delete it. The message names
  the rejecting component, the key, the keys that component does accept, and the components the key is
  valid on. Nothing that styles something today stops styling it: the per-component sets are derived from
  what each component actually resolves. What is deliberately still accepted is theming an `ApiOptions`
  input the current `filter` never renders — all ten exist regardless of the filter, so that stays inert
  rather than becoming an error.
- **A bad theme key passed to `CalendarViewer`, `ApiExplorer` or `SubscriptionBuilder` is now reported
  under that component's own name**, not `CalendarControls`', also #78. All three forward their options
  bag to an internal `CalendarControls`, which named ITSELF when rejecting an option the caller had
  passed to a class they never touched — the misattribution PR #76 fixed for the `inputs` bag, and this
  fixes for `theme`. Each now validates under its own name before forwarding, and forwards only the keys
  `CalendarControls` owns, which is what keeps `SubscriptionBuilder`'s `subscriptionUrl` working while
  `CalendarControls` itself still rejects it.

- **Every `ApiOptions` input now renders a localized `<label>`**, closing #59. Nine inputs shipped the raw
  snake_case API parameter name — `ascension`, `corpus_christi`, `epiphany`, `eternal_high_priest`,
  `holydays_of_obligation`, `year_type`, `year`, `day`, `month` — and `LocaleInput` shipped `locale`, in
  every language. Since the `<label>` is what a screen reader announces for the control, this was an
  accessibility defect and not only a cosmetic one. 2.7.0 fixed only `locale`, and only for callers who
  mounted a meta-component. The lookup now lives in each input's own constructor, via the internal
  `defaultLabelText( key, locale )` in `src/ApiOptions/Input/InputLabels.js`, so a consumer who writes
  `new ApiOptions( 'it' )` with no meta-component anywhere gets localized labels too. **This changes
  rendered text for any consumer that never set a label of its own.** The existing overrides are unchanged
  and still win, since all of them are applied after construction: a meta-component theme's `labelText`,
  `LiturgyOfAnyDay`'s `dayInputConfig`/`monthInputConfig`/`yearInputConfig` bags, and direct assignment to
  `input._labelElement.textContent`.

### Documentation

- `LiturgyOfTheDay` is deliberately **not** given a live region under #65. It appends to its events wrapper
  and never clears it, so a second `calendarFetched` duplicates the day's events rather than replacing them —
  announcing "updated" over a component that is accumulating would describe something that did not happen. It
  is also pinned to today's date and owns no controls, so the select-driven silence #65 describes does not
  arise from anything it owns. The duplication is a real, separate defect, recorded here rather than fixed
  under this issue.

- `LiturgyOfAnyDay.listenTo()` still attaches its `calendarFetched` listener without releasing a previous
  one, unlike `WebCalendar.listenTo()`, so calling it twice renders — and now announces — twice per fetch.
  Pre-existing and untouched by #65, but recorded here because "exactly one announcement per user action" is
  now a stated contract that this one path can break.

- `LiturgyOfAnyDay`'s announcement names the date but not the calendar, so changing only the calendar or the
  rite while the date stays put produces identical text and a screen reader may not repeat it. Naming the
  calendar would mean giving that widget `WebCalendar`'s three-branch caption derivation and its rite
  tracking, neither of which it has. Recorded as a follow-up.

- `Theme.js`'s `applyLocaleInputTheme()` is unchanged in behaviour but its rationale is not: it justified
  writing the label unconditionally by citing `LocaleInput`'s hardcoded `'locale'`, which no longer exists.
  The write is now a no-op for every caller in this library — `CalendarControls.#language` is the same
  `locale.language` `ApiOptions` hands `LocaleInput` — and is kept only so a caller supplying a
  `defaultLabelText` from another catalogue is still honoured.

### Added

- **The `controls` slot of `CalendarControls` and `CalendarViewer` takes an object keyed by `ApiOptions`
  filter**, closing #63 — `controls: { allCalendars: '#calendarOptions', generalRoman: '#generalRomanOptions' }`
  mounts one pass per filter in a single call. 2.5.0 documented a two-pass `filter().appendTo()` idiom for
  the same layout; it worked, but it made the consumer reach through the component for the `ApiOptions`
  the component owns, and it rested on three rules the docs listed and nothing enforced — the second pass
  had to run after `appendTo()`, the filters could not overlap, and `ApiOptionsFilter.NONE` could not
  participate. All three now belong to the component. It performs the passes itself, so there is no
  ordering for a caller to get wrong; it runs `pathBuilder` before `allCalendars` whichever order the keys
  were written in, so the same bag mounts identically either way. Overlap is computed from the inputs each
  filter actually renders rather than from the key names, so `{ localeOnly, allCalendars }` throws naming
  both keys and `localeInput`, while `{ pathBuilder, allCalendars }` — which share only the year input
  `ApiOptions` already mounts once — is accepted. `none` as a key throws, and so does a filter-keyed bag on
  a component constructed with `filter: ApiOptionsFilter.NONE`. Valid keys are `generalRoman`,
  `allCalendars`, `pathBuilder`, `localeOnly` and `yearOnly`, plus `basePath` and `allPaths` as aliases of
  the first two, matching the enum's own alias members and `ApiExplorer`'s slot names; any other key throws
  naming it, and naming one filter under both spellings throws as a duplicate. Every container is resolved
  before anything is appended, so a typo in the last one leaves the document untouched. The rite and
  calendar selects mount into the first key named. **A bare `controls` target is unchanged**, the slot
  NAMES are unchanged, and the two-pass idiom stays supported and unwarned — it is `ApiOptions` public API,
  `ApiExplorer` uses it internally, and it is still the only way to reach a container the component does
  not own. `ApiExplorer` and `SubscriptionBuilder` are deliberately untouched: the first already has
  dedicated ordered slots and no `controls` slot to widen, the second mounts its children itself.
- **A visually-hidden live region on `WebCalendar` and `LiturgyOfAnyDay`**, closing #65. Both replace all of
  their content when a `<select>` changes — a whole table, a whole event list — while focus stays on the
  select, so a screen-reader user got silence, and no way to tell a successful update from a request that did
  nothing. Each now owns a `role="status"` / `aria-live="polite"` / `aria-atomic="true"` region, following the
  precedent `SubscriptionUrl` set in 2.7.0, announcing a short localized summary and never the content — a
  live region carrying the table would be catastrophic. `WebCalendar` announces the caption text and the
  entry count (`General Roman Calendar - 2026, 561 entries`), reusing the very string the `<caption>` carries
  so the two cannot drift and announcing it even when `removeCaption( true )` hides the element;
  `LiturgyOfAnyDay` announces the date (`Liturgy for Friday, 14 August 2026 updated`).

  The **first** render is deliberately silent, for two reasons: it is the page loading rather than a user
  action, and it is also the render that mounts the region, which has to be in the DOM before its content
  changes to be announced at all. "First" counts per REGION, not per instance, so `WebCalendar.dispose()` and
  an `announceUpdates( false )` followed by an `( true )` each restore the silence — all three rebuild or
  re-insert the region.

  `announceUpdates: false`, as a constructor option or as a chainable setter on either component, turns it off
  for a consumer that already owns a live region for the surrounding page.
  `src/__tests__/AnnouncementFrequency.test.js` confirms it fires exactly once per user action across a rite,
  a calendar and a locale change, which the request coalescing added in 2.5.0 is what makes true.

- **`src/MessageFormat.js` and `src/LiveAnnouncer.js`**, both internal and neither exported from
  `src/index.js`, on the same reasoning as `LocaleValidation.js` and `Theme.js`. The first gives the
  `{placeholder}` convention `Messages.js` already used — `AMBROSIAN_CALENDAR_CAPTION` and the two other
  captions — one home, adding the English fallback each call site wrote by hand and an `Intl.PluralRules`
  form selection. The second owns the hidden-region markup; `SubscriptionUrl` now uses it too.

- **Three `Messages` keys** — `CALENDAR_UPDATED_ANNOUNCEMENT_ONE`, `CALENDAR_UPDATED_ANNOUNCEMENT_OTHER` and
  `LITURGY_UPDATED_ANNOUNCEMENT` — in the twelve locales that already carry `SELECT_A_RITE`. Every other
  locale reaches English through the `??` fallback, as before. Only `_ONE` and `_OTHER` are populated, so a
  language whose plural rules select `few` or `many` takes its own `_OTHER`; each `_OTHER` is therefore
  written in the form its language uses with a large count, which is the only count a full liturgical year
  produces.

- **`HolydaysOfObligationInput.setOptions( options, merge = true )`** takes a second parameter, for #70.
  The default is unchanged and overlays `BASE_OPTIONS`, which is right for a national or diocesan calendar
  — every `holydays_of_obligation` the API publishes for one names all ten base keys. `false` uses the
  array verbatim, which is what a rite's list needs: merging it would leave the form asserting that
  `StJoseph` and `StsPeterPaulAp` are Ambrosian holy days of obligation. The validation `mergeOptions()`
  already did is now shared with the new branch as `HolydaysOfObligationInput.validateOptions()`, which
  differs from `mergeOptions()` in one respect: a non-array is an error rather than a request for the base
  options, since there is no base list to fall back to on that path.
- **`inputs: { acceptHeader: false }` on `CalendarControls`, `CalendarViewer` and `ApiExplorer`**, closing
  the first half of #61. `AcceptHeaderInput.hide()` sets a flag `ApiOptions.appendTo()` reads, so it was
  only expressible between construction and the append — a window `mountInto()` does not open. One boolean
  toggle therefore cost a caller the whole factory path, and with it `settled`, the signal that path
  publishes. The bag is resolved in `CalendarControls`' constructor (via a new internal
  `src/MetaComponents/InputVisibility.js`, not exported from `src/index.js`, like `Theme.js`), so both
  construction paths honour it. An unknown key is rejected by name, as is a non-boolean value or a
  non-object bag, before anything is mounted — and under the name of the class the caller actually used,
  since `CalendarViewer` and `ApiExplorer` each validate the bag themselves before forwarding it. Defaults are unchanged everywhere — `ApiExplorer` included,
  where the accept-header select is part of the path-building UI and drives `PathBuilder`'s `return_type`.
  `_acceptHeaderInput.hide()` still works and is unchanged.

- **`theme.apiOptions`, making the whole `ApiOptions` form themeable**, closing #60. The theme bag reached
  `riteSelect`, `calendarSelect` and (since 2.7.0) `localeInput` and nothing else, so every consumer of the
  meta-components still had to open with four process-wide `Input.setGlobalInputClass()` /
  `setGlobalLabelClass()` / `setGlobalWrapper()` / `setGlobalWrapperClass()` mutations — which leak onto
  every other component on the page, and which the theme bag exists to replace. A nested `apiOptions` key
  now carries flat role defaults (`select`, `input`, `label`, `wrapper`) for the whole bundle plus
  per-input overrides named for `ApiOptions`' own accessors, underscore stripped: `epiphanyInput`,
  `ascensionInput`, `corpusChristiInput`, `eternalHighPriestInput`, `holydaysOfObligationInput`,
  `localeInput`, `yearTypeInput`, `yearInput`, `acceptHeaderInput`, `calendarPathInput`. Only `yearInput`
  takes the `input` role. All ten exist whatever the `filter`, so theming one the current filter does not
  render is inert rather than an error. `CalendarControls`, `CalendarViewer`, `ApiExplorer`,
  `SubscriptionBuilder` and `DayViewer` all accept it; `CalendarResourcePicker` bundles no `ApiOptions`
  and is unaffected. The reason the docs previously gave for not doing this — that `filter` makes the set
  of inputs variable — did not hold: `filter` varies which inputs render, not which exist.

  **The key is an opt-in gate, and nothing changes without it.** While `theme.apiOptions` is absent, the
  flat keys reach exactly what they reached in 2.7.0. Naming it at all opens the gate (`{}` included),
  after which each input resolves per key, most specific first, over four tiers:
  `theme.apiOptions[ inputKey ]`, then `theme.localeInput` (that input only, 2.7.0's key, still fully
  supported), then `theme.apiOptions`' flat keys, then the outer bag's. Gating it this way keeps a minor
  release from silently restyling existing forms, and from consuming `Input.wrapper()`'s one-shot
  allowance on ten inputs that a consumer may still be styling by hand.

  **With the gate open, a themed input's `wrapper()`/`wrapperClass()` and `labelClass()` are consumed at
  construction**, so a later `controls.apiOptions._yearInput.wrapper( … )` or `.labelClass( … )` throws
  where it previously worked — the escape hatch `docs/meta-components.md` recommends. Before this key
  existed only the locale input could be closed this way. The `Input.setGlobal*` values do **not** close
  either: the constructor assigns them without marking the class as set, which is what keeps the
  globals-plus-per-input-override pairing working on a page mid-migration. Same rendered class, different
  behaviour afterwards, and both directions are pinned in
  `src/__tests__/MetaComponentThemeApiOptionsGlobals.test.js`.

  **An unrecognised key inside `apiOptions` throws, naming it**, at both new levels — the typo check that
  issue #43 was filed over now holds at the added depth. So does naming one of the other nine inputs at
  the TOP level, where only `localeInput` is answered: `theme: { localeInput: …, yearInput: … }` written
  by analogy would otherwise have had half of it silently dropped, and the error points at
  `theme.apiOptions.yearInput` instead. The per-input check is stricter than the
  top-level one: the role is known there, so a `liturgy`-role key such as `titleClass` on an input is
  rejected rather than accepted and dropped. The shorter spellings `epiphany`/`holydaysOfObligation` are
  deliberately not accepted — they would make the already-shipped `localeInput` inconsistent, and they
  collide with the API query parameters of the same name.

  Internally this is `Theme.js`'s new `applyApiOptionsTheme()`, which `CalendarControls` and `DayViewer`
  each call in place of their previous locale-input-only block; `resolveWrapperBag()` is reused rather
  than re-inlined, so a per-input `wrapperClass` with no element type still wraps in a `<div>` instead of
  raising "Wrapper has not been set". `Theme.js` remains internal and unexported from `src/index.js`.

- Six `Messages` keys backing those labels — `YEAR_TYPE`, `EPIPHANY`, `ASCENSION`, `CORPUS_CHRISTI`,
  `ETERNAL_HIGH_PRIEST`, `HOLYDAYS_OF_OBLIGATION` — populated for the same twelve locales that already carry
  `SELECT_A_RITE`, with the other 72 blocks degrading to English through the usual
  `Messages[language]?.[KEY] ?? Messages['en'][KEY]`. The four existing keys `DAY`, `MONTH`, `YEAR` and
  `LANGUAGE` are reused rather than duplicated.
- `DayInput`, `YearInput` and `HolydaysOfObligationInput` take an optional `Intl.Locale` —
  `new DayInput( locale )`, `new YearInput( locale )`, `new HolydaysOfObligationInput( options, locale )`.
  `null` (the default) means "not supplied" and yields the English label, so existing calls are unaffected;
  anything that is neither `null` nor an `Intl.Locale` throws, naming the class.

- **`VERSION`**, closing #64 — the package's own version as an exported string, so a running page can
  report which build it is on. `LiturgicalCalendarFrontend` resolves this library through a symlinked
  local build in development and a pinned CDN tag in production; the two silently diverged by five minor
  versions, and a pinned importmap could not settle it either, since jsDelivr rebuilds `+esm` bundles and
  a stale cache can serve an old module from a current-looking URL. The constant is hand-maintained in
  `src/Version.js` rather than generated, so **a release is now a two-file bump** — `package.json` and
  `src/Version.js`. Forgetting the second is a red build, not a false claim:
  `src/__tests__/Version.test.js` reads `package.json` off disk and fails on drift. It is declared
  `string` rather than a string literal type, so a consumer's version-floor comparison type-checks
  instead of raising TS2367 — enforced by `type-fixtures/dts-consumer.ts`, a new home for compile-time
  assertions about the emitted declarations, which `tsconfig.dts-check.json` checks against `dist/` the
  way a consumer would. Neither `yarn compile` (with `checkJs` off) nor a runtime test can see that
  regression, and `yarn lint:dts` could not either until the fixture existed, since a narrowed literal
  is valid TypeScript. There is no `ApiClient.version`: `ApiClient` and `ApiBase` deal in the API's
  own versioned base URLs (`/api/dev`), so a `version` there would read as the API's version rather than
  this package's. See `CLAUDE.md`'s Releasing section for the rejected alternatives.

- **`src/MessageLookup.js`, exporting `message( key, locale )`**: the canonical guarded read of the message
  catalogue for the call sites migrated onto it, added for #69. Not the library's only one:
  `src/MetaComponents/` still applies the same shape inline, correctly, and `WebCalendar`/`LiturgyOfAnyDay`
  remain unguarded (issue #83). Internal, and deliberately not exported from `src/index.js`, on the same
  reasoning as `LocaleValidation.js`, `OptionsValidation.js` and `WrapperOptions.js`. It accepts an
  `Intl.Locale`, a locale tag string or `null`, falls back to English for a missing block or a missing key,
  throws by name for an unparseable tag (through `toIntlLocale()`, so the underscore form every other locale
  entry point accepts is accepted here too), and throws by name for a key absent even from English. There is deliberately
  **no** `console.warn` on the fallback: a sparse block is the documented normal case here — several keys are
  carried by only twelve of the 84 locales — so a warning would fire once per input constructed for 72 locales
  that are working exactly as designed, and would start logging on four paths that already fell back silently.
  `InputLabels.js`'s `defaultLabelText()`, `RiteSelect`, `CalendarSelect` and `SubscriptionUrl` now delegate to
  it instead of each applying the guard by hand.
- `src/__tests__/MessageLookup.test.js` scans `src/` for the unguarded `Messages[ EXPR ][ KEY ]` shape and
  fails on any hit, so a seventh occurrence cannot be added silently. `WebCalendar.js` and
  `LiturgyOfAnyDay.js` are allow-listed with the reason stated in the test; guarding them keeps it green.

### Changed

- **`ApiOptions.appendTo()` iterates a single filter-to-inputs mapping** — the new internal
  `src/ApiOptions/FilterInputs.js` — instead of the five hard-coded `if` branches that used to be the only
  statement of which inputs each filter renders. #63's overlap check needs that same knowledge, and a
  second copy beside `appendTo()` would drift the first time a filter gained an input, so the mapping was
  extracted rather than duplicated. `src/__tests__/FilterInputs.test.js` re-derives the table from a real
  append, per filter, so the two cannot silently disagree. The two decisions that are instance state
  rather than properties of a filter stay in `appendTo()`: a hidden accept-header input, and the year
  input a `PATH_BUILDER` pass has already claimed. No behaviour change.
- **Line endings are now enforced, not merely documented**, closing #84. A new `.gitattributes` carries
  `* text=auto eol=lf`, and the seven files that had CRLF **in the index** — `.storybook/preview-head.html`,
  `DayInput.js`, `MonthInput.js`, `LiturgyOfAnyDay.js`, the two `LiturgyOfAnyDay*.stories.js` and
  `liturgyofanyday.css` — were renormalized in one dedicated commit that changes nothing else.
  `.prettierrc`'s `endOfLine` moves from `"auto"` to `"lf"`, which only becomes the right setting once
  normalization happens upstream: `"auto"` preserves whatever a file already has, so it would let a stray
  CRLF survive a formatting pass rather than fixing it.

  The convention was already stated in `.editorconfig` and honoured by prettier, but **neither can enforce
  it** — git never reads `.editorconfig`, and prettier only touches the files it is pointed at, so a
  scripted rewrite or a `sed -i` slips past both. It broke twice in a single day's work (PR #74 rewrote
  `MonthInput.js` whole-file, PR #82 did the same to `LiturgyOfAnyDay.js`), each caught only by a manual
  `file -b` check, since no test, linter or formatter reports it and `yarn format:js` passes either way by
  design. Nothing else changed: every renormalized file is byte-identical to its parent once `\r` is
  stripped, verified per file rather than assumed.

- **`settled` now observes the constructor path too**, closing the second half of #61. It was documented
  and implemented as "`mountInto()`'s initial fetch"; it is now "the most recent fetch this component
  issued", so a hand-constructed `CalendarControls`, `CalendarViewer` or `DayViewer` publishes the same
  signal from its own `fetch()` calls, each call replacing the last. Every other clause of the contract is
  unchanged: always resolves, never rejects, already resolved when nothing has been issued, throws once
  disposed. The promise `fetch()` returns is stored **raw** and normalized only when the `settled` getter
  is read — deriving from it eagerly would mark that very promise object handled and silently remove the
  platform's unhandled-rejection report for a caller who calls `fetch()` and ignores the result, which is
  the report `fetch()` relies on when it declines to log a promise the caller holds. `settled` is
  therefore a fresh promise object per read, settling at the same instant. Refetches driven by
  `ApiClient`'s own `listenTo()` change listeners are still not observed, on either path, and could not
  be: their promises never reach the component.

- **`CalendarSelect.value( val )` now throws for a non-empty value no option carries**, naming the select
  (with its element id, when it has one) and the offending value. This is the last point at which that
  particular mistake can be named at all: the DOM discards an unmatched value at assignment, so `value()`
  and every listener afterwards read back only `''`. The check is point-in-time and cannot be otherwise —
  a value accepted now stops matching when a rite change rebuilds the option list, and the selection then
  degrades to the rite-level calendar silently. `''` itself is still always accepted, including on a select
  with no empty option, because it is the documented way to ask for the rite-level calendar and lands on
  `selectedIndex === -1` by design. Writing to `_domElement.value` directly is unaffected — there is no
  setter to intercept — and issues no request of its own, since a property assignment dispatches no
  `change`; it simply leaves an empty selection, and the next `change` event to arrive is then handled
  as the rite-level calendar rather than crashing.

### Fixed

- **`LiturgyOfAnyDay` no longer goes permanently silent after a failed year refetch.** The
  `#refetchPending` flag that keeps the stale, pre-refetch render from being announced was cleared only by
  the `calendarFetched` handler, which a rejected request never reaches — so a single failed request would
  have suppressed every later announcement, including for the day and month changes that never refetch at
  all. It is now cleared whichever way the request settles, through a handler attached to a derived promise
  so `_discardRequest()`'s log-or-suppress rule is untouched. Introduced and fixed within #65.

- **`SubscriptionUrl`'s copy region was not actually clipped**, and gains `role="status"` and
  `aria-atomic="true"` in passing. It wrote `clip: rect(0 0 0 0)`; the space-separated form is not CSS2
  `rect()` syntax, so a strict parser discards the declaration outright — measured in jsdom, where the
  property reads back empty — leaving the region a 1x1 `overflow: hidden` box rather than a clipped one. It
  is now written as `rect(0, 0, 0, 0)`, with `clip-path: inset(50%)` alongside it since `clip` is deprecated,
  and `white-space: nowrap` so a long announcement cannot lay out as a tall column. Found while moving the
  markup into the shared `LiveAnnouncer` for #65.

- **A rite change now SETS the five option inputs whose values the rite fixes, instead of only disabling
  four of them**, closing #70. `ApiOptions`' `applyRite()` disabled `_epiphanyInput`, `_ascensionInput`,
  `_corpusChristiInput` and `_eternalHighPriestInput` and stopped there, with no rite-level counterpart to
  the `#applySettingsToInputs()` that applies a nation's settings — so the four froze at whatever was last
  displayed. Select Italy (`ascension: SUNDAY`), switch to Ambrosian, and the greyed-out select still read
  `SUNDAY` for a feast the Ambrosian Missal fixes to Thursday. It hid on an untouched form because the
  four inputs start at the empty `--` option, which lets the API apply the very defaults the Ambrosian
  rite happens to fix. The values are read from the rite's own `settings` block, which `/calendars` now
  publishes under `ambrosian_calendars[]` (LiturgicalCalendarAPI#776, shipped in PR 779) — not from a
  hardcoded table in `Enums.js`, which would copy liturgical law into the client where it can drift from
  the API in silence. A rite that publishes no settings, which is every Roman page, changes no value.
- **The request body follows the rite too**, which is the invisible half of the same defect.
  `ApiClient.fetchCalendar()` POSTs those four parameters plus `holydays_of_obligation` as the body of a
  rite-level calendar request, and learns them only from `change` listeners on the inputs — so a value
  picked by hand under the Roman rite was still sent to `/calendar/ambrosian`, the exact request the
  disable exists to prevent. Each input that actually moves now dispatches `change`, and `ApiClient`
  coalesces the burst into a single refetch.
- **`_holydaysOfObligationInput` is a fifth affected input**, which the issue's own table omitted. The
  published Ambrosian list is not a re-selection of the Roman one: it drops `CorpusChristi`,
  `MaryMotherOfGod`, `StJoseph` and `StsPeterPaulAp`, and adds `Circoncisione`, `Pentecost`, `StAmbrose`
  and `DedicationDuomo`. Because it is an option **list** the rite defines rather than a value, it follows
  the locale input's rule instead of the four values' rule — replaced by the rite's list, and restored to
  the input's own defaults for a rite that publishes none, so an Ambrosian-only entry cannot survive a
  switch back to the Roman rite.
- `src/__fixtures__/metadata.js` carries the Ambrosian `settings` block again, copied verbatim from the
  live `/calendars` response. It was removed in `dab21b5` because the API served none; the API then
  shipped one, leaving the fixture behind reality rather than ahead of it. Both directions turn a green
  test into a claim about nothing.

- **A throwing `onError()` callback no longer breaks the `settled` contract, or the `CalendarViewer`
  factory.** The callbacks run inside the very rejection handler each `mountInto()` builds its stored
  `settled` branch from, and `#deliverError()` invoked them unguarded — so a subscriber's own bug rejected
  that branch. Two consequences, both real: `CalendarViewer.mountInto()` **awaits** its stored branch, so
  the whole factory rejected and the caller received no viewer; and on the two paths that do not await, the
  branch rejected with nothing attached, producing precisely the unhandled-rejection report that
  `settled`'s "never rejects" clause exists to rule out. Deriving in the getter cannot cover that second
  case — it only attaches a handler when somebody actually reads `settled`. The delivery now goes through
  `Settled.js`'s `deliverFetchFailure()`, which cannot throw; a callback that throws is still reported to
  the console rather than swallowed. Found by CodeRabbit reviewing #76.

- **`settled` resolved with the calendar payload on the success path**, contrary to its documented
  contract of resolving with `undefined`. The factories built it with `.catch( handler )`, which passes a
  fulfilled value straight through, so the property became a second data channel beside
  `onCalendarFetched()` — free to drift from it, which is exactly what the contract exists to prevent.
  Only the failure path had ever been covered by a test. Found while widening `settled` for #61.

- **`settled` could reject**, despite "never rejects", when an `onError()` callback threw: the callbacks
  run inside the very rejection handler each factory builds `settled` from. Normalizing in the getter
  closes that structurally rather than by convention.

- **A `CalendarSelect` with nothing selected no longer crashes `ApiClient`'s `change` listener**, closing
  #66. Assigning a value no option carries leaves `selectedIndex` at `-1`, and the listener read
  `selectedOptions[0].value` off the missing option — a bare `TypeError` raised inside a listener, where
  the DOM swallows it, so the page simply stopped updating with nothing in the console naming the select.
  The listener now falls back to the rite-level calendar, which is the only thing the DOM still reports:
  `HTMLSelectElement.value` is `''` whenever nothing is selected, so the offending value has already been
  discarded and "nothing selected" is indistinguishable from "the empty option is selected".
  `PathBuilder`, `SubscriptionUrl` and `CalendarControls.fetch()` all read it that way already; this
  brings `ApiClient` into line with them.

  This was reachable without any programmatic help: `CalendarSelect#applyLinkedRite()` resets the value to
  `''` around its rebuild, an `allowNull( false )` select (the default) has no empty option to match, and
  the rite change then dispatches `change` straight into the crash — so an ordinary rite change on such a
  select, wired to an `ApiClient`, was affected.

- **A locale the message catalogue does not carry no longer throws**, closing #69. `Messages.js` holds 84
  locale blocks, and six sites read `Messages[locale.language][KEY]` — two unguarded index operations — so a
  language with no block at all failed on the first, with a bare
  `TypeError: Cannot read properties of undefined` naming neither the component, nor the locale, nor the fact
  that it was the message catalogue rather than the API that lacked the language. The worst of the six was
  `EpiphanyInput`, which `ApiOptions` builds in its constructor: since five of the six composed components
  build an `ApiOptions` — `CalendarControls` and `DayViewer` directly, the other three through
  `CalendarControls`; `CalendarResourcePicker` builds none — `new CalendarViewer( { locale: 'ceb' } )`, or any
  `locale` wired straight from `document.documentElement.lang`, died at construction inside a component the
  consumer never touched. The
  other five were
  `EternalHighPriestInput`'s, `YearTypeInput`'s and `CalendarPathInput`'s option and label text,
  `CalendarSelect.label()`'s default text, and `LiturgyOfTheDay`'s title. All six now fall back to English.
  Only a language with **no block at all** was affected: every key those sites read is present in all 84
  blocks, so a locale that merely lacks translations never reached it.
- `CalendarPathInput`'s `?? 'Select route'` fallback sat outside the throwing index and so could never have
  run; it is replaced by the catalogue's own English string. Constructing the input with no `locale` — which
  its own argument check deliberately permits — now yields the English label instead of a `TypeError`.

### Known gaps

- `AcceptHeaderInput` still renders `return_type` / `Accept Header` raw. It takes no locale, its label flips
  at runtime in `asReturnTypeParam()`, and it is `PathBuilder`-only; left for its own issue.
- `Input` has no public `labelText()` setter — the supported override remains
  `input._labelElement.textContent`, which the library itself uses.
- **#69's symptom is still reachable through two components**, because `WebCalendar.js` and
  `LiturgyOfAnyDay.js` still read the catalogue unguarded and are left to the issue already editing them.
  `LiturgyOfAnyDay` throws in its constructor, so `new DayViewer( { locale: 'ceb' } )` and
  `DayViewer.mountInto()` still throw; `WebCalendar` throws inside `buildTable()`, so a `CalendarViewer`
  now constructs under such a locale but still throws when it renders. `src/MetaComponents/` also still
  applies the guard inline rather than through `message()` — a consolidation left undone, not a bug. The
  source scan in `MessageLookup.test.js` allow-lists only those two files, so the gap cannot spread; it
  matches the shape the bug took rather than proving absence, and its doc comment lists what it does not see.

## 2.7.0

`SubscriptionBuilder`, the sixth meta-component, plus `ApiOptions`' locale-input theming extracted to one
place and applied to a second component.

### Added

- **`SubscriptionBuilder`**, closing #42 — a `CalendarControls` (rite select, an unfiltered
  `CalendarSelect` with a selectable empty option, and an `ApiOptions` restricted to its locale input)
  paired with a rendered iCal subscription URL and an accessible copy control, replacing the hand-rolled
  card in `LiturgicalCalendarFrontend`'s `usage.php`. Like `ApiExplorer`, it never calls `listenTo()`, so
  it never fetches and has no `settled`, `onError` or `initialFetch` — there is no calendar data to wait
  on. `appendTo()`/`mountInto()` take a required `{ controls, url }` slots object, the same
  two-mandatory-mount rule as `CalendarViewer` and `ApiExplorer`. A `scheme: 'https' | 'webcal'` option
  (default `'https'`) rewrites the URL's protocol so a calendar app that recognises `webcal:` opens its
  "add subscription" flow directly rather than downloading a file. Five options style and hook the copy
  control — `copyIcon`, `copyTitle`, `copiedText`, `copiedClass`, `onCopy` — and the control's wrapper IS
  the `<button>` itself, not a `<div>` around one: the card it replaces used `div[role="button"]` with no
  `tabindex` and no key handler, announcing a control to screen readers that could neither be focused nor
  activated by keyboard. `return_type` is pinned to ICS and `explicitRite` is set true so `/roman` always
  appears in the path, matching the card being replaced. `onChange(callback)` fires once per user action
  even when a single selection moves more than one input — coalesced onto a microtask and deduped by URL
  value, the same shape as `ApiClient`'s own refetch coalescing (#50). Two new `Messages` keys,
  `COPY_TO_CLIPBOARD` and `COPIED_TO_CLIPBOARD`, back the copy control's title and its `aria-live`
  confirmation. See `docs/meta-components.md`'s `SubscriptionBuilder` section for the full contract.

- **`Theme.js` gains `applyLocaleInputTheme()`**, an internal helper (not exported from `src/index.js`,
  like the rest of that module) that themes an `ApiOptions._localeInput`'s `class`, `labelClass`, wrapper
  and label text in one call. `DayViewer` and `SubscriptionBuilder` had each grown a near-identical block
  for this — `SubscriptionBuilder`'s was a copy-paste of `DayViewer`'s, made conditional on the theme
  where the original correctly was not, which is exactly the class of bug this extraction closes: the
  label text is set **unconditionally**, because `LocaleInput`'s constructor hardcodes its label to the
  raw, untranslated string `'locale'` (`LocaleInput.js:48`) with no i18n of its own, so an un-themed
  caller must still get a localized label rather than that literal string. `SubscriptionBuilder` ships
  with no such block of its own: its locale input is themed entirely through `CalendarControls`, since the
  whole options bag — including `theme` — already flows into its `new CalendarControls( bag )` call, and a
  second `wrapper()` call from a block of its own would have **thrown**, not silently no-opped —
  `Input.wrapper()` became one-shot in 2.6.0.

### Behaviour changes

- **`CalendarControls` now themes its locale input, and therefore so do `CalendarViewer` and
  `ApiExplorer`.** Previously `theme.localeInput` had no effect on `CalendarControls` at all —
  `apiOptions` was documented as "not a themeable child" with no exception. (`SubscriptionBuilder` is new
  in this same release, so this is not a behaviour change for it — it is built on `CalendarControls` and
  gets this theming from the day it first ships.) Three things follow for `CalendarControls`,
  `CalendarViewer` and `ApiExplorer`:

  - **The locale input's label is now localized instead of showing the raw `locale` string.** A
    `CalendarControls` (or anything built on it) constructed with no theme at all used to render the
    literal, untranslated word `locale` as this input's label; it now renders `Language` / `Lingua` /
    `Sprache` / … from the `LANGUAGE` message key, the same catalogue entry `DayViewer` already used for
    the same input. A theme-supplied `theme.localeInput.labelText` still wins.
  - **The flat `theme.wrapper` key now reaches the locale input too**, and so does a per-child
    `theme.localeInput.wrapperClass`/`wrapper` override — previously neither had any effect on this
    child. **This is the larger of the three changes**: a consumer who set a flat `wrapper` class expecting
    it to apply only to `riteSelect` and `calendarSelect` will now see a wrapper element appear around the
    locale input as well, which can shift layout. Review any `theme.wrapper` in use with `CalendarControls`,
    `CalendarViewer` or `ApiExplorer` before upgrading.
  - **This can also THROW, not just shift layout.** `Input.wrapper()` is one-shot (2.6.0), and a bag
    naming a class also closes `wrapperClass()` for the rest of that instance's life. With any
    `theme.wrapper` or `theme.localeInput.wrapperClass` in play, `CalendarControls` now consumes that
    single allowance on `apiOptions._localeInput` at construction — so the escape hatch
    `docs/meta-components.md` recommends for reaching an unthemed `ApiOptions` input, "reach the remaining
    inputs directly through `controls.apiOptions`", now throws when aimed at the locale input specifically:
    `controls.apiOptions._localeInput.wrapper( … )` or `.wrapperClass( … )` raises `Wrapper has already
been set on Input instance, and cannot be set twice.` (or the equivalent `wrapperClass()` message)
    once a theme has already themed that wrapper. `year_type`, `year` and the rest of `ApiOptions`' inputs are
    unaffected — this bag never touches them.

  See `docs/meta-components.md`'s `CalendarControls` "The theme bag" section for the full, updated rule,
  and the escape-hatch note beside "reach the remaining inputs directly through `controls.apiOptions`" for
  the throw above.

## 2.6.1

### Fixed

- **A per-child `wrapper` naming only the element type is no longer dropped in silence.** `wrapper` is an
  accepted per-child theme key for the `select` and `input` roles, where it names the wrapper's element
  **type** — as against the **flat** `theme.wrapper`, which `resolveChildTheme()` maps onto a wrapper
  **class**. Either alone is a complete instruction, but every meta-component gated its `wrapper()` call on
  `wrapperClass` alone, so `{ calendarSelect: { wrapper: 'td' } }` was accepted by the resolver, carried all
  the way to the call site, and dropped there: no wrapper, no throw, no warning.

  The gate is now `Theme.js`'s `resolveWrapperBag()`, which returns the `{ as, class }` bag or `null`, and
  all seven call sites use it — both selects in `CalendarControls`, `CalendarResourcePicker` and
  `DayViewer`, plus `DayViewer`'s locale input. Extracted rather than repeated: seven copies of a rule is
  how a rule ends up applied in some places and not others, which is exactly what had happened. It omits
  `class` rather than passing `undefined`, because `Input.wrapper()` rejects a non-string class **and**
  (since 2.6.0) treats a class named in the bag as final, closing `wrapperClass()` afterwards.

  `DayViewer`'s `dateControls` block is deliberately unchanged: it feeds a config bag to `LiturgyOfAnyDay`'s
  `dayInputConfig()`/`monthInputConfig()`/`yearInputConfig()`, which call `wrapper()` and `wrapperClass()`
  separately and already handled both keys.

  The gap predates 2.6.0 — the same guard stood before that release's refactor — but it is reachable
  through the documented theme vocabulary, so it is fixed rather than merely recorded.

### Documentation

- The **flat versus per-child `wrapper`** distinction is now stated explicitly in `docs/meta-components.md`,
  with an example. It had been implicit in a source comment, which is a fair part of why the gap survived.
- The control-method table in `docs/api-options.md` is whole again: 2.6.0's new "The wrapper bag" section
  was inserted between its last row and its `hide()` row, stranding `hide()` after the prose as a one-row
  table. Neither `markdownlint` nor `prettier` caught it, because a lone `|`-row **is** a valid table.
- `hide()` is documented accurately: it takes no parameter — `hide( false )` would not unhide — and exists
  only on `_acceptHeaderInput`, not on every control the table lists.

## 2.6.0

Two additions and one converged API: a first-class signal for `mountInto()`'s initial fetch, and the
`{ as, class, id }` wrapper bag on the last component that lacked it.

### Added

- **`settled` on `CalendarControls`, `CalendarViewer` and `DayViewer`.** `mountInto()` resolves to the
  component, not to the calendar data, and drops the initial fetch's promise — so a caller had no way to
  sequence on that first request: not to hide a spinner, not to assert in a test, not to know it had
  finished at all. `onCalendarFetched()` and `onError()` between them observe everything about that fetch
  except _when it finished_.

  ```javascript
  const viewer = await DayViewer.mountInto('#mount', { apiClient, onError });
  await viewer.settled; // the initial fetch has finished, one way or the other
  spinner.hide();
  ```

  It **always resolves and never rejects**, with `undefined`: a property present on every mounted instance
  that could reject would produce an unhandled rejection for every caller who never reads it, which is the
  trap `mountInto()` avoids by discarding. What is stored is the promise _after_ each factory's existing
  `.catch`, so it adds no error handling and changes none — outcomes stay with `onError()`, and the data
  stays with `onCalendarFetched()`. It is always a promise, already resolved when no initial fetch ran
  (`initialFetch: false`, no `apiClient`, or a hand-constructed instance).

  `CalendarResourcePicker` and `ApiExplorer` have none, deliberately: neither fetches, so neither has
  anything to settle. On `CalendarViewer` it is the very promise that factory already awaits, so it has
  settled by the time a caller can read it.

- **`Input.wrapper()` takes the `{ as, class, id }` bag**, the same one `CalendarSelect.wrapper()` and
  `RiteSelect.wrapper()` take, through the same shared validator — so the three cannot drift. This also
  brings a wrapper `id` to `ApiOptions` inputs, which had no way to set one, and lets a wrapper's type and
  class be set in one call rather than two:

  ```javascript
  apiOptions._yearInput.wrapper({ as: 'div', class: 'form-group col col-md-3', id: 'year-wrapper' });
  ```

  The bare tag name it has always taken still works — `wrapper('td')` is `wrapper({ as: 'td' })` — and is
  kept rather than deprecated, because `DayViewer`, `LiturgyOfAnyDay` and both example apps all pass one.
  `wrapperClass()` is unchanged for callers already using it.

  `Input.setGlobalWrapper()` is deliberately **not** given the bag. Its JSDoc now records why: the globals
  apply to every `Input` a page builds — `ApiOptions` alone builds more than a dozen — so a global `id`
  would be stamped onto every wrapper and emit invalid HTML with duplicate ids.

### Behaviour changes

- **Listener-driven fetches are deferred by one microtask** (from 2.5.0's coalescing, restated here because
  it is the change most likely to affect a downstream test suite). A test or consumer driving an input
  programmatically must `await Promise.resolve()` before asserting on `fetch`. The explicit fetch methods
  are unaffected.

- **`Input.wrapper()` may be called once; a second call now throws.** The behaviour removed was not
  something a caller could have relied on: it silently replaced the element and reset its class to the
  _global_ wrapper class while leaving the class-set flag true, so a class set through `wrapperClass()` was
  discarded without a word and the next `wrapperClass()` call threw an error naming a class the caller had
  never set.

  ```javascript
  input.wrapperClass('form-group col-md-3'); // ok
  input.wrapper('div'); // before: silently discarded that class
  input.wrapperClass('form-group col-md-3'); // before: threw, naming the global class
  ```

  **`setGlobalWrapper()` does not consume that one allowance.** The guard counts explicit `wrapper()` calls
  only, so the wrapper the constructor builds from the global does not count — a page that sets the global
  still gets one per-instance call. All three code bases were surveyed before this shipped
  (`LiturgicalCalendarFrontend`, `examples/`, `src/`) and no call site calls `wrapper()` twice. The one
  remaining path that could: calling `LiturgyOfAnyDay`'s `dayInputConfig()`/`monthInputConfig()`/
  `yearInputConfig()` twice with a `wrapper` key.

  A `class` named in the bag beats `setGlobalWrapperClass()` and counts as the class being set, so a later
  `wrapperClass()` naming something different throws. A class _inherited_ from the global does not, leaving
  `wrapperClass()` free — the pairing every page built on the globals relies on.

## 2.5.0

One user action now issues one request. This settles the cost 2.4.1 recorded as known and deferred, and
removes a rendering flicker that measurement had not attributed to it.

### Fixed

- **A single user action no longer issues several requests.** `ApiClient.listenTo()` attaches a `change`
  listener per input, and each one decided on its own to fetch. But a single action moves several inputs:
  a rite change makes `ApiOptions` rewrite the year floor, the calendar path, the locale options and the
  calendar select, each dispatching its own `change`. Those listeners ran in attachment order while the
  client's own state was still half-updated, so the leading requests described the state the user had just
  **left** — the previous rite, or the previous calendar. They now mark the client dirty instead, and one
  refetch runs on a microtask, built from the state the batch settled on. Every dispatch in the batch is
  synchronous, so the whole burst has landed before the flush and nothing beyond the current turn is
  swallowed.

- **The calendar no longer flashes the rite the user just switched away from.** This was the same defect,
  and measuring requests had hidden it. `#requestRevision` already dropped a superseded response before the
  `calendarFetched` emit, so a slow stale response could never overwrite a fresh one — but a wasted request
  answered **from cache** emits synchronously, at an instant when it _is_ the newest revision, so that guard
  had nothing to catch. The wasted requests were precisely the ones most likely to be cached, so a rite
  switch could deliver `roman`, `roman`, `ambrosian` to a `WebCalendar` while issuing only one request. The
  waste had to be removed at its source rather than filtered out on arrival; `#requestRevision` still earns
  its place for the overlap that remains, a user acting again before the previous response lands.

### Behaviour changes

- **Listener-driven fetches are deferred by one microtask.** A test or consumer that drives an input
  programmatically must let the flush run before asserting on `fetch`:

  ```javascript
  select.dispatchEvent(new Event('change'));
  await Promise.resolve(); // let the coalesced refetch go out
  expect(global.fetch).toHaveBeenCalledTimes(1);
  ```

  Only the listener path is affected. `fetchCalendar()`, `fetchNationalCalendar()`,
  `fetchDiocesanCalendar()` and `refetchCalendarData()` stay immediate, so consumers holding those promises
  — `LiturgyOfAnyDay` calls `refetchCalendarData()` three times — see no timing change. This is the split
  every data-fetching library draws between an automatic refetch and an explicit one.

- **Actions in separate turns still produce separate requests.** Coalescing collapses one action, never two.

### Not done, deliberately

Superseded requests are **not** aborted. After coalescing, requests overlap only when a user acts again
before the previous response lands; that response is already ignored before the emit, and letting it land
populates the cache, which makes switching back instant. `AbortController` would also need an `AbortError`
branch that must not emit `calendarFetchFailed` or reject the caller's promise as a failure.

Gating on the `isTrusted` event property was weighed and rejected. It distinguishes a user-originated event
from a dispatched one, but not a _settled_ state from an unsettled one: the trusted event runs last only
because `ApiOptions` is attached before `ApiClient`, so the guarantee would be listener attachment order
wearing a different name. It would also silence the documented `calendarSelect.value('')` path, which is a
synthetic dispatch, and it cannot be tested — jsdom reports `isTrusted: false` for `dispatchEvent()` and for
`element.click()` alike, and the property cannot be forged with `Object.defineProperty`.

## 2.4.1

### Fixed

- **A rite change no longer leaves the locale select and the requested locale disagreeing.** Switching
  rite rebuilds the locale input's options, which changes which locale is selected — but neither
  `setOptionsForCalendarLocales()` nor `resetOptions()` is a user edit, so neither fired a `change`
  event. `ApiClient` learns the locale only from a `change` listener on that input, so its
  `Accept-Language` kept whatever had last been chosen by hand and diverged from the form for good:
  pick French under the Roman rite, switch to Ambrosian, and the select read Italian while the request
  still asked for French — a locale that rite cannot serve, so the calendar came back in another
  language entirely. `applyRite()` now notifies when, and only when, the rebuild actually changed the
  selected locale — the same conditional the year clamp beside it already used, and the same
  notification the calendar-selection path already performed for this input.

  **Cost, measured:** a rite change that also changes the selected locale now issues additional requests
  before the correct one — `ApiClient` refetches on every input `change`, and a rite switch legitimately
  moves several inputs at once. The final request always carries the new rite and the displayed locale,
  and a rite change that leaves the locale alone still issues exactly one request. This is the same shape
  the calendar-selection path has always had (selecting a nation issues a request for the previous
  calendar first), not a new pattern; coalescing them is tracked separately.

  **`PathBuilder` was affected by the same defect and is fixed by the same change.** It reads the locale
  from that identical `change` listener, so its rendered URL kept the stale query parameter —
  `/calendar/ambrosian?locale=fr` while the form read Italian. `ApiExplorer` never fetches, so there the
  defect was visible purely in the composed path.

## 2.4.0

`CalendarViewer` gains the public mount path its documentation already described, and `RiteSelect`
gains the `wrapper()` every other select in the library already had.

`RiteSelect.wrapper()` takes the same `{ as, class, id }` bag as `CalendarSelect.wrapper()`, and the two
now share one internal validator, so the bag can never drift between them. `CalendarSelect.wrapper()`'s
observable behaviour — every accepted value and every error message — is unchanged, pinned by a
characterization suite added before the extraction, with two deliberate exceptions to its instance-state
and argument-mutation behaviour, listed under Behaviour changes below.

`CalendarViewer` was the only meta-component with no `appendTo()` and no `listenTo()`, so its
documented constructor path — "builds both halves but mounts neither" — was a dead end, and anything
that has to happen between construction and the mount was unreachable. `AcceptHeaderInput.hide()` is
the case that surfaced it: `ApiOptions.appendTo()` reads that flag when it decides whether to render
the input, so `hide()` is only meaningful beforehand, and `mountInto()` offers no such window. It now
has `appendTo()`, `listenTo()`, `fetch()`, `onCalendarFetched()` and `onError()`, and `mountInto()`
is implemented on top of them rather than duplicating their bodies. `listenTo()` exists as its own
method rather than being left to callers because the order is load-bearing: the controls must be
wired before the calendar, or a `WebCalendar` throw on empty data aborts the synchronous listener
loop before the messages renderer runs.

`RiteSelect.wrapper({ as, class, id })` matches `CalendarSelect.wrapper()` exactly. Its absence had
reached the meta-components' theme bag, whose `wrapper` role was resolved for the rite select and
then silently discarded by `CalendarResourcePicker`, `DayViewer` and `CalendarControls` alike,
because there was no method to pass it to.

### Fixed

- **`CalendarViewer.mountInto()`'s initial fetch now reports pre-request failures to `onError()`.**
  A failure raised before the request goes out — an unserviceable rite, an unusable locale — emits no
  `calendarFetchFailed`, so routing the dropped promise through `ApiClient#_discardRequest` could never
  reach an `onError()` callback. 2.3.0 fixed exactly this for `CalendarControls` and `DayViewer` and
  missed `CalendarViewer`, which kept the old seam. It now uses the same deduplicated delivery: the
  callbacks are tried first, and the console fallback runs only if nothing received the error.
- **`new RiteSelect({ label, wrapper })` honours both options.** The constructor accepted them and then
  silently dropped them, because nothing read them — so the bag form worked on `CalendarSelect` and
  quietly did nothing on `RiteSelect`. Both are now forwarded to the corresponding method, `label`
  first, as `CalendarSelect`'s constructor does.

### Behaviour changes

Four, all deliberate:

- **The theme bag's `wrapper` role now reaches the rite select.** A page passing flat
  `theme: { wrapper: '…' }` to `CalendarResourcePicker`, `DayViewer`, `CalendarControls`,
  `CalendarViewer` or `ApiExplorer` previously got that class on its calendar select only; its rite
  select is now wrapped too. A `wrapper` role honoured for one of two selects is not a role
  vocabulary. Pass `{ riteSelect: { wrapperClass: … } }` to give the two selects different wrappers.
- **`CalendarControls.appendTo()` and `CalendarViewer.appendTo()` reject unknown slot names**, naming
  the offending key, as `ApiExplorer.appendTo()` already did. `{ contorls: '#x' }` previously mounted
  nothing and returned successfully.
- **A rejected `CalendarSelect.wrapper()` call no longer poisons the instance.** The wrapper bag is now
  validated in full before anything is assigned, so a call that throws leaves the select exactly as it
  was and a retry with a valid bag succeeds. Previously the "wrapper has been set" flag was raised
  before `class` and `id` were validated, so a throw from either left the select permanently unable to
  accept a wrapper — reporting `"Wrapper has already been set"` about one that never was.
- **`CalendarSelect.wrapper()` no longer mutates the options object it is handed.** A caller that passed
  in a bag and kept a reference to it used to see that reference altered as a side effect of the call;
  it is now left exactly as passed.

## 2.3.0

Three more meta-components — `CalendarControls`, `CalendarViewer` and `ApiExplorer` — completing the family
2.2.0 started. Purely additive: nothing existing changes API or behaviour, and every test that existed
before this release still passes unmodified.

Where 2.2.0's two components each wrapped a fixed page, this release starts from the wiring two of those
pages shared, structurally identical apart from locale source, comment wording and minor content, and lets
the renderer vary on top of it. A `WebCalendar` example, a FullCalendar
one, and an API-explorer page all build the same rite select, calendar select and `ApiOptions`, wired the
same way to the same client, and then diverge only in what they do with the fetched data — one renders a
table, one hands the data to a third-party calendar library the components package has no business
depending on, and one never fetches at all. `CalendarControls` is that shared wiring with no renderer
bundled in; `CalendarViewer` adds a `WebCalendar` to it; `ApiExplorer` adds a `PathBuilder` and turns
fetching off. Bundling `WebCalendar` into `CalendarControls` itself would have solved two of the three call
sites and permanently excluded the fourth, so the renderer stayed out of the shared class instead of
becoming an assumption baked into it.

### Added

- **`CalendarControls`**, bundling a `RiteSelect`, a `CalendarSelect` and an `ApiOptions` into one mount,
  wired to one another and — through `listenTo()` — to an `ApiClient`. It absorbs the rite's two-wire
  requirement (`ApiOptions.linkToRiteSelect()` plus `apiClient.listenTo(riteSelect)`, the whole reason this
  component family exists) and an optional `messages` slot rendering the API's `messages` array as
  `<tr>` rows built with `textContent` — not `innerHTML`, unlike both examples this class replaces, so a
  message containing markup renders as text rather than as live elements.

  - **`onCalendarFetched(cb)` and `onError(cb)`** replace `apiClient._eventBus.on('calendarFetched', …)`, a
    private-field reach present in both of the examples this class was extracted from — despite
    `ApiClient.on()` having been public since 2.0.0. Neither example had been updated to use it.
  - **The initial fetch dispatches three ways.** `CalendarSelect` marks each option
    `data-calendartype="national"` or `"diocesan"`, and an empty value is the General Roman Calendar, so
    `fetch()` calls `fetchCalendar()`, `fetchNationalCalendar()` or `fetchDiocesanCalendar()` accordingly.
    One of the two examples this class replaces wrote only the first two branches by hand: a diocesan
    calendar selected as the initial value called `fetchNationalCalendar()` with a diocese id, silently
    requesting the wrong resource. The three-way dispatch is not a new feature so much as a bug fix folded
    into the extraction.
  - **`initialFetch: false`** wires the client — so a subsequent rite, calendar or option change still
    fetches — while skipping only the one fetch `mountInto()` would otherwise perform immediately. It does
    not by itself produce a component that never fetches at all; `ApiExplorer` (below) needs exactly that
    stronger guarantee and gets it a different way, by never calling `listenTo()` in the first place.

- **`CalendarViewer`**, a `CalendarControls` paired with a `WebCalendar` wired to the same `ApiClient` —
  the whole `WebCalendar` example page in one mount call. It adds nothing to `CalendarControls`' own
  wiring, ordering or fetch dispatch, reached unchanged through `viewer.controls`; it adds only the
  `calendar` slot and a `webCalendar` option bag applying named `WebCalendar` methods by key, rejecting
  immediately on a key outside that list. `controls.listenTo()` is wired before `webCalendar.listenTo()`,
  so the messages renderer (when named) always runs before `WebCalendar`'s own `calendarFetched` listener —
  which throws on malformed or empty calendar data — and so can never be suppressed by that throw.

  `CalendarViewer.mountInto()` additionally `await`s its dropped initial-fetch promise before resolving,
  unlike `CalendarControls.mountInto()` and `DayViewer.mountInto()`, which resolve immediately and let the
  fetch keep running in the background. This is deliberate, not an inconsistency: a viewer's whole reason
  to exist is its populated table, and resolving before the fetch's promise chain — including the
  `WebCalendar` listener and the messages render — has run at all would hand back a viewer whose table is
  still empty for a caller who had no reason to expect that.

- **`ApiExplorer`**, a `CalendarControls` paired with a `PathBuilder`, with fetching turned off — the whole
  "explore the API" page in one call, and the odd member of the family: every other meta-component adds a
  renderer that reacts to fetched data, while this one never fetches at all. Its constructor reuses only
  `CalendarControls`' construction and its direct `linkToCalendarSelect().linkToRiteSelect()` call, never
  `listenTo()` — which wires the rite → calendar chain AND turns every change into a live request under one
  name, and this class needs only the first half. It bypasses `CalendarControls.appendTo()` entirely too,
  since the page it was extracted from spreads one `ApiOptions` instance across three differently-filtered
  containers and positions the calendar select relative to one specific input rather than inside a
  container of its own — a layout `CalendarControls.appendTo()`'s single `controls` target cannot express.

- **Construction and mounting** for all three, following the same split 2.2.0 established: a synchronous
  constructor requiring an already-initialised `ApiBase`, paired with `appendTo()`, plus a static async
  `X.mountInto(target, options)`. `CalendarControls.mountInto()` and `CalendarViewer.mountInto()` **reject**
  when the API metadata cannot be loaded, with no failure control — a deliberate difference from
  `CalendarResourcePicker`, not an inconsistency waiting to be "fixed" into agreement with it. That picker
  substitutes for a single required form field, where an empty slot is indistinguishable from "still
  loading" and a disabled stand-in select is a meaningful thing to render. These two bundle a whole form: a
  `RiteSelect` and `CalendarSelect` with no calendars to list are not a smaller working form, they are no
  form at all, so there is no meaningful partial stand-in and construction is simply left to throw, exactly
  as `DayViewer` already does. `ApiExplorer` rejects the same way for the same reason, and never has a
  "failed initial fetch" case to resolve through at all, since it never fetches.

- **A `CalendarViewer` Storybook story** (`src/stories/1_CombinedComponents/`), following the CSS-free
  `.render.js` / `.stories.js` split 2.2.0's two stories established, with Bootstrap and unstyled variants
  differing only by the `theme` argument. `CalendarControls` gets no story of its own — it is already
  exercised through `CalendarViewer`'s — and neither does `ApiExplorer`, which needs five containers a
  single story cannot usefully show.

### Fixed

- **Jest was discovering two copies of every test file** whenever a worktree existed under
  `.claude/worktrees/` alongside the checkout, because `testPathIgnorePatterns` was unset. Measured during
  the 2.2.0 release as 43 of 86 files discovered twice, producing a phantom 1818-test run; CI never saw it,
  having no worktree, but any local run during worktree-based work silently doubled and produced at least
  one incorrect implementation report during phase 1 of this family. `package.json` now anchors
  `<rootDir>/.claude/` and `<rootDir>/.worktrees/` in `testPathIgnorePatterns`, so only files nested beneath
  the project root's own worktree directories are filtered, leaving the project's actual tests discoverable
  from either location.

## 2.2.0

Two meta-components — `CalendarResourcePicker` and `DayViewer` — plus the infrastructure they needed:
`EventEmitter.off()`, three `Messages` keys, and an internal theme resolver. Purely additive: nothing
existing changes API or behaviour, and every test that existed before this release still passes
unmodified.

The problem was duplication with teeth. `LiturgicalCalendarFrontend` had five call sites re-deriving the
same wiring by hand, each carrying a paragraph-long comment explaining a trap the library documented but
could not enforce — most sharply, that a `RiteSelect` needs **two** separate wires
(`linkToRiteSelect()` and `apiClient.listenTo(riteSelect)`) or the form reads `ambrosian` while every
request still goes to `/calendar/roman/`. A meta-component owns that wiring once, in the library, so
every consumer gets it correctly by construction instead of by careful copying.

### Added

- **`CalendarResourcePicker`**, bundling a `RiteSelect` and a filtered `CalendarSelect` into one mount —
  a rite select for choosing Roman or Ambrosian, and a calendar select scoped to national or diocesan
  calendars. It absorbs four behaviours that three frontend call sites previously duplicated: the rite
  select appears only for a diocesan filter (the Ambrosian rite has no national tier, so a
  `NATIONAL_CALENDARS` select under it would strand the user with a required field it cannot fill);
  append-then-link ordering; placeholder re-application after every rite change, which
  `linkToRiteSelect()` would otherwise silently discard by rebuilding the option list from scratch; and a
  visible failure control — a disabled, `is-invalid` select carrying an error message and
  `dataset.loadFailed = 'true'` — so a runtime failure (the API down, metadata unparseable) never leaves
  a container an end-to-end test can only fail to find ten seconds later, indistinguishable from "still
  loading".

- **`DayViewer`**, bundling a `RiteSelect`, a filtered `CalendarSelect`, an `ApiOptions(LOCALE_ONLY)`
  locale input and `LiturgyOfAnyDay` into one wired unit, mounted through either a single target or a
  slots object (`{ rite, calendar, locale, liturgy }`) naming one target per child — the page this was
  extracted from mounts its four parts into four separate containers, which a single `appendTo()` target
  cannot express. It absorbs the rite's two-wire requirement (the whole reason this component exists),
  General Roman Calendar as the default selection rather than Vatican, and the locale-matching cascade
  (exact match, then language-prefix match, then the first available option) that every consumer
  previously wrote out by hand — exposed as `viewer.selectedLocale`.

- **The theme bag**, resolved internally by `src/MetaComponents/Theme.js` (not exported — same reasoning
  as `LocaleValidation.js` and `OptionsValidation.js`: internal contract, not public API) and shared by
  both meta-components. Its vocabulary is HTML roles, never framework names: a flat `select`/`label`/
  `wrapper`/`input` key styles every child of that role, and a per-child override
  (`riteSelect: { class: '...' }`, named for the meta-component's own public getter) wins per-key over
  the flat default rather than replacing a child's styling wholesale. `labelText` is a per-child-only key
  with no flat equivalent, setting a themed child's label TEXT — needed because `CalendarSelect.label()`
  and `RiteSelect.label()` are one-shot, so reaching `picker.calendarSelect.label({ text: '...' })` after
  the theme bag has already themed that child's label throws. Two constraints are worth stating plainly
  rather than discovering by trial:

  - **Every class-string value, flat or per-child, is validated by the same shared
    `Utils.validateClassName()`** every other class-taking method in this library already uses — which
    this release widened; see Changed below. Utility-framework classes work as written.
  - **`RiteSelect` has no wrapper concept**, so the flat `wrapper` key and a `riteSelect.wrapperClass`
    override are both silently unused for it. `CalendarSelect` and, on `DayViewer`, the `ApiOptions`
    locale input both support one.

- **`CalendarResourcePicker.required()`**, and a matching `required` constructor option, marking the
  working select `required`. Without it, a form needing a mandatory calendar field had to write
  `picker.calendarSelect._domElement.required = true` — reaching through the component into a private
  field, which is the pattern the meta-components exist to retire. It is deliberately never applied to
  the failure control: that control is `disabled`, and a disabled element is barred from constraint
  validation and excluded from submission entirely, so `required` on it would be inert. A form that must
  not submit without a calendar therefore needs `required` for the ordinary case and its own check of
  `picker.failed` for the case where the calendar list could not be loaded at all.

- **Construction and mounting**: each meta-component has a synchronous constructor — requiring an
  already-initialised `ApiBase`, exactly as `CalendarSelect` does today — paired with `appendTo()`, and a
  static async factory, `X.mountInto(target, options)`, which awaits the client, constructs, mounts, and
  installs the failure control on a runtime failure. Programmer error and runtime failure are handled
  differently, on purpose, and this is the one place in this release where "resolves" rather than
  "rejects" is deliberate rather than a gap: an invalid option (an unparseable locale, an unknown filter,
  a target that matches nothing) **rejects**, matching this library's 2.0.0 direction, while a runtime
  failure — the API down, metadata unparseable — **resolves** with the component in a failed state and
  its failure control already rendered. These mount into forms where an empty container is
  indistinguishable from "still loading", with nothing for a `waitFor` to point at ten seconds later.
  `mountInto()` also resolves to `null`, without throwing or rejecting, when a supplied `signal` was
  already aborted or the target left the DOM while the client was resolving — a scope change landing
  mid-await, which three frontend call sites previously guarded against three different ways.

- **`dispose()`** on both meta-components: idempotent, and a disposed instance throws on further use
  rather than failing quietly, across every public member — not only the DOM-facing ones. What it
  releases: every listener and subscription the meta-component itself attached, and the mounted DOM,
  which is emptied. **What it cannot release, and why:** the `change` listeners `ApiClient.listenTo()`
  attaches internally to the rite select, calendar select and `ApiOptions` inputs, and (on `DayViewer`)
  the `calendarFetched` listener `LiturgyOfAnyDay.listenTo()` attaches to the client's event bus. Both are
  anonymous closures created inside methods the meta-component does not own, attached via
  `addEventListener`/`on()` with no reference stored anywhere reachable — not even by `ApiClient` itself.
  This is a pre-existing gap in the wired components, not something `dispose()` papers over by claiming
  otherwise: a disposed meta-component's own DOM and event-bus footprint are gone, but the same
  `ApiClient` can still be driven by the same selects if a caller kept a separate reference to them.

- **`EventEmitter.off(event, listener)`**, purely additive and useful on its own. Without it,
  `DayViewer.dispose()` could only ever be partial — dropping its own DOM listeners and child references
  while its `ApiClient` subscriptions kept firing against a detached tree. Removes one registration per
  call, mirroring `on()`, which appends unconditionally; a listener added twice must be removed twice.
  Unknown events and unregistered listeners are no-ops.

- **Three `Messages` keys** — `DAY`, `YEAR` and `LANGUAGE` — added for the same 12 locales that already
  carry `SELECT_A_RITE` (`de en es fr hu id it la nl pt sk vi`), with English fallback beyond, matching
  that key's existing coverage rule rather than inventing a second one. This deletes the 90-line hand-
  copied translation map `liturgyOfAnyDay.js` carried for exactly these three concepts, because `Messages`
  itself is not exported — `DayViewer` is what consumes it internally now. The fallback is per **key**,
  not per **locale**: a locale missing only `DAY` still shows its own translation for `MONTH`, which is
  translated for all 84 locales, rather than reverting the whole viewer to English.

### Fixed

- **`DayViewer`'s eight `LiturgyOfAnyDay` styling keys now reach the widget** ([#43]). The theme
  resolver's per-child allow-list was written for `<select>`-shaped children and never widened, so
  `titleClass`, `dateClass`, `dateControlsClass`, `eventsWrapperClass`, `eventClass`,
  `eventGradeClass`, `eventCommonClass` and `eventYearCycleClass` were stripped in transit. The loop
  in `DayViewer`'s constructor that names all eight and calls the matching setter was therefore
  unreachable, and a consumer theming the event rows or the date header got library defaults with no
  throw and no warning — the reporter only noticed because an end-to-end selector broke. The allow-list
  is now per role, and `LiturgyOfAnyDay` has its own.

- **`onError()` now hears about failures raised before the request goes out** ([#43], second defect).
  `ApiClient` deliberately emits no `calendarFetchFailed` for an error thrown before a request is
  issued — an unserviceable rite, an unusable locale — on the reasoning that the event reports a
  request that failed, not one that was never made. But `onError()` callbacks subscribe to exactly
  that event, and `DayViewer.mountInto()` skipped its console fallback whenever a callback was
  registered, assuming the callback would handle it. The three combined into total silence: no
  callback, no log, and the rejection swallowed by the factory's own `.catch()`. Passing `onError()`
  was therefore strictly WORSE than omitting it — omit it and the console line at least appeared.

  `DayViewer` and `CalendarControls` now deliver such a failure to their callbacks directly, and fall
  back to the console only when nothing received it at all. An error that did travel the event bus is
  still delivered exactly once. `ApiClient`'s own behaviour is unchanged — the fix belongs in the
  meta-components, which are the ones making the promise.

- **An unrecognised per-child theme key now throws, naming it.** Silence is what made the above
  invisible: the keys passed validation, were discarded, and the markup simply rendered with defaults.
  A key valid for one role but named on a child of another is still dropped rather than rejected —
  `assertTheme()` validates a bag without knowing which children a given component has, so it catches a
  misspelling but not a misplacement.

[#43]: https://github.com/Liturgical-Calendar/liturgy-components-js/issues/43

### Changed

- **`Utils.validateClassName()` now accepts utility-framework class names**, across every component that
  takes a class — not only the meta-components. It previously demanded
  `/^(?!\d|--|-?\d)[a-zA-Z_-][a-zA-Z\d_-]{1,}$/`, which describes a CSS _identifier_. A `class`
  attribute does not hold identifiers; it holds a space-separated token list, and a token may contain
  any character except whitespace. The old rule therefore rejected `md:w-1/2`, `hover:bg-blue-500`,
  `2xl:flex`, `p-1.5`, `bg-[#1da1f2]`, `w-[calc(100%-2rem)]` and `[&>*]:mt-2` — and rejected them by
  **throwing**, so a Tailwind consumer could not use these components at all rather than merely seeing
  them unstyled.

  A token is now accepted when it is non-empty and contains no whitespace, quote character, backtick or
  `<` — the characters that can only arrive from a caller's mistake, such as forgetting to split on
  whitespace or letting markup leak into a class string. Those still throw `Invalid class name: …`.

  This widens what is accepted and rejects nothing that was previously accepted, so no working code
  changes behaviour. `LiturgyOfAnyDay` and `LiturgyOfTheDay` each carried a private copy of the old
  regex; both now delegate to `Utils.validateClassName()`, so the rule has one definition rather than
  three that could drift apart.

- **`assertTheme()` validates the values inside a per-child override, not only its shape.**
  `{ calendarSelect: { class: 42 } }` previously passed the theme guard and failed later inside
  `CalendarSelect.class()`, reporting the caller's mistake under the child's name — the same
  misattribution the meta-components validate locale and filter themselves to avoid. It now throws
  under the meta-component's own name, identifying the exact key:

  ```text
  DayViewer: theme.calendarSelect.class must be of type `string` but found type: number
  ```

  An explicitly `undefined` value is still accepted and resolves as absent.

- **`CalendarResourcePicker.appendTo()` may be called more than once.** A second call previously threw
  `Current CalendarSelect instance is already linked to a RiteSelect instance`, from a child the caller
  never touched, because `linkToRiteSelect()` is one-shot. The link is between the two component
  instances rather than their positions in the document, so it now happens once per pairing and
  survives a move; the picker's own placeholder listener is released and re-registered, leaving one
  mount's worth of listeners live at a time. Re-mounting a failed picker no longer strands its previous
  failure control in the old container.

- **`DayViewer.listenTo()` refuses to rebind**, and refuses a client bound to a different `ApiBase` than
  its own children, both **before** any wiring happens — so a rejected call leaves the viewer exactly as
  it was. A second call already failed, but only by accident of `ApiOptions.linkToCalendarSelect()`
  being one-shot, and it failed under `ApiOptions`' name. A mismatched base was not checked at all, and
  would have produced a viewer whose selects list one API's calendars while its requests went to
  another.

- The failure control no longer carries a `required` attribute. It is `disabled`, which bars it from
  constraint validation entirely, so the attribute was inert and its accompanying comment — claiming
  submit validation would still block — was wrong.

### Notes

- Two Storybook stories, one per meta-component, each rendered twice from one source with a Bootstrap and
  an unstyled theme bag — replacing the duplicate-story pattern `0_Components/` used for the same purpose.
- `Messages` remains unexported. Translating the three new keys beyond the 12 locales listed above is
  explicitly out of scope: machine-translated liturgical UI is not worth the risk, matching the same
  decision `SELECT_A_RITE` made when it landed.

## 2.1.0

A new way to wire a `RiteSelect` into an `ApiOptions`, and two path builder bugs that were reaching real pages.
Minor rather than patch: `ApiOptions.linkToRiteSelect()` is a new public method. Nothing is removed and nothing
changes behaviour for code that does not use the rite components — the one deprecation keeps working and warns.

Both halves are the same mistake wearing different clothes: rite state that reads as wired when it is not, or
that is written at a call site instead of derived where its inputs meet.

### Added

- **`ApiOptions.linkToRiteSelect( riteSelect )`**, chainable, replacing the second argument of
  `linkToCalendarSelect()`. The two link methods may be called in **either order** — whichever arrives second
  completes the pairing — so migrating cannot introduce an ordering bug, and neither does anything on its own:

  ```js
  // Before
  apiOptions.linkToCalendarSelect( calendarSelect, riteSelect );

  // After
  apiOptions.linkToCalendarSelect( calendarSelect ).linkToRiteSelect( riteSelect );
  ```

  The point is not fewer calls — there were always two, and there still are. It is that the second one no longer
  hides inside the first. **On a page that fetches, `ApiOptions` is only half the wiring:** it rebuilds the
  calendar list, disables the temporal options the rite fixes and adjusts the year floor, but only the client
  turns the rite into a path segment.

  ```js
  apiClient.listenTo( calendarSelect ).listenTo( riteSelect ).listenTo( apiOptions );
  ```

  Omit `listenTo( riteSelect )` and the failure is **silent**: the form reads `ambrosian`, the calendar list
  rebuilds with the Ambrosian dioceses, the temporal inputs grey themselves out — and every request still goes
  to `/calendar/roman/`. That bug was shipping in this project's own frontend. A page that only renders a form,
  with no `ApiClient`, needs no second wire.

  Linking is idempotent and one-way per instance: a second link throws, from either side, including a deprecated
  second argument arriving after `linkToRiteSelect()`. Wiring twice would put two `change` listeners on one rite
  select and rebuild — and dispatch — twice per change.

- `CalendarSelect._showRiteLevelCalendarOnly()`, which collapses a select to the rite-level calendar under that
  calendar's own localized name. Used by the path builder for the `/calendar` route.

### Deprecated

- **The second argument of `ApiOptions.linkToCalendarSelect()`.** It still works and now warns, naming
  `linkToRiteSelect()`. The warning is emitted after `calendarSelect` validation, so a call that goes on to
  throw does not also warn about an argument that never took effect.

### Fixed

- The path builder's calendar select **rendered blank on load**, then showed a wrong, sticky `GENERAL ROMAN`.
  Two causes compounding. `ApiOptions` wrote a hardcoded, unlocalized `<option value="">GENERAL ROMAN</option>`,
  rite-independent — so an Ambrosian request announced itself as the General Roman Calendar — when
  `CalendarSelect` had had a rite-aware, localized version of exactly that since rite support landed. The same
  call also set `allowNull( false )`, and because the calendar select is linked _before_ the rite is wired, the
  rite's first `_applyRite()` rebuilt the options with no empty option at all; `value = ''` then matched nothing,
  leaving `selectedIndex` at `-1`. Hence blank until the user round-tripped through another route — the one path
  that re-injected the option.
- The path builder's calendar select **disappeared for good** after selecting a rite with no national tier while
  the `/calendar/nation/` route was active. `hidden` was written in one place but derived from two inputs, filter
  and rite: hiding was correct, but `ApiOptions` then forced the route back to `/calendar`, moving the filter off
  `NATIONAL_CALENDARS`, and the only `_setHidden( false )` lived in the `NATIONAL_CALENDARS` branch — while the
  nation route that would return there is disabled under precisely that rite. Visibility is now derived in
  `#reapplyOptionsToDom()`, the single point both `_applyFilter()` and `_applyRite()` pass through.

## 2.0.0

Two breaking changes forced the major version, and both are the same change of mind: a failure the library used
to log and swallow is now a rejection the caller owns. `ApiClient.init()` rejects instead of resolving to
`false`, and the fetch methods return a promise that rejects instead of one that cannot fail. Everything else in
this release is additive, a deprecation, or a narrower break — two of the three reach only code that imports
past the package's public exports, and the third refuses an argument the components used to accept and quietly
ignore. One entry under Breaking is none of those and changes no code at all: the package now declares the
ES2022 floor it has always required.

The work merged after 1.5.0 that never got a release of its own is folded into the sections below rather than
kept apart: `CalendarSelect.linkToRiteSelect()`, the rite vocabulary in ten more languages, and the path
builder's ability to re-filter its calendar select. Upgrading from 1.5.0 brings all of it.

### Breaking

- `ApiClient.init()` now **rejects** when the API cannot be reached, instead of logging the error and resolving
  to `false`. It rejects with an `ApiClientError` carrying `url`, `status`, `statusText` and `body` when the
  `/calendars` request fails, and with a plain `Error` when the `url` argument itself is not a non-empty string
  or is not an absolute `http:`/`https:` URL.
  Nothing is thrown synchronously, so a single `.catch()` covers both. Add one — or wrap the `await` in
  `try`/`catch` — at every call site:

  ```js
  // Before
  ApiClient.init( BASE ).then( apiClient => {
      if ( !apiClient || !( apiClient instanceof ApiClient ) ) {
          // handle failure
      }
      // …
  } );

  // After
  ApiClient.init( BASE )
      .then( apiClient => { /* … */ } )
      .catch( error => {
          // error.url, error.status, error.statusText, error.body
          console.error( `Could not reach ${error.url}: ${error.message}` );
      } );
  ```

  The `instanceof` guard is now dead code and can be deleted: the `then` callback only runs on success.

- `fetchCalendar()`, `fetchNationalCalendar()`, `fetchDiocesanCalendar()` and `refetchCalendarData()` now return
  a promise that **rejects** when the request fails. They previously returned `undefined` and ended in a
  `.catch()` that logged the error with `console.error` and swallowed it, so a failed request could never reach
  the caller. Called as a bare statement — the documented idiom, and what every example in this repository did —
  a failure now surfaces as an unhandled promise rejection instead of a logged error:

  ```js
  // Before — returned undefined; the library logged any failure for you
  apiClient.fetchCalendar( 'en' );

  // After — handle the promise
  apiClient.fetchCalendar( 'en' ).catch( error => {
      console.error( `Could not fetch from ${error.url}: ${error.message}` );
  } );

  // …or report failures once, through the event, and discard the individual promise
  apiClient.on( 'calendarFetchFailed', error => showBanner( error ) );
  apiClient.fetchCalendar( 'en' ).catch( () => {} );
  ```

  The promise resolves to this request's calendar data — or, if a newer request superseded it in flight, to the
  client's current data — and rejects with an `ApiClientError` after emitting `calendarFetchFailed`. Nothing is
  thrown synchronously, so — as with `init()` — a single `.catch()` covers every failure mode, including the
  ones that never get as far as a request. An API that cannot serve the current rite, a
  `fetchNationalCalendar()` under a rite with no national tier, and a `locale` that is neither a parseable tag
  nor an `Intl.Locale` used to throw at the call site, past any `.catch()` written around it; they now reject
  too, with exactly the plain `Error` they threw rather than an `ApiClientError`, since there is no request
  context for one to carry. They emit no `calendarFetchFailed`: it reports a request that failed, not one that
  was never made. A promise
  you hold is yours: the library does not log it on your behalf. Its `console.error` fallback covers only its
  own fire-and-forget calls — the listeners behind `listenTo()`, and `LiturgyOfAnyDay`'s year handling — which
  have no caller to hand a promise back to, and one of those is silenced when the error it caught was itself
  delivered to a `calendarFetchFailed` listener. Subscribing is therefore the intended way to take over
  reporting of request failures — but only of those: an error that never emits is still logged, because no
  subscriber could have received it. Two never emit. An argument or state rejection reports a request that was
  never made, and a throw from a `calendarFetched` listener is **not** a fetch failure — it propagates to the
  returned promise unwrapped.

Three narrower breaks, listed for completeness:

- The `ApiClient` constructor now takes the `ApiBase` it is bound to: `new ApiClient( base )`. It previously
  took no arguments and worked standalone, because the URL and metadata were statics. `new ApiClient()` — or
  any call whose argument is not an `ApiBase` — now throws immediately, naming `ApiClient.init()` as the way
  to obtain a client, rather than leaving the client with no base for a later fetch to fail on unhelpfully.
  `ApiClient.init()` was always the documented way to obtain a client and is unaffected; the constructor is
  worth knowing about because it is how a test builds a client on a base from `ApiBase.fromMetadata()`.
- `LocaleInput` now requires an `ApiBase` as its second constructor argument and throws without one. It is not
  exported from the package root, so this only affects code deep-importing
  `ApiOptions/Input/index.js`. Construct an `ApiOptions`, which supplies the base itself, or pass one:
  `new LocaleInput( locale, apiClient.base )`.
- `CalendarSelect`, `RiteSelect`, `LiturgyOfTheDay` and `LiturgyOfAnyDay` now reject an options argument that is
  none of a string, an `Intl.Locale`, a plain object or nullish, as `ApiOptions` already did. Each of the four
  previously accepted any class instance and then took every default, English
  included: `new CalendarSelect( new Date() )` built an English select and warned about nothing, because a
  `Date` shares not one property name with `locale`, `id`, `filter` or any other option and so destructures to
  `{}`. The test is by prototype, so any class instance is refused and a null-prototype object still passes; the
  message names the component and the type it found —
  ``CalendarSelect: Invalid type for options, must be of type `object` but found type: Date``. A locale string
  or a genuine options object is unaffected, and `Intl.Locale` is a recognized form in its own right rather than
  an exception to this guard — see **Added** below.

And one entry that breaks no code, because it changes none — what narrows is what the package says it needs:

- **ES2022 is now the declared runtime floor.** `tsconfig.json` pins `"target": "ES2022"` in place of
  `"esnext"`, which drifted with every TypeScript release and so stated no contract at all, and the browser
  support lines in `README.md`, `CLAUDE.md` and `docs/installation.md` name concrete engines in place of
  "modern browsers with ES6 module support", a bar 2017-era engines cleared:

  ```text
  Before — Modern browsers with ES6 module support.
  After  — Chrome/Edge 94+, Firefox 93+, Safari 15.4+, Node.js 16.11+.
  ```

  **The requirement is not new; only the statement of it is.** 1.5.0 already shipped `static #` private fields
  and `Object.hasOwn`, and 2.0.0 adds `Error`'s `cause` — the latter two are ES2022 _runtime_ APIs, which no
  compiler `target` can transpile away, and the published build ships no polyfills, so an engine below the
  floor cannot run the artifact as published. It binds what is shipped, not what you build: a consumer whose
  own toolchain transpiles the syntax and polyfills those two APIs (core-js does both) is not bound by it.
  Nothing to do if your engine clears it, and everything released since March 2022 does. If it does
  not, then 1.5.0 did not work there either and pinning to it is no remedy; Safari 15.0 through 15.3 is the
  case to actually watch for, since it has `Error`'s `cause` but not `Object.hasOwn` — which this package calls
  while validating the calendar index, and again wherever a component reads its options bag. The floor is
  stated in the documentation, not enforced by a `package.json` `engines` field, so neither npm nor yarn will
  warn you about it at install time.

### Added

- `ApiBase`: one object per API base URL, owning that base's URL, its `/calendars` index and its response cache.
  A static registry keyed by normalized URL deduplicates bases, so two clients pointed at the same API share one
  metadata fetch and one cache while remaining independent objects. Two bases can now be driven on one page —
  see `examples/CompareBases/`.
- An options-object form for the `ApiOptions` constructor: `new ApiOptions( { locale, apiClient } )`, alongside
  the locale string it has always accepted.
- **`Intl.Locale` is accepted wherever a locale string is** — as the bare constructor argument, as the `locale`
  property of an options object, and as the argument to `WebCalendar.locale()`, `ApiClient.fetchCalendar()`,
  `fetchNationalCalendar()` and `fetchDiocesanCalendar()`. It was previously refused everywhere except
  `LocaleInput`, which requires one, so a caller holding the more precise type had to downgrade it to a string
  for the library that already uses it internally:

  ```js
  const locale = new Intl.Locale( 'it-IT' );

  new CalendarSelect( String( locale ) );          // Before
  new CalendarSelect( locale );                    // After
  new LiturgyOfTheDay( { locale } );               // After — inside a bag too
  webCalendar.locale( locale );                    // After
  ```

  The three forms disambiguate without ambiguity, and are tested in this order: an `Intl.Locale` is a locale, any
  other object is an options bag, a string is a locale. It is a recognized third form checked _before_ the
  plain-object test, not an exception carved into that test — every other class instance is still rejected
  exactly as it was. The value stored is the locale's canonical tag, so an `Intl.Locale` and the string it
  stringifies to are interchangeable; extensions survive, including ones supplied as constructor options and
  therefore absent from the tag as written (`new Intl.Locale( 'en', { calendar: 'buddhist' } )` resolves to
  `en-u-ca-buddhist`). Passing a string is unchanged in every respect.

- **`null` now means "not given" wherever `undefined` does**, both as the options argument itself and as the
  `locale` inside a bag. The five component constructors used to run three different policies between them:

  ```js
  new CalendarSelect( null );                 // Before: defaults — After: unchanged
  new ApiOptions( null );                     // Before: threw    — After: defaults
  new ApiOptions( { locale: null } );         // Before: threw    — After: defaults
  new LiturgyOfTheDay( { locale: null } );    // Before: threw    — After: defaults
  new LiturgyOfTheDay( { locale: undefined } ); // Before: threw  — After: defaults
  ```

  The last of those is the one worth calling out: the widgets read the option with `Object.hasOwn`, which sees
  the key whatever its value, so spreading a bag whose `locale` happened to be unset threw. That is ordinary
  JavaScript and now behaves as an omission does. This is a widening only — every call that worked before works
  unchanged, and only calls that used to throw have new behaviour. An invalid locale still throws: "absent" and
  "unparseable" remain different things, and neither `null` nor `undefined` will ever silence a bad tag.

- An `apiClient` option on `CalendarSelect` and `ApiOptions`, binding the component to that client's base.
  Omitting it binds to the first base registered, so existing single-base code is unaffected. Once more than one
  base is registered, an unbound component warns once per component class and names the base it chose.
- `apiClient.base`, the `ApiBase` a client is bound to. Read `apiClient.base.url` and `apiClient.base.metadata`
  in place of the deprecated statics.
- `ApiBase.fromMetadata( url, metadata )` registers a loaded base with no network request — the supported way to
  exercise components in tests without mocking `fetch`. It hydrates the base for a URL in place and returns the
  same object on every call — until `ApiBase.reset()` clears the registry — so re-installing a fixture replaces
  that base's calendar index and empties its response cache (a calendar request already in flight still caches
  its own response) without replacing the base itself. `ApiBase.reset()` empties the registry between tests.
- `ApiBase` metadata queries: `locales()`, `nationalCalendars()`, `diocesanCalendars( rite )`,
  `riteCalendars( rite )`, `isValidDioceseForNation( dioceseId, nation )`, and the `supportsRite` getter. The
  methods throw, rather than answering emptily, when the base has not been loaded — an empty calendar list is
  indistinguishable from an API that genuinely serves none. `supportsRite` is feature detection and is the one
  exception: it answers `false` for an unloaded base.
- `ApiBase.cacheLimits( { maxEntries, ttl } )` and `ApiBase.clearAllCaches()`, plus `ApiBase.resolve()`,
  `ApiBase.normalizeUrl()`, `ApiBase.DEFAULT_URL`, `ApiBase.default` and `ApiBase.all`.
- `ApiClientError`, carrying `url`, `status`, `statusText`, `body` and `cause` as enumerable properties, so they
  survive logging and `JSON.stringify`.
- The `calendarFetchFailed` event, emitted as `( error, { rite } )`, and `apiClient.on( event, listener )` as a
  chainable shorthand for `apiClient._eventBus.on()`.
- Guards against pairing components across bases, on every pairing that crosses instances.
  `new PathBuilder( apiOptions, calendarSelect )` throws when its two arguments are bound to different bases —
  a path built from one API's options and another API's calendars would point at neither — and takes its own
  base from them rather than from an option of its own.
  `CalendarSelect.linkToNationsSelect()` throws on the same mismatch, as does
  `ApiOptions.linkToCalendarSelect()` for every select passed to it, in both its single and its
  nation/diocese-pair forms, and `ApiClient.listenTo()` for a `CalendarSelect` or an `ApiOptions` bound
  elsewhere. A `RiteSelect` is exempt: it builds its options from the `Rite` enum, reads no metadata, and so
  holds no base to disagree about. Each guard names both URLs and what the mismatch would have caused.
- `ApiBase` and `ApiClientError` are exported from the package root.
- The `CalendarIndex`, `NationalCalendar`, `DiocesanCalendar`, `DiocesanGroup`, `WiderRegion` and `CalendarData`
  typedefs.
- `PathBuilder` exposes a `_domElement` getter.
- `CalendarSelect.linkToRiteSelect( riteSelect, dispatchChange = true )`: makes a select follow a `RiteSelect`,
  rebuilding its options on every rite change and once immediately with the rite select's current value, so a
  select mounted under an already-chosen rite is correct without waiting for a change event. It works for any
  filter, which is what `ApiOptions.linkToCalendarSelect()` does not cover — that accepts only a `none` filtered
  select or a nations/dioceses pair — so a lone `nations` or `dioceses` filtered select can now follow a rite.
  A `nations` filtered select is hidden while a rite with no national tier is selected, the Ambrosian rite
  having none, and shown again when the rite has one. It throws if the select is already linked to a rite
  select, or if the argument is not a `RiteSelect`. `ApiOptions` now drives its own rite handling through this
  same method rather than a second copy of it, passing `dispatchChange = false` so that a select it manages
  hears one `change` per rite change — its own, dispatched once the endpoint state has caught up — rather than
  two with a stale one in between.
- The rite vocabulary beyond `en` and `it`. `GENERAL_ROMAN_CALENDAR` now exists for all 84 locales in the
  catalogue, derived from each locale's already-reviewed `GENERAL_ROMAN_CALENDAR_CAPTION` by dropping its
  trailing `- {year}` suffix, so nothing is invented. `RITE_ROMAN`, `RITE_AMBROSIAN`, `SELECT_A_RITE`,
  `AMBROSIAN_CALENDAR` and `AMBROSIAN_CALENDAR_CAPTION` are translated for the ten further locales this project
  maintains — `la`, `es`, `fr`, `de`, `pt`, `nl`, `hu`, `id`, `sk` and `vi` — bringing those five keys to twelve
  locales. The remaining 72 still fall back to English for them: machine-translated liturgical terminology
  belongs in Weblate, under native review, rather than in the catalogue.

### Changed

- Response caches are bounded, and belong to a base rather than to the `ApiClient` class: 50 entries per base by
  default, evicted least-recently-**read** first, with optional expiry. Both are configured through
  `ApiBase.cacheLimits( { maxEntries, ttl } )`. The cache was previously a single unbounded static map shared by
  every client. `ApiClient.clearCache()` still works and now clears every registered base.
- `ApiOptions` validates its constructor argument, and says what was wrong with it. Anything that is none of a
  locale string, an `Intl.Locale`, a plain object or nullish is rejected with a message naming the type it
  found, so that a slip like `new ApiOptions( new Date() )` is recognizable. That same call previously failed
  with `TypeError: locale.replaceAll is not a function`, which named neither the argument nor
  the component. An invalid locale string likewise now reads `ApiOptions: Invalid locale: not a locale` rather
  than the `RangeError` that `Intl.getCanonicalLocales` raises. That guard is now one shared implementation
  rather than six divergent ones, and every component taking an options bag uses it — see the third narrower
  break above.
- All six components that sanitize a caller's locale — `CalendarSelect`, `RiteSelect`, `WebCalendar`,
  `ApiOptions`, `LiturgyOfTheDay` and `LiturgyOfAnyDay` — now report a bad one the same way, naming both
  themselves and the tag `Intl` actually rejected. They used to disagree: for a malformed tag the first four
  named the tag but not themselves, while the two liturgy widgets threw one opaque message for a malformed tag
  and a wrong-typed argument alike:

  ```text
  // Before
  Invalid locale: not a locale             // CalendarSelect, RiteSelect, ApiOptions
  Invalid locale identifier: not a locale  // WebCalendar.locale()
  LiturgyOfTheDay: Invalid locale          // both liturgy widgets, for either fault

  // After
  CalendarSelect: Invalid locale: not a locale
  WebCalendar.locale: Invalid locale: not a locale
  LiturgyOfTheDay: Invalid type for locale, must be of type `string` or `Intl.Locale` but found type: Date
  ```

  The tag named is the normalized one, as it always was for the four that named a tag at all —
  `new ApiOptions( 'it__IT' )` reports `it--IT`, which is what `Intl` was handed — and the type comes from the
  same `describeType` the options guard uses, so a class instance passed where a locale belongs reads
  `found type: Date` rather than `found type: object`. `WebCalendar.locale` is prefixed with the method
  rather than the class because it is a setter a caller invokes by name. No message text is API: match on the
  thrown `Error`, never on what it says. One ordering change comes with this: `ApiOptions` validates the locale
  before resolving its API base, where previously only the type check did, so
  `new ApiOptions( 'not a locale' )` on a page with no base registered now complains about the locale rather
  than about the registry.

  An empty or blank tag is named for what it is rather than reported as an unparseable one. `Intl` rejects
  `''` like any other malformed tag, so the message would otherwise read `WebCalendar.locale: Invalid locale:`
  with nothing at all after the colon; all six now read
  `WebCalendar.locale: Invalid locale, cannot be an empty or blank string`, and a tag that is only whitespace
  is treated as the same mistake. `ApiClient.fetchCalendar( locale )` joins them: it hand-rolled the same
  type check, the same empty-string check and the same `_` to `-` normalization, and now calls the shared
  guard, so a malformed tag passed to it is reported with the method named — as a rejection of the promise it
  returns, per **Breaking** above — rather than being logged to the console and ignored, and the tag it puts in
  `Accept-Language` is the canonical one. Its own sentinels are unchanged —
  `null` still means "no locale given", and a well-formed locale the calendar does not serve is still no error.

- `WebCalendar.locale()` stores the canonical tag rather than the argument as written, so the `_locale` getter
  reads back canonically:

  ```js
  webCalendar.locale( 'EN-us' );
  webCalendar._locale; // Before: 'EN-us' — After: 'en-US'
  ```

  It was the one component that probed the tag with `new Intl.Locale` and then threw the parsed result away.
  Formatting is unaffected, and always would have been — `Intl` canonicalizes internally — so this is visible
  only to code that reads `_locale` back, and only for an argument that was not already canonical.

- A base URL must now be an absolute `http:` or `https:` URL, and is rejected by `ApiBase.normalizeUrl()` — and
  so by `ApiBase.resolve()`, `ApiBase.fromMetadata()` and `ApiClient.init()` — when it is not. Nothing that
  worked stops working: a base that is not an absolute HTTP URL is interpolated into `` `${url}/calendars` ``,
  where it resolves against the document and 404s, so it could only ever fail — silently, and far from its
  cause. What is new is that it fails at the call that supplied it, and says why. Parsing alone was not enough
  to check for: `new URL( 'localhost:8000' )` succeeds, yielding a URL whose _protocol_ is `localhost:`, so a
  caller who merely omitted the scheme would have passed a `URL.canParse()` test and then got the same silent
  404 anyway. That case is singled out and answered with the URL they meant — `Did you mean http://localhost:8000?` —
  while `javascript:`, `data:`, `ftp://…` and the rest are named by the scheme they carry, and `/api` is told
  that a relative base is not supported. A `'///'` base, which normalized away to `''` and registered a base
  whose `load()` fetched a relative `/calendars`, is refused along with them.
- `ApiClient.init( url )` with no argument uses the constant default base rather than the first base already
  registered, so a call meaning "the public API" cannot resolve to a localhost base a comparison page happened
  to register first. An empty string is rejected rather than treated as "unspecified".
- `ApiClient.init()` returns a **new** client on every call, including for a base already registered; only the
  metadata and cache are shared. That is what allows two clients against one API to hold different rites.
- On a rite change, the `change` event that tells a calendar select's own listeners to redraw is now withheld
  from a select that has a dependent diocese select, rather than from any `nations` filtered select. The two
  rules agree for a linked nation/diocese pair, which is what the exclusion is for: the nation select carries
  the diocese select's listener, and dispatching would have it re-derive the diocese options for a nation value
  that was just cleared. They differ for a `nations` filtered select with nothing depending on it, which used to
  be passed over on the strength of its filter alone and is now told, as any other select is.

### Deprecated

- The statics `ApiClient._apiUrl` and `ApiClient._metadata` resolve to the first registered base, and warn on
  every read while more than one base is registered. Read `apiClient.base.url` and `apiClient.base.metadata`
  from a specific client instead. The instance getters `apiClient._apiUrl` and `apiClient._metadata` are not
  deprecated and answer for that client's own base.

### Fixed

- `ApiClient.init()` called with a second base URL no longer leaves the client pointing at the new API while
  reporting the first API's calendars. The URL was static and was overwritten; the metadata was static and was
  kept.
- Calendar responses are no longer served from one base's cache to another's.
- Concurrent `ApiClient.init()` calls no longer issue duplicate `/calendars` requests: a load already in flight
  is returned rather than duplicated. A failed load clears itself, so a later call can retry.
- A failed calendar request no longer emits `calendarFetched` with `undefined` data and caches it. It emits
  `calendarFetchFailed` and rejects.
- A `/calendars` response that is not an object, that omits `national_calendars`, `diocesan_calendars` or
  `locales`, or that carries any of those three as something other than an array, is rejected by `load()` — and
  by `fromMetadata()` — naming the field, the type actually found and the URL of the API that served it, rather
  than only surfacing when some component happens to read it. Requiring the three to be present was not enough
  on its own: an index carrying `locales: {}` passed that check and then failed a step further down, on the
  request path, as a bare `TypeError` out of `.includes()` naming neither the field nor the API — the very
  failure the check exists to prevent, and with a field that is present, so a message about absence would have
  been actively misleading.
- An options bag with no prototype, or one carrying its own `hasOwnProperty` key, no longer throws
  `TypeError: options.hasOwnProperty is not a function`. `CalendarSelect`, `RiteSelect`, `WebCalendar`,
  `LiturgyOfTheDay` and `LiturgyOfAnyDay` read their options — and the `label` bags both selects accept, and the
  `wrapper` bag `CalendarSelect` accepts — by calling `hasOwnProperty` **on the caller's object**, which
  `Object.create( null )` does not carry and which `{ locale: 'it', hasOwnProperty: 'x' }` shadows. Both are
  plain objects that the components' own guard accepts, deliberately so in the first case, and both failed with
  a bare `TypeError` naming neither the component nor the option:

  ```js
  const options = Object.assign( Object.create( null ), { locale: 'it', class: 'form-select' } );
  new CalendarSelect( options ); // Before: TypeError: options.hasOwnProperty is not a function
                                 // After:  the `class` option is applied
  ```

  The reads now use `Object.hasOwn`, which depends on neither the bag's prototype nor its keys. `ApiOptions`
  was never affected: it destructures its options rather than probing them.

- `CalendarSelect` no longer sorts the shared metadata's national calendar list in place; it sorts its own copy,
  by its own locale.
- `ApiClient._metadata` was typed as `CalendarMetadata`, the per-response metadata block, rather than as the
  `/calendars` index it actually returns.
- Switching the path builder from `/calendar/nation/` to `/calendar/diocese/` no longer throws
  `Filter has already been set to ...`, stranding the select on the national list. `ApiOptions` drives one
  `CalendarSelect` between the two lists on every path change, which is the component working as designed
  rather than a configuration chain contradicting itself, so it now calls `_applyFilter()`, which rebuilds
  without the one-shot guard. `filter()` keeps that guard, and both entry points reject an unknown filter alike.
  This mirrors the existing `rite()` / `_applyRite()` split, for the same reason.
- `new LiturgyOfTheDay()` — the no-argument form its own default parameter advertises — no longer throws
  `TypeError: Cannot read properties of null`. `typeof null === 'object'` carried it past the object branch and
  into a property read on `null`; it now falls back to the default locale, as `LiturgyOfAnyDay` does.
- `MonthInput.value` no longer overrides the inherited `value( val )` method with a getter. The getter made
  `monthInput.value( '7' )` throw `TypeError: monthInput.value is not a function` while `DayInput` and
  `YearInput` could still be set through their own inherited `value()`, and it was the sole cause of two
  `yarn lint:dts` errors (an accessor overriding a base method). Reading `MonthInput#value()` now returns the
  raw string, exactly as it does for `DayInput` and `YearInput`; a caller wanting the integer should
  `parseInt( input.value(), 10 )`, which is what the only in-library caller already did.
- `ApiClient`'s fire-and-forget calls — the `listenTo()` handlers, `LiturgyOfAnyDay`'s year handling — no longer
  suppress an error just because _something_ is subscribed to `calendarFetchFailed`, when that error was never
  emitted for the subscriber to receive. A throwing `calendarFetched` listener, and an argument/state rejection
  such as an unserviceable rite, both reject without emitting: the first because a listener's throw is its own
  bug and not a fetch failure, the second because no request was ever made. On any page following the documented
  `apiClient.on( 'calendarFetchFailed', … )` wiring, both used to vanish completely — no event, no console
  output. `#discardRequest` now checks whether the specific error it caught was actually delivered to a
  listener, recorded at the point of emission, rather than whether a listener merely exists at catch time.
