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
    apiClient.fetchCalendar('en').catch((error) => {
        console.error(`Could not load the calendar: ${error.message}`);
    });
}).catch((error) => {
    console.error(`Could not reach the API at ${error.url}: ${error.message}`);
});
</script>
```

## Components

| Component                                    | Description                                        |
| -------------------------------------------- | -------------------------------------------------- |
| [ApiClient][api-client]                      | Manages API communication and data fetching        |
| [ApiBase][api-client]                        | One API base: its URL, index and cache             |
| [ApiClientError][api-client]                 | Error carrying url, status, statusText, body       |
| [CalendarSelect][calendar-select]            | Dropdown for selecting liturgical calendars        |
| [RiteSelect][rite-select]                    | Dropdown for selecting the liturgical rite         |
| [ApiOptions][api-options]                    | Form controls for API parameters                   |
| [WebCalendar][web-calendar]                  | Full calendar table with customizable display      |
| [LiturgyOfTheDay / LiturgyOfAnyDay][liturgy] | Daily liturgy widgets                              |
| [PathBuilder][path-builder]                  | API URL builder tool                               |
| [CalendarResourcePicker][meta-components]    | Rite + calendar picker, bundled and wired          |
| [DayViewer][meta-components]                 | Complete "liturgy of any day" page in one mount    |
| [CalendarControls][meta-components]          | Rite + calendar + `ApiOptions`, wired, no renderer |
| [CalendarViewer][meta-components]            | `CalendarControls` paired with a `WebCalendar`     |
| [ApiExplorer][meta-components]               | `CalendarControls` paired with a `PathBuilder`     |
| [Utils][utils]                               | Utility functions for locale detection             |

[api-client]: https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/api-client.md
[calendar-select]: https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/calendar-select.md
[rite-select]: https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/rite-select.md
[api-options]: https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/api-options.md
[web-calendar]: https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/web-calendar.md
[liturgy]: https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/liturgy-components.md
[path-builder]: https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/path-builder.md
[meta-components]: https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/meta-components.md
[utils]: https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/utils.md

## Meta-components

Meta-components bundle a fixed, tested wiring of the library's existing components — including the
ordering requirements and silent-failure traps that come with wiring them by hand — behind a single
mount call, and expose the wired children publicly for anything a theme bag doesn't cover:

- **`CalendarResourcePicker`** — a `RiteSelect` and a filtered `CalendarSelect` bundled into one mount,
  for picking a national or diocesan calendar resource id.
- **`DayViewer`** — a complete "liturgy of any day" page (rite, calendar, locale and the
  `LiturgyOfAnyDay` widget) bundled into one mount, correctly wired so a rite change actually reaches
  the API request.
- **`CalendarControls`** — a `RiteSelect`, a `CalendarSelect` and an `ApiOptions` bundled into one mount
  and wired to an `ApiClient`, with no renderer of its own. `CalendarViewer` and `ApiExplorer` are both
  built on it; a fourth, unbundled consumer renders with FullCalendar instead of `WebCalendar`, which is
  why the renderer was kept out of this class rather than folded in.
- **`CalendarViewer`** — `CalendarControls` paired with a `WebCalendar`, the whole calendar-table example
  page in one mount call.
- **`ApiExplorer`** — `CalendarControls` paired with a `PathBuilder`, with fetching turned off, for a page
  whose only job is building and previewing an API request URL.

All five take a synchronous constructor plus a static async `mountInto()`, and a `theme` bag written in
HTML roles (`select`, `input`, `label`, `wrapper`) rather than framework class names — the library ships
no framework-specific CSS. See [the meta-components documentation][meta-components] for the full
contract, including the theme bag's resolution rules and the reject/resolve behaviour of `mountInto()`.

## Using two API bases on one page

Each `ApiClient` is bound to an `ApiBase` — one object per API base URL, owning that base's calendar index and
its response cache. Passing a client to a component binds the component to that base:

```javascript
const dev = await ApiClient.init('http://localhost:8000');
const prod = await ApiClient.init('https://litcal.johnromanodorazio.com/api/dev');

const devSelect = new CalendarSelect({ locale: 'en', apiClient: dev });
const prodSelect = new CalendarSelect({ locale: 'en', apiClient: prod });
```

Omitting `apiClient` binds to the first base initialized, so single-base pages need no change. Once more than
one base is registered, an unbound component warns and names the base it chose.

`PathBuilder` takes no `apiClient`: it reads the base of the `ApiOptions` and `CalendarSelect` handed to it, and
throws if those two disagree. `CalendarSelect.linkToNationsSelect()` throws on the same mismatch.

`ApiClient.init()` returns a **new** client on every call, including for a base already registered — only the
metadata and cache are shared. That is what allows two clients on one API to hold different rites:

```javascript
import { ApiClient, Rite } from '@liturgical-calendar/components-js';

const BASE = 'https://litcal.johnromanodorazio.com/api/dev';

