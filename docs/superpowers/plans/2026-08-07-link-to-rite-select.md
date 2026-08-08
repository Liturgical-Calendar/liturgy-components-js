# CalendarSelect.linkToRiteSelect() Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `CalendarSelect` a public `linkToRiteSelect()` so a select used without an
`ApiOptions` can follow a `RiteSelect`, and route `ApiOptions` through the same method so there is
one implementation.

**Architecture:** The rite-to-calendar rebuild (clear value → `_applyRite` → clear value → hide a
tierless nation select → dispatch `change`) moves out of `ApiOptions#handleLinkedRiteSelect` and
onto `CalendarSelect` as a public `linkToRiteSelect( riteSelect )`. `ApiOptions` calls it for each
linked select and keeps only its own concerns — endpoint state, temporal inputs, year clamp, path
and locale inputs — behind its own listener registered afterwards, so the calendar rebuild still
runs first. `linkToNationsSelect` gains a back-reference so a nation select knows whether any
diocese select depends on it, which turns the `change`-dispatch exclusion from a filter-based proxy
into the exact condition.

**Tech Stack:** Vanilla ES2020 modules, Jest 30 with `jest-environment-jsdom`, run through `yarn test`.

## Global Constraints

- Source is plain ES modules under `src/`; `yarn compile` emits `dist/` via `tsc`. Never edit `dist/` by hand.
- Private fields use `#`; internal-but-cross-instance members use a single leading underscore
  (`_applyRite`, `_setHidden`, `_domElement`). A leading underscore means "internal, but reachable
  from a sibling instance or a sibling class".
- Style in `src/CalendarSelect/CalendarSelect.js` uses spaces inside parentheses:
  `filter( filter = CalendarSelectFilter.NONE )`. `src/ApiOptions/ApiOptions.js` does not. Match
  whichever file you are editing.
- Every public method that configures the instance returns `this`. `appendTo()` returns void.
- Tests live in `src/__tests__/*.test.js` and start with `/** @jest-environment jsdom */`.
- Run a single test file with `yarn test src/__tests__/<name>.test.js`. Run everything with `yarn test`.
- The full suite is green at 117 tests before this work starts. It must be green at every commit.
- Design reference: `docs/superpowers/specs/2026-08-07-link-to-rite-select-design.md`.

---

## File Structure

| File                                                   | Responsibility                                                                                                                                                                                     |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/CalendarSelect/CalendarSelect.js`                 | Gains `#dependentDioceseSelects`, `_registerDependentDioceseSelect()`, `_hasDependentDioceseSelects`, `#riteLinked`, `linkToRiteSelect()`. One registration line added to `linkToNationsSelect()`. |
| `src/ApiOptions/ApiOptions.js`                         | `#handleLinkedRiteSelect` sheds the calendar-side work and delegates.                                                                                                                              |
| `src/__tests__/ApiOptionsRiteCharacterization.test.js` | **New.** Pins today's `ApiOptions` rite behaviour so the refactor is provably behaviour-preserving.                                                                                                |
| `src/__tests__/CalendarSelectRiteLink.test.js`         | **New.** Covers the new public method on standalone selects.                                                                                                                                       |
| `docs/calendar-select.md`, `docs/rite-select.md`       | Document the new method and the standalone pattern.                                                                                                                                                |

---

## Task 1: Characterize the current ApiOptions rite behaviour

Nothing here changes production code. These tests must pass **before** and **after** the refactor —
that is the whole point of writing them first. The path-builder regression in #27 reached `main`
because this code had no such net.

**Files:**

- Test: `src/__tests__/ApiOptionsRiteCharacterization.test.js` (create)

**Interfaces:**

- Consumes: existing `ApiOptions`, `CalendarSelect`, `RiteSelect`, `ApiClient` public API.
- Produces: nothing consumed by later tasks. Task 4 re-runs this file unchanged.

- [ ] **Step 1: Write the characterization tests**

Create `src/__tests__/ApiOptionsRiteCharacterization.test.js`:

