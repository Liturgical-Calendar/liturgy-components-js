# @liturgical-calendar/components-js

A reusable ES6/JavaScript component library for the [Liturgical Calendar API](https://litcal.johnromanodorazio.com/api/dev/).
Build liturgical calendar interfaces without a build step.

![LiturgyOfAnyDay Example](docs/images/liturgyofanyday.png)

## Quick Start

```html
<script type="module">
import {
    ApiClient,
    CalendarSelect,
    LiturgyOfTheDay
} from 'https://cdn.jsdelivr.net/npm/@liturgical-calendar/components-js@latest/+esm';

ApiClient.init().then((apiClient) => {
    if (!(apiClient instanceof ApiClient)) return;

    const calendarSelect = new CalendarSelect('en-US')
        .class('form-select')
        .allowNull();
    calendarSelect.appendTo('#calendar-container');

    const liturgy = new LiturgyOfTheDay('en-US')
        .class('liturgy-widget')
        .showReadings(true)
        .listenTo(apiClient);
    liturgy.appendTo('#liturgy-container');

    apiClient.listenTo(calendarSelect);
    apiClient.fetchCalendar('en');
});
</script>
```

## Components

| Component | Description |
|-----------|-------------|
| [ApiClient](docs/api-client.md) | Manages API communication and data fetching |
| [CalendarSelect](docs/calendar-select.md) | Dropdown for selecting liturgical calendars |
| [ApiOptions](docs/api-options.md) | Form controls for API parameters |
| [WebCalendar](docs/web-calendar.md) | Full calendar table with customizable display |
| [LiturgyOfTheDay / LiturgyOfAnyDay](docs/liturgy-components.md) | Daily liturgy widgets |
| [PathBuilder](docs/path-builder.md) | API URL builder tool |

## Documentation

- [Installation & Usage](docs/installation.md) - CDN usage, import maps, local development
- [Storybook & Development](docs/storybook.md) - Running Storybook, Docker setup
- [Enums Reference](docs/enums.md) - All available enum values
- [Examples](docs/examples.md) - Working example applications

## Examples

The `examples/` folder contains complete working examples:

| Example | Description |
|---------|-------------|
| [LiturgyOfTheDay](examples/LiturgyOfTheDay/) | Today's liturgy with calendar/locale selection |
| [LiturgyOfAnyDay](examples/LiturgyOfAnyDay/) | Browse any date with lectionary readings |
| [WebCalendar](examples/WebCalendar/) | Full calendar table with display options |
| [PathBuilder](examples/PathBuilder/) | Interactive API URL builder |

To run examples:

1. Start the Liturgical Calendar API on `localhost:8000`
2. Serve the project: `python3 -m http.server 3001`
3. Open `http://localhost:3001/examples/LiturgyOfTheDay/`

## Exports

```javascript
export {
    // Components
    ApiClient,
    CalendarSelect,
    ApiOptions,
    WebCalendar,
    LiturgyOfTheDay,
    LiturgyOfAnyDay,
    PathBuilder,
    Input,

    // Enums
    Grouping,
    ColorAs,
    Column,
    ColumnOrder,
    DateFormat,
    GradeDisplay,
    ApiOptionsFilter,
    CalendarSelectFilter,
    YearType,
    LatinInterface
}
```

## Key Features

- **No build step required** - Use directly from CDN with ES6 imports
- **Chainable configuration** - Fluent API for all components
- **Automatic caching** - Reduces redundant API requests
- **Locale support** - 13 languages supported
- **Bootstrap compatible** - Easy integration with Bootstrap 5
- **TypeScript definitions** - Full type support in `dist/index.d.ts`

## Browser Support

Modern browsers with ES6 module support. Requires `<script type="module">`.

## Development

```bash
yarn install          # Install dependencies
yarn compile          # Compile TypeScript
yarn test             # Run tests
yarn storybook        # Launch Storybook
```

See [Storybook documentation](docs/storybook.md) for detailed setup.

## License

ISC
