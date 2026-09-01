# `ApiOptions.onSettled()` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** Give `ApiOptions` a public `onSettled( callback )` that fires once after its synthetic change cascade
has settled, so `SubscriptionUrl` and `CalendarControls` can delete their own microtask coalescers.

**Architecture:** `ApiOptions` attaches one `change` listener per input and per linked select, marks itself
dirty, and flushes on a microtask, notifying subscribers once. This relocates the idiom
`ApiClient.#scheduleRefetch()` already uses into the layer that causes the burst. Every existing per-input
`change` dispatch is untouched, so the change is additive and ships as a minor.

**Tech Stack:** ES2022 JavaScript modules, JSDoc types compiled by `tsc` with `checkJs` off, Jest 30 with
jsdom, Yarn 4 (PnP).

**Spec:** `docs/superpowers/specs/2026-09-01-api-options-settled-signal-design.md`

## Global Constraints

- **Formatting is prettier's**, via `.prettierrc`: 4-space indent, single quotes. Run `yarn format:js:fix`
  before committing; CI runs `yarn format:js` and fails on an unformatted file.
- **`checkJs` is off**, so `yarn compile` passing proves nothing about the emitted `.d.ts`. Any new public
  member must be asserted in `type-fixtures/dts-consumer.ts` and checked with `yarn lint:dts`, which requires
  `yarn compile` to have run first. This repo has shipped three features whose type surface was silently
  missing; do not add a fourth.
- **Never skip git hooks.** No `--no-verify`.
- **Tests must `await Promise.resolve()`** before asserting on anything a microtask flush produces.
- **`ApiBase.reset()` in `beforeEach`**, and build a loaded base with
  `ApiBase.fromMetadata( API_URL, FULL_METADATA )` from `src/__fixtures__/metadata.js` — no network in tests.
- **Do not change any existing `dispatchEvent( new Event( 'change' ) )` call.** The additive contract is the
  whole reason this is a minor rather than a 3.0.0.

## File Structure

| File                                            | Responsibility in this plan                                                                         |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `src/ApiOptions/ApiOptions.js`                  | Owns the signal: registrar, dirty marking, microtask flush, listener attachment                     |
| `src/SubscriptionBuilder/SubscriptionUrl.js`    | Drops `#scheduleNotify()`, subscribes instead; keeps its synchronous `#render()`                    |
| `src/MetaComponents/CalendarControls.js`        | Drops `#scheduleSelectionNotify()`, subscribes instead; keeps `#applyScopeVisibility()` synchronous |
| `src/ApiClient/ApiClient.js`                    | Doc comment only — records why its coalescer stays                                                  |
| `src/__tests__/ApiOptionsSettledSignal.test.js` | New suite for the signal itself                                                                     |
| `type-fixtures/dts-consumer.ts`                 | Compile-time assertion that `onSettled` reaches `dist/index.d.ts`                                   |
| `docs/api-options.md`, `CHANGELOG.md`           | Public documentation                                                                                |

---

### Task 1: The signal on `ApiOptions`

**Files:**

- Modify: `src/ApiOptions/ApiOptions.js`
- Modify: `type-fixtures/dts-consumer.ts`
- Test: `src/__tests__/ApiOptionsSettledSignal.test.js` (create)

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: `apiOptions.onSettled( callback: () => void ): () => void` — registers `callback`, returns an
  unsubscribe function. Private `#scheduleSettled(): void`, used by Task 2.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/ApiOptionsSettledSignal.test.js`:

```javascript
/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.innerHTML = '<div id="opts"></div>';
});

