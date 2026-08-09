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
ignore. One entry under Breaking is none of those and changes no code at all: the package now declares the
ES2022 floor it has always required.

The work merged after 1.5.0 that never got a release of its own is folded into the sections below rather than
kept apart: `CalendarSelect.linkToRiteSelect()`, the rite vocabulary in ten more languages, and the path
builder's ability to re-filter its calendar select. Upgrading from 1.5.0 brings all of it.

### Breaking

- `ApiClient.init()` now **rejects** when the API cannot be reached, instead of logging the error and resolving
  to `false`. It rejects with an `ApiClientError` carrying `url`, `status`, `statusText` and `body` when the
  `/calendars` request fails, and with a plain `Error` when the `url` argument itself is not a non-empty string
  or is not an absolute `http:`/`https:` URL.
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
  client's current data — and rejects with an `ApiClientError` after emitting `calendarFetchFailed`. Nothing is
  thrown synchronously, so — as with `init()` — a single `.catch()` covers every failure mode, including the
  ones that never get as far as a request. An API that cannot serve the current rite, a
  `fetchNationalCalendar()` under a rite with no national tier, and a `locale` that is neither a parseable tag
  nor an `Intl.Locale` used to throw at the call site, past any `.catch()` written around it; they now reject
  too, with exactly the plain `Error` they threw rather than an `ApiClientError`, since there is no request
  context for one to carry. They emit no `calendarFetchFailed`: it reports a request that failed, not one that
  was never made. A promise
  you hold is yours: the library does not log it on your behalf. Its `console.error` fallback covers only its
  own fire-and-forget calls — the listeners behind `listenTo()`, and `LiturgyOfAnyDay`'s year handling — which
  have no caller to hand a promise back to, and even those are silenced once anything is subscribed to
  `calendarFetchFailed`. Subscribing is therefore the intended way to take over reporting entirely. A throw from
  a `calendarFetched` listener is **not** a fetch failure: it propagates to the returned promise unwrapped, and
  emits no `calendarFetchFailed`.

Three narrower breaks, listed for completeness:

- The `ApiClient` constructor now takes the `ApiBase` it is bound to: `new ApiClient( base )`. It previously
  took no arguments and worked standalone, because the URL and metadata were statics. `new ApiClient()` — or
  any call whose argument is not an `ApiBase` — now throws immediately, naming `ApiClient.init()` as the way
  to obtain a client, rather than leaving the client with no base for a later fetch to fail on unhelpfully.
  `ApiClient.init()` was always the documented way to obtain a client and is unaffected; the constructor is
  worth knowing about because it is how a test builds a client on a base from `ApiBase.fromMetadata()`.
- `LocaleInput` now requires an `ApiBase` as its second constructor argument and throws without one. It is not
  exported from the package root, so this only affects code deep-importing
  `ApiOptions/Input/index.js`. Construct an `ApiOptions`, which supplies the base itself, or pass one:
  `new LocaleInput( locale, apiClient.base )`.
- `CalendarSelect`, `RiteSelect`, `LiturgyOfTheDay` and `LiturgyOfAnyDay` now reject an options argument that is
  none of a string, an `Intl.Locale`, a plain object or nullish, as `ApiOptions` already did. Each of the four
  previously accepted any class instance and then took every default, English
  included: `new CalendarSelect( new Date() )` built an English select and warned about nothing, because a
  `Date` shares not one property name with `locale`, `id`, `filter` or any other option and so destructures to
  `{}`. The test is by prototype, so any class instance is refused and a null-prototype object still passes; the
  message names the component and the type it found —
  ``CalendarSelect: Invalid type for options, must be of type `object` but found type: Date``. A locale string
  or a genuine options object is unaffected, and `Intl.Locale` is a recognized form in its own right rather than
  an exception to this guard — see **Added** below.

And one entry that breaks no code, because it changes none — what narrows is what the package says it needs:

