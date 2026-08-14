# Export a `VERSION` constant — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended)
> or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax
> for tracking.

**Goal:** Export a `VERSION` string constant from the package so a running page can report which build it is on.

**Architecture:** A new `src/Version.js` holds one hand-maintained literal, re-exported from `src/index.js`.
A Jest test reads the real `package.json` off disk and fails when the two drift, so the release-time bump
cannot be silently skipped. No generator, no build step, no new dependency.

**Tech Stack:** Plain ES2022 module; TypeScript 5.7 `tsc` in `allowJs`/`declaration` mode for the emit;
Jest 30 with `--experimental-vm-modules` for the tests.

Spec: `docs/superpowers/specs/2026-08-14-export-version-design.md`.

## Global Constraints

- **Do not bump `package.json`'s `version`.** It stays at `2.7.0`. This branch adds the mechanism, not a release.
- **Do not touch any source file other than `src/Version.js` and `src/index.js`.** Four sibling branches are
  in flight; keep the diff minimal.
- **ES2022 floor.** No import attributes (`with { type: 'json' }`), no syntax or runtime API newer than
  ES2022. See the spec's Decision 1 for why the JSON-import route is rejected.
- **`VERSION` must declare as `string`, not a string literal type,** in `dist/index.d.ts`. Achieved with a
  JSDoc `@type {string}` annotation.
- **Prettier owns `src/`:** 4-space indent, single-quoted strings (`.prettierrc`). `yarn format:js` must pass.
- **Markdown:** 180-char lines, fenced blocks with language specifiers, blank lines around lists and code
  blocks, tables vertically aligned. `yarn lint:md` and `yarn format:md` must pass.
- **No `@readonly` JSDoc tag on anything**, per `CLAUDE.md` — `tsc` emits it as invalid TypeScript on getters.
- The current `package.json` version is `2.7.0`; that is the literal `src/Version.js` must carry today.

---

### Task 1: The `VERSION` constant, its drift test, and the barrel export

**Files:**

- Create: `src/Version.js`
- Modify: `src/index.js` (add one import line and one entry to the `export { … }` list)
- Test: `src/__tests__/Version.test.js`

**Interfaces:**

- Consumes: nothing.
- Produces: `export const VERSION` — a `string` — from `src/Version.js`, re-exported by name from
  `src/index.js`. Task 2 documents this exact name; no other symbol is added.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/Version.test.js`:

```javascript
/**
 * The drift gate for the exported version constant.
 *
 * `src/Version.js` is hand-maintained rather than generated (see
 * `docs/superpowers/specs/2026-08-14-export-version-design.md`, Decision 1), so
 * the one thing that has to be mechanical is catching a release that bumps
 * `package.json` and forgets the constant. A version constant nobody can trust
 * is the exact failure #64 is about, so an untrue claim has to be loud.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { VERSION } from '../Version.js';
import * as index from '../index.js';

const packageJson = JSON.parse(
    readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
);

describe('VERSION', () => {
    it("matches package.json's version", () => {
        expect(VERSION).toBe(packageJson.version);
    });

    /**
     * Asserted on its own terms as well as against `package.json`, so a bad edit
     * to either file fails with a message about the thing that is actually wrong
     * rather than only as a mismatch between two equally suspect strings.
     */
    it('is a non-empty semver-shaped string', () => {
        expect(typeof VERSION).toBe('string');
        expect(VERSION).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/);
    });

    it('is re-exported from the package entry point', () => {
        expect(index.VERSION).toBe(VERSION);
    });
});
```

- [ ] **Step 2: Run the test and confirm it fails for the right reason**

Run: `yarn test src/__tests__/Version.test.js`

Expected: FAIL. The failure is a module resolution error — `Cannot find module '../Version.js'` — because
`src/Version.js` does not exist yet. If it fails for any other reason, stop and investigate before writing
the implementation.

- [ ] **Step 3: Write the minimal implementation**

Create `src/Version.js`:

```javascript
/**
 * The version of this package, as a string.
 *
 * Hand-maintained, and kept honest by `src/__tests__/Version.test.js`, which
 * reads `package.json` off disk and fails when the two drift. Bumping a release
 * therefore means editing two files: `package.json` and this one.
 *
 * Generating this file at build time was considered and rejected: `dist/` is
 * gitignored, so a generated file would have to land in `src/` — either
 * committed (identical to this, plus a generator) or gitignored (breaking
 * `yarn test` and `yarn storybook` on a fresh clone). Importing `package.json`
 * with `with { type: 'json' }` was also rejected: `tsc` emits that import
 * verbatim, so every consumer would evaluate it at run time, and import
 * attributes need Chrome 123+/Firefox 121+/Safari 17.2+/Node 20.10+ against this
 * package's documented ES2022 floor of Chrome 94+/Firefox 93+/Safari 15.4+/Node
 * 16.11+.
 *
 * Annotated `string` rather than left to widen to its literal type: without the
 * annotation `tsc` declares `export const VERSION: "2.7.0"`, and a consumer
 * comparing it against any other literal — the version-floor check this constant
 * exists for — gets TS2367 instead of a boolean.
 *
 * @type {string}
 */
