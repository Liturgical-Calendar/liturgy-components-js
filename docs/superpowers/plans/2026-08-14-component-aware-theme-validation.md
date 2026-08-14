# Component-Aware Theme Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `assertTheme()` reject a theme key naming a child the receiving component does not have, under that component's own name, instead of accepting it and silently dropping it.

**Architecture:** A frozen `THEME_CHILD_KEYS` registry in `src/MetaComponents/Theme.js` maps each of the six theme-taking components to the child keys it actually resolves; `assertTheme()` looks its allowed set up by the `componentName` it is already given. The three components that forward `theme` to `CalendarControls` validate under their own name before forwarding and hand down a bag narrowed to `CalendarControls`' own keys, so a legitimate outer key (`subscriptionUrl`) is never rejected by an inner class that has never heard of it.

**Tech Stack:** ES2022 JavaScript modules, Jest 30, prettier (`tabWidth: 4`, `singleQuote: true`), markdownlint-cli2.

**Spec:** `docs/superpowers/specs/2026-08-14-component-aware-theme-validation-design.md`

## Global Constraints

- Work exclusively in `/home/johnrdorazio/development/LiturgicalCalendar/liturgy-components-js/.claude/worktrees/issue-78`, branch `fix/component-aware-theme-validation`.
- `Theme.js` stays internal — never export it or its new constants from `src/index.js`.
- Do **not** make the nested `apiOptions` bag filter-aware: all ten inputs exist regardless of `filter`, and theming a filtered-out input stays inert. The test pinning that must keep passing untouched.
- Do **not** implement named theme presets (`bootstrap4`/`bootstrap5`) — that is held issue #67, next in this same file.
- Edits to `CalendarControls.js` are confined to theme validation (held issues #63 and #68 will touch that file).
- Stay out of `src/ApiOptions/**`, `src/WebCalendar/**`, `src/LiturgyOfAnyDay/**` and `src/Messages.js` (issues #69, #70, #65 are running there now).
- Gates, all of which must pass at the end: `yarn test` (baseline 72 suites / 1350 tests), `yarn compile && yarn lint:dts`, `yarn format:js`, `yarn format:md`, `yarn lint:md`.
- Commit with `git commit -S`, ending the message with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`. Do not push, do not open a PR.

---

## File Structure

| File                                                     | Responsibility                                                                              |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/MetaComponents/Theme.js`                             | The registry, the reverse map, the component-aware `assertTheme()`, and `narrowTheme()`.    |
| `src/MetaComponents/CalendarViewer.js`                    | Validates `theme` under its own name before forwarding; narrows what it forwards.           |
| `src/MetaComponents/ApiExplorer.js`                       | Same.                                                                                        |
| `src/SubscriptionBuilder/SubscriptionBuilder.js`          | Same, with `subscriptionUrl` resolved from the unnarrowed bag first.                        |
| `src/__tests__/MetaComponentThemeComponentAware.test.js`  | The new suite: per-component acceptance/rejection, attribution, hints, unknown name.         |
| `CLAUDE.md`, `docs/meta-components.md`, `CHANGELOG.md`    | Correct the passages that describe the limitation as permanent; record the behaviour change. |

---

### Task 1: The registry, the reverse map and the component-aware guard

**Files:**

- Modify: `src/MetaComponents/Theme.js`
- Test: `src/__tests__/MetaComponentThemeComponentAware.test.js` (create)

**Interfaces:**

- Consumes: the existing `FLAT_KEYS`, `API_OPTIONS_KEY`, `API_OPTIONS_INPUT_KEYS`, `assertApiOptionsTheme()` in `Theme.js`.
- Produces:
  - `export const THEME_CHILD_KEYS` — frozen object, keys are the six component names, values frozen `string[]`.
  - `assertTheme( theme, componentName )` — unchanged signature; now throws for a key outside `FLAT_KEYS ∪ THEME_CHILD_KEYS[ componentName ]`, and throws for an unrecognised `componentName`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/MetaComponentThemeComponentAware.test.js`:

```javascript
/**
 * Issue #78: a theme key naming a child the component does not have must throw,
 * under that component's own name, rather than being accepted and dropped.
 */

import { assertTheme, THEME_CHILD_KEYS } from '../MetaComponents/Theme.js';

describe('assertTheme is component-aware', () => {
    it('rejects theme.apiOptions on CalendarResourcePicker, which bundles none', () => {
        expect(() =>
            assertTheme(
                { apiOptions: { select: 'form-select' } },
                'CalendarResourcePicker',
            ),
        ).toThrow(
            /CalendarResourcePicker: theme\.apiOptions is not a recognised theme key/,
        );
    });

    it('rejects theme.localeInput on CalendarResourcePicker', () => {
        expect(() =>
            assertTheme({ localeInput: 'form-select' }, 'CalendarResourcePicker'),
        ).toThrow(/CalendarResourcePicker: theme\.localeInput/);
    });

    it('rejects theme.liturgy on CalendarControls but accepts it on DayViewer', () => {
        expect(() =>
            assertTheme({ liturgy: { eventClass: 'card' } }, 'CalendarControls'),
        ).toThrow(/CalendarControls: theme\.liturgy is not a recognised theme key/);
        expect(() =>
            assertTheme({ liturgy: { eventClass: 'card' } }, 'DayViewer'),
        ).not.toThrow();
    });

    it('rejects theme.subscriptionUrl everywhere but on SubscriptionBuilder', () => {
        for (const name of [
            'CalendarControls',
            'CalendarViewer',
            'ApiExplorer',
            'DayViewer',
        ]) {
            expect(() =>
                assertTheme({ subscriptionUrl: 'x' }, name),
            ).toThrow(/theme\.subscriptionUrl is not a recognised theme key/);
        }
        expect(() =>
            assertTheme({ subscriptionUrl: 'x' }, 'SubscriptionBuilder'),
        ).not.toThrow();
    });

    it('names the components where the key would be valid', () => {
        let message = '';
        try {
            assertTheme({ liturgy: 'x' }, 'CalendarViewer');
        } catch (error) {
            message = error.message;
        }
        expect(message).toMatch(/valid on DayViewer/);
    });

    it('lists the component\'s own valid keys in the message', () => {
        let message = '';
        try {
            assertTheme({ liturgy: 'x' }, 'CalendarResourcePicker');
        } catch (error) {
            message = error.message;
        }
        expect(message).toMatch(/riteSelect/);
        expect(message).toMatch(/calendarSelect/);
    });

    it('still advises the nested spelling for an ApiOptions input on a component that has one', () => {
        expect(() =>
            assertTheme({ yearInput: { class: 'x' } }, 'CalendarControls'),
        ).toThrow(/Write it as theme\.apiOptions\.yearInput instead/);
    });

    it('reports an ApiOptions input as an unknown key where there is no ApiOptions', () => {
        expect(() =>
            assertTheme({ yearInput: { class: 'x' } }, 'CalendarResourcePicker'),
        ).toThrow(/is not a recognised theme key/);
    });

    it('throws for a component name it has no key set for', () => {
        expect(() => assertTheme({}, 'NotAComponent')).toThrow(
            /NotAComponent/,
        );
    });

    it('accepts every key each component actually resolves', () => {
        for (const [name, keys] of Object.entries(THEME_CHILD_KEYS)) {
            for (const key of keys) {
                const bag =
                    'apiOptions' === key ? { apiOptions: {} } : { [key]: 'x' };
                expect(() => assertTheme(bag, name)).not.toThrow();
            }
        }
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/MetaComponentThemeComponentAware.test.js`
Expected: FAIL — `THEME_CHILD_KEYS` is not exported, and the rejection tests do not throw.

- [ ] **Step 3: Add the registry and the reverse map to `Theme.js`**

Insert after the `LEGACY_TOP_LEVEL_INPUT_KEYS` constant:

```javascript
/**
 * The per-child theme keys `CalendarControls` itself resolves, named once
 * because three components forward their whole bag to it and share this set.
 *
 * `apiOptions` is here even though it is a nested bundle rather than a per-child
 * override: it is still a key the receiving component either has a use for or
 * does not, and a component with no `ApiOptions` must reject it. `localeInput`
 * is here for the same reason — it is the one input that also answers to a
 * top-level key (see {@link LEGACY_TOP_LEVEL_INPUT_KEYS}), so it belongs to
 * exactly the components that have an `ApiOptions`.
 *
 * @type {Readonly<string[]>}
 */
const CALENDAR_CONTROLS_CHILD_KEYS = Object.freeze([
    'riteSelect',
    'calendarSelect',
    API_OPTIONS_KEY,
    ...LEGACY_TOP_LEVEL_INPUT_KEYS,
]);

/**
 * The theme keys each component actually resolves, by component name (issue #78).
 *
 * This is what makes {@link assertTheme} catch a MISPLACEMENT and not only a
 * misspelling. Before it, any key outside {@link FLAT_KEYS} was read as a
 * per-child override, accepted, and then dropped in silence by
 * {@link resolveChildTheme} when the component had no such child —
 * `theme.apiOptions` on a `CalendarResourcePicker`, `theme.liturgy` on a
 * `CalendarViewer` — which is precisely the issue-#43 failure mode this module's
 * comments are elsewhere emphatic about.
 *
 * Every entry is derived by reading that component's own `resolveChildTheme()`
 * and `applyApiOptionsTheme()` calls; nothing here is aspirational. Adding a
 * child to a meta-component means adding its key here, or the theme bag will
 * reject the very key the new child reads.
 *
 * `CalendarViewer` and `ApiExplorer` repeat `CalendarControls`' set rather than
 * extending it: their own children take no theme from this bag —
 * `CalendarViewer`'s `WebCalendar` is configured through the separate
 * `webCalendar` option, and `ApiExplorer`'s `PathBuilder` reads no theme at all.
 *
 * @type {Readonly<Object<string, Readonly<string[]>>>}
 */
export const THEME_CHILD_KEYS = Object.freeze({
    CalendarResourcePicker: Object.freeze(['riteSelect', 'calendarSelect']),
    CalendarControls: CALENDAR_CONTROLS_CHILD_KEYS,
    CalendarViewer: CALENDAR_CONTROLS_CHILD_KEYS,
    ApiExplorer: CALENDAR_CONTROLS_CHILD_KEYS,
    DayViewer: Object.freeze([
        'riteSelect',
        'calendarSelect',
        'liturgy',
        'dateControls',
        API_OPTIONS_KEY,
        ...LEGACY_TOP_LEVEL_INPUT_KEYS,
    ]),
    SubscriptionBuilder: Object.freeze([
        ...CALENDAR_CONTROLS_CHILD_KEYS,
        'subscriptionUrl',
    ]),
});

/**
 * Which components accept each child key, derived from {@link THEME_CHILD_KEYS}.
 *
 * Used only to finish a rejection message with where the key WOULD be valid,
 * which is the difference between "this is wrong" and "you wrote it on the wrong
 * component". Derived rather than written out, so the two cannot drift.
 *
 * @type {Readonly<Object<string, Readonly<string[]>>>}
 */
const COMPONENTS_BY_CHILD_KEY = Object.freeze(
    Object.entries(THEME_CHILD_KEYS).reduce((map, [component, keys]) => {
        for (const key of keys) {
            map[key] = Object.freeze([...(map[key] ?? []), component]);
        }
        return map;
    }, {}),
);
```

- [ ] **Step 4: Make `assertTheme()` consult the registry**

Replace the body of the `for` loop's opening in `assertTheme()` so the
unknown-key check runs FIRST. The whole function becomes:

```javascript
export function assertTheme(theme, componentName) {
    // Looked up rather than passed in, so a component's NAME and its key set can
    // never disagree — a mismatch at a forwarding boundary is the second half of
    // issue #78, and a `childKeys` argument would let a call site reintroduce it.
    // An unknown name throws rather than falling back to the old permissive
    // behaviour: a silent fallback would restore the very bug this closes.
    const childKeys = THEME_CHILD_KEYS[componentName];
    if (undefined === childKeys) {
        throw new Error(
            `assertTheme: no theme key set is registered for ${componentName}. Add one to THEME_CHILD_KEYS in Theme.js.`,
        );
    }
    if (null === theme || undefined === theme) {
        return;
    }
    assertPlainOptions(theme, `${componentName}: theme`);
    const validKeys = [...FLAT_KEYS, ...childKeys];
    for (const key of Object.keys(theme)) {
        const value = theme[key];
        if (false === validKeys.includes(key)) {
            throw unknownThemeKeyError(key, componentName, validKeys, childKeys);
        }
        if (API_OPTIONS_KEY === key) {
            assertApiOptionsTheme(value, componentName);
            continue;
        }
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
        for (const overrideKey of Object.keys(value)) {
            if (false === ALL_OVERRIDE_KEYS.includes(overrideKey)) {
                throw new Error(
                    `${componentName}: theme.${key}.${overrideKey} is not a recognised per-child theme key. Valid keys are: ${ALL_OVERRIDE_KEYS.join(', ')}.`,
                );
            }
            const overrideValue = value[overrideKey];
            if (
                undefined !== overrideValue &&
                typeof overrideValue !== 'string'
            ) {
                throw new Error(
                    `${componentName}: theme.${key}.${overrideKey} must be of type \`string\` but found type: ${describeType(overrideValue)}`,
                );
            }
        }
    }
}
```

Keep the existing long comment about the top-level `ApiOptions` input names by
moving it onto the new helper below, which is where that case is now answered:

```javascript
/**
 * Builds the error for a top-level theme key the component does not accept.
 *
 * Three shapes, most specific first:
 *
 * 1. An `ApiOptions` input name on a component that HAS an `ApiOptions` keeps
 *    the message issue #60 added, pointing at the nested spelling. That case is
 *    plausible precisely because #60 ships ten names that work under
 *    `apiOptions` while one of them, `localeInput`, also works at the top level,
 *    so `{ localeInput: …, yearInput: … }` written by analogy would otherwise
 *    have half of it silently ignored.
 * 2. A key valid on some OTHER component names those components. This is the
 *    difference between "this is wrong" and "you wrote it on the wrong
 *    component", and it is the case issue #78 was filed about.
 * 3. Anything else — a genuine misspelling — gets the same sentence without the
 *    final hint.
 *
 * @param {string} key - The offending top-level key.
 * @param {string} componentName - The rejecting component's class name.
 * @param {string[]} validKeys - Every key this component does accept.
 * @param {Readonly<string[]>} childKeys - Its child keys, without the flat ones.
 * @returns {Error} The error to throw.
 */
function unknownThemeKeyError(key, componentName, validKeys, childKeys) {
    if (
        API_OPTIONS_INPUT_KEYS.includes(key) &&
        childKeys.includes(API_OPTIONS_KEY)
    ) {
        return new Error(
            `${componentName}: theme.${key} is an ApiOptions input, which the theme bag reaches through the nested key. Write it as theme.${API_OPTIONS_KEY}.${key} instead.`,
        );
    }
    const validOn = COMPONENTS_BY_CHILD_KEY[key];
    const hint =
        undefined === validOn
            ? ''
            : ` theme.${key} is valid on ${validOn.join(', ')}.`;
    return new Error(
        `${componentName}: theme.${key} is not a recognised theme key for this component. Valid keys are: ${validKeys.join(', ')}.${hint}`,
    );
}
```

- [ ] **Step 5: Run the new suite and the whole suite**

Run: `yarn test src/__tests__/MetaComponentThemeComponentAware.test.js`
Expected: PASS.

Run: `yarn test`
Expected: all suites pass. If `MetaComponentTheme.test.js`,
`MetaComponentThemeApiOptions.test.js` or `MetaComponentThemeLiturgyKeys.test.js`
fails, read the failing bag: a key legitimately belonging to the named component
means the registry entry is wrong and must be corrected; a key that does not
belong means the test was relying on the old permissive behaviour and its
component name (not the assertion) should be corrected.

- [ ] **Step 6: Commit**

```bash
git add src/MetaComponents/Theme.js src/__tests__/MetaComponentThemeComponentAware.test.js
git commit -S -m "$(cat <<'EOF'
Make assertTheme() component-aware (#78)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `narrowTheme()` and the three forwarding components

**Files:**

- Modify: `src/MetaComponents/Theme.js`
- Modify: `src/MetaComponents/CalendarViewer.js:109-125`
- Modify: `src/MetaComponents/ApiExplorer.js:92-100`
- Modify: `src/SubscriptionBuilder/SubscriptionBuilder.js:70-108`
- Test: `src/__tests__/MetaComponentThemeComponentAware.test.js`

**Interfaces:**

- Consumes: `THEME_CHILD_KEYS` and `assertTheme()` from Task 1.
- Produces: `export function narrowTheme( theme, componentName )` — returns the bag unchanged when nullish, otherwise a fresh bag holding every flat key plus only the child keys `componentName` owns.

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/MetaComponentThemeComponentAware.test.js`:

```javascript
import { narrowTheme } from '../MetaComponents/Theme.js';
import { ApiBase } from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import CalendarViewer from '../MetaComponents/CalendarViewer.js';
import ApiExplorer from '../MetaComponents/ApiExplorer.js';
import SubscriptionBuilder from '../SubscriptionBuilder/SubscriptionBuilder.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

describe('narrowTheme', () => {
    it('passes a nullish theme straight through', () => {
        expect(narrowTheme(null, 'CalendarControls')).toBeNull();
        expect(narrowTheme(undefined, 'CalendarControls')).toBeUndefined();
    });

    it('keeps flat keys and the target component\'s own child keys', () => {
        const narrowed = narrowTheme(
            {
                select: 'form-select',
                label: 'form-label',
                calendarSelect: { class: 'a' },
                subscriptionUrl: 'b',
            },
            'CalendarControls',
        );
        expect(narrowed).toEqual({
            select: 'form-select',
            label: 'form-label',
            calendarSelect: { class: 'a' },
        });
    });
});

describe('forwarding components own their theme attribution', () => {
    beforeEach(() => {
        ApiBase.reset();
        ApiBase.fromMetadata(API_URL, FULL_METADATA);
    });

    it('reports a bad theme key on CalendarViewer under its own name', () => {
        expect(
            () => new CalendarViewer({ theme: { liturgy: { class: 'x' } } }),
        ).toThrow(/^CalendarViewer: theme\.liturgy/);
    });

    it('reports a bad theme key on ApiExplorer under its own name', () => {
        expect(
            () => new ApiExplorer({ theme: { liturgy: { class: 'x' } } }),
        ).toThrow(/^ApiExplorer: theme\.liturgy/);
    });

    it('reports a bad theme key on SubscriptionBuilder under its own name', () => {
        expect(
            () => new SubscriptionBuilder({ theme: { liturgy: { class: 'x' } } }),
        ).toThrow(/^SubscriptionBuilder: theme\.liturgy/);
    });

    it('still accepts subscriptionUrl on SubscriptionBuilder, which CalendarControls has never heard of', () => {
        const builder = new SubscriptionBuilder({
            theme: { select: 'form-select', subscriptionUrl: 'url-box' },
        });
        expect(builder.controls.calendarSelect._domElement.className).toBe(
            'form-select',
        );
        builder.dispose();
    });
});
```

Note: read the neighbouring suites (`CalendarViewer.test.js`,
`SubscriptionBuilder.test.js`) for the exact fixture import names and the
accessor used to read a select's class before writing the last assertion; match
whatever they already do rather than inventing a new accessor.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn test src/__tests__/MetaComponentThemeComponentAware.test.js`
Expected: FAIL — `narrowTheme` is not exported, and the three constructors report
`CalendarControls:` rather than their own names.

- [ ] **Step 3: Add `narrowTheme()` to `Theme.js`**

```javascript
/**
 * Narrows a theme bag to the keys one component owns, for forwarding (issue #78).
 *
 * `CalendarViewer`, `ApiExplorer` and `SubscriptionBuilder` each hand their whole
 * options bag — `theme` included — to a `CalendarControls`, which validates it
 * again under its own name. Once {@link assertTheme} is component-aware, that
 * inner pass would reject a key that is legitimately the OUTER component's:
 * `SubscriptionBuilder`'s `subscriptionUrl` names a child `CalendarControls` has
 * never heard of. Narrowing states the rule instead: a key naming this
 * component's own child is not the controls' business.
 *
 * Flat keys always survive — they are the shared vocabulary, and the controls'
 * children read them.
 *
 * All three forwarders call this, not only the one whose set differs today, so
 * the rule holds mechanically if either of the other two ever gains a themed
 * child of its own.
 *
 * @param {Object|null|undefined} theme - The caller's whole theme bag.
 * @param {string} componentName - The component the narrowed bag is FOR.
 * @returns {Object|null|undefined} A fresh narrowed bag, or the nullish input.
 */
export function narrowTheme(theme, componentName) {
    if (null === theme || undefined === theme) {
        return theme;
    }
    const keep = [...FLAT_KEYS, ...(THEME_CHILD_KEYS[componentName] ?? [])];
    const narrowed = {};
    for (const key of Object.keys(theme)) {
        if (keep.includes(key)) {
            narrowed[key] = theme[key];
        }
    }
    return narrowed;
}
```

- [ ] **Step 4: Wire `CalendarViewer`**

In `src/MetaComponents/CalendarViewer.js`, add to the existing `Theme.js` import
(create one if the file has none — it currently imports `resolveInputVisibility`
from `./InputVisibility.js`):

```javascript
import { assertTheme, narrowTheme } from './Theme.js';
```

and in the constructor, immediately after the existing
`resolveInputVisibility( bag.inputs, 'CalendarViewer' );` line:

```javascript
        // Validated here for ATTRIBUTION, exactly as `inputs` is above and for
        // the same reason: `CalendarControls` validates the same bag a line
        // below but names ITSELF, reporting a typo in an option the caller
        // passed to `CalendarViewer` under a class they never touched (#78).
        // What is forwarded is narrowed to the controls' own keys, so this
        // component stays free to gain a themed child of its own later.
        assertTheme(bag.theme, 'CalendarViewer');
        this.#controls = new CalendarControls({
            ...bag,
            theme: narrowTheme(bag.theme, 'CalendarControls'),
        });
```

replacing the existing `this.#controls = new CalendarControls( bag );`.

- [ ] **Step 5: Wire `ApiExplorer`**

Same two edits in `src/MetaComponents/ApiExplorer.js`, with `'ApiExplorer'` as
the name, replacing its own `this.#controls = new CalendarControls( bag );`.

- [ ] **Step 6: Wire `SubscriptionBuilder`**

In `src/SubscriptionBuilder/SubscriptionBuilder.js`, extend the existing
`Theme.js` import to `import { assertTheme, narrowTheme, resolveChildTheme } from '../MetaComponents/Theme.js';`
and, in the constructor, add the assertion just after the locale is
canonicalized and before `new CalendarControls(...)`:

```javascript
        // Under THIS class' name, and before forwarding — `subscriptionUrl` is a
        // key `CalendarControls` has never heard of, so the inner pass could
        // neither accept it nor report it honestly (#78).
        assertTheme(bag.theme, 'SubscriptionBuilder');
        this.#controls = new CalendarControls({
            ...bag,
            locale: intlLocale,
            theme: narrowTheme(bag.theme, 'CalendarControls'),
        });
```

The existing `const urlTheme = resolveChildTheme( bag.theme, 'subscriptionUrl' );`
stays where it is and keeps reading the UNNARROWED bag — it is this component's
own child, and narrowing is only about what the controls receive.

- [ ] **Step 7: Run the tests**

Run: `yarn test`
Expected: all suites pass, including `CalendarViewer.test.js`,
`ApiExplorer.test.js` and `SubscriptionBuilder.test.js`.

- [ ] **Step 8: Commit**

```bash
git add src/MetaComponents/Theme.js src/MetaComponents/CalendarViewer.js src/MetaComponents/ApiExplorer.js src/SubscriptionBuilder/SubscriptionBuilder.js src/__tests__/MetaComponentThemeComponentAware.test.js
git commit -S -m "$(cat <<'EOF'
Validate and narrow the theme at the forwarding boundary (#78)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Documentation and CHANGELOG

**Files:**

- Modify: `CLAUDE.md` (the `assertTheme()` bullet in the Meta-Components section)
- Modify: `docs/meta-components.md:167`, `docs/meta-components.md:200-205`
- Modify: `CHANGELOG.md` (`## [Unreleased]` → `### Behaviour changes`)

**Interfaces:**

- Consumes: the behaviour implemented in Tasks 1 and 2.
- Produces: nothing code depends on.

- [ ] **Step 1: Correct `docs/meta-components.md`**

Replace the `apiOptions` paragraph under `CalendarResourcePicker` (which
currently ends "… the same 'a misspelling is caught, a misplacement is not'
limitation that applies to every key here, since the bag is validated without
knowing which children the component receiving it actually has.") with:

```markdown
**`apiOptions` is a reserved key, not a per-child override.** It is the one nested bag the vocabulary
has: flat role keys plus per-input overrides for a whole `ApiOptions` form, documented under
[`CalendarControls`](#themeapioptions--the-whole-apioptions-form). `CalendarResourcePicker` bundles no
`ApiOptions`, so naming it here **throws**, naming this component and pointing at the components where
the key is valid. Since 2.8.0 the bag is validated against the children the receiving component actually
has, so a misplacement is caught as well as a misspelling — see
[Theme keys are per component](#theme-keys-are-per-component).
```

Then extend the sentence at line 167 ("**An unrecognised per-child key throws**,
naming the key — the same misspelling that produced that issue is now reported
rather than ignored.") with:

```markdown
A key naming a child this component does not have throws too, since 2.8.0 — see
[Theme keys are per component](#theme-keys-are-per-component).
```

Add a new section immediately after the theme-bag vocabulary discussion (before
`### Public getters` of `CalendarResourcePicker` is fine; place it where the
surrounding heading levels stay ordered):

```markdown
### Theme keys are per component

Each component accepts the flat role keys — `select`, `input`, `label`, `wrapper` — plus exactly the
child keys it resolves:

| Component                | Child keys                                                                     |
| ------------------------ | ------------------------------------------------------------------------------ |
| `CalendarResourcePicker` | `riteSelect`, `calendarSelect`                                                  |
| `CalendarControls`       | `riteSelect`, `calendarSelect`, `apiOptions`, `localeInput`                     |
| `CalendarViewer`         | as `CalendarControls`                                                           |
| `ApiExplorer`            | as `CalendarControls`                                                           |
| `DayViewer`              | `riteSelect`, `calendarSelect`, `liturgy`, `dateControls`, `apiOptions`, `localeInput` |
| `SubscriptionBuilder`    | as `CalendarControls`, plus `subscriptionUrl`                                   |

Anything else throws, naming the rejecting component, the offending key and — when the key is valid
somewhere — the components it is valid on. Before 2.8.0 such a key was accepted and then dropped in
silence by the resolver, which is the issue-#43 failure mode arriving by a different route: markup
rendered with library defaults, no throw and no warning.

`CalendarViewer`, `ApiExplorer` and `SubscriptionBuilder` forward their bag to an internal
`CalendarControls`, and each validates it under **its own** name first, then hands down only the keys
the controls own. That is why `subscriptionUrl` works on a `SubscriptionBuilder` and nowhere else, and
why a bad key on a `CalendarViewer` is reported as a `CalendarViewer` problem rather than as a
`CalendarControls` one.

What this does **not** do is reject an `ApiOptions` input the current `filter` never renders. All ten
inputs exist whatever the filter; theming one the filter hides is inert, not an error, and a caller
should not need to know which filter renders which input.
```

- [ ] **Step 2: Correct `CLAUDE.md`**

Rewrite the third bullet of the `apiOptions` list in the Meta-Components section
(the one beginning "**`assertTheme()` catches typos at the new depth too**") so
it reads:

```markdown
- **`assertTheme()` catches typos at the new depth too**, both for a key inside `apiOptions` and for a key
  inside a per-input override, AND it rejects any of the other nine input names written at the top level,
  pointing at the nested spelling. The per-input check is deliberately STRICTER than the two-level one,
  because the role is known there. Silently dropping an unrecognised key is the exact failure mode issue
  #43 was filed about, and shipping ten names that work nested while one of them also works at the top
  level is what would otherwise have made that misplacement easy to write.
```

and add, after that list, a new paragraph:

```markdown
**Theme keys are validated per component, and the forwarding boundary owns its own attribution (#78).**
`THEME_CHILD_KEYS` in `Theme.js` maps each of the six theme-taking components to the child keys it
actually resolves, and `assertTheme()` looks its allowed set up by the `componentName` it is already
given — the name and the set therefore cannot disagree, which a third `childKeys` argument would have
allowed at exactly the boundary where the second half of #78 went wrong. An unregistered name throws
rather than falling back to the old permissive behaviour. `theme.apiOptions` on a
`CalendarResourcePicker`, or `theme.liturgy` on a `CalendarViewer`, now throw naming the component, the
key and where that key would be valid, instead of being accepted and dropped. `CalendarViewer`,
`ApiExplorer` and `SubscriptionBuilder` validate under their own names **before** forwarding (PR #76's
shape for the `inputs` bag) and forward `narrowTheme( theme, 'CalendarControls' )`, which keeps the flat
keys and drops the outer component's own child keys — without it, `SubscriptionBuilder`'s legitimate
`subscriptionUrl` would be rejected by a class that has never heard of it. What is deliberately NOT
validated is whether the current `filter` renders a themed `ApiOptions` input: all ten exist regardless,
so theming a hidden one stays inert.
```

- [ ] **Step 3: Add the CHANGELOG entry**

Under `## [Unreleased]` → `### Behaviour changes`, append:

```markdown
- **A theme key naming a child the component does not have now throws**, closing #78. `assertTheme()`
  validated a theme bag without knowing which children the receiving component actually had, so any key
  outside the four flat role keys was read as a per-child override, accepted, and then dropped in silence
  by `resolveChildTheme()` — `theme.apiOptions` on a `CalendarResourcePicker`, which bundles no
  `ApiOptions`, or `theme.liturgy` on a `CalendarViewer`, which has no `LiturgyOfAnyDay`. That is the
  issue-#43 failure mode by a different route: markup rendered with library defaults, no throw and no
  warning, and nothing to notice until an end-to-end selector broke. **A consumer currently passing a
  misplaced key gets a new exception where it previously got silently unstyled markup.** That is the
  intent — a key that styles nothing is a bug the consumer cannot otherwise see — but it is a behaviour
  change: the fix is to move the key to the component that owns it, or delete it. The message names the
  rejecting component, the key, the keys that component does accept, and the components the key is valid
  on. Nothing that styles something today stops styling it; the per-component sets are derived from what
  each component actually resolves.
- **A bad theme key passed to `CalendarViewer`, `ApiExplorer` or `SubscriptionBuilder` is now reported
  under that component's name**, not `CalendarControls`'. All three forward their bag to an internal
  `CalendarControls`, which named itself when rejecting an option the caller had passed to a class they
  never touched — the misattribution PR #76 fixed for the `inputs` bag and this fixes for `theme`. Each
  now validates under its own name before forwarding, and forwards only the keys `CalendarControls`
  owns, which is what keeps `SubscriptionBuilder`'s `subscriptionUrl` working.
```

- [ ] **Step 4: Run the markdown gates**

Run: `yarn format:md:fix && yarn format:md && yarn lint:md`
Expected: prettier reports nothing to change, markdownlint reports zero errors.
MD013 (180-char lines) and MD029 are not fixed by prettier — wrap by hand if
either is reported.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs/meta-components.md CHANGELOG.md
git commit -S -m "$(cat <<'EOF'
Document component-aware theme validation (#78)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Full gate run

**Files:** none modified unless a gate fails.

- [ ] **Step 1: Run every gate, in order, and keep the real output**

```bash
yarn test
yarn compile && yarn lint:dts
yarn format:js
yarn format:md
yarn lint:md
```

Expected: `yarn test` reports 73 suites and more than 1350 tests (baseline was
72 / 1350, plus the new suite). `yarn lint:dts` must be clean — `Theme.js` is not
exported from `src/index.js`, so the new exports should not reach
`dist/index.d.ts` at all; if they do, that is a signal something exported them by
mistake.

- [ ] **Step 2: Fix anything a gate reports, then re-run that gate and `yarn test`**

`yarn format:js` failures are fixed by `yarn format:js:fix`. Commit any fix
separately with the same trailer.

- [ ] **Step 3: Commit the spec and plan if not already committed**

```bash
git add docs/superpowers/specs docs/superpowers/plans
git commit -S -m "$(cat <<'EOF'
Add the #78 spec and implementation plan

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

- **Spec coverage:** D1 → Task 1 Step 3; D2 → Task 1 Step 4; D3 → Task 2; D4/D5 → Task 1 Steps 3-4;
  backward compatibility → Task 3 Step 3; testing → Tasks 1 and 2; non-goals → Global Constraints and
  Task 3's closing paragraph.
- **Placeholders:** none — every step carries the code or the exact text.
- **Type consistency:** `THEME_CHILD_KEYS` and `narrowTheme( theme, componentName )` are named
  identically in every task that uses them; `assertTheme( theme, componentName )` keeps its existing
  two-argument signature throughout.
