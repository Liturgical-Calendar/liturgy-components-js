# `CalendarControls.onSelectionChange()` — design (issue #68)

## The problem

Both example pages migrated onto the meta-components carry the same hand-wired block:

```javascript
const calendarSelectElement = viewer.controls.calendarSelect._domElement;
setHolyDaysOfObligationBgColor(holydaysInput, calendarSelectElement.value);

calendarSelectElement.addEventListener('change', (ev) => {
    $(holydaysInput).multiselect('rebuild');
    setHolyDaysOfObligationBgColor(holydaysInput, ev.target.value);
});
```

The jQuery call is the consumer's business and stays there. What is not the consumer's business is the
state being derived: _"the selection is the rite-level calendar, so the holydays input is user-editable"_
versus _"a national or diocesan calendar predetermines it, so it is effectively read-only"_. That is the
library's own domain knowledge — it is the very rule `ApiOptions.#applyTemporalInputState()` implements
when it disables inputs — and every consumer re-derives it from a raw `change` event plus a `value === ''`
test.

The `value === ''` test is also **incomplete**, which is the strongest argument that consumers should not
be writing it. Under the Ambrosian rite the Missal fixes Epiphany, Ascension and Corpus Domini and does
not establish the Eternal High Priest, so those four inputs are predetermined **with no calendar
selected at all** — `value === ''` reports "user-editable" for four inputs `ApiOptions` has disabled.

## What ships

Two new members on `CalendarControls`, and nothing else public.

```javascript
/** @type {{calendarType: 'general'|'national'|'diocesan', calendarId: ?string, predeterminedInputs: ReadonlyArray<string>}} */
controls.selection;

controls.onSelectionChange(({ calendarType, calendarId, predeterminedInputs }) => { … }); // chainable
```

### The payload

| Key                   | Type                                    | Meaning                                                                                  |
| --------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------- |
| `calendarType`        | `'general' \| 'national' \| 'diocesan'` | What kind of calendar is selected. `'general'` is the rite-level calendar (empty value). |
| `calendarId`          | `string \| null`                        | The selected `calendar_id`; `null` under `'general'`.                                    |
| `predeterminedInputs` | `ReadonlyArray<string>`                 | The `ApiOptions` inputs whose values the current rite and calendar fix.                  |

**`calendarType` uses the `data-calendartype` vocabulary (`national`/`diocesan`) extended with
`'general'`**, which is `ApiClient`'s own cache-key category for the rite-level calendar. It is
deliberately **not** the exported `CalendarType` enum, whose values are the URL segments `nation`/`diocese`
— those describe a path, not a selection.

**`calendarId` is `null`, not `''`, under `'general'`.** The whole point of the issue is to retire the
`value === ''` test; handing back the same empty string invites it to be written again against the payload.

**`predeterminedInputs` names inputs by their canonical `ApiOptions` accessor** (`'epiphanyInput'`,
`'ascensionInput'`, `'corpusChristiInput'`, `'eternalHighPriestInput'`, `'holydaysOfObligationInput'`),
in that canonical order, frozen. That is the same vocabulary `theme.apiOptions` uses and the same names that
issue #62 gave the public accessors, so `controls.apiOptions[name]` reaches the input a consumer was told about.

**`rite` is deliberately not in the payload.** A consumer styling the Ambrosian rite-level calendar sees
`calendarType: 'general'` with four predetermined inputs, which is exactly the information the styling
needs; adding the rite would be a second way to ask the same question. Adding a key later is backward
compatible, removing one is not.

## Where `predeterminedInputs` comes from

**One rule, two readers** — the shape PR #87 established for `src/ApiOptions/FilterInputs.js`.

`ApiOptions.#applyTemporalInputState( calendarSelected )` today computes:

```javascript
const fixedTemporalDisabled = calendarSelected || this.#riteFixesTemporalOptions;
epiphany/ascension/corpusChristi/eternalHighPriest -> disabled( fixedTemporalDisabled )
holydaysOfObligation                               -> disabled( calendarSelected )
```

That rule moves into a new internal module, `src/ApiOptions/PredeterminedInputs.js`:

```javascript
predeterminedInputKeys({ calendarSelected, riteFixesTemporalOptions }) -> ReadonlyArray<string>
```

`#applyTemporalInputState()` is rewritten to call it and to disable exactly the inputs it names, storing
the result in a private field; a new internal getter `ApiOptions._predeterminedInputs` reports that field.
There is therefore **one copy of the rule**, applied by the disabling half and reported by the payload
half. A reviewer can check this by mutating the module and watching both the disabled state and the
payload move together.

Why not read the inputs' `disabled` state back off the DOM instead? Because
`HolydaysOfObligationInput.disabled()` overrides the base method and never sets `_domElement.disabled` —
it sets a (non-standard) `readonly` expando and disables each `<option>` individually. A DOM read-back
would therefore need its own special case for the one input the issue is actually about, which is a second
hand-rolled copy of the domain knowledge by another name.

