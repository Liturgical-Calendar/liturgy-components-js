/**
 * The `CalendarResourcePicker` story's render logic.
 *
 * Factored out of `CalendarResourcePicker.stories.js` for one reason: this project's
 * `yarn test` runs Jest with no CSS transform configured, and the story file imports
 * `bootstrap/dist/css/bootstrap.min.css` at module scope for Storybook's benefit —
 * exactly what Storybook needs when it loads the story for real, and exactly what
 * makes Jest throw `SyntaxError: Invalid or unexpected token` on the first `@charset`
 * line if that module is imported from a test. Keeping this function in its own,
 * CSS-free module lets a Jest test import the very function the story renders with,
 * rather than a hand-written stand-in that could silently drift from it.
 *
 * `CalendarResourcePicker.mountInto()` treats a disconnected target as a cancelled
 * mount — Task 6's `isConnected` guard, which is correct and stays as-is — so the
 * container is attached to `document.body` before mounting and detached again once
 * mounting has settled. The picker itself needs no permanent parent, only a
 * connected one at the moments `mountInto()` inspects it.
 *
 * Imports its dependencies by RELATIVE path rather than the `@liturgical-calendar/
 * components-js` specifier every neighbouring `*.stories.js` file uses. That
 * specifier resolves to `dist/`, which does not exist on a clean checkout before
 * the first `yarn compile` — invisible for the other story files, because nothing
 * had ever imported one from a test before this file existed to be imported from
 * `CalendarResourcePickerStory.test.js`. `yarn test` must pass with no `dist/`
 * directory present at all, so this one file reaches into `src/` directly instead.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import CalendarResourcePicker from '../../MetaComponents/CalendarResourcePicker.js';
import { CalendarSelectFilter } from '../../Enums.js';

/**
 * @param {{theme?: Object}} args - Storybook args; only `theme` is read.
 * @returns {Promise<HTMLElement>} The mount element, containing a rendered picker.
 */
export async function render(args) {
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    try {
        await CalendarResourcePicker.mountInto(mount, {
            locale: 'en',
            filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
            placeholderText: 'Select calendar ID...',
            theme: args.theme,
        });
    } finally {
        document.body.removeChild(mount);
    }
    return mount;
}
