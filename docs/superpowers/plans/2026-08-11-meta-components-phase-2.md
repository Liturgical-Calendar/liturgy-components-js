# Meta-components Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** Add `CalendarControls` (a renderer-agnostic form + client wiring), plus `CalendarViewer`
and `ApiExplorer` composing over it, so all four downstream consumers of that wiring stop
hand-writing it.

**Architecture:** `CalendarControls` bundles `RiteSelect` + `CalendarSelect` + `ApiOptions` and
drives an `ApiClient`, with no renderer. `CalendarViewer` composes it with `WebCalendar`;
`ApiExplorer` composes it with `PathBuilder` and turns fetching off. All three follow the contracts
phase 1 settled — theme bag, `mountInto()` reject-on-programmer-error, `dispose()`,
`#assertUsable()` everywhere.

**Tech Stack:** ES2022 modules, Jest 30 + jsdom, TypeScript 5.7 for declaration emit only, Prettier, markdownlint-cli2, Yarn 4.6.

**Design spec:** `docs/superpowers/specs/2026-08-11-meta-components-phase-2-design.md`

**Phase 1 reference:** `src/MetaComponents/CalendarResourcePicker.js` and `DayViewer.js` are complete and are the pattern. Read them before writing anything.

## Global Constraints

- **ECMAScript floor is ES2022**, pinned in `tsconfig.json`. `Object.hasOwn()` is fine; `toSorted`, `toSpliced`, `Array.prototype.with`, `findLast` and `structuredClone` are not.
- **`checkJs` is off.** A green `yarn compile` proves nothing about JS correctness or `.d.ts`
  validity. `yarn lint:dts` is the gate, and it checks whatever is already in `dist/` — run `yarn
compile` first.
- **Never put `@readonly` on a getter** in JSDoc: `tsc` emits the invalid `readonly get foo(): T;`.
- **Prettier owns `src/`**: `tabWidth: 4`, `singleQuote: true`. Run `yarn format:js:fix`, then `yarn
format:js` to confirm. Transcribing code from this plan does not exempt you — a phase 1 task shipped
  unformatted exactly that way.
- **Markdown**: `yarn format:md:fix`, then BOTH `yarn lint:md` (0 issues) and `yarn format:md`. Max line 180.
- **`appendTo()` returns `undefined`**; `mountInto()` returns a Promise; `dispose()` returns `undefined`; `onCalendarFetched()`/`onError()`/`listenTo()` return `this`.
- **Tests never hit the network.** Build bases with `ApiBase.fromMetadata(url, metadata)` and call `ApiBase.reset()` in `beforeEach`.
- **The suite must pass with no `dist/` directory.** Verify by moving `dist` aside, running the full
  suite, then restoring it. Story render helpers must import relative `src/` paths, never the package
  specifier.
- **Never use `--no-verify`.** Do not commit `dist/` — it is gitignored, and `git add dist/` aborts the whole commit.
- **Version target: 2.3.0.** Additive; no existing component API changes.
- **Do not weaken, delete or loosen any existing test.**

---

### Task 1: Stop jest discovering worktree copies of every test

Do this first: until it lands, every test count in this plan is unreliable.

**Files:**

- Modify: `package.json`
- Test: verified by measurement, not a unit test (see Step 3)

**Interfaces:**

- Consumes: nothing.
- Produces: a `"jest"` config key with `testPathIgnorePatterns`.

- [ ] **Step 1: Measure the current behaviour**

Run:

```bash
git worktree add .claude/worktrees/jest-probe -b chore/jest-probe HEAD
yarn test --listTests 2>/dev/null | wc -l
yarn test --listTests 2>/dev/null | grep -c "worktrees"
```

Expected: the second number is greater than zero, and equals roughly half the first — jest is discovering the worktree's copy of every test file.

- [ ] **Step 2: Add the config**

`package.json` has no jest configuration at all, and the project is `"type": "module"`, so a
`jest.config.js` would have to be ESM. Adding a `"jest"` key to `package.json` avoids the
module-format question entirely and is the smaller change. Insert it as a top-level key, after
`"scripts"`:

```json
  "jest": {
    "testPathIgnorePatterns": [
      "/node_modules/",
      "/\\.claude/",
      "/\\.worktrees/",
      "/worktrees/"
    ]
  },
```

Note the escaped dots: these are regular expressions, not globs.

- [ ] **Step 3: Verify the measurement changed**

Run:

```bash
yarn test --listTests 2>/dev/null | grep -c "worktrees"
```

Expected: `0`.

Then run the full suite and confirm the totals halved back to the real figure:

```bash
yarn test
```

Expected: 43 suites, 909 tests — the true count, not the doubled one.

- [ ] **Step 4: Remove the probe worktree**

```bash
git worktree remove .claude/worktrees/jest-probe
git branch -D chore/jest-probe
git worktree prune
```

Confirm `git status --short` is clean apart from `package.json`.

- [ ] **Step 5: Commit**

```bash
yarn format:js:fix
git add package.json
git commit -m "Stop jest discovering worktree copies of every test

Jest had no testPathIgnorePatterns, so running the suite from the repo root
while a worktree existed under .claude/worktrees/ discovered both copies of
every test file — measured during the 2.2.0 release as 43 of 86 discovered
files, producing a phantom 1818-test run. CI never saw it, having no
worktree, but any local run during worktree-based work silently doubled, and
it caused one incorrect implementation report during phase 1."
```

---

### Task 2: `CalendarControls` core

Constructor, children, theme, mount ordering and the rite's two wires. No fetching yet.

**Files:**

- Create: `src/MetaComponents/CalendarControls.js`
- Test: `src/__tests__/CalendarControls.test.js`

**Interfaces:**

- Consumes: `resolveChildTheme`/`assertTheme` from `./Theme.js`; `resolveBase`/`assertSameBase` from
  `../ApiClient/ApiBase.js`; `normalizeComponentOptions`/`describeType` from
  `../OptionsValidation.js`; `canonicalizeLocale` from `../LocaleValidation.js`.
- Produces: `new CalendarControls(options)`, getters `riteSelect` / `calendarSelect` / `apiOptions`, `appendTo(target) → undefined`, `listenTo(apiClient) → this`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/CalendarControls.test.js`:

```javascript
/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import CalendarControls from '../MetaComponents/CalendarControls.js';
import { ApiOptionsFilter } from '../Enums.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

