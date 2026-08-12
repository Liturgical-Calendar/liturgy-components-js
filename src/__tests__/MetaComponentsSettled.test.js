/** @jest-environment jsdom */
/**
 * `mountInto()` performs an initial fetch and DROPS that promise: it resolves to
 * the component, not to the calendar data. A caller therefore had no way to
 * sequence on that first fetch — not to hide a spinner, not to assert in a test,
 * not to know it had finished at all. `onCalendarFetched()` and `onError()`
 * between them observe everything except *when the first fetch settled*, and the
 * only approximation available was `await new Promise( r => setTimeout( r, 0 ) )`,
 * which this repo's own mount tests used eleven times.
 *
 * `settled` is that missing signal. Its contract, and the reasoning behind each
 * clause:
 *
 *   - It **always resolves, never rejects.** A property present on every mounted
 *     instance that could reject would produce an unhandled rejection for every
 *     caller who never touches it — precisely the trap `mountInto()` avoids today
 *     by discarding. The promise captured is the one AFTER the existing `.catch`,
 *     so resolve-always comes for free rather than being bolted on.
 *   - It resolves to **`undefined`**. The data has a channel already in
 *     `onCalendarFetched()`; a second one would drift from it.
 *   - It is **always a promise**, already-resolved when no initial fetch was
 *     performed — `initialFetch: false`, no `apiClient`, or a hand-constructed
 *     instance. "Nothing pending" is the honest reading, and an absent property
 *     would break `.then()` and force callers to feature-detect.
 *   - Only the three components that fetch have it. `CalendarResourcePicker` and
 *     `ApiExplorer` never fetch, so there is nothing for them to settle.
 *
 * Success and failure remain the business of `onError()`, which since #44 also
 * reports failures raised before a request is issued. `settled` answers "has it
 * finished", never "did it work".
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import CalendarControls from '../MetaComponents/CalendarControls.js';
import CalendarViewer from '../MetaComponents/CalendarViewer.js';
import DayViewer from '../MetaComponents/DayViewer.js';
import CalendarResourcePicker from '../MetaComponents/CalendarResourcePicker.js';
import ApiExplorer from '../MetaComponents/ApiExplorer.js';
import { CalendarSelectFilter } from '../Enums.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

/** Mocks a successful calendar response and records the request URLs. */
const captureRequests = () => {
    const urls = [];
    global.fetch = jest.fn((url) => {
        urls.push(String(url));
        return Promise.resolve({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: () =>
                Promise.resolve({
                    litcal: [],
                    settings: {},
                    metadata: {},
                    messages: [],
                }),
        });
    });
    return urls;
};

/** Mocks a calendar endpoint that is down. */
const failRequests = () => {
    global.fetch = jest.fn(() =>
        Promise.resolve({
            ok: false,
            status: 503,
            statusText: 'Service Unavailable',
            headers: { get: () => 'text/plain' },
            text: () => Promise.resolve('down'),
        }),
    );
};

/**
 * A fetch mock whose response lands only when the returned function is called.
 *
 * "Still pending" and "already settled" must not be separated by mere microtask
 * depth — with an immediately-resolving mock they differ by a hop or two, and a
 * test measuring that would assert on the shape of the promise chain rather than
 * on behaviour. Holding the response open makes the distinction unambiguous.
 *
 * @returns {function(): void} Lands the response.
 */
const deferRequests = () => {
    let land;
    global.fetch = jest.fn(
        () =>
            new Promise((resolve) => {
                land = () =>
                    resolve({
                        ok: true,
                        status: 200,
                        headers: { get: () => 'application/json' },
                        json: () =>
                            Promise.resolve({
                                litcal: [],
                                settings: {},
                                metadata: {},
                                messages: [],
                            }),
                    });
            }),
    );
    return () => land();
};

/**
 * Drains the microtask queue without letting a macrotask through, so anything
 * still waiting on a held-open response stays unsettled.
 *
 * @returns {Promise<void>} Resolves once the queue is drained.
 */
const drain = async () => {
    for (let i = 0; i < 20; i += 1) {
        await Promise.resolve();
    }
};

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.replaceChildren();
    for (const id of ['mount', 'messages', 'calendar', 'pb']) {
        const element = document.createElement('div');
        element.id = id;
        document.body.appendChild(element);
    }
});