```javascript
/** @jest-environment jsdom */
import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import ApiClient from '../ApiClient/ApiClient.js';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import { ApiOptionsFilter, CalendarSelectFilter, Rite, RiteProperties } from '../Enums.js';

const METADATA = {
    locales: [ 'en', 'it', 'la' ],
    national_calendars: [
        { calendar_id: 'IT', locales: [ 'it-IT' ], settings: {} },
        { calendar_id: 'VA', locales: [ 'la', 'it-IT' ], settings: {} }
    ],
    diocesan_calendars: [
        { calendar_id: 'romamo_it', nation: 'IT', diocese: 'Diocesi di Roma',   locales: [ 'it-IT' ], rite: 'roman' },
        { calendar_id: 'milano_it', nation: 'IT', diocese: 'Diocesi di Milano', locales: [ 'it-IT' ], rite: 'ambrosian' },
        { calendar_id: 'lugano_ch', nation: 'CH', diocese: 'Diocesi di Lugano', locales: [ 'it-IT' ], rite: 'ambrosian' }
    ],
    ambrosian_calendars: [ { calendar_id: 'ambrosian', rite: 'ambrosian', locales: [ 'it', 'la' ] } ]
};

beforeAll( async () => {
    global.fetch = jest.fn().mockResolvedValue( {
        ok: true,
        json: () => Promise.resolve( { litcal_metadata: METADATA } )
    } );
    await ApiClient.init();
} );

beforeEach( async () => {
    ApiClient.clearCache();
    await ApiClient.init();
    document.body.innerHTML =
        '<div id="rite"></div><div id="nation"></div><div id="diocese"></div><div id="single"></div><div id="opts"></div>';
} );

/** The paired nation/diocese form, wired the way examples/RiteSelectChain does. */
const buildPaired = () => {
    const riteSelect = new RiteSelect( 'en' );
    riteSelect.appendTo( '#rite' );

    const nationSelect = new CalendarSelect( 'en' )
        .filter( CalendarSelectFilter.NATIONAL_CALENDARS )
        .allowNull( true );
    nationSelect.appendTo( '#nation' );

    const dioceseSelect = new CalendarSelect( 'en' )
        .filter( CalendarSelectFilter.DIOCESAN_CALENDARS )
        .linkToNationsSelect( nationSelect )
        .allowNull( true );
    dioceseSelect.appendTo( '#diocese' );

    const apiOptions = new ApiOptions( 'en' );
    apiOptions.linkToCalendarSelect( [ nationSelect, dioceseSelect ], riteSelect );
    apiOptions.appendTo( '#opts' );

    return { riteSelect, nationSelect, dioceseSelect, apiOptions };
};

/** The single `none` filtered form, as index.js in the frontend builds it. */
const buildSingle = () => {
    const riteSelect = new RiteSelect( 'en' );
    riteSelect.appendTo( '#rite' );

    const calendarSelect = new CalendarSelect( 'en' ).allowNull( true );
    calendarSelect.appendTo( '#single' );

    const apiOptions = new ApiOptions( 'en' );
    apiOptions.filter( ApiOptionsFilter.PATH_BUILDER ).appendTo( '#opts' );
    apiOptions.linkToCalendarSelect( calendarSelect, riteSelect );

    return { riteSelect, calendarSelect, apiOptions };
};

const chooseRite = ( riteSelect, rite ) => {
    riteSelect._domElement.value = rite;
    riteSelect._domElement.dispatchEvent( new Event( 'change' ) );
};

describe( 'ApiOptions rite behaviour, paired nation/diocese form', () => {

    it( 'hides the nation select for a rite with no national tier, and shows it again', () => {
        const { riteSelect, nationSelect } = buildPaired();
        const target = () => nationSelect._wrapperElement ?? nationSelect._domElement;

        expect( RiteProperties[ Rite.AMBROSIAN ].hasNationalTier ).toBe( false );

        chooseRite( riteSelect, Rite.AMBROSIAN );
        expect( target().hidden ).toBe( true );

        chooseRite( riteSelect, Rite.ROMAN );
        expect( target().hidden ).toBe( false );
    } );

    it( 'rebuilds the diocese select for the chosen rite and clears the selection', () => {
        const { riteSelect, dioceseSelect } = buildPaired();

        chooseRite( riteSelect, Rite.AMBROSIAN );
        const values = [ ...dioceseSelect._domElement.options ].map( o => o.value );
        expect( values ).toContain( 'milano_it' );
        expect( values ).toContain( 'lugano_ch' );
        expect( values ).not.toContain( 'romamo_it' );
        expect( dioceseSelect._domElement.value ).toBe( '' );
    } );

    it( 'dispatches change on the diocese select but not on the nation select', () => {
        const { riteSelect, nationSelect, dioceseSelect } = buildPaired();
        let nationChanges = 0;
        let dioceseChanges = 0;
        nationSelect._domElement.addEventListener( 'change', () => { nationChanges++; } );
        dioceseSelect._domElement.addEventListener( 'change', () => { dioceseChanges++; } );

        chooseRite( riteSelect, Rite.AMBROSIAN );

        expect( dioceseChanges ).toBeGreaterThan( 0 );
        expect( nationChanges ).toBe( 0 );
    } );
} );

describe( 'ApiOptions rite behaviour, single linked form', () => {

    it( 'clamps a year below the new rite floor and notifies listeners', () => {
        const { riteSelect, apiOptions } = buildSingle();
        const yearElement = apiOptions._yearInput._domElement;
        const floor = RiteProperties[ Rite.AMBROSIAN ].minYear;

        yearElement.value = String( RiteProperties[ Rite.ROMAN ].minYear );
        let yearChanges = 0;
        yearElement.addEventListener( 'change', () => { yearChanges++; } );

        chooseRite( riteSelect, Rite.AMBROSIAN );

        expect( Number( yearElement.value ) ).toBe( floor );
        expect( Number( yearElement.min ) ).toBe( floor );
        expect( yearChanges ).toBeGreaterThan( 0 );
    } );

    it( 'rebuilds the single calendar select and clears its selection', () => {
        const { riteSelect, calendarSelect } = buildSingle();

        chooseRite( riteSelect, Rite.AMBROSIAN );

        expect( calendarSelect._domElement.value ).toBe( '' );
        expect( calendarSelect._rite ).toBe( Rite.AMBROSIAN );
    } );

    it( 'disables the temporal inputs for a rite that fixes them', () => {
        const { riteSelect, apiOptions } = buildSingle();

        expect( RiteProperties[ Rite.AMBROSIAN ].hasFixedTemporalOptions ).toBe( true );
        chooseRite( riteSelect, Rite.AMBROSIAN );

        expect( apiOptions._epiphanyInput._domElement.disabled ).toBe( true );
        expect( apiOptions._ascensionInput._domElement.disabled ).toBe( true );
        expect( apiOptions._corpusChristiInput._domElement.disabled ).toBe( true );
        expect( apiOptions._eternalHighPriestInput._domElement.disabled ).toBe( true );

        chooseRite( riteSelect, Rite.ROMAN );
        expect( apiOptions._epiphanyInput._domElement.disabled ).toBe( false );
    } );
} );
```

