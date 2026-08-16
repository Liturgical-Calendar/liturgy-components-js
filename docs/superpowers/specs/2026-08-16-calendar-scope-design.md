# Calendar scope: declaring which calendars a widget may show

**Date:** 2026-08-16
**Status:** Implemented
**Target release:** 2.8.0 (unreleased)

## Problem

A consumer who wants to embed a liturgical calendar for one specific church body has no way to say so. The
Diocese of Rome putting a `WebCalendar` on its website does not want a rite dropdown, a calendar dropdown
listing every diocese on earth, and a locale dropdown — it wants its own calendar, in Italian, and nothing
else on screen.

The library can already **fetch** that calendar. `ApiClient` has `rite()`, `fetchCalendar()`,
`fetchNationalCalendar()` and `fetchDiocesanCalendar()`, so this works today:

```javascript
const apiClient = await ApiClient.init(BaseUrl);
apiClient.rite('roman');
webCalendar.listenTo(apiClient);
await apiClient.fetchDiocesanCalendar('romamo_it', 'it');
```

**This is therefore a composition and API-surface gap, not a capability gap.** What is missing is a
declarative way to state it, and meta-components that can omit the controls — `CalendarControls` always
builds all three.

The requirement is not merely "pin everything", though. Three real cases have to work:

- **Diocese of Rome** — one calendar, no controls at all.
- **Italian Bishops' Conference** — the Italian national calendar, but able to offer a rite switch, because
  Italy contains an Ambrosian diocese. Possibly down to diocesan level, possibly not.
- **Canadian Bishops' Conference** — the Canadian national calendar in two locales, either user-switchable
  or fixed, with a separate widget per language as an acceptable alternative.

## The model: scope, not default

The unifying concept is a **scope** — a declarative restriction on the calendar space — rather than a
default value. Controls are then _derived_ from the scope rather than separately configured: a control
appears only when it has a real choice to offer.

This was chosen over "`defaultCalendar` as an initial value" and "`defaultCalendar` as a lock" because
neither handles the Italian case. The Ambrosian rite has **no national tier**
(`RiteProperties[Rite.AMBROSIAN].hasNationalTier === false`), so `{rite: 'ambrosian', nation: 'IT'}` is not
a valid calendar; a rite switch necessarily abandons the nation. Scope sidesteps that: the consumer
declares the _space_, and each rite resolves to whatever is in it.

The name is `scope` rather than `defaultCalendar` because `{nation: 'IT', includeDioceses: true}` is plainly
not a default calendar. The original term stays accurate for the fully-pinned cases but not across the range.

### Shape

Every key is optional.

```javascript
scope: {
    rite: 'roman',            // allowed rite(s); string or array — see below
    nation: 'IT',             // pin to a national calendar
    diocese: 'romamo_it',     // pin to a diocesan calendar
    locale: 'fr-CA',          // pin the locale
    includeDioceses: true,    // widen a nation scope down one tier; default false
}
```

`scope: undefined` and `scope: {}` both mean "no scope" — today's behaviour, every calendar — per the
library-wide nullish rule.

#### `scope.rite` is a RESTRICTION, and takes a string or an array

`scope.rite` names the **allowed set** of rites, not an initial default. That is why pinning it removes the
rite select rather than merely preselecting it, and it is the semantics that makes the array form a
consistent widening rather than a second concept: a string is a singleton set.

**The initial rite is the first element.** One rule, degenerating correctly:

```javascript
rite: 'roman'                    // allowed {roman},            initial roman
rite: ['roman', 'ambrosian']     // allowed {roman, ambrosian}, initial roman
rite: ['ambrosian', 'roman']     // same set,                   initial ambrosian
```

Had `scope.rite` instead meant "initial value, all rites still reachable", expressing a restriction later
would have required a second key, and the string form would read wrong beside it.

**This is deliberate future-proofing with limited use today.** With only `roman` and `ambrosian` in `Rite`,
`['roman', 'ambrosian']` is equivalent to omitting the key, so the _restriction_ aspect is not yet
expressible; only the **ordering** aspect is observable. It earns its place when further rites are added:
an Italian Bishops' Conference site would then write `rite: ['roman', 'ambrosian']` and a Melkite or
Ruthenian rite would never appear.

### Resolution

`resolveScope( scope, apiBase )` is a pure function of the scope and the `/calendars` metadata. It produces
the rites available, the calendars available **per rite**, the locales available per calendar, and the
initial selection.

