# RiteSelect and rite-aware CalendarSelect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `CalendarSelect` rite-aware and add a `RiteSelect` component orchestrated by `ApiOptions`, so Ambrosian and Roman calendars are never shown together and `lugano_ch` stops crashing the constructor.

**Architecture:** A frozen `Rite` enum plus a `RiteProperties` map carries four structural facts per rite (national tier, fixed temporal options, minimum year, empty-option label). `CalendarSelect` filters dioceses by rite and skips the nation-grouping pass entirely for a rite with no national tier. A standalone `RiteSelect` is passed as an optional second argument to `ApiOptions.linkToCalendarSelect()`, which drives the chain. Roman remains the default, so embeds that never mention rite keep emitting identical paths.

**Tech Stack:** Vanilla ES modules, Jest 29 in ESM mode (`node --experimental-vm-modules`), Yarn 4 (PnP), TypeScript only for `.d.ts` emission via `tsc`.

## Global Constraints

- Source design: `docs/superpowers/specs/2026-08-06-rite-select-design.md`. Read it before starting.
- Rite values are exactly `'roman'` and `'ambrosian'`, matching the API's `Rite` backed enum (`src/Enum/Rite.php`).
- The four Ambrosian dioceses are `milano_it`, `bergam_it`, `novara_it`, `lugano_ch`. Note `bergam_it`, **not** `bergamo_it`.
- Ambrosian minimum year is `1976`. Roman minimum year is `1970` (the existing `YearInput.js:21` value).
- **Never emit `/calendar/ambrosian/nation/...`** — the route does not exist.
- Existing embeds that do not link a `RiteSelect` must emit byte-identical **paths**. Their rendered **markup** does change: the four Ambrosian dioceses disappear from the Roman set. That is the fix.
- The empty option currently renders as `---`. Keep `---` unless a `RiteSelect` is linked.
- Do not machine-translate `Messages.js`. Add new keys for `en` and `it` only; every read site uses the `?? 'English fallback'` pattern already used at `CalendarPathInput.js:23`.
- Every task ends with a GPG-signed commit. Never pass `--no-gpg-sign`.
- Tests must be shown **failing before** the implementation and passing after. A test that only ever passed proves nothing.
- Run tests with `yarn test`. It is already wired to `node --experimental-vm-modules $(yarn bin jest)`.

## File Structure

| File | Responsibility | Change |
| --- | --- | --- |
| `src/Enums.js` | `Rite` enum + `RiteProperties` map | Modify |
| `src/RiteSelect/RiteSelect.js` | The rite `<select>` component | Create |
| `src/CalendarSelect/CalendarSelect.js` | Rite filtering, nation-pass skip, instance state | Modify |
| `src/ApiOptions/ApiOptions.js` | `linkToCalendarSelect(cal, riteSelect?)` orchestration | Modify |
| `src/ApiOptions/Input/YearInput.js` | `min` becomes settable | Modify |
| `src/PathBuilder/PathBuilder.js` | Rite segment in `CurrentEndpoint` | Modify |
| `src/Messages.js` | `RITE_ROMAN`, `RITE_AMBROSIAN`, `GENERAL_ROMAN_CALENDAR`, `AMBROSIAN_CALENDAR` for `en` + `it` | Modify |
| `src/index.js` | Export `RiteSelect`, `Rite` | Modify |
| `src/__tests__/CalendarSelect.test.js` | Rite filtering + isolation tests | Modify (replaces existing assertions) |
| `src/__tests__/RiteSelect.test.js` | RiteSelect rendering | Create |
| `src/__tests__/PathBuilder.test.js` | Path composition | Create |
| `package.json` | `1.4.0` → `1.5.0` | Modify |

---

### Task 1: `Rite` enum and `RiteProperties` map

**Files:**
- Modify: `src/Enums.js`
- Modify: `src/index.js`
- Test: `src/__tests__/Rite.test.js` (create)

**Interfaces:**
- Produces: `Rite` (frozen object, `{ROMAN: 'roman', AMBROSIAN: 'ambrosian'}`) and `RiteProperties` (frozen object keyed by rite value, each entry `{hasNationalTier: boolean, hasFixedTemporalOptions: boolean, minYear: number, emptyOptionLabelKey: string}`). Every later task consumes both.
- `emptyOptionLabelKey` is a **Messages key name**, not display text. Task 6 adds the keys.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/Rite.test.js`:

```js
import { describe, it, expect } from '@jest/globals';
import { Rite, RiteProperties } from '../Enums.js';

describe( 'Rite enum', () => {
    it( 'has exactly the two rites the API defines', () => {
        expect( Object.values( Rite ) ).toEqual( [ 'roman', 'ambrosian' ] );
    } );

    it( 'is frozen', () => {
        expect( Object.isFrozen( Rite ) ).toBe( true );
    } );
} );

describe( 'RiteProperties', () => {
    it( 'gives the Roman rite a national tier and no fixed temporal options', () => {
        expect( RiteProperties[ Rite.ROMAN ].hasNationalTier ).toBe( true );
        expect( RiteProperties[ Rite.ROMAN ].hasFixedTemporalOptions ).toBe( false );
        expect( RiteProperties[ Rite.ROMAN ].minYear ).toBe( 1970 );
        expect( RiteProperties[ Rite.ROMAN ].emptyOptionLabelKey ).toBe( 'GENERAL_ROMAN_CALENDAR' );
    } );

    it( 'gives the Ambrosian rite no national tier and fixed temporal options', () => {
        expect( RiteProperties[ Rite.AMBROSIAN ].hasNationalTier ).toBe( false );
        expect( RiteProperties[ Rite.AMBROSIAN ].hasFixedTemporalOptions ).toBe( true );
        expect( RiteProperties[ Rite.AMBROSIAN ].minYear ).toBe( 1976 );
        expect( RiteProperties[ Rite.AMBROSIAN ].emptyOptionLabelKey ).toBe( 'AMBROSIAN_CALENDAR' );
    } );

    it( 'covers every rite in the enum', () => {
        Object.values( Rite ).forEach( rite => {
            expect( RiteProperties ).toHaveProperty( rite );
        } );
    } );
} );
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/__tests__/Rite.test.js`
Expected: FAIL — `Rite` and `RiteProperties` are not exported from `Enums.js`.

- [ ] **Step 3: Implement**

In `src/Enums.js`, add before the final `export` statement:

```js
/**
 * The liturgical rite a calendar request is computed under.
 * Mirrors the API's `Rite` backed enum (`src/Enum/Rite.php`): ROMAN is the
 * default and applies to every pre-existing route, AMBROSIAN is selected by an
 * optional leading path segment.
 *
 * @enum {{ROMAN: 'roman', AMBROSIAN: 'ambrosian'}}
 */
