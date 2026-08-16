# Calendar Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** Let a consumer declare which calendars a widget may show, so the rite, calendar and locale controls appear only when they offer a real choice.

**Architecture:** A new internal module `src/MetaComponents/CalendarScope.js` resolves a `scope` bag plus the
`/calendars` metadata into the rites available, the calendars available per rite, and the derived control
visibility. `CalendarControls`, `DayViewer` and `CalendarResourcePicker` consume it; `CalendarViewer`,
`ApiExplorer` and `SubscriptionBuilder` inherit it through `CalendarControls`. A new `TodayViewer`
meta-component wraps `LiturgyOfTheDay`, which first needs a defect fixed.

**Tech Stack:** ES2022 JavaScript modules, JSDoc types compiled by `tsc` with `checkJs` off, Jest 30 with jsdom, prettier (4-space indent, single quotes).

**Spec:** `docs/superpowers/specs/2026-08-16-calendar-scope-design.md`

## Global Constraints

- **ES2022 floor.** Chrome 94+, Firefox 93+, Safari 15.4+. No import attributes, no `Element.setHTML()`.
- **No new runtime dependencies, no build step.** Everything must work as plain ES modules from a CDN.
- **`src/MetaComponents/CalendarScope.js` is internal** — it MUST NOT be exported from `src/index.js`, on the
  same reasoning as `Theme.js`, `FilterInputs.js`, `InputVisibility.js` and `PredeterminedInputs.js`.
- **`appendTo()` returns `undefined`** on every component. Never `return this` from it.
- **Reject for programmer error, resolve for runtime failure.** Invalid options throw; API failures route to `onError()`.
- **`null` and `undefined` both mean "not supplied"** for every option, everywhere.
- **Prettier owns formatting.** Run `yarn format:js:fix` before every commit; CI runs `yarn format:js`.
- **Markdown:** max 180 chars per line, tables aligned by `yarn format:md:fix`, checked by `yarn lint:md`.
- **Never use `--no-verify`.** If a hook fails, fix the cause and commit again.
- **A version bump is a two-file edit** (`package.json` and `src/Version.js`) — not needed by this plan, but do not touch one without the other.

---

## File Structure

| File                                                    | Responsibility                                                  |
| ------------------------------------------------------- | --------------------------------------------------------------- |
| `src/MetaComponents/CalendarScope.js` (create)          | Resolve a scope bag against metadata; derive control visibility |
| `src/RiteSelect/RiteSelect.js` (modify)                 | Render a restricted, ordered set of rites                       |
| `src/LiturgyOfTheDay/LiturgyOfTheDay.js` (modify)       | Replace rather than append on refetch; add a live region        |
| `src/MetaComponents/CalendarControls.js` (modify)       | Accept `scope`, apply it to its three children                  |
| `src/MetaComponents/DayViewer.js` (modify)              | Accept `scope` (builds its selects directly)                    |
| `src/MetaComponents/CalendarResourcePicker.js` (modify) | Accept `scope` (builds its selects directly)                    |
| `src/MetaComponents/TodayViewer.js` (create)            | New meta-component wrapping `LiturgyOfTheDay`                   |
| `src/index.js` (modify)                                 | Export `TodayViewer` only                                       |
| `type-fixtures/dts-consumer.ts` (modify)                | Compile-time assertions the runtime tests cannot reach          |

Tasks 1–3 are independent of each other and of the rest. Tasks 4–6 build `CalendarScope.js` bottom-up. Tasks 7–9 consume it. Task 10 is docs and examples.

---

### Task 1: LiturgyOfTheDay replaces its events instead of appending

**Why this is first:** the spec makes it a prerequisite. `#updateEventDetails()` appends without clearing, so
a second fetch renders today's liturgy twice. `TodayViewer` (Task 9) exposes controls that trigger refetches,
so it would be broken without this.

**Files:**

- Modify: `src/LiturgyOfTheDay/LiturgyOfTheDay.js` — `#updateEventDetails()`, around line 255
- Test: `src/__tests__/LiturgyOfTheDayRefetch.test.js` (create)

**Interfaces:**

