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
 * A response body carrying one real event.
 *
 * `WebCalendar` and `LiturgyOfAnyDay` both THROW on an empty `litcal[]` from
 * inside their `calendarFetched` listeners, which turns an otherwise successful
 * fetch into a REJECTED promise. A test meaning to exercise the success path of
 * a renderer-bearing component must therefore send an event, or it silently
 * measures the failure path instead. The same minimal event
 * `DayViewerMount.test.js` uses.
 *
 * @type {Object}
 */
const PAYLOAD_WITH_EVENT = {
    litcal: [
        {
            event_key: 'StJohnVianney',
            event_idx: 1,
            name: 'Saint John Mary Vianney, Priest',
            color: ['white'],
            color_lcl: ['white'],
            grade: 3,
            grade_lcl: 'Memorial',
            grade_abbr: 'M',
            grade_display: null,
            common: ['Pastors'],
            common_lcl: 'Pastors',
            type: 'fixed',
            date: '2026-06-15T00:00:00+00:00',
            year: 2026,
            month: 6,
            month_short: 'Jun.',
            month_long: 'June',
            day: 15,
            day_of_the_week_iso8601: 1,
            day_of_the_week_short: 'Mon',
            day_of_the_week_long: 'Monday',
            liturgical_year: null,
            is_vigil_mass: false,
            psalter_week: 2,
            liturgical_season: 'ORDINARY_TIME',
            liturgical_season_lcl: 'Ordinary Time',
            holy_day_of_obligation: false,
        },
    ],
    settings: { year: 2026, locale: 'en', year_type: 'CIVIL' },
    metadata: { version: 'test' },
    messages: [],
};

/** Mocks an immediately-successful response carrying one real event. */
const captureRequestsWithEvent = () => {
    const urls = [];
    global.fetch = jest.fn((url) => {
        urls.push(String(url));
        return Promise.resolve({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: () => Promise.resolve(PAYLOAD_WITH_EVENT),
        });
    });
    return urls;
};

/**
 * As {@link deferRequests}, but the held-open response carries one real event —
 * see {@link PAYLOAD_WITH_EVENT} for why a renderer-bearing component needs it.
 *
 * @returns {function(): void} Lands the response.
 */
const deferRequestsWithEvent = () => {
    let land;
    global.fetch = jest.fn(
        () =>
            new Promise((resolve) => {
                land = () =>
                    resolve({
                        ok: true,
                        status: 200,
                        headers: { get: () => 'application/json' },
                        json: () => Promise.resolve(PAYLOAD_WITH_EVENT),
                    });
            }),
    );
    return () => land();
};

/**
 * A fetch mock whose FAILING response lands only when the returned function is
 * called — `failRequests()`, held open, so "still pending" and "settled" can be
 * told apart on the failure path too.
 *
 * @returns {function(): void} Lands the failure.
 */
