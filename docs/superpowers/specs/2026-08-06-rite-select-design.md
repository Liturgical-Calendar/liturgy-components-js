# RiteSelect and rite-aware CalendarSelect — design

**Date:** 2026-08-06
**Status:** approved, pending implementation plan
**Lands in:** PR #5 (`fix/calendarselect-undefined-national-calendar`), which is repurposed from a crash guard into the rite-aware fix

## Problem

`CalendarSelect` has no concept of liturgical rite. It reads every entry in
`diocesan_calendars[]` and groups each one under a national calendar looked up by
the diocese's `nation` field. The Liturgical Calendar API, however, partitions
calendars by rite, and the Ambrosian rite has no national tier at all.

The visible symptom is a crash. `#addNationalCalendarWithDioceses` does an
unguarded `.find()` on `#nationalCalendars`; for `lugano_ch` (`nation: "CH"`) it
returns `undefined`, pushes it, and `#buildAllOptions` then dereferences
`.calendar_id`, throwing `TypeError: Cannot read properties of undefined`.

The crash is the lucky case. Of the four Ambrosian dioceses, three are Italian —
`milano_it`, `bergam_it`, `novara_it` — and `IT` *does* have a Roman national
calendar, so they do not throw. They are silently folded into the Italy
`<optgroup>` alongside Roman Italian dioceses, as though they were Roman. Only
`lugano_ch` throws, because `CH` is the one Ambrosian nation with no Roman
national calendar to attach to.

So rite-unawareness currently produces **one loud failure and three silent wrong
ones**. A guard against the `undefined` silences the loud one and leaves the
three misgroupings in place. That is why this PR becomes the rite-aware fix
rather than shipping the guard.

### Downstream impact

The crash takes out any page that constructs a `CalendarSelect`. In
LiturgicalCalendarFrontend, `assets/js/permission-requests.js:221-224` builds
`.perm-object-id` with `new CalendarSelect(...)`; when the constructor throws,
`appendTo(mount)` never runs, the control never appears, and Playwright times out
waiting for it. That is the whole of the frontend's red `[rbac]` E2E suite —
9 failed / 23 passed, every failure through one locator. Because the throw
happens inside an `async` function it surfaces as an unhandled rejection, not a
`pageerror` event, so diagnostics keyed on `pageError` do not catch it.

The frontend pins the package by CDN URL in three places
(`layout/footer.php:110`, `examples.php:23`, `examples.php:76`), so unblocking it
requires a published release, then a pin bump.

## Domain facts

Established and not to be re-derived. Sources given because several of these
contradict plausible assumptions.

### Rite structure

- `diocesan_calendars[]` entries carry a `rite` field; `national_calendars[]` has
  none and is implicitly Roman. Pinned by
  `MetadataHandlerTest::testGetAnnouncesAmbrosianDiocesesWithRite` in the API,
  which asserts `rite` on **every** diocesan entry.
- The Ambrosian rite has **no national calendars**. `CalendarParams::validateRiteCompatibility()`
  (`CalendarParams.php:684-688`) throws if `NationalCalendar` is non-null for
  Ambrosian, and there is no `/calendar/ambrosian/nation/...` route.
- Four Ambrosian dioceses ship data: `milano_it`, `bergam_it`, `novara_it`,
  `lugano_ch`. Note `bergam_it`, not `bergamo_it`.
- `ambrosian_calendars[]` holds exactly one entry (`calendar_id: 'ambrosian'`),
  the *comune ambrosiano*, reachable at `/calendar/ambrosian`.
- `Rite` is a real backed enum in the API (`src/Enum/Rite.php`) with cases
  `roman` and `ambrosian`. `Router::extractRiteSegment()` accepts **both**
  explicitly, so `/calendar/roman/nation/IT` ≡ `/calendar/nation/IT`.
- Maintainer ruling: `CH` must not exist for the Roman rite. Ambrosian dioceses
  have no national tier and stand alone.

### Ambrosian temporal norms

From the *Premesse e praenotanda* of the reformed Ambrosian Missal
(`Premesse_praenotanda_portale.pdf`). These settle whether the four Roman
temporal options mean anything under the Ambrosian rite. **They do not.**

- **Epiphany** — n. 34: *"L'Epifania del Signore si celebra il 6 gennaio."* The
  same paragraph goes on to handle the case where 6 January falls on a Monday,
  which only makes sense if the date never moves. The Roman
  `JAN6` / `SUNDAY_JAN2_JAN8` choice has no analogue.
