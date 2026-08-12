# `CalendarViewer`'s mount path and `RiteSelect.wrapper()` — design

A follow-up to [phase 2](./2026-08-11-meta-components-phase-2-design.md), shipped as 2.3.0. Phase 3
(`SubscriptionBuilder`) is blocked behind it: the migration phase 2 exists to enable cannot be carried out
for `examples/javascript/main.js`. Two defects block it, neither introduced by phase 3 — one is in what
2.3.0 shipped, the other is a gap in `RiteSelect` that predates the meta-components entirely and that the
theme bag has been silently papering over since 2.2.0.

## Problem

### `CalendarViewer` has no mount path other than `mountInto()`

`AcceptHeaderInput.hide()` sets a private flag, and `ApiOptions.appendTo()` reads it
(`src/ApiOptions/ApiOptions.js:1149`) to decide whether to render that input at all. So `hide()` is only
meaningful **before** the append.

`examples/javascript/main.js:97` calls it. Every other meta-component supports that ordering, because
each pairs a synchronous constructor with a public `appendTo()`:

| Component                | `appendTo()`                    | `listenTo()`              |
| ------------------------ | ------------------------------- | ------------------------- |
| `CalendarResourcePicker` | `CalendarResourcePicker.js:363` | — (never fetches)         |
| `DayViewer`              | `DayViewer.js:517`              | `DayViewer.js:404`        |
| `CalendarControls`       | `CalendarControls.js:342`       | `CalendarControls.js:426` |
| `ApiExplorer`            | `ApiExplorer.js:210`            | — (never fetches)         |
| `CalendarViewer`         | **absent**                      | **absent**                |

`CalendarViewer` has only the static async `mountInto()`, which constructs and appends in one call. There
is no window between the two, so `hide()` cannot be reached in time and `main.js` cannot migrate.

This is not a deliberate omission. `docs/meta-components.md:915-940` documents both missing methods as
though they existed:

> **`new CalendarViewer(options)`** is synchronous and requires an already-initialised `ApiBase` — it
> builds both halves but mounts neither.

and

> **Registration order, and why it matters.** `listenTo()` wires `controls` to the `ApiClient` before it
> wires `webCalendar` to it.

The constructor is documented as a supported entry point and is in fact a dead end — it builds two halves
with no way to mount either. `listenTo()` is described as a method and is really a paragraph about
`mountInto()`'s internals. `CLAUDE.md` makes the same claim for the family as a whole ("each
meta-component has a synchronous constructor … paired with `appendTo(target)`").

### `RiteSelect` is the only mountable select with no `wrapper()`

`main.js:76-84` hand-builds a `div`, gives it a Bootstrap grid class, and appends the rite select into it,
with a comment naming the reason: `RiteSelect` has no `wrapper()` of its own, unlike `CalendarSelect`.
`examples/fullcalendar/script.js` carries the structurally identical block.

`CalendarSelect.wrapper()` exists (`src/CalendarSelect/CalendarSelect.js:1008`), taking an
`{ as, class, id }` bag, and `Input` has its own `wrapper()` (`src/ApiOptions/Input/Input.js:581`), which
takes a bare tag name and pairs with a separate `wrapperClass()`. `RiteSelect`'s entire public surface is
`class`, `id`, `label`, `name` and `appendTo` — no wrapper in either shape.

The consequence reaches the meta-components' theme bag, whose role vocabulary is `select`, `input`,
`label` and `wrapper`. `Theme.js` already resolves the `wrapper` role for the rite select:

- `OVERRIDE_KEYS_BY_ROLE.select` lists `wrapperClass` (`Theme.js:72-79`), so `assertTheme` accepts
  `{ riteSelect: { wrapperClass: '…' } }` without complaint;
- `resolveChildTheme` maps the flat `theme.wrapper` onto `resolved.wrapperClass` (`Theme.js:226`) for
  every child, the rite select included.

Three components then resolve that bag and **discard** the `wrapperClass` it hands them, because there is
no method to pass it to — `CalendarControls.js:130-147`, `DayViewer.js:120-136` and
`CalendarResourcePicker.js:180-196` each read `class`, `labelClass` and `labelText` only. The same three
apply `wrapperClass` to their calendar select two lines later (e.g. `CalendarControls.js:179-183`).

