# `CalendarViewer` mount path and `RiteSelect.wrapper()` — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended)
> or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax
> for tracking.

**Goal:** Give `RiteSelect` a `wrapper()` matching `CalendarSelect`'s, honour the theme bag's `wrapper`
role for rite selects in all three meta-components that theme one, and give `CalendarViewer` the public
`appendTo()`/`listenTo()`/`fetch()`/`onError()`/`onCalendarFetched()` its documentation already promises.

**Architecture:** Three independent layers, built bottom-up. `RiteSelect.wrapper()` is a leaf addition
copied structurally from `CalendarSelect.wrapper()`. The three meta-component constructors then each gain
the same three-line block they already run for their calendar select. Finally `CalendarViewer` grows five
public members, and its existing `mountInto()` is refactored to call them instead of duplicating their
bodies.

**Tech Stack:** ES2022 JavaScript modules, Jest 30 with jsdom, TypeScript 5.7 for declaration emit only (`checkJs` is off), prettier + markdownlint, Yarn 4.6.

## Global Constraints

- **Working directory:** `/home/johnrdorazio/development/LiturgicalCalendar/liturgy-components-js`. Branch
  `feat/calendarviewer-mount-and-rite-wrapper` already exists and holds the design doc.
- **Spec:** `docs/superpowers/specs/2026-08-12-calendarviewer-mount-and-rite-wrapper-design.md`. Read it before starting.
- **ES2022 floor.** `Object.hasOwn()` and `Error`'s `cause` are fine. Nothing newer.
- **Formatting is enforced by CI.** `.prettierrc` sets `tabWidth: 4` and `singleQuote: true`. Run `yarn
format:js:fix` before every commit touching `src/`, and `yarn format:md:fix` before every commit touching
  `*.md`.
- **Never use `git commit --no-verify`.** If a hook fails, fix the cause and commit again.
- **Comparison idiom:** this codebase writes the constant first — `if (false === x)`, `if (null === y)`, `if (true === z)`. Match it.
- **Private fields** use the `#` prefix. Public read-only access is exposed through `_`-prefixed getters (`_domElement`, `_hidden`) — that is the existing convention, not a smell.
- **JSDoc on every public method**, with `@param`, `@returns` and `@throws`. `yarn lint:dts` type-checks
  the emitted declarations; a `@readonly` tag on a getter emits invalid TypeScript, so do not add one.
- **Test environment:** every test file starts with the `/** @jest-environment jsdom */` pragma on line 1.
- **Test isolation:** meta-component tests call `ApiBase.reset()` then `ApiBase.fromMetadata(API_URL, FULL_METADATA)` in `beforeEach`. No network, ever.
- **Full gate before any commit that touches `src/`:** `yarn test && yarn compile && yarn lint:dts`.

---

## File structure

| File                                                      | Responsibility                                                                                                              | Task |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---- |
| `src/__tests__/CalendarSelectWrapper.test.js`             | New — characterizes `CalendarSelect.wrapper()`'s every branch before it is refactored.                                      | 1    |
| `src/WrapperOptions.js`                                   | New — the shared wrapper-bag validator and element builder. Internal; not exported from `index.js`.                         | 2    |
| `src/CalendarSelect/CalendarSelect.js`                    | Rewire `wrapper()` onto the shared helper. No behaviour change.                                                             | 2    |
| `src/RiteSelect/RiteSelect.js`                            | Add `#wrapperElement`, `#hasWrapper`, `#wrapperSet` fields, the `wrapper()` method, and the wrapper branch in `appendTo()`. | 3    |
| `src/__tests__/RiteSelect.test.js`                        | `wrapper()` parity coverage against `CalendarSelect`'s contract.                                                            | 3    |
| `src/MetaComponents/CalendarControls.js`                  | Apply `riteTheme.wrapperClass`.                                                                                             | 4    |
| `src/MetaComponents/DayViewer.js`                         | Apply `riteTheme.wrapperClass`.                                                                                             | 4    |
| `src/MetaComponents/CalendarResourcePicker.js`            | Apply `riteTheme.wrapperClass`.                                                                                             | 4    |
| `src/__tests__/MetaComponentThemeWrapperSymmetry.test.js` | Invert the two rite-select assertions; add `CalendarControls`.                                                              | 4    |
| `src/MetaComponents/CalendarControls.js`                  | Reject unknown slot names in `appendTo()`.                                                                                  | 5    |
| `src/MetaComponents/CalendarViewer.js`                    | Add five public members; refactor `mountInto()` onto them; reject unknown slot names.                                       | 6, 7 |
| `src/__tests__/CalendarViewerMount.test.js`               | New — the constructor path, the `hide()` regression, listener ordering, slot validation, dispose guards.                    | 6, 7 |
| `docs/rite-select.md`                                     | Document `wrapper()`.                                                                                                       | 8    |
| `docs/meta-components.md`                                 | `CalendarViewer` public-members table and `appendTo()` section; drop the "RiteSelect has none" carve-out.                   | 8    |
| `CHANGELOG.md`, `package.json`                            | 2.4.0 entry and version bump.                                                                                               | 8    |

---

### Task 1: Characterize `CalendarSelect.wrapper()`

**Files:**

- Create: `src/__tests__/CalendarSelectWrapper.test.js`

**Interfaces:**

- Consumes: nothing.
- Produces: a behavioural safety net Task 2 must keep green **without editing this file**.

**Why this task exists.** Task 2 refactors `CalendarSelect.wrapper()` — a method used by the meta-components, four
`examples/`, six stories and `CalendarSelect`'s own constructor (`CalendarSelect.js:226`) — onto a shared helper. Its
current direct coverage is a single happy-path case (`ComponentOptionsValidation.test.js:359`); not one validation
branch is pinned. Refactoring it with no net is how a silent behaviour change ships. **Write no source code in this
task.** These tests must pass against `CalendarSelect` exactly as it stands today.

Read `src/CalendarSelect/CalendarSelect.js:1008-1102` and pin what it actually does — including anything that
surprises you. If a test you expect to pass fails, the current behaviour is the specification: change the test to
match it and note the surprise in your report. Do not "fix" `CalendarSelect` in this task.

- [ ] **Step 1: Write the characterization tests**

Create `src/__tests__/CalendarSelectWrapper.test.js`:

```javascript
/** @jest-environment jsdom */
/**
 * Characterization tests for `CalendarSelect.wrapper()`, pinning its behaviour
 * branch by branch BEFORE it is refactored onto the shared `WrapperOptions`
 * helper. Their job is to fail loudly if that refactor changes anything a
 * caller can observe.
 *
 * These assert current behaviour, not desired behaviour. Do not modify this
 * file during the refactor — if one of these fails afterwards, the refactor is
 * wrong, not the test.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.innerHTML = '<div id="mount"></div>';
});

const select = () => new CalendarSelect('en');

describe('CalendarSelect.wrapper() — characterization', () => {
    it('defaults `as` to div and applies the class', () => {
        const cs = select().wrapper({ class: 'col-md-3' });
        cs.appendTo('#mount');
        const wrapper = document.querySelector('#mount > div');
        expect(wrapper).not.toBeNull();
        expect(wrapper.className).toBe('col-md-3');
        expect(cs._domElement.parentElement).toBe(wrapper);
    });

    it('accepts as: td', () => {
        document.body.innerHTML = '<table><tr id="row"></tr></table>';
        const cs = select().wrapper({ as: 'td' });
        cs.appendTo('#row');
        expect(document.querySelector('#row > td')).not.toBeNull();
    });

    it('rejects an `as` outside div and td', () => {
        expect(() => select().wrapper({ as: 'span' })).toThrow(
            'Invalid value for wrapper `as` property, must be one of `div` or `td` but found: span',
        );
    });

    it('rejects a non-string `as`', () => {
        expect(() => select().wrapper({ as: 42 })).toThrow(
            'Invalid type for wrapper `as` property, must be of type string but found type: number',
        );
    });

    it('treats null as no wrapper, and still marks the setting as made', () => {
        const cs = select();
        cs.wrapper(null);
        cs.appendTo('#mount');
        expect(cs._domElement.parentElement).toBe(
            document.getElementById('mount'),
        );
        expect(() => cs.wrapper({ class: 'x' })).toThrow(
            /Wrapper has already been set on CalendarSelect instance/,
        );
    });

    it('rejects an object naming none of as, class or id', () => {
        expect(() => select().wrapper({})).toThrow(
            'Invalid wrapper options, must be an object with at least an `as`, `class` or `id` property',
        );
        expect(() => select().wrapper({ nope: 'x' })).toThrow(
            'Invalid wrapper options, must be an object with at least an `as`, `class` or `id` property',
        );
    });

    it('rejects an array and a string', () => {
        expect(() => select().wrapper([])).toThrow(
            'Invalid type for wrapper options, must be of type object (not null or array) but found type: array',
        );
        expect(() => select().wrapper('div')).toThrow(
            'Invalid type for wrapper options, must be of type object (not null or array) but found type: string',
        );
    });

    it('throws on a second call, naming the locale', () => {
        const cs = select().wrapper({ class: 'a' });
        expect(() => cs.wrapper({ class: 'b' })).toThrow(
            /Wrapper has already been set on CalendarSelect instance with locale en/,
        );
    });

    it('rejects a non-string class and an invalid class name', () => {
        expect(() => select().wrapper({ class: 42 })).toThrow(
            'Invalid type for wrapper class, must be of type string but found type: number',
        );
        expect(() => select().wrapper({ class: 'has<bad>chars' })).toThrow(
            /Invalid class name/,
        );
    });

    it('collapses whitespace between class names', () => {
        const cs = select().wrapper({ class: 'a   b' });
        cs.appendTo('#mount');
        expect(document.querySelector('#mount > div').className).toBe('a b');
    });

    it('rejects a non-string id and an invalid id', () => {
        expect(() => select().wrapper({ id: 42 })).toThrow(
            'Invalid type for wrapper id, must be of type string but found type: number',
        );
        expect(() => select().wrapper({ id: 'has space' })).toThrow(/Invalid id/);
    });

    it('sets the wrapper id', () => {
        const cs = select().wrapper({ id: 'calendarWrapper' });
        cs.appendTo('#mount');
        expect(document.getElementById('calendarWrapper')).not.toBeNull();
    });

    it('returns this', () => {
        const cs = select();
        expect(cs.wrapper({ class: 'x' })).toBe(cs);
    });

    it('places the label inside the wrapper, immediately before the select', () => {
        const cs = select();
        cs.label({ text: 'Calendar' });
        cs.wrapper({ class: 'col-md-3' });
        cs.appendTo('#mount');
        const wrapper = document.querySelector('#mount > div');
        expect(cs._domElement.parentElement).toBe(wrapper);
        expect(cs._domElement.previousElementSibling.tagName).toBe('LABEL');
    });
});
```