export const VERSION = '2.7.0';
```

- [ ] **Step 4: Add the barrel export**

In `src/index.js`, add the import alongside the existing ones (after the `Utils` import, before the
`Enums.js` import block):

```javascript
import { VERSION } from './Version.js';
```

and add `VERSION,` to the `export { … }` list, as the last entry after `RiteProperties,`.

- [ ] **Step 5: Run the test and confirm it passes**

Run: `yarn test src/__tests__/Version.test.js`

Expected: PASS, 3 tests.

- [ ] **Step 6: Run the full suite to confirm nothing regressed**

Run: `yarn test`

Expected: PASS. Baseline on `main` is 64 suites / 1191 tests; this adds 1 suite / 3 tests, so expect
65 suites / 1194 tests.

- [ ] **Step 7: Compile, check the declarations, and read the actual emit**

Run:

```bash
yarn compile && yarn lint:dts
grep -n "VERSION" dist/index.js dist/index.d.ts dist/Version.js dist/Version.d.ts
```

Expected: both commands exit 0, and the grep shows `export const VERSION: string;` in `dist/Version.d.ts`
(**not** `: "2.7.0"`), `VERSION` re-exported from `dist/index.d.ts`, and the literal `'2.7.0'` in
`dist/Version.js`. `CLAUDE.md` warns that `checkJs` is off, so a green `yarn compile` proves nothing on its
own — reading the emit is the actual check.

- [ ] **Step 8: Formatting gates**

Run: `yarn format:js`

Expected: pass. If it reports either new file, run `yarn format:js:fix` and re-run.

---

### Task 2: Documentation

**Files:**

- Modify: `README.md` (the `## Exports` code block, plus a short new section)
- Modify: `CLAUDE.md` (record the release-time two-file bump where a releaser will meet it)
- Modify: `CHANGELOG.md` (a new `## [Unreleased]` heading above `## 2.7.0`)

**Interfaces:**

- Consumes: the `VERSION` export from Task 1.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add `VERSION` to the README's `## Exports` block**

In `README.md`, inside the `## Exports` fenced block, add a trailing group after `RiteProperties`:

```javascript
    // Metadata
    VERSION
```

- [ ] **Step 2: Add a README section explaining what it is for**

Insert this immediately after the `## Exports` section and before `## Key Features`:

The outer fence below is five backticks so the inner three-backtick block survives quoting. Write the
section into `README.md` as ordinary content — a `## Version` heading, the prose, and one three-backtick
`javascript` block — not with the five-backtick wrapper.

````markdown
## Version

`VERSION` is this package's own version as a string, so a running page can report which build it is on:

```javascript
import { VERSION } from '@liturgical-calendar/components-js';

console.debug(`components-js ${VERSION}`);
```

This matters when the library is resolved more than one way. A page that loads it from a symlinked local
build in development and a pinned CDN tag in production can silently run two different versions, and a
pinned importmap is not evidence of what actually loaded: jsDelivr rebuilds `+esm` bundles, and a stale
browser cache can serve an old module from a URL that reads current. `VERSION` is what the loaded module
itself says, so it answers the question the URL cannot.

