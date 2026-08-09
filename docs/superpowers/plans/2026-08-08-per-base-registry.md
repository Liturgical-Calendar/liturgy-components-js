# Per-base API registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** Let two API bases run side by side on one page by giving each base its own object that owns its URL,
metadata and response cache, replacing the static fields that today assume a single base.

**Architecture:** A new `ApiBase` class owns everything per-base; a static `Map` keyed by normalized URL
deduplicates bases. `ApiClient` holds an `ApiBase` in an instance field and keeps returning a new client per
`init()` call, so two clients can share one base. `CalendarSelect`, `ApiOptions`, `LocaleInput` and
`PathBuilder` take an optional `apiClient` and read metadata through its base, falling back to the first
registered base.

**Tech Stack:** ES2020 modules, TypeScript 5.7 for declaration emit only (`allowJs`, `strict`), Jest 30 with
`jest-environment-jsdom`, Yarn 4.6 PnP.

**Spec:** `docs/superpowers/specs/2026-08-08-per-base-registry-design.md`

## Global Constraints

- Target release is **v2.0.0**. The only breaking change is `ApiClient.init()` rejecting instead of resolving
  `false`; everything else must stay additive.
- `ApiClient.init()` with a null `url` resolves the constant `https://litcal.johnromanodorazio.com/api/dev`,
  **never** `ApiBase.default`.
- `ApiClient.init()` returns a **new** `ApiClient` on every call, including for an already-registered base.
  Only per-base state is deduplicated.
- URL normalization strips trailing slashes only. Everything else — protocol, host, port, path — is compared
  verbatim.
- Every task must leave `yarn test` green and `yarn compile` clean. Run both before every commit.
- **No test may contact a live API.** All tests use fixtures or a mocked `global.fetch`.
- Match the surrounding file's formatting. `src/ApiClient/ApiClient.js` and
  `src/CalendarSelect/CalendarSelect.js` mix spacing inside parentheses; follow the neighbouring lines rather
  than imposing one style.
- 4-space indentation, single quotes, ES module imports with explicit `.js` extensions.
- Private state uses `#`. Package-internal members shared between instances use a leading underscore
  (`_applyRite`, `_setHidden`, `_applyFilter`, `_base`).
- Every public method carries JSDoc with `@param` and `@returns`.
- Test files that touch the DOM begin with the `/** @jest-environment jsdom */` docblock.
- Jest's default `testMatch` collects **everything** under `src/__tests__/`. Shared fixtures live in
  `src/__fixtures__/`, never in `src/__tests__/`.
- Markdown: run `yarn format:md:fix` first, then `yarn lint:md`. Never use `git commit --no-verify`.

---

## File Structure

**Created:**

| File                                       | Responsibility                                                    |
| ------------------------------------------ | ----------------------------------------------------------------- |
| `src/ApiClient/ApiClientError.js`          | Error type carrying url, status, statusText, body                 |
| `src/ApiClient/ApiBase.js`                 | One base: url, metadata, cache, metadata queries; static registry |
| `src/__fixtures__/metadata.js`             | Shared `/calendars` fixtures for tests                            |
| `src/__tests__/ApiBase.test.js`            | Registry, normalization, `load()`                                 |
| `src/__tests__/ApiBaseCache.test.js`       | Cache isolation, LRU, TTL                                         |
| `src/__tests__/ApiBaseMetadata.test.js`    | Metadata query methods                                            |
| `src/__tests__/ApiClientMultiBase.test.js` | Two bases isolated; two clients on one base                       |
| `src/__tests__/ApiClientErrors.test.js`    | `init()` rejection, `calendarFetchFailed`                         |
| `src/__tests__/ComponentBinding.test.js`   | Component `apiClient` option, fallback, PathBuilder guard         |
| `examples/CompareBases/index.html`         | Two-pane comparison page markup                                   |
| `examples/CompareBases/main.js`            | Two-pane comparison page wiring                                   |

**Modified:**

| File                                                     | Change                                                   |
| -------------------------------------------------------- | -------------------------------------------------------- |
| `src/typedefs.js`                                        | Add 5 index typedefs                                     |
| `src/ApiClient/ApiClient.js`                             | Statics → `#base`; init resolves+loads; errors propagate |
| `src/CalendarSelect/CalendarSelect.js`                   | `apiClient` option; statics → `#base`                    |
| `src/ApiOptions/ApiOptions.js`                           | `apiClient` option; pass base to `LocaleInput`           |
| `src/ApiOptions/Input/LocaleInput.js`                    | Accept a base; statics → instance fields                 |
| `src/PathBuilder/PathBuilder.js`                         | Read `base.url`; throw on mismatched bases               |
| `src/index.js`                                           | Export `ApiBase`, `ApiClientError`                       |
| 17 files in `src/__tests__/`                             | Use `ApiBase.reset()` / `ApiBase.fromMetadata()`         |
| 8 files `examples/*/main.js`                             | `.catch()` for the rejecting `init()`                    |
| `src/stories/**/*.stories.js`                            | `.catch()` for the rejecting `init()`                    |
| `README.md`, `CLAUDE.md`, `CHANGELOG.md`, `package.json` | Docs, migration note, version 2.0.0                      |

---

### Task 1: `ApiClientError` and index typedefs

**Files:**

- Create: `src/ApiClient/ApiClientError.js`
- Modify: `src/typedefs.js` (append before the final `export default {};`)
- Modify: `src/index.js`
- Test: `src/__tests__/ApiClientError.test.js`

**Interfaces:**

- Consumes: nothing.
- Produces: `ApiClientError` (default export of `src/ApiClient/ApiClientError.js`), constructed as
  `new ApiClientError( message, { url, status, statusText, body, cause } )`, with public properties `url`,
  `status`, `statusText`, `body` and `name === 'ApiClientError'`. Typedefs `CalendarIndex`,
  `NationalCalendar`, `DiocesanCalendar`, `DiocesanGroup`, `WiderRegion` referenced as
  `import('../typedefs.js').CalendarIndex`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/ApiClientError.test.js`:

```js
import { describe, it, expect } from '@jest/globals';
import ApiClientError from '../ApiClient/ApiClientError.js';

describe( 'ApiClientError', () => {

    it( 'is an Error with a distinguishable name', () => {
        const err = new ApiClientError( 'boom' );
        expect( err ).toBeInstanceOf( Error );
        expect( err.name ).toBe( 'ApiClientError' );
        expect( err.message ).toBe( 'boom' );
    } );

    it( 'carries the request context', () => {
        const err = new ApiClientError( 'failed', {
            url: 'http://localhost:8000/calendars',
            status: 503,
            statusText: 'Service Unavailable',
            body: '{"error":"down"}'
        } );
        expect( err.url ).toBe( 'http://localhost:8000/calendars' );
        expect( err.status ).toBe( 503 );
        expect( err.statusText ).toBe( 'Service Unavailable' );
        expect( err.body ).toBe( '{"error":"down"}' );
    } );

    it( 'defaults every context field to null when omitted', () => {
        const err = new ApiClientError( 'failed' );
        expect( err.url ).toBeNull();
        expect( err.status ).toBeNull();
        expect( err.statusText ).toBeNull();
        expect( err.body ).toBeNull();
    } );

    it( 'preserves the underlying error as cause', () => {
        const inner = new TypeError( 'fetch failed' );
        const err = new ApiClientError( 'wrapped', { cause: inner } );
        expect( err.cause ).toBe( inner );
    } );

} );
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/ApiClientError.test.js`

Expected: FAIL — `Cannot find module '../ApiClient/ApiClientError.js'`.

- [ ] **Step 3: Create `src/ApiClient/ApiClientError.js`**

```js
/**
 * An error raised by the ApiClient when a request to the Liturgical Calendar API fails.
 *
 * Carries the request context as plain public properties rather than private fields
 * with getters: errors are routinely logged, serialized and inspected in a console,
 * and plain properties survive all three.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */
export default class ApiClientError extends Error {

    /**
     * @param {string} message - A human readable description of the failure.
     * @param {object} [context] - The request context.
     * @param {string|null} [context.url] - The URL that was requested.
     * @param {number|null} [context.status] - The HTTP status, or null if the request never completed.
     * @param {string|null} [context.statusText] - The HTTP status text, or null if the request never completed.
     * @param {string|null} [context.body] - The response body as text, when it could be read.
     * @param {Error|null} [context.cause] - The underlying error, when the request never completed.
     */
    constructor( message, { url = null, status = null, statusText = null, body = null, cause = null } = {} ) {
        super( message, cause === null ? undefined : { cause } );
        this.name       = 'ApiClientError';
        this.url        = url;
        this.status     = status;
        this.statusText = statusText;
        this.body       = body;
    }

}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test src/__tests__/ApiClientError.test.js`

Expected: PASS, 4 tests.

- [ ] **Step 5: Append the index typedefs to `src/typedefs.js`**

Insert immediately before the closing `export default {};` line:

```js
/**
 * @typedef {Object} NationalCalendar
 * @prop {string} calendar_id - The calendar ID (ISO 3166-1 alpha-2 country code)
 * @prop {string[]} locales - The locales supported by this calendar
 * @prop {string[]} missals - The Roman Missal editions available for this calendar
 * @prop {{epiphany: string, ascension: string, corpus_christi: string, eternal_high_priest: boolean}} settings - The calendar's default settings
 * @prop {string} [wider_region] - The wider region this calendar belongs to
 * @prop {string[]} [dioceses] - The calendar IDs of the dioceses within this nation
 */

/**
 * @typedef {Object} DiocesanCalendar
 * @prop {string} calendar_id - The calendar ID for the diocese
 * @prop {string} diocese - The name of the diocese
 * @prop {string} nation - The nation this diocese belongs to (ISO 3166-1 alpha-2 country code)
 * @prop {string[]} locales - The locales supported by this calendar
 * @prop {string} timezone - The IANA timezone for this diocese
 * @prop {string} [group] - The diocesan group this diocese belongs to
 * @prop {{epiphany?: string, ascension?: string, corpus_christi?: string}} [settings] - Settings overriding the national defaults
 * @prop {'roman'|'ambrosian'} [rite] - The rite this diocese celebrates. Absent on the v5 API, where a missing value means `roman`.
 */

/**
 * @typedef {Object} DiocesanGroup
 * @prop {string} group_name - The name of the diocesan group
 * @prop {string[]} dioceses - The calendar IDs of the dioceses in this group
 */

/**
 * @typedef {Object} WiderRegion
 * @prop {string} name - The name of the wider region
 * @prop {string[]} locales - The locales supported by this region
 * @prop {string} api_path - The API path for this region's calendar
 */

/**
 * The response body of the API's `/calendars` path: an index of every calendar the
 * API can serve.
 *
 * Distinct from {@link CalendarMetadata}, which is the `metadata` block within a
 * single calendar response. The two describe different objects and must not be
 * used interchangeably.
 *
 * @typedef {Object} CalendarIndex
 * @prop {NationalCalendar[]} national_calendars - Every national calendar
 * @prop {string[]} national_calendars_keys - The calendar IDs of every national calendar
 * @prop {DiocesanCalendar[]} diocesan_calendars - Every diocesan calendar
 * @prop {string[]} diocesan_calendars_keys - The calendar IDs of every diocesan calendar
 * @prop {DiocesanGroup[]} diocesan_groups - Groups of dioceses
 * @prop {WiderRegion[]} wider_regions - Wider regions, such as continents
 * @prop {string[]} wider_regions_keys - The names of every wider region
 * @prop {string[]} locales - Every locale the API supports
 * @prop {NationalCalendar[]} [ambrosian_calendars] - The Ambrosian rite's own calendars. Absent on the v5 API; its absence is how rite support is feature-detected.
 */
```

- [ ] **Step 6: Export the error type from `src/index.js`**

Add the import alongside the existing ones:

```js
import ApiClientError from './ApiClient/ApiClientError.js';
```

and add `ApiClientError` to the `export { ... }` list, immediately after `ApiClient`.

- [ ] **Step 7: Verify the suite and the compile**

Run: `yarn test && yarn compile`

Expected: 15 suites pass (14 existing plus the new one), 139 tests. `yarn compile` exits 0 and writes
`dist/ApiClient/ApiClientError.d.ts`.

- [ ] **Step 8: Commit**

```bash
git add src/ApiClient/ApiClientError.js src/typedefs.js src/index.js src/__tests__/ApiClientError.test.js
git commit -m "Add ApiClientError and the calendar index typedefs"
```

---

### Task 2: `ApiBase` core — registry and `load()`

**Files:**

- Create: `src/ApiClient/ApiBase.js`
- Create: `src/__fixtures__/metadata.js`
- Test: `src/__tests__/ApiBase.test.js`

**Interfaces:**

- Consumes: `ApiClientError` from Task 1.
- Produces: `ApiBase` (default export of `src/ApiClient/ApiBase.js`) with statics `ApiBase.DEFAULT_URL`
  (string), `ApiBase.normalizeUrl( url )`, `ApiBase.resolve( url )`, `ApiBase.fromMetadata( url, metadata )`,
  `ApiBase.default` (getter), `ApiBase.all` (getter), `ApiBase.reset()`; instance members `url`, `metadata`,
  `isLoaded`, `load()`. Fixtures `FULL_METADATA` and `V5_METADATA` exported from
  `src/__fixtures__/metadata.js`.

- [ ] **Step 1: Create the shared fixtures**

Create `src/__fixtures__/metadata.js`. This directory is deliberately **outside** `src/__tests__/`, because
Jest's default `testMatch` collects every file under `__tests__` as a suite and would fail this one for
containing no tests.

```js
/**
 * Shared `/calendars` fixtures for the test suite.
 *
 * Lives in `src/__fixtures__/` rather than `src/__tests__/` because Jest's default
 * `testMatch` collects every file under `__tests__` as a test suite, and a module
 * of fixtures contains no tests.
 */

