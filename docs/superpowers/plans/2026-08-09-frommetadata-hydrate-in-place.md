# `ApiBase.fromMetadata()` hydrates in place — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** Make `ApiBase.fromMetadata( url, metadata )` hydrate the base already registered for a URL instead of
replacing it with a new object, so every reference to that URL's base stays one object with one calendar index and
one response cache.

**Architecture:** Four changes, in dependency order. `fromMetadata()` swaps `new ApiBase( … )` + `registry.set()`
for `ApiBase.resolve( … )` + assignment + `clearCache()`. `load()` gains an early return so a fetch landing after a
fixture was installed does not undo it. A regression test in `ComponentBinding.test.js` pins the behaviour the
issue is actually about. Comments and docs that cite the old replacement contract are rewritten.

**Tech Stack:** JavaScript ES2022 modules, Jest 29.7 (via `node --experimental-vm-modules`), Yarn 4.6,
markdownlint-cli2 + prettier for docs.

**Spec:** `docs/superpowers/specs/2026-08-09-frommetadata-hydrate-in-place-design.md`
**Issue:** [#33](https://github.com/Liturgical-Calendar/liturgy-components-js/issues/33)
**Folded into:** [PR #30](https://github.com/Liturgical-Calendar/liturgy-components-js/pull/30)
**Branch:** `feat/per-base-registry` (already checked out; do not branch again)

## Global Constraints

- **Code style:** 4-space indent, single quotes, and the repo's spacing inside parentheses and brackets —
  `ApiBase.fromMetadata( url, metadata )`, `[ 'a', 'b' ]`. Match the surrounding lines exactly; every code block
  below is already in this style.
- **Yoda comparisons against `null`/`false`** are the house style in `ApiBase.js` (`if ( null === metadata )`, `if
( false === response.ok )`). Keep them where the file already uses them.
- **ES2022 floor.** No runtime API newer than ES2022. Nothing in this plan needs one.
- **JSDoc on every public method**, with `@param`, `@returns` and `@throws`.
- **Private fields** use the `#` prefix. `#metadata`, `#loadPromise` and `#cache` are private to `ApiBase`; static
  methods of `ApiBase` may read and write them on any `ApiBase` instance, which is what `fromMetadata()` relies on.
- **Tests:** `yarn test <path>` runs one file; add `-t '<name substring>'` for one test. Full suite is `yarn test`.
  The baseline on `feat/per-base-registry` as of this plan is **607 passing tests across 25 suites** — measured,
  not the 269/21 quoted in the PR description, which predates the branch's later commits. The count only goes up.
- **No test may contact a live API.** Build bases with `ApiBase.fromMetadata()`; where a fetch is genuinely under
  test, stub `global.fetch` with `jest.fn()` as `ApiBase.test.js` already does.
- **Markdown:** max 180 columns. After editing any `.md`, run `yarn format:md:fix` then `yarn lint:md` and expect
  `0 issues`.
- **Never use `--no-verify`.** If a hook fails, fix the cause and commit again.
- **Commits are GPG-signed and pinentry may prompt.** If `git commit` fails with `gpg: signing failed: Timeout`,
  the passphrase prompt could not be reached — leave the change staged and ask the user to run the commit
  themselves rather than disabling signing.
- **Do not run `yarn compile`** as a correctness check on `src/`: `checkJs` is off, so it neither type-checks nor
  catches a bad JS change. Run it only to confirm the build still emits.

## File Structure

| File                                     | Responsibility                    | Change                                                    |
| ---------------------------------------- | --------------------------------- | --------------------------------------------------------- |
| `src/ApiClient/ApiBase.js`               | The base, the registry, the cache | `fromMetadata()` (`:273`), `load()` continuation (`:371`) |
| `src/__tests__/ApiBase.test.js`          | `ApiBase` unit tests              | Rewrite one test, add seven                               |
| `src/__tests__/ComponentBinding.test.js` | Component-to-base binding         | Add one `describe`, two tests                             |
| `src/CalendarSelect/CalendarSelect.js`   | —                                 | Comment only (`:173-177`)                                 |
| `src/ApiOptions/ApiOptions.js`           | —                                 | Comment only (`:73-80`)                                   |
| `docs/api-client.md`                     | Public `ApiClient`/`ApiBase` docs | One paragraph                                             |
| `CHANGELOG.md`                           | v2.0.0 notes                      | One bullet                                                |

---

### Task 1: `fromMetadata()` hydrates the registered base

**Files:**

- Modify: `src/ApiClient/ApiBase.js:260-280` (the `fromMetadata()` doc comment and body)
- Test: `src/__tests__/ApiBase.test.js:157-181` (the `describe( 'ApiBase.fromMetadata', … )` block) and `:190-236`
  (the `describe( 'ApiBase rejects an unusable calendar index', … )` block)

**Interfaces:**

- Consumes: `ApiBase.resolve( url )` (returns the registered base, registering an unloaded one if absent),
  `ApiBase.normalizeUrl( url )`, `ApiBase.#assertValidIndex( metadata, url )`, the instance methods `clearCache()`,
  `setCached( key, data )` and `getCached( key )`, and the getters `metadata`, `isLoaded`, `url`.
- Produces: `ApiBase.fromMetadata( url, metadata ) -> ApiBase`, now guaranteeing `fromMetadata( U, A ) ===
fromMetadata( U, B ) === ApiBase.resolve( U )` for any one normalized `U`. Tasks 2 and 3 both depend on this
  identity guarantee.

- [ ] **Step 1: Replace the third test in the `fromMetadata` describe with the identity tests**

In `src/__tests__/ApiBase.test.js`, delete this test in full (currently at `:172-178`):

```js
    it( 'replaces an existing entry for the same url', () => {
        const first  = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        const second = ApiBase.fromMetadata( 'http://localhost:8000', OTHER_METADATA );
        expect( second ).not.toBe( first );
        expect( ApiBase.resolve( 'http://localhost:8000' ).metadata ).toBe( OTHER_METADATA );
        expect( ApiBase.all ).toHaveLength( 1 );
    } );
```

and put these four in its place, so the `describe( 'ApiBase.fromMetadata', … )` block ends with them:

```js
    it( 'returns the same object when the same url is installed twice', () => {
        const first  = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        const second = ApiBase.fromMetadata( 'http://localhost:8000', OTHER_METADATA );
        expect( second ).toBe( first );
        expect( ApiBase.all ).toHaveLength( 1 );
    } );

    it( 'installs the new index onto the base already registered', () => {
        const first = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        ApiBase.fromMetadata( 'http://localhost:8000', OTHER_METADATA );
        expect( first.metadata ).toBe( OTHER_METADATA );
        expect( ApiBase.resolve( 'http://localhost:8000' ).metadata ).toBe( OTHER_METADATA );
    } );

    it( 'empties the response cache of the base it re-installs', () => {
        const base = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        base.setCached( 'a-cache-key', { litcal: [] } );
        expect( base.getCached( 'a-cache-key' ) ).not.toBeNull();
        ApiBase.fromMetadata( 'http://localhost:8000', OTHER_METADATA );
        expect( base.getCached( 'a-cache-key' ) ).toBeNull();
    } );

    it( 'hydrates a base that was resolved but never loaded', () => {
        const resolved = ApiBase.resolve( 'http://localhost:8000' );
        expect( resolved.isLoaded ).toBe( false );
        const hydrated = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        expect( hydrated ).toBe( resolved );
        expect( resolved.isLoaded ).toBe( true );
        expect( resolved.metadata ).toBe( FULL_METADATA );
    } );
```

- [ ] **Step 2: Add the untouched-on-rejection test**

This one belongs in the validation block, not the `fromMetadata` block, because `NO_NATIONS` is declared there
(`:192`) and is not in scope earlier. In `src/__tests__/ApiBase.test.js`, find:

```js
    it( 'registers nothing when it rejects', () => {
        expect( () => ApiBase.fromMetadata( 'http://localhost:8000', NO_NATIONS ) ).toThrow();
        expect( ApiBase.all ).toHaveLength( 0 );
    } );
```

and insert immediately after it:

```js
    /**
     * The sibling of the test above, and new with hydration in place: validating
     * before `resolve()` is what keeps a rejected call from half-hydrating a base
     * that was already registered and loaded.
     */
    it( 'leaves an already registered base untouched when it rejects', () => {
        const base = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        expect( () => ApiBase.fromMetadata( 'http://localhost:8000', NO_NATIONS ) ).toThrow( /national_calendars/ );
        expect( base.metadata ).toBe( FULL_METADATA );
        expect( ApiBase.resolve( 'http://localhost:8000' ) ).toBe( base );
        expect( ApiBase.all ).toHaveLength( 1 );
    } );
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `yarn test src/__tests__/ApiBase.test.js`

Expected: FAIL. `'returns the same object when the same url is installed twice'` fails on `expect( second ).toBe(
first )` (received a different `ApiBase`); `'installs the new index onto the base already registered'` fails
because `first.metadata` is still `FULL_METADATA`; `'empties the response cache…'` fails because the _old_ object's
cache still holds the key; `'hydrates a base that was resolved but never loaded'` fails on `expect( hydrated
).toBe( resolved )`. `'leaves an already registered base untouched when it rejects'` should already **pass** —
validation is ahead of construction today too, and it must stay passing.

- [ ] **Step 4: Rewrite `fromMetadata()`**

In `src/ApiClient/ApiBase.js`, replace the whole doc comment and method at `:260-280`:

```js
    /**
     * Registers an already loaded base from a metadata object, without any network
     * request.
     *
     * Hydrates the base **in place**. The object registered for a URL is created
     * once and never replaced, so a component that resolved the base earlier reads
     * an index installed later. Registering a fresh object instead would leave every
     * earlier reference holding an orphan — same URL, its own metadata, its own
     * response cache — which is precisely the divergence the registry exists to
     * prevent.
     *
     * The index supplied wins whether or not the base already carried one, so
     * fixture setup needs no {@link ApiBase.reset} first: requiring one would be a
     * trap in a `beforeEach`, where forgetting it once silently reuses the previous
     * index. The base's response cache is emptied for the same reason it would have
     * started empty before — a base whose index has just been redefined must not
     * answer from the one it replaced.
     *
     * The index is validated BEFORE the base is resolved, so a rejected call neither
     * registers a new base nor half-hydrates an existing one.
     *
     * @param {string} url - The base URL.
     * @param {import('../typedefs.js').CalendarIndex} metadata - The calendar index.
     * @returns {ApiBase} The base registered for the URL — the same object on every call for a given URL.
     * @throws {Error} If the metadata is not an object, or omits `national_calendars`, `diocesan_calendars` or `locales`, or carries any of the three as something other than an array.
     */
    static fromMetadata( url, metadata ) {
        const normalized = ApiBase.normalizeUrl( url );
        ApiBase.#assertValidIndex( metadata, normalized );
        const base = ApiBase.resolve( normalized );
        base.#metadata = metadata;
        base.clearCache();
        return base;
    }
```

Note what is **not** here: `#loadPromise` is deliberately left alone. Task 2 makes clearing it unnecessary, and
nulling it would let a later `load()` open a second request for one already in flight.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `yarn test src/__tests__/ApiBase.test.js`

Expected: PASS, all tests in the file.

- [ ] **Step 6: Run the full suite**

Run: `yarn test`

Expected: PASS. Pay attention to `CalendarSelectLegacyMetadata.test.js`, which installs a second, different fixture
on the same URL mid-test (`:60`) with no `reset()` — it exercises the index-wins rule and must stay green. If
anything else fails, do not adjust the new behaviour to suit it; report which suite and why.

- [ ] **Step 7: Commit**

```bash
git add src/ApiClient/ApiBase.js src/__tests__/ApiBase.test.js
git commit -m "Hydrate the registered base in fromMetadata rather than replacing it

fromMetadata() built a new ApiBase and took over the registry slot, so
anything that had already resolved that URL kept a reference to an orphan
with its own metadata and its own response cache. Two components could
both be on http://localhost:8000 and disagree about what that means.

It now resolves the registered base and installs the index onto it. The
index supplied still wins, so fixture setup needs no reset() first, and
the cache is emptied because a base whose index has just been redefined
must not answer from the one it replaced. Validation stays ahead of
resolve(), so a rejected call neither registers a base nor half-hydrates
one.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `load()` yields to an index installed mid-flight

**Files:**

- Modify: `src/ApiClient/ApiBase.js:371-383` (the `.then( data => { … } )` continuation inside `load()`)
- Test: `src/__tests__/ApiBase.test.js` — a new top-level `describe`, inserted immediately after the `describe(
'ApiBase.fromMetadata', … )` block closes

**Interfaces:**

- Consumes: Task 1's identity guarantee — this task is only necessary, and its tests only meaningful, because
  `fromMetadata()` now writes to the _same_ object a pending `load()` will write to.
- Produces: no new API. `load()` keeps returning `Promise<ApiBase>` resolving to the base, and still rejects with
  `ApiClientError` when the request fails or the response is unusable _and_ no index arrived meanwhile.

**Why this is needed at all:** while the registry replaced objects, a `load()` in flight belonged to the object
being orphaned, so it could not touch the fixture. Hydrating in place puts the background fetch and the explicit
install on one object, and the fetch lands second.

- [ ] **Step 1: Write the failing tests**

In `src/__tests__/ApiBase.test.js`, insert this new top-level `describe` immediately after the closing `} );` of
`describe( 'ApiBase.fromMetadata', … )`:

```js
/**
 * With the registry replacing objects, a `load()` in flight belonged to the base
 * being orphaned and could not reach a fixture installed meanwhile. Hydrating in
 * place puts both writes on one object, and the fetch lands second — so the rule
 * has to be stated rather than inherited: an explicit install outranks a
 * background fetch.
 */