/**
 * Records every URL requested, answering each with an empty but well-formed
 * calendar payload. Assertions are about which path was requested, never about
 * the response.
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
    document.body.replaceChildren();
    const mount = document.createElement('div');
    mount.id = 'mount';
    document.body.appendChild(mount);
});

describe('CalendarControls construction', () => {
    it('builds all three children', () => {
        const controls = new CalendarControls({ locale: 'en' });
        expect(controls.riteSelect).not.toBeNull();
        expect(controls.calendarSelect).not.toBeNull();
        expect(controls.apiOptions).not.toBeNull();
    });

    it('rejects an unparseable locale, naming this component', () => {
        expect(() => new CalendarControls({ locale: 'not a locale' })).toThrow(
            /CalendarControls/,
        );
    });

    it('rejects a malformed theme, naming this component', () => {
        expect(
            () => new CalendarControls({ locale: 'en', theme: 'form-select' }),
        ).toThrow(/CalendarControls.*theme/);
    });

    it('applies the theme to the children', () => {
        const controls = new CalendarControls({
            locale: 'en',
            theme: {
                select: 'form-select',
                riteSelect: { class: 'form-select mb-2' },
            },
        });
        controls.appendTo('#mount');
        expect(controls.riteSelect._domElement.className).toBe(
            'form-select mb-2',
        );
        expect(controls.calendarSelect._domElement.className).toBe(
            'form-select',
        );
    });
});

describe('CalendarControls mounting', () => {
    it('mounts the rite select before the calendar select', () => {
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#mount');
        const selects = document.querySelectorAll('#mount select');
        expect(selects[0]).toBe(controls.riteSelect._domElement);
    });

    it('returns undefined from appendTo', () => {
        const controls = new CalendarControls({ locale: 'en' });
        expect(controls.appendTo('#mount')).toBeUndefined();
    });

    it('throws when the target matches nothing, naming this component', () => {
        const controls = new CalendarControls({ locale: 'en' });
        expect(() => controls.appendTo('#nope')).toThrow(
            /CalendarControls.*nope/,
        );
    });

    it('is callable more than once without duplicating children', () => {
        const other = document.createElement('div');
        other.id = 'other';
        document.body.appendChild(other);
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#mount');
        controls.appendTo('#other');
        expect(document.querySelectorAll('#mount select').length).toBe(0);
        expect(
            document.querySelectorAll('#other select').length,
        ).toBeGreaterThanOrEqual(2);
    });
});

describe('CalendarControls rite wiring', () => {
    // The regression this whole family exists to prevent. Wire only
    // linkToRiteSelect() and the form reads `ambrosian` while every request
    // still goes to /calendar/roman/.
    it('requests the ambrosian path after a rite change', async () => {
        const urls = captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#mount');
        controls.listenTo(apiClient);

        controls.riteSelect._domElement.value = 'ambrosian';
        controls.riteSelect._domElement.dispatchEvent(
            new Event('change', { bubbles: true }),
        );
        await new Promise((resolve) => setTimeout(resolve, 0));

        const calendarRequests = urls.filter((u) => u.includes('/calendar'));
        expect(calendarRequests.length).toBeGreaterThan(0);
        expect(calendarRequests.at(-1)).toContain('/calendar/ambrosian');
        expect(calendarRequests.at(-1)).not.toContain('/calendar/roman');
    });

    it('is chainable', async () => {
        captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#mount');
        expect(controls.listenTo(apiClient)).toBe(controls);
    });

    it('refuses to rebind to a second client, naming this component', async () => {
        captureRequests();
        const first = await ApiClient.init(API_URL);
        const second = await ApiClient.init(API_URL);
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#mount');
        controls.listenTo(first);
        expect(() => controls.listenTo(second)).toThrow(
            /CalendarControls.*already wired/,
        );
    });

    it('honours the filter option', () => {
        const controls = new CalendarControls({
            locale: 'en',
            filter: ApiOptionsFilter.LOCALE_ONLY,
        });
        controls.appendTo('#mount');
        expect(controls.apiOptions._localeInput).not.toBeNull();
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/CalendarControls.test.js`

Expected: FAIL — cannot resolve `../MetaComponents/CalendarControls.js`.

- [ ] **Step 3: Implement**

Create `src/MetaComponents/CalendarControls.js`. **Read `src/MetaComponents/DayViewer.js` first** —
this class is closely modelled on it, and every convention it uses (private field style, the static
`#requireElement` target resolver, `#assertUsable()`, `#releaseRiteWiring()`, JSDoc density) should
be matched rather than reinvented.

```javascript
/**
 * The rite select, calendar select and API options of a calendar page, wired to
 * one another and to an `ApiClient` — with no renderer.
 *
 * The renderer is the axis of variation and the wiring is not: the same 45-line
 * block appears byte-for-byte in a `WebCalendar` example and a FullCalendar one,
 * and again, minus the fetching, in the API explorer. This class is that block.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import ApiClient from '../ApiClient/ApiClient.js';
import { resolveBase, assertSameBase } from '../ApiClient/ApiBase.js';
import { ApiOptionsFilter } from '../Enums.js';
import { normalizeComponentOptions } from '../OptionsValidation.js';
import { canonicalizeLocale } from '../LocaleValidation.js';
import { assertTheme, resolveChildTheme } from './Theme.js';

export default class CalendarControls {
    /** @type {string} */
    #locale = 'en';

    /** @type {RiteSelect} */
    #riteSelect;

    /** @type {CalendarSelect} */
    #calendarSelect;

    /** @type {ApiOptions} */
    #apiOptions;

    /** @type {ApiClient|null} */
    #apiClient = null;

    /** @type {import('../ApiClient/ApiBase.js').default} */
    #base;

    /** @type {HTMLElement|null} */
    #mount = null;

    /** @type {boolean} */
    #disposed = false;

    /** @type {boolean} */
    #riteLinked = false;

    /**
     * @param {Object|string|Intl.Locale} [options] - Options bag, or a locale.
     * @param {string|Intl.Locale} [options.locale] - The display locale.
     * @param {string} [options.filter] - Which `ApiOptions` inputs to show.
     * @param {Object} [options.theme] - The theme bag; see `Theme.js`.
     * @param {Object} [options.apiClient] - Binds to that client's API base.
     */
    constructor(options) {
        options = normalizeComponentOptions(options, 'CalendarControls');
        const { locale, filter, theme, apiClient } = options;

        if (locale !== undefined && locale !== null) {
            this.#locale = canonicalizeLocale(locale, 'CalendarControls');
        }
        assertTheme(theme, 'CalendarControls');
        this.#base = resolveBase(apiClient, 'CalendarControls');

        const riteTheme = resolveChildTheme(theme, 'riteSelect');
        this.#riteSelect = new RiteSelect({ locale: this.#locale });
        if (Object.hasOwn(riteTheme, 'class')) {
            this.#riteSelect.class(riteTheme.class);
        }
        if (
            Object.hasOwn(riteTheme, 'labelClass') ||
            Object.hasOwn(riteTheme, 'labelText')
        ) {
            const labelOptions = {};
            if (Object.hasOwn(riteTheme, 'labelClass')) {
                labelOptions.class = riteTheme.labelClass;
            }
            if (Object.hasOwn(riteTheme, 'labelText')) {
                labelOptions.text = riteTheme.labelText;
            }
            this.#riteSelect.label(labelOptions);
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
        if (
            Object.hasOwn(calendarTheme, 'labelClass') ||
            Object.hasOwn(calendarTheme, 'labelText')
        ) {
            const labelOptions = {};
            if (Object.hasOwn(calendarTheme, 'labelClass')) {
                labelOptions.class = calendarTheme.labelClass;
            }
            labelOptions.text = Object.hasOwn(calendarTheme, 'labelText')
                ? calendarTheme.labelText
                : undefined;
            this.#calendarSelect.label(labelOptions);
        }
        if (Object.hasOwn(calendarTheme, 'wrapperClass')) {
            this.#calendarSelect.wrapper({
                class: calendarTheme.wrapperClass,
            });
        }

        this.#apiOptions = new ApiOptions({
            locale: this.#locale,
            apiClient,
        }).filter(filter ?? ApiOptionsFilter.ALL_CALENDARS);
    }

    /** @returns {RiteSelect} The wired rite select. */
    get riteSelect() {
        this.#assertUsable();
        return this.#riteSelect;
    }

    /** @returns {CalendarSelect} The wired calendar select. */
    get calendarSelect() {
        this.#assertUsable();
        return this.#calendarSelect;
    }

    /** @returns {ApiOptions} The wired ApiOptions. */
    get apiOptions() {
        this.#assertUsable();
        return this.#apiOptions;
    }

    /**
     * Guards every method a disposed instance cannot honour.
     *
     * @returns {void}
     * @throws {Error} If this instance has been disposed.
     */
    #assertUsable() {
        if (true === this.#disposed) {
            throw new Error(
                'CalendarControls: these controls have been disposed and can no longer be used.',
            );
        }
    }

    /**
     * Resolves a mount target to an element.
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
                `CalendarControls.${caller}: target must be a non-empty CSS selector or an HTMLElement.`,
            );
        }
        const element = document.querySelector(target);
        if (null === element) {
            throw new Error(
                `CalendarControls.${caller}: Element not found: ${target}`,
            );
        }
        return element;
    }

    /**
     * Mounts the three children into the target, rite select first so it reads
     * first in the form.
     *
     * `linkToRiteSelect()` does NOT require the select to be in the document —
     * it only calls `addEventListener` and reads `.value`, both fine detached —
     * so the ordering is for form layout, nothing else.
     *
     * Callable more than once; the children are moved rather than copied.
     *
     * @param {string|HTMLElement} target - Where to mount.
     * @returns {void}
     */
    appendTo(target) {
        this.#assertUsable();
        const element = CalendarControls.#requireElement(target, 'appendTo');
        this.#mount = element;
        this.#riteSelect.appendTo(element);
        this.#calendarSelect.appendTo(element);
        this.#apiOptions.appendTo(element);
    }

    /**
     * Wires the controls to an `ApiClient`.
     *
     * The rite needs BOTH wires: `ApiOptions.linkToRiteSelect()` rebuilds the
     * calendar list and disables the temporal options the rite fixes, while only
     * `ApiClient.listenTo( riteSelect )` turns the rite into a URL path segment.
     * Wire just the first and the failure is silent — the form reads `ambrosian`
     * while every request still goes to `/calendar/roman/`.
     *
     * Rebinding is refused before anything is wired, so a rejected call leaves
     * the previous client and its subscriptions untouched.
     *
     * @param {ApiClient} apiClient - The client to drive.
     * @returns {CalendarControls} This instance.
     */
    listenTo(apiClient) {
        this.#assertUsable();
        if (null !== this.#apiClient) {
            throw new Error(
                'CalendarControls.listenTo: these controls are already wired to an ApiClient. Build a second CalendarControls to drive a second client.',
            );
        }
        assertSameBase(
            this.#base,
            apiClient?.base,
            'CalendarControls.listenTo: these controls and the ApiClient passed to them',
            'Controls filled from one API while their requests go to another would describe neither.',
        );

        if (false === this.#riteLinked) {
            this.#apiOptions
                .linkToCalendarSelect(this.#calendarSelect)
                .linkToRiteSelect(this.#riteSelect);
            this.#riteLinked = true;
        }
        apiClient
            .listenTo(this.#calendarSelect)
            .listenTo(this.#riteSelect)
            .listenTo(this.#apiOptions);
        this.#apiClient = apiClient;
        return this;
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test src/__tests__/CalendarControls.test.js`

Expected: PASS, 10 tests.

- [ ] **Step 5: Verify the headline test is not vacuous**

Temporarily replace the `.listenTo(this.#riteSelect)` line in `listenTo()` with a comment, re-run
the single test file, and confirm the ambrosian test FAILS with a received path containing
`/calendar/roman/`. Restore the line, confirm it passes, and confirm `git status --short` shows no
leftover mutation before committing. Record the observed failure message in your report.

- [ ] **Step 6: Run the whole suite and commit**

Run: `yarn test`, then:

```bash
yarn format:js:fix && yarn format:js
git add src/MetaComponents/CalendarControls.js src/__tests__/CalendarControls.test.js
git commit -m "Add CalendarControls core with both rite wires

The renderer is the axis of variation and the wiring is not: the same block
appears byte-for-byte in the WebCalendar and FullCalendar examples. This is
that block, with no renderer, and with the two-wire rite requirement owned
in one place and pinned by a mutation-verified regression test."
```

---

### Task 3: The initial fetch, three-way dispatch, and the event hooks

**Files:**

- Modify: `src/MetaComponents/CalendarControls.js`
- Test: `src/__tests__/CalendarControlsFetch.test.js`

**Interfaces:**

- Consumes: Task 2.
- Produces: `onCalendarFetched(cb) → this`, `onError(cb) → this`, `fetch() → Promise<Object>`, and the `initialFetch` option honoured by `mountInto()` in Task 5.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/CalendarControlsFetch.test.js`. Reuse the `captureRequests` helper from Task 2's file by copying it into this file — do not import across test files.

```javascript
/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import CalendarControls from '../MetaComponents/CalendarControls.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

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
                    messages: ['first message'],
                }),
        });
    });
    return urls;
};

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.replaceChildren();
    const mount = document.createElement('div');
    mount.id = 'mount';
    document.body.appendChild(mount);
});

