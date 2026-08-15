# Public `ApiOptions` accessors — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** Give `ApiOptions`' ten form-control accessors non-underscore, canonical names, keep the underscore
forms working unchanged, and document the four remaining underscore accessors as genuinely internal.

**Architecture:** Ten new getters on `ApiOptions`, each reading `this.#inputs.<name>` directly; the existing
underscore getters become one-line delegates to them. `Theme.js`'s `apiOptions['_' + key]` lookup becomes
`apiOptions[key]`. No other library call site moves. Docs, README, `CLAUDE.md` and `examples/` are rewritten
to the canonical spelling.

**Tech Stack:** JavaScript ES2022 modules, JSDoc-driven `tsc` declaration emit, Jest 30, prettier,
markdownlint-cli2.

**Spec:** `docs/superpowers/specs/2026-08-15-public-api-options-accessors-design.md`

## Global Constraints

- Purely additive. No underscore accessor is removed, renamed or made to warn.
- The ten canonical names must be exactly `API_OPTIONS_INPUT_ROLES`' keys in `src/MetaComponents/Theme.js`:
  `epiphanyInput`, `ascensionInput`, `corpusChristiInput`, `eternalHighPriestInput`,
  `holydaysOfObligationInput`, `localeInput`, `yearTypeInput`, `yearInput`, `acceptHeaderInput`,
  `calendarPathInput`.
- `_filter`, `_filtersSet`, `_currentEndpoint`, `_base` get no alias.
- `Theme.js` edits are limited to the `'_' +` lookup and its doc paragraph (issue #67 is held in that file).
- `CalendarControls.js` and `CalendarViewer.js` are not touched (issue #63 owns them).
- No `@readonly` JSDoc tag on any getter — `tsc` emits the invalid `readonly get foo(): T;`.
- Line endings LF. `yarn format:js` and `yarn format:md` must pass.
- Gates: `yarn test`, `yarn compile && yarn lint:dts`, `yarn format:js`, `yarn format:md`, `yarn lint:md`.

---

### Task 1: The ten aliases

**Files:**

- Modify: `src/ApiOptions/ApiOptions.js:1431-1519` (the ten getters) and `:33-43` (the class doc list)
- Modify: `src/MetaComponents/Theme.js:880-900` (lookup and its paragraph)
- Test: `src/__tests__/ApiOptionsPublicAccessors.test.js` (create)

**Interfaces:**

- Produces: `ApiOptions.prototype.epiphanyInput`, `.ascensionInput`, `.corpusChristiInput`,
  `.eternalHighPriestInput`, `.holydaysOfObligationInput`, `.localeInput`, `.yearTypeInput`, `.yearInput`,
  `.acceptHeaderInput`, `.calendarPathInput` — read-only getters returning the same `Input` instances the
  underscore getters return.
- Consumes: `API_OPTIONS_INPUT_KEYS` from `src/MetaComponents/Theme.js`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/ApiOptionsPublicAccessors.test.js`, modelled on the existing
`src/__tests__/MetaComponentThemeApiOptions.test.js` for its `ApiBase.fromMetadata()` /
`ApiBase.reset()` setup:

```javascript
import { ApiOptions } from '../index.js';
import { ApiBase } from '../ApiClient/ApiBase.js';
import { API_OPTIONS_INPUT_KEYS } from '../MetaComponents/Theme.js';
import metadata from '../__fixtures__/metadata.js';

const CANONICAL = [
    'epiphanyInput',
    'ascensionInput',
    'corpusChristiInput',
    'eternalHighPriestInput',
    'holydaysOfObligationInput',
    'localeInput',
    'yearTypeInput',
    'yearInput',
    'acceptHeaderInput',
    'calendarPathInput',
];

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata('http://localhost:8000', metadata);
});