const deferFailure = () => {
    let land;
    global.fetch = jest.fn(
        () =>
            new Promise((resolve) => {
                land = () =>
                    resolve({
                        ok: false,
                        status: 503,
                        statusText: 'Service Unavailable',
                        headers: { get: () => 'text/plain' },
                        text: () => Promise.resolve('down'),
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

    it('is resolved on a hand-constructed instance that has not fetched', async () => {
        captureRequests();
        const controls = new CalendarControls({ locale: 'en' });

        // Nothing has been issued yet. Once the caller drives `fetch()`
        // themselves, this same property tracks THAT request — see the
        // constructor-path block below.
        await expect(controls.settled).resolves.toBeUndefined();
    });
});

/**
 * `settled` on the constructor path (#61).
 *
 * `mountInto()` publishes this signal because it drops the initial fetch's
 * promise. A hand-constructed instance holds its own promise from `fetch()`, so
 * `settled` is not the only way to sequence there — but a caller who reaches
 * `settled` should not have to know which construction path produced the
 * instance, which is the same reasoning that keeps the property on
 * `CalendarViewer` even though its factory already awaits the fetch.
 *
 * So `settled` means: the most recent fetch THIS COMPONENT issued —
 * `mountInto()`'s initial one, or the latest `fetch()` call. Every other clause
 * of the contract above is unchanged, and the tests below hold each of them to
 * that: it still never rejects, it is still already-resolved before anything is
 * issued, and the promise `fetch()` hands back is still the caller's, rejection
 * and all.
 *
 * Refetches driven by `ApiClient`'s own `listenTo()` change listeners are NOT
 * observed, on either path: those requests are issued inside `ApiClient` and the
 * meta-component never sees their promises.
 */
describe('settled tracks a constructor-path fetch()', () => {
    it('stays pending until CalendarControls’ own fetch() lands', async () => {
        const land = deferRequests();
        const apiClient = await ApiClient.init(API_URL);
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#mount');
        controls.listenTo(apiClient);

        // Nothing issued yet.
        await expect(controls.settled).resolves.toBeUndefined();

        const fetching = controls.fetch();
        let done = false;
        controls.settled.then(() => {
            done = true;
        });
        await drain();
        expect(done).toBe(false);

        land();
        await expect(controls.settled).resolves.toBeUndefined();
        await expect(fetching).resolves.toBeDefined();
    });

    it('stays pending until CalendarViewer’s own fetch() lands', async () => {
        const land = deferRequestsWithEvent();
        const apiClient = await ApiClient.init(API_URL);
        const viewer = new CalendarViewer({ locale: 'en' });
        viewer.appendTo({ controls: '#mount', calendar: '#calendar' });
        viewer.listenTo(apiClient);

        const fetching = viewer.fetch();
        let done = false;
        viewer.settled.then(() => {
            done = true;
        });
        await drain();
        expect(done).toBe(false);

        land();
        await expect(viewer.settled).resolves.toBeUndefined();
        await fetching;
    });

    it('stays pending until DayViewer’s own fetch() lands', async () => {
        const land = deferRequestsWithEvent();
        const apiClient = await ApiClient.init(API_URL);
        const viewer = new DayViewer({ locale: 'en' });
        viewer.appendTo('#mount');
        viewer.listenTo(apiClient);

        const fetching = viewer.fetch();
        let done = false;
        viewer.settled.then(() => {
            done = true;
        });
        await drain();
        expect(done).toBe(false);

        land();
        await expect(viewer.settled).resolves.toBeUndefined();
        await fetching;
    });

    it('still resolves when that fetch fails, while the returned promise rejects', async () => {
        const land = deferFailure();
        const apiClient = await ApiClient.init(API_URL);
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#mount');
        controls.listenTo(apiClient);

        // Deferred, so this measures the failure actually arriving. With an
        // immediate mock the assertion below would be satisfied by the
        // already-resolved promise the field is initialised with, whatever
        // `fetch()` did with it.
        const fetching = controls.fetch();
        // The caller's promise is theirs, and still rejects. Handled here so
        // the assertion below cannot pass by way of a swallowed rejection.
        const rejecting = expect(fetching).rejects.toThrow();
        let done = false;
        controls.settled.then(() => {
            done = true;
        });
        await drain();
        expect(done).toBe(false);

        land();
        await rejecting;
        await expect(controls.settled).resolves.toBeUndefined();
    });

    it('does not silence the unhandled rejection of the promise fetch() returns', async () => {
        // `settled` is derived when the getter is READ, never eagerly, because
        // rejection tracking is per promise object: attaching a handler to the
        // promise `fetch()` returns would mark that very object handled, and a
        // caller who ignores the result would silently lose the platform's
        // report. `fetch()`'s own contract — the library deliberately does NOT
        // log for it, because the caller holds it — depends on that report.
        failRequests();
        const apiClient = await ApiClient.init(API_URL);
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#mount');
        controls.listenTo(apiClient);

        const fetching = controls.fetch();
        // Nothing must have been attached to it by `fetch()` itself.
        await expect(fetching).rejects.toThrow();
    });

    it('is replaced by each further fetch(), so it tracks the latest one', async () => {
        let land = deferRequests();
        const apiClient = await ApiClient.init(API_URL);
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#mount');
        controls.listenTo(apiClient);

        const first = controls.fetch();
        land();
        await controls.settled;
        await first;

        // A second request, deliberately for a different year so the cache
        // cannot answer it synchronously and hide the point.
        land = deferRequests();
        apiClient.year(2030);
        const second = controls.fetch();
        let done = false;
        controls.settled.then(() => {
            done = true;
        });
        await drain();
        expect(done).toBe(false);

        land();
        await expect(controls.settled).resolves.toBeUndefined();
        await second;
    });

    it('is untouched when fetch() throws synchronously', async () => {
        captureRequests();
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#mount');

        // No client is wired, so no request was issued and there is nothing new
        // to settle.
        expect(() => controls.fetch()).toThrow(/no ApiClient is wired/);
        await expect(controls.settled).resolves.toBeUndefined();
    });

    it('resolves with undefined after a SUCCESSFUL mountInto fetch, not with the payload', async () => {
        // The contract says `undefined`, and says why: the data has a channel
        // already in `onCalendarFetched()`, and a second one would be free to
        // drift from it. `.catch( handler )` alone does not deliver that — it
        // passes a fulfilled value straight through — so on the success path
        // `settled` used to resolve with the whole calendar payload. Only the
        // FAILURE path was ever covered, which is how that survived.
        captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const controls = await CalendarControls.mountInto('#mount', {
            locale: 'en',
            apiClient,
        });

        await expect(controls.settled).resolves.toBeUndefined();
    });

    it('resolves with undefined after a successful CalendarViewer mount too', async () => {
        // A payload with an event, so `WebCalendar`'s listener accepts it and
        // this measures the SUCCESS path: with an empty `litcal[]` that listener
        // throws, the fetch rejects, and the assertion would pass by way of the
        // rejection handler no matter what the fulfilment handler did.
        captureRequestsWithEvent();
        const apiClient = await ApiClient.init(API_URL);
        const viewer = await CalendarViewer.mountInto(
            { controls: '#mount', calendar: '#calendar' },
            { locale: 'en', apiClient },
        );

        await expect(viewer.settled).resolves.toBeUndefined();
    });

    it('resolves with undefined after a successful DayViewer mount too', async () => {
        // The third of the three, and the one the first round of this work
        // missed: `LiturgyOfAnyDay` throws on an empty `litcal[]` exactly as
        // `WebCalendar` does, so without a real event this would measure the
        // failure path and pass however the fulfilment side behaved.
        captureRequestsWithEvent();
        const apiClient = await ApiClient.init(API_URL);
        const viewer = await DayViewer.mountInto('#mount', {
            locale: 'en',
            apiClient,
        });

        await expect(viewer.settled).resolves.toBeUndefined();
    });

    it('resolves only after onError has been delivered, on the constructor path', async () => {
        // The ordering the factory path gets from overwriting `#settled` with
        // its own error-delivering branch. On the constructor path it comes
        // from `ApiClient` itself, which emits `calendarFetchFailed` BEFORE
        // rejecting the promise — so the bus-bound `onError()` callback has
        // already run by the time anything derived from that promise resolves.
        failRequests();
        const apiClient = await ApiClient.init(API_URL);
        const seen = [];
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#mount');
        controls.listenTo(apiClient);
        controls.onError(() => seen.push('onError'));

        const fetching = controls.fetch();
        await expect(fetching).rejects.toThrow();
        await controls.settled;
        expect(seen).toEqual(['onError']);
    });

    it('resolves only after onError has been delivered, on DayViewer too', async () => {
        failRequests();
        const apiClient = await ApiClient.init(API_URL);
        const seen = [];
        const viewer = new DayViewer({ locale: 'en' });
        viewer.appendTo('#mount');
        viewer.listenTo(apiClient);
        viewer.onError(() => seen.push('onError'));

        const fetching = viewer.fetch();
        await expect(fetching).rejects.toThrow();
        await viewer.settled;
        expect(seen).toEqual(['onError']);
    });

    it('resolves even when an onError callback throws', async () => {
        // "Never rejects" has to survive a subscriber's own bug, not only a
        // failed request: the callbacks run inside the very rejection handler
        // the factory builds `#settled` from, so a throwing one used to make
        // `settled` itself reject — an unhandled rejection for every caller who
        // never reads it, which is the trap the contract exists to avoid.
        // Normalizing in the getter closes that structurally.
        failRequests();
        const apiClient = await ApiClient.init(API_URL);
        const controls = await CalendarControls.mountInto('#mount', {
            locale: 'en',
            apiClient,
            onError: () => {
                throw new Error('a subscriber’s own bug');
            },
        });

        await expect(controls.settled).resolves.toBeUndefined();
    });

    it('is still the factory’s error-delivering branch on the mountInto path', async () => {
        failRequests();
        const apiClient = await ApiClient.init(API_URL);
        const errors = [];
        const controls = await CalendarControls.mountInto('#mount', {
            locale: 'en',
            apiClient,
            onError: (error) => errors.push(error),
        });

        // `fetch()` stores its own swallowing branch, and the factory then
        // overwrites `#settled` with the branch that delivers to `onError()`.
        // If that ordering ever inverted, this could resolve before the callback
        // had run.
        await controls.settled;
        expect(errors).toHaveLength(1);
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
