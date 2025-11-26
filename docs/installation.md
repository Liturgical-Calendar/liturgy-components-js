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

## CDN Caching

> [!NOTE]
> The jsdelivr CDN caches packages for 7 days. When requesting the `@latest` tag,
> you might not get the most recent version for up to a week.
> To use the most recent release before the CDN cache expires, explicitly request the version number:
>
> ```javascript
> import { ApiClient } from 'https://cdn.jsdelivr.net/npm/@liturgical-calendar/components-js@1.4.0/+esm';
> ```

## Using Import Maps

You can define an importmap so that you can import from `@liturgical-calendar/components-js`
rather than from the full CDN path:

```html
<!-- myPage.html -->
<script type='importmap'>
    {
        "imports": {
            "@liturgical-calendar/components-js": "https://cdn.jsdelivr.net/npm/@liturgical-calendar/components-js@1.4.0/+esm"
        }
    }
</script>
<script type="module" src="myScript.js"></script>
```

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
```

Then import in your JavaScript:

```javascript
import { ApiClient, CalendarSelect } from '@liturgical-calendar/components-js';
```
