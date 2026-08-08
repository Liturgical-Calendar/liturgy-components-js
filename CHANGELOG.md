# Changelog

Releases before 2.0.0 are not recorded here; see the git history.

## 2.0.0

One breaking change forced the major version: `ApiClient.init()` now rejects instead of resolving to `false`.
Everything else in this release is additive, a deprecation, or a narrower break that only affects code reaching
past the package's public exports.

### Breaking

- `ApiClient.init()` now **rejects** when the API cannot be reached, instead of logging the error and resolving
  to `false`. It rejects with an `ApiClientError` carrying `url`, `status`, `statusText` and `body` when the
  `/calendars` request fails, and with a plain `Error` when the `url` argument itself is not a non-empty string.
  Nothing is thrown synchronously, so a single `.catch()` covers both. Add one — or wrap the `await` in
  `try`/`catch` — at every call site:

  ```js
  // Before
  ApiClient.init( BASE ).then( apiClient => {
      if ( !apiClient || !( apiClient instanceof ApiClient ) ) {
          // handle failure
      }
      // …
  } );

  // After
  ApiClient.init( BASE )
      .then( apiClient => { /* … */ } )
      .catch( error => {
          // error.url, error.status, error.statusText, error.body
          console.error( `Could not reach ${error.url}: ${error.message}` );
      } );
  ```

  The `instanceof` guard is now dead code and can be deleted: the `then` callback only runs on success.

Two narrower breaks, listed for completeness:

- The `ApiClient` constructor now takes the `ApiBase` it is bound to: `new ApiClient( base )`. It previously
  took no arguments and worked standalone, because the URL and metadata were statics. `new ApiClient()` now
  leaves the client with no base, and the first fetch fails with a bare `TypeError`. `ApiClient.init()` was
  always the documented way to obtain a client and is unaffected; the constructor is worth knowing about
  because it is how a test builds a client on a base from `ApiBase.fromMetadata()`.
- `LocaleInput` now requires an `ApiBase` as its second constructor argument and throws without one. It is not
  exported from the package root, so this only affects code deep-importing
  `ApiOptions/Input/index.js`. Construct an `ApiOptions`, which supplies the base itself, or pass one:
  `new LocaleInput( locale, apiClient.base )`.

### Added

- `ApiBase`: one object per API base URL, owning that base's URL, its `/calendars` index and its response cache.
  A static registry keyed by normalized URL deduplicates bases, so two clients pointed at the same API share one
  metadata fetch and one cache while remaining independent objects. Two bases can now be driven on one page —
  see `examples/CompareBases/`.
- An options-object form for the `ApiOptions` constructor: `new ApiOptions( { locale, apiClient } )`, alongside
  the locale string it has always accepted.
- An `apiClient` option on `CalendarSelect` and `ApiOptions`, binding the component to that client's base.
  Omitting it binds to the first base registered, so existing single-base code is unaffected. Once more than one
  base is registered, an unbound component warns once per component class and names the base it chose.
- `apiClient.base`, the `ApiBase` a client is bound to. Read `apiClient.base.url` and `apiClient.base.metadata`
  in place of the deprecated statics.
- `ApiBase.fromMetadata( url, metadata )` registers a loaded base with no network request — the supported way to
  exercise components in tests without mocking `fetch`. `ApiBase.reset()` empties the registry between tests.
- `ApiBase` metadata queries: `locales()`, `nationalCalendars()`, `diocesanCalendars( rite )`,
  `riteCalendars( rite )`, `isValidDioceseForNation( dioceseId, nation )`, and the `supportsRite` getter. The
  methods throw, rather than answering emptily, when the base has not been loaded — an empty calendar list is
  indistinguishable from an API that genuinely serves none. `supportsRite` is feature detection and is the one
  exception: it answers `false` for an unloaded base.
- `ApiBase.cacheLimits( { maxEntries, ttl } )` and `ApiBase.clearAllCaches()`, plus `ApiBase.resolve()`,
  `ApiBase.normalizeUrl()`, `ApiBase.DEFAULT_URL`, `ApiBase.default` and `ApiBase.all`.
- `ApiClientError`, carrying `url`, `status`, `statusText`, `body` and `cause` as enumerable properties, so they
  survive logging and `JSON.stringify`.
- The `calendarFetchFailed` event, emitted as `( error, { rite } )`, and `apiClient.on( event, listener )` as a
  chainable shorthand for `apiClient._eventBus.on()`.
