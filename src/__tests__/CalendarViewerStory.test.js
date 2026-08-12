/** @jest-environment jsdom */
import { describe, it, expect, beforeEach } from '@jest/globals';
// `ApiBase` is imported from the relative `src/` path, matching
// `CalendarViewer.render.js`'s own imports (see that file's header comment): both must
// resolve to the SAME module graph, or seeding this test's `ApiBase` registry would
// leave the viewer's own `ApiBase` singleton unloaded — two singletons, not one —
// and `CalendarViewer.mountInto()` would find no registered base. `render.js`
// deliberately avoids the `@liturgical-calendar/components-js` package specifier
// (which resolves to `dist/`, absent on a clean checkout before the first `yarn
// compile`), so this test follows suit rather than reintroducing a `dist/`
// dependency through its own import instead.
import ApiBase from '../ApiClient/ApiBase.js';
import { render } from '../stories/1_CombinedComponents/CalendarViewer.render.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

// Imports `CalendarViewer.render.js` rather than the sibling
// `CalendarViewer.stories.js`: the story file imports
// `bootstrap/dist/css/bootstrap.min.css` at module scope for Storybook's benefit,
// and this project's `yarn test` has no CSS transform configured, so loading that
// file here would fail with a CSS parse error before a single test could run. The
// story's `render` is re-exported from, not duplicated in, the CSS-free module
// under test, so this exercises the exact function Storybook calls.

const API_URL = 'http://localhost:8000';

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
});

describe('CalendarViewer.render (Storybook)', () => {
    it('mounts a real viewer containing its rite and calendar selects', async () => {
        const mount = await render({ theme: undefined });
        expect(mount.querySelectorAll('select').length).toBeGreaterThanOrEqual(
            2,
        );
    });

    it('the Bootstrap and Unstyled args differ only by theme, and both render', async () => {
        const bootstrapMount = await render({
            theme: {
                select: 'form-select',
                label: 'form-label d-block mb-1',
                riteSelect: { class: 'form-select mb-2' },
            },
        });
        const unstyledMount = await render({ theme: undefined });

        const bootstrapSelect = bootstrapMount.querySelector('select');
        const unstyledSelect = unstyledMount.querySelector('select');
        expect(bootstrapSelect.className).toContain('form-select');
        expect(unstyledSelect.className).toBe('');
    });

    it('leaves the mount detached from the document once rendering settles', async () => {
        const mount = await render({ theme: undefined });
        expect(mount.isConnected).toBe(false);
    });
});