/** A rite-aware (v6) index: announces `ambrosian_calendars`. */
export const FULL_METADATA = {
    national_calendars: [
        { calendar_id: 'IT', locales: [ 'it-IT' ], missals: [ 'EDITIO_TYPICA_1970' ], settings: { epiphany: 'JAN6', ascension: 'SUNDAY', corpus_christi: 'SUNDAY', eternal_high_priest: false } },
        { calendar_id: 'US', locales: [ 'en-US' ], missals: [ 'EDITIO_TYPICA_1970' ], settings: { epiphany: 'SUNDAY_JAN2_JAN8', ascension: 'SUNDAY', corpus_christi: 'SUNDAY', eternal_high_priest: false } },
        { calendar_id: 'VA', locales: [ 'la', 'it-IT' ], missals: [ 'EDITIO_TYPICA_1970' ], settings: { epiphany: 'JAN6', ascension: 'THURSDAY', corpus_christi: 'THURSDAY', eternal_high_priest: false } }
    ],
    national_calendars_keys: [ 'IT', 'US', 'VA' ],
    diocesan_calendars: [
        { calendar_id: 'romamo_it', nation: 'IT', diocese: 'Diocesi di Roma', locales: [ 'it-IT' ], timezone: 'Europe/Rome', rite: 'roman' },
        { calendar_id: 'boston_us', nation: 'US', diocese: 'Archdiocese of Boston', locales: [ 'en-US' ], timezone: 'America/New_York', rite: 'roman' },
        { calendar_id: 'milano_it', nation: 'IT', diocese: 'Arcidiocesi di Milano', locales: [ 'it-IT' ], timezone: 'Europe/Rome', rite: 'ambrosian' }
    ],
    diocesan_calendars_keys: [ 'romamo_it', 'boston_us', 'milano_it' ],
    diocesan_groups: [],
    wider_regions: [ { name: 'Europe', locales: [ 'it-IT', 'la' ], api_path: '/data/widerregion/Europe' } ],
    wider_regions_keys: [ 'Europe' ],
    locales: [ 'en', 'it', 'la' ],
    ambrosian_calendars: [
        { calendar_id: 'ambrosian', locales: [ 'it', 'la' ], missals: [], settings: { epiphany: 'JAN6', ascension: 'THURSDAY', corpus_christi: 'THURSDAY', eternal_high_priest: false } }
    ]
};

/**
 * The shape the live v5 API returns: no `ambrosian_calendars` key, and diocesan
 * entries carry no `rite` field. A missing `rite` means Roman.
 */
export const V5_METADATA = {
    national_calendars: [
        { calendar_id: 'IT', locales: [ 'it-IT' ], missals: [ 'EDITIO_TYPICA_1970' ], settings: { epiphany: 'JAN6', ascension: 'SUNDAY', corpus_christi: 'SUNDAY', eternal_high_priest: false } },
        { calendar_id: 'US', locales: [ 'en-US' ], missals: [ 'EDITIO_TYPICA_1970' ], settings: { epiphany: 'SUNDAY_JAN2_JAN8', ascension: 'SUNDAY', corpus_christi: 'SUNDAY', eternal_high_priest: false } },
        { calendar_id: 'VA', locales: [ 'la', 'it-IT' ], missals: [ 'EDITIO_TYPICA_1970' ], settings: { epiphany: 'JAN6', ascension: 'THURSDAY', corpus_christi: 'THURSDAY', eternal_high_priest: false } }
    ],
    national_calendars_keys: [ 'IT', 'US', 'VA' ],
    diocesan_calendars: [
        { calendar_id: 'romamo_it', nation: 'IT', diocese: 'Diocesi di Roma', locales: [ 'it-IT' ], timezone: 'Europe/Rome' },
        { calendar_id: 'boston_us', nation: 'US', diocese: 'Archdiocese of Boston', locales: [ 'en-US' ], timezone: 'America/New_York' }
    ],
    diocesan_calendars_keys: [ 'romamo_it', 'boston_us' ],
    diocesan_groups: [],
    wider_regions: [],
    wider_regions_keys: [],
    locales: [ 'en', 'it', 'la' ]
};

/** A second, deliberately different index, for asserting that two bases stay isolated. */
export const OTHER_METADATA = {
    national_calendars: [
        { calendar_id: 'NL', locales: [ 'nl-NL' ], missals: [ 'EDITIO_TYPICA_1970' ], settings: { epiphany: 'SUNDAY_JAN2_JAN8', ascension: 'SUNDAY', corpus_christi: 'SUNDAY', eternal_high_priest: false } }
    ],
    national_calendars_keys: [ 'NL' ],
    diocesan_calendars: [
        { calendar_id: 'haarlem_nl', nation: 'NL', diocese: 'Bisdom Haarlem-Amsterdam', locales: [ 'nl-NL' ], timezone: 'Europe/Amsterdam', rite: 'roman' }
    ],
    diocesan_calendars_keys: [ 'haarlem_nl' ],
    diocesan_groups: [],
    wider_regions: [],
    wider_regions_keys: [],
    locales: [ 'nl' ]
};
```

- [ ] **Step 2: Write the failing test**

Create `src/__tests__/ApiBase.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClientError from '../ApiClient/ApiClientError.js';
import { FULL_METADATA, OTHER_METADATA } from '../__fixtures__/metadata.js';

const okResponse = ( metadata ) => ( {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve( { litcal_metadata: metadata } )
} );

beforeEach( () => {
    ApiBase.reset();
} );

afterEach( () => {
    delete global.fetch;
} );

describe( 'ApiBase.normalizeUrl', () => {

    it( 'strips trailing slashes', () => {
        expect( ApiBase.normalizeUrl( 'http://localhost:8000/' ) ).toBe( 'http://localhost:8000' );
        expect( ApiBase.normalizeUrl( 'http://localhost:8000///' ) ).toBe( 'http://localhost:8000' );
    } );

    it( 'leaves protocol, host, port and path untouched', () => {
        expect( ApiBase.normalizeUrl( 'https://example.org/api/dev' ) ).toBe( 'https://example.org/api/dev' );
    } );

    it( 'treats hosts that merely resolve alike as distinct', () => {
        expect( ApiBase.normalizeUrl( 'http://localhost:8000' ) )
            .not.toBe( ApiBase.normalizeUrl( 'http://127.0.0.1:8000' ) );
    } );

    it( 'rejects a non-string or empty url', () => {
        expect( () => ApiBase.normalizeUrl( null ) ).toThrow( /non-empty string/ );
        expect( () => ApiBase.normalizeUrl( '   ' ) ).toThrow( /non-empty string/ );
    } );

} );

describe( 'ApiBase registry', () => {

    it( 'returns the same instance for urls differing only by trailing slash', () => {
        expect( ApiBase.resolve( 'http://localhost:8000' ) )
            .toBe( ApiBase.resolve( 'http://localhost:8000/' ) );
    } );

    it( 'returns different instances for different urls', () => {
        expect( ApiBase.resolve( 'http://localhost:8000' ) )
            .not.toBe( ApiBase.resolve( 'https://example.org/api/dev' ) );
    } );

    it( 'does not fetch when resolving', () => {
        global.fetch = jest.fn();
        ApiBase.resolve( 'http://localhost:8000' );
        expect( global.fetch ).not.toHaveBeenCalled();
    } );

    it( 'reports the first registered base as the default', () => {
        const first = ApiBase.resolve( 'http://localhost:8000' );
        ApiBase.resolve( 'https://example.org/api/dev' );
        expect( ApiBase.default ).toBe( first );
    } );

    it( 'reports null as the default when nothing is registered', () => {
        expect( ApiBase.default ).toBeNull();
    } );

    it( 'lists every base in registration order', () => {
        ApiBase.resolve( 'http://localhost:8000' );
        ApiBase.resolve( 'https://example.org/api/dev' );
        expect( ApiBase.all.map( base => base.url ) )
            .toEqual( [ 'http://localhost:8000', 'https://example.org/api/dev' ] );
    } );

    it( 'clears the registry on reset', () => {
        ApiBase.resolve( 'http://localhost:8000' );
        ApiBase.reset();
        expect( ApiBase.all ).toEqual( [] );
        expect( ApiBase.default ).toBeNull();
    } );

} );

describe( 'ApiBase.fromMetadata', () => {

    it( 'produces a loaded base with no network call', () => {
        global.fetch = jest.fn();
        const base = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        expect( base.isLoaded ).toBe( true );
        expect( base.metadata ).toBe( FULL_METADATA );
        expect( global.fetch ).not.toHaveBeenCalled();
    } );

    it( 'registers the base so resolve returns it', () => {
        const base = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        expect( ApiBase.resolve( 'http://localhost:8000' ) ).toBe( base );
    } );

    it( 'replaces an existing entry for the same url', () => {
        const first  = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        const second = ApiBase.fromMetadata( 'http://localhost:8000', OTHER_METADATA );
        expect( second ).not.toBe( first );
        expect( ApiBase.resolve( 'http://localhost:8000' ).metadata ).toBe( OTHER_METADATA );
        expect( ApiBase.all ).toHaveLength( 1 );
    } );

} );

describe( 'ApiBase.load', () => {

    it( 'requests the /calendars path of its own base', async () => {
        global.fetch = jest.fn().mockResolvedValue( okResponse( FULL_METADATA ) );
        const base = ApiBase.resolve( 'http://localhost:8000/' );
        await base.load();
        expect( global.fetch ).toHaveBeenCalledWith( 'http://localhost:8000/calendars' );
        expect( base.metadata ).toEqual( FULL_METADATA );
        expect( base.isLoaded ).toBe( true );
    } );

    it( 'fetches only once across repeated loads', async () => {
        global.fetch = jest.fn().mockResolvedValue( okResponse( FULL_METADATA ) );
        const base = ApiBase.resolve( 'http://localhost:8000' );
        await base.load();
        await base.load();
        expect( global.fetch ).toHaveBeenCalledTimes( 1 );
    } );

    it( 'collapses concurrent loads into one request', async () => {
        global.fetch = jest.fn().mockResolvedValue( okResponse( FULL_METADATA ) );
        const base = ApiBase.resolve( 'http://localhost:8000' );
        await Promise.all( [ base.load(), base.load(), base.load() ] );
        expect( global.fetch ).toHaveBeenCalledTimes( 1 );
    } );

    it( 'keeps two bases isolated', async () => {
        global.fetch = jest.fn( url => Promise.resolve(
            url.startsWith( 'http://localhost:8000' )
                ? okResponse( FULL_METADATA )
                : okResponse( OTHER_METADATA )
        ) );
        const dev  = ApiBase.resolve( 'http://localhost:8000' );
        const prod = ApiBase.resolve( 'https://example.org/api/dev' );
        await Promise.all( [ dev.load(), prod.load() ] );
        expect( dev.metadata ).toEqual( FULL_METADATA );
        expect( prod.metadata ).toEqual( OTHER_METADATA );
    } );

    it( 'rejects with an ApiClientError naming the url and status on a non-ok response', async () => {
        global.fetch = jest.fn().mockResolvedValue( {
            ok: false,
            status: 503,
            statusText: 'Service Unavailable',
            text: () => Promise.resolve( 'down for maintenance' )
        } );
        const base = ApiBase.resolve( 'http://localhost:8000' );
        await expect( base.load() ).rejects.toBeInstanceOf( ApiClientError );
        await expect( base.load() ).rejects.toMatchObject( {
            url: 'http://localhost:8000/calendars',
            status: 503,
            statusText: 'Service Unavailable',
            body: 'down for maintenance'
        } );
    } );

    it( 'rejects with an ApiClientError wrapping a transport failure', async () => {
        const transport = new TypeError( 'Failed to fetch' );
        global.fetch = jest.fn().mockRejectedValue( transport );
        const base = ApiBase.resolve( 'http://localhost:8000' );
        await expect( base.load() ).rejects.toBeInstanceOf( ApiClientError );
        await expect( base.load() ).rejects.toMatchObject( {
            url: 'http://localhost:8000/calendars',
            status: null,
            cause: transport
        } );
    } );

    it( 'rejects when the response carries no litcal_metadata property', async () => {
        global.fetch = jest.fn().mockResolvedValue( {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: () => Promise.resolve( { unexpected: true } )
        } );
        const base = ApiBase.resolve( 'http://localhost:8000' );
        await expect( base.load() ).rejects.toThrow( /litcal_metadata/ );
    } );

    it( 'allows a retry after a failed load', async () => {
        global.fetch = jest.fn()
            .mockRejectedValueOnce( new TypeError( 'Failed to fetch' ) )
            .mockResolvedValueOnce( okResponse( FULL_METADATA ) );
        const base = ApiBase.resolve( 'http://localhost:8000' );
        await expect( base.load() ).rejects.toBeInstanceOf( ApiClientError );
        await base.load();
        expect( base.metadata ).toEqual( FULL_METADATA );
        expect( global.fetch ).toHaveBeenCalledTimes( 2 );
    } );

} );
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `yarn test src/__tests__/ApiBase.test.js`

Expected: FAIL — `Cannot find module '../ApiClient/ApiBase.js'`.

- [ ] **Step 4: Create `src/ApiClient/ApiBase.js`**

