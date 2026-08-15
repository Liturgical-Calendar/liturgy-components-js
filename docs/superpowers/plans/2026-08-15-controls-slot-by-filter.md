# Filter-keyed `controls` slot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the `controls` slot of `CalendarControls` and `CalendarViewer` take an object keyed by
`ApiOptions` filter, so the component performs the multi-container passes itself, in the right order, and
validates overlap and `NONE` before mounting anything.

**Architecture:** The filter→inputs mapping is extracted out of `ApiOptions.appendTo()`'s `if` branches into
a new internal module (`src/ApiOptions/FilterInputs.js`) which `appendTo()` then iterates — one copy, two
consumers. A second new internal module (`src/MetaComponents/ControlSlots.js`) validates a filter-keyed bag
against that mapping and returns the passes in a canonical order. `CalendarControls.appendTo()` consumes it;
`CalendarViewer` inherits it by forwarding `slots.controls` verbatim, as it already does.

**Tech Stack:** ES2022 JavaScript modules, JSDoc-typed (`checkJs` off), Jest 30 + jsdom, prettier
(`tabWidth: 4`, `singleQuote: true`), markdownlint-cli2.

**Spec:** `docs/superpowers/specs/2026-08-15-controls-slot-by-filter-design.md`

## Global Constraints

- Work only in `/home/johnrdorazio/development/LiturgicalCalendar/liturgy-components-js/.claude/worktrees/issue-63`, branch `feat/controls-slots-by-filter`.
- Line endings are LF, enforced by `.gitattributes`. Never write CRLF.
- `appendTo()` returns `undefined`. Do not change that on any component.
- Do NOT touch `src/MetaComponents/Theme.js`, `src/Messages.js`, `src/WebCalendar/`, `src/LiturgyOfAnyDay/`.
- Do NOT rename any `ApiOptions` accessor. Read the underscore forms that exist today (`_filter`, `_localeInput`, `_acceptHeaderInput`).
- Keep edits to `src/MetaComponents/CalendarControls.js` confined to slot handling (issue #68 lands in that file next).
- New modules are internal: do NOT add them to `src/index.js`'s exports.
- Baseline gate: `yarn test` is 80 suites / 1518 tests on `main`.
- Gates that must all pass at the end: `yarn test`; `yarn compile && yarn lint:dts`; `yarn format:js`; `yarn format:md`; `yarn lint:md`.
- Commit with `git commit -S`, message ending `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`. Do not push, do not open a PR.

## File Structure

| File                                                                                                    | Responsibility                                                                                                               |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/ApiOptions/FilterInputs.js` (new)                                                                  | The single filter→ordered-input-keys mapping, and `inputKeysForFilter()`. Internal.                                          |
| `src/ApiOptions/ApiOptions.js` (modify, `appendTo()` only)                                              | Iterates the mapping instead of hard-coding five `if` branches.                                                              |
| `src/MetaComponents/ControlSlots.js` (new)                                                              | Recognises and validates a filter-keyed `controls` bag; returns canonical-ordered passes plus the selects' target. Internal. |
| `src/MetaComponents/CalendarControls.js` (modify, `appendTo()`/`#targetElement()`/`dispose()`/`#mount`) | Consumes `ControlSlots.js`; mounts each pass; tracks several mounts.                                                         |
| `src/MetaComponents/CalendarViewer.js` (modify, `#targetElement()` + JSDoc)                             | Recognises an `HTMLElement` inside a filter-keyed bag for the cancellation pre-check.                                        |
| `src/__tests__/FilterInputs.test.js` (new)                                                              | Conformance: the mapping describes what `ApiOptions.appendTo()` actually appends.                                            |
| `src/__tests__/ControlsSlotByFilter.test.js` (new)                                                      | The three rules, the key vocabulary, resolution-before-mount, dispose, viewer forwarding.                                    |
| `docs/meta-components.md` (modify)                                                                      | "Multi-row option layouts" rewritten to lead with the declarative form.                                                      |
| `CLAUDE.md`, `CHANGELOG.md` (modify)                                                                    | Contract summary and an `## [Unreleased]` entry.                                                                             |

---

### Task 1: Extract the filter→inputs mapping

**Files:**

- Create: `src/ApiOptions/FilterInputs.js`
- Modify: `src/ApiOptions/ApiOptions.js` — `appendTo()`, lines 1377-1429, and the import block at the top
- Test: `src/__tests__/FilterInputs.test.js`

**Interfaces:**

- Consumes: `ApiOptionsFilter` from `src/Enums.js`.
- Produces:
  - `INPUT_KEYS_BY_FILTER: ReadonlyMap<string|null, readonly string[]>`
  - `inputKeysForFilter(filter: string|null): readonly string[]` — throws `Error` on an unrecognised filter.

- [ ] **Step 1: Write the failing conformance test**

Create `src/__tests__/FilterInputs.test.js`:

```javascript
/**
 * @jest-environment jsdom
 */
import ApiOptions from '../ApiOptions/ApiOptions.js';
import ApiBase from '../ApiClient/ApiBase.js';
import { ApiOptionsFilter } from '../Enums.js';
import {
    INPUT_KEYS_BY_FILTER,
    inputKeysForFilter,
} from '../ApiOptions/FilterInputs.js';
import metadata from '../__fixtures__/metadata.js';

const BASE = 'http://localhost:8000';

/**
 * The `id` each `ApiOptions` input renders with, so a mounted container can be
 * read back as a set of input KEYS and compared with the mapping.
 */
const ID_BY_INPUT_KEY = {
    epiphanyInput: 'epiphany',
    ascensionInput: 'ascension',
    corpusChristiInput: 'corpusChristi',
    eternalHighPriestInput: 'eternalHighPriest',
    holydaysOfObligationInput: 'holydaysOfObligation',
    localeInput: 'locale',
    yearTypeInput: 'yearType',
    acceptHeaderInput: 'acceptHeader',
    yearInput: 'year',
    calendarPathInput: 'calendarPath',
};

function mountedKeys(container) {
    return Object.entries(ID_BY_INPUT_KEY)
        .filter(([, id]) => null !== container.querySelector(`#${id}`))
        .map(([key]) => key);
}

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(BASE, metadata);
    document.body.innerHTML = '<div id="target"></div>';
});