describe('ApiOptions.onSettled()', () => {
    it('notifies once for a burst of input changes in one turn', async () => {
        const apiOptions = new ApiOptions('en');
        const seen = jest.fn();
        apiOptions.onSettled(seen);

        apiOptions.yearInput._domElement.dispatchEvent(new Event('change'));
        apiOptions.localeInput._domElement.dispatchEvent(new Event('change'));
        await Promise.resolve();

        expect(seen).toHaveBeenCalledTimes(1);
    });

    it('notifies again for a second action in a separate turn', async () => {
        const apiOptions = new ApiOptions('en');
        const seen = jest.fn();
        apiOptions.onSettled(seen);

        apiOptions.yearInput._domElement.dispatchEvent(new Event('change'));
        await Promise.resolve();
        apiOptions.yearInput._domElement.dispatchEvent(new Event('change'));
        await Promise.resolve();

        expect(seen).toHaveBeenCalledTimes(2);
    });

    it('notifies for a lone edit that originates no cascade', async () => {
        const apiOptions = new ApiOptions('en');
        const seen = jest.fn();
        apiOptions.onSettled(seen);

        apiOptions.yearInput._domElement.dispatchEvent(new Event('change'));
        await Promise.resolve();

        expect(seen).toHaveBeenCalledTimes(1);
    });

    it('does not fire on subscribe', async () => {
        const apiOptions = new ApiOptions('en');
        const seen = jest.fn();
        apiOptions.onSettled(seen);

        await Promise.resolve();

        expect(seen).not.toHaveBeenCalled();
    });

    it('throws for a non-function', () => {
        const apiOptions = new ApiOptions('en');
        expect(() => apiOptions.onSettled('nope')).toThrow(/onSettled/);
    });

    it('stops notifying after the returned unsubscribe is called', async () => {
        const apiOptions = new ApiOptions('en');
        const seen = jest.fn();
        const unsubscribe = apiOptions.onSettled(seen);
        unsubscribe();

        apiOptions.yearInput._domElement.dispatchEvent(new Event('change'));
        await Promise.resolve();

        expect(seen).not.toHaveBeenCalled();
    });

    it('isolates a throwing callback from the others and reports it', async () => {
        const apiOptions = new ApiOptions('en');
        const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
        const after = jest.fn();
        apiOptions.onSettled(() => {
            throw new Error('subscriber blew up');
        });
        apiOptions.onSettled(after);

        apiOptions.yearInput._domElement.dispatchEvent(new Event('change'));
        await Promise.resolve();

        expect(after).toHaveBeenCalledTimes(1);
        expect(errors).toHaveBeenCalled();
        errors.mockRestore();
    });

    it('does not skip the next subscriber when one unsubscribes mid-flush', async () => {
        const apiOptions = new ApiOptions('en');
        const second = jest.fn();
        const unsubscribeFirst = apiOptions.onSettled(() => unsubscribeFirst());
        apiOptions.onSettled(second);

        apiOptions.yearInput._domElement.dispatchEvent(new Event('change'));
        await Promise.resolve();

        expect(second).toHaveBeenCalledTimes(1);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/ApiOptionsSettledSignal.test.js`
Expected: FAIL — `apiOptions.onSettled is not a function`.

- [ ] **Step 3: Add the two private fields**

In `src/ApiOptions/ApiOptions.js`, beside the existing `#filter` / `#filtersSet` declarations:

```javascript
    /**
     * Callbacks registered through {@link ApiOptions#onSettled}.
     *
     * @type {Array<function(): void>}
     */
    #settledCallbacks = [];

    /**
     * The pending settled flush, or `null` when no batch is in flight.
     *
     * @type {?Promise<void>}
     */
    #pendingSettled = null;
```

- [ ] **Step 4: Add the flush**

Add as a private method:

```javascript
    /**
     * Marks the form dirty and schedules one settled notification for this turn.
     *
     * One user action moves several of these inputs: a rite change makes this class
     * rewrite the calendar list, the locale options, the year floor and the calendar
     * path, dispatching a synthetic `change` on each. Notifying per event would
     * describe the state the user had just LEFT, which is the bug three separate
     * consumers each had to defend against on their own — see issue #55.
     *
     * A microtask is the right horizon because every dispatch in that burst is
     * synchronous, so the whole cascade has landed before this runs, and nothing
     * beyond the current turn is swallowed. `ApiClient.#scheduleRefetch()` states the
     * same reasoning at more length; this is that mechanism moved into the layer that
     * CAUSES the burst rather than one that observes it.
     *
     * @returns {void}
     * @private
     */
    #scheduleSettled() {
        if (null !== this.#pendingSettled) {
            return;
        }
        this.#pendingSettled = Promise.resolve().then(() => {
            // Cleared BEFORE notifying, so a `change` raised by a subscriber
            // schedules a NEW batch rather than joining a departing one.
            this.#pendingSettled = null;
            // `forEach`, not `for...of`: it captures the length before it starts, so
            // a callback that registers another callback does not have that new one
            // fired inside this same flush — which would contradict "does not fire on
            // subscribe". `SubscriptionUrl` and `EventEmitter.emit()` notify this way
            // for the same reason.
            this.#settledCallbacks.forEach((callback) => {
                // A subscriber's failure is its own. Left unguarded it would abandon
                // the rest of the list and surface as an unhandled rejection, since
                // this body runs on a microtask with no caller to catch it.
                try {
                    callback();
                } catch (error) {
                    console.error(
                        'ApiOptions.onSettled(): a subscriber threw; the remaining subscribers were still notified.',
                        error,
                    );
                }
            });
        });
    }
