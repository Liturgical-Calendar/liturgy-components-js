/**
 * The `CalendarViewer` story's render logic.
 *
 * Factored out of `CalendarViewer.stories.js` for the same reason
 * `CalendarResourcePicker.render.js` and `DayViewer.render.js` are split from their own
 * `*.stories.js` files: this project's `yarn test` runs Jest with no CSS transform
 * configured, and the story file imports `bootstrap/dist/css/bootstrap.min.css` at
 * module scope for Storybook's benefit — exactly what Storybook needs when it loads
 * the story for real, and exactly what makes Jest throw `SyntaxError: Invalid or
 * unexpected token` on the first `@charset` line if that module is imported from a
 * test. Keeping this function in its own, CSS-free module lets a Jest test import the
 * very function the story renders with, rather than a hand-written stand-in that
 * could silently drift from it.
 *
 * `CalendarViewer.mountInto()` treats a disconnected slot target as a cancelled
 * mount — the same `isConnected` guard `CalendarResourcePicker.mountInto()` and
 * `DayViewer.mountInto()` apply — so both slots are attached to `document.body`
 * before mounting and detached again (via their shared wrapper) once mounting has
 * settled.
 *
 * Unlike `CalendarResourcePicker` and `DayViewer`, `CalendarViewer.mountInto()`
 * requires a slots object naming `controls` AND `calendar` — a bare selector or
 * element is rejected — so this passes the two child elements directly rather than
 * a single mount. No `apiClient` is passed, for the same reason `DayViewer.render.js`
 * omits one: the story shows the wired form and an (empty, unfetched) table, not a
 * live fetch. `WebCalendar.appendTo()` only stores the target element reference and
 * renders nothing until data arrives via `listenTo()`, so the `calendar` slot stays
 * empty here — that is expected, not a defect in this render helper.
 *
 * Imports its dependency by RELATIVE path rather than the `@liturgical-calendar/
 * components-js` specifier every neighbouring `*.stories.js` file uses. That
 * specifier resolves to `dist/`, which does not exist on a clean checkout before
 * the first `yarn compile` — invisible for the other story files, because nothing
 * had ever imported one from a test before `CalendarResourcePicker.render.js` set
 * this precedent. `yarn test` must pass with no `dist/` directory present at all,
 * so this file reaches into `src/` directly instead.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import CalendarViewer from '../../MetaComponents/CalendarViewer.js';

/**
 * @param {{theme?: Object}} args - Storybook args; only `theme` is read.
 * @returns {Promise<HTMLElement>} The mount element, containing the rendered viewer.
 */
export async function render(args) {
    const mount = document.createElement('div');
    const controls = document.createElement('div');
    const calendar = document.createElement('div');
    mount.appendChild(controls);
    mount.appendChild(calendar);
    document.body.appendChild(mount);
    try {
        await CalendarViewer.mountInto(
            { controls, calendar },
            {
                locale: 'en',
                theme: args.theme,
            },
        );
    } finally {
        document.body.removeChild(mount);
    }
    return mount;
}
