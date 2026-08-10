import {
    describe,
    it,
    expect,
    beforeEach,
    afterEach,
    jest,
} from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClientError from '../ApiClient/ApiClientError.js';
import { FULL_METADATA, OTHER_METADATA } from '../__fixtures__/metadata.js';

const okResponse = (metadata) => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve({ litcal_metadata: metadata }),
});

beforeEach(() => {
    ApiBase.reset();
});

afterEach(() => {
    delete global.fetch;
});

describe('ApiBase.normalizeUrl', () => {
    it('strips trailing slashes', () => {
        expect(ApiBase.normalizeUrl('http://localhost:8000/')).toBe(
            'http://localhost:8000',
        );
        expect(ApiBase.normalizeUrl('http://localhost:8000///')).toBe(
            'http://localhost:8000',
        );
    });

    it('leaves protocol, host, port and path untouched', () => {
        expect(ApiBase.normalizeUrl('https://example.org/api/dev')).toBe(
            'https://example.org/api/dev',
        );
    });

    it('treats hosts that merely resolve alike as distinct', () => {
        expect(ApiBase.normalizeUrl('http://localhost:8000')).not.toBe(
            ApiBase.normalizeUrl('http://127.0.0.1:8000'),
        );
    });

    it('rejects a non-string or empty url', () => {
        expect(() => ApiBase.normalizeUrl(null)).toThrow(/non-empty string/);
        expect(() => ApiBase.normalizeUrl('   ')).toThrow(/non-empty string/);
    });

    it('accepts an absolute http or https url, with or without a port or path', () => {
        expect(ApiBase.normalizeUrl('http://localhost:8000')).toBe(
            'http://localhost:8000',
        );
        expect(ApiBase.normalizeUrl('https://example.org')).toBe(
            'https://example.org',
        );
        expect(ApiBase.normalizeUrl('https://example.org/api/dev')).toBe(
            'https://example.org/api/dev',
        );
        expect(ApiBase.normalizeUrl('http://127.0.0.1:8000/api')).toBe(
            'http://127.0.0.1:8000/api',
        );
        expect(ApiBase.normalizeUrl('  https://example.org/api/dev/  ')).toBe(
            'https://example.org/api/dev',
        );
    });

    it('rejects a scheme that is not http or https, naming the scheme found', () => {
        expect(() => ApiBase.normalizeUrl('javascript:alert(1)')).toThrow(
            /javascript:/,
        );
        expect(() => ApiBase.normalizeUrl('javascript:alert(1)')).toThrow(
            /absolute http: or https: URL/,
        );
        expect(() => ApiBase.normalizeUrl('data:text/html,x')).toThrow(/data:/);
        expect(() => ApiBase.normalizeUrl('ftp://example.org/api')).toThrow(
            /ftp:/,
        );
        expect(() => ApiBase.normalizeUrl('file:///etc/passwd')).toThrow(
            /file:/,
        );
        expect(() => ApiBase.normalizeUrl('ws://example.org/api')).toThrow(
            /ws:/,
        );
        expect(() =>
            ApiBase.normalizeUrl('mailto:someone@example.org'),
        ).toThrow(/mailto:/);
    });

    it('does not mistake a non-http scheme for an omitted one', () => {
        // `javascript:` and friends must not be told to write `http://javascript:…`:
        // the caller chose a scheme, they did not forget one.
        expect(() => ApiBase.normalizeUrl('javascript:alert(1)')).not.toThrow(
            /Did you mean/,
        );
        expect(() => ApiBase.normalizeUrl('ftp://example.org/api')).not.toThrow(
            /Did you mean/,
        );
    });

    it('rejects a scheme-less host:port, suggesting the http:// form', () => {
        expect(() => ApiBase.normalizeUrl('localhost:8000')).toThrow(
            /Did you mean http:\/\/localhost:8000\?/,
        );
        // The value the caller passed is named, so the message is actionable in a log.
        expect(() => ApiBase.normalizeUrl('localhost:8000')).toThrow(
            /localhost:8000/,
        );
        expect(() => ApiBase.normalizeUrl('localhost:8000/')).toThrow(
            /Did you mean http:\/\/localhost:8000\?/,
        );
        expect(() => ApiBase.normalizeUrl('example.org:8000/api')).toThrow(
            /Did you mean http:\/\/example\.org:8000\/api\?/,
        );
    });

    it('rejects a scheme-less host, suggesting the http:// form', () => {
        expect(() => ApiBase.normalizeUrl('example.org/api/dev')).toThrow(
            /Did you mean http:\/\/example\.org\/api\/dev\?/,
        );
    });

    it('rejects a protocol-relative url, suggesting the http:// form', () => {
        expect(() => ApiBase.normalizeUrl('//example.org/api')).toThrow(
            /Did you mean http:\/\/example\.org\/api\?/,
        );
    });

    it('rejects a same-origin relative path', () => {
        // Relative bases are not supported: `${url}/calendars` would resolve against
        // the document and 404 silently. A same-origin deployment passes an absolute URL.
        expect(() => ApiBase.normalizeUrl('/api')).toThrow(
            /absolute http: or https: URL/,
        );
        expect(() => ApiBase.normalizeUrl('/api')).not.toThrow(/Did you mean/);
    });

    it('rejects a url that normalizes away to nothing', () => {
        // `'///'` trimmed and stripped of trailing slashes is `''`, which used to be
        // registered as a base whose load() fetched a relative `/calendars`.
        expect(() => ApiBase.normalizeUrl('///')).toThrow(
            /absolute http: or https: URL/,
        );
    });

    it('rejects a string that is not a url at all', () => {
        expect(() => ApiBase.normalizeUrl('not a url')).toThrow(
            /absolute http: or https: URL/,
        );
    });

    it('refuses to register a base for a url it rejects', () => {
        expect(() => ApiBase.resolve('localhost:8000')).toThrow(/Did you mean/);
        expect(() => ApiBase.fromMetadata('///', FULL_METADATA)).toThrow(
            /absolute http: or https: URL/,
        );
        expect(ApiBase.all).toHaveLength(0);
    });
});