const Rite = Object.freeze({
    ROMAN:     'roman',
    AMBROSIAN: 'ambrosian'
});

/**
 * Structural facts about each rite. These are properties of the RITE, not of a
 * diocese and not user preferences, which is why they live beside the enum
 * rather than in component state.
 *
 * - `hasNationalTier`: whether the rite has national calendars at all. The
 *   Ambrosian rite does not; `CalendarParams::validateRiteCompatibility()` in
 *   the API throws if a national calendar is set for it, and there is no
 *   `/calendar/ambrosian/nation/...` route.
 * - `hasFixedTemporalOptions`: whether the rite fixes Epiphany, Ascension,
 *   Corpus Christi and the Eternal High Priest in its own liturgical books,
 *   making the corresponding API parameters meaningless. For the Ambrosian rite
 *   the praenotanda of the reformed Ambrosian Missal fix Epiphany to 6 January
 *   (n. 34) and Ascension to the fortieth day of Easter (n. 22), and the annual
 *   table fixes Corpus Domini to the Thursday after Trinity; the Eternal High
 *   Priest is not established there at all.
 * - `minYear`: earliest year the rite can be computed for. 1976 is the first
 *   reformed Ambrosian Missal, mirroring `CalendarParams::AMBROSIAN_YEAR_LOWER_LIMIT`.
 * - `emptyOptionLabelKey`: the `Messages` key for the rite-level calendar's
 *   label, used only in rite-aware mode.
 *
 * @type {Readonly<Object<string, {hasNationalTier: boolean, hasFixedTemporalOptions: boolean, minYear: number, emptyOptionLabelKey: string}>>}
 */
const RiteProperties = Object.freeze({
    [ Rite.ROMAN ]: Object.freeze({
        hasNationalTier:         true,
        hasFixedTemporalOptions: false,
        minYear:                 1970,
        emptyOptionLabelKey:     'GENERAL_ROMAN_CALENDAR'
    }),
    [ Rite.AMBROSIAN ]: Object.freeze({
        hasNationalTier:         false,
        hasFixedTemporalOptions: true,
        minYear:                 1976,
        emptyOptionLabelKey:     'AMBROSIAN_CALENDAR'
    })
});
```

Change the final export line of `src/Enums.js` to include both:

```js
export { Grouping, ColumnOrder, Column, ColorAs, DateFormat, GradeDisplay, ApiOptionsFilter, CalendarSelectFilter, YearType, LatinInterface, Rite, RiteProperties };
```

In `src/index.js`, add `Rite` and `RiteProperties` to both the import from `./Enums.js` and the `export { ... }` block.

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/__tests__/Rite.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/Enums.js src/index.js src/__tests__/Rite.test.js
git commit -m "Add the Rite enum and its structural properties map"
```

---

### Task 2: Filter dioceses by rite and skip the nation pass when the rite has no national tier

**Files:**
- Modify: `src/CalendarSelect/CalendarSelect.js:33` (static → instance), `:80-82` (drop the guard), `:266-300` (`#buildAllOptions`)
- Modify: `src/__tests__/CalendarSelect.test.js` (replaces the existing assertions)

**Interfaces:**
- Consumes: `Rite`, `RiteProperties` from Task 1.
- Produces: `CalendarSelect` constructor option `rite` (string, defaults to `Rite.ROMAN`) and chainable `.rite(riteValue)` returning `this`. `CalendarSelect._rite` getter returns the current rite. Task 4 calls `.rite()`.

This is the core task. Read the spec's "Architecture" section before starting — in particular why skipping the nation pass is what makes dropping the guard safe.

- [ ] **Step 1: Replace the test file's assertions with rite-aware ones**

Replace the whole of `src/__tests__/CalendarSelect.test.js`. The existing file asserts `expect( calendarSelect.nationsInnerHtml ).toContain( 'value="CH"' )` — pinning a fabricated Roman `CH` nation that the maintainer ruling forbids. That assertion is **inverted**, not extended.

```js
import { describe, it, expect, beforeAll, jest } from '@jest/globals';
import ApiClient from '../ApiClient/ApiClient.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import { Rite, CalendarSelectFilter } from '../Enums.js';

/**
 * Reproduces the real rite partition. `lugano_ch` is Ambrosian and its nation
 * `CH` has NO Roman national calendar — the crash case. `milano_it` is also
 * Ambrosian but its nation `IT` DOES have a Roman national calendar, so before
 * rite filtering it was silently grouped under Italy as though it were Roman.
 * `roma_it` is the Roman control.
 */
const METADATA = {
    national_calendars: [
        { calendar_id: 'IT', locales: [ 'it-IT' ] },
        { calendar_id: 'VA', locales: [ 'la', 'it-IT' ] }
    ],
    diocesan_calendars: [
        { calendar_id: 'roma_it',   nation: 'IT', diocese: 'Diocesi di Roma',    rite: 'roman' },
        { calendar_id: 'milano_it', nation: 'IT', diocese: 'Diocesi di Milano',  rite: 'ambrosian' },
        { calendar_id: 'lugano_ch', nation: 'CH', diocese: 'Diocesi di Lugano',  rite: 'ambrosian' }
    ],
    ambrosian_calendars: [ { calendar_id: 'ambrosian' } ]
};

global.document = {
    createElement: () => ( {} )
};

beforeAll( async () => {
    global.fetch = jest.fn().mockResolvedValue( {
        ok: true,
        json: () => Promise.resolve( { litcal_metadata: METADATA } )
    } );
    await ApiClient.init();
} );

describe( 'CalendarSelect rite filtering — Roman (default)', () => {

    it( 'does not crash on an Ambrosian diocese whose nation has no Roman national calendar', () => {
        expect( () => new CalendarSelect() ).not.toThrow();
    } );

    it( 'excludes Ambrosian dioceses entirely', () => {
        const cs = new CalendarSelect();
        expect( cs.diocesesInnerHtml ).not.toContain( 'value="lugano_ch"' );
        expect( cs.diocesesInnerHtml ).not.toContain( 'value="milano_it"' );
    } );

    it( 'never fabricates a CH nation', () => {
        const cs = new CalendarSelect();
        expect( cs.nationsInnerHtml ).not.toContain( 'value="CH"' );
    } );

    it( 'keeps Roman dioceses grouped under their nation', () => {
        const cs = new CalendarSelect();
        expect( cs.diocesesInnerHtml ).toContain( 'value="roma_it"' );
        expect( cs.nationsInnerHtml ).toContain( 'value="IT"' );
        expect( cs.diocesesInnerHtml ).toMatch( /<optgroup label="[^"]*">[^<]*<option[^>]*value="roma_it"/ );
    } );
} );

describe( 'CalendarSelect rite filtering — Ambrosian', () => {

    it( 'includes only Ambrosian dioceses', () => {
        const cs = new CalendarSelect().rite( Rite.AMBROSIAN );
        expect( cs.diocesesInnerHtml ).toContain( 'value="lugano_ch"' );
        expect( cs.diocesesInnerHtml ).toContain( 'value="milano_it"' );
        expect( cs.diocesesInnerHtml ).not.toContain( 'value="roma_it"' );
    } );

    it( 'produces no nation options at all', () => {
        const cs = new CalendarSelect().rite( Rite.AMBROSIAN );
        expect( cs.nationsInnerHtml ).not.toContain( 'value="IT"' );
        expect( cs.nationsInnerHtml ).not.toContain( 'value="CH"' );
        expect( cs.nationsInnerHtml ).not.toContain( 'value="VA"' );
    } );

    it( 'lists dioceses flat, with no nation optgroup', () => {
        const cs = new CalendarSelect().rite( Rite.AMBROSIAN );
        expect( cs.diocesesInnerHtml ).not.toContain( '<optgroup' );
    } );
} );

describe( 'CalendarSelect rite isolation between instances', () => {

    it( 'does not let an Ambrosian instance leak nations into a Roman one', () => {
        const roman  = new CalendarSelect();
        const before = roman.nationsInnerHtml;

        new CalendarSelect().rite( Rite.AMBROSIAN );

        const after = new CalendarSelect().nationsInnerHtml;
        expect( after ).toBe( before );
    } );
} );

describe( 'CalendarSelect rite validation', () => {

    it( 'throws on an unknown rite', () => {
        expect( () => new CalendarSelect().rite( 'byzantine' ) ).toThrow( /Invalid rite/ );
    } );
} );
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test src/__tests__/CalendarSelect.test.js`
Expected: FAIL. `.rite()` is not a function; the Roman exclusion tests fail because Ambrosian dioceses are still present; the isolation test fails because `#nationalCalendarsWithDioceses` is static.