- **ES2022 is now the declared runtime floor.** `tsconfig.json` pins `"target": "ES2022"` in place of
  `"esnext"`, which drifted with every TypeScript release and so stated no contract at all, and the browser
  support lines in `README.md`, `CLAUDE.md` and `docs/installation.md` name concrete engines in place of
  "modern browsers with ES6 module support", a bar 2017-era engines cleared:

  ```text
  Before — Modern browsers with ES6 module support.
  After  — Chrome/Edge 94+, Firefox 93+, Safari 15.4+, Node.js 16.11+.
  ```

  **The requirement is not new; only the statement of it is.** 1.5.0 already shipped `static #` private fields
  and `Object.hasOwn`, and 2.0.0 adds `Error`'s `cause` — the latter two are ES2022 _runtime_ APIs, which no
  compiler `target` can transpile away, and the published build ships no polyfills, so an engine below the
  floor cannot run the artifact as published. It binds what is shipped, not what you build: a consumer whose
  own toolchain transpiles the syntax and polyfills those two APIs (core-js does both) is not bound by it.
  Nothing to do if your engine clears it, and everything released since March 2022 does. If it does
  not, then 1.5.0 did not work there either and pinning to it is no remedy; Safari 15.0 through 15.3 is the
  case to actually watch for, since it has `Error`'s `cause` but not `Object.hasOwn` — which this package calls
  while validating the calendar index, and again wherever a component reads its options bag. The floor is
  stated in the documentation, not enforced by a `package.json` `engines` field, so neither npm nor yarn will
  warn you about it at install time.

### Added

- `ApiBase`: one object per API base URL, owning that base's URL, its `/calendars` index and its response cache.
  A static registry keyed by normalized URL deduplicates bases, so two clients pointed at the same API share one
  metadata fetch and one cache while remaining independent objects. Two bases can now be driven on one page —
  see `examples/CompareBases/`.
- An options-object form for the `ApiOptions` constructor: `new ApiOptions( { locale, apiClient } )`, alongside
  the locale string it has always accepted.
- **`Intl.Locale` is accepted wherever a locale string is** — as the bare constructor argument, as the `locale`
  property of an options object, and as the argument to `WebCalendar.locale()`, `ApiClient.fetchCalendar()`,
  `fetchNationalCalendar()` and `fetchDiocesanCalendar()`. It was previously refused everywhere except
  `LocaleInput`, which requires one, so a caller holding the more precise type had to downgrade it to a string
  for the library that already uses it internally:

  ```js
  const locale = new Intl.Locale( 'it-IT' );

  new CalendarSelect( String( locale ) );          // Before
  new CalendarSelect( locale );                    // After
  new LiturgyOfTheDay( { locale } );               // After — inside a bag too
  webCalendar.locale( locale );                    // After
  ```

  The three forms disambiguate without ambiguity, and are tested in this order: an `Intl.Locale` is a locale, any
  other object is an options bag, a string is a locale. It is a recognized third form checked _before_ the
  plain-object test, not an exception carved into that test — every other class instance is still rejected
  exactly as it was. The value stored is the locale's canonical tag, so an `Intl.Locale` and the string it
  stringifies to are interchangeable; extensions survive, including ones supplied as constructor options and
  therefore absent from the tag as written (`new Intl.Locale( 'en', { calendar: 'buddhist' } )` resolves to
  `en-u-ca-buddhist`). Passing a string is unchanged in every respect.

- **`null` now means "not given" wherever `undefined` does**, both as the options argument itself and as the
  `locale` inside a bag. The five component constructors used to run three different policies between them:

  ```js
  new CalendarSelect( null );                 // Before: defaults — After: unchanged
  new ApiOptions( null );                     // Before: threw    — After: defaults
  new ApiOptions( { locale: null } );         // Before: threw    — After: defaults
  new LiturgyOfTheDay( { locale: null } );    // Before: threw    — After: defaults
  new LiturgyOfTheDay( { locale: undefined } ); // Before: threw  — After: defaults
  ```

  The last of those is the one worth calling out: the widgets read the option with `Object.hasOwn`, which sees
  the key whatever its value, so spreading a bag whose `locale` happened to be unset threw. That is ordinary
  JavaScript and now behaves as an omission does. This is a widening only — every call that worked before works
  unchanged, and only calls that used to throw have new behaviour. An invalid locale still throws: "absent" and
  "unparseable" remain different things, and neither `null` nor `undefined` will ever silence a bad tag.

