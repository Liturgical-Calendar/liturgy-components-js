# Theme Presets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended)
> or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax
> for tracking.

**Goal:** Let a meta-component theme bag name a framework preset (`theme: 'bootstrap5'` or
`{ preset: 'bootstrap5', … }`) that expands to the standard Bootstrap class set, overridable per key.

**Architecture:** A preset expands to a plain theme bag — flat role keys plus, on components that have an
`ApiOptions`, an empty `apiOptions` bundle that opens the existing gate. Expansion happens inside
`Theme.js` at its four raw-bag entry points, so no meta-component file needs to change and every existing
resolution and validation rule then applies unchanged.

**Tech Stack:** ES2022 JavaScript modules, JSDoc-typed, Jest 30, prettier (`tabWidth: 4`,
`singleQuote: true`), markdownlint-cli2.

**Spec:** `docs/superpowers/specs/2026-08-15-theme-presets-design.md`

## Global Constraints

- Line endings are LF everywhere (`.gitattributes` `* text=auto eol=lf`).
- `src/MetaComponents/CalendarControls.js` MUST NOT be modified — issue #68 owns it in a parallel branch.
- Do not modify `src/ApiOptions/ApiOptions.js`, `src/Messages.js`, `src/WebCalendar/`,
  `src/LiturgyOfAnyDay/`, or `src/MetaComponents/ControlSlots.js`.
- Preset values: `bootstrap5` -> `{ select: 'form-select', input: 'form-control', label: 'form-label' }`;
  `bootstrap4` -> `{ select: 'form-control', input: 'form-control' }` (no `label`).
- `THEME_CHILD_KEYS` in `src/MetaComponents/Theme.js` is the authority for which components take
  `apiOptions`; never write a second list.
- Every gate must pass at the end: `yarn test`, `yarn compile && yarn lint:dts`, `yarn format:js`,
  `yarn format:md`, `yarn lint:md`. Baseline on `main` is 83 suites / 1601 tests.
- Every new test asserting the property its task exists to guarantee must be mutation-verified: break the
  implementation, confirm the test goes red, restore.

---

### Task 1: The preset table and its expansion helper

**Files:**

- Create: `src/MetaComponents/ThemePresets.js`
- Test: `src/__tests__/ThemePresets.test.js`

**Interfaces:**

- Produces:
  - `export const ThemePreset` — frozen `{ BOOTSTRAP_4: 'bootstrap4', BOOTSTRAP_5: 'bootstrap5' }`.
  - `export function hasThemePreset( theme ): boolean` — true when the bag asks for a preset (a string
    theme, or an object with an own `preset` key). `null`/`undefined` are false.
  - `export function expandThemePreset( theme, componentName = null ): Object` — the expanded plain bag,
    with `preset` removed. Throws for an unknown or non-string preset name. Only call when
    `hasThemePreset()` is true.
  - `export const THEME_PRESET_NAMES` — frozen array of the valid names, for messages and tests.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/ThemePresets.test.js`:

```javascript
import {
    ThemePreset,
    THEME_PRESET_NAMES,
    hasThemePreset,
    expandThemePreset,
} from '../MetaComponents/ThemePresets.js';