- [ ] **Step 2: Run them against unmodified `CalendarSelect`**

Run: `yarn test src/__tests__/CalendarSelectWrapper.test.js`

Expected: **PASS, all cases, with no source change.** Any failure means the test misdescribes current
behaviour — correct the test to match the code and record what surprised you in your report. Do not edit
`src/CalendarSelect/CalendarSelect.js` in this task.

- [ ] **Step 3: Run the full gate and commit**

```bash
yarn format:js:fix && yarn test && yarn compile && yarn lint:dts
git add src/__tests__/CalendarSelectWrapper.test.js
git commit -m "Characterize CalendarSelect.wrapper() ahead of extracting it"
```

---

### Task 2: Extract `WrapperOptions` and rewire `CalendarSelect`

**Files:**

- Create: `src/WrapperOptions.js`
- Modify: `src/CalendarSelect/CalendarSelect.js:1008-1102`
- Test: `src/__tests__/CalendarSelectWrapper.test.js` — **must pass unmodified**

**Interfaces:**

- Consumes: the characterization suite from Task 1.
- Produces: `buildWrapperElement(wrapperOptions, componentName) => HTMLElement|null`, exported from
  `src/WrapperOptions.js`. Task 3's `RiteSelect.wrapper()` calls it with `'RiteSelect'`.

**Scope discipline.** This is a pure refactor: **no observable behaviour may change**, including every error message.
The messages the helper throws are the ones `CalendarSelect` throws today, verbatim — Task 1 pinned them. The
one-shot `#wrapperSet` guard stays in `CalendarSelect`, because its message names the class and the instance's
locale, which is per-component state the helper cannot see.

`src/WrapperOptions.js` is **internal**: do not add it to `src/index.js`, matching `LocaleValidation.js` and
`OptionsValidation.js`, which are contract between components rather than public API.

- [ ] **Step 1: Create the shared helper**

Create `src/WrapperOptions.js`:

```javascript
/**
 * Shared validation and construction for the `{ as, class, id }` wrapper bag
 * that `CalendarSelect.wrapper()` and `RiteSelect.wrapper()` both accept.
 *
 * Internal, and deliberately NOT exported from `src/index.js` — contract
 * between the components, not public API, on the same reasoning as
 * `LocaleValidation.js` and `OptionsValidation.js`.
 *
 * `Input.wrapper()` deliberately does NOT use this: it takes a bare tag name
 * and pairs with a separate `wrapperClass()`. Converging it is tracked in
 * issue #46 and is explicitly out of scope here.
 *
 * The caller keeps its own "already set" guard: that message names the calling
 * class and its instance state, which this module cannot see.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import Utils from './Utils.js';

/**
 * Validates a wrapper bag and builds the element it describes.
 *
 * @param {?{as?: string, class?: string, id?: string}} wrapperOptions The wrapper
 *        configuration, or `null` for no wrapper.
 * @param {string} componentName The calling class' name, for error messages.
 * @returns {HTMLElement|null} The configured element, or `null` when
 *          `wrapperOptions` is `null` (meaning "no wrapper").
 * @throws {Error} If `wrapperOptions` is an array or a non-object, names none of
 *         `as`/`class`/`id`, or carries an invalid `as`, `class` or `id` value.
 */
export function buildWrapperElement(wrapperOptions, componentName) {
    if (null === wrapperOptions) {
        return null;
    }
    if (typeof wrapperOptions !== 'object' || Array.isArray(wrapperOptions)) {
        const wrapperOptionsType = Array.isArray(wrapperOptions)
            ? 'array'
            : typeof wrapperOptions;
        throw new Error(
            'Invalid type for wrapper options, must be of type object (not null or array) but found type: ' +
                wrapperOptionsType,
        );
    }
    if (
        Object.keys(wrapperOptions).length === 0 ||
        false ===
            Object.keys(wrapperOptions).some((key) =>
                ['as', 'class', 'id'].includes(key),
            )
    ) {
        throw new Error(
            'Invalid wrapper options, must be an object with at least an `as`, `class` or `id` property',
        );
    }

    let as = 'div';
    if (Object.hasOwn(wrapperOptions, 'as')) {
        if (typeof wrapperOptions.as !== 'string') {
            throw new Error(
                'Invalid type for wrapper `as` property, must be of type string but found type: ' +
                    typeof wrapperOptions.as,
            );
        }
        if (false === ['div', 'td'].includes(wrapperOptions.as)) {
            throw new Error(
                'Invalid value for wrapper `as` property, must be one of `div` or `td` but found: ' +
                    wrapperOptions.as,
            );
        }
        as = wrapperOptions.as;
    }

    const element = document.createElement(as);

    if (Object.hasOwn(wrapperOptions, 'class')) {
        if (typeof wrapperOptions.class !== 'string') {
            throw new Error(
                'Invalid type for wrapper class, must be of type string but found type: ' +
                    typeof wrapperOptions.class,
            );
        }
        let classNames = wrapperOptions.class.split(/\s+/);
        classNames = classNames.map((className) =>
            Utils.sanitizeInput(className),
        );
        classNames.forEach((className) => {
            if (false === Utils.validateClassName(className)) {
                throw new Error('Invalid class name: ' + className);
            }
        });
        element.className = classNames.join(' ');
    }

    if (Object.hasOwn(wrapperOptions, 'id')) {
        if (typeof wrapperOptions.id !== 'string') {
            throw new Error(
                'Invalid type for wrapper id, must be of type string but found type: ' +
                    typeof wrapperOptions.id,
            );
        }
        const id = Utils.sanitizeInput(wrapperOptions.id);
        if (false === Utils.validateId(id)) {
            throw new Error(
                'Invalid id, cannot contain any kind of whitespace character and must be a valid CSS selector: ' +
                    id,
            );
        }
        element.id = id;
    }

    return element;
}
```

`componentName` is currently unused by any message — every one of them is component-agnostic today, and Task 1
pinned them that way. It is in the signature so a future message can name the caller without changing every call
site. If your linter objects to an unused parameter, keep the parameter and do not "simplify" it away.

- [ ] **Step 2: Rewire `CalendarSelect.wrapper()`**

Add the import near the top of `src/CalendarSelect/CalendarSelect.js`, alongside the existing imports:

```javascript
import { buildWrapperElement } from '../WrapperOptions.js';
```

Replace the whole body of `wrapper()` (`:1008-1102`) with:

```javascript
    wrapper(wrapperOptions = null) {
        if (this.#wrapperSet) {
            throw new Error(
                'Wrapper has already been set on CalendarSelect instance with locale ' +
                    this.#locale +
                    '.',
            );
        }
        const element = buildWrapperElement(wrapperOptions, 'CalendarSelect');
        this.#wrapperElement = element;
        this.#hasWrapper = null !== element;
        this.#wrapperSet = true;
        return this;
    }
```

Leave the method's existing JSDoc block in place above it, unchanged.

**Ordering matters:** the `#wrapperSet` guard runs BEFORE `buildWrapperElement()`, and `#wrapperSet` is assigned
only AFTER it returns — so an invalid bag throws without marking the wrapper as set, exactly as today, where the
validation threw before any of the three assignments.

- [ ] **Step 3: Verify the characterization suite still passes, unmodified**

Run: `yarn test src/__tests__/CalendarSelectWrapper.test.js`

Expected: PASS, **with that file untouched**. If any case fails, the refactor changed observable behaviour — fix
`src/WrapperOptions.js`, never the test.

- [ ] **Step 4: Run the full suite**

Run: `yarn test`