```js
import ApiClientError from './ApiClientError.js';

/**
 * One Liturgical Calendar API base URL, and everything that belongs to it: the
 * calendar index served by its `/calendars` path, and the cache of calendar
 * responses fetched from it.
 *
 * A static registry keyed by normalized URL deduplicates bases, so two clients
 * pointed at the same API share one metadata fetch and one cache while remaining
 * independent objects themselves.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */
export default class ApiBase {

    /** @type {Map<string, ApiBase>} Registry keyed by normalized URL, in registration order. */
    static #registry = new Map();

    /** @type {string} */
    static #defaultUrl = 'https://litcal.johnromanodorazio.com/api/dev';

    /** @type {string} */
    #url;

    /** @type {import('../typedefs.js').CalendarIndex|null} */
    #metadata = null;

    /** @type {Promise<ApiBase>|null} The in-flight `/calendars` request, if any. */
    #loadPromise = null;

    /**
     * Not for direct use: obtain a base through {@link ApiBase.resolve} or
     * {@link ApiBase.fromMetadata} so that it is registered.
     *
     * @param {string} url - An already normalized base URL.
     */
    constructor( url ) {
        this.#url = url;
    }

    /**
     * The base URL used when none is supplied.
     *
     * @returns {string}
     */
    static get DEFAULT_URL() {
        return ApiBase.#defaultUrl;
    }

    /**
     * Normalizes a base URL for use as a registry key.
     *
     * Strips trailing slashes and surrounding whitespace, and nothing else: two
     * URLs that differ in host or port are two bases even when they happen to
     * resolve to the same server, because guessing otherwise would be worse than
     * the duplicate.
     *
     * @param {string} url - The URL to normalize.
     * @returns {string} The normalized URL.
     * @throws {Error} If the URL is not a non-empty string.
     */
    static normalizeUrl( url ) {
        if ( typeof url !== 'string' || url.trim() === '' ) {
            throw new Error( 'ApiBase: url must be a non-empty string, but found: ' + String( url ) );
        }
        return url.trim().replace( /\/+$/, '' );
    }

    /**
     * Returns the registered base for a URL, registering an unloaded one if absent.
     *
     * Never performs a network request; call {@link ApiBase#load} for that.
     *
     * @param {string} [url] - The base URL. Defaults to {@link ApiBase.DEFAULT_URL}.
     * @returns {ApiBase}
     */
    static resolve( url = ApiBase.#defaultUrl ) {
        const normalized = ApiBase.normalizeUrl( url );
        if ( false === ApiBase.#registry.has( normalized ) ) {
            ApiBase.#registry.set( normalized, new ApiBase( normalized ) );
        }
        return ApiBase.#registry.get( normalized );
    }

    /**
     * Registers an already loaded base from a metadata object, without any network
     * request.
     *
     * Replaces any base already registered for the URL. The replacement is
     * deliberate: fixture setup that had to clear the registry first would be a
     * trap in a `beforeEach`.
     *
     * @param {string} url - The base URL.
     * @param {import('../typedefs.js').CalendarIndex} metadata - The calendar index.
     * @returns {ApiBase}
     */
    static fromMetadata( url, metadata ) {
        const base = new ApiBase( ApiBase.normalizeUrl( url ) );
        base.#metadata = metadata;
        ApiBase.#registry.set( base.url, base );
        return base;
    }

    /**
     * The first base registered, which unbound components fall back to.
     *
     * @returns {ApiBase|null} Null when no base is registered.
     */
    static get default() {
        const first = ApiBase.#registry.values().next();
        return first.done ? null : first.value;
    }

    /**
     * Every registered base, in registration order.
     *
     * @returns {ApiBase[]}
     */
    static get all() {
        return Array.from( ApiBase.#registry.values() );
    }

    /**
     * Empties the registry.
     *
     * @returns {void}
     */
    static reset() {
        ApiBase.#registry.clear();
    }

    /**
     * The normalized base URL.
     *
     * @returns {string}
     */
    get url() {
        return this.#url;
    }

    /**
     * The calendar index served by this base's `/calendars` path.
     *
     * @returns {import('../typedefs.js').CalendarIndex|null} Null until loaded.
     */
    get metadata() {
        return this.#metadata;
    }

    /**
     * Whether this base's metadata has been loaded.
     *
     * @returns {boolean}
     */
    get isLoaded() {
        return this.#metadata !== null;
    }

    /**
     * Loads this base's calendar index, once.
     *
     * Idempotent, and safe to call concurrently: a load already in flight is
     * returned rather than duplicated, so two panes on one base issue a single
     * request. On failure the in-flight promise is cleared so that a later call
     * can retry.
     *
     * @returns {Promise<ApiBase>} Resolves to this base once its metadata is loaded.
     * @throws {ApiClientError} If the request fails or the response carries no `litcal_metadata`.
     */
    load() {
        if ( this.#metadata !== null ) {
            return Promise.resolve( this );
        }
        if ( this.#loadPromise !== null ) {
            return this.#loadPromise;
        }

        const requestUrl = `${this.#url}/calendars`;

        this.#loadPromise = fetch( requestUrl ).then( response => {
            if ( false === response.ok ) {
                return response.text()
                    .catch( () => null )
                    .then( body => {
                        throw new ApiClientError(
                            `GET ${requestUrl} failed: ${response.status} ${response.statusText}`,
                            { url: requestUrl, status: response.status, statusText: response.statusText, body }
                        );
                    } );
            }
            return response.json();
        } ).then( data => {
            if ( null === data || typeof data !== 'object' || false === Object.hasOwn( data, 'litcal_metadata' ) ) {
                throw new ApiClientError(
                    `GET ${requestUrl} returned no litcal_metadata property`,
                    { url: requestUrl }
                );
            }
            this.#metadata    = data.litcal_metadata;
            this.#loadPromise = null;
            return this;
        } ).catch( error => {
            this.#loadPromise = null;
            if ( error instanceof ApiClientError ) {
                throw error;
            }
            throw new ApiClientError(
                `GET ${requestUrl} failed: ${error.message}`,
                { url: requestUrl, cause: error }
            );
        } );

        return this.#loadPromise;
    }

}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `yarn test src/__tests__/ApiBase.test.js`

Expected: PASS, 20 tests.

- [ ] **Step 6: Export `ApiBase` from `src/index.js`**

Add the import:

```js
import ApiBase from './ApiClient/ApiBase.js';
```

and add `ApiBase` to the `export { ... }` list, immediately after `ApiClientError`.

- [ ] **Step 7: Verify the whole suite and the compile**

Run: `yarn test && yarn compile`

Expected: 16 suites pass, 159 tests. `yarn compile` exits 0.

- [ ] **Step 8: Commit**

```bash
git add src/ApiClient/ApiBase.js src/__fixtures__/metadata.js src/__tests__/ApiBase.test.js src/index.js
git commit -m "Add ApiBase with a per-base registry and idempotent metadata load"
```

---

### Task 3: `ApiBase` response cache

**Files:**

- Modify: `src/ApiClient/ApiBase.js`
- Test: `src/__tests__/ApiBaseCache.test.js`

**Interfaces:**

- Consumes: `ApiBase` from Task 2.
- Produces: instance methods `getCached( key )` returning the stored data or `null`, `setCached( key, data )`
  returning void, `clearCache()` returning void; static `ApiBase.cacheLimits( { maxEntries, ttl } )` and
  `ApiBase.clearAllCaches()`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/ApiBaseCache.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import { FULL_METADATA, OTHER_METADATA } from '../__fixtures__/metadata.js';

beforeEach( () => {
    ApiBase.reset();
    ApiBase.cacheLimits( { maxEntries: 50, ttl: null } );
} );

afterEach( () => {
    jest.useRealTimers();
} );

describe( 'ApiBase cache', () => {

    it( 'returns null for a key never stored', () => {
        const base = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        expect( base.getCached( 'nope' ) ).toBeNull();
    } );

    it( 'round-trips stored data', () => {
        const base = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        const payload = { litcal: [ { event_key: 'Christmas' } ] };
        base.setCached( 'roman|general||2026|LITURGICAL|it', payload );
        expect( base.getCached( 'roman|general||2026|LITURGICAL|it' ) ).toBe( payload );
    } );

    it( 'keeps two bases isolated under an identical key', () => {
        const dev  = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        const prod = ApiBase.fromMetadata( 'https://example.org/api/dev', OTHER_METADATA );
        dev.setCached( 'same-key', { from: 'dev' } );
        prod.setCached( 'same-key', { from: 'prod' } );
        expect( dev.getCached( 'same-key' ) ).toEqual( { from: 'dev' } );
        expect( prod.getCached( 'same-key' ) ).toEqual( { from: 'prod' } );
    } );

    it( 'empties only its own cache on clearCache', () => {
        const dev  = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        const prod = ApiBase.fromMetadata( 'https://example.org/api/dev', OTHER_METADATA );
        dev.setCached( 'k', { from: 'dev' } );
        prod.setCached( 'k', { from: 'prod' } );
        dev.clearCache();
        expect( dev.getCached( 'k' ) ).toBeNull();
        expect( prod.getCached( 'k' ) ).toEqual( { from: 'prod' } );
    } );

    it( 'empties every base cache on clearAllCaches', () => {
        const dev  = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        const prod = ApiBase.fromMetadata( 'https://example.org/api/dev', OTHER_METADATA );
        dev.setCached( 'k', { from: 'dev' } );
        prod.setCached( 'k', { from: 'prod' } );
        ApiBase.clearAllCaches();
        expect( dev.getCached( 'k' ) ).toBeNull();
        expect( prod.getCached( 'k' ) ).toBeNull();
    } );

    it( 'evicts the least recently read entry beyond maxEntries', () => {
        ApiBase.cacheLimits( { maxEntries: 3 } );
        const base = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        base.setCached( 'a', { n: 1 } );
        base.setCached( 'b', { n: 2 } );
        base.setCached( 'c', { n: 3 } );
        base.getCached( 'a' );          // 'a' becomes the most recently read, so 'b' is now oldest
        base.setCached( 'd', { n: 4 } );
        expect( base.getCached( 'b' ) ).toBeNull();
        expect( base.getCached( 'a' ) ).toEqual( { n: 1 } );
        expect( base.getCached( 'c' ) ).toEqual( { n: 3 } );
        expect( base.getCached( 'd' ) ).toEqual( { n: 4 } );
    } );

    it( 'never expires entries when ttl is null', () => {
        jest.useFakeTimers();
        const base = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        base.setCached( 'k', { n: 1 } );
        jest.advanceTimersByTime( 1000 * 60 * 60 * 24 );
        expect( base.getCached( 'k' ) ).toEqual( { n: 1 } );
    } );

    it( 'treats an entry older than ttl as a miss and drops it', () => {
        jest.useFakeTimers();
        ApiBase.cacheLimits( { ttl: 5000 } );
        const base = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        base.setCached( 'k', { n: 1 } );
        jest.advanceTimersByTime( 4999 );
        expect( base.getCached( 'k' ) ).toEqual( { n: 1 } );
        jest.advanceTimersByTime( 2 );
        expect( base.getCached( 'k' ) ).toBeNull();
    } );

    it( 'rejects a non-positive maxEntries', () => {
        expect( () => ApiBase.cacheLimits( { maxEntries: 0 } ) ).toThrow( /maxEntries/ );
        expect( () => ApiBase.cacheLimits( { maxEntries: -1 } ) ).toThrow( /maxEntries/ );
    } );

    it( 'rejects a non-positive ttl that is not null', () => {
        expect( () => ApiBase.cacheLimits( { ttl: 0 } ) ).toThrow( /ttl/ );
        expect( () => ApiBase.cacheLimits( { ttl: -1 } ) ).toThrow( /ttl/ );
    } );

} );
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/ApiBaseCache.test.js`

Expected: FAIL — `base.getCached is not a function`.

- [ ] **Step 3: Add the cache to `src/ApiClient/ApiBase.js`**

Add two static fields immediately after the existing `static #defaultUrl` declaration:

```js
    /** @type {number} Maximum cached responses per base. */
    static #maxEntries = 50;

    /** @type {number|null} Cache entry lifetime in milliseconds, or null for no expiry. */
    static #ttl = null;
```

Add one instance field immediately after the existing `#loadPromise` declaration:

```js
    /** @type {Map<string, {data: object, timestamp: number}>} Responses fetched from this base, in least-recently-read order. */
    #cache = new Map();
```

Add these methods at the end of the class body, after `load()`:

```js
    /**
     * Configures the response cache for every base.
     *
     * Global rather than per-base: no use case has asked for one base to cache
     * differently from another.
     *
     * @param {object} [limits] - The limits to apply. Omitted keys are left unchanged.
     * @param {number} [limits.maxEntries] - Maximum cached responses per base. Must be a positive integer.
     * @param {number|null} [limits.ttl] - Entry lifetime in milliseconds, or null for no expiry.
     * @returns {void}
     * @throws {Error} If a supplied limit is out of range.
     */
    static cacheLimits( { maxEntries, ttl } = {} ) {
        if ( maxEntries !== undefined ) {
            if ( false === Number.isInteger( maxEntries ) || maxEntries < 1 ) {
                throw new Error( 'ApiBase.cacheLimits: maxEntries must be a positive integer, but found: ' + String( maxEntries ) );
            }
            ApiBase.#maxEntries = maxEntries;
        }
        if ( ttl !== undefined ) {
            if ( ttl !== null && ( typeof ttl !== 'number' || ttl <= 0 ) ) {
                throw new Error( 'ApiBase.cacheLimits: ttl must be null or a positive number of milliseconds, but found: ' + String( ttl ) );
            }
            ApiBase.#ttl = ttl;
        }
    }

    /**
     * Empties the response cache of every registered base.
     *
     * @returns {void}
     */
    static clearAllCaches() {
        ApiBase.#registry.forEach( base => base.clearCache() );
    }

    /**
     * Reads a cached response.
     *
     * A read moves the entry to the end of the insertion order, so that the map's
     * own ordering is least-recently-read first and eviction needs no separate
     * bookkeeping.
     *
     * @param {string} key - The cache key.
     * @returns {object|null} The cached data, or null on a miss or an expired entry.
     */
    getCached( key ) {
        if ( false === this.#cache.has( key ) ) {
            return null;
        }
        const entry = this.#cache.get( key );
        if ( ApiBase.#ttl !== null && Date.now() - entry.timestamp > ApiBase.#ttl ) {
            this.#cache.delete( key );
            return null;
        }
        this.#cache.delete( key );
        this.#cache.set( key, entry );
        return entry.data;
    }

    /**
     * Stores a response, evicting the least recently read entries beyond the limit.
     *
     * @param {string} key - The cache key.
     * @param {object} data - The response data to cache.
     * @returns {void}
     */
    setCached( key, data ) {
        this.#cache.delete( key );
        this.#cache.set( key, { data, timestamp: Date.now() } );
        while ( this.#cache.size > ApiBase.#maxEntries ) {
            const oldest = this.#cache.keys().next().value;
            this.#cache.delete( oldest );
        }
    }

    /**
     * Empties this base's response cache.
     *
     * @returns {void}
     */
    clearCache() {
        this.#cache.clear();
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test src/__tests__/ApiBaseCache.test.js`

Expected: PASS, 10 tests.

- [ ] **Step 5: Verify the whole suite and the compile**

Run: `yarn test && yarn compile`

