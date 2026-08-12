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
            select: 'form-select',
            label: 'form-label d-block mb-1',
            riteSelect: { class: 'form-select mb-2' },
        },
    },
};

export const Unstyled = { args: { theme: undefined } };