describe( 'ApiBase.load yields to an index installed while it was in flight', () => {

    /** Resolves the pending `fetch` on demand, so the fixture can land mid-request. */
    const deferredFetch = () => {
        let settle;
        global.fetch = jest.fn( () => new Promise( resolve => { settle = resolve; } ) );
        return ( response ) => settle( response );
    };

    it( 'keeps the installed index rather than the fetched one', async () => {
        const respondWith = deferredFetch();
        const base    = ApiBase.resolve( 'http://localhost:8000' );
        const loading = base.load();

        ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        respondWith( okResponse( OTHER_METADATA ) );

        await expect( loading ).resolves.toBe( base );
        expect( base.metadata ).toBe( FULL_METADATA );
    } );

    it( 'resolves rather than rejecting when the overtaken response is unusable', async () => {
        const { national_calendars, ...NO_NATIONS } = FULL_METADATA;
        const respondWith = deferredFetch();
        const base    = ApiBase.resolve( 'http://localhost:8000' );
        const loading = base.load();

        ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        respondWith( okResponse( NO_NATIONS ) );

        await expect( loading ).resolves.toBe( base );
        expect( base.metadata ).toBe( FULL_METADATA );
    } );

    it( 'clears the in-flight promise, so a later load neither refetches nor hangs', async () => {
        const respondWith = deferredFetch();
        const base    = ApiBase.resolve( 'http://localhost:8000' );
        const loading = base.load();

        ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        respondWith( okResponse( OTHER_METADATA ) );
        await loading;

        await expect( base.load() ).resolves.toBe( base );
        expect( global.fetch ).toHaveBeenCalledTimes( 1 );
    } );

} );
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn test src/__tests__/ApiBase.test.js -t 'yields to an index installed'`

Expected: FAIL. The first two fail on `expect( base.metadata ).toBe( FULL_METADATA )` — the fetch's continuation
overwrote the fixture with `OTHER_METADATA`; the second additionally rejects, because `#assertValidIndex` throws on
the overtaken response. The third fails for the same overwrite reason.