Expected: 17 suites pass, 169 tests. `yarn compile` exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/ApiClient/ApiBase.js src/__tests__/ApiBaseCache.test.js
git commit -m "Give each ApiBase its own bounded response cache"
```

---

### Task 4: `ApiBase` metadata queries

The spec sketched `nationalCalendars( rite )`. That signature is wrong, and this task corrects it. Reading the
call sites shows rite partitions metadata three different ways:

- `diocesan_calendars[].rite ?? Rite.ROMAN` filters dioceses by rite
  (`src/CalendarSelect/CalendarSelect.js:372`)
- `{rite}_calendars` holds a rite's own rite-level calendars; the Roman rite has no such key
  (`src/ApiOptions/ApiOptions.js:320`)
- whether a rite has a national tier at all is `RiteProperties[ rite ].hasNationalTier`, which lives in
  `src/Enums.js` and is not a metadata question

So `nationalCalendars()` takes no rite, and a fourth query, `riteCalendars( rite )`, is added.

**Files:**

- Modify: `src/ApiClient/ApiBase.js`
- Test: `src/__tests__/ApiBaseMetadata.test.js`

**Interfaces:**

- Consumes: `ApiBase` from Tasks 2 and 3, `Rite` from `src/Enums.js`.
- Produces: instance members `locales()`, `nationalCalendars()`, `diocesanCalendars( rite = Rite.ROMAN )`,
  `riteCalendars( rite )`, `isValidDioceseForNation( dioceseId, nation )`, and the getter `supportsRite`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/ApiBaseMetadata.test.js`:

```js
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import { Rite } from '../Enums.js';
import { FULL_METADATA, V5_METADATA } from '../__fixtures__/metadata.js';

beforeEach( () => {
    ApiBase.reset();
} );

describe( 'ApiBase metadata queries', () => {

    it( 'returns the locales the API supports', () => {
        const base = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        expect( base.locales() ).toEqual( [ 'en', 'it', 'la' ] );
    } );

    it( 'returns every national calendar', () => {
        const base = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        expect( base.nationalCalendars().map( c => c.calendar_id ) ).toEqual( [ 'IT', 'US', 'VA' ] );
    } );

    it( 'filters diocesan calendars by rite', () => {
        const base = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        expect( base.diocesanCalendars( Rite.ROMAN ).map( c => c.calendar_id ) )
            .toEqual( [ 'romamo_it', 'boston_us' ] );
        expect( base.diocesanCalendars( Rite.AMBROSIAN ).map( c => c.calendar_id ) )
            .toEqual( [ 'milano_it' ] );
    } );

    it( 'treats a diocese with no rite field as Roman', () => {
        const base = ApiBase.fromMetadata( 'http://localhost:8000', V5_METADATA );
        expect( base.diocesanCalendars( Rite.ROMAN ).map( c => c.calendar_id ) )
            .toEqual( [ 'romamo_it', 'boston_us' ] );
    } );

    it( 'defaults diocesanCalendars to the Roman rite', () => {
        const base = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        expect( base.diocesanCalendars() ).toEqual( base.diocesanCalendars( Rite.ROMAN ) );
    } );

    it( 'returns a rite own calendars under the {rite}_calendars convention', () => {
        const base = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        expect( base.riteCalendars( Rite.AMBROSIAN ).map( c => c.calendar_id ) )
            .toEqual( [ 'ambrosian' ] );
    } );

    it( 'returns an empty list for a rite with no own calendars', () => {
        const base = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        expect( base.riteCalendars( Rite.ROMAN ) ).toEqual( [] );
    } );

    it( 'reports rite support from the presence of ambrosian_calendars', () => {
        expect( ApiBase.fromMetadata( 'http://a', FULL_METADATA ).supportsRite ).toBe( true );
        expect( ApiBase.fromMetadata( 'http://b', V5_METADATA ).supportsRite ).toBe( false );
    } );

    it( 'validates a diocese against its nation', () => {
        const base = ApiBase.fromMetadata( 'http://localhost:8000', FULL_METADATA );
        expect( base.isValidDioceseForNation( 'romamo_it', 'IT' ) ).toBe( true );
        expect( base.isValidDioceseForNation( 'romamo_it', 'US' ) ).toBe( false );
        expect( base.isValidDioceseForNation( 'nonexistent', 'IT' ) ).toBe( false );
    } );

    it( 'throws a query on an unloaded base rather than returning an empty result', () => {
        const base = ApiBase.resolve( 'http://localhost:8000' );
        expect( () => base.locales() ).toThrow( /has not been loaded/ );
        expect( () => base.nationalCalendars() ).toThrow( /has not been loaded/ );
        expect( () => base.diocesanCalendars() ).toThrow( /has not been loaded/ );
        expect( () => base.riteCalendars( Rite.ROMAN ) ).toThrow( /has not been loaded/ );
        expect( () => base.isValidDioceseForNation( 'romamo_it', 'IT' ) ).toThrow( /has not been loaded/ );
    } );

    it( 'names the base in the unloaded error', () => {
        const base = ApiBase.resolve( 'http://localhost:8000' );
        expect( () => base.locales() ).toThrow( /http:\/\/localhost:8000/ );
    } );

} );
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/ApiBaseMetadata.test.js`

Expected: FAIL — `base.locales is not a function`.

- [ ] **Step 3: Add the query methods to `src/ApiClient/ApiBase.js`**

Add the import at the top of the file, after the `ApiClientError` import:

```js
import { Rite } from '../Enums.js';
```

Add these methods at the end of the class body, after `clearCache()`:

```js
    /**
     * Asserts that this base's metadata has been loaded.
     *
     * Query methods throw rather than returning an empty result, because an empty
     * calendar list is indistinguishable from an API that genuinely serves none and
     * would surface as an empty select with no explanation.
     *
     * @param {string} method - The name of the calling method, for the message.
     * @returns {void}
     * @throws {Error} If the metadata has not been loaded.
     * @private
     */
    #assertLoaded( method ) {
        if ( null === this.#metadata ) {
            throw new Error( `ApiBase.${method}: the base at ${this.#url} has not been loaded. Await load() — or ApiClient.init() — before querying its metadata.` );
        }
    }

    /**
     * Every locale this API supports.
     *
     * @returns {string[]}
     * @throws {Error} If the metadata has not been loaded.
     */
    locales() {
        this.#assertLoaded( 'locales' );
        return this.#metadata.locales;
    }

    /**
     * Every national calendar this API serves.
     *
     * Takes no rite: whether a rite has a national tier at all is a property of the
     * rite (`RiteProperties[ rite ].hasNationalTier`), not of the metadata.
     *
     * @returns {import('../typedefs.js').NationalCalendar[]}
     * @throws {Error} If the metadata has not been loaded.
     */
    nationalCalendars() {
        this.#assertLoaded( 'nationalCalendars' );
        return this.#metadata.national_calendars;
    }

    /**
     * The diocesan calendars belonging to a rite.
     *
     * A diocesan entry with no `rite` field is Roman: the field is a v6 addition,
     * and everything the v5 API ever served was Roman. Filtering on a strict
     * equality against `rite` would drop every diocese on a v5 API.
     *
     * @param {'roman'|'ambrosian'} [rite] - The rite to filter by. Defaults to `Rite.ROMAN`.
     * @returns {import('../typedefs.js').DiocesanCalendar[]}
     * @throws {Error} If the metadata has not been loaded.
     */
    diocesanCalendars( rite = Rite.ROMAN ) {
        this.#assertLoaded( 'diocesanCalendars' );
        return this.#metadata.diocesan_calendars.filter(
            diocesanCalendar => ( diocesanCalendar.rite ?? Rite.ROMAN ) === rite
        );
    }

    /**
     * A rite's own rite-level calendars, announced under the `{rite}_calendars` key.
     *
     * The Roman rite has no such key, because its rite-level calendar is the General
     * Roman Calendar, served in every locale the API supports. The absence of the key
     * is therefore not an error and yields an empty list.
     *
     * @param {'roman'|'ambrosian'} rite - The rite whose own calendars are wanted.
     * @returns {import('../typedefs.js').NationalCalendar[]}
     * @throws {Error} If the metadata has not been loaded.
     */
    riteCalendars( rite ) {
        this.#assertLoaded( 'riteCalendars' );
        const riteCalendars = this.#metadata[ `${rite}_calendars` ];
        return Array.isArray( riteCalendars ) ? riteCalendars : [];
    }

    /**
     * Whether this API understands the rite path segment.
     *
     * There is no version field in `/calendars`, so this is feature-detected: the
     * rite-aware API announces `ambrosian_calendars`, v5 does not. v5 answers any
     * path carrying a rite segment with a bare 400 — on EVERY route, not only
     * Ambrosian ones — so emitting the segment unconditionally would break every
     * request this library makes against it.
     *
     * @returns {boolean}
     */
    get supportsRite() {
        return Array.isArray( this.#metadata?.ambrosian_calendars );
    }

    /**
     * Whether a diocese belongs to a nation according to this API's metadata.
     *
     * @param {string} dioceseId - The diocesan calendar ID.
     * @param {string} nation - The national calendar ID (ISO 3166-1 alpha-2).
     * @returns {boolean} False when the diocese is unknown to this API.
     * @throws {Error} If the metadata has not been loaded.
     */
    isValidDioceseForNation( dioceseId, nation ) {
        this.#assertLoaded( 'isValidDioceseForNation' );
        const diocese = this.#metadata.diocesan_calendars.find(
            diocesanCalendar => diocesanCalendar.calendar_id === dioceseId
        );
        return undefined !== diocese && diocese.nation === nation;
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test src/__tests__/ApiBaseMetadata.test.js`

Expected: PASS, 11 tests.

- [ ] **Step 5: Verify the whole suite and the compile**

Run: `yarn test && yarn compile`

Expected: 18 suites pass, 180 tests. `yarn compile` exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/ApiClient/ApiBase.js src/__tests__/ApiBaseMetadata.test.js
git commit -m "Add metadata queries to ApiBase, including isValidDioceseForNation"
```

---

### Task 5: Bind `ApiClient` to an `ApiBase`

**Files:**

- Modify: `src/ApiClient/ApiClient.js` (statics at `:39`–`:79`, `init()` at `:174`, `#fetchCalendars()` at
  `:193`, `#supportsRite` at `:270`, `#assertRiteSupported()` at `:281`,
  `#getCachedData()`/`#setCachedData()`/`clearCache()` at `:298`–`:326`, the three fetch methods, and the
  accessors at `:848`–`:875`)
- Test: `src/__tests__/ApiClientMultiBase.test.js`

**Interfaces:**

- Consumes: `ApiBase` from Tasks 2–4.
- Produces: `apiClient.base` returning the bound `ApiBase`; `ApiClient.init( url )` resolving to a **new**
  `ApiClient` per call; `ApiClient._apiUrl` and `ApiClient._metadata` resolving to `ApiBase.default`;
  `ApiClient.clearCache()` clearing every base's cache.

**Note on the existing suite:** the 16 test files that call `ApiClient.init()` mock `global.fetch`
unconditionally, so they keep working — `base.load()` requests the same `/calendars` path the old code did.
They are migrated to fixtures in Task 10, not here. If any of them fails after this task, fix it in this task;
do not defer.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/ApiClientMultiBase.test.js`:

```js
/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import ApiClient from '../ApiClient/ApiClient.js';
import ApiBase from '../ApiClient/ApiBase.js';
import { Rite } from '../Enums.js';
import { FULL_METADATA, OTHER_METADATA } from '../__fixtures__/metadata.js';

const DEV  = 'http://localhost:8000';
const PROD = 'https://example.org/api/dev';

beforeEach( () => {
    ApiBase.reset();
    global.fetch = jest.fn( url => Promise.resolve( {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve(
            url.endsWith( '/calendars' )
                ? { litcal_metadata: url.startsWith( DEV ) ? FULL_METADATA : OTHER_METADATA }
                : { litcal: [], settings: {}, metadata: {}, messages: [] }
        )
    } ) );
} );

afterEach( () => {
    delete global.fetch;
} );

describe( 'ApiClient bound to a base', () => {

    it( 'exposes the base it is bound to', async () => {
        const client = await ApiClient.init( DEV );
        expect( client.base ).toBe( ApiBase.resolve( DEV ) );
        expect( client.base.url ).toBe( DEV );
    } );

    it( 'normalizes a trailing slash to the same base', async () => {
        const withSlash    = await ApiClient.init( `${DEV}/` );
        const withoutSlash = await ApiClient.init( DEV );
        expect( withSlash.base ).toBe( withoutSlash.base );
    } );

    it( 'returns a new client on every init, even for one base', async () => {
        const first  = await ApiClient.init( DEV );
        const second = await ApiClient.init( DEV );
        expect( second ).not.toBe( first );
        expect( second.base ).toBe( first.base );
    } );

    it( 'keeps two clients on one base independent', async () => {
        const roman     = await ApiClient.init( DEV );
        const ambrosian = await ApiClient.init( DEV );
        ambrosian.rite( Rite.AMBROSIAN );
        expect( roman._currentRite ).toBe( Rite.ROMAN );
        expect( ambrosian._currentRite ).toBe( Rite.AMBROSIAN );
    } );

    it( 'fetches metadata once per base regardless of client count', async () => {
        await ApiClient.init( DEV );
        await ApiClient.init( DEV );
        const calendarsCalls = global.fetch.mock.calls.filter( ( [ url ] ) => url.endsWith( '/calendars' ) );
        expect( calendarsCalls ).toHaveLength( 1 );
    } );

    it( 'gives each base its own metadata', async () => {
        const dev  = await ApiClient.init( DEV );
        const prod = await ApiClient.init( PROD );
        expect( dev.base.metadata ).toEqual( FULL_METADATA );
        expect( prod.base.metadata ).toEqual( OTHER_METADATA );
    } );

    it( 'refetches metadata when a second base is initialized', async () => {
        await ApiClient.init( DEV );
        await ApiClient.init( PROD );
        const calendarsCalls = global.fetch.mock.calls.filter( ( [ url ] ) => url.endsWith( '/calendars' ) );
        expect( calendarsCalls.map( ( [ url ] ) => url ) ).toEqual( [
            `${DEV}/calendars`,
            `${PROD}/calendars`
        ] );
    } );

    it( 'issues calendar requests against its own base url', async () => {
        const prod = await ApiClient.init( PROD );
        await ApiClient.init( DEV );
        global.fetch.mockClear();
        prod.fetchCalendar();
        await Promise.resolve();
        expect( global.fetch.mock.calls[ 0 ][ 0 ] ).toContain( PROD );
        expect( global.fetch.mock.calls[ 0 ][ 0 ] ).not.toContain( DEV );
    } );

    it( 'does not answer one base from another base cache', async () => {
        const dev  = await ApiClient.init( DEV );
        const prod = await ApiClient.init( PROD );
        dev.fetchCalendar();
        await new Promise( resolve => setTimeout( resolve, 0 ) );
        global.fetch.mockClear();
        prod.fetchCalendar();
        await Promise.resolve();
        expect( global.fetch ).toHaveBeenCalled();
    } );

    it( 'resolves the constant default url when init is called with no argument', async () => {
        await ApiClient.init( DEV );
        const client = await ApiClient.init();
        expect( client.base.url ).toBe( ApiBase.DEFAULT_URL );
        expect( client.base.url ).not.toBe( DEV );
    } );

    it( 'resolves the deprecated statics to the first registered base', async () => {
        await ApiClient.init( DEV );
        await ApiClient.init( PROD );
        expect( ApiClient._apiUrl ).toBe( DEV );
        expect( ApiClient._metadata ).toEqual( FULL_METADATA );
    } );

    it( 'warns when a deprecated static is read with more than one base registered', async () => {
        const warn = jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
        await ApiClient.init( DEV );
        warn.mockClear();
        void ApiClient._apiUrl;
        expect( warn ).not.toHaveBeenCalled();
        await ApiClient.init( PROD );
        void ApiClient._apiUrl;
        expect( warn ).toHaveBeenCalledWith( expect.stringContaining( DEV ) );
        warn.mockRestore();
    } );

    it( 'clears every base cache on the static clearCache', async () => {
        const dev  = await ApiClient.init( DEV );
        const prod = await ApiClient.init( PROD );
        dev.base.setCached( 'k', { n: 1 } );
        prod.base.setCached( 'k', { n: 2 } );
        ApiClient.clearCache();
        expect( dev.base.getCached( 'k' ) ).toBeNull();
        expect( prod.base.getCached( 'k' ) ).toBeNull();
    } );

} );
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/ApiClientMultiBase.test.js`

Expected: FAIL — `client.base` is undefined.

- [ ] **Step 3: Replace the static base state in `src/ApiClient/ApiClient.js`**

Delete the `static #apiUrl`, `static #metadata` and `static #calendarCache` declarations. Add an instance
field beside the other instance fields, immediately before `#eventBus`:

```js
  /**
   * The API base this client is bound to: its URL, its calendar index, and its
   * response cache.
   *
   * Instance state, deliberately. Holding the base statically is what allowed a
   * second `init()` to leave a client pointing at one API while reporting
   * another's calendars.
   *
   * @type {ApiBase}
   * @private
   */
  #base = null;
```

Add the import at the top of the file:

```js
import ApiBase from './ApiBase.js';
```

- [ ] **Step 4: Rewrite `init()` and delete `#fetchCalendars()`**

Replace the whole `static init( url = null ) { ... }` method and the whole `static #fetchCalendars() { ... }`
method with:

```js
  /**
   * Initializes an ApiClient against an API base, loading that base's calendar
   * index if it has not been loaded already.
   *
   * Returns a NEW client on every call, including for a base already registered:
   * only the per-base state is shared. Two clients on one base is a supported
   * arrangement — it is what lets one page compare two rites served by a single
   * API — and it works because every per-request field on this class is instance
   * state.
   *
   * @param {string|null} [url] - The API base URL. When null, the constant default
   *                              base is used, NOT the first base already registered:
   *                              a call that means "the public API" must not resolve
   *                              to localhost because a comparison page registered it
   *                              first.
   * @returns {Promise<ApiClient>} Resolves to a new client once the base is loaded.
   * @throws {ApiClientError} If the base's `/calendars` request fails.
   * @static
   */
  static init( url = null ) {
    const base = ApiBase.resolve( url ?? ApiBase.DEFAULT_URL );
    return base.load().then( () => new ApiClient( base ) );
  }
```

- [ ] **Step 5: Bind the constructor and add the `base` getter**

Replace the existing `constructor() { this.#eventBus = new EventEmitter(); }` with:

```js
  /**
   * Instantiates an ApiClient bound to an API base.
   *
   * Use {@link ApiClient.init} rather than calling this directly: `init()`
   * guarantees the base's calendar index is loaded before any component reads it.
   *
   * @param {ApiBase} base - The API base this client issues its requests against.
   */
  constructor( base ) {
    this.#base     = base;
    this.#eventBus = new EventEmitter();
  }

  /**
   * The API base this client is bound to.
   *
   * @returns {ApiBase}
   */
  get base() {
    return this.#base;
  }
```

- [ ] **Step 6: Route rite support, the cache and the request URLs through the base**

Delete the `static get #supportsRite()` getter entirely.

In `#assertRiteSupported()`, replace the condition and message with:

```js
  #assertRiteSupported() {
    if ( this.#currentRite !== Rite.ROMAN && false === this.#base.supportsRite ) {
      throw new Error( `ApiClient: the API at ${this.#base.url} does not support the ${this.#currentRite} rite. Rite support was added in API v6; this API announces no ambrosian_calendars in its metadata.` );
    }
  }
