# ApiClient

The `ApiClient` is not a UI component, but rather manages API communication.
It fetches data from the Liturgical Calendar API based on interactions with UI components
and provides the fetched data to those components.

## Initialization

An `ApiClient` must be initialized before any UI components are constructed, because they read the calendar
index it loads:

```javascript
import { ApiClient } from '@liturgical-calendar/components-js';

// Initialize with a local API URL
ApiClient.init('http://localhost:8000').then((apiClient) => {
    // Create and configure UI components here
}).catch((error) => {
    console.error(`Could not reach ${error.url}: ${error.message}`);
});

// Initialize with the default remote API URL
const apiClient = await ApiClient.init();
```

The default API URL is `https://litcal.johnromanodorazio.com/api/dev`.

`init()` returns a promise that resolves to a new `ApiClient`, or **rejects**:

- with an `ApiClientError` if the base's `/calendars` request fails, carrying `url`, `status`, `statusText`,
  `body` and `cause`
- with a plain `Error` if the `url` argument is not a non-empty string, or is not an absolute `http:`/`https:` URL

Nothing is thrown synchronously, so one `.catch()` — or one `try`/`catch` around the `await` — covers both.

> [!IMPORTANT]
> Before 2.0.0, `init()` logged the error and resolved to `false`, and call sites guarded with
> `if (apiClient instanceof ApiClient)`. That guard is now dead code: the `then` callback only runs on success.
> Replace it with a `.catch()`.

`init()` returns a **new** client on every call, including for a base already registered. Only the base's
metadata and cache are shared, so two clients against one API can hold different settings — different rites,
for instance.

## Listening to UI Components

Configure the `ApiClient` to listen to `CalendarSelect` and `ApiOptions` components:

```javascript
ApiClient.init('http://localhost:8000').then((apiClient) => {
    const calendarSelect = new CalendarSelect();
    const apiOptions = new ApiOptions();
    apiClient.listenTo(calendarSelect).listenTo(apiOptions);
}).catch((error) => {
    console.error(`Could not reach the API at ${error.url ?? 'the configured base'}: ${error.message}`);
});
```

When listening to components:

- Calendar selection changes trigger automatic data fetching
- API option changes trigger data re-fetching
- The `calendarFetched` event is emitted for `WebCalendar` and other components to consume

## Direct Fetch Methods

Fetch calendar data directly without UI component interactions:

```javascript
// Fetch the General Roman Calendar (Vatican defaults)
apiClient.fetchCalendar();

// Fetch the General Roman Calendar with a specific locale
apiClient.fetchCalendar('en');

// Fetch a National Calendar by ID
apiClient.fetchNationalCalendar('IT');

// Fetch a National Calendar by ID with a specific locale
apiClient.fetchNationalCalendar('IT', 'it');

// Fetch a Diocesan Calendar by ID
apiClient.fetchDiocesanCalendar('romamo_it');

// Fetch a Diocesan Calendar by ID with a specific locale
apiClient.fetchDiocesanCalendar('romamo_it', 'it');

// Re-fetch with current settings
apiClient.refetchCalendarData();
```

The `locale` parameter is optional for all fetch methods, and may be given as a `string` or as an `Intl.Locale`.
When provided, it sets the `Accept-Language` header for the request.
The locale is validated against the calendar's supported locales before being applied.

Each fetch method returns a promise. It resolves to this request's calendar data — or, when a newer request has
superseded it while it was in flight, to the client's current calendar data — and rejects with an
`ApiClientError` after emitting `calendarFetchFailed`. A promise you hold is yours to handle:

```javascript
try {
    const calendarData = await apiClient.fetchNationalCalendar('IT', 'it');
} catch (error) {
    console.error(`${error.status} ${error.statusText} from ${error.url}`);
}
```

Nothing is thrown synchronously, so — as with `init()` — one `.catch()`, or one `try`/`catch` around the
`await`, covers every failure mode. The failures that never got as far as a request reject too:

