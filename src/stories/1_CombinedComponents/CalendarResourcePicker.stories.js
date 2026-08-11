import {
    CalendarResourcePicker,
    CalendarSelectFilter,
} from '@liturgical-calendar/components-js';
import 'bootstrap/dist/css/bootstrap.min.css';

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
 */
const render = (args) => {
    const mount = document.createElement('div');
    CalendarResourcePicker.mountInto(mount, {
        locale: 'en',
        filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
        placeholderText: 'Select calendar ID...',
        theme: args.theme,
    });
    return mount;
};

const meta = {
    title: 'Combined Components/CalendarResourcePicker',
    tags: ['autodocs'],
    render,
};

export default meta;

export const Bootstrap = {
    args: {
        theme: {
            select: 'form-select',
            label: 'form-label',
            riteSelect: { class: 'form-select mb-2' },
        },
    },
};

export const Unstyled = { args: { theme: undefined } };