- [ ] **Step 3: Add the early return**

In `src/ApiClient/ApiBase.js`, inside `load()`, find the `.then( data => { … } )` continuation. After the
`litcal_metadata` presence check throws and **before** the `ApiBase.#assertValidIndex( data.litcal_metadata,
this.#url )` line, insert:

```js
            // An index may have been installed by `fromMetadata()` — a fixture, or a
            // server-rendered payload — while this request was in flight. It wins: an
            // explicit call outranks a background fetch. The response is dropped
            // without being validated, because it is no longer what anyone will read,
            // and rejecting here would fail a `load()` on a base that is loaded.
            if ( this.#metadata !== null ) {
                this.#loadPromise = null;
                return this;
            }

```

The continuation should then read, in order: the `litcal_metadata` presence check, the comment about a plain
`Error` being deliberate, the new early return, `ApiBase.#assertValidIndex( … )`, `this.#metadata =
data.litcal_metadata;`, `this.#loadPromise = null;`, `return this;`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `yarn test src/__tests__/ApiBase.test.js`

Expected: PASS, all tests in the file — including the existing `load()` tests, which cover the ordinary path (no
fixture installed) and must be unaffected.

- [ ] **Step 5: Run the full suite**

Run: `yarn test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ApiClient/ApiBase.js src/__tests__/ApiBase.test.js
git commit -m "Let an index installed mid-flight outrank the fetched one

While the registry replaced objects, a load() in flight belonged to the
base being orphaned and could not reach a fixture installed meanwhile.
Hydrating in place puts both writes on one object, and the fetch lands
second — so a fixture installed during a /calendars request would be
undone, later and asynchronously, which is the hardest kind to diagnose.

load() now returns early when an index arrived while its request was
open. The early return sits ahead of the index validation rather than
guarding the assignment after it: a response nobody will read should not
be able to reject a load() on a base that is, truthfully, loaded.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Pin the regression the issue is about

**Files:**

- Test: `src/__tests__/ComponentBinding.test.js` — a new top-level `describe`, appended at the end of the file

**Interfaces:**

- Consumes: Task 1's identity guarantee. Already imported at the top of this file: `ApiBase`, `CalendarSelect`,
  `ApiClient`, `FULL_METADATA`, `OTHER_METADATA`, and the constants `DEV = 'http://localhost:8000'` and `PROD =
