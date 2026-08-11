# Meta-components Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** Add two meta-components — `CalendarResourcePicker` and `DayViewer` — that own the
component wiring the frontend currently re-derives by hand in five places, while leaving all styling
to the consumer.

**Architecture:** A new `src/MetaComponents/` directory holds one internal theme resolver plus two
standalone meta-components. Each bundles existing components, owns their wiring and mount ordering,
exposes the wired children as public getters, and takes a theme bag whose vocabulary is HTML roles
rather than framework names. No base class. Supporting additions: `EventEmitter.off()` (so teardown
can be complete) and three new `Messages` keys.

**Tech Stack:** ES2022 modules, Jest 30 + jsdom, TypeScript 5.7 for declaration emit only, Prettier, markdownlint-cli2, Yarn 4.6.

**Design spec:** `docs/superpowers/specs/2026-08-11-meta-components-design.md`

## Global Constraints

- **ECMAScript floor is ES2022**, pinned in `tsconfig.json`. `Object.hasOwn()` and `Error` `cause` are
  used; do not lower it. Any change to the floor must be verified by reading emitted `dist/`, not by a
  green `yarn compile`.
- **`checkJs` is off.** `yarn compile` passing proves nothing about JS correctness or `.d.ts`
  validity. `yarn lint:dts` is the gate that catches invalid declarations, and it checks whatever is
  already in `dist/` — run `yarn compile` first.
- **Never put `@readonly` on a getter** in JSDoc: `tsc` emits the syntactically invalid `readonly get foo(): T;` and breaks every downstream TypeScript consumer.
- **Prettier owns `src/`**: `tabWidth: 4`, `singleQuote: true`. Run `yarn format:js:fix` before every commit; CI fails on unformatted files.
- **Markdown**: `yarn format:md:fix` then `yarn lint:md`, both must be clean. Max line length 180.
- **`appendTo()` returns `undefined`** on every component including the new ones. Do not return `this`.
- **Never use `--no-verify`.** If a git hook fails, fix the cause and commit again.
- **Tests never hit the network.** Build bases with `ApiBase.fromMetadata(url, metadata)` and call `ApiBase.reset()` in `beforeEach`.
- **Version target: 2.2.0.** Purely additive; no existing component API changes except the additive `EventEmitter.off()`.
- Internal modules (`Theme.js`) are **not** exported from `src/index.js`, matching `LocaleValidation.js` and `OptionsValidation.js`.

---

### Task 1: `EventEmitter.off()`

Teardown is impossible today: `EventEmitter` has `on()` and `emit()` and no way to unsubscribe. `DayViewer.dispose()` depends on this.

**Files:**

- Modify: `src/ApiClient/EventEmitter.js`
- Test: `src/__tests__/EventEmitter.test.js` (create)

**Interfaces:**

- Consumes: nothing.
- Produces: `EventEmitter.prototype.off(event: string, listener: Function): void`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/EventEmitter.test.js`:

```javascript
import { describe, it, expect } from '@jest/globals';
import EventEmitter from '../ApiClient/EventEmitter.js';

