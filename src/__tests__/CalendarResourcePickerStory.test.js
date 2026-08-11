/** @jest-environment jsdom */
import { describe, it, expect, beforeEach } from '@jest/globals';
// `ApiBase` is imported from the relative `src/` path, matching
// `CalendarResourcePicker.render.js`'s own imports (see that file's header comment):
// both must resolve to the SAME module graph, or seeding this test's `ApiBase`
// registry would leave the picker's own `ApiBase` singleton unloaded — two
// singletons, not one — and every fetch inside `mountInto()` would see no
// registered base. `render.js` deliberately avoids the `@liturgical-calendar/
// components-js` package specifier (which resolves to `dist/`, absent on a clean
// checkout before the first `yarn compile`), so this test follows suit rather than
// reintroducing a `dist/` dependency through its own import instead.
import ApiBase from '../ApiClient/ApiBase.js';
import { render } from '../stories/1_CombinedComponents/CalendarResourcePicker.render.js';

// Imports `CalendarResourcePicker.render.js` rather than the sibling
// `CalendarResourcePicker.stories.js`: the story file imports
// `bootstrap/dist/css/bootstrap.min.css` at module scope for Storybook's benefit,
// and this project's `yarn test` has no CSS transform configured, so loading that
// file here would fail with a CSS parse error before a single test could run. The
// story's `render` is re-exported from, not duplicated in, the CSS-free module
// under test, so this exercises the exact function Storybook calls.

const METADATA = {
    locales: ['en', 'it'],
    national_calendars: [
        { calendar_id: 'IT', locales: ['it-IT'], settings: {} },
    ],
    diocesan_calendars: [
        {
            calendar_id: 'romamo_it',
            nation: 'IT',
            diocese: 'Diocesi di Roma',
            locales: ['it-IT'],
            rite: 'roman',
        },
    ],
    ambrosian_calendars: [],
};

const API_URL = 'http://localhost:8000';

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, METADATA);
});

describe('CalendarResourcePicker.render (Storybook)', () => {
    it('mounts a real picker containing a select', async () => {
        const mount = await render({ theme: undefined });
        expect(mount.querySelector('select')).not.toBeNull();
    });

    it('mounts the rite select too, since the story uses the diocesan filter', async () => {
        const mount = await render({ theme: undefined });
        expect(mount.querySelectorAll('select').length).toBe(2);
    });

    it('the Bootstrap and Unstyled args differ only by theme, and both render', async () => {
        const bootstrapMount = await render({
            theme: {
                select: 'form-select',
                label: 'form-label',
                riteSelect: { class: 'form-select mb-2' },
            },
        });
        const unstyledMount = await render({ theme: undefined });

        const bootstrapSelect = bootstrapMount.querySelector(
            'select:not([data-load-failed])',
        );
        const unstyledSelect = unstyledMount.querySelector(
            'select:not([data-load-failed])',
        );
        expect(bootstrapSelect.className).toContain('form-select');
        expect(unstyledSelect.className).toBe('');
    });

    it('leaves the mount detached from the document once rendering settles', async () => {
        const mount = await render({ theme: undefined });
        expect(mount.isConnected).toBe(false);
    });
});