| Failure                                                      | Rejects with                          | Emits `calendarFetchFailed` |
| ------------------------------------------------------------ | ------------------------------------- | --------------------------- |
| The request fails, or the API answers with a non-2xx status  | `ApiClientError` with request context | yes                         |
| The API cannot serve the current rite                        | plain `Error`                         | no                          |
| `fetchNationalCalendar()` under a rite with no national tier | plain `Error`                         | no                          |
| `locale` is not a parseable tag or an `Intl.Locale`          | plain `Error`                         | no                          |
| A `calendarFetched` listener throws                          | the listener's own error, unwrapped   | no                          |

The three that never reach the network reject with exactly the `Error` they describe rather than an
`ApiClientError`: there is no request context for one to carry. And `calendarFetchFailed` stays silent for
them, because it reports a request that failed and not one that was never made.

**This is a breaking change in 2.0.0.** Before it, these methods returned `undefined` and logged any failure
with `console.error` themselves, so the bare-statement calls shown above could not fail visibly. They now
reject, and a bare statement leaves that rejection unhandled. Either handle the promise, or report failures
once through the event and discard the promise deliberately:

```javascript
apiClient.on('calendarFetchFailed', error => showBanner(error));
apiClient.fetchCalendar('en').catch(() => {});
```

## Errors

`ApiClientError` extends `Error` and carries the request context as enumerable properties, so it survives
logging and `JSON.stringify`:

| Property     | Meaning                                                   |
| ------------ | --------------------------------------------------------- |
| `url`        | The URL that was requested                                |
| `status`     | The HTTP status, or `null` if the request never completed |
| `statusText` | The HTTP status text, or `null` for the same reason       |
| `body`       | The response body as text, when it could be read          |
| `cause`      | The underlying error, when the request never completed    |

A failed calendar request emits `calendarFetchFailed` as `(error, { rite })` before the promise rejects:

```javascript
apiClient.on('calendarFetchFailed', (error, { rite }) => {
    banner.textContent = `The ${rite} calendar could not be loaded: ${error.message}`;
});
```

`on()` is chainable. `calendarFetched` is emitted as `(data, { rite })` on success.

### Which failures are logged

Only the ones nobody could have handled:

- A promise **you** hold — from your own `fetchCalendar()` call — rejects and is **not** logged. Handling it is
  yours.
- The requests the library issues for itself — the listeners behind `listenTo()`, and `LiturgyOfAnyDay`'s year
  handling — have no caller to return a promise to. Their error is delivered to `calendarFetchFailed`, then
  suppressed if anything is subscribed to that event, or logged with `console.error` if nothing is.

Subscribing to `calendarFetchFailed` therefore takes over reporting entirely, and silences the console.

Two of the errors in the table above emit no `calendarFetchFailed` and yet still reach that same
suppression when the library issued the request for itself: an unserviceable rite, and a throw from a
`calendarFetched` listener. With a subscriber attached, neither is announced anywhere. Both used to escape
as an uncaught throw instead, so nothing is lost that was previously handled — but do not read a silent
`calendarFetchFailed` as proof that a selection change succeeded.

## Configuration Methods

Set year and year type directly using chainable methods:

```javascript
import { ApiClient, YearType } from '@liturgical-calendar/components-js';

apiClient.year(2025);
apiClient.yearType(YearType.LITURGICAL);

// Chainable
apiClient.year(2025).yearType(YearType.CIVIL).fetchCalendar('en').catch((error) => {
    console.error(`Could not fetch calendar: ${error.message}`);
});
```

> [!NOTE]
> The older methods `setYear()` and `setYearType()` are deprecated but still available.
> They emit console warnings. Please migrate to `year()` and `yearType()`.

## Rite

The rite is a **path segment**, not a query parameter, so it is composed into the URL rather than sent in
the request body.

```javascript
import { ApiClient, RiteSelect, Rite } from '@liturgical-calendar/components-js';

// One try/catch around the awaits covers both the init() and the fetch rejection.
try {
    const apiClient = await ApiClient.init();
    const riteSelect = new RiteSelect('en-US');
    riteSelect.appendTo('#rite');

    apiClient.listenTo(riteSelect);    // changing the rite refetches
    apiClient.rite(Rite.AMBROSIAN);    // or set it directly; chainable
    await apiClient.fetchCalendar();   // POST /calendar/ambrosian
} catch (error) {
    console.error(`Could not load the Ambrosian calendar: ${error.message}`);
}
```

