# `inputs` option and `settled` on the constructor path — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the accept-header input's visibility expressible in the meta-components' options bag, and make
`settled` observe the constructor path's own `fetch()` calls — so `mountInto()` covers the case that forced
every consumer onto the constructor path, and the constructor path is no longer signal-less if they stay.

**Architecture:** A new internal validator module, `src/MetaComponents/InputVisibility.js`, resolves an
`inputs: { acceptHeader: boolean }` bag the way `Theme.js` resolves a theme bag — rejecting an unknown key by
name. `CalendarControls`' constructor applies it by calling `_acceptHeaderInput.hide()`, which
`ApiOptions.appendTo()` reads on both construction paths. Separately, `CalendarControls.fetch()`,
`CalendarViewer.fetch()` and `DayViewer.fetch()` each store `promise.catch( () => {} )` in their existing
`#settled` field, preserving every clause of the published contract.

**Tech Stack:** ES2022 JavaScript modules, Jest 29 (jsdom), TypeScript 5.7 for `.d.ts` emit only, prettier,
markdownlint-cli2.

## Global Constraints

- Default behaviour must not change anywhere. The accept-header input renders by default on every component
  that renders it today, `ApiExplorer` very much included.
- `settled` keeps its published contract verbatim: always resolves, never rejects, resolves with `undefined`,
  is the promise stored **after** each factory's existing `.catch`, is already resolved when no fetch ran,
  and throws once disposed.
- Reject for programmer error: an unknown key inside `inputs` is rejected **by name**; a non-boolean value is
  rejected naming the key and `describeType()`'s type name.
- Formatting is prettier's: 4-space indent, single quotes (`.prettierrc`). Comparisons in this codebase are
  written Yoda-style (`false === x`); match the surrounding code.
