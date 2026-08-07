# ApiClient

The `ApiClient` is not a UI component, but rather manages API communication.
It fetches data from the Liturgical Calendar API based on interactions with UI components
and provides the fetched data to those components.

## Initialization

The `ApiClient` must be statically initialized before any UI components can be used:

```javascript
import { ApiClient } from '@liturgical-calendar/components-js';

// Initialize with a local API URL
ApiClient.init('http://localhost:8000').then((apiClient) => {
    if (apiClient instanceof ApiClient) {
        // Create and configure UI components here
    }
});

// Initialize with the default remote API URL
ApiClient.init().then((apiClient) => {
    if (apiClient instanceof ApiClient) {
        // Create and configure UI components here
    }
});
```

The default API URL is `https://litcal.johnromanodorazio.com/api/dev/`.

The `init()` method returns a promise that resolves to:

- An `ApiClient` instance if successful
- `false` if an error occurs

## Listening to UI Components

Configure the `ApiClient` to listen to `CalendarSelect` and `ApiOptions` components:

```javascript
ApiClient.init('http://localhost:8000').then((apiClient) => {
    if (apiClient instanceof ApiClient) {
        const calendarSelect = new CalendarSelect();
        const apiOptions = new ApiOptions();
        apiClient.listenTo(calendarSelect).listenTo(apiOptions);
    }
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

The `locale` parameter is optional for all fetch methods. When provided, it sets the `Accept-Language` header for the request.
The locale is validated against the calendar's supported locales before being applied.

## Configuration Methods

Set year and year type directly using chainable methods:

```javascript
import { ApiClient, YearType } from '@liturgical-calendar/components-js';

apiClient.year(2025);
apiClient.yearType(YearType.LITURGICAL);

// Chainable
apiClient.year(2025).yearType(YearType.CIVIL).fetchCalendar('en');
```

> [!NOTE]
> The older methods `setYear()` and `setYearType()` are deprecated but still available.
> They emit console warnings. Please migrate to `year()` and `yearType()`.

## Rite

The rite is a **path segment**, not a query parameter, so it is composed into the URL rather than sent in
the request body.

```javascript
import { ApiClient, RiteSelect, Rite } from '@liturgical-calendar/components-js';

const apiClient = await ApiClient.init();
const riteSelect = new RiteSelect('en-US');
riteSelect.appendTo('#rite');

apiClient.listenTo(riteSelect);   // changing the rite refetches
apiClient.rite(Rite.AMBROSIAN);   // or set it directly; chainable
apiClient.fetchCalendar();        // GET /calendar/ambrosian
```

Against a rite-aware API (v6 or `dev`) the segment is emitted for **every** rite, including Roman, so
requests read `/calendar/roman/nation/IT`. Both forms are the same request: the API router accepts
`roman` as an explicit rite segment. Against v5 the segment is omitted entirely and a non-Roman rite is
refused — see [API version support](#api-version-support) below.

`listenTo()` accepts a `RiteSelect` alongside `CalendarSelect` and `ApiOptions`. A rite change drops the
current calendar selection and re-targets the request at the rite-level calendar, because a `calendar_id`
from one rite is never valid under another — in either direction.

`fetchNationalCalendar()` throws under a rite with no national tier: there is no
`/calendar/ambrosian/nation/...` route, so the client refuses rather than emitting a request that cannot
succeed.

The rite participates in the cache key, so switching rite at the same year, locale and calendar id
issues a fresh request rather than returning the previous rite's calendar.

### API version support

Rite support is feature-detected from the `/calendars` metadata that `init()` already fetches: a
rite-aware API announces `ambrosian_calendars`, and v5 does not. There is no version field to read and no
option to configure.

Against a v5-era API the segment is omitted entirely, so this release keeps working for everything v5
supports — v5 rejects the segment on every route, not only Ambrosian ones. Requesting a non-Roman rite
there throws an error naming the version requirement, rather than emitting a request the API answers with
a bare 400.

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

// Clear all cached data
ApiClient.clearCache();
```

## Static Properties

```javascript
ApiClient._apiUrl    // The API URL being used
ApiClient._metadata  // Metadata about available liturgical calendars
```

## Instance Properties

```javascript
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