describe('settled reports when the initial fetch finished', () => {
    it('stays pending until CalendarControls’ initial fetch completes', async () => {
        const land = deferRequests();
        const apiClient = await ApiClient.init(API_URL);
        const fetched = [];
        const controls = await CalendarControls.mountInto('#mount', {
            locale: 'en',
            apiClient,
        });
        controls.onCalendarFetched(() => fetched.push(true));

        let done = false;
        controls.settled.then(() => {
            done = true;
        });

        // `CalendarControls.mountInto()` resolves without awaiting the fetch, so
        // the request is still in flight here. That is the documented behaviour,
        // and exactly why this signal is needed.
        await drain();
        expect(done).toBe(false);
        expect(fetched).toHaveLength(0);

        land();
        await controls.settled;
        expect(done).toBe(true);
        expect(fetched).toHaveLength(1);
    });

    it('stays pending until DayViewer’s initial fetch completes', async () => {
        const land = deferRequests();
        const apiClient = await ApiClient.init(API_URL);
        const viewer = await DayViewer.mountInto('#mount', {
            locale: 'en',
            apiClient,
        });

        let done = false;
        viewer.settled.then(() => {
            done = true;
        });
        await drain();
        expect(done).toBe(false);

        land();
        await expect(viewer.settled).resolves.toBeUndefined();
    });

    it('is the very promise CalendarViewer.mountInto awaits', async () => {
        const land = deferRequests();
        const apiClient = await ApiClient.init(API_URL);

        // Unlike the other two, this factory awaits its own initial fetch before
        // resolving — deliberately, because a viewer's reason to exist is its
        // populated table. So `mountInto()` itself must still be pending here...
        let mounted = false;
        const mounting = CalendarViewer.mountInto(
            { controls: '#mount', calendar: '#calendar' },
            { locale: 'en', apiClient },
        ).then((instance) => {
            mounted = true;
            return instance;
        });
        await drain();
        expect(mounted).toBe(false);

        land();
        const viewer = await mounting;

        // ...and `settled` must agree with that rather than contradict it: it is
        // the same promise, so by now it has already settled.
        let done = false;
        viewer.settled.then(() => {
            done = true;
        });
        await drain();
        expect(done).toBe(true);
    });
});

describe('settled never rejects', () => {
    it('resolves even when the initial fetch fails, and onError still fires', async () => {
        failRequests();
        const apiClient = await ApiClient.init(API_URL);
        const errors = [];
        const controls = await CalendarControls.mountInto('#mount', {
            locale: 'en',
            apiClient,
            onError: (error) => errors.push(error),
        });

        // A rejection here would be an unhandled rejection for every caller who
        // never reads the property.
        await expect(controls.settled).resolves.toBeUndefined();
        expect(errors).toHaveLength(1);
    });
});

describe('settled is already resolved when no initial fetch ran', () => {
    // With no request in flight there is nothing that could settle the promise
    // later, so awaiting it is the whole assertion: it resolves, and the paired
    // check confirms no calendar request was made to resolve it.
    it('is resolved when initialFetch is false', async () => {
        const urls = captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const controls = await CalendarControls.mountInto('#mount', {
            locale: 'en',
            apiClient,
            initialFetch: false,
        });

        await expect(controls.settled).resolves.toBeUndefined();
        expect(urls.some((url) => url.includes('/calendar/'))).toBe(false);
    });

    it('is resolved when no apiClient was supplied', async () => {
        const urls = captureRequests();
        const controls = await CalendarControls.mountInto('#mount', {
            locale: 'en',
        });

        await expect(controls.settled).resolves.toBeUndefined();
        expect(urls.some((url) => url.includes('/calendar/'))).toBe(false);
    });

    it('is resolved on a hand-constructed instance', async () => {
        captureRequests();
        const controls = new CalendarControls({ locale: 'en' });

        // The library performed no initial fetch here; the caller drives it with
        // `fetch()`, whose promise they already hold.
        await expect(controls.settled).resolves.toBeUndefined();
    });
});

describe('settled exists only where there is a fetch to settle', () => {
    it('is absent from CalendarResourcePicker and ApiExplorer', async () => {
        captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const picker = await CalendarResourcePicker.mountInto('#mount', {
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        const explorer = await ApiExplorer.mountInto(
            { pathBuilder: '#pb' },
            { locale: 'en', apiClient },
        );

        // Neither ever fetches: the picker is a form field, and the explorer
        // composes request URLs rather than issuing them.
        expect(picker.settled).toBeUndefined();
        expect(explorer.settled).toBeUndefined();
    });
});

describe('settled honours the disposal guard', () => {
    it('throws once the component has been disposed', async () => {
        captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const controls = await CalendarControls.mountInto('#mount', {
            locale: 'en',
            apiClient,
        });
        await controls.settled;
        controls.dispose();

        expect(() => controls.settled).toThrow(/disposed/);
    });
});