describe('EventEmitter.off', () => {
    it('stops a removed listener from being called', () => {
        const emitter = new EventEmitter();
        const calls = [];
        const listener = (data) => calls.push(data);

        emitter.on('ping', listener);
        emitter.emit('ping', 'first');
        emitter.off('ping', listener);
        emitter.emit('ping', 'second');

        expect(calls).toEqual(['first']);
    });

    it('leaves other listeners for the same event registered', () => {
        const emitter = new EventEmitter();
        const kept = [];
        const removed = () => {
            throw new Error('should not be called');
        };
        const keeper = (data) => kept.push(data);

        emitter.on('ping', removed);
        emitter.on('ping', keeper);
        emitter.off('ping', removed);
        emitter.emit('ping', 'payload');

        expect(kept).toEqual(['payload']);
    });

    it('removes only one registration when the same listener was added twice', () => {
        const emitter = new EventEmitter();
        let count = 0;
        const listener = () => {
            count += 1;
        };

        emitter.on('ping', listener);
        emitter.on('ping', listener);
        emitter.off('ping', listener);
        emitter.emit('ping', null);

        expect(count).toBe(1);
    });

    it('is a no-op for an unknown event or an unregistered listener', () => {
        const emitter = new EventEmitter();
        expect(() => emitter.off('nope', () => {})).not.toThrow();
        emitter.on('ping', () => {});
        expect(() => emitter.off('ping', () => {})).not.toThrow();
    });

    // `emit()` iterates the listener array. Removing during iteration must not
    // cause `forEach` to skip the next listener, which is what an in-place
    // `splice` would do.
    it('does not skip a listener when one unsubscribes during emit', () => {
        const emitter = new EventEmitter();
        const seen = [];
        const first = () => {
            seen.push('first');
            emitter.off('ping', first);
        };
        const second = () => seen.push('second');

        emitter.on('ping', first);
        emitter.on('ping', second);
        emitter.emit('ping', null);

        expect(seen).toEqual(['first', 'second']);
    });

    // ApiClient:433 reads `_events['calendarFetchFailed']?.length > 0` to decide
    // whether a failure reaches a handler. An emptied array must read as zero.
    it('leaves an empty array that reads as no listeners', () => {
        const emitter = new EventEmitter();
        const listener = () => {};
        emitter.on('calendarFetchFailed', listener);
        emitter.off('calendarFetchFailed', listener);

        expect(
            emitter._events['calendarFetchFailed']?.length > 0,
        ).toBe(false);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/EventEmitter.test.js`

Expected: FAIL — `emitter.off is not a function`.

- [ ] **Step 3: Implement `off()`**

In `src/ApiClient/EventEmitter.js`, add this method immediately after `on()`:

```javascript
    /**
     * Removes a previously registered listener for the specified event.
     *
     * Removes ONE registration, so a listener added twice must be removed twice.
     * This mirrors `on()`, which appends unconditionally.
     *
     * The array is REPLACED rather than spliced in place, and that is load-bearing:
     * `emit()` iterates with `forEach`, and an in-place removal during that
     * iteration shifts the remaining entries down so `forEach` skips the next one.
     * Replacing the array leaves the in-flight iteration holding the old one, which
     * completes intact.
     *
     * An emptied event keeps its (now empty) array rather than deleting the key.
     * `ApiClient#emitCalendarFetchFailed` reads `_events[ event ]?.length > 0`, for
     * which an empty array and an absent key are equivalent.
     *
     * Unknown events and unregistered listeners are no-ops: unsubscribing something
     * already gone is not an error.
     *
     * @param {string} event - The event to stop listening for.
     * @param {function} listener - The exact listener reference passed to `on()`.
     * @returns {void}
     */
    off(event, listener) {
        const listeners = this.#events[event];
        if (undefined === listeners) {
            return;
        }
        const index = listeners.indexOf(listener);
        if (-1 === index) {
            return;
        }
        this.#events[event] = [
            ...listeners.slice(0, index),
            ...listeners.slice(index + 1),
        ];
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test src/__tests__/EventEmitter.test.js`

Expected: PASS, 6 tests.

- [ ] **Step 5: Verify nothing else regressed**

Run: `yarn test`

Expected: the whole suite passes.

- [ ] **Step 6: Format and commit**

```bash
yarn format:js:fix
git add src/ApiClient/EventEmitter.js src/__tests__/EventEmitter.test.js
git commit -m "Add EventEmitter.off() so subscriptions can be released

The emitter had on() and emit() and no way to unsubscribe, which made
listenTo() a permanent one-way subscription and teardown impossible. The
listener array is replaced rather than spliced so that a listener removing
itself during emit() does not cause forEach to skip the next one."
```

---

### Task 2: `DAY`, `YEAR` and `LANGUAGE` message keys

`liturgyOfAnyDay.js:19-104` copies a 90-line translation map because these keys do not exist. `DayViewer` needs them to delete that map.

**Files:**

- Modify: `src/Messages.js`
- Test: `src/__tests__/Messages.test.js:1` (extend the existing file)

**Interfaces:**

- Consumes: nothing.
- Produces: `Messages[lang].DAY`, `Messages[lang].YEAR`, `Messages[lang].LANGUAGE` for the 12 locales `de en es fr hu id it la nl pt sk vi`.

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/Messages.test.js`:

```javascript
describe('day/year/language keys', () => {
    // The same 12 locales that already carry SELECT_A_RITE. Chosen to match the
    // existing precedent rather than invent a second coverage rule, and because
    // they are exactly the languages the frontend serves.
    const TRANSLATED = [
        'de', 'en', 'es', 'fr', 'hu', 'id',
        'it', 'la', 'nl', 'pt', 'sk', 'vi',
    ];

    it.each(TRANSLATED)('defines DAY, YEAR and LANGUAGE for %s', (lang) => {
        expect(typeof Messages[lang].DAY).toBe('string');
        expect(typeof Messages[lang].YEAR).toBe('string');
        expect(typeof Messages[lang].LANGUAGE).toBe('string');
        expect(Messages[lang].DAY.length).toBeGreaterThan(0);
        expect(Messages[lang].YEAR.length).toBeGreaterThan(0);
        expect(Messages[lang].LANGUAGE.length).toBeGreaterThan(0);
    });

    it('carries the same coverage as SELECT_A_RITE', () => {
        const withRite = Object.keys(Messages).filter(
            (lang) => undefined !== Messages[lang].SELECT_A_RITE,
        );
        const withDay = Object.keys(Messages).filter(
            (lang) => undefined !== Messages[lang].DAY,
        );
        expect(withDay.sort()).toEqual(withRite.sort());
    });

    it('leaves untranslated locales undefined so callers fall back to English', () => {
        expect(Messages['zh'].DAY).toBeUndefined();
        expect(Messages['en'].DAY).toBe('Day');
    });
});
```

Confirm the file's existing import provides `Messages`; if it imports differently, match it rather than adding a second import.

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/Messages.test.js`

Expected: FAIL — `expected "undefined" to be "string"`.

- [ ] **Step 3: Add the keys**

In `src/Messages.js`, add three entries to each of the 12 locale objects. Values are taken verbatim
from the map already in production at
`LiturgicalCalendarFrontend/assets/js/liturgyOfAnyDay.js:62-103`, so this is a move, not a new
translation:

| Locale | `DAY`  | `YEAR` | `LANGUAGE` |
| ------ | ------ | ------ | ---------- |
| `de`   | Tag    | Jahr   | Sprache    |
| `en`   | Day    | Year   | Language   |
| `es`   | Día    | Año    | Idioma     |
| `fr`   | Jour   | Année  | Langue     |
| `hu`   | Nap    | Év     | Nyelv      |
| `id`   | Hari   | Tahun  | Bahasa     |
| `it`   | Giorno | Anno   | Lingua     |
| `la`   | Dies   | Annus  | Lingua     |
| `nl`   | Dag    | Jaar   | Taal       |
| `pt`   | Dia    | Ano    | Língua     |
| `sk`   | Deň    | Rok    | Jazyk      |
| `vi`   | Ngày   | Năm    | Ngôn ngữ   |

For example, in the `en` block, beside the existing `MONTH: 'Month',`:

```javascript
        DAY: 'Day',
        YEAR: 'Year',
        LANGUAGE: 'Language',
```

Place them adjacent to the existing `MONTH` key in each of the 12 blocks so related keys stay together. Do not touch the other 72 locales.

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test src/__tests__/Messages.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
yarn format:js:fix
git add src/Messages.js src/__tests__/Messages.test.js
git commit -m "Add DAY, YEAR and LANGUAGE message keys for 12 locales

LiturgyOfAnyDay supplies no default labels for its day, month and year
inputs, which forced the frontend to copy a 90-line translation map into
liturgyOfAnyDay.js. The values here are that map, moved. Coverage matches
SELECT_A_RITE exactly rather than inventing a second coverage rule."
```

---

### Task 3: `Theme.js` resolver

A pure, DOM-free function. Everything else in this plan depends on it, so it is worth isolating and testing on its own.

**Files:**

- Create: `src/MetaComponents/Theme.js`
- Test: `src/__tests__/MetaComponentTheme.test.js`

**Interfaces:**

- Consumes: `assertPlainOptions` and `describeType` from `../OptionsValidation.js`.
- Produces: `resolveChildTheme(theme, childKey, role) → { class?, labelClass?, wrapperClass?, wrapper? }`, and `assertTheme(theme, componentName) → void`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/MetaComponentTheme.test.js`:

```javascript
import { describe, it, expect } from '@jest/globals';
import {
    resolveChildTheme,
    assertTheme,
} from '../MetaComponents/Theme.js';

describe('resolveChildTheme', () => {
    it('returns an empty result for an absent theme', () => {
        expect(resolveChildTheme(null, 'riteSelect')).toEqual({});
        expect(resolveChildTheme(undefined, 'riteSelect')).toEqual({});
    });

    it('applies the flat role defaults', () => {
        const theme = {
            select: 'form-select',
            label: 'form-label',
            wrapper: 'col-md-3',
        };
        expect(resolveChildTheme(theme, 'riteSelect')).toEqual({
            class: 'form-select',
            labelClass: 'form-label',
            wrapperClass: 'col-md-3',
        });
    });

    it('reads the input role rather than the select role', () => {
        const theme = { select: 'form-select', input: 'form-control' };
        expect(resolveChildTheme(theme, 'yearInput', 'input')).toEqual({
            class: 'form-control',
        });
    });

    it('lets a per-child override beat the flat default', () => {
        const theme = {
            select: 'form-select',
            riteSelect: { class: 'form-select mb-2' },
        };
        expect(resolveChildTheme(theme, 'riteSelect').class).toBe(
            'form-select mb-2',
        );
        expect(resolveChildTheme(theme, 'calendarSelect').class).toBe(
            'form-select',
        );
    });

    it('accepts a bare string as shorthand for a class override', () => {
        const theme = { select: 'form-select', riteSelect: 'custom' };
        expect(resolveChildTheme(theme, 'riteSelect').class).toBe('custom');
    });

    it('merges per-key rather than replacing the whole result', () => {
        const theme = {
            select: 'form-select',
            label: 'form-label',
            riteSelect: { class: 'custom' },
        };
        expect(resolveChildTheme(theme, 'riteSelect')).toEqual({
            class: 'custom',
            labelClass: 'form-label',
        });
    });

    it('omits keys that were never set rather than emitting undefined values', () => {
        const result = resolveChildTheme({ select: 'a' }, 'riteSelect');
        expect(Object.hasOwn(result, 'labelClass')).toBe(false);
    });

    it('carries a per-child wrapper element name through', () => {
        const theme = { dateControls: { wrapper: 'div', wrapperClass: 'col' } };
        expect(resolveChildTheme(theme, 'dateControls', 'input')).toEqual({
            wrapper: 'div',
            wrapperClass: 'col',
        });
    });
});

describe('assertTheme', () => {
    it('accepts an absent theme', () => {
        expect(() => assertTheme(null, 'DayViewer')).not.toThrow();
        expect(() => assertTheme(undefined, 'DayViewer')).not.toThrow();
    });

    it('rejects a non-object theme, naming the component and the type', () => {
        expect(() => assertTheme('form-select', 'DayViewer')).toThrow(
            /DayViewer.*theme.*string/,
        );
        expect(() => assertTheme(['a'], 'DayViewer')).toThrow(
            /DayViewer.*theme.*array/,
        );
    });

    it('rejects a per-child override that is neither string nor object', () => {
        expect(() =>
            assertTheme({ riteSelect: 42 }, 'CalendarResourcePicker'),
        ).toThrow(/riteSelect.*number/);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/MetaComponentTheme.test.js`

Expected: FAIL — cannot resolve `../MetaComponents/Theme.js`.

- [ ] **Step 3: Implement the resolver**

Create `src/MetaComponents/Theme.js`:

```javascript
/**
 * Resolves a meta-component's theme bag into per-child styling values.
 *
 * Deliberately NOT exported from `src/index.js`, on the same reasoning as
 * `LocaleValidation.js` and `OptionsValidation.js`: internal contract between
 * components, not public API.
 *
 * The bag's vocabulary is HTML roles — `select`, `input`, `label`, `wrapper` —
 * never framework names, so a Tailwind or vanilla consumer is not writing
 * Bootstrap-shaped keys. Per-child keys are named for the meta-component's public
 * getters, so the override key and the escape hatch are the same word.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import { assertPlainOptions, describeType } from '../OptionsValidation.js';

/**
 * The flat theme key that supplies a child's `class`, by the child's role.
 * A `select` child takes its class from `theme.select`, a text or number input
 * from `theme.input` — the two are separated because a consumer styling
 * Bootstrap needs `form-select` on one and `form-control` on the other.
 *
 * @type {Readonly<Object<string, string>>}
 */
const CLASS_KEY_BY_ROLE = Object.freeze({
    select: 'select',
    input: 'input',
});

/**
 * The reserved flat role keys. Any other key in the bag is read as a per-child
 * override, which is what keeps the bag open to children added later without
 * this module needing to know their names.
 *
 * @type {Readonly<string[]>}
 */
const FLAT_KEYS = Object.freeze(['select', 'input', 'label', 'wrapper']);

/**
 * Validates a theme bag's shape, throwing with the component's name and the type
 * actually found.
 *
 * Shape only. Class strings are never inspected: this module takes no position on
 * what a valid class name is, which is the whole point of the role vocabulary.
 *
 * @param {unknown} theme - The candidate theme bag.
 * @param {string} componentName - The rejecting component's class name.
 * @returns {void}
 * @throws {Error} If the bag or any per-child override has the wrong shape.
 */
export function assertTheme(theme, componentName) {
    if (null === theme || undefined === theme) {
        return;
    }
    assertPlainOptions(theme, `${componentName}: theme`);
    for (const key of Object.keys(theme)) {
        const value = theme[key];
        if (FLAT_KEYS.includes(key)) {
            if (typeof value !== 'string') {
                throw new Error(
                    `${componentName}: theme.${key} must be of type \`string\` but found type: ${describeType(value)}`,
                );
            }
            continue;
        }
        if (typeof value === 'string') {
            continue;
        }
        try {
            assertPlainOptions(value, `${componentName}: theme.${key}`);
        } catch {
            throw new Error(
                `${componentName}: theme.${key} must be a class string or an object but found type: ${describeType(value)}`,
            );
        }
    }
}

/**
 * Resolves the styling for one child of a meta-component.
 *
 * Resolution is per-key and most-specific-first: a per-child override supplies
 * whichever keys it names, and every key it does not name falls back to the flat
 * role default. A per-child override therefore adjusts a child rather than
 * replacing its styling wholesale, which is what makes
 * `{ select: 'form-select', riteSelect: { class: 'form-select mb-2' } }` leave the
 * shared label class in place.
 *
 * Unset keys are OMITTED rather than set to `undefined`, so a caller can use
 * `Object.hasOwn()` to distinguish "not themed" from "themed as empty" and avoid
 * calling a component's setter with an empty string.
 *
 * @param {Object|null|undefined} theme - The meta-component's theme bag.
 * @param {string} childKey - The child's public getter name, e.g. `riteSelect`.
 * @param {'select'|'input'} [role='select'] - Which flat key supplies `class`.
 * @returns {{class?: string, labelClass?: string, wrapperClass?: string, wrapper?: string}} The resolved styling.
 */
export function resolveChildTheme(theme, childKey, role = 'select') {
    if (null === theme || undefined === theme) {
        return {};
    }

    const resolved = {};
    const classKey = CLASS_KEY_BY_ROLE[role] ?? 'select';
    if (typeof theme[classKey] === 'string') {
        resolved.class = theme[classKey];
    }
    if (typeof theme.label === 'string') {
        resolved.labelClass = theme.label;
    }
    if (typeof theme.wrapper === 'string') {
        resolved.wrapperClass = theme.wrapper;
    }

    let override = theme[childKey];
    if (typeof override === 'string') {
        override = { class: override };
    }
    if (null === override || typeof override !== 'object') {
        return resolved;
    }
    for (const key of ['class', 'labelClass', 'wrapperClass', 'wrapper']) {
        if (Object.hasOwn(override, key)) {
            resolved[key] = override[key];
        }
    }
    return resolved;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test src/__tests__/MetaComponentTheme.test.js`

Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
yarn format:js:fix
git add src/MetaComponents/Theme.js src/__tests__/MetaComponentTheme.test.js
git commit -m "Add the meta-component theme resolver

Resolves a theme bag into per-child styling, per-key and most-specific
first, so a per-child override adjusts a child rather than replacing its
styling wholesale. The bag's vocabulary is HTML roles rather than framework
names, and the module is internal for the same reason LocaleValidation and
OptionsValidation are."
```

---

### Task 4: `CalendarResourcePicker` core

The constructor, the children, the rite-for-diocesan-only rule, and mount ordering.

**Files:**

- Create: `src/MetaComponents/CalendarResourcePicker.js`
- Test: `src/__tests__/CalendarResourcePicker.test.js`

**Interfaces:**

- Consumes: `resolveChildTheme`, `assertTheme` (Task 3); `resolveBase` from `../ApiClient/ApiBase.js`; `normalizeComponentOptions` from `../OptionsValidation.js`.
- Produces: `new CalendarResourcePicker(options)`, getters `calendarSelect`, `riteSelect`, `value`, `failed`, and `appendTo(target) → undefined`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/CalendarResourcePicker.test.js`:

```javascript
/** @jest-environment jsdom */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import CalendarResourcePicker from '../MetaComponents/CalendarResourcePicker.js';
import { CalendarSelectFilter } from '../Enums.js';

// Two Ambrosian dioceses and one Roman one, so that a rite change is observable
// as a change of options rather than merely a change of count.
const METADATA = {
    locales: ['en', 'it', 'la'],
    national_calendars: [
        { calendar_id: 'IT', locales: ['it-IT'], settings: {} },
        { calendar_id: 'VA', locales: ['la', 'it-IT'], settings: {} },
    ],
    diocesan_calendars: [
        {
            calendar_id: 'romamo_it',
            nation: 'IT',
            diocese: 'Diocesi di Roma',
            locales: ['it-IT'],
            rite: 'roman',
        },
        {
            calendar_id: 'milano_it',
            nation: 'IT',
            diocese: 'Diocesi di Milano',
            locales: ['it-IT'],
            rite: 'ambrosian',
        },
        {
            calendar_id: 'lugano_ch',
            nation: 'CH',
            diocese: 'Diocesi di Lugano',
            locales: ['it-IT'],
            rite: 'ambrosian',
        },
    ],
    ambrosian_calendars: [
        { calendar_id: 'ambrosian', rite: 'ambrosian', locales: ['it', 'la'] },
    ],
};

const API_URL = 'http://localhost:8000';

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, METADATA);
    document.body.innerHTML = '<div id="mount"></div>';
});

describe('CalendarResourcePicker construction', () => {
    it('builds a rite select for a diocesan filter', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
        });
        expect(picker.riteSelect).not.toBeNull();
        expect(picker.calendarSelect).not.toBeNull();
    });

    // The Ambrosian rite has no national tier: a nations-filtered select under it
    // holds only the rite-level calendar and hides itself, stranding the user with
    // a required field they cannot fill.
    it('builds no rite select for a national filter', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        expect(picker.riteSelect).toBeNull();
    });

    it('rejects a filter that is neither national nor diocesan', () => {
        expect(
            () =>
                new CalendarResourcePicker({
                    locale: 'en',
                    filter: CalendarSelectFilter.NONE,
                }),
        ).toThrow(/CalendarResourcePicker.*filter/);
    });

    it('rejects an unparseable locale rather than falling back to English', () => {
        expect(
            () =>
                new CalendarResourcePicker({
                    locale: 'not a locale',
                    filter: CalendarSelectFilter.NATIONAL_CALENDARS,
                }),
        ).toThrow(/CalendarResourcePicker/);
    });

    it('applies the theme to both children', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
            theme: {
                select: 'form-select',
                riteSelect: { class: 'form-select mb-2' },
            },
        });
        picker.appendTo('#mount');
        expect(
            document.querySelector('#mount select.form-select.mb-2'),
        ).not.toBeNull();
        const calendarEl = picker.calendarSelect._domElement;
        expect(calendarEl.className).toBe('form-select');
    });
});

