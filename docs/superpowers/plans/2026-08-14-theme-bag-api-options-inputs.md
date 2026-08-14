# `theme.apiOptions` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** Make the whole `ApiOptions` input bundle themeable through the meta-components' `theme` bag, so
consumers no longer need the process-wide `Input.setGlobal*` mutations — answering issue #60.

**Architecture:** One new opt-in top-level key, `theme.apiOptions`, carrying flat role defaults plus
per-input overrides named for `ApiOptions`' accessors. `Theme.js` grows the key table, the validation
branch, a tiered resolver and one application helper; `CalendarControls` and `DayViewer` each swap their
locale-input block for a single call to it. `CalendarViewer`, `ApiExplorer` and `SubscriptionBuilder`
inherit it through `CalendarControls` with no code change.

**Tech Stack:** ES2022 JavaScript modules, Jest 29 with jsdom, prettier, markdownlint-cli2.

## Global Constraints

- **ES2022 floor.** `static #` private fields, `Object.hasOwn()`, `Error` `cause` are all in use. Do not lower `target`.
- **Formatting is prettier's.** `.prettierrc` sets `tabWidth: 4` and `singleQuote: true`. Run `yarn format:js:fix`; CI runs `yarn format:js`.
- **Markdown:** `yarn format:md:fix` for table alignment (MD060), `yarn lint:md` for the rest. MD013's 180-char limit needs a manual edit.
- **Gates, all of which must pass:** `yarn test`, `yarn compile && yarn lint:dts`, `yarn format:js`, `yarn format:md`, `yarn lint:md`.
- **Baseline:** 64 suites / 1191 tests green on `main`.
- **`Theme.js` stays internal** — never exported from `src/index.js`, like `LocaleValidation.js` and `OptionsValidation.js`.
- **Out of scope, owned by sibling issues:** `src/Messages.js` and default label text (#59); `ApiOptions`
  accessor names (#62); theme presets (#67); constructor options / `mountInto()` / `settled` (#61).
  Reach the inputs through the existing underscore accessors only.

---

### Task 1: `Theme.js` — key tables and the `assertTheme()` branch

**Files:**

- Modify: `src/MetaComponents/Theme.js`
- Test: `src/__tests__/MetaComponentThemeApiOptions.test.js` (create)

**Interfaces:**

- Produces: `API_OPTIONS_KEY`, `API_OPTIONS_INPUT_ROLES` (frozen `Object<string, 'select'|'input'>`) and
  `API_OPTIONS_INPUT_KEYS` (frozen `string[]`), all exported from `Theme.js`. `assertTheme( theme,
componentName )` keeps its signature.

- [x] **Step 1: Write the failing tests** — the ten key names; a bag mixing flat role keys and per-input
      overrides is accepted; a class-string `apiOptions` is rejected naming the object form; an
      unrecognised key inside `apiOptions` is rejected naming it; the message points at
      `holydaysOfObligationInput`; a non-string flat value, an unrecognised per-input key and a non-string
      per-input value are each rejected; an explicitly-`undefined` per-input value is accepted.

- [x] **Step 2: Run and watch it fail**

Run: `yarn test src/__tests__/MetaComponentThemeApiOptions.test.js`
Expected: FAIL — `does not provide an export named 'API_OPTIONS_INPUT_KEYS'`.

- [x] **Step 3: Implement**

```javascript
export const API_OPTIONS_KEY = 'apiOptions';

export const API_OPTIONS_INPUT_ROLES = Object.freeze({
    epiphanyInput: 'select',
    ascensionInput: 'select',
    corpusChristiInput: 'select',
    eternalHighPriestInput: 'select',
    holydaysOfObligationInput: 'select',
    localeInput: 'select',
    yearTypeInput: 'select',
    yearInput: 'input',
    acceptHeaderInput: 'select',
    calendarPathInput: 'select',
});

export const API_OPTIONS_INPUT_KEYS = Object.freeze(
    Object.keys(API_OPTIONS_INPUT_ROLES),
);

const LEGACY_TOP_LEVEL_INPUT_KEYS = Object.freeze(['localeInput']);
```

Add a module-private `assertApiOptionsTheme( bundle, componentName )` and dispatch to it from
`assertTheme()`'s loop, before the existing per-child branch, when `key === API_OPTIONS_KEY`.

- [x] **Step 4: Run tests — green**
- [x] **Step 5: `yarn format:js:fix && yarn test`, then commit**

---

### Task 2: `Theme.js` — the tiered resolver

**Files:**

- Modify: `src/MetaComponents/Theme.js`
- Test: `src/__tests__/MetaComponentThemeApiOptions.test.js`

**Interfaces:**

- Consumes: Task 1's `API_OPTIONS_INPUT_ROLES` and `LEGACY_TOP_LEVEL_INPUT_KEYS`.
- Produces: `resolveApiOptionsInputTheme( theme, inputKey )` →
  `{class?, labelClass?, labelText?, wrapperClass?, wrapper?}`.

- [x] **Step 1: Write the failing tests** — gate closed returns `{}` for a non-locale input and 2.7.0's
      result for `localeInput`; `apiOptions: {}` opens the gate to the outer flat keys; bundle flat beats
      outer flat; `yearInput` takes the `input` role; a per-input override beats bundle flat; a per-input
      class-string shorthand works; keys merge rather than replacing wholesale;
      `apiOptions.localeInput` beats `theme.localeInput` which beats bundle flat; an explicitly-`undefined`
      override key falls through; a nullish theme returns `{}`; the flat `wrapper` maps to `wrapperClass`
      while a per-input `wrapper` stays the element type.

- [x] **Step 2: Run and watch it fail** — `resolveApiOptionsInputTheme` is not exported.

- [x] **Step 3: Implement**

Refactor `resolveChildTheme()`'s two halves into module-private `collectFlatDefaults( bag, role )` and
`collectOverride( resolved, override, role )`, express `resolveChildTheme()` in terms of them (behaviour
unchanged), then:

```javascript
export function resolveApiOptionsInputTheme(theme, inputKey) {
    if (null === theme || undefined === theme) {
        return {};
    }
    const role = API_OPTIONS_INPUT_ROLES[inputKey] ?? 'select';
    const legacyTopLevel = LEGACY_TOP_LEVEL_INPUT_KEYS.includes(inputKey);
    const bundle = theme[API_OPTIONS_KEY];
    if (null === bundle || typeof bundle !== 'object') {
        return legacyTopLevel ? resolveChildTheme(theme, inputKey, role) : {};
    }
    const resolved = collectFlatDefaults(theme, role);
    Object.assign(resolved, collectFlatDefaults(bundle, role));
    if (legacyTopLevel) {
        collectOverride(resolved, theme[inputKey], role);
    }
    collectOverride(resolved, bundle[inputKey], role);
    return resolved;
}
```

- [x] **Step 4: Run tests — green**, including the untouched `MetaComponentTheme*` suites
- [x] **Step 5: `yarn format:js:fix && yarn test`, then commit**

---

### Task 3: `Theme.js` — `applyApiOptionsTheme()`

**Files:**

- Modify: `src/MetaComponents/Theme.js`
- Test: `src/__tests__/MetaComponentThemeApiOptions.test.js`

**Interfaces:**

- Consumes: Tasks 1-2, plus the existing `resolveWrapperBag()` and `applyLocaleInputTheme()`.
- Produces: `applyApiOptionsTheme( apiOptions, theme, defaultLocaleLabelText )` → `void`.

- [x] **Step 1: Write the failing test** — drive a real `ApiOptions`, hydrating the base in `beforeEach`
      with `ApiBase.reset()` then `ApiBase.fromMetadata()`. Call `applyApiOptionsTheme` directly,
      and assert on `_epiphanyInput._domElement.className`, `_yearInput._domElement.className`,
      `_ascensionInput._labelElement.className`, the wrapper element's `tagName` and `className`, a
      per-input `wrapperClass` beating the bundle default, a per-input `labelText` leaving its siblings
      alone, the locale input's unconditional localized label, the gate-closed case, and that theming an
      input the filter hides does not throw. Use `ApiOptionsFilter.LOCALE_ONLY`, not the string.

- [x] **Step 2: Run and watch it fail**

- [x] **Step 3: Implement**

```javascript
export function applyApiOptionsTheme(
    apiOptions,
    theme,
    defaultLocaleLabelText,
) {
    for (const inputKey of API_OPTIONS_INPUT_KEYS) {
        const childTheme = resolveApiOptionsInputTheme(theme, inputKey);
        const input = apiOptions[`_${inputKey}`];
        if ('localeInput' === inputKey) {
            applyLocaleInputTheme(input, childTheme, defaultLocaleLabelText);
            continue;
        }
        applyInputTheme(input, childTheme);
    }
}
```

with a module-private `applyInputTheme( input, childTheme )` setting `class`, `labelClass`, the
`resolveWrapperBag()` wrapper, and `labelText` (only when named). Re-express `applyLocaleInputTheme()` as
`applyInputTheme()` plus its unconditional-label fallback, so the special case has one definition.

- [x] **Step 4: Run tests — green**
- [x] **Step 5: `yarn format:js:fix && yarn test`, then commit**

---

### Task 4: Wire `CalendarControls` and `DayViewer`

**Files:**

- Modify: `src/MetaComponents/CalendarControls.js` — the `resolveChildTheme( theme, 'localeInput' )` +
  `applyLocaleInputTheme( … )` block
- Modify: `src/MetaComponents/DayViewer.js` — the same block
- Modify: `src/SubscriptionBuilder/SubscriptionBuilder.js` — the comment naming the old helper
- Test: `src/__tests__/MetaComponentThemeApiOptions.test.js`

**Interfaces:**

- Consumes: `applyApiOptionsTheme()` from Task 3.

- [x] **Step 1: Write the failing end-to-end tests** — a `CalendarControls` themed with the issue's own
      example bag styles `_epiphanyInput`, `_yearInput`, `_ascensionInput`'s label and wrapper, and both
      per-input `wrapperClass` overrides; a bag with no `apiOptions` key leaves the inputs alone while
      `localeInput` still gets the flat class; `apiOptions.localeInput` beats `theme.localeInput`; a
      `LOCALE_ONLY` filter does not throw; a misspelled key is rejected naming `CalendarControls`; and
      `CalendarViewer`, `ApiExplorer`, `SubscriptionBuilder` and `DayViewer` all inherit it.

- [x] **Step 2: Run and watch it fail**
- [x] **Step 3: Replace both blocks with one `applyApiOptionsTheme( … )` call**, keeping each component's
      existing `LANGUAGE` message-catalogue expression as the third argument, and update the imports.
- [x] **Step 4: Run the FULL suite — every pre-existing test must still pass**
- [x] **Step 5: `yarn format:js:fix && yarn test`, then commit**

---

### Task 5: Documentation and CHANGELOG

**Files:**

- Modify: `docs/meta-components.md`, `CLAUDE.md`, `CHANGELOG.md`, `README.md`

- [x] **Step 1:** Replace `docs/meta-components.md`'s "**`apiOptions` as a whole is still not a themeable
      child.**" paragraph — statement AND stated reason — with the new key's documentation: the shape, the
      opt-in gate, the four-tier precedence table, the ten key names with their roles and filters, the
      inert-when-hidden rule, and the `DayViewer` note. Generalize the escape-hatch-throws paragraph from
      `localeInput` to any themed input. Correct the `CalendarViewer` multi-row paragraph, which described
      the asymmetric row this key fixes. Note the reserved key in the shared role-vocabulary section.
- [x] **Step 2:** Extend `CLAUDE.md`'s "The theme bag's role vocabulary" contract point with the four
      load-bearing properties (the gate, the legacy tier, the typo check at depth, all ten regardless of
      filter).
- [x] **Step 3:** Add a `## [Unreleased]` CHANGELOG entry, scoped to #60 only — four sibling branches each
      add their own, and they have to merge.
- [x] **Step 4:** `yarn format:md:fix && yarn lint:md && yarn format:md`
- [x] **Step 5:** Commit.

---

### Task 6: Full verification and code review

- [x] `yarn test`
- [x] `yarn compile && yarn lint:dts`
- [x] `yarn format:js`
- [x] `yarn format:md`
- [x] `yarn lint:md`
- [x] Request code review; verify each finding against the source before acting on it.

---

### Task 7: Address code review (added during execution)

**Files:**

- Modify: `src/MetaComponents/Theme.js`, `docs/meta-components.md`, `CLAUDE.md`, `CHANGELOG.md`
- Test: `src/__tests__/MetaComponentThemeApiOptions.test.js`,
  `src/__tests__/MetaComponentThemeApiOptionsGlobals.test.js` (create)

- [x] **Step 1: Write the failing test** for a top-level input key. Passing a bare `yearInput` override to
      `assertTheme()` must throw, pointing at `theme.apiOptions.yearInput`, and likewise for every one of
      the nine non-legacy names, while the legacy top-level `localeInput` is still accepted.
- [x] **Step 2: Run and watch it fail** (2 failing).
- [x] **Step 3: Implement** the rejection in `assertTheme()`'s loop, after the `apiOptions` branch. Verify
      first that no meta-component uses any of the ten names as a per-child key.
- [x] **Step 4: Run the full suite — green.**
- [x] **Step 5: Add `MetaComponentThemeApiOptionsGlobals.test.js`** covering the `Input.setGlobal*`
      pairing: the constructor's global wrapper not consuming the one-shot, a bag class beating the global
      and closing `wrapperClass()`, a type-only bag inheriting the global and leaving it free, and the gate
      closed leaving the globals in sole charge. Its own file, because the statics have no reset — the same
      reason `InputWrapperGlobals.test.js` is separate.
- [x] **Step 6: Prove those regression tests can fail.** They pass on the first run, so verify red-green
      against two deliberate mutations: (a) make `applyInputTheme()` always pass a `class` to
      `Input.wrapper()`, and (b) make `resolveApiOptionsInputTheme()` open the gate unconditionally.
      Restore and confirm green.
- [x] **Step 7: Document** the two edges review surfaced — the bundle's flat `wrapper` is a class whose
      element type is always `div` (overriding a global `'td'`), and
      `AcceptHeaderInput.asReturnTypeParam()` rewrites its own label text after the theme has applied.
- [x] **Step 8: Re-run every gate, then commit.**
