# RiteSelect examples and ApiClient rite support — design

**Date:** 2026-08-07
**Status:** approved, pending implementation plan
**Follows:** [2026-08-06-rite-select-design.md](2026-08-06-rite-select-design.md)

## Problem

Nothing in `examples/` exercises `RiteSelect`. The five existing examples predate the rite feature, so an
integrator reading them has no working reference for the rite → calendar chain, for the rite as a path
segment, or for what an Ambrosian calendar actually renders as.

Writing those examples surfaced a gap that blocks one of them outright.

### ApiClient is not rite-aware

`grep -ci rite src/ApiClient/ApiClient.js` returns `0`. The three fetch methods hard-code the Roman
routes, and `listenTo()` accepts only `CalendarSelect` and `ApiOptions`:

```text
/calendar          /calendar/nation/{id}          /calendar/diocese/{id}
```

So the rite reaches the path `PathBuilder` _displays_ but not the request `ApiClient` _makes_. Verified
against the live dev API:

| Route                                   | Status  | Note                              |
| --------------------------------------- | ------- | --------------------------------- |
| `/calendar/diocese/lugano_ch`           | **400** | what `ApiClient` sends today      |
| `/calendar/ambrosian/diocese/lugano_ch` | 200     | the correct route                 |
| `/calendar/ambrosian`                   | 200     | the rite-level Ambrosian calendar |

Any embed that wires an `ApiClient` to a rite-aware `CalendarSelect` therefore emits a 400 as soon as the
user selects an Ambrosian diocese. Fixing this is in scope: without it the third example cannot exist, and
the first two would have to avoid `ApiClient` to stay honest.

### API v5 rejects the rite segment entirely

Measured across both deployments:

| Base  | `/calendar/nation/IT` | `/calendar/roman/nation/IT` | `/calendar/roman` |
| ----- | --------------------- | --------------------------- | ----------------- |
| `v5`  | 200                   | **400**                     | **400**           |
| `dev` | 200                   | 200                         | 200               |

v5 rejects the segment on _every_ route, not only Ambrosian ones. Emitting it unconditionally would break
every request made by this library against v5, including plain Roman national calendars that v5 fully
supports.

Neither deployment exposes a version field in `/calendars`, so feature detection is the only reliable
signal. It is also already the established pattern here: `CalendarSelectLegacyMetadata.test.js`
("CalendarSelect against metadata with no rite field (live v5 API)") pins `CalendarSelect` degrading
gracefully on v5 by treating rite-less dioceses as Roman. `ApiClient` hard-breaking on the same API would
contradict a guarantee the library makes one layer up.

## Decisions

1. **The rite segment is always emitted when the API supports it**, including for Roman —
   `/calendar/roman/nation/IT`. Consistency of the emitted path is preferred over preserving the shorter
   form. Both are the same request: `Router::extractRiteSegment()` accepts `roman` explicitly.

2. **Rite support is capability-detected, not version-configured.** `ApiClient` already fetches
   `/calendars` at `init()` and caches it. `dev` returns `ambrosian_calendars`; v5 does not. That presence
   is the probe. No `apiVersion` option: it is state the library can derive, and a wrong or forgotten
   value reintroduces exactly the failure being avoided.

3. **Against a non-rite-aware API the segment is omitted**, so this version stays fully usable on v5 for
   everything v5 can do. Requesting the Ambrosian rite against such an API throws a labelled error rather
   than emitting a request that returns a bare 400.

4. **`#currentRite` is instance state, not static.** Per-request state in `ApiClient` is instance-level
   (`#currentCategory`, `#currentCalendarId`, `#params`); only genuinely shared things are static
   (`#apiUrl`, `#paths`, `#metadata`, `#calendarCache`). A static rite would be the cross-instance leak
   just removed from `CurrentEndpoint`.

5. **The rite reaches `ApiClient` through `listenTo()`**, mirroring `CalendarSelect`, not by reading it
   back out of a linked `ApiOptions`.

## ApiClient changes

### State and setter

A `#currentRite` instance field defaulting to `Rite.ROMAN`, sitting alongside `#currentCategory` and
`#currentCalendarId`, with a chainable setter mirroring `year()` / `yearType()`:

```javascript
apiClient.rite( Rite.AMBROSIAN );          // chainable, validated against the Rite enum
apiClient.year( 2026 ).rite( Rite.ROMAN ); // composes with the existing setters
```

Rite is a path segment, not a query parameter, so it does not join `#params`.

### Path composition