describe('ApiOptions canonical accessors', () => {
    test.each(CANONICAL)('%s returns the same input as its underscore alias', (name) => {
        const apiOptions = new ApiOptions('en');
        expect(apiOptions[name]).toBeDefined();
        expect(apiOptions[name]).toBe(apiOptions[`_${name}`]);
    });

    test('the canonical names are exactly the theme bag input keys', () => {
        expect([...CANONICAL].sort()).toEqual([...API_OPTIONS_INPUT_KEYS].sort());
    });

    test('neither spelling warns', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const apiOptions = new ApiOptions('en');
        for (const name of CANONICAL) {
            void apiOptions[name];
            void apiOptions[`_${name}`];
        }
        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
    });

    test('the internal accessors gain no public alias', () => {
        const apiOptions = new ApiOptions('en');
        expect(apiOptions.base).toBeUndefined();
        expect(apiOptions.filtersSet).toBeUndefined();
        expect(apiOptions.currentEndpoint).toBeUndefined();
        expect(typeof apiOptions.filter).toBe('function');
        expect(apiOptions._base).toBeDefined();
        expect(apiOptions._currentEndpoint).toBeDefined();
    });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `yarn test src/__tests__/ApiOptionsPublicAccessors.test.js`
Expected: the `%s returns the same input` cases fail with `expect(received).toBeDefined()` receiving
`undefined`.

- [ ] **Step 3: Add the ten getters**

In `src/ApiOptions/ApiOptions.js`, replace each underscore getter with a canonical getter carrying the doc
comment plus a one-line delegate. The shape, repeated for all ten:

```javascript
    /**
     * The Epiphany input control.
     *
     * @returns {EpiphanyInput} The Epiphany input control.
     */
    get epiphanyInput() {
        return this.#inputs.epiphanyInput;
    }

    /**
     * Legacy alias for {@link ApiOptions#epiphanyInput}.
     *
     * Supported, not deprecated, and emits no warning — see the note above the
     * canonical accessors.
     *
     * @returns {EpiphanyInput} The Epiphany input control.
     */
    get _epiphanyInput() {
        return this.epiphanyInput;
    }
```

Precede the block with a comment stating the policy: ten canonical accessors, four package-internal
underscore-only accessors, the legacy aliases are permanent. Do **not** add `@readonly`.

Also update the class-level doc list at `src/ApiOptions/ApiOptions.js:33-43` to name the canonical
accessors (`epiphanyInput`, …) instead of `___epiphanyInput__`.

- [ ] **Step 4: Simplify the `Theme.js` lookup**

In `src/MetaComponents/Theme.js`, change

```javascript
        const input = apiOptions[`_${inputKey}`];
```

to

```javascript
        const input = apiOptions[inputKey];
```

and rewrite the doc paragraph at lines 880-883 from _"The `'_' + inputKey` lookup … Should those accessors
ever gain non-underscore aliases…"_ to record that they now have them and the lookup is direct. Update the
sentence in `API_OPTIONS_INPUT_ROLES`' doc comment (lines 116-120) that says the names are the accessors
"with the leading underscore stripped" — they are now the accessor names themselves.

- [ ] **Step 5: Run the tests**

Run: `yarn test`
Expected: PASS, including `MetaComponentThemeApiOptions.test.js`, which exercises the changed lookup.

- [ ] **Step 6: Commit**

```bash
git add src/ApiOptions/ApiOptions.js src/MetaComponents/Theme.js src/__tests__/ApiOptionsPublicAccessors.test.js
git commit -S -m "Add canonical, non-underscore ApiOptions accessors (#62)"
```

---

### Task 2: The declaration-file assertion

**Files:**

- Modify: `type-fixtures/dts-consumer.ts`

**Interfaces:**

- Consumes: the ten getters from Task 1, as emitted into `dist/index.d.ts`.

- [ ] **Step 1: Add the assertion**

Append to `type-fixtures/dts-consumer.ts`:

```typescript
import { ApiOptions } from '../dist/index.js';

/**
 * Every canonical `ApiOptions` accessor must reach the emitted declarations, and
 * must have the same type as the underscore alias it replaces.
 *
 * No runtime test can see this. A JSDoc mistake that dropped a getter from the
 * `.d.ts` — a stray `@readonly`, which `tsc` emits as the syntactically invalid
 * `readonly get foo(): T;` — still passes `yarn test`, because the getter itself
 * is fine at run time.
 *
 * Written as mutual assignments in both directions so that a canonical accessor
 * typed more loosely than its alias fails too, not only a missing one.
 */
type ApiOptionsInstance = InstanceType<typeof ApiOptions>;

const canonicalMatchesAlias: {
    epiphanyInput: ApiOptionsInstance['_epiphanyInput'];
    ascensionInput: ApiOptionsInstance['_ascensionInput'];
    corpusChristiInput: ApiOptionsInstance['_corpusChristiInput'];
    eternalHighPriestInput: ApiOptionsInstance['_eternalHighPriestInput'];
    holydaysOfObligationInput: ApiOptionsInstance['_holydaysOfObligationInput'];
    localeInput: ApiOptionsInstance['_localeInput'];
    yearTypeInput: ApiOptionsInstance['_yearTypeInput'];
    yearInput: ApiOptionsInstance['_yearInput'];
    acceptHeaderInput: ApiOptionsInstance['_acceptHeaderInput'];
    calendarPathInput: ApiOptionsInstance['_calendarPathInput'];
} = null as unknown as Pick<
    ApiOptionsInstance,
    | 'epiphanyInput'
    | 'ascensionInput'
    | 'corpusChristiInput'
    | 'eternalHighPriestInput'
    | 'holydaysOfObligationInput'
    | 'localeInput'
    | 'yearTypeInput'
    | 'yearInput'
    | 'acceptHeaderInput'
    | 'calendarPathInput'
>;
void canonicalMatchesAlias;
```

- [ ] **Step 2: Compile and check**

Run: `yarn compile && yarn lint:dts`
Expected: both exit 0. If `lint:dts` reports TS2339 for a canonical name, the getter did not reach the
emit — read `dist/index.d.ts` before changing the fixture.

- [ ] **Step 3: Read the emitted declarations**

Run: `grep -n "Input:" dist/index.d.ts | head -40`
Expected: each of the ten canonical names appears alongside its underscore alias, and no line reads
`readonly get`.

- [ ] **Step 4: Commit**

```bash
git add type-fixtures/dts-consumer.ts
git commit -S -m "Assert the canonical accessors reach the emitted declarations (#62)"
```

---

### Task 3: Documentation and examples

**Files:**

- Modify: `docs/api-options.md`, `docs/meta-components.md`, `docs/path-builder.md`, `docs/rite-select.md`,
  `docs/utils.md`, `docs/liturgy-components.md`, `README.md`, `CLAUDE.md`, `CHANGELOG.md`
- Modify: `examples/LiturgyOfAnyDay/main.js`, `examples/LiturgyOfTheDay/main.js`,
  `examples/MultipleForms/main.js`, `examples/PathBuilder/main.js`, `examples/RiteSelectChain/main.js`,
  `examples/RiteSelectPathBuilder/main.js`, `examples/RiteSelectWebCalendar/main.js`,
  `examples/WebCalendar/main.js`
- Leave alone: everything under `docs/superpowers/`

- [ ] **Step 1: Mechanical rename across docs and examples**

For each of the ten names, replace `._<name>` with `.<name>` and `` `_<name>` `` with `` `<name>` ``. Do
not touch `_domElement`, `_labelElement`, `_filter`, `_base`, `_currentEndpoint`, `_filtersSet`, or
`LiturgyOfAnyDay._yearInput`.

- [ ] **Step 2: Rewrite `docs/api-options.md`'s "Form Controls" preamble**

Replace the two paragraphs and the blockquote that currently explain the underscore convention with a
statement of the policy: ten canonical accessors, listed in the tables below; the underscore forms are
permanent, warning-free aliases kept for compatibility; `_filter`, `_filtersSet`, `_currentEndpoint` and
`_base` are package-internal and have no canonical form. Add a "Legacy alias" column to the three property
tables. Correct "nine form controls" to "ten".

- [ ] **Step 3: Update `CLAUDE.md`**

Rewrite the `theme.apiOptions` bullet that says the per-input keys are "named for `ApiOptions`' accessors
with the underscore stripped" — they are now the accessor names — and the two worked examples in the
"Typical Page Setup" and "LocaleInput Selection Logic" sections that read `apiOptions._localeInput`. Add a
short paragraph under the `ApiOptions` material recording the accessor policy and why there is no warning.

- [ ] **Step 4: CHANGELOG entry**

Under `## [Unreleased]`, in the additions section, describe the ten aliases, the four that stay internal,
and the deliberate absence of a deprecation warning.

- [ ] **Step 5: Gates**

```bash
yarn format:js && yarn format:md && yarn lint:md && yarn test && yarn compile && yarn lint:dts
```

Expected: all exit 0. Then confirm no stale underscore input reads remain outside `src/` and
`docs/superpowers/`:

```bash
grep -rn "_epiphanyInput\|_ascensionInput\|_corpusChristiInput\|_eternalHighPriestInput\|_holydaysOfObligationInput\|_localeInput\|_yearTypeInput\|_acceptHeaderInput\|_calendarPathInput" docs examples README.md CLAUDE.md | grep -v docs/superpowers
```

Expected: only the lines that deliberately name the legacy aliases.

- [ ] **Step 6: Commit**

```bash
git add docs examples README.md CLAUDE.md CHANGELOG.md
git commit -S -m "Show the canonical ApiOptions accessors everywhere (#62)"
```

## Self-review

- **Spec coverage:** D1 → Task 1 Step 3; D2 → Task 1 Step 1 (test) and Task 3 Step 2 (docs); D3 → Task 1
  Step 3 (no warning) and Task 3 Steps 2-4 (documented); D4 → Task 1 Step 3; D5 → Task 1 Step 4; D6 → no
  task, by construction; D7 → Task 3; D8 → Task 1 Step 1; D9 → Task 2.
- **Placeholders:** none; every code step carries the code.
- **Type consistency:** the ten names are written out identically in the spec, the test, the fixture and
  the constraint list.