Record which assertions fail. If the isolation test passes at this point, it is not exercising the leak — fix the test before continuing.

- [ ] **Step 3: Move the shared derived state to the instance**

In `src/CalendarSelect/CalendarSelect.js`, change line 33 from a static to an instance field, and add the rite field:

```js
    static #nationalCalendars             = [];
    static #diocesanCalendars             = [];
    #nationalCalendarsWithDioceses        = [];
    #rite                                 = Rite.ROMAN;
    #riteSet                              = false;
    #nationOptions                        = [];
```

Add `Rite`, `RiteProperties` to the existing `Enums.js` import at the top of the file:

```js
import { CalendarSelectFilter, Rite, RiteProperties } from '../Enums.js';
```

Then update the two helpers to be instance methods rather than static, since the list they read is now per-instance:

```js
    #hasNationalCalendarWithDioceses( nation ) {
        return this.#nationalCalendarsWithDioceses.some( item => item.calendar_id === nation );
    }

    /**
     * Adds a national calendar to this instance's list of nations that have dioceses.
     *
     * The `.find()` is deliberately unguarded. After rite filtering, every diocese
     * reaching this method belongs to a rite that HAS a national tier, and its
     * nation is guaranteed to have a national calendar. A miss therefore means the
     * API metadata is self-inconsistent, which is a defect worth failing on rather
     * than papering over with a fabricated placeholder — an earlier fix did exactly
     * that and thereby invented a Roman national calendar for CH.
     */
    #addNationalCalendarWithDioceses( nation ) {
        const nationalCalendar = CalendarSelect.#nationalCalendars.find( item => item.calendar_id === nation );
        this.#nationalCalendarsWithDioceses.push( nationalCalendar );
    }
```

Update every call site of these two from `CalendarSelect.#has...` / `CalendarSelect.#add...` to `this.#has...` / `this.#add...`, and every read of `CalendarSelect.#nationalCalendarsWithDioceses` to `this.#nationalCalendarsWithDioceses`.

- [ ] **Step 4: Add the `.rite()` setter**

Add after the existing `filter()` method:

```js
    /**
     * Set the liturgical rite this select is built for.
     *
     * @param {string} rite - A value from the `Rite` enum.
     * @returns {CalendarSelect} The current instance for method chaining.
     * @throws {Error} If the rite is unknown or has already been set.
     */
    rite( rite = Rite.ROMAN ) {
        if ( this.#riteSet ) {
            throw new Error( 'Rite has already been set on this CalendarSelect instance.' );
        }
        this._applyRite( rite );
        this.#riteSet = true;
        return this;
    }

    /**
     * Rebuild this select for a different rite.
     *
     * Package-internal rather than public: `ApiOptions` calls it on every rite
     * change, so unlike the chainable `.rite()` it deliberately has NO
     * "already set" guard.
     *
     * @param {string} rite - A value from the `Rite` enum.
     * @param {boolean} [riteAware=false] - When true, the empty option takes the
     *        rite's label instead of `---`. Only ApiOptions passes true, and only
     *        when a RiteSelect is linked, so embeds that never opt in keep `---`.
     */
    _applyRite( rite, riteAware = false ) {
        if ( false === Object.values( Rite ).includes( rite ) ) {
            throw new Error( 'Invalid rite: `' + rite + '`. Valid rites are: ' + Object.values( Rite ).join( ', ' ) + '.' );
        }
        this.#rite      = rite;
        this.#riteAware = riteAware;
        this.#buildAllOptions();
        this.#reapplyOptionsToDom();
    }

    /**
     * Hide or show this select, preferring its wrapper when one was set via
     * `wrapper()` so the label goes with it.
     *
     * @param {boolean} hidden
     */
    _setHidden( hidden ) {
        const target = this.#wrapperElement ?? this.#domElement;
        target.hidden = hidden;
    }

    get _rite() {
        return this.#rite;
    }
```

Add `#riteAware = false;` to the instance fields alongside `#rite`.

`#reapplyOptionsToDom()` is a small private method extracting whatever the constructor already does to push `#nationOptions` / `#dioceseOptionsGrouped` into `#domElement`. Extract it from the constructor rather than duplicating that logic, and call it from both places. It is also where the empty option is emitted, so it is the place to branch on `#riteAware`:

```js
        const emptyLabel = this.#riteAware
            ? ( Messages[ locale.language ]?.[ RiteProperties[ this.#rite ].emptyOptionLabelKey ]
                ?? Messages[ 'en' ][ RiteProperties[ this.#rite ].emptyOptionLabelKey ] )
            : '---';
        const firstElement = this.#allowNull ? `<option value="">${emptyLabel}</option>` : '';
```