- Guards against pairing components across bases. `new PathBuilder( apiOptions, calendarSelect )` throws when
  its two arguments are bound to different bases — a path built from one API's options and another API's
  calendars would point at neither — and takes its own base from them rather than from an option of its own.
  `CalendarSelect.linkToNationsSelect()` throws on the same mismatch.
- `ApiBase` and `ApiClientError` are exported from the package root.
- The `CalendarIndex`, `NationalCalendar`, `DiocesanCalendar`, `DiocesanGroup`, `WiderRegion` and `CalendarData`
  typedefs.
- `PathBuilder` exposes a `_domElement` getter.

### Changed

- `fetchCalendar()`, `fetchNationalCalendar()` and `fetchDiocesanCalendar()` return a promise. They previously
  returned `undefined`, so awaiting one resolved immediately without waiting for the request. The promise
  resolves to this request's calendar data — or, if a newer request superseded it in flight, to the client's
  current data — and rejects with an `ApiClientError` after emitting `calendarFetchFailed`.
- Failures are logged only when nobody could have handled them. A promise you hold is yours: your
  `fetchCalendar()` rejects and is not logged. The requests the library issues for itself — the listeners behind
  `listenTo()`, and `LiturgyOfAnyDay`'s year handling — have no caller to hand a promise back to, so their
  rejection is delivered to `calendarFetchFailed` and then suppressed if anything is subscribed to it, or logged
  with `console.error` if nothing is. Subscribing to `calendarFetchFailed` therefore silences the console
  entirely, which is the intended way to take over reporting.
- Response caches are bounded, and belong to a base rather than to the `ApiClient` class: 50 entries per base by
  default, evicted least-recently-**read** first, with optional expiry. Both are configured through
  `ApiBase.cacheLimits( { maxEntries, ttl } )`. The cache was previously a single unbounded static map shared by
  every client. `ApiClient.clearCache()` still works and now clears every registered base.
- `ApiOptions` validates its constructor argument, and says what was wrong with it. Anything that is neither a
  locale string nor a plain object is rejected with a message ending in `found type: Locale` — naming the type,
  so that the plausible slip `new ApiOptions( new Intl.Locale( 'it' ) )` is recognizable. That same call
  previously failed with `TypeError: locale.replaceAll is not a function`, which named neither the argument nor
  the component. An invalid locale string likewise now reads `Invalid locale: xx-INVALID` rather than the
  `RangeError` that `Intl.getCanonicalLocales` raises.
- `ApiClient.init( url )` with no argument uses the constant default base rather than the first base already
  registered, so a call meaning "the public API" cannot resolve to a localhost base a comparison page happened
  to register first. An empty string is rejected rather than treated as "unspecified".
- `ApiClient.init()` returns a **new** client on every call, including for a base already registered; only the
  metadata and cache are shared. That is what allows two clients against one API to hold different rites.

### Deprecated

- The statics `ApiClient._apiUrl` and `ApiClient._metadata` resolve to the first registered base, and warn on
  every read while more than one base is registered. Read `apiClient.base.url` and `apiClient.base.metadata`
  from a specific client instead. The instance getters `apiClient._apiUrl` and `apiClient._metadata` are not
  deprecated and answer for that client's own base.

### Fixed

- `ApiClient.init()` called with a second base URL no longer leaves the client pointing at the new API while
  reporting the first API's calendars. The URL was static and was overwritten; the metadata was static and was
  kept.
- Calendar responses are no longer served from one base's cache to another's.
- Concurrent `ApiClient.init()` calls no longer issue duplicate `/calendars` requests: a load already in flight
  is returned rather than duplicated. A failed load clears itself, so a later call can retry.
- A failed calendar request no longer emits `calendarFetched` with `undefined` data and caches it. It emits
  `calendarFetchFailed` and rejects.
- A `/calendars` response that is not an object, or that omits `national_calendars` or `diocesan_calendars`, is
  rejected by `load()` — and by `fromMetadata()` — naming the missing field and the URL of the API that omitted
  it, rather than only surfacing when some component happens to read it.
- `CalendarSelect` no longer sorts the shared metadata's national calendar list in place; it sorts its own copy,
  by its own locale.
- `ApiClient._metadata` was typed as `CalendarMetadata`, the per-response metadata block, rather than as the
  `/calendars` index it actually returns.
