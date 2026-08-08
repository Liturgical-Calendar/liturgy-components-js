# Changelog

Releases up to and including 1.5.0 are not recorded here; see the git history. There is no 1.6.0 — the release
prepared under that number was skipped, and everything it was to have delivered ships in 2.0.0 instead. This
entry therefore covers the whole span since 1.5.0, not only the work that forced the major.

## 2.0.0

Two breaking changes forced the major version, and both are the same change of mind: a failure the library used
to log and swallow is now a rejection the caller owns. `ApiClient.init()` rejects instead of resolving to
`false`, and the fetch methods return a promise that rejects instead of one that cannot fail. Everything else in
this release is additive, a deprecation, or a narrower break — two of the three reach only code that imports
past the package's public exports, and the third refuses an argument the components used to accept and quietly
ignore.

The work merged after 1.5.0 that never got a release of its own is folded into the sections below rather than
kept apart: `CalendarSelect.linkToRiteSelect()`, the rite vocabulary in ten more languages, and the path
builder's ability to re-filter its calendar select. Upgrading from 1.5.0 brings all of it.

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

- `fetchCalendar()`, `fetchNationalCalendar()`, `fetchDiocesanCalendar()` and `refetchCalendarData()` now return
  a promise that **rejects** when the request fails. They previously returned `undefined` and ended in a
  `.catch()` that logged the error with `console.error` and swallowed it, so a failed request could never reach
  the caller. Called as a bare statement — the documented idiom, and what every example in this repository did —
  a failure now surfaces as an unhandled promise rejection instead of a logged error:

  ```js
  // Before — returned undefined; the library logged any failure for you
  apiClient.fetchCalendar( 'en' );

  // After — handle the promise
  apiClient.fetchCalendar( 'en' ).catch( error => {
      console.error( `Could not fetch from ${error.url}: ${error.message}` );
  } );

  // …or report failures once, through the event, and discard the individual promise
  apiClient.on( 'calendarFetchFailed', error => showBanner( error ) );
  apiClient.fetchCalendar( 'en' ).catch( () => {} );
  ```

  The promise resolves to this request's calendar data — or, if a newer request superseded it in flight, to the
  client's current data — and rejects with an `ApiClientError` after emitting `calendarFetchFailed`. A promise
  you hold is yours: the library does not log it on your behalf. Its `console.error` fallback covers only its
  own fire-and-forget calls — the listeners behind `listenTo()`, and `LiturgyOfAnyDay`'s year handling — which
  have no caller to hand a promise back to, and even those are silenced once anything is subscribed to
  `calendarFetchFailed`. Subscribing is therefore the intended way to take over reporting entirely. A throw from
  a `calendarFetched` listener is **not** a fetch failure: it propagates to the returned promise unwrapped, and
  emits no `calendarFetchFailed`.

Three narrower breaks, listed for completeness:

- The `ApiClient` constructor now takes the `ApiBase` it is bound to: `new ApiClient( base )`. It previously
  took no arguments and worked standalone, because the URL and metadata were statics. `new ApiClient()` now
  leaves the client with no base, and the first fetch fails with a bare `TypeError`. `ApiClient.init()` was
  always the documented way to obtain a client and is unaffected; the constructor is worth knowing about
  because it is how a test builds a client on a base from `ApiBase.fromMetadata()`.
- `LocaleInput` now requires an `ApiBase` as its second constructor argument and throws without one. It is not
  exported from the package root, so this only affects code deep-importing
  `ApiOptions/Input/index.js`. Construct an `ApiOptions`, which supplies the base itself, or pass one:
  `new LocaleInput( locale, apiClient.base )`.
- `CalendarSelect`, `RiteSelect`, `LiturgyOfTheDay` and `LiturgyOfAnyDay` now reject an options argument that is
  neither a string nor a plain object, as `ApiOptions` already did. Each of the four previously accepted any
  class instance and then took every default, English included: `new CalendarSelect( new Intl.Locale( 'it' ) )`
  built an English select and warned about nothing, because an `Intl.Locale` shares not one property name with
  `locale`, `id`, `filter` or any other option and so destructures to `{}`. The test is by prototype, so any
  class instance is refused and a null-prototype object still passes; the message names the component and the
  type it found — ``CalendarSelect: Invalid type for options, must be of type `object` but found type: Locale``.
  A locale string or a genuine options object is unaffected. What each component makes of `null` is deliberately
  unchanged, and the five still do not agree about it — that is issue #32, left open rather than settled here.

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
- Guards against pairing components across bases, on every pairing that crosses instances.
  `new PathBuilder( apiOptions, calendarSelect )` throws when its two arguments are bound to different bases —
  a path built from one API's options and another API's calendars would point at neither — and takes its own
  base from them rather than from an option of its own.
  `CalendarSelect.linkToNationsSelect()` throws on the same mismatch, as does
  `ApiOptions.linkToCalendarSelect()` for every select passed to it, in both its single and its
  nation/diocese-pair forms, and `ApiClient.listenTo()` for a `CalendarSelect` or an `ApiOptions` bound
  elsewhere. A `RiteSelect` is exempt: it builds its options from the `Rite` enum, reads no metadata, and so
  holds no base to disagree about. Each guard names both URLs and what the mismatch would have caused.
