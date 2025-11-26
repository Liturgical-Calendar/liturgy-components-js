# @liturgical-calendar/components-js

A reusable ES6/JavaScript component library for the [Liturgical Calendar API](https://litcal.johnromanodorazio.com/api/dev/).
Build liturgical calendar interfaces without a build step.

![LiturgyOfAnyDay Example](https://raw.githubusercontent.com/Liturgical-Calendar/liturgy-components-js/main/docs/images/liturgyofanyday.png)

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
| [ApiClient](https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/api-client.md) | Manages API communication and data fetching |
| [CalendarSelect](https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/calendar-select.md) | Dropdown for selecting liturgical calendars |
| [ApiOptions](https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/api-options.md) | Form controls for API parameters |
| [WebCalendar](https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/web-calendar.md) | Full calendar table with customizable display |
| [LiturgyOfTheDay / LiturgyOfAnyDay](https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/liturgy-components.md) | Daily liturgy widgets |
| [PathBuilder](https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/path-builder.md) | API URL builder tool |
| [Utils](https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/utils.md) | Utility functions for locale detection and validation |

## Documentation

- [Installation & Usage](https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/installation.md) - CDN usage, import maps, local development
- [Storybook & Development](https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/storybook.md) - Running Storybook, Docker setup
- [Enums Reference](https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/enums.md) - All available enum values
- [Examples](https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/examples.md) - Working example applications

## Examples

The `examples/` folder contains complete working examples:

| Example | Description |
|---------|-------------|
| [LiturgyOfTheDay](https://github.com/Liturgical-Calendar/liturgy-components-js/tree/main/examples/LiturgyOfTheDay) | Today's liturgy with calendar/locale selection |
| [LiturgyOfAnyDay](https://github.com/Liturgical-Calendar/liturgy-components-js/tree/main/examples/LiturgyOfAnyDay) | Browse any date with lectionary readings |
| [WebCalendar](https://github.com/Liturgical-Calendar/liturgy-components-js/tree/main/examples/WebCalendar) | Full calendar table with display options |
| [PathBuilder](https://github.com/Liturgical-Calendar/liturgy-components-js/tree/main/examples/PathBuilder) | Interactive API URL builder |

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
    Utils,

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

See [Storybook documentation](https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/storybook.md) for detailed setup.

## License

ISC