- [ ] **Step 2: Run the file and make every test pass**

Run: `yarn test src/__tests__/ApiOptionsRiteCharacterization.test.js`

Expected: **PASS**, all 6 tests. These describe behaviour that already exists.

If any test fails, the assertion is wrong about today's behaviour, not the code. Read
`ApiOptions#handleLinkedRiteSelect` and correct the test to match what the code actually does — do
**not** change production code in this task. A characterization test that fails is a
misunderstanding to fix now, before it is baked into the refactor.

Two accessor names to check if something is undefined: `CalendarSelect` exposes `_rite`,
`_domElement` and `_wrapperElement`; `ApiOptions` exposes `_yearInput`, `_epiphanyInput`,
`_ascensionInput`, `_corpusChristiInput`, `_eternalHighPriestInput`. Confirm with
`grep -n "get _" src/CalendarSelect/CalendarSelect.js src/ApiOptions/ApiOptions.js`.

- [ ] **Step 3: Run the full suite**

Run: `yarn test`

Expected: **PASS**, 123 tests (117 existing + 6 new).

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/ApiOptionsRiteCharacterization.test.js
git commit -m "Characterize the ApiOptions rite behaviour before refactoring it

Pins what #handleLinkedRiteSelect does today — nation hiding under a tierless
rite, diocese rebuild and selection reset, which selects receive a change
dispatch, the year clamp, and the temporal input state — so the extraction that
follows is provably behaviour-preserving.

No production code changes."
```

---

## Task 2: Give a nation select a back-reference to its dependents

Turns the `change`-dispatch rule from "never dispatch on a nation select" into the exact condition,
"do not dispatch on a nation select that something depends on".

**Files:**

- Modify: `src/CalendarSelect/CalendarSelect.js` (private field block near line 58; `linkToNationsSelect`)
- Test: `src/__tests__/CalendarSelectRiteLink.test.js` (create)

**Interfaces:**

- Consumes: nothing from Task 1.
- Produces: `calendarSelect._registerDependentDioceseSelect( dioceseSelect ) → void` and the getter
  `calendarSelect._hasDependentDioceseSelects → boolean`. Task 3 reads the getter.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/CalendarSelectRiteLink.test.js`:

```javascript
/** @jest-environment jsdom */
import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import ApiClient from '../ApiClient/ApiClient.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import { CalendarSelectFilter } from '../Enums.js';

const METADATA = {
    locales: [ 'en', 'it', 'la' ],
    national_calendars: [
        { calendar_id: 'IT', locales: [ 'it-IT' ], settings: {} },
        { calendar_id: 'VA', locales: [ 'la', 'it-IT' ], settings: {} }
    ],
    diocesan_calendars: [
        { calendar_id: 'romamo_it', nation: 'IT', diocese: 'Diocesi di Roma',   locales: [ 'it-IT' ], rite: 'roman' },
        { calendar_id: 'milano_it', nation: 'IT', diocese: 'Diocesi di Milano', locales: [ 'it-IT' ], rite: 'ambrosian' },
        { calendar_id: 'lugano_ch', nation: 'CH', diocese: 'Diocesi di Lugano', locales: [ 'it-IT' ], rite: 'ambrosian' }
    ],
    ambrosian_calendars: [ { calendar_id: 'ambrosian', rite: 'ambrosian', locales: [ 'it', 'la' ] } ]
};

beforeAll( async () => {
    global.fetch = jest.fn().mockResolvedValue( {
        ok: true,
        json: () => Promise.resolve( { litcal_metadata: METADATA } )
    } );
    await ApiClient.init();
} );

beforeEach( async () => {
    ApiClient.clearCache();
    await ApiClient.init();
    document.body.innerHTML =
        '<div id="rite"></div><div id="nation"></div><div id="diocese"></div><div id="single"></div>';
} );

describe( 'CalendarSelect dependent diocese registration', () => {

    it( 'reports no dependents on a standalone nation select', () => {
        const nationSelect = new CalendarSelect( 'en' )
            .filter( CalendarSelectFilter.NATIONAL_CALENDARS );
        nationSelect.appendTo( '#nation' );

        expect( nationSelect._hasDependentDioceseSelects ).toBe( false );
    } );

    it( 'reports a dependent once a diocese select links to it', () => {
        const nationSelect = new CalendarSelect( 'en' )
            .filter( CalendarSelectFilter.NATIONAL_CALENDARS );
        nationSelect.appendTo( '#nation' );

        const dioceseSelect = new CalendarSelect( 'en' )
            .filter( CalendarSelectFilter.DIOCESAN_CALENDARS )
            .linkToNationsSelect( nationSelect );
        dioceseSelect.appendTo( '#diocese' );

        expect( nationSelect._hasDependentDioceseSelects ).toBe( true );
        expect( dioceseSelect._hasDependentDioceseSelects ).toBe( false );
    } );
} );
```

- [ ] **Step 2: Run it and watch it fail**

Run: `yarn test src/__tests__/CalendarSelectRiteLink.test.js`

Expected: **FAIL** — `_hasDependentDioceseSelects` is `undefined`, so `toBe( false )` fails with
`Received: undefined`.

- [ ] **Step 3: Add the field, the registrar and the getter**

In `src/CalendarSelect/CalendarSelect.js`, add to the private field block immediately after
`#linkedNationsSelect`:

```javascript
    /** @type {CalendarSelect[]} Diocese selects that derive their per-nation narrowing from this one. */
    #dependentDioceseSelects              = [];
```

Add these two members next to `_setHidden()`:

```javascript
    /**
     * Records that `dioceseSelect` derives its options from this select.
     *
     * Called by `linkToNationsSelect()` on the nations instance. The link is
     * otherwise one-directional — the diocese holds `#linkedNationsSelect` and the
     * nation knows nothing — which leaves a nation select unable to tell whether
     * dispatching `change` would disturb a dependent. See `linkToRiteSelect()`.
     *
     * @param {CalendarSelect} dioceseSelect - The dependent, `dioceses` filtered select.
     * @returns {void}
     */
    _registerDependentDioceseSelect( dioceseSelect ) {
        if ( false === this.#dependentDioceseSelects.includes( dioceseSelect ) ) {
            this.#dependentDioceseSelects.push( dioceseSelect );
        }
    }

    /**
     * Whether any diocese select derives its options from this one.
     *
     * @returns {boolean}
     */
    get _hasDependentDioceseSelects() {
        return this.#dependentDioceseSelects.length > 0;
    }
```

In `linkToNationsSelect()`, immediately after the existing line
`this.#linkedNationsSelect = calendarSelectInstance;`, add:

```javascript
        // Tell the nations select it now has a dependent, so it can decide
        // whether dispatching `change` would disturb one. See `linkToRiteSelect()`.
        calendarSelectInstance._registerDependentDioceseSelect( this );
```

- [ ] **Step 4: Run the test and the full suite**

Run: `yarn test src/__tests__/CalendarSelectRiteLink.test.js`
Expected: **PASS**, 2 tests.

Run: `yarn test`
Expected: **PASS**, 125 tests.

- [ ] **Step 5: Commit**

```bash
git add src/CalendarSelect/CalendarSelect.js src/__tests__/CalendarSelectRiteLink.test.js
git commit -m "Let a nation select see the diocese selects that depend on it

linkToNationsSelect records the link only on the diocese side, so a nation
select cannot tell whether anything derives its options from it. Register the
dependency on the nations instance too.

Nothing consumes it yet; linkToRiteSelect uses it to decide whether dispatching
change on a nation select would disturb a dependent."
```

---

## Task 3: Add `linkToRiteSelect()`

**Files:**

- Modify: `src/CalendarSelect/CalendarSelect.js` (imports; private field block; new public method)
- Test: `src/__tests__/CalendarSelectRiteLink.test.js` (extend)

**Interfaces:**