describe('ThemePresets', () => {
    it('names exactly the presets it defines', () => {
        expect(Object.values(ThemePreset).sort()).toEqual(
            ['bootstrap4', 'bootstrap5'].sort(),
        );
        expect([...THEME_PRESET_NAMES].sort()).toEqual(
            Object.values(ThemePreset).sort(),
        );
    });

    it('recognises both spellings, and nothing else', () => {
        expect(hasThemePreset('bootstrap5')).toBe(true);
        expect(hasThemePreset({ preset: 'bootstrap5' })).toBe(true);
        expect(hasThemePreset({ select: 'form-select' })).toBe(false);
        expect(hasThemePreset(null)).toBe(false);
        expect(hasThemePreset(undefined)).toBe(false);
    });

    it('expands bootstrap5 to the three control roles', () => {
        expect(expandThemePreset('bootstrap5')).toEqual({
            select: 'form-select',
            input: 'form-control',
            label: 'form-label',
        });
    });

    it('expands bootstrap4 without a label class, which Bootstrap 4 does not define', () => {
        expect(expandThemePreset('bootstrap4')).toEqual({
            select: 'form-control',
            input: 'form-control',
        });
    });

    it('lets the caller keys win per key, and drops the preset key itself', () => {
        expect(
            expandThemePreset({
                preset: 'bootstrap5',
                select: 'form-select-lg',
                riteSelect: { class: 'x' },
            }),
        ).toEqual({
            select: 'form-select-lg',
            input: 'form-control',
            label: 'form-label',
            riteSelect: { class: 'x' },
        });
    });

    it('never mutates the caller bag', () => {
        const theme = { preset: 'bootstrap5' };
        expandThemePreset(theme);
        expect(theme).toEqual({ preset: 'bootstrap5' });
    });

    it('throws for an unknown preset, naming it and the valid ones', () => {
        expect(() => expandThemePreset('bootstrap6', 'CalendarViewer')).toThrow(
            /CalendarViewer: theme preset 'bootstrap6' is not recognised\. Valid presets are: bootstrap4, bootstrap5\./,
        );
    });

    it('falls back to a Theme prefix when no component name is known', () => {
        expect(() => expandThemePreset({ preset: 'nope' })).toThrow(
            /^Theme: theme preset 'nope' is not recognised\./,
        );
    });

    it('throws for a non-string preset value, naming the type', () => {
        expect(() => expandThemePreset({ preset: 5 }, 'DayViewer')).toThrow(
            /DayViewer: theme\.preset must be of type `string` but found type: number/,
        );
    });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `yarn test src/__tests__/ThemePresets.test.js`
Expected: FAIL — cannot resolve `../MetaComponents/ThemePresets.js`.

- [ ] **Step 3: Write `src/MetaComponents/ThemePresets.js`**

```javascript
/**
 * Named framework presets for a meta-component's theme bag (issue #67).
 *
 * Every consuming page in this org rewrote the same mapping from HTML role to
 * Bootstrap class — `form-select` for a `<select>`, `form-control` for a text or
 * number input, `form-label` for a label — and one example carried a runtime
 * Bootstrap-version probe to choose between two spellings of it. None of that is
 * the consumer's decision: it is what the framework calls those things.
 *
 * **Scope, stated so it can be held to.** A preset names CONTROLS, never LAYOUT.
 * It supplies no wrapper class, no grid span and no spacing utility, and it ships
 * no class the named framework does not itself define. `CLAUDE.md`'s "takes no
 * position on CSS" stands everywhere else; this is a bounded exception, and the
 * bound is the framework's own control vocabulary.
 *
 * The class table is deliberately NOT exported from `src/index.js` — only the
 * `ThemePreset` names are. The strings must stay free to be corrected in a patch
 * release when a framework moves or a mapping here turns out to be wrong;
 * exporting them would freeze a mapping we specifically want to be able to fix.
 * The names and the table live in ONE file so the two cannot drift.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import { describeType } from '../OptionsValidation.js';

/**
 * The preset names a theme bag may use.
 *
 * Exported from `src/index.js`, like every other closed set of magic strings in
 * this library (`ApiOptionsFilter`, `CalendarSelectFilter`, `YearType`), so a
 * TypeScript consumer gets completion and a compile error rather than a runtime
 * throw.
 *
 * @enum {{BOOTSTRAP_4: 'bootstrap4', BOOTSTRAP_5: 'bootstrap5'}}
 */
export const ThemePreset = Object.freeze({
    BOOTSTRAP_4: 'bootstrap4',
    BOOTSTRAP_5: 'bootstrap5',
});

/**
 * What each preset resolves to, in the theme bag's own flat role vocabulary.
 *
 * Three keys at most, and never `wrapper`. A wrapper class is layout: Bootstrap 4's
 * `.form-group` was removed in Bootstrap 5 in favour of spacing utilities, a grid
 * form wraps in `.col-md-*` instead, and the spans are budgeted per row by the page.
 * Supplying one would also consume `Input.wrapper()`'s one-shot allowance on all ten
 * `ApiOptions` inputs and close `wrapperClass()` on them — which is one of the two
 * reasons `theme.apiOptions` is an opt-in gate, and the reason a preset may open that
 * gate safely.
 *
 * **`bootstrap4` emits no `label` on purpose.** `.form-label` is a Bootstrap 5 class;
 * Bootstrap 4 form labels carry no class at all (`.col-form-label` is a different
 * thing, for horizontal forms). Emitting it anyway would be inventing CSS. A Bootstrap 4
 * consumer who wants label utilities writes them: `{ preset: 'bootstrap4', label: 'd-block mb-1' }`.
 *
 * @type {Readonly<Object<string, Readonly<{select: string, input: string, label?: string}>>>}
 */
const PRESET_CLASSES = Object.freeze({
    [ThemePreset.BOOTSTRAP_4]: Object.freeze({
        select: 'form-control',
        input: 'form-control',
    }),
    [ThemePreset.BOOTSTRAP_5]: Object.freeze({
        select: 'form-select',
        input: 'form-control',
        label: 'form-label',
    }),
});

/**
 * The valid preset names, for error messages and for the drift test.
 *
 * @type {Readonly<string[]>}
 */
export const THEME_PRESET_NAMES = Object.freeze(Object.keys(PRESET_CLASSES));

/**
 * Whether a theme bag ASKS for a preset — regardless of whether the name is valid.
 *
 * Separated from {@link expandThemePreset} so that "asks for a preset" and "names a
 * preset that exists" are two questions with two answers. Folding them together would
 * make an unknown name indistinguishable from no preset at all, and the caller would
 * then carry on with the caller's bag rather than throwing — the silent-drop failure
 * mode this module's neighbours are emphatic about.
 *
 * A bare string is a preset name. That spelling is purely additive: a string was never
 * a valid `theme`, since `assertTheme()` runs `assertPlainOptions()` on it. It cannot be
 * confused with the per-child string form (`theme.riteSelect: 'form-select'`, meaning
 * `{ class }`), which lives one level down and is never read here.
 *
 * @param {unknown} theme - The candidate theme bag.
 * @returns {boolean} Whether it asks for a preset.
 */
export function hasThemePreset(theme) {
    if (null === theme || undefined === theme) {
        return false;
    }
    if (typeof theme === 'string') {
        return true;
    }
    if (typeof theme !== 'object') {
        return false;
    }
    return Object.hasOwn(theme, 'preset');
}

/**
 * Expands a preset-bearing theme bag into a plain one.
 *
 * The preset's flat keys are spread FIRST and the caller's own keys second, so a
 * caller's explicit key beats the preset's, per key. Everything downstream — the flat
 * default versus per-child override in `resolveChildTheme()`, the four tiers in
 * `resolveApiOptionsInputTheme()` — then applies unchanged: a preset is one more tier
 * below the flat keys, expressed as a shallow spread rather than as new machinery.
 *
 * Call only when {@link hasThemePreset} is true.
 *
 * @param {string|Object} theme - A preset name, or a bag carrying a `preset` key.
 * @param {string|null} [componentName=null] - The rejecting component, when known.
 * @returns {Object} A fresh plain bag, with `preset` removed.
 * @throws {Error} If the preset name is not a string, or is not a known preset.
 */
export function expandThemePreset(theme, componentName = null) {
    const prefix = null === componentName ? 'Theme' : componentName;
    const name = typeof theme === 'string' ? theme : theme.preset;
    if (typeof name !== 'string') {
        throw new Error(
            `${prefix}: theme.preset must be of type \`string\` but found type: ${describeType(name)}`,
        );
    }
    if (false === Object.hasOwn(PRESET_CLASSES, name)) {
        throw new Error(
            `${prefix}: theme preset '${name}' is not recognised. Valid presets are: ${THEME_PRESET_NAMES.join(', ')}.`,
        );
    }
    const rest = typeof theme === 'string' ? {} : { ...theme };
    delete rest.preset;
    return { ...PRESET_CLASSES[name], ...rest };
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `yarn test src/__tests__/ThemePresets.test.js`
Expected: PASS.