That replaces the three hardcoded `'<option value="">---</option>'` sites at lines 234, 236 and 362. Import `Messages` in `CalendarSelect.js` — it is already imported at line 2.

- [ ] **Step 5: Split `#buildAllOptions()` on `hasNationalTier`**

Replace the body of `#buildAllOptions()` (currently around line 266). Reset the derived arrays first so a rebuild after `.rite()` does not accumulate:

```js
    #buildAllOptions() {
        this.#nationalCalendarsWithDioceses = [];
        this.#nationOptions                 = [];
        this.#dioceseOptions                = {};
        this.#dioceseOptionsGrouped         = [];

        const riteProps = RiteProperties[ this.#rite ];
        const dioceses  = CalendarSelect.#diocesanCalendars.filter(
            diocesanCalendarObj => diocesanCalendarObj.rite === this.#rite
        );

        if ( false === riteProps.hasNationalTier ) {
            // A rite with no national tier has no national calendars to group under.
            // Running the nation pass here would make EVERY diocese an orphan, not
            // just the ones whose nation code happens to be absent. Dioceses stand
            // alone, ungrouped, and no nation options are produced.
            dioceses.forEach( diocesanCalendarObj => {
                this.#addDioceseOption( diocesanCalendarObj );
            } );
            return;
        }

        dioceses.forEach( diocesanCalendarObj => {
            if ( false === this.#hasNationalCalendarWithDioceses( diocesanCalendarObj.nation ) ) {
                this.#addNationalCalendarWithDioceses( diocesanCalendarObj.nation );
            }
            if ( false === this.#dioceseOptions.hasOwnProperty( diocesanCalendarObj.nation ) ) {
                this.#dioceseOptions[ diocesanCalendarObj.nation ] = [];
            }
            this.#addDioceseOption( diocesanCalendarObj );
        } );

        CalendarSelect.#nationalCalendars.sort( ( a, b ) => this.#countryNames.of( a.calendar_id ).localeCompare( this.#countryNames.of( b.calendar_id ) ) );
        CalendarSelect.#nationalCalendars.forEach( nationalCalendar => {
            if ( false === this.#hasNationalCalendarWithDioceses( nationalCalendar.calendar_id ) ) {
                if ( 'VA' === nationalCalendar.calendar_id ) {
                    this.#addNationOption( nationalCalendar, true );
                } else {
                    this.#addNationOption( nationalCalendar );
                }
            }
        } );

        this.#nationalCalendarsWithDioceses.sort( ( a, b ) => this.#countryNames.of( a.calendar_id ).localeCompare( this.#countryNames.of( b.calendar_id ) ) );
        this.#nationalCalendarsWithDioceses.forEach( nationalCalendar => {
            this.#addNationOption( nationalCalendar );
            const optGroup = `<optgroup label="${this.#countryNames.of( nationalCalendar.calendar_id )}">${this.#dioceseOptions[ nationalCalendar.calendar_id ].join( '' )}</optgroup>`;
            this.#dioceseOptionsGrouped.push( optGroup );
        } );
    }
```

In the no-national-tier branch, `#addDioceseOption` must append to the flat `#dioceseOptionsGrouped` rather than into a per-nation bucket. Adjust `#addDioceseOption` to take the current rite into account, or push directly to `this.#dioceseOptionsGrouped` in that branch — whichever reads better against the existing method.

Also accept `rite` in the constructor's options object alongside `filter`, `id`, `class`, `name`, calling the same validation as `.rite()`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `yarn test src/__tests__/CalendarSelect.test.js`
Expected: PASS, 9 tests.

- [ ] **Step 7: Run the full suite for regressions**

Run: `yarn test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/CalendarSelect/CalendarSelect.js src/__tests__/CalendarSelect.test.js
git commit -m "Filter CalendarSelect dioceses by rite and skip the nation pass when a rite has none"
```

---

### Task 3: Rite segment in the request path

**Files:**
- Modify: `src/PathBuilder/PathBuilder.js:76-92` (`CurrentEndpoint`)
- Test: `src/__tests__/PathBuilder.test.js` (create)

**Interfaces:**
- Consumes: `Rite` from Task 1.
- Produces: `CurrentEndpoint.rite` (string, defaults to `Rite.ROMAN`) and `CurrentEndpoint.explicitRite` (boolean, defaults to `false`). Task 4 sets both.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/PathBuilder.test.js`:

```js
import { describe, it, expect, beforeEach } from '@jest/globals';
import { CurrentEndpoint, CalendarType } from '../PathBuilder/PathBuilder.js';
import { Rite } from '../Enums.js';

beforeEach( () => {
    CurrentEndpoint.rite         = Rite.ROMAN;
    CurrentEndpoint.explicitRite = false;
    CurrentEndpoint.calendarType = null;
    CurrentEndpoint.calendarId   = null;
    CurrentEndpoint.calendarYear = null;
} );

describe( 'CurrentEndpoint path composition', () => {

    it( 'omits the rite segment for Roman when not explicit', () => {
        expect( CurrentEndpoint.path ).toBe( '/calendar' );

        CurrentEndpoint.calendarType = CalendarType.NATIONAL;
        CurrentEndpoint.calendarId   = 'IT';
        expect( CurrentEndpoint.path ).toBe( '/calendar/nation/IT' );

        CurrentEndpoint.calendarType = CalendarType.DIOCESAN;
        CurrentEndpoint.calendarId   = 'roma_it';
        expect( CurrentEndpoint.path ).toBe( '/calendar/diocese/roma_it' );
    } );

    it( 'emits the explicit roman segment when explicitRite is set', () => {
        CurrentEndpoint.explicitRite = true;
        expect( CurrentEndpoint.path ).toBe( '/calendar/roman' );

        CurrentEndpoint.calendarType = CalendarType.NATIONAL;
        CurrentEndpoint.calendarId   = 'IT';
        expect( CurrentEndpoint.path ).toBe( '/calendar/roman/nation/IT' );
    } );

    it( 'always emits the ambrosian segment', () => {
        CurrentEndpoint.rite         = Rite.AMBROSIAN;
        CurrentEndpoint.explicitRite = true;
        expect( CurrentEndpoint.path ).toBe( '/calendar/ambrosian' );

        CurrentEndpoint.calendarType = CalendarType.DIOCESAN;
        CurrentEndpoint.calendarId   = 'lugano_ch';
        expect( CurrentEndpoint.path ).toBe( '/calendar/ambrosian/diocese/lugano_ch' );

        CurrentEndpoint.calendarYear = 2026;
        expect( CurrentEndpoint.path ).toBe( '/calendar/ambrosian/diocese/lugano_ch/2026' );
    } );

    it( 'places the year after the calendar id for Roman too', () => {
        CurrentEndpoint.calendarType = CalendarType.NATIONAL;
        CurrentEndpoint.calendarId   = 'IT';
        CurrentEndpoint.calendarYear = 2026;
        expect( CurrentEndpoint.path ).toBe( '/calendar/nation/IT/2026' );
    } );
} );
```

If `CurrentEndpoint` and `CalendarType` are not currently exported from `PathBuilder.js`, export them — the test needs them and they are already effectively public API within the package.

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/__tests__/PathBuilder.test.js`
Expected: FAIL — `CurrentEndpoint.rite` is undefined and the ambrosian assertions produce `/calendar/diocese/lugano_ch`.

