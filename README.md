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

| Component                                    | Description                                   |
| -------------------------------------------- | --------------------------------------------- |
| [ApiClient][api-client]                      | Manages API communication and data fetching   |
| [CalendarSelect][calendar-select]            | Dropdown for selecting liturgical calendars   |
| [RiteSelect][rite-select]                    | Dropdown for selecting the liturgical rite    |
| [ApiOptions][api-options]                    | Form controls for API parameters              |
| [WebCalendar][web-calendar]                  | Full calendar table with customizable display |
| [LiturgyOfTheDay / LiturgyOfAnyDay][liturgy] | Daily liturgy widgets                         |
| [PathBuilder][path-builder]                  | API URL builder tool                          |
| [Utils][utils]                               | Utility functions for locale detection        |

[api-client]: https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/api-client.md
[calendar-select]: https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/calendar-select.md
[rite-select]: https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/rite-select.md
[api-options]: https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/api-options.md
[web-calendar]: https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/web-calendar.md
[liturgy]: https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/liturgy-components.md
[path-builder]: https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/path-builder.md
[utils]: https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/utils.md

## Documentation

- [Installation & Usage](https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/installation.md) - CDN usage, import maps, local development
- [Storybook & Development](https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/storybook.md) - Running Storybook, Docker setup
- [Enums Reference](https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/enums.md) - All available enum values
- [Examples](https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/examples.md) - Working example applications

## Examples

The `examples/` folder contains complete working examples:

| Example                           | Description                                    |
| --------------------------------- | ---------------------------------------------- |
| [LiturgyOfTheDay][ex-liturgy-day] | Today's liturgy with calendar/locale selection |
| [LiturgyOfAnyDay][ex-liturgy-any] | Browse any date with lectionary readings       |
| [WebCalendar][ex-webcalendar]     | Full calendar table with display options       |
| [PathBuilder][ex-pathbuilder]     | Interactive API URL builder                    |

[ex-liturgy-day]: https://github.com/Liturgical-Calendar/liturgy-components-js/tree/main/examples/LiturgyOfTheDay
[ex-liturgy-any]: https://github.com/Liturgical-Calendar/liturgy-components-js/tree/main/examples/LiturgyOfAnyDay
[ex-webcalendar]: https://github.com/Liturgical-Calendar/liturgy-components-js/tree/main/examples/WebCalendar
[ex-pathbuilder]: https://github.com/Liturgical-Calendar/liturgy-components-js/tree/main/examples/PathBuilder

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
    RiteSelect,
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
    LatinInterface,
    Rite,
    RiteProperties
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