const roman = await ApiClient.init(BASE);
const ambrosian = await ApiClient.init(BASE);
ambrosian.rite(Rite.AMBROSIAN);
```

See [`examples/CompareBases/`](https://github.com/Liturgical-Calendar/liturgy-components-js/tree/main/examples/CompareBases)
for a complete two-pane page, and [the ApiClient documentation][api-client] for error handling and caching.

## Documentation

- [Installation & Usage](https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/installation.md) - CDN usage, import maps, local development
- [Storybook & Development](https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/storybook.md) - Running Storybook, Docker setup
- [Enums Reference](https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/enums.md) - All available enum values
- [Examples](https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docs/examples.md) - Working example applications

## Examples

The `examples/` folder contains complete working examples:

| Example                                 | Description                                    |
| --------------------------------------- | ---------------------------------------------- |
| [LiturgyOfTheDay][ex-liturgy-day]       | Today's liturgy with calendar/locale selection |
| [LiturgyOfAnyDay][ex-liturgy-any]       | Browse any date with lectionary readings       |
| [WebCalendar][ex-webcalendar]           | Full calendar table with display options       |
| [PathBuilder][ex-pathbuilder]           | Interactive API URL builder                    |
| [RiteSelectChain][ex-rite-chain]        | Rite to nation to diocese chain                |
| [RiteSelectPathBuilder][ex-rite-path]   | The rite as an API path segment                |
| [RiteSelectWebCalendar][ex-rite-webcal] | A rendered Ambrosian calendar                  |
| [CompareBases][ex-compare-bases]        | Two API bases side by side on one page         |

[ex-liturgy-day]: https://github.com/Liturgical-Calendar/liturgy-components-js/tree/main/examples/LiturgyOfTheDay
[ex-liturgy-any]: https://github.com/Liturgical-Calendar/liturgy-components-js/tree/main/examples/LiturgyOfAnyDay
[ex-webcalendar]: https://github.com/Liturgical-Calendar/liturgy-components-js/tree/main/examples/WebCalendar
[ex-pathbuilder]: https://github.com/Liturgical-Calendar/liturgy-components-js/tree/main/examples/PathBuilder
[ex-rite-chain]: https://github.com/Liturgical-Calendar/liturgy-components-js/tree/main/examples/RiteSelectChain
[ex-rite-path]: https://github.com/Liturgical-Calendar/liturgy-components-js/tree/main/examples/RiteSelectPathBuilder
[ex-rite-webcal]: https://github.com/Liturgical-Calendar/liturgy-components-js/tree/main/examples/RiteSelectWebCalendar
[ex-compare-bases]: https://github.com/Liturgical-Calendar/liturgy-components-js/tree/main/examples/CompareBases

To run examples:

1. Start the Liturgical Calendar API on `localhost:8000`
2. Serve the project: `python3 -m http.server 8090`
3. Open `http://localhost:8090/examples/LiturgyOfTheDay/`

## Exports

```javascript
export {
    // Components
    ApiClient,
    ApiClientError,
    ApiBase,
    CalendarSelect,
    RiteSelect,
    ApiOptions,
    WebCalendar,
    LiturgyOfTheDay,
    LiturgyOfAnyDay,
    PathBuilder,
    CalendarResourcePicker,
    DayViewer,
    CalendarControls,
    CalendarViewer,
    ApiExplorer,
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
    RiteProperties,

    // Metadata
    VERSION
}
```

## Version

`VERSION` is this package's own version as a string, so a running page can report which build it is on:

```javascript
import { VERSION } from '@liturgical-calendar/components-js';

console.debug(`components-js ${VERSION}`);
```

This matters when the library is resolved more than one way. A page that loads it from a symlinked local
build in development and a pinned CDN tag in production can silently run two different versions, and a
pinned importmap is not evidence of what actually loaded: jsDelivr rebuilds `+esm` bundles, and a stale
browser cache can serve an old module from a URL that reads current. `VERSION` is what the loaded module
itself says, so it answers the question the URL cannot.

It is typed `string` rather than a string literal, so a consumer's version-floor comparison type-checks
instead of raising TS2367.

## Key Features

- **No build step required** - Use directly from CDN with ES6 imports
- **Chainable configuration** - Fluent API for all components
- **Automatic caching** - Reduces redundant API requests
- **Locale support** - 13 languages supported; every component takes a locale as either a `string` or an
  `Intl.Locale`, and treats `null` and `undefined` alike as "not supplied"
- **Bootstrap compatible** - Easy integration with Bootstrap 5
- **TypeScript definitions** - Full type support in `dist/index.d.ts`

## Browser Support

Requires `<script type="module">`, and a browser with **ES2022** support: Chrome/Edge 94+, Firefox 93+, Safari 15.4+.
On Node.js the floor is 16.11+ (18+ recommended).

ES6 module support alone is not enough. The published code uses ES2022 runtime APIs — `Object.hasOwn()` and
`Error`'s `cause` option — as well as `static #` private class fields. A compiler `target` alone cannot
transpile a runtime API away, and the published build ships no polyfills, so an older engine fails at run time
on the artifact as shipped. Consuming the package through your own toolchain lifts that: transpile the syntax
and polyfill the two APIs (core-js does both) and the floor is whatever your build targets.

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