- Consumes: nothing
- Produces: `LiturgyOfTheDay` renders exactly one set of events per fetch. Task 2 and Task 9 rely on this.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/LiturgyOfTheDayRefetch.test.js`:

```javascript
/** @jest-environment jsdom */
/**
 * `#updateEventDetails()` appended without clearing, so a second
 * `calendarFetched` rendered today's liturgy twice. CLAUDE.md recorded this as
 * a separate defect; it stops being separate once `TodayViewer` can expose a
 * control whose change triggers a refetch.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiClient from '../ApiClient/ApiClient.js';
import ApiBase from '../ApiClient/ApiBase.js';
import LiturgyOfTheDay from '../LiturgyOfTheDay/LiturgyOfTheDay.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

const today = new Date();
const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

const payload = () => ({
    litcal: [
        {
            event_key: 'Advent1',
            event_idx: 1,
            name: 'Dominica I in Adventu Domini',
            color: ['white'],
            color_lcl: ['albus'],
            grade: 7,
            grade_lcl: 'sollemnitas',
            grade_abbr: 'S',
            grade_display: '',
            common: [],
            common_lcl: '',
            type: 'mobile',
            date: `${iso}T00:00:00+00:00`,
            year: today.getFullYear(),
            month: today.getMonth() + 1,
            month_short: 'Nov.',
            month_long: 'November',
            day: today.getDate(),
            day_of_the_week_iso8601: 7,
            day_of_the_week_short: 'Sun',
            day_of_the_week_long: 'Sunday',
            liturgical_year: 'A',
            is_vigil_mass: false,
            psalter_week: 1,
            liturgical_season: 'ADVENT',
            liturgical_season_lcl: 'Advent',
            holy_day_of_obligation: false,
        },
    ],
    settings: { year: today.getFullYear(), locale: 'en', year_type: 'CIVIL' },
    metadata: { version: 'test' },
    messages: [],
});

let apiClient;

beforeEach(async () => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    apiClient = await ApiClient.init(API_URL);
    document.body.innerHTML = '<div id="host"></div>';
});

describe('LiturgyOfTheDay on a refetch', () => {
    it('replaces its events rather than appending a second copy', () => {
        const liturgy = new LiturgyOfTheDay({ locale: 'en' });
        liturgy.listenTo(apiClient);
        liturgy.appendTo('#host');

        apiClient._eventBus.emit('calendarFetched', payload());
        const afterFirst = document.querySelectorAll('#host h3').length;
        expect(afterFirst).toBe(1);

        apiClient._eventBus.emit('calendarFetched', payload());
        expect(document.querySelectorAll('#host h3').length).toBe(1);
    });

    it('shows the new events, not the old ones, after a refetch', () => {
        const liturgy = new LiturgyOfTheDay({ locale: 'en' });
        liturgy.listenTo(apiClient);
        liturgy.appendTo('#host');

        apiClient._eventBus.emit('calendarFetched', payload());
        const second = payload();
        second.litcal[0].name = 'Sanctorum Petri et Pauli';
        apiClient._eventBus.emit('calendarFetched', second);

        const headings = [...document.querySelectorAll('#host h3')].map(
            (h) => h.textContent,
        );
        expect(headings).toEqual(['Sanctorum Petri et Pauli']);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/__tests__/LiturgyOfTheDayRefetch.test.js`
Expected: FAIL — the first test reports 2 headings after the second emit, the second reports both names.

- [ ] **Step 3: Write the minimal implementation**

In `src/LiturgyOfTheDay/LiturgyOfTheDay.js`, at the top of `#updateEventDetails( todaysEvents )` — immediately before the existing `todaysEvents.forEach(` — insert:

```javascript
        // Replace, do not append. This method used to add to whatever was
        // already there, so a second `calendarFetched` rendered the day twice
        // and a third three times. It went unnoticed while nothing could
        // trigger a refetch on this component; `TodayViewer` can, because a
        // scope may leave a rite or calendar select on screen.
        this.#eventsElementsWrapper.replaceChildren();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/__tests__/LiturgyOfTheDayRefetch.test.js`
Expected: PASS, 2 tests.

- [ ] **Step 5: Run the whole suite for regressions**

Run: `yarn test`
Expected: all suites pass. If `LiturgyOfTheDay.test.js` fails, read the failing assertion — a test that relied
on accumulation is asserting the bug, and should be updated to assert replacement.

- [ ] **Step 6: Format and commit**

```bash
yarn format:js:fix
git add src/LiturgyOfTheDay/LiturgyOfTheDay.js src/__tests__/LiturgyOfTheDayRefetch.test.js
git commit -m "Replace LiturgyOfTheDay's events on refetch instead of appending"
```

---

### Task 2: LiturgyOfTheDay announces updates

**Why:** the spec folds this in. CLAUDE.md records that the live region was withheld _because_ of the duplication Task 1 removes, so the reason is gone.

**Files:**

- Modify: `src/LiturgyOfTheDay/LiturgyOfTheDay.js`
- Test: `src/__tests__/LiturgyOfTheDayAnnouncements.test.js` (create)

**Interfaces:**

- Consumes: Task 1's replace-not-append behaviour
- Produces: `LiturgyOfTheDay` accepts `announceUpdates` (constructor option and chainable setter, default `true`), matching `WebCalendar` and `LiturgyOfAnyDay`

- [ ] **Step 1: Read the two existing implementations first**

Run: `sed -n '1,60p' src/LiveAnnouncer.js` and `grep -n "announceUpdates\|#hasRendered\|LiveAnnouncer" src/LiturgyOfAnyDay/LiturgyOfAnyDay.js`

Follow `LiturgyOfAnyDay`'s shape exactly. Three rules from CLAUDE.md are non-negotiable:

1. Default **on**.
2. The **first render is silent**, and "first" is per REGION, not per instance — the region must be in the DOM before its content changes to be announced at all.
3. `#hasRendered` resets wherever the region is detached or replaced, including `announceUpdates( true )` after a `( false )`.

- [ ] **Step 2: Write the failing test**

Create `src/__tests__/LiturgyOfTheDayAnnouncements.test.js`. Reuse the `payload()` helper and `beforeEach`
from Task 1's file verbatim (copy them; the two files are independent), then:

```javascript
describe('LiturgyOfTheDay live region', () => {
    it('mounts a polite, atomic status region', () => {
        const liturgy = new LiturgyOfTheDay({ locale: 'en' });
        liturgy.listenTo(apiClient);
        liturgy.appendTo('#host');
        apiClient._eventBus.emit('calendarFetched', payload());

        const region = document.querySelector('#host [role="status"]');
        expect(region).not.toBeNull();
        expect(region.getAttribute('aria-live')).toBe('polite');
        expect(region.getAttribute('aria-atomic')).toBe('true');
    });

    it('says nothing on the first render', () => {
        const liturgy = new LiturgyOfTheDay({ locale: 'en' });
        liturgy.listenTo(apiClient);
        liturgy.appendTo('#host');
        apiClient._eventBus.emit('calendarFetched', payload());
        expect(
            document.querySelector('#host [role="status"]').textContent,
        ).toBe('');
    });

    it('announces on a later render', () => {
        const liturgy = new LiturgyOfTheDay({ locale: 'en' });
        liturgy.listenTo(apiClient);
        liturgy.appendTo('#host');
        apiClient._eventBus.emit('calendarFetched', payload());
        apiClient._eventBus.emit('calendarFetched', payload());
        expect(
            document.querySelector('#host [role="status"]').textContent.length,
        ).toBeGreaterThan(0);
    });

    it('stays silent when announceUpdates is false', () => {
        const liturgy = new LiturgyOfTheDay({
            locale: 'en',
            announceUpdates: false,
        });
        liturgy.listenTo(apiClient);
        liturgy.appendTo('#host');
        apiClient._eventBus.emit('calendarFetched', payload());
        apiClient._eventBus.emit('calendarFetched', payload());
        expect(document.querySelector('#host [role="status"]')).toBeNull();
    });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `yarn test src/__tests__/LiturgyOfTheDayAnnouncements.test.js`
Expected: FAIL — no `[role="status"]` element exists.

- [ ] **Step 4: Implement**

Mirror `LiturgyOfAnyDay`: add a `#announcer` field built from `LiveAnnouncer.js`, an `#announceUpdates = true`
field set from the constructor bag, a chainable `announceUpdates( value )` setter that validates a boolean and
throws naming the component otherwise, a `#hasRendered = false` flag, and an `#announce()` call at the end of
`#updateEventDetails()` that is skipped when `#hasRendered` is false (setting it true instead).

The announcement text is a short summary, never the content. Use the existing `LITURGY_OF_THE_DAY` message via
`message()` from `src/MessageLookup.js` plus the event count, following `WebCalendar`'s `#captionText()`
precedent of reusing an existing string rather than minting a second set of translations.

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn test src/__tests__/LiturgyOfTheDayAnnouncements.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 6: Run the whole suite, format, commit**

```bash
yarn test && yarn format:js:fix
git add src/LiturgyOfTheDay/LiturgyOfTheDay.js src/__tests__/LiturgyOfTheDayAnnouncements.test.js
git commit -m "Announce LiturgyOfTheDay updates through a live region"
```

---

### Task 3: RiteSelect renders a restricted, ordered set of rites

**Files:**

- Modify: `src/RiteSelect/RiteSelect.js` — the constructor's `innerHTML` assignment, around line 58
- Test: `src/__tests__/RiteSelectOptionSet.test.js` (create)

**Interfaces:**

- Consumes: nothing
- Produces: `new RiteSelect({ locale, rites })` where `rites` is `string[]`, and a chainable `rites( list )` setter. Tasks 7, 8 and 9 call these.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/RiteSelectOptionSet.test.js`:

```javascript
/** @jest-environment jsdom */
import { describe, it, expect } from '@jest/globals';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import { Rite } from '../Enums.js';