- Consumes: `_hasDependentDioceseSelects` from Task 2; existing `_applyRite( rite, riteAware )`,
  `_setHidden( hidden )`, `_domElement`, `_filter`.
- Produces: `calendarSelect.linkToRiteSelect( riteSelect ) → CalendarSelect` (chainable). Task 4
  calls it from `ApiOptions`.

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/CalendarSelectRiteLink.test.js`, inside the existing imports' scope. Add
`RiteSelect` and `Rite` to the imports at the top of the file so the first two lines read:

```javascript
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import { CalendarSelectFilter, Rite, RiteProperties } from '../Enums.js';
```

Then append these blocks at the end of the file:

```javascript
const buildRiteSelect = () => {
    const riteSelect = new RiteSelect( 'en' );
    riteSelect.appendTo( '#rite' );
    return riteSelect;
};

const chooseRite = ( riteSelect, rite ) => {
    riteSelect._domElement.value = rite;
    riteSelect._domElement.dispatchEvent( new Event( 'change' ) );
};

describe( 'CalendarSelect.linkToRiteSelect', () => {

    it( 'is chainable and rejects a non-RiteSelect', () => {
        const riteSelect = buildRiteSelect();
        const calendarSelect = new CalendarSelect( 'en' );
        calendarSelect.appendTo( '#single' );

        expect( calendarSelect.linkToRiteSelect( riteSelect ) ).toBe( calendarSelect );

        const other = new CalendarSelect( 'en' );
        other.appendTo( '#diocese' );
        expect( () => other.linkToRiteSelect( {} ) ).toThrow( /must be of type `RiteSelect`/ );
    } );

    it( 'throws when linked to a rite select twice', () => {
        const riteSelect = buildRiteSelect();
        const calendarSelect = new CalendarSelect( 'en' );
        calendarSelect.appendTo( '#single' );
        calendarSelect.linkToRiteSelect( riteSelect );

        expect( () => calendarSelect.linkToRiteSelect( riteSelect ) ).toThrow( /already linked to a RiteSelect/ );
    } );

    it( 'rebuilds a dioceses filtered select on a rite change and clears the selection', () => {
        const riteSelect = buildRiteSelect();
        const dioceseSelect = new CalendarSelect( 'en' )
            .filter( CalendarSelectFilter.DIOCESAN_CALENDARS )
            .linkToRiteSelect( riteSelect );
        dioceseSelect.appendTo( '#diocese' );

        chooseRite( riteSelect, Rite.AMBROSIAN );

        const values = [ ...dioceseSelect._domElement.options ].map( o => o.value );
        expect( values ).toContain( 'milano_it' );
        expect( values ).not.toContain( 'romamo_it' );
        expect( dioceseSelect._domElement.value ).toBe( '' );
    } );

    it( 'hides a nations filtered select for a rite with no national tier, and shows it again', () => {
        const riteSelect = buildRiteSelect();
        const nationSelect = new CalendarSelect( 'en' )
            .filter( CalendarSelectFilter.NATIONAL_CALENDARS )
            .linkToRiteSelect( riteSelect );
        nationSelect.appendTo( '#nation' );
        const target = () => nationSelect._wrapperElement ?? nationSelect._domElement;

        expect( RiteProperties[ Rite.AMBROSIAN ].hasNationalTier ).toBe( false );

        chooseRite( riteSelect, Rite.AMBROSIAN );
        expect( target().hidden ).toBe( true );

        chooseRite( riteSelect, Rite.ROMAN );
        expect( target().hidden ).toBe( false );
    } );

    it( 'dispatches change on a standalone nation select, but not on one with a dependent', () => {
        const riteSelect = buildRiteSelect();

        const lone = new CalendarSelect( 'en' )
            .filter( CalendarSelectFilter.NATIONAL_CALENDARS )
            .linkToRiteSelect( riteSelect );
        lone.appendTo( '#nation' );

        const paired = new CalendarSelect( 'en' )
            .filter( CalendarSelectFilter.NATIONAL_CALENDARS );
        paired.appendTo( '#single' );
        const dependent = new CalendarSelect( 'en' )
            .filter( CalendarSelectFilter.DIOCESAN_CALENDARS )
            .linkToNationsSelect( paired );
        dependent.appendTo( '#diocese' );
        paired.linkToRiteSelect( riteSelect );

        let loneChanges = 0;
        let pairedChanges = 0;
        lone._domElement.addEventListener( 'change', () => { loneChanges++; } );
        paired._domElement.addEventListener( 'change', () => { pairedChanges++; } );

        chooseRite( riteSelect, Rite.AMBROSIAN );

        expect( loneChanges ).toBeGreaterThan( 0 );
        expect( pairedChanges ).toBe( 0 );
    } );
} );
```

- [ ] **Step 2: Run them and watch them fail**

Run: `yarn test src/__tests__/CalendarSelectRiteLink.test.js`

Expected: **FAIL** — `calendarSelect.linkToRiteSelect is not a function`.

- [ ] **Step 3: Implement the method**

In `src/CalendarSelect/CalendarSelect.js`, add to the imports:

```javascript
import RiteSelect from '../RiteSelect/RiteSelect.js';
```

There is no import cycle: `RiteSelect` imports only `Messages`, `Utils` and `Enums`.

Add to the private field block, after `#dependentDioceseSelects`:

```javascript
    #riteLinked                           = false;
```

Add the method immediately before `linkToNationsSelect()`:

```javascript
    /**
     * Makes this select follow a `RiteSelect`, rebuilding its options whenever the
     * rite changes.
     *
     * Works for any filter, which is what a select used without an `ApiOptions`
     * needs — `ApiOptions.linkToCalendarSelect()` accepts only a `none` filtered
     * single select or a nations/dioceses pair.
     *
     * The rite is applied once immediately with the rite select's current value,
     * so a select mounted under an already-chosen rite is correct without waiting
     * for a change event.
     *
     * @param {RiteSelect} riteSelect - The rite select to follow.
     * @returns {CalendarSelect} This instance, for chaining.
     * @throws {Error} If already linked to a rite select, or if `riteSelect` is not one.
     */
    linkToRiteSelect( riteSelect ) {
        if ( this.#riteLinked ) {
            throw new Error( 'Current CalendarSelect instance is already linked to a RiteSelect instance.' );
        }
        if ( false === riteSelect instanceof RiteSelect ) {
            throw new Error( 'Invalid type for parameter passed to linkToRiteSelect, must be of type `RiteSelect` but found type: ' + typeof riteSelect );
        }
        this.#riteLinked = true;
        riteSelect._domElement.addEventListener( 'change', ( ev ) => this.#applyLinkedRite( ev.target.value ) );
        this.#applyLinkedRite( riteSelect._domElement.value );
        return this;
    }

    /**
     * Rebuilds this select for `rite`, as a linked `RiteSelect` changes.
     *
     * @param {string} rite - A value from the `Rite` enum.
     * @returns {void}
     * @private
     */
    #applyLinkedRite( rite ) {
        const riteProps = RiteProperties[ rite ];

        // Cleared BEFORE the rebuild as well as after: a diocese select linked to a
        // nation select re-derives its per-nation narrowing from that select's
        // CURRENT value inside `_applyRite()`, and that value must already be the
        // reset one rather than the outgoing rite's — otherwise the rebuilt list is
        // filtered for a nation that is no longer selected.
        this.#domElement.value = '';
        this._applyRite( rite, true );
        this.#domElement.value = '';

        if ( CalendarSelectFilter.NATIONAL_CALENDARS === this.#filter ) {
            this._setHidden( false === riteProps.hasNationalTier );
        }

        // A dependent diocese select carries its own `change` listener on this
        // element, which would re-derive its options for the now-empty nation value
        // and stomp the flat list `_applyRite()` just built for a tierless rite.
        // With no dependent there is nothing to disturb, and staying silent would
        // instead strand a consumer holding the value we just cleared.
        if ( false === this._hasDependentDioceseSelects ) {
            this.#domElement.dispatchEvent( new Event( 'change' ) );
        }
    }
```

- [ ] **Step 4: Run the test file and the full suite**

Run: `yarn test src/__tests__/CalendarSelectRiteLink.test.js`
Expected: **PASS**, 7 tests.

Run: `yarn test`
Expected: **PASS**, 130 tests.

- [ ] **Step 5: Commit**

```bash
git add src/CalendarSelect/CalendarSelect.js src/__tests__/CalendarSelectRiteLink.test.js
git commit -m "Add CalendarSelect.linkToRiteSelect()

A CalendarSelect used without an ApiOptions had no public way to follow a
RiteSelect: linkToCalendarSelect accepts only a none-filtered single select or a
nations/dioceses pair, RiteSelect emits no events, and rite() is one-shot. The
rebuild machinery existed but was private.

Works for any filter. Hides a nations filtered select under a rite with no
national tier, and dispatches change unless a dependent diocese select would be
disturbed by it.

Closes #26."
```

---

## Task 4: Point ApiOptions at the new method

The characterization tests from Task 1 are the gate. They must pass unchanged.

**Files:**

- Modify: `src/ApiOptions/ApiOptions.js` (`#handleLinkedRiteSelect`)

**Interfaces:**

- Consumes: `linkToRiteSelect()` from Task 3.
- Produces: no new API.

- [ ] **Step 1: Replace the calendar-side work with a delegation**

In `src/ApiOptions/ApiOptions.js`, replace the whole body of `#handleLinkedRiteSelect( riteSelect, calendarSelect )` with:

```javascript
    #handleLinkedRiteSelect( riteSelect, calendarSelect ) {
        const selects = Array.isArray( calendarSelect ) ? calendarSelect : [ calendarSelect ];

        // The calendar-side rebuild lives on CalendarSelect, so there is one
        // implementation of it. Linked FIRST so that each select's listener is
        // registered before the one below: listeners fire in registration order, and
        // the option state applied here assumes the selection has already been reset.
        selects.forEach( cs => cs.linkToRiteSelect( riteSelect ) );

        const applyRite = ( rite ) => {
            const riteProps = RiteProperties[ rite ];

            this.#currentEndpoint.rite = rite;
            this.#riteFixesTemporalOptions = riteProps.hasFixedTemporalOptions;

            // The selection has just been reset to the rite-level calendar, so the
            // calendar-selection half of the rule is false here; the rite half is
            // carried by `#riteFixesTemporalOptions`, set above.
            this.#applyTemporalInputState( false );

            this.#inputs.yearInput.min( riteProps.minYear );
            // Decision 5: pre-empt an invalid request rather than let it through.
            // Raising `min` alone leaves an already-entered year below the new floor
            // untouched — e.g. 1970 (valid Roman) is below the Ambrosian floor of
            // 1976 — which the API would reject. Clamp it up and notify listeners
            // with a `change` event, matching how a user edit would.
            const yearInputElement = this.#inputs.yearInput._domElement;
            if ( Number( yearInputElement.value ) < riteProps.minYear ) {
                yearInputElement.value = riteProps.minYear;
                yearInputElement.dispatchEvent( new Event( 'change' ) );
            }
            this.#applyRiteToCalendarPathInput( riteProps.hasNationalTier );
            this.#applyRiteToLocaleInput( rite );

            this.#currentEndpoint.calendarType = null;
            this.#currentEndpoint.calendarId   = null;
        };

        riteSelect._domElement.addEventListener( 'change', ( ev ) => applyRite( ev.target.value ) );
        applyRite( riteSelect._domElement.value );
    }
```

Everything removed — the value clearing, `_applyRite`, `_setHidden` on the nation select, and the
`change` dispatch — now happens inside `linkToRiteSelect()`.

- [ ] **Step 2: Run the characterization tests**

Run: `yarn test src/__tests__/ApiOptionsRiteCharacterization.test.js`

Expected: **PASS**, all 6, unchanged from Task 1. A failure here means the refactor changed
behaviour — fix the code, not the test.

- [ ] **Step 3: Run the full suite**

Run: `yarn test`
Expected: **PASS**, 130 tests.

Run: `yarn compile`
Expected: exit 0.

- [ ] **Step 4: Cover the mixed double-link case**

The spec calls this out: now that `ApiOptions` routes through `linkToRiteSelect()`, a select handed
to `ApiOptions` **and** linked directly is linked twice, and the second call throws. Pin it.

Append to `src/__tests__/CalendarSelectRiteLink.test.js` — not to the characterization file, which
must stay byte-identical:

```javascript
describe( 'linkToRiteSelect and ApiOptions together', () => {

    it( 'throws when a select linked by ApiOptions is also linked directly', async () => {
        const { default: ApiOptions } = await import( '../ApiOptions/ApiOptions.js' );

        const riteSelect = buildRiteSelect();
        const calendarSelect = new CalendarSelect( 'en' ).allowNull( true );
        calendarSelect.appendTo( '#single' );

        const apiOptions = new ApiOptions( 'en' );
        apiOptions.linkToCalendarSelect( calendarSelect, riteSelect );

        // ApiOptions has already linked it; a second, direct link would put two rite
        // listeners on one select and apply the rite twice per change.
        expect( () => calendarSelect.linkToRiteSelect( riteSelect ) ).toThrow( /already linked to a RiteSelect/ );
    } );
} );
```

Run: `yarn test src/__tests__/CalendarSelectRiteLink.test.js`
Expected: **PASS**, 8 tests.

Run: `yarn test`
Expected: **PASS**, 131 tests.

- [ ] **Step 5: Check that `CalendarSelectFilter` is still used in ApiOptions**

Run: `grep -n "CalendarSelectFilter" src/ApiOptions/ApiOptions.js`

The nation-hiding and dispatch-exclusion lines that used it are gone. If no references remain,
remove it from the import at the top of the file; if some remain, leave the import alone.

Run: `yarn test` again after any import change. Expected: **PASS**, 131 tests.

- [ ] **Step 6: Commit**

```bash
git add src/ApiOptions/ApiOptions.js src/__tests__/CalendarSelectRiteLink.test.js
git commit -m "Route ApiOptions' rite handling through linkToRiteSelect