Three properties are load-bearing:

- **Redundant keys are inferred and verified, not merely stored.** `{diocese: 'romamo_it'}` already
  determines its rite and its nation from metadata, so `{rite: 'roman', diocese: 'romamo_it'}` is accepted
  and checked. `{rite: 'ambrosian', diocese: 'romamo_it'}` is a contradiction and throws, naming both sides.
- **Diocesan exclusion by nation falls out for free.** Diocesan metadata entries carry `nation`, so a
  `nation: 'IT'` scope excludes `lugano_ch` under either rite with no special-casing. This is the behaviour
  that was explicitly wanted: Milan is in scope for Italy, Lugano is not.
- **Which rites are in scope is DERIVED from the metadata, not assumed to be all of them:**

  > A rite is in scope for a nation iff that nation has a national calendar for it, **or** at least one
  > diocese of it.

  So `{nation: 'IT'}` yields Roman (national tier) and Ambrosian (Milan), while `{nation: 'US'}` yields
  Roman alone — the United States has no Ambrosian diocese — and its rite select is therefore hidden rather
  than offering an Ambrosian option with nothing American behind it.

  `scope.rite` intersects with this derived set. An empty intersection throws at mount, naming both the
  requested rites and those actually available.

- **A rite-level calendar counts as in scope for a nation, for a rite that is in scope.** `{nation: 'IT'}`
  under `rite = ambrosian` offers the Ambrosian calendar plus Italian Ambrosian dioceses, because there is
  no Ambrosian national tier to offer instead. This is a fallback for rites lacking a national tier, **not**
  a licence for every rite-level calendar to appear in every nation's scope — which is what the earlier
  draft of this rule would have meant once more rites existed.

### `includeDioceses` defaults to `false`

`{nation: 'IT'}` therefore means "the Italian national calendar", one calendar, no controls. Widening to
dioceses is the rarer and more deliberate act, so it is the opt-in. This keeps the simplest case simplest
and makes a bare nation scope behave the way a consumer writing "default calendar" would expect.

### Worked cases

| `scope`                                                | `rite = roman` offers             | `rite = ambrosian` offers         | Controls shown  |
| ------------------------------------------------------ | --------------------------------- | --------------------------------- | --------------- |
| `{diocese: 'romamo_it'}`                               | Rome only                         | — (pinned by inference)           | none            |
| `{nation: 'IT'}`                                       | Italy                             | Ambrosian                         | rite only       |
| `{nation: 'IT', includeDioceses: true}`                | Italy + Italian Roman dioceses    | Ambrosian + Milan (not Lugano)    | rite + calendar |
| `{nation: 'IT', rite: 'roman', includeDioceses: true}` | Italy + Italian Roman dioceses    | — (pinned)                        | calendar only   |
| `{nation: 'CA'}`                                       | Canada, locales `fr-CA` / `en-CA` | — (no Canadian Ambrosian diocese) | locale only     |
| `{nation: 'CA', rite: 'roman'}`                        | Canada, two locales               | — (pinned)                        | locale only     |
| `{nation: 'CA', rite: 'roman', locale: 'fr-CA'}`       | Canada in French                  | — (pinned)                        | none            |
| `{nation: 'US'}`                                       | United States                     | — (no US Ambrosian diocese)       | none            |
| `{nation: 'IT', rite: ['ambrosian', 'roman']}`         | Italy                             | Ambrosian (initial)               | rite only       |

The "separate widget per rite / per language" alternatives are simply the pinned rows: pin `rite`, or pin
`locale`, and the corresponding control disappears.

The `{nation: 'US'}` and `{nation: 'CA'}` rows are the ones the derived-rites rule changes. Under the earlier
draft both would have shown a two-option rite select whose Ambrosian branch led to the bare Ambrosian
calendar — nothing to do with either country. Neither the United States nor Canada has an Ambrosian diocese,
so the derived-rites rule (above) excludes Ambrosian from both scopes entirely: no rite select, and for
Canada, `{nation: 'CA'}` alone already reduces to exactly the same "locale only" outcome as the more explicit
`{nation: 'CA', rite: 'roman'}` row below it — pinning a rite that was already the only one reachable changes
nothing.

It also removes an edge case structurally rather than by special-casing: a nation with an Ambrosian diocese
but no Roman national calendar — the `CH` case `CalendarSelect.test.js` calls "the crash case" — resolves to
Ambrosian alone, instead of offering a Roman option with nothing behind it.

## Derived visibility