```

Replace the bodies of `#getCachedData()` and `#setCachedData()`:

```js
  #getCachedData(cacheKey) {
    return this.#base.getCached( cacheKey );
  }

  #setCachedData(cacheKey, data) {
    this.#base.setCached( cacheKey, data );
  }
```

Replace the body of the static `clearCache()`:

```js
  static clearCache() {
    ApiBase.clearAllCaches();
  }
```

In all three fetch methods (`fetchCalendar`, `fetchNationalCalendar`, `fetchDiocesanCalendar`), replace every
`ApiClient.#apiUrl` with `this.#base.url` and every `ApiClient.#supportsRite` with `this.#base.supportsRite`.
In `fetchCalendar` also replace `ApiClient.#metadata.locales` with `this.#base.locales()`, and make the same
substitution wherever `ApiClient.#metadata` is read inside `#resolveCalendarLocale`.

- [ ] **Step 7: Rewrite the deprecated static accessors**

Replace the `static get _metadata()`, the instance `get _metadata()` and the `static get _apiUrl()` with:

```js
  /**
   * The calendar index of the first registered base.
   *
   * @deprecated Read `apiClient.base.metadata` instead. With more than one base
   *             registered this getter cannot know which one the caller means, and
   *             answers with the first.
   * @returns {import('../typedefs.js').CalendarIndex|null}
   * @static
   */
  static get _metadata() {
    ApiClient.#warnAmbiguousStatic( '_metadata' );
    return ApiBase.default?.metadata ?? null;
  }

  /**
   * The URL of the first registered base.
   *
   * @deprecated Read `apiClient.base.url` instead.
   * @returns {string|null}
   * @static
   */
  static get _apiUrl() {
    ApiClient.#warnAmbiguousStatic( '_apiUrl' );
    return ApiBase.default?.url ?? null;
  }

  /**
   * Warns that a deprecated static was read while more than one base was registered.
   *
   * Silent only in the single-base case, which is every page written before this
   * release. Silent ambiguity is the failure this release removes; a fallback that
   * never says which base it picked would reintroduce it.
   *
   * @param {string} accessor - The name of the accessor being read.
   * @returns {void}
   * @private
   */
  static #warnAmbiguousStatic( accessor ) {
    if ( ApiBase.all.length > 1 ) {
      console.warn( `ApiClient.${accessor} is ambiguous: ${ApiBase.all.length} API bases are registered, and it resolved to ${ApiBase.default.url}. Read it from a specific client instead, as apiClient.base.` );
    }
  }

  /**
   * The calendar index of the base this client is bound to.
   *
   * @returns {import('../typedefs.js').CalendarIndex|null}
   */
  get _metadata() {
    return this.#base.metadata;
  }
```

- [ ] **Step 8: Run the new test and then the whole suite**

Run: `yarn test src/__tests__/ApiClientMultiBase.test.js`

Expected: PASS, 13 tests.

Run: `yarn test`

Expected: every suite green. If an existing suite fails, fix it here rather than deferring — `git diff`
against the previous commit shows exactly which reads of the removed statics were missed.

- [ ] **Step 9: Verify the compile**

Run: `yarn compile`

Expected: exits 0.

- [ ] **Step 10: Commit**

```bash
git add src/ApiClient/ApiClient.js src/__tests__/ApiClientMultiBase.test.js
git commit -m "Bind ApiClient to an ApiBase instead of static per-base fields"
```

---

### Task 6: Propagate fetch errors

**Files:**

- Modify: `src/ApiClient/ApiClient.js` (the three fetch methods; `refetchCalendarData()` at `:344`; the
  fire-and-forget call inside the `listenTo` subscription at `:720`)
- Modify: `src/LiturgyOfAnyDay/LiturgyOfAnyDay.js` (the three `refetchCalendarData()` calls at `:197`,
  `:309`, `:314`)
- Test: `src/__tests__/ApiClientErrors.test.js`

**Fire-and-forget callers.** Once the three fetch methods reject, every caller that discards their promise
turns a handled failure into an unhandled rejection in the browser. `refetchCalendarData()` discards all
three, and it in turn has four discarding callers — one inside `ApiClient` itself and three in
`LiturgyOfAnyDay`. `refetchCalendarData()` must therefore `return` the promise it currently drops, and each
of the four call sites must attach a handler. Since `calendarFetchFailed` already carries the error to
subscribers, those handlers are deliberate no-op suppressors and must carry a comment saying so — an
unexplained empty `catch` is indistinguishable from a swallowed bug.

**Interfaces:**

- Consumes: `ApiBase`, `ApiClientError`, `ApiClient` from Tasks 1–5.
- Produces: `fetchCalendar`, `fetchNationalCalendar` and `fetchDiocesanCalendar` each return a `Promise` that
  rejects with an `ApiClientError`; the event `'calendarFetchFailed'` emitted as `( error, { rite } )`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/ApiClientErrors.test.js`:

```js
/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import ApiClient from '../ApiClient/ApiClient.js';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClientError from '../ApiClient/ApiClientError.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const DEV = 'http://localhost:8000';

beforeEach( () => {
    ApiBase.reset();
} );

afterEach( () => {
    delete global.fetch;
} );

describe( 'ApiClient.init failure', () => {

    it( 'rejects with an ApiClientError naming the url and status', async () => {
        global.fetch = jest.fn().mockResolvedValue( {
            ok: false,
            status: 502,
            statusText: 'Bad Gateway',
            text: () => Promise.resolve( '' )
        } );
        await expect( ApiClient.init( DEV ) ).rejects.toBeInstanceOf( ApiClientError );
        await expect( ApiClient.init( DEV ) ).rejects.toMatchObject( {
            url: `${DEV}/calendars`,
            status: 502
        } );
    } );

    it( 'rejects rather than resolving false when the API is unreachable', async () => {
        global.fetch = jest.fn().mockRejectedValue( new TypeError( 'Failed to fetch' ) );
        await expect( ApiClient.init( DEV ) ).rejects.toBeInstanceOf( ApiClientError );
    } );

    it( 'leaves a healthy base usable when another base is down', async () => {
        global.fetch = jest.fn( url => url.startsWith( DEV )
            ? Promise.reject( new TypeError( 'Failed to fetch' ) )
            : Promise.resolve( {
                ok: true,
                status: 200,
                statusText: 'OK',
                json: () => Promise.resolve( { litcal_metadata: FULL_METADATA } )
            } )
        );
        await expect( ApiClient.init( DEV ) ).rejects.toBeInstanceOf( ApiClientError );
        const healthy = await ApiClient.init( 'https://example.org/api/dev' );
        expect( healthy.base.metadata ).toEqual( FULL_METADATA );
    } );

} );

describe( 'ApiClient calendar fetch failure', () => {

    const mockMetadataThenFailure = () => {
        global.fetch = jest.fn( url => url.endsWith( '/calendars' )
            ? Promise.resolve( {
                ok: true,
                status: 200,
                statusText: 'OK',
                json: () => Promise.resolve( { litcal_metadata: FULL_METADATA } )
            } )
            : Promise.resolve( {
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                text: () => Promise.resolve( 'boom' )
            } )
        );
    };

    it( 'rejects with an ApiClientError carrying the status', async () => {
        mockMetadataThenFailure();
        const client = await ApiClient.init( DEV );
        await expect( client.fetchCalendar() ).rejects.toMatchObject( {
            status: 500,
            statusText: 'Internal Server Error'
        } );
    } );

    it( 'emits calendarFetchFailed with the error and the request rite', async () => {
        mockMetadataThenFailure();
        const client = await ApiClient.init( DEV );
        const onFailure = jest.fn();
        client.on( 'calendarFetchFailed', onFailure );
        await expect( client.fetchCalendar() ).rejects.toBeInstanceOf( ApiClientError );
        expect( onFailure ).toHaveBeenCalledTimes( 1 );
        expect( onFailure.mock.calls[ 0 ][ 0 ] ).toBeInstanceOf( ApiClientError );
        expect( onFailure.mock.calls[ 0 ][ 1 ] ).toEqual( { rite: 'roman' } );
    } );

    it( 'does not emit calendarFetched on a failure', async () => {
        mockMetadataThenFailure();
        const client = await ApiClient.init( DEV );
        const onFetched = jest.fn();
        client.on( 'calendarFetched', onFetched );
        await expect( client.fetchCalendar() ).rejects.toBeInstanceOf( ApiClientError );
        expect( onFetched ).not.toHaveBeenCalled();
    } );

    it( 'does not cache a failed response', async () => {
        mockMetadataThenFailure();
        const client = await ApiClient.init( DEV );
        await expect( client.fetchCalendar() ).rejects.toBeInstanceOf( ApiClientError );
        await expect( client.fetchCalendar() ).rejects.toBeInstanceOf( ApiClientError );
        const calendarCalls = global.fetch.mock.calls.filter( ( [ url ] ) => false === url.endsWith( '/calendars' ) );
        expect( calendarCalls.length ).toBe( 2 );
    } );

    it( 'rejects from fetchNationalCalendar too', async () => {
        mockMetadataThenFailure();
        const client = await ApiClient.init( DEV );
        await expect( client.fetchNationalCalendar( 'IT' ) ).rejects.toBeInstanceOf( ApiClientError );
    } );

    it( 'rejects from fetchDiocesanCalendar too', async () => {
        mockMetadataThenFailure();
        const client = await ApiClient.init( DEV );
        await expect( client.fetchDiocesanCalendar( 'romamo_it' ) ).rejects.toBeInstanceOf( ApiClientError );
    } );

} );
```

Note: the test calls `client.on( ... )`. Confirm that `ApiClient` exposes a public subscription method; if the
only path is the private `#eventBus`, add a public `on( event, listener )` that delegates to it, with JSDoc,
as part of Step 3.

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/ApiClientErrors.test.js`

Expected: FAIL — `init()` resolves rather than rejecting.

- [ ] **Step 3: Make the fetch methods return and reject**

In each of `fetchCalendar`, `fetchNationalCalendar` and `fetchDiocesanCalendar`, `return` the fetch chain and
replace the trailing handlers. For `fetchCalendar` the cached-hit branch becomes:

```js
    const cachedData = this.#getCachedData(cacheKey);
    if (cachedData) {
      this.#calendarData = cachedData;
      this.#eventBus.emit('calendarFetched', cachedData, { rite: requestRite });
      return Promise.resolve( cachedData );
    }
