# SubscriptionBuilder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** Add `SubscriptionBuilder`, the sixth meta-component, bundling the rite, calendar and locale selects
with a rendered iCal subscription URL and a copy control — replacing the hand-rolled card in
`LiturgicalCalendarFrontend`'s `usage.php` and answering issue #42.

**Architecture:** `SubscriptionBuilder` composes a `CalendarControls` (rite select, unfiltered `allowNull`
calendar select, `ApiOptions` filtered to `LOCALE_ONLY`) and never calls `listenTo()`, so it never fetches —
exactly `ApiExplorer`'s template. A new internal `SubscriptionUrl` renders the URL by borrowing
`apiOptions._currentEndpoint`, the same `CurrentEndpoint` instance `PathBuilder` borrows. `PathBuilder` is not
modified.

**Tech Stack:** ES2022 JavaScript modules, Jest 29 with jsdom, prettier, markdownlint-cli2.

## Global Constraints

- **ES2022 floor.** `static #` private fields, `Object.hasOwn()`, `Error` `cause` are all in use. Do not lower `target`.
- **Formatting is prettier's.** `.prettierrc` sets `tabWidth: 4` and `singleQuote: true`. Run `yarn format:js:fix`; CI runs `yarn format:js`.
- **JSDoc on every public method**, with `@param`, `@returns` and `@throws`.
- **Private fields use `#`.** Test-facing accessors use a leading underscore getter (`_domElement`), matching every other component.
- **`appendTo()` returns `undefined`.** It may terminate a chain; nothing may be chained off it.
- **Never skip git hooks.** No `--no-verify`.
- **Markdown:** max 180 chars, tables vertically aligned (MD060). `yarn lint:md` then `yarn format:md:fix`.
- **Every test file that constructs components needs** `/** @jest-environment jsdom */` on line 1, and `ApiBase.reset()` plus `ApiBase.fromMetadata(API_URL, FULL_METADATA)` in `beforeEach`.
- **Full gate before every commit:** `yarn test && yarn compile && yarn lint:dts && yarn format:js && yarn lint:md && yarn format:md`.

## File Structure

| File                                             | Responsibility                                                           |
| ------------------------------------------------ | ------------------------------------------------------------------------ |
| `src/SubscriptionBuilder/SubscriptionUrl.js`     | Internal renderer: serializes the URL, renders it, owns the copy control |
| `src/SubscriptionBuilder/SubscriptionBuilder.js` | The meta-component: composes `CalendarControls` + `SubscriptionUrl`      |
| `src/Messages.js`                                | Two new keys, `COPY_TO_CLIPBOARD` and `COPIED_TO_CLIPBOARD`              |
| `src/index.js`                                   | Exports `SubscriptionBuilder` (not `SubscriptionUrl`)                    |
| `src/__tests__/SubscriptionUrl.test.js`          | The renderer in isolation                                                |
| `src/__tests__/SubscriptionBuilder.test.js`      | The composition                                                          |
| `docs/meta-components.md`                        | The component's documentation section                                    |
| `CLAUDE.md`                                      | Contract points, plus the stale Messages-count correction                |

`SubscriptionUrl` lives beside `SubscriptionBuilder` rather than in `src/MetaComponents/`, because
`src/MetaComponents/` holds exported meta-components plus the internal `Theme.js`, and `SubscriptionUrl` is
this component's private renderer — the same relationship `CurrentEndpoint.js` has to `PathBuilder.js` in
`src/PathBuilder/`.

---

## Facts you will need (verified against the code)

- `apiOptions._currentEndpoint` is a **`CurrentEndpoint` instance**, owned by `ApiOptions`. `PathBuilder.js:79`
  borrows it the same way. It is instance state, not static, so two builders on one page never share it.
- `currentEndpoint.path` is a **getter** (`CurrentEndpoint.js:138-150`) returning a _relative_ path: `/calendar[/rite][/type/id][/year]`.
- **`path` omits the rite when it is Roman unless `explicitRite` is true** (`CurrentEndpoint.js:141`). The
  frontend's subscription URL emits `/roman` unconditionally, so `SubscriptionUrl` **must set `explicitRite =
true`** to preserve current behaviour.
- `currentEndpoint.serialize()` (`CurrentEndpoint.js:163-177`) returns `path` plus `?key=value` pairs for every non-`null`, non-`''` field of `requestPayload`.
- `apiOptions._base.url` is the API base URL. The full subscription URL is `` `${base.url}${currentEndpoint.serialize()}` ``.
- `ApiOptions` sets `currentEndpoint.rite` itself when the rite select changes (`ApiOptions.js:506`), via
  `linkToRiteSelect()`. `SubscriptionUrl` therefore does **not** set the rite — it only needs to re-render when
  the rite changes.
- The calendar select's option carries `data-calendartype` of `'national'` or `'diocesan'`; the empty option
  carries none. `PathBuilder.js`'s listener maps these to `CalendarType.NATIONAL` / `CalendarType.DIOCESAN` /
  `null`.
- Exact helper names: `normalizeComponentOptions(options, name)`, `assertPlainOptions(options, name)`,
  `describeType(value)` from `src/OptionsValidation.js`; `assertTheme`, `resolveChildTheme`, `resolveWrapperBag`
  from `src/MetaComponents/Theme.js`; `CalendarType` from `src/PathBuilder/CurrentEndpoint.js`.

---

### Task 1: `SubscriptionUrl` — construction and serialization

**Files:**

- Create: `src/SubscriptionBuilder/SubscriptionUrl.js`
- Test: `src/__tests__/SubscriptionUrl.test.js`

**Interfaces:**

- Consumes: `ApiOptions` (for `_currentEndpoint` and `_base`), `CalendarSelect`, `RiteSelect`.
- Produces: `new SubscriptionUrl(apiOptions, calendarSelect, riteSelect, options)`; `get url(): string`; `get _domElement(): HTMLElement`; `appendTo(target: HTMLElement): void`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/SubscriptionUrl.test.js`:

```javascript
/** @jest-environment jsdom */
/**
 * `SubscriptionUrl` is `SubscriptionBuilder`'s private renderer. It borrows the
 * `CurrentEndpoint` instance `ApiOptions` owns — the same one `PathBuilder`
 * borrows — so the URL model is shared and only the presentation is not.
 *
 * Two pins are load-bearing and easy to lose:
 *   - `return_type = 'ICS'` is what makes the URL a subscription rather than a
 *     JSON request. It is not user-selectable, unlike `PathBuilder`'s.
 *   - `explicitRite = true` forces `/roman` into the path. Without it
 *     `CurrentEndpoint.path` omits the rite for Roman, and the frontend card
 *     this replaces emits it unconditionally.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import SubscriptionUrl from '../SubscriptionBuilder/SubscriptionUrl.js';
import { ApiOptionsFilter } from '../Enums.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.innerHTML = '<div id="mount"></div>';
});

/**
 * The three controls a SubscriptionUrl wires to, built the way
 * SubscriptionBuilder will build them.
 *
 * @param {Object} [options] - Forwarded to SubscriptionUrl.
 * @returns {Object} The controls and the renderer.
 */
const build = (options = {}) => {
    const riteSelect = new RiteSelect('en');
    const calendarSelect = new CalendarSelect({ locale: 'en', allowNull: true });
    const apiOptions = new ApiOptions('en').filter(ApiOptionsFilter.LOCALE_ONLY);
    apiOptions.linkToCalendarSelect(calendarSelect).linkToRiteSelect(riteSelect);
    const url = new SubscriptionUrl(
        apiOptions,
        calendarSelect,
        riteSelect,
        options,
    );
    return { apiOptions, calendarSelect, riteSelect, url };
};

describe('SubscriptionUrl serialization', () => {
    it('renders the rite-level calendar with ICS and CIVIL pinned', () => {
        const { url } = build();
        expect(url.url).toBe(
            `${API_URL}/calendar/roman?return_type=ICS&year_type=CIVIL`,
        );
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/__tests__/SubscriptionUrl.test.js`