describe('ApiBase registry', () => {
    it('returns the same instance for urls differing only by trailing slash', () => {
        expect(ApiBase.resolve('http://localhost:8000')).toBe(
            ApiBase.resolve('http://localhost:8000/'),
        );
    });

    it('returns different instances for different urls', () => {
        expect(ApiBase.resolve('http://localhost:8000')).not.toBe(
            ApiBase.resolve('https://example.org/api/dev'),
        );
    });

    it('does not fetch when resolving', () => {
        global.fetch = jest.fn();
        ApiBase.resolve('http://localhost:8000');
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('reports the first registered base as the default', () => {
        const first = ApiBase.resolve('http://localhost:8000');
        ApiBase.resolve('https://example.org/api/dev');
        expect(ApiBase.default).toBe(first);
    });

    it('reports null as the default when nothing is registered', () => {
        expect(ApiBase.default).toBeNull();
    });

    it('lists every base in registration order', () => {
        ApiBase.resolve('http://localhost:8000');
        ApiBase.resolve('https://example.org/api/dev');
        expect(ApiBase.all.map((base) => base.url)).toEqual([
            'http://localhost:8000',
            'https://example.org/api/dev',
        ]);
    });

    it('clears the registry on reset', () => {
        ApiBase.resolve('http://localhost:8000');
        ApiBase.reset();
        expect(ApiBase.all).toEqual([]);
        expect(ApiBase.default).toBeNull();
    });
});

describe('ApiBase.fromMetadata', () => {
    it('produces a loaded base with no network call', () => {
        global.fetch = jest.fn();
        const base = ApiBase.fromMetadata(
            'http://localhost:8000',
            FULL_METADATA,
        );
        expect(base.isLoaded).toBe(true);
        expect(base.metadata).toBe(FULL_METADATA);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('registers the base so resolve returns it', () => {
        const base = ApiBase.fromMetadata(
            'http://localhost:8000',
            FULL_METADATA,
        );
        expect(ApiBase.resolve('http://localhost:8000')).toBe(base);
    });

    it('returns the same object when the same url is installed twice', () => {
        const first = ApiBase.fromMetadata(
            'http://localhost:8000',
            FULL_METADATA,
        );
        const second = ApiBase.fromMetadata(
            'http://localhost:8000',
            OTHER_METADATA,
        );
        expect(second).toBe(first);
        expect(ApiBase.all).toHaveLength(1);
    });

    it('installs the new index onto the base already registered', () => {
        const first = ApiBase.fromMetadata(
            'http://localhost:8000',
            FULL_METADATA,
        );
        ApiBase.fromMetadata('http://localhost:8000', OTHER_METADATA);
        expect(first.metadata).toBe(OTHER_METADATA);
        expect(ApiBase.resolve('http://localhost:8000').metadata).toBe(
            OTHER_METADATA,
        );
    });

    it('empties the response cache of the base it re-installs', () => {
        const base = ApiBase.fromMetadata(
            'http://localhost:8000',
            FULL_METADATA,
        );
        base.setCached('a-cache-key', { litcal: [] });
        expect(base.getCached('a-cache-key')).not.toBeNull();
        ApiBase.fromMetadata('http://localhost:8000', OTHER_METADATA);
        expect(base.getCached('a-cache-key')).toBeNull();
    });

    it('hydrates a base that was resolved but never loaded', () => {
        const resolved = ApiBase.resolve('http://localhost:8000');
        expect(resolved.isLoaded).toBe(false);
        const hydrated = ApiBase.fromMetadata(
            'http://localhost:8000',
            FULL_METADATA,
        );
        expect(hydrated).toBe(resolved);
        expect(resolved.isLoaded).toBe(true);
        expect(resolved.metadata).toBe(FULL_METADATA);
    });
});

/**
 * With the registry replacing objects, a `load()` in flight belonged to the base
 * being orphaned and could not reach a fixture installed meanwhile. Hydrating in
 * place puts both writes on one object, and the fetch lands second — so the rule
 * has to be stated rather than inherited: an explicit install outranks a
 * background fetch.
 */
describe('ApiBase.load yields to an index installed while it was in flight', () => {
    /** Resolves the pending `fetch` on demand, so the fixture can land mid-request. */
    const deferredFetch = () => {
        let settle;
        global.fetch = jest.fn(
            () =>
                new Promise((resolve) => {
                    settle = resolve;
                }),
        );
        return (response) => settle(response);
    };

    /** Rejects the pending `fetch` on demand, so a network error can land mid-request. */
    const deferredFetchFailure = () => {
        let fail;
        global.fetch = jest.fn(
            () =>
                new Promise((resolve, reject) => {
                    fail = reject;
                }),
        );
        return (error) => fail(error);
    };

    it('keeps the installed index rather than the fetched one', async () => {
        const respondWith = deferredFetch();
        const base = ApiBase.resolve('http://localhost:8000');
        const loading = base.load();

        ApiBase.fromMetadata('http://localhost:8000', FULL_METADATA);
        respondWith(okResponse(OTHER_METADATA));

        await expect(loading).resolves.toBe(base);
        expect(base.metadata).toBe(FULL_METADATA);
    });

    it('resolves rather than rejecting when the overtaken response is unusable', async () => {
        const { national_calendars, ...NO_NATIONS } = FULL_METADATA;
        const respondWith = deferredFetch();
        const base = ApiBase.resolve('http://localhost:8000');
        const loading = base.load();

        ApiBase.fromMetadata('http://localhost:8000', FULL_METADATA);
        respondWith(okResponse(NO_NATIONS));

        await expect(loading).resolves.toBe(base);
        expect(base.metadata).toBe(FULL_METADATA);
    });

    it('lets a later load resolve from the installed index without refetching', async () => {
        const respondWith = deferredFetch();
        const base = ApiBase.resolve('http://localhost:8000');
        const loading = base.load();

        ApiBase.fromMetadata('http://localhost:8000', FULL_METADATA);
        respondWith(okResponse(OTHER_METADATA));
        await loading;

        expect(base.metadata).toBe(FULL_METADATA);
        await expect(base.load()).resolves.toBe(base);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('keeps the installed index when the overtaken request comes back with a non-ok response', async () => {
        const respondWith = deferredFetch();
        const base = ApiBase.resolve('http://localhost:8000');
        const loading = base.load();

        ApiBase.fromMetadata('http://localhost:8000', FULL_METADATA);
        respondWith({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            text: () => Promise.resolve('boom'),
        });

        await expect(loading).resolves.toBe(base);
        expect(base.metadata).toBe(FULL_METADATA);
        await expect(base.load()).resolves.toBe(base);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('keeps the installed index when the overtaken request throws a network error', async () => {
        const fail = deferredFetchFailure();
        const base = ApiBase.resolve('http://localhost:8000');
        const loading = base.load();

        ApiBase.fromMetadata('http://localhost:8000', FULL_METADATA);
        fail(new TypeError('network error'));

        await expect(loading).resolves.toBe(base);
        expect(base.metadata).toBe(FULL_METADATA);
    });
});

/**
 * An index missing these fields used to be caught by `CalendarSelect.#init()`.
 * With per-base binding that method is gone, so the check belongs here, where
 * every component benefits from it: unvalidated, an incomplete index surfaces
 * far from its cause as a bare `TypeError` naming neither the field nor the API.
 * `fromMetadata` is validated as well as `load`, because it is how the whole
 * test suite builds its fixtures.
 */
describe('ApiBase rejects an unusable calendar index', () => {
    const { national_calendars, ...NO_NATIONS } = FULL_METADATA;
    const { diocesan_calendars, ...NO_DIOCESES } = FULL_METADATA;
    const { locales, ...NO_LOCALES } = FULL_METADATA;

    it('rejects metadata with no national_calendars from fromMetadata', () => {
        expect(() =>
            ApiBase.fromMetadata('http://localhost:8000', NO_NATIONS),
        ).toThrow(/national_calendars/);
    });

    it('rejects metadata with no diocesan_calendars from fromMetadata', () => {
        expect(() =>
            ApiBase.fromMetadata('http://localhost:8000', NO_DIOCESES),
        ).toThrow(/diocesan_calendars/);
    });

    /**
     * `locales` is required for the same reason as the other two, but it fails on
     * the request path rather than at construction: `ApiClient.fetchCalendar`
     * calls `this.#base.locales().includes( … )`, so an index without it produces
     * a bare `TypeError: Cannot read properties of undefined (reading 'includes')`
     * — exactly the failure mode this validation exists to prevent.
     */
    it('rejects metadata with no locales from fromMetadata', () => {
        expect(() =>
            ApiBase.fromMetadata('http://localhost:8000', NO_LOCALES),
        ).toThrow(/locales/);
    });

    it('rejects metadata with no locales from load, as an ApiClientError', async () => {
        global.fetch = jest.fn().mockResolvedValue(okResponse(NO_LOCALES));
        const base = ApiBase.resolve('http://localhost:8000');
        await expect(base.load()).rejects.toBeInstanceOf(ApiClientError);
        await expect(base.load()).rejects.toThrow(/locales/);
        expect(base.isLoaded).toBe(false);
    });

    it('names the base url in the message', () => {
        expect(() =>
            ApiBase.fromMetadata('http://localhost:8000', NO_NATIONS),
        ).toThrow(/http:\/\/localhost:8000/);
    });

    it('rejects metadata that is not an object', () => {
        expect(() =>
            ApiBase.fromMetadata('http://localhost:8000', null),
        ).toThrow(/must be an object/);
        expect(() =>
            ApiBase.fromMetadata('http://localhost:8000', 'nope'),
        ).toThrow(/must be an object/);
        expect(() => ApiBase.fromMetadata('http://localhost:8000', [])).toThrow(
            /must be an object/,
        );
    });

    it('registers nothing when it rejects', () => {
        expect(() =>
            ApiBase.fromMetadata('http://localhost:8000', NO_NATIONS),
        ).toThrow();
        expect(ApiBase.all).toHaveLength(0);
    });

    /**
     * The sibling of the test above, and new with hydration in place: validating
     * before `resolve()` is what keeps a rejected call from half-hydrating a base
     * that was already registered and loaded.
     */
    it('leaves an already registered base untouched when it rejects', () => {
        const base = ApiBase.fromMetadata(
            'http://localhost:8000',
            FULL_METADATA,
        );
        expect(() =>
            ApiBase.fromMetadata('http://localhost:8000', NO_NATIONS),
        ).toThrow(/national_calendars/);
        expect(base.metadata).toBe(FULL_METADATA);
        expect(ApiBase.resolve('http://localhost:8000')).toBe(base);
        expect(ApiBase.all).toHaveLength(1);
    });

    it('rejects an incomplete index from load, as an ApiClientError', async () => {
        global.fetch = jest.fn().mockResolvedValue(okResponse(NO_NATIONS));
        const base = ApiBase.resolve('http://localhost:8000');
        await expect(base.load()).rejects.toBeInstanceOf(ApiClientError);
        await expect(base.load()).rejects.toThrow(/national_calendars/);
    });

    it('leaves the base unloaded when load rejects an incomplete index', async () => {
        global.fetch = jest.fn().mockResolvedValue(okResponse(NO_DIOCESES));
        const base = ApiBase.resolve('http://localhost:8000');
        await expect(base.load()).rejects.toThrow(/diocesan_calendars/);
        expect(base.isLoaded).toBe(false);
    });
});

/**
 * Presence is not enough. An index carrying `locales: {}` satisfies a presence
 * test and then fails one step further down, on the request path, as the same
 * anonymous `TypeError` the presence check was written to prevent — from
 * `ApiClient.fetchCalendar`, which calls `this.#base.locales().includes( … )`.
 * The other two are iterated just as unconditionally. Both entry points are
 * covered for each field, because `fromMetadata` is how the suite builds every
 * fixture while `load` is how a live API delivers one.
 */
describe('ApiBase rejects a calendar index whose required fields are not arrays', () => {
    const NOT_ARRAYS = { object: {}, null: null, string: 'nope', number: 3 };

    ['national_calendars', 'diocesan_calendars', 'locales'].forEach((field) => {
        it(`rejects a non-array \`${field}\` from fromMetadata`, () => {
            Object.values(NOT_ARRAYS).forEach((value) => {
                expect(() =>
                    ApiBase.fromMetadata('http://localhost:8000', {
                        ...FULL_METADATA,
                        [field]: value,
                    }),
                ).toThrow(new RegExp(`\`${field}\`.+must be an array`));
            });
            expect(ApiBase.all).toHaveLength(0);
        });

        it(`rejects a non-array \`${field}\` from load, as an ApiClientError`, async () => {
            global.fetch = jest
                .fn()
                .mockResolvedValue(
                    okResponse({ ...FULL_METADATA, [field]: {} }),
                );
            const base = ApiBase.resolve('http://localhost:8000');
            await expect(base.load()).rejects.toBeInstanceOf(ApiClientError);
            await expect(base.load()).rejects.toThrow(
                new RegExp(`\`${field}\`.+must be an array`),
            );
            expect(base.isLoaded).toBe(false);
        });
    });

    it('names the base url and the type actually found', () => {
        expect(() =>
            ApiBase.fromMetadata('http://localhost:8000', {
                ...FULL_METADATA,
                locales: {},
            }),
        ).toThrow(/http:\/\/localhost:8000/);
        expect(() =>
            ApiBase.fromMetadata('http://localhost:8000', {
                ...FULL_METADATA,
                locales: {},
            }),
        ).toThrow(/but found: Object/);
        expect(() =>
            ApiBase.fromMetadata('http://localhost:8000', {
                ...FULL_METADATA,
                locales: 'en',
            }),
        ).toThrow(/but found: string/);
        expect(() =>
            ApiBase.fromMetadata('http://localhost:8000', {
                ...FULL_METADATA,
                locales: null,
            }),
        ).toThrow(/but found: null/);
    });

    /**
     * The guard is on the three fields every component reads, not on every key an
     * index carries: an API is free to add keys this library does not know, and
     * `riteCalendars()` already tolerates a non-array `{rite}_calendars` by
     * returning an empty list rather than throwing.
     */
    it('leaves optional keys alone', () => {
        expect(() =>
            ApiBase.fromMetadata('http://localhost:8000', {
                ...FULL_METADATA,
                wider_regions: {},
            }),
        ).not.toThrow();
    });

    it('still accepts an index whose required fields are empty arrays', () => {
        const base = ApiBase.fromMetadata('http://localhost:8000', {
            ...FULL_METADATA,
            national_calendars: [],
            diocesan_calendars: [],
            locales: [],
        });
        expect(base.locales()).toEqual([]);
        expect(base.nationalCalendars()).toEqual([]);
    });
});

describe('ApiBase.load', () => {
    it('requests the /calendars path of its own base', async () => {
        global.fetch = jest.fn().mockResolvedValue(okResponse(FULL_METADATA));
        const base = ApiBase.resolve('http://localhost:8000/');
        await base.load();
        expect(global.fetch).toHaveBeenCalledWith(
            'http://localhost:8000/calendars',
        );
        expect(base.metadata).toEqual(FULL_METADATA);
        expect(base.isLoaded).toBe(true);
    });

    it('fetches only once across repeated loads', async () => {
        global.fetch = jest.fn().mockResolvedValue(okResponse(FULL_METADATA));
        const base = ApiBase.resolve('http://localhost:8000');
        await base.load();
        await base.load();
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('collapses concurrent loads into one request', async () => {
        global.fetch = jest.fn().mockResolvedValue(okResponse(FULL_METADATA));
        const base = ApiBase.resolve('http://localhost:8000');
        await Promise.all([base.load(), base.load(), base.load()]);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('keeps two bases isolated', async () => {
        global.fetch = jest.fn((url) =>
            Promise.resolve(
                url.startsWith('http://localhost:8000')
                    ? okResponse(FULL_METADATA)
                    : okResponse(OTHER_METADATA),
            ),
        );
        const dev = ApiBase.resolve('http://localhost:8000');
        const prod = ApiBase.resolve('https://example.org/api/dev');
        await Promise.all([dev.load(), prod.load()]);
        expect(dev.metadata).toEqual(FULL_METADATA);
        expect(prod.metadata).toEqual(OTHER_METADATA);
    });

    it('rejects with an ApiClientError naming the url and status on a non-ok response', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 503,
            statusText: 'Service Unavailable',
            text: () => Promise.resolve('down for maintenance'),
        });
        const base = ApiBase.resolve('http://localhost:8000');
        await expect(base.load()).rejects.toBeInstanceOf(ApiClientError);
        await expect(base.load()).rejects.toMatchObject({
            url: 'http://localhost:8000/calendars',
            status: 503,
            statusText: 'Service Unavailable',
            body: 'down for maintenance',
        });
    });

    it('rejects with an ApiClientError wrapping a transport failure', async () => {
        const transport = new TypeError('Failed to fetch');
        global.fetch = jest.fn().mockRejectedValue(transport);
        const base = ApiBase.resolve('http://localhost:8000');
        await expect(base.load()).rejects.toBeInstanceOf(ApiClientError);
        await expect(base.load()).rejects.toMatchObject({
            url: 'http://localhost:8000/calendars',
            status: null,
            cause: transport,
        });
    });

    it('rejects when the response carries no litcal_metadata property', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: () => Promise.resolve({ unexpected: true }),
        });
        const base = ApiBase.resolve('http://localhost:8000');
        await expect(base.load()).rejects.toThrow(/litcal_metadata/);
    });

    it('allows a retry after a failed load', async () => {
        global.fetch = jest
            .fn()
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockResolvedValueOnce(okResponse(FULL_METADATA));
        const base = ApiBase.resolve('http://localhost:8000');
        await expect(base.load()).rejects.toBeInstanceOf(ApiClientError);
        await base.load();
        expect(base.metadata).toEqual(FULL_METADATA);
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });
});