- [ ] **Step 5: Mutation-verify the drift test**

Temporarily add `BOOTSTRAP_3: 'bootstrap3'` to `ThemePreset` without adding it to `PRESET_CLASSES`. Run
the suite; the first test must fail. Restore.

- [ ] **Step 6: Commit**

```bash
git add src/MetaComponents/ThemePresets.js src/__tests__/ThemePresets.test.js
git commit -S -m "Add the theme preset table and its expansion helper (#67)"
```

---

### Task 2: Wire expansion into `Theme.js`

**Files:**

- Modify: `src/MetaComponents/Theme.js`
- Test: `src/__tests__/MetaComponentThemePresets.test.js` (create)

**Interfaces:**

- Consumes: `hasThemePreset()`, `expandThemePreset()`, `ThemePreset` from Task 1.
- Produces: `assertTheme()`, `narrowTheme()`, `resolveChildTheme()` and
  `resolveApiOptionsInputTheme()` all accept a preset-bearing bag (string or object) and all throw on an
  unknown preset. Signatures are unchanged.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/MetaComponentThemePresets.test.js`:

```javascript
import {
    assertTheme,
    narrowTheme,
    resolveChildTheme,
    resolveApiOptionsInputTheme,
    THEME_CHILD_KEYS,
} from '../MetaComponents/Theme.js';
import {
    THEME_PRESET_NAMES,
    expandThemePreset,
} from '../MetaComponents/ThemePresets.js';