describe('CalendarResourcePicker mounting', () => {
    it('mounts the rite select before the calendar select', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
        });
        picker.appendTo('#mount');
        const selects = document.querySelectorAll('#mount select');
        expect(selects.length).toBeGreaterThanOrEqual(2);
        expect(selects[0]).toBe(picker.riteSelect._domElement);
    });

    it('returns undefined from appendTo, per library convention', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        expect(picker.appendTo('#mount')).toBeUndefined();
    });

    it('accepts an HTMLElement as well as a selector', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        picker.appendTo(document.getElementById('mount'));
        expect(document.querySelector('#mount select')).not.toBeNull();
    });

    it('throws when the mount target matches nothing', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        expect(() => picker.appendTo('#nope')).toThrow(/nope/);
    });

    it('reports the selected calendar id through value', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        picker.appendTo('#mount');
        picker.calendarSelect._domElement.value = 'IT';
        expect(picker.value).toBe('IT');
    });

    it('starts out not failed', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        expect(picker.failed).toBe(false);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/CalendarResourcePicker.test.js`

Expected: FAIL — cannot resolve `../MetaComponents/CalendarResourcePicker.js`.

- [ ] **Step 3: Implement the core**

Create `src/MetaComponents/CalendarResourcePicker.js`:

```javascript
/**
 * A rite select and a filtered calendar select, wired together as one control.
 *
 * Exists because three separate admin call sites in `LiturgicalCalendarFrontend`
 * built this pairing by hand, identically, including the comments — and because
 * the pairing has ordering and re-application requirements that the underlying
 * components document but cannot enforce.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import { CalendarSelectFilter } from '../Enums.js';
import { normalizeComponentOptions } from '../OptionsValidation.js';
import { assertTheme, resolveChildTheme } from './Theme.js';

/**
 * The filters this picker accepts. `CalendarSelectFilter.NONE` is excluded on
 * purpose: an unfiltered select mixes national and diocesan calendars, and a
 * resource id has to be one or the other.
 *
 * @type {Readonly<string[]>}
 */
const ACCEPTED_FILTERS = Object.freeze([
    CalendarSelectFilter.NATIONAL_CALENDARS,
    CalendarSelectFilter.DIOCESAN_CALENDARS,
]);

export default class CalendarResourcePicker {
    /** @type {CalendarSelect} */
    #calendarSelect;

    /** @type {RiteSelect|null} */
    #riteSelect = null;

    /** @type {HTMLElement|null} */
    #mount = null;

    /** @type {boolean} */
    #failed = false;

    /**
     * @param {Object|string|Intl.Locale} [options] - Options bag, or a locale.
     * @param {string|Intl.Locale} [options.locale] - The display locale.
     * @param {string} options.filter - `CalendarSelectFilter.NATIONAL_CALENDARS` or `.DIOCESAN_CALENDARS`.
     * @param {Object} [options.theme] - The theme bag; see `Theme.js`.
     * @param {Object} [options.apiClient] - Binds this picker to that client's API base.
     * @throws {Error} If the filter is absent or not one of the two accepted values.
     */
    constructor(options) {
        options = normalizeComponentOptions(
            options,
            'CalendarResourcePicker',
        );
        const { locale, filter, theme, apiClient } = options;

        if (false === ACCEPTED_FILTERS.includes(filter)) {
            throw new Error(
                `CalendarResourcePicker: the filter option must be CalendarSelectFilter.NATIONAL_CALENDARS or CalendarSelectFilter.DIOCESAN_CALENDARS, but found: ${String(filter)}`,
            );
        }
        assertTheme(theme, 'CalendarResourcePicker');

        // The rite select is offered for diocesan filters ONLY. The Ambrosian rite
        // has no national tier, so a `nations` filtered select under it holds only
        // the rite-level calendar and hides itself — which would strand the user
        // with a required field and no way to fill it. Derived here rather than
        // left for each caller to remember.
        const wantsRite = filter === CalendarSelectFilter.DIOCESAN_CALENDARS;

        if (wantsRite) {
            const riteTheme = resolveChildTheme(theme, 'riteSelect');
            this.#riteSelect = new RiteSelect({ locale });
            if (Object.hasOwn(riteTheme, 'class')) {
                this.#riteSelect.class(riteTheme.class);
            }
            if (Object.hasOwn(riteTheme, 'labelClass')) {
                // No `text`: omitting it lets RiteSelect supply its own localized
                // label rather than forcing the caller to hardcode English.
                this.#riteSelect.label({ class: riteTheme.labelClass });
            }
        }

        const calendarTheme = resolveChildTheme(theme, 'calendarSelect');
        this.#calendarSelect = new CalendarSelect({
            locale,
            filter,
            apiClient,
            allowNull: true,
        });
        if (Object.hasOwn(calendarTheme, 'class')) {
            this.#calendarSelect.class(calendarTheme.class);
        }
        if (Object.hasOwn(calendarTheme, 'labelClass')) {
            this.#calendarSelect.label({ class: calendarTheme.labelClass });
        }
        if (Object.hasOwn(calendarTheme, 'wrapperClass')) {
            this.#calendarSelect.wrapper({
                class: calendarTheme.wrapperClass,
            });
        }
    }

    /**
     * The wired `CalendarSelect`. Public so a consumer can reach anything the theme
     * bag does not cover — an id, a data attribute — without touching a private field.
     *
     * @returns {CalendarSelect} The calendar select.
     */
    get calendarSelect() {
        return this.#calendarSelect;
    }

    /**
     * The wired `RiteSelect`, or `null` for a national filter.
     *
     * @returns {RiteSelect|null} The rite select, when there is one.
     */
    get riteSelect() {
        return this.#riteSelect;
    }

    /**
     * The selected calendar id, or the empty string when the placeholder is selected.
     *
     * @returns {string} The selected calendar id.
     */
    get value() {
        return this.#calendarSelect._domElement.value;
    }

    /**
     * Whether the picker is showing its failure control instead of a working select.
     *
     * @returns {boolean} True when construction failed at runtime.
     */
    get failed() {
        return this.#failed;
    }

    /**
     * Resolves a mount target to an element.
     *
     * Static because `mountInto()` needs it before any instance exists — it
     * resolves the target ahead of construction so that an unusable target is
     * reported as the programmer error it is, rather than surfacing later as a
     * failure control.
     *
     * @param {string|HTMLElement} target - A CSS selector or an element.
     * @param {string} caller - The calling method's name, for the message.
     * @returns {HTMLElement} The resolved element.
     * @throws {Error} If the target is neither, or matches nothing.
     */
    static #requireElement(target, caller) {
        if (target instanceof HTMLElement) {
            return target;
        }
        if (typeof target !== 'string' || '' === target) {
            throw new Error(
                `CalendarResourcePicker.${caller}: target must be a non-empty CSS selector or an HTMLElement.`,
            );
        }
        const element = document.querySelector(target);
        if (null === element) {
            throw new Error(
                `CalendarResourcePicker.${caller}: Element not found: ${target}`,
            );
        }
        return element;
    }

    /**
     * Mounts the picker's children into the target element.
     *
     * The rite select is appended FIRST, and that ordering is load-bearing twice
     * over: it reads first in the form, and `linkToRiteSelect()` requires the rite
     * select to already be in the DOM, because it reads the element to attach its
     * change listener.
     *
     * Returns `undefined`, matching every other component in this library.
     *
     * @param {string|HTMLElement} target - Where to mount.
     * @returns {void}
     */
    appendTo(target) {
        const element = CalendarResourcePicker.#requireElement(
            target,
            'appendTo',
        );
        this.#mount = element;
        if (null !== this.#riteSelect) {
            this.#riteSelect.appendTo(element);
        }
        this.#calendarSelect.appendTo(element);
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test src/__tests__/CalendarResourcePicker.test.js`

Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
yarn format:js:fix
git add src/MetaComponents/CalendarResourcePicker.js src/__tests__/CalendarResourcePicker.test.js
git commit -m "Add CalendarResourcePicker core

Bundles a rite select and a filtered calendar select. The rite select is
offered for diocesan filters only, because the Ambrosian rite has no
national tier and a nations-filtered select under it hides itself, and it
is appended first because linkToRiteSelect() reads the mounted element."
```

---

### Task 5: Placeholder and rite-change re-application

The half that three call sites currently hand-write, and the half most likely to be silently dropped.

**Files:**

- Modify: `src/MetaComponents/CalendarResourcePicker.js`
- Test: `src/__tests__/CalendarResourcePicker.test.js` (extend)

**Interfaces:**