```

- [ ] **Step 5: Add the public registrar**

```javascript
    /**
     * Registers a callback fired once after this form has settled, on a microtask.
     *
     * The callback takes no argument: read whatever state you need from the ten input
     * accessors when it fires. A payload would be a second way to read state those
     * accessors already expose, and the two could then drift.
     *
     * Does NOT fire on subscribe, matching `CalendarControls.onSelectionChange()`,
     * `SubscriptionBuilder.onChange()` and `onError()`. The state is a synchronous,
     * race-free read, so the initial pass is `read(); subscribe();`.
     *
     * Returns an unsubscribe function rather than `this`. `ApiOptions` has no
     * `dispose()`, so a subscription registered here would otherwise have no lifecycle
     * method to release it.
     *
     * @param {function(): void} callback - Invoked once per settled batch.
     * @returns {function(): void} Removes this registration. Safe to call twice.
     * @throws {Error} If `callback` is not a function.
     */
    onSettled(callback) {
        if ('function' !== typeof callback) {
            throw new Error(
                `ApiOptions.onSettled(): Expected a function, but found: ${typeof callback}`,
            );
        }
        this.#settledCallbacks.push(callback);
        return () => {
            // Replaces the array rather than splicing it, so a subscriber that removes
            // itself mid-flush does not cause the next one to be skipped.
            // `EventEmitter.off()` has been written this way since 2.2.0.
            this.#settledCallbacks = this.#settledCallbacks.filter(
                (registered) => registered !== callback,
            );
        };
    }
```

- [ ] **Step 6: Attach one listener per input**

Add this private method:

```javascript
    /**
     * Listens to every input this form owns, so any user edit produces a settled
     * signal — not only the ones that originate a cascade.
     *
     * All ten are listened to regardless of `filter`. They all exist; `filter` decides
     * only which are appended. This is the same rule theming follows, and keeping the
     * two identical is what stops a filter change from silently narrowing the signal.
     *
     * @returns {void}
     * @private
     */
    #attachSettledListeners() {
        Object.values(this.#inputs)
            .filter((input) => null !== input && undefined !== input)
            .forEach((input) =>
                input._domElement.addEventListener('change', () =>
                    this.#scheduleSettled(),
                ),
            );
    }
```

Then call it at the very end of the constructor, after every `this.#inputs.*` assignment:

```javascript
        this.#attachSettledListeners();
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `yarn test src/__tests__/ApiOptionsSettledSignal.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 8: Assert the type surface**