Expected: PASS. `ComponentOptionsValidation.test.js`, `ApiOptionsRite.test.js` and
`ApiOptionsPathBuilderRiteRegression.test.js` all exercise `CalendarSelect.wrapper()` and are the cross-check that
the meta-components and `ApiOptions` still see the old behaviour.

- [ ] **Step 5: Run the full gate and commit**

```bash
yarn format:js:fix && yarn test && yarn compile && yarn lint:dts
git add src/WrapperOptions.js src/CalendarSelect/CalendarSelect.js
git commit -m "Extract the wrapper-bag validator CalendarSelect and RiteSelect share"
```

---

### Task 3: `RiteSelect.wrapper()`

**Files:**

- Modify: `src/RiteSelect/RiteSelect.js` — fields at `:23-29`, new method after `class()` (which ends at `:107`), `appendTo()` at `:307-329`
- Test: `src/__tests__/RiteSelect.test.js`

**Interfaces:**

- Consumes: `buildWrapperElement(wrapperOptions, componentName)` from `src/WrapperOptions.js`, added in
  Task 2.
- Produces: `RiteSelect.prototype.wrapper(wrapperOptions = null) => RiteSelect`, accepting `{ as?:
'div'|'td', class?: string, id?: string }` or `null`. Tasks 4 and 8 depend on this exact name and shape.

**Reference implementation:** `CalendarSelect.wrapper()` **as Task 2 leaves it** — the one-shot guard, the
`buildWrapperElement()` call, three assignments — and `CalendarSelect.js:1319-1324` for the `appendTo()`
branch. Read both before writing.