- Consumes: Task 4's class.
- Produces: `options.placeholderText`, `onChange(cb) → this`, and the linked rite behaviour.

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/CalendarResourcePicker.test.js`:

```javascript
describe('CalendarResourcePicker placeholder', () => {
    /**
     * @returns {CalendarResourcePicker} A mounted diocesan picker with a placeholder.
     */
    const mountDiocesan = () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
            placeholderText: 'Select calendar ID...',
        });
        picker.appendTo('#mount');
        return picker;
    };

    it('renders the placeholder as a disabled, selected empty option', () => {
        const picker = mountDiocesan();
        const option =
            picker.calendarSelect._domElement.querySelector('option[value=""]');
        expect(option).not.toBeNull();
        expect(option.textContent).toBe('Select calendar ID...');
        expect(option.disabled).toBe(true);
        expect(option.selected).toBe(true);
    });

    // linkToRiteSelect() rebuilds the option list from scratch, which discards the
    // placeholder customization. Three frontend files re-register this by hand.
    it('re-applies the placeholder after a rite change', () => {
        const picker = mountDiocesan();
        picker.riteSelect._domElement.value = 'ambrosian';
        picker.riteSelect._domElement.dispatchEvent(
            new Event('change', { bubbles: true }),
        );

        const option =
            picker.calendarSelect._domElement.querySelector('option[value=""]');
        expect(option).not.toBeNull();
        expect(option.textContent).toBe('Select calendar ID...');
        expect(option.disabled).toBe(true);
    });

    it('rebuilds the calendar options for the selected rite', () => {
        const picker = mountDiocesan();
        const idsBefore = Array.from(
            picker.calendarSelect._domElement.options,
        ).map((o) => o.value);
        expect(idsBefore).toContain('romamo_it');

        picker.riteSelect._domElement.value = 'ambrosian';
        picker.riteSelect._domElement.dispatchEvent(
            new Event('change', { bubbles: true }),
        );

        const idsAfter = Array.from(
            picker.calendarSelect._domElement.options,
        ).map((o) => o.value);
        expect(idsAfter).not.toContain('romamo_it');
        expect(idsAfter).toContain('milano_it');
    });

    it('leaves no placeholder text when none was supplied', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        picker.appendTo('#mount');
        const option =
            picker.calendarSelect._domElement.querySelector('option[value=""]');
        expect(option.disabled).toBe(false);
    });
});

describe('CalendarResourcePicker onChange', () => {
    it('fires with the selected id when the calendar select changes', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        picker.appendTo('#mount');
        const seen = [];
        picker.onChange((value) => seen.push(value));

        picker.calendarSelect._domElement.value = 'IT';
        picker.calendarSelect._domElement.dispatchEvent(
            new Event('change', { bubbles: true }),
        );

        expect(seen).toEqual(['IT']);
    });

    it('is chainable', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        expect(picker.onChange(() => {})).toBe(picker);
    });

    // admin-tests.js:692 listens on the mount, not on the select.
    it('lets change events bubble to the mount', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        picker.appendTo('#mount');
        let bubbled = false;
        document
            .getElementById('mount')
            .addEventListener('change', () => (bubbled = true));

        picker.calendarSelect._domElement.dispatchEvent(
            new Event('change', { bubbles: true }),
        );
        expect(bubbled).toBe(true);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/CalendarResourcePicker.test.js`

Expected: FAIL — the placeholder option is not disabled; `picker.onChange is not a function`.

- [ ] **Step 3: Implement**

In `src/MetaComponents/CalendarResourcePicker.js`, add a private field beside the others:

```javascript
    /** @type {string|null} */
    #placeholderText = null;
```

In the constructor, destructure `placeholderText` alongside the rest and store it, immediately after the `assertTheme` call:

```javascript
        if (typeof placeholderText === 'string' && '' !== placeholderText) {
            this.#placeholderText = placeholderText;
        }
```

Add these two methods, and call them from `appendTo()`:

```javascript
    /**
     * Turns the calendar select's empty option into a disabled placeholder.
     *
     * `allowNull` adds an empty option whose meaning is "no nation or diocese",
     * i.e. the General Roman Calendar — which is never a valid national or diocesan
     * resource id. Disabling it forces a concrete choice while keeping the select
     * unselected until the user makes one.
     *
     * Idempotent, and re-run after every rite change: `linkToRiteSelect()` rebuilds
     * the option list from scratch and discards this customization.
     *
     * @returns {void}
     */
    #applyPlaceholder() {
        if (null === this.#placeholderText) {
            return;
        }
        const option =
            this.#calendarSelect._domElement.querySelector('option[value=""]');
        if (null === option) {
            return;
        }
        option.textContent = this.#placeholderText;
        option.disabled = true;
        option.selected = true;
    }

    /**
     * Registers a callback for changes to the selected calendar.
     *
     * Chainable, unlike `appendTo()`.
     *
     * @param {function(string): void} callback - Receives the selected calendar id.
     * @returns {CalendarResourcePicker} This instance.
     */
    onChange(callback) {
        this.#calendarSelect._domElement.addEventListener('change', () =>
            callback(this.value),
        );
        return this;
    }
```

Replace the body of `appendTo()` after the two child appends with:

```javascript
        // Linked only AFTER both children are in the DOM: linkToRiteSelect() reads
        // the rite select's element to attach its change listener.
        if (null !== this.#riteSelect) {
            this.#calendarSelect.linkToRiteSelect(this.#riteSelect);
            this.#riteChangeListener = () => this.#applyPlaceholder();
            this.#riteSelect._domElement.addEventListener(
                'change',
                this.#riteChangeListener,
            );
        }
        this.#applyPlaceholder();
```

Add the listener field beside the others so Task 7 can remove it:

```javascript
    /** @type {function|null} */
    #riteChangeListener = null;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test src/__tests__/CalendarResourcePicker.test.js`

Expected: PASS, 18 tests.

- [ ] **Step 5: Commit**

```bash
yarn format:js:fix
git add src/MetaComponents/CalendarResourcePicker.js src/__tests__/CalendarResourcePicker.test.js
git commit -m "Re-apply the picker's placeholder after every rite change

linkToRiteSelect() rebuilds the calendar options from scratch and discards
the disabled-empty-option customization, so three frontend files re-register
this listener by hand. Owning it here is the point of the meta-component."
```

---

### Task 6: `mountInto()`, the failure control, and `AbortSignal`

**Files:**

- Modify: `src/MetaComponents/CalendarResourcePicker.js`
- Test: `src/__tests__/CalendarResourcePickerMount.test.js`

**Interfaces:**

- Consumes: Tasks 4 and 5.
- Produces: `static CalendarResourcePicker.mountInto(target, options) → Promise<CalendarResourcePicker>`, and `options.errorText`, `options.signal`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/CalendarResourcePickerMount.test.js`:

```javascript
/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import CalendarResourcePicker from '../MetaComponents/CalendarResourcePicker.js';
import { CalendarSelectFilter } from '../Enums.js';

const METADATA = {
    locales: ['en', 'it'],
    national_calendars: [{ calendar_id: 'IT', locales: ['it-IT'], settings: {} }],
    diocesan_calendars: [
        {
            calendar_id: 'romamo_it',
            nation: 'IT',
            diocese: 'Diocesi di Roma',
            locales: ['it-IT'],
            rite: 'roman',
        },
    ],
    ambrosian_calendars: [],
};

const API_URL = 'http://localhost:8000';

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, METADATA);
    document.body.innerHTML = '<div id="mount"></div>';
});