- [ ] **Step 3: Implement**

In `src/PathBuilder/PathBuilder.js`, add the two static fields and the rite segment. Import `Rite` and `RiteProperties` from `../Enums.js`:

```js
class CurrentEndpoint {
    static calendarType   = null;
    static calendarId     = null;
    static calendarYear   = null;
    static rite           = Rite.ROMAN;
    /**
     * Whether to spell out the rite segment even for Roman. `Router::extractRiteSegment()`
     * accepts `roman` explicitly, so `/calendar/roman/nation/IT` and `/calendar/nation/IT`
     * are the same request. Kept false unless a RiteSelect is linked, so embeds that never
     * opt into rite awareness emit byte-identical paths.
     */
    static explicitRite   = false;

    static get path() {
        let currentEndpoint = '/calendar';
        if ( CurrentEndpoint.rite !== Rite.ROMAN || CurrentEndpoint.explicitRite ) {
            currentEndpoint += `/${CurrentEndpoint.rite}`;
        }
        if ( CurrentEndpoint.calendarType !== null && CurrentEndpoint.calendarId !== null ) {
            currentEndpoint += `/${CurrentEndpoint.calendarType}/${CurrentEndpoint.calendarId}`;
        }
        if ( CurrentEndpoint.calendarYear !== null ) {
            currentEndpoint += `/${CurrentEndpoint.calendarYear}`;
        }
        return currentEndpoint;
    }
}
```

Keep the existing `path` getter's structure; only the rite block is new. If the current implementation builds the string in a method rather than a getter, adapt in place rather than restructuring.

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/__tests__/PathBuilder.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/PathBuilder/PathBuilder.js src/__tests__/PathBuilder.test.js
git commit -m "Emit the rite segment in the request path"
```

---

### Task 4: The `RiteSelect` component

**Files:**
- Create: `src/RiteSelect/RiteSelect.js`
- Modify: `src/index.js`
- Test: `src/__tests__/RiteSelect.test.js` (create)

**Interfaces:**
- Consumes: `Rite`, `RiteProperties` from Task 1; `Messages` for labels.
- Produces: `RiteSelect` class with constructor `(options)` accepting a locale string or an options object (`{locale, id, class, name}`), chainable `.class()`, `.id()`, `.label()`, `.appendTo()`, and a `_domElement` getter. Task 5 consumes `_domElement` and listens for `change`.

Mirror `CalendarSelect`'s public shape (`.class()` at line 379, `.id()` at 416, `.label()` at 480, `.appendTo()` at 822) rather than inventing a new one.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/RiteSelect.test.js`:

```js
import { describe, it, expect } from '@jest/globals';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import { Rite } from '../Enums.js';

describe( 'RiteSelect', () => {

    it( 'renders one option per rite, Roman first', () => {
        const rs = new RiteSelect( 'en' );
        expect( rs._domElement.innerHTML ).toContain( 'value="roman"' );
        expect( rs._domElement.innerHTML ).toContain( 'value="ambrosian"' );
        expect( rs._domElement.innerHTML.indexOf( 'value="roman"' ) )
            .toBeLessThan( rs._domElement.innerHTML.indexOf( 'value="ambrosian"' ) );
    } );

    it( 'defaults to Roman', () => {
        const rs = new RiteSelect( 'en' );
        expect( rs._domElement.value ).toBe( Rite.ROMAN );
    } );

    it( 'has no empty option — a request always has a rite', () => {
        const rs = new RiteSelect( 'en' );
        expect( rs._domElement.innerHTML ).not.toContain( 'value=""' );
    } );

    it( 'supports the same chainable surface as CalendarSelect', () => {
        const rs = new RiteSelect( 'en' ).class( 'form-select' ).id( 'riteSelect' );
        expect( rs._domElement.className ).toBe( 'form-select' );
        expect( rs._domElement.id ).toBe( 'riteSelect' );
    } );
} );
```

This test needs a real DOM. Add `jsdom` as a dev dependency and put `/** @jest-environment jsdom */` at the top of this file — the `global.document = { createElement: () => ({}) }` stub used by `CalendarSelect.test.js` is not enough for `.value` and `.className`.

Run `yarn add --dev jest-environment-jsdom` before writing the test.

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/__tests__/RiteSelect.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/RiteSelect/RiteSelect.js`, modelled on `CalendarSelect`'s constructor-options handling:

```js
import Messages from '../Messages.js';
import Utils from '../Utils.js';
import { Rite } from '../Enums.js';

/**
 * A select menu for the liturgical rite a calendar request is computed under.
 *
 * Standalone rather than an `ApiOptions/Input/` class because rite is a PATH
 * segment, like nation and diocese, whereas the `Input` classes map to query
 * parameters. Link it via `ApiOptions.linkToCalendarSelect( calendarSelect, riteSelect )`.
 *
 * @example
 * const riteSelect = new RiteSelect( 'it-IT' );
 * riteSelect.class( 'form-select' ).appendTo( '#rite-select' );
 */
export default class RiteSelect {
    #domElement   = null;
    #labelElement = null;
    #locale       = 'en';
    #idSet        = false;
    #classSet     = false;
    #labelSet     = false;

    constructor( options = {} ) {
        const opts   = typeof options === 'string' ? { locale: options } : options;
        this.#locale = opts.locale ?? 'en';

        const locale      = new Intl.Locale( this.#locale.replaceAll( '_', '-' ) );
        this.#domElement  = document.createElement( 'select' );
        this.#domElement.innerHTML = Object.values( Rite ).map( rite => {
            const key   = 'RITE_' + rite.toUpperCase();
            const label = Messages[ locale.language ]?.[ key ] ?? Messages[ 'en' ][ key ];
            return `<option value="${rite}">${label}</option>`;
        } ).join( '' );
        this.#domElement.value = Rite.ROMAN;

        if ( opts.id ) { this.id( opts.id ); }
        if ( opts.class ) { this.class( opts.class ); }
        if ( opts.name ) { this.#domElement.name = opts.name; }
    }