Do **not** re-implement the bag validation here. It lives in `src/WrapperOptions.js`, which Task 2 created
for exactly these two callers. All `RiteSelect` owns is its own one-shot guard, whose message names this
class and its locale.

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/RiteSelect.test.js`, inside the existing top-level `describe('RiteSelect', …)` block:

```javascript
    describe('wrapper()', () => {
        it('wraps the select in a div by default, with the label inside and before it', () => {
            document.body.innerHTML = '<div id="mount"></div>';
            const rs = new RiteSelect('en');
            rs.label({ text: 'Rite' });
            rs.wrapper({ class: 'form-group col col-md-2' });
            rs.appendTo('#mount');

            const mount = document.getElementById('mount');
            const wrapper = mount.firstElementChild;
            expect(wrapper.tagName).toBe('DIV');
            expect(wrapper.className).toBe('form-group col col-md-2');
            expect(rs._domElement.parentElement).toBe(wrapper);
            expect(rs._domElement.previousElementSibling.tagName).toBe('LABEL');
        });

        it('appends the select directly when no wrapper is set', () => {
            document.body.innerHTML = '<div id="mount"></div>';
            const rs = new RiteSelect('en');
            rs.appendTo('#mount');
            expect(rs._domElement.parentElement).toBe(
                document.getElementById('mount'),
            );
        });

        it('accepts `td` and defaults `as` to `div`', () => {
            const asTd = new RiteSelect('en').wrapper({ as: 'td' });
            const asDefault = new RiteSelect('en').wrapper({ class: 'x' });
            document.body.innerHTML = '<table><tr id="row"></tr></table>';
            asTd.appendTo('#row');
            expect(document.querySelector('#row td')).not.toBeNull();

            document.body.innerHTML = '<div id="mount"></div>';
            asDefault.appendTo('#mount');
            expect(document.querySelector('#mount div')).not.toBeNull();
        });

        it('rejects an `as` value other than div or td', () => {
            expect(() => new RiteSelect('en').wrapper({ as: 'span' })).toThrow(
                /must be one of `div` or `td`/,
            );
        });

        it('rejects a non-string `as`', () => {
            expect(() => new RiteSelect('en').wrapper({ as: 42 })).toThrow(
                /wrapper `as` property/,
            );
        });

        it('treats null as "no wrapper" and still marks the setting as made', () => {
            document.body.innerHTML = '<div id="mount"></div>';
            const rs = new RiteSelect('en');
            rs.wrapper(null);
            rs.appendTo('#mount');
            expect(rs._domElement.parentElement).toBe(
                document.getElementById('mount'),
            );
            expect(() => rs.wrapper({ class: 'x' })).toThrow(
                /already been set/,
            );
        });

        it('rejects an options object naming none of as, class or id', () => {
            expect(() => new RiteSelect('en').wrapper({})).toThrow(
                /at least an `as`, `class` or `id` property/,
            );
        });

        it('rejects an array and a non-object', () => {
            expect(() => new RiteSelect('en').wrapper([])).toThrow(
                /must be of type object/,
            );
            expect(() => new RiteSelect('en').wrapper('div')).toThrow(
                /must be of type object/,
            );
        });

        it('throws on a second call', () => {
            const rs = new RiteSelect('en').wrapper({ class: 'a' });
            expect(() => rs.wrapper({ class: 'b' })).toThrow(
                /already been set/,
            );
        });

        it('rejects an invalid class name and an invalid id', () => {
            expect(() =>
                new RiteSelect('en').wrapper({ class: 'has<bad>chars' }),
            ).toThrow(/Invalid class name/);
            expect(() =>
                new RiteSelect('en').wrapper({ id: 'has space' }),
            ).toThrow(/Invalid id/);
        });

        it('sets the wrapper id', () => {
            document.body.innerHTML = '<div id="mount"></div>';
            const rs = new RiteSelect('en').wrapper({ id: 'riteWrapper' });
            rs.appendTo('#mount');
            expect(document.getElementById('riteWrapper')).not.toBeNull();
        });

        it('is chainable', () => {
            const rs = new RiteSelect('en');
            expect(rs.wrapper({ class: 'x' })).toBe(rs);
        });
    });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn test src/__tests__/RiteSelect.test.js`

Expected: FAIL — `rs.wrapper is not a function`.

- [ ] **Step 3: Add the three private fields**

In `src/RiteSelect/RiteSelect.js`, the field block currently reads:

```javascript
export default class RiteSelect {
    #domElement = null;
    #labelElement = null;
    #hasLabel = false;
    #labelSet = false;
    #locale = 'en';
    #idSet = false;
    #nameSet = false;
```

Add three fields after `#labelSet`:

```javascript
export default class RiteSelect {
    #domElement = null;
    #labelElement = null;
    #hasLabel = false;
    #labelSet = false;
    #wrapperElement = null;
    #hasWrapper = false;
    #wrapperSet = false;
    #locale = 'en';
    #idSet = false;
    #nameSet = false;
```

- [ ] **Step 4: Add the `wrapper()` method**

Insert immediately after the closing brace of `class()` (which ends at `:107`, just before the JSDoc for `id()`):

```javascript
    /**
     * Wraps the select (and its label, when one is set) in a container element.
     *
     * Mirrors `CalendarSelect.wrapper()` exactly, rather than `Input.wrapper()`:
     * a rite select is a select, and `Input`'s split `wrapper()` /
     * `wrapperClass()` shape would give the meta-components' theme bag two
     * different contracts to drive for its two selects. `Input`'s convergence
     * onto this shape is tracked separately in issue #46.
     *
     * One-shot: a second call throws rather than silently replacing a wrapper
     * a previous call already configured.
     *
     * @param {?{as?: string, class?: string, id?: string}} [wrapperOptions=null] The wrapper
     *        configuration, or `null` for no wrapper. `as` is `'div'` or `'td'` and defaults
     *        to `'div'`.
     * @throws {Error} If a wrapper has already been set on this instance.
     * @throws {Error} If `wrapperOptions` is an array or a non-object, names none of
     *         `as`/`class`/`id`, or carries an invalid `as`, `class` or `id` value.
     * @returns {RiteSelect} The current `RiteSelect` instance for chaining.
     */
    wrapper(wrapperOptions = null) {
        if (this.#wrapperSet) {
            throw new Error(
                'Wrapper has already been set on RiteSelect instance with locale ' +
                    this.#locale +
                    '.',
            );
        }
        const element = buildWrapperElement(wrapperOptions, 'RiteSelect');
        this.#wrapperElement = element;
        this.#hasWrapper = null !== element;
        this.#wrapperSet = true;
        return this;
    }
```

Add the import alongside the existing ones at the top of `src/RiteSelect/RiteSelect.js`:

```javascript
import { buildWrapperElement } from '../WrapperOptions.js';
```

**Ordering matters, exactly as in `CalendarSelect`:** the `#wrapperSet` guard runs BEFORE
`buildWrapperElement()`, and `#wrapperSet` is assigned only AFTER it returns — so an invalid bag throws
without marking the wrapper as set.

- [ ] **Step 5: Add the wrapper branch to `appendTo()`**

`appendTo()` currently ends with:

```javascript
        domNode.appendChild(this.#domElement);
        if (this.#hasLabel) {
```

Replace the single `appendChild` line with the wrapper branch, leaving the label block untouched:

```javascript
        if (this.#hasWrapper) {
            domNode.appendChild(this.#wrapperElement);
            this.#wrapperElement.appendChild(this.#domElement);
        } else {
            domNode.appendChild(this.#domElement);
        }
        if (this.#hasLabel) {
```

The existing `insertAdjacentElement('beforebegin', this.#labelElement)` below is deliberately expressed
relative to the select, not the container, so it stays correct in both branches. Do not change it.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `yarn test src/__tests__/RiteSelect.test.js`

Expected: PASS, all cases including the pre-existing ones.

- [ ] **Step 7: Run the full gate**

```bash
yarn format:js:fix && yarn test && yarn compile && yarn lint:dts
```

Expected: all green. `dist/index.d.ts` should now declare `wrapper(wrapperOptions?: { as?: string; class?: string; id?: string } | null): RiteSelect;`.

- [ ] **Step 8: Commit**

```bash
git add src/RiteSelect/RiteSelect.js src/__tests__/RiteSelect.test.js
git commit -m "Give RiteSelect the wrapper() CalendarSelect already has"
```

---

### Task 4: Honour `riteTheme.wrapperClass` in the three meta-components

**Files:**

- Modify: `src/MetaComponents/CalendarControls.js:130-147`
- Modify: `src/MetaComponents/DayViewer.js:120-136`
- Modify: `src/MetaComponents/CalendarResourcePicker.js:180-196`
- Test: `src/__tests__/MetaComponentThemeWrapperSymmetry.test.js`

**Interfaces:**

- Consumes: `RiteSelect.prototype.wrapper({ class })` from Task 3.
- Produces: no new API. Behaviour change only — the theme bag's `wrapper` role now reaches the rite select.

**Background:** `resolveChildTheme(theme, 'riteSelect')` already returns a `wrapperClass` key, resolved
either from the flat `theme.wrapper` (`Theme.js:226`) or from an explicit `{ riteSelect: { wrapperClass }
}` override. All three components currently read only `class`, `labelClass` and `labelText` from that
resolved bag and drop `wrapperClass`. Each already applies `wrapperClass` to its **calendar** select —
`CalendarControls.js:179-183` is the model.

- [ ] **Step 1: Update the pinned symmetry test to the new expectation**

In `src/__tests__/MetaComponentThemeWrapperSymmetry.test.js`, replace the comment block at lines 69-75 and the two `it(...)` blocks that follow it (lines 76-108) with:

```javascript
    // I1: `.not.toThrow()` alone cannot tell "the wrapper applied" apart from "the
    // wrapper was silently skipped" — both pass it. These assert the resulting DOM
    // structure instead: which children actually got wrapped, and which did not.
    // Found this way: with `{ select, label, wrapper }`, `DayViewer` wrapped its
    // `calendarSelect` but silently skipped `localeInput`, even though `LocaleInput`
    // supports a wrapper exactly as `CalendarSelect` does.
    //
    // `riteSelect` was the third such omission and was pinned here as a genuine
    // capability limit, `RiteSelect` having had no `wrapper()` at all. It has one
    // now (see `RiteSelect.wrapper()`), so the flat key must reach it too: a
    // `wrapper` role honoured for one of two selects is not a role vocabulary.
    it('wraps every DayViewer child that can take a wrapper, and only those', () => {
        const viewer = new DayViewer({ locale: 'en', theme: FLAT_BAG });
        viewer.appendTo('#mount');

        expect(
            viewer.calendarSelect._domElement.closest('.col-md-3'),
        ).not.toBeNull();
        expect(
            viewer.localeInput._domElement.closest('.col-md-3'),
        ).not.toBeNull();
        expect(
            viewer.riteSelect._domElement.closest('.col-md-3'),
        ).not.toBeNull();
    });

    it('wraps both selects for CalendarResourcePicker', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
            theme: FLAT_BAG,
        });
        picker.appendTo('#mount');

        expect(
            picker.calendarSelect._domElement.closest('.col-md-3'),
        ).not.toBeNull();
        expect(
            picker.riteSelect._domElement.closest('.col-md-3'),
        ).not.toBeNull();
    });

    it('wraps both selects for CalendarControls', () => {
        const controls = new CalendarControls({ locale: 'en', theme: FLAT_BAG });
        controls.appendTo('#mount');

        expect(
            controls.calendarSelect._domElement.closest('.col-md-3'),
        ).not.toBeNull();
        expect(
            controls.riteSelect._domElement.closest('.col-md-3'),
        ).not.toBeNull();
    });

    it('honours an explicit riteSelect.wrapperClass override over the flat key', () => {
        const controls = new CalendarControls({
            locale: 'en',
            theme: { ...FLAT_BAG, riteSelect: { wrapperClass: 'col-md-2' } },
        });
        controls.appendTo('#mount');

        expect(
            controls.riteSelect._domElement.closest('.col-md-2'),
        ).not.toBeNull();
        expect(
            controls.riteSelect._domElement.closest('.col-md-3'),
        ).toBeNull();
    });
```

Add the `CalendarControls` import alongside the existing ones near line 25:

```javascript
import CalendarControls from '../MetaComponents/CalendarControls.js';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn test src/__tests__/MetaComponentThemeWrapperSymmetry.test.js`

Expected: FAIL — the three new `riteSelect` assertions each report `Received: null`, because no component passes `wrapperClass` to the rite select yet.

- [ ] **Step 3: Apply the wrapper class in `CalendarControls`**

In `src/MetaComponents/CalendarControls.js`, the rite-select theme block currently ends with the
`this.#riteSelect.label(labelOptions);` call and its closing brace, immediately before `const
calendarTheme = …`. Insert this block between them:

```javascript
        if (Object.hasOwn(riteTheme, 'wrapperClass')) {
            this.#riteSelect.wrapper({ class: riteTheme.wrapperClass });
        }
```

- [ ] **Step 4: Apply the same block in `DayViewer`**

In `src/MetaComponents/DayViewer.js`, insert the identical three lines immediately after the rite-select `label(riteLabelOptions)` block closes (after `:136`):

```javascript
        if (Object.hasOwn(riteTheme, 'wrapperClass')) {
            this.#riteSelect.wrapper({ class: riteTheme.wrapperClass });
        }
```

- [ ] **Step 5: Apply the same block in `CalendarResourcePicker`**

In `src/MetaComponents/CalendarResourcePicker.js`, the rite-select theme handling sits inside a
conditional block (it starts at `:180` with `const riteTheme = …`, indented one level deeper than the
other two files). Insert after the `label(riteLabelOptions)` block closes (after `:196`), matching the
surrounding indentation:

```javascript
            if (Object.hasOwn(riteTheme, 'wrapperClass')) {
                this.#riteSelect.wrapper({ class: riteTheme.wrapperClass });
            }
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `yarn test src/__tests__/MetaComponentThemeWrapperSymmetry.test.js`

Expected: PASS.

- [ ] **Step 7: Run the full suite — this is a behaviour change, so look for collateral**

Run: `yarn test`

Expected: PASS. If any other test fails, it is asserting DOM structure around a rite select and needs its
expectation updated to account for the new wrapper element — **read the failure before changing
anything**, and confirm the failure is the added wrapper and not a real regression.

- [ ] **Step 8: Run the full gate**

```bash
yarn format:js:fix && yarn test && yarn compile && yarn lint:dts
```

- [ ] **Step 9: Commit**

```bash
git add src/MetaComponents/CalendarControls.js src/MetaComponents/DayViewer.js \
        src/MetaComponents/CalendarResourcePicker.js \
        src/__tests__/MetaComponentThemeWrapperSymmetry.test.js
git commit -m "Honour the theme bag's wrapper role for rite selects"
```

---

### Task 5: Reject unknown slot names in `CalendarControls.appendTo()`

**Files:**

- Modify: `src/MetaComponents/CalendarControls.js:342-409`
- Test: `src/__tests__/CalendarControlsMount.test.js`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: `CalendarControls.appendTo()` throws `` `${caller}: unknown slot name(s): …` `` for any key
  outside `['controls', 'messages']`. Task 6's `CalendarViewer.appendTo()` applies the same rule to its own
  slot set.

**Model:** `src/MetaComponents/ApiExplorer.js:227-234` already does this. Copy its message shape.

- [ ] **Step 1: Write the failing tests**

Append inside the top-level `describe` of `src/__tests__/CalendarControlsMount.test.js`:

```javascript
    it('rejects an unknown slot name, naming it', () => {
        const controls = new CalendarControls({ locale: 'en' });
        expect(() =>
            controls.appendTo({ controls: '#mount', mesages: '#messages' }),
        ).toThrow(/unknown slot name\(s\): mesages/);
    });

    it('names the calling class in an unknown-slot error', () => {
        const controls = new CalendarControls({ locale: 'en' });
        expect(() =>
            controls.appendTo({ controls: '#mount', nope: '#messages' }),
        ).toThrow(/^CalendarControls\.appendTo: unknown slot name/);
    });