Add to `type-fixtures/dts-consumer.ts`, beside the existing `ApiOptions` assertions:

```typescript
// `onSettled` must reach dist/index.d.ts as a function returning an unsubscribe
// function. `yarn compile` cannot see this — checkJs is off.
const unsubscribeSettled: () => void = apiOptions.onSettled(() => {});
unsubscribeSettled();
```

- [ ] **Step 9: Verify the declarations**

Run: `yarn compile && yarn lint:dts`
Expected: both clean. If `lint:dts` cannot see `onSettled`, the JSDoc on the method is malformed — fix it
rather than editing the fixture.

- [ ] **Step 10: Format and commit**

```bash
yarn format:js:fix
git add src/ApiOptions/ApiOptions.js src/__tests__/ApiOptionsSettledSignal.test.js type-fixtures/dts-consumer.ts
git commit -m "Add ApiOptions.onSettled(), one signal per settled batch (#55)"
```

---

### Task 2: Extend detection to the linked selects

**Files:**

- Modify: `src/ApiOptions/ApiOptions.js` — inside `linkToRiteSelect()` and `linkToCalendarSelect()`
- Test: `src/__tests__/ApiOptionsSettledSignal.test.js`

**Interfaces:**

- Consumes: `#scheduleSettled()` from Task 1.
- Produces: no new public members. A rite or calendar change on a **linked** select now produces exactly one
  settled signal, which Tasks 3 and 4 both depend on.

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/ApiOptionsSettledSignal.test.js`, adding `CalendarSelect` and `RiteSelect` to the
imports at the top of the file:

```javascript
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';

