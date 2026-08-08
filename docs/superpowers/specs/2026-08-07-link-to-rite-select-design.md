# `CalendarSelect.linkToRiteSelect()` — design

Issue: [#26](https://github.com/Liturgical-Calendar/liturgy-components-js/issues/26)

## Problem

The only way to make a `CalendarSelect` react to a `RiteSelect` today is
`ApiOptions.linkToCalendarSelect( calendarSelect, riteSelect )`. That works when the page has an
`ApiOptions`, and leaves a gap when it does not: **a `CalendarSelect` used on its own cannot be made
rite-aware through any public API.**

The gap is concrete. [LiturgicalCalendarFrontend#430](https://github.com/Liturgical-Calendar/LiturgicalCalendarFrontend/pull/430)
added `RiteSelect` to the two public frontend forms, and had to leave three admin forms out:

| File                               | Shape                                                       |
| ---------------------------------- | ----------------------------------------------------------- |
| `assets/js/permission-requests.js` | `new CalendarSelect(locale).filter(filter).allowNull(true)` |
| `assets/js/admin-permissions.js`   | same                                                        |
| `assets/js/admin-tests.js`         | same                                                        |

In each, `filter` is `NATIONAL_CALENDARS` or `DIOCESAN_CALENDARS` chosen at runtime, the select
scopes a permission or a test, and there is no `ApiOptions` on the page at all.

Nothing public reaches that case:

- `ApiOptions.linkToCalendarSelect` accepts a single `none`-filtered select, or an array of exactly
  two (one `nations`, one `dioceses`). A lone filtered select fits neither branch, and there is no
  `ApiOptions` instance to call it on regardless.
- `RiteSelect` emits no events. Its surface is `appendTo`, `class`, `id`, `label`, `name`.
- `ApiClient.listenTo( riteSelect )` feeds the rite into fetches; it does not rebuild a calendar
  select's option list, which is the part that matters when picking an Ambrosian diocese.
- `CalendarSelect.rite()` is one-shot — it throws on a second call — so it can pin a fixed rite but
  cannot track a user-driven selector.

The machinery exists but is private: `ApiOptions#handleLinkedRiteSelect` calls
`calendarSelect._applyRite( rite, true )`, clears `_domElement.value` either side of the rebuild, and
calls `_setHidden()` on the nation select when the rite has no national tier.

## API

```javascript
const riteSelect = new RiteSelect( 'it' );
riteSelect.appendTo( '#riteWrapper' );

const calSelect = new CalendarSelect( 'it' )
    .filter( CalendarSelectFilter.DIOCESAN_CALENDARS )
    .allowNull( true )
    .linkToRiteSelect( riteSelect );
calSelect.appendTo( mount );
```

Chainable, returns `this`, mirroring `linkToNationsSelect()`.

Accepts any filter — `none`, `nations`, `dioceses` — which is what the admin forms need.

Throws when:

- the argument is not a `RiteSelect` instance
- this select is already linked to a rite select (guarded by a private `#riteLinked` flag, matching
  the `#linked` flag `linkToNationsSelect` uses)

Because `ApiOptions.linkToCalendarSelect( calendarSelect, riteSelect )` now routes through this same
method, the guard also covers the mixed case: a select passed to `ApiOptions` with a rite select
**and** linked directly is linked twice, and the second call throws whichever order they happen in.
That is the intended outcome — two rite listeners on one select would apply the rite twice per
change — and the message names the flag so the cause is obvious rather than looking like an internal
error.

## Behaviour

The listener is attached to the rite select's DOM element, and applied **once immediately** with the
rite select's current value, so a select that mounts under an already-chosen rite is correct without
waiting for a change.

On each application:

1. Clear the value, call `_applyRite( rite, true )`, clear the value again.
2. If this select is `nations`-filtered, `_setHidden( !hasNationalTier )` — hidden under a rite with
   no national tier, shown again otherwise.
3. Dispatch `change`, subject to the rule below.

Step 1's clear-**before**-and-after ordering is carried over verbatim from
`#handleLinkedRiteSelect`, and is load-bearing: a diocese select linked via `linkToNationsSelect()`
re-derives its per-nation narrowing from the nation select's _current_ value inside `_applyRite()`,
so that value must already be reset rather than still holding the outgoing rite's.

Step 2 was chosen over emptying-and-disabling, or leaving it to the caller, so that a standalone
nation select behaves the same as the nation half of the existing paired form.

### The dispatch rule

`ApiOptions` today dispatches `change` on every select **except** `nations`-filtered ones, because
`linkToNationsSelect()` attaches its own listener to the nation select which would re-derive the
diocese options for the (now empty) nation value, stomping the flat, ungrouped list `_applyRite()`
had just built for a tierless rite.

That exclusion is a **proxy** for the real condition. The rule that is actually wanted is _"do not
dispatch on a nation select that has a diocese select depending on it"_. It is implemented as
_"never dispatch on a nation select"_ only because the link is one-directional: the diocese select
holds `#linkedNationsSelect`, and the nation select knows nothing about its dependents.

That is harmless for `ApiOptions`, which only ever pairs them. It is wrong for the case this feature
exists to serve: a **standalone** nation select would reset its value with no `change` fired, leaving
a consumer such as `permission-requests.js` holding a stale scope.

So the link gains a back-reference. Inside `linkToNationsSelect`, on the nations instance:

```javascript
calendarSelectInstance._registerDependentDioceseSelect( this );
```

The nations instance records it in a private list, and the dispatch rule becomes exact: **dispatch
unless this select has dependent diocese selects.** This changes nothing for `ApiOptions`, which
always pairs, and makes a standalone nation select notify its listeners as it should.

> **What implementation changed.** This section is kept as designed, but the dispatch rule gained a
> second half that only emerged once the code existed. With `ApiOptions` delegating, the rebuild's
> dispatch fired _before_ `ApiOptions` had updated `#currentEndpoint`, so `PathBuilder` rendered a
> stale path; adding a second dispatch afterwards then produced two `change` events per rite change
> and a duplicate fetch. The shipped signature is therefore
> `linkToRiteSelect( riteSelect, dispatchChange = true )`: a standalone select dispatches for itself,
> and `ApiOptions` passes `false` to become the sole dispatcher once its own state is current. The
> rule above still governs _whether_ a select is eligible to be dispatched to; `dispatchChange`
> governs _who_ does it.

## ApiOptions refactor

`#handleLinkedRiteSelect` delegates the calendar-side work and keeps its own:

| Moves to `linkToRiteSelect`      | Stays in `ApiOptions`                                            |
| -------------------------------- | ---------------------------------------------------------------- |
| clear → `_applyRite` → clear     | `#currentEndpoint.rite` / `calendarType` / `calendarId`          |
| hide nation select when tierless | `#riteFixesTemporalOptions`, `#applyTemporalInputState( false )` |
| dispatch `change`                | `yearInput.min()` plus the clamp-and-dispatch                    |
|                                  | `#applyRiteToCalendarPathInput`, `#applyRiteToLocaleInput`       |

Ordering is preserved: `ApiOptions`' own work runs **after** the calendar rebuild, because
`#applyTemporalInputState( false )` assumes the selection has already been reset.

One implementation of the rite-to-calendar rebuild, so the two cannot drift.

## Testing

A regression in exactly this area — the path-builder filter switch, [#27](https://github.com/Liturgical-Calendar/liturgy-components-js/pull/27) —
reached `main` because no test covered it. So the refactor is done under characterization tests
rather than after it.

1. **Characterize first.** Pin today's `ApiOptions` rite behaviour before touching it: paired and
   single linked forms, the nation select hiding under a tierless rite, the year clamp, and which
   selects receive a `change` dispatch. These must still pass unchanged after the extraction — that
   is what proves the refactor is behaviour-preserving.
2. **Then extract**, and point `ApiOptions` at the new method.
3. **New coverage** for what the feature adds: a standalone `none`, `nations` and `dioceses` select
   each tracking a rite change; the nation select hiding and un-hiding; a standalone nation select
   dispatching `change` while a paired one still does not; the double-link guard; and the type check.

## Out of scope

- **`usage.php`'s Calendar subscription section.** It renders
  `LiturgicalCalendar\Components\CalendarSelect` server-side from **liturgy-components-php**, which
  has no `RiteSelect` at all. A JavaScript component cannot reach it.
- **Wiring the three admin forms.** That is frontend work, and follows once this ships.
- **Making `RiteSelect` an event emitter.** Listening to its DOM element is enough here; a public
  event surface is a larger API decision and nothing in this feature needs it.
