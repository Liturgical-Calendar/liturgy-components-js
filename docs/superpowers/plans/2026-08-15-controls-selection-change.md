# `CalendarControls.onSelectionChange()` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** Give `CalendarControls` a `selection` getter and a chainable `onSelectionChange( callback )` so a consumer
can style "this input is predetermined" without hand-wiring a raw `change` listener and a `value === ''` test.

**Architecture:** The disable rule already in `ApiOptions.#applyTemporalInputState()` moves into one internal module,
`src/ApiOptions/PredeterminedInputs.js`, which that method then applies and which a new internal
`ApiOptions._predeterminedInputs` getter reports. `CalendarControls` reads that getter plus the calendar select's own
`data-calendartype`, and notifies subscribers once per user action on a microtask, deduped against the last payload —
the shape `SubscriptionUrl.#scheduleNotify()` already uses.

**Tech Stack:** ES2022 JavaScript modules, Jest 30 with jsdom, prettier, markdownlint-cli2, TypeScript 5.7 for
declaration emit only.

**Spec:** `docs/superpowers/specs/2026-08-15-controls-selection-change-design.md`

## Global Constraints

- Work only inside `/home/johnrdorazio/development/LiturgicalCalendar/liturgy-components-js/.claude/worktrees/issue-68`.
- Line endings are LF everywhere (`.gitattributes`: `* text=auto eol=lf`).
- Formatting is prettier's, `tabWidth: 4`, `singleQuote: true`. Run `yarn format:js:fix` before committing.
- New internal modules are **not** exported from `src/index.js`, like `Theme.js`, `FilterInputs.js`,
  `InputVisibility.js`, `LocaleValidation.js`.
- Write the canonical non-underscore `ApiOptions` accessor names in new code and docs
  (`apiOptions.localeInput`, not `apiOptions._localeInput`); do **not** migrate existing internal call sites.
- Do not touch `src/MetaComponents/Theme.js` (another agent owns it), `src/Messages.js`, `src/WebCalendar/`,
  or `src/LiturgyOfAnyDay/`.
- Baseline before any change: **83 suites / 1601 tests** passing.
- Gates, all of which must pass at the end: `yarn test`, `yarn compile && yarn lint:dts`, `yarn format:js`,
  `yarn format:md`, `yarn lint:md`.
- Commit with `git commit -S`, ending the message with
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`. Do not push, do not open a PR.

---

## File Structure

| File                                               | Responsibility                                                                   |
| -------------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/ApiOptions/PredeterminedInputs.js`            | **New.** The one copy of "which inputs the rite and calendar predetermine".      |
| `src/ApiOptions/ApiOptions.js`                     | Applies that rule when disabling; stores and reports the result.                 |
| `src/MetaComponents/CalendarControls.js`           | `selection` getter, `onSelectionChange()`, the coalescing notifier, `dispose()`. |
| `src/__tests__/PredeterminedInputs.test.js`        | **New.** The rule, and its agreement with `FilterInputs.js`.                     |
| `src/__tests__/CalendarControlsSelectionChange.js` | **New** (`.test.js`). Payload, frequency, dedupe, dispose.                       |
| `docs/meta-components.md`                          | The `CalendarControls` public-API sections.                                      |
| `CLAUDE.md`, `README.md`, `CHANGELOG.md`           | Contract summary, feature list, `## [Unreleased]` entry.                         |

---

### Task 1: The predetermined-inputs rule, extracted

**Files:**

- Create: `src/ApiOptions/PredeterminedInputs.js`
- Create: `src/__tests__/PredeterminedInputs.test.js`
- Modify: `src/ApiOptions/ApiOptions.js` (the `#applyTemporalInputState()` method, around line 366)

**Interfaces:**

- Consumes: `inputKeysForFilter( filter )` and `ApiOptionsFilter` from `src/ApiOptions/FilterInputs.js` /
  `src/Enums.js` (test only).
- Produces:
  - `predeterminedInputKeys( { calendarSelected, riteFixesTemporalOptions } ) -> ReadonlyArray<string>`
  - `PREDETERMINABLE_INPUTS: ReadonlyArray<string>` — the five candidate keys, canonical order.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/PredeterminedInputs.test.js`:

```javascript
/**
 * The rule `ApiOptions.#applyTemporalInputState()` applies, stated once here and
 * read by both halves of it: the `disabled()` calls and the payload
 * `CalendarControls.selection` publishes.
 *
 * The agreement with `FilterInputs.js` is asserted rather than shared by import:
 * the two answer different questions ("what does GENERAL_ROMAN render" vs "what
 * does a calendar predetermine") and are the same five keys today. Should a
 * filter ever gain a sixth input, this fails and a human decides which list it
 * belongs to, rather than one list silently acquiring the other's member.
 */
import { describe, it, expect } from '@jest/globals';
import {
    predeterminedInputKeys,
    PREDETERMINABLE_INPUTS,
} from '../ApiOptions/PredeterminedInputs.js';
import { inputKeysForFilter } from '../ApiOptions/FilterInputs.js';
import { ApiOptionsFilter } from '../Enums.js';

