# Installation and Usage

The `@liturgical-calendar/components-js` component library doesn't need to be installed via npm, yarn, or pnpm.
Instead, it can be used directly from a CDN that supports ES6 modules.

## Basic Import

```javascript
// myScript.js
import {
    ApiClient,
    CalendarSelect,
    ApiOptions,
    WebCalendar,
    LiturgyOfTheDay,
    LiturgyOfAnyDay
} from 'https://cdn.jsdelivr.net/npm/@liturgical-calendar/components-js@latest/+esm'
```

> [!TIP]
> To use ES6 import statements without a build step in your project,
> your project's script tag must have the attribute `type="module"`:
>
> ```html
> <!-- myPage.html -->
> <script type="module" src="myScript.js"></script>
> ```

## Runtime Requirements

ES6 module support alone is not sufficient to run the library. The published code targets **ES2022** and uses
ES2022 runtime APIs — `Object.hasOwn()` and `Error`'s `cause` option — as well as `static #` private class
fields. As published, on npm and on the CDN, nothing polyfills them, so the floor for running the shipped
artifact as-is is Chrome/Edge 94+, Firefox 93+, Safari 15.4+, or Node.js 16.11+.

The floor binds the published build, not your build. If you consume this package through your own toolchain
and it transpiles the syntax and polyfills those APIs — core-js, or a `@babel/preset-env` with the right
`targets` — the result runs on older engines; both APIs polyfill straightforwardly. What cannot be done is
loading the CDN build directly into an engine below the floor.

## CDN Caching

> [!NOTE]
> The jsdelivr CDN caches packages for 7 days. When requesting the `@latest` tag,
> you might not get the most recent version for up to a week.
> To use the most recent release before the CDN cache expires, explicitly request the version number:
>
> ```javascript
> import { ApiClient } from 'https://cdn.jsdelivr.net/npm/@liturgical-calendar/components-js@X.Y.Z/+esm';
> ```
>
> Replace `X.Y.Z` with the current version number from the
> [npm package page](https://www.npmjs.com/package/@liturgical-calendar/components-js).
>
> Pinning states an intent; it does not confirm an outcome. To see which build actually loaded, read the
> exported `VERSION` constant. It comes from the module itself, so it stays correct even when a cached page
> and a freshly served bundle disagree:
>
> ```javascript
> import { VERSION } from 'https://cdn.jsdelivr.net/npm/@liturgical-calendar/components-js@X.Y.Z/+esm';
>
> console.debug(`components-js ${VERSION}`);
> ```

## Using Import Maps

You can define an importmap so that you can import from `@liturgical-calendar/components-js`
rather than from the full CDN path:

```html
<!-- myPage.html -->
<script type='importmap'>
    {
        "imports": {
            "@liturgical-calendar/components-js": "https://cdn.jsdelivr.net/npm/@liturgical-calendar/components-js@X.Y.Z/+esm"
        }
    }
</script>
<script type="module" src="myScript.js"></script>
```

> [!TIP]
> Replace `X.Y.Z` with the current version number from the
> [npm package page](https://www.npmjs.com/package/@liturgical-calendar/components-js).

```javascript
// myScript.js
import {
    ApiClient,
    CalendarSelect,
    ApiOptions
} from '@liturgical-calendar/components-js'
```

The importmap lets the browser know where to look for the package.
It must be defined before the script that imports the package.
Define the importmap in an inline `<script type="importmap">` rather than loading from a separate file
to avoid unnecessary network requests and timing conflicts.

## Local Development

If you want to install the package locally for development:

```bash
# Using npm
npm install @liturgical-calendar/components-js

# Using yarn
yarn add @liturgical-calendar/components-js

# Using pnpm
pnpm add @liturgical-calendar/components-js

# Using bun
bun add @liturgical-calendar/components-js
```

Then import in your JavaScript:

```javascript
import { ApiClient, CalendarSelect } from '@liturgical-calendar/components-js';
```