- `ApiBase` and `ApiClientError` are exported from the package root.
- The `CalendarIndex`, `NationalCalendar`, `DiocesanCalendar`, `DiocesanGroup`, `WiderRegion` and `CalendarData`
  typedefs.
- `PathBuilder` exposes a `_domElement` getter.
- `CalendarSelect.linkToRiteSelect( riteSelect, dispatchChange = true )`: makes a select follow a `RiteSelect`,
  rebuilding its options on every rite change and once immediately with the rite select's current value, so a
  select mounted under an already-chosen rite is correct without waiting for a change event. It works for any
  filter, which is what `ApiOptions.linkToCalendarSelect()` does not cover — that accepts only a `none` filtered
  select or a nations/dioceses pair — so a lone `nations` or `dioceses` filtered select can now follow a rite.
  A `nations` filtered select is hidden while a rite with no national tier is selected, the Ambrosian rite
  having none, and shown again when the rite has one. It throws if the select is already linked to a rite
  select, or if the argument is not a `RiteSelect`. `ApiOptions` now drives its own rite handling through this
  same method rather than a second copy of it, passing `dispatchChange = false` so that a select it manages
  hears one `change` per rite change — its own, dispatched once the endpoint state has caught up — rather than
  two with a stale one in between.
- The rite vocabulary beyond `en` and `it`. `GENERAL_ROMAN_CALENDAR` now exists for all 84 locales in the
  catalogue, derived from each locale's already-reviewed `GENERAL_ROMAN_CALENDAR_CAPTION` by dropping its
  trailing `- {year}` suffix, so nothing is invented. `RITE_ROMAN`, `RITE_AMBROSIAN`, `SELECT_A_RITE`,
  `AMBROSIAN_CALENDAR` and `AMBROSIAN_CALENDAR_CAPTION` are translated for the ten further locales this project
  maintains — `la`, `es`, `fr`, `de`, `pt`, `nl`, `hu`, `id`, `sk` and `vi` — bringing those five keys to twelve
  locales. The remaining 72 still fall back to English for them: machine-translated liturgical terminology
  belongs in Weblate, under native review, rather than in the catalogue.

### Changed

- Response caches are bounded, and belong to a base rather than to the `ApiClient` class: 50 entries per base by
  default, evicted least-recently-**read** first, with optional expiry. Both are configured through
  `ApiBase.cacheLimits( { maxEntries, ttl } )`. The cache was previously a single unbounded static map shared by
  every client. `ApiClient.clearCache()` still works and now clears every registered base.
- `ApiOptions` validates its constructor argument, and says what was wrong with it. Anything that is neither a
  locale string nor a plain object is rejected with a message ending in `found type: Locale` — naming the type,
  so that the plausible slip `new ApiOptions( new Intl.Locale( 'it' ) )` is recognizable. That same call
  previously failed with `TypeError: locale.replaceAll is not a function`, which named neither the argument nor
  the component. An invalid locale string likewise now reads `Invalid locale: xx-INVALID` rather than the
  `RangeError` that `Intl.getCanonicalLocales` raises. That guard is now one shared implementation rather than
  six divergent ones, and every component taking an options bag uses it — see the third narrower break above.
- `ApiClient.init( url )` with no argument uses the constant default base rather than the first base already
  registered, so a call meaning "the public API" cannot resolve to a localhost base a comparison page happened
  to register first. An empty string is rejected rather than treated as "unspecified".
- `ApiClient.init()` returns a **new** client on every call, including for a base already registered; only the
  metadata and cache are shared. That is what allows two clients against one API to hold different rites.
- On a rite change, the `change` event that tells a calendar select's own listeners to redraw is now withheld
  from a select that has a dependent diocese select, rather than from any `nations` filtered select. The two
  rules agree for a linked nation/diocese pair, which is what the exclusion is for: the nation select carries
  the diocese select's listener, and dispatching would have it re-derive the diocese options for a nation value
  that was just cleared. They differ for a `nations` filtered select with nothing depending on it, which used to
  be passed over on the strength of its filter alone and is now told, as any other select is.

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
- Switching the path builder from `/calendar/nation/` to `/calendar/diocese/` no longer throws
  `Filter has already been set to ...`, stranding the select on the national list. `ApiOptions` drives one
  `CalendarSelect` between the two lists on every path change, which is the component working as designed
  rather than a configuration chain contradicting itself, so it now calls `_applyFilter()`, which rebuilds
  without the one-shot guard. `filter()` keeps that guard, and both entry points reject an unknown filter alike.
  This mirrors the existing `rite()` / `_applyRite()` split, for the same reason.
- `new LiturgyOfTheDay()` — the no-argument form its own default parameter advertises — no longer throws
  `TypeError: Cannot read properties of null`. `typeof null === 'object'` carried it past the object branch and
  into a property read on `null`; it now falls back to the default locale, as `LiturgyOfAnyDay` does.
