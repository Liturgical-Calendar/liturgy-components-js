import 'bootstrap/dist/css/bootstrap.min.css';
import { render } from './DayViewer.render.js';

/**
 * `DayViewer`
 *
 * A complete "liturgy of any day" page in one mount: a rite select, a calendar
 * select, a locale input and the `LiturgyOfAnyDay` widget, wired to one another
 * the way `LiturgicalCalendarFrontend`'s own liturgy-of-any-day page wires them by
 * hand — including the two-wire rite requirement (`linkToRiteSelect()` AND
 * `apiClient.listenTo(riteSelect)`) that this meta-component exists to stop callers
 * getting wrong.
 *
 * Two stories, one render function, two theme bags. The Bootstrap and unstyled
 * variants differ ONLY by the `theme` argument, which is the claim the theme bag
 * exists to make: nothing framework-specific is baked into the component.
 *
 * `render` is async and awaits `DayViewer.mountInto()` before returning the mount —
 * see `DayViewer.render.js` for why no `apiClient` is passed (the story shows the
 * form, not a live fetch) and why the render logic lives in its own, CSS-free
 * module.
 */
const meta = {
    title: 'Combined Components/DayViewer',
    tags: ['autodocs'],
    render,
};

export default meta;

export const Bootstrap = {
    args: {
        theme: {
            select: 'form-select',
            label: 'form-label',
            input: 'form-control',
            wrapper: 'mb-3',
            riteSelect: { class: 'form-select mb-2' },
        },
    },
};

export const Unstyled = { args: { theme: undefined } };