- **Ascension** — n. 22: *"L'Ascensione del Signore si celebra il quarantesimo
  giorno di Pasqua."* Always the 40th day, always Thursday.
  **Do not mis-map the following sentence:** *"Dove lo si ritenga opportuno per
  ragioni pastorali, i testi propri del Lezionario e del Messale di questa
  solennità possono essere riproposti anche nella successiva domenica."* That
  permits the proper **texts** to be repeated on the following Sunday. It does
  not transfer the solemnity, and reading it as the Ambrosian equivalent of the
  Roman Sunday option would move a feast the Missal fixes.
- **Corpus Domini** — not stated as a norm in the praenotanda text, but the
  annual table (pp. LXXXVIII-LXXXIX) fixes it for 2025-2056 and the rule is
  unambiguous: always the Thursday after Trinity Sunday, i.e. Pentecost + 11.
  Verified against the table: 2025 Pentecost 8 June → Corpus Domini 19 June;
  2026, 24 May → 4 June; 2027, 16 May → 27 May. Never a Sunday across 32
  tabulated years.
- **Eternal High Priest** — not established by the praenotanda. No occurrence of
  *sommo ed eterno sacerdote*, no *giovedì dopo Pentecoste* celebration. The one
  `sommo sacerdote` occurrence is theological prose about Christ as high priest
  of the new covenant, not a feast.
- The Ambrosian rite is available from **1976** onward, the first reformed
  Ambrosian Missal (`CalendarParams::AMBROSIAN_YEAR_LOWER_LIMIT`).

### Correction to an earlier reading

`jsondata/schemas/openapi.json` documents `501 Not Implemented` for
`/calendar/ambrosian/diocese/{calendar_id}` and its `/{year}` variant. **That
schema is stale.** `ImplementationException` is never thrown anywhere in the API,
and `CalendarHandler.php:453-468` is live: it loads the diocese from
`JsonData::AMBROSIAN_DIOCESAN_CALENDAR_FILE` and deliberately leaves
`NationalCalendar` null. Comments at `CalendarHandler.php:1161` and `:4318` also
still describe the 501 as in force. Verify endpoint behaviour from the handler,
not from the schema.

## Decisions

1. **Back-compat is structural, not flagged.** An embed that never mentions rite
   is Roman, and Roman without a linked `RiteSelect` emits no rite segment, so
   every existing path is byte-identical. The consumer upgrade is a pin bump with
   no code change.
2. **`ApiOptions` orchestrates the rite → calendar chain**, as it already chains
   nation → diocese.
3. **The nation select is hidden entirely when Ambrosian is selected.**
4. **Ambrosian dioceses are filtered away from the Roman set and vice versa.**
   They are never shown together.
5. **The component mirrors the API's declared surface, not its implementation
   progress or its liturgical correctness.** No interception of error responses.
6. **The `undefined` guard from the original PR #5 is dropped**, not kept and not
   converted to a warning. See "Accepted trade-offs".
7. **The rite list is a static enum**, not derived from metadata. Metadata is
   still read for per-diocese `rite` filtering; only the offered *list* is static.
8. **The explicit `/calendar/roman` form is emitted when a `RiteSelect` is
   linked**, and omitted when one is not.

## Architecture

### `Rite` enum and structural maps (`src/Enums.js`)

```js
const Rite = Object.freeze({
    ROMAN:     'roman',
    AMBROSIAN: 'ambrosian'
});
```

Beside it, one frozen map keyed by rite carrying the structural facts that drive
UI. Both flags are statements about a *rite's* structure — neither varies by
diocese, and neither is a user preference:

| Key | `roman` | `ambrosian` | Drives |
| --- | --- | --- | --- |
| `hasNationalTier` | `true` | `false` | Whether the nation pass runs at all; whether the nation select is shown |
| `hasFixedTemporalOptions` | `false` | `true` | Whether Epiphany / Ascension / Corpus Christi / Eternal High Priest inputs are disabled |
| `minYear` | `1970` | `1976` | `YearInput`'s `min` attribute |
| `emptyOptionLabel` | General Roman Calendar | Ambrosian Calendar | The rite-level calendar's label |

`minYear` for Roman is the existing `YearInput` floor (`YearInput.js:21`);
`1976` mirrors `AMBROSIAN_YEAR_LOWER_LIMIT`.

### `src/RiteSelect/RiteSelect.js`