    it('still accepts the two known slots', () => {
        const controls = new CalendarControls({ locale: 'en' });
        expect(() =>
            controls.appendTo({ controls: '#mount', messages: '#messages' }),
        ).not.toThrow();
    });
```

If `CalendarControlsMount.test.js`'s `beforeEach` does not already create a `#messages` element, add one alongside the existing mount setup.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn test src/__tests__/CalendarControlsMount.test.js`

Expected: FAIL on the first two — no error is thrown today, the unknown key is silently ignored.

- [ ] **Step 3: Add the module-level slot-name constant**

Near the top of `src/MetaComponents/CalendarControls.js`, after the imports and before the class declaration:

```javascript
/**
 * The slot names `appendTo()` accepts.
 *
 * Enumerated so a typo is rejected with the offending key named, rather than
 * mounting nothing and returning successfully — the silent-failure shape this
 * family exists to close, and the same rule `ApiExplorer.appendTo()` and
 * `CalendarViewer`'s `webCalendar` bag already apply.
 *
 * @type {Readonly<string[]>}
 */
const SLOT_NAMES = Object.freeze(['controls', 'messages']);
```

- [ ] **Step 4: Add the check to `appendTo()`**

In `appendTo()`, the block that resolves `slots` currently reads:

```javascript
        const slots = single ? { controls: target } : target;
        if (false === Object.hasOwn(slots, 'controls')) {
            throw new Error(
                `${caller}: a slots object must name a 'controls' target.`,
            );
        }
```

Insert the unknown-key check between the two, so an unknown key is reported even when `controls` is also missing:

```javascript
        const slots = single ? { controls: target } : target;
        const unknownKeys = Object.keys(slots).filter(
            (key) => false === SLOT_NAMES.includes(key),
        );
        if (unknownKeys.length > 0) {
            throw new Error(
                `${caller}: unknown slot name(s): ${unknownKeys.join(', ')}. Known slots are { controls, messages }.`,
            );
        }
        if (false === Object.hasOwn(slots, 'controls')) {
            throw new Error(
                `${caller}: a slots object must name a 'controls' target.`,
            );
        }
```

- [ ] **Step 5: Update the `appendTo()` JSDoc**

Add to the existing `@throws` list:

```javascript
     * @throws {Error} If `target` names a slot outside `{ controls, messages }`.
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `yarn test src/__tests__/CalendarControlsMount.test.js && yarn test`

Expected: PASS. `CalendarViewer.mountInto()` builds its `controlsSlots` from exactly these two keys (`CalendarViewer.js:328-331`), so it is unaffected.

- [ ] **Step 7: Run the full gate and commit**

```bash
yarn format:js:fix && yarn test && yarn compile && yarn lint:dts
git add src/MetaComponents/CalendarControls.js src/__tests__/CalendarControlsMount.test.js
git commit -m "Reject unknown slot names in CalendarControls.appendTo()"
```

---

### Task 6: `CalendarViewer.appendTo()` and `listenTo()`

**Files:**

- Modify: `src/MetaComponents/CalendarViewer.js`
- Create: `src/__tests__/CalendarViewerMount.test.js`

**Interfaces:**

- Consumes: `CalendarControls.appendTo(target, caller)` and its unknown-slot rejection from Task 5; `CalendarControls.listenTo(apiClient)`.
- Produces:
  - `CalendarViewer.prototype.appendTo(slots, caller = 'CalendarViewer.appendTo') => void`, slots `{
controls: string|HTMLElement, calendar: string|HTMLElement, messages?: string|HTMLElement }`
  - `CalendarViewer.prototype.listenTo(apiClient) => CalendarViewer`

  Task 7 refactors `mountInto()` onto both.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/CalendarViewerMount.test.js`:

```javascript
/** @jest-environment jsdom */
/**
 * The constructor path — `new CalendarViewer()`, `appendTo()`, `listenTo()`,
 * `fetch()` — as distinct from `mountInto()`, which `CalendarViewer.test.js`
 * covers. That path was documented in `docs/meta-components.md` before it
 * existed: the constructor built both halves and nothing could mount them.
 *
 * The case that motivated it is `hides the Accept header input` below.
 * `AcceptHeaderInput.hide()` sets a flag that `ApiOptions.appendTo()` reads
 * (`ApiOptions.js:1149`), so it is only meaningful between construction and
 * the append — a window `mountInto()` does not have.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import CalendarViewer from '../MetaComponents/CalendarViewer.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

/**
 * An EMPTY `litcal` with a non-empty `messages`. `WebCalendar`'s
 * `calendarFetched` listener throws on this (see `WebCalendar.js`), which is
 * exactly what the listener-ordering test needs: the messages renderer must
 * have run before that throw aborts `EventEmitter.emit()`'s synchronous
 * `forEach`.
 */
const EMPTY_WITH_MESSAGES = {
    litcal: [],
    settings: {},
    metadata: {},
    messages: ['First message', 'Second message'],
};

const respondWith = (payload) => {
    global.fetch = jest.fn(() =>
        Promise.resolve({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: () => Promise.resolve(payload),
        }),
    );
};

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.replaceChildren();
    for (const id of ['controls', 'calendar', 'messages']) {
        const el = document.createElement('div');
        el.id = id;
        document.body.appendChild(el);
    }
});

describe('CalendarViewer — the constructor path', () => {
    it('mounts both halves through appendTo()', () => {
        const viewer = new CalendarViewer({ locale: 'en' });
        viewer.appendTo({ controls: '#controls', calendar: '#calendar' });
        expect(
            document.querySelectorAll('#controls select').length,
        ).toBeGreaterThanOrEqual(2);
    });

    it('returns undefined from appendTo(), per the library-wide contract', () => {
        const viewer = new CalendarViewer({ locale: 'en' });
        expect(
            viewer.appendTo({ controls: '#controls', calendar: '#calendar' }),
        ).toBeUndefined();
    });

    it('hides the Accept header input when hide() runs before appendTo()', () => {
        const viewer = new CalendarViewer({ locale: 'en' });
        viewer.controls.apiOptions._acceptHeaderInput.hide();
        viewer.appendTo({ controls: '#controls', calendar: '#calendar' });

        const acceptHeaderElement =
            viewer.controls.apiOptions._acceptHeaderInput._domElement;
        expect(document.getElementById('controls').contains(acceptHeaderElement)).toBe(
            false,
        );
    });

    it('mounts the Accept header input when hide() is not called', () => {
        const viewer = new CalendarViewer({ locale: 'en' });
        viewer.appendTo({ controls: '#controls', calendar: '#calendar' });

        const acceptHeaderElement =
            viewer.controls.apiOptions._acceptHeaderInput._domElement;
        expect(document.getElementById('controls').contains(acceptHeaderElement)).toBe(
            true,
        );
    });

    it('renders messages before WebCalendar throws on an empty litcal', async () => {
        respondWith(EMPTY_WITH_MESSAGES);
        const apiClient = await ApiClient.init(API_URL);
        const viewer = new CalendarViewer({ locale: 'en' });
        viewer.appendTo({
            controls: '#controls',
            calendar: '#calendar',
            messages: '#messages',
        });
        viewer.listenTo(apiClient);
        // `viewer.controls.fetch()` and not `viewer.fetch()`: the delegate
        // arrives in Task 7, and this test must pass at the end of Task 6.
        // Task 7 adds `fetch()`'s own coverage; this line stays as it is.
        await viewer.controls.fetch().catch(() => {});

        const rows = document.querySelectorAll('#messages tr');
        expect(rows.length).toBe(2);
        expect(rows[0].textContent).toContain('First message');
    });

    it('returns this from listenTo(), for chaining', async () => {
        respondWith(EMPTY_WITH_MESSAGES);
        const apiClient = await ApiClient.init(API_URL);
        const viewer = new CalendarViewer({ locale: 'en' });
        viewer.appendTo({ controls: '#controls', calendar: '#calendar' });
        expect(viewer.listenTo(apiClient)).toBe(viewer);
    });

    it('rejects an unknown slot name, naming it', () => {
        const viewer = new CalendarViewer({ locale: 'en' });
        expect(() =>
            viewer.appendTo({
                controls: '#controls',
                calender: '#calendar',
            }),
        ).toThrow(/unknown slot name\(s\): calender/);
    });

    it('rejects slots missing controls or calendar', () => {
        const viewer = new CalendarViewer({ locale: 'en' });
        expect(() => viewer.appendTo({ calendar: '#calendar' })).toThrow(
            /must name a 'controls' target/,
        );
        expect(() => viewer.appendTo({ controls: '#controls' })).toThrow(
            /must name a 'calendar' target/,
        );
    });

    it('rejects a non-object slots argument', () => {
        const viewer = new CalendarViewer({ locale: 'en' });
        expect(() => viewer.appendTo('#controls')).toThrow(
            /slots must be an object naming/,
        );
    });

    it('mounts nothing when the calendar target is unusable', () => {
        const viewer = new CalendarViewer({ locale: 'en' });
        expect(() =>
            viewer.appendTo({
                controls: '#controls',
                calendar: '#nonexistent',
            }),
        ).toThrow(/Element not found for the calendar slot/);
        expect(document.querySelectorAll('#controls select').length).toBe(0);
    });

    it('is callable twice, moving the children rather than copying them', () => {
        const second = document.createElement('div');
        second.id = 'controls2';
        document.body.appendChild(second);

        const viewer = new CalendarViewer({ locale: 'en' });
        viewer.appendTo({ controls: '#controls', calendar: '#calendar' });
        const firstCount = document.querySelectorAll('#controls select').length;
        viewer.appendTo({ controls: '#controls2', calendar: '#calendar' });

        expect(document.querySelectorAll('#controls select').length).toBe(0);
        expect(document.querySelectorAll('#controls2 select').length).toBe(
            firstCount,
        );
    });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn test src/__tests__/CalendarViewerMount.test.js`

Expected: FAIL — `viewer.appendTo is not a function`.

- [ ] **Step 3: Rename `#requireElement`'s hard-coded caller**

`CalendarViewer.#requireElement(target, slot)` currently hard-codes `CalendarViewer.mountInto` in both messages. Change its signature to take the caller, so `appendTo()` reports itself:

```javascript
    /**
     * Resolves a mount target to an element.
     *
     * @param {string|HTMLElement} target - A CSS selector or an element.
     * @param {string} slot - The slot name, for the message.
     * @param {string} caller - The `Class.method` prefix to report, so a bad
     *   target names whichever entry point the caller actually used.
     * @returns {HTMLElement} The resolved element.
     * @throws {Error} If the target is neither, or matches nothing.
     */
    static #requireElement(target, slot, caller) {
        if (target instanceof HTMLElement) {
            return target;
        }
        if (typeof target !== 'string' || '' === target) {
            throw new Error(
                `${caller}: the ${slot} target must be a non-empty CSS selector or an HTMLElement.`,
            );
        }
        const element = document.querySelector(target);
        if (null === element) {
            throw new Error(
                `${caller}: Element not found for the ${slot} slot: ${target}`,
            );
        }
        return element;
    }
```

Its one existing call site inside `mountInto()` (`:320-323`) becomes:

```javascript
        const calendarElement = CalendarViewer.#requireElement(
            slots.calendar,
            'calendar',
            'CalendarViewer.mountInto',
        );
```

- [ ] **Step 4: Add the slot-name constant**

After `WEB_CALENDAR_KEYS` in `src/MetaComponents/CalendarViewer.js`:

```javascript
/**
 * The slot names `appendTo()` accepts.
 *
 * `controls` and `calendar` are both required — a viewer has two mandatory
 * mounts. `messages` is optional and is forwarded to `CalendarControls`, which
 * owns the renderer.
 *
 * @type {Readonly<string[]>}
 */
const SLOT_NAMES = Object.freeze(['controls', 'calendar', 'messages']);
```

- [ ] **Step 5: Add `appendTo()`**

Insert after the `webCalendar` getter (which ends at `:156`):

```javascript
    /**
     * Mounts both halves: the controls into `slots.controls`, the calendar into
     * `slots.calendar`, and — when named — the messages table into
     * `slots.messages`, which `CalendarControls` renders.
     *
     * **Both required targets are resolved before either is mounted.** Resolving
     * `calendar` after mounting the controls meant an unusable `calendar`
     * selector threw with the controls already in the document — a partial mount
     * the caller never asked for and, from `mountInto()`, cannot easily undo,
     * since the rejected promise hands back no viewer to `dispose()`.
     *
     * Unlike `CalendarControls.appendTo()`, this does NOT accept a single bare
     * target. A viewer has two mandatory mounts, and a lone target would have to
     * choose one of them silently.
     *
     * Callable more than once; the children are moved rather than copied.
     *
     * @param {{controls: (string|HTMLElement), calendar: (string|HTMLElement), messages?: (string|HTMLElement)}} slots - Where to mount each half.
     * @param {string} [caller='CalendarViewer.appendTo'] - Internal only: the
     *   `Class.method` prefix to report in a thrown message. `mountInto()`
     *   passes its own name so a bad target is reported under the entry point
     *   the caller actually used.
     * @returns {void}
     * @throws {Error} If this viewer has been disposed.
     * @throws {Error} If `slots` is not an object, names an unknown slot, omits
     *   `controls` or `calendar`, or names a target matching nothing.
     */
    appendTo(slots, caller = 'CalendarViewer.appendTo') {
        this.#assertUsable();
        try {
            assertPlainOptions(slots, caller);
        } catch {
            throw new Error(
                `${caller}: slots must be an object naming { controls, calendar, messages } targets, but found type: ${describeType(slots)}`,
            );
        }

        const unknownKeys = Object.keys(slots).filter(
            (key) => false === SLOT_NAMES.includes(key),
        );
        if (unknownKeys.length > 0) {
            throw new Error(
                `${caller}: unknown slot name(s): ${unknownKeys.join(', ')}. Known slots are { controls, calendar, messages }.`,
            );
        }
        if (false === Object.hasOwn(slots, 'controls')) {
            throw new Error(`${caller}: slots must name a 'controls' target.`);
        }
        if (false === Object.hasOwn(slots, 'calendar')) {
            throw new Error(`${caller}: slots must name a 'calendar' target.`);
        }

        // Resolved BEFORE either half is mounted — see the doc comment above.
        const calendarElement = CalendarViewer.#requireElement(
            slots.calendar,
            'calendar',
            caller,
        );

        const controlsSlots = { controls: slots.controls };
        if (Object.hasOwn(slots, 'messages')) {
            controlsSlots.messages = slots.messages;
        }
        // The caller's own name is passed down so a bad `controls`/`messages`
        // target is reported as this class' method, not as
        // `CalendarControls.appendTo` — a class the caller never touched.
        this.#controls.appendTo(controlsSlots, caller);

        this.#calendarMount = calendarElement;
        this.#webCalendar.appendTo(calendarElement);
    }
```

- [ ] **Step 6: Add `listenTo()`**

Insert immediately after `appendTo()`:

```javascript
    /**
     * Wires both halves to an `ApiClient`, controls first.
     *
     * **The order is the whole point of this method.** `EventEmitter.emit()` is
     * a synchronous `forEach` over listeners in registration order, and
     * `WebCalendar`'s own `calendarFetched` listener throws on malformed or
     * empty `litcal` (see `WebCalendar.js`) — a throw that aborts the iteration
     * for every listener registered after it. Registering the controls first
     * means their `calendarFetched` listeners, including the messages renderer
     * when a `messages` slot was named, always run before `WebCalendar`'s, so a
     * `WebCalendar` failure can never suppress a messages render that was
     * already due. A caller wiring `controls` and `webCalendar` by hand has to
     * know that and reproduce it; this method is what removes that trap, the
     * same way `CalendarControls.listenTo()` removes the rite's two-wire trap.
     *
     * @param {ApiClient} apiClient - The client to drive.
     * @returns {CalendarViewer} This instance.
     * @throws {Error} If this viewer has been disposed, or if the controls are
     *   already wired to a client.
     */
    listenTo(apiClient) {
        this.#assertUsable();
        this.#controls.listenTo(apiClient);
        this.#webCalendar.listenTo(apiClient);
        return this;
    }
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `yarn test src/__tests__/CalendarViewerMount.test.js`

Expected: PASS, every case. Task 6's tests deliberately avoid `viewer.fetch()`, which arrives in Task 7.

- [ ] **Step 8: Mutation-verify the ordering test**

Temporarily swap the two lines in `listenTo()` so `#webCalendar.listenTo()` runs first. Run `yarn test
src/__tests__/CalendarViewerMount.test.js -t 'renders messages before WebCalendar throws'`.

Expected: FAIL — 0 rows instead of 2. **Restore the correct order and re-run to confirm PASS.** A test
that passes either way is worthless here, and this is the one assertion in the file that can silently
degrade.

- [ ] **Step 9: Run the full gate and commit**

```bash
yarn format:js:fix && yarn test && yarn compile && yarn lint:dts
git add src/MetaComponents/CalendarViewer.js src/__tests__/CalendarViewerMount.test.js
git commit -m "Add CalendarViewer.appendTo() and listenTo()"
```

---

### Task 7: The three delegates, the dispose guards, and the `mountInto()` refactor

**Files:**

- Modify: `src/MetaComponents/CalendarViewer.js`
- Test: `src/__tests__/CalendarViewerMount.test.js`

**Interfaces:**

- Consumes: `appendTo()` and `listenTo()` from Task 6; `CalendarControls.fetch()`, `.onError()`, `.onCalendarFetched()`.
- Produces: `CalendarViewer.prototype.fetch() => Promise<Object>`, `.onError(cb) => CalendarViewer`, `.onCalendarFetched(cb) => CalendarViewer`.

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/CalendarViewerMount.test.js`, inside the existing `describe`:

```javascript
    it('fetch() hands its promise to the caller', async () => {
        respondWith(EMPTY_WITH_MESSAGES);
        const apiClient = await ApiClient.init(API_URL);
        const viewer = new CalendarViewer({ locale: 'en' });
        viewer.appendTo({ controls: '#controls', calendar: '#calendar' });
        viewer.listenTo(apiClient);
        await expect(viewer.fetch()).resolves.toBeDefined();
    });

    it('fetch() throws when no client is wired', () => {
        const viewer = new CalendarViewer({ locale: 'en' });
        viewer.appendTo({ controls: '#controls', calendar: '#calendar' });
        expect(() => viewer.fetch()).toThrow(/no ApiClient is wired/);
    });

    it('onError() and onCalendarFetched() return this', async () => {
        respondWith(EMPTY_WITH_MESSAGES);
        const apiClient = await ApiClient.init(API_URL);
        const viewer = new CalendarViewer({ locale: 'en' });
        viewer.appendTo({ controls: '#controls', calendar: '#calendar' });
        viewer.listenTo(apiClient);
        expect(viewer.onError(() => {})).toBe(viewer);
        expect(viewer.onCalendarFetched(() => {})).toBe(viewer);
    });

    it('onCalendarFetched() receives the fetched data', async () => {
        respondWith(EMPTY_WITH_MESSAGES);
        const apiClient = await ApiClient.init(API_URL);
        const viewer = new CalendarViewer({ locale: 'en' });
        viewer.appendTo({ controls: '#controls', calendar: '#calendar' });
        viewer.onCalendarFetched(() => {});
        viewer.listenTo(apiClient);

        const seen = [];
        viewer.onCalendarFetched((data) => seen.push(data));
        await viewer.fetch().catch(() => {});
        expect(seen.length).toBe(1);
        expect(seen[0].messages).toEqual([
            'First message',
            'Second message',
        ]);
    });

    it('throws from every public member once disposed', async () => {
        respondWith(EMPTY_WITH_MESSAGES);
        const apiClient = await ApiClient.init(API_URL);
        const viewer = new CalendarViewer({ locale: 'en' });
        viewer.appendTo({ controls: '#controls', calendar: '#calendar' });
        viewer.listenTo(apiClient);
        viewer.dispose();

        const disposed = /has been disposed/;
        expect(() => viewer.controls).toThrow(disposed);
        expect(() => viewer.webCalendar).toThrow(disposed);
        expect(() =>
            viewer.appendTo({ controls: '#controls', calendar: '#calendar' }),
        ).toThrow(disposed);
        expect(() => viewer.listenTo(apiClient)).toThrow(disposed);
        expect(() => viewer.fetch()).toThrow(disposed);
        expect(() => viewer.onError(() => {})).toThrow(disposed);
        expect(() => viewer.onCalendarFetched(() => {})).toThrow(disposed);
    });

    it('dispose() is idempotent', () => {
        const viewer = new CalendarViewer({ locale: 'en' });
        viewer.appendTo({ controls: '#controls', calendar: '#calendar' });
        viewer.dispose();
        expect(() => viewer.dispose()).not.toThrow();
    });
```

Leave Task 6's existing `viewer.controls.fetch()` call as it is — it exercises the controls' own method, which is still worth covering directly.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn test src/__tests__/CalendarViewerMount.test.js`

Expected: FAIL — `viewer.fetch is not a function`.

- [ ] **Step 3: Add the three delegates**

Insert after `listenTo()` in `src/MetaComponents/CalendarViewer.js`:

```javascript
    /**
     * Fetches the calendar the select currently names, through the controls'
     * own three-way dispatch.
     *
     * The promise is returned to the caller and is never routed through
     * `ApiClient#_discardRequest` — the rule `CalendarControls.fetch()`'s own
     * doc comment states, which a delegate must not quietly change. A caller
     * holding this promise can `.catch()` or `await` it, so logging on top of
     * that would report a handled failure twice.
     *
     * @returns {Promise<Object>} The fetched calendar data.
     * @throws {Error} If this viewer has been disposed, or no client is wired.
     */
    fetch() {
        this.#assertUsable();
        return this.#controls.fetch();
    }

