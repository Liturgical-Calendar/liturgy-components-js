/** @jest-environment jsdom */
/**
 * The `inputs` bag, and specifically `inputs: { acceptHeader: false }`.
 *
 * `AcceptHeaderInput.hide()` sets a flag `ApiOptions.appendTo()` reads, so it is
 * only meaningful between construction and the append — a window `mountInto()`
 * does not open. One boolean toggle therefore cost a caller the whole factory
 * path, and with it `settled` (#61). These tests pin the option down on both
 * construction paths, and pin the DEFAULT down too: the accept-header input is
 * still rendered wherever it is rendered today, `ApiExplorer` above all, because
 * `PathBuilder` listens to that select's `change` to compose `return_type` into
 * the URL it renders.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import CalendarControls from '../MetaComponents/CalendarControls.js';
import CalendarViewer from '../MetaComponents/CalendarViewer.js';
import ApiExplorer from '../MetaComponents/ApiExplorer.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

/** @returns {HTMLSelectElement|null} The accept-header select inside `element`. */
const acceptHeaderIn = (element) =>
    element.querySelector('select[name="return_type"]');

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    global.fetch = jest.fn(() =>
        Promise.reject(new Error('no request expected in these tests')),
    );
    document.body.replaceChildren();
    for (const id of ['mount', 'calendar', 'pb', 'all']) {
        const element = document.createElement('div');
        element.id = id;
        document.body.appendChild(element);
    }
});

describe('CalendarControls and the inputs bag', () => {
    it('renders the accept-header input by default', async () => {
        const controls = await CalendarControls.mountInto('#mount', {
            locale: 'en',
        });

        expect(acceptHeaderIn(document.getElementById('mount'))).not.toBeNull();
        controls.dispose();
    });

    it('omits it when mountInto is given inputs: { acceptHeader: false }', async () => {
        const controls = await CalendarControls.mountInto('#mount', {
            locale: 'en',
            inputs: { acceptHeader: false },
        });

        expect(acceptHeaderIn(document.getElementById('mount'))).toBeNull();
        controls.dispose();
    });

    it('omits it on the constructor path too', () => {
        const controls = new CalendarControls({
            locale: 'en',
            inputs: { acceptHeader: false },
        });
        controls.appendTo('#mount');

        expect(acceptHeaderIn(document.getElementById('mount'))).toBeNull();
        controls.dispose();
    });

    it('renders it when acceptHeader is explicitly true', async () => {
        const controls = await CalendarControls.mountInto('#mount', {
            locale: 'en',
            inputs: { acceptHeader: true },
        });

        expect(acceptHeaderIn(document.getElementById('mount'))).not.toBeNull();
        controls.dispose();
    });
});

describe('CalendarViewer forwards the inputs bag', () => {
    it('omits the accept-header input when asked to', async () => {
        const viewer = await CalendarViewer.mountInto(
            { controls: '#mount', calendar: '#calendar' },
            { locale: 'en', inputs: { acceptHeader: false } },
        );

        expect(acceptHeaderIn(document.getElementById('mount'))).toBeNull();
        viewer.dispose();
    });

    it('renders it by default', async () => {
        const viewer = await CalendarViewer.mountInto(
            { controls: '#mount', calendar: '#calendar' },
            { locale: 'en' },
        );

        expect(acceptHeaderIn(document.getElementById('mount'))).not.toBeNull();
        viewer.dispose();
    });
});

describe('ApiExplorer keeps the accept-header input by default', () => {
    // `ApiExplorer`'s `allPaths` slot appends under `ApiOptionsFilter.ALL_PATHS`,
    // which is the same value as `ALL_CALENDARS` and is one of the two filters
    // that render this input. It is part of the path-building UI — `PathBuilder`
    // turns its `change` into the URL's `return_type` — so the default here is a
    // regression guard, not merely a default.
    it('renders it in the allPaths slot with no inputs bag', async () => {
        const explorer = await ApiExplorer.mountInto(
            { pathBuilder: '#pb', allPaths: '#all' },
            { locale: 'en' },
        );

        expect(acceptHeaderIn(document.getElementById('all'))).not.toBeNull();
        explorer.dispose();
    });

    it('omits it when the caller asks for that', async () => {
        const explorer = await ApiExplorer.mountInto(
            { pathBuilder: '#pb', allPaths: '#all' },
            { locale: 'en', inputs: { acceptHeader: false } },
        );

        expect(acceptHeaderIn(document.getElementById('all'))).toBeNull();
        explorer.dispose();
    });
});

describe('an invalid inputs bag is programmer error', () => {
    it('rejects an unknown key by name, having mounted nothing', async () => {
        await expect(
            CalendarControls.mountInto('#mount', {
                locale: 'en',
                inputs: { acceptHeder: false },
            }),
        ).rejects.toThrow('unknown inputs option `acceptHeder`');

        expect(document.getElementById('mount').children).toHaveLength(0);
    });

    it('rejects a non-boolean value', async () => {
        await expect(
            CalendarControls.mountInto('#mount', {
                locale: 'en',
                inputs: { acceptHeader: 'hidden' },
            }),
        ).rejects.toThrow(/inputs\.acceptHeader.*found type: string/);
    });

    it('rejects a bag that is not an object', async () => {
        await expect(
            CalendarViewer.mountInto(
                { controls: '#mount', calendar: '#calendar' },
                { locale: 'en', inputs: 'acceptHeader' },
            ),
        ).rejects.toThrow(/inputs must be an object.*found type: string/);
    });

    it('rejects through ApiExplorer too', async () => {
        await expect(
            ApiExplorer.mountInto(
                { pathBuilder: '#pb' },
                { locale: 'en', inputs: { nope: true } },
            ),
        ).rejects.toThrow('unknown inputs option `nope`');
    });
});