A standalone component mirroring `CalendarSelect`'s shape — locale-aware
constructor plus the same chainable surface it already exposes: `.class()`
(line 379), `.id()` (416), `.label()` (480), `.appendTo()` (822), and
`_domElement`. Renders one
`<select>` built from the `Rite` enum, defaulting to `ROMAN`. It is standalone
rather than an `ApiOptions/Input/` class because rite is a **path segment**, like
nation and diocese, whereas the existing `Input` classes map to query parameters.

### `CalendarSelect` changes

- Gains an internal rite, defaulting to `Rite.ROMAN`.
- `#buildAllOptions()` splits on `hasNationalTier`:
  - **National tier (Roman)** — current behaviour, minus the guard. Dioceses
    filtered to `rite === 'roman'`, grouped by nation into `<optgroup>`s.
  - **No national tier (Ambrosian)** — the nation pass is skipped **entirely**.
    `#addNationalCalendarWithDioceses` is never called. Dioceses are flat
    options, ungrouped.
- The empty option keeps meaning "the rite-level calendar" and takes its label
  from `emptyOptionLabel`.

**Hiding the nation select is not sufficient on its own, and this is the crux of
the design.** Ambrosian has no national calendars, so filtering `#nationalCalendars`
by rite yields an empty set. If the nation pass still ran, *every* Ambrosian
diocese would be an orphan and — with the guard dropped — all four would crash,
not just `lugano_ch`. Skipping the pass is what makes dropping the guard safe.

### State ownership fix

`#nationalCalendarsWithDioceses` is currently `static` (`CalendarSelect.js:33`)
while the option arrays are per-instance (lines 34-36). Today that is benign:
every instance derives the same list from the same full diocese set, and
`#hasNationalCalendarWithDioceses` makes the push idempotent. Under rite
filtering it is a bug — a Roman instance and an Ambrosian instance would
accumulate into one shared list, and whichever was constructed first would leak
its nations into the other's grouping.

`#nationalCalendarsWithDioceses` therefore moves from `static` to instance state.
`#nationalCalendars` and `#diocesanCalendars` stay static: they are the raw
metadata cache and are correctly shared. Only the *derived* per-rite grouping
becomes per-instance.

### Path composition

`CurrentEndpoint` gains a `rite` field. The segment is inserted directly after
`/calendar`, and whether it appears for Roman depends on linkage:

| Selection | No `RiteSelect` linked | `RiteSelect` linked |
| --- | --- | --- |
| Roman, rite-level | `/calendar` | `/calendar/roman` |
| Roman, national | `/calendar/nation/IT` | `/calendar/roman/nation/IT` |
| Roman, diocesan | `/calendar/diocese/roma_it` | `/calendar/roman/diocese/roma_it` |
| Ambrosian, rite-level | — | `/calendar/ambrosian` |
| Ambrosian, diocesan | — | `/calendar/ambrosian/diocese/lugano_ch` |
| Ambrosian, diocesan + year | — | `/calendar/ambrosian/diocese/lugano_ch/2026` |

Both Roman forms are the same request — `Router::extractRiteSegment()` shifts
`roman` off and leaves the remainder unchanged. Omitting it when no `RiteSelect`
is linked is what keeps existing embeds byte-identical; emitting it when one is
linked makes a rite-aware embed's URL self-describing and removes an
`if roman then omit` branch from the rite-aware path.

There is no `/calendar/ambrosian/nation/...` row because that route does not
exist — the API confirming the no-national-tier rule independently.

### `ApiOptions` linkage

`linkToCalendarSelect(calendarSelect, riteSelect?)` — optional second parameter.
Absent, nothing changes. Present, `ApiOptions` subscribes to the rite select's
`change` event and, per the rite:

- rebuilds the linked calendar select(s) against the new rite;
- relabels the empty option from `emptyOptionLabel`;
- hides the nation select when `hasNationalTier` is `false`;
- disables the Epiphany, Ascension, Corpus Christi and Eternal High Priest inputs
  when `hasFixedTemporalOptions` is `true`;
- sets `YearInput`'s `min` from `minYear`, restoring `1970` when switching back
  to Roman;
- **resets the calendar selection to the rite-level calendar** (the empty
  option). A Roman `calendar_id` is not valid under Ambrosian and vice versa, so
  carrying a selection across a rite change would emit a path the API rejects.
  The rite-level calendar is the only selection valid in both directions.

The existing enable/disable rule generalises rather than being replaced. It
becomes: *those four inputs are disabled if the rite fixes them, or if a nation
or diocese is selected.* `/calendar/ambrosian` accepts exactly the same parameter
set as `/calendar` — `YearType`, `Epiphany`, `Ascension`, `CorpusChristi`,
`EternalHighPriest` and the two headers — so nothing else needs a rite branch.

