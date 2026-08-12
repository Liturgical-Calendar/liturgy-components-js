# Changelog

Releases up to and including 1.5.0 are not recorded here; see the git history. There is no 1.6.0 — the release
prepared under that number was skipped, and everything it was to have delivered ships in 2.0.0 instead. The
2.0.0 entry therefore covers the whole span since 1.5.0, not only the work that forced the major.

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
  notification the calendar-selection path already performed for this input. Measured: no additional
  HTTP requests per rite change.

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
