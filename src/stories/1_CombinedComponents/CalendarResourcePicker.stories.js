import 'bootstrap/dist/css/bootstrap.min.css';
import { render } from './CalendarResourcePicker.render.js';

/**
 * `CalendarResourcePicker`
 *
 * Bundles a `RiteSelect` and a filtered `CalendarSelect` into one mount, wired the
 * way the three admin call sites in `LiturgicalCalendarFrontend` used to wire it by
 * hand: the rite select offered only for a diocesan filter, appended before the
 * calendar select (which `linkToRiteSelect()` requires), and a disabled placeholder
 * re-applied after every rite change.
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
 * `render` is async and awaits `CalendarResourcePicker.mountInto()` before
 * returning the mount — see `CalendarResourcePicker.render.js` for why the mount is
 * briefly attached to `document.body` while mounting, and why the logic lives in its
 * own module.
 */
const meta = {
    title: 'Combined Components/CalendarResourcePicker',
    tags: ['autodocs'],
    render,
};

export default meta;

export const Bootstrap = {
    args: {
        theme: {
            preset: 'bootstrap5',
            riteSelect: { class: 'form-select mb-2' },
        },
    },
};

export const Unstyled = { args: { theme: undefined } };
