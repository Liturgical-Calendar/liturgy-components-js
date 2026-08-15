import 'bootstrap/dist/css/bootstrap.min.css';
import { render } from './CalendarViewer.render.js';

/**
 * `CalendarViewer`
 *
 * A `CalendarControls` paired with a `WebCalendar` — the whole `WebCalendar` example
 * page in one mount: a rite select, a calendar select, `ApiOptions` and the table
 * renderer, wired to one another and, when an `ApiClient` is supplied, to it. This
 * story mounts the form without an `ApiClient`, so the `calendar` slot renders no
 * table — `WebCalendar.appendTo()` only remembers its target until data arrives via
 * `listenTo()`. `CalendarControls` itself is exercised through this story rather than
 * getting a story of its own: this component adds nothing over it but the renderer.
 *
 * Two stories, one render function, two theme bags. The Bootstrap and unstyled
 * variants differ ONLY by the `theme` argument, which is the claim the theme bag
 * exists to make: nothing framework-specific is baked into the component.
 *
 * The Bootstrap bag names `preset: 'bootstrap5'` (#67) rather than spelling out
 * `form-select`/`form-control`/`form-label`, which is the same class set said once
 * instead of three times — and it still styles the whole `ApiOptions` form, which
 * the hand-written bag did not reach without the `Input.setGlobal*` setters.
 *
 * A key written beside the preset REPLACES the preset's value for that key; class
 * tokens are not merged. So an override still spells out the framework class it
 * wants to keep — `select: 'form-select form-select-sm'`, not `'form-select-sm'`.
 * The preset earns its place on the keys a page does NOT override.
 *
 * `render` is async and awaits `CalendarViewer.mountInto()` before returning the
 * mount — see `CalendarViewer.render.js` for why the two slots are passed as
 * elements rather than selectors, and why the render logic lives in its own,
 * CSS-free module.
 */
const meta = {
    title: 'Combined Components/CalendarViewer',
    tags: ['autodocs'],
    render,
};

export default meta;

export const Bootstrap = {
    args: {
        theme: {
            preset: 'bootstrap5',
            label: 'form-label d-block mb-1',
            riteSelect: { class: 'form-select mb-2' },
        },
    },
};

export const Unstyled = { args: { theme: undefined } };
