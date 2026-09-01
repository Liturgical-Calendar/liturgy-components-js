# `ApiOptions.onSettled()` — design (issue #55)

**Date:** 2026-09-01
**Status:** Designed, not implemented
**Target release:** a minor — see [Semver](#semver-this-is-a-minor-and-55-says-otherwise) below, which
corrects issue #55's own conclusion

## The problem

`ApiOptions` responds to one user action by rewriting several of its own inputs and dispatching a synthetic
`change` on each — `ApiOptions.js:522` (temporal inputs), `:577` (holydays), `:681` (calendar path), `:783`
(year), `:809` (locale), `:838` (calendar select). Those events are `new Event( 'change' )`, byte-identical
to what a real user edit produces.

Every downstream listener therefore sees a burst of events, in attachment order, while the state they
describe is still half-updated — and has no way to tell _"the cascade has finished"_ from _"the cascade is
mid-flight"_. The layer that **causes** the burst does not **describe** it.

Three consumers have each solved this independently, with the same five-line microtask idiom:

| Consumer                                      | Defence                        | Shipped in                            |
| --------------------------------------------- | ------------------------------ | ------------------------------------- |
| `ApiClient.#scheduleRefetch()`                | microtask-coalesced refetch    | #50, released in 2.5.0                |
| `SubscriptionUrl.#scheduleNotify()`           | microtask-coalesced `onChange` | the `SubscriptionBuilder` work, 2.7.0 |
| `CalendarControls.#scheduleSelectionNotify()` | microtask-coalesced `onChange` | #68 / PR #88, released in 2.8.0       |

Issue #55 was written as conditional on a third instance appearing. It has, and the failure it guards
against is not hypothetical: selecting a nation fired `SubscriptionUrl`'s `onChange` **twice**, the first
call carrying the calendar the user had just left, because `linkToCalendarSelect()`'s listener is registered
before the renderer's and synchronously dispatches on the locale input.

## What ships

Two new members on `ApiOptions`, and nothing else public.

```javascript
/**
 * Fires once after the form has settled, on a microtask. Does not fire on subscribe.
 * @returns {function(): void} Unsubscribe.
 */
const unsubscribe = apiOptions.onSettled(() => {
    // read whatever you need; every input has settled
    const locale = apiOptions.localeInput.value();
});

unsubscribe();
```

The callback takes **no argument**. All three existing coalescers already re-read the state they need at
flush time — `refetchCalendarData()`, `this.url`, `this.selection` — so a payload would be a second way to
read state the ten accessors from #62 already expose, and the two readers could then drift. That drift is
the exact failure those accessors were introduced to prevent.

### `onSettled()` returns an unsubscribe function, not `this`

This diverges deliberately from `onSelectionChange()`, `onChange()` and `onError()`, which return `this` for
chaining. `ApiOptions` has **no `dispose()`**, so a subscription registered on it has no lifecycle method to
release it. `CalendarControls.dispose()` already documents a gap it cannot close — the anonymous listeners
`ApiClient.listenTo()` attaches — and adding a second unreleasable subscription mechanism would widen it.

Returning the unsubscribe is the smallest thing that makes the subscription releasable without inventing an
`ApiOptions.dispose()` and the teardown semantics that would come with it. Chaining is not lost in practice:
nothing in the library chains off a registrar today.

### Subscription mechanics, inherited rather than invented

- **Throws for a non-function**, matching the three existing registrars.
- **Does not fire on subscribe.** `onSelectionChange()`, `onChange()` and `onError()` all follow this rule,
  and CLAUDE.md documents the reasoning: the state is a synchronous, race-free read, so the initial pass is
  `read(); subscribe();` rather than a synthetic first delivery.
- **The notify loop is `forEach`, not `for...of`**, so a callback registered by another callback does not
  fire inside that same flush — which would contradict the rule above. `SubscriptionUrl` and
  `EventEmitter.emit()` both notify this way.
- **Unsubscribing replaces the callback array rather than splicing it**, so a subscriber that removes itself
  mid-flush does not cause the next one to be skipped. `EventEmitter.off()` is written exactly that way —
  it rebuilds the array from two `slice()` calls — and has been since 2.2.0.

## Detection and timing

`ApiOptions` attaches one `change` listener per input in `#inputs`, marks itself dirty, and flushes on
`Promise.resolve().then()`, notifying every subscriber once.

**All ten inputs are listened to regardless of `filter`.** They all exist; `filter` decides only which are
appended. This is the same rule theming follows — `theme.apiOptions` themes all ten and a hidden one stays
inert — and keeping the two rules identical is what stops a filter change from silently narrowing the signal.

**The linked selects are included when they have been linked.** `linkToCalendarSelect()` and
`linkToRiteSelect()` are what make a rite change the most important batch origin there is, so the listener
goes on at link time. An `ApiOptions` with neither linked covers only its own inputs — documented as a limit,
not worked around, because there is no third place the component could learn about a select it was never
given.

**The pending marker is cleared before notifying**, so a `change` arriving during the flush schedules a new
batch rather than joining a departing one. This is `ApiClient.#scheduleRefetch()`'s rule, kept verbatim; its
comment already states why.

### Why a microtask, and why that is not a new risk

The horizon is already justified in `ApiClient`'s doc comment and pinned by its tests: every dispatch in a
cascade is synchronous — `ApiOptions` and `CalendarSelect` both use `dispatchEvent( new Event( 'change' ) )`
— so the whole burst has landed before the flush runs, and nothing beyond the current turn is swallowed.

This design **relocates a mechanism whose edge cases are already mapped** rather than inventing a second one.
That is the main reason to prefer it over synchronous batch brackets, which would emit at the end of each
cascade-originating handler. Brackets cannot cover a lone edit of an input `ApiOptions` does not handle — the
year input, say — so they would need listeners anyway, and would then emit on two different timings.

### No dedupe at this layer

`ApiOptions` does not know what a consumer derives, so deduping here would flatten three different semantics
into one. `SubscriptionUrl` keeps deduping on the serialized URL and `CalendarControls` on its selection key;
both stay exactly as they are, minus their scheduling.

## What replaces the three coalescers — and what does not

**`ApiClient.#scheduleRefetch()` is kept.** This is the one point where the design departs from issue #55's
framing, and it is deliberate.

`ApiClient.listenTo()` accepts a `CalendarSelect` or a `RiteSelect` with **no `ApiOptions` in the picture at
all**. On such a page a rite change still produces two events — the rite select's own, plus the one
`CalendarSelect.#applyLinkedRite()` dispatches when it writes `''` — and there is no `ApiOptions` to describe
that batch. That is #50's original bug, reachable with no `ApiOptions` mounted.

So the two coalescers exist for different reasons, and only one of them is the duplication #55 is about:

- `ApiOptions` coalesces because it **causes** a cascade.
- `ApiClient` coalesces because it **multiplexes several independent sources**.

They share five lines of idiom and nothing else. `ApiClient.#scheduleRefetch()`'s doc comment gains that
distinction, so the next reader does not mistake it for a fourth copy of the same mistake.

| Coalescer                                     | After this change                          |
| --------------------------------------------- | ------------------------------------------ |
| `SubscriptionUrl.#scheduleNotify()`           | **deleted** → an `onSettled` subscription  |
| `CalendarControls.#scheduleSelectionNotify()` | **deleted** → an `onSettled` subscription  |
| `ApiClient.#scheduleRefetch()`                | **kept**, doc comment records why it stays |

Three copies become one producer plus one principled multiplexer. Chasing zero would mean `ApiClient`
routing select changes through an `ApiOptions` when one exists and not when it does not — conditional wiring
whose two paths would need testing separately, to remove five lines that are correct today.

## Semver: this is a minor, and #55 says otherwise

Issue #55 concludes that the fix is semver-visible and "stays queued for the 3.0.0 window". **That
conclusion applies to a different design than this one, and this spec supersedes it.**

It is semver-visible only if the intermediate dispatches change. Here they do not:

- Every per-input `change` dispatch fires exactly as it does today.
- `PathBuilder`'s ten per-input listeners are untouched and need no migration. #55 named that migration as
  the reason a major was required; the additive shape removes the requirement rather than solving it.
- A consumer listening directly to an input element observes no difference.

The suppressing design #55 describes remains available later, and this does not foreclose it. It does remove
the reason to wait for it.

## What is not being done

- **No shared-helper extraction.** #55 argues against factoring the three copies into one internal module,
  and this is not a disguised version of that: the mechanism moves **into the layer that causes the burst**,
  which is the fix the issue asks for, rather than hiding three copies behind a fourth name while
  `ApiOptions` still fails to describe its batch.
- **No suppression of the intermediate dispatches.** That is the major-version design, deliberately deferred.
- **No `detail.synthetic` / `isTrusted` gating.** Refuted during the 2.5.0 work and recorded at
  `CHANGELOG.md:977`; origin is not settledness. Nothing here reopens it.
- **No payload**, per the accessor-drift reasoning above.
- **No `ApiOptions.dispose()`.** The unsubscribe function is what makes that unnecessary here. A real
  `dispose()` is worth its own issue, since it would also want to address the gap `CalendarControls.dispose()`
  documents.

## Tests

A new `ApiOptionsSettledSignal.test.js`, modelled on `ApiClientRequestCoalescing.test.js`:

- **One action, one signal** — asserted separately for each of the four cascade origins: the rite select, the
  nation/diocese pair, the calendar select, and the calendar path input.
- **Two actions in separate turns, two signals.** This is the load-bearing one. Its counterpart is the last
  test in `ApiClientRequestCoalescing.test.js`, and it is what keeps coalescing from swallowing a second,
  genuine user action.
- **A lone edit signals too** — changing only the year input, which originates no cascade, must still notify.
  This is what lets a consumer drop per-input listening entirely, so it is a requirement rather than a nicety.
- **A throwing callback is isolated**: reported to the console, and neither breaking the flush nor preventing
  the remaining subscribers from being notified. Follows `Settled.js`'s `deliverFetchFailure()` precedent.
- **Unsubscribe during a flush** does not skip the next subscriber.
- **An unlinked `ApiOptions`** signals for its own inputs and does not throw.

Tests must `await Promise.resolve()` before asserting, as the existing coalescing tests do.

The regression net for the two migrated consumers is their existing suites —
`CalendarControlsSelectionChange.test.js` and the `SubscriptionBuilder` tests — which assert the observable
contract (one notification per action, deduped) rather than the scheduling mechanism, and must stay green
unchanged. If either needs editing to accommodate this, that is a signal the migration changed behaviour and
should be treated as a defect rather than a test to update.
