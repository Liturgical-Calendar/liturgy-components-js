# RiteSelect Examples and ApiClient Rite Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan
> task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `ApiClient` rite-aware so it can fetch Ambrosian calendars, then add three worked examples covering the rite chain, the rite as a path segment, and a
rendered Ambrosian calendar.

**Architecture:** `ApiClient` gains a `#currentRite` instance field with a chainable `rite()` setter, emits the rite as a path segment in all three fetch methods, includes
the rite in its cache key, and accepts a `RiteSelect` in `listenTo()` exactly as it already accepts a `CalendarSelect`. Whether the segment is emitted at all is
capability-detected from the `/calendars` metadata `ApiClient` already fetches, because API v5 rejects the segment on every route.

**Tech Stack:** ES2020 modules, Jest 29 with `jest-environment-jsdom`, Bootstrap 5 for the examples, Yarn 4.

## Global Constraints

- The rite segment is emitted **for every rite including Roman** (`/calendar/roman/nation/IT`) when the API supports it.
- Rite support is **capability-detected** via `Array.isArray( ApiClient.#metadata?.ambrosian_calendars )`. No `apiVersion` option.
- Against an API without that capability the segment is **omitted**; requesting a non-Roman rite there **throws**.
- `#currentRite` is **instance** state, never static. Only `#apiUrl`, `#paths`, `#metadata`, `#calendarCache` are static in this class.
- Rite is a **path segment, not a query parameter** — it never joins `#params`.
- Examples call `ApiClient.init('http://localhost:8000')`, matching all five existing examples. The local API must be running to exercise them.
- Examples use an import map to `../../src/index.js` with the bare specifier `liturgy-components-js` (the convention in 4 of the 5 existing examples).
- Markdown must pass both `yarn lint:md` (markdownlint) and `yarn format:md` (prettier). Run `yarn format:md:fix` before committing docs.
- Commits are GPG-signed. If signing times out, stop and ask — do not use `--no-gpg-sign`.
- **Line numbers in this plan refer to `src/ApiClient/ApiClient.js` as it stands before Task 1** and drift as tasks are applied — Task 1 alone inserts roughly 40 lines. Locate
  code by the surrounding names quoted in each step, not by the line number.

---

### Task 1: Rite state, setter, and capability probe

**Files:**

- Modify: `src/ApiClient/ApiClient.js` (imports at line 1-4; new field beside `#currentCalendarId` at line 128)
- Test: `src/__tests__/ApiClientRite.test.js` (create)

**Interfaces:**

- Consumes: `Rite` and `RiteProperties` from `src/Enums.js` (already exported).
- Produces: `apiClient.rite( riteValue )` returning `this`; `apiClient._currentRite` getter returning the current rite string; private `ApiClient.#supportsRite` static getter.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/ApiClientRite.test.js`:

```javascript
/** @jest-environment jsdom */
import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import ApiClient from '../ApiClient/ApiClient.js';
import { Rite } from '../Enums.js';

/**
 * v6-shaped metadata: `ambrosian_calendars` is present, which is the capability
 * probe for rite support. The v5 shape (no such key) is exercised in
 * ApiClientRiteLegacyMetadata.test.js — ApiClient caches metadata in a static
 * field, so a second fixture needs the fresh module registry Jest gives per file.
 */
const METADATA = {
    locales: [ 'en', 'it', 'la' ],
    national_calendars: [ { calendar_id: 'IT', locales: [ 'it-IT' ], settings: {} } ],
    diocesan_calendars: [
        { calendar_id: 'romamo_it',   nation: 'IT', diocese: 'Diocesi di Roma',   locales: [ 'it-IT' ], rite: 'roman' },
        { calendar_id: 'lugano_ch', nation: 'CH', diocese: 'Diocesi di Lugano', locales: [ 'it-IT' ], rite: 'ambrosian' }
    ],
    ambrosian_calendars: [ { calendar_id: 'ambrosian' } ]
};

let apiClient;

beforeAll( async () => {
    global.fetch = jest.fn().mockResolvedValue( {
        ok: true,
        json: () => Promise.resolve( { litcal_metadata: METADATA } )
    } );
    apiClient = await ApiClient.init();
} );

// A FRESH client per test. ApiClient carries per-request state (#currentCategory,
// #currentCalendarId, #currentRite) that would otherwise leak between tests and
// make them order-dependent — a national fetch in one test changes what
// refetchCalendarData() does in the next. init() is cheap here: #metadata is
// already cached, so it resolves a new instance without fetching.
beforeEach( async () => {
    ApiClient.clearCache();
    apiClient = await ApiClient.init();
    global.fetch.mockClear();
} );

describe( 'ApiClient rite state', () => {

    it( 'defaults to the Roman rite', () => {
        expect( apiClient._currentRite ).toBe( Rite.ROMAN );
    } );

    it( 'sets the rite and returns this for chaining', () => {
        expect( apiClient.rite( Rite.AMBROSIAN ) ).toBe( apiClient );
        expect( apiClient._currentRite ).toBe( Rite.AMBROSIAN );

        apiClient.rite( Rite.ROMAN );
        expect( apiClient._currentRite ).toBe( Rite.ROMAN );
    } );

    it( 'throws on a value that is not a Rite', () => {
        expect( () => apiClient.rite( 'byzantine' ) ).toThrow( /must be a valid Rite/ );
        expect( () => apiClient.rite( null ) ).toThrow( /must be a valid Rite/ );
    } );
} );
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/ApiClientRite.test.js`
Expected: FAIL — `apiClient.rite is not a function`.

- [ ] **Step 3: Add the import, the field, the setter, the getter and the probe**

In `src/ApiClient/ApiClient.js`, change the `Enums` import on line 4 to:

```javascript
import { YearType, Rite, RiteProperties } from '../Enums.js';
```

Immediately after the `#currentCalendarId` field (line 128), add:

```javascript
  /**
   * The liturgical rite the current request is computed under.
   *
   * Instance state, deliberately: per-request state in this class is
   * instance-level, and only genuinely shared things (`#apiUrl`, `#paths`,
   * `#metadata`, `#calendarCache`) are static. A static rite would let two
   * ApiClients on one page overwrite each other's requests.
   *
   * @type {'roman' | 'ambrosian'}
   * @private
   */
  #currentRite = Rite.ROMAN;
```

After the `#generateCacheKey` method (ends line 224), add the probe:

```javascript
  /**
   * Whether the API this client is pointed at understands the rite path segment.
   *
   * There is no version field in `/calendars`, so this is feature-detected: the
   * rite-aware API announces `ambrosian_calendars`, v5 does not. v5 answers
   * `/calendar/roman/nation/IT` with 400 — on EVERY route, not only Ambrosian
   * ones — so emitting the segment unconditionally would break every request
   * this library makes against it.
   *
   * @returns {boolean}
   * @private
   */
  static get #supportsRite() {
    return Array.isArray( ApiClient.#metadata?.ambrosian_calendars );
  }
```

