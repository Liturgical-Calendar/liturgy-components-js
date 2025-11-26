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

// Fetch a National Calendar by ID
apiClient.fetchNationalCalendar('IT');

// Fetch a Diocesan Calendar by ID
apiClient.fetchDiocesanCalendar('romamo_it');

// Re-fetch with current settings
apiClient.refetchCalendarData();
```

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

## Caching

The `ApiClient` implements parameter-based caching to avoid redundant API requests.
Calendar data is cached based on:

- Category (general, national, diocesan)
- Calendar ID
- Year
- Year type (LITURGICAL or CIVIL)
- Locale
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
apiClient._eventBus     // EventEmitter instance for event handling
apiClient._calendarData // Latest fetched calendar data
```

The `_eventBus._events.calendarFetched` can be inspected to see registered event handlers.