**The candidate set is not duplicated either.** `FilterInputs.js` already names these five, under a doc
comment reading _"The five parameters a national or diocesan calendar predetermines"_ — the same fact.
`PredeterminedInputs.js` states its own split (the four the rite can fix, plus holydays, which follows the
calendar alone) because the rule needs the two halves separately, and a test asserts that the union of
those halves equals `inputKeysForFilter( ApiOptionsFilter.GENERAL_ROMAN )` in the same order. That pins
the relationship in both directions without making one list a positional slice of the other: if a filter
ever gains a sixth input, the test fails and a human decides which list it belongs to.

**What `_predeterminedInputs` reports is what `ApiOptions` has applied**, not an abstract fact about the
selection. There are two ways to observe the difference, and the empty/stale set describes the form
correctly in both:

- an `ApiOptions` never linked to a calendar select — `mountInto()` without `apiClient`, so `listenTo()`
  never runs — where nothing has ever been applied and nothing in the form reacts to the select either;
- a programmatic `CalendarSelect.value()`, which dispatches no `change`, so neither this nor `ApiClient`
  (which would not refetch for it) observes it until a `change` is dispatched.

Deriving the key live from the DOM instead was considered and declined: it would make this one key react
to a select that the rest of an unwired form still ignores — a less coherent payload rather than a more
accurate one — and the rite half could not be derived live at all, since `#riteFixesTemporalOptions` is
itself only ever set by the link. Both cases are documented in `docs/meta-components.md` and pinned by
tests. (Corrected after review: the first bullet was originally written as the only route.)

## When the callback fires

**Once per user action, on a microtask, and only when the state changed.** The mechanism is
`SubscriptionUrl.#scheduleNotify()`'s, for the reason that method's own comment gives: one selection moves
several inputs, every dispatch in that burst is synchronous, so a microtask flush reads settled state
while a synchronous callback would hand out an intermediate payload naming the calendar the user just
left.

`CalendarControls` attaches one `change` listener to the rite select and one to the calendar select, in
its constructor. Those are the only two inputs that can move the payload: a locale, year or year-type
change moves nothing in it. A rite change dispatches on both (and on several `ApiOptions` inputs) and
still notifies exactly once.

**Deduplication against the last announced payload**, seeded at construction, matching `onChange`'s
documented "fires when the URL changes". A `change` event that leaves all three keys identical — a raw
dispatch, reselecting the option already selected — notifies nobody, because there is nothing for a
consumer to restyle.

**It does not fire on subscribe.** Three reasons: it matches `onCalendarFetched()`, `onError()` and
`SubscriptionUrl.onChange()`, none of which replay; a callback invoked synchronously inside the
registration call runs consumer code before the registering statement has returned; and the initial state
is already available synchronously and race-free. The documented recipe is two lines, which is what both
examples already write:

```javascript
const paint = ({ calendarType, predeterminedInputs }) => { … };
paint(controls.selection);
controls.onSelectionChange(paint);
```

## Subscription mechanics

- `onSelectionChange()` is chainable, returns `this`, and throws naming the component if the argument is
  not a function (`SubscriptionUrl.onChange()`'s behaviour; `onError()`/`onCalendarFetched()` predate it
  and are left as they are).
- Both getters and the registrar throw once disposed, via the existing `#assertUsable()`.
- `dispose()` removes both `change` listeners — they are this class's own named closures, so unlike the
  ones `ApiClient.listenTo()` attaches they **can** be released — and clears the callback list and the
  pending microtask flag. The documented gap about `ApiClient`'s anonymous listeners is unchanged and is
  not overstated in either direction.

## What is not being done

- **`SubscriptionBuilder.onChange()` is left alone.** It notifies with a serialized **URL string** built
  from `SubscriptionUrl`'s own `CurrentEndpoint`, which tracks the year, locale, return type, rite and
  path as well as the calendar — a different payload watching a different set of inputs. Refactoring it
  onto this would either change its payload (a breaking change for the one thing it exists to publish) or
  make it a consumer of a mechanism that does not carry what it needs. The two now share a _shape_
  (microtask coalescing, dedupe against the last notification), which `ApiClient.#scheduleRefetch()`
  already made three instances of; unifying that mechanism is a refactor for its own change, not for this
  one. A `SubscriptionBuilder` consumer reaches the new API through `builder.controls.onSelectionChange()`
  regardless.
- **No forwarding methods on `CalendarViewer`, `ApiExplorer` or `SubscriptionBuilder`.** All three already
  expose `.controls`, which is how the issue's own example reaches `calendarSelect`.
- **No public `ApiOptions.predeterminedInputs`.** The getter is internal (`_`-prefixed, this codebase's
  convention for internal-but-reachable), because the public route is `CalendarControls`. Promoting it
  later is backward compatible.
- **The two examples that motivated the issue live in `Liturgical-Calendar/examples`, another repository**,
  so they cannot be migrated from here. `docs/meta-components.md` gains the before/after in their place.

## Tests

New: `src/__tests__/PredeterminedInputs.test.js` (the rule, and the agreement with `FilterInputs.js`) and
`src/__tests__/CalendarControlsSelectionChange.test.js`.

The frequency tests follow `AnnouncementFrequency.test.js`: real `change` events through the real wiring,
counting callback invocations, asserting the sequence rather than only a count — one rite change, one
calendar change, one locale change (zero), and three separate actions in a row. Each of those is
**mutation-verified**: the implementation is broken deliberately (notify synchronously instead of on a
microtask; drop the dedupe) and the test confirmed red before being kept.