```

and the request itself becomes:

```js
    const riteSegment = this.#base.supportsRite ? `/${requestRite}` : '';
    const requestUrl  = `${this.#base.url}${ApiClient.#paths.calendar}${riteSegment}${year ? `/${year}` : ''}`;
    return fetch( requestUrl, {
      method: 'POST',
      headers: this.#fetchCalendarHeaders,
      body: JSON.stringify( params )
    }).then( response => {
      if ( false === response.ok ) {
        return response.text()
          .catch( () => null )
          .then( body => {
            throw new ApiClientError(
              `POST ${requestUrl} failed: ${response.status} ${response.statusText}`,
              { url: requestUrl, status: response.status, statusText: response.statusText, body }
            );
          } );
      }
      return response.json();
    }).then( data => {
      // Cache regardless: the response is valid for its own key even if a newer
      // request has superseded it, and caching it saves refetching later.
      this.#setCachedData(cacheKey, data);
      if ( requestRevision !== this.#requestRevision ) {
        return this.#calendarData;
      }
      this.#calendarData = data;
      this.#eventBus.emit( 'calendarFetched', data, { rite: requestRite } );
      return this.#calendarData;
    }).catch( error => {
      const apiError = error instanceof ApiClientError
        ? error
        : new ApiClientError( `POST ${requestUrl} failed: ${error.message}`, { url: requestUrl, cause: error } );
      this.#eventBus.emit( 'calendarFetchFailed', apiError, { rite: requestRite } );
      throw apiError;
    });
```

Apply the same three changes to `fetchNationalCalendar` and `fetchDiocesanCalendar`, keeping each method's own
`requestUrl` construction (`/nation/${calendar_id}` and `/diocese/${calendar_id}` respectively) and its own
cached-hit branch.

Add the import at the top of the file:

```js
import ApiClientError from './ApiClientError.js';
```

If `ApiClient` has no public subscription method, add one beside the other public methods:

```js
  /**
   * Subscribes a listener to one of this client's events.
   *
   * Events: `calendarFetched` — `( data, { rite } )` — and `calendarFetchFailed`
   * — `( error, { rite } )`.
   *
   * @param {string} event - The event name.
   * @param {Function} listener - The listener to invoke.
   * @returns {ApiClient} This client, for chaining.
   */
  on( event, listener ) {
    this.#eventBus.on( event, listener );
    return this;
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test src/__tests__/ApiClientErrors.test.js`

Expected: PASS, 10 tests.

- [ ] **Step 5: Verify the whole suite and the compile**

Run: `yarn test && yarn compile`

Expected: every suite green; `yarn compile` exits 0. Existing suites that assert on the old
swallow-and-return-false behaviour must be updated here.

- [ ] **Step 6: Commit**

```bash
git add src/ApiClient/ApiClient.js src/__tests__/ApiClientErrors.test.js
git commit -m "Propagate API failures as ApiClientError instead of swallowing them"
```

---

### Task 7: Bind `CalendarSelect` to a base

**Files:**

- Modify: `src/ApiClient/ApiBase.js` (append the `resolveBase` named export after the class — Step 3)
- Modify: `src/CalendarSelect/CalendarSelect.js` (statics at `:31`–`:33`, `#init()` at `:127`, the constructor
  at `:167`, the `#init()` guard at `:217`–`:219`, the diocesan filter at `:372`, the national list at `:340`)
- Test: `src/__tests__/ComponentBinding.test.js`

**Interfaces:**

- Consumes: `ApiBase`, `ApiClient` from earlier tasks.
- Produces: `new CalendarSelect( { locale, apiClient } )`; the package-internal getter `calendarSelect._base`
  returning the bound `ApiBase`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/ComponentBinding.test.js`:

```js
/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiClient from '../ApiClient/ApiClient.js';
import ApiBase from '../ApiClient/ApiBase.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import { FULL_METADATA, OTHER_METADATA } from '../__fixtures__/metadata.js';

const DEV  = 'http://localhost:8000';
const PROD = 'https://example.org/api/dev';

beforeEach( () => {
    ApiBase.reset();
} );

/** Builds a client bound to a fixture base without any network call. */
const clientFor = ( url, metadata ) => {
    const base = ApiBase.fromMetadata( url, metadata );
    return { base };
};

describe( 'CalendarSelect binding', () => {

    it( 'reads the metadata of the base it is bound to', () => {
        const dev  = clientFor( DEV, FULL_METADATA );
        const prod = clientFor( PROD, OTHER_METADATA );
        const devSelect  = new CalendarSelect( { locale: 'en', apiClient: dev } );
        const prodSelect = new CalendarSelect( { locale: 'en', apiClient: prod } );
        expect( devSelect.nationsInnerHtml ).toContain( 'value="IT"' );
        expect( devSelect.nationsInnerHtml ).not.toContain( 'value="NL"' );
        expect( prodSelect.nationsInnerHtml ).toContain( 'value="NL"' );
        expect( prodSelect.nationsInnerHtml ).not.toContain( 'value="IT"' );
    } );

    it( 'exposes the base it resolved', () => {
        const dev = clientFor( DEV, FULL_METADATA );
        const select = new CalendarSelect( { locale: 'en', apiClient: dev } );
        expect( select._base ).toBe( ApiBase.resolve( DEV ) );
    } );

    it( 'falls back to the first registered base when no client is given', () => {
        ApiBase.fromMetadata( DEV, FULL_METADATA );
        const select = new CalendarSelect( 'en' );
        expect( select._base ).toBe( ApiBase.resolve( DEV ) );
    } );

    it( 'does not warn on the fallback when only one base is registered', () => {
        const warn = jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
        ApiBase.fromMetadata( DEV, FULL_METADATA );
        new CalendarSelect( 'en' );
        expect( warn ).not.toHaveBeenCalled();
        warn.mockRestore();
    } );

    it( 'warns on the fallback when more than one base is registered, naming its choice', () => {
        const warn = jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
        ApiBase.fromMetadata( DEV, FULL_METADATA );
        ApiBase.fromMetadata( PROD, OTHER_METADATA );
        new CalendarSelect( 'en' );
        expect( warn ).toHaveBeenCalledWith( expect.stringContaining( DEV ) );
        expect( warn ).toHaveBeenCalledWith( expect.stringContaining( 'CalendarSelect' ) );
        warn.mockRestore();
    } );

    it( 'throws when no base is registered at all', () => {
        expect( () => new CalendarSelect( 'en' ) ).toThrow( /has not been initialized/ );
    } );

    it( 'names the component in the uninitialized error', () => {
        expect( () => new CalendarSelect( 'en' ) ).toThrow( /CalendarSelect/ );
    } );

} );
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/ComponentBinding.test.js`

Expected: FAIL — `select._base` is undefined.

- [ ] **Step 3: Add a shared base resolver**

Create the resolver as a named export in `src/ApiClient/ApiBase.js`, appended after the class:

```js
/**
 * Resolves the API base a component should read its metadata from.
 *
 * Prefers the base of an explicitly supplied client. Falling back to the first
 * registered base keeps every page written before per-base binding working
 * untouched — but the fallback announces itself once more than one base exists,
 * because a component silently reading the wrong API's calendars is the exact
 * failure this release removes.
 *
 * @param {{base: ApiBase}|null|undefined} apiClient - The client to bind to, if any.
 * @param {string} componentName - The binding component's class name, for messages.
 * @returns {ApiBase} The resolved base.
 * @throws {Error} If no client is given and no base is registered.
 */
export function resolveBase( apiClient, componentName ) {
    if ( apiClient !== null && apiClient !== undefined ) {
        if ( false === apiClient.base instanceof ApiBase ) {
            throw new Error( `${componentName}: the apiClient option must be an ApiClient obtained from ApiClient.init().` );
        }
        return apiClient.base;
    }
    const fallback = ApiBase.default;
    if ( null === fallback ) {
        throw new Error( `${componentName}: ApiClient has not been initialized. Please initialize with \`ApiClient.init().then(() => { ... })\`, and construct ${componentName} instances within the callback.` );
    }
    if ( ApiBase.all.length > 1 ) {
        console.warn( `${componentName} was constructed without an apiClient while ${ApiBase.all.length} API bases are registered, and bound to ${fallback.url}. Pass \`apiClient\` explicitly to choose.` );
    }
    return fallback;
}
```

- [ ] **Step 4: Bind `CalendarSelect`**

Delete the `static #metadata`, `static #nationalCalendars` and `static #diocesanCalendars` declarations and
the whole `static #init()` method.

Add instance fields beside the other instance fields:

```js
    /** @type {ApiBase} */
    #base                                 = null;

    /** @type {import('../typedefs.js').NationalCalendar[]} */
    #nationalCalendars                    = [];

    /** @type {import('../typedefs.js').DiocesanCalendar[]} */
    #diocesanCalendars                    = [];
```

Add the import:

```js
import ApiBase, { resolveBase } from '../ApiClient/ApiBase.js';
```

Destructure `apiClient` from the options in the constructor by extending the existing destructuring at `:178`:

```js
        const { locale: inputLocale, id, name, filter, after, label, wrapper, allowNull, disabled, rite, apiClient } = options;
```

Replace the three-line guard at `:217`–`:219`, which currently reads

```js
        if (null === CalendarSelect.#metadata) {
            CalendarSelect.#init();
        }
```

with:

```js
        this.#base              = resolveBase( apiClient, 'CalendarSelect' );
        this.#nationalCalendars = this.#base.nationalCalendars();
        this.#diocesanCalendars = this.#base.diocesanCalendars( this.#rite );
```

This must stay ahead of the `this.#buildAllOptions()` call on the next line, which reads both lists, and after
the `rite` handling at `:206`–`:214`, which sets `this.#rite`.

Replace every remaining `CalendarSelect.#nationalCalendars` with `this.#nationalCalendars` and every
`CalendarSelect.#diocesanCalendars` with `this.#diocesanCalendars`.

At `:372`, the diocesan rite filter is now performed by `ApiBase.diocesanCalendars( rite )`, so replace the
inline `.filter( diocesanCalendarObj => ( diocesanCalendarObj.rite ?? Rite.ROMAN ) === this.#rite )` with a
re-read from the base:

```js
        const diocesanCalendarsForRite = this.#base.diocesanCalendars( this.#rite );
```

and use `diocesanCalendarsForRite` where the filtered array was used.

Add the package-internal getter beside the other underscore-prefixed members:

```js
    /**
     * The API base this select reads its calendars from.
     *
     * Package-internal: `PathBuilder` uses it to verify that the select and the
     * `ApiOptions` it is paired with are bound to the same API.
     *
     * @returns {ApiBase}
     */
    get _base() {
        return this.#base;
    }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `yarn test src/__tests__/ComponentBinding.test.js`

Expected: PASS, 7 tests.

- [ ] **Step 6: Verify the whole suite and the compile**

Run: `yarn test && yarn compile`

Expected: every suite green. `CalendarSelect.test.js`, `CalendarSelectRiteLink.test.js` and
`CalendarSelectLegacyMetadata.test.js` exercise this class heavily; fix any breakage here.

- [ ] **Step 7: Commit**

```bash
git add src/ApiClient/ApiBase.js src/CalendarSelect/CalendarSelect.js src/__tests__/ComponentBinding.test.js
git commit -m "Bind CalendarSelect to an ApiBase through an apiClient option"
```

---

### Task 8: Bind `ApiOptions` and `LocaleInput` to a base

**Files:**

- Modify: `src/ApiOptions/ApiOptions.js` (constructor at `:137`, and the `ApiClient._metadata` reads at
  `:246`, `:320`, `:474`, `:480`)
- Modify: `src/ApiOptions/Input/LocaleInput.js` (statics at `:6`–`:7`, constructor at `:24`)
- Test: `src/__tests__/ComponentBinding.test.js` (append)

**Interfaces:**

- Consumes: `resolveBase` and `ApiBase` from Task 7, `ApiBase.riteCalendars()` and `ApiBase.locales()` from
  Task 4.
- Produces: `new ApiOptions( { locale, apiClient } )` accepting the existing string form too;
  `apiOptions._base`; `new LocaleInput( locale, base )`.

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/ComponentBinding.test.js`:

```js
describe( 'ApiOptions binding', () => {

    it( 'accepts a locale string as before', () => {
        ApiBase.fromMetadata( DEV, FULL_METADATA );
        const apiOptions = new ApiOptions( 'it-IT' );
        expect( apiOptions._base ).toBe( ApiBase.resolve( DEV ) );
    } );

    it( 'binds to the client it is given', () => {
        ApiBase.fromMetadata( DEV, FULL_METADATA );
        const prod = clientFor( PROD, OTHER_METADATA );
        const apiOptions = new ApiOptions( { locale: 'en', apiClient: prod } );
        expect( apiOptions._base ).toBe( ApiBase.resolve( PROD ) );
    } );

    it( 'offers the locales of its own base', () => {
        const dev  = clientFor( DEV, FULL_METADATA );
        const prod = clientFor( PROD, OTHER_METADATA );
        const devOptions  = new ApiOptions( { locale: 'en', apiClient: dev } );
        const prodOptions = new ApiOptions( { locale: 'en', apiClient: prod } );
        expect( devOptions._localeInput.options() ).toEqual( expect.arrayContaining( [ 'it' ] ) );
        expect( prodOptions._localeInput.options() ).toEqual( [ 'nl' ] );
    } );

    it( 'warns on the fallback when more than one base is registered', () => {
        const warn = jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
        ApiBase.fromMetadata( DEV, FULL_METADATA );
        ApiBase.fromMetadata( PROD, OTHER_METADATA );
        new ApiOptions( 'en' );
        expect( warn ).toHaveBeenCalledWith( expect.stringContaining( 'ApiOptions' ) );
        warn.mockRestore();
    } );

    it( 'throws when no base is registered at all', () => {
        expect( () => new ApiOptions( 'en' ) ).toThrow( /has not been initialized/ );
    } );

} );
```

Add the import at the top of the file:

```js
import ApiOptions from '../ApiOptions/ApiOptions.js';
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/ComponentBinding.test.js`

Expected: FAIL — `apiOptions._base` is undefined.

- [ ] **Step 3: Bind `LocaleInput`**

Delete the `static #apiLocales` and `static #apiLocalesDisplay` declarations. Add instance fields:

```js
    /** @type {ApiBase} */
    #base              = null;

    /** @type {string[]} */
    #apiLocales        = null;

    /** @type {Object<string, Map<string, string>>} */
    #apiLocalesDisplay = {};
```

Change the constructor signature and the metadata reads:

```js
    /**
     * Constructs a LocaleInput object.
     *
     * @param {string|Intl.Locale|null} locale - The locale to use for the select element.
     * @param {ApiBase} base - The API base whose supported locales this input offers.
     *
     * @throws {Error} If the locale is invalid, or the base has not been loaded.
     */
    constructor( locale = null, base = null ) {
        super();
        this._domElement.name = 'locale';
        this._domElement.id = 'locale';
        this._labelElement.textContent = 'locale';
        this._labelElement.htmlFor = this._domElement.id;
        if ( null === base ) {
            throw new Error( 'LocaleInput requires an ApiBase. It is constructed by ApiOptions, which supplies one; construct an ApiOptions rather than a LocaleInput directly.' );
        }
        this.#base = base;
```

Replace the `if (ApiClient._metadata === null) { throw ... }` block with nothing — the base itself now
guarantees loaded metadata — and replace the locales read:

```js
        if (this.#apiLocales === null) {
            this.#apiLocales = this.#base.locales();
        }
```

Replace every remaining `LocaleInput.#apiLocales` with `this.#apiLocales` and every
`LocaleInput.#apiLocalesDisplay` with `this.#apiLocalesDisplay`. Remove the now-unused
`import ApiClient from "../../ApiClient/ApiClient.js";`.

- [ ] **Step 4: Bind `ApiOptions`**

Add the import:

```js
import ApiBase, { resolveBase } from '../ApiClient/ApiBase.js';
```

Add an instance field beside the others:

```js
    /** @type {ApiBase} */
    #base                  = null;
```

Change the constructor to accept both forms:

```js
    /**
     * Constructs an ApiOptions form.
     *
     * @param {string|{locale?: string, apiClient?: ApiClient}} [options] - A locale string,
     *        or an options object. `apiClient` binds this form to that client's API base;
     *        omitting it binds to the first base registered.
     * @throws {Error} If the locale is invalid, or no API base is available.
     */
    constructor( options = 'en' ) {
        const { locale = 'en', apiClient = null } = typeof options === 'string'
            ? { locale: options }
            : ( options ?? {} );
        this.#base = resolveBase( apiClient, 'ApiOptions' );
        const normalizedLocale = locale.replaceAll('_', '-');
        const canonicalLocales = Intl.getCanonicalLocales(normalizedLocale);
        if (canonicalLocales.length === 0) {
            throw new Error('Invalid locale: ' + normalizedLocale);
        }
        this.#locale = new Intl.Locale(canonicalLocales[0]);
```

and pass the base to `LocaleInput`:

```js
        this.#inputs.localeInput = new LocaleInput(this.#locale, this.#base);
```

Replace the four `ApiClient._metadata` reads:

- `:246` —
  `const nationalCalendarForDiocese = this.#base.nationalCalendars().find( nationCalendarObj => nationCalendarObj.calendar_id === diocesanCalendar.nation );`
- `:320` — `const riteCalendars = this.#base.riteCalendars( rite );` and drop the now-redundant
  `Array.isArray( riteCalendars )` guard, since `riteCalendars()` always returns an array:

```js
        const riteLevelCalendar = riteCalendars.find( calendar => calendar.calendar_id === rite ) ?? null;
```

- `:474` —
  `const nationalCalendar = this.#base.nationalCalendars().find( obj => obj.calendar_id === calendarId );`
- `:480` —
  `const diocesanCalendar = this.#base.metadata.diocesan_calendars.find( obj => obj.calendar_id === calendarId );`

Add the package-internal getter:

```js
    /**
     * The API base this form reads its metadata from.
     *
     * Package-internal: `PathBuilder` uses it to verify that the form and the
     * `CalendarSelect` it is paired with are bound to the same API.
     *
     * @returns {ApiBase}
     */
    get _base() {
        return this.#base;
    }
```

Remove the `import ApiClient from ...` line if nothing else in the file uses it.

- [ ] **Step 5: Run the test to verify it passes**

Run: `yarn test src/__tests__/ComponentBinding.test.js`

Expected: PASS, 12 tests.

- [ ] **Step 6: Verify the whole suite and the compile**

Run: `yarn test && yarn compile`

Expected: every suite green. `ApiOptionsRite.test.js`, `ApiOptionsRiteSettings.test.js`,
`ApiOptionsRiteCharacterization.test.js` and `ApiOptionsPathBuilderFilterSwitch.test.js` exercise these
classes; fix any breakage here.

- [ ] **Step 7: Commit**

```bash
git add src/ApiOptions/ApiOptions.js src/ApiOptions/Input/LocaleInput.js src/__tests__/ComponentBinding.test.js
git commit -m "Bind ApiOptions and LocaleInput to an ApiBase"
```

---

### Task 9: Bind `PathBuilder` and guard against mismatched bases

**Files:**

- Modify: `src/PathBuilder/PathBuilder.js` (constructor at `:36`, the URL reads at `:64` and `:177`)
- Modify: `src/CalendarSelect/CalendarSelect.js` — `linkToNationsSelect()` and `linkToRiteSelect()`
- Test: `src/__tests__/ComponentBinding.test.js` (append)

**Interfaces:**

- Consumes: `apiOptions._base` from Task 8 and `calendarSelect._base` from Task 7.
- Produces: a `PathBuilder` that renders its own base's URL and throws when its two arguments disagree about
  the base; `linkToNationsSelect()` and `linkToRiteSelect()` that throw on the same mismatch.

**The guard belongs on every pairing, not only `PathBuilder`.** `linkToNationsSelect()` narrows one select's
diocese list using another select's chosen nation. Given two selects bound to different bases, the dioceses
come from one API and the nations from another, and the result is a silently wrong option list — the same
failure `PathBuilder`'s guard exists to catch, in a place a user is more likely to reach. Apply the identical
check and the identical error shape, naming both URLs, in `linkToNationsSelect()` and `linkToRiteSelect()`.

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/ComponentBinding.test.js`:

```js
describe( 'PathBuilder binding', () => {

    it( 'renders the url of the base its arguments share', () => {
        ApiBase.fromMetadata( DEV, FULL_METADATA );
        const prodClient = clientFor( PROD, OTHER_METADATA );
        const apiOptions     = new ApiOptions( { locale: 'en', apiClient: prodClient } );
        const calendarSelect = new CalendarSelect( { locale: 'en', apiClient: prodClient } );
        const pathBuilder    = new PathBuilder( apiOptions, calendarSelect );
        expect( pathBuilder._domElement.textContent ).toContain( PROD );
        expect( pathBuilder._domElement.textContent ).not.toContain( DEV );
    } );

    it( 'throws when its arguments are bound to different bases, naming both', () => {
        const devClient  = clientFor( DEV, FULL_METADATA );
        const prodClient = clientFor( PROD, OTHER_METADATA );
        const apiOptions     = new ApiOptions( { locale: 'en', apiClient: devClient } );
        const calendarSelect = new CalendarSelect( { locale: 'en', apiClient: prodClient } );
        expect( () => new PathBuilder( apiOptions, calendarSelect ) ).toThrow( /different API bases/ );
        expect( () => new PathBuilder( apiOptions, calendarSelect ) ).toThrow( new RegExp( DEV.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ) ) );
        expect( () => new PathBuilder( apiOptions, calendarSelect ) ).toThrow( /example\.org/ );
    } );

} );
```

Add the import at the top of the file:

```js
import PathBuilder from '../PathBuilder/PathBuilder.js';
```

If `PathBuilder` exposes no `_domElement` accessor, add one in Step 3 alongside the other changes.

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/ComponentBinding.test.js`

Expected: FAIL — the rendered path contains the fallback base's URL, and no mismatch error is thrown.

- [ ] **Step 3: Bind `PathBuilder`**

Add an instance field:

```js
    /** @type {ApiBase} */
    #base;
```

Add the import:

```js
import ApiBase from '../ApiClient/ApiBase.js';
```

In the constructor, immediately after the two existing `instanceof` guards, add:

```js
        if ( apiOptions._base !== calendarSelect._base ) {
            throw new Error(
                `PathBuilder: the apiOptions and calendarSelect passed to it are bound to different API bases — `
                + `${apiOptions._base.url} and ${calendarSelect._base.url}. A path built from one API's options and `
                + `another API's calendars would point at neither.`
            );
        }
        this.#base = apiOptions._base;
```

Replace `this.#pathCodeElement.textContent = ApiClient._apiUrl;` at `:64` with:

```js
        this.#pathCodeElement.textContent = this.#base.url;
```

Replace `const finalPath = (ApiClient._apiUrl + this.#currentEndpoint.serialize());` at `:177` with:

```js
        const finalPath = (this.#base.url + this.#currentEndpoint.serialize());
```

Remove the `import ApiClient from ...` line if nothing else in the file uses it.

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test src/__tests__/ComponentBinding.test.js`

Expected: PASS, 14 tests.

- [ ] **Step 5: Verify the whole suite and the compile**

Run: `yarn test && yarn compile`

Expected: every suite green; `yarn compile` exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/PathBuilder/PathBuilder.js src/__tests__/ComponentBinding.test.js
git commit -m "Bind PathBuilder to its arguments' base and reject a mismatch"
```

---

### Task 10: Migrate the existing suite to fixtures

**Files:**

- Modify: every file in `src/__tests__/` that calls `ApiClient.init()` — `ApiClientRite.test.js`,
  `ApiClientRiteLegacyMetadata.test.js`, `ApiOptionsPathBuilderFilterSwitch.test.js`,
  `ApiOptionsRite.test.js`, `ApiOptionsRiteCharacterization.test.js`, `ApiOptionsRiteSettings.test.js`,
  `CalendarSelect.test.js`, `CalendarSelectLegacyMetadata.test.js`, `CalendarSelectRiteLink.test.js`,
  `WebCalendarRiteCaption.test.js`, and any other file the grep in Step 1 reports

**Interfaces:**

- Consumes: `ApiBase.reset()`, `ApiBase.fromMetadata()` and the fixtures from Task 2.
- Produces: no production change. A suite that no longer mocks `global.fetch` to obtain metadata.

- [ ] **Step 1: List the files to migrate**

Run: `grep -rln "ApiClient.init" src/__tests__/`

Expected: the file list above. Work through it in the order printed.

- [ ] **Step 2: Migrate one file and confirm the pattern**

In `src/__tests__/CalendarSelectLegacyMetadata.test.js`, delete the `global.fetch` mock and the
`await ApiClient.init()` in `beforeAll`, delete the local `V5_METADATA` constant, and replace the setup with:

```js
import { beforeEach, describe, it, expect } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import { Rite } from '../Enums.js';
import { V5_METADATA } from '../__fixtures__/metadata.js';

beforeEach( () => {
    ApiBase.reset();
    ApiBase.fromMetadata( 'http://localhost:8000', V5_METADATA );
} );
```

Delete the file's header comment paragraph beginning "Deliberately in its own test file", which documented the
module-registry constraint this change removes, and replace it with:

```js
/**
 * The shape the LIVE v5 API returns: diocesan entries carry NO `rite` field at
 * all. Only v6 announces one.
 *
 * A consumer pinned to v5 who bumps this package gets this metadata, so strict
 * `obj.rite === this.#rite` filtering would drop every diocese and empty the
 * list with no error and no warning. A missing `rite` means Roman: the rite
 * partition is a v6 addition, and everything v5 ever served was Roman.
 */