Expected: FAIL — `Cannot find module '../SubscriptionBuilder/SubscriptionUrl.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/SubscriptionBuilder/SubscriptionUrl.js`:

```javascript
/**
 * The renderer half of `SubscriptionBuilder`: it turns the current rite,
 * calendar and locale selections into an iCal subscription URL, renders it, and
 * offers a copy control.
 *
 * Internal, and deliberately NOT exported from `src/index.js` — this component's
 * private renderer, the same relationship `CurrentEndpoint.js` has to
 * `PathBuilder.js`.
 *
 * It borrows `apiOptions._currentEndpoint` rather than constructing one, exactly
 * as `PathBuilder` does, so the URL model is shared between the two renderers
 * and cannot drift. What is NOT shared is the presentation: `PathBuilder`'s
 * button navigates to the API and its `return_type` is user-selectable, both of
 * which are wrong for a subscription.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import { CalendarType } from '../PathBuilder/CurrentEndpoint.js';

/** The schemes a subscription URL may be rendered under. */
const SCHEMES = Object.freeze(['https', 'webcal']);

export default class SubscriptionUrl {
    /** @type {Object} The ApiBase this renderer's URL is built against. */
    #base;

    /** @type {Object} Borrowed from ApiOptions; never constructed here. */
    #currentEndpoint;

    /** @type {HTMLElement} */
    #domElement;

    /** @type {HTMLElement} */
    #codeElement;

    /** @type {'https'|'webcal'} */
    #scheme;

    /**
     * @param {Object} apiOptions - The ApiOptions owning the CurrentEndpoint.
     * @param {Object} calendarSelect - The calendar select to follow.
     * @param {Object} riteSelect - The rite select to follow.
     * @param {Object} [options] - Renderer options.
     * @param {'https'|'webcal'} [options.scheme='https'] - The URL scheme.
     * @throws {Error} If `scheme` is neither 'https' nor 'webcal'.
     */
    constructor(apiOptions, calendarSelect, riteSelect, options = {}) {
        const scheme = options.scheme ?? 'https';
        if (false === SCHEMES.includes(scheme)) {
            throw new Error(
                `SubscriptionUrl: the scheme option must be 'https' or 'webcal', but found: ${String(scheme)}`,
            );
        }
        this.#scheme = scheme;
        this.#base = apiOptions._base;
        this.#currentEndpoint = apiOptions._currentEndpoint;

        // `return_type` is what makes this a subscription rather than a JSON
        // request, so it is pinned here and never wired to an input — unlike
        // `PathBuilder`, which lets the accept-header input drive it.
        this.#currentEndpoint.requestPayload.return_type = 'ICS';
        this.#currentEndpoint.requestPayload.year_type = 'CIVIL';
        // Without this, `CurrentEndpoint.path` omits the rite whenever it is
        // Roman, and the card this replaces emits `/roman` unconditionally.
        this.#currentEndpoint.explicitRite = true;

        this.#domElement = document.createElement('button');
        this.#domElement.setAttribute('type', 'button');
        this.#codeElement = document.createElement('code');
        this.#domElement.append(this.#codeElement);

        this.#render();
    }

    /** @returns {string} The serialized subscription URL. */
    get url() {
        const full = `${this.#base.url}${this.#currentEndpoint.serialize()}`;
        return 'webcal' === this.#scheme
            ? full.replace(/^https?:/, 'webcal:')
            : full;
    }

    /** @returns {HTMLElement} The rendered control, for tests and mounting. */
    get _domElement() {
        return this.#domElement;
    }

    /**
     * Repaints the rendered URL.
     *
     * @returns {void}
     */
    #render() {
        this.#codeElement.textContent = this.url;
    }

    /**
     * Mounts the control, replacing whatever the target held.
     *
     * @param {HTMLElement} target - The element to mount into.
     * @returns {void}
     */
    appendTo(target) {
        target.replaceChildren(this.#domElement);
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/__tests__/SubscriptionUrl.test.js`

Expected: PASS.

- [ ] **Step 5: Add the remaining serialization tests**

Append to `src/__tests__/SubscriptionUrl.test.js`, inside `describe('SubscriptionUrl serialization', …)`:

```javascript
    it('renders the Ambrosian rite-level calendar', () => {
        const { url, riteSelect } = build();
        riteSelect._domElement.value = 'ambrosian';
        riteSelect._domElement.dispatchEvent(new Event('change'));
        expect(url.url).toContain('/calendar/ambrosian');
    });

    it('emits /roman explicitly rather than omitting it', () => {
        // `CurrentEndpoint.path` drops the rite for Roman unless `explicitRite`
        // is set. The card this replaces always emits it, and URLs already
        // pasted into calendar apps depend on the explicit form resolving.
        const { url } = build();
        expect(url.url).toContain('/calendar/roman');
    });

    it('rejects an unknown scheme', () => {
        expect(() => build({ scheme: 'ftp' })).toThrow(
            /must be 'https' or 'webcal'/,
        );
    });

    it('rewrites only the scheme for webcal', () => {
        const https = build().url.url;
        const webcal = build({ scheme: 'webcal' }).url.url;
        expect(webcal).toBe(https.replace(/^https?:/, 'webcal:'));
        expect(webcal.startsWith('webcal:')).toBe(true);
    });
```

- [ ] **Step 6: Run the tests**

Run: `yarn test src/__tests__/SubscriptionUrl.test.js`

Expected: PASS, 5 tests.

The Ambrosian case passes with no listener yet because `url` is a getter that recomputes from the endpoint on
every read, and `ApiOptions.linkToRiteSelect()` has already written the new rite onto that endpoint. Task 2 adds
the listener that repaints the DOM; this task only reads.

- [ ] **Step 7: Run the full gate and commit**

```bash
yarn test && yarn compile && yarn lint:dts && yarn format:js:fix && yarn format:js
git add src/SubscriptionBuilder/SubscriptionUrl.js src/__tests__/SubscriptionUrl.test.js
git commit -m "Add SubscriptionUrl: serialize an iCal subscription URL

Borrows the CurrentEndpoint instance ApiOptions owns, as PathBuilder does, so
the URL model is shared and only the presentation is not. return_type is pinned
to ICS rather than wired to an input, and explicitRite is set so /roman appears
in the path — CurrentEndpoint.path omits it for Roman otherwise, and the card
this replaces emits it unconditionally."
```

---

### Task 2: `SubscriptionUrl` — control wiring and `onChange`

**Files:**

- Modify: `src/SubscriptionBuilder/SubscriptionUrl.js`
- Test: `src/__tests__/SubscriptionUrl.test.js`

**Interfaces:**

- Consumes: Task 1's `SubscriptionUrl` constructor and `#render()`.
- Produces: `onChange(callback: (url: string) => void): SubscriptionUrl` (chainable); `dispose(): void`.

- [ ] **Step 1: Write the failing tests**

Append a new `describe` to `src/__tests__/SubscriptionUrl.test.js`:

```javascript
describe('SubscriptionUrl control wiring', () => {
    /**
     * Selects a value the way a user would, notifying listeners.
     *
     * @param {HTMLSelectElement} element - The select to drive.
     * @param {string} value - The value to select.
     * @returns {void}
     */
    const userSelects = (element, value) => {
        element.value = value;
        element.dispatchEvent(new Event('change', { bubbles: true }));
    };

    it('repaints when the calendar select names a nation', () => {
        const { url, calendarSelect } = build();
        url.appendTo(document.getElementById('mount'));
        userSelects(calendarSelect._domElement, 'VA');
        expect(url._domElement.textContent).toContain('/nation/VA');
    });

    it('clears the calendar when the empty option is reselected', () => {
        // The empty option carries no `data-calendartype` and means the
        // rite-level calendar. Without clearing, the last nation stays in the
        // path forever and reselecting empty appears to do nothing.
        const { url, calendarSelect } = build();
        url.appendTo(document.getElementById('mount'));
        userSelects(calendarSelect._domElement, 'VA');
        userSelects(calendarSelect._domElement, '');
        expect(url._domElement.textContent).not.toContain('/nation/');
        expect(url._domElement.textContent).toContain('/calendar/roman');
    });

    it('repaints when the rite changes', () => {
        const { url, riteSelect } = build();
        url.appendTo(document.getElementById('mount'));
        userSelects(riteSelect._domElement, 'ambrosian');
        expect(url._domElement.textContent).toContain('/calendar/ambrosian');
    });

    it('carries the locale select into the query', () => {
        // A subscription URL cannot carry an Accept-Language header — a calendar
        // app just GETs it — so the chosen language has to travel as ?locale=.
        const { url, apiOptions } = build();
        url.appendTo(document.getElementById('mount'));
        userSelects(apiOptions._localeInput._domElement, 'it');
        expect(url._domElement.textContent).toContain('locale=it');
    });

    it('notifies onChange exactly once per action, with settled state', async () => {
        // `ApiOptions.linkToCalendarSelect()`'s listener is registered before
        // this class's and synchronously dispatches a synthetic `change` on the
        // locale input, so without coalescing a subscriber is notified twice —
        // the first time with the calendar the user just left.
        const seen = [];
        const { url, calendarSelect } = build();
        url.onChange((next) => seen.push(next));
        userSelects(calendarSelect._domElement, 'VA');
        await Promise.resolve();
        expect(seen).toHaveLength(1);
        expect(seen[0]).toContain('/nation/VA');
    });

    it('stops repainting after dispose', () => {
        const { url, calendarSelect } = build();
        url.appendTo(document.getElementById('mount'));
        const before = url._domElement.textContent;
        url.dispose();
        userSelects(calendarSelect._domElement, 'VA');
        expect(url._domElement.textContent).toBe(before);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test src/__tests__/SubscriptionUrl.test.js`

Expected: FAIL — the repaint tests fail because nothing re-renders, and `onChange` / `dispose` are not functions.

- [ ] **Step 3: Write the implementation**

In `src/SubscriptionBuilder/SubscriptionUrl.js`, add two fields beside the others:

```javascript
    /** @type {Array<{element: HTMLElement, listener: function}>} */
    #subscriptions = [];

    /** @type {Array<function(string): void>} */
    #changeCallbacks = [];

    /** @type {Promise<void>|null} The coalesced notification this turn scheduled. */
    #pendingNotify = null;
```

At the end of the constructor, after `this.#render();`, add:

```javascript
        // The calendar select's option carries `data-calendartype`; the empty
        // option carries none and means the rite-level calendar. Reading
        // `selectedOptions[0]` optionally matters: a select can legitimately
        // have nothing selected — `allowNull(false)` removes the empty option
        // and a rite change then resets the value to '' with no option to match
        // — and a throw inside a listener is swallowed by the DOM, which would
        // leave the endpoint updated and the rendering stale.
        this.#listen(calendarSelect._domElement, (ev) => {
            const selected = ev.target.selectedOptions[0];
            const type = selected?.getAttribute('data-calendartype') ?? null;
            if ('national' === type) {
                this.#currentEndpoint.calendarType = CalendarType.NATIONAL;
                this.#currentEndpoint.calendarId = ev.target.value;
            } else if ('diocesan' === type) {
                this.#currentEndpoint.calendarType = CalendarType.DIOCESAN;
                this.#currentEndpoint.calendarId = ev.target.value;
            } else {
                this.#currentEndpoint.calendarType = null;
                this.#currentEndpoint.calendarId = null;
            }
        });

        // `ApiOptions` already writes the rite onto the endpoint through
        // `linkToRiteSelect()`, so this listener only has to repaint. Attached
        // AFTER the link, so the endpoint is current by the time this runs.
        this.#listen(riteSelect._domElement, () => {});

        this.#listen(apiOptions._localeInput._domElement, (ev) => {
            this.#currentEndpoint.requestPayload.locale = ev.target.value;
        });
```

Add the three methods:

```javascript
    /**
     * Attaches a `change` listener that updates the endpoint and repaints, and
     * records it so `dispose()` can remove it.
     *
     * @param {HTMLElement} element - The element to listen to.
     * @param {function(Event): void} update - Applies the change to the endpoint.
     * @returns {void}
     */
    #listen(element, update) {
        const listener = (ev) => {
            update(ev);
            // The repaint stays SYNCHRONOUS: both firings of a single user
            // action share one task, so the browser never paints between them
            // and the intermediate write is unobservable. Deferring it would
            // only make the DOM lag the state by a microtask, for no gain.
            this.#render();
            this.#scheduleNotify();
        };
        element.addEventListener('change', listener);
        this.#subscriptions.push({ element, listener });
    }

    /**
     * Collapses the `onChange` notifications one user action provokes into one,
     * on a microtask.
     *
     * One selection moves several inputs: `ApiOptions.linkToCalendarSelect()`'s
     * own listener is registered BEFORE this class's and synchronously dispatches
     * a synthetic `change` on the locale input, so without this a subscriber is
     * notified while `calendarType`/`calendarId` are still stale — an
     * intermediate URL carrying the calendar the user just left. Every dispatch
     * in that burst is synchronous, so a microtask flush reads settled state.
     *
     * The same shape as `ApiClient.#scheduleRefetch()`, added for the
     * structurally identical problem in issue #50. Only the NOTIFICATION is
     * coalesced, not the repaint: a callback hands a value to consumer code that
     * acts on it at once, whereas the DOM write is idempotent and invisible until
     * the task settles.
     *
     * @returns {void}
     */
    #scheduleNotify() {
        if (null !== this.#pendingNotify) {
            return;
        }
        this.#pendingNotify = Promise.resolve().then(() => {
            this.#pendingNotify = null;
            const next = this.url;
            this.#changeCallbacks.forEach((callback) => callback(next));
        });
    }

    /**
     * Registers a callback fired whenever the rendered URL changes.
     *
     * @param {function(string): void} callback - Receives the new URL.
     * @returns {SubscriptionUrl} This instance, for chaining.
     * @throws {Error} If `callback` is not a function.
     */
    onChange(callback) {
        if (typeof callback !== 'function') {
            throw new Error(
                `SubscriptionUrl.onChange: callback must be a function, but found type: ${typeof callback}`,
            );
        }
        this.#changeCallbacks.push(callback);
        return this;
    }

    /**
     * Removes every listener this renderer attached.
     *
     * Idempotent.
     *
     * @returns {void}
     */
    dispose() {
        for (const { element, listener } of this.#subscriptions) {
            element.removeEventListener('change', listener);
        }
        this.#subscriptions = [];
        this.#changeCallbacks = [];
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test src/__tests__/SubscriptionUrl.test.js`

Expected: PASS, 11 tests.

- [ ] **Step 5: Run the full gate and commit**

```bash
yarn test && yarn compile && yarn lint:dts && yarn format:js:fix && yarn format:js
git add src/SubscriptionBuilder/SubscriptionUrl.js src/__tests__/SubscriptionUrl.test.js
git commit -m "Wire SubscriptionUrl to the rite, calendar and locale selects

The locale reaches the URL as ?locale=, not as an Accept-Language header: a
calendar app simply GETs a subscription URL, so a header has nowhere to travel.
The rite listener only repaints, because ApiOptions already writes the rite onto
the shared endpoint through linkToRiteSelect()."
```

---

### Task 3: `SubscriptionUrl` — the copy control

**Files:**

- Modify: `src/SubscriptionBuilder/SubscriptionUrl.js`
- Modify: `src/Messages.js`
- Test: `src/__tests__/SubscriptionUrl.test.js`

**Interfaces:**

- Consumes: Task 2's `SubscriptionUrl`.
- Produces: `options.copyIcon`, `options.copyTitle`, `options.copiedText`, `options.onCopy`, `options.copiedClass` on the constructor.

- [ ] **Step 1: Add the Messages keys**

`src/Messages.js` holds **84 locale blocks** with uneven key coverage. `SELECT_A_RITE` — the precedent —
exists in twelve of them. Add both new keys to those same twelve blocks only; every other locale reaches
English through the call-site `??` fallback.

Find each block's `SELECT_A_RITE` line and add the two keys beside it:

```javascript
// de
COPY_TO_CLIPBOARD: 'Klicken zum Kopieren in die Zwischenablage!',
COPIED_TO_CLIPBOARD: 'URL in die Zwischenablage kopiert',
// en
COPY_TO_CLIPBOARD: 'Click to copy to the clipboard!',
COPIED_TO_CLIPBOARD: 'URL copied to clipboard',
// es
COPY_TO_CLIPBOARD: '¡Haga clic para copiar al portapapeles!',
COPIED_TO_CLIPBOARD: 'URL copiada al portapapeles',
// fr
COPY_TO_CLIPBOARD: 'Cliquez pour copier dans le presse-papiers !',
COPIED_TO_CLIPBOARD: 'URL copiée dans le presse-papiers',
// hu
COPY_TO_CLIPBOARD: 'Kattintson a vágólapra másoláshoz!',
COPIED_TO_CLIPBOARD: 'URL a vágólapra másolva',
// id
COPY_TO_CLIPBOARD: 'Klik untuk menyalin ke papan klip!',
COPIED_TO_CLIPBOARD: 'URL disalin ke papan klip',
// it
COPY_TO_CLIPBOARD: 'Clicca per copiare negli appunti!',
COPIED_TO_CLIPBOARD: 'URL copiato negli appunti',
// la
COPY_TO_CLIPBOARD: 'Preme ut in tabulam transcribas!',
COPIED_TO_CLIPBOARD: 'URL in tabulam transcriptum',
// nl
COPY_TO_CLIPBOARD: 'Klik om naar het klembord te kopiëren!',
COPIED_TO_CLIPBOARD: 'URL naar klembord gekopieerd',
// pt
COPY_TO_CLIPBOARD: 'Clique para copiar para a área de transferência!',
COPIED_TO_CLIPBOARD: 'URL copiado para a área de transferência',
// sk
COPY_TO_CLIPBOARD: 'Kliknutím skopírujete do schránky!',
COPIED_TO_CLIPBOARD: 'URL skopírovaná do schránky',
// vi
COPY_TO_CLIPBOARD: 'Nhấp để sao chép vào bảng nhớ tạm!',
COPIED_TO_CLIPBOARD: 'Đã sao chép URL vào bảng nhớ tạm',
```

- [ ] **Step 2: Write the failing tests**

Append to `src/__tests__/SubscriptionUrl.test.js`:

```javascript
describe('SubscriptionUrl copy control', () => {
    /**
     * Replaces navigator.clipboard with a recording stub.
     *
     * @param {boolean} succeeds - Whether writeText resolves or rejects.
     * @returns {Array<string>} The texts the stub was asked to write.
     */
    const stubClipboard = (succeeds) => {
        const written = [];
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {
                writeText: (text) => {
                    written.push(text);
                    return succeeds
                        ? Promise.resolve()
                        : Promise.reject(new Error('denied'));
                },
            },
        });
        return written;
    };

    it('is a real button, not a div with role=button', () => {
        // `role="button"` on a div with no tabindex and no key handler announces
        // a button that cannot be focused or activated. A real <button> gets
        // keyboard focus, Enter/Space and the correct accessibility tree free.
        const { url } = build();
        expect(url._domElement.tagName).toBe('BUTTON');
        expect(url._domElement.getAttribute('type')).toBe('button');
        expect(url._domElement.hasAttribute('role')).toBe(false);
    });

    it('carries a localized title', () => {
        const { url } = build();
        expect(url._domElement.getAttribute('title')).toBe(
            'Click to copy to the clipboard!',
        );
    });

    it('renders an inline SVG icon by default', () => {
        const { url } = build();
        expect(url._domElement.querySelector('svg')).not.toBeNull();
    });

    it('accepts a consumer icon and renders no SVG', () => {
        const { url } = build({
            copyIcon: '<i class="fas fa-clipboard"></i>',
        });
        expect(url._domElement.querySelector('i.fa-clipboard')).not.toBeNull();
        expect(url._domElement.querySelector('svg')).toBeNull();
    });

    it('renders no icon at all for copyIcon: null', () => {
        const { url } = build({ copyIcon: null });
        expect(url._domElement.querySelector('svg')).toBeNull();
        expect(url._domElement.querySelector('i')).toBeNull();
    });

    it('copies the URL and reports success', async () => {
        const written = stubClipboard(true);
        const seen = [];
        const { url } = build({ onCopy: (ok) => seen.push(ok) });
        url._domElement.click();
        await Promise.resolve();
        await Promise.resolve();
        expect(written).toEqual([url.url]);
        expect(seen).toEqual([true]);
    });

    it('reports failure without throwing', async () => {
        stubClipboard(false);
        const seen = [];
        const { url } = build({ onCopy: (ok, error) => seen.push([ok, error])});
        url._domElement.click();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        expect(seen[0][0]).toBe(false);
        expect(seen[0][1]).toBeInstanceOf(Error);
    });

    it('announces the copy through an aria-live region', async () => {
        stubClipboard(true);
        const { url } = build();
        url.appendTo(document.getElementById('mount'));
        url._domElement.click();
        await Promise.resolve();
        await Promise.resolve();
        const live = document.querySelector('[aria-live="polite"]');
        expect(live).not.toBeNull();
        expect(live.textContent).toBe('URL copied to clipboard');
    });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `yarn test src/__tests__/SubscriptionUrl.test.js`

Expected: FAIL — no title, no icon, no click handler.

- [ ] **Step 4: Write the implementation**

Add to the imports in `src/SubscriptionBuilder/SubscriptionUrl.js`:

```javascript
import Messages from '../Messages.js';
```

Add the default icon constant beside `SCHEMES`:

```javascript
/**
 * The default clipboard glyph: an inline SVG, so the component depends on no
 * icon font, no stylesheet and no network request. A consumer already using an
 * icon set replaces it with `copyIcon`.
 */
const DEFAULT_COPY_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">' +
    '<path d="M4 1.5A1.5 1.5 0 0 1 5.5 0h5A1.5 1.5 0 0 1 12 1.5V2h.5A1.5 1.5 0 0 1 14 3.5v11a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 14.5v-11A1.5 1.5 0 0 1 3.5 2H4v-.5Zm1 .5h6v-.5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0-.5.5V2Z"/>' +
    '</svg>';

/** How long the copied state stays applied, in milliseconds. */
const COPIED_DURATION = 2000;
```

Add fields:

```javascript
    /** @type {HTMLElement} */
    #liveRegion;

    /** @type {function(boolean, Error=): void|null} */
    #onCopy;

    /** @type {string} */
    #copiedText;

    /** @type {string} */
    #copiedClass;

    /** @type {number|null} */
    #copiedTimer = null;
```

In the constructor, after `this.#domElement.append(this.#codeElement);`, add:

```javascript
        // The display language for the two built-in strings. Taken from the
        // `language` option `SubscriptionBuilder` passes in — NOT from the
        // locale input, which exposes no locale accessor: `_localeInput._locale`
        // is `undefined`, so reading it would silently pin every locale to
        // English with no error to notice.
        const language = options.language ?? 'en';
        this.#domElement.setAttribute(
            'title',
            options.copyTitle ??
                (Messages[language]?.['COPY_TO_CLIPBOARD'] ??
                    Messages['en']['COPY_TO_CLIPBOARD']),
        );
        this.#copiedText =
            options.copiedText ??
            (Messages[language]?.['COPIED_TO_CLIPBOARD'] ??
                Messages['en']['COPIED_TO_CLIPBOARD']);
        this.#copiedClass = options.copiedClass ?? 'is-copied';
        this.#onCopy = typeof options.onCopy === 'function' ? options.onCopy : null;

        // `copyIcon` accepts consumer HTML, injected with the same
        // `createContextualFragment` path `Input.labelAfter()` uses. `null`
        // means no glyph; omitted means the built-in SVG.
        const icon = Object.hasOwn(options, 'copyIcon')
            ? options.copyIcon
            : DEFAULT_COPY_ICON;
        if (null !== icon && undefined !== icon) {
            this.#domElement.append(
                document.createRange().createContextualFragment(icon),
            );
        }

        this.#liveRegion = document.createElement('span');
        this.#liveRegion.setAttribute('aria-live', 'polite');
        // Announced but not shown: the visible confirmation is the copied class,
        // which the consumer themes.
        this.#liveRegion.style.position = 'absolute';
        this.#liveRegion.style.width = '1px';
        this.#liveRegion.style.height = '1px';
        this.#liveRegion.style.overflow = 'hidden';
        this.#liveRegion.style.clip = 'rect(0 0 0 0)';
        this.#domElement.append(this.#liveRegion);

        this.#domElement.addEventListener('click', () => this.#copy());
```

Add the copy methods:

```javascript
    /**
     * Writes the URL to the clipboard, reporting the outcome.
     *
     * Never rejects and never throws: a clipboard refusal is a runtime
     * condition, not a programming error, and the caller has no promise to
     * catch — the click handler dropped it.
     *
     * @returns {Promise<void>} Resolves once the outcome has been reported.
     */
    async #copy() {
        const text = this.url;
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                SubscriptionUrl.#execCommandCopy(text);
            }
            this.#reportCopy(true);
        } catch (error) {
            this.#reportCopy(false, error);
        }
    }

    /**
     * The pre-Clipboard-API fallback, for browsers and for insecure origins
     * where `navigator.clipboard` is absent.
     *
     * @param {string} text - The text to copy.
     * @returns {void}
     * @throws {Error} If the copy command reports failure.
     */
    static #execCommandCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            if (false === document.execCommand('copy')) {
                throw new Error('SubscriptionUrl: the copy command failed.');
            }
        } finally {
            document.body.removeChild(textarea);
        }
    }

    /**
     * Applies the transient copied state and notifies `onCopy`.
     *
     * @param {boolean} ok - Whether the copy succeeded.
     * @param {Error} [error] - The failure, when it did not.
     * @returns {void}
     */
    #reportCopy(ok, error) {
        if (ok) {
            this.#domElement.classList.add(this.#copiedClass);
            this.#liveRegion.textContent = this.#copiedText;
            if (null !== this.#copiedTimer) {
                clearTimeout(this.#copiedTimer);
            }
            this.#copiedTimer = setTimeout(() => {
                this.#domElement.classList.remove(this.#copiedClass);
                this.#liveRegion.textContent = '';
                this.#copiedTimer = null;
            }, COPIED_DURATION);
        }
        this.#onCopy?.(ok, error);
    }
```

In `#render()`, guard against clobbering the icon and live region — it must only set the `<code>`:

```javascript
    #render() {
        this.#codeElement.textContent = this.url;
    }
```

(unchanged — it already targets `#codeElement` only, which is why the icon survives repaints.)

In `dispose()`, add before clearing `#subscriptions`:

```javascript
        if (null !== this.#copiedTimer) {
            clearTimeout(this.#copiedTimer);
            this.#copiedTimer = null;
        }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn test src/__tests__/SubscriptionUrl.test.js`

Expected: PASS, 19 tests.

- [ ] **Step 6: Run the full gate and commit**

```bash
yarn test && yarn compile && yarn lint:dts && yarn format:js:fix && yarn format:js && yarn lint:md
git add src/SubscriptionBuilder/SubscriptionUrl.js src/Messages.js src/__tests__/SubscriptionUrl.test.js
git commit -m "Give SubscriptionUrl an accessible copy control

The wrapper IS the button. The card this replaces uses div[role=button] with no
tabindex and no key handler, which announces to screen readers a button that
cannot be focused or activated; a real <button> with the <code> inside it keeps
the whole-box click, the tooltip and the pointer cursor while fixing that.

The icon is an inline SVG so the library depends on no icon font, overridable
with consumer markup through copyIcon, or null for none. Feedback is a transient
class plus an aria-live announcement, with onCopy for consumers routing to their
own notification library."
```

---

### Task 4: `SubscriptionBuilder` — composition, getters and `appendTo()`

**Files:**

- Create: `src/SubscriptionBuilder/SubscriptionBuilder.js`
- Test: `src/__tests__/SubscriptionBuilder.test.js`

**Interfaces:**

- Consumes: `SubscriptionUrl` from Tasks 1-3; `CalendarControls`.
- Produces: `new SubscriptionBuilder(options)`; getters `controls`, `riteSelect`, `calendarSelect`, `localeInput`, `url`; `onChange(cb)`; `appendTo(slots, caller?)`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/SubscriptionBuilder.test.js`:

```javascript
/** @jest-environment jsdom */
/**
 * `SubscriptionBuilder` is meta-components phase 3, and the answer to issue #42.
 *
 * It composes a `CalendarControls` and NEVER calls `listenTo()`, so it never
 * fetches — `ApiExplorer`'s template. Issue #42's three picker requirements (an
 * all-calendars scope, a selectable empty option meaning the rite-level
 * calendar, and a rite select offered alongside) are satisfied by
 * `CalendarControls` as it already stands: its `CalendarSelect` is built with
 * `allowNull: true` and no filter.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import SubscriptionBuilder from '../SubscriptionBuilder/SubscriptionBuilder.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.innerHTML =
        '<div id="controls"></div><div id="url"></div>';
    global.fetch = jest.fn(() =>
        Promise.reject(new Error('no request should ever be issued')),
    );
});

describe('SubscriptionBuilder construction', () => {
    it('builds the three controls and the URL', () => {
        const sub = new SubscriptionBuilder({ locale: 'en' });
        expect(sub.riteSelect).not.toBeNull();
        expect(sub.calendarSelect).not.toBeNull();
        expect(sub.localeInput).not.toBeNull();
        expect(sub.url).toContain('/calendar/roman');
    });

    it('offers an unfiltered calendar list with a selectable empty option', () => {
        // Issue #42's first two requirements, inherited from CalendarControls.
        const sub = new SubscriptionBuilder({ locale: 'en' });
        const options = [...sub.calendarSelect._domElement.options];
        expect(options[0].value).toBe('');
        expect(options[0].disabled).toBe(false);
        expect(
            options.some((o) => o.dataset.calendartype === 'national'),
        ).toBe(true);
        expect(
            options.some((o) => o.dataset.calendartype === 'diocesan'),
        ).toBe(true);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/__tests__/SubscriptionBuilder.test.js`

Expected: FAIL — `Cannot find module '../SubscriptionBuilder/SubscriptionBuilder.js'`.

- [ ] **Step 3: Write the implementation**

Create `src/SubscriptionBuilder/SubscriptionBuilder.js`:

```javascript
/**
 * A `CalendarControls` paired with a rendered iCal subscription URL and a copy
 * control — meta-components phase 3, and the answer to issue #42.
 *
 * It NEVER calls `CalendarControls.listenTo()`, so no `ApiClient` listener is
 * ever installed and no calendar request is ever issued. The `apiClient` option
 * binds the selects to that client's API base so they populate from `/calendars`
 * metadata; it is never used to fetch a calendar. This is `ApiExplorer`'s
 * template, for the same reason.
 *
 * Issue #42 asked whether `CalendarResourcePicker` should gain a browse/subscribe
 * mode. It should not: the picker's rules are load-bearing for a resource id,
 * where empty is never valid. Here empty is a REAL, SELECTABLE choice meaning the
 * rite-level calendar. All three of the issue's requirements are satisfied by
 * `CalendarControls` as it stands — its `CalendarSelect` is built with
 * `allowNull: true` and no filter — so this component adds only the URL half.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import CalendarControls from '../MetaComponents/CalendarControls.js';
import SubscriptionUrl from './SubscriptionUrl.js';
import { ApiOptionsFilter } from '../Enums.js';
import {
    assertPlainOptions,
    describeType,
    normalizeComponentOptions,
} from '../OptionsValidation.js';
import { toIntlLocale } from '../LocaleValidation.js';

/** The slot names `appendTo()` accepts. */
const SLOT_NAMES = Object.freeze(['controls', 'url']);

export default class SubscriptionBuilder {
    /** @type {CalendarControls} */
    #controls;

    /** @type {SubscriptionUrl} */
    #url;

    /** @type {HTMLElement|null} */
    #controlsMount = null;

    /** @type {HTMLElement|null} */
    #urlMount = null;

    /** @type {boolean} */
    #disposed = false;

    /**
     * @param {Object|string|Intl.Locale} [options] - Options bag, or a locale.
     * @param {string|Intl.Locale} [options.locale] - The display locale.
     * @param {Object} [options.theme] - The theme bag; see `Theme.js`.
     * @param {Object} [options.apiClient] - Binds the controls to that client's
     *   API base. Never used to fetch a calendar.
     * @param {'https'|'webcal'} [options.scheme='https'] - The URL scheme.
     * @param {string|null} [options.copyIcon] - HTML for the copy glyph.
     * @param {string} [options.copyTitle] - The copy control's title.
     * @param {string} [options.copiedText] - The copied announcement.
     * @param {string} [options.copiedClass] - The transient copied class.
     * @param {function(boolean, Error=): void} [options.onCopy] - Copy outcome.
     */
    constructor(options) {
        const bag = normalizeComponentOptions(options, 'SubscriptionBuilder');
        this.#controls = new CalendarControls(bag);
        // The rite -> calendar chain, wired directly rather than through
        // `CalendarControls.listenTo()`: that method also installs
        // `apiClient.listenTo( … )`, which fetches on every change.
        this.#controls.apiOptions
            .linkToCalendarSelect(this.#controls.calendarSelect)
            .linkToRiteSelect(this.#controls.riteSelect);
        // `language` is derived here, where the normalized locale lives, and
        // passed in: the locale input exposes no locale accessor for
        // `SubscriptionUrl` to read.
        const language = toIntlLocale(
            bag.locale ?? 'en',
            'SubscriptionBuilder',
        ).language;
        this.#url = new SubscriptionUrl(
            this.#controls.apiOptions,
            this.#controls.calendarSelect,
            this.#controls.riteSelect,
            { ...bag, language },
        );
    }

    /**
     * Guards every method a disposed builder cannot honour.
     *
     * @returns {void}
     * @throws {Error} If this builder has been disposed.
     */
    #assertUsable() {
        if (true === this.#disposed) {
            throw new Error(
                'SubscriptionBuilder: this builder has been disposed and can no longer be used.',
            );
        }
    }

    /** @returns {CalendarControls} The wired controls. */
    get controls() {
        this.#assertUsable();
        return this.#controls;
    }

    /** @returns {Object} The wired rite select. */
    get riteSelect() {
        this.#assertUsable();
        return this.#controls.riteSelect;
    }

    /** @returns {Object} The wired calendar select. */
    get calendarSelect() {
        this.#assertUsable();
        return this.#controls.calendarSelect;
    }

    /** @returns {Object} The wired locale input. */
    get localeInput() {
        this.#assertUsable();
        return this.#controls.apiOptions._localeInput;
    }

    /** @returns {string} The serialized subscription URL. */
    get url() {
        this.#assertUsable();
        return this.#url.url;
    }

    /**
     * Registers a callback fired whenever the URL changes.
     *
     * @param {function(string): void} callback - Receives the new URL.
     * @returns {SubscriptionBuilder} This instance, for chaining.
     */
    onChange(callback) {
        this.#assertUsable();
        this.#url.onChange(callback);
        return this;
    }

    /**
     * Resolves a mount target to an element.
     *
     * @param {string|HTMLElement} target - A CSS selector or an element.
     * @param {string} slot - The slot name, for the message.
     * @param {string} caller - The `Class.method` prefix for the message.
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

    /**
     * Mounts the controls and the URL into two named slots.
     *
     * Both are REQUIRED, and a bare target is rejected: this component has two
     * mandatory mounts, and a lone target would have to pick one of them
     * silently. Matches `CalendarViewer` and `ApiExplorer`.
     *
     * The three controls all mount into the single `controls` container. Column
     * layout is the theme bag's job, through its `wrapper` keys — there is no
     * per-control slot.
     *
     * @param {{controls: (string|HTMLElement), url: (string|HTMLElement)}} slots - Where to mount.
     * @param {string} [caller='SubscriptionBuilder.appendTo'] - Internal only.
     * @returns {void}
     * @throws {Error} If disposed, if `slots` is not a plain object, names an
     *   unknown slot, omits either slot, or a slot matches nothing.
     */
    appendTo(slots, caller = 'SubscriptionBuilder.appendTo') {
        this.#assertUsable();
        try {
            assertPlainOptions(slots, caller);
        } catch {
            throw new Error(
                `${caller}: slots must be an object naming { controls, url } targets, but found type: ${describeType(slots)}`,
            );
        }

        const unknownKeys = Object.keys(slots).filter(
            (key) => false === SLOT_NAMES.includes(key),
        );
        if (unknownKeys.length > 0) {
            throw new Error(
                `${caller}: unknown slot name(s): ${unknownKeys.join(', ')}. Known slots are { controls, url }.`,
            );
        }
        for (const slot of SLOT_NAMES) {
            if (false === Object.hasOwn(slots, slot)) {
                throw new Error(
                    `${caller}: slots must name both a 'controls' and a 'url' target; '${slot}' is missing.`,
                );
            }
        }

        const controlsTarget = SubscriptionBuilder.#requireElement(
            slots.controls,
            'controls',
            caller,
        );
        const urlTarget = SubscriptionBuilder.#requireElement(
            slots.url,
            'url',
            caller,
        );

        this.#controls.riteSelect.appendTo(controlsTarget);
        this.#controls.calendarSelect.appendTo(controlsTarget);
        this.#controls.apiOptions
            .filter(ApiOptionsFilter.LOCALE_ONLY)
            .appendTo(controlsTarget);
        this.#controlsMount = controlsTarget;

        this.#url.appendTo(urlTarget);
        this.#urlMount = urlTarget;
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test src/__tests__/SubscriptionBuilder.test.js`

Expected: PASS, 2 tests.

- [ ] **Step 5: Add the slot tests**

Append to `src/__tests__/SubscriptionBuilder.test.js`:

```javascript
describe('SubscriptionBuilder.appendTo', () => {
    it('mounts all three controls and the URL', () => {
        const sub = new SubscriptionBuilder({ locale: 'en' });
        sub.appendTo({ controls: '#controls', url: '#url' });
        expect(document.querySelectorAll('#controls select').length).toBe(3);
        expect(document.querySelector('#url button')).not.toBeNull();
    });

    it('rejects a bare target', () => {
        const sub = new SubscriptionBuilder({ locale: 'en' });
        expect(() => sub.appendTo('#controls')).toThrow(
            /must be an object naming \{ controls, url \}/,
        );
    });

    it('rejects an unknown slot, naming it', () => {
        const sub = new SubscriptionBuilder({ locale: 'en' });
        expect(() =>
            sub.appendTo({ controls: '#controls', url: '#url', nope: '#x' }),
        ).toThrow(/unknown slot name\(s\): nope/);
    });

    it('rejects a missing slot, naming it', () => {
        const sub = new SubscriptionBuilder({ locale: 'en' });
        expect(() => sub.appendTo({ controls: '#controls' })).toThrow(
            /'url' is missing/,
        );
    });

    it('rejects a slot matching nothing', () => {
        const sub = new SubscriptionBuilder({ locale: 'en' });
        expect(() =>
            sub.appendTo({ controls: '#nope', url: '#url' }),
        ).toThrow(/Element not found for the controls slot/);
    });
});
```

- [ ] **Step 6: Run the tests**

Run: `yarn test src/__tests__/SubscriptionBuilder.test.js`

Expected: PASS, 7 tests.

- [ ] **Step 7: Run the full gate and commit**

```bash
yarn test && yarn compile && yarn lint:dts && yarn format:js:fix && yarn format:js
git add src/SubscriptionBuilder/SubscriptionBuilder.js src/__tests__/SubscriptionBuilder.test.js
git commit -m "Add SubscriptionBuilder: CalendarControls plus a subscription URL

Composes CalendarControls and never calls listenTo(), so it never fetches —
ApiExplorer's template. Issue #42's three picker requirements are already
satisfied by CalendarControls, whose CalendarSelect is allowNull and unfiltered,
so this adds only the URL half."
```

---

### Task 5: `SubscriptionBuilder` — `mountInto()`, `dispose()`, and the no-fetch guarantee

**Files:**

- Modify: `src/SubscriptionBuilder/SubscriptionBuilder.js`
- Test: `src/__tests__/SubscriptionBuilder.test.js`

**Interfaces:**

- Consumes: Task 4's `SubscriptionBuilder`.
- Produces: `static async mountInto(slots, options): Promise<SubscriptionBuilder|null>`; `dispose(): void`.

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/SubscriptionBuilder.test.js`:

```javascript
describe('SubscriptionBuilder.mountInto', () => {
    it('resolves to a mounted builder', async () => {
        const sub = await SubscriptionBuilder.mountInto(
            { controls: '#controls', url: '#url' },
            { locale: 'en' },
        );
        expect(sub).toBeInstanceOf(SubscriptionBuilder);
        expect(document.querySelector('#url button')).not.toBeNull();
    });

    it('rejects an unparseable locale', async () => {
        await expect(
            SubscriptionBuilder.mountInto(
                { controls: '#controls', url: '#url' },
                { locale: 'not a locale' },
            ),
        ).rejects.toThrow(/SubscriptionBuilder/);
    });

    it('rejects an unknown scheme', async () => {
        await expect(
            SubscriptionBuilder.mountInto(
                { controls: '#controls', url: '#url' },
                { locale: 'en', scheme: 'ftp' },
            ),
        ).rejects.toThrow(/'https' or 'webcal'/);
    });

    it('resolves to null when the signal is already aborted', async () => {
        const controller = new AbortController();
        controller.abort();
        const sub = await SubscriptionBuilder.mountInto(
            { controls: document.getElementById('controls'), url: '#url' },
            { locale: 'en', signal: controller.signal },
        );
        expect(sub).toBeNull();
    });
});

describe('SubscriptionBuilder never fetches', () => {
    it('issues no request, whatever the user changes', async () => {
        const sub = await SubscriptionBuilder.mountInto(
            { controls: '#controls', url: '#url' },
            { locale: 'en' },
        );
        const change = (element, value) => {
            element.value = value;
            element.dispatchEvent(new Event('change', { bubbles: true }));
        };
        change(sub.riteSelect._domElement, 'ambrosian');
        change(sub.riteSelect._domElement, 'roman');
        change(sub.calendarSelect._domElement, 'VA');
        change(sub.localeInput._domElement, 'it');
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(global.fetch).not.toHaveBeenCalled();
    });
});

describe('SubscriptionBuilder.dispose', () => {
    it('is idempotent and makes further use throw', async () => {
        const sub = await SubscriptionBuilder.mountInto(
            { controls: '#controls', url: '#url' },
            { locale: 'en' },
        );
        sub.dispose();
        sub.dispose();
        expect(() => sub.url).toThrow(/disposed/);
        expect(document.querySelector('#url button')).toBeNull();
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test src/__tests__/SubscriptionBuilder.test.js`

Expected: FAIL — `SubscriptionBuilder.mountInto is not a function`.

- [ ] **Step 3: Write the implementation**

Add to `src/SubscriptionBuilder/SubscriptionBuilder.js`:

```javascript
    /**
     * Releases every mount and listener this builder used.
     *
     * Idempotent; further use throws.
     *
     * Subject to the same documented, pre-existing gap as the rest of the
     * family: the anonymous listeners `ApiOptions.linkToCalendarSelect()` and
     * `linkToRiteSelect()` attach internally are not exposed anywhere this
     * could reach them, and are not released.
     *
     * @returns {void}
     */
    dispose() {
        if (true === this.#disposed) {
            return;
        }
        this.#url.dispose();
        this.#controls.dispose();
        this.#controlsMount?.replaceChildren();
        this.#urlMount?.replaceChildren();
        this.#controlsMount = null;
        this.#urlMount = null;
        this.#disposed = true;
    }

    /**
     * Resolves the slots argument to an already-attached element, for the
     * cancellation check in `mountInto()` only.
     *
     * @param {Object} slots - The `mountInto()` slots argument.
     * @returns {HTMLElement|null} The first resolved element found, or `null`.
     */
    static #targetElement(slots) {
        for (const key of SLOT_NAMES) {
            const candidate = slots?.[key];
            if (candidate instanceof HTMLElement) {
                return candidate;
            }
        }
        return null;
    }

    /**
     * Resolves the targets, constructs the builder and mounts it.
     *
     * **Rejects** on invalid options — an unparseable locale, an unknown
     * `scheme`, an unknown or missing slot, a target matching nothing — and on
     * metadata that cannot be loaded at all. The second matches
     * `CalendarControls`, `CalendarViewer` and `ApiExplorer`: this bundles a
     * whole form, and a rite select and calendar select with no calendars to
     * list are not a smaller working form but no form at all. It does NOT grow a
     * failure control like `CalendarResourcePicker`'s, which substitutes for a
     * single required field.
     *
     * There is no `settled`, no `onError` and no `initialFetch`: this component
     * never fetches a calendar, exactly as `ApiExplorer` never does.
     *
     * @param {{controls: (string|HTMLElement), url: (string|HTMLElement)}} slots - Where to mount.
     * @param {Object} [options] - As the constructor, plus `signal`.
     * @param {AbortSignal} [options.signal] - Cancels the mount.
     * @returns {Promise<SubscriptionBuilder|null>} The mounted builder, or
     *   `null` when the mount was cancelled.
     */
    static async mountInto(slots, options = {}) {
        const bag = normalizeComponentOptions(options, 'SubscriptionBuilder');
        const { signal } = bag;

        const builder = new SubscriptionBuilder(bag);

        try {
            assertPlainOptions(slots, 'SubscriptionBuilder.mountInto');
        } catch {
            throw new Error(
                `SubscriptionBuilder.mountInto: slots must be an object naming { controls, url } targets, but found type: ${describeType(slots)}`,
            );
        }

        const element = SubscriptionBuilder.#targetElement(slots);
        if (
            true === signal?.aborted ||
            (null !== element && false === element.isConnected)
        ) {
            return null;
        }

        builder.appendTo(slots, 'SubscriptionBuilder.mountInto');

        return builder;
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test src/__tests__/SubscriptionBuilder.test.js`

Expected: PASS, 13 tests.

- [ ] **Step 5: Run the full gate and commit**

```bash
yarn test && yarn compile && yarn lint:dts && yarn format:js:fix && yarn format:js
git add src/SubscriptionBuilder/SubscriptionBuilder.js src/__tests__/SubscriptionBuilder.test.js
git commit -m "Add SubscriptionBuilder.mountInto() and dispose()

mountInto() rejects on invalid options and on unloadable metadata, matching
CalendarControls, CalendarViewer and ApiExplorer: this bundles a whole form, so
there is no meaningful partial stand-in. No settled, no onError, no initialFetch
— it never fetches, which is pinned by a test that changes every control and
asserts global.fetch was never called."
```

---

### Task 6: Theme wiring, export, and documentation

**Files:**

- Modify: `src/SubscriptionBuilder/SubscriptionUrl.js`
- Modify: `src/index.js`
- Modify: `docs/meta-components.md`
- Modify: `CLAUDE.md`
- Test: `src/__tests__/SubscriptionBuilder.test.js`

**Interfaces:**

- Consumes: everything from Tasks 1-5.
- Produces: `SubscriptionBuilder` exported from `src/index.js`.

- [ ] **Step 1: Write the failing theme test**

Append to `src/__tests__/SubscriptionBuilder.test.js`:

```javascript
describe('SubscriptionBuilder theming', () => {
    it('reaches all three controls and the URL wrapper', () => {
        const sub = new SubscriptionBuilder({
            locale: 'en',
            theme: {
                select: 'form-select',
                label: 'form-label',
                wrapper: 'form-group col-md',
                subscriptionUrl: { class: 'bg-light border rounded p-2' },
            },
        });
        sub.appendTo({ controls: '#controls', url: '#url' });

        expect(sub.riteSelect._domElement.className).toBe('form-select');
        expect(sub.calendarSelect._domElement.className).toBe('form-select');
        expect(sub.localeInput._domElement.className).toBe('form-select');
        expect(
            sub.riteSelect._domElement.closest('.form-group'),
        ).not.toBeNull();
        expect(document.querySelector('#url button').className).toBe(
            'bg-light border rounded p-2',
        );
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/__tests__/SubscriptionBuilder.test.js -t theming`

Expected: FAIL — the button has no class.

- [ ] **Step 3: Apply the theme in `SubscriptionUrl`**

In the `SubscriptionBuilder` constructor, resolve the URL's theme and pass it through. Add to the imports:

```javascript
import { resolveChildTheme } from '../MetaComponents/Theme.js';
```

and replace the `new SubscriptionUrl(...)` call with:

```javascript
        const urlTheme = resolveChildTheme(bag.theme, 'subscriptionUrl');
        this.#url = new SubscriptionUrl(
            this.#controls.apiOptions,
            this.#controls.calendarSelect,
            this.#controls.riteSelect,
            { ...bag, urlTheme },
        );
```

In `SubscriptionUrl`'s constructor, after creating `#domElement` and `#codeElement`, add:

```javascript
        const urlTheme = options.urlTheme ?? {};
        if (Object.hasOwn(urlTheme, 'class')) {
            this.#domElement.className = urlTheme.class;
        }
        if (Object.hasOwn(urlTheme, 'codeClass')) {
            this.#codeElement.className = urlTheme.codeClass;
        }
        if (Object.hasOwn(urlTheme, 'copiedClass')) {
            this.#copiedClass = urlTheme.copiedClass;
        }
```

Move the `#copiedClass` assignment above this block so the theme can override it, i.e. set `this.#copiedClass = options.copiedClass ?? 'is-copied';` first.

> **Correction (post-execution).** The `codeClass` and `copiedClass` branches shown above were found
> unreachable during execution and removed from the implementation. `Theme.js`'s per-child key lists
> (`ALL_OVERRIDE_KEYS` and `OVERRIDE_KEYS_BY_ROLE.select`, the role `resolveChildTheme()` is called with
> for `subscriptionUrl`) do not carry a `codeClass` or `copiedClass` key, so `assertTheme()` rejects a
> theme bag naming either one before `SubscriptionUrl`'s constructor is ever reached — these two branches
> could never run. Only the `class` branch survives. This code block is left as written above, as the
> historical record of what was instructed; do not reimplement the removed branches from this listing.

- [ ] **Step 4: Run the test**

Run: `yarn test src/__tests__/SubscriptionBuilder.test.js -t theming`

Expected: PASS.

- [ ] **Step 5: Export the component**

In `src/index.js`, add the import beside `ApiExplorer`'s:

```javascript
import SubscriptionBuilder from './SubscriptionBuilder/SubscriptionBuilder.js';
```

and add `SubscriptionBuilder,` to the export list beside `ApiExplorer,`.

`SubscriptionUrl` is **not** exported — it is this component's private renderer, the same as `Theme.js`, `LocaleValidation.js` and `OptionsValidation.js`.

- [ ] **Step 6: Document the component**

Add a `## SubscriptionBuilder` section to `docs/meta-components.md`, after `## ApiExplorer`, covering: what it
bundles; the `{ controls, url }` slots and why both are required; that column layout comes from the theme
bag's wrapper keys rather than per-control slots; the `scheme` option; the copy control's options (`copyIcon`,
`copyTitle`, `copiedText`, `copiedClass`, `onCopy`); that it never fetches and therefore has no `settled`,
`onError` or `initialFetch`; and `dispose()`.

Include the worked example:

```javascript
const sub = await SubscriptionBuilder.mountInto(
    { controls: '#subscriptionControls', url: '#calSubscriptionUrlWrapper' },
    {
        locale: 'it',
        apiClient,
        copyIcon: '<i class="fas fa-clipboard float-end text-info"></i>',
        onCopy: (ok) =>
            ok ? toastr.success('Copied') : toastr.error('Copy failed'),
        theme: {
            select: 'form-select',
            label: 'form-label',
            wrapper: 'form-group col-md',
            subscriptionUrl: { class: 'w-100 text-center bg-light border border-info rounded p-2' },
        },
    },
);
```

State the `w-100` note: the copy control is a `<button>`, which unlike a `<div>` does not fill its container.

- [ ] **Step 7: Update `CLAUDE.md`**

Add `SubscriptionBuilder` to the key-components table and to the meta-components section, recording:

- it never fetches, so it has no `settled`/`onError`/`initialFetch`, like `ApiExplorer`;
- both slots are required;
- the copy control's wrapper **is** the `<button>` — do not "fix" it into a separate button beside the text,
  because `div[role="button"]` without `tabindex` or a key handler announces a control that cannot be focused or
  activated;
- `return_type` is pinned to ICS and `explicitRite` is set to `true`, and why.

Also correct the stale Messages claim. `CLAUDE.md` currently says "Supports 13 languages via message catalogs
in `Messages.js`: en, it, la, es, fr, de, pt, nl, hu, id, sk, vi" — twelve names under a claim of thirteen,
describing a file that holds **84 locale blocks** with uneven key coverage. Replace with an accurate
statement: 84 locale blocks, unevenly populated, with newer keys present in twelve and every other locale
reaching English through the call sites' `??` fallback.

- [ ] **Step 8: Run the full gate and commit**

```bash
yarn test && yarn compile && yarn lint:dts && yarn format:js:fix && yarn format:js
yarn lint:md && yarn format:md:fix && yarn format:md
git add -A
git commit -m "Theme, export and document SubscriptionBuilder

Also corrects CLAUDE.md's Messages claim: it said 13 languages while listing
twelve names, for a file that actually holds 84 locale blocks with uneven key
coverage."
```

---

## Self-review

**Spec coverage.** Every section of the spec maps to a task: composition and the no-fetch guarantee (Tasks 4,
5); the dedicated renderer on the shared `CurrentEndpoint` (Task 1); the locale select as a control (Task 2);
fixed ICS/CIVIL parameters (Task 1); `scheme` (Task 1); the wrapper-is-the-button decision and its
accessibility rationale (Task 3); the inline SVG icon and its override (Task 3); copy feedback, both the
built-in state and `onCopy` (Task 3); Messages coverage following `SELECT_A_RITE`'s twelve blocks (Task 3);
slots and layout (Task 4); theming (Task 6); errors and reject-vs-resolve (Task 5); `dispose()` (Tasks 2, 5);
the full test list (spread across all six); the `CLAUDE.md` Messages correction (Task 6). The frontend
migration is a spec non-goal and correctly has no task.

**Placeholders.** None. Every code step carries the code; every test step carries the assertions.

**Type consistency.** `SubscriptionUrl`'s constructor is `(apiOptions, calendarSelect, riteSelect, options)`
in Tasks 1, 2, 3, 4 and 6. `url` is a getter returning `string` on both classes. `onChange(callback)` is
chainable on both. `dispose()` returns `void` on both. `SLOT_NAMES` is `['controls', 'url']` in Tasks 4 and 5.
`#copiedClass` is assigned in Task 3 and overridden in Task 6, with Step 3 of Task 6 stating the ordering
requirement explicitly.

**One risk flagged for the implementer.** Task 3's constructor reads `apiOptions._localeInput._locale` to pick
the Messages language. Verify that accessor exists before relying on it; if it does not, take the language
from the `bag.locale` that `SubscriptionBuilder` already normalized and pass it into `SubscriptionUrl`'s
options as `language`. Either way the `??` fallback to `Messages['en']` must stay, because a locale outside
the catalogue would otherwise throw.