- An `apiClient` option on `CalendarSelect` and `ApiOptions`, binding the component to that client's base.
  Omitting it binds to the first base registered, so existing single-base code is unaffected. Once more than one
  base is registered, an unbound component warns once per component class and names the base it chose.
- `apiClient.base`, the `ApiBase` a client is bound to. Read `apiClient.base.url` and `apiClient.base.metadata`
  in place of the deprecated statics.
- `ApiBase.fromMetadata( url, metadata )` registers a loaded base with no network request — the supported way to
  exercise components in tests without mocking `fetch`. It hydrates the base for a URL in place and returns the
  same object on every call, so re-installing a fixture replaces that base's calendar index and empties its
  response cache without replacing the base itself. `ApiBase.reset()` empties the registry between tests.
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
- `ApiOptions` validates its constructor argument, and says what was wrong with it. Anything that is none of a
  locale string, an `Intl.Locale`, a plain object or nullish is rejected with a message naming the type it
  found, so that a slip like `new ApiOptions( new Date() )` is recognizable. That same call previously failed
  with `TypeError: locale.replaceAll is not a function`, which named neither the argument nor
  the component. An invalid locale string likewise now reads `ApiOptions: Invalid locale: not a locale` rather
  than the `RangeError` that `Intl.getCanonicalLocales` raises. That guard is now one shared implementation
  rather than six divergent ones, and every component taking an options bag uses it — see the third narrower
  break above.
- All six components that sanitize a caller's locale — `CalendarSelect`, `RiteSelect`, `WebCalendar`,
  `ApiOptions`, `LiturgyOfTheDay` and `LiturgyOfAnyDay` — now report a bad one the same way, naming both
  themselves and the tag `Intl` actually rejected. They used to disagree: for a malformed tag the first four
  named the tag but not themselves, while the two liturgy widgets threw one opaque message for a malformed tag
  and a wrong-typed argument alike:

  ```text
  // Before
  Invalid locale: not a locale             // CalendarSelect, RiteSelect, ApiOptions
  Invalid locale identifier: not a locale  // WebCalendar.locale()
  LiturgyOfTheDay: Invalid locale          // both liturgy widgets, for either fault

  // After
  CalendarSelect: Invalid locale: not a locale
  WebCalendar.locale: Invalid locale: not a locale
  LiturgyOfTheDay: Invalid type for locale, must be of type `string` or `Intl.Locale` but found type: Date
  ```

  The tag named is the normalized one, as it always was for the four that named a tag at all —
  `new ApiOptions( 'it__IT' )` reports `it--IT`, which is what `Intl` was handed — and the type comes from the
  same `describeType` the options guard uses, so a class instance passed where a locale belongs reads
  `found type: Date` rather than `found type: object`. `WebCalendar.locale` is prefixed with the method
  rather than the class because it is a setter a caller invokes by name. No message text is API: match on the
  thrown `Error`, never on what it says. One ordering change comes with this: `ApiOptions` validates the locale
  before resolving its API base, where previously only the type check did, so
  `new ApiOptions( 'not a locale' )` on a page with no base registered now complains about the locale rather
  than about the registry.

  An empty or blank tag is named for what it is rather than reported as an unparseable one. `Intl` rejects
  `''` like any other malformed tag, so the message would otherwise read `WebCalendar.locale: Invalid locale:`
  with nothing at all after the colon; all six now read
  `WebCalendar.locale: Invalid locale, cannot be an empty or blank string`, and a tag that is only whitespace
  is treated as the same mistake. `ApiClient.fetchCalendar( locale )` joins them: it hand-rolled the same
  type check, the same empty-string check and the same `_` to `-` normalization, and now calls the shared
  guard, so a malformed tag passed to it is reported with the method named — as a rejection of the promise it
  returns, per **Breaking** above — rather than being logged to the console and ignored, and the tag it puts in
  `Accept-Language` is the canonical one. Its own sentinels are unchanged —
  `null` still means "no locale given", and a well-formed locale the calendar does not serve is still no error.

