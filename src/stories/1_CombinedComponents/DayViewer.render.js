/**
 * The `DayViewer` story's render logic.
 *
 * Factored out of `DayViewer.stories.js` for the same reason
 * `CalendarResourcePicker.render.js` is split from `CalendarResourcePicker.stories.js`:
 * this project's `yarn test` runs Jest with no CSS transform configured, and the
 * story file imports `bootstrap/dist/css/bootstrap.min.css` at module scope for
 * Storybook's benefit — exactly what Storybook needs when it loads the story for
 * real, and exactly what makes Jest throw `SyntaxError: Invalid or unexpected
 * token` on the first `@charset` line if that module is imported from a test.
 * Keeping this function in its own, CSS-free module lets a Jest test import the
 * very function the story renders with, rather than a hand-written stand-in that
 * could silently drift from it.
 *
 * Imports `DayViewer` by RELATIVE path rather than the `@liturgical-calendar/
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

import DayViewer from '../../MetaComponents/DayViewer.js';

/**
 * @param {{theme?: Object}} args - Storybook args; only `theme` is read.
 * @returns {Promise<HTMLElement>} The mount element, containing a rendered viewer.
 */
export async function render(args) {
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    // No `apiClient` option: the story mounts a working form without an
    // `ApiClient` wired, exactly as a page that only needs the controls (and
    // wires them itself, later) would. `mountInto()` skips the initial fetch in
    // that case, so there is nothing here for it to fail against.
    await DayViewer.mountInto(mount, {
        locale: 'en',
        theme: args.theme,
    });
    return mount;
}