Add the public setter next to `year()` / `yearType()`:

```javascript
  /**
   * Sets the liturgical rite for subsequent calendar requests.
   *
   * The rite is a path segment rather than a query parameter, so it is kept out
   * of `#params` and composed into the URL by the fetch methods.
   *
   * @param {'roman' | 'ambrosian'} riteValue - A value of the `Rite` enum.
   * @returns {ApiClient} This instance, for chaining.
   * @throws {Error} If `riteValue` is not a value of the `Rite` enum.
   */
  rite( riteValue ) {
    if ( false === Object.values( Rite ).includes( riteValue ) ) {
      throw new Error( `ApiClient.rite: value must be a valid Rite, one of ${Object.values( Rite ).join( ', ' )}, but found: ${String( riteValue )}` );
    }
    this.#currentRite = riteValue;
    return this;
  }
```

And the accessor, beside the other `_`-prefixed getters:

```javascript
  /**
   * The liturgical rite the current request is computed under.
   * @returns {'roman' | 'ambrosian'}
   * @readonly
   */
  get _currentRite() {
    return this.#currentRite;
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test src/__tests__/ApiClientRite.test.js`
Expected: PASS, 3 tests.

- [ ] **Step 5: Run the whole suite for regressions**

Run: `yarn test`
Expected: PASS — 75 existing tests plus the 3 new ones.

- [ ] **Step 6: Commit**

```bash
git add src/ApiClient/ApiClient.js src/__tests__/ApiClientRite.test.js
git commit -m "Add rite state and a capability probe to ApiClient"
```

---

### Task 2: Emit the rite segment and key the cache on it

**Files:**

- Modify: `src/ApiClient/ApiClient.js` (`#generateCacheKey` line 206; the three `fetch(` calls at lines 369, 419, 469)
- Test: `src/__tests__/ApiClientRite.test.js` (extend)

**Interfaces:**

- Consumes: `#currentRite`, `ApiClient.#supportsRite` from Task 1.
- Produces: request URLs of the form `/calendar/{rite}`, `/calendar/{rite}/nation/{id}`, `/calendar/{rite}/diocese/{id}`; cache keys that include the rite.

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/ApiClientRite.test.js`:

```javascript
describe( 'ApiClient rite path composition', () => {

    const urlOf = ( callIndex = 0 ) => global.fetch.mock.calls[ callIndex ][ 0 ];

    it( 'emits the roman segment on the base calendar route', () => {
        apiClient.rite( Rite.ROMAN );
        apiClient.fetchCalendar();
        expect( urlOf() ).toContain( '/calendar/roman' );
    } );

    it( 'emits the ambrosian segment on the base calendar route', () => {
        apiClient.rite( Rite.AMBROSIAN );
        apiClient.fetchCalendar();
        expect( urlOf() ).toContain( '/calendar/ambrosian' );
    } );

    it( 'places the rite before the diocese segment', () => {
        apiClient.rite( Rite.AMBROSIAN );
        apiClient.fetchDiocesanCalendar( 'lugano_ch' );
        expect( urlOf() ).toContain( '/calendar/ambrosian/diocese/lugano_ch' );
    } );

    it( 'places the rite before the nation segment', () => {
        apiClient.rite( Rite.ROMAN );
        apiClient.fetchNationalCalendar( 'IT' );
        expect( urlOf() ).toContain( '/calendar/roman/nation/IT' );
    } );
} );

describe( 'ApiClient rite cache isolation', () => {

    it( 'does not serve an Ambrosian request from the Roman cache entry', () => {
        // Without the rite in the cache key this is the dangerous case: same
        // year, locale and calendar id, so the Ambrosian call would be answered
        // from the cached Roman calendar with no request at all.
        apiClient.rite( Rite.ROMAN );
        apiClient.fetchCalendar();
        expect( global.fetch ).toHaveBeenCalledTimes( 1 );

        apiClient.rite( Rite.AMBROSIAN );
        apiClient.fetchCalendar();
        expect( global.fetch ).toHaveBeenCalledTimes( 2 );
        expect( global.fetch.mock.calls[ 1 ][ 0 ] ).toContain( '/calendar/ambrosian' );
    } );
} );
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/ApiClientRite.test.js`
Expected: FAIL — URLs are `/calendar`, `/calendar/nation/IT`, `/calendar/diocese/lugano_ch`, and the cache test sees only 1 fetch.

- [ ] **Step 3: Add the segment to the three fetch calls**

In each of the three fetch methods, insert this line immediately above the `fetch(` call:

```javascript
    const riteSegment = ApiClient.#supportsRite ? `/${this.#currentRite}` : '';
```

Then change the three URLs. `fetchCalendar` (line 369):

```javascript
    fetch(`${ApiClient.#apiUrl}${ApiClient.#paths.calendar}${riteSegment}${year ? `/${year}` : ''}`, {
```

`fetchNationalCalendar` (line 419):

```javascript
    fetch(`${ApiClient.#apiUrl}${ApiClient.#paths.calendar}${riteSegment}/nation/${calendar_id}${year ? `/${year}` : ''}`, {
```

`fetchDiocesanCalendar` (line 469):

```javascript
    fetch(`${ApiClient.#apiUrl}${ApiClient.#paths.calendar}${riteSegment}/diocese/${calendar_id}${year ? `/${year}` : ''}`, {
```

- [ ] **Step 4: Add the rite to the cache key**

Replace the body of `#generateCacheKey` (line 206) so the rite is part of every key. Note the added `rite` parameter and that all three call sites pass it:

```javascript
  #generateCacheKey(category, calendarId, year, yearType, locale, params = {}, rite = Rite.ROMAN) {
    const keyParts = [
      rite,
      category || 'general',
      calendarId || '',
      year,
      yearType,
      locale || ''
    ];
    // For general Roman calendar, include mobile feast settings
    if (!category) {
      keyParts.push(
        params.epiphany || '',
        params.ascension || '',
        params.corpus_christi || '',
        params.eternal_high_priest || false
      );
    }
    return keyParts.join('|');
  }
```

Update the three call sites to pass the rite. In `fetchCalendar` (line 361):

```javascript
    const cacheKey = this.#generateCacheKey('', '', year, params.year_type, resolvedLocale, params, this.#currentRite);
```

In `fetchNationalCalendar` (line 411):

```javascript
    const cacheKey = this.#generateCacheKey('national', calendar_id, year, params.year_type, resolvedLocale, {}, this.#currentRite);
```

In `fetchDiocesanCalendar` (line 461):

```javascript
    const cacheKey = this.#generateCacheKey('diocesan', calendar_id, year, params.year_type, resolvedLocale, {}, this.#currentRite);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `yarn test src/__tests__/ApiClientRite.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 6: Run the whole suite for regressions**

Run: `yarn test`
Expected: PASS. Existing tests do not assert ApiClient URLs, so none should break.

- [ ] **Step 7: Commit**

```bash
git add src/ApiClient/ApiClient.js src/__tests__/ApiClientRite.test.js
git commit -m "Emit the rite path segment from ApiClient and key the cache on it"
```

---

### Task 3: Degrade gracefully against a non-rite-aware API

**Files:**

- Modify: `src/ApiClient/ApiClient.js` (the three fetch methods)
- Test: `src/__tests__/ApiClientRiteLegacyMetadata.test.js` (create)

**Interfaces:**

- Consumes: `ApiClient.#supportsRite` from Task 1, `riteSegment` from Task 2.
- Produces: no new public surface. Behaviour: segment omitted when unsupported; non-Roman rite throws with a message matching `/does not support the .* rite/`.

A separate test file is required: `ApiClient` caches metadata in a static field with no reset, so a second fixture needs the fresh module registry Jest gives per file. This
mirrors `CalendarSelectLegacyMetadata.test.js`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/ApiClientRiteLegacyMetadata.test.js`:

```javascript
/** @jest-environment jsdom */
import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import ApiClient from '../ApiClient/ApiClient.js';
import { Rite } from '../Enums.js';

/**
 * The shape the LIVE v5 API returns: no `ambrosian_calendars` key, and no `rite`
 * on diocesan entries. v5 answers `/calendar/roman/nation/IT` with 400 on every
 * route, so a client pointed at it must omit the segment entirely rather than
 * break every request.
 */
const V5_METADATA = {
    locales: [ 'en', 'it', 'la' ],
    national_calendars: [ { calendar_id: 'IT', locales: [ 'it-IT' ], settings: {} } ],
    diocesan_calendars: [ { calendar_id: 'romamo_it', nation: 'IT', diocese: 'Diocesi di Roma', locales: [ 'it-IT' ] } ]
};

let apiClient;

beforeAll( async () => {
    global.fetch = jest.fn().mockResolvedValue( {
        ok: true,
        json: () => Promise.resolve( { litcal_metadata: V5_METADATA } )
    } );
    apiClient = await ApiClient.init();
} );

// Fresh client per test, for the same reason as in ApiClientRite.test.js.
beforeEach( async () => {
    ApiClient.clearCache();
    apiClient = await ApiClient.init();
    global.fetch.mockClear();
} );

describe( 'ApiClient against metadata with no ambrosian_calendars (live v5 API)', () => {

    it( 'omits the rite segment entirely for the Roman rite', () => {
        apiClient.rite( Rite.ROMAN );
        apiClient.fetchCalendar();
        expect( global.fetch.mock.calls[ 0 ][ 0 ] ).not.toContain( '/roman' );
    } );

    it( 'still serves national and diocesan routes unchanged', () => {
        apiClient.rite( Rite.ROMAN );
        apiClient.fetchNationalCalendar( 'IT' );
        expect( global.fetch.mock.calls[ 0 ][ 0 ] ).toContain( '/calendar/nation/IT' );
        expect( global.fetch.mock.calls[ 0 ][ 0 ] ).not.toContain( '/roman' );
    } );

    it( 'throws a labelled error rather than emitting a request the API will reject', () => {
        apiClient.rite( Rite.AMBROSIAN );
        expect( () => apiClient.fetchCalendar() ).toThrow( /does not support the ambrosian rite/ );
        expect( global.fetch ).not.toHaveBeenCalled();
    } );
} );
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/ApiClientRiteLegacyMetadata.test.js`
Expected: FAIL on the third test — no error is thrown and a request is made.

- [ ] **Step 3: Add the guard to all three fetch methods**

Add this as the **first statement** of `fetchCalendar`, `fetchNationalCalendar` and `fetchDiocesanCalendar`, before any other work:

```javascript
    if ( this.#currentRite !== Rite.ROMAN && false === ApiClient.#supportsRite ) {
      throw new Error( `ApiClient: the API at ${ApiClient.#apiUrl} does not support the ${this.#currentRite} rite. Rite support was added in API v6; this API announces no ambrosian_calendars in its metadata.` );
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test src/__tests__/ApiClientRiteLegacyMetadata.test.js`
Expected: PASS, 3 tests.

- [ ] **Step 5: Run the whole suite**

Run: `yarn test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ApiClient/ApiClient.js src/__tests__/ApiClientRiteLegacyMetadata.test.js
git commit -m "Omit the rite segment and refuse non-Roman rites on a v5 API"
```

---

### Task 4: Refuse a national calendar under a rite with no national tier

**Files:**

- Modify: `src/ApiClient/ApiClient.js` (`fetchNationalCalendar`, line 401)
- Test: `src/__tests__/ApiClientRite.test.js` (extend)

**Interfaces:**

- Consumes: `RiteProperties` imported in Task 1, `#currentRite`.
- Produces: `fetchNationalCalendar()` throwing with a message matching `/has no national calendars/`.

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/ApiClientRite.test.js`:

```javascript
describe( 'ApiClient national tier guard', () => {

    it( 'refuses a national calendar under a rite that has no national tier', () => {
        // There is no /calendar/ambrosian/nation/... route: the API's
        // CalendarParams::validateRiteCompatibility() rejects a non-null
        // NationalCalendar for Ambrosian. Pre-empt it rather than emit a 400.
        apiClient.rite( Rite.AMBROSIAN );
        expect( () => apiClient.fetchNationalCalendar( 'IT' ) ).toThrow( /has no national calendars/ );
        expect( global.fetch ).not.toHaveBeenCalled();
    } );

    it( 'still allows a national calendar under the Roman rite', () => {
        apiClient.rite( Rite.ROMAN );
        expect( () => apiClient.fetchNationalCalendar( 'IT' ) ).not.toThrow();
        expect( global.fetch ).toHaveBeenCalledTimes( 1 );
    } );
} );
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/ApiClientRite.test.js`
Expected: FAIL — no error thrown, a request is made.

- [ ] **Step 3: Add the guard**

In `fetchNationalCalendar`, immediately after the unsupported-rite guard added in Task 3:

```javascript
    if ( false === RiteProperties[ this.#currentRite ].hasNationalTier ) {
      throw new Error( `ApiClient.fetchNationalCalendar: the ${this.#currentRite} rite has no national calendars, so there is no route to request. Use fetchCalendar() for the rite-level calendar, or fetchDiocesanCalendar() for one of its dioceses.` );
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test src/__tests__/ApiClientRite.test.js`
Expected: PASS, 10 tests.

- [ ] **Step 5: Run the whole suite**

Run: `yarn test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ApiClient/ApiClient.js src/__tests__/ApiClientRite.test.js
git commit -m "Refuse a national calendar under a rite with no national tier"
```

---

### Task 5: Accept a RiteSelect in listenTo

**Files:**

- Modify: `src/ApiClient/ApiClient.js` (imports; `listenTo` at line 487; new private method after `#listenToCalendarSelect`, which ends at line 524)
- Test: `src/__tests__/ApiClientRite.test.js` (extend)

**Interfaces:**

- Consumes: `RiteSelect` from `src/RiteSelect/RiteSelect.js`; `refetchCalendarData()` (line 313), which already dispatches on `#currentCategory`.
- Produces: `apiClient.listenTo( riteSelect )` returning `this`.

`RiteSelect` imports only `Messages`, `Utils` and `Enums`, none of which reach `ApiClient`, so this import introduces no cycle.

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/ApiClientRite.test.js` — add `RiteSelect` to the imports at the top of the file first:

```javascript
import RiteSelect from '../RiteSelect/RiteSelect.js';
```

```javascript
describe( 'ApiClient listening to a RiteSelect', () => {

    it( 'rejects something that is not a RiteSelect, CalendarSelect or ApiOptions', () => {
        expect( () => apiClient.listenTo( {} ) ).toThrow( /Expected an instance of/ );
    } );

    it( 'sets the rite and re-issues the request when the rite changes', () => {
        const riteSelect = new RiteSelect( 'en' );
        expect( apiClient.listenTo( riteSelect ) ).toBe( apiClient );

        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent( new Event( 'change' ) );

        expect( apiClient._currentRite ).toBe( Rite.AMBROSIAN );
        expect( global.fetch ).toHaveBeenCalledTimes( 1 );
        expect( global.fetch.mock.calls[ 0 ][ 0 ] ).toContain( '/calendar/ambrosian' );
    } );

    it( 'falls back to the rite-level calendar from a national selection', () => {
        // A user switching rites is not a programming error, so this must not
        // hit the throw in fetchNationalCalendar. It re-targets instead.
        const riteSelect = new RiteSelect( 'en' );
        apiClient.rite( Rite.ROMAN ).listenTo( riteSelect );
        apiClient.fetchNationalCalendar( 'IT' );
        global.fetch.mockClear();

        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent( new Event( 'change' ) );

        expect( global.fetch ).toHaveBeenCalledTimes( 1 );
        expect( global.fetch.mock.calls[ 0 ][ 0 ] ).toContain( '/calendar/ambrosian' );
        expect( global.fetch.mock.calls[ 0 ][ 0 ] ).not.toContain( '/nation/' );
    } );

    it( 'falls back to the rite-level calendar from a diocesan selection, in both directions', () => {
        // A calendar_id from one rite is never valid under another. Carrying a
        // diocese across a rite change is a 400 in BOTH directions, verified
        // against the API:
        //   /calendar/ambrosian/diocese/romamo_it   -> 400
        //   /calendar/roman/diocese/lugano_ch     -> 400
        const riteSelect = new RiteSelect( 'en' );
        apiClient.rite( Rite.ROMAN ).listenTo( riteSelect );
        apiClient.fetchDiocesanCalendar( 'romamo_it' );
        global.fetch.mockClear();

        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent( new Event( 'change' ) );

        expect( global.fetch.mock.calls[ 0 ][ 0 ] ).toContain( '/calendar/ambrosian' );
        expect( global.fetch.mock.calls[ 0 ][ 0 ] ).not.toContain( '/diocese/' );

        // ...and back the other way, from an Ambrosian diocese to Roman.
        apiClient.fetchDiocesanCalendar( 'lugano_ch' );
        global.fetch.mockClear();

        riteSelect._domElement.value = Rite.ROMAN;
        riteSelect._domElement.dispatchEvent( new Event( 'change' ) );

        expect( global.fetch.mock.calls[ 0 ][ 0 ] ).toContain( '/calendar/roman' );
        expect( global.fetch.mock.calls[ 0 ][ 0 ] ).not.toContain( '/diocese/' );
    } );
} );
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/ApiClientRite.test.js`
Expected: FAIL — `listenTo` throws `Expected an instance of CalendarSelect or ApiOptions` for a `RiteSelect`.

- [ ] **Step 3: Import RiteSelect and extend listenTo**

Add to the imports at the top of `src/ApiClient/ApiClient.js`:

```javascript
import RiteSelect from '../RiteSelect/RiteSelect.js';
```

Replace `listenTo` (line 487) with:

```javascript
  listenTo( uiComponent = null ) {
    if ( false === uiComponent instanceof CalendarSelect
      && false === uiComponent instanceof ApiOptions
      && false === uiComponent instanceof RiteSelect ) {
      throw new Error( 'ApiClient.listenTo(): Expected an instance of CalendarSelect, RiteSelect or ApiOptions' );
    }
    if (uiComponent instanceof CalendarSelect) {
      return this.#listenToCalendarSelect( uiComponent );
    } else if (uiComponent instanceof RiteSelect) {
      return this.#listenToRiteSelect( uiComponent );
    } else if (uiComponent instanceof ApiOptions) {
      return this.#listenToApiOptions( uiComponent );
    }
  }
```

- [ ] **Step 4: Add the private listener**

After `#listenToCalendarSelect` (ends line 524), add:

```javascript
  /**
   * Attaches a change listener to a RiteSelect, so that changing the rite
   * re-issues the request under the new rite.
   *
   * Any current selection is dropped and the request re-targeted at the
   * incoming rite-level calendar. A calendar_id from one rite is never valid
   * under another — the same rule ApiOptions applies when it resets the
   * calendar selection — and that holds for dioceses in BOTH directions, not
   * only for the national tier: `/calendar/ambrosian/diocese/romamo_it` and
   * `/calendar/roman/diocese/lugano_ch` are both 400.
   *
   * This falls back rather than throwing: a user switching rites is not a
   * programming error. The throw in `fetchNationalCalendar()` still covers the
   * programmatic case.
   *
   * Note that wiring both an ApiOptions and an ApiClient to the same RiteSelect
   * produces two requests per rite change. `ApiOptions#handleLinkedRiteSelect`
   * resets the calendar selection and dispatches `change` on it synchronously,
   * which fetches under the outgoing rite before this listener runs. The final
   * state is correct and the cache absorbs part of the cost.
   *
   * @param {RiteSelect} riteSelect - The RiteSelect instance to listen to.
   * @returns {ApiClient} This instance, for chaining.
   * @throws {Error} If the argument is not a RiteSelect.
   * @private
   */
  #listenToRiteSelect( riteSelect = null ) {
    if ( false === riteSelect instanceof RiteSelect ) {
      throw new Error( 'Expected an instance of RiteSelect' );
    }
    riteSelect._domElement.addEventListener( 'change', ( ev ) => {
      this.rite( ev.target.value );
      this.#currentCategory   = '';
      this.#currentCalendarId = '';
      this.refetchCalendarData();
    });
    return this;
  }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `yarn test src/__tests__/ApiClientRite.test.js`
Expected: PASS, 13 tests.

- [ ] **Step 6: Run the whole suite**

Run: `yarn test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/ApiClient/ApiClient.js src/__tests__/ApiClientRite.test.js
git commit -m "Let ApiClient listen to a RiteSelect"
```

---

### Task 6: The RiteSelectChain example

**Files:**

- Create: `examples/RiteSelectChain/index.html`
- Create: `examples/RiteSelectChain/main.css`
- Create: `examples/RiteSelectChain/main.js`

**Interfaces:**

- Consumes: `RiteSelect`, `CalendarSelect`, `ApiOptions`, `Input`, `CalendarSelectFilter` from `liturgy-components-js`.
- Produces: nothing other tasks depend on.

This example deliberately wires **no `ApiClient`** — it is about form behaviour, and leaving the client out keeps the demonstration of the chain uncluttered.

- [ ] **Step 1: Create the HTML**

`examples/RiteSelectChain/index.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Liturgical Calendar Components JS</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
        integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH"
        crossorigin="anonymous" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.1/css/all.min.css"
        integrity="sha512-5Hs3dF2AEPkpNAR7UiOHba+lRSJNeM2ECkwxUIxC1Q/FLycGTbNapWXB4tP889k5T5Ju8fs4b1P5z/iB4nMfSQ=="
        crossorigin="anonymous"
        referrerpolicy="no-referrer" />
    <link rel="stylesheet" type="text/css" media="screen" href="main.css" />
</head>
<body class="p-4">
    <h1>Liturgical Calendar Components JS: rite &rarr; calendar chain</h1>
    <p class="lead">
        Switch the rite below and watch the rest of the form react. No <code>ApiClient</code> is wired up
        here: this example is only about how <code>ApiOptions</code> orchestrates the chain.
    </p>
    <div class="alert alert-info">
        <b>What to look for when you select Ambrosian:</b>
        <ul class="mb-0">
            <li>The nation select disappears &mdash; the Ambrosian rite has no national tier.</li>
            <li>The diocese list becomes a flat list of the four Ambrosian dioceses, with no nation grouping.</li>
            <li>Any calendar selection is cleared &mdash; a calendar id from one rite is never valid under another.</li>
            <li>Epiphany, Ascension, Corpus Christi and Eternal High Priest are disabled &mdash; the Ambrosian Missal fixes them itself.</li>
            <li>The year field will not accept anything before 1976, the first reformed Ambrosian Missal.</li>
        </ul>
    </div>
    <form id="litcalForm">
        <div class="row mb-4" id="riteSelectWrapper">
            <h2>Rite</h2>
        </div>
        <div class="row mb-4" id="calendarSelects">
            <h2>Calendar</h2>
        </div>
        <div class="row mb-4" id="calendarOptions">
            <h2>Options</h2>
        </div>
    </form>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"
        integrity="sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz"
        crossorigin="anonymous"></script>
    <script type="importmap">
        {
            "imports": {
                "liturgy-components-js": "../../src/index.js"
            }
        }
    </script>
    <script type="module" src="main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create the CSS**

`examples/RiteSelectChain/main.css`:

```css
h1 {
    margin-bottom: 1rem;
}

h2 {
    font-size: 1.15rem;
    font-weight: 600;
}

/* The nation select is hidden outright for a rite with no national tier, so the
   row must not keep its gutter and leave a visible gap. */
select[hidden],
div:has(> select[hidden]) {
    display: none !important;
}
```

- [ ] **Step 3: Create the JS**

`examples/RiteSelectChain/main.js`:

```javascript
import { ApiClient, CalendarSelect, RiteSelect, ApiOptions, Input, CalendarSelectFilter } from 'liturgy-components-js';

Input.setGlobalInputClass('form-select');
Input.setGlobalLabelClass('form-label d-block mb-1');
Input.setGlobalWrapper('div');
Input.setGlobalWrapperClass('form-group col col-md-3');

// ApiClient.init() is still required: CalendarSelect reads the calendar metadata
// it fetches. This example simply never asks the client for a calendar.
ApiClient.init('http://localhost:8000').then(apiClient => {
    if (!apiClient || !(apiClient instanceof ApiClient)) {
        alert('Error initializing the Liturgical Calendar API Client');
        return;
    }

    const riteSelect = new RiteSelect('en-US')
        .class('form-select')
        .id('riteSelect')
        .label({ text: 'Select a rite', class: 'form-label d-block mb-1' });
    riteSelect.appendTo('#riteSelectWrapper');

    const nationSelect = new CalendarSelect('en-US')
        .filter(CalendarSelectFilter.NATIONAL_CALENDARS)
        .class('form-select')
        .id('nationSelect')
        .label({ text: 'Select a nation', class: 'form-label d-block mb-1' })
        .wrapper({ class: 'form-group col col-md-3' })
        .allowNull();
    nationSelect.appendTo('#calendarSelects');

    const dioceseSelect = new CalendarSelect('en-US')
        .filter(CalendarSelectFilter.DIOCESAN_CALENDARS)
        .class('form-select')
        .id('dioceseSelect')
        .label({ text: 'Select a diocese', class: 'form-label d-block mb-1' })
        .wrapper({ class: 'form-group col col-md-3' })
        .linkToNationsSelect(nationSelect)
        .after('<small class="text-secondary"><i class="fas fa-circle-info me-2"></i><i>Filtered by rite, and by the selected nation when the rite has a national tier.</i></small>')
        .allowNull();
    dioceseSelect.appendTo('#calendarSelects');

    const apiOptions = new ApiOptions('en-US');
    apiOptions._yearInput.class('form-control');
    apiOptions._acceptHeaderInput.hide();
    apiOptions._holydaysOfObligationInput.class('d-none');

    // The whole chain hangs off this one call: the rite select drives the
    // calendar selects, which in turn drive the option inputs.
    apiOptions.linkToCalendarSelect([ nationSelect, dioceseSelect ], riteSelect);
    apiOptions.appendTo('#calendarOptions');
});
```

- [ ] **Step 4: Verify it runs**

Start the API locally on port 8000, then serve the repo root: `python3 -m http.server 3001`.
Open `http://localhost:3001/examples/RiteSelectChain/`.
Expected: with Roman selected, a nation select and a nation-grouped diocese select. Selecting Ambrosian hides the nation select, flattens the diocese list to Milano, Bergamo,
Novara and Lugano, clears the selection, disables the four temporal inputs, and sets the year field's minimum to 1976. Check the browser console is free of errors.

- [ ] **Step 5: Commit**

```bash
git add examples/RiteSelectChain
git commit -m "Add the RiteSelectChain example"
```

---

### Task 7: The RiteSelectPathBuilder example

**Files:**

- Create: `examples/RiteSelectPathBuilder/index.html`
- Create: `examples/RiteSelectPathBuilder/main.css`
- Create: `examples/RiteSelectPathBuilder/main.js`

**Interfaces:**

- Consumes: `RiteSelect`, `CalendarSelect`, `ApiOptions`, `ApiOptionsFilter`, `Input`, `PathBuilder` from `liturgy-components-js`.
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Create the HTML**

`examples/RiteSelectPathBuilder/index.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Liturgical Calendar Components JS</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
        integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH"
        crossorigin="anonymous" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.1/css/all.min.css"
        integrity="sha512-5Hs3dF2AEPkpNAR7UiOHba+lRSJNeM2ECkwxUIxC1Q/FLycGTbNapWXB4tP889k5T5Ju8fs4b1P5z/iB4nMfSQ=="
        crossorigin="anonymous"
        referrerpolicy="no-referrer" />
    <link rel="stylesheet" type="text/css" media="screen" href="main.css" />
</head>
<body class="p-4">
    <h1>Liturgical Calendar Components JS: the rite as a path segment</h1>
    <p class="lead">
        A rite is a path segment, like a nation or a diocese &mdash; not a query parameter. Change the
        controls and watch the request path below rebuild.
    </p>
    <div class="alert alert-info">
        <b>Paths to try:</b>
        <ul class="mb-0">
            <li>Roman, no calendar &rarr; <code>/calendar/roman</code></li>
            <li>Ambrosian, no calendar &rarr; <code>/calendar/ambrosian</code></li>
            <li>Ambrosian, Lugano &rarr; <code>/calendar/ambrosian/diocese/lugano_ch</code></li>
        </ul>
        With a <code>RiteSelect</code> linked, the rite is spelled out even for Roman. Both forms are the
        same request: the API router accepts <code>roman</code> explicitly.
    </div>
    <div class="row mb-2" id="riteSelectWrapper">
        <h5 class="fw-bold">Rite</h5>
    </div>
    <div class="row mb-2" id="pathBuilder">
        <h5 class="fw-bold">Path builder</h5>
    </div>
    <div class="row mb-2" id="requestParameters">
        <h5 class="fw-bold">Request parameters</h5>
    </div>
    <div id="pathBuilderResult"></div>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"
        integrity="sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz"
        crossorigin="anonymous"></script>
    <script type="importmap">
        {
            "imports": {
                "liturgy-components-js": "../../src/index.js"
            }
        }
    </script>
    <script type="module" src="main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create the CSS**

`examples/RiteSelectPathBuilder/main.css`:

```css
h1 {
    margin-bottom: 1rem;
}

#pathBuilderResult code {
    font-size: 1rem;
}
```

- [ ] **Step 3: Create the JS**

`examples/RiteSelectPathBuilder/main.js`:

```javascript
import { ApiClient, CalendarSelect, RiteSelect, ApiOptions, Input, ApiOptionsFilter, PathBuilder } from 'liturgy-components-js';

Input.setGlobalInputClass('form-select');
Input.setGlobalLabelClass('form-label mb-1');
Input.setGlobalWrapper('div');
Input.setGlobalWrapperClass('form-group col col-md-3');

ApiClient.init('http://localhost:8000').then(apiClient => {
    if (!apiClient || !(apiClient instanceof ApiClient)) {
        alert('Error initializing the Liturgical Calendar API Client');
        return;
    }

    const riteSelect = new RiteSelect('en-US')
        .class('form-select')
        .id('riteSelect')
        .label({ text: 'Select a rite', class: 'form-label mb-1' });
    riteSelect.appendTo('#riteSelectWrapper');

    const apiOptions = new ApiOptions('en-US');
    apiOptions._localeInput.defaultValue('la');
    apiOptions._acceptHeaderInput.hide();
    apiOptions._yearInput.class('form-control');
    apiOptions._holydaysOfObligationInput.class('d-none');
    apiOptions.filter(ApiOptionsFilter.PATH_BUILDER).appendTo('#pathBuilder');

    // PathBuilder requires a `none` filtered CalendarSelect.
    const calendarSelect = new CalendarSelect('en-US').allowNull();
    calendarSelect.label({
        class: 'form-label mb-1',
        id: 'calendarSelectLabel',
        text: 'Select a calendar'
    }).wrapper({
        class: 'form-group col col-md-3',
        id: 'calendarSelectWrapper'
    }).id('calendarSelect')
    .class('form-control select-input')
    .insertAfter(apiOptions._calendarPathInput);

    apiOptions.filter(ApiOptionsFilter.ALL_PATHS).appendTo('#requestParameters');
    apiOptions.linkToCalendarSelect(calendarSelect, riteSelect);

    const pathBuilder = new PathBuilder(apiOptions, calendarSelect)
        .class('row align-items-center ps-2')
        .id('pathBuilderResult')
        .pathWrapperClass('col-sm-7 border border-secondary rounded bg-light px-3 py-1')
        .buttonWrapperClass('col-sm-3')
        .buttonClass('btn btn-primary');
    pathBuilder.replace('#pathBuilderResult');
});
```

- [ ] **Step 4: Verify it runs**

Serve as in Task 6 and open `http://localhost:3001/examples/RiteSelectPathBuilder/`.
Expected: the displayed path reads `/calendar/roman` on load. Selecting Ambrosian changes it to `/calendar/ambrosian` and disables the `/calendar/nation/` route option; if that
route was selected, the selection falls back to `/calendar`. Selecting the Lugano diocese yields `/calendar/ambrosian/diocese/lugano_ch`. Clicking the button opens a working
request in a new tab.

- [ ] **Step 5: Commit**

```bash
git add examples/RiteSelectPathBuilder
git commit -m "Add the RiteSelectPathBuilder example"
```

---

### Task 8: The RiteSelectWebCalendar example

**Files:**

- Create: `examples/RiteSelectWebCalendar/index.html`
- Create: `examples/RiteSelectWebCalendar/main.css`
- Create: `examples/RiteSelectWebCalendar/main.js`

**Interfaces:**

- Consumes: everything from Tasks 1-5 (`apiClient.listenTo( riteSelect )` and the rite-aware fetch paths), plus `WebCalendar` and its display enums.
- Produces: nothing other tasks depend on.

This is the example that could not exist before the `ApiClient` work: it renders real Ambrosian calendar data.

- [ ] **Step 1: Create the HTML**

`examples/RiteSelectWebCalendar/index.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Liturgical Calendar Components JS</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
        integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH"
        crossorigin="anonymous" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.1/css/all.min.css"
        integrity="sha512-5Hs3dF2AEPkpNAR7UiOHba+lRSJNeM2ECkwxUIxC1Q/FLycGTbNapWXB4tP889k5T5Ju8fs4b1P5z/iB4nMfSQ=="
        crossorigin="anonymous"
        referrerpolicy="no-referrer" />
    <link rel="stylesheet" type="text/css" media="screen" href="main.css" />
</head>
<body class="p-4">
    <h1>Liturgical Calendar Components JS: an Ambrosian calendar</h1>
    <p class="lead">
        The full stack: <code>RiteSelect</code> &rarr; <code>CalendarSelect</code> &rarr;
        <code>ApiOptions</code> &rarr; <code>ApiClient</code> &rarr; <code>WebCalendar</code>. Switching
        the rite refetches and redraws the table below with real data.
    </p>
    <div class="alert alert-info">
        Requires API v6 or the <code>dev</code> deployment. Rite support is detected from the
        <code>/calendars</code> metadata; against v5 the Ambrosian rite is refused with an explicit error
        rather than a bare 400.
    </div>
    <form id="litcalForm">
        <div class="row mb-4" id="riteSelectWrapper">
            <h2>Rite</h2>
        </div>
        <div class="row mb-4" id="calendarOptions">
            <h2>Calendar Select / Options</h2>
        </div>
    </form>
    <div id="litcalWebcalendar"></div>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"
        integrity="sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz"
        crossorigin="anonymous"></script>
    <script type="importmap">
        {
            "imports": {
                "liturgy-components-js": "../../src/index.js"
            }
        }
    </script>
    <script type="module" src="main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create the CSS**

`examples/RiteSelectWebCalendar/main.css`: copy `examples/WebCalendar/main.css` verbatim. It styles `#LitCalTable`, which this example reuses under the same id.

```bash
cp examples/WebCalendar/main.css examples/RiteSelectWebCalendar/main.css
```

- [ ] **Step 3: Create the JS**

`examples/RiteSelectWebCalendar/main.js`:

```javascript
import { ApiClient, CalendarSelect, RiteSelect, ApiOptions, Input, WebCalendar, Grouping, ColorAs, Column, ColumnOrder, DateFormat, GradeDisplay } from 'liturgy-components-js';

Input.setGlobalInputClass('form-select');
Input.setGlobalLabelClass('form-label d-block mb-1');
Input.setGlobalWrapper('div');
Input.setGlobalWrapperClass('form-group col col-md-3');

ApiClient.init('http://localhost:8000').then(apiClient => {
    if (!apiClient || !(apiClient instanceof ApiClient)) {
        alert('Error initializing the Liturgical Calendar API Client');
        return;
    }

    const riteSelect = new RiteSelect('en-US')
        .class('form-select')
        .id('riteSelect')
        .label({ text: 'Select a rite', class: 'form-label d-block mb-1' });
    riteSelect.appendTo('#riteSelectWrapper');

    const calendarSelect = new CalendarSelect('en-US').allowNull();
    calendarSelect.label({
        class: 'form-label d-block mb-1',
        text: 'Select a calendar'
    }).wrapper({
        class: 'form-group col col-md-3'
    }).id('calendarSelect').class('form-select').appendTo('#calendarOptions');

    const apiOptions = new ApiOptions('en-US');
    apiOptions._yearInput.class('form-control');
    apiOptions._acceptHeaderInput.hide();
    apiOptions._holydaysOfObligationInput.class('d-none');
    apiOptions.linkToCalendarSelect(calendarSelect, riteSelect);
    apiOptions.appendTo('#calendarOptions');

    const webCalendar = new WebCalendar();
    webCalendar.id('LitCalTable')
        .firstColumnGrouping(Grouping.BY_LITURGICAL_SEASON)
        .psalterWeekColumn()
        .removeHeaderRow()
        .seasonColor(ColorAs.CSS_CLASS)
        .seasonColorColumns(Column.LITURGICAL_SEASON)
        .eventColor(ColorAs.INDICATOR)
        .eventColorColumns(Column.EVENT_DETAILS)
        .monthHeader()
        .dateFormat(DateFormat.DAY_ONLY)
        .columnOrder(ColumnOrder.GRADE_FIRST)
        .gradeDisplay(GradeDisplay.ABBREVIATED)
        .listenTo(apiClient);
    webCalendar.appendTo('#litcalWebcalendar');

    // The rite select is wired to the client directly, alongside the calendar
    // select and options, so that changing the rite refetches. See
    // #listenToRiteSelect for the redundant-fetch note.
    apiClient.listenTo(calendarSelect).listenTo(apiOptions).listenTo(riteSelect);

    apiClient.fetchCalendar();
});
```

- [ ] **Step 4: Verify it runs**

Serve as in Task 6 and open `http://localhost:3001/examples/RiteSelectWebCalendar/`.
Expected: a General Roman calendar table on load. Selecting Ambrosian refetches and redraws with Ambrosian data — confirm in the Network tab that the request path is
`/calendar/ambrosian`, and that selecting the Lugano diocese requests `/calendar/ambrosian/diocese/lugano_ch` and returns 200. Confirm the year input will not go below 1976
under Ambrosian.

- [ ] **Step 5: Commit**

```bash
git add examples/RiteSelectWebCalendar
git commit -m "Add the RiteSelectWebCalendar example"
```

---

### Task 9: Documentation

**Files:**

- Modify: `docs/examples.md` (add three sections after the `PathBuilder` section, which starts at line 157)
- Modify: `README.md` (the examples table and its link references, around lines 71-81)
- Modify: `docs/api-client.md`
- Modify: `docs/rite-select.md` (the Back-Compatibility section)

**Interfaces:**

- Consumes: the public surface added in Tasks 1-5 — `rite()`, `_currentRite`, `listenTo( riteSelect )`.
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Add the three example sections to docs/examples.md**

Insert after the `PathBuilder` section, before `## Common Patterns`:

```markdown
## RiteSelectChain

Demonstrates how `ApiOptions` orchestrates the rite → nation → diocese chain. Deliberately wires no
`ApiClient`: the example is about form behaviour only.

### Features

- `RiteSelect` linked through `ApiOptions.linkToCalendarSelect([nationSelect, dioceseSelect], riteSelect)`
- Nation select hidden under a rite with no national tier
- Diocese list refiltered per rite, flat and ungrouped when there is no national tier
- Calendar selection cleared on every rite change
- The four fixed temporal inputs disabled, and the year floor raised to 1976, under Ambrosian

### Files

- `examples/RiteSelectChain/index.html`
- `examples/RiteSelectChain/main.css`
- `examples/RiteSelectChain/main.js`

### Key Implementation Details

`ApiClient.init()` is still called even though no calendar is ever fetched: `CalendarSelect` reads the
metadata it retrieves. The API must be running on `localhost:8000`.

## RiteSelectPathBuilder

Shows the rite as a path segment rather than a query parameter, using `PathBuilder` to render the live
request path.

### Features

- `/calendar/roman` → `/calendar/ambrosian` → `/calendar/ambrosian/diocese/lugano_ch`
- The rite spelled out explicitly even for Roman once a `RiteSelect` is linked
- The `/calendar/nation/` route disabled for a rite with no national tier, with the selection falling
  back to `/calendar`

### Files

- `examples/RiteSelectPathBuilder/index.html`
- `examples/RiteSelectPathBuilder/main.css`
- `examples/RiteSelectPathBuilder/main.js`

### Key Implementation Details

`PathBuilder` requires a `none` filtered `CalendarSelect`. Both forms of the Roman path are the same
request: the API router accepts `roman` as an explicit rite segment. Requires the API on
`localhost:8000`.

## RiteSelectWebCalendar

The full stack through to rendered Ambrosian calendar data: `RiteSelect` → `CalendarSelect` →
`ApiOptions` → `ApiClient` → `WebCalendar`.

### Features

- `apiClient.listenTo(riteSelect)` refetching on every rite change
- Real Ambrosian liturgical data in a `WebCalendar` table
- The 1976 year floor enforced by the year input

### Files

- `examples/RiteSelectWebCalendar/index.html`
- `examples/RiteSelectWebCalendar/main.css`
- `examples/RiteSelectWebCalendar/main.js`

### Key Implementation Details

Requires the API on `localhost:8000`, **and that API must be v6 or the `dev` deployment**. Rite support is
detected from the `/calendars` metadata: against v5 the rite segment is omitted and requesting the
Ambrosian rite throws an explicit error rather than producing a bare 400.
```

- [ ] **Step 2: Add three rows to the README examples table**

The table uses link references. Add the rows and matching definitions:

```markdown
| [RiteSelectChain][ex-rite-chain]              | Rite &rarr; nation &rarr; diocese chain        |
| [RiteSelectPathBuilder][ex-rite-path]         | The rite as an API path segment                |
| [RiteSelectWebCalendar][ex-rite-webcal]       | A rendered Ambrosian calendar                  |

[ex-rite-chain]: https://github.com/Liturgical-Calendar/liturgy-components-js/tree/main/examples/RiteSelectChain
[ex-rite-path]: https://github.com/Liturgical-Calendar/liturgy-components-js/tree/main/examples/RiteSelectPathBuilder
[ex-rite-webcal]: https://github.com/Liturgical-Calendar/liturgy-components-js/tree/main/examples/RiteSelectWebCalendar
```

Column widths do not need to be aligned by hand — `yarn format:md:fix` in Step 5 does that.

- [ ] **Step 3: Document the ApiClient rite surface in docs/api-client.md**

Add a `### Rite` subsection covering: the `rite()` setter with a code sample; that the rite is emitted as a path segment for every rite including Roman; that support is
detected from the metadata so the segment is omitted against v5 and a non-Roman rite throws there; that `fetchNationalCalendar()` throws under a rite with no national tier; and
that `listenTo()` accepts a `RiteSelect`. Include this sample:

```javascript
import { ApiClient, RiteSelect, Rite } from '@liturgical-calendar/components-js';

const apiClient = await ApiClient.init();
const riteSelect = new RiteSelect('en-US');
riteSelect.appendTo('#rite');

apiClient.listenTo(riteSelect);   // changing the rite refetches
apiClient.rite(Rite.AMBROSIAN);   // or set it directly; chainable
apiClient.fetchCalendar();        // GET /calendar/ambrosian
```

- [ ] **Step 4: Correct the Back-Compatibility section of docs/rite-select.md**

That section opens by promising an embed without a `RiteSelect` makes requests whose paths are
"byte-identical to before rite awareness was added". `ApiClient` now emits the segment for every rite, so
that is no longer true of requests — only of `PathBuilder`'s displayed path. Replace the opening paragraph
with:

```markdown
An embed that never instantiates `RiteSelect` and never passes one to `linkToCalendarSelect()` keeps
making equivalent requests, and `CalendarSelect`'s empty option still reads `---` rather than a
rite-specific label.

The request **paths** are no longer byte-identical, however. `ApiClient` emits the rite segment for every
rite, so what was `/calendar/nation/IT` is now `/calendar/roman/nation/IT`. Both are the same request —
the API router accepts `roman` as an explicit rite segment — so responses are unchanged; only the URL
string differs.
```

Keep the following paragraph about the rendered markup change (the four Ambrosian dioceses leaving the
Roman diocese list) exactly as it stands. Then append a version-compatibility note to the end of the
section:

```markdown
### API version compatibility

Rite support is detected from the `/calendars` metadata rather than configured: a rite-aware API announces
`ambrosian_calendars`, and API v5 does not.

- Against **v5**, the rite segment is omitted entirely, so this release keeps working for everything v5
  supports. Requesting the Ambrosian rite there throws an explicit error rather than emitting a request
  the API answers with 400.
- Against **v6 or `dev`**, the segment is always emitted and the Ambrosian rite is available.
```

- [ ] **Step 5: Format, lint and verify**

```bash
yarn format:md:fix
yarn lint:md
yarn format:md
```

Expected: `Summary: 0 error(s)` and `All matched files use Prettier code style!`.

- [ ] **Step 6: Commit**

```bash
git add docs/examples.md README.md docs/api-client.md docs/rite-select.md
git commit -m "Document the rite examples and ApiClient rite support"
```

---

## Final verification

- [ ] `yarn test` — all suites pass, 91 tests (75 existing, plus 13 in `ApiClientRite.test.js` and 3 in `ApiClientRiteLegacyMetadata.test.js`)
- [ ] `yarn compile` — exits 0
- [ ] `yarn lint:md` — 0 errors
- [ ] `yarn format:md` — clean
- [ ] All three examples load without console errors against a local API
- [ ] `git log --oneline main..HEAD` shows one commit per task, each GPG-signed