So the bag documents `wrapper` as a role of the vocabulary and honours it for one of the two selects,
silently. `src/__tests__/MetaComponentThemeWrapperSymmetry.test.js:88-93,107` currently pins that as
correct, distinguishing `riteSelect`'s "genuine capability limit" from `localeInput`'s mere omission. It
was right about the code as it stood; giving `RiteSelect` the capability is what makes it wrong.

### What is _not_ blocking the migration

Established by inspection before scoping this work, so it does not creep in later:

- `main.js:99` `_yearInput.class( 'form-control' )` and `:102-103` `_epiphanyInput.wrapperClass()` /
  `_holydaysOfObligationInput.wrapperClass()` mutate elements built in the `Input` constructor
  (`Input.js:246-283`), which sets neither `#classSet` nor `#wrapperClassSet`. They work after the mount.
- `main.js:118`'s second pass, `filter( GENERAL_ROMAN ).appendTo( '#generalRomanOptions' )`, is reachable
  post-mount through `viewer.controls.apiOptions`.
- `Input.setGlobal*` (`main.js:43-47`) stays with the consumer, as phase 2's "Two deliberate non-goals"
  states. Being process-wide, it reaches the `ApiOptions` a meta-component builds internally.
- The jQuery `multiselect` treatment stays with the consumer, likewise per phase 2, reached through
  `controls.apiOptions._holydaysOfObligationInput`.

## Approach

Fix both defects at their source rather than routing around them.

An earlier draft of this design gave `CalendarControls.appendTo()` an optional `riteSelect` slot, so a
consumer could pass its own wrapper element as a mount target — mirroring the slot `ApiExplorer.appendTo()`
already has. That was rejected in favour of `RiteSelect.wrapper()`: the slot would let `main.js` keep its
hand-built `div` and hand it to the library, where `wrapper()` deletes the `div` from `main.js` and from
`fullcalendar/script.js` both, and simultaneously closes the theme-bag gap that no slot addresses.
`ApiExplorer` keeps its own `riteSelect` slot, which exists for an unrelated reason: `assets/js/index.js`
mounts the rite select in a genuinely separate container from the path builder.

## `RiteSelect.wrapper()`

New method on `src/RiteSelect/RiteSelect.js`, mirroring `CalendarSelect.wrapper()`
(`CalendarSelect.js:1008-1102`) rather than inventing a second convention. `CalendarSelect` is the right
model and `Input` is not: a rite select is a select, and `Input`'s split `wrapper()` / `wrapperClass()`
shape would give the theme bag two different contracts to drive for its two selects.

```javascript
riteSelect.wrapper({ as: 'div', class: 'form-group col col-md-2', id: 'riteWrapper' });
```

| Rule                   | Behaviour                                                                       |
| ---------------------- | ------------------------------------------------------------------------------- |
| Argument               | An object with at least one of `as`, `class`, `id`; or `null` for "no wrapper". |
| `as`                   | `'div'` or `'td'`; defaults to `'div'`. Any other value throws.                 |
| `class`                | Sanitized and validated per class name, as `CalendarSelect.wrapper()` does.     |
| `id`                   | Sanitized and validated as a CSS selector, likewise.                            |
| Repeat call            | Throws — a `#wrapperSet` one-shot guard, as on `CalendarSelect`.                |
| Return                 | `this`, chainable.                                                              |
| Default (never called) | No wrapper, exactly as today.                                                   |

`RiteSelect.appendTo()` (`RiteSelect.js:307`) gains the wrapper branch `CalendarSelect.appendTo()` already
uses (`CalendarSelect.js:1319-1324`): when a wrapper is set, the wrapper is appended to the target and the
select to the wrapper; otherwise the select goes to the target directly. The existing
`insertAdjacentElement( 'beforebegin', … )` label placement is unchanged and stays correct either way,
which is why it is expressed relative to the select rather than to the container.

`RiteSelect` has no `after()` concept, so `CalendarSelect.appendTo()`'s `#hasAfter` branch has no
counterpart here and is not ported.

## The three theme call sites

`CalendarControls`, `DayViewer` and `CalendarResourcePicker` each gain, next to their existing rite-select
theme handling, the three lines they already run for their calendar select:

```javascript
if (Object.hasOwn(riteTheme, 'wrapperClass')) {
    this.#riteSelect.wrapper({ class: riteTheme.wrapperClass });
}
```

`CalendarViewer` and `ApiExplorer` inherit this through the `CalendarControls` they hold; neither themes a
rite select itself.

**This changes existing layout**, and is the first of this work's two behaviour changes — the other being
the unknown-slot-name rejection below. A page passing flat
`theme: { wrapper: '…' }` today gets that class on its calendar select only; afterwards its rite select is
wrapped too. That is the intended reading of a role vocabulary — a `wrapper` role honoured for one of two
selects is not a vocabulary — and the alternative, honouring only an explicit `riteSelect.wrapperClass`
override while ignoring the flat default, would preserve the asymmetry in a form that is harder to explain
than the current one. 2.3.0 is days old and the `LiturgicalCalendarFrontend` migration has not happened, so
the reachable blast radius is the two examples in this repository.

## `CalendarViewer`'s public members

Five new members on `src/MetaComponents/CalendarViewer.js`, joining the existing `controls`, `webCalendar`
and `dispose()`. Every one calls `#assertUsable()` first, as the family requires.

| Member                    | Returns          | Behaviour                                                                            |
| ------------------------- | ---------------- | ------------------------------------------------------------------------------------ |
| `appendTo(slots, caller)` | `void`           | Mounts both halves. `caller` is internal, defaulting to `'CalendarViewer.appendTo'`. |
| `listenTo(apiClient)`     | `CalendarViewer` | Wires `controls` then `webCalendar`, in that order.                                  |
| `fetch()`                 | `Promise`        | Delegates to `controls.fetch()`.                                                     |
| `onError(cb)`             | `CalendarViewer` | Delegates to `controls.onError()`.                                                   |
| `onCalendarFetched(cb)`   | `CalendarViewer` | Delegates to `controls.onCalendarFetched()`.                                         |

`appendTo()` **requires the slots object** and does not accept a single target, unlike
`CalendarControls.appendTo()`. A viewer has two mandatory mounts; a lone target would have to pick one
silently. Slots are `{ controls, calendar, messages? }` — `controls` and `calendar` required, `messages`
optional and forwarded to `CalendarControls.appendTo()` as today.

It keeps the ordering rule already written into `mountInto()` and its comment at
`CalendarViewer.js:314-319`: **both required targets are resolved before either is mounted**, so an
unusable `calendar` selector cannot leave the controls half mounted in a document the caller has no viewer
to `dispose()`. Like the rest of the family, it is callable more than once, and moves its children rather
than copying them.

`listenTo()` is the reason this component cannot simply expose `controls` and let callers wire both halves
themselves. `EventEmitter.emit()` is a synchronous `forEach` in registration order, and `WebCalendar`'s
`calendarFetched` listener throws on malformed or empty `litcal`, aborting the iteration for anything
registered after it. Wiring `controls` first is what keeps a messages render from being suppressed by a
`WebCalendar` failure. That rule exists today only inside `mountInto()`'s body and in a documentation
paragraph; a consumer on the constructor path has to know it and reproduce it. This is the same class of
silent-failure trap as the rite's two wires, which is what the meta-component family exists to remove.

`fetch()` returns the promise to its caller and is never routed through `_discardRequest()` — the rule
`CalendarControls.fetch()`'s own doc comment states, and which a delegate must not quietly change.

### Unknown slot names now throw

`CalendarViewer.appendTo()` and `CalendarControls.appendTo()` reject any slot key outside their known set,
naming the offending key, as `ApiExplorer.appendTo()` already does (`ApiExplorer.js:227-234`). Today
`{ contorls: '#x' }` mounts nothing and returns successfully — the silent-failure shape this family exists
to close, and the same reasoning that makes `CalendarViewer`'s `webCalendar` bag reject unknown keys.

A caller currently passing an unrecognised key would newly throw. Called out in the changelog rather than
buried, but not treated as a reason to keep the silent path.

## Refactoring `mountInto()`