const values = (riteSelect) =>
    [...riteSelect._domElement.options].map((option) => option.value);

describe('RiteSelect option set', () => {
    it('renders every rite when none is named', () => {
        expect(values(new RiteSelect('en'))).toEqual(Object.values(Rite));
    });

    it('renders only the rites named, in the order given', () => {
        const select = new RiteSelect({
            locale: 'en',
            rites: [Rite.AMBROSIAN, Rite.ROMAN],
        });
        expect(values(select)).toEqual([Rite.AMBROSIAN, Rite.ROMAN]);
    });

    it('selects the first named rite', () => {
        const select = new RiteSelect({
            locale: 'en',
            rites: [Rite.AMBROSIAN, Rite.ROMAN],
        });
        expect(select._domElement.value).toBe(Rite.AMBROSIAN);
    });

    it('keeps the localized label for each rite it renders', () => {
        const select = new RiteSelect({ locale: 'it', rites: [Rite.ROMAN] });
        expect(select._domElement.options[0].textContent.length).toBeGreaterThan(
            0,
        );
    });

    it('is chainable as a setter', () => {
        const select = new RiteSelect('en');
        expect(select.rites([Rite.ROMAN])).toBe(select);
        expect(values(select)).toEqual([Rite.ROMAN]);
    });

    it('rejects a non-array', () => {
        expect(() => new RiteSelect({ locale: 'en', rites: 'roman' })).toThrow(
            /RiteSelect.*rites/,
        );
    });

    it('rejects an empty array', () => {
        expect(() => new RiteSelect({ locale: 'en', rites: [] })).toThrow(
            /RiteSelect.*empty/,
        );
    });

    it('rejects an unknown rite, naming it and the valid ones', () => {
        expect(
            () => new RiteSelect({ locale: 'en', rites: ['byzantine'] }),
        ).toThrow(/byzantine.*roman/s);
    });

    it('rejects a duplicate', () => {
        expect(
            () => new RiteSelect({ locale: 'en', rites: ['roman', 'roman'] }),
        ).toThrow(/RiteSelect.*duplicate/i);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/__tests__/RiteSelectOptionSet.test.js`
Expected: FAIL — the `rites` option is ignored, so the restricted cases return all rites.

- [ ] **Step 3: Implement**

In `src/RiteSelect/RiteSelect.js` add a private field and a validator, then route the constructor's option building through it:

```javascript
    /** @type {string[]} The rites this select offers, in order. */
    #rites = Object.values(Rite);

    /**
     * Validates a rite list and returns it.
     *
     * @param {unknown} list - The candidate list.
     * @returns {string[]} The validated list.
     * @throws {Error} If it is not a non-empty array of distinct known rites.
     */
    static #assertRites(list) {
        if (false === Array.isArray(list)) {
            throw new Error(
                `RiteSelect: rites must be an array of rite names, but found type: ${typeof list}`,
            );
        }
        if (0 === list.length) {
            throw new Error(
                'RiteSelect: rites must name at least one rite, but the array is empty.',
            );
        }
        const known = Object.values(Rite);
        for (const rite of list) {
            if (false === known.includes(rite)) {
                throw new Error(
                    `RiteSelect: unknown rite '${rite}'. Valid rites are: ${known.join(', ')}.`,
                );
            }
        }
        if (new Set(list).size !== list.length) {
            throw new Error(
                `RiteSelect: rites contains a duplicate: ${list.join(', ')}.`,
            );
        }
        return [...list];
    }
```

Add a chainable setter that rebuilds the options:

```javascript
    /**
     * Restricts the select to the named rites, in the order given.
     *
     * The first entry becomes the selected value, which is what makes
     * `scope.rite`'s first-element-is-initial rule visible in the DOM.
     *
     * @param {string[]} list - The rites to offer.
     * @returns {RiteSelect} This instance, for chaining.
     * @throws {Error} If the list is not a non-empty array of distinct known rites.
     */
    rites(list) {
        this.#rites = RiteSelect.#assertRites(list);
        this.#renderOptions();
        return this;
    }
```

Extract the constructor's existing `innerHTML` assignment into `#renderOptions()` so both paths share it — it
must iterate `this.#rites` rather than `Object.values( Rite )`, and must set `this.#domElement.value =
this.#rites[ 0 ]` instead of the hardcoded `Rite.ROMAN`. Then, in the constructor, after the existing
option-building call, honour the bag:

```javascript
        if (Object.hasOwn(options, 'rites')) {
            this.rites(options.rites);
        }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/__tests__/RiteSelectOptionSet.test.js`
Expected: PASS, 9 tests.

- [ ] **Step 5: Run the whole suite, format, commit**

```bash
yarn test && yarn format:js:fix
git add src/RiteSelect/RiteSelect.js src/__tests__/RiteSelectOptionSet.test.js
git commit -m "Let RiteSelect render a restricted, ordered set of rites"
```

---

### Task 4: CalendarScope resolves a scope to rites and calendars

**Files:**

- Create: `src/MetaComponents/CalendarScope.js`
- Test: `src/__tests__/CalendarScope.test.js` (create)

**Interfaces:**

- Consumes: `ApiBase` accessors `nationalCalendars()`, `diocesanCalendars( rite )`, `riteCalendars( rite )`, `locales()`
- Produces:

```javascript
resolveScope( scope, apiBase ) → null | {
    rites: string[],                    // ordered; first is the initial
    calendarsByRite: Object<string, ScopedCalendar[]>,
    initial: { rite: string, calendarType: 'rite'|'national'|'diocesan', calendarId: string, locale: string|null },
}
// ScopedCalendar = { type: 'rite'|'national'|'diocesan', id: string, locales: string[] }
```

**Returns `null` when the scope restricts nothing.** Callers then skip scope handling entirely, so every
existing code path is untouched — this is what keeps the change backward compatible.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/CalendarScope.test.js`. Use a LOCAL metadata literal, not `FULL_METADATA` — CLAUDE.md
requires the shared fixture stay byte-identical to the live `/calendars` response, so `lugano_ch` must not be
invented in it. `CalendarSelect.test.js` sets this precedent.

```javascript
/**
 * The scope resolver, as a pure function. No DOM: this file is about the
 * mapping from a scope bag plus metadata to rites, calendars and an initial
 * selection.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import { resolveScope } from '../MetaComponents/CalendarScope.js';
import { Rite } from '../Enums.js';

const API_URL = 'http://localhost:8000';

/**
 * Reproduces the real rite partition, with Lugano present so a nation scope
 * can be shown to exclude it. `US` has a Roman diocese and no Ambrosian one,
 * which is what makes the derived-rites rule observable.
 */
const METADATA = {
    locales: ['en', 'it', 'fr', 'la'],
    national_calendars: [
        { calendar_id: 'IT', locales: ['it'] },
        { calendar_id: 'US', locales: ['en'] },
        { calendar_id: 'CA', locales: ['fr-CA', 'en-CA'] },
        { calendar_id: 'CH', locales: ['de', 'fr', 'it'] },
    ],
    diocesan_calendars: [
        { calendar_id: 'romamo_it', nation: 'IT', diocese: 'Roma', locales: ['it'], rite: 'roman' },
        { calendar_id: 'milano_it', nation: 'IT', diocese: 'Milano', locales: ['it'], rite: 'ambrosian' },
        { calendar_id: 'lugano_ch', nation: 'CH', diocese: 'Lugano', locales: ['it'], rite: 'ambrosian' },
        { calendar_id: 'boston_us', nation: 'US', diocese: 'Boston', locales: ['en'], rite: 'roman' },
    ],
    ambrosian_calendars: [{ calendar_id: 'AMBROSIAN', locales: ['it', 'la'] }],
};

let base;

beforeEach(() => {
    ApiBase.reset();
    base = ApiBase.fromMetadata(API_URL, METADATA);
});

const ids = (resolved, rite) =>
    resolved.calendarsByRite[rite].map((calendar) => calendar.id);

describe('an empty scope', () => {
    it('resolves to null so existing behaviour is untouched', () => {
        expect(resolveScope(undefined, base)).toBeNull();
        expect(resolveScope(null, base)).toBeNull();
        expect(resolveScope({}, base)).toBeNull();
    });
});

describe('rites in scope are derived from the metadata', () => {
    it('gives a nation with both a national calendar and an Ambrosian diocese both rites', () => {
        expect(resolveScope({ nation: 'IT' }, base).rites).toEqual([
            Rite.ROMAN,
            Rite.AMBROSIAN,
        ]);
    });

    it('gives a nation with no Ambrosian diocese the Roman rite alone', () => {
        expect(resolveScope({ nation: 'US' }, base).rites).toEqual([
            Rite.ROMAN,
        ]);
    });

    it('gives a diocese scope exactly its own rite', () => {
        expect(resolveScope({ diocese: 'milano_it' }, base).rites).toEqual([
            Rite.AMBROSIAN,
        ]);
    });
});

describe('calendars per rite', () => {
    it('offers only the national calendar when includeDioceses is absent', () => {
        const resolved = resolveScope({ nation: 'IT' }, base);
        expect(ids(resolved, Rite.ROMAN)).toEqual(['IT']);
    });

    it('adds the nation’s dioceses when includeDioceses is true', () => {
        const resolved = resolveScope(
            { nation: 'IT', includeDioceses: true },
            base,
        );
        expect(ids(resolved, Rite.ROMAN)).toEqual(['IT', 'romamo_it']);
    });

    it('excludes a diocese belonging to another nation', () => {
        const resolved = resolveScope(
            { nation: 'IT', includeDioceses: true },
            base,
        );
        expect(ids(resolved, Rite.AMBROSIAN)).not.toContain('lugano_ch');
        expect(ids(resolved, Rite.AMBROSIAN)).toContain('milano_it');
    });

    it('stands the rite-level calendar in where the rite has no national tier', () => {
        const resolved = resolveScope({ nation: 'IT' }, base);
        expect(resolved.calendarsByRite[Rite.AMBROSIAN][0].type).toBe('rite');
    });
});

describe('scope.rite', () => {
    it('accepts a string and restricts to it', () => {
        expect(resolveScope({ nation: 'IT', rite: 'roman' }, base).rites).toEqual(
            [Rite.ROMAN],
        );
    });

    it('accepts an array and preserves its order as the initial', () => {
        const resolved = resolveScope(
            { nation: 'IT', rite: ['ambrosian', 'roman'] },
            base,
        );
        expect(resolved.rites).toEqual([Rite.AMBROSIAN, Rite.ROMAN]);
        expect(resolved.initial.rite).toBe(Rite.AMBROSIAN);
    });
});

describe('the initial selection', () => {
    it('names the first calendar of the first rite', () => {
        const resolved = resolveScope({ nation: 'IT' }, base);
        expect(resolved.initial).toMatchObject({
            rite: Rite.ROMAN,
            calendarType: 'national',
            calendarId: 'IT',
        });
    });

    it('carries a pinned locale through', () => {
        const resolved = resolveScope(
            { nation: 'CA', rite: 'roman', locale: 'fr-CA' },
            base,
        );
        expect(resolved.initial.locale).toBe('fr-CA');
    });

    it('leaves locale null when none is pinned', () => {
        expect(resolveScope({ nation: 'CA' }, base).initial.locale).toBeNull();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/__tests__/CalendarScope.test.js`
Expected: FAIL — `Cannot find module '../MetaComponents/CalendarScope.js'`.

- [ ] **Step 3: Implement**

Create `src/MetaComponents/CalendarScope.js` with a module doc comment recording that it is internal and not
exported from `src/index.js`, on the same reasoning as `Theme.js` and `FilterInputs.js`, then:

```javascript
import { Rite, RiteProperties } from '../Enums.js';

/**
 * Finds a diocesan calendar across every rite, returning it with its rite.
 *
 * @param {import('../ApiClient/ApiBase.js').default} apiBase - The loaded base.
 * @param {string} dioceseId - The diocesan calendar id.
 * @returns {?{calendar_id: string, nation: string, locales: string[], rite: string}}
 */
function findDiocese(apiBase, dioceseId) {
    for (const rite of Object.values(Rite)) {
        const found = apiBase
            .diocesanCalendars(rite)
            .find((entry) => entry.calendar_id === dioceseId);
        if (undefined !== found) {
            return { ...found, rite };
        }
    }
    return null;
}

/**
 * Whether a rite is in scope for a nation.
 *
 * A rite is in scope iff the nation has a national calendar for it, or at
 * least one diocese of it. This is what keeps an Ambrosian option off a
 * United States widget, where it would lead only to the bare Ambrosian
 * calendar. A rite with no national tier can only qualify through a diocese.
 *
 * @param {import('../ApiClient/ApiBase.js').default} apiBase - The loaded base.
 * @param {string} nation - The nation's calendar id.
 * @param {string} rite - The rite to test.
 * @returns {boolean}
 */
function nationHasRite(apiBase, nation, rite) {
    if (
        RiteProperties[rite].hasNationalTier &&
        apiBase
            .nationalCalendars()
            .some((entry) => entry.calendar_id === nation)
    ) {
        return true;
    }
    return apiBase
        .diocesanCalendars(rite)
        .some((entry) => entry.nation === nation);
}
```

Then `calendarsForRite( scope, apiBase, rite )` returning `ScopedCalendar[]`: for a `diocese` scope, the
single diocesan entry; for a `nation` scope, the national calendar when the rite has a national tier,
otherwise a `{ type: 'rite', id: '', locales: apiBase.locales() }` stand-in, followed by that nation's
dioceses of that rite when `includeDioceses` is `true`.

Finally `resolveScope( scope, apiBase )`: return `null` when `scope` is nullish or names neither `nation` nor
`diocese` nor `rite` nor `locale`; otherwise derive the rite list (diocese scope → that diocese's rite; nation
scope → filtered by `nationHasRite`; neither → `Object.values( Rite )`), intersect with `scope.rite`
normalized to an array **preserving the scope's order**, build `calendarsByRite`, and set `initial` from the
first rite and its first calendar plus `scope.locale ?? null`.

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/__tests__/CalendarScope.test.js`
Expected: PASS, 15 tests.

- [ ] **Step 5: Format and commit**

```bash
yarn format:js:fix
git add src/MetaComponents/CalendarScope.js src/__tests__/CalendarScope.test.js
git commit -m "Add CalendarScope's resolver: scope plus metadata to rites and calendars"
```

---

### Task 5: CalendarScope validates a scope bag

**Files:**

- Modify: `src/MetaComponents/CalendarScope.js`
- Modify: `src/__tests__/CalendarScope.test.js`

**Interfaces:**

- Consumes: Task 4's `resolveScope()`
- Produces: `assertScope( scope, componentName )`, throwing `Error` with the component named. Tasks 7–9 call it before resolving.

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/CalendarScope.test.js`:

```javascript
import { assertScope } from '../MetaComponents/CalendarScope.js';

describe('assertScope()', () => {
    it('accepts a nullish scope', () => {
        expect(() => assertScope(undefined, 'CalendarViewer', base)).not.toThrow();
        expect(() => assertScope(null, 'CalendarViewer', base)).not.toThrow();
    });

    it('rejects a non-object', () => {
        expect(() => assertScope('IT', 'CalendarViewer', base)).toThrow(
            /CalendarViewer.*scope/,
        );
    });

    it('rejects an unknown key, naming it and the accepted ones', () => {
        expect(() =>
            assertScope({ natoin: 'IT' }, 'CalendarViewer', base),
        ).toThrow(/natoin.*nation/s);
    });

    it('rejects a nation absent from the metadata', () => {
        expect(() => assertScope({ nation: 'ZZ' }, 'DayViewer', base)).toThrow(
            /DayViewer.*ZZ/,
        );
    });

    it('rejects a diocese absent from the metadata', () => {
        expect(() =>
            assertScope({ diocese: 'nowhere_xx' }, 'DayViewer', base),
        ).toThrow(/nowhere_xx/);
    });

    it('rejects a rite that contradicts the diocese, naming both', () => {
        expect(() =>
            assertScope(
                { rite: 'ambrosian', diocese: 'romamo_it' },
                'CalendarViewer',
                base,
            ),
        ).toThrow(/ambrosian.*romamo_it/s);
    });

    it('rejects a rite outside the set derived for the nation', () => {
        expect(() =>
            assertScope({ nation: 'US', rite: 'ambrosian' }, 'CalendarViewer', base),
        ).toThrow(/ambrosian.*roman/s);
    });

    it('rejects an empty rite array', () => {
        expect(() =>
            assertScope({ nation: 'IT', rite: [] }, 'CalendarViewer', base),
        ).toThrow(/empty/);
    });

    it('rejects a locale the resolved calendar does not support, listing those it does', () => {
        expect(() =>
            assertScope(
                { nation: 'IT', locale: 'de' },
                'CalendarViewer',
                base,
            ),
        ).toThrow(/de.*it/s);
    });

    it('accepts a locale the resolved calendar supports', () => {
        expect(() =>
            assertScope({ nation: 'CA', locale: 'fr-CA' }, 'CalendarViewer', base),
        ).not.toThrow();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/__tests__/CalendarScope.test.js`
Expected: FAIL — `assertScope` is not exported.

- [ ] **Step 3: Implement**

Add to `src/MetaComponents/CalendarScope.js`:

```javascript
/** The keys a scope bag may carry. */
const SCOPE_KEYS = Object.freeze([
    'rite',
    'nation',
    'diocese',
    'locale',
    'includeDioceses',
]);
```

and an `assertScope( scope, componentName, apiBase )` that returns early for a nullish scope, throws for a
non-plain-object, throws for any key outside `SCOPE_KEYS` naming the offender and listing `SCOPE_KEYS`, throws
for a `nation` or `diocese` absent from the metadata, throws for a `rite` contradicting an inferred diocese
rite, throws for a `rite` list whose intersection with the derived rites is empty (naming requested and
available), throws for an empty `rite` array, and throws for a `locale` outside the initial calendar's
`locales`.

Every message must be prefixed with `${componentName}:` followed by a space, so the component is named, matching the existing `assertTheme()` convention.

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/__tests__/CalendarScope.test.js`
Expected: PASS, 25 tests.

- [ ] **Step 5: Format and commit**

```bash
yarn format:js:fix
git add src/MetaComponents/CalendarScope.js src/__tests__/CalendarScope.test.js
git commit -m "Validate a scope bag, naming the component and the offending key"
```

---

### Task 6: CalendarScope derives control visibility

**Files:**

- Modify: `src/MetaComponents/CalendarScope.js`
- Modify: `src/__tests__/CalendarScope.test.js`

**Interfaces:**

- Consumes: Task 4's resolved object
- Produces: `deriveVisibility( resolved, currentRite, currentCalendarId, inputs )` → `{ riteSelect: boolean, calendarSelect: boolean, localeInput: boolean }`

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/CalendarScope.test.js`:

```javascript
import { deriveVisibility } from '../MetaComponents/CalendarScope.js';

describe('deriveVisibility()', () => {
    it('hides every control for a single fully-determined calendar', () => {
        const resolved = resolveScope({ diocese: 'romamo_it' }, base);
        expect(
            deriveVisibility(resolved, Rite.ROMAN, 'romamo_it', {}),
        ).toEqual({
            riteSelect: false,
            calendarSelect: false,
            localeInput: false,
        });
    });

    it('shows only the rite select for a national-only two-rite scope', () => {
        const resolved = resolveScope({ nation: 'IT' }, base);
        expect(deriveVisibility(resolved, Rite.ROMAN, 'IT', {})).toEqual({
            riteSelect: true,
            calendarSelect: false,
            localeInput: false,
        });
    });

    it('shows the calendar select once dioceses widen the scope', () => {
        const resolved = resolveScope(
            { nation: 'IT', includeDioceses: true },
            base,
        );
        expect(
            deriveVisibility(resolved, Rite.ROMAN, 'IT', {}).calendarSelect,
        ).toBe(true);
    });

    it('re-derives per rite, not once at mount', () => {
        // `CH` has an Ambrosian diocese and a national calendar, so the
        // calendar select is meaningful under Ambrosian and not under Roman.
        const resolved = resolveScope(
            { nation: 'CH', includeDioceses: true },
            base,
        );
        expect(
            deriveVisibility(resolved, Rite.ROMAN, 'CH', {}).calendarSelect,
        ).toBe(false);
        expect(
            deriveVisibility(resolved, Rite.AMBROSIAN, '', {}).calendarSelect,
        ).toBe(true);
    });

    it('shows the locale input when the current calendar has several locales', () => {
        const resolved = resolveScope({ nation: 'CA' }, base);
        expect(
            deriveVisibility(resolved, Rite.ROMAN, 'CA', {}).localeInput,
        ).toBe(true);
    });

    it('hides the locale input when the scope pins one', () => {
        const resolved = resolveScope({ nation: 'CA', locale: 'fr-CA' }, base);
        expect(
            deriveVisibility(resolved, Rite.ROMAN, 'CA', {}).localeInput,
        ).toBe(false);
    });

    it('lets inputs force a control on', () => {
        const resolved = resolveScope({ diocese: 'romamo_it' }, base);
        expect(
            deriveVisibility(resolved, Rite.ROMAN, 'romamo_it', {
                calendarSelect: true,
            }).calendarSelect,
        ).toBe(true);
    });

    it('lets inputs force a control off', () => {
        const resolved = resolveScope({ nation: 'IT' }, base);
        expect(
            deriveVisibility(resolved, Rite.ROMAN, 'IT', { riteSelect: false })
                .riteSelect,
        ).toBe(false);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/__tests__/CalendarScope.test.js`
Expected: FAIL — `deriveVisibility` is not exported.

- [ ] **Step 3: Implement**

```javascript
/**
 * Which controls have a choice to offer.
 *
 * Two of the three are RUNTIME-dependent rather than mount-time constants:
 * switching rite changes the calendar set, and switching calendar changes the
 * locale set. Callers must therefore re-derive on every rite and calendar
 * change, in the one place both land — `CalendarSelect._setHidden()`'s doc
 * comment records what happens when visibility is derived on the rite side
 * alone.
 *
 * @param {?Object} resolved - `resolveScope()`'s result, or `null` for no scope.
 * @param {string} currentRite - The rite now selected.
 * @param {string} currentCalendarId - The calendar id now selected; `''` for rite-level.
 * @param {Object<string, boolean>} inputs - Per-control overrides.
 * @returns {{riteSelect: boolean, calendarSelect: boolean, localeInput: boolean}}
 */
export function deriveVisibility(resolved, currentRite, currentCalendarId, inputs = {}) {
    const derived =
        null === resolved
            ? { riteSelect: true, calendarSelect: true, localeInput: true }
            : {
                  riteSelect: resolved.rites.length > 1,
                  calendarSelect:
                      (resolved.calendarsByRite[currentRite] ?? []).length > 1,
                  localeInput: localeChoiceCount(resolved, currentRite, currentCalendarId) > 1,
              };
    for (const key of ['riteSelect', 'calendarSelect', 'localeInput']) {
        if (typeof inputs?.[key] === 'boolean') {
            derived[key] = inputs[key];
        }
    }
    return derived;
}
```

with a `localeChoiceCount()` helper returning `1` when `resolved.initial.locale` is non-null (a pinned locale is one choice), else the current calendar's `locales.length`.

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/__tests__/CalendarScope.test.js`
Expected: PASS, 33 tests.

- [ ] **Step 5: Format and commit**

```bash
yarn format:js:fix
git add src/MetaComponents/CalendarScope.js src/__tests__/CalendarScope.test.js
git commit -m "Derive control visibility from a resolved scope"
```

---

### Task 7: CalendarControls accepts a scope

**Files:**

- Modify: `src/MetaComponents/CalendarControls.js`
- Test: `src/__tests__/CalendarControlsScope.test.js` (create)

**Interfaces:**

- Consumes: Tasks 3–6
- Produces: `new CalendarControls({ scope, ... })` and the same key on `mountInto()`. `CalendarViewer`,
  `ApiExplorer` and `SubscriptionBuilder` inherit it with no change of their own beyond forwarding.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/CalendarControlsScope.test.js` using the same local `METADATA` literal as Task 4 (copy it), and assert, through the mounted DOM:

```javascript
describe('CalendarControls with a scope', () => {
    it('hides every control for a diocese scope', () => {
        const controls = new CalendarControls({
            locale: 'en',
            scope: { diocese: 'romamo_it' },
        });
        controls.appendTo('#mount');
        expect(controls.riteSelect._domElement.hidden).toBe(true);
        expect(controls.calendarSelect._domElement.hidden).toBe(true);
    });

    it('shows the rite select for a two-rite national scope', () => {
        const controls = new CalendarControls({
            locale: 'en',
            scope: { nation: 'IT' },
        });
        controls.appendTo('#mount');
        expect(controls.riteSelect._domElement.hidden).toBe(false);
        expect(controls.calendarSelect._domElement.hidden).toBe(true);
    });

    it('restricts the rite select to the rites in scope', () => {
        const controls = new CalendarControls({
            locale: 'en',
            scope: { nation: 'US' },
        });
        controls.appendTo('#mount');
        expect(
            [...controls.riteSelect._domElement.options].map((o) => o.value),
        ).toEqual(['roman']);
    });

    it('selects the scope’s calendar', () => {
        const controls = new CalendarControls({
            locale: 'en',
            scope: { diocese: 'romamo_it' },
        });
        controls.appendTo('#mount');
        expect(controls.calendarSelect._domElement.value).toBe('romamo_it');
    });

    it('re-derives visibility when the rite changes', () => {
        const controls = new CalendarControls({
            locale: 'en',
            scope: { nation: 'CH', includeDioceses: true },
        });
        controls.appendTo('#mount');
        expect(controls.calendarSelect._domElement.hidden).toBe(true);
        controls.riteSelect._domElement.value = 'ambrosian';
        controls.riteSelect._domElement.dispatchEvent(new Event('change'));
        expect(controls.calendarSelect._domElement.hidden).toBe(false);
    });

    it('throws for an unknown scope key, naming the component', () => {
        expect(
            () => new CalendarControls({ locale: 'en', scope: { natoin: 'IT' } }),
        ).toThrow(/CalendarControls.*natoin/s);
    });

    it('leaves an unscoped instance exactly as before', () => {
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#mount');
        expect(controls.riteSelect._domElement.hidden).toBe(false);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/__tests__/CalendarControlsScope.test.js`
Expected: FAIL — `scope` is rejected as an unknown option, or ignored.

- [ ] **Step 3: Implement**

In `CalendarControls`' constructor, after the existing theme assertion, call `assertScope( bag.scope,
'CalendarControls', base )` then store `resolveScope( bag.scope, base )` in a `#scope` field. When it is
non-null:

1. Pass `rites: resolved.rites` to the `RiteSelect` constructor (Task 3).
2. After the calendar select is built, set its value to `resolved.initial.calendarId` — using `value('')` for a `rite` type, which is the documented rite-level spelling.
3. Add a `#applyScopeVisibility()` private method calling `deriveVisibility()` with the live rite and calendar
   values plus the resolved `inputs` bag, then `_setHidden()` on each of the three children.
4. Call it once after mounting **and** from the existing rite-change and calendar-change listeners — the one place both land, per the spec.

Add `scope` to the constructor's accepted option keys and to `mountInto()`'s forwarded options.

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/__tests__/CalendarControlsScope.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 5: Run the whole suite, format, commit**

```bash
yarn test && yarn format:js:fix
git add src/MetaComponents/CalendarControls.js src/__tests__/CalendarControlsScope.test.js
git commit -m "Accept a scope on CalendarControls and derive its controls from it"
```

---

### Task 8: DayViewer and CalendarResourcePicker accept a scope

**Files:**

- Modify: `src/MetaComponents/DayViewer.js`
- Modify: `src/MetaComponents/CalendarResourcePicker.js`
- Test: `src/__tests__/DayViewerScope.test.js` (create)
- Test: `src/__tests__/CalendarResourcePickerScope.test.js` (create)

**Interfaces:**

- Consumes: Tasks 3–6
- Produces: `scope` accepted on both components' constructors and `mountInto()`

Both build their selects directly rather than through `CalendarControls`, which is why they need their own wiring rather than inheriting Task 7's.

- [ ] **Step 1: Write the failing tests**

Create both files, each with the Task 4 `METADATA` literal, asserting the same three things per component: a
diocese scope hides both selects and selects the scoped calendar; a `{nation:'US'}` scope restricts the rite
select to `['roman']`; an unknown scope key throws naming that component (`/DayViewer.*natoin/s` and
`/CalendarResourcePicker.*natoin/s` respectively). For `DayViewer` also assert its locale input is hidden when
`scope.locale` is pinned.

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test src/__tests__/DayViewerScope.test.js src/__tests__/CalendarResourcePickerScope.test.js`
Expected: FAIL on both.

- [ ] **Step 3: Implement**

Apply the same four-step wiring as Task 7 in each constructor. `CalendarResourcePicker` has no locale input,
so it derives only `riteSelect` and `calendarSelect`; pass no `localeInput` key and ignore the third field of
the returned bag.

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test src/__tests__/DayViewerScope.test.js src/__tests__/CalendarResourcePickerScope.test.js`
Expected: PASS.

- [ ] **Step 5: Run the whole suite, format, commit**

```bash
yarn test && yarn format:js:fix
git add src/MetaComponents/DayViewer.js src/MetaComponents/CalendarResourcePicker.js src/__tests__/DayViewerScope.test.js src/__tests__/CalendarResourcePickerScope.test.js
git commit -m "Accept a scope on DayViewer and CalendarResourcePicker"
```

---

### Task 9: TodayViewer

**Files:**

- Create: `src/MetaComponents/TodayViewer.js`
- Modify: `src/index.js`
- Test: `src/__tests__/TodayViewer.test.js` (create)
- Test: `src/__tests__/TodayViewerMount.test.js` (create)

**Interfaces:**

- Consumes: Tasks 1–8
- Produces: `TodayViewer` exported from `src/index.js`, with `mountInto( target, options )`, `appendTo( target
)`, `settled`, `onError()`, `onCalendarFetched()`, `dispose()`, and getters `riteSelect`, `calendarSelect`,
  `localeInput`, `liturgy`

- [ ] **Step 1: Read DayViewer end to end first**

Run: `cat src/MetaComponents/DayViewer.js`

`TodayViewer` is its sibling and must match it on every convention: single target or slots object,
reject-for-programmer-error, resolve-on-runtime-failure routing to `onError()`, `settled` normalized through
`Settled.js` (never rejecting, always resolving `undefined`), theme resolution through `Theme.js`, and an
idempotent `dispose()` with the documented gap around `ApiClient`'s internal listeners.

- [ ] **Step 2: Write the failing tests**

`TodayViewer.test.js` covers construction and the children (all four getters non-null; an unparseable locale
throws naming `TodayViewer`; a malformed theme throws naming `TodayViewer`; a scope with an unknown key throws
naming `TodayViewer`). `TodayViewerMount.test.js` covers `mountInto()` with a single target and with slots,
`settled` resolving, `onError()` receiving a failed initial fetch while the component still mounts, and
`dispose()` being idempotent.

Mirror the assertions in `DayViewer.test.js` and `DayViewerMount.test.js` rather than inventing new shapes.

- [ ] **Step 3: Run tests to verify they fail**

Run: `yarn test src/__tests__/TodayViewer.test.js src/__tests__/TodayViewerMount.test.js`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Write `src/MetaComponents/TodayViewer.js` modelled on `DayViewer.js`, substituting `LiturgyOfTheDay` for
`LiturgyOfAnyDay` and omitting the date-controls block entirely. Register `TodayViewer` in `Theme.js`'s
`THEME_CHILD_KEYS` with the child keys it actually resolves (`riteSelect`, `calendarSelect`, `localeInput`,
`liturgy`, plus `apiOptions`) — omitting it means `assertTheme()` throws for an unregistered component.

Export it from `src/index.js` beside the other meta-components. Do **not** export `CalendarScope.js`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn test src/__tests__/TodayViewer.test.js src/__tests__/TodayViewerMount.test.js`
Expected: PASS.

- [ ] **Step 6: Run the whole suite, compile, check declarations**

```bash
yarn test && yarn compile && yarn lint:dts
```

- [ ] **Step 7: Format and commit**

```bash
yarn format:js:fix
git add src/MetaComponents/TodayViewer.js src/index.js src/MetaComponents/Theme.js src/__tests__/TodayViewer.test.js src/__tests__/TodayViewerMount.test.js
git commit -m "Add TodayViewer, a scoped LiturgyOfTheDay meta-component"
```

---

### Task 10: Declaration assertions, documentation and an example

**Files:**

- Modify: `type-fixtures/dts-consumer.ts`
- Modify: `CLAUDE.md`
- Modify: `docs/meta-components.md`
- Modify: `CHANGELOG.md`
- Create: `examples/ScopedWidgets/index.html`
- Create: `examples/ScopedWidgets/main.js`

**Interfaces:**

- Consumes: everything above
- Produces: nothing further depends on this task

- [ ] **Step 1: Add the compile-time assertions**

`TodayViewer` reaching `dist/` at the right type is a `.d.ts`-only class of bug that `yarn test` cannot see —
the trap CLAUDE.md documents for `VERSION` and for `@readonly` getters. Append to
`type-fixtures/dts-consumer.ts`:

```typescript
import { TodayViewer } from '../dist/index.js';

// The documented recipe must compile for a consumer.
async function scopedTodayViewer(): Promise<void> {
    const viewer = await TodayViewer.mountInto('#today', {
        locale: 'it',
        scope: { rite: 'roman', diocese: 'romamo_it' },
    });
    await viewer.settled;
    viewer.dispose();
}

// `scope.rite` must accept both a string and an array.
const scopeWithStringRite: { rite: string } = { rite: 'roman' };
const scopeWithArrayRite: { rite: string[] } = { rite: ['roman', 'ambrosian'] };
void scopedTodayViewer;
void scopeWithStringRite;
void scopeWithArrayRite;
```

- [ ] **Step 2: Verify the declarations**

```bash
yarn compile && yarn lint:dts
```

Expected: no output from either.

- [ ] **Step 3: Write the example**

`examples/ScopedWidgets/` shows two widgets side by side: the Diocese of Rome (`scope: { diocese: 'romamo_it'
}, locale: 'it'`, no controls) and the Italian Bishops' Conference (`scope: { nation: 'IT' }`, rite select
only). Follow the structure of an existing example directory — run `ls examples/` and copy the closest one's
`index.html` shape.

- [ ] **Step 4: Write the documentation**

- `CLAUDE.md`: a section covering the scope model, the derived-rites rule, the derived-visibility rule with its
  runtime-dependence warning, the `inputs` override and its two documented wrinkles, and `TodayViewer`.
- `docs/meta-components.md`: a `TodayViewer` section, and scope coverage for the other six.
- `CHANGELOG.md` under `[Unreleased]`: **Added** for `scope`, `TodayViewer` and `RiteSelect`'s option set;
  **Behaviour changes** for `LiturgyOfTheDay` replacing rather than duplicating and gaining a live region.

- [ ] **Step 5: Lint the documentation**

```bash
yarn format:md:fix && yarn lint:md && yarn format:md
```

Expected: `Summary: 0 issues in 0 files`, then `All matched files use Prettier code style!`

- [ ] **Step 6: Full CI parity, then commit**

```bash
yarn compile && yarn lint:dts && yarn test && yarn lint:md && yarn format:md && yarn format:js && yarn storybook:build
git add -A
git commit -m "Document calendar scope and TodayViewer, with a worked example"
```

---

## Self-Review

**Spec coverage.** Every spec section maps to a task: the scope object and resolution → Task 4; `scope.rite`
as a set → Tasks 3, 4; derived rites → Task 4; `includeDioceses` → Task 4; derived visibility and the `inputs`
override → Task 6; `CalendarScope.js` → Tasks 4–6; the consumer table → Tasks 7, 8; `RiteSelect`'s option set
→ Task 3; `TodayViewer` → Task 9; the `LiturgyOfTheDay` prerequisite and its live region → Tasks 1, 2; error
handling → Task 5; testing → each task's own tests plus Task 10's `.d.ts` fixture; docs, CHANGELOG and the
example → Task 10.

**Type consistency.** `resolveScope()` returns `null` or `{rites, calendarsByRite, initial}` in Tasks 4, 6, 7,
8 and 9 alike. `deriveVisibility()` returns `{riteSelect, calendarSelect, localeInput}` everywhere.
`RiteSelect`'s option is `rites` (plural) as both a constructor key and a setter in Tasks 3, 7, 8 and 9.
`assertScope( scope, componentName, apiBase )` takes the same three arguments in Tasks 5, 7, 8 and 9.

**Known risk, called out rather than hidden.** Task 7 step 3 asserts that re-deriving visibility from the
existing rite-change and calendar-change listeners is sufficient. `CalendarSelect._setHidden()`'s doc comment
records a leak from deriving on the rite side alone, and `ApiOptions`' path builder re-filters a single select
without a rite change. If the Task 7 re-derivation test passes but a `PathBuilder`-driven filter change leaves
a control stale, the fix is to settle visibility in `#reapplyOptionsToDom()` — where filter and rite both land
— rather than in the listeners.
