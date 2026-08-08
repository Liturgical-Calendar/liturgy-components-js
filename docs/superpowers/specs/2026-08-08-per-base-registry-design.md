# Per-base API registry — design

Issue: [#29](https://github.com/Liturgical-Calendar/liturgy-components-js/issues/29)

## Problem

The library assumes one API base per page, and does so implicitly — through static fields rather than
through any stated contract. Re-pointing it at a second base is therefore not merely unsupported, it
is silently wrong.

`ApiClient.init()` sets the URL and then declines to refetch:

```js
static init( url = null ) {
    if ( url ) {
        this.#apiUrl = url;
    }
    return ApiClient.#fetchCalendars();
}
```

`#fetchCalendars()` returns early whenever `#metadata !== null` (`src/ApiClient/ApiClient.js:194`).
So `init( 'A' )` followed by `init( 'B' )` yields a client whose `#apiUrl` is B and whose metadata is
still A's. No error, no warning.

The response cache compounds it. `#generateCacheKey()` (`:238`) keys on rite, category, calendar id,
year, year type, locale and params — **not** the base. After a switch, requests to B are answered
from A's cached responses.

Three classes hold state derived from the base:

| Class            | Static state derived from the API base                  |
| ---------------- | ------------------------------------------------------- |
| `ApiClient`      | `#apiUrl`, `#metadata`, `#calendarCache`                |
| `CalendarSelect` | `#metadata`, `#nationalCalendars`, `#diocesanCalendars` |
| `LocaleInput`    | `#apiLocales`, `#apiLocalesDisplay`                     |

`ApiOptions` reads `ApiClient._metadata` at call time rather than caching it, so it follows whatever
`ApiClient` reports. `PathBuilder` reads the static `ApiClient._apiUrl` at `:64` and `:177`.
`WebCalendar`, `LiturgyOfTheDay`, `LiturgyOfAnyDay` and `RiteSelect` hold no base-derived state at
all — their statics are constants and validators, and they are driven entirely through
`listenTo( apiClient )`.

The motivating use case is comparison: running `http://localhost:8000` beside
`https://litcal.johnromanodorazio.com/api/dev` to see where a local API diverges from the reference
one, and letting anyone self-hosting the API do the same against the canonical deployment.

## Approach

Replace the ambient statics with **one object per API base** that owns everything per-base and
nothing else. A static registry exists only to deduplicate bases by URL.

The alternative considered and rejected was a `MetadataProvider` module mirroring
`liturgy-components-php`'s `src/Metadata/MetadataProvider.php`, whose `$metadataCache` is likewise
keyed by API URL. It would read familiarly across the two libraries, but it re-keys ambient static
state rather than removing it — and PHP needs `resetForTesting()` precisely because of that. PHP's
singleton is a concession to a per-request process model this library does not have.

`ApiClient.init()` keeps returning a **new** instance on every call, including for a base already
registered. Only the shared per-base state is deduplicated. This preserves the intent recorded at
`src/ApiClient/ApiClient.js:130`, where rite is instance state specifically so that "two ApiClients
on one page" cannot overwrite each other's requests — which is what makes comparing the Roman and
Ambrosian rites against a single API possible.

## `ApiBase`

New file: `src/ApiClient/ApiBase.js`. Exported from `src/index.js`.

```js
class ApiBase {
    static #registry = new Map();       // normalized url → ApiBase
    static #maxEntries = 50;
    static #ttl = null;

    static resolve( url )               // get-or-create; does not fetch
    static fromMetadata( url, metadata ) // registered, already loaded, no network
    static get default()                // first registered, or null
    static get all()                    // ApiBase[] in registration order
    static reset()                      // clears the registry
    static cacheLimits( { maxEntries, ttl } )

    get url()                           // normalized
    get metadata()                      // CalendarIndex | null
    get isLoaded()                      // boolean

    async load()                        // GET /calendars once; idempotent

    nationalCalendars( rite )           // NationalCalendar[]
    diocesanCalendars( rite )           // DiocesanCalendar[]
    locales()                           // string[]
    isValidDioceseForNation( dioceseId, nation )  // boolean

    getCached( key )                    // data | null
    setCached( key, data )              // void
    clearCache()                        // void
}
```

### URL normalization

Trailing slashes are stripped; everything else — protocol, host, port, path — is compared verbatim.
`http://localhost:8000` and `http://localhost:8000/` are one base. `http://localhost:8000` and
`http://127.0.0.1:8000` are two, because the library cannot know they are the same server and
guessing would be worse than the duplicate.

### `resolve()` and `fromMetadata()`

`resolve( url )` returns the registered base for the normalized URL, creating and registering an
unloaded one if absent. It never performs a network request.

`fromMetadata( url, metadata )` creates a base that is already loaded and registers it, **replacing**
any existing entry for that URL. It exists so tests and server-rendered pages can supply a metadata
fixture without a network round trip. The replacement is deliberate: fixture setup that had to clear
the registry first would be a trap in `beforeEach`.

### `load()`

```text
metadata already set  → resolve immediately
load in flight        → return the SAME promise
otherwise             → GET `${url}/calendars`, store the in-flight promise
```

On success the metadata is stored from the response's `litcal_metadata` property and the in-flight
promise is cleared. On failure the in-flight promise is **also** cleared, so a later `init()` for the
same base can retry, and the returned promise rejects with an `ApiClientError`.

Collapsing concurrent loads fixes a live race: `#fetchCalendars()` tests `null === this.#metadata`,
so two concurrent `init()` calls today both see `null` and both issue the request. It is also what
makes a comparison page cheap — two panes against one base fetch metadata once.

### Cache

Each base owns its own cache, so the base URL drops out of the cache key rather than having to be
added to it. Cross-base bleed becomes structurally impossible instead of being fixed by a longer key.

Entries are stored as `{ data, timestamp }`, as today. Two limits apply, configured globally through
`ApiBase.cacheLimits()`:

- `maxEntries` — default `50`. On overflow the least recently _read_ entry is evicted. Reads move an
  entry to the end of the `Map`; insertion order therefore gives LRU order directly.
- `ttl` — default `null`, meaning entries never expire, which preserves today's behaviour. When set
  to a number of milliseconds, `getCached()` treats an older entry as a miss and deletes it.

`ApiClient.clearCache()` keeps its current signature and clears every registered base's cache.

## `ApiClient` changes

`static #apiUrl`, `static #metadata` and `static #calendarCache` are removed. In their place a single
instance field:

```js
#base;   // ApiBase
```

`ApiClient.init( url = null )` resolves the base, awaits `base.load()`, and returns
`new ApiClient( base )`.

A null `url` resolves the constant `https://litcal.johnromanodorazio.com/api/dev` — the value
`static #apiUrl` holds today at `src/ApiClient/ApiClient.js:39` — and **not** `ApiBase.default`.
The distinction matters once a second base exists: were no-argument `init()` to mean "the first base
registered", a call that means "the public API" would silently return `localhost` on a comparison
page. The sixteen test files calling `ApiClient.init()` with no argument keep their current
behaviour.

Request URLs are built from `this.#base.url`. Cache reads and writes go through `this.#base`.
`#generateCacheKey()` is unchanged — the base no longer belongs in the key.

`#requestRevision` stays instance-level. It orders responses within one client, which remains exactly
its job.

`apiClient.base` is a public getter returning the `ApiBase`.

### Deprecated statics

`ApiClient._apiUrl` and `ApiClient._metadata` survive, resolving to `ApiBase.default?.url` and
`ApiBase.default?.metadata`. Both emit a deprecation warning when more than one base is registered,
naming the base they resolved to. They are used by the Storybook stories
(`src/stories/0_Components/ApiOptions.stories.js:65`,
`src/stories/0_Components/LiturgyOfTheDayNationalCalendar.stories.js:91`, and four others) and by
consumer pages, and keeping them working is what makes everything except `init()` additive.

## Component binding

`CalendarSelect`, `ApiOptions` and `LocaleInput` gain an `apiClient` option:

```js
const dev  = await ApiClient.init( 'http://localhost:8000' );
const prod = await ApiClient.init( 'https://litcal.johnromanodorazio.com/api/dev' );

const devSelect  = new CalendarSelect( { locale: 'it-IT', apiClient: dev } );
const prodSelect = new CalendarSelect( { locale: 'it-IT', apiClient: prod } );
```

Their base-derived statics become instance fields, read at construction:

| Class            | Instance fields replacing statics                      |
| ---------------- | ------------------------------------------------------ |
| `CalendarSelect` | `#base`; national and diocesan lists read from `#base` |
| `LocaleInput`    | `#base`; locales and display names read from `#base`   |
| `ApiOptions`     | `#base`, passed down to the inputs it constructs       |

`ApiOptions` owns the `LocaleInput` it creates, so it passes its own base down; `LocaleInput` is
never bound directly by a consumer.

### Resolution rule

A component resolves its base as `apiClient?.base ?? ApiBase.default`. `CalendarSelect` accepts
`Object|string` today, where a string is the locale; that form takes the fallback.

When a component falls back **and** more than one base is registered, it warns once, naming the base
it chose. Silent ambiguity is the failure mode being removed here; a fallback that never says which
base it picked would reintroduce it in a new place.

When no base is registered at all, the component throws the existing "ApiClient has not been
initialized" error from `CalendarSelect.#init()` (`:128`), extended to name the class that failed.

### `PathBuilder`

`PathBuilder` needs no new parameter. It already receives `( apiOptions, calendarSelect )` and takes
its base from them, exposed through an underscore-prefixed internal accessor (`_base`) in keeping
with the existing convention for cross-instance internals (`_applyRite`, `_setHidden`,
`_applyFilter`).

If `apiOptions` and `calendarSelect` are bound to different bases it throws at construction, naming
both. That mistake would otherwise surface as a URL preview pointing at the wrong server, which is
the single most misleading thing this component could do.

## Data flow

```text
ApiClient.init( url )
  ├─ ApiBase.resolve( url )          get-or-create, no network
  ├─ base.load()                     idempotent, collapses concurrent calls
  └─ new ApiClient( base )

user changes CalendarSelect
  → apiClient updates #currentCategory / #currentCalendarId
  → base.getCached( key )   hit  → emit 'calendarFetched'
                            miss → fetch `${base.url}/calendar/…`
                                 → base.setCached( key, data )
                                 → #requestRevision guard
                                 → emit 'calendarFetched'
  → WebCalendar renders
```

## Errors

New file: `src/ApiClient/ApiClientError.js`, exported from `src/index.js`.

```js
class ApiClientError extends Error {
    url         // the request URL
    status      // HTTP status, or null when the request never completed
    statusText  // HTTP status text, or null
    body        // response body text when available, else null
    cause       // the underlying error when the request never completed
}
```

| Failure                               | Behaviour                                                      |
| ------------------------------------- | -------------------------------------------------------------- |
| `/calendars` unreachable or non-2xx   | `base.load()` rejects → `init()` rejects with `ApiClientError` |
| calendar fetch fails                  | promise rejects **and** `'calendarFetchFailed'` is emitted     |
| component bound to a base that failed | throws at construction, naming the base URL                    |

`'calendarFetchFailed'` carries `( error, { rite } )`, matching the existing `'calendarFetched'`
signature. It is what gives a comparison page per-pane isolation: each pane subscribes to its own
client and renders its own failure, and a dead `localhost` cannot take the other pane down.

The library emits; it does not render error UI. Teaching `WebCalendar` to draw error states is a
separate question.

### The breaking change

`init()` currently resolves `false` on failure, documented as
`@returns {Promise<ApiClient|boolean>}`. Every example follows the pattern:

```js
ApiClient.init( BASE ).then( apiClient => {
    if ( !apiClient || !( apiClient instanceof ApiClient ) ) { /* … */ }
} );
```

With a rejecting `init()`, that callback never runs and an unmigrated page renders nothing at all —
worse than today until the call site adds a `.catch()`. This is the only breaking change in the
spec; it makes the release **v2.0.0**, and it carries a migration note.

All eight `examples/*/main.js` files and the Storybook stories that call `ApiClient.init()` are
updated as part of the work.

## Types

`src/typedefs.js` gains five typedefs mirroring `src/Models/Index/` in `liturgy-components-php`,
using the snake_case names the API actually returns:

- `CalendarIndex` — the `/calendars` response: `national_calendars`, `national_calendars_keys`,
  `diocesan_calendars`, `diocesan_calendars_keys`, `diocesan_groups`, `wider_regions`,
  `wider_regions_keys`, `locales`, plus the rite-partitioned `roman_calendars` and
  `ambrosian_calendars` that `src/ApiOptions/ApiOptions.js:320` reads as `` `${rite}_calendars` ``
- `NationalCalendar` — `calendar_id`, `locales`, `missals`, `settings`, optional `wider_region`,
  optional `dioceses`
- `DiocesanCalendar` — `calendar_id`, `diocese`, `nation`, `locales`, `timezone`, optional `group`,
  optional `settings`, optional `rite`
- `DiocesanGroup` — `group_name`, `dioceses`
- `WiderRegion` — `name`, `locales`, `api_path`, referenced by `CalendarIndex.wider_regions`

`rite` on `DiocesanCalendar` is optional because the v5 API omits it entirely; a missing `rite` means
Roman, as recorded in `src/__tests__/CalendarSelectLegacyMetadata.test.js:13`.

`ApiBase#metadata` and the deprecated `ApiClient._metadata` are typed `CalendarIndex`.

This fixes a live mistyping. `ApiClient._metadata` is declared `CalendarMetadata` at
`src/ApiClient/ApiClient.js:848` and `:869`, but `CalendarMetadata` (`src/typedefs.js:139`) describes
the **per-response** metadata block — `solemnities_keys`, `feasts_keys`, `suppressed_events`. The
`/calendars` index it actually returns has `national_calendars` and `diocesan_calendars`, read off it
at `src/CalendarSelect/CalendarSelect.js:137`. Two unrelated shapes share one name, so every consumer
of `_metadata` is typed against an object it will never receive, and `dist/index.d.ts` ships the
error downstream.

`CalendarMetadata` keeps its current meaning. The new typedef is what allows the old one to be
correct.

## Testing

`ApiBase.fromMetadata()` is the test affordance: a loaded base with no network.

```js
beforeEach( () => {
    ApiBase.reset();
    ApiBase.fromMetadata( 'http://localhost:8000', V5_METADATA );
} );
```

`src/__tests__/CalendarSelectLegacyMetadata.test.js:16` currently records the constraint this
removes: a second metadata fixture "needs a fresh module registry, which Jest gives per test file."
That file is rewritten to use `fromMetadata()`, dropping both its `global.fetch` mock and the
one-file-per-fixture requirement. The other sixteen test files that call `ApiClient.init()` are
migrated to the same setup.

New coverage:

| File                         | Covers                                                                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ApiBase.test.js`            | registry keying, URL normalization, `resolve()` dedup, `default`, `all`, `reset()`, `load()` idempotency, concurrent-load collapse, retry after a failed load             |
| `ApiBaseCache.test.js`       | per-base cache isolation, TTL expiry, `maxEntries` LRU eviction, `clearCache()`                                                                                           |
| `ApiClientMultiBase.test.js` | two bases with independent metadata, caches and event buses; two clients on one base with independent rite and calendar data                                              |
| `ApiClientErrors.test.js`    | `init()` rejects with an `ApiClientError` carrying url and status; a failed calendar fetch rejects and emits `'calendarFetchFailed'`                                      |
| `ComponentBinding.test.js`   | explicit binding for `CalendarSelect`, `ApiOptions` and `LocaleInput`; fallback to `default`; the multi-base fallback warning; `PathBuilder` throwing on mismatched bases |

Every test runs against fixtures. **No test requires a live API**, let alone two.

## Ships alongside

- `examples/CompareBases/` — the two-tree comparison page, pointed at `http://localhost:8000` and
  the live API. Manual and development only, for the reason above: it is the one thing here that
  needs two running servers.
- `CHANGELOG.md` — the v2.0.0 migration note for `init()`.
- `README.md` and `CLAUDE.md` — the `apiClient` binding option, `ApiBase`, `ApiClientError`, the
  `'calendarFetchFailed'` event, and the multi-base wiring pattern.

## Out of scope

- **Retry and `AbortController`** (issue #29 §5). A separate question, and not required by
  comparison.
- **`WebCalendar` error rendering.** The library emits `'calendarFetchFailed'`; the page decides what
  to draw.
- **Per-base cache configuration.** `ApiBase.cacheLimits()` is global. No use case has asked for one
  base to cache differently from another.
- **Anything in `liturgy-components-php`.** Its parity work is tracked separately at
  [liturgy-components-php#37](https://github.com/Liturgical-Calendar/liturgy-components-php/issues/37).

## Version

**v2.0.0.** Every change here is additive except `init()` rejecting, and that one change is enough to
require the major. Issue #29 closes with this release: §1 (typedefs), §2 (error propagation), §3
(`isValidDioceseForNation`) and §4 (cache bounds) are all absorbed, and §5 is explicitly deferred.

The already-prepared **v1.6.0** release is independent of this work and should ship first.