'https://example.org/api/dev'`. The file is `/** @jest-environment jsdom */` and has `ApiBase.reset()` in
  `beforeEach`.
- Produces: nothing consumed later. This is the acceptance test for issue #33.

**Why here rather than in `ApiBase.test.js`:** the divergence needs a component on each side of the re-install. It
cannot be shown with a component built _before_ any index exists — `resolveBase()` throws on an empty registry
(`ApiBase.js:622`) and `nationalCalendars()` throws via `#assertLoaded` on an unloaded base, so `CalendarSelect`'s
constructor never gets far enough to diverge.

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/ComponentBinding.test.js`:

```js
/**
 * Issue #33. `fromMetadata()` used to register a NEW base for a URL, so a
 * component built before a re-install and a client built after it held two
 * different objects that both claimed the same URL — with two different response
 * caches. `assertSameBase()` compares by identity, which makes the failure vivid:
 * `listenTo()` refusing to connect them while naming the same URL twice.
 */
describe( 're-installing a fixture does not fork the base', () => {

    it( 'leaves a select and a client built either side of the re-install on one base', () => {
        ApiBase.fromMetadata( DEV, FULL_METADATA );
        const select = new CalendarSelect( { locale: 'en' } );
        ApiBase.fromMetadata( DEV, OTHER_METADATA );
        const client = new ApiClient( ApiBase.resolve( DEV ) );

        expect( select._base ).toBe( client.base );
        expect( () => client.listenTo( select ) ).not.toThrow();
    } );

    it( 'leaves one shared response cache rather than two', () => {
        ApiBase.fromMetadata( DEV, FULL_METADATA );
        const select = new CalendarSelect( { locale: 'en' } );
        ApiBase.fromMetadata( DEV, OTHER_METADATA );

        ApiBase.resolve( DEV ).setCached( 'a-cache-key', { litcal: [] } );
        expect( select._base.getCached( 'a-cache-key' ) ).not.toBeNull();
    } );

} );
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn test src/__tests__/ComponentBinding.test.js -t 'does not fork the base'`

Tasks 1 and 2 already fix this, and they are **committed** by now — so `git stash` has nothing to stash. Verify the
failure by checking `ApiBase.js` back to its pre-fix state, running, then restoring:

```bash
BEFORE=$( git log --format=%H --grep='^Hydrate the registered base' -n 1 )^
git checkout "$BEFORE" -- src/ApiClient/ApiBase.js
yarn test src/__tests__/ComponentBinding.test.js -t 'does not fork the base'   # expect FAIL
git checkout HEAD -- src/ApiClient/ApiBase.js
```

Expected on the reverted run: the first test fails on `expect( select._base ).toBe( client.base )`, and
`listenTo()` throws `bound to different API bases — http://localhost:8000 and http://localhost:8000` — naming the
same URL twice. The second fails because the key set on the newly registered base is invisible to the one the
select holds.