#handleLinkedRiteSelect carried its own copy of the rite-to-calendar rebuild —
clear, _applyRite, clear, hide a tierless nation select, dispatch change. That
is now CalendarSelect.linkToRiteSelect, so ApiOptions delegates and keeps only
its own concerns: endpoint state, temporal inputs, the year clamp, and the path
and locale inputs.

The selects are linked first so their listeners run before this one, preserving
the ordering the option state depends on.

The characterization tests added before the extraction pass unchanged."
```

---

## Task 5: Document the method

**Files:**

- Modify: `docs/calendar-select.md`
- Modify: `docs/rite-select.md`

**Interfaces:**

- Consumes: the public API from Task 3.
- Produces: nothing.

- [ ] **Step 1: Read both documents to match their structure**

Run: `sed -n '1,60p' docs/calendar-select.md` and `sed -n '1,60p' docs/rite-select.md`

Find the method table or method list in `calendar-select.md` and the usage section in
`rite-select.md`. Match the surrounding heading depth and table style exactly.

- [ ] **Step 2: Add the method to `docs/calendar-select.md`**

Add `linkToRiteSelect( riteSelect )` to the method listing, described as: makes the select follow a
`RiteSelect`, rebuilding its options on every rite change; works with any filter; chainable; throws
if already linked or if the argument is not a `RiteSelect`.

Then add a section showing the standalone pattern:

````markdown
### Following a rite without an ApiOptions

`ApiOptions.linkToCalendarSelect()` accepts only a `none` filtered select or a nations/dioceses
pair. A select used on its own — to scope a permission or a test, say — links to the rite directly:

```javascript
const riteSelect = new RiteSelect( 'it' );
riteSelect.appendTo( '#riteWrapper' );

const calSelect = new CalendarSelect( 'it' )
    .filter( CalendarSelectFilter.DIOCESAN_CALENDARS )
    .allowNull( true )
    .linkToRiteSelect( riteSelect );
calSelect.appendTo( '#calendarWrapper' );
```

A `nations` filtered select is hidden while a rite with no national tier is selected — the
Ambrosian rite has no national calendars — and shown again when the rite has one.
````

- [ ] **Step 3: Cross-reference from `docs/rite-select.md`**

Append this to the usage section, adjusting the heading depth to match the surrounding document:

````markdown
### Driving a CalendarSelect without an ApiOptions

`RiteSelect` is usually passed to `ApiOptions.linkToCalendarSelect()`, which wires it to the option
inputs as well as the calendar select. When there is no `ApiOptions` on the page, link the calendar
select to the rite directly instead:

```javascript
const calSelect = new CalendarSelect( 'it' )
    .filter( CalendarSelectFilter.NATIONAL_CALENDARS )
    .linkToRiteSelect( riteSelect );
```

See [`linkToRiteSelect()`](calendar-select.md) for the full behaviour.
````

- [ ] **Step 4: Lint and format the markdown**

Run: `yarn format:md:fix && yarn lint:md`

Expected: `lint:md` reports `Summary: 0 issues`. Prettier owns table alignment (MD060); run it
before markdownlint, not after.

- [ ] **Step 5: Commit**

```bash
git add docs/calendar-select.md docs/rite-select.md
git commit -m "Document linkToRiteSelect"
```

---

## Task 6: Open the pull request

**Files:** none.

- [ ] **Step 1: Verify the whole suite once more**

```bash
yarn test && yarn compile && yarn lint:md && yarn format:md
```

Expected: 130 tests pass, compile exits 0, both markdown checks pass.

- [ ] **Step 2: Push and open the PR**

```bash
git push -u origin feat/calendar-select-link-to-rite-select
gh pr create --title "Add CalendarSelect.linkToRiteSelect()" --body "Closes #26. See docs/superpowers/specs/2026-08-07-link-to-rite-select-design.md for the design."
```

Expand the PR body with: the gap being closed, the back-reference and why the old dispatch rule was
a proxy, the ApiOptions delegation, and the characterization-tests-first approach.

---

## Notes for the implementer

**Create the branch first**, before Task 1:

```bash
git checkout main && git pull --ff-only
git checkout -b feat/calendar-select-link-to-rite-select
```

**Known ordering wrinkle.** `linkToRiteSelect()` applies the rite immediately, so a nation select
linked to a rite _before_ a diocese select links to it will dispatch `change` on that first
application — it has no dependents yet. Every current caller links nations/dioceses first
(`examples/RiteSelectChain`, and `ApiOptions` receives already-paired selects), so this does not
arise in practice. Do not add machinery for it; if it ever matters, the fix is to link the pair
before the rite.

**If a characterization test fails in Task 1**, that is a misunderstanding of current behaviour, and
the test is what changes. **If one fails in Task 4**, the refactor broke something, and the code is
what changes. The difference matters.