describe('ApiOptions.onSettled() and the linked selects', () => {
    it('notifies once for a rite change, not once per cascaded input', async () => {
        const riteSelect = new RiteSelect('en');
        const apiOptions = new ApiOptions('en').linkToRiteSelect(riteSelect);
        const seen = jest.fn();
        apiOptions.onSettled(seen);

        riteSelect._domElement.value = 'ambrosian';
        riteSelect._domElement.dispatchEvent(new Event('change'));
        await Promise.resolve();

        expect(seen).toHaveBeenCalledTimes(1);
    });

    it('notifies once for a calendar change', async () => {
        const calendarSelect = new CalendarSelect('en');
        const apiOptions = new ApiOptions('en').linkToCalendarSelect(calendarSelect);
        const seen = jest.fn();
        apiOptions.onSettled(seen);

        calendarSelect._domElement.value = 'IT';
        calendarSelect._domElement.dispatchEvent(new Event('change'));
        await Promise.resolve();

        expect(seen).toHaveBeenCalledTimes(1);
    });

    it('an unlinked ApiOptions still signals for its own inputs', async () => {
        const apiOptions = new ApiOptions('en');
        const seen = jest.fn();
        apiOptions.onSettled(seen);

        apiOptions.localeInput._domElement.dispatchEvent(new Event('change'));
        await Promise.resolve();

        expect(seen).toHaveBeenCalledTimes(1);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/ApiOptionsSettledSignal.test.js -t 'linked selects'`
Expected: the first two FAIL with `expect(jest.fn()).toHaveBeenCalledTimes(1)` receiving `0` — the cascade
moves inputs, but the select's own change is not yet observed.

- [ ] **Step 3: Attach in `linkToRiteSelect()`**

In `linkToRiteSelect()`, immediately after the existing
`riteSelect._domElement.addEventListener( 'change', (ev) => applyRite( ev.target.value ) );`:

```javascript
        // A second, separate listener rather than a call inside `applyRite()`: the
        // signal must describe the whole batch, including the paths where `applyRite()`
        // returns early. Order does not matter — the flush is a microtask.
        riteSelect._domElement.addEventListener('change', () =>
            this.#scheduleSettled(),
        );
```

- [ ] **Step 4: Attach in `linkToCalendarSelect()`**

In `linkToCalendarSelect()`, immediately after the existing
`calendarSelect._domElement.addEventListener( 'change', (ev) => { … } );` block closes:

```javascript
        calendarSelect._domElement.addEventListener('change', () =>
            this.#scheduleSettled(),
        );
```

- [ ] **Step 5: Cover the remaining two cascade origins**

The spec requires all four origins asserted. Two are covered above; these are the other two, which are the
nation/diocese pair (`ApiOptions.js:995-996`) and the calendar path input (`ApiOptions.js:1036`).

Append the path-builder case, which needs no new arrangement — `calendarPathInput` is one of the ten inputs,
so this asserts that the input Task 1 already listens to also signals when it is the cascade's origin:

```javascript
describe('ApiOptions.onSettled() and the path builder', () => {
    it('notifies once for a calendar path change', async () => {
        const apiOptions = new ApiOptions('en').filter(
            ApiOptionsFilter.PATH_BUILDER,
        );
        apiOptions.appendTo('#opts');
        const seen = jest.fn();
        apiOptions.onSettled(seen);

        apiOptions.calendarPathInput._domElement.dispatchEvent(
            new Event('change'),
        );
        await Promise.resolve();

        expect(seen).toHaveBeenCalledTimes(1);
    });
});
```

Add `import { ApiOptionsFilter } from '../Enums.js';` to the file's imports.

For the nation/diocese pair, build the paired-select arrangement by copying the setup from
`src/__tests__/ComponentBinding.test.js` — read it first; it is the shortest existing construction of a
nations select linked to a dioceses select. The assertion is the same shape as the two above: dispatch one
`change` on the **nations** select, `await Promise.resolve()`, and expect exactly one notification, not one
per input the diocese cascade rewrites.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `yarn test src/__tests__/ApiOptionsSettledSignal.test.js`
Expected: PASS — 11 tests plus the two added in Step 5.

- [ ] **Step 7: Format and commit**

```bash
yarn format:js:fix
git add src/ApiOptions/ApiOptions.js src/__tests__/ApiOptionsSettledSignal.test.js
git commit -m "Signal settled for a linked rite or calendar change too (#55)"
```

---

### Task 3: Migrate `SubscriptionUrl`

**Files:**

- Modify: `src/SubscriptionBuilder/SubscriptionUrl.js:60-66` (fields), `:408-421` (`#listen`), `:441-460`
  (`#scheduleNotify`), the constructor near `:226`, and `dispose()` near `:499`
- Test: existing `src/__tests__/SubscriptionUrl.test.js` and `src/__tests__/SubscriptionBuilder*.test.js` are
  the regression net — **do not edit them**

  > **Corrected after the fact.** This line originally named `src/__tests__/SubscriptionBuilder*.test.js`
  > alone, a glob that excludes `SubscriptionUrl.test.js` — where the `onChange` dedupe, coalescing and
  > dispose-race tests this task actually had to preserve all live. No code defect resulted (the full suite
  > was run, so those tests did guard the change), but the plan named the wrong net and is corrected here
  > rather than left standing, following the precedent of commit `d37f703`.

**Interfaces:**

- Consumes: `apiOptions.onSettled( callback )` from Task 1, and the linked-select detection from Task 2.
- Produces: no public change. `onChange()`'s contract is unaltered: one notification per user action, deduped
  against the last notified URL.

**Precondition, verify before starting:** `SubscriptionBuilder`'s constructor calls
`apiOptions.linkToCalendarSelect( … ).linkToRiteSelect( … )`. That is what makes Task 2 cover the calendar and
rite selects this class listens to. Confirm with
`grep -n 'linkToCalendarSelect\|linkToRiteSelect' src/SubscriptionBuilder/SubscriptionBuilder.js`. If it does
not, stop and report — the migration is unsound without it.

- [ ] **Step 1: Run the existing suites to establish green**

Run: `yarn test SubscriptionBuilder`
Expected: PASS. Record the test count; it must not change in this task.

- [ ] **Step 2: Replace the field**

Delete `#pendingNotify`:

```javascript
    /** @type {?Promise<void>} */
    #pendingNotify = null;
```

and add in its place:

```javascript
    /**
     * Releases this class's `ApiOptions.onSettled()` registration.
     *
     * @type {?function(): void}
     */
    #unsubscribeSettled = null;
```

- [ ] **Step 3: Turn the flush body into a plain notifier**

Replace the whole `#scheduleNotify()` method with:

```javascript
    /**
     * Notifies subscribers when the serialized URL has changed.
     *
     * Called from `ApiOptions.onSettled()`, which is what guarantees the whole
     * synthetic cascade has landed before this reads `this.url`. Until issue #55 this
     * class scheduled its own microtask for exactly that reason; the scheduling now
     * belongs to the layer that causes the cascade, and only the dedupe — which is
     * specific to what THIS class derives — remains here.
     *
     * @returns {void}
     * @private
     */
    #notifyIfChanged() {
        const next = this.url;
        // The documented contract is that this fires when the URL CHANGES. Compared
        // against the LAST NOTIFIED value, not a set of every URL ever seen, so
        // changing away and back still notifies both times.
        if (next === this.#lastNotified) {
            return;
        }
        this.#lastNotified = next;
        this.#changeCallbacks.forEach((callback) => callback(next));
    }
```

- [ ] **Step 4: Subscribe in the constructor**

Immediately after the existing `this.#lastNotified = this.url;` line:

```javascript
        this.#unsubscribeSettled = apiOptions.onSettled(() =>
            this.#notifyIfChanged(),
        );
```

- [ ] **Step 5: Drop the scheduling call from `#listen()`, keeping the render**

In `#listen()`, the listener body becomes:

```javascript
        const listener = (ev) => {
            update(ev);
            // The repaint stays SYNCHRONOUS: both firings of a single user action share
            // one task, so the browser never paints between them and the intermediate
            // write is unobservable. Only the NOTIFICATION is deferred, and that is now
            // `ApiOptions.onSettled()`'s job rather than this class's.
            this.#render();
        };
```

- [ ] **Step 6: Release the subscription in `dispose()`**

Where `dispose()` currently sets `this.#pendingNotify = null;`, replace that line with:

```javascript
        this.#unsubscribeSettled?.();
        this.#unsubscribeSettled = null;
```

- [ ] **Step 7: Run the suites to verify they still pass, unedited**

Run: `yarn test SubscriptionBuilder`
Expected: PASS, with the same test count as Step 1 and no edits to those files. **If a test needs changing to
pass, stop.** The spec is explicit that this indicates a behaviour regression, not a test to update.

- [ ] **Step 8: Format and commit**

```bash
yarn format:js:fix
git add src/SubscriptionBuilder/SubscriptionUrl.js
git commit -m "SubscriptionUrl subscribes to onSettled instead of coalescing (#55)"
```

---

### Task 4: Migrate `CalendarControls`

**Files:**

- Modify: `src/MetaComponents/CalendarControls.js:176-192` (fields), `:568-583` (`#listenForSelection`),
  `:667-710` (`#scheduleSelectionNotify`), the constructor near `:432`, and `dispose()`
- Test: existing `src/__tests__/CalendarControlsSelectionChange.test.js` is the regression net — **do not
  edit it**

**Interfaces:**

- Consumes: `apiOptions.onSettled( callback )` from Task 1, and the linked-select detection from Task 2.
- Produces: no public change. `onSelectionChange()`'s contract is unaltered.

**Trap:** `#listenForSelection()` does two things — it schedules the notify AND calls
`#applyScopeVisibility()`. The visibility call **must stay synchronous on the listener**: a scoped control's
`hidden` must reflect the new selection by the time the handler returns, not one turn later. Only the notify
half migrates. Removing the whole listener would break calendar scope.

- [ ] **Step 1: Run the existing suite to establish green**

Run: `yarn test CalendarControlsSelectionChange`
Expected: PASS. Record the test count.

- [ ] **Step 2: Replace the field**

Delete `#pendingSelectionNotify`:

```javascript
    /** @type {?Promise<void>} */
    #pendingSelectionNotify = null;
```

and add:

```javascript
    /**
     * Releases this component's `ApiOptions.onSettled()` registration.
     *
     * @type {?function(): void}
     */
    #unsubscribeSettled = null;
```

- [ ] **Step 3: Turn the flush body into a plain notifier**

Replace the whole `#scheduleSelectionNotify()` method with:

```javascript
    /**
     * Notifies subscribers when the selection payload has changed.
     *
     * Called from `ApiOptions.onSettled()`, which is what guarantees the cascade has
     * landed — including `ApiOptions`' own listener, so `predeterminedInputs` describes
     * the new selection rather than the previous one. Until issue #55 this component
     * scheduled its own microtask for exactly that reason.
     *
     * @returns {void}
     * @private
     */
    #notifySelectionIfChanged() {
        // NOT what stops a disposed instance notifying — `dispose()` empties
        // `#selectionCallbacks`, so the loop below would already visit nothing. What
        // this prevents is a disposed instance doing pointless work in a turn it no
        // longer belongs to: reading its children's DOM and rewriting
        // `#lastSelectionKey`. It returns rather than throwing through
        // `#assertUsable()`, because a throw here has no caller to catch it.
        if (true === this.#disposed) {
            return;
        }
        const selection = this.#readSelection();
        const key = CalendarControls.#selectionKey(selection);
        // Fires when the selection CHANGES. Compared against the LAST NOTIFIED key,
        // not a set of every key ever seen, so changing away and back notifies twice.
        if (key === this.#lastSelectionKey) {
            return;
        }
        this.#lastSelectionKey = key;
        // `forEach`, not `for...of`: a callback that registers another callback does
        // not have that new one fired inside this same flush.
        this.#selectionCallbacks.forEach((callback) => callback(selection));
    }
```

- [ ] **Step 4: Subscribe in the constructor**

After the existing `this.#lastSelectionKey = CalendarControls.#selectionKey( … );` seeding call:

```javascript
        this.#unsubscribeSettled = this.#apiOptions.onSettled(() =>
            this.#notifySelectionIfChanged(),
        );
```

Use the private field `#apiOptions`, **not** the public `apiOptions` getter: that getter calls
`#assertUsable()`, which throws on a disposed instance. It is harmless in the constructor, but reaching
through a guarded public getter from inside the class is the kind of thing that breaks the day this line
moves.

- [ ] **Step 5: Drop the scheduling call from `#listenForSelection()`, keeping the visibility call**

The listener body becomes:

```javascript
        const listener = () => {
            // Stays SYNCHRONOUS: a scoped control's `hidden` must already reflect the
            // new selection by the time this handler returns, not one turn later. Only
            // the NOTIFICATION was deferred, and that is now
            // `ApiOptions.onSettled()`'s job — see issue #55.
            this.#applyScopeVisibility();
        };
```

- [ ] **Step 6: Release the subscription in `dispose()`**

Alongside the existing listener teardown in `dispose()`:

```javascript
        this.#unsubscribeSettled?.();
        this.#unsubscribeSettled = null;
```

- [ ] **Step 7: Run the selection suite and the scope suites**

Run: `yarn test CalendarControlsSelectionChange CalendarControlsScope CalendarViewerScope`
Expected: PASS, same counts, no edits to those files. The scope suites are what prove Step 5 kept
`#applyScopeVisibility()` synchronous.

- [ ] **Step 8: Format and commit**

```bash
yarn format:js:fix
git add src/MetaComponents/CalendarControls.js
git commit -m "CalendarControls subscribes to onSettled instead of coalescing (#55)"
```

---

### Task 5: Record why `ApiClient` keeps its coalescer, and document the signal

**Files:**

- Modify: `src/ApiClient/ApiClient.js` — the `#scheduleRefetch()` doc comment only, no code
- Modify: `docs/api-options.md`
- Modify: `CHANGELOG.md` — the `[Unreleased]` section
- Test: none new; the full suite is the check

**Interfaces:**

- Consumes: everything from Tasks 1–4.
- Produces: no code changes at all. This task is documentation.

- [ ] **Step 1: Add the distinction to `ApiClient.#scheduleRefetch()`'s doc comment**

Append this paragraph to the existing comment, before the `@returns` tag:

```javascript
     * This is deliberately NOT replaced by `ApiOptions.onSettled()` (issue #55), and
     * the two are not duplicates despite sharing five lines of idiom. `listenTo()`
     * accepts a `CalendarSelect` or `RiteSelect` with no `ApiOptions` mounted at all,
     * and a rite change on such a page still produces two events — the select's own,
     * plus the one `CalendarSelect.#applyLinkedRite()` dispatches when it writes `''`
     * — with no `ApiOptions` in the picture to describe that batch. `ApiOptions`
     * coalesces because it CAUSES a cascade; this class coalesces because it
     * MULTIPLEXES several independent sources. Removing this would reintroduce #50 on
     * every page that wires selects without an options form.
```

- [ ] **Step 2: Document `onSettled()` in `docs/api-options.md`**

Add a section, matching the file's existing heading depth:

````markdown
### `onSettled( callback )`

Fires once after the form has settled, on a microtask, and returns a function that removes the registration.

```javascript
const unsubscribe = apiOptions.onSettled(() => {
    console.log(apiOptions.localeInput.value());
});

unsubscribe();
```

One user action moves several inputs at once — a rite change rewrites the calendar list, the locale options,
the year floor and the calendar path, dispatching a synthetic `change` on each. Listening to those inputs
individually means acting on a half-updated form. `onSettled()` fires once, after all of them.

It does **not** fire on subscribe, matching `CalendarControls.onSelectionChange()`. The callback takes no
argument: read what you need from the input accessors when it fires.

Every per-input `change` event still fires exactly as before, so listening to individual inputs continues to
work unchanged.
````

- [ ] **Step 3: Add the CHANGELOG entry**

Under `## [Unreleased]`, in an `### Added` section:

```markdown
- **`ApiOptions.onSettled( callback )`**, closing #55 — one signal per settled batch, so a consumer no longer
  has to infer "the cascade has finished" from listener attachment order. Returns an unsubscribe function
  rather than `this`, because `ApiOptions` has no `dispose()` to release a subscription. `SubscriptionUrl`
  and `CalendarControls` dropped their own microtask coalescers in favour of it.

  `ApiClient.#scheduleRefetch()` deliberately stays: `listenTo()` accepts selects with no `ApiOptions`
  mounted, so it coalesces because it multiplexes independent sources, not because it causes a cascade.

  **Additive**: every per-input `change` dispatch fires exactly as before, and `PathBuilder`'s per-input
  listeners are untouched.
```

- [ ] **Step 4: Run the full verification set**

Run: `yarn compile && yarn test && yarn lint:dts && yarn lint:md && yarn format:md && yarn format:js`
Expected: all clean. The suite total should be the pre-change total plus the 13 new tests from Tasks 1–2 — 8 from
Task 1, and 5 from Task 2 (three linked-select, two cascade-origin). Corrected after the fact: this
line said 11, which was right before Task 2 gained its Step 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ApiClient/ApiClient.js docs/api-options.md CHANGELOG.md
git commit -m "Document onSettled, and why ApiClient keeps its own coalescer (#55)"
```