Confirm `git status` shows `src/ApiClient/ApiBase.js` clean again before continuing. If it does not, run
`git checkout HEAD -- src/ApiClient/ApiBase.js` again — carrying a reverted `ApiBase.js` into the next step
would silently undo both fixes.

- [ ] **Step 3: Run the tests to verify they pass**

Run: `yarn test src/__tests__/ComponentBinding.test.js`

Expected: PASS, whole file. No implementation change belongs in this task — Tasks 1 and 2 already make these
pass. If they do not, stop and report: it means the fix does not actually cover the case the issue describes.

- [ ] **Step 4: Run the full suite**

Run: `yarn test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/ComponentBinding.test.js
git commit -m "Pin the base-forking regression from issue #33

A select built before a fixture re-install and a client built after it
used to hold two different ApiBase objects for one URL, with two
different response caches. assertSameBase() compares by identity, so
listenTo() refused to connect them while naming the same URL twice.

Asserted through the components rather than on ApiBase alone: the
divergence needs one on each side of the re-install, and cannot be shown
with a component built before any index exists, since resolveBase()
throws on an empty registry and nationalCalendars() throws on an
unloaded base.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Rewrite the comments and docs that state the old contract

**Files:**

- Modify: `src/CalendarSelect/CalendarSelect.js:173-177`
- Modify: `src/ApiOptions/ApiOptions.js:73-80`
- Modify: `docs/api-client.md` (the _Testing without mocking fetch_ section, ~`:343-364`)
- Modify: `CHANGELOG.md:186-187`

**Interfaces:**

- Consumes: the behaviour established in Tasks 1 and 2. No code changes here — two comments and two documents.
- Produces: nothing consumed later.

These are not cosmetic. Both source comments assert as fact something Task 1 makes false, and a reader who trusts
them will reason wrongly about why the components hold a base.

- [ ] **Step 1: Rewrite the `CalendarSelect` comment**

In `src/CalendarSelect/CalendarSelect.js`, replace:

```js
        // Must stay ahead of `#buildAllOptions()`, which reads both the base and the
        // national list, and after the `rite` handling above, which sets `this.#rite`.
        // The base is resolved ONCE and held: `ApiBase.fromMetadata()` replaces a
        // registry entry rather than mutating it, so re-resolving by URL later could
        // silently swap the API under a select that is already on screen.