describe('predeterminedInputKeys', () => {
    it('names nothing for the rite-level calendar of a rite that fixes nothing', () => {
        expect(
            predeterminedInputKeys({
                calendarSelected: false,
                riteFixesTemporalOptions: false,
            }),
        ).toEqual([]);
    });

    it('names all five when a nation or diocese is selected', () => {
        expect(
            predeterminedInputKeys({
                calendarSelected: true,
                riteFixesTemporalOptions: false,
            }),
        ).toEqual([
            'epiphanyInput',
            'ascensionInput',
            'corpusChristiInput',
            'eternalHighPriestInput',
            'holydaysOfObligationInput',
        ]);
    });

    it('names the four temporal inputs alone for a rite that fixes them', () => {
        // The Ambrosian rite-level calendar: the Missal fixes Epiphany,
        // Ascension and Corpus Domini and does not establish the Eternal High
        // Priest, but holy days of obligation stay the user's to choose.
        expect(
            predeterminedInputKeys({
                calendarSelected: false,
                riteFixesTemporalOptions: true,
            }),
        ).toEqual([
            'epiphanyInput',
            'ascensionInput',
            'corpusChristiInput',
            'eternalHighPriestInput',
        ]);
    });

    it('names all five when both halves hold', () => {
        expect(
            predeterminedInputKeys({
                calendarSelected: true,
                riteFixesTemporalOptions: true,
            }),
        ).toHaveLength(5);
    });

    it('returns a frozen array, so a consumer cannot mutate the reported state', () => {
        const keys = predeterminedInputKeys({
            calendarSelected: true,
            riteFixesTemporalOptions: false,
        });
        expect(Object.isFrozen(keys)).toBe(true);
    });

    it('covers exactly the inputs ApiOptionsFilter.GENERAL_ROMAN renders, in order', () => {
        expect(PREDETERMINABLE_INPUTS).toEqual(
            inputKeysForFilter(ApiOptionsFilter.GENERAL_ROMAN),
        );
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/__tests__/PredeterminedInputs.test.js`
Expected: FAIL — `Cannot find module '../ApiOptions/PredeterminedInputs.js'`.

- [ ] **Step 3: Write the module**

Create `src/ApiOptions/PredeterminedInputs.js`:

```javascript
/**
 * Which `ApiOptions` inputs the current rite and calendar selection predetermine.
 *
 * Deliberately NOT exported from `src/index.js`, on the same reasoning as
 * `FilterInputs.js`, `Theme.js`, `InputVisibility.js` and `LocaleValidation.js`:
 * internal contract between the components, not public API.
 *
 * **Why this is a module rather than five lines inside `#applyTemporalInputState()`.**
 * It was the latter. Issue #68 needed the same knowledge a second time — every
 * consumer was re-deriving "is this input effectively read-only" from a raw
 * `change` event plus a `value === ''` test, which is both the library's own
 * domain knowledge and, under the Ambrosian rite, wrong: four inputs are
 * predetermined there with no calendar selected at all. `#applyTemporalInputState()`
 * now applies what this returns and `ApiOptions._predeterminedInputs` reports it,
 * so the disabling half and the reporting half cannot drift. The same shape
 * `FilterInputs.js` gave the filter -> inputs mapping in issue #63.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

/**
 * The four inputs a rite can fix for itself, in canonical order.
 *
 * The Ambrosian Missal fixes Epiphany to 6 January, Ascension to the fortieth
 * day of Easter and Corpus Domini to the Thursday after Trinity, and does not
 * establish the Eternal High Priest at all. A selected nation or diocese fixes
 * the same four through its own published settings.
 *
 * @type {Readonly<string[]>}
 */
const RITE_FIXABLE_INPUTS = Object.freeze([
    'epiphanyInput',
    'ascensionInput',
    'corpusChristiInput',
    'eternalHighPriestInput',
]);

/**
 * The one input that follows the calendar selection alone.
 *
 * Holy days of obligation are not fixed by any rite — they are an option list a
 * rite may REPLACE, which is a different thing from a value it fixes — so this
 * follows the calendar half of the rule by itself.
 *
 * @type {string}
 */
const CALENDAR_ONLY_INPUT = 'holydaysOfObligationInput';

/**
 * Every input this module can name, in canonical order.
 *
 * The same five `ApiOptionsFilter.GENERAL_ROMAN` renders, and for the same
 * reason — `FilterInputs.js` describes them as "the five parameters a national
 * or diocesan calendar predetermines". The two lists are stated independently
 * because they answer different questions, and
 * `src/__tests__/PredeterminedInputs.test.js` asserts they agree, so a filter
 * that gained a sixth input would fail rather than silently join this set.
 *
 * @type {Readonly<string[]>}
 */
const PREDETERMINABLE_INPUTS = Object.freeze([
    ...RITE_FIXABLE_INPUTS,
    CALENDAR_ONLY_INPUT,
]);

/**
 * The inputs whose values the current rite and calendar selection fix.
 *
 * Both halves are independent and either alone is enough for the four temporal
 * inputs: implementing only the rite half is what let a user return to the
 * rite-level empty option under Ambrosian and re-enable them, making
 * `/calendar/ambrosian?ascension=SUNDAY` reachable.
 *
 * @param {Object} state - The state the rule reads.
 * @param {boolean} state.calendarSelected - Whether a nation or diocese is selected.
 * @param {boolean} state.riteFixesTemporalOptions - Whether the current rite fixes them.
 * @returns {Readonly<string[]>} The predetermined input keys, canonical order.
 */
function predeterminedInputKeys({ calendarSelected, riteFixesTemporalOptions }) {
    const keys = [];
    if (calendarSelected || riteFixesTemporalOptions) {
        keys.push(...RITE_FIXABLE_INPUTS);
    }
    if (calendarSelected) {
        keys.push(CALENDAR_ONLY_INPUT);
    }
    return Object.freeze(keys);
}

export { predeterminedInputKeys, PREDETERMINABLE_INPUTS };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/__tests__/PredeterminedInputs.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Make `ApiOptions` the rule's first reader**

In `src/ApiOptions/ApiOptions.js`, add to the imports near the other local ones:

```javascript
import {
    predeterminedInputKeys,
    PREDETERMINABLE_INPUTS,
} from './PredeterminedInputs.js';
```

Add a private field beside `#riteFixesTemporalOptions` (around line 173):

```javascript
    /**
     * What `#applyTemporalInputState()` last determined the rite and calendar
     * fix, reported by `_predeterminedInputs`. Empty until that method has run,
     * which is honest: on an `ApiOptions` never linked to a calendar select
     * nothing has been applied to the form either.
     *
     * @type {Readonly<string[]>}
     */
    #predeterminedInputs = Object.freeze([]);
```

Replace the body of `#applyTemporalInputState( calendarSelected )` (keeping its
existing doc comment, and appending the paragraph below to it):

```javascript
    #applyTemporalInputState(calendarSelected) {
        this.#predeterminedInputs = predeterminedInputKeys({
            calendarSelected,
            riteFixesTemporalOptions: this.#riteFixesTemporalOptions,
        });
        for (const key of PREDETERMINABLE_INPUTS) {
            this.#inputs[key].disabled(
                this.#predeterminedInputs.includes(key),
            );
        }
    }
```

Doc-comment paragraph to append, above `@param`:

```text
     * The rule itself lives in `PredeterminedInputs.js`, which this method
     * applies and `_predeterminedInputs` reports, so what is disabled and what
     * `CalendarControls.selection` publishes cannot drift (#68). Every one of
     * the five is still assigned on every call — `disabled( false )` for the
     * ones the rule does not name — which is what re-enables them when a
     * selection is cleared.
```

Add the internal getter next to `get _filter()` (around line 1660):

```javascript
    /**
     * The inputs whose values the current rite and calendar selection fix — the
     * very set `#applyTemporalInputState()` disabled.
     *
     * `_`-prefixed by this codebase's convention for internal-but-reachable
     * members (`_filter`, `_currentEndpoint`, `_domElement`): the public route
     * to this state is `CalendarControls.selection` and
     * `CalendarControls.onSelectionChange()`. Promoting it to a public
     * `predeterminedInputs` later would be backward compatible.
     *
     * Reading `_domElement.disabled` back off the inputs is NOT an alternative:
     * `HolydaysOfObligationInput.disabled()` overrides the base method and sets
     * a `readonly` expando plus per-`<option>` flags instead, so the one input
     * issue #68 is actually about would need its own special case.
     *
     * @returns {Readonly<string[]>} The predetermined input keys, canonical order.
     */
    get _predeterminedInputs() {
        return this.#predeterminedInputs;
    }
```

- [ ] **Step 6: Run the whole suite**

Run: `yarn test`
Expected: PASS — 84 suites, 1607 tests. In particular
`ApiOptionsRite*.test.js`, `ApiOptionsRiteCharacterization.test.js` and
`ApiOptionsPublicAccessors.test.js` must be unchanged and green: the rewrite is
behaviour-preserving.

- [ ] **Step 7: Mutation-verify the shared source**

Temporarily change `predeterminedInputKeys()` to `if (calendarSelected)` for the
first branch (dropping the rite half). Run `yarn test`. Expected: failures in
**both** `PredeterminedInputs.test.js` and the existing `ApiOptionsRite*` disable
tests — proving `ApiOptions` really reads the module rather than keeping its own
copy. Revert the mutation and re-run to green.

- [ ] **Step 8: Format and commit**

```bash
yarn format:js:fix
git add src/ApiOptions/PredeterminedInputs.js src/ApiOptions/ApiOptions.js src/__tests__/PredeterminedInputs.test.js
git commit -S -m "$(cat <<'EOF'
Extract the predetermined-inputs rule ApiOptions applies (#68)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `CalendarControls.selection`

**Files:**

- Modify: `src/MetaComponents/CalendarControls.js`
- Create: `src/__tests__/CalendarControlsSelectionChange.test.js`

**Interfaces:**

- Consumes: `ApiOptions._predeterminedInputs` from Task 1.
- Produces: `get selection() -> { calendarType: 'general'|'national'|'diocesan', calendarId: ?string,
predeterminedInputs: ReadonlyArray<string> }`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/CalendarControlsSelectionChange.test.js`:

```javascript
/** @jest-environment jsdom */
/**
 * `CalendarControls.selection` and `onSelectionChange()` — issue #68.
 *
 * The frequency tests drive REAL `change` events through the real wiring and
 * count callback invocations, following `AnnouncementFrequency.test.js`: one
 * user action moves several inputs, and "fires once per user action" is the
 * property this whole feature exists to provide, so it is measured rather than
 * assumed.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import CalendarControls from '../MetaComponents/CalendarControls.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    ApiClient.clearCache();
    document.body.innerHTML = '<div id="controls"></div>';
    global.fetch = jest.fn(() =>
        Promise.resolve({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: () =>
                Promise.resolve({
                    litcal: [],
                    messages: [],
                    metadata: {},
                    settings: {},
                }),
        }),
    );
});

/** Lets the notification microtask flush. */
const flush = () => Promise.resolve().then(() => {});

/**
 * Sets a select's value the way a user would, notifying listeners.
 *
 * @param {HTMLSelectElement} element - The select to drive.
 * @param {string} value - The value to select.
 * @returns {void}
 */
const userSelects = (element, value) => {
    element.value = value;
    element.dispatchEvent(new Event('change', { bubbles: true }));
};

/**
 * Mounted, wired controls with no initial fetch.
 *
 * @returns {Promise<CalendarControls>} The mounted controls.
 */
const build = async () => {
    const apiClient = await ApiClient.init(API_URL);
    return CalendarControls.mountInto('#controls', {
        locale: 'en',
        apiClient,
        initialFetch: false,
    });
};

describe('CalendarControls.selection', () => {
    it('reports the rite-level calendar with nothing predetermined', async () => {
        const controls = await build();
        expect(controls.selection).toEqual({
            calendarType: 'general',
            calendarId: null,
            predeterminedInputs: [],
        });
    });

    it('reports a national calendar and its five predetermined inputs', async () => {
        const controls = await build();
        userSelects(controls.calendarSelect._domElement, 'IT');
        expect(controls.selection).toEqual({
            calendarType: 'national',
            calendarId: 'IT',
            predeterminedInputs: [
                'epiphanyInput',
                'ascensionInput',
                'corpusChristiInput',
                'eternalHighPriestInput',
                'holydaysOfObligationInput',
            ],
        });
    });

    it('reports a diocesan calendar', async () => {
        const controls = await build();
        userSelects(controls.calendarSelect._domElement, 'romamo_it');
        expect(controls.selection.calendarType).toBe('diocesan');
        expect(controls.selection.calendarId).toBe('romamo_it');
    });

    it('reports the four temporal inputs the Ambrosian rite fixes, with no calendar selected', async () => {
        // The case a `value === ''` test gets WRONG: the rite-level calendar,
        // yet four inputs are predetermined.
        const controls = await build();
        userSelects(controls.riteSelect._domElement, 'ambrosian');
        expect(controls.selection).toEqual({
            calendarType: 'general',
            calendarId: null,
            predeterminedInputs: [
                'epiphanyInput',
                'ascensionInput',
                'corpusChristiInput',
                'eternalHighPriestInput',
            ],
        });
    });

    it('names inputs reachable on the ApiOptions it is published beside', async () => {
        const controls = await build();
        userSelects(controls.calendarSelect._domElement, 'IT');
        for (const key of controls.selection.predeterminedInputs) {
            expect(controls.apiOptions[key]).toBeDefined();
        }
    });

    it('throws once disposed', async () => {
        const controls = await build();
        controls.dispose();
        expect(() => controls.selection).toThrow(/disposed/);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/__tests__/CalendarControlsSelectionChange.test.js`
Expected: FAIL — `controls.selection` is `undefined`.

If `'IT'` or `'romamo_it'` is not in `src/__fixtures__/metadata.js`, substitute
ids that are; read the fixture rather than guessing.

- [ ] **Step 3: Implement the getter**

In `src/MetaComponents/CalendarControls.js`, after the `selectedLocale` getter:

```javascript
    /**
     * What is selected, and which `ApiOptions` inputs that selection fixes.
     *
     * The state both migrated examples were deriving by hand from a raw `change`
     * listener plus a `value === ''` test (#68). Two things that test cannot
     * express and this can: which inputs are affected, by name, and the case
     * where the rite predetermines them with no calendar selected at all — the
     * Ambrosian rite-level calendar, where `value === ''` reports "editable" for
     * four inputs `ApiOptions` has disabled.
     *
     * `calendarType` is the `data-calendartype` vocabulary extended with
     * `'general'` for the rite-level calendar, which is `ApiClient`'s own
     * cache-key category for it. It is deliberately NOT the exported
     * `CalendarType` enum, whose values are the URL segments `nation`/`diocese`.
     * `calendarId` is `null` rather than `''` there, so the empty-string test
     * this replaces is not simply rewritten against the payload.
     *
     * Read synchronously, so it is also the initial state a consumer paints
     * before subscribing — see [`onSelectionChange()`](#onselectionchange).
     *
     * Throws once these controls have been disposed; see [`dispose()`](#dispose).
     *
     * @returns {{calendarType: string, calendarId: ?string, predeterminedInputs: Readonly<string[]>}} The current selection.
     * @throws {Error} If these controls have been disposed.
     */
    get selection() {
        this.#assertUsable();
        return this.#readSelection();
    }

    /**
     * Builds the selection payload from the calendar select and the `ApiOptions`.
     *
     * Split from the getter so the notifier can read it without going through
     * `#assertUsable()`, and so the two cannot describe the state differently.
     *
     * The `data-calendartype` attribute is read from the checked option rather
     * than mapped from the id, which is how `fetch()` and `PathBuilder` already
     * dispatch. `selectedIndex === -1` — a value no option carries, which
     * `#applyLinkedRite()` produces routinely — reads as the rite-level
     * calendar, exactly as every other reader in this library treats it (#66).
     *
     * @returns {{calendarType: string, calendarId: ?string, predeterminedInputs: Readonly<string[]>}} The current selection.
     */
    #readSelection() {
        const element = this.#calendarSelect._domElement;
        const value = element.value;
        const selected = element.options[element.selectedIndex];
        const type = selected?.dataset.calendartype ?? null;
        return {
            calendarType:
                '' === value || null === type
                    ? 'general'
                    : 'diocesan' === type
                      ? 'diocesan'
                      : 'national',
            calendarId: '' === value ? null : value,
            predeterminedInputs: this.#apiOptions._predeterminedInputs,
        };
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/__tests__/CalendarControlsSelectionChange.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
yarn format:js:fix
git add src/MetaComponents/CalendarControls.js src/__tests__/CalendarControlsSelectionChange.test.js
git commit -S -m "$(cat <<'EOF'
Publish the current selection as CalendarControls.selection (#68)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `onSelectionChange()`, fired once per user action

**Files:**

- Modify: `src/MetaComponents/CalendarControls.js`
- Modify: `src/__tests__/CalendarControlsSelectionChange.test.js`

**Interfaces:**

- Consumes: `#readSelection()` from Task 2.
- Produces: `onSelectionChange( callback ) -> CalendarControls` (chainable), and a `dispose()` that removes
  the two `change` listeners it attached.

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/CalendarControlsSelectionChange.test.js`:

```javascript
describe('CalendarControls.onSelectionChange', () => {
    it('is chainable', async () => {
        const controls = await build();
        expect(controls.onSelectionChange(() => {})).toBe(controls);
    });

    it('rejects a non-function callback, naming the component', async () => {
        const controls = await build();
        expect(() => controls.onSelectionChange('nope')).toThrow(
            /CalendarControls\.onSelectionChange/,
        );
    });

    it('does not fire on subscribe', async () => {
        const controls = await build();
        const seen = [];
        controls.onSelectionChange((payload) => seen.push(payload));
        await flush();
        expect(seen).toEqual([]);
    });

    it('fires exactly once for one calendar change', async () => {
        const controls = await build();
        const seen = [];
        controls.onSelectionChange((payload) => seen.push(payload));

        userSelects(controls.calendarSelect._domElement, 'IT');
        await flush();

        expect(seen).toHaveLength(1);
        expect(seen[0].calendarType).toBe('national');
        expect(seen[0].calendarId).toBe('IT');
        expect(seen[0].predeterminedInputs).toHaveLength(5);
    });

    it('fires exactly once for one rite change, which moves several inputs', async () => {
        const controls = await build();
        const seen = [];
        controls.onSelectionChange((payload) => seen.push(payload));

        userSelects(controls.riteSelect._domElement, 'ambrosian');
        await flush();

        expect(seen).toHaveLength(1);
        expect(seen[0].predeterminedInputs).toEqual([
            'epiphanyInput',
            'ascensionInput',
            'corpusChristiInput',
            'eternalHighPriestInput',
        ]);
    });

    it('does not fire for a locale change, which moves nothing it reports', async () => {
        const controls = await build();
        const seen = [];
        controls.onSelectionChange((payload) => seen.push(payload));

        userSelects(controls.apiOptions.localeInput._domElement, 'it');
        await flush();

        expect(seen).toEqual([]);
    });

    it('fires once per action across three separate actions', async () => {
        const controls = await build();
        const seen = [];
        controls.onSelectionChange((payload) => seen.push(payload));

        userSelects(controls.calendarSelect._domElement, 'IT');
        await flush();
        userSelects(controls.calendarSelect._domElement, '');
        await flush();
        userSelects(controls.riteSelect._domElement, 'ambrosian');
        await flush();

        // Asserted as a SEQUENCE, not a count: a length of three would also be
        // satisfied by one action notifying nothing and another notifying twice,
        // which is exactly what this file exists to catch.
        expect(
            seen.map(({ calendarType, calendarId, predeterminedInputs }) => [
                calendarType,
                calendarId,
                predeterminedInputs.length,
            ]),
        ).toEqual([
            ['national', 'IT', 5],
            ['general', null, 0],
            ['general', null, 4],
        ]);
    });

    it('does not fire when a change leaves the selection unaltered', async () => {
        const controls = await build();
        const seen = [];
        controls.onSelectionChange((payload) => seen.push(payload));

        // A raw dispatch with no value change: nothing to restyle.
        controls.calendarSelect._domElement.dispatchEvent(new Event('change'));
        await flush();

        expect(seen).toEqual([]);
    });

    it('notifies every registered callback', async () => {
        const controls = await build();
        const first = [];
        const second = [];
        controls
            .onSelectionChange((payload) => first.push(payload))
            .onSelectionChange((payload) => second.push(payload));

        userSelects(controls.calendarSelect._domElement, 'IT');
        await flush();

        expect(first).toHaveLength(1);
        expect(second).toHaveLength(1);
    });

    it('stops notifying after dispose(), and removes its listeners', async () => {
        const controls = await build();
        const select = controls.calendarSelect._domElement;
        const seen = [];
        controls.onSelectionChange((payload) => seen.push(payload));

        controls.dispose();
        userSelects(select, 'IT');
        await flush();

        expect(seen).toEqual([]);
    });

    it('throws on onSelectionChange() once disposed', async () => {
        const controls = await build();
        controls.dispose();
        expect(() => controls.onSelectionChange(() => {})).toThrow(/disposed/);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test src/__tests__/CalendarControlsSelectionChange.test.js`
Expected: FAIL — `controls.onSelectionChange is not a function`.

- [ ] **Step 3: Implement**

In `src/MetaComponents/CalendarControls.js`, add the fields beside `#subscriptions`:

```javascript
    /** @type {Array<function(Object): void>} */
    #selectionCallbacks = [];

    /** @type {Array<{element: HTMLElement, listener: function}>} */
    #selectionListeners = [];

    /** @type {?Promise<void>} */
    #pendingSelectionNotify = null;

    /**
     * The last payload handed to `onSelectionChange()` callbacks, serialized —
     * seeded in the constructor, so the first notification compares against the
     * state these controls started in rather than against nothing.
     *
     * @type {string}
     */
    #lastSelectionKey = '';
```

At the end of the constructor, after the `defaultValue()` line:

```javascript
        // Attached to the only two inputs that can move the selection payload.
        // A locale, year or year-type change moves nothing in it, so listening
        // to the whole `ApiOptions` would only produce notifications with an
        // identical payload for the dedupe to drop.
        this.#lastSelectionKey = CalendarControls.#selectionKey(
            this.#readSelection(),
        );
        this.#listenForSelection(this.#riteSelect._domElement);
        this.#listenForSelection(this.#calendarSelect._domElement);
```

Then the methods:

````javascript
    /**
     * Attaches the `change` listener that schedules a selection notification,
     * recording it so `dispose()` can remove it.
     *
     * Unlike the listeners `ApiClient.listenTo()` attaches — anonymous closures
     * created inside that class, which `dispose()` documents it cannot release —
     * these are this class' own and are stored, so they ARE released.
     *
     * @param {HTMLElement} element - The select to listen to.
     * @returns {void}
     */
    #listenForSelection(element) {
        const listener = () => this.#scheduleSelectionNotify();
        element.addEventListener('change', listener);
        this.#selectionListeners.push({ element, listener });
    }

    /**
     * A payload, flattened to one string for the change comparison.
     *
     * @param {{calendarType: string, calendarId: ?string, predeterminedInputs: Readonly<string[]>}} selection - The payload.
     * @returns {string} A key equal for equal payloads.
     */
    static #selectionKey({ calendarType, calendarId, predeterminedInputs }) {
        return `${calendarType}|${calendarId ?? ''}|${predeterminedInputs.join(',')}`;
    }

    /**
     * Collapses the notifications one user action provokes into one, on a
     * microtask.
     *
     * One action moves several inputs: a rite change makes `ApiOptions` rewrite
     * the calendar list, the locale options and the year floor, each dispatching
     * its own synchronous `change`, and the calendar select's own listener fires
     * in that same burst. Notifying synchronously would hand a subscriber an
     * intermediate payload naming the calendar the user had just left — and
     * would hand it out before `ApiOptions.#applyTemporalInputState()` had
     * necessarily run, so `predeterminedInputs` could describe the previous
     * selection. Every dispatch in that burst is synchronous, so a microtask
     * flush reads settled state and nothing beyond the current turn is
     * swallowed.
     *
     * The same shape as `SubscriptionUrl.#scheduleNotify()` and
     * `ApiClient.#scheduleRefetch()`, for the structurally identical problem.
     *
     * @returns {void}
     */
    #scheduleSelectionNotify() {
        if (null !== this.#pendingSelectionNotify) {
            return;
        }
        this.#pendingSelectionNotify = Promise.resolve().then(() => {
            this.#pendingSelectionNotify = null;
            if (true === this.#disposed) {
                return;
            }
            const selection = this.#readSelection();
            const key = CalendarControls.#selectionKey(selection);
            // The documented contract is that this fires when the selection
            // CHANGES. A `change` event that altered nothing it reports — a raw
            // dispatch, reselecting the current option — notifies nobody, since
            // there is nothing for a consumer to restyle. Compared against the
            // LAST NOTIFIED key, seeded at construction, so changing away and
            // back notifies both times.
            if (key === this.#lastSelectionKey) {
                return;
            }
            this.#lastSelectionKey = key;
            for (const callback of this.#selectionCallbacks) {
                callback(selection);
            }
        });
    }

    /**
     * Registers a callback fired whenever the selection changes.
     *
     * Receives the same payload as [`selection`](#selection): what kind of
     * calendar is selected, its id, and which `ApiOptions` inputs that selection
     * predetermines. This is what replaces a raw `change` listener on the
     * calendar select plus a `value === ''` test (#68) — a test that is also
     * wrong under the Ambrosian rite, where four inputs are predetermined with
     * no calendar selected.
     *
     * **Fired once per user action, on a microtask, and only when the payload
     * changed.** One action moves several inputs; see
     * `#scheduleSelectionNotify()`.
     *
     * **It does NOT fire on subscribe.** The initial state is available
     * synchronously and race-free from `selection`, so painting it is one extra
     * line, and a callback invoked inside the registration call would run
     * consumer code before the registering statement had returned. This matches
     * `onCalendarFetched()`, `onError()` and `SubscriptionBuilder.onChange()`,
     * none of which replay:
     *
     * ```javascript
     * const paint = ( { predeterminedInputs } ) => { … };
     * paint( controls.selection );
     * controls.onSelectionChange( paint );
     * ```
     *
     * @param {function(Object): void} callback - Receives the new selection.
     * @returns {CalendarControls} This instance, for chaining.
     * @throws {Error} If these controls have been disposed, or `callback` is not
     *   a function.
     */
    onSelectionChange(callback) {
        this.#assertUsable();
        if (typeof callback !== 'function') {
            throw new Error(
                `CalendarControls.onSelectionChange: callback must be a function, but found type: ${typeof callback}`,
            );
        }
        this.#selectionCallbacks.push(callback);
        return this;
    }
````

In `dispose()`, before `this.#disposed = true;`:

```javascript
        for (const { element, listener } of this.#selectionListeners) {
            element.removeEventListener('change', listener);
        }
        this.#selectionListeners = [];
        this.#selectionCallbacks = [];
        this.#pendingSelectionNotify = null;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test src/__tests__/CalendarControlsSelectionChange.test.js`
Expected: PASS, 17 tests.

- [ ] **Step 5: Mutation-verify "exactly once per user action"**

A green test proves nothing on its own. Run each of these, confirm the named test
goes RED, then revert:

1. Replace `#scheduleSelectionNotify()`'s body with a direct synchronous notify
   (no microtask, no dedupe). Expected RED: "fires exactly once for one rite
   change" (a rite change dispatches on both selects, so the callback fires
   twice) and "does not fire when a change leaves the selection unaltered".
2. Delete only the `if (key === this.#lastSelectionKey) return;` guard. Expected
   RED: "does not fire when a change leaves the selection unaltered", and "does
   not fire for a locale change" stays green (proving the guard is not the only
   thing keeping that one honest — the listener set is).
3. Add a `this.#listenForSelection( this.#apiOptions.localeInput._domElement )`
   call. Expected: still green, because the payload does not change — which is
   the evidence that the dedupe, not luck, is what makes the locale case zero.
   Revert.
4. Remove the `removeEventListener` loop from `dispose()`. Expected RED: "stops
   notifying after dispose(), and removes its listeners"? Confirm: it may stay
   green because the callbacks are cleared too. If so, that test does not prove
   what its name claims — keep the callback-clearing assertion and add:

```javascript
    it('removes its change listeners on dispose, not only its callbacks', async () => {
        const controls = await build();
        const select = controls.calendarSelect._domElement;
        const removed = jest.spyOn(select, 'removeEventListener');
        controls.dispose();
        expect(removed).toHaveBeenCalledWith('change', expect.any(Function));
    });
```

- [ ] **Step 6: Run the whole suite**

Run: `yarn test`
Expected: PASS, 84 suites.

- [ ] **Step 7: Commit**

```bash
yarn format:js:fix
git add src/MetaComponents/CalendarControls.js src/__tests__/CalendarControlsSelectionChange.test.js
git commit -S -m "$(cat <<'EOF'
Notify selection changes once per user action (#68)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Documentation

**Files:**

- Modify: `docs/meta-components.md` (the `CalendarControls` "Public getters" and `dispose()` sections)
- Modify: `CLAUDE.md` (the Meta-Components section)
- Modify: `README.md` (the `CalendarControls` bullet)
- Modify: `CHANGELOG.md` (`## [Unreleased]`)

**Interfaces:**

- Consumes: the API from Tasks 2 and 3. No code changes.

- [ ] **Step 1: `docs/meta-components.md`**

Extend the `CalendarControls` "Public getters" table with `selection`, then add a
new `### onSelectionChange()` subsection after "The locale cascade" containing:
the payload table from the spec; the "fires once per user action, on a microtask,
deduped" rule; the explicit "does not fire on subscribe" decision with the
two-line recipe; and the before/after for the examples that motivated the issue:

````markdown
Before, in every consumer:

```javascript
const calendarSelectElement = viewer.controls.calendarSelect._domElement;
setHolyDaysOfObligationBgColor(holydaysInput, calendarSelectElement.value);

calendarSelectElement.addEventListener('change', (ev) => {
    $(holydaysInput).multiselect('rebuild');
    setHolyDaysOfObligationBgColor(holydaysInput, ev.target.value);
});
```

After — the jQuery call stays with the consumer, the derived state does not:

```javascript
const paint = ({ predeterminedInputs }) => {
    const readOnly = predeterminedInputs.includes('holydaysOfObligationInput');
    holydaysInput.classList.toggle('predetermined', readOnly);
};

paint(viewer.controls.selection);
viewer.controls.onSelectionChange((selection) => {
    $(holydaysInput).multiselect('rebuild');
    paint(selection);
});
```
````

Also add to the `dispose()` section that the two `change` listeners this class
attaches for `onSelectionChange()` **are** released — being its own named
closures, unlike `ApiClient`'s — leaving the documented gap unchanged.

- [ ] **Step 2: `CLAUDE.md`**

Add a paragraph to the Meta-Components section, after the `settled` paragraph:

```markdown
**`onSelectionChange()` publishes the state consumers were deriving by hand.** `CalendarControls.selection`
reports `{ calendarType, calendarId, predeterminedInputs }` and `onSelectionChange( callback )` fires once
per user action — on a microtask, like `SubscriptionUrl.#scheduleNotify()`, and only when the payload
changed. It deliberately does **not** fire on subscribe: the initial state is available synchronously from
`selection`, and the two-line `paint( controls.selection ); controls.onSelectionChange( paint );` is what
both migrated examples already write. `predeterminedInputs` is derived from `ApiOptions`' own disable rule,
which lives in exactly one place — `src/ApiOptions/PredeterminedInputs.js`, applied by
`#applyTemporalInputState()` and reported by `ApiOptions._predeterminedInputs`, the same one-source-two-readers
shape `FilterInputs.js` has. **Do not reconstruct it by reading `_domElement.disabled` back:**
`HolydaysOfObligationInput.disabled()` never sets that property, so the one input the feature exists for
would need a special case. `SubscriptionBuilder.onChange()` is deliberately not refactored onto this — it
publishes a serialized URL built from a `CurrentEndpoint` that also tracks year, locale, return type and
path, so it watches a different set of inputs and carries a different payload.
```

- [ ] **Step 3: `README.md`**

Extend the `CalendarControls` bullet (around line 81) with one sentence naming
`selection`/`onSelectionChange()`.

- [ ] **Step 4: `CHANGELOG.md`**

Add under `## [Unreleased]`, in the appropriate subsection (a new `### Added`
if none exists there yet — check the file):

```markdown
- **`CalendarControls` now publishes the current selection**, closing #68. `controls.selection` reports
  `{ calendarType, calendarId, predeterminedInputs }` and the chainable `controls.onSelectionChange( callback )`
  fires once per user action, on a microtask, whenever that payload changes. It replaces the raw `change`
  listener plus `value === ''` test every consumer was writing to decide whether an `ApiOptions` input is
  effectively read-only — a test that is also wrong under the Ambrosian rite, where the Missal predetermines
  four inputs with no calendar selected at all. `predeterminedInputs` names inputs by their canonical
  `ApiOptions` accessor and is derived from the same rule `ApiOptions` uses to disable them, extracted to
  `src/ApiOptions/PredeterminedInputs.js` (internal, not exported). The callback does **not** fire on
  subscribe; read `selection` for the initial paint. `dispose()` releases both listeners it attaches.
  Reached through `.controls` on `CalendarViewer`, `ApiExplorer` and `SubscriptionBuilder`, which need no
  forwarding methods of their own.
```

- [ ] **Step 5: Run the documentation gates**

```bash
yarn format:md:fix && yarn format:md && yarn lint:md
```

Expected: no files needing changes, zero markdownlint errors.

- [ ] **Step 6: Commit**

```bash
git add docs/meta-components.md CLAUDE.md README.md CHANGELOG.md docs/superpowers
git commit -S -m "$(cat <<'EOF'
Document CalendarControls.onSelectionChange() (#68)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Full gates and review

**Files:** none — verification only.

- [ ] **Step 1: Run every gate, capturing real output**

```bash
yarn test
yarn compile && yarn lint:dts
yarn format:js
yarn format:md
yarn lint:md
```

Expected: `yarn test` reports 84 suites and ~1624 tests, all passing (baseline
83/1601 plus the new files); `lint:dts` clean; both formatters report nothing to
change; markdownlint zero errors.

`yarn lint:dts` matters specifically here: `selection`'s JSDoc return type is an
inline object type, and a getter emitted with a stray `@readonly` or an
unresolvable type name breaks every downstream TypeScript consumer while
`yarn compile` stays green.

- [ ] **Step 2: Request code review**

Use `superpowers:requesting-code-review`, then address findings via
`superpowers:receiving-code-review` — verifying each claim against the code
rather than agreeing reflexively.

- [ ] **Step 3: Verification before completion**

Use `superpowers:verification-before-completion`. Every claim in the final report
must be backed by output actually observed in this session.
