# `ApiBase.fromMetadata()` hydrates in place — design

Issue: [#33](https://github.com/Liturgical-Calendar/liturgy-components-js/issues/33)
Folded into: [#30](https://github.com/Liturgical-Calendar/liturgy-components-js/pull/30) (v2.0.0)

## Problem

`ApiBase.fromMetadata( url, metadata )` builds a loaded base and registers it, **replacing** whatever
was registered for that normalized URL:

```js
static fromMetadata( url, metadata ) {
    const normalized = ApiBase.normalizeUrl( url );
    ApiBase.#assertValidIndex( metadata, normalized );
    const base = new ApiBase( normalized );   // a NEW object
    base.#metadata = metadata;
    ApiBase.#registry.set( base.url, base );  // takes over the slot
    return base;
}
```

The replacement was deliberate. It exists so a `beforeEach` can install a fixture without clearing the
registry first, which would otherwise be a trap: forget the clear once and the second test silently
reuses the first's metadata.

The cost is object identity. A component that resolved the base _before_ the replacement keeps a
reference to the old object; a component resolving _after_ gets the new one. Both then believe they are
on the same base while holding different metadata and — more consequentially — **different response
caches**. That undercuts the guarantee the registry exists to provide: one base per URL, with metadata
fetched once and a cache shared by every client pointed at it.

The exposure today is narrow but the shape is sharp. `CalendarSelect` and `ApiOptions` each resolve
their base **once, in the constructor, and hold it** (`CalendarSelect.js:175`, `ApiOptions.js:76`), so
they are precisely the classes that can be left holding an orphan. Every current caller of
`fromMetadata()` is a `beforeEach` that installs the fixture before constructing anything, so no test
fails today. It is a latent sharp edge, and it bites the moment anything resolves a base earlier than a
test expects — or the moment `fromMetadata()` is used for the other job it was designed for,
server-side rendering.

## Decision

**Hydrate in place.** The object registered for a URL is created once and never replaced. Of the three
options recorded on the issue — hydrate, refuse an already-registered URL, or keep replacing and
document it — hydrate is the only one that both fixes the divergence and preserves the `beforeEach`
ergonomics that motivated the replacement.

Three sub-decisions, each settled deliberately rather than left implicit:

| Question                                       | Decision                                          |
| ---------------------------------------------- | ------------------------------------------------- |
| Base already carries an index — who wins?      | The index just supplied. As today.                |
| The base's response cache across the swap      | Emptied.                                          |
| A `/calendars` request in flight when it lands | The supplied index wins; the response is dropped. |

**Why the new index wins, rather than being refused or ignored.** Refusing reintroduces exactly the
`beforeEach` trap the replacement was chosen to avoid. Ignoring — returning the loaded base and
discarding the argument — silently drops an explicit call, and would break
`CalendarSelectLegacyMetadata.test.js:60`, which installs a second, different fixture on the same URL
inside a test, after the `beforeEach` has already installed `V5_METADATA`, with no `reset()` between.

**Why the cache is emptied.** One rule with no conditional: `fromMetadata()` (re)defines the base, so
the base starts with an empty cache. On a fresh base — the common case, right after `reset()` — the
cache is empty already and the call is a no-op, so emptying only ever has an effect in the case where
redefinition was the intent. It also reproduces the old semantics exactly: a freshly constructed object
always started empty.

## Changes

### 1. `fromMetadata()`

```js
static fromMetadata( url, metadata ) {
    const normalized = ApiBase.normalizeUrl( url );
    ApiBase.#assertValidIndex( metadata, normalized );
    const base = ApiBase.resolve( normalized );
    base.#metadata = metadata;
    base.clearCache();
    return base;
}
```

**Validation stays ahead of `resolve()`.** `ApiBase.test.js:233` asserts that a rejected
`fromMetadata()` registers nothing; resolving first would leave an empty base registered as a side
effect of a call that threw. The same ordering gives a second invariant that did not exist before and
now matters: a rejected call against an **already registered** base leaves it untouched rather than
half-hydrated.

**`#loadPromise` is deliberately not cleared.** Change 2 makes clearing unnecessary, and nulling it
would let a subsequent `load()` start a duplicate request for one already in flight.

The doc comment is rewritten. The current one explains the replacement (_"Replaces any base already
registered for the URL"_); the new one states the identity guarantee, names the index-wins rule and the
emptied cache, and the `@returns` says the same object is returned on every call for a given URL.

### 2. `load()` yields to an index that arrived meanwhile

The fetch continuation currently assigns `this.#metadata` unconditionally. With replacement that was
safe, because an in-flight load belonged to the object being orphaned. Hydrating in place, the same
base is now the one both the fetch and the hydration write to — so a fixture installed mid-flight would
be silently undone, later, asynchronously.

```js
} ).then( data => {
    if ( null === data || typeof data !== 'object' || false === Object.hasOwn( data, 'litcal_metadata' ) ) {
        throw new ApiClientError( … );
    }

    // An index may have been installed by `fromMetadata()` while this request was
    // in flight. It wins: an explicit call outranks a background fetch, and the
    // base is loaded either way, so this response is simply dropped.
    if ( this.#metadata !== null ) {
        this.#loadPromise = null;
        return this;
    }

    ApiBase.#assertValidIndex( data.litcal_metadata, this.#url );
    this.#metadata    = data.litcal_metadata;
    this.#loadPromise = null;
    return this;
} )
```

The early return sits **before** `#assertValidIndex`, not after it as a guarded assignment: a response
that nobody will read should not be able to reject a `load()` on a base that is, truthfully, loaded.
The promise resolves to a loaded base, which is what its contract promises.

### 3. Comments and docs that assert the old contract

`CalendarSelect.js:175` and `ApiOptions.js:76` both justify holding the base with a claim that becomes
false: _"`ApiBase.fromMetadata()` replaces a registry entry rather than mutating it, so re-resolving by
URL later could silently swap the API."_ After this change the entry is stable. Both comments are
rewritten to justify holding for the ordinary reason — the binding is the component's, decided at
construction — rather than as a defence against a hazard that no longer exists.

`docs/api-client.md` (the _Testing without mocking fetch_ section) and `CHANGELOG.md` (the
`fromMetadata()` entry under v2.0.0) each gain a sentence on identity: the base returned for a URL is
the same object on every call, and re-installing replaces the index and empties the cache without
replacing the base.

`docs/superpowers/specs/2026-08-08-per-base-registry-design.md:111` describes the replacement. It is
left as written — it records the design as it was decided, and this spec supersedes that paragraph.

## Tests

`src/__tests__/ApiBase.test.js`. The existing `'replaces an existing entry for the same url'`
(`:172`) asserts the bug as the contract — `expect( second ).not.toBe( first )` — and is rewritten
rather than deleted.

| Test                                                       | Asserts                                                                 |
| ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| re-installing returns the same object                      | `second === first`, `ApiBase.all` still length 1                        |
| re-installing replaces the index                           | `base.metadata === OTHER_METADATA` on the _original_ reference          |
| re-installing empties the cache                            | an entry set via `setCached` is gone after a second install             |
| hydrating an unloaded resolved base preserves identity     | `ApiBase.resolve( U )` then `fromMetadata( U, … )` are one object       |
| a rejected re-install leaves the registered base untouched | index and identity unchanged after a throw on a bad index               |
| an in-flight `load()` does not clobber a fixture           | hydrate mid-flight; resolved base carries the fixture, not the response |
| a `load()` overtaken by a fixture still resolves           | the promise resolves to the base rather than rejecting                  |

Plus the regression the issue is actually about, in `ComponentBinding.test.js`: a `CalendarSelect`
constructed **before** `fromMetadata()` runs, reading the index installed afterwards through the base it
already holds. That is the assertion that fails on `main` and passes after the change.

## Out of scope

- **`resolve()` and `load()` semantics beyond the mid-flight guard.** Deduplication of in-flight
  requests and the early return for a loaded base are unchanged, and are not what the issue is about.
- **Per-base cache configuration.** `ApiBase.cacheLimits()` stays global.
- **Making `fromMetadata()` a documented SSR entry point.** It stays described as the test affordance
  it is; SSR is the motivating _future_ use, and settling identity now is what makes it viable later.

## Version

Folded into PR #30, which is unreleased. `fromMetadata()` ships for the first time in **v2.0.0**, so
there is no behaviour change to record for any consumer — only the CHANGELOG description of a new
method, corrected before it ships. A new commit on `feat/per-base-registry`, matching the branch's
existing pattern of one commit per follow-up fix.