It is typed `string` rather than a string literal, so a consumer's version-floor comparison type-checks
instead of raising TS2367.
````

- [ ] **Step 3: Add the release step to `CLAUDE.md`**

Append a subsection at the end of `CLAUDE.md`'s `## Important Notes` section (or as a short section
immediately after it), so a releaser meets it where they already look:

```markdown
## Releasing

**A version bump is a two-file edit: `package.json` and `src/Version.js`.** The exported `VERSION`
constant is hand-maintained rather than generated — the alternatives each cost more than they save (a
generator would have to write into `src/`, since `dist/` is gitignored; a `with { type: 'json' }` import of
`package.json` is emitted verbatim by `tsc` and would raise the runtime floor to Chrome 123+/Node 20.10+,
against this package's documented ES2022 floor). Forgetting the second file is not silent:
`src/__tests__/Version.test.js` reads `package.json` off disk and fails on drift.
```

- [ ] **Step 4: Add the CHANGELOG entry**

Insert directly above the `## 2.7.0` heading in `CHANGELOG.md`. Keep it tightly scoped to #64 — four
sibling branches will each add their own entry under the same `## [Unreleased]` heading, and they have to
merge cleanly:

```markdown
## [Unreleased]

### Added

- **`VERSION`**, closing #64 — the package's version as an exported string, so a running page can report
  which build it is on. `LiturgicalCalendarFrontend` resolves this library through a symlinked local build
  in development and a pinned CDN tag in production; those two silently diverged by five minor versions,
  and a pinned importmap could not settle it either, since jsDelivr rebuilds `+esm` bundles and a stale
  cache can serve an old module from a current-looking URL. The constant is hand-maintained in
  `src/Version.js` rather than generated, so a release is now a two-file bump — `src/__tests__/Version.test.js`
  reads `package.json` off disk and fails on drift, so forgetting it is a red build rather than a false
  claim. It is declared `string` rather than a literal type, so a consumer's version-floor comparison
  type-checks. No `ApiClient.version`: `ApiClient` and `ApiBase` deal in the API's own versioned base URLs
  (`/api/dev`), so a `version` there would read as the API's version, not this package's.
```

- [ ] **Step 5: Markdown gates**

Run:

```bash
yarn format:md
yarn lint:md
```

Expected: both pass. If `format:md` reports files, run `yarn format:md:fix` and re-run both — prettier is
what fixes MD060 table alignment, `markdownlint-cli2 --fix` cannot.

- [ ] **Step 6: Full verification sweep**

Run every gate and read the real output:

```bash
yarn test
yarn compile && yarn lint:dts
yarn format:js
yarn format:md
yarn lint:md
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/Version.js src/index.js src/__tests__/Version.test.js README.md CLAUDE.md CHANGELOG.md docs/superpowers
git commit -m "$(cat <<'EOF'
Export a VERSION constant so a page can report its build

Closes #64.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

Do **not** `git push` and do **not** open a pull request.

---

## Self-Review

**Spec coverage.** Decision 1 (hand-maintained constant plus drift test) → Task 1 Steps 1–3. Decision 2
(`VERSION` only, no `ApiClient.version`) → enforced by the Global Constraints' "no other source file" rule
and recorded in Task 2 Step 4's CHANGELOG text. Decision 3 (`string`, not the literal) → Task 1 Step 3's
`@type {string}` and verified at Step 7. Surface → Task 1 Step 4. Tests → all three spec-listed assertions
appear verbatim in Task 1 Step 1. Release note → Task 2 Step 3. Out-of-scope items → Global Constraints.

**Placeholder scan.** No TBDs, no "handle edge cases", no "similar to Task N". Every code step carries the
literal content to write.

**Type consistency.** One symbol, `VERSION`, spelled identically in `src/Version.js`, `src/index.js`, the
test, the README, `CLAUDE.md` and the CHANGELOG. The declared type is `string` in the source annotation,
the emit check, and the CHANGELOG's description.