describe('CalendarResourcePicker.mountInto', () => {
    it('resolves to a mounted picker', async () => {
        const picker = await CalendarResourcePicker.mountInto('#mount', {
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        expect(picker).toBeInstanceOf(CalendarResourcePicker);
        expect(picker.failed).toBe(false);
        expect(document.querySelector('#mount select')).not.toBeNull();
    });

    it('empties the target before mounting, so a remount does not stack', async () => {
        document.getElementById('mount').innerHTML = '<span>stale</span>';
        await CalendarResourcePicker.mountInto('#mount', {
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        expect(document.querySelector('#mount span')).toBeNull();
    });

    // Programmer error rejects; runtime failure does not.
    it('rejects on an invalid filter', async () => {
        await expect(
            CalendarResourcePicker.mountInto('#mount', {
                locale: 'en',
                filter: CalendarSelectFilter.NONE,
            }),
        ).rejects.toThrow(/filter/);
    });

    it('rejects when the target matches nothing', async () => {
        await expect(
            CalendarResourcePicker.mountInto('#nope', {
                locale: 'en',
                filter: CalendarSelectFilter.NATIONAL_CALENDARS,
            }),
        ).rejects.toThrow(/nope/);
    });

    it('renders a visible failure control on a runtime failure', async () => {
        // An unloaded base is a runtime failure, not a programmer error: it is what
        // a down API looks like from here.
        ApiBase.reset();
        const errorSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        const picker = await CalendarResourcePicker.mountInto('#mount', {
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
            errorText: 'Could not load calendars',
            theme: { select: 'form-select perm-object-id' },
        });

        expect(picker.failed).toBe(true);
        const control = document.querySelector('#mount select');
        expect(control).not.toBeNull();
        expect(control.disabled).toBe(true);
        expect(control.classList.contains('is-invalid')).toBe(true);
        // The theme's marker classes survive, so form validation and E2E selectors
        // still find the control.
        expect(control.classList.contains('perm-object-id')).toBe(true);
        expect(control.dataset.loadFailed).toBe('true');
        expect(control.textContent).toContain('Could not load calendars');
        expect(errorSpy).toHaveBeenCalled();
        errorSpy.mockRestore();
    });

    it('does not mount when the signal is already aborted', async () => {
        const controller = new AbortController();
        controller.abort();
        const picker = await CalendarResourcePicker.mountInto('#mount', {
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
            signal: controller.signal,
        });
        expect(picker).toBeNull();
        expect(document.querySelector('#mount select')).toBeNull();
    });

    it('does not mount when the target has left the DOM', async () => {
        const detached = document.createElement('div');
        const picker = await CalendarResourcePicker.mountInto(detached, {
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        expect(picker).toBeNull();
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/CalendarResourcePickerMount.test.js`

Expected: FAIL — `CalendarResourcePicker.mountInto is not a function`.

- [ ] **Step 3: Implement**

Add to `src/MetaComponents/CalendarResourcePicker.js`.

The options are validated **before** the `try` block, so anything thrown inside it is a runtime
failure by construction and no heuristic is needed to tell the two apart. The failed instance is a
real instance built through the normal constructor with a private `_failed` flag, not an
`Object.create` stand-in — a stand-in bypasses the private field initialisers, so `picker.failed`
would throw.

First, a private static that renders the stand-in control:

```javascript
    /**
     * Renders the stand-in control shown when the picker cannot be built.
     *
     * It deliberately keeps the theme's classes, so the control the rest of the
     * form — and the E2E suite — waits for does appear. It is disabled and carries
     * no selectable value, so submit validation still blocks, but the failure now
     * reads as "this broke" rather than as an element that never arrived.
     *
     * @param {HTMLElement} element - The mount.
     * @param {Object|undefined} theme - The theme bag.
     * @param {string} [errorText] - The message to show.
     * @returns {void}
     */
    static #renderFailure(element, theme, errorText) {
        const { class: themedClass } = resolveChildTheme(
            theme,
            'calendarSelect',
        );
        const select = document.createElement('select');
        select.className = `${themedClass ?? ''} is-invalid`.trim();
        select.disabled = true;
        select.required = true;
        select.dataset.loadFailed = 'true';

        const option = document.createElement('option');
        option.value = '';
        option.selected = true;
        option.textContent =
            errorText ?? 'Could not load calendars — try reloading the page';
        select.appendChild(option);

        element.replaceChildren(select);
    }
```

Then the factory itself:

```javascript
    /**
     * Builds a picker and mounts it, handling the two things every real call site
     * needs and none of them should re-derive: the failure control, and cancellation.
     *
     * Programmer error and runtime failure are answered differently, on purpose:
     *
     * - Invalid options, or a target that matches nothing, REJECT. Absent and
     *   invalid are different things, and a typo should not be papered over.
     * - A runtime failure — the API down, metadata unparseable — RESOLVES with a
     *   picker whose `failed` is true and whose failure control is in the DOM.
     *   These mount into forms where an empty container is indistinguishable from
     *   "still loading"; the only symptom is a Playwright `waitFor` timing out ten
     *   seconds later with nothing to point at.
     *
     * Resolves to `null` when the mount was cancelled, either by an aborted signal
     * or because the target left the DOM while the client was resolving. The three
     * known call sites all guard against a scope change landing mid-await, each
     * differently; a standard `AbortSignal` covers all three.
     *
     * @param {string|HTMLElement} target - Where to mount.
     * @param {Object} [options] - As the constructor, plus those below.
     * @param {string} [options.errorText] - Text for the failure control.
     * @param {AbortSignal} [options.signal] - Cancels the mount.
     * @returns {Promise<CalendarResourcePicker|null>} The picker, or `null` if cancelled.
     * @throws {Error} If the options or the target are invalid.
     */
    static async mountInto(target, options = {}) {
        const bag = normalizeComponentOptions(
            options,
            'CalendarResourcePicker',
        );
        const { errorText, signal, theme, filter } = bag;

        // Validated up front, ahead of the try below, so that every throw inside it
        // is a runtime failure by construction.
        if (false === ACCEPTED_FILTERS.includes(filter)) {
            throw new Error(
                `CalendarResourcePicker: the filter option must be CalendarSelectFilter.NATIONAL_CALENDARS or CalendarSelectFilter.DIOCESAN_CALENDARS, but found: ${String(filter)}`,
            );
        }
        assertTheme(theme, 'CalendarResourcePicker');

        const element = CalendarResourcePicker.#requireElement(
            target,
            'mountInto',
        );

        if (true === signal?.aborted || false === element.isConnected) {
            return null;
        }

        try {
            const picker = new CalendarResourcePicker(bag);
            // Re-checked after construction: the scope may have changed while the
            // base was being read.
            if (true === signal?.aborted || false === element.isConnected) {
                return null;
            }
            element.replaceChildren();
            picker.appendTo(element);
            return picker;
        } catch (error) {
            console.error(
                'CalendarResourcePicker: could not build the calendar select:',
                error,
            );
            CalendarResourcePicker.#renderFailure(element, theme, errorText);
            return new CalendarResourcePicker({ filter, theme, _failed: true });
        }
    }
```

The failed instance has to be constructible without a working base, so add an early return to the constructor immediately after the `assertTheme` call:

```javascript
        // Set only by `mountInto()`, and only when the real construction already
        // threw. The instance exists to answer `failed` and `value`; it builds no
        // children, because building them is exactly what just failed.
        if (true === options._failed) {
            this.#failed = true;
            return;
        }
```

and make `value` tolerate the absent child:

```javascript
    /**
     * The selected calendar id, or the empty string when the placeholder is
     * selected or the picker failed to build.
     *
     * @returns {string} The selected calendar id.
     */
    get value() {
        return this.#calendarSelect?._domElement.value ?? '';
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test src/__tests__/CalendarResourcePickerMount.test.js`

Expected: PASS, 7 tests.

- [ ] **Step 5: Run the whole picker suite**

Run: `yarn test src/__tests__/CalendarResourcePicker`

Expected: both picker files pass, 25 tests.

- [ ] **Step 6: Commit**

```bash
yarn format:js:fix
git add src/MetaComponents/CalendarResourcePicker.js src/__tests__/CalendarResourcePickerMount.test.js
git commit -m "Add CalendarResourcePicker.mountInto with a visible failure control

Programmer error rejects; a runtime failure resolves with a disabled,
is-invalid control carrying the theme's marker classes. An empty mount is
indistinguishable from still-loading, and its only symptom is an E2E
waitFor timing out with nothing to point at. Cancellation is a standard
AbortSignal, plus a self-check for a mount that left the DOM."
```

---

### Task 7: `dispose()`, export, docs and story

**Files:**

- Modify: `src/MetaComponents/CalendarResourcePicker.js`, `src/index.js`
- Create: `src/stories/1_CombinedComponents/CalendarResourcePicker.stories.js`, `docs/meta-components.md`
- Test: `src/__tests__/CalendarResourcePickerMount.test.js` (extend)

**Interfaces:**

- Consumes: Tasks 4-6.
- Produces: `dispose() → void`; `CalendarResourcePicker` exported from `src/index.js`.

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/CalendarResourcePickerMount.test.js`:

```javascript
describe('CalendarResourcePicker.dispose', () => {
    it('empties the mount', async () => {
        const picker = await CalendarResourcePicker.mountInto('#mount', {
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        picker.dispose();
        expect(document.getElementById('mount').children.length).toBe(0);
    });

    it('stops onChange callbacks from firing', async () => {
        const picker = await CalendarResourcePicker.mountInto('#mount', {
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        let fired = false;
        picker.onChange(() => (fired = true));
        const element = picker.calendarSelect._domElement;
        picker.dispose();

        element.dispatchEvent(new Event('change', { bubbles: true }));
        expect(fired).toBe(false);
    });

    it('is idempotent', async () => {
        const picker = await CalendarResourcePicker.mountInto('#mount', {
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        picker.dispose();
        expect(() => picker.dispose()).not.toThrow();
    });

    it('throws on use after dispose rather than failing quietly', async () => {
        const picker = await CalendarResourcePicker.mountInto('#mount', {
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        picker.dispose();
        expect(() => picker.appendTo('#mount')).toThrow(/disposed/);
        expect(() => picker.onChange(() => {})).toThrow(/disposed/);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/CalendarResourcePickerMount.test.js`

Expected: FAIL — `picker.dispose is not a function`.

- [ ] **Step 3: Implement `dispose()`**

Add these fields and methods to `src/MetaComponents/CalendarResourcePicker.js`:

```javascript
    /** @type {boolean} */
    #disposed = false;

    /** @type {Array<{target: EventTarget, type: string, listener: function}>} */
    #listeners = [];
```

Record every listener as it is attached. In `onChange()`:

```javascript
    onChange(callback) {
        this.#assertUsable();
        const listener = () => callback(this.value);
        this.#calendarSelect._domElement.addEventListener('change', listener);
        this.#listeners.push({
            target: this.#calendarSelect._domElement,
            type: 'change',
            listener,
        });
        return this;
    }
```

and in `appendTo()`, where the rite listener is attached:

```javascript
            this.#riteSelect._domElement.addEventListener(
                'change',
                this.#riteChangeListener,
            );
            this.#listeners.push({
                target: this.#riteSelect._domElement,
                type: 'change',
                listener: this.#riteChangeListener,
            });
```

Then add:

```javascript
    /**
     * Guards every method that a disposed picker cannot honour.
     *
     * A disposed component that quietly does nothing is worse than one that
     * throws: the caller's next assertion fails somewhere unrelated.
     *
     * @returns {void}
     * @throws {Error} If this picker has been disposed.
     */
    #assertUsable() {
        if (true === this.#disposed) {
            throw new Error(
                'CalendarResourcePicker: this picker has been disposed and can no longer be used.',
            );
        }
    }

    /**
     * Releases this picker's listeners and empties its mount.
     *
     * Needed because all three known call sites rebuild their picker whenever the
     * selected scope changes. Idempotent; further use throws.
     *
     * @returns {void}
     */
    dispose() {
        if (true === this.#disposed) {
            return;
        }
        for (const { target, type, listener } of this.#listeners) {
            target.removeEventListener(type, listener);
        }
        this.#listeners = [];
        this.#mount?.replaceChildren();
        this.#mount = null;
        this.#disposed = true;
    }
```

Add `this.#assertUsable();` as the first line of `appendTo()`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test src/__tests__/CalendarResourcePicker`

Expected: PASS, 29 tests.

- [ ] **Step 5: Export it**

In `src/index.js`, add the import beside the others and the name to the export list:

```javascript
import CalendarResourcePicker from './MetaComponents/CalendarResourcePicker.js';
```

```javascript
    CalendarResourcePicker,
```

- [ ] **Step 6: Add the Storybook story**

Create `src/stories/1_CombinedComponents/CalendarResourcePicker.stories.js`. Follow the structure of
the existing `CalendarSelectApiOptions.stories.js` in the same directory for the meta and decorator
conventions, and give it exactly two stories from one render function — this is what replaces the
duplicate-story pattern in `0_Components/`:

```javascript
/**
 * Two stories, one render function, two theme bags. The Bootstrap and unstyled
 * variants differ ONLY by the `theme` argument, which is the claim the theme bag
 * exists to make: nothing framework-specific is baked into the component.
 */
const render = (args) => {
    const mount = document.createElement('div');
    CalendarResourcePicker.mountInto(mount, {
        locale: 'en',
        filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
        placeholderText: 'Select calendar ID...',
        theme: args.theme,
    });
    return mount;
};

export const Bootstrap = {
    render,
    args: {
        theme: {
            select: 'form-select',
            label: 'form-label',
            riteSelect: { class: 'form-select mb-2' },
        },
    },
};

export const Unstyled = { render, args: { theme: undefined } };
```

- [ ] **Step 7: Start the docs page**

Create `docs/meta-components.md` documenting `CalendarResourcePicker`: what it bundles, the full
options table (`locale`, `filter`, `theme`, `placeholderText`, `errorText`, `signal`, `apiClient`),
the theme bag's role vocabulary, the public getters, `mountInto()` versus the constructor, the
reject-versus-resolve rule, and `dispose()`. Include the worked Bootstrap example from the design
spec.

- [ ] **Step 8: Verify the docs and the whole suite**

Run: `yarn format:md:fix && yarn lint:md && yarn test`

Expected: markdown clean, whole suite passing.

- [ ] **Step 9: Commit**

```bash
yarn format:js:fix
git add src/MetaComponents/CalendarResourcePicker.js src/index.js src/__tests__/CalendarResourcePickerMount.test.js src/stories/1_CombinedComponents/CalendarResourcePicker.stories.js docs/meta-components.md
git commit -m "Add CalendarResourcePicker.dispose, export and document it

All three known call sites rebuild the picker on every scope change, so it
is the first thing in this library that needed teardown. The story renders
Bootstrap and unstyled variants from one render function, differing only by
the theme bag, which is the claim the bag exists to make."
```

---

### Task 8: `DayViewer` core

Slots, children, theme and `showTitle`. No client wiring yet.

**Files:**

- Create: `src/MetaComponents/DayViewer.js`
- Test: `src/__tests__/DayViewer.test.js`

**Interfaces:**

- Consumes: Task 3's `Theme.js`; `CalendarSelect`, `RiteSelect`, `ApiOptions`, `LiturgyOfAnyDay`.
- Produces: `new DayViewer(options)`, getters `calendarSelect`, `riteSelect`, `localeInput`, `liturgy`, and `appendTo(target) → undefined`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/DayViewer.test.js`:

```javascript
/** @jest-environment jsdom */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import DayViewer from '../MetaComponents/DayViewer.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

const SLOTS = `
    <div id="rite"></div>
    <div id="calendar"></div>
    <div id="locale"></div>
    <div id="liturgy"></div>
    <div id="single"></div>
`;

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.innerHTML = SLOTS;
});

describe('DayViewer construction', () => {
    it('builds all four children', () => {
        const viewer = new DayViewer({ locale: 'en' });
        expect(viewer.calendarSelect).not.toBeNull();
        expect(viewer.riteSelect).not.toBeNull();
        expect(viewer.localeInput).not.toBeNull();
        expect(viewer.liturgy).not.toBeNull();
    });

    it('rejects an unparseable locale rather than falling back to English', () => {
        expect(() => new DayViewer({ locale: 'not a locale' })).toThrow(
            /DayViewer/,
        );
    });

    it('rejects a malformed theme, naming the component', () => {
        expect(() => new DayViewer({ locale: 'en', theme: 'form-select' })).toThrow(
            /DayViewer.*theme/,
        );
    });
});

describe('DayViewer slot mounting', () => {
    it('mounts each child into its named slot', () => {
        const viewer = new DayViewer({ locale: 'en' });
        viewer.appendTo({
            rite: '#rite',
            calendar: '#calendar',
            locale: '#locale',
            liturgy: '#liturgy',
        });
        expect(document.querySelector('#rite select')).not.toBeNull();
        expect(document.querySelector('#calendar select')).not.toBeNull();
        expect(document.querySelector('#locale select')).not.toBeNull();
        expect(document.querySelector('#liturgy').children.length).toBeGreaterThan(0);
    });

    it('mounts everything into one container when given a single target', () => {
        const viewer = new DayViewer({ locale: 'en' });
        viewer.appendTo('#single');
        expect(
            document.querySelectorAll('#single select').length,
        ).toBeGreaterThanOrEqual(3);
    });

    it('omits a child whose slot is not named', () => {
        const viewer = new DayViewer({ locale: 'en' });
        viewer.appendTo({ calendar: '#calendar', liturgy: '#liturgy' });
        expect(document.querySelector('#rite select')).toBeNull();
        expect(document.querySelector('#calendar select')).not.toBeNull();
    });

    it('returns undefined from appendTo, per library convention', () => {
        const viewer = new DayViewer({ locale: 'en' });
        expect(viewer.appendTo('#single')).toBeUndefined();
    });

    it('throws when a named slot matches nothing', () => {
        const viewer = new DayViewer({ locale: 'en' });
        expect(() => viewer.appendTo({ calendar: '#nope' })).toThrow(/nope/);
    });

    // The rite select must be in the DOM before it is linked, so it is mounted first.
    it('mounts the rite select before linking it', () => {
        const viewer = new DayViewer({ locale: 'en' });
        viewer.appendTo({ rite: '#rite', calendar: '#calendar' });
        expect(viewer.riteSelect._domElement.isConnected).toBe(true);
    });
});

describe('DayViewer title', () => {
    it('shows the title by default', () => {
        const viewer = new DayViewer({ locale: 'en' });
        viewer.appendTo('#single');
        expect(viewer.liturgy._titleElement.style.display).not.toBe('none');
    });

    it('hides the title when showTitle is false', () => {
        const viewer = new DayViewer({ locale: 'en', showTitle: false });
        viewer.appendTo('#single');
        expect(viewer.liturgy._titleElement.style.display).toBe('none');
    });
});

describe('DayViewer default selection', () => {
    // Selecting Vatican would silently force Latin. The General Roman Calendar is
    // the universal calendar and is available in every supported locale.
    it('selects the General Roman Calendar rather than Vatican', () => {
        const viewer = new DayViewer({ locale: 'en' });
        viewer.appendTo('#single');
        expect(viewer.calendarSelect._domElement.value).toBe('');
    });
});

describe('DayViewer labels', () => {
    it('labels the date controls from the message catalogue', () => {
        const viewer = new DayViewer({ locale: 'it' });
        viewer.appendTo('#single');
        const text = document.getElementById('single').textContent;
        expect(text).toContain('Giorno');
        expect(text).toContain('Anno');
    });

    it('falls back to English for an untranslated locale', () => {
        const viewer = new DayViewer({ locale: 'zh' });
        viewer.appendTo('#single');
        const text = document.getElementById('single').textContent;
        expect(text).toContain('Day');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/DayViewer.test.js`

Expected: FAIL — cannot resolve `../MetaComponents/DayViewer.js`.

- [ ] **Step 3: Implement the core**

Create `src/MetaComponents/DayViewer.js`:

```javascript
/**
 * A complete "liturgy of any day" page: a rite select, a calendar select, a locale
 * input and the `LiturgyOfAnyDay` widget, wired to one another and to an `ApiClient`.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import LiturgyOfAnyDay from '../LiturgyOfAnyDay/LiturgyOfAnyDay.js';
import Messages from '../Messages.js';
import { ApiOptionsFilter } from '../Enums.js';
import { normalizeComponentOptions } from '../OptionsValidation.js';
import { canonicalizeLocale } from '../LocaleValidation.js';
import { assertTheme, resolveChildTheme } from './Theme.js';

/** The slots a caller may name, in mount order. @type {Readonly<string[]>} */
const SLOT_NAMES = Object.freeze(['rite', 'calendar', 'locale', 'liturgy']);

export default class DayViewer {
    /** @type {string} */
    #locale = 'en';

    /** @type {string} */
    #language = 'en';

    /** @type {CalendarSelect} */
    #calendarSelect;

    /** @type {RiteSelect} */
    #riteSelect;

    /** @type {ApiOptions} */
    #apiOptions;

    /** @type {LiturgyOfAnyDay} */
    #liturgy;

    /** @type {string} */
    #selectedLocale = '';

    /** @type {HTMLElement[]} */
    #mounts = [];

    /**
     * @param {Object|string|Intl.Locale} [options] - Options bag, or a locale.
     * @param {string|Intl.Locale} [options.locale] - The display locale.
     * @param {Object} [options.theme] - The theme bag; see `Theme.js`.
     * @param {boolean} [options.showTitle=true] - Whether to show the widget's own heading.
     * @param {Object} [options.apiClient] - Binds this viewer to that client's API base.
     */
    constructor(options) {
        options = normalizeComponentOptions(options, 'DayViewer');
        const { locale, theme, showTitle, apiClient } = options;

        if (locale !== undefined && locale !== null) {
            this.#locale = canonicalizeLocale(locale, 'DayViewer');
        }
        this.#language = new Intl.Locale(this.#locale).language;
        assertTheme(theme, 'DayViewer');

        // No `text` on the rite label: omitting it lets RiteSelect supply its own
        // localized label rather than forcing a hardcoded English one.
        const riteTheme = resolveChildTheme(theme, 'riteSelect');
        this.#riteSelect = new RiteSelect({ locale: this.#locale });
        if (Object.hasOwn(riteTheme, 'class')) {
            this.#riteSelect.class(riteTheme.class);
        }
        if (Object.hasOwn(riteTheme, 'labelClass')) {
            this.#riteSelect.label({ class: riteTheme.labelClass });
        }

        const calendarTheme = resolveChildTheme(theme, 'calendarSelect');
        this.#calendarSelect = new CalendarSelect({
            locale: this.#locale,
            apiClient,
            allowNull: true,
        });
        if (Object.hasOwn(calendarTheme, 'class')) {
            this.#calendarSelect.class(calendarTheme.class);
        }
        if (Object.hasOwn(calendarTheme, 'labelClass')) {
            this.#calendarSelect.label({
                class: calendarTheme.labelClass,
                text: this.#message('SELECT_A_CALENDAR'),
            });
        }
        if (Object.hasOwn(calendarTheme, 'wrapperClass')) {
            this.#calendarSelect.wrapper({ class: calendarTheme.wrapperClass });
        }

        this.#apiOptions = new ApiOptions({
            locale: this.#locale,
            apiClient,
        }).filter(ApiOptionsFilter.LOCALE_ONLY);
        const localeTheme = resolveChildTheme(theme, 'localeInput');
        if (Object.hasOwn(localeTheme, 'class')) {
            this.#apiOptions._localeInput.class(localeTheme.class);
        }
        if (Object.hasOwn(localeTheme, 'labelClass')) {
            this.#apiOptions._localeInput.labelClass(localeTheme.labelClass);
        }
        this.#apiOptions._localeInput._labelElement.textContent =
            this.#message('LANGUAGE');
        this.#apiOptions._localeInput.defaultValue(this.#language);

        this.#liturgy = new LiturgyOfAnyDay({ locale: this.#locale });
        const liturgyTheme = resolveChildTheme(theme, 'liturgy');
        if (Object.hasOwn(liturgyTheme, 'class')) {
            this.#liturgy.class(liturgyTheme.class);
        }
        for (const key of [
            'titleClass',
            'dateClass',
            'dateControlsClass',
            'eventsWrapperClass',
            'eventClass',
            'eventGradeClass',
            'eventCommonClass',
            'eventYearCycleClass',
        ]) {
            if (Object.hasOwn(liturgyTheme, key)) {
                this.#liturgy[key](liturgyTheme[key]);
            }
        }

        // The three date controls share one theme entry and differ only by label,
        // because a consumer styling them differently from one another is a case
        // nobody has needed; `liturgy` getter access covers it if that changes.
        const controls = resolveChildTheme(theme, 'dateControls', 'input');
        this.#liturgy
            .dayInputConfig({ ...controls, labelText: this.#message('DAY') })
            .monthInputConfig({
                ...controls,
                labelText: this.#message('MONTH'),
            })
            .yearInputConfig({ ...controls, labelText: this.#message('YEAR') })
            .buildDateControls();

        if (false === showTitle) {
            this.#liturgy._titleElement.style.display = 'none';
        }
    }

    /**
     * Reads a message key for this viewer's language, falling back to English.
     *
     * The fallback is per-KEY, not per-locale: `DAY`, `YEAR` and `LANGUAGE` are
     * translated for the same 12 locales that carry `SELECT_A_RITE`, while `MONTH`
     * and `SELECT_A_CALENDAR` are translated for all 84 — so a single locale can
     * legitimately hit the fallback for one key and not another.
     *
     * @param {string} key - The message key.
     * @returns {string} The translated string, or the English one.
     */
    #message(key) {
        return Messages[this.#language]?.[key] ?? Messages['en'][key];
    }

    /**
     * Chooses the locale to request, from those the selected calendar supports.
     *
     * Exact match, then language-prefix match, then the first available option,
     * then the configured locale. Written once here because every consumer wrote it
     * out by hand, and because the order is not self-evident: a page asking for
     * `it-CH` should get Italian rather than English.
     *
     * @returns {string} The locale to request.
     */
    #matchLocale() {
        const options = this.#apiOptions._localeInput.options();
        const exact = options.find((value) => value === this.#locale);
        const language = options.find(
            (value) => value.split(/[-_]/)[0] === this.#language,
        );
        return exact ?? language ?? options[0] ?? this.#locale;
    }

    /** @returns {CalendarSelect} The wired calendar select. */
    get calendarSelect() {
        return this.#calendarSelect;
    }

    /** @returns {RiteSelect} The wired rite select. */
    get riteSelect() {
        return this.#riteSelect;
    }

    /** @returns {Object} The `ApiOptions` locale input. */
    get localeInput() {
        return this.#apiOptions._localeInput;
    }

    /** @returns {LiturgyOfAnyDay} The wired liturgy widget. */
    get liturgy() {
        return this.#liturgy;
    }

    /**
     * Resolves a mount target to an element.
     *
     * @param {string|HTMLElement} target - A CSS selector or an element.
     * @param {string} slot - The slot name, for the message.
     * @returns {HTMLElement} The resolved element.
     * @throws {Error} If the target is neither, or matches nothing.
     */
    static #requireElement(target, slot) {
        if (target instanceof HTMLElement) {
            return target;
        }
        if (typeof target !== 'string' || '' === target) {
            throw new Error(
                `DayViewer.appendTo: the ${slot} target must be a non-empty CSS selector or an HTMLElement.`,
            );
        }
        const element = document.querySelector(target);
        if (null === element) {
            throw new Error(
                `DayViewer.appendTo: Element not found for the ${slot} slot: ${target}`,
            );
        }
        return element;
    }

    /**
     * Mounts the viewer's children.
     *
     * Takes either a slots object naming a target per child, or a single target
     * receiving all of them. The page this was extracted from mounts its parts into
     * four separate containers, which a single target cannot express; a third party
     * embedding the widget wants the single target.
     *
     * An omitted slot means that child is not rendered.
     *
     * Returns `undefined`, matching every other component in this library.
     *
     * @param {string|HTMLElement|Object<string, string|HTMLElement>} target - Slots, or one target.
     * @returns {void}
     */
    appendTo(target) {
        const single =
            typeof target === 'string' || target instanceof HTMLElement;
        const slots = single
            ? Object.fromEntries(SLOT_NAMES.map((name) => [name, target]))
            : target;

        const children = {
            rite: this.#riteSelect,
            calendar: this.#calendarSelect,
            locale: this.#apiOptions,
            liturgy: this.#liturgy,
        };

        for (const name of SLOT_NAMES) {
            if (false === Object.hasOwn(slots, name)) {
                continue;
            }
            const element = DayViewer.#requireElement(slots[name], name);
            this.#mounts.push(element);
            children[name].appendTo(element);
        }

        // Selecting Vatican would silently force Latin. The General Roman Calendar
        // is the universal calendar and is available in every supported locale, so
        // it is the honest default for a page that offers a language picker.
        this.#calendarSelect._domElement.value = '';

        // After the locale input is populated: its options come from the metadata
        // and are not present until it is built.
        this.#selectedLocale = this.#matchLocale();
        this.#apiOptions._localeInput._domElement.value = this.#selectedLocale;
    }
}
```

`#matchLocale()` is implemented here because `appendTo()` calls it, but it is left untested until
Task 9, which adds the `selectedLocale` getter that exposes its result and the cascade tests that
pin its fallback order.

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test src/__tests__/DayViewer.test.js`

Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
yarn format:js:fix
git add src/MetaComponents/DayViewer.js src/__tests__/DayViewer.test.js
git commit -m "Add DayViewer core with slot mounting

The liturgy-of-any-day page mounts its parts into four separate containers,
so appendTo takes either a slots object or a single target. Date-control
labels come from the message catalogue rather than from a translation map
copied into the consumer."
```

---

### Task 9: `DayViewer` wiring and the locale cascade

The regression this whole phase exists to prevent.

**Files:**

- Modify: `src/MetaComponents/DayViewer.js`
- Test: `src/__tests__/DayViewerWiring.test.js`

**Interfaces:**

- Consumes: Task 8, including its untested `#matchLocale()`.
- Produces: `listenTo(apiClient) → this`, `selectedLocale` getter, `#assertUsable()` guard.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/DayViewerWiring.test.js`:

```javascript
/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import DayViewer from '../MetaComponents/DayViewer.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

/**
 * Records every URL requested, answering each with an empty but well-formed
 * calendar payload. The assertions are about which path was requested, never
 * about the response.
 *
 * @returns {string[]} The live list of requested URLs.
 */
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

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.innerHTML = '<div id="single"></div>';
});

describe('DayViewer rite wiring', () => {
    // THE regression this phase exists to prevent. Wire only linkToRiteSelect and
    // the form reads `ambrosian` while every request still goes to /calendar/roman/.
    it('requests the ambrosian path after a rite change', async () => {
        const urls = captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const viewer = new DayViewer({ locale: 'en' });
        viewer.appendTo('#single');
        viewer.listenTo(apiClient);

        viewer.riteSelect._domElement.value = 'ambrosian';
        viewer.riteSelect._domElement.dispatchEvent(
            new Event('change', { bubbles: true }),
        );
        await new Promise((resolve) => setTimeout(resolve, 0));

        const calendarRequests = urls.filter((url) => url.includes('/calendar'));
        expect(calendarRequests.length).toBeGreaterThan(0);
        expect(calendarRequests.at(-1)).toContain('/calendar/ambrosian');
        expect(calendarRequests.at(-1)).not.toContain('/calendar/roman');
    });

    it('rebuilds the calendar options on a rite change', async () => {
        captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const viewer = new DayViewer({ locale: 'en' });
        viewer.appendTo('#single');
        viewer.listenTo(apiClient);

        const before = viewer.calendarSelect._domElement.innerHTML;
        viewer.riteSelect._domElement.value = 'ambrosian';
        viewer.riteSelect._domElement.dispatchEvent(
            new Event('change', { bubbles: true }),
        );
        expect(viewer.calendarSelect._domElement.innerHTML).not.toBe(before);
    });

    it('is chainable', async () => {
        captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const viewer = new DayViewer({ locale: 'en' });
        viewer.appendTo('#single');
        expect(viewer.listenTo(apiClient)).toBe(viewer);
    });
});

describe('DayViewer locale cascade', () => {
    it('prefers an exact locale match', () => {
        const viewer = new DayViewer({ locale: 'en' });
        viewer.appendTo('#single');
        expect(viewer.selectedLocale).toBe('en');
    });

    it('falls back to a language match when there is no exact one', () => {
        const viewer = new DayViewer({ locale: 'it-CH' });
        viewer.appendTo('#single');
        expect(viewer.selectedLocale.split(/[-_]/)[0]).toBe('it');
    });

    it('falls back to the first available option when neither matches', () => {
        const viewer = new DayViewer({ locale: 'ja' });
        viewer.appendTo('#single');
        expect(viewer.localeInput.options()).toContain(viewer.selectedLocale);
    });

    it('selects the cascade result in the locale input', () => {
        const viewer = new DayViewer({ locale: 'en' });
        viewer.appendTo('#single');
        expect(viewer.localeInput._domElement.value).toBe(viewer.selectedLocale);
    });
});
```

If `FULL_METADATA` does not offer an Italian locale, the language-match test cannot pass; check
`src/__fixtures__/metadata.js` first and use a locale the fixture does offer, keeping the
assertion's shape.

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/DayViewerWiring.test.js`

Expected: FAIL — `viewer.listenTo is not a function`.

- [ ] **Step 3: Implement**

Add these fields to `src/MetaComponents/DayViewer.js`, beside the existing ones:

```javascript
    /** @type {boolean} */
    #disposed = false;

    /** @type {ApiClient|null} */
    #apiClient = null;
```

Then add the getter, the guard and `listenTo()`:

```javascript
    /**
     * The locale chosen by the cascade and selected in the locale input.
     *
     * @returns {string} The selected locale.
     */
    get selectedLocale() {
        return this.#selectedLocale;
    }

    /**
     * Guards every method a disposed viewer cannot honour.
     *
     * A disposed component that quietly does nothing is worse than one that
     * throws: the caller's next assertion then fails somewhere unrelated.
     *
     * @returns {void}
     * @throws {Error} If this viewer has been disposed.
     */
    #assertUsable() {
        if (true === this.#disposed) {
            throw new Error(
                'DayViewer: this viewer has been disposed and can no longer be used.',
            );
        }
    }

    /**
     * Wires this viewer's controls to an `ApiClient`.
     *
     * The rite needs BOTH wires, and this is the whole reason the meta-component
     * exists. `linkToRiteSelect()` rebuilds the calendar list and disables the
     * temporal options the rite fixes; only `listenTo()` on the client turns the
     * rite into a path segment. Wire just the first and the failure is silent: the
     * form reads `ambrosian` while every request still goes to `/calendar/roman/`.
     *
     * `linkToRiteSelect()` is called here rather than in the constructor because it
     * reads the rite select's element to attach its change listener, so the select
     * must already be mounted.
     *
     * @param {ApiClient} apiClient - The client to drive.
     * @returns {DayViewer} This instance.
     */
    listenTo(apiClient) {
        this.#assertUsable();
        this.#apiOptions
            .linkToCalendarSelect(this.#calendarSelect)
            .linkToRiteSelect(this.#riteSelect);
        this.#liturgy.listenTo(apiClient);
        apiClient
            .listenTo(this.#calendarSelect)
            .listenTo(this.#riteSelect)
            .listenTo(this.#apiOptions);
        this.#apiClient = apiClient;
        return this;
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test src/__tests__/DayViewerWiring.test.js`

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
yarn format:js:fix
git add src/MetaComponents/DayViewer.js src/__tests__/DayViewerWiring.test.js
git commit -m "Wire DayViewer's rite to both consumers, with a regression test

linkToRiteSelect rebuilds the calendar list; only listenTo on the client
turns the rite into a path segment. Wiring just the first fails silently —
the form reads ambrosian while every request goes to /calendar/roman/ — and
nothing tested it until now. Also absorbs the locale matching cascade."
```

---

### Task 10: `DayViewer.mountInto()`, `onError()`, `dispose()`, export and docs

**Files:**

- Modify: `src/MetaComponents/DayViewer.js`, `src/index.js`, `docs/meta-components.md`
- Create: `src/stories/1_CombinedComponents/DayViewer.stories.js`
- Test: `src/__tests__/DayViewerMount.test.js`

**Interfaces:**

- Consumes: Tasks 8, 9, and `EventEmitter.off()` from Task 1.
- Produces: `static DayViewer.mountInto(target, options) → Promise<DayViewer|null>`, `onError(cb) →
this`, `fetch() → Promise<Object>`, `dispose() → void`; `DayViewer` exported from `src/index.js`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/DayViewerMount.test.js`, reusing the `captureRequests` helper from Task 9 (copy it into this file rather than importing across test files):

```javascript
describe('DayViewer.mountInto', () => {
    it('resolves to a mounted, wired viewer and performs the initial fetch', async () => {
        const urls = captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const viewer = await DayViewer.mountInto('#single', {
            locale: 'en',
            apiClient,
        });
        expect(viewer).toBeInstanceOf(DayViewer);
        expect(urls.some((url) => url.includes('/calendar'))).toBe(true);
    });

    it('rejects an unparseable locale', async () => {
        const apiClient = await ApiClient.init(API_URL);
        await expect(
            DayViewer.mountInto('#single', { locale: 'not a locale', apiClient }),
        ).rejects.toThrow(/DayViewer/);
    });

    it('reports a failed initial fetch through onError rather than console', async () => {
        global.fetch = jest.fn(() => Promise.reject(new Error('network down')));
        const apiClient = await ApiClient.init(API_URL).catch(() => null);
        // The base is already loaded from the fixture, so init succeeded; only the
        // calendar fetch fails.
        const seen = [];
        const viewer = new DayViewer({ locale: 'en' });
        viewer.appendTo('#single');
        viewer.onError((error) => seen.push(error));
        viewer.listenTo(apiClient);
        await viewer.fetch();

        expect(seen.length).toBeGreaterThan(0);
    });
});

describe('DayViewer.dispose', () => {
    it('stops the viewer reacting to further client events', async () => {
        captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const viewer = await DayViewer.mountInto('#single', {
            locale: 'en',
            apiClient,
        });
        const before = apiClient._eventBus._events['calendarFetched'].length;
        viewer.dispose();
        const after = apiClient._eventBus._events['calendarFetched'].length;
        expect(after).toBeLessThan(before);
    });

    it('is idempotent and throws on use after dispose', async () => {
        captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const viewer = await DayViewer.mountInto('#single', {
            locale: 'en',
            apiClient,
        });
        viewer.dispose();
        expect(() => viewer.dispose()).not.toThrow();
        expect(() => viewer.listenTo(apiClient)).toThrow(/disposed/);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/DayViewerMount.test.js`

Expected: FAIL — `DayViewer.mountInto is not a function`.

- [ ] **Step 3: Implement**

Add to `src/MetaComponents/DayViewer.js`. First the field that lets `dispose()` unsubscribe precisely:

```javascript
    /**
     * Every subscription this viewer made on the client's event bus, kept so that
     * `dispose()` can pass the exact same references back to `off()`.
     *
     * @type {Array<{event: string, listener: function}>}
     */
    #subscriptions = [];

    /** @type {Array<function(Error): void>} */
    #errorCallbacks = [];
```

Then the three public methods and teardown:

```javascript
    /**
     * Registers a callback for calendar fetch failures.
     *
     * Subscribing here is what stops the library falling back to `console.error`
     * behind the caller's back: `ApiClient` logs a failure only when nothing is
     * listening for `calendarFetchFailed`.
     *
     * @param {function(Error): void} callback - Receives the ApiClientError.
     * @returns {DayViewer} This instance.
     */
    onError(callback) {
        this.#assertUsable();
        this.#errorCallbacks.push(callback);
        if (null !== this.#apiClient) {
            const listener = (error) => callback(error);
            this.#apiClient._eventBus.on('calendarFetchFailed', listener);
            this.#subscriptions.push({
                event: 'calendarFetchFailed',
                listener,
            });
        }
        return this;
    }

    /**
     * Performs a calendar fetch using the locale chosen by the cascade.
     *
     * The returned promise is the caller's to handle. Rejections also reach any
     * `onError()` callbacks, so a page that registered one does not have to handle
     * the promise as well — but the rejection is never swallowed.
     *
     * @returns {Promise<Object>} The fetched calendar data.
     * @throws {Error} If no client has been wired with `listenTo()`.
     */
    fetch() {
        this.#assertUsable();
        if (null === this.#apiClient) {
            throw new Error(
                'DayViewer.fetch: no ApiClient is wired. Call listenTo( apiClient ) first, or pass apiClient to mountInto().',
            );
        }
        return this.#apiClient.fetchCalendar(this.#selectedLocale);
    }

    /**
     * Releases this viewer's listeners and subscriptions and empties its mounts.
     *
     * The `off()` calls are why `EventEmitter.off()` was added in this same phase:
     * without it a disposed viewer's subscriptions would keep firing against a
     * detached tree, and teardown could only ever be partial.
     *
     * Idempotent; further use throws.
     *
     * @returns {void}
     */
    dispose() {
        if (true === this.#disposed) {
            return;
        }
        if (null !== this.#apiClient) {
            for (const { event, listener } of this.#subscriptions) {
                this.#apiClient._eventBus.off(event, listener);
            }
        }
        this.#subscriptions = [];
        this.#errorCallbacks = [];
        for (const mount of this.#mounts) {
            mount.replaceChildren();
        }
        this.#mounts = [];
        this.#apiClient = null;
        this.#disposed = true;
    }

    /**
     * Builds a viewer, mounts it, wires it and performs the initial fetch.
     *
     * Programmer error and runtime failure are answered differently, exactly as in
     * `CalendarResourcePicker.mountInto()`: invalid options or an unusable target
     * REJECT, while a failed calendar fetch reaches `onError()` and leaves a
     * working, mounted form behind — a page whose fetch failed is still a page the
     * user can correct their selection on.
     *
     * Resolves to `null` when a supplied signal aborted or the target left the DOM.
     *
     * @param {string|HTMLElement|Object<string, string|HTMLElement>} target - Slots, or one target.
     * @param {Object} [options] - As the constructor, plus those below.
     * @param {Object} [options.apiClient] - The client to wire; when given, the initial fetch runs.
     * @param {AbortSignal} [options.signal] - Cancels the mount.
     * @param {function(Error): void} [options.onError] - Registered before the initial fetch.
     * @returns {Promise<DayViewer|null>} The viewer, or `null` if cancelled.
     * @throws {Error} If the options or any slot target are invalid.
     */
    static async mountInto(target, options = {}) {
        const bag = normalizeComponentOptions(options, 'DayViewer');
        const { apiClient, signal, onError } = bag;

        // Constructed BEFORE the abort check so that an invalid locale or theme
        // rejects even on an aborted mount: a typo should be reported whether or
        // not the caller changed their mind.
        const viewer = new DayViewer(bag);
        if (true === signal?.aborted) {
            return null;
        }

        viewer.appendTo(target);

        if (apiClient !== undefined && apiClient !== null) {
            viewer.listenTo(apiClient);
            if (typeof onError === 'function') {
                viewer.onError(onError);
            }
            // The rejection is handled here rather than returned, because this
            // factory's promise resolves to the viewer. Callers wanting the fetch
            // result await `viewer.fetch()` themselves.
            viewer.fetch().catch((error) => {
                if (0 === viewer.#errorCallbacks.length) {
                    console.error(
                        `DayViewer: could not load the calendar: ${error.message}`,
                    );
                }
            });
        }

        return viewer;
    }
```

Note that `onError()` only subscribes when a client is already wired, so `listenTo()` must also
replay any callbacks registered before it. Add this to the end of `listenTo()`, before the `return
this`:

```javascript
        for (const callback of this.#errorCallbacks) {
            const listener = (error) => callback(error);
            apiClient._eventBus.on('calendarFetchFailed', listener);
            this.#subscriptions.push({
                event: 'calendarFetchFailed',
                listener,
            });
        }
```

and guard `onError()` against double-subscribing the same callback once `listenTo()` has already
replayed it, by registering the callback only — the subscription loop above owns the wiring:

```javascript
    onError(callback) {
        this.#assertUsable();
        this.#errorCallbacks.push(callback);
        if (null !== this.#apiClient) {
            const listener = (error) => callback(error);
            this.#apiClient._eventBus.on('calendarFetchFailed', listener);
            this.#subscriptions.push({
                event: 'calendarFetchFailed',
                listener,
            });
        }
        return this;
    }
```

The two paths are mutually exclusive — `listenTo()` replays only what was registered before it, and
`onError()` subscribes directly only once a client exists — so no callback is subscribed twice. Add
a test asserting a callback registered before `listenTo()` fires exactly once.

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test src/__tests__/DayViewer`

Expected: all three DayViewer test files pass.

- [ ] **Step 5: Export it**

In `src/index.js`, add the import and the export entry:

```javascript
import DayViewer from './MetaComponents/DayViewer.js';
```

```javascript
    DayViewer,
```

- [ ] **Step 6: Add the story and extend the docs**

Create `src/stories/1_CombinedComponents/DayViewer.stories.js` with `Bootstrap` and `Unstyled` stories from one render function, exactly as Task 7 did for the picker.

Extend `docs/meta-components.md` with a `DayViewer` section: the slots object, the full options
table, the theme keys it understands (`select`, `label`, `input`, `wrapper`, `riteSelect`,
`calendarSelect`, `localeInput`, `liturgy`, `dateControls`), `showTitle`, `selectedLocale`,
`onError()`, `fetch()`, `dispose()`, and the note that the new `DAY`/`YEAR`/`LANGUAGE` keys cover 12
locales with English fallback beyond.

- [ ] **Step 7: Verify**

Run: `yarn format:md:fix && yarn lint:md && yarn test`

Expected: all clean.

- [ ] **Step 8: Commit**

```bash
yarn format:js:fix
git add src/MetaComponents/DayViewer.js src/index.js src/__tests__/DayViewerMount.test.js src/stories/1_CombinedComponents/DayViewer.stories.js docs/meta-components.md
git commit -m "Add DayViewer.mountInto, onError and dispose

dispose() unsubscribes from the client through the EventEmitter.off() added
earlier in this phase; without it teardown could only ever be partial, with
subscriptions still firing against a detached tree."
```

---

### Task 11: Declaration check, docs and release prep

**Files:**

- Modify: `package.json:5`, `README.md`, `CLAUDE.md`
- Verify: `dist/index.d.ts`

- [ ] **Step 1: Compile and check the emitted declarations**

Run: `yarn compile && yarn lint:dts`

Expected: both clean. If `lint:dts` fails, the cause is almost certainly a JSDoc mistake in the new
files — a `@readonly` on a getter, or a type name that does not resolve in the declaration file's
own scope. Fix the JSDoc in `src/`, re-run `yarn compile`, then re-run `yarn lint:dts`. Do not edit
`dist/` by hand.

- [ ] **Step 2: Confirm the ES2022 floor was not raised**

Run: `grep -nE "structuredClone|Array\.prototype\.(with|toSorted|toSpliced)|findLast|hasOwn|at\(" dist/index.js | head -20`

Expected: `Object.hasOwn` and `.at()` are ES2022 and fine. Any `toSorted`, `toSpliced`, `with` or
`structuredClone` is ES2023+ and must be replaced — the README's stated browser support (Chrome/Edge
94+, Firefox 93+, Safari 15.4+) is a contract, and `yarn compile` cannot catch a violation because
`checkJs` is off.

- [ ] **Step 3: Bump the version**

In `package.json`, change `"version": "2.1.0"` to `"version": "2.2.0"`.

- [ ] **Step 4: Document the meta-components in `README.md`**

Add a `Meta-components` section listing `CalendarResourcePicker` and `DayViewer` with one line each,
and a pointer to `docs/meta-components.md`. Add both to the existing component table.

- [ ] **Step 5: Document them in `CLAUDE.md`**

Add a `Meta-components` section covering:

- what they are and why they exist;
- the theme bag's role vocabulary, and that `Theme.js` is internal and not exported;
- the `mountInto()`-versus-constructor split;
- the reject-for-programmer-error, resolve-for-runtime-failure rule;
- `dispose()`, and why `EventEmitter.off()` had to exist for it to be complete.

Add `off()` to the `ApiClient` section.

- [ ] **Step 6: Full verification**

Run: `yarn test && yarn compile && yarn lint:dts && yarn format:js && yarn format:md && yarn lint:md`

Expected: every one clean. `format:js` and `format:md` are the check-only forms — if either reports a file, run the `:fix` variant and re-run.

- [ ] **Step 7: Commit**

```bash
git add package.json README.md CLAUDE.md dist/
git commit -m "Release 2.2.0: meta-components phase 1

Adds CalendarResourcePicker and DayViewer, the theme contract they share,
EventEmitter.off() and three message keys. Purely additive: no existing
component API changes."
```

---

## Follow-up, not in this plan

The frontend migration is deliberately separate, because `LiturgicalCalendarFrontend/examples.php`
pins the CDN version and cannot move until 2.2.0 is published. It updates `admin-permissions.js`,
`permission-requests.js`, `admin-tests.js` and `liturgyOfAnyDay.js`, and deletes the 90-line
translation map. The stale comment at `assets/js/index.js:49-50` — which claims `SELECT_A_RITE` is
translated "for en and it so far", when it is 12 locales — should be corrected in that same pass.

Phase 2 (`CalendarViewer`, `ApiExplorer`, `SubscriptionBuilder`) needs its own spec.