```

Run: `yarn test src/__tests__/CalendarSelectLegacyMetadata.test.js`

Expected: PASS, with the same assertions as before.

- [ ] **Step 3: Migrate the remaining files**

For each remaining file, apply the same three changes: replace the `global.fetch` mock and `ApiClient.init()`
setup with `ApiBase.reset()` plus `ApiBase.fromMetadata( url, fixture )` in a `beforeEach`; import the fixture
from `../__fixtures__/metadata.js` rather than declaring it locally; and where the test needs an `ApiClient`
instance, keep `await ApiClient.init( url )` — it now resolves instantly against the pre-loaded base without
touching `fetch`.

Where a test asserts on the number of `fetch` calls for calendar data (not metadata), keep its `global.fetch`
mock for those calls only.

- [ ] **Step 4: Verify the whole suite**

Run: `yarn test`

Expected: every suite green, with the same total test count as after Task 9.

- [ ] **Step 5: Confirm no test reaches the network**

Run: `grep -rn "litcal.johnromanodorazio.com" src/__tests__/ || echo "no live host referenced"`

Expected: `no live host referenced`, or matches only inside string assertions about the default URL constant.

- [ ] **Step 6: Commit**

```bash
git add src/__tests__/
git commit -m "Migrate the test suite to ApiBase fixtures instead of fetch mocks"
```

---

### Task 11: Update the examples and add the comparison page

**Files:**

- Modify: `examples/LiturgyOfAnyDay/main.js`, `examples/LiturgyOfTheDay/main.js`,
  `examples/MultipleForms/main.js`, `examples/PathBuilder/main.js`, `examples/RiteSelectChain/main.js`,
  `examples/RiteSelectPathBuilder/main.js`, `examples/RiteSelectWebCalendar/main.js`,
  `examples/WebCalendar/main.js`
- Modify: every file under `src/stories/` that calls `ApiClient.init()`
- Modify: `.storybook/preview.ts` — its `loaders` array awaits `ApiClient.init()` at line 15, outside
  `src/stories/`, so the grep in Step 3 will not find it
- Modify: `README.md`'s quick-start snippet, which still shows the `if ( !apiClient )` guard
- Create: `examples/CompareBases/index.html`, `examples/CompareBases/main.js`

**Interfaces:**

- Consumes: everything from Tasks 1–9.
- Produces: no library change. Working examples under the rejecting `init()`.

**Two distinct kinds of call site, needing two greps.** `init()` is only half of it. The three fetch
methods now reject too, and `ApiClient`'s internal `#discardRequest` suppressor deliberately covers only
the library's own fire-and-forget paths — a consumer's own `apiClient.fetchCalendar( locale )` is the
consumer's promise, so an unhandled rejection there is correct behaviour and must be handled at the call
site. Both greps are needed:

```bash
grep -rn "ApiClient.init" examples/ src/stories/ .storybook/
grep -rn "\.fetchCalendar(\|\.fetchNationalCalendar(\|\.fetchDiocesanCalendar(" examples/ src/stories/
```

The second finds roughly five discarded calls in `examples/` and seven in `src/stories/` that the first
misses entirely. Each needs a `.catch()` rendering the failure where that page or story already renders
its errors.

- [ ] **Step 1: Update one example and confirm the pattern**

In `examples/WebCalendar/main.js`, replace the
`ApiClient.init( ... ).then( apiClient => { if ( !apiClient || ... ) { ... } else { ... } } )` wrapper with:

```js
ApiClient.init('http://localhost:8000').then( apiClient => {
    // ... the existing body of the `else` branch, unchanged and de-indented ...
} ).catch( error => {
    document.querySelector('#litcalWebcalendar').textContent =
        `Could not reach the Liturgical Calendar API at ${error.url ?? 'the configured base'}: ${error.message}`;
} );
```

The `if ( !apiClient || !( apiClient instanceof ApiClient ) )` guard is dead under a rejecting `init()` and is
removed.

- [ ] **Step 2: Update the remaining seven examples**

Apply the same change to each, targeting whichever element that example already used for its error message.

- [ ] **Step 3: Update the stories and the Storybook preview**

Run: `grep -rln "ApiClient.init" src/stories/ .storybook/`

`.storybook/preview.ts:15` awaits `ApiClient.init()` inside a `loaders` entry. A rejecting `init()` makes
that loader reject, which kills every story rather than letting each render its own error message, so it
needs a `.catch` that resolves to a sentinel the stories can test — keep `apiClient` as the loader's key
and give it `null` on failure, since the stories already guard on a falsy client.

For each file, the existing error branch reads

```js
container.textContent = 'Error initializing the Liturgical Calendar API Client, check that the API is running at ' + ApiClient._apiUrl;
```

Move that line into a `.catch( error => { ... } )` and read the URL from the error rather than the deprecated
static:

```js
} ).catch( error => {
    container.textContent = 'Error initializing the Liturgical Calendar API Client, check that the API is running at ' + ( error.url ?? ApiBase.DEFAULT_URL );
} );
```

adding `import { ApiBase } from '../../index.js';` where the story does not already import it.

- [ ] **Step 4: Create `examples/CompareBases/index.html`**

```html
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Compare two API bases — Liturgical Calendar components</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="p-4">
    <h1 class="h3 mb-4">Compare two API bases</h1>
    <p class="text-muted">
        Each pane is driven by its own <code>ApiClient</code>, bound to its own API base. A pane whose
        API is unreachable reports the failure without affecting the other.
    </p>
    <div class="row g-4">
        <section class="col-lg-6">
            <h2 class="h5" id="devHeading">http://localhost:8000</h2>
            <div id="devControls" class="row g-2 mb-3"></div>
            <div id="devCalendar"></div>
        </section>
        <section class="col-lg-6">
            <h2 class="h5" id="prodHeading">https://litcal.johnromanodorazio.com/api/dev</h2>
            <div id="prodControls" class="row g-2 mb-3"></div>
            <div id="prodCalendar"></div>
        </section>
    </div>
    <script type="module" src="./main.js"></script>
</body>
</html>
```

- [ ] **Step 5: Create `examples/CompareBases/main.js`**

```js
import { ApiClient, CalendarSelect, ApiOptions, WebCalendar, ApiOptionsFilter, Grouping, ColorAs } from 'liturgy-components-js';

const BASES = [
    { url: 'http://localhost:8000',                          controls: '#devControls',  calendar: '#devCalendar'  },
    { url: 'https://litcal.johnromanodorazio.com/api/dev',   controls: '#prodControls', calendar: '#prodCalendar' }
];

/**
 * Builds one independent pane: its own client, its own controls, its own table.
 *
 * Nothing is shared between panes but the DOM they are appended to, so a base that
 * is down fails inside its own pane only.
 *
 * @param {{url: string, controls: string, calendar: string}} pane - The pane's base URL and target selectors.
 * @returns {Promise<void>}
 */
const buildPane = async ( pane ) => {
    try {
        const apiClient = await ApiClient.init( pane.url );

        const calendarSelect = new CalendarSelect( { locale: 'en', apiClient } )
            .class( 'form-select' )
            .label( { text: 'Calendar', class: 'form-label' } )
            .wrapper( { as: 'div', class: 'col-md-6' } )
            .allowNull( true );
        calendarSelect.appendTo( pane.controls );

        const apiOptions = new ApiOptions( { locale: 'en', apiClient } )
            .filter( ApiOptionsFilter.LOCALE_ONLY )
            .linkToCalendarSelect( calendarSelect );
        apiOptions.appendTo( pane.controls );

        const webCalendar = new WebCalendar()
            .class( 'table table-sm table-striped' )
            .firstColumnGrouping( Grouping.BY_MONTH )
            .seasonColor( ColorAs.CSS_CLASS )
            .listenTo( apiClient );
        webCalendar.appendTo( pane.calendar );

        apiClient.on( 'calendarFetchFailed', error => {
            document.querySelector( pane.calendar ).textContent =
                `Request failed: ${error.message}`;
        } );

        apiClient.listenTo( calendarSelect ).listenTo( apiOptions );
        apiClient.fetchCalendar( 'en' );
    } catch ( error ) {
        document.querySelector( pane.calendar ).innerHTML =
            `<div class="alert alert-warning mb-0">Could not reach <code>${pane.url}</code>: ${error.message}</div>`;
    }
};

BASES.forEach( buildPane );
```

- [ ] **Step 6: Verify the suite and the compile**

Run: `yarn test && yarn compile`

Expected: every suite green; `yarn compile` exits 0. The examples are not covered by Jest; verify them by eye
in Step 7.

- [ ] **Step 7: Verify the comparison page by hand**

Start the API locally per `LiturgicalCalendarAPI`'s `composer start`, serve the examples directory, and open
`examples/CompareBases/index.html`. Confirm that both panes render a calendar, then stop the local API,
reload, and confirm the left pane shows its warning while the right pane still renders.

Record the outcome in the commit message if the local API was not available to test against.

- [ ] **Step 8: Commit**

```bash
git add examples/ src/stories/
git commit -m "Update examples and stories for the rejecting init(), add a comparison page"
```

---

### Task 12: Documentation and the version bump

**Files:**

- Modify: `README.md`, `CLAUDE.md`, `package.json`
- Create or modify: `CHANGELOG.md`

**Interfaces:**

- Consumes: the finished implementation.
- Produces: version `2.0.0` in `package.json`, and a migration note.

- [ ] **Step 1: Add the changelog entry**

Add at the top of `CHANGELOG.md`, creating the file with an `# Changelog` heading if it does not exist:

````markdown
## 2.0.0

### Breaking

- `ApiClient.init()` now **rejects** with an `ApiClientError` when the API cannot be
  reached, instead of resolving to `false`. Add a `.catch()` — or wrap the `await` in
  `try`/`catch` — at every call site:

  ```js
  // Before
  ApiClient.init( BASE ).then( apiClient => {
      if ( !apiClient || !( apiClient instanceof ApiClient ) ) {
          // handle failure
      }
  } );

  // After
  ApiClient.init( BASE )
      .then( apiClient => { /* … */ } )
      .catch( error => {
          // error.url, error.status, error.statusText, error.body
      } );
  ```

### Added

- `ApiBase`: one object per API base, owning its URL, its calendar index and its
  response cache. Two bases can now be used on one page — see
  `examples/CompareBases/`.
- An `apiClient` option on `CalendarSelect`, `ApiOptions` and `PathBuilder`, binding a
  component to a specific base. Omitting it binds to the first base initialized, so
  existing single-base code is unaffected.
- `ApiClientError`, carrying `url`, `status`, `statusText` and `body`.
- The `calendarFetchFailed` event, emitted as `( error, { rite } )`.
- `ApiBase.isValidDioceseForNation( dioceseId, nation )`.
- Response caches are now bounded: 50 entries per base by default, with optional
  expiry, both configurable through `ApiBase.cacheLimits()`.
- `CalendarIndex`, `NationalCalendar`, `DiocesanCalendar`, `DiocesanGroup` and
  `WiderRegion` typedefs.

### Fixed

- `ApiClient.init()` called with a second base URL no longer leaves the client
  pointing at the new API while reporting the first API's calendars.
- Calendar responses are no longer served from one base's cache to another's.
- Concurrent `ApiClient.init()` calls no longer issue duplicate `/calendars` requests.
- `ApiClient._metadata` was typed as `CalendarMetadata`, the per-response metadata
  block, rather than as the `/calendars` index it actually returns.

### Deprecated

- `ApiClient._apiUrl` and `ApiClient._metadata` resolve to the first registered base
  and warn when more than one is registered. Read `apiClient.base.url` and
  `apiClient.base.metadata` instead.

````

- [ ] **Step 2: Set the version**

In `package.json`, change `"version": "1.5.0"` to `"version": "2.0.0"`.

If v1.6.0 has been released in the meantime, this is still `2.0.0`.

- [ ] **Step 3: Document the binding in `README.md`**

Add a section after the existing `ApiClient` documentation:

````markdown
### Using two API bases on one page

Each `ApiClient` is bound to an `ApiBase` — one object per API base URL, owning that
base's calendar index and response cache. Passing a client to a component binds the
component to that base:

```js
const dev  = await ApiClient.init( 'http://localhost:8000' );
const prod = await ApiClient.init( 'https://litcal.johnromanodorazio.com/api/dev' );

const devSelect  = new CalendarSelect( { locale: 'en', apiClient: dev } );
const prodSelect = new CalendarSelect( { locale: 'en', apiClient: prod } );
```

Omitting `apiClient` binds to the first base initialized, so single-base pages need no
change. When more than one base is registered, an unbound component warns and names the
base it chose.

`ApiClient.init()` returns a **new** client on every call, including for a base already
registered — only the metadata and cache are shared. That is what allows two clients on
one API to hold different rites:

```js
const roman     = await ApiClient.init( BASE );
const ambrosian = await ApiClient.init( BASE );
ambrosian.rite( Rite.AMBROSIAN );
```

See `examples/CompareBases/` for a complete two-pane page.

````

- [ ] **Step 4: Document the binding in `CLAUDE.md`**

Add the same `apiClient` option to the `CalendarSelect` and `ApiOptions` method tables under "Component
Library Methods", and add a "Multi-base wiring" subsection under "Component Wiring Patterns" pointing at
`examples/CompareBases/`. Add `ApiBase` and `ApiClientError` to the "Key Components" table with the one-line
descriptions "One API base: its URL, calendar index and response cache" and "Error carrying url, status,
statusText and body".

- [ ] **Step 5: Format and lint the markdown**

Run: `yarn format:md:fix && yarn lint:md`

Expected: `lint:md` reports `Summary: 0 issues in 0 files`.

- [ ] **Step 6: Final verification**

Run: `yarn test && yarn compile && yarn lint:md`

Expected: every suite green, `yarn compile` exits 0, `lint:md` clean.

- [ ] **Step 7: Commit**

```bash
git add README.md CLAUDE.md CHANGELOG.md package.json
git commit -m "Document the per-base registry and set the version to 2.0.0"
```

---

## Coverage against the spec

| Spec section                                    | Task      |
| ----------------------------------------------- | --------- |
| `ApiBase` class shape                           | 2, 3, 4   |
| URL normalization                               | 2         |
| `resolve()`/`fromMetadata()`                    | 2         |
| `load()` and in-flight collapse                 | 2         |
| Cache, LRU, TTL                                 | 3         |
| Metadata queries, `isValidDioceseForNation`     | 4         |
| `ApiClient` changes, deprecated statics         | 5         |
| Data flow                                       | 5, 6      |
| Errors, `ApiClientError`, `calendarFetchFailed` | 1, 6      |
| The breaking change                             | 6, 11, 12 |
| Component binding                               | 7, 8      |
| `PathBuilder`                                   | 9         |
| Types                                           | 1         |
| Testing                                         | 2–10      |
| Ships alongside                                 | 11, 12    |
| Version                                         | 12        |

**Deviation from the spec:** the spec's `nationalCalendars( rite )` is corrected to `nationalCalendars()` plus
a new `riteCalendars( rite )`, for the reason given in Task 4. `ApiBase.clearAllCaches()` was added in Task 3
to give the existing static `ApiClient.clearCache()` something to delegate to.