```

with:

```js
        // Must stay ahead of `#buildAllOptions()`, which reads both the base and the
        // national list, and after the `rite` handling above, which sets `this.#rite`.
        // The base is resolved ONCE and held because the binding belongs to this
        // select and is settled here, at construction: whichever base the `apiClient`
        // option named — or the default in force at the time — is the one it keeps for
        // its lifetime, whatever is registered later.
```

- [ ] **Step 2: Rewrite the `ApiOptions` comment**

In `src/ApiOptions/ApiOptions.js`, replace:

```js
    /**
     * The API base this form reads its metadata from.
     *
     * Resolved ONCE, in the constructor, and held: `ApiBase.fromMetadata()`
     * replaces a registry entry rather than mutating it, so re-resolving by URL
     * later could silently swap the API under a form that is already on screen.
     *
     * @type {ApiBase}
     */
```

with:

```js
    /**
     * The API base this form reads its metadata from.
     *
     * Resolved ONCE, in the constructor, and held because the binding belongs to
     * this form and is settled there: whichever base the `apiClient` option named —
     * or the default in force at the time — is the one it keeps for its lifetime,
     * whatever is registered later.
     *
     * @type {ApiBase}
     */
```

- [ ] **Step 3: Add the identity paragraph to `docs/api-client.md`**

In the _Testing without mocking fetch_ section, find the paragraph that ends:

```markdown
A field that is present but not an array is refused just as an absent one is — `locales: {}` would otherwise
pass here and fail later, on the request path, as a bare `TypeError`.
```

and append a new paragraph after it:

```markdown
The base registered for a URL is the same object on every call. Installing a fixture on a URL that already
has one replaces that base's calendar index and empties its response cache **without replacing the base**, so
a component constructed before the re-install and one constructed after it remain on a single base, sharing a
single cache. A `/calendars` request still in flight when a fixture lands does not overwrite it.
```

- [ ] **Step 4: Update the `CHANGELOG.md` entry**

Replace the bullet at `:186-187`:

```markdown
- `ApiBase.fromMetadata( url, metadata )` registers a loaded base with no network request — the supported way to
  exercise components in tests without mocking `fetch`. `ApiBase.reset()` empties the registry between tests.