describe('FilterInputs', () => {
    it.each([
        ['PATH_BUILDER', ApiOptionsFilter.PATH_BUILDER],
        ['LOCALE_ONLY', ApiOptionsFilter.LOCALE_ONLY],
        ['YEAR_ONLY', ApiOptionsFilter.YEAR_ONLY],
        ['ALL_CALENDARS', ApiOptionsFilter.ALL_CALENDARS],
        ['GENERAL_ROMAN', ApiOptionsFilter.GENERAL_ROMAN],
        ['NONE', ApiOptionsFilter.NONE],
    ])(
        'the mapping for %s matches what ApiOptions.appendTo() appends',
        (_name, filter) => {
            const apiOptions = new ApiOptions({ locale: 'en' }).filter(filter);
            const target = document.getElementById('target');
            apiOptions.appendTo(target);
            expect(mountedKeys(target).sort()).toEqual(
                [...inputKeysForFilter(filter)].sort(),
            );
        },
    );

    it('covers every ApiOptionsFilter value exactly once', () => {
        expect([...INPUT_KEYS_BY_FILTER.keys()].sort()).toEqual(
            [
                ApiOptionsFilter.PATH_BUILDER,
                ApiOptionsFilter.LOCALE_ONLY,
                ApiOptionsFilter.YEAR_ONLY,
                ApiOptionsFilter.ALL_CALENDARS,
                ApiOptionsFilter.GENERAL_ROMAN,
                ApiOptionsFilter.NONE,
            ].sort(),
        );
    });

    it('throws by name for a filter it does not know', () => {
        expect(() => inputKeysForFilter('nope')).toThrow(
            /inputKeysForFilter: unrecognised ApiOptions filter: nope/,
        );
    });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `yarn test src/__tests__/FilterInputs.test.js`
Expected: FAIL — `Cannot find module '../ApiOptions/FilterInputs.js'`.

If the `id` values in `ID_BY_INPUT_KEY` do not match the real ones, the per-filter tests will report empty
sets. Confirm each id against `src/ApiOptions/Input/*.js` and fix the table, not the mapping.

- [ ] **Step 3: Create the mapping module**

Create `src/ApiOptions/FilterInputs.js`:

```javascript
/**
 * Which `ApiOptions` inputs each `ApiOptionsFilter` renders, and in what order.
 *
 * Deliberately NOT exported from `src/index.js`, on the same reasoning as
 * `Theme.js`, `InputVisibility.js`, `LocaleValidation.js` and
 * `OptionsValidation.js`: internal contract between the components, not public
 * API.
 *
 * **Why this is a module rather than five `if` branches.** It used to be the
 * latter, inside `ApiOptions.appendTo()`. Issue #63 needed the same knowledge a
 * second time — a filter-keyed `controls` slot cannot tell whether two of its
 * keys would fight over an input without it — and a second copy is a mapping
 * free to drift the first time a filter gains an input. `appendTo()` now reads
 * this table too, so there is one copy and both consumers read it.
 *
 * **What is deliberately NOT here.** Two of `appendTo()`'s decisions are
 * runtime state, not properties of a filter, and stay where they are:
 * `acceptHeaderInput` is skipped once `AcceptHeaderInput.hide()` has been
 * called, and `yearInput` is skipped under `ALL_CALENDARS`/`NONE` once a
 * `PATH_BUILDER` pass has already claimed it (`#pathBuilderEnabled`).
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import { ApiOptionsFilter } from '../Enums.js';

/**
 * The inputs `ALL_CALENDARS` renders, in append order. Named because `NONE`
 * renders these followed by the General Roman five.
 *
 * @type {Readonly<string[]>}
 */
const ALL_CALENDARS_INPUTS = Object.freeze([
    'localeInput',
    'yearTypeInput',
    'acceptHeaderInput',
    'yearInput',
]);

/**
 * The five parameters a national or diocesan calendar predetermines, in append
 * order. Named for the same reason as {@link ALL_CALENDARS_INPUTS}.
 *
 * @type {Readonly<string[]>}
 */
const GENERAL_ROMAN_INPUTS = Object.freeze([
    'epiphanyInput',
    'ascensionInput',
    'corpusChristiInput',
    'eternalHighPriestInput',
    'holydaysOfObligationInput',
]);

/**
 * A `Map` rather than an object literal because `ApiOptionsFilter.NONE` is
 * `null`, which an object literal would coerce to the string `'null'` and so
 * fail to distinguish from a filter actually named that.
 *
 * @type {ReadonlyMap<string|null, Readonly<string[]>>}
 */
const INPUT_KEYS_BY_FILTER = new Map([
    [
        ApiOptionsFilter.PATH_BUILDER,
        Object.freeze(['calendarPathInput', 'yearInput']),
    ],
    [ApiOptionsFilter.LOCALE_ONLY, Object.freeze(['localeInput'])],
    [ApiOptionsFilter.YEAR_ONLY, Object.freeze(['yearInput'])],
    [ApiOptionsFilter.ALL_CALENDARS, ALL_CALENDARS_INPUTS],
    [ApiOptionsFilter.GENERAL_ROMAN, GENERAL_ROMAN_INPUTS],
    [
        ApiOptionsFilter.NONE,
        Object.freeze([...ALL_CALENDARS_INPUTS, ...GENERAL_ROMAN_INPUTS]),
    ],
]);

/**
 * The `ApiOptions` input keys a filter renders, in append order.
 *
 * @param {string|null} filter - An `ApiOptionsFilter` value.
 * @returns {Readonly<string[]>} The input keys, in append order.
 * @throws {Error} If the filter is not an `ApiOptionsFilter` value.
 */
function inputKeysForFilter(filter) {
    const keys = INPUT_KEYS_BY_FILTER.get(filter);
    if (undefined === keys) {
        throw new Error(
            `inputKeysForFilter: unrecognised ApiOptions filter: ${String(filter)}`,
        );
    }
    return keys;
}

export { INPUT_KEYS_BY_FILTER, inputKeysForFilter };
```

- [ ] **Step 4: Run the test again**

Run: `yarn test src/__tests__/FilterInputs.test.js`
Expected: PASS — the mapping already describes today's `appendTo()`, so the conformance tests pass before
`appendTo()` is touched. That is the point: it proves the table before anything depends on it.

- [ ] **Step 5: Rewrite `ApiOptions.appendTo()` to iterate the mapping**

In `src/ApiOptions/ApiOptions.js`, add to the imports near the top (beside the existing `Enums.js` import):

```javascript
import { inputKeysForFilter } from './FilterInputs.js';
```

Replace the body of `appendTo()` from the `if ( ApiOptionsFilter.PATH_BUILDER === this.#filter )` line
through the closing brace of the `GENERAL_ROMAN` block (currently lines 1388-1423) with:

```javascript
        // The set of inputs is looked up in `FilterInputs.js` rather than
        // branched on here, so the filter-keyed `controls` slot on the
        // meta-components (#63) reads the SAME mapping when it checks two of
        // its keys for an input in common. Two copies would drift.
        //
        // The two skips below are runtime state rather than properties of a
        // filter, which is why they stay here: `hide()` is irreversible and is
        // read at append time, and `#pathBuilderEnabled` records that an
        // earlier pass on this same instance already mounted the year input.
        const dedupeYearInput =
            (ApiOptionsFilter.NONE === this.#filter ||
                ApiOptionsFilter.ALL_CALENDARS === this.#filter) &&
            true === this.#pathBuilderEnabled;
        for (const key of inputKeysForFilter(this.#filter)) {
            if (
                'acceptHeaderInput' === key &&
                true === this.#inputs.acceptHeaderInput._hidden
            ) {
                continue;
            }
            if ('yearInput' === key && dedupeYearInput) {
                continue;
            }
            this.#inputs[key].appendTo(domNode);
        }
        if (ApiOptionsFilter.PATH_BUILDER === this.#filter) {
            this.#pathBuilderEnabled = true;
        }
```

Leave the `if ( this.#filtersSet.length === 0 )` block that follows exactly as it is.

- [ ] **Step 6: Run the whole suite**

Run: `yarn test`
Expected: PASS, at 81 suites (the new one) and 1518 + 8 tests. Any `ApiOptions` failure means the rewrite
changed append order or a skip condition — compare against the original five branches, do not adjust the
mapping to match a wrong result.

- [ ] **Step 7: Format and commit**

```bash
yarn format:js:fix
yarn test
git add src/ApiOptions/FilterInputs.js src/ApiOptions/ApiOptions.js src/__tests__/FilterInputs.test.js
git commit -S -m "$(cat <<'EOF'
Extract the ApiOptions filter -> inputs mapping into one module (#63)

`appendTo()`'s five `if` branches were the only statement of which inputs
each filter renders. #63 needs that same knowledge to tell whether two keys
of a filter-keyed `controls` slot would fight over an input, and a second
copy would drift the first time a filter gained an input.

`FilterInputs.js` is now the single copy and `appendTo()` iterates it. The
two runtime skips — a hidden accept-header input, and the year input a
PATH_BUILDER pass already claimed — stay in `appendTo()`, because they are
instance state rather than properties of a filter.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: The filter-keyed slot validator

**Files:**

- Create: `src/MetaComponents/ControlSlots.js`
- Test: covered by Task 3's suite (this task's own proof is Task 3's rule tests; run `yarn test` after it to confirm nothing regressed)

**Interfaces:**

- Consumes: `inputKeysForFilter` from Task 1; `ApiOptionsFilter` from `src/Enums.js`; `assertPlainOptions`, `describeType` from `src/OptionsValidation.js`.
- Produces:
  - `isFilterKeyedControls(value: unknown): boolean`
  - `resolveControlSlots(value: object, caller: string)` returns
    `{ passes: Array<{key: string, filter: string, target: string|HTMLElement}>, selectsTarget: string|HTMLElement }` —
    `passes` in canonical order; `selectsTarget` is the value of the first key in the caller's own
    insertion order. Throws on every violation.

- [ ] **Step 1: Create the module**

Create `src/MetaComponents/ControlSlots.js`:

```javascript
/**
 * Validates a filter-keyed `controls` slot and orders its passes.
 *
 * Deliberately NOT exported from `src/index.js`, on the same reasoning as
 * `Theme.js` and `InputVisibility.js`: internal contract between the
 * components, not public API.
 *
 * **What it replaces.** Splitting a controls form across rows used to need a
 * documented two-pass idiom — `viewer.controls.apiOptions.filter( X
 * ).appendTo( target )` after the mount — which reached through the component
 * and rested on three rules nothing enforced: the second pass had to run after
 * `appendTo()`, the filters could not overlap, and `ApiOptionsFilter.NONE`
 * could not participate. Each of the three failed silently or confusingly
 * (#63). Naming the containers by filter moves all three into the component.
 *
 * The idiom itself is NOT deprecated: it is `ApiOptions` public API, both
 * migrated examples use it, `ApiExplorer` uses it internally, and it is still
 * the only way to reach a container the component does not own.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import { ApiOptionsFilter } from '../Enums.js';
import { inputKeysForFilter } from '../ApiOptions/FilterInputs.js';
import { assertPlainOptions, describeType } from '../OptionsValidation.js';

/**
 * The keys a filter-keyed `controls` slot may name, mapped to the filter each
 * one selects.
 *
 * The canonical five are the camelCase forms of the `ApiOptionsFilter` member
 * names, as issue #63 writes them. `basePath` and `allPaths` are accepted as
 * ALIASES of `generalRoman` and `allCalendars` for three reasons, none of them
 * "be permissive": the enum already ships `BASE_PATH`/`ALL_PATHS` as alias
 * members of exactly those two; their runtime VALUES are `'basePath'` and
 * `'allPaths'`, so `{ [ ApiOptionsFilter.GENERAL_ROMAN ]: '#x' }` — a computed
 * key a reader would expect to work — would otherwise throw; and
 * `ApiExplorer`'s existing slot names are literally `basePath` and `allPaths`,
 * so accepting them keeps one vocabulary across the library. The other three
 * keys are already identical under both spellings.
 *
 * @type {Readonly<Object<string, string>>}
 */
const FILTER_BY_SLOT_KEY = Object.freeze({
    generalRoman: ApiOptionsFilter.GENERAL_ROMAN,
    allCalendars: ApiOptionsFilter.ALL_CALENDARS,
    pathBuilder: ApiOptionsFilter.PATH_BUILDER,
    localeOnly: ApiOptionsFilter.LOCALE_ONLY,
    yearOnly: ApiOptionsFilter.YEAR_ONLY,
    basePath: ApiOptionsFilter.GENERAL_ROMAN,
    allPaths: ApiOptionsFilter.ALL_CALENDARS,
});

/** The five canonical keys, for error messages. @type {Readonly<string[]>} */
const CANONICAL_KEYS = Object.freeze([
    'generalRoman',
    'allCalendars',
    'pathBuilder',
    'localeOnly',
    'yearOnly',
]);

/**
 * The order the passes RUN in, regardless of the order the caller wrote the
 * keys in — ordering is the component's responsibility now, which is the whole
 * point of #63's first rule.
 *
 * Exactly one constraint here is real: `PATH_BUILDER` must run before
 * `ALL_CALENDARS`, so `ApiOptions`' `#pathBuilderEnabled` is set before the
 * pass that would otherwise mount the year input a second time.
 * `ApiExplorer.appendTo()` already hard-codes that same precedence for its own
 * three fixed slots. Fixing the order is also what makes the overlap
 * exemption below order-independent: under caller order,
 * `{ allCalendars, pathBuilder }` and `{ pathBuilder, allCalendars }` would
 * differ in which container ended up with the year input — which is rule two's
 * silent failure relocated rather than removed.
 *
 * @type {Readonly<string[]>}
 */
const PASS_ORDER = Object.freeze([
    ApiOptionsFilter.PATH_BUILDER,
    ApiOptionsFilter.ALL_CALENDARS,
    ApiOptionsFilter.LOCALE_ONLY,
    ApiOptionsFilter.YEAR_ONLY,
    ApiOptionsFilter.GENERAL_ROMAN,
]);

/**
 * Whether a `controls` slot value is a filter-keyed bag rather than a single
 * target.
 *
 * A single target is a non-empty string or an `HTMLElement`, so anything else
 * that survives `assertPlainOptions()` is a bag. Callers use this to decide
 * which branch to take BEFORE validating, so a malformed value is still
 * reported by the caller's own "must be a selector, an element, or a
 * filter-keyed object" message.
 *
 * @param {unknown} value - The `controls` slot value.
 * @returns {boolean} `true` when the value should be read as a filter-keyed bag.
 */
function isFilterKeyedControls(value) {
    if (typeof value === 'string' || value instanceof HTMLElement) {
        return false;
    }
    try {
        assertPlainOptions(value, 'controls');
    } catch {
        return false;
    }
    return true;
}

/**
 * The input keys a pass actually claims, given the whole set of filters in the
 * bag.
 *
 * The single exemption mirrors `ApiOptions`' `#pathBuilderEnabled`: when a
 * `PATH_BUILDER` pass is present it mounts the year input, and the
 * `ALL_CALENDARS` pass then skips it — so the two do not really collide, and
 * `{ pathBuilder, allCalendars }` is a legal, useful pairing rather than a
 * spurious error. `NONE` never reaches here; it is rejected as a key.
 *
 * @param {string} filter - The pass' filter.
 * @param {Array<string>} allFilters - Every filter named in the bag.
 * @returns {Array<string>} The input keys this pass claims.
 */
function claimedInputs(filter, allFilters) {
    const keys = [...inputKeysForFilter(filter)];
    if (
        ApiOptionsFilter.ALL_CALENDARS === filter &&
        allFilters.includes(ApiOptionsFilter.PATH_BUILDER)
    ) {
        return keys.filter((key) => 'yearInput' !== key);
    }
    return keys;
}

/**
 * Validates a filter-keyed `controls` bag and returns its passes in the order
 * they must run.
 *
 * Everything is checked BEFORE the caller resolves a single element, so a bag
 * naming one good container and one bad one never half-mounts — the same rule
 * `CalendarViewer.appendTo()` already applies to its `calendar` slot.
 *
 * @param {object} value - The filter-keyed `controls` bag.
 * @param {string} caller - The `Class.method` prefix to report under.
 * @returns {{passes: Array<{key: string, filter: string, target: (string|HTMLElement)}>, selectsTarget: (string|HTMLElement)}}
 *   The passes in canonical order, and the target the rite and calendar
 *   selects mount into — the FIRST key in the caller's own insertion order,
 *   which is what the two-pass idiom produced and what a caller listing
 *   containers in page order means.
 * @throws {Error} If the bag is empty, names an unknown key, names `none`,
 *   names one filter twice, or names two filters that share an input.
 */
function resolveControlSlots(value, caller) {
    const keys = Object.keys(value);
    if (0 === keys.length) {
        throw new Error(
            `${caller}: the controls slot object must name at least one filter. Valid keys are: ${CANONICAL_KEYS.join(', ')}.`,
        );
    }

    const seen = new Map();
    for (const key of keys) {
        if ('none' === key) {
            throw new Error(
                `${caller}: the controls slot object cannot name 'none'. ApiOptionsFilter.NONE renders every input, so it cannot be one of several passes, and ApiOptions.filter() refuses to mix it with any other filter.`,
            );
        }
        if (false === Object.hasOwn(FILTER_BY_SLOT_KEY, key)) {
            throw new Error(
                `${caller}: '${key}' is not a recognised ApiOptions filter key in the controls slot. Valid keys are: ${CANONICAL_KEYS.join(', ')} (basePath and allPaths are accepted as aliases of generalRoman and allCalendars).`,
            );
        }
        const filter = FILTER_BY_SLOT_KEY[key];
        if (seen.has(filter)) {
            throw new Error(
                `${caller}: the controls slot object names the same filter twice, as '${seen.get(filter)}' and '${key}'.`,
            );
        }
        seen.set(filter, key);
    }

    const allFilters = [...seen.keys()];
    const claims = new Map();
    for (const filter of allFilters) {
        claims.set(filter, claimedInputs(filter, allFilters));
    }
    for (let i = 0; i < allFilters.length; i++) {
        for (let j = i + 1; j < allFilters.length; j++) {
            const first = allFilters[i];
            const second = allFilters[j];
            const shared = claims
                .get(first)
                .filter((key) => claims.get(second).includes(key));
            if (shared.length > 0) {
                throw new Error(
                    `${caller}: the controls slot keys '${seen.get(first)}' and '${seen.get(second)}' both render ${shared.join(', ')}. Two filters that share an input would move it to whichever container mounted last; name each input under exactly one filter.`,
                );
            }
        }
    }

    const passes = PASS_ORDER.filter((filter) => seen.has(filter)).map(
        (filter) => ({
            key: seen.get(filter),
            filter,
            target: value[seen.get(filter)],
        }),
    );
    return { passes, selectsTarget: value[keys[0]] };
}

export { isFilterKeyedControls, resolveControlSlots, FILTER_BY_SLOT_KEY };
```

- [ ] **Step 2: Confirm nothing regressed**

Run: `yarn test`
Expected: PASS, unchanged from Task 1 — nothing imports the new module yet.

- [ ] **Step 3: Commit**

```bash
yarn format:js:fix
git add src/MetaComponents/ControlSlots.js
git commit -S -m "$(cat <<'EOF'
Add the filter-keyed controls-slot validator (#63)

Reads `FilterInputs.js` for the overlap check, so the mapping has one copy.
Canonical key spelling is the camelCase filter member names; `basePath` and
`allPaths` are accepted as aliases, matching both the enum's own alias
members and `ApiExplorer`'s existing slot names.

Pass order is the component's, not the caller's: PATH_BUILDER runs first so
`#pathBuilderEnabled` is set before the pass that would otherwise mount the
year input twice.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `CalendarControls` consumes the bag

**Files:**

- Modify: `src/MetaComponents/CalendarControls.js` — the `#mount` field (line 98), `appendTo()`
  (lines 481-556), `#targetElement()` (lines ~921-926), `dispose()` (lines ~893-895), and the import
  block
- Test: `src/__tests__/ControlsSlotByFilter.test.js`

**Interfaces:**

- Consumes: `isFilterKeyedControls`, `resolveControlSlots` from Task 2.
- Produces: `CalendarControls.appendTo()` accepting `controls: string | HTMLElement | object`. No new slot names, no new public method, no change to the `undefined` return.

- [ ] **Step 1: Write the failing test suite**

Create `src/__tests__/ControlsSlotByFilter.test.js`:

```javascript
/**
 * @jest-environment jsdom
 */
import CalendarControls from '../MetaComponents/CalendarControls.js';
import CalendarViewer from '../MetaComponents/CalendarViewer.js';
import ApiBase from '../ApiClient/ApiBase.js';
import { ApiOptionsFilter } from '../Enums.js';
import metadata from '../__fixtures__/metadata.js';

const BASE = 'http://localhost:8000';

const LAYOUT = `
    <div id="row1"></div>
    <div id="row2"></div>
    <div id="row3"></div>
    <div id="calendar"></div>
`;

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(BASE, metadata);
    document.body.innerHTML = LAYOUT;
});

/** The input ids `#row1` etc. can be read back by. */
const idsIn = (selector) =>
    [...document.querySelector(selector).querySelectorAll('select, input')]
        .map((element) => element.id)
        .filter((id) => '' !== id);

describe('a bare controls target is unchanged', () => {
    it('mounts every input of the component filter into the one container', () => {
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#row1');
        expect(idsIn('#row1')).toEqual(
            expect.arrayContaining(['locale', 'yearType', 'year']),
        );
        expect(idsIn('#row2')).toEqual([]);
    });

    it('still accepts an HTMLElement', () => {
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo(document.getElementById('row1'));
        expect(idsIn('#row1')).toEqual(expect.arrayContaining(['locale']));
    });
});

describe('rule 1: the component performs the passes, in its own order', () => {
    it('splits the form across the containers in one call', () => {
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo({
            controls: { allCalendars: '#row1', generalRoman: '#row2' },
        });
        expect(idsIn('#row1')).toEqual(
            expect.arrayContaining(['locale', 'yearType', 'year']),
        );
        expect(idsIn('#row2')).toEqual([
            'epiphany',
            'ascension',
            'corpusChristi',
            'eternalHighPriest',
            'holydaysOfObligation',
        ]);
    });

    it('mounts the rite and calendar selects into the first key named', () => {
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo({
            controls: { allCalendars: '#row1', generalRoman: '#row2' },
        });
        expect(document.querySelector('#row1 #rite-select')).not.toBeNull();
        expect(document.querySelector('#row2 #rite-select')).toBeNull();
    });

    it.each([
        ['pathBuilder first', { pathBuilder: '#row1', allCalendars: '#row2' }],
        ['allCalendars first', { allCalendars: '#row2', pathBuilder: '#row1' }],
    ])(
        'runs pathBuilder before allCalendars whichever order the caller wrote (%s)',
        (_name, bag) => {
            const controls = new CalendarControls({ locale: 'en' });
            controls.appendTo({ controls: bag });
            // The year input belongs to the pathBuilder pass either way: the
            // component chose the order, so the caller's did not decide it.
            expect(idsIn('#row1')).toContain('year');
            expect(idsIn('#row2')).not.toContain('year');
        },
    );
});

describe('rule 2: overlapping filters are rejected', () => {
    it('names both keys and the shared input', () => {
        const controls = new CalendarControls({ locale: 'en' });
        expect(() =>
            controls.appendTo({
                controls: { localeOnly: '#row1', allCalendars: '#row2' },
            }),
        ).toThrow(
            /both render localeInput\. Two filters that share an input would move it/,
        );
    });

    it('rejects yearOnly beside allCalendars', () => {
        const controls = new CalendarControls({ locale: 'en' });
        expect(() =>
            controls.appendTo({
                controls: { yearOnly: '#row1', allCalendars: '#row2' },
            }),
        ).toThrow(/both render yearInput/);
    });

    it('accepts the disjoint pairing the issue names', () => {
        const controls = new CalendarControls({ locale: 'en' });
        expect(() =>
            controls.appendTo({
                controls: { allCalendars: '#row1', generalRoman: '#row2' },
            }),
        ).not.toThrow();
    });

    it('accepts pathBuilder beside allCalendars, which share only the deduped year input', () => {
        const controls = new CalendarControls({ locale: 'en' });
        expect(() =>
            controls.appendTo({
                controls: { pathBuilder: '#row1', allCalendars: '#row2' },
            }),
        ).not.toThrow();
    });
});

describe('rule 3: NONE cannot participate', () => {
    it('rejects a none key', () => {
        const controls = new CalendarControls({ locale: 'en' });
        expect(() =>
            controls.appendTo({ controls: { none: '#row1' } }),
        ).toThrow(/cannot name 'none'\. ApiOptionsFilter\.NONE renders every input/);
    });

    it('rejects a filter-keyed bag on a component built with filter NONE', () => {
        const controls = new CalendarControls({
            locale: 'en',
            filter: ApiOptionsFilter.NONE,
        });
        expect(() =>
            controls.appendTo({ controls: { generalRoman: '#row1' } }),
        ).toThrow(/ApiOptionsFilter\.NONE, which renders every input/);
    });
});

describe('the key vocabulary', () => {
    it('rejects an unknown key by name, listing the valid ones', () => {
        const controls = new CalendarControls({ locale: 'en' });
        expect(() =>
            controls.appendTo({ controls: { generalRomanOptions: '#row1' } }),
        ).toThrow(
            /'generalRomanOptions' is not a recognised ApiOptions filter key in the controls slot\. Valid keys are: generalRoman, allCalendars, pathBuilder, localeOnly, yearOnly/,
        );
    });

    it('accepts the enum values as aliases, including as computed keys', () => {
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo({
            controls: {
                [ApiOptionsFilter.ALL_CALENDARS]: '#row1',
                [ApiOptionsFilter.GENERAL_ROMAN]: '#row2',
            },
        });
        expect(idsIn('#row2')).toContain('epiphany');
    });

    it('rejects the same filter named twice under both spellings', () => {
        const controls = new CalendarControls({ locale: 'en' });
        expect(() =>
            controls.appendTo({
                controls: { generalRoman: '#row1', basePath: '#row2' },
            }),
        ).toThrow(/names the same filter twice, as 'generalRoman' and 'basePath'/);
    });

    it('rejects an empty bag', () => {
        const controls = new CalendarControls({ locale: 'en' });
        expect(() => controls.appendTo({ controls: {} })).toThrow(
            /must name at least one filter/,
        );
    });
});

describe('nothing is mounted until every target resolves', () => {
    it('leaves the document untouched when a later container is missing', () => {
        const controls = new CalendarControls({ locale: 'en' });
        expect(() =>
            controls.appendTo({
                controls: { allCalendars: '#row1', generalRoman: '#nope' },
            }),
        ).toThrow(/Element not found for the controls.generalRoman slot: #nope/);
        expect(idsIn('#row1')).toEqual([]);
    });
});

describe('dispose empties every container it filled', () => {
    it('clears both rows', () => {
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo({
            controls: { allCalendars: '#row1', generalRoman: '#row2' },
        });
        controls.dispose();
        expect(idsIn('#row1')).toEqual([]);
        expect(idsIn('#row2')).toEqual([]);
    });
});

describe('CalendarViewer forwards the bag', () => {
    it('splits the controls and still mounts the calendar', () => {
        const viewer = new CalendarViewer({ locale: 'en' });
        viewer.appendTo({
            controls: { allCalendars: '#row1', generalRoman: '#row2' },
            calendar: '#calendar',
        });
        expect(idsIn('#row1')).toContain('locale');
        expect(idsIn('#row2')).toContain('epiphany');
        viewer.dispose();
        expect(idsIn('#row2')).toEqual([]);
    });

    it('reports a bad controls key under its own name', () => {
        const viewer = new CalendarViewer({ locale: 'en' });
        expect(() =>
            viewer.appendTo({
                controls: { nope: '#row1' },
                calendar: '#calendar',
            }),
        ).toThrow(/^CalendarViewer\.appendTo: 'nope' is not a recognised/);
    });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `yarn test src/__tests__/ControlsSlotByFilter.test.js`
Expected: FAIL. The "bare controls target" block should PASS (regression guard); every filter-keyed block
should fail with `CalendarControls.appendTo: the controls target must be a non-empty CSS selector or an
HTMLElement.`

If the "bare controls target" block fails, the `id` values used by `idsIn` or the rite select's id
(`#rite-select`) are wrong — read them off the rendered DOM in that test and correct the test, not the
source.

- [ ] **Step 3: Change `#mount` to hold every container**

In `src/MetaComponents/CalendarControls.js`, replace the `#mount` field declaration (line 98) with:

```javascript
    /**
     * Every container the controls were mounted into — one for a single
     * target, one per pass for a filter-keyed `controls` slot (#63).
     * `dispose()` empties all of them.
     *
     * @type {HTMLElement[]}
     */
    #mounts = [];
```

In `dispose()`, replace:

```javascript
        this.#mount?.replaceChildren();
```

with:

```javascript
        for (const mount of this.#mounts) {
            mount.replaceChildren();
        }
```

and replace `this.#mount = null;` with `this.#mounts = [];`.

- [ ] **Step 4: Teach `appendTo()` the bag**

Add to the imports near the top of `src/MetaComponents/CalendarControls.js`:

```javascript
import { isFilterKeyedControls, resolveControlSlots } from './ControlSlots.js';
```

In `appendTo()`, replace the block that currently reads:

```javascript
        const element = CalendarControls.#requireElement(
            slots.controls,
            'controls',
            caller,
        );
        this.#mount = element;
        this.#riteSelect.appendTo(element);
        this.#calendarSelect.appendTo(element);
        this.#apiOptions.appendTo(element);
```

with:

```javascript
        // `controls` may be a single target — every input in one container, the
        // 2.5.0 behaviour, unchanged — or an object keyed by `ApiOptions`
        // filter, which splits the form across as many containers as it names
        // (#63). The filter-keyed form exists because doing this by hand needed
        // a two-pass `filter().appendTo()` idiom that reached through the
        // component and rested on three rules nothing enforced; all three are
        // checked in `ControlSlots.js` before a single element is resolved.
        if (isFilterKeyedControls(slots.controls)) {
            this.#appendByFilter(slots.controls, caller);
        } else {
            const element = CalendarControls.#requireElement(
                slots.controls,
                'controls',
                caller,
            );
            this.#mounts = [element];
            this.#riteSelect.appendTo(element);
            this.#calendarSelect.appendTo(element);
            this.#apiOptions.appendTo(element);
        }
```

Then add this private method immediately after `appendTo()`:

```javascript
    /**
     * Mounts the three children across the containers a filter-keyed `controls`
     * slot names.
     *
     * Ordering is this class' responsibility, not the caller's — the first of
     * the three rules the two-pass idiom left unenforced. Every target is
     * resolved BEFORE anything is appended, so a typo in the last container
     * does not leave a half-mounted form; that is the same rule
     * `CalendarViewer.appendTo()` already applies to its `calendar` slot.
     *
     * @param {object} bag - The filter-keyed `controls` value.
     * @param {string} caller - The `Class.method` prefix to report under.
     * @returns {void}
     * @throws {Error} If this instance was constructed with
     *   `ApiOptionsFilter.NONE`, or the bag violates any of `ControlSlots.js`'
     *   rules, or a target matches nothing.
     */
    #appendByFilter(bag, caller) {
        // Checked HERE rather than left to `ApiOptions.filter()`, which refuses
        // to move off an explicit `NONE` with a message naming neither this
        // class nor the option the caller actually passed. `NONE` renders every
        // input, so there is nothing to split in the first place.
        if (ApiOptionsFilter.NONE === this.#apiOptions._filter) {
            throw new Error(
                `${caller}: a filter-keyed controls slot cannot be used with filter: ApiOptionsFilter.NONE, which renders every input. Construct with a narrower filter, or name a single controls target.`,
            );
        }
        const { passes, selectsTarget } = resolveControlSlots(bag, caller);
        const elements = passes.map((pass) => ({
            ...pass,
            element: CalendarControls.#requireElement(
                pass.target,
                `controls.${pass.key}`,
                caller,
            ),
        }));
        const selectsElement = CalendarControls.#requireElement(
            selectsTarget,
            'controls',
            caller,
        );

        this.#mounts = [
            selectsElement,
            ...elements
                .map(({ element }) => element)
                .filter((element) => element !== selectsElement),
        ];
        this.#riteSelect.appendTo(selectsElement);
        this.#calendarSelect.appendTo(selectsElement);
        for (const { filter, element } of elements) {
            this.#apiOptions.filter(filter).appendTo(element);
        }
    }
```

- [ ] **Step 5: Teach `#targetElement()` the bag**

Replace the body of `static #targetElement( target )` with:

```javascript
        const single =
            typeof target === 'string' || target instanceof HTMLElement;
        let candidate = single ? target : target?.controls;
        // A filter-keyed `controls` slot has no single element to check; the
        // first container the caller named is the one the selects mount into,
        // so it is the right stand-in for "did this leave the document?".
        if (isFilterKeyedControls(candidate)) {
            candidate = Object.values(candidate)[0];
        }
        return candidate instanceof HTMLElement ? candidate : null;
```

- [ ] **Step 6: Update the JSDoc on `appendTo()` and `mountInto()`**

On both, change the `@param` for `target` to:

```javascript
     * @param {string|HTMLElement|{controls: (string|HTMLElement|Object<string, (string|HTMLElement)>), messages?: (string|HTMLElement)}} target - Where to mount.
```

and add to `appendTo()`'s doc comment, after the "Takes either a single target …" paragraph:

```javascript
     * `controls` itself may be a single target — every input in one container —
     * or an object keyed by `ApiOptions` filter (`generalRoman`,
     * `allCalendars`, `pathBuilder`, `localeOnly`, `yearOnly`, plus `basePath`
     * and `allPaths` as aliases of the first two), which splits the form across
     * one container per filter. The rite and calendar selects mount into the
     * first key named. See `ControlSlots.js` for what is rejected and why.
```

- [ ] **Step 7: Run the suite**

Run: `yarn test src/__tests__/ControlsSlotByFilter.test.js`
Expected: PASS, all blocks.

Then: `yarn test`
Expected: PASS overall. If a `CalendarControls` or `CalendarViewer` test fails on `#mount`, it is reading
the renamed field — update the source, not the test, unless the test itself references `#mount` (it cannot;
it is private).

- [ ] **Step 8: Commit**

```bash
yarn format:js:fix
yarn test
git add src/MetaComponents/CalendarControls.js src/__tests__/ControlsSlotByFilter.test.js
git commit -S -m "$(cat <<'EOF'
Let the controls slot take an object keyed by filter (#63)

`CalendarControls.appendTo()` now accepts, for `controls`, either the single
target it has always taken or an object naming one container per `ApiOptions`
filter. The component performs the passes itself, in an order it chooses, and
checks all three of the two-pass idiom's previously unenforced rules —
ordering, overlap, and `NONE` — before resolving a single element.

`CalendarViewer` inherits it: it already forwards `slots.controls` verbatim.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `CalendarViewer`'s cancellation pre-check and JSDoc

**Files:**

- Modify: `src/MetaComponents/CalendarViewer.js` — `#targetElement()` (lines ~452-458), and the `@param` on `appendTo()`, `#assertSlots()` and `mountInto()`
- Test: the `CalendarViewer forwards the bag` block from Task 3

**Interfaces:**

- Consumes: `isFilterKeyedControls` from Task 2.
- Produces: no new API. `CalendarViewer`'s `controls` slot accepts the same values `CalendarControls`' does.

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/ControlsSlotByFilter.test.js`:

```javascript
describe('CalendarViewer.mountInto with a filter-keyed controls slot', () => {
    it('does not treat a filter-keyed bag as a cancelled mount', async () => {
        const viewer = await CalendarViewer.mountInto(
            {
                controls: {
                    allCalendars: document.getElementById('row1'),
                    generalRoman: document.getElementById('row2'),
                },
                calendar: '#calendar',
            },
            { locale: 'en', initialFetch: false },
        );
        expect(viewer).not.toBeNull();
        expect(idsIn('#row2')).toContain('epiphany');
        viewer.dispose();
    });

    it('resolves to null when the first named container has left the document', async () => {
        const detached = document.createElement('div');
        const viewer = await CalendarViewer.mountInto(
            {
                controls: { allCalendars: detached, generalRoman: '#row2' },
                calendar: '#calendar',
            },
            { locale: 'en', initialFetch: false },
        );
        expect(viewer).toBeNull();
    });
});
```

- [ ] **Step 2: Run it and confirm the second test fails**

Run: `yarn test src/__tests__/ControlsSlotByFilter.test.js -t 'left the document'`
Expected: FAIL — `#targetElement()` returns `null` for an object, so the disconnected check is skipped and
a viewer is returned instead of `null`.

- [ ] **Step 3: Teach `CalendarViewer.#targetElement()` the bag**

Add to the imports in `src/MetaComponents/CalendarViewer.js`:

```javascript
import { isFilterKeyedControls } from './ControlSlots.js';
```

Replace the body of `static #targetElement( slots )` with:

```javascript
        // A filter-keyed `controls` slot has no single element; the first
        // container the caller named is the one the selects mount into, so it
        // is the right stand-in — the same choice `CalendarControls`'
        // own `#targetElement()` makes.
        const controlsValue = isFilterKeyedControls(slots?.controls)
            ? Object.values(slots.controls)[0]
            : slots?.controls;
        const controlsCandidate =
            controlsValue instanceof HTMLElement ? controlsValue : null;
        const calendarCandidate =
            slots?.calendar instanceof HTMLElement ? slots.calendar : null;
        return controlsCandidate ?? calendarCandidate;
```

- [ ] **Step 4: Update the three `@param` lines**

In `appendTo()`, `#assertSlots()` and `mountInto()`, change the `slots` `@param` type to:

```javascript
     * @param {{controls: (string|HTMLElement|Object<string, (string|HTMLElement)>), calendar: (string|HTMLElement), messages?: (string|HTMLElement)}} slots - Where to mount.
```

and in `#targetElement()`'s own `@param`:

```javascript
     * @param {{controls?: (string|HTMLElement|Object<string, (string|HTMLElement)>), calendar?: (string|HTMLElement)}} slots - The `mountInto()` slots argument.
```

- [ ] **Step 5: Run the tests**

Run: `yarn test src/__tests__/ControlsSlotByFilter.test.js`
Expected: PASS.

Then: `yarn test`
Expected: PASS overall.

- [ ] **Step 6: Commit**

```bash
yarn format:js:fix
yarn test
git add src/MetaComponents/CalendarViewer.js src/__tests__/ControlsSlotByFilter.test.js
git commit -S -m "$(cat <<'EOF'
Let CalendarViewer's cancellation check see through a filter-keyed slot (#63)

`mountInto()`'s pre-check recognises an `HTMLElement` handed directly, so it
could resolve to `null` for a disconnected `controls` element. A filter-keyed
bag hid that element behind an object and the check silently stopped applying.
It now reads the first container named, which is the one the selects mount
into.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Documentation

**Files:**

- Modify: `docs/meta-components.md` — the "Multi-row option layouts" section (around lines 1269-1340)
- Modify: `CLAUDE.md` — the Meta-Components section
- Modify: `CHANGELOG.md` — under `## [Unreleased]`

**Interfaces:**

- Consumes: the behaviour Tasks 1-4 shipped.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Rewrite the `docs/meta-components.md` section to lead with the declarative form**

Replace everything from the `### Multi-row option layouts` heading down to (but not including) the
`### mountInto() versus the constructor` heading with:

````markdown
### Multi-row option layouts

`controls` takes either a single container — every input lands in it — or an **object keyed by
`ApiOptions` filter**, which splits the form across one container per filter. The component performs
the passes itself, in an order it chooses, and validates the whole layout before mounting anything.

A two-row Bootstrap form — the path and temporal inputs on one row, the parameters a national or
diocesan calendar predetermines on another:

```javascript
import { CalendarViewer, ApiOptionsFilter } from '@liturgical-calendar/components-js';

const viewer = new CalendarViewer({
    locale: 'en',
    inputs: { acceptHeader: false },
    theme: { select: 'form-select', label: 'form-label', wrapper: 'form-group col col-md-2' },
});

viewer.appendTo({
    controls: {
        allCalendars: '#calendarOptions',
        generalRoman: '#generalRomanOptions',
    },
    calendar: '#litcalWebcalendar',
    messages: '#LitCalMessages tbody',
});

viewer.listenTo(apiClient);
```

| Container              | Receives                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| `#calendarOptions`     | rite select, calendar select, `locale`, `year_type`, `year`                                |
| `#generalRomanOptions` | `epiphany`, `ascension`, `corpus_christi`, `eternal_high_priest`, `holydays_of_obligation` |

**The keys.** `generalRoman`, `allCalendars`, `pathBuilder`, `localeOnly` and `yearOnly` — the camelCase
forms of the `ApiOptionsFilter` member names. `basePath` and `allPaths` are accepted as aliases of the
first two, matching the enum's own `BASE_PATH`/`ALL_PATHS` members and `ApiExplorer`'s slot names, so a
computed key such as `{ [ApiOptionsFilter.GENERAL_ROMAN]: '#row2' }` works too. Any other key throws,
naming it and listing the valid ones; naming one filter twice under both spellings throws as well.

**The rite and calendar selects mount into the first key you name**, so list the containers in page
order. There is no slot of their own: they belong with the first row of options, which is what the
layout above and every earlier version of it produce.

**Three rules the component now enforces**, each of which used to be the caller's to remember and each
of which failed silently or confusingly when forgotten:

- **Ordering is the component's.** It runs `pathBuilder` before `allCalendars`, whichever order you
  wrote them in, so the year input lands in the path-builder container rather than in whichever pass
  happened to go last.
- **The filters must not overlap.** `{ localeOnly, allCalendars }` throws naming both keys and
  `localeInput`, rather than moving that input to whichever container mounted last. `{ pathBuilder,
  allCalendars }` is fine: `ApiOptions` mounts the year input once, under `pathBuilder`.
- **`ApiOptionsFilter.NONE` cannot participate.** A `none` key throws, and so does a filter-keyed
  layout on a component constructed with `filter: ApiOptionsFilter.NONE` — that filter renders every
  input, so there is nothing to split.

Every container is resolved before anything is appended, so a typo in the last one throws with the
document untouched rather than leaving a half-mounted form.

#### The two-pass idiom is still supported

`ApiOptions` is one object whose `appendTo()` **moves** the inputs its current filter selects, so
calling `filter().appendTo()` again still splits the form by hand:

```javascript
viewer.appendTo({ controls: '#calendarOptions', calendar: '#litcalWebcalendar' });
viewer.controls.apiOptions
    .filter(ApiOptionsFilter.GENERAL_ROMAN)
    .appendTo('#generalRomanOptions');
```

This is not deprecated and does not warn: it is `ApiOptions` public API, [`ApiExplorer`](#apiexplorer)
uses it internally, and it remains the way to reach a container the component does not own. Prefer the
filter-keyed slot when the containers are all yours — it is the same result with the three rules
checked for you, and without reaching through the component for an object it owns.

**The flat `wrapper` reaches `riteSelect`, `calendarSelect` and `locale`, but stops there.** For a
symmetric row — `year_type` and `year` column-wrapped like the other three, and the five General Roman
inputs on row two wrapped too — add the `apiOptions` key, which opts the whole form in:

```javascript
theme: {
    select: 'form-select',
    label: 'form-label',
    wrapper: 'form-group col col-md-2',
    apiOptions: {},                       // inherit the three flat keys above, for all ten inputs
}
```

That is the whole change; an empty bundle is an explicit "these defaults apply to the form as well". Name
keys inside it to diverge from the outer defaults, or a per-input key to diverge for one input — see
[`CalendarControls`' `theme.apiOptions` section](#themeapioptions--the-whole-apioptions-form).

**`ApiExplorer` keeps its own three dedicated slots** (`pathBuilder`, `basePath`, `allPaths`) rather
than a filter-keyed `controls` bag. It has no `controls` slot at all: its calendar select is positioned
relative to the calendar-path input rather than mounted into a container, so its `pathBuilder` slot
carries a relationship no filter key can express. The key vocabulary is shared even though the
mechanism is not — `basePath` and `allPaths` mean the same filters in both places.
````

- [ ] **Step 2: Check the markdown gates**

Run: `yarn format:md:fix && yarn lint:md`
Expected: `lint:md` reports zero errors. If MD013 (180 chars) fires, rewrap the offending prose line by
hand — prettier does not fix it.

- [ ] **Step 3: Update `CLAUDE.md`**

In the Meta-Components section, immediately after the paragraph beginning **`mountInto()` versus the
constructor** (the one ending "…nothing can be chained off it, and its result must never be assigned."),
insert:

```markdown
**The `controls` slot's VALUE may be a single target or an object keyed by `ApiOptions` filter; the slot
NAMES are unchanged.** `CalendarControls` and `CalendarViewer` accept
`controls: { allCalendars: '#row1', generalRoman: '#row2' }`, which mounts one pass per filter and
replaces the two-pass `filter().appendTo()` idiom 2.5.0 documented (#63). Four points are load-bearing:

- **The filter -> inputs mapping has ONE copy**, `src/ApiOptions/FilterInputs.js`, which
  `ApiOptions.appendTo()` iterates and `src/MetaComponents/ControlSlots.js` reads for its overlap check.
  It used to be five `if` branches inside `appendTo()`; a second copy beside them would drift the first
  time a filter gained an input. Both new modules are internal and not exported from `src/index.js`, like
  `Theme.js` and `InputVisibility.js`.
- **Ordering is the component's, and canonical rather than the caller's.** `PATH_BUILDER` runs before
  `ALL_CALENDARS` so `ApiOptions`' `#pathBuilderEnabled` is set before the pass that would otherwise mount
  the year input twice — the precedence `ApiExplorer.appendTo()` already hard-codes. That is also what
  makes the one overlap exemption (`allCalendars` does not claim `yearInput` when `pathBuilder` is
  present) order-independent; under caller order the two spellings of that bag would put the year input in
  different containers, which is the silent failure relocated rather than removed.
- **Key spelling is the camelCase member names, with `basePath`/`allPaths` as aliases.** The enum already
  ships `BASE_PATH`/`ALL_PATHS` as alias members of exactly those two, their runtime values ARE those
  strings (so a computed `{ [ApiOptionsFilter.GENERAL_ROMAN]: t }` key must work), and `ApiExplorer`'s
  slot names are literally `basePath`/`allPaths`. Naming one filter under both spellings is rejected as a
  duplicate.
- **`ApiExplorer` and `SubscriptionBuilder` are deliberately untouched.** `ApiExplorer` already has
  dedicated ordered slots, bypasses `CalendarControls.appendTo()` entirely, and positions its calendar
  select with `insertAfter()` rather than into a container — giving it a `controls` slot would be a new
  slot name and a second way to say one thing. `SubscriptionBuilder` mounts the three children itself
  rather than through `CalendarControls.appendTo()`. The two-pass idiom stays supported and unwarned:
  it is `ApiOptions` public API, both examples use it, and it is still the only way to reach a container
  the component does not own.
```

- [ ] **Step 4: Add the `CHANGELOG.md` entry**

Under `## [Unreleased]`, in the appropriate `### Added` / `### Changed` subsections (create them if the
`## [Unreleased]` heading has none), add:

```markdown
### Added

- `CalendarControls` and `CalendarViewer` accept an object keyed by `ApiOptions` filter for the `controls`
  slot — `controls: { allCalendars: '#row1', generalRoman: '#row2' }` — which mounts one pass per filter
  and validates the layout before touching the DOM ([#63](https://github.com/Liturgical-Calendar/liturgy-components-js/issues/63)).
  Valid keys are `generalRoman`, `allCalendars`, `pathBuilder`, `localeOnly` and `yearOnly`, plus
  `basePath` and `allPaths` as aliases of the first two. The component now owns the pass ordering, rejects
  two filters that would fight over an input (naming both keys and the shared input), and rejects
  `ApiOptionsFilter.NONE` both as a key and as the component's own filter. A bare `controls` target is
  unchanged, and the two-pass `filter().appendTo()` idiom stays supported and unwarned.

### Changed

- `ApiOptions.appendTo()` iterates a single filter-to-inputs mapping (`src/ApiOptions/FilterInputs.js`,
  internal) instead of five hard-coded branches, so the meta-components' overlap check and the append
  itself cannot disagree. No behaviour change.
```

- [ ] **Step 5: Run every gate**

```bash
yarn test
yarn compile && yarn lint:dts
yarn format:js
yarn format:md
yarn lint:md
```

Expected: all pass. `yarn test` should be 82 suites and 1518 + the new tests.

- [ ] **Step 6: Commit**

```bash
git add docs/meta-components.md CLAUDE.md CHANGELOG.md docs/superpowers
git commit -S -m "$(cat <<'EOF'
Lead the multi-row docs with the declarative controls slot (#63)

`docs/meta-components.md` presented the two-pass idiom as the only way to
split a controls form across rows, with its three rules as prose the reader
had to remember. It now leads with the filter-keyed slot and keeps the idiom
as the documented escape hatch, explicitly not deprecated.

Also records in CLAUDE.md why the filter -> inputs mapping has one copy, why
the pass order is canonical rather than the caller's, why the key spelling
carries two aliases, and why `ApiExplorer` and `SubscriptionBuilder` are left
alone.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage:** D1 → Task 2 (`FILTER_BY_SLOT_KEY`) + Task 3 tests. D2 → Tasks 3-4, documented in Task 5.
D3 → Task 1. D4 → Task 2 (`claimedInputs`) + Task 3 tests. D5 → Task 2 (`PASS_ORDER`) + Task 3's
either-order test. D6 → Task 2 (`selectsTarget`) + Task 3 test. D7 → Task 3 (`#appendByFilter` resolves all
first) + its "nothing is mounted until every target resolves" test. D8 → Task 2 (`none` key) + Task 3
(`filter: NONE` guard). D9 → Task 5's "still supported" subsection.

**Placeholders:** none — every code step carries the actual code.

**Type consistency:** `inputKeysForFilter` (Task 1) is called in Task 2 only. `isFilterKeyedControls` /
`resolveControlSlots` (Task 2) are called in Tasks 3 and 4 with the signatures Task 2 defines.
`resolveControlSlots` returns `{ passes, selectsTarget }`, destructured under exactly those names in Task 3.
`#mounts` is introduced in Task 3 Step 3 and used in Steps 3 and 4 of the same task.