`CalendarViewer.mountInto()` is rewritten to call the new public methods instead of duplicating them:
validate options, construct, validate slots, cancellation check, `appendTo(slots,
'CalendarViewer.mountInto')`, `listenTo(apiClient)`, `onError(onError)`, then the existing `fetch()` +
`_discardRequest()` + `await fetchPromise.catch(() => {})` block unchanged.

Everything currently inline moves into the method that should have owned it, so the two entry points
cannot drift. The `caller` parameter is what keeps a bad target reported under
`CalendarViewer.mountInto` — the name the caller actually used — rather than under `appendTo`.

**Behaviour is unchanged.** `CalendarViewer.test.js` and `CalendarViewerStory.test.js` must pass
untouched. Any change needed there is a regression in this refactor, not a test to update.

## Testing

Jest with jsdom, `ApiBase.fromMetadata()` and `ApiBase.reset()` in `beforeEach`, no network, as the whole
family.

`RiteSelect.test.js` gains `wrapper()` parity coverage against `CalendarSelect`'s: `as` defaulting to
`div`, `td` accepted, any other value rejected, `null` meaning no wrapper, the one-shot guard, an invalid
class name and an invalid id each rejected, and `appendTo()` producing wrapper → select with the label
adjacent to and before the select.

`MetaComponentThemeWrapperSymmetry.test.js` has its two rite-select cases inverted — the flat bag must now
wrap the rite select in all three components — and gains `CalendarControls`, which it does not currently
cover. The comment at lines 69-75 explaining `riteSelect` as a capability limit is rewritten, since the
limit is what this work removes.

New `CalendarViewerMount.test.js`, following `CalendarControlsMount.test.js` and `DayViewerMount.test.js`:

1. The constructor path end-to-end: construct, `appendTo()`, `listenTo()`, `fetch()`.
2. **`_acceptHeaderInput.hide()` between construction and `appendTo()` suppresses the input** — the defect
   that motivated this spec, and the one test that would have caught it.
3. `listenTo()` registers the controls' listeners before `WebCalendar`'s: asserted by rendering messages
   from a fixture whose `litcal` is empty, so `WebCalendar`'s listener throws and the messages must still
   be in the DOM. Mutation-verified by swapping the two `listenTo()` calls and confirming it fails.
4. Unknown slot names rejected, naming the key; a missing `controls` or a missing `calendar` rejected.
5. A bad `calendar` target leaves nothing mounted — the partial-mount rule, now exercised through
   `appendTo()` and not only `mountInto()`.
6. The disposed guard on all five new members.
7. `appendTo()` callable twice, moving the children.

`yarn lint:dts` is a real gate: `RiteSelect.wrapper()` and five `CalendarViewer` members enter the public
type surface.

## Documentation

- `docs/rite-select.md` — `wrapper()` documented, with the `CalendarSelect` parity noted.
- `docs/meta-components.md` — a `CalendarViewer` "`appendTo()` and its slots" section; its two-getter
  public-members table replaced by one covering all eight members; the theme-bag section's "RiteSelect has
  none" carve-out removed.
- `CLAUDE.md` — its meta-components section already claims all five pair a constructor with
  `appendTo(target)`; that becomes true rather than aspirational. No edit needed beyond verifying it.
- `CHANGELOG.md` — 2.4.0, with the theme layout change and the unknown-slot-name rejection both called out
  explicitly as behaviour changes.

## Delivery

Ships as **2.4.0**. Additive except for the two behaviour changes named above, neither of which is a
signature or return-type change.

## Non-goals

- **The `examples/javascript/main.js` migration itself.** It lives in the `Liturgical-Calendar/examples`
  repository, with its own review cycle. This work is what unblocks it.
- **`examples/fullcalendar/script.js`.** Same repository, same reasoning; it benefits from
  `RiteSelect.wrapper()` identically but is a separate change.
- **`SubscriptionBuilder`.** Phase 3, unchanged in scope by this work.
- **Widening the theme bag to reach `ApiOptions`' inputs.** `CalendarControls` themes only its two selects;
  the inputs are still styled through `Input.setGlobal*` by the consumer. That is phase 2's stated
  non-goal and stays one — this spec closes the gap between the bag's vocabulary and `RiteSelect`, not the
  separate gap between the bag and `ApiOptions`.