- Out of scope, on hold on sibling branches: `src/Messages.js` and `Input` label text (#59); theme override
  resolution in `Theme.js` and its call sites (#60); renaming the underscore accessors (#62); `appendTo()`
  slot shapes (#63).
- Verification gates, all of which must pass: `yarn test`, `yarn compile && yarn lint:dts`, `yarn format:js`,
  `yarn format:md`, `yarn lint:md`. Baseline on `main`: 64 suites / 1191 tests.

---

### Task 1: `resolveInputVisibility()` — the validator

**Files:**

- Create: `src/MetaComponents/InputVisibility.js`
- Test: `src/__tests__/InputVisibility.test.js`

**Interfaces:**

- Produces: `resolveInputVisibility( inputs, componentName )` → `{ acceptHeader: boolean }`. Accepts
  `null`/`undefined` as "no bag" and returns `{ acceptHeader: true }`. Throws for a non-plain-object bag, an
  unknown key, or a non-boolean value. A key whose value is exactly `undefined` counts as absent.

- [ ] **Step 1: Write the failing test** — `src/__tests__/InputVisibility.test.js`

```javascript
import { describe, it, expect } from '@jest/globals';
import { resolveInputVisibility } from '../MetaComponents/InputVisibility.js';

describe('resolveInputVisibility', () => {
    it('defaults every input to visible when no bag is given', () => {
        expect(resolveInputVisibility(undefined, 'CalendarControls')).toEqual({
            acceptHeader: true,
        });
        expect(resolveInputVisibility(null, 'CalendarControls')).toEqual({
            acceptHeader: true,
        });
    });

    it('reads an explicit boolean', () => {
        expect(
            resolveInputVisibility({ acceptHeader: false }, 'CalendarControls'),
        ).toEqual({ acceptHeader: false });
        expect(
            resolveInputVisibility({ acceptHeader: true }, 'CalendarControls'),
        ).toEqual({ acceptHeader: true });
    });

    it('treats a key present with an explicit undefined as absent', () => {
        expect(
            resolveInputVisibility(
                { acceptHeader: undefined },
                'CalendarControls',
            ),
        ).toEqual({ acceptHeader: true });
    });

    it('rejects a bag that is not a plain object, naming the type', () => {
        expect(() => resolveInputVisibility('acceptHeader', 'ApiExplorer')).toThrow(
            /ApiExplorer: inputs.*found type: string/,
        );
        expect(() => resolveInputVisibility([1], 'ApiExplorer')).toThrow(
            /found type: array/,
        );
    });

    it('rejects an unknown key by name', () => {
        expect(() =>
            resolveInputVisibility({ acceptHeder: false }, 'CalendarViewer'),
        ).toThrow(/CalendarViewer: unknown inputs option `acceptHeder`/);
    });

    it('rejects a non-boolean value, naming the key and the type', () => {
        expect(() =>
            resolveInputVisibility({ acceptHeader: 'no' }, 'CalendarControls'),
        ).toThrow(/acceptHeader.*boolean.*found type: string/);
    });

    it('rejects nothing partially — an unknown key throws before any value is read', () => {
        expect(() =>
            resolveInputVisibility(
                { acceptHeader: false, nope: true },
                'CalendarControls',
            ),
        ).toThrow(/unknown inputs option `nope`/);
    });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `yarn test src/__tests__/InputVisibility.test.js`
Expected: FAIL — cannot resolve `../MetaComponents/InputVisibility.js`.

- [ ] **Step 3: Write the module**

```javascript
/**
 * Resolves a meta-component's `inputs` bag into per-input visibility flags.
 *
 * Internal, and deliberately NOT exported from `src/index.js`, on the same
 * reasoning as `Theme.js`, `LocaleValidation.js` and `OptionsValidation.js`.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import { assertPlainOptions, describeType } from '../OptionsValidation.js';

/** The keys an `inputs` bag may name. @type {Readonly<string[]>} */
const INPUT_KEYS = Object.freeze(['acceptHeader']);

/** Every input is rendered unless the bag says otherwise. */
const DEFAULTS = Object.freeze({ acceptHeader: true });

export function resolveInputVisibility(inputs, componentName) {
    if (null === inputs || undefined === inputs) {
        return { ...DEFAULTS };
    }
    try {
        assertPlainOptions(inputs, `${componentName}: inputs`);
    } catch {
        throw new Error(
            `${componentName}: inputs must be an object naming { acceptHeader }, but found type: ${describeType(inputs)}`,
        );
    }
    for (const key of Object.keys(inputs)) {
        if (false === INPUT_KEYS.includes(key)) {
            throw new Error(
                `${componentName}: unknown inputs option \`${key}\``,
            );
        }
    }
    const resolved = { ...DEFAULTS };
    for (const key of INPUT_KEYS) {
        if (false === Object.hasOwn(inputs, key) || undefined === inputs[key]) {
            continue;
        }
        if (typeof inputs[key] !== 'boolean') {
            throw new Error(
                `${componentName}: inputs.${key} must be of type \`boolean\` but found type: ${describeType(inputs[key])}`,
            );
        }
        resolved[key] = inputs[key];
    }
    return resolved;
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `yarn test src/__tests__/InputVisibility.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/MetaComponents/InputVisibility.js src/__tests__/InputVisibility.test.js
git commit -m "Add resolveInputVisibility(), the inputs-bag validator (#61)"
```

---

### Task 2: `CalendarControls` honours `inputs`, and `CalendarViewer`/`ApiExplorer` inherit it

**Files:**

- Modify: `src/MetaComponents/CalendarControls.js` (constructor + its JSDoc, `mountInto()` JSDoc)
- Modify: `src/MetaComponents/CalendarViewer.js` (constructor JSDoc only)
- Modify: `src/MetaComponents/ApiExplorer.js` (constructor JSDoc only)
- Test: `src/__tests__/MetaComponentsInputsOption.test.js`

**Interfaces:**

- Consumes: `resolveInputVisibility()` from Task 1.
- Produces: an `inputs` option on `CalendarControls`, forwarded verbatim by `CalendarViewer` and
  `ApiExplorer` (both already pass their whole bag to `new CalendarControls( bag )`).

- [ ] **Step 1: Write the failing test** — `src/__tests__/MetaComponentsInputsOption.test.js`

The test must cover, with `ApiBase.fromMetadata( API_URL, FULL_METADATA )` in `beforeEach()` (no network):

1. `CalendarControls.mountInto( '#mount', { locale: 'en' } )` renders a `select[name="return_type"]` inside
   `#mount` — the default.
2. The same call with `inputs: { acceptHeader: false }` renders none.
3. `new CalendarControls( { locale: 'en', inputs: { acceptHeader: false } } )` + `appendTo( '#mount' )`
   renders none — the option works on the constructor path too.
4. `CalendarViewer.mountInto( { controls: '#mount', calendar: '#calendar' }, { inputs: { acceptHeader:
   false } } )` renders none in `#mount`.
5. `ApiExplorer.mountInto( { pathBuilder: '#pb', allPaths: '#all' }, { locale: 'en' } )` renders the input
   in `#all` **by default** — the regression guard for `PathBuilder`'s `return_type` wiring — and renders
   none with `inputs: { acceptHeader: false }`.
6. An unknown key rejects, naming it, and mounts nothing (`#mount` stays empty).
7. A non-boolean value rejects; a non-object `inputs` rejects.
8. `inputs: { acceptHeader: true }` renders the input.

- [ ] **Step 2: Run it and watch it fail**

Run: `yarn test src/__tests__/MetaComponentsInputsOption.test.js`
Expected: FAIL — every "hidden" assertion fails, because the option is ignored.

- [ ] **Step 3: Implement in `CalendarControls`**

Import `resolveInputVisibility` and, immediately after `this.#apiOptions` is constructed and filtered, add:

```javascript
        // Applied HERE, in the constructor, rather than being left to the
        // caller between construction and the append: `hide()` sets a flag
        // `ApiOptions.appendTo()` reads, so a caller could only express it in a
        // window `mountInto()` never opens — which is what forced every real
        // consumer onto the constructor path and away from `settled` (#61).
        const inputVisibility = resolveInputVisibility(
            inputs,
            'CalendarControls',
        );
        if (false === inputVisibility.acceptHeader) {
            this.#apiOptions._acceptHeaderInput.hide();
        }
```

with `inputs` destructured from the options bag alongside `locale, filter, theme, apiClient`. Document the
option in the constructor's JSDoc (`@param {Object} [options.inputs]`), and add the same `@param` line to
`CalendarViewer`'s and `ApiExplorer`'s constructor JSDoc.

- [ ] **Step 4: Run the test and watch it pass**

Run: `yarn test src/__tests__/MetaComponentsInputsOption.test.js`
Expected: PASS. Then `yarn test` — the whole suite, to confirm nothing regressed.

- [ ] **Step 5: Commit**

```bash
git add src/MetaComponents src/__tests__/MetaComponentsInputsOption.test.js
git commit -m "Accept inputs: { acceptHeader } on the meta-components (#61)"
```

---

### Task 3: `settled` observes the constructor path's `fetch()`

**Files:**

- Modify: `src/MetaComponents/CalendarControls.js` (`fetch()` + its JSDoc, `settled` getter JSDoc)
- Modify: `src/MetaComponents/CalendarViewer.js` (`fetch()` + its JSDoc, `settled` getter JSDoc)
- Modify: `src/MetaComponents/DayViewer.js` (`fetch()` + its JSDoc, `settled` getter JSDoc)
- Test: `src/__tests__/MetaComponentsSettled.test.js` (extend; also update the stale comment at the
  "is resolved on a hand-constructed instance" case)

**Interfaces:**

- Consumes: the existing `#settled` field on all three classes.
- Produces: no new public members. `fetch()` still returns the same `Promise<Object>` it does today.

- [ ] **Step 1: Write the failing tests** — a new `describe` block in `MetaComponentsSettled.test.js`

Covering, using the file's existing `deferRequests()`/`drain()`/`failRequests()` helpers:

1. A hand-constructed `CalendarControls` wired with `listenTo( apiClient )`: `settled` is resolved before
   `fetch()`, pending after it, and resolves once the response lands.
2. The same for `CalendarViewer` and `DayViewer`.
3. `settled` still never rejects when that `fetch()` fails — and the promise `fetch()` returned **does**
   reject (assert both, so the swallow is proved to be a separate branch).
4. A second `fetch()` replaces `settled`: after the first has landed, `settled` is pending again until the
   second lands.
5. `fetch()` throwing synchronously with no client wired leaves `settled` resolved.
6. `mountInto()`'s `settled` is still the error-delivering branch: with a failing initial fetch and an
   `onError` callback, `await controls.settled` and the callback has already fired (guards the assignment
   ordering between `fetch()`'s store and the factory's).

- [ ] **Step 2: Run them and watch them fail**

Run: `yarn test src/__tests__/MetaComponentsSettled.test.js`
Expected: FAIL — `settled` stays resolved after a constructor-path `fetch()`.

- [ ] **Step 3: Implement**

In `CalendarControls.fetch()`, replace the three direct `return` statements with a single stored promise:

```javascript
        const promise = this.#fetchFor(element, value);
        // `settled` tracks the most recent fetch this component issued —
        // `mountInto()`'s initial one, or this call on the constructor path.
        // The `.catch` is a HANDLED derived branch: the promise returned below
        // is untouched and still the caller's to handle, so this neither
        // creates nor removes an unhandled rejection (#61).
        this.#settled = promise.catch(() => {});
        return promise;
```

…where the dispatch itself stays exactly as it is today (inline it rather than adding a helper if that reads
better; the three-way `''`/`diocesan`/national dispatch must not change). `CalendarViewer.fetch()` and
`DayViewer.fetch()` get the same two lines around their own single call.

`mountInto()` in all three classes keeps its existing `#settled = …catch( … )` assignment, which runs after
`fetch()`'s and therefore still wins — do not delete it.

Update the three `settled` getters' JSDoc from "Resolves once `mountInto()`'s initial fetch has settled" to
the fetch-most-recently-issued wording, keeping every other clause verbatim.

- [ ] **Step 4: Run the tests and watch them pass**

Run: `yarn test src/__tests__/MetaComponentsSettled.test.js`, then `yarn test`.
Expected: PASS, 64 suites plus the new one.

- [ ] **Step 5: Commit**

```bash
git add src/MetaComponents src/__tests__/MetaComponentsSettled.test.js
git commit -m "settled now observes a constructor-path fetch() too (#61)"
```

---

### Task 4: Documentation

**Files:**

- Modify: `docs/meta-components.md` — rewrite the "Use the constructor path when something must happen
  between construction and the mount" passage; switch both `_acceptHeaderInput.hide()` examples to the
  option; add `inputs` to the `CalendarControls`, `CalendarViewer` and `ApiExplorer` option tables; update
  the `settled` rows and prose in all three "Public members" tables.
- Modify: `CLAUDE.md` — the `settled` clause and a new sentence on the `inputs` bag in the Meta-Components
  section.
- Modify: `docs/api-options.md` — note the meta-component option beside `_acceptHeaderInput.hide()`.
- Modify: `CHANGELOG.md` — one `## [Unreleased]` entry scoped to #61.

- [ ] **Step 1: Rewrite the passage**, so it no longer cites a case the code now covers:

> **Both construction paths take the same options.** The accept-header input used to be the exception —
> `AcceptHeaderInput.hide()` sets a flag `ApiOptions.appendTo()` reads, so it was only expressible between
> construction and the append, a window `mountInto()` does not open. Since 2.8.0 it is
> `inputs: { acceptHeader: false }`, and `mountInto()` covers it. Reach for the constructor when you want the
> instance synchronously — the `ApiBase` is already loaded and you have your own mount sequencing — not
> because an option is out of reach.

- [ ] **Step 2: Run the markdown gates**

Run: `yarn format:md:fix && yarn format:md && yarn lint:md`
Expected: prettier reports nothing to change; markdownlint reports zero errors.

- [ ] **Step 3: Commit**

```bash
git add docs CLAUDE.md CHANGELOG.md
git commit -m "Document inputs: { acceptHeader } and settled's widened contract (#61)"
```

---

### Task 5: Verification gates

- [ ] **Step 1:** `yarn test` — expect every suite green, ≥ 1191 tests plus the new ones.
- [ ] **Step 2:** `yarn compile && yarn lint:dts` — expect no TypeScript errors from the emitted `.d.ts`.
- [ ] **Step 3:** `yarn format:js` (repair with `yarn format:js:fix`) — expect no files needing changes.
- [ ] **Step 4:** `yarn format:md` and `yarn lint:md` — expect clean.
- [ ] **Step 5:** Code review, then address whatever holds up.