A control renders if and only if it offers more than one choice:

```text
riteSelect      shown iff  the scope yields > 1 rite
calendarSelect  shown iff  the scope yields > 1 calendar FOR THE CURRENT RITE
localeInput     shown iff  the CURRENT CALENDAR supports > 1 locale
```

**Two of those are runtime-dependent, not mount-time constants.** Switching rite changes the calendar set;
switching calendar changes the locale set. A scope whose nation has no Ambrosian diocese shows
`calendarSelect` under Roman and hides it under Ambrosian.

This is the same situation `CalendarSelect._setHidden()` already handles, and its doc comment records how it
was got wrong before: deriving visibility on the rite side alone leaked, because `ApiOptions`' path builder
re-filters a single select with no rite change to re-evaluate it. **Visibility must therefore be settled in
the one place rite and calendar both land**, extended from one control to three. `_setHidden()` is reused
rather than a second hiding mechanism being invented, and all three controls are always _built_ and then
hidden rather than conditionally omitted, so there is one code path.

**A hidden control still holds its value and still drives the fetch.** This is what makes the Rome case
work: the calendar select is hidden, and is still what tells `ApiClient` to fetch `romamo_it`.

### The `inputs` override

Visibility can be overridden per control through the **existing** `inputs` bag:

```javascript
inputs: { riteSelect: false, calendarSelect: true, localeInput: false, acceptHeader: false }
```

`inputs` is reused rather than a new `controls` key being added, because `controls` is already a mount
**slot** name (`{controls, calendar, messages}`) whose value may itself be a target or a filter-keyed
object. A second `controls` in the options bag would be the "second way to say one thing" this codebase
explicitly avoids. `inputs` already means "which controls render", is already boolean-valued, and already
rejects unknown keys through `InputVisibility.js`.

Two wrinkles are accepted deliberately and must be documented:

- **The new keys differ in semantics from `acceptHeader`.** That key is an irreversible `hide()` flag, where
  `true` is "the default reasserted, not an un-hide". The three new keys override a _derived_ default in
  both directions.
- **Spelling follows `theme`, not `acceptHeader`.** `theme` uses the public accessor names `riteSelect` /
  `calendarSelect` / `localeInput`; `inputs` currently uses the abbreviated `acceptHeader`. The new keys use
  the accessor names, leaving `acceptHeader` as the pre-existing odd one out rather than propagating the
  abbreviation to three more keys.

**Pin with `scope`, present with `inputs`.** `inputs: {riteSelect: false}` on a two-rite scope does not
remove Ambrosian from the space; it makes it unreachable by the user, leaving the rite at its scope value
(or `roman`). That is legitimate for programmatic control, but `scope.rite` is the honest way to say
"Roman only".

## Component surface

### `src/MetaComponents/CalendarScope.js`

A new internal module — **not exported** from `src/index.js`, on the same reasoning as `Theme.js`,
`FilterInputs.js`, `InputVisibility.js` and `PredeterminedInputs.js`.

```text
assertScope( scope, componentName, apiBase )
    → throws for unknown keys, contradictions, unknown nation/diocese/locale

resolveScope( scope, apiBase )
    → { rites, calendarsByRite, initial }

deriveVisibility( resolved, currentRite, currentCalendar, inputs )
    → { riteSelect, calendarSelect, localeInput }
```

