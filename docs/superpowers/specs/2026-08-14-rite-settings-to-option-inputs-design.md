# Applying a rite's published settings to the option inputs

Issue: [#70](https://github.com/Liturgical-Calendar/liturgy-components-js/issues/70) —
"Rite switch disables the temporal inputs but leaves stale values".

Date: 2026-08-14

## The bug

`ApiOptions.#handleLinkedRiteSelect()`'s `applyRite()` calls `#applyTemporalInputState( false )`,
which **disables** the Epiphany / Ascension / Corpus Christi / Eternal High Priest inputs whenever the
rite fixes them, and stops there. Nothing ever **sets** them. There is no rite-level counterpart to
`#applySettingsToInputs()`, the method that applies a nation's or a diocese's settings when a calendar
is selected.

So the four inputs freeze at whatever was last displayed. Select Italy (`ascension: SUNDAY`), switch to
Ambrosian, and the greyed-out select still reads `SUNDAY` while `/calendar/ambrosian` is computed with
the Thursday the Ambrosian Missal fixes.

It hides on a clean page because the Ambrosian **fixed** values and the General Roman **default** values
coincide exactly — `JAN6` / `THURSDAY` / `THURSDAY` / `false` in both columns. Different in kind,
identical in effect, so a rite switch on an untouched form computes the right calendar by accident.

Note that the four inputs' own untouched state is not those values but the empty `--` option, which
means "unspecified" and lets the API apply its own default. So a clean form does not _display_ what the
Ambrosian rite fixes either; it merely fails to contradict it.

### The second, invisible half

`ApiClient.fetchCalendar()` POSTs `#params` — `epiphany`, `ascension`, `corpus_christi`,
`eternal_high_priest`, `holydays_of_obligation` — as the request body for the **rite-level** calendar.
(`fetchNationalCalendar()` and `fetchDiocesanCalendar()` destructure all five away, which is why the
inputs are disabled once a calendar is selected.) `ApiClient` learns those values **only** from `change`
listeners on the inputs, so a value the user picked by hand under the Roman rite survives a rite switch
in `#params` and is sent to `/calendar/ambrosian` — a request that moves a feast the Missal fixes,
exactly what `#applyTemporalInputState()`'s own doc comment says the disable is there to prevent.

Setting the input values without notifying `ApiClient` would fix only the visible half. The year clamp
and the locale rebuild in the same `applyRite()` already establish the pattern: assign, compare, and
dispatch `change` when the value actually moved.

## Unblocked: the API now publishes the settings

The issue was filed blocked on [LiturgicalCalendarAPI#776](https://github.com/Liturgical-Calendar/LiturgicalCalendarAPI/issues/776),
because `/calendars` served `ambrosian_calendars[]` with no `settings`. That has shipped. Verified
against `https://litcal.johnromanodorazio.com/api/dev/calendars` on 2026-08-14:

```json
"ambrosian_calendars": [
  {
    "calendar_id": "ambrosian",
    "rite": "ambrosian",
    "locales": ["it", "la"],
    "settings": {
      "epiphany": "JAN6",
      "ascension": "THURSDAY",
      "corpus_christi": "THURSDAY",
      "eternal_high_priest": false,
      "holydays_of_obligation": {
        "Christmas": true, "Circoncisione": true, "Epiphany": true,
        "Ascension": true, "Pentecost": true, "ImmaculateConception": true,
        "Assumption": true, "AllSaints": true, "StAmbrose": true,
        "DedicationDuomo": true
      }
    }
  }
]
```

So the metadata route the issue prefers is taken. `RiteProperties` in `src/Enums.js` is **not** extended
with fixed temporal values: that alternative copies liturgical law into the client where it can drift
from the API silently, and the reason to hold it in reserve has expired rather than strengthened.

## The fifth input the issue did not anticipate

The published `settings` also carries `holydays_of_obligation`, which the issue's table omits. It is a
fifth affected input, and the Ambrosian list is **not** a re-selection of the Roman one:

|                                                                  | in the Roman list | in the Ambrosian list |
| ---------------------------------------------------------------- | ----------------- | --------------------- |
| `Christmas`, `Epiphany`, `Ascension`, `ImmaculateConception`     | yes               | yes                   |
| `Assumption`, `AllSaints`                                        | yes               | yes                   |
| `CorpusChristi`, `MaryMotherOfGod`, `StJoseph`, `StsPeterPaulAp` | yes               | **no**                |
| `Circoncisione`, `Pentecost`, `StAmbrose`, `DedicationDuomo`     | **no**            | yes                   |

`holydaysOfObligationInput` is **not** disabled by rite — `#applyTemporalInputState()` gates it on the
calendar-selection half alone, because no rite fixes it — and its value **is** sent in the
`/calendar/ambrosian` body. So ignoring the key would leave the Ambrosian rite-level form offering and
requesting `StJoseph` and `StsPeterPaulAp`, and never offering `StAmbrose`. It is the same defect as the
four, one input over. It is in scope.

## Design

### 1. One shared rite-level-calendar lookup

`#applyRiteToLocaleInput()` already resolves the rite's own calendar by convention — metadata announces
it under `{rite}_calendars`, which `ApiBase.riteCalendars()` reads — and the Roman rite deliberately has
no such key, so the lookup yields `null`. That lookup moves into a private
`#riteLevelCalendar( rite )` and both consumers call it. No behaviour change for the locale input.

### 2. `#applyRiteToTemporalInputs( rite )`, called from `applyRite()`

Called immediately **before** `#applyTemporalInputState( false )`, so the enable/disable pass stays the
last word on input state — a convention borrowed from the calendar path, not a bug fix. `applyRite()`
passes a hardcoded `false`, which re-enables all five inputs unconditionally, so swapping the two lines
would produce identical DOM today and no test would fail. The order is still worth keeping:
`HolydaysOfObligationInput.setOptions()` rebuilds its `<option>` elements without the per-option
`disabled` flag its own `disabled()` override sets, so the first time this runs with a calendar still
selected — the only case where the state pass disables rather than enables — the reversed order would
silently re-enable the whole list.

For each of the four `settings` keys that maps to an input:

- **absent key, or no rite-level calendar, or no `settings`: leave the value alone.** The Roman rite has
  no `roman_calendars` entry at all, so this is the path every Roman page takes and it must be a no-op.
- **a value no `<option>` carries: leave the value alone.** Assigning an unmatched value to a `<select>`
  leaves `selectedIndex === -1` and the DOM discards it, so the input would read `''` — blanking, which
  is precisely what must not happen. API drift degrades to "unchanged", not to "empty".
- **otherwise: assign, and dispatch `change` only if the value moved.** Conditional for the reason the
  locale rebuild in the same function is conditional: `ApiClient` treats a `change` as "refetch".

### 3. Holy days of obligation follow the **locale input's** rule, not the four values' rule

The four are _values_ drawn from a fixed option list. Holy days of obligation, like locales, are an
_option list the rite defines_. `#applyRiteToLocaleInput()` already narrows that list when the rite
publishes one and calls `resetOptions()` when it does not; the holydays input gets the same treatment:

- rite publishes `holydays_of_obligation` -> that list becomes the options, **exactly**;
- rite publishes none -> the input's own `BASE_OPTIONS` are restored.

This is what keeps `Circoncisione` / `StAmbrose` / `DedicationDuomo` from surviving an Ambrosian ->
Roman switch into a General Roman Calendar form and request. Leaving the _list_ alone there would be a
regression introduced by this fix, not a case of "leave the values alone": the requirement that an
unpublished rite must not blank anything is about values, and restoring an input's own documented
defaults is not blanking. The four temporal values need no equivalent restore, because the Ambrosian
fixed values they are left holding are also the General Roman defaults — so the Roman calendar the form
then describes is the same one the untouched `--` would have asked for.

A `change` is dispatched only when the selected-state map actually changed, on the same rule as the four.

### 4. `HolydaysOfObligationInput.setOptions( options, merge = true )`

`setOptions()` runs its argument through `mergeOptions()`, which starts from `BASE_OPTIONS` and overlays.
For a national calendar that is invisible — every `national_calendars[].settings.holydays_of_obligation`
the API serves names all ten base keys, so merge and replace agree. For the Ambrosian list they do not:
merging keeps `CorpusChristi`, `MaryMotherOfGod`, `StJoseph` and `StsPeterPaulAp` at their base
`selected: true`, so the form would assert they are Ambrosian holy days of obligation. They are not.

A second parameter, defaulting to `true`, preserves every existing call byte-for-byte; the rite path
passes `false` and gets the published list exactly. The constructor's documented "merged with the base
options" contract is untouched.

## What is deliberately NOT changed

- **`RiteProperties`** gains no temporal values. See above.
- **`mergeOptions()`'s default semantics**, and the constructor's use of them.
- **The national/diocesan path.** `#applySettingsToInputs()` still does not dispatch `change`, so
  `ApiClient.#params` still does not follow a _nation's_ settings. That is harmless today — the five
  params are destructured away for national and diocesan requests — and it is a separate concern from
  this issue.
- **`ApiOptions`' accessors.** Issue #62 renames/aliases them next in this same file; the diff stays
  inside the rite/settings logic so both merge cleanly.

## Fixture reconciliation

`src/__fixtures__/metadata.js` had an `ambrosian_calendars[0].settings` block removed in `dab21b5`
(PR #71) precisely because the API served none. The API now serves one, so the fixture is behind
reality in the opposite direction — equally wrong, and the block goes back, copied verbatim from the
live response above including `holydays_of_obligation`. The comment is rewritten to record that the
fixture tracks the live response at this commit, and why that matters in both directions.

## Testing

New suite `src/__tests__/ApiOptionsRiteTemporalSettings.test.js`:

1. **The divergent case, which is the whole point.** Local metadata whose `IT` differs from the
   Ambrosian fixed values on all four keys and on the holydays list; select `IT`, assert the inputs show
   Italy's values, switch the rite, assert they show the **rite's**.
2. **A clean page lands on the rite's values too** — labelled as the case that hid the bug, since
   before the fix it read the harmless-looking `--` rather than a contradiction.
3. **Roman, publishing nothing, leaves the four values alone** — hand-edit the inputs, switch
   Ambrosian -> Roman, assert the four are untouched.
4. **Roman restores the holydays option list**, so Ambrosian-only entries do not survive the switch.
5. **`ApiClient.#params` follows**, observed through the request body of a `fetchCalendar()` after a
   rite switch: the pre-fix body carries the stale hand-picked value.
6. **No settings published at all** (an `ambrosian_calendars` entry without `settings`, i.e. the
   pre-#776 shape) is a no-op on all five inputs — the library must not require the newer API.
7. **A published value no option carries** leaves the input unchanged rather than blank.
8. **`HolydaysOfObligationInput.setOptions( list, false )`** replaces exactly; the default still merges.