```javascript
const riteSegment = ApiClient.#supportsRite ? `/${this.#currentRite}` : '';
fetch( `${ApiClient.#apiUrl}${ApiClient.#paths.calendar}${riteSegment}${year ? `/${year}` : ''}` );
```

Applied identically to the base, national and diocesan fetch methods.

### Capability probe

```javascript
static get #supportsRite() {
    return Array.isArray( ApiClient.#metadata?.ambrosian_calendars );
}
```

### Guards

- `fetchNationalCalendar()` throws when `RiteProperties[ this.#currentRite ].hasNationalTier` is `false`.
  There is no `/calendar/ambrosian/nation/...` route; the component pre-empts the invalid request rather
  than surfacing the API's rejection. This follows decision 5 of the preceding design.
- Any fetch under a non-Roman rite throws when `#supportsRite` is `false`, naming the incompatibility.

### Cache key

`#generateCacheKey()` gains the rite. Without it, switching Roman → Ambrosian at the same year, locale and
calendar id returns the **cached Roman calendar** with no request at all — a silent wrong answer rather
than a visible failure.

### listenTo

`listenTo()` accepts a `RiteSelect` and dispatches to a new `#listenToRiteSelect()`, exactly as it already
does for `CalendarSelect`. That method attaches a `change` listener to `riteSelect._domElement`, sets
`#currentRite`, and re-issues the current request.

It **always clears both the category and the calendar id**, re-targeting the request at the incoming
rite-level calendar. A `calendar_id` from one rite is never valid under another — the same rule
`ApiOptions` already applies when it resets the calendar selection on a rite change — and that holds for
dioceses in **both** directions, not only for the national tier. Measured against the API:

| Route                                   | Status  |
| --------------------------------------- | ------- |
| `/calendar/ambrosian/diocese/roma_it`   | **400** |
| `/calendar/roman/diocese/lugano_ch`     | **400** |
| `/calendar/ambrosian/diocese/lugano_ch` | 200     |

So carrying any stale selection across a rite change produces an invalid request. Clearing
unconditionally is both simpler than a per-tier check and the only correct option.

This falls back rather than throwing: a user switching rites is not a programming error. The throw in
`fetchNationalCalendar()` still covers the programmatic case.

**Known redundant fetch.** When both an `ApiOptions` and an `ApiClient` are wired to the same
`RiteSelect`, a rite change produces two requests. `#handleLinkedRiteSelect`'s `applyRite` resets the
calendar selection and dispatches `change` on it synchronously, which triggers a fetch under the outgoing
rite, before `ApiClient`'s own rite listener runs and fetches correctly. The final state is correct and the
cache absorbs part of the cost. Documented rather than fixed: suppressing it would mean coupling
`ApiOptions` to `ApiClient`, which is a larger change than the waste justifies.

## The examples

Three sibling folders, following the existing one-folder-per-example convention that `docs/examples.md`
and the README both index. Each carries `index.html`, `main.css` and `main.js`, uses Bootstrap 5 and the
import map to `../../src/index.js`, and explains itself inline with `<small>` notes, as `MultipleForms`
does. Note that those notes attach via `.after()` on `CalendarSelect` only — `RiteSelect`'s surface is
`class` / `id` / `name` / `label` / `appendTo`, with no `after()` — so notes accompanying the rite control
live in `index.html` beside its mount point.

### examples/RiteSelectChain/

The orchestration chain, deliberately without an `ApiClient` — this example is about form behaviour.

`RiteSelect` plus a nation/diocese `CalendarSelect` pair joined by `linkToNationsSelect()`, wired with
`apiOptions.linkToCalendarSelect( [ nationSelect, dioceseSelect ], riteSelect )`. Switching to Ambrosian
shows, in one screen: the nation select hidden, the diocese list reflattened to the four Ambrosian
dioceses with no nation `<optgroup>`, the calendar selection cleared, the four temporal inputs disabled,
and the year floor moved to 1976.

### examples/RiteSelectPathBuilder/

The rite as a path segment. Mirrors the existing `PathBuilder` example with a `RiteSelect` added, so the
rendered path walks `/calendar/roman` → `/calendar/ambrosian` →
`/calendar/ambrosian/diocese/lugano_ch`. Also shows the `/calendar/nation/` route option disabling under
Ambrosian, with the route selection falling back to the base `/calendar` **option** — which, with a
`RiteSelect` linked, renders as the path `/calendar/ambrosian`, not `/calendar`.

### examples/RiteSelectWebCalendar/

The full stack, and the example that depends on the `ApiClient` work: `RiteSelect` → `CalendarSelect` →
`ApiOptions` → `ApiClient` → `WebCalendar`, rendering a real Ambrosian calendar table.

## Testing

Jest coverage for the `ApiClient` rite behaviour:

- path composition per rite, with and without the capability probe satisfied
- the rite participating in the cache key, so a rite switch is not served stale
- `fetchNationalCalendar()` throwing under a rite with no national tier
- a non-Roman rite against a non-rite-aware API throwing a labelled error
- `listenTo( riteSelect )` setting the rite and re-issuing the request
- the `national` → rite-level fallback

The existing suite must stay green.

## Documentation

- `docs/examples.md` — a section per new example, matching the existing structure
- `README.md` — three rows in the examples table, with matching link references
- `docs/api-client.md` — `rite()`, `listenTo( riteSelect )`, and the v5 behaviour
- `docs/rite-select.md` — the Back-Compatibility section currently promises that an embed without a
  `RiteSelect` makes requests whose paths are "byte-identical to before rite awareness was added". Decision
  1 makes that false for `ApiClient` against a rite-aware API, though the requests remain equivalent. The
  paragraph is reworded, and the version compatibility is stated: this release works against v5 for
  everything v5 supports, and needs v6/dev for the Ambrosian rite.

## Scope

**In scope:** `src/ApiClient/ApiClient.js`, three new folders under `examples/`, the four documentation
files above, and the Jest tests listed.

**Out of scope:** the redundant-fetch coupling described above; any change to `RiteSelect`,
`CalendarSelect`, `ApiOptions` or `PathBuilder`, all of which already behave correctly; a
back-compatibility example, considered and dropped.