```

with:

```markdown
- `ApiBase.fromMetadata( url, metadata )` registers a loaded base with no network request — the supported way to
  exercise components in tests without mocking `fetch`. It hydrates the base for a URL in place and returns the
  same object on every call, so re-installing a fixture replaces that base's calendar index and empties its
  response cache without replacing the base itself. `ApiBase.reset()` empties the registry between tests.
```

- [ ] **Step 5: Format and lint the markdown**

Run: `yarn format:md:fix && yarn lint:md`

Expected: `Summary: 0 issues in 0 files`. Prettier may reflow the paragraphs you added; that is expected and should
be kept.

- [ ] **Step 6: Confirm the build still emits and the suite is green**

Run: `yarn compile && yarn test`

Expected: `compile` completes with no errors; `yarn test` PASSes every suite. (`compile` is a build check only —
`checkJs` is off, so it does not validate the JS sources.)

- [ ] **Step 7: Commit**

```bash
git add src/CalendarSelect/CalendarSelect.js src/ApiOptions/ApiOptions.js docs/api-client.md CHANGELOG.md
git commit -m "Stop citing a registry hazard that no longer exists

CalendarSelect and ApiOptions both justified holding their base by
fromMetadata() replacing a registry entry rather than mutating it. That
is now false, and a reader trusting it would reason wrongly about why the
components hold a base at all. Both comments now give the ordinary
reason: the binding belongs to the component and is settled at
construction.

The api-client and CHANGELOG entries gain the identity guarantee, which
is what a caller of fromMetadata() actually needs to know.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Deliberately not changed

Recorded so a reviewer does not read these as oversights:

- **`#loadPromise` is not cleared by `fromMetadata()`.** Task 2 removes the need, and clearing it would let a later
  `load()` open a duplicate request for one already in flight.
- **`ApiBase.resolve()` is otherwise untouched**, as are `load()`'s in-flight deduplication and its early return
  for an already-loaded base.
- **Components still hold their base rather than re-resolving by URL.** The spec's _Kept in view_ section
  records why: a held reference survives `ApiBase.reset()` where a re-resolve would mint a fresh unloaded base
  and throw, and `CalendarSelect` holds derived state (a sorted copy of the national list, and the option HTML
  built from it, `CalendarSelect.js:179-180`) that re-resolving the base alone would not refresh. Revisiting it
  should be a deliberate look at derived-state invalidation, not a follow-on from this fix.
- **`docs/superpowers/specs/2026-08-08-per-base-registry-design.md:111`** still describes the replacement. It
  records the design as it was decided; the new spec supersedes that paragraph.
- **`CLAUDE.md:388`** needs no change — it says only that tests build a loaded base with `fromMetadata()` and reset
  in `beforeEach`, both still true.

## Definition of done

- [ ] `yarn test` — every suite passes; the total is 607 + 10 added − 1 deleted = **616** across 25 suites
- [ ] `yarn lint:md` — `0 issues`
- [ ] `yarn compile` — emits with no errors
- [ ] No `git commit --no-verify` anywhere in the history of this work
- [ ] Four commits on `feat/per-base-registry`, one per task