/**
 * @param {string} value - The value to select in the calendar select.
 * @returns {Promise<{controls: CalendarControls, urls: string[]}>} Wired controls.
 */
const wiredWith = async (value) => {
    const urls = captureRequests();
    const apiClient = await ApiClient.init(API_URL);
    const controls = new CalendarControls({ locale: 'en' });
    controls.appendTo('#mount');
    controls.calendarSelect._domElement.value = value;
    controls.listenTo(apiClient);
    return { controls, urls };
};

describe('CalendarControls initial fetch dispatch', () => {
    // An empty value means the General Roman Calendar, not a nation.
    it('uses the general path for an empty selection', async () => {
        const { controls, urls } = await wiredWith('');
        await controls.fetch();
        const last = urls.filter((u) => u.includes('/calendar')).at(-1);
        expect(last).not.toMatch(/\/calendar\/(nation|diocese)\//);
    });

    it('uses the nation path for a national calendar', async () => {
        const { controls, urls } = await wiredWith('IT');
        await controls.fetch();
        const last = urls.filter((u) => u.includes('/calendar')).at(-1);
        expect(last).toContain('/nation/IT');
    });

    // fullcalendar/script.js only handles empty-vs-national, so a diocesan
    // selection there calls fetchNationalCalendar() with a diocese id.
    it('uses the diocese path for a diocesan calendar', async () => {
        const { controls, urls } = await wiredWith('romamo_it');
        await controls.fetch();
        const last = urls.filter((u) => u.includes('/calendar')).at(-1);
        expect(last).toContain('/diocese/romamo_it');
        expect(last).not.toContain('/nation/');
    });

    it('throws when no client is wired', () => {
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#mount');
        expect(() => controls.fetch()).toThrow(/listenTo/);
    });
});

describe('CalendarControls event hooks', () => {
    it('delivers fetched data to onCalendarFetched', async () => {
        const { controls } = await wiredWith('');
        const seen = [];
        controls.onCalendarFetched((data) => seen.push(data));
        await controls.fetch();
        expect(seen.length).toBe(1);
        expect(seen[0]).toHaveProperty('litcal');
    });

    it('is chainable', async () => {
        const { controls } = await wiredWith('');
        expect(controls.onCalendarFetched(() => {})).toBe(controls);
        expect(controls.onError(() => {})).toBe(controls);
    });

    it('routes a failed fetch to onError and suppresses console.error', async () => {
        const apiClient = await ApiClient.init(API_URL);
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#mount');
        controls.listenTo(apiClient);
        const seen = [];
        controls.onError((error) => seen.push(error));

        global.fetch = jest.fn(() => Promise.reject(new Error('network down')));
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        await expect(controls.fetch()).rejects.toThrow();
        expect(seen.length).toBeGreaterThan(0);
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('falls back to console.error when nothing is listening', async () => {
        const apiClient = await ApiClient.init(API_URL);
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#mount');
        controls.listenTo(apiClient);

        global.fetch = jest.fn(() => Promise.reject(new Error('network down')));
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        await expect(controls.fetch()).rejects.toThrow();
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/CalendarControlsFetch.test.js`

Expected: FAIL — `controls.fetch is not a function`.

- [ ] **Step 3: Implement**

Add these fields to `CalendarControls`:

```javascript
    /** @type {Array<function(Object): void>} */
    #fetchedCallbacks = [];

    /** @type {Array<function(Error): void>} */
    #errorCallbacks = [];

    /** @type {Array<{event: string, listener: function}>} */
    #subscriptions = [];
```

Add these methods:

```javascript
    /**
     * Registers a callback for successfully fetched calendar data.
     *
     * This replaces reaching for `apiClient._eventBus.on( 'calendarFetched', … )`,
     * which both downstream examples do although `ApiClient.on()` has been public
     * since 2.0.0.
     *
     * @param {function(Object): void} callback - Receives the calendar payload.
     * @returns {CalendarControls} This instance.
     */
    onCalendarFetched(callback) {
        this.#assertUsable();
        this.#fetchedCallbacks.push(callback);
        this.#subscribe('calendarFetched', callback);
        return this;
    }

    /**
     * Registers a callback for calendar fetch failures.
     *
     * Subscribing is what stops `ApiClient` falling back to `console.error`: it
     * logs only when nothing is listening for `calendarFetchFailed`.
     *
     * @param {function(Error): void} callback - Receives the ApiClientError.
     * @returns {CalendarControls} This instance.
     */
    onError(callback) {
        this.#assertUsable();
        this.#errorCallbacks.push(callback);
        this.#subscribe('calendarFetchFailed', callback);
        return this;
    }

    /**
     * Subscribes one callback to one client event, recording the registration so
     * `dispose()` can pass the same reference back to `off()`.
     *
     * A callback registered before `listenTo()` is replayed by it; this method
     * subscribes directly only once a client exists, so the two paths are
     * mutually exclusive and nothing is ever subscribed twice.
     *
     * @param {string} event - The event name.
     * @param {function} callback - The consumer's callback.
     * @returns {void}
     */
    #subscribe(event, callback) {
        if (null === this.#apiClient) {
            return;
        }
        const listener = (payload) => callback(payload);
        this.#apiClient._eventBus.on(event, listener);
        this.#subscriptions.push({ event, listener });
    }

    /**
     * Fetches the calendar the select currently names.
     *
     * Dispatched three ways, from the `data-calendartype` attribute
     * `CalendarSelect` puts on each option: an empty value is the General Roman
     * Calendar, `national` is a nation, `diocesan` is a diocese. The FullCalendar
     * example writes only the first two by hand, so a diocesan selection there
     * calls `fetchNationalCalendar()` with a diocese id.
     *
     * @returns {Promise<Object>} The fetched calendar data.
     * @throws {Error} If no client has been wired.
     */
    fetch() {
        this.#assertUsable();
        if (null === this.#apiClient) {
            throw new Error(
                'CalendarControls.fetch: no ApiClient is wired. Call listenTo( apiClient ) first, or pass apiClient to mountInto().',
            );
        }
        const element = this.#calendarSelect._domElement;
        const value = element.value;
        if ('' === value) {
            return this.#apiClient.fetchCalendar();
        }
        const selected = element.options[element.selectedIndex];
        return 'diocesan' === selected?.dataset.calendartype
            ? this.#apiClient.fetchDiocesanCalendar(value)
            : this.#apiClient.fetchNationalCalendar(value);
    }
```

Then, at the end of `listenTo()` before `return this`, replay any callbacks registered before a client existed:

```javascript
        for (const callback of this.#fetchedCallbacks) {
            this.#subscribe('calendarFetched', callback);
        }
        for (const callback of this.#errorCallbacks) {
            this.#subscribe('calendarFetchFailed', callback);
        }
```

Note that `#subscribe` must run AFTER `this.#apiClient = apiClient;` for the replay to take effect — order the two accordingly.

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test src/__tests__/CalendarControlsFetch.test.js`

Expected: PASS, 9 tests.

- [ ] **Step 5: Run the whole suite and commit**

```bash
yarn test && yarn format:js:fix && yarn format:js
git add src/MetaComponents/CalendarControls.js src/__tests__/CalendarControlsFetch.test.js
git commit -m "Dispatch the initial fetch three ways, and add the event hooks

CalendarSelect marks each option national or diocesan, and an empty value is
the General Roman Calendar — so the correct dispatch has three branches. The
FullCalendar example writes two of them by hand, meaning a diocesan initial
selection calls fetchNationalCalendar with a diocese id.

onCalendarFetched replaces the apiClient._eventBus reach both examples use,
although ApiClient.on() has been public since 2.0.0."
```

---

### Task 4: The messages slot

**Files:**

- Modify: `src/MetaComponents/CalendarControls.js`
- Test: `src/__tests__/CalendarControlsMessages.test.js`

**Interfaces:**

- Consumes: Tasks 2 and 3.
- Produces: `appendTo()` accepting a slots object `{ controls, messages }`, and message rendering.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/CalendarControlsMessages.test.js`:

```javascript
/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import CalendarControls from '../MetaComponents/CalendarControls.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

/**
 * @param {string[]} messages - The messages the API should return.
 * @returns {string[]} The live list of requested URLs.
 */
const captureRequests = (messages) => {
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
                    messages,
                }),
        });
    });
    return urls;
};

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.replaceChildren();
    for (const id of ['mount', 'messages']) {
        const el = document.createElement('div');
        el.id = id;
        document.body.appendChild(el);
    }
});

describe('CalendarControls messages slot', () => {
    it('renders one row per message when the slot is named', async () => {
        captureRequests(['first', 'second']);
        const apiClient = await ApiClient.init(API_URL);
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo({ controls: '#mount', messages: '#messages' });
        controls.listenTo(apiClient);
        await controls.fetch();

        const rows = document.querySelectorAll('#messages tr');
        expect(rows.length).toBe(2);
        expect(rows[0].textContent).toContain('first');
    });

    it('renders nothing when the slot is omitted', async () => {
        captureRequests(['first']);
        const apiClient = await ApiClient.init(API_URL);
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#mount');
        controls.listenTo(apiClient);
        await controls.fetch();
        expect(document.querySelectorAll('#messages tr').length).toBe(0);
    });

    // Both examples build these rows with innerHTML from API-supplied strings.
    it('renders a message containing markup as text, not as elements', async () => {
        captureRequests(['<img src=x onerror=alert(1)> plain']);
        const apiClient = await ApiClient.init(API_URL);
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo({ controls: '#mount', messages: '#messages' });
        controls.listenTo(apiClient);
        await controls.fetch();

        expect(document.querySelectorAll('#messages img').length).toBe(0);
        expect(document.querySelector('#messages').textContent).toContain(
            '<img',
        );
    });

    it('replaces earlier messages rather than appending on a refetch', async () => {
        captureRequests(['first', 'second']);
        const apiClient = await ApiClient.init(API_URL);
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo({ controls: '#mount', messages: '#messages' });
        controls.listenTo(apiClient);
        await controls.fetch();
        captureRequests(['only']);
        await controls.fetch();

        const rows = document.querySelectorAll('#messages tr');
        expect(rows.length).toBe(1);
        expect(rows[0].textContent).toContain('only');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/CalendarControlsMessages.test.js`

Expected: FAIL — no rows rendered.

- [ ] **Step 3: Implement**

Add a field and render method, and teach `appendTo()` to accept slots. Follow
`DayViewer.appendTo()`'s slots handling, including its `assertPlainOptions` guard against a
malformed target:

```javascript
    /** @type {HTMLElement|null} */
    #messagesMount = null;
```

```javascript
    /**
     * Renders the API's `messages` array into the messages slot.
     *
     * Rows are built with `textContent`, not `innerHTML`. Both downstream
     * examples interpolate the API's strings into an HTML string, which would
     * render any markup a message contained.
     *
     * Replaces rather than appends, so a refetch does not accumulate rows.
     *
     * @param {Object} data - The fetched calendar payload.
     * @returns {void}
     */
    #renderMessages(data) {
        if (null === this.#messagesMount) {
            return;
        }
        const messages = Array.isArray(data?.messages) ? data.messages : [];
        const rows = messages.map((message, index) => {
            const tr = document.createElement('tr');
            const indexCell = document.createElement('td');
            indexCell.textContent = String(index);
            const messageCell = document.createElement('td');
            messageCell.textContent = String(message);
            tr.append(indexCell, messageCell);
            return tr;
        });
        this.#messagesMount.replaceChildren(...rows);
    }
```

In `appendTo()`, accept either a single target or `{ controls, messages }`. When `messages` is
named, resolve it into `#messagesMount` and register the renderer via the same subscription path the
hooks use, so `dispose()` releases it:

```javascript
        if (null !== this.#messagesMount) {
            this.#subscribe('calendarFetched', (data) =>
                this.#renderMessages(data),
            );
        }
```

Because `#subscribe` is a no-op before a client exists, also replay the messages renderer inside
`listenTo()` alongside the other callbacks. Keep one registration only — guard with a
`#messagesSubscribed` boolean.

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test src/__tests__/CalendarControlsMessages.test.js`

Expected: PASS, 4 tests.

- [ ] **Step 5: Run the whole suite and commit**

```bash
yarn test && yarn format:js:fix && yarn format:js
git add src/MetaComponents/CalendarControls.js src/__tests__/CalendarControlsMessages.test.js
git commit -m "Render the messages table from a slot, as text

Both downstream examples build these rows with innerHTML from API-supplied
strings, in byte-identical code. This renders them with textContent instead,
and replaces rather than appends so a refetch does not accumulate rows."
```

---

### Task 5: `mountInto()`, `dispose()`, export and docs

**Files:**

- Modify: `src/MetaComponents/CalendarControls.js`, `src/index.js`, `docs/meta-components.md`
- Test: `src/__tests__/CalendarControlsMount.test.js`

**Interfaces:**

- Consumes: Tasks 2-4, and `EventEmitter.off()` from phase 1.
- Produces: `static CalendarControls.mountInto(target, options) → Promise<CalendarControls|null>`, `dispose() → void`; `CalendarControls` exported.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/CalendarControlsMount.test.js` covering:

```javascript
/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import CalendarControls from '../MetaComponents/CalendarControls.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

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
    document.body.replaceChildren();
    const mount = document.createElement('div');
    mount.id = 'mount';
    document.body.appendChild(mount);
});

describe('CalendarControls.mountInto', () => {
    it('resolves to mounted controls and performs the initial fetch', async () => {
        const urls = captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const controls = await CalendarControls.mountInto('#mount', {
            locale: 'en',
            apiClient,
        });
        expect(controls).toBeInstanceOf(CalendarControls);
        expect(urls.some((u) => u.includes('/calendar'))).toBe(true);
    });

    it('skips the initial fetch when initialFetch is false', async () => {
        const urls = captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        await CalendarControls.mountInto('#mount', {
            locale: 'en',
            apiClient,
            initialFetch: false,
        });
        expect(urls.some((u) => u.includes('/calendar/'))).toBe(false);
    });

    it('rejects an unparseable locale', async () => {
        const apiClient = await ApiClient.init(API_URL);
        await expect(
            CalendarControls.mountInto('#mount', {
                locale: 'not a locale',
                apiClient,
            }),
        ).rejects.toThrow(/CalendarControls/);
    });

    it('rejects when the metadata cannot be loaded', async () => {
        ApiBase.reset();
        await expect(
            CalendarControls.mountInto('#mount', { locale: 'en' }),
        ).rejects.toThrow();
    });

    it('resolves to null when the signal is already aborted', async () => {
        const controller = new AbortController();
        controller.abort();
        const apiClient = await ApiClient.init(API_URL);
        const controls = await CalendarControls.mountInto('#mount', {
            locale: 'en',
            apiClient,
            signal: controller.signal,
        });
        expect(controls).toBeNull();
    });
});

describe('CalendarControls.dispose', () => {
    it('stops the viewer reacting to further client events', async () => {
        captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const controls = await CalendarControls.mountInto('#mount', {
            locale: 'en',
            apiClient,
        });
        const before = apiClient._eventBus._events['calendarFetched'].length;
        controls.dispose();
        const after = apiClient._eventBus._events['calendarFetched'].length;
        expect(after).toBeLessThan(before);
    });

    it('is idempotent and throws on use after dispose', async () => {
        captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const controls = await CalendarControls.mountInto('#mount', {
            locale: 'en',
            apiClient,
        });
        controls.dispose();
        expect(() => controls.dispose()).not.toThrow();
        expect(() => controls.riteSelect).toThrow(/disposed/);
        expect(() => controls.listenTo(apiClient)).toThrow(/disposed/);
    });

    it('empties the mount', async () => {
        captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const controls = await CalendarControls.mountInto('#mount', {
            locale: 'en',
            apiClient,
        });
        controls.dispose();
        expect(document.getElementById('mount').children.length).toBe(0);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/CalendarControlsMount.test.js`

Expected: FAIL — `CalendarControls.mountInto is not a function`.

- [ ] **Step 3: Implement**

Model `mountInto()` on `DayViewer.mountInto()` — read it. Validate every option BEFORE any `try`, so
anything thrown later is a runtime failure by construction; construct before the abort check so a
typo rejects even on a cancelled mount; then `appendTo()`, `listenTo()` when an `apiClient` was
given, and `fetch()` when `initialFetch` is not `false`. Resolve to `null` when the signal aborted
or the target left the DOM.

Unlike `CalendarResourcePicker`, there is **no failure control**: when the metadata cannot load,
construction throws and `mountInto()` rejects. Document that difference and its reason — the picker
stands in for a single required form field where an empty slot is indistinguishable from "still
loading"; a whole form has no equivalent.

`dispose()` mirrors `DayViewer.dispose()`: `off()` every recorded subscription, remove every
recorded DOM listener, empty every mount it recorded (controls and messages), null the client, set
`#disposed`. Document the same two gaps `DayViewer` documents — the anonymous `change` listeners
`ApiClient.listenTo()` attaches to the selects are not reachable.

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test src/__tests__/CalendarControls`

Expected: all four CalendarControls suites pass.

- [ ] **Step 5: Export and document**

Add to `src/index.js`, matching the file's existing import/export style:

```javascript
import CalendarControls from './MetaComponents/CalendarControls.js';
```

```javascript
    CalendarControls,
```

Add a `CalendarControls` section to `docs/meta-components.md`, matching the structure of the two
existing component sections: what it bundles, the options table, the theme keys, the slots,
`mountInto()` versus the constructor, the reject-versus-resolve rule **including why this component
has no failure control**, and `dispose()` with its documented gaps.

- [ ] **Step 6: Verify and commit**

Run: `yarn test`, `yarn format:js`, `yarn format:md:fix && yarn lint:md && yarn format:md`, `yarn
compile && yarn lint:dts`. All clean. Then confirm the suite passes with `dist/` moved aside and
restored.

```bash
git add src/MetaComponents/CalendarControls.js src/index.js src/__tests__/CalendarControlsMount.test.js docs/meta-components.md
git commit -m "Add CalendarControls.mountInto and dispose, export and document it"
```

---

### Task 6: `CalendarViewer`

**Files:**

- Create: `src/MetaComponents/CalendarViewer.js`
- Modify: `src/index.js`, `docs/meta-components.md`
- Test: `src/__tests__/CalendarViewer.test.js`

**Interfaces:**

- Consumes: `CalendarControls` (Tasks 2-5), `WebCalendar`.
- Produces: `new CalendarViewer(options)`, `static mountInto(slots, options)`, getters `controls` / `webCalendar`, `dispose()`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/CalendarViewer.test.js` asserting:

```javascript
/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import CalendarViewer from '../MetaComponents/CalendarViewer.js';
import { Grouping, DateFormat } from '../Enums.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

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
    document.body.replaceChildren();
    for (const id of ['controls', 'calendar', 'messages']) {
        const el = document.createElement('div');
        el.id = id;
        document.body.appendChild(el);
    }
});

describe('CalendarViewer', () => {
    it('mounts controls and a calendar into their slots', async () => {
        captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const viewer = await CalendarViewer.mountInto(
            { controls: '#controls', calendar: '#calendar' },
            { locale: 'en', apiClient },
        );
        expect(
            document.querySelectorAll('#controls select').length,
        ).toBeGreaterThanOrEqual(2);
        expect(viewer.webCalendar).not.toBeNull();
        expect(viewer.controls).not.toBeNull();
    });

    it('forwards the webCalendar bag to the matching methods', async () => {
        captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const viewer = await CalendarViewer.mountInto(
            { controls: '#controls', calendar: '#calendar' },
            {
                locale: 'en',
                apiClient,
                webCalendar: {
                    id: 'LitCalTable',
                    firstColumnGrouping: Grouping.BY_LITURGICAL_SEASON,
                    dateFormat: DateFormat.DAY_ONLY,
                    psalterWeekColumn: true,
                },
            },
        );
        expect(viewer.webCalendar).not.toBeNull();
    });

    it('rejects an unknown webCalendar key, naming it', async () => {
        const apiClient = await ApiClient.init(API_URL);
        await expect(
            CalendarViewer.mountInto(
                { controls: '#controls', calendar: '#calendar' },
                { locale: 'en', apiClient, webCalendar: { notAMethod: 1 } },
            ),
        ).rejects.toThrow(/notAMethod/);
    });

    it('renders messages when the slot is named', async () => {
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: () =>
                    Promise.resolve({
                        litcal: [],
                        settings: {},
                        metadata: {},
                        messages: ['a message'],
                    }),
            }),
        );
        const apiClient = await ApiClient.init(API_URL);
        await CalendarViewer.mountInto(
            {
                controls: '#controls',
                calendar: '#calendar',
                messages: '#messages',
            },
            { locale: 'en', apiClient },
        );
        expect(document.querySelectorAll('#messages tr').length).toBe(1);
    });

    it('disposes both halves', async () => {
        captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const viewer = await CalendarViewer.mountInto(
            { controls: '#controls', calendar: '#calendar' },
            { locale: 'en', apiClient },
        );
        viewer.dispose();
        expect(() => viewer.controls).toThrow(/disposed/);
        expect(document.getElementById('controls').children.length).toBe(0);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/CalendarViewer.test.js`

Expected: FAIL — cannot resolve `../MetaComponents/CalendarViewer.js`.

- [ ] **Step 3: Implement**

`CalendarViewer` holds a `CalendarControls` and a `WebCalendar`. Its constructor forwards the options bag to `CalendarControls` and applies the `webCalendar` bag key-by-key:

```javascript
/**
 * The `WebCalendar` methods a `webCalendar` theme-style bag may name.
 *
 * Enumerated rather than reflected off the instance so that a typo is rejected
 * with the offending key named, instead of being silently ignored — the failure
 * mode a bag of unvalidated keys otherwise has.
 *
 * @type {Readonly<string[]>}
 */
const WEB_CALENDAR_KEYS = Object.freeze([
    'class',
    'id',
    'dateFormat',
    'removeCaption',
    'removeHeaderRow',
    'firstColumnGrouping',
    'columnOrder',
    'psalterWeekColumn',
    'eventColor',
    'seasonColor',
    'seasonColorColumns',
    'eventColorColumns',
    'monthHeader',
    'gradeDisplay',
    'latinInterface',
    'locale',
]);
```

**`rite` is deliberately absent from that list**, and `WebCalendar` does have a `rite()` method.
`WebCalendar.listenTo()` reassigns `#rite` from each fetch's own metadata — `WebCalendar.js:1761+`,
which takes the rite the _request_ was made under precisely to survive two in-flight requests
landing out of order. A static `rite` in the bag would therefore be overwritten by the first fetch,
appearing to work until data arrived. Naming it in `WEB_CALENDAR_KEYS` would offer a setting the
component cannot honour; the rite comes from the rite select, through the client. Add a comment
saying so, or the next reader will "fix" the omission.

Apply each present key as `this.#webCalendar[key](bag[key])`. For any key not in the list, throw,
naming the offending key:

```text
CalendarViewer: unknown webCalendar option `notAMethod`
```

Then call `this.#webCalendar.listenTo(apiClient)` inside `listenTo()`, and mount it into the
`calendar` slot.

`mountInto(slots, options)` takes `{ controls, calendar, messages }`, forwarding `controls` and
`messages` to the inner `CalendarControls` and using `calendar` for the `WebCalendar`. `dispose()`
disposes the controls and empties the calendar mount.

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test src/__tests__/CalendarViewer.test.js`

Expected: PASS, 5 tests.

- [ ] **Step 5: Export, document, verify and commit**

Add `CalendarViewer` to `src/index.js` and a section to `docs/meta-components.md` in the same shape as the others. Run the full gate set, then:

```bash
git add src/MetaComponents/CalendarViewer.js src/index.js src/__tests__/CalendarViewer.test.js docs/meta-components.md
git commit -m "Add CalendarViewer composing controls with WebCalendar"
```

---

### Task 7: `ApiExplorer`

**Files:**

- Create: `src/MetaComponents/ApiExplorer.js`
- Modify: `src/index.js`, `docs/meta-components.md`
- Test: `src/__tests__/ApiExplorer.test.js`

**Interfaces:**

- Consumes: `CalendarControls`, `PathBuilder` (`new PathBuilder(apiOptions, calendarSelect)`).
- Produces: `new ApiExplorer(options)`, `static mountInto(slots, options)`, getters `controls` / `pathBuilder`, `dispose()`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/ApiExplorer.test.js`:

```javascript
/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import ApiExplorer from '../MetaComponents/ApiExplorer.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    global.fetch = jest.fn(() =>
        Promise.resolve({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: () => Promise.resolve({ litcal: [] }),
        }),
    );
    document.body.replaceChildren();
    for (const id of [
        'pathBuilder',
        'basePath',
        'allPaths',
        'rite',
        'builder',
    ]) {
        const el = document.createElement('div');
        el.id = id;
        document.body.appendChild(el);
    }
});

/** @returns {Promise<ApiExplorer>} A mounted explorer. */
const mountExplorer = async () => {
    const apiClient = await ApiClient.init(API_URL);
    return ApiExplorer.mountInto(
        {
            pathBuilder: '#pathBuilder',
            basePath: '#basePath',
            allPaths: '#allPaths',
            riteSelect: '#rite',
            builder: '#builder',
        },
        { locale: 'en', apiClient },
    );
};

describe('ApiExplorer', () => {
    it('mounts the option groups into their three slots', async () => {
        await mountExplorer();
        expect(document.querySelector('#pathBuilder').children.length).toBeGreaterThan(0);
        expect(document.querySelector('#basePath').children.length).toBeGreaterThan(0);
        expect(document.querySelector('#allPaths').children.length).toBeGreaterThan(0);
    });

    it('mounts the rite select into its own slot', async () => {
        const explorer = await mountExplorer();
        expect(document.querySelector('#rite select')).toBe(
            explorer.controls.riteSelect._domElement,
        );
    });

    it('never fetches a calendar', async () => {
        await mountExplorer();
        const calls = global.fetch.mock.calls.map((c) => String(c[0]));
        expect(calls.some((u) => /\/calendar(\/|\?|$)/.test(u))).toBe(false);
    });

    it('exposes the path builder', async () => {
        const explorer = await mountExplorer();
        expect(explorer.pathBuilder).not.toBeNull();
    });

    it('throws on use after dispose', async () => {
        const explorer = await mountExplorer();
        explorer.dispose();
        expect(() => explorer.controls).toThrow(/disposed/);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/ApiExplorer.test.js`

Expected: FAIL — cannot resolve `../MetaComponents/ApiExplorer.js`.

- [ ] **Step 3: Implement**

`ApiExplorer` holds a `CalendarControls` constructed normally and a `PathBuilder` built from the
controls' `apiOptions` and `calendarSelect`. It never calls `CalendarControls.listenTo()`, and that
— not an `initialFetch` option — is what makes it never fetch: `listenTo()` is what wires
`apiClient.listenTo()` onto the three children, and those fetch on every change. `initialFetch:
false` would suppress only the first request.

Its `appendTo(slots)` reproduces what `assets/js/index.js` does, appending the **same** `ApiOptions` instance three times under three different filters:

```javascript
        this.#controls.apiOptions
            .filter(ApiOptionsFilter.PATH_BUILDER)
            .appendTo(pathBuilderTarget);
        // The calendar select is positioned relative to an input rather than into
        // a container of its own, matching the page this was extracted from.
        this.#controls.calendarSelect.insertAfter(
            this.#controls.apiOptions._calendarPathInput,
        );
        this.#controls.riteSelect.appendTo(riteTarget);
        this.#controls.apiOptions
            .filter(ApiOptionsFilter.BASE_PATH)
            .appendTo(basePathTarget);
        this.#controls.apiOptions
            .filter(ApiOptionsFilter.ALL_PATHS)
            .appendTo(allPathsTarget);
```

Then link the rite (both wires are still needed for the calendar list to rebuild, even though nothing fetches) and mount the `PathBuilder` into the `builder` slot.

Slots: `pathBuilder`, `basePath`, `allPaths`, `riteSelect`, `builder`. An omitted slot skips that
append. A named slot that matches nothing throws, naming `ApiExplorer` and the slot.

Two things it does NOT absorb, documented as stated limits: the per-input `id()` calls
(page-specific anchors) and the label-after tooltip nodes, both reachable through
`explorer.controls.apiOptions`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test src/__tests__/ApiExplorer.test.js`

Expected: PASS, 5 tests.

- [ ] **Step 5: Export, document, verify and commit**

Add `ApiExplorer` to `src/index.js` and a section to `docs/meta-components.md`, including the three-filter table and the "never fetches" note. Run the full gate set, then:

```bash
git add src/MetaComponents/ApiExplorer.js src/index.js src/__tests__/ApiExplorer.test.js docs/meta-components.md
git commit -m "Add ApiExplorer composing controls with PathBuilder"
```

---

### Task 8: Stories, release prep and 2.3.0

**Files:**

- Create: `src/stories/1_CombinedComponents/CalendarViewer.render.js`, `CalendarViewer.stories.js`
- Modify: `package.json:5`, `README.md`, `CLAUDE.md`, `CHANGELOG.md`
- Test: `src/__tests__/CalendarViewerStory.test.js`

- [ ] **Step 1: Add the story, following the established split**

`CalendarResourcePicker` and `DayViewer` each split into a CSS-free `.render.js` module plus a
`.stories.js` file, and **the render helper imports relative `src/` paths, not the package
specifier** — the specifier resolves to the gitignored `dist/` and broke the suite on a clean
checkout during phase 1. Read `src/stories/1_CombinedComponents/DayViewer.render.js` and follow it
exactly.

The render helper must attach its container to `document.body` before calling `mountInto()` and
detach it afterwards, because `mountInto()` treats a disconnected target as a cancelled mount.

Add `Bootstrap` and `Unstyled` stories differing only by the `theme` argument, plus
`src/__tests__/CalendarViewerStory.test.js` importing the real `render()` and asserting it produces
mounted `<select>` children.

One story is enough: `CalendarControls` is exercised through `CalendarViewer`, and `ApiExplorer` needs five containers that a story cannot usefully show.

- [ ] **Step 2: Bump the version**

In `package.json`, change `"version": "2.2.0"` to `"version": "2.3.0"`.

- [ ] **Step 3: Write the CHANGELOG entry**

Read the 2.2.0 and 2.1.0 entries and match their voice and depth — this changelog explains _why_,
not just _what_. Cover: the three components and the decomposition reason (the renderer is the axis
of variation; a fourth consumer renders with FullCalendar); `onCalendarFetched()` replacing the
`_eventBus` reach; the three-way fetch dispatch and the diocesan bug it fixes; the messages slot
rendering as text; `initialFetch`; the jest fix; and that all three reject rather than rendering a
failure control, with the reason.

- [ ] **Step 4: Document in `README.md` and `CLAUDE.md`**

Add the three components to the README's component table and exports list, and to `CLAUDE.md`'s
project-structure block, key-components table and Meta-Components section. State the failure-control
asymmetry in `CLAUDE.md` so it is not later "fixed".

- [ ] **Step 5: Full verification**

Run each and confirm clean:

```bash
yarn test
yarn compile && yarn lint:dts
yarn format:js
yarn format:md:fix && yarn lint:md && yarn format:md
```

Then confirm the suite passes with `dist/` moved aside and restored, and check the ES2022 floor:

```bash
grep -rlE "toSorted|toSpliced|\.with\(|findLast|structuredClone" dist/ || echo "no post-ES2022 APIs"
```

Report any hit rather than silently "fixing" it — the README states browser support as Chrome/Edge 94+, Firefox 93+, Safari 15.4+, and that is a contract.

- [ ] **Step 6: Commit**

Stage only the files you edited. **Do not `git add dist/`** — it is gitignored and would abort the commit.

```bash
git add package.json README.md CLAUDE.md CHANGELOG.md src/stories src/__tests__/CalendarViewerStory.test.js
git commit -m "Release 2.3.0: meta-components phase 2"
```

---

## Follow-up, not in this plan

- **`SubscriptionBuilder`** — phase 3. The only member of the family that is a new feature rather than
  an extraction, with its own design questions: the `webcal://` scheme, which parameters belong in a
  subscription URL, and ICS defaults.
- **The `LiturgicalCalendarFrontend` migration**, now unblocked since 2.2.0 published. It should move
  `main.js`, `fullcalendar/script.js`, `index.js` and the three admin files onto these components, and
  delete the `Input.setGlobal*` calls the theme bag replaces. Belongs in that repository with its own
  review cycle.