    class( className ) {
        if ( this.#classSet ) {
            throw new Error( 'Class has already been set on this RiteSelect instance.' );
        }
        if ( typeof className !== 'string' ) {
            throw new Error( 'Invalid type for class name on RiteSelect instance, must be of type string but found type: ' + typeof className );
        }
        // Same order CalendarSelect.class() uses (line 379): validate, then sanitize.
        Utils.validateClassName( className );
        this.#domElement.className = Utils.sanitizeInput( className );
        this.#classSet = true;
        return this;
    }

    id( id ) {
        if ( this.#idSet ) {
            throw new Error( 'Id has already been set on this RiteSelect instance.' );
        }
        Utils.validateId( id );
        this.#domElement.id = Utils.sanitizeInput( id );
        this.#idSet = true;
        return this;
    }

    label( labelOptions = null ) {
        if ( this.#labelSet ) {
            throw new Error( 'Label has already been set on this RiteSelect instance.' );
        }
        this.#labelElement = document.createElement( 'label' );
        this.#labelElement.textContent = labelOptions?.text
            ?? Messages[ new Intl.Locale( this.#locale.replaceAll( '_', '-' ) ).language ]?.[ 'SELECT_A_RITE' ]
            ?? Messages[ 'en' ][ 'SELECT_A_RITE' ];
        if ( labelOptions?.class ) { this.#labelElement.className = Utils.sanitizeInput( labelOptions.class ); }
        if ( labelOptions?.id ) { this.#labelElement.id = Utils.sanitizeInput( labelOptions.id ); }
        this.#labelSet = true;
        return this;
    }

    appendTo( element ) {
        const target = typeof element === 'string' ? document.querySelector( element ) : element;
        if ( null === target ) {
            throw new Error( 'RiteSelect.appendTo: target element not found.' );
        }
        if ( this.#labelElement ) { target.appendChild( this.#labelElement ); }
        target.appendChild( this.#domElement );
        return this;
    }

    get _domElement() {
        return this.#domElement;
    }

    get _locale() {
        return this.#locale;
    }
}
```

Check `Utils.sanitizeInput`'s actual name before using it — match whatever `CalendarSelect.class()` calls at line 379.

In `src/index.js`, import and export `RiteSelect`.

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/__tests__/RiteSelect.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/RiteSelect/RiteSelect.js src/index.js src/__tests__/RiteSelect.test.js package.json yarn.lock
git commit -m "Add the RiteSelect component"
```

---

### Task 5: Make `YearInput`'s minimum settable

**Files:**
- Modify: `src/ApiOptions/Input/YearInput.js:21`

**Interfaces:**
- Produces: `YearInput.prototype.min( value )` — chainable, sets the DOM `min` attribute, returns `this`. Task 6 calls it.

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/RiteSelect.test.js` (it already has the jsdom environment):

```js
import YearInput from '../ApiOptions/Input/YearInput.js';

describe( 'YearInput minimum', () => {

    it( 'defaults to 1970', () => {
        expect( new YearInput()._domElement.min ).toBe( '1970' );
    } );

    it( 'can be raised and lowered again', () => {
        const yi = new YearInput();
        yi.min( 1976 );
        expect( yi._domElement.min ).toBe( '1976' );
        yi.min( 1970 );
        expect( yi._domElement.min ).toBe( '1970' );
    } );
} );
```

Note the DOM returns `min` as a **string**. Assert against `'1976'`, not `1976`.

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/__tests__/RiteSelect.test.js -t "YearInput minimum"`
Expected: FAIL — `yi.min is not a function`.

- [ ] **Step 3: Implement**

Add to `src/ApiOptions/Input/YearInput.js`:

```js
    /**
     * Set the minimum selectable year.
     *
     * Used to raise the floor to the Ambrosian rite's first reformed Missal (1976)
     * when the Ambrosian rite is selected, and to restore 1970 for the Roman rite.
     *
     * @param {number} year
     * @returns {YearInput} The current instance for method chaining.
     */
    min( year ) {
        this._domElement.min = year;
        return this;
    }
```

Unlike the other setters in this codebase there is deliberately **no** "already set" guard: this value is re-set every time the rite changes.

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/__tests__/RiteSelect.test.js -t "YearInput minimum"`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ApiOptions/Input/YearInput.js src/__tests__/RiteSelect.test.js
git commit -m "Let YearInput's minimum be raised for rites with a later floor"
```

---

### Task 6: Message keys for `en` and `it`

**Files:**
- Modify: `src/Messages.js`

**Interfaces:**
- Produces: keys `RITE_ROMAN`, `RITE_AMBROSIAN`, `SELECT_A_RITE`, `GENERAL_ROMAN_CALENDAR`, `AMBROSIAN_CALENDAR` under the `en` and `it` locale objects. All read sites use `?? Messages['en'][key]`.

`Messages.js` carries 83 locales. **Do not machine-translate into all of them.** Add `en` and `it` — `it` because the Ambrosian rite's own language is Italian — and let every other locale fall back to English through the `??` pattern already used at `CalendarPathInput.js:23` and `LiturgyOfAnyDay.js:163`. Translations for the remaining locales are a separate, human task.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/Messages.test.js`:

```js
import { describe, it, expect } from '@jest/globals';
import Messages from '../Messages.js';
import { Rite, RiteProperties } from '../Enums.js';

const REQUIRED = [ 'RITE_ROMAN', 'RITE_AMBROSIAN', 'SELECT_A_RITE', 'GENERAL_ROMAN_CALENDAR', 'AMBROSIAN_CALENDAR' ];

describe( 'rite message keys', () => {

    it( 'defines every required key in English, which is the fallback for all other locales', () => {
        REQUIRED.forEach( key => {
            expect( Messages[ 'en' ] ).toHaveProperty( key );
            expect( Messages[ 'en' ][ key ].length ).toBeGreaterThan( 0 );
        } );
    } );

    it( 'defines every required key in Italian', () => {
        REQUIRED.forEach( key => {
            expect( Messages[ 'it' ] ).toHaveProperty( key );
            expect( Messages[ 'it' ][ key ].length ).toBeGreaterThan( 0 );
        } );
    } );

    it( 'has an English message for every emptyOptionLabelKey the Rite map names', () => {
        Object.values( Rite ).forEach( rite => {
            expect( Messages[ 'en' ] ).toHaveProperty( RiteProperties[ rite ].emptyOptionLabelKey );
        } );
    } );
} );
```

The third test is the one that matters: it fails if someone adds a rite to `RiteProperties` without a corresponding label.

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/__tests__/Messages.test.js`
Expected: FAIL — keys missing.

- [ ] **Step 3: Implement**

Add to the `"en"` object in `src/Messages.js`:

```json
"RITE_ROMAN": "Roman Rite",
"RITE_AMBROSIAN": "Ambrosian Rite",
"SELECT_A_RITE": "Select a rite",
"GENERAL_ROMAN_CALENDAR": "General Roman Calendar",
"AMBROSIAN_CALENDAR": "Ambrosian Calendar"
```

And to the `"it"` object:

```json
"RITE_ROMAN": "Rito Romano",
"RITE_AMBROSIAN": "Rito Ambrosiano",
"SELECT_A_RITE": "Seleziona un rito",
"GENERAL_ROMAN_CALENDAR": "Calendario Romano Generale",
"AMBROSIAN_CALENDAR": "Calendario Ambrosiano"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/__tests__/Messages.test.js`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/Messages.js src/__tests__/Messages.test.js
git commit -m "Add rite message keys for en and it, with English fallback elsewhere"
```

---

### Task 7: `ApiOptions` orchestration

**Files:**
- Modify: `src/ApiOptions/ApiOptions.js:192-233` (`#handleMultipleLinkedCalendarSelects`), `:440-460` (`linkToCalendarSelect`)
- Test: `src/__tests__/ApiOptionsRite.test.js` (create)

**Interfaces:**
- Consumes: `Rite`, `RiteProperties` (Task 1); `CalendarSelect.prototype.rite` and `_rite` (Task 2); `CurrentEndpoint.rite` / `.explicitRite` (Task 3); `RiteSelect._domElement` (Task 4); `YearInput.prototype.min` (Task 5); the message keys (Task 6).
- Produces: `ApiOptions.prototype.linkToCalendarSelect( calendarSelect, riteSelect = null )`.

This is the task that ties everything together. Everything it needs already exists and is tested.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/ApiOptionsRite.test.js` with `/** @jest-environment jsdom */` at the top. It must cover, on a rite change to Ambrosian:

```js
describe( 'ApiOptions rite orchestration', () => {

    it( 'hides the nation select for a rite with no national tier', () => {
        // build apiOptions + [nationSelect, dioceseSelect] + riteSelect, link them
        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent( new Event( 'change' ) );
        // _setHidden targets the wrapper when one was set via wrapper(), and the
        // select itself otherwise. This setup does not call wrapper(), so assert
        // on the select. A separate test covers the wrapper case.
        expect( nationSelect._domElement.hidden ).toBe( true );
    } );

    it( 'shows the nation select again when returning to Roman', () => {
        riteSelect._domElement.value = Rite.AMBROSIAN;
        riteSelect._domElement.dispatchEvent( new Event( 'change' ) );
        riteSelect._domElement.value = Rite.ROMAN;
        riteSelect._domElement.dispatchEvent( new Event( 'change' ) );
        expect( nationSelect._domElement.hidden ).toBe( false );
    } );

    it( 'disables the four fixed temporal inputs under Ambrosian', () => {
        expect( apiOptions._epiphanyInput._domElement.disabled ).toBe( true );
        expect( apiOptions._ascensionInput._domElement.disabled ).toBe( true );
        expect( apiOptions._corpusChristiInput._domElement.disabled ).toBe( true );
        expect( apiOptions._eternalHighPriestInput._domElement.disabled ).toBe( true );
    } );

    it( 're-enables them under Roman with no nation or diocese selected', () => {
        expect( apiOptions._epiphanyInput._domElement.disabled ).toBe( false );
        expect( apiOptions._ascensionInput._domElement.disabled ).toBe( false );
        expect( apiOptions._corpusChristiInput._domElement.disabled ).toBe( false );
        expect( apiOptions._eternalHighPriestInput._domElement.disabled ).toBe( false );
    } );

    it( 'raises the year floor to 1976 under Ambrosian and restores 1970 under Roman', () => {
        expect( apiOptions._yearInput._domElement.min ).toBe( '1976' );
        // then switch back to Roman
        expect( apiOptions._yearInput._domElement.min ).toBe( '1970' );
    } );

    it( 'hides the wrapper rather than the select when a wrapper was set', () => {
        const wrapped = new CalendarSelect( 'en' )
            .filter( CalendarSelectFilter.NATIONAL_CALENDARS )
            .wrapper( { class: 'form-group' } );
        wrapped._setHidden( true );
        expect( wrapped._domElement.hidden ).toBe( false );
        expect( wrapped._wrapperElement.hidden ).toBe( true );
    } );

    it( 'labels the empty option per rite in rite-aware mode', () => {
        expect( dioceseSelect._domElement.innerHTML ).toContain( '>Ambrosian Calendar<' );
        // then switch back to Roman
        expect( dioceseSelect._domElement.innerHTML ).toContain( '>General Roman Calendar<' );
    } );

    it( 'leaves the empty option as --- when no RiteSelect is linked', () => {
        // link a fresh CalendarSelect without a rite select
        expect( plainSelect._domElement.innerHTML ).toContain( '<option value="">---</option>' );
    } );

    it( 'resets the calendar selection to the rite-level calendar on rite change', () => {
        dioceseSelect._domElement.value = 'roma_it';
        // change rite
        expect( dioceseSelect._domElement.value ).toBe( '' );
    } );

    it( 'sets explicitRite when a RiteSelect is linked', () => {
        expect( CurrentEndpoint.explicitRite ).toBe( true );
    } );

    it( 'leaves explicitRite false when no RiteSelect is linked', () => {
        // link without a rite select
        expect( CurrentEndpoint.explicitRite ).toBe( false );
    } );
} );
```

Fill in the setup from the existing usage in `src/stories/1_CombinedComponents/CalendarSelectApiOptions.stories.js`, which shows how `ApiOptions` and `CalendarSelect` are wired together. Use the same `METADATA` fixture as `CalendarSelect.test.js` and the same `ApiClient.init()` mock.

The exact accessor for hiding the nation select depends on whether the instance has a wrapper element — check `CalendarSelect`'s `#wrapperElement` / `wrapper()` and hide the wrapper when present, falling back to the select itself.

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test src/__tests__/ApiOptionsRite.test.js`
Expected: FAIL — `linkToCalendarSelect` takes one argument.

- [ ] **Step 3: Implement**

In `linkToCalendarSelect`, accept and validate the optional second parameter:

```js
    linkToCalendarSelect( calendarSelect, riteSelect = null ) {
        if ( null !== riteSelect ) {
            if ( false === riteSelect instanceof RiteSelect ) {
                throw new Error( 'ApiOptions.linkToCalendarSelect: riteSelect must be of type `RiteSelect` but found type: ' + typeof riteSelect );
            }
            CurrentEndpoint.explicitRite = true;
            this.#handleLinkedRiteSelect( riteSelect, calendarSelect );
        }
        // ...existing body unchanged
    }
```

Add the handler:

```js
    /**
     * Wire a RiteSelect to the calendar select(s) and the option inputs.
     *
     * Mirrors what #handleMultipleLinkedCalendarSelects already does for the
     * nation -> diocese chain, one level up.
     */
    #handleLinkedRiteSelect( riteSelect, calendarSelect ) {
        const applyRite = ( rite ) => {
            const riteProps = RiteProperties[ rite ];
            const selects   = Array.isArray( calendarSelect ) ? calendarSelect : [ calendarSelect ];

            CurrentEndpoint.rite = rite;

            selects.forEach( cs => cs._applyRite( rite, true ) );

            if ( Array.isArray( calendarSelect ) ) {
                const nationSelector = calendarSelect.find( cs => cs._filter === CalendarSelectFilter.NATIONAL_CALENDARS );
                if ( nationSelector ) {
                    nationSelector._setHidden( false === riteProps.hasNationalTier );
                }
            }

            const fixed = riteProps.hasFixedTemporalOptions;
            this.#inputs.epiphanyInput.disabled( fixed );
            this.#inputs.ascensionInput.disabled( fixed );
            this.#inputs.corpusChristiInput.disabled( fixed );
            this.#inputs.eternalHighPriestInput.disabled( fixed );

            this.#inputs.yearInput.min( riteProps.minYear );

            // A calendar_id from one rite is never valid under another, so reset to
            // the rite-level calendar rather than carrying a selection across.
            selects.forEach( cs => { cs._domElement.value = ''; } );
            CurrentEndpoint.calendarType = null;
            CurrentEndpoint.calendarId   = null;
        };

        riteSelect._domElement.addEventListener( 'change', ( ev ) => applyRite( ev.target.value ) );
        applyRite( riteSelect._domElement.value );
    }
```

`_applyRite( rite, riteAware )` and `_setHidden( hidden )` are both `CalendarSelect` methods **already added in Task 2** — do not redefine them here. Call `cs._applyRite( rite, true )` (the `true` is what switches the empty option from `---` to the rite's label; only `ApiOptions` ever passes it, and only when a `RiteSelect` is linked).

Import `RiteSelect`, `Rite`, `RiteProperties` and `CurrentEndpoint` at the top of `ApiOptions.js`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test src/__tests__/ApiOptionsRite.test.js`
Expected: PASS, 10 tests.

The accessors above are the ones `ApiOptions` actually exposes — individual
getters `_epiphanyInput` (line 523), `_ascensionInput` (533),
`_corpusChristiInput` (543), `_eternalHighPriestInput` (553), `_yearInput`
(593). There is no `_inputs` getter; `#inputs` is private.

- [ ] **Step 5: Run the full suite**

Run: `yarn test`
Expected: PASS, all tests from Tasks 1-7.

- [ ] **Step 6: Commit**

```bash
git add src/ApiOptions/ApiOptions.js src/CalendarSelect/CalendarSelect.js src/__tests__/ApiOptionsRite.test.js
git commit -m "Orchestrate the rite chain from ApiOptions"
```

---

### Task 8: Docs, story, and release

**Files:**
- Create: `docs/rite-select.md`
- Modify: `docs/calendar-select.md`, `docs/api-options.md`, `docs/enums.md`, `README.md`
- Create: `src/stories/0_Components/RiteSelect.stories.js`
- Modify: `package.json` (`1.4.0` → `1.5.0`)

**Interfaces:**
- Consumes: everything from Tasks 1-7. Adds no new API.

Note `main` carries uncommitted markdownlint work (`lint:md` / `lint:md:fix` scripts, `markdownlint-cli2` dev dependency). If that has landed by the time this task runs, run `yarn lint:md` before committing.

- [ ] **Step 1: Write `docs/rite-select.md`**

Follow the structure of `docs/calendar-select.md`. Cover: what the component is, the two rites, the opt-in nature, and this example:

```js
import { ApiClient, ApiOptions, CalendarSelect, RiteSelect, CalendarSelectFilter } from '@liturgical-calendar/components-js';

ApiClient.init().then( () => {
    const riteSelect    = new RiteSelect( 'it-IT' ).class( 'form-select' );
    const nationSelect  = new CalendarSelect( 'it-IT' ).filter( CalendarSelectFilter.NATIONAL_CALENDARS );
    const dioceseSelect = new CalendarSelect( 'it-IT' ).filter( CalendarSelectFilter.DIOCESAN_CALENDARS );
    const apiOptions    = new ApiOptions( 'it-IT' );

    riteSelect.appendTo( '#rite' );
    nationSelect.appendTo( '#nation' );
    dioceseSelect.appendTo( '#diocese' );

    apiOptions.linkToCalendarSelect( [ nationSelect, dioceseSelect ], riteSelect );
} );
```

State explicitly that selecting the Ambrosian rite hides the nation select, disables the four temporal options, and raises the year floor to 1976.

- [ ] **Step 2: Update the existing docs**

- `docs/enums.md` — document `Rite` and `RiteProperties`, including what each of the four properties means.
- `docs/calendar-select.md` — document the `rite` constructor option and `.rite()`, and state that Ambrosian dioceses no longer appear in the default Roman set.
- `docs/api-options.md` — document `linkToCalendarSelect`'s optional second parameter.
- `README.md` — add `RiteSelect` to the component list.

- [ ] **Step 3: Add the Storybook story**

Create `src/stories/0_Components/RiteSelect.stories.js` modelled on `src/stories/0_Components/CalendarSelect.stories.js`.

- [ ] **Step 4: Bump the version**

In `package.json`, change `"version": "1.4.0"` to `"version": "1.5.0"`. Minor, not patch: this adds a component and changes rendered markup.

- [ ] **Step 5: Verify the build**

Run: `yarn compile`
Expected: clean `tsc` run emitting `.d.ts` for `RiteSelect`.

Run: `yarn test`
Expected: PASS, all tests.

- [ ] **Step 6: Commit**

```bash
git add docs/ README.md src/stories/0_Components/RiteSelect.stories.js package.json
git commit -m "Document RiteSelect and release 1.5.0"
```

---

## After the plan

Once merged and published to npm, the frontend unblocks by bumping the CDN pin from `@1.4.0` to `@1.5.0` in three places — `layout/footer.php:110`, `examples.php:23`, `examples.php:76` — with no other frontend change. That should turn the red `[rbac]` E2E suite green; confirm by running it rather than assuming, since all 9 failures share one root cause and one fix either clears all of them or none.

The two API follow-ups (rejecting the fixed temporal params for Ambrosian, and the stale 501 artifacts in `openapi.json` and `CalendarHandler.php`) are being handled separately and do not gate any of the above.