- `WebCalendar.locale()` stores the canonical tag rather than the argument as written, so the `_locale` getter
  reads back canonically:

  ```js
  webCalendar.locale( 'EN-us' );
  webCalendar._locale; // Before: 'EN-us' — After: 'en-US'
  ```

  It was the one component that probed the tag with `new Intl.Locale` and then threw the parsed result away.
  Formatting is unaffected, and always would have been — `Intl` canonicalizes internally — so this is visible
  only to code that reads `_locale` back, and only for an argument that was not already canonical.

- A base URL must now be an absolute `http:` or `https:` URL, and is rejected by `ApiBase.normalizeUrl()` — and
  so by `ApiBase.resolve()`, `ApiBase.fromMetadata()` and `ApiClient.init()` — when it is not. Nothing that
  worked stops working: a base that is not an absolute HTTP URL is interpolated into `` `${url}/calendars` ``,
  where it resolves against the document and 404s, so it could only ever fail — silently, and far from its
  cause. What is new is that it fails at the call that supplied it, and says why. Parsing alone was not enough
  to check for: `new URL( 'localhost:8000' )` succeeds, yielding a URL whose _protocol_ is `localhost:`, so a
  caller who merely omitted the scheme would have passed a `URL.canParse()` test and then got the same silent
  404 anyway. That case is singled out and answered with the URL they meant — `Did you mean http://localhost:8000?` —
  while `javascript:`, `data:`, `ftp://…` and the rest are named by the scheme they carry, and `/api` is told
  that a relative base is not supported. A `'///'` base, which normalized away to `''` and registered a base
  whose `load()` fetched a relative `/calendars`, is refused along with them.
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
- A `/calendars` response that is not an object, that omits `national_calendars`, `diocesan_calendars` or
  `locales`, or that carries any of those three as something other than an array, is rejected by `load()` — and
  by `fromMetadata()` — naming the field, the type actually found and the URL of the API that served it, rather
  than only surfacing when some component happens to read it. Requiring the three to be present was not enough
  on its own: an index carrying `locales: {}` passed that check and then failed a step further down, on the
  request path, as a bare `TypeError` out of `.includes()` naming neither the field nor the API — the very
  failure the check exists to prevent, and with a field that is present, so a message about absence would have
  been actively misleading.
- An options bag with no prototype, or one carrying its own `hasOwnProperty` key, no longer throws
  `TypeError: options.hasOwnProperty is not a function`. `CalendarSelect`, `RiteSelect`, `WebCalendar`,
  `LiturgyOfTheDay` and `LiturgyOfAnyDay` read their options — and the `label` bags both selects accept, and the
  `wrapper` bag `CalendarSelect` accepts — by calling `hasOwnProperty` **on the caller's object**, which
  `Object.create( null )` does not carry and which `{ locale: 'it', hasOwnProperty: 'x' }` shadows. Both are
  plain objects that the components' own guard accepts, deliberately so in the first case, and both failed with
  a bare `TypeError` naming neither the component nor the option:

  ```js
  const options = Object.assign( Object.create( null ), { locale: 'it', class: 'form-select' } );
  new CalendarSelect( options ); // Before: TypeError: options.hasOwnProperty is not a function
                                 // After:  the `class` option is applied
  ```

  The reads now use `Object.hasOwn`, which depends on neither the bag's prototype nor its keys. `ApiOptions`
  was never affected: it destructures its options rather than probing them.

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