Against a rite-aware API (v6 or `dev`) the segment is emitted for **every** rite, including Roman, so
requests read `/calendar/roman/nation/IT`. Both forms are the same request: the API router accepts
`roman` as an explicit rite segment. Against v5 the segment is omitted entirely and a non-Roman rite is
refused — see [API version support](#api-version-support) below.

`listenTo()` accepts a `RiteSelect` alongside `CalendarSelect` and `ApiOptions`. A rite change drops the
current calendar selection and re-targets the request at the rite-level calendar, because a `calendar_id`
from one rite is never valid under another — in either direction.

`fetchNationalCalendar()` refuses a rite with no national tier: there is no `/calendar/ambrosian/nation/...`
route, so the client rejects the returned promise rather than emitting a request that cannot succeed.

The rite participates in the cache key, so switching rite at the same year, locale and calendar id
issues a fresh request rather than returning the previous rite's calendar.

### API version support

Rite support is feature-detected from the `/calendars` metadata that `init()` already fetches: a
rite-aware API announces `ambrosian_calendars`, and v5 does not. There is no version field to read and no
option to configure.

Against a v5-era API the segment is omitted entirely, so this release keeps working for everything v5
supports — v5 rejects the segment on every route, not only Ambrosian ones. Requesting a non-Roman rite
there rejects with an error naming the version requirement, rather than emitting a request the API answers
with a bare 400.

## Caching

The `ApiClient` implements parameter-based caching to avoid redundant API requests.
Calendar data is cached based on:

- Category (general, national, diocesan)
- Calendar ID
- Year
- Year type (LITURGICAL or CIVIL)
- Locale
- Rite (roman or ambrosian)
- Mobile feast settings (epiphany, ascension, corpus_christi, eternal_high_priest)

```javascript
// First call fetches from API
await apiClient.fetchCalendar('en');

// Second call with same parameters returns cached data (no HTTP request)
await apiClient.fetchCalendar('en');

// Different parameters trigger a new fetch
apiClient.year(2026);
await apiClient.fetchCalendar('en'); // Fetches from API

// Clear all cached data, on every registered base
ApiClient.clearCache();
```

The cache belongs to the API base, not to the `ApiClient` class, so two clients on one base share it and two
bases never see each other's responses. It is bounded: 50 entries per base by default, evicted
least-recently-**read** first. Both the limit and an optional expiry are set globally through `ApiBase`:

```javascript
import { ApiBase } from '@liturgical-calendar/components-js';

ApiBase.cacheLimits({ maxEntries: 200, ttl: 15 * 60 * 1000 }); // 200 entries, 15 minutes
ApiBase.cacheLimits({ ttl: null });                            // no expiry (the default)
ApiBase.clearAllCaches();                                      // what ApiClient.clearCache() delegates to
```

## API bases

An `ApiBase` is one API base URL and everything belonging to it: the `/calendars` index and the response cache.
Bases are registered in a static registry keyed by normalized URL, so two clients pointed at the same API share
one metadata fetch and one cache. `apiClient.base` is the base a client is bound to.

A base URL must be an **absolute `http:` or `https:` URL**. Normalizing trims whitespace and strips trailing
slashes; anything that is not then an absolute HTTP URL is rejected, because the base is interpolated into
`` `${url}/calendars` `` and any other form resolves against the document and 404s silently. So
`javascript:`, `data:`, `ftp://…`, `//example.org/api` and `/api` are all refused, and so is a scheme-less
`localhost:8000` — which `new URL()` accepts as a URL whose _protocol_ is `localhost:`. That last case is
reported with the URL you almost certainly meant:

```text
ApiBase: url must be an absolute http: or https: URL, but found: localhost:8000 — which carries no scheme.
Did you mean http://localhost:8000?
```

Relative, same-origin bases are not supported. A same-origin deployment should pass an absolute URL, built
from `location.origin` if need be.

```javascript
const dev = await ApiClient.init('http://localhost:8000');
const prod = await ApiClient.init('https://litcal.johnromanodorazio.com/api/dev');

dev.base.url; // 'http://localhost:8000'
dev.base.metadata; // that API's calendar index
```

Pass a client as the `apiClient` option to bind a component to its base:

```javascript
const devSelect = new CalendarSelect({ locale: 'en', apiClient: dev });
const devOptions = new ApiOptions({ locale: 'en', apiClient: dev });
```

Omitting it binds to the first base registered, which is what every single-base page does implicitly. Once more
than one base is registered, an unbound component warns once per component class and names the base it chose.
`PathBuilder` has no `apiClient` option: it takes its base from the `ApiOptions` and `CalendarSelect` handed to
it, and throws if those disagree, as does `CalendarSelect.linkToNationsSelect()`.

`examples/CompareBases/` is a complete two-pane page built this way.

### Querying a base

```javascript
apiClient.base.locales(); // every locale this API supports
apiClient.base.nationalCalendars(); // every national calendar
apiClient.base.diocesanCalendars(Rite.ROMAN); // dioceses of a rite (Roman by default)
apiClient.base.riteCalendars(Rite.AMBROSIAN); // a rite's own rite-level calendars
apiClient.base.isValidDioceseForNation('romamo_it', 'IT'); // true
apiClient.base.supportsRite; // whether the API understands the rite path segment
```

Every one of these except `supportsRite` throws, rather than answering emptily, if the base has not been
loaded — an empty calendar list is indistinguishable from an API that genuinely serves none, and would surface
as an empty select with no explanation. `supportsRite` is feature detection and answers `false` for an
unloaded base.

### Testing without mocking fetch

`ApiBase.fromMetadata(url, metadata)` registers a loaded base with no network request, and `ApiBase.reset()`
empties the registry between tests:

```javascript
import { ApiBase, ApiClient, CalendarSelect } from '@liturgical-calendar/components-js';

beforeEach(() => {
    ApiBase.reset();
});

test('lists the national calendars of its base', () => {
    const base = ApiBase.fromMetadata('http://test.local', METADATA);
    const calendarSelect = new CalendarSelect({ locale: 'en', apiClient: new ApiClient(base) });
    // …
});
```

The metadata must be an object carrying `national_calendars`, `diocesan_calendars` and `locales`, each of them
an array; anything else is rejected with a message naming the field, the type actually found and the base URL.
A field that is present but not an array is refused just as an absent one is — `locales: {}` would otherwise
pass here and fail later, on the request path, as a bare `TypeError`.

## Static Properties

```javascript
ApiClient._apiUrl // DEPRECATED — the URL of the FIRST registered base
ApiClient._metadata // DEPRECATED — the calendar index of the FIRST registered base
```

> [!WARNING]
> Both are deprecated as of 2.0.0. With more than one base registered they cannot know which one the caller
> means, so they answer with the first and warn on every read. Read them from a specific client instead, as
> `apiClient.base.url` and `apiClient.base.metadata`. The instance getters `apiClient._apiUrl` and
> `apiClient._metadata` are not deprecated and answer for that client's own base.

## Instance Properties

```javascript
apiClient.base          // The ApiBase this client is bound to
apiClient._apiUrl       // That base's URL
apiClient._metadata     // That base's calendar index
apiClient._calendarData // Latest fetched calendar data
apiClient._eventBus     // EventEmitter instance for event handling (EventEmitter is an internal class that is not exported)

/**
 * Registers a new callback for an event.
 *
 * @param {string} event - The name of the event to register.
 * @param {function} listener - The callback function to invoke when the event occurs.
 */
apiClient._eventBus.on(event, listener)

/**
 * Emits a specified event, invoking all registered listeners with the provided data.
 *
 * @param {string} event - The name of the event to emit.
 * @param {*} data - The data to pass to each event listener.
 */
apiClient._eventBus.emit(event)
apiClient._eventBus._events // readonly object map of registered events and event handlers
```