    /**
     * Registers a callback for successfully fetched calendar data.
     *
     * Callbacks registered before `listenTo()` are replayed by it, so the order
     * of the two calls does not matter.
     *
     * @param {function(Object): void} callback - Receives the calendar data.
     * @returns {CalendarViewer} This instance.
     * @throws {Error} If this viewer has been disposed.
     */
    onCalendarFetched(callback) {
        this.#assertUsable();
        this.#controls.onCalendarFetched(callback);
        return this;
    }

    /**
     * Registers a callback for calendar fetch failures.
     *
     * Subscribing is what stops `ApiClient` falling back to `console.error`: it
     * logs only when nothing is listening for `calendarFetchFailed`.
     *
     * @param {function(Error): void} callback - Receives the ApiClientError.
     * @returns {CalendarViewer} This instance.
     * @throws {Error} If this viewer has been disposed.
     */
    onError(callback) {
        this.#assertUsable();
        this.#controls.onError(callback);
        return this;
    }
```

Each returns `this` — the viewer — rather than the `CalendarControls` its delegate returns. Returning the child would let a caller chain off it and silently leave the viewer behind.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `yarn test src/__tests__/CalendarViewerMount.test.js`

Expected: PASS.

- [ ] **Step 5: Refactor `mountInto()` onto the new methods**

Replace the body of `mountInto()` from the `assertPlainOptions(slots, …)` try/catch through to the end of
the method. The validation, the unknown-key check, the required-key checks, the `#requireElement` call
for `calendar` and the two mount calls all now live in `appendTo()`; the cancellation check stays here
because only `mountInto()` takes a `signal`.

```javascript
    static async mountInto(slots, options = {}) {
        const bag = normalizeComponentOptions(options, 'CalendarViewer');
        const { apiClient, signal, onError, initialFetch } = bag;

        const viewer = new CalendarViewer(bag);

        const element = CalendarViewer.#targetElement(slots);
        if (
            true === signal?.aborted ||
            (null !== element && false === element.isConnected)
        ) {
            return null;
        }

        // Passed explicitly so a bad target, an unknown slot name or a missing
        // required slot is reported as `CalendarViewer.mountInto` — the entry
        // point the caller actually used — rather than as `appendTo`.
        viewer.appendTo(slots, 'CalendarViewer.mountInto');

        if (apiClient !== undefined && apiClient !== null) {
            // Controls FIRST, so the messages renderer (if any) is registered
            // ahead of WebCalendar's listener on the same `calendarFetched`
            // event — see `listenTo()`'s own doc comment for why.
            viewer.listenTo(apiClient);
            if (typeof onError === 'function') {
                viewer.onError(onError);
            }
            if (false !== initialFetch) {
                // `_discardRequest` is what CalendarControls.mountInto() itself
                // uses for this exact promise, and it is called exactly once
                // here: `fetch()` never routes through it, so a second discard
                // would be the duplicate `CalendarControls.fetch()`'s own doc
                // comment warns against. The `.catch(() => {})` below is NOT a
                // second discard — it is an independent subscriber on the SAME
                // promise, added only so this factory can `await` the request's
                // settlement before resolving, rather than resolving while the
                // WebCalendar listener's throw on an empty `litcal` and the
                // messages render that must precede it are still pending.
                const fetchPromise = viewer.fetch();
                apiClient._discardRequest(fetchPromise);
                await fetchPromise.catch(() => {});
            }
        }

        return viewer;
    }
```

Two consequences to check rather than assume:

1. **`#targetElement(slots)` now runs before `slots` has been validated.** It already tolerates that — it
   reads `slots?.controls` and `slots?.calendar` with optional chaining and returns `null` for anything else
   — so a non-object `slots` reaches `appendTo()` and is rejected there with the right message. Verify by
   running the `mountInto` slot-validation tests in `CalendarViewer.test.js`.
2. **The ordering of "cancelled" versus "invalid slots" is preserved:** the cancellation check still runs first, so an aborted signal returns `null` rather than throwing on a bad target.

Also update `mountInto()`'s JSDoc `@throws` to mention unknown slot names, and delete the now-inaccurate
sentences in its doc comment that describe validation it no longer performs itself — specifically the
paragraph beginning "This factory calls `this.#controls`'s own `appendTo()`/`listenTo()`/`fetch()`
directly", which should now read that it calls this class' own public methods. Keep the paragraph
explaining `_discardRequest`, which is still accurate.

- [ ] **Step 6: Verify the refactor changed no behaviour**

Run: `yarn test src/__tests__/CalendarViewer.test.js src/__tests__/CalendarViewerStory.test.js`

Expected: PASS, **with those two files unmodified**. If either fails, the refactor introduced a
regression — fix the source, do not adjust the test. These two files are the contract that
`mountInto()` behaves exactly as it did before.

- [ ] **Step 7: Run the whole suite and the full gate**

```bash
yarn format:js:fix && yarn test && yarn compile && yarn lint:dts
```

Confirm `dist/index.d.ts` declares all five new `CalendarViewer` members.

- [ ] **Step 8: Commit**

```bash
git add src/MetaComponents/CalendarViewer.js src/__tests__/CalendarViewerMount.test.js
git commit -m "Add CalendarViewer fetch/onError/onCalendarFetched; refactor mountInto onto them"
```

---

### Task 8: Documentation, changelog and version

**Files:**

- Modify: `docs/rite-select.md`
- Modify: `docs/meta-components.md`
- Modify: `CHANGELOG.md`
- Modify: `package.json`

**Interfaces:**

- Consumes: every API from Tasks 1-7.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Document `RiteSelect.wrapper()`**

In `docs/rite-select.md`, add `wrapper()` to the method listing, following the shape the surrounding entries use, and note the `CalendarSelect` parity:

````markdown
### `wrapper(wrapperOptions)`

Wraps the select — and its label, when one is set — in a container element. Chainable.

```javascript
const riteSelect = new RiteSelect('en')
    .class('form-select')
    .wrapper({ as: 'div', class: 'form-group col col-md-2' });
riteSelect.appendTo('#calendarOptions');
```

| Option  | Type     | Notes                                                    |
| ------- | -------- | -------------------------------------------------------- |
| `as`    | `string` | `'div'` or `'td'`. Defaults to `'div'`.                  |
| `class` | `string` | Each class name is sanitized and validated.              |
| `id`    | `string` | Sanitized and validated as a CSS selector.               |

Pass `null` for no wrapper, which is also the default when the method is never called. The
options object must name at least one of `as`, `class` or `id`.

This is one-shot: a second call throws rather than replacing a wrapper already configured. The
signature matches `CalendarSelect.wrapper()` exactly, so the meta-components' theme bag drives
one contract for both selects. `ApiOptions`' `Input.wrapper()` still takes a bare tag name and
pairs with a separate `wrapperClass()`; converging it is tracked in issue #46.
````

- [ ] **Step 2: Replace `CalendarViewer`'s "Public getters" section**

In `docs/meta-components.md`, the `### Public getters` section under `## CalendarViewer` (around `:906`) currently lists two rows. Replace the heading and table with:

````markdown
### Public members

Every member below throws once this viewer has been disposed — see [`dispose()`](#dispose-3).

| Member                    | Returns            | Description                                                                  |
| ------------------------- | ------------------ | ---------------------------------------------------------------------------- |
| `controls`                | `CalendarControls` | The wired rite select, calendar select and API options, bundled.             |
| `webCalendar`             | `WebCalendar`      | The wired table renderer.                                                    |
| `appendTo(slots)`         | `void`             | Mounts both halves. See below.                                               |
| `listenTo(apiClient)`     | `CalendarViewer`   | Wires the controls, then the calendar, to a client — in that order.          |
| `fetch()`                 | `Promise<Object>`  | Fetches the calendar the select names. The promise is yours; handle it.      |
| `onCalendarFetched(cb)`   | `CalendarViewer`   | Registers a callback for fetched data.                                       |
| `onError(cb)`             | `CalendarViewer`   | Registers a callback for fetch failures.                                     |
| `dispose()`               | `void`             | Releases listeners and empties both mounts. Idempotent; further use throws.  |

### `appendTo()` and its slots

```javascript
const viewer = new CalendarViewer({ locale: 'en' });
viewer.controls.apiOptions._acceptHeaderInput.hide(); // read at append time
viewer.appendTo({
    controls: '#calendarOptions',
    calendar: '#litcalWebcalendar',
    messages: '#LitCalMessages tbody', // optional
});
viewer.listenTo(apiClient);
viewer.fetch().catch((error) => console.error(error.message));
```

`controls` and `calendar` are both required, and unlike `CalendarControls.appendTo()` a single bare
target is **not** accepted — a viewer has two mandatory mounts, and a lone target would have to pick
one of them silently. An unknown slot name throws, naming the key.

Both required targets are resolved before either is mounted, so an unusable `calendar` selector
leaves nothing in the document rather than a half-mounted form. `appendTo()` returns `undefined`, per
the library-wide contract: nothing can be chained off it, and its result must never be assigned. It is
callable more than once, and moves its children rather than copying them.

**Use the constructor path when something must happen between construction and the mount.** The
motivating case is above: `AcceptHeaderInput.hide()` sets a flag that `ApiOptions.appendTo()` reads,
so it is only meaningful before the append — a window `mountInto()` does not have.
````

- [ ] **Step 3: Drop the "RiteSelect has none" carve-out**

Search `docs/meta-components.md` for text stating that `RiteSelect` has no wrapper, or that the theme
bag's `wrapper` role does not apply to it, and rewrite each occurrence to say the role applies to both
selects. Run:

```bash
grep -n "RiteSelect has none\|no wrapper\|wrapper concept" docs/meta-components.md docs/*.md
```

Read each hit before editing — the grep is deliberately broad and will match unrelated prose
(`ApiExplorer`'s `riteSelect` slot discussion, for instance, is correct as written and must not be
touched). Change only sentences asserting that `RiteSelect` cannot take a wrapper.

Also verify the `CalendarViewer` `mountInto()`-versus-constructor section no longer claims the
constructor "mounts neither" without saying how to mount them — it should now point at `appendTo()`.

- [ ] **Step 4: Verify `CLAUDE.md`'s claim is now true**

`CLAUDE.md`'s meta-components section states that each of the five pairs a synchronous constructor with `appendTo(target)`. Confirm this is now accurate for all five and needs no edit:

```bash
grep -n "appendTo" CLAUDE.md | head -20
```

If any sentence still describes `CalendarViewer` as an exception, remove it.

- [ ] **Step 5: Write the changelog entry**

Add above the `## 2.3.0` heading in `CHANGELOG.md`:

```markdown
## 2.4.0

`CalendarViewer` gains the public mount path its documentation already described, and `RiteSelect`
gains the `wrapper()` every other select in the library already had.

`RiteSelect.wrapper()` takes the same `{ as, class, id }` bag as `CalendarSelect.wrapper()`, and the two
now share one internal validator, so the bag can never drift between them. `CalendarSelect.wrapper()`'s
observable behaviour — every accepted value and every error message — is unchanged; a characterization
suite added before the extraction pins it.

`CalendarViewer` was the only meta-component with no `appendTo()` and no `listenTo()`, so its
documented constructor path — "builds both halves but mounts neither" — was a dead end, and anything
that has to happen between construction and the mount was unreachable. `AcceptHeaderInput.hide()` is
the case that surfaced it: `ApiOptions.appendTo()` reads that flag when it decides whether to render
the input, so `hide()` is only meaningful beforehand, and `mountInto()` offers no such window. It now
has `appendTo()`, `listenTo()`, `fetch()`, `onCalendarFetched()` and `onError()`, and `mountInto()`
is implemented on top of them rather than duplicating their bodies. `listenTo()` exists as its own
method rather than being left to callers because the order is load-bearing: the controls must be
wired before the calendar, or a `WebCalendar` throw on empty data aborts the synchronous listener
loop before the messages renderer runs.

`RiteSelect.wrapper({ as, class, id })` matches `CalendarSelect.wrapper()` exactly. Its absence had
reached the meta-components' theme bag, whose `wrapper` role was resolved for the rite select and
then silently discarded by `CalendarResourcePicker`, `DayViewer` and `CalendarControls` alike,
because there was no method to pass it to.

### Behaviour changes

Two, both deliberate:

- **The theme bag's `wrapper` role now reaches the rite select.** A page passing flat
  `theme: { wrapper: '…' }` to `CalendarResourcePicker`, `DayViewer`, `CalendarControls`,
  `CalendarViewer` or `ApiExplorer` previously got that class on its calendar select only; its rite
  select is now wrapped too. A `wrapper` role honoured for one of two selects is not a role
  vocabulary. Pass `{ riteSelect: { wrapperClass: … } }` to give the two selects different wrappers.
- **`CalendarControls.appendTo()` and `CalendarViewer.appendTo()` reject unknown slot names**, naming
  the offending key, as `ApiExplorer.appendTo()` already did. `{ contorls: '#x' }` previously mounted
  nothing and returned successfully.
```

- [ ] **Step 6: Bump the version**

In `package.json`, change `"version": "2.3.0"` to `"version": "2.4.0"`.

- [ ] **Step 7: Run the markdown and full gates**

```bash
yarn format:md:fix && yarn lint:md && yarn test && yarn compile && yarn lint:dts
```

Expected: `Summary: 0 issues in 0 files` from `lint:md`, everything else green.

- [ ] **Step 8: Commit**

```bash
git add docs/rite-select.md docs/meta-components.md CLAUDE.md CHANGELOG.md package.json
git commit -m "Document RiteSelect.wrapper() and CalendarViewer's mount path; release 2.4.0"
```

---

## Definition of done

- [ ] `yarn test` passes with no pre-existing test file modified, except
      `MetaComponentThemeWrapperSymmetry.test.js` (Task 4, deliberately inverted) and
      `CalendarControlsMount.test.js` (Task 5, additions only).
- [ ] `CalendarSelectWrapper.test.js` passes unmodified from the moment Task 1 wrote it — it is the
      evidence that extracting the shared validator changed nothing observable about `CalendarSelect`.
- [ ] `src/WrapperOptions.js` is NOT exported from `src/index.js`.
- [ ] `yarn compile && yarn lint:dts` pass.
- [ ] `yarn format:js && yarn format:md && yarn lint:md` all report no changes needed.
- [ ] The listener-ordering test was mutation-verified (Task 6, Step 8) and the correct order restored.
- [ ] `CalendarViewer.test.js` and `CalendarViewerStory.test.js` pass unmodified.
- [ ] This sequence works end-to-end, which is what unblocks `examples/javascript/main.js`:

  ```javascript
  const viewer = new CalendarViewer({ locale: 'en', theme: { wrapper: 'form-group col col-md-2' } });
  viewer.controls.apiOptions._acceptHeaderInput.hide();
  viewer.appendTo({ controls: '#calendarOptions', calendar: '#litcalWebcalendar' });
  viewer.listenTo(apiClient);
  ```

## Out of scope

Named so they are not started by accident:

- The `examples/javascript/main.js` and `examples/fullcalendar/script.js` migrations. Different
  repository (`Liturgical-Calendar/examples`), separate review cycle. This branch unblocks them.
- `Input.wrapper()` converging on the `{ as, class, id }` bag — tracked in issue #46, explicitly not required by any meta-component.
- `SubscriptionBuilder` (phase 3).
- Widening the theme bag to reach `ApiOptions`' inputs.