## Accepted trade-offs

**The dropped guard.** With the rite split, a Roman diocese whose nation has no
Roman national calendar can only arise from genuinely inconsistent API data. That
now throws `TypeError` from the unguarded `.find()`, exactly as before this work.
This is deliberate: the component asserts the API's contract and violations stay
loud. The cost is real and should be stated plainly — this failure mode surfaces
as an unhandled rejection inside `async` callers rather than a labelled error,
which is precisely why it cost a week of red frontend CI before anyone traced it.
The rite split makes it unreachable via Ambrosian; it remains reachable only via
inconsistent Roman data.

**Unhandled API failures.** Requests that the API rejects — an out-of-range year,
an unsupported combination — are not intercepted. The response surfaces.

**Year floor is enforced client-side, uniquely.** Setting `YearInput.min` to 1976
under Ambrosian is the one place the component pre-empts an API validation rather
than letting it surface. It is justified by being a native `<input type="number">`
attribute rather than a code path — the constraint is declarative, costs nothing,
and gives the browser's own affordance instead of a round-trip to a 400.

## Error handling

| Case | Behaviour |
| --- | --- |
| Unknown rite passed programmatically | Throw at construction, matching how `linkToCalendarSelect` already validates `_filter`. A typo'd rite is a caller bug. |
| API rejects a request | Surface it. No interception. |
| Roman diocese with no national calendar | `TypeError` — see accepted trade-offs. |

## Testing

Keeps the Jest/ESM setup introduced by the original PR #5
(`node --experimental-vm-modules $(yarn bin jest)`, the `tsconfig.json` excludes
for `**/*.test.*` and `./src/__tests__/**/*`) — this is the repo's first working
test setup and is worth retaining on its own merits. The metadata fixture is
extended with `rite` fields and an `ambrosian_calendars` entry.

1. **Inverted from the original PR #5** — under Roman, `lugano_ch` is absent
   *and* no `CH` nation option exists. The current test asserts the opposite
   ("A nation option for CH must exist so the group is actually selectable"),
   pinning the fabricated `CH` that the maintainer ruling forbids. That assertion
   is replaced, not extended.
2. Under Ambrosian, all four dioceses present, flat, with no nation `<optgroup>`
   and no nation options at all.
3. Roman grouping unchanged — `roma_it` under an `IT` optgroup.
4. **Instance isolation** — construct a Roman select, then an Ambrosian one, then
   assert the Roman one's markup is unchanged. Pins the `static` → instance move.
5. Path composition across every row of the table above, including both Roman
   forms and the year variant.
6. Empty-option relabelling per rite.
7. `YearInput.min` is `1976` under Ambrosian and back to `1970` under Roman.
8. The four temporal inputs are disabled under Ambrosian and re-enabled under
   Roman with no nation/diocese selected.

**Every one of these must be shown failing before the fix, not merely passing
after.** Test 4 especially: a leak-free result is indistinguishable from a test
that never exercised the leak.

## Scope

**In scope:** `liturgy-components-js` only — `src/Enums.js`, `src/RiteSelect/`,
`src/CalendarSelect/CalendarSelect.js`, `src/ApiOptions/ApiOptions.js`,
`src/ApiOptions/Input/YearInput.js`, `src/PathBuilder/PathBuilder.js`, tests,
docs, and a `1.4.0 → 1.5.0` version bump.

**Out of scope, tracked separately:**

- **LiturgicalCalendarFrontend** — no code change needed. It gets Roman-only
  behaviour from the default; unblocking its E2E is a pin bump in
  `layout/footer.php:110` and `examples.php:23,76` after the release. The RBAC
  permission form deliberately does not gain a rite picker.
- **API: reject fixed temporal params for Ambrosian.**
  `validateRiteCompatibility()` currently rejects only a non-null
  `NationalCalendar` and pre-1976 years; it accepts all four temporal params for
  Ambrosian, and `openapi.json` advertises them on `/calendar/ambrosian`. Given
  the praenotanda they should be rejected. Worth checking whether the Ambrosian
  engine currently *applies* them — if it does, a client can today request an
  Ambrosian calendar with Ascension moved to Sunday, which the Missal forbids.
- **API: stale 501 artifacts.** `openapi.json`'s 501 responses on the two
  Ambrosian diocesan routes, and the comments at `CalendarHandler.php:1161`
  and `:4318`.

## Open items

None blocking. The two API follow-ups above are independent of this work and do
not gate the release.