describe('theme presets in Theme.js', () => {
    it('resolves a select child from a bare preset name', () => {
        expect(resolveChildTheme('bootstrap5', 'riteSelect')).toEqual({
            class: 'form-select',
            labelClass: 'form-label',
        });
    });

    it('lets a per-child override beat the preset, per key', () => {
        expect(
            resolveChildTheme(
                { preset: 'bootstrap5', riteSelect: { class: 'x' } },
                'riteSelect',
            ),
        ).toEqual({ class: 'x', labelClass: 'form-label' });
    });

    it('opens the apiOptions gate, so the preset reaches all ten inputs', () => {
        expect(resolveApiOptionsInputTheme('bootstrap5', 'yearInput')).toEqual({
            class: 'form-control',
            labelClass: 'form-label',
        });
        expect(
            resolveApiOptionsInputTheme('bootstrap5', 'epiphanyInput'),
        ).toEqual({ class: 'form-select', labelClass: 'form-label' });
    });

    it('keeps a caller-written apiOptions bundle rather than replacing it', () => {
        expect(
            resolveApiOptionsInputTheme(
                {
                    preset: 'bootstrap5',
                    apiOptions: { yearInput: { class: 'y' } },
                },
                'yearInput',
            ),
        ).toEqual({ class: 'y', labelClass: 'form-label' });
    });

    it('does not inject apiOptions for a component that has no ApiOptions', () => {
        expect(() =>
            assertTheme('bootstrap5', 'CalendarResourcePicker'),
        ).not.toThrow();
        expect(narrowTheme('bootstrap5', 'CalendarResourcePicker')).toEqual({
            select: 'form-select',
            input: 'form-control',
            label: 'form-label',
        });
    });

    it('injects apiOptions for every component whose registry entry has it', () => {
        expect(narrowTheme('bootstrap5', 'CalendarControls')).toEqual({
            select: 'form-select',
            input: 'form-control',
            label: 'form-label',
            apiOptions: {},
        });
    });

    // The guard, not a second list: whatever a preset expands to must survive
    // `assertTheme()` under every component's own name.
    it('expands to something every component accepts', () => {
        for (const componentName of Object.keys(THEME_CHILD_KEYS)) {
            for (const preset of THEME_PRESET_NAMES) {
                expect(() => assertTheme(preset, componentName)).not.toThrow();
            }
        }
    });

    it('throws for an unknown preset on every entry point', () => {
        expect(() => assertTheme('bootstrap6', 'DayViewer')).toThrow(
            /theme preset 'bootstrap6' is not recognised/,
        );
        expect(() => narrowTheme('bootstrap6', 'CalendarControls')).toThrow(
            /theme preset 'bootstrap6' is not recognised/,
        );
        expect(() => resolveChildTheme('bootstrap6', 'riteSelect')).toThrow(
            /theme preset 'bootstrap6' is not recognised/,
        );
        expect(() =>
            resolveApiOptionsInputTheme('bootstrap6', 'yearInput'),
        ).toThrow(/theme preset 'bootstrap6' is not recognised/);
    });

    it('leaves a bag with no preset exactly as it was', () => {
        const theme = { select: 'form-select' };
        expect(resolveChildTheme(theme, 'riteSelect')).toEqual({
            class: 'form-select',
        });
        expect(theme).toEqual({ select: 'form-select' });
        expect(expandThemePreset).toBeInstanceOf(Function);
    });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `yarn test src/__tests__/MetaComponentThemePresets.test.js`
Expected: FAIL — `resolveChildTheme('bootstrap5', …)` returns `{}` today, and `assertTheme` throws
`must be of type object`.

- [ ] **Step 3: Add the private expansion to `Theme.js`**

Add to the imports at the top of `src/MetaComponents/Theme.js`:

```javascript
import { hasThemePreset, expandThemePreset } from './ThemePresets.js';
```

Insert this function immediately above `export function assertTheme(`:

```javascript
/**
 * Expands a theme bag's preset, if it names one, before anything else reads it (#67).
 *
 * Applied at every entry point in this module that receives a RAW bag — the two
 * component-aware guards and the two resolvers — rather than at the six components'
 * call sites. Two things follow, and both are the point:
 *
 * 1. **No meta-component changes.** `CalendarControls` keeps its `theme` local as the
 *    caller wrote it, string or bag, and every `Theme.js` call it makes expands for
 *    itself.
 * 2. **An unknown preset throws on every path**, not only on whichever happens to run
 *    first. Relying on `assertTheme()` running before the resolvers is exactly the
 *    ordering assumption that has silently disabled a check in this codebase before.
 *
 * The `apiOptions` injection is what OPENS the opt-in gate for a preset, and it is
 * deliberate. That gate exists so no bag written before 2.8.0 restyles a form on
 * upgrade; `preset` is a key no such bag contains, so nothing that renders today can
 * change. Against that stands the issue's own purpose: a preset that stopped short of
 * the form would leave the ten inputs to the process-wide `Input.setGlobal*` setters,
 * which the theme bag exists to replace. `{}` is all that is injected — the existing
 * four-tier resolver then carries the preset's own flat keys down as tier 4, which is
 * exactly what `apiOptions: {}` has always meant. A bundle the caller wrote is kept
 * untouched. This is only safe because a preset supplies no `wrapper` class: the gate's
 * other justification is that a flat wrapper consumes `Input.wrapper()`'s one-shot
 * allowance on ten inputs, and `ThemePresets.js` never emits one.
 *
 * Whether to inject is read from {@link THEME_CHILD_KEYS} via {@link childKeysFor},
 * never from a second list, so a component that gains or loses an `ApiOptions` needs no
 * change here.
 *
 * @param {unknown} theme - The caller's theme bag, possibly a preset name.
 * @param {string|null} componentName - The component, when the caller knows it.
 * @param {boolean} withApiOptions - Whether to open the `apiOptions` gate.
 * @returns {unknown} The expanded bag, or `theme` untouched when it names no preset.
 * @throws {Error} If the bag names a preset that does not exist.
 */
function expandTheme(theme, componentName, withApiOptions) {
    if (false === hasThemePreset(theme)) {
        return theme;
    }
    const expanded = expandThemePreset(theme, componentName);
    if (
        withApiOptions &&
        false === Object.hasOwn(expanded, API_OPTIONS_KEY)
    ) {
        expanded[API_OPTIONS_KEY] = {};
    }
    return expanded;
}
```

- [ ] **Step 4: Call it from the four entry points**

In `assertTheme()`, replace the two lines after `const childKeys = childKeysFor( componentName );`:

```javascript
    const childKeys = childKeysFor(componentName);
    theme = expandTheme(
        theme,
        componentName,
        childKeys.includes(API_OPTIONS_KEY),
    );
    if (null === theme || undefined === theme) {
        return;
    }
```

In `narrowTheme()`, after `const childKeys = childKeysFor( componentName );`:

```javascript
    const childKeys = childKeysFor(componentName);
    theme = expandTheme(
        theme,
        componentName,
        childKeys.includes(API_OPTIONS_KEY),
    );
    if (null === theme || undefined === theme) {
        return theme;
    }
```

In `resolveChildTheme()`, as the first statement:

```javascript
    // `false`: this function never reads `apiOptions`, so injecting it here would
    // be inert. `resolveApiOptionsInputTheme()` is where the gate matters.
    theme = expandTheme(theme, null, false);
    if (null === theme || undefined === theme) {
        return {};
    }
```

In `resolveApiOptionsInputTheme()`, as the first statement:

```javascript
    // `true`: only `applyApiOptionsTheme()` reaches here, and only from a component
    // that has an `ApiOptions` for the bundle to describe.
    theme = expandTheme(theme, null, true);
    if (null === theme || undefined === theme) {
        return {};
    }
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `yarn test src/__tests__/MetaComponentThemePresets.test.js src/__tests__/MetaComponentTheme.test.js src/__tests__/MetaComponentThemeApiOptions.test.js src/__tests__/MetaComponentThemeComponentAware.test.js`
Expected: PASS.

- [ ] **Step 6: Mutation-verify the guard test**

Temporarily add `wrapperr: 'x'` to `PRESET_CLASSES[ThemePreset.BOOTSTRAP_5]`. Run
`yarn test src/__tests__/MetaComponentThemePresets.test.js`; the "expands to something every component
accepts" test must fail for all six components. Restore.

Then temporarily change `resolveChildTheme()`'s `expandTheme( theme, null, false )` back to nothing; the
"throws for an unknown preset on every entry point" test must fail. Restore.

- [ ] **Step 7: Commit**

```bash
git add src/MetaComponents/Theme.js src/__tests__/MetaComponentThemePresets.test.js
git commit -S -m "Expand a theme preset at every Theme.js entry point (#67)"
```

---

### Task 3: Stop a flat class reaching a child that is not a control

**Files:**

- Modify: `src/MetaComponents/Theme.js` (`CLASS_KEY_BY_ROLE`, `OVERRIDE_KEYS_BY_ROLE`,
  `collectFlatDefaults`)
- Modify: `src/SubscriptionBuilder/SubscriptionBuilder.js:118`
- Test: `src/__tests__/MetaComponentThemePresets.test.js` (extend)

**Interfaces:**

- Consumes: nothing new.
- Produces: `resolveChildTheme( theme, childKey, 'liturgy' )` and
  `resolveChildTheme( theme, childKey, 'url' )` no longer read a flat class key.

Without this the preset is unusable on `DayViewer` and `SubscriptionBuilder`:
`CLASS_KEY_BY_ROLE[ role ] ?? 'select'` makes a role with no entry read `theme.select`, so
`theme: 'bootstrap5'` would put `form-select` — border, padding and the dropdown-arrow background image —
onto the `LiturgyOfAnyDay` container and onto the subscription URL's copy `<button>`. Neither is a
`<select>`, and the docs have always said the flat key applies to "every `<select>` child".

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/MetaComponentThemePresets.test.js`:

```javascript
describe('a flat class reaches controls only', () => {
    it('does not reach the liturgy child, which is not a select', () => {
        expect(
            resolveChildTheme('bootstrap5', 'liturgy', 'liturgy'),
        ).not.toHaveProperty('class');
        expect(
            resolveChildTheme({ select: 'form-select' }, 'liturgy', 'liturgy'),
        ).not.toHaveProperty('class');
    });

    it('still honours a per-child class on the liturgy child', () => {
        expect(
            resolveChildTheme(
                { preset: 'bootstrap5', liturgy: { class: 'card shadow' } },
                'liturgy',
                'liturgy',
            ),
        ).toEqual({ class: 'card shadow' });
    });

    it('does not reach the subscription URL control, which is a button', () => {
        expect(
            resolveChildTheme('bootstrap5', 'subscriptionUrl', 'url'),
        ).not.toHaveProperty('class');
    });

    it('still honours a per-child class on the subscription URL control', () => {
        expect(
            resolveChildTheme(
                { preset: 'bootstrap5', subscriptionUrl: 'url-box' },
                'subscriptionUrl',
                'url',
            ),
        ).toEqual({ class: 'url-box' });
    });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `yarn test src/__tests__/MetaComponentThemePresets.test.js -t 'reaches controls only'`
Expected: FAIL — `class: 'form-select'` is present on both.

- [ ] **Step 3: Make `CLASS_KEY_BY_ROLE` complete**

In `src/MetaComponents/Theme.js`, extend `CLASS_KEY_BY_ROLE`'s doc comment with:

```text
 * **A role absent from this map takes NO flat class**, and that is the whole content
 * of the map now that it is read without a fallback. `collectFlatDefaults()` used to
 * read `CLASS_KEY_BY_ROLE[ role ] ?? 'select'`, so the two roles with no entry —
 * `liturgy`, and the `url` role the subscription control uses — silently inherited
 * `theme.select`. Neither is a `<select>`: a flat `select` therefore put a framework's
 * select styling (in Bootstrap's case a border, padding and a dropdown-arrow
 * background image) onto a `LiturgyOfAnyDay` card and onto a copy `<button>`, which is
 * not what "applied to every `<select>` child" has ever said in the documentation. A
 * per-child `class` is how those two are styled, and always was.
```

Change `collectFlatDefaults()`'s first two statements from:

```javascript
    const classKey = CLASS_KEY_BY_ROLE[role] ?? 'select';
    if (typeof bag[classKey] === 'string') {
```

to:

```javascript
    const classKey = CLASS_KEY_BY_ROLE[role];
    if (undefined !== classKey && typeof bag[classKey] === 'string') {
```

Add a `url` entry to `OVERRIDE_KEYS_BY_ROLE`, after `liturgy`:

```javascript
    // The subscription URL control: a `<button>` wrapping a `<code>`, with no label
    // and no wrapper of its own, so `class` is the only key `SubscriptionUrl` reads.
    // Naming the role here is what keeps `collectFlatDefaults()` from handing it a
    // flat `select` class it would then apply to a button.
    url: Object.freeze(['class']),
```

- [ ] **Step 4: Point `SubscriptionBuilder` at the new role**

In `src/SubscriptionBuilder/SubscriptionBuilder.js`, change line 118 from:

```javascript
        const urlTheme = resolveChildTheme(bag.theme, 'subscriptionUrl');
```

to:

```javascript
        // The `url` role, not the default `select` one: this control is a
        // `<button>` and reads only `class`, so inheriting the flat `theme.select`
        // would style a button as a dropdown.
        const urlTheme = resolveChildTheme(bag.theme, 'subscriptionUrl', 'url');
```

- [ ] **Step 5: Run the full suite**

Run: `yarn test`
Expected: PASS. If a pre-existing test asserted the old fallback, read it before changing it — none was
found when this plan was written.

- [ ] **Step 6: Mutation-verify**

Restore the `?? 'select'` fallback in `collectFlatDefaults()`; the four new tests must fail. Restore the
fix.

- [ ] **Step 7: Commit**

```bash
git add src/MetaComponents/Theme.js src/SubscriptionBuilder/SubscriptionBuilder.js src/__tests__/MetaComponentThemePresets.test.js
git commit -S -m "Stop a flat theme class reaching a child that is not a control (#67)"
```

---

### Task 4: End-to-end coverage across all six components

**Files:**

- Test: `src/__tests__/MetaComponentThemePresets.test.js` (extend)

**Interfaces:**

- Consumes: everything from Tasks 1-3.
- Produces: nothing further; this is the test that would catch a regression a unit test cannot.

Follow the construction idiom the existing meta-component suites use: `ApiBase.reset()` and
`ApiBase.fromMetadata( url, metadata )` in `beforeEach`, with the fixture from `src/__fixtures__/`. Copy
the exact setup block from `src/__tests__/MetaComponentThemeApiOptions.test.js` rather than inventing one.

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/MetaComponentThemePresets.test.js` a `describe` that, for each of
`CalendarResourcePicker`, `CalendarControls`, `CalendarViewer`, `ApiExplorer`, `DayViewer` and
`SubscriptionBuilder`, constructs the component with `theme: 'bootstrap5'` and asserts:

```javascript
expect(component.riteSelect._domElement.className).toBe('form-select');
expect(component.calendarSelect._domElement.className).toBe('form-select');
```

and, for the five that bundle an `ApiOptions`:

```javascript
expect(component.apiOptions.epiphanyInput._domElement.className).toBe(
    'form-select',
);
expect(component.apiOptions.yearInput._domElement.className).toBe(
    'form-control',
);
expect(component.apiOptions.localeInput._labelElement.className).toBe(
    'form-label',
);
```

Add the two negative assertions from the spec's decision 6:

```javascript
expect(viewer.liturgy._domElement.className).not.toContain('form-select');
expect(builder.url._domElement.className).not.toContain('form-select');
```

(check the public getter names against the components before writing; `DayViewer` exposes `liturgy`, and
`SubscriptionBuilder`'s URL control getter is read from its own class body).

Add one bootstrap4 case:

```javascript
const controls = new CalendarControls({ locale: 'en', theme: 'bootstrap4' });
expect(controls.calendarSelect._domElement.className).toBe('form-control');
expect(controls.apiOptions.localeInput._labelElement.className).toBe('');
```

And one override case:

```javascript
const controls = new CalendarControls({
    locale: 'en',
    theme: { preset: 'bootstrap5', calendarSelect: { class: 'form-select-lg' } },
});
expect(controls.calendarSelect._domElement.className).toBe('form-select-lg');
expect(controls.riteSelect._domElement.className).toBe('form-select');
```

- [ ] **Step 2: Run it**

Run: `yarn test src/__tests__/MetaComponentThemePresets.test.js`
Expected: PASS if Tasks 1-3 are right. Any failure here is a real defect — fix the implementation, not the
assertion, unless reading the component proves the assertion wrong.

- [ ] **Step 3: Mutation-verify**

Temporarily change `PRESET_CLASSES[ThemePreset.BOOTSTRAP_5].select` to `'form-selectX'`; every
`form-select` assertion must fail. Restore.

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/MetaComponentThemePresets.test.js
git commit -S -m "Cover the theme preset end to end on all six components (#67)"
```

---

### Task 5: Export `ThemePreset`

**Files:**

- Modify: `src/index.js`
- Modify: `type-fixtures/dts-consumer.ts`
- Test: covered by `yarn lint:dts`

- [ ] **Step 1: Add the import and the export**

In `src/index.js`, add after the `Enums.js` import block:

```javascript
import { ThemePreset } from './MetaComponents/ThemePresets.js';
```

and add `ThemePreset,` to the `export { … }` list, after `RiteProperties,`.

- [ ] **Step 2: Add a declaration assertion**

In `type-fixtures/dts-consumer.ts`, add:

```typescript
// #67: the preset names must reach `dist/` as a usable value, not only as a type.
const bootstrap5Preset: string = ThemePreset.BOOTSTRAP_5;
void bootstrap5Preset;
```

adding `ThemePreset` to that file's existing import from `dist/index.d.ts`.

- [ ] **Step 3: Verify**

Run: `yarn compile && yarn lint:dts`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/index.js type-fixtures/dts-consumer.ts
git commit -S -m "Export the ThemePreset names (#67)"
```

---

### Task 6: Documentation

**Files:**

- Modify: `docs/meta-components.md`
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: `docs/meta-components.md`**

Add a `### Theme presets` subsection immediately after `### The theme bag's role vocabulary`, covering:
the two spellings; the table of what each preset resolves to; that a caller's key wins per key; that a
preset opens the `apiOptions` gate and why that is safe (no wrapper); that `bootstrap4` emits no `label`
and why; that an unknown preset throws; and the explicit non-goals (no detection, no layout, no CSS, no
third framework).

Add a before/after of the motivating probe:

````markdown
```javascript
// Before — the mapping written out per page
const selectClass = isBS5 ? 'form-select' : 'form-control';
Input.setGlobalInputClass(selectClass);
Input.setGlobalLabelClass('form-label d-block mb-1');
theme: {
    select: selectClass,
    label: 'form-label d-block mb-1',
    riteSelect: { wrapperClass: formGroupClass(2) },
    calendarSelect: { wrapperClass: formGroupClass(4) },
}

// After — the page still knows which Bootstrap it loaded; it no longer
// knows what that Bootstrap calls a select.
theme: {
    preset: isBS5 ? 'bootstrap5' : 'bootstrap4',
    label: 'form-label d-block mb-1',
    riteSelect: { wrapperClass: formGroupClass(2) },
    calendarSelect: { wrapperClass: formGroupClass(4) },
}
```
````

Update both `## Worked Bootstrap example` sections to lead with `preset`. Add a sentence to
`#### theme.apiOptions — the whole ApiOptions form`'s "opt-in gate" paragraph recording that a `preset`
opens it too. Add a note under the flat-key description that `liturgy` and `subscriptionUrl` take a
per-child `class` and no flat one.

- [ ] **Step 2: `CLAUDE.md`**

Under the Meta-Components section's theme paragraphs, add a short block stating: the preset's two
spellings; that expansion lives in `Theme.js` at four entry points and therefore needs no component
change; that a preset opens the `apiOptions` gate deliberately and that this is only safe because a
preset emits no `wrapper`; that `THEME_CHILD_KEYS` decides whether `apiOptions` is injected; and that a
flat class no longer reaches the `liturgy` or `url` roles. Add `ThemePreset` to the Enums list. Add
`ThemePresets.js` to the project-structure tree.

- [ ] **Step 3: `README.md`**

Add the preset to whatever theme example the README already carries; if it carries none, add two lines
under the components list pointing at `docs/meta-components.md#theme-presets`.

- [ ] **Step 4: `CHANGELOG.md`**

Under `## [Unreleased]`, add an `### Added` entry for the preset (with the table and the gate reasoning)
and a `### Behaviour changes` entry for the flat-class change of Task 3, stated as a behaviour change with
the migration (`liturgy: { class: … }`, `subscriptionUrl: { class: … }`).

- [ ] **Step 5: Format and lint**

```bash
yarn format:md:fix && yarn lint:md && yarn format:md
```

- [ ] **Step 6: Commit**

```bash
git add docs/meta-components.md CLAUDE.md README.md CHANGELOG.md
git commit -S -m "Document theme presets (#67)"
```

---

### Task 7: Gates and review

- [ ] **Step 1: Run every gate and capture real output**

```bash
yarn test
yarn compile && yarn lint:dts
yarn format:js
yarn format:md
yarn lint:md
```

Suite count must be 83 + 2 = 85 suites, with the test count risen by the number added. A drop in either is
a deleted test, not a win.

- [ ] **Step 2: Commit the spec and plan**

```bash
git add docs/superpowers/specs/2026-08-15-theme-presets-design.md docs/superpowers/plans/2026-08-15-theme-presets.md
git commit -S -m "Record the theme preset spec and plan (#67)"
```

- [ ] **Step 3: Request code review**

Use `superpowers:requesting-code-review`, then `superpowers:receiving-code-review` for the findings —
verifying each claim against the code rather than agreeing reflexively.

## Self-review

- **Spec coverage:** decisions 1-2 -> Tasks 1-2; decision 3 -> Task 2 (`expandTheme`); decision 4 ->
  Task 1 (`PRESET_CLASSES` has no `wrapper`) and its doc comment; decision 5 -> Task 1; decision 6 ->
  Task 3; decision 7 -> Tasks 1 and 5; decision 8 -> Task 1. Testing properties 1-8 -> Tasks 1-4.
- **Placeholders:** none; every code step carries its content. Task 4's assertions name getters to be
  checked against the components, which is a verification instruction, not a gap.
- **Type consistency:** `hasThemePreset`/`expandThemePreset`/`ThemePreset`/`THEME_PRESET_NAMES` are
  spelled identically in Tasks 1, 2 and 5; `expandTheme` (private, Theme.js) is distinct from
  `expandThemePreset` (exported, ThemePresets.js) throughout.