`assertScope()` takes the `apiBase` because validating a `nation`/`diocese`/`locale` against the metadata is
not possible without it — `componentName` alone, as an earlier draft of this section had it, only prefixes
the thrown message. Each calendar entry in `calendarsByRite` already carries its own `locales` array
(`{type, id, locales}`), so a separate `localesByCalendar` map was never built; an earlier draft of this
section proposed one, but it would have duplicated data `calendarsByRite` already holds. `assertScope()`'s
allowed keys are a single FLAT list, `SCOPE_KEYS` in `CalendarScope.js` — not a per-component registry keyed
by `componentName` the way `THEME_CHILD_KEYS` (#78) is for the theme bag. An earlier draft of this section
proposed that discipline for `assertScope()` too; it was not built, because every scope-taking component
accepts the identical five keys (`rite`, `nation`, `diocese`, `locale`, `includeDioceses`) — there is no
per-component variation for a registry to express.

### Consumers

| Component                               | How it gets `scope`                                                         |
| --------------------------------------- | --------------------------------------------------------------------------- |
| `CalendarControls`                      | implements it                                                               |
| `CalendarViewer`, `SubscriptionBuilder` | inherited — both build a `CalendarControls` and never render `PATH_BUILDER` |
| `ApiExplorer`                           | **cannot take `scope` at all** — see below                                  |
| `DayViewer`, `CalendarResourcePicker`   | build their selects directly; each needs wiring                             |
| `TodayViewer` (new)                     | new component wrapping `LiturgyOfTheDay`                                    |

**Correction (implemented, 2026-08-16):** this table originally listed `ApiExplorer` alongside
`CalendarViewer` and `SubscriptionBuilder` as inheriting `scope` "for free." That is wrong.
`ApiExplorer.appendTo()` always renders its `CalendarControls`' `ApiOptions` under
`ApiOptionsFilter.PATH_BUILDER` (among the other two filters — see the three-filter layout), which is
exactly the combination `CalendarControls`' own constructor rejects (see "Error handling" below). Since
`ApiExplorer` builds a `CalendarControls` internally and forwards its own options bag to it unchanged, a
`scope` passed to `ApiExplorer` reaches that `CalendarControls` and always throws — `ApiExplorer` cannot
take a `scope` at all, for the same reason `CalendarPathInput` and `scope` cannot coexist on any component.
`CalendarViewer` and `SubscriptionBuilder` genuinely do inherit `scope` for free, because neither ever sets
`PATH_BUILDER`.

`SubscriptionBuilder` inheriting scope is a deliberate benefit rather than an accident: "subscribe to _our_
calendar" is a diocesan use case, and pinning the scope makes the generated iCal URL a single fixed
subscription rather than a builder.

### `RiteSelect` gains an option set

`RiteSelect` currently renders every member of `Rite` unconditionally, from `Object.values(Rite)` in its
constructor. The derived-rites rule requires it to render a subset, so it gains a constructor option and a
matching chainable setter naming the rites to offer.

This is **new public surface on a component this feature would otherwise not touch**, and it is the one
place the design reaches outside the meta-component layer. It is justified because the alternative — a
meta-component reaching in to remove `<option>` elements after construction — would duplicate the option
labelling and the localized `message( 'RITE_*' )` lookups that `RiteSelect` owns.

Defaults are unchanged: omitting the option renders every rite, exactly as today, so no existing consumer
is affected. Ordering follows the given list, which is what makes `scope.rite`'s first-element-is-initial
rule visible in the select itself.

### `TodayViewer`

A new meta-component, sibling to `DayViewer`. The names carry exactly the distinction — `DayViewer` renders
any day and owns date controls; `TodayViewer` renders today and does not.

It follows every existing meta-component convention that applies to it: synchronous constructor plus static
async `mountInto()`, `appendTo()` returning `undefined`, `settled`, `onError()` / `onCalendarFetched()`, an
idempotent `dispose()`, and the theme bag. Unlike `CalendarControls`/`CalendarViewer`, it has no
`initialFetch` option — `TodayViewer.mountInto()` destructures only `{apiClient, signal, onError}` from its
options, the same set `DayViewer.mountInto()` takes, since fetching today's liturgy on mount is the whole
point of the component and there is no "wire without fetching" case to opt out of. It accepts either a
single target or a slots object, like `DayViewer`. With a pinned scope the controls vanish, so the
single-target form is the common case:

```javascript
await TodayViewer.mountInto('#today', {
    scope: { diocese: 'romamo_it' },
    locale: 'it',
});
```

## Prerequisite: `LiturgyOfTheDay` must replace, not append

`LiturgyOfTheDay.#updateEventDetails()` **appends without clearing**, so a second fetch duplicates its
content rather than replacing it. This is recorded in CLAUDE.md as a known defect, and is the stated reason
that component has no live region: "updated" would misdescribe what happens.

**It stops being a separate defect here.** As soon as `TodayViewer` exposes a rite or calendar select,
switching it triggers a refetch, and today's liturgy renders twice, then three times. `TodayViewer` would be
broken for precisely the multi-choice case this feature exists to enable.

The fix is therefore in scope:

- Clear before appending, so a refetch replaces.
- Add the visually-hidden `role="status"` live region that `WebCalendar` and `LiturgyOfAnyDay` already have,
  through `LiveAnnouncer.js`, with the same `announceUpdates` option and the same silent-first-render rule.
  It was withheld only because of the duplication, so removing the cause removes the reason.

The rejected alternative — restricting `TodayViewer` to fully-pinned scopes — would make it the only
meta-component that cannot show a control, purely to route around a bug.

This is a behaviour change and is recorded as one in the CHANGELOG, not slid in as a fix.

## Error handling

The existing split holds: **reject for programmer error, resolve for runtime failure.**

`assertScope()` throws at mount for:

- an unknown key in the bag, naming it and listing the accepted keys;
- a `nation` or `diocese` absent from the metadata index, naming it;
- a contradiction between keys, naming both sides;
- a `locale` the resolved calendar does not support, naming the supported locales;
- a `rite` — or every member of a `rite` array — outside the set derived for the scope, naming both the
  requested rites and those actually available. `{nation: 'US', rite: 'ambrosian'}` is the concrete case;
- an empty `rite` array, which states a restriction to nothing and is always a mistake.

**The locale case is a deliberate decision.** It is a mount-time configuration claim, and silently serving a
liturgical calendar in the wrong language is worse than failing loudly. The precedent is
`CalendarSelect.value()`, which throws for an unmatched value "because it is the last place the mistake is
nameable". The accepted cost is that API drift — a nation dropping a locale — turns a working page into a
hard failure at mount.

Runtime metadata failure keeps each component's existing behaviour. `TodayViewer` follows `DayViewer`: it
**resolves** with a mounted, working viewer and routes the failure to `onError()`. It gets no failure
control, for the same reason `CalendarControls` does not — with a pinned scope there are no controls for a
stand-in to substitute for.

## Testing

- **`CalendarScope.test.js`** — the resolver as a pure function: every row of the worked-cases table, the
  Lugano exclusion, key inference, and each contradiction. Specifically including the derived-rites rule
  (`{nation: 'US'}` yields Roman alone; `{nation: 'IT'}` yields both), `scope.rite` in string and array
  form, first-element-is-initial ordering, and the empty-intersection and empty-array throws.
- **`RiteSelect` option-set tests** — a restricted list renders only those rites, in the given order, with
  their localized labels intact; omitting the option still renders every rite, so no existing consumer
  changes.
- **Per-component visibility tests, including the dynamic path** — switch rite, assert `calendarSelect`
  appears and vanishes. This is where the documented `_setHidden()` leak happened before, so a static
  mount-time assertion is not sufficient.
- **`TodayViewer.test.js` and `TodayViewerMount.test.js`**, mirroring the `DayViewer` pair.
- **A refetch-duplication regression test** for `LiturgyOfTheDay`, plus announcement tests matching
  `LiturgyOfAnyDayAnnouncements.test.js`.

Two things that would otherwise be got wrong:

- **A local metadata fixture, not `FULL_METADATA`.** The shared fixture is a self-consistent index that
  CLAUDE.md requires stay byte-identical to the live `/calendars` response, so a `lugano_ch` must not be
  invented in it. `CalendarSelect.test.js` already sets the precedent of a local metadata literal for
  exactly this reason.
- **`type-fixtures/dts-consumer.ts` needs additions.** `TodayViewer` and the `scope` typedef reaching
  `dist/` at the right types is a `.d.ts`-only class of bug that `yarn test` cannot see.

## Documentation and release

- A CLAUDE.md section covering the scope model, the derived-visibility rule and the `inputs` override.
- A `docs/meta-components.md` section for `TodayViewer`, and scope coverage across the existing six.
- CHANGELOG split between **Added** (`scope`, `TodayViewer`) and **Behaviour changes**
  (`LiturgyOfTheDay` replaces instead of duplicating, and gains a live region).
- `examples/ScopedWidgets/` showing the Diocese of Rome and Italian Bishops' Conference cases side by side.
  This feature is aimed at people who copy an example.

Everything is additive except the `LiturgyOfTheDay` fix, which is a bug fix, so this lands in the unreleased
**2.8.0**.

## Non-goals

- **No change to the renderers' architecture.** `WebCalendar`, `LiturgyOfTheDay` and `LiturgyOfAnyDay` keep
  listening to an `ApiClient` and never fetch for themselves. Scope is a meta-component concern.
- **No new `ApiClient` surface.** The fetch methods already cover every case; this adds no
  `apiClient.calendar()`.
- **No narrowing of `CalendarSelect`'s own public filter API.** `CalendarSelectFilter` keeps its present
  meaning; scope narrows the option set that reaches the select, not the enum.
- **No new `Rite` members.** Melkite and Ruthenian are the motivating hypothetical for `scope.rite`
  accepting an array, but adding rites is API-side work and out of scope here.
