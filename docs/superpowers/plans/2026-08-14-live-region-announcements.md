# Live-region announcements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended)
> or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax
> for tracking.

**Goal:** Give `WebCalendar` and `LiturgyOfAnyDay` a visually-hidden polite live region that announces a short,
localized summary whenever they replace their content, so a screen-reader user driving them from a `<select>`
is no longer met with silence.

**Architecture:** Two new internal modules — `src/MessageFormat.js` (placeholder interpolation and plural
selection over `Messages.js`) and `src/LiveAnnouncer.js` (the hidden `role="status"` region and its mounting
rules) — plus an `announceUpdates` boolean (default `true`) on each of the two renderers. Neither new module is
exported from `src/index.js`, matching `LocaleValidation.js` / `WrapperOptions.js` / `Theme.js`.

**Tech Stack:** ES2022 JavaScript, JSDoc types compiled by `tsc` (`checkJs` off), Jest 30 with the `jsdom`
environment, prettier (`tabWidth: 4`, `singleQuote: true`).

**Spec:** `docs/superpowers/specs/2026-08-14-live-region-announcements-design.md`

## Global Constraints

- Work only in the worktree at `.claude/worktrees/issue-65`, branch `feat/live-region-announcements`.
- `src/Messages.js` changes must be **additions only** — issue #69 is editing the `ApiOptions` input classes'
  reads of the same file in parallel.
- Do **not** touch `src/MetaComponents/Theme.js`, the meta-components' theme validation, or
  `src/__fixtures__/metadata.js` — issues #70 and #78 own those.
- New message keys go into exactly the twelve locale blocks that already carry `SELECT_A_RITE`:
  `de en es fr hu id it la nl pt sk vi`. Every other locale reaches English through the
  `Messages[ language ]?.[ KEY ] ?? Messages[ 'en' ][ KEY ]` fallback.
- Prettier owns formatting: run `yarn format:js:fix` before every commit.
- Gates that must pass at the end: `yarn test`, `yarn compile && yarn lint:dts`, `yarn format:js`,
  `yarn format:md`, `yarn lint:md`. Baseline on `main` is 72 suites / 1350 tests.
- Never use `git commit --no-verify`. Commits are signed: `git commit -S`.
- Every commit message ends with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

## File Structure

| File                                                                                           | Responsibility                                                                           |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/MessageFormat.js` (new)                                                                   | Resolve a `Messages` key with English fallback, interpolate `{name}`, pick a plural form |
| `src/LiveAnnouncer.js` (new)                                                                   | The hidden `role="status"` region: build, mount once, set text, clear, remove            |
| `src/Messages.js` (modify)                                                                     | Three new keys in twelve locale blocks                                                   |
| `src/SubscriptionBuilder/SubscriptionUrl.js` (modify)                                          | Use `LiveAnnouncer` instead of its own inlined hidden span                               |
| `src/WebCalendar/WebCalendar.js` (modify)                                                      | `#captionText()` extraction, `announceUpdates()`, region-preserving swap                 |
| `src/LiturgyOfAnyDay/LiturgyOfAnyDay.js` (modify)                                              | `announceUpdates()`, region in `#domElement`, `#refetchPending` suppression              |
| `src/__tests__/MessageFormat.test.js` (new)                                                    | Interpolation, fallback and plural selection                                             |
| `src/__tests__/LiveAnnouncer.test.js` (new)                                                    | Region markup, mount-once, text, clear, dispose                                          |
| `src/__tests__/WebCalendarAnnouncements.test.js` (new)                                         | `WebCalendar`'s region: markup, skip-first, summary, survival, opt-out                   |
| `src/__tests__/LiturgyOfAnyDayAnnouncements.test.js` (new)                                     | `LiturgyOfAnyDay`'s region and its refetch suppression                                   |
| `src/__tests__/AnnouncementFrequency.test.js` (new)                                            | One user action -> exactly one announcement, through real `change` events                |
| `src/__tests__/Messages.test.js` (modify)                                                      | The twelve blocks carry the three new keys                                               |
| `docs/web-calendar.md`, `docs/liturgy-components.md`, `README.md`, `CLAUDE.md`, `CHANGELOG.md` | Documentation                                                                            |

---

### Task 1: `MessageFormat.js`

**Files:**

- Create: `src/MessageFormat.js`
- Test: `src/__tests__/MessageFormat.test.js`

**Interfaces:**

- Consumes: `src/Messages.js`'s default export (an object keyed by language subtag).
- Produces:
  - `interpolate( template: string, replacements: Object ): string`
  - `formatMessage( key: string, language: string, replacements?: Object ): string`
  - `formatPluralMessage( baseKey: string, language: string, count: number, replacements?: Object ): string`
    (all named exports, no default export)

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/MessageFormat.test.js`:

```javascript
import { describe, it, expect } from '@jest/globals';
import {
    interpolate,
    formatMessage,
    formatPluralMessage,
} from '../MessageFormat.js';

describe('interpolate', () => {
    it('replaces every named placeholder', () => {
        expect(
            interpolate('{a} and {b}', { a: 'first', b: 'second' }),
        ).toBe('first and second');
    });

    it('stringifies a non-string replacement', () => {
        expect(interpolate('{year}', { year: 2026 })).toBe('2026');
    });

    it('leaves a placeholder with no replacement intact', () => {
        // The inlined caption sites in WebCalendar.js emit the string
        // 'undefined' here. Leaving the placeholder is strictly more
        // debuggable and reaches no existing call site.
        expect(interpolate('{a} {b}', { a: 'x' })).toBe('x {b}');
    });
});

describe('formatMessage', () => {
    it('resolves a key in the requested language', () => {
        expect(formatMessage('SELECT_A_RITE', 'it')).toBe('Seleziona un rito');
    });

    it('falls back to English for a language block that lacks the key', () => {
        // Polish carries the older messages but not the rite ones.
        expect(formatMessage('SELECT_A_RITE', 'pl')).toBe('Select a rite');
    });

    it('falls back to English for a language with no block at all', () => {
        expect(formatMessage('SELECT_A_RITE', 'zz')).toBe('Select a rite');
    });

    it('interpolates the resolved template', () => {
        expect(
            formatMessage('AMBROSIAN_CALENDAR_CAPTION', 'en', { year: 2026 }),
        ).toBe('Ambrosian Calendar - 2026');
    });
});

describe('formatPluralMessage', () => {
    it('picks the ONE form for a count of one', () => {
        expect(
            formatPluralMessage('CALENDAR_UPDATED_ANNOUNCEMENT', 'en', 1, {
                calendar: 'General Roman Calendar - 2026',
                count: '1',
            }),
        ).toBe('General Roman Calendar - 2026, 1 entry');
    });

    it('picks the OTHER form for a larger count', () => {
        expect(
            formatPluralMessage('CALENDAR_UPDATED_ANNOUNCEMENT', 'en', 561, {
                calendar: 'General Roman Calendar - 2026',
                count: '561',
            }),
        ).toBe('General Roman Calendar - 2026, 561 entries');
    });

    it('takes the language OTHER form when its plural category has no key', () => {
        // Slovak selects `few` for 3. Only _ONE and _OTHER are populated, so
        // this must land on Slovak's _OTHER rather than on English.
        expect(
            formatPluralMessage('CALENDAR_UPDATED_ANNOUNCEMENT', 'sk', 3, {
                calendar: 'X',
                count: '3',
            }),
        ).toBe('X, 3 záznamov');
    });

    it('falls back to English for a language with no block at all', () => {
        expect(
            formatPluralMessage('CALENDAR_UPDATED_ANNOUNCEMENT', 'zz', 5, {
                calendar: 'X',
                count: '5',
            }),
        ).toBe('X, 5 entries');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/MessageFormat.test.js`
Expected: FAIL — `Cannot find module '../MessageFormat.js'`.

- [ ] **Step 3: Write the implementation**

Create `src/MessageFormat.js`:

```javascript
import Messages from './Messages.js';

/**
 * Placeholder interpolation for `Messages` templates.
 *
 * The `{name}` syntax and this regex are not new: `Messages.js` has carried
 * `AMBROSIAN_CALENDAR_CAPTION: 'Ambrosian Calendar - {year}'` (and the diocesan
 * and national captions before it) since long before this module, interpolated
 * inline at three sites in `WebCalendar.js`. This lifts that convention into one
 * place rather than inventing a second one; the three caption sites still inline
 * it, and converting them is a refactor for its own change.
 *
 * @param {string} template - The message template.
 * @param {Object<string, unknown>} replacements - Values by placeholder name.
 * @returns {string} The interpolated string.
 */
export function interpolate(template, replacements) {
    return template.replace(/{(.*?)}/g, (match, name) =>
        Object.hasOwn(replacements, name) ? String(replacements[name]) : match,
    );
}

/**
 * Resolves a message key for a language and interpolates it.
 *
 * Applies the same `Messages[ language ]?.[ KEY ] ?? Messages[ 'en' ][ KEY ]`
 * fallback every call site in this library already writes by hand, so a language
 * whose block is unpopulated for this key — or absent entirely — degrades to
 * English rather than throwing.
 *
 * @param {string} key - The `Messages` key.
 * @param {string} language - A language subtag, e.g. `'it'`.
 * @param {Object<string, unknown>} [replacements] - Values by placeholder name.
 * @returns {string} The resolved, interpolated message.
 */
export function formatMessage(key, language, replacements = {}) {
    const template = Messages[language]?.[key] ?? Messages['en'][key];
    return interpolate(template, replacements);
}

/**
 * Resolves a count-dependent message and interpolates it.
 *
 * The key is the base key with the `Intl.PluralRules` category appended in
 * upper case, so `one` reads `<BASE>_ONE`. Only `_ONE` and `_OTHER` are
 * populated, so a language whose rules select `few` or `many` — Slovak at 2–4,
 * for instance — takes its OWN `_OTHER` before English is considered. Each
 * `_OTHER` translation is therefore written in the form its language uses with a
 * large count, which is the only count a full liturgical year produces.
 *
 * @param {string} baseKey - The key without its plural suffix.
 * @param {string} language - A language subtag, e.g. `'sk'`.
 * @param {number} count - The count the plural form is selected for.
 * @param {Object<string, unknown>} [replacements] - Values by placeholder name.
 * @returns {string} The resolved, interpolated message.
 */
export function formatPluralMessage(
    baseKey,
    language,
    count,
    replacements = {},
) {
    const category = new Intl.PluralRules(language).select(count);
    const key = `${baseKey}_${category.toUpperCase()}`;
    const otherKey = `${baseKey}_OTHER`;
    const template =
        Messages[language]?.[key] ??
        Messages[language]?.[otherKey] ??
        Messages['en'][key] ??
        Messages['en'][otherKey];
    return interpolate(template, replacements);
}
```

- [ ] **Step 4: Run the test**

Run: `yarn test src/__tests__/MessageFormat.test.js`
Expected: the three `formatPluralMessage` cases still FAIL — the keys do not exist yet. Everything else PASSES.
Leave them failing; Task 2 adds the keys.

- [ ] **Step 5: Do not commit yet**

Task 2 finishes this suite.

---

### Task 2: The three message keys, in twelve locales

**Files:**

- Modify: `src/Messages.js` (twelve blocks, additions only)
- Test: `src/__tests__/Messages.test.js` (append a `describe` block)

**Interfaces:**

- Consumes: nothing.
- Produces: `CALENDAR_UPDATED_ANNOUNCEMENT_ONE`, `CALENDAR_UPDATED_ANNOUNCEMENT_OTHER` and
  `LITURGY_UPDATED_ANNOUNCEMENT` in the twelve blocks. `{calendar}`, `{count}` and `{date}` are the
  placeholder names.

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/Messages.test.js`:

```javascript
describe('live-region announcement keys', () => {
    // The same twelve locales that carry SELECT_A_RITE, per the project's
    // established coverage rule. Every other locale reaches English through the
    // `??` fallback in MessageFormat.js.
    const TRANSLATED_ANNOUNCEMENTS = [
        'de',
        'en',
        'es',
        'fr',
        'hu',
        'id',
        'it',
        'la',
        'nl',
        'pt',
        'sk',
        'vi',
    ];

    it.each(TRANSLATED_ANNOUNCEMENTS)(
        'defines both calendar plural forms for %s, each naming {calendar} and {count}',
        (lang) => {
            ['ONE', 'OTHER'].forEach((category) => {
                const message =
                    Messages[lang][`CALENDAR_UPDATED_ANNOUNCEMENT_${category}`];
                expect(typeof message).toBe('string');
                expect(message).toContain('{calendar}');
                expect(message).toContain('{count}');
            });
        },
    );

    it.each(TRANSLATED_ANNOUNCEMENTS)(
        'defines LITURGY_UPDATED_ANNOUNCEMENT for %s, naming {date}',
        (lang) => {
            const message = Messages[lang].LITURGY_UPDATED_ANNOUNCEMENT;
            expect(typeof message).toBe('string');
            expect(message).toContain('{date}');
        },
    );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/Messages.test.js`
Expected: FAIL — 24 cases, `expect(typeof undefined).toBe('string')`.

- [ ] **Step 3: Add the keys**

In each of the twelve blocks, insert the three keys immediately after that block's
`AMBROSIAN_CALENDAR_CAPTION` line (which is the last key in each of the twelve). The
`AMBROSIAN_CALENDAR_CAPTION` value differs per locale, so it is a unique anchor for an `Edit`.

```javascript
// de — after 'Ambrosianischer Kalender - {year}',
        CALENDAR_UPDATED_ANNOUNCEMENT_ONE: '{calendar}, {count} Eintrag',
        CALENDAR_UPDATED_ANNOUNCEMENT_OTHER: '{calendar}, {count} Einträge',
        LITURGY_UPDATED_ANNOUNCEMENT: 'Liturgie für {date} aktualisiert',

// en — after 'Ambrosian Calendar - {year}',
        CALENDAR_UPDATED_ANNOUNCEMENT_ONE: '{calendar}, {count} entry',
        CALENDAR_UPDATED_ANNOUNCEMENT_OTHER: '{calendar}, {count} entries',
        LITURGY_UPDATED_ANNOUNCEMENT: 'Liturgy for {date} updated',

// es — after 'Calendario ambrosiano - {year}',
        CALENDAR_UPDATED_ANNOUNCEMENT_ONE: '{calendar}, {count} entrada',
        CALENDAR_UPDATED_ANNOUNCEMENT_OTHER: '{calendar}, {count} entradas',
        LITURGY_UPDATED_ANNOUNCEMENT: 'Liturgia del {date} actualizada',

// fr — after 'Calendrier ambrosien - {year}',
        CALENDAR_UPDATED_ANNOUNCEMENT_ONE: '{calendar}, {count} entrée',
        CALENDAR_UPDATED_ANNOUNCEMENT_OTHER: '{calendar}, {count} entrées',
        LITURGY_UPDATED_ANNOUNCEMENT: 'Liturgie du {date} mise à jour',

// hu — after 'Ambrozián naptár - {year}',
// Hungarian takes a singular noun after a numeral, so both forms are identical.
        CALENDAR_UPDATED_ANNOUNCEMENT_ONE: '{calendar}, {count} bejegyzés',
        CALENDAR_UPDATED_ANNOUNCEMENT_OTHER: '{calendar}, {count} bejegyzés',
        LITURGY_UPDATED_ANNOUNCEMENT: '{date} liturgiája frissítve',

// id — after 'Kalender Ambrosian - {year}',
// Indonesian does not inflect for number.
        CALENDAR_UPDATED_ANNOUNCEMENT_ONE: '{calendar}, {count} entri',
        CALENDAR_UPDATED_ANNOUNCEMENT_OTHER: '{calendar}, {count} entri',
        LITURGY_UPDATED_ANNOUNCEMENT: 'Liturgi untuk {date} diperbarui',

// it — after 'Calendario Ambrosiano - {year}',
        CALENDAR_UPDATED_ANNOUNCEMENT_ONE: '{calendar}, {count} voce',
        CALENDAR_UPDATED_ANNOUNCEMENT_OTHER: '{calendar}, {count} voci',
        LITURGY_UPDATED_ANNOUNCEMENT: 'Liturgia del {date} aggiornata',

// la — after 'Calendarium Ambrosianum - {year}',
        CALENDAR_UPDATED_ANNOUNCEMENT_ONE: '{calendar}, {count} celebratio',
        CALENDAR_UPDATED_ANNOUNCEMENT_OTHER: '{calendar}, {count} celebrationes',
        LITURGY_UPDATED_ANNOUNCEMENT: 'Liturgia diei {date} renovata',

// nl — after 'Ambrosiaanse kalender - {year}',
        CALENDAR_UPDATED_ANNOUNCEMENT_ONE: '{calendar}, {count} item',
        CALENDAR_UPDATED_ANNOUNCEMENT_OTHER: '{calendar}, {count} items',
        LITURGY_UPDATED_ANNOUNCEMENT: 'Liturgie voor {date} bijgewerkt',

// pt — after 'Calendário ambrosiano - {year}',
        CALENDAR_UPDATED_ANNOUNCEMENT_ONE: '{calendar}, {count} entrada',
        CALENDAR_UPDATED_ANNOUNCEMENT_OTHER: '{calendar}, {count} entradas',
        LITURGY_UPDATED_ANNOUNCEMENT: 'Liturgia de {date} atualizada',

// sk — after 'Ambroziánsky kalendár - {year}',
// _OTHER carries the genitive plural Slovak uses from five upwards, which is
// also what `few` (2–4) falls back to. See MessageFormat.formatPluralMessage().
        CALENDAR_UPDATED_ANNOUNCEMENT_ONE: '{calendar}, {count} záznam',
        CALENDAR_UPDATED_ANNOUNCEMENT_OTHER: '{calendar}, {count} záznamov',
        LITURGY_UPDATED_ANNOUNCEMENT: 'Liturgia na {date} aktualizovaná',

// vi — after 'Lịch Ambrôsiô - {year}',
// Vietnamese does not inflect for number.
        CALENDAR_UPDATED_ANNOUNCEMENT_ONE: '{calendar}, {count} mục',
        CALENDAR_UPDATED_ANNOUNCEMENT_OTHER: '{calendar}, {count} mục',
        LITURGY_UPDATED_ANNOUNCEMENT: 'Phụng vụ ngày {date} đã được cập nhật',
```

- [ ] **Step 4: Run both suites**

Run: `yarn test src/__tests__/Messages.test.js src/__tests__/MessageFormat.test.js`
Expected: PASS, including the three `formatPluralMessage` cases left failing in Task 1.

- [ ] **Step 5: Format and commit**

```bash
yarn format:js:fix
git add src/MessageFormat.js src/Messages.js src/__tests__/MessageFormat.test.js src/__tests__/Messages.test.js
git commit -S -m "$(cat <<'EOF'
Add MessageFormat.js and the announcement message keys (#65)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `LiveAnnouncer.js`

**Files:**

- Create: `src/LiveAnnouncer.js`
- Test: `src/__tests__/LiveAnnouncer.test.js`

**Interfaces:**

- Consumes: nothing.
- Produces: a default-exported class with
  - `get element(): HTMLSpanElement`
  - `mountInto( parent: HTMLElement ): void` — appends only if not already a child of `parent`
  - `announce( text: string ): void`
  - `clear(): void`
  - `dispose(): void` — removes the element from the DOM and clears its text

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/LiveAnnouncer.test.js`:

```javascript
/** @jest-environment jsdom */
import { describe, it, expect } from '@jest/globals';
import LiveAnnouncer from '../LiveAnnouncer.js';

describe('LiveAnnouncer', () => {
    it('builds a polite, atomic status region', () => {
        const { element } = new LiveAnnouncer();
        expect(element.tagName).toBe('SPAN');
        expect(element.getAttribute('role')).toBe('status');
        expect(element.getAttribute('aria-live')).toBe('polite');
        expect(element.getAttribute('aria-atomic')).toBe('true');
    });

    it('hides the region the way SubscriptionUrl already does', () => {
        const { element } = new LiveAnnouncer();
        expect(element.style.position).toBe('absolute');
        expect(element.style.width).toBe('1px');
        expect(element.style.height).toBe('1px');
        expect(element.style.overflow).toBe('hidden');
        expect(element.style.clip).toBe('rect(0 0 0 0)');
    });

    it('starts empty', () => {
        expect(new LiveAnnouncer().element.textContent).toBe('');
    });

    it('mounts once, and never re-inserts the same node', () => {
        // Re-inserting a live region is what stops it being announced, so this
        // is the property the whole class exists to hold.
        const announcer = new LiveAnnouncer();
        const parent = document.createElement('div');
        announcer.mountInto(parent);
        announcer.mountInto(parent);
        expect(parent.childNodes).toHaveLength(1);
        expect(parent.firstChild).toBe(announcer.element);
    });

    it('moves to a new parent when asked', () => {
        const announcer = new LiveAnnouncer();
        const first = document.createElement('div');
        const second = document.createElement('div');
        announcer.mountInto(first);
        announcer.mountInto(second);
        expect(first.childNodes).toHaveLength(0);
        expect(second.firstChild).toBe(announcer.element);
    });

    it('writes and clears the announcement text', () => {
        const announcer = new LiveAnnouncer();
        announcer.announce('Calendar updated');
        expect(announcer.element.textContent).toBe('Calendar updated');
        announcer.clear();
        expect(announcer.element.textContent).toBe('');
    });

    it('detaches and empties on dispose', () => {
        const announcer = new LiveAnnouncer();
        const parent = document.createElement('div');
        announcer.mountInto(parent);
        announcer.announce('Calendar updated');
        announcer.dispose();
        expect(parent.childNodes).toHaveLength(0);
        expect(announcer.element.textContent).toBe('');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/LiveAnnouncer.test.js`
Expected: FAIL — `Cannot find module '../LiveAnnouncer.js'`.

- [ ] **Step 3: Write the implementation**

Create `src/LiveAnnouncer.js`:

```javascript
/**
 * A visually-hidden ARIA live region, and nothing else.
 *
 * The markup and the hiding technique are `SubscriptionUrl`'s, which introduced
 * both in 2.7.0; this class is where they now live so that there is one
 * implementation rather than one per component. `role="status"` and
 * `aria-atomic="true"` are additions: the role names the region for assistive
 * technology that keys off roles rather than off `aria-live`, and atomic makes a
 * short summary be read whole instead of only its changed part.
 *
 * It holds NO policy about when to announce. "The first render" is a concept
 * only a renderer has, and `SubscriptionUrl` — which must announce on its first
 * use and self-clear on a timer — would have to opt out of any such policy. The
 * callers own the when; this owns the what.
 *
 * Internal. Deliberately not exported from `src/index.js`, on the same reasoning
 * as `LocaleValidation.js` and `WrapperOptions.js`.
 */
export default class LiveAnnouncer {
    /** @type {HTMLSpanElement} */
    #element;

    constructor() {
        this.#element = document.createElement('span');
        this.#element.setAttribute('role', 'status');
        this.#element.setAttribute('aria-live', 'polite');
        this.#element.setAttribute('aria-atomic', 'true');
        this.#element.style.position = 'absolute';
        this.#element.style.width = '1px';
        this.#element.style.height = '1px';
        this.#element.style.overflow = 'hidden';
        this.#element.style.clip = 'rect(0 0 0 0)';
    }

    /**
     * The region element, for a caller that has to mount it itself.
     *
     * @type {HTMLSpanElement}
     */
    get element() {
        return this.#element;
    }

    /**
     * Mounts the region as the last child of `parent`, at most once.
     *
     * The idempotence is the point, not an optimization: a live region that is
     * removed and re-inserted is not reliably announced, because assistive
     * technology needs it present BEFORE its content changes. Callers that swap
     * sibling content on every render must therefore leave this node alone.
     *
     * @param {HTMLElement} parent - The element to mount into.
     * @returns {void}
     */
    mountInto(parent) {
        if (this.#element.parentNode !== parent) {
            parent.appendChild(this.#element);
        }
    }

    /**
     * Writes the text to be announced.
     *
     * @param {string} text - The announcement.
     * @returns {void}
     */
    announce(text) {
        this.#element.textContent = text;
    }

    /**
     * Empties the region without unmounting it.
     *
     * @returns {void}
     */
    clear() {
        this.#element.textContent = '';
    }

    /**
     * Empties the region and detaches it.
     *
     * @returns {void}
     */
    dispose() {
        this.clear();
        this.#element.remove();
    }
}
```

- [ ] **Step 4: Run the test**

Run: `yarn test src/__tests__/LiveAnnouncer.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Format and commit**

```bash
yarn format:js:fix
git add src/LiveAnnouncer.js src/__tests__/LiveAnnouncer.test.js
git commit -S -m "$(cat <<'EOF'
Extract the hidden live region into LiveAnnouncer (#65)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Convert `SubscriptionUrl` to `LiveAnnouncer`

**Files:**

- Modify: `src/SubscriptionBuilder/SubscriptionUrl.js` (field at :68, construction at :185-193, writes at
  :315 and :321, mount at :373)
- Test: `src/__tests__/SubscriptionUrl.test.js` (existing; extend)

**Interfaces:**

- Consumes: `LiveAnnouncer` from Task 3.
- Produces: no public API change. `SubscriptionUrl`'s region keeps announcing on the first copy and clearing
  after two seconds.

- [ ] **Step 1: Write the failing test**

Append to the existing `describe` in `src/__tests__/SubscriptionUrl.test.js` that already queries
`[aria-live="polite"]` (near line 410). Match the surrounding suite's own setup helpers:

```javascript
    it('marks the copy region as an atomic status region', async () => {
        // Added when the hidden-region markup moved into LiveAnnouncer, shared
        // with WebCalendar and LiturgyOfAnyDay.
        await mount();
        const live = document.querySelector('[aria-live="polite"]');
        expect(live.getAttribute('role')).toBe('status');
        expect(live.getAttribute('aria-atomic')).toBe('true');
    });
```

Read the file first and reuse whatever mounting helper the neighbouring tests use — do not invent `mount()` if
the suite spells it differently.

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/SubscriptionUrl.test.js`
Expected: FAIL — `expect(null).toBe('status')`.

- [ ] **Step 3: Convert the implementation**

In `src/SubscriptionBuilder/SubscriptionUrl.js`:

- **1.** Add `import LiveAnnouncer from '../LiveAnnouncer.js';` alongside the existing imports.
- **2.** Replace the `#liveRegion` field declaration with:

```javascript
    /**
     * The hidden region the copy outcome is announced through.
     *
     * @type {LiveAnnouncer}
     */
    #announcer;
```

- **3.** Replace the nine construction lines (`this.#liveRegion = document.createElement('span');` down to
  `this.#liveRegion.style.clip = 'rect(0 0 0 0)';`) with:

```javascript
        // Announced but not shown: the visible confirmation is the copied class,
        // which the consumer themes. `LiveAnnouncer` owns the markup and the
        // hiding technique, which this component introduced and now shares with
        // WebCalendar and LiturgyOfAnyDay.
        this.#announcer = new LiveAnnouncer();
```

Keep the comment that follows about the region being a SIBLING of the button.

- **4.** Line 315 becomes `this.#announcer.announce(this.#copiedText);`
- **5.** Line 321 becomes `this.#announcer.clear();`
- **6.** Line 373 becomes `target.replaceChildren(this.#domElement, this.#announcer.element);`
- **7.** Update the doc comment at line 365 to say `#announcer` instead of `#liveRegion`.

- [ ] **Step 4: Run the whole SubscriptionUrl and SubscriptionBuilder suites**

Run: `yarn test src/__tests__/SubscriptionUrl.test.js src/__tests__/SubscriptionBuilder.test.js`
Expected: PASS, with no change to any pre-existing assertion.

- [ ] **Step 5: Format and commit**

```bash
yarn format:js:fix
git add src/SubscriptionBuilder/SubscriptionUrl.js src/__tests__/SubscriptionUrl.test.js
git commit -S -m "$(cat <<'EOF'
Move SubscriptionUrl onto the shared LiveAnnouncer (#65)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `WebCalendar` announces

**Files:**

- Modify: `src/WebCalendar/WebCalendar.js` (caption block at :1473-1536, `calendarFetched` handler at
  :1837-1849, `dispose()` at :1872-1875, constructor at :299-352)
- Test: `src/__tests__/WebCalendarAnnouncements.test.js` (new)

**Interfaces:**

- Consumes: `LiveAnnouncer` (Task 3), `formatPluralMessage` (Task 1),
  `CALENDAR_UPDATED_ANNOUNCEMENT_*` (Task 2).
- Produces:
  - `WebCalendar.prototype.announceUpdates( enabled: boolean ): WebCalendar` (chainable)
  - a constructor option `announceUpdates: boolean`, default `true`
  - `WebCalendar.prototype._liveRegion: HTMLSpanElement | null` (getter, underscore-prefixed like the
    file's other test accessors) — `null` when announcements are disabled

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/WebCalendarAnnouncements.test.js`. Copy the `calendarData()` fixture and the
`beforeEach` from `src/__tests__/WebCalendarRiteCaption.test.js` verbatim, then:

```javascript
/** @jest-environment jsdom */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiClient from '../ApiClient/ApiClient.js';
import ApiBase from '../ApiClient/ApiBase.js';
import WebCalendar from '../WebCalendar/WebCalendar.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

/** One event, shaped like a real `/calendar` entry. See WebCalendarRiteCaption. */
const event = (overrides = {}) => ({
    event_key: 'Advent1',
    event_idx: 1,
    name: 'Dominica I in Adventu Domini',
    color: ['morello'],
    color_lcl: ['violaceus'],
    grade: 7,
    grade_lcl: 'sollemnitas',
    grade_abbr: 'S',
    grade_display: '',
    common: [],
    common_lcl: '',
    type: 'mobile',
    date: '2026-11-15T00:00:00+00:00',
    year: 2026,
    month: 11,
    month_short: 'Nov.',
    month_long: 'November',
    day: 15,
    day_of_the_week_iso8601: 7,
    day_of_the_week_short: 'Sun',
    day_of_the_week_long: 'Sunday',
    liturgical_year: 'A',
    is_vigil_mass: false,
    psalter_week: 1,
    liturgical_season: 'ADVENT',
    liturgical_season_lcl: 'Advent',
    holy_day_of_obligation: false,
    ...overrides,
});

const calendarData = (settings = {}, count = 1) => ({
    litcal: Array.from({ length: count }, (unused, index) =>
        event({ event_idx: index + 1, day: 15 + index }),
    ),
    settings: { year: 2026, locale: 'en', year_type: 'LITURGICAL', ...settings },
    metadata: { version: 'test' },
    messages: [],
});

let apiClient;

beforeEach(async () => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    apiClient = await ApiClient.init(API_URL);
});

/** Pushes one payload through the same path a real fetch takes. */
const render = async (data) => {
    apiClient._eventBus.emit('calendarFetched', data);
    await new Promise((resolve) => setTimeout(resolve, 0));
};

/** A mounted, listening calendar and its container. */
const mounted = (options = {}) => {
    const webCalendar = new WebCalendar(options);
    const container = document.createElement('div');
    document.body.appendChild(container);
    webCalendar.appendTo(container);
    webCalendar.listenTo(apiClient);
    return { webCalendar, container };
};

describe('WebCalendar live region', () => {
    it('mounts a polite, atomic status region as the last child', async () => {
        const { container } = mounted();
        await render(calendarData());
        const region = container.querySelector('[role="status"]');
        expect(region).not.toBeNull();
        expect(region.getAttribute('aria-live')).toBe('polite');
        expect(region.getAttribute('aria-atomic')).toBe('true');
        expect(container.lastElementChild).toBe(region);
        expect(container.firstElementChild.tagName).toBe('TABLE');
    });

    it('says nothing on the first render', async () => {
        // A live region that fires during page load talks over whatever else is
        // being announced, and the user did not act.
        const { container } = mounted();
        await render(calendarData());
        expect(container.querySelector('[role="status"]').textContent).toBe('');
    });

    it('announces the calendar and its entry count on a later render', async () => {
        const { container } = mounted();
        await render(calendarData());
        await render(calendarData({}, 3));
        expect(container.querySelector('[role="status"]').textContent).toBe(
            'General Roman Calendar - 2026, 3 entries',
        );
    });

    it('uses the singular form for a single entry', async () => {
        const { container } = mounted();
        await render(calendarData());
        await render(calendarData({ year: 2027 }));
        expect(container.querySelector('[role="status"]').textContent).toBe(
            'General Roman Calendar - 2027, 1 entry',
        );
    });

    it('announces in the payload locale', async () => {
        const { container } = mounted();
        await render(calendarData());
        await render(calendarData({ locale: 'it' }, 2));
        expect(container.querySelector('[role="status"]').textContent).toBe(
            'Calendario romano generale - 2026, 2 voci',
        );
    });

    it('announces even when the caption element is removed', async () => {
        // The announcement is not the caption; it only reuses its text.
        const { container } = mounted({ removeCaption: true });
        await render(calendarData());
        await render(calendarData({}, 2));
        expect(container.querySelector('caption')).toBeNull();
        expect(container.querySelector('[role="status"]').textContent).toBe(
            'General Roman Calendar - 2026, 2 entries',
        );
    });

    it('keeps the very same region node across the table swap', async () => {
        // Re-inserting the region is what stops it being announced.
        const { container } = mounted();
        await render(calendarData());
        const first = container.querySelector('[role="status"]');
        await render(calendarData({}, 2));
        expect(container.querySelector('[role="status"]')).toBe(first);
    });

    it('still clears whatever the consumer left in the container', async () => {
        const { container } = mounted();
        container.appendChild(document.createElement('p'));
        await render(calendarData());
        expect(container.querySelector('p')).toBeNull();
    });

    it('mounts no region when announcements are turned off', async () => {
        const { container } = mounted({ announceUpdates: false });
        await render(calendarData());
        await render(calendarData({}, 2));
        expect(container.querySelector('[role="status"]')).toBeNull();
        expect(container.children).toHaveLength(1);
    });

    it('removes a mounted region when turned off later, and is chainable', async () => {
        const { webCalendar, container } = mounted();
        await render(calendarData());
        expect(webCalendar.announceUpdates(false)).toBe(webCalendar);
        expect(container.querySelector('[role="status"]')).toBeNull();
    });

    it('rejects a non-boolean', () => {
        expect(() => new WebCalendar().announceUpdates('yes')).toThrow(
            /WebCalendar/,
        );
    });

    it('removes the region on dispose', async () => {
        const { webCalendar, container } = mounted();
        await render(calendarData());
        webCalendar.dispose();
        expect(container.querySelector('[role="status"]')).toBeNull();
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/WebCalendarAnnouncements.test.js`
Expected: FAIL — no region is ever mounted.

- [ ] **Step 3: Implement**

In `src/WebCalendar/WebCalendar.js`:

- **1.** Add the imports:

```javascript
import LiveAnnouncer from '../LiveAnnouncer.js';
import { formatPluralMessage } from '../MessageFormat.js';
```

- **2.** Add two private fields next to `#attachedElement`:

```javascript
    /**
     * The hidden live region, or `null` when `announceUpdates( false )` was set.
     *
     * @type {LiveAnnouncer|null}
     */
    #announcer = new LiveAnnouncer();

    /**
     * Whether a render has already happened.
     *
     * The FIRST render is deliberately silent: it is the page loading, not a
     * user action, and a live region firing then talks over whatever the page is
     * already announcing. It is also what mounts the region, and a live region
     * has to be in the DOM before its content changes to be announced at all.
     *
     * @type {boolean}
     */
    #hasRendered = false;
```

- **3.** Extract the caption text. Replace the body of the `if (false === this.#removeCaption) { ... }` block's
  text computation with a call, and add the private method. The new method is the existing three-branch
  code moved verbatim, with `captionText` returned rather than assigned:

```javascript
        if (false === this.#removeCaption) {
            const caption = document.createElement('caption');
            caption.appendChild(document.createTextNode(this.#captionText()));
            this.#domElement.appendChild(caption);
        }
```

and, next to the other private methods:

```javascript
    /**
     * The calendar's own name and year, as the `<caption>` states it.
     *
     * Extracted so the live-region announcement can reuse the exact string the
     * caption carries rather than deriving the calendar's name a second time —
     * which would mean a second set of translations free to drift from these.
     * Called even when `removeCaption( true )` suppresses the element, because
     * the announcement is not the caption.
     *
     * @returns {string} The caption text.
     * @private
     */
    #captionText() {
        if (Object.hasOwn(this.#calendarData.settings, 'diocesan_calendar')) {
            const replacements = {
                diocese: this.#calendarData.metadata.diocese_name,
                year: this.#calendarData.settings.year,
            };
            return Messages[this.#baseLocale][
                'DIOCESAN_CALENDAR_CAPTION'
            ].replace(/{(.*?)}/g, (match, p1) => replacements[p1]);
        }
        if (Object.hasOwn(this.#calendarData.settings, 'national_calendar')) {
            const nation = new Intl.DisplayNames([this.#locale], {
                type: 'region',
            }).of(this.#calendarData.settings.national_calendar);
            const replacements = {
                nation: nation,
                year: this.#calendarData.settings.year,
            };
            return Messages[this.#baseLocale][
                'NATIONAL_CALENDAR_CAPTION'
            ].replace(/{(.*?)}/g, (match, p1) => replacements[p1]);
        }
        // The rite-level calendar. Which rite it is cannot be read from the
        // payload — it has neither a national nor a diocesan setting, and the
        // response carries no rite field — so it comes from `#rite`, set by
        // `listenTo()` or `rite()`.
        //
        // The caption key is derived from the rite's own `emptyOptionLabelKey`,
        // so `GENERAL_ROMAN_CALENDAR` gives `GENERAL_ROMAN_CALENDAR_CAPTION` and
        // `AMBROSIAN_CALENDAR` gives `AMBROSIAN_CALENDAR_CAPTION`. Adding a rite
        // then needs only the matching message, no branch here.
        const captionKey = `${RiteProperties[this.#rite].emptyOptionLabelKey}_CAPTION`;
        const replacements = { year: this.#calendarData.settings.year };
        // Rite-specific captions exist only for the twelve maintained locales,
        // following the same policy as the other rite messages, so fall back to
        // English before falling back to the General Roman caption.
        const captionTemplate =
            Messages[this.#baseLocale]?.[captionKey] ??
            Messages['en'][captionKey] ??
            Messages[this.#baseLocale]['GENERAL_ROMAN_CALENDAR_CAPTION'];
        return captionTemplate.replace(
            /{(.*?)}/g,
            (match, p1) => replacements[p1],
        );
    }
```

- **4.** Add the announcement builder and the chainable setter:

```javascript
    /**
     * Turns the live-region announcement on or off.
     *
     * Default `true`. An accessibility fix that is off by default fixes nobody:
     * the consumers who need it are the least likely to know the option exists.
     * Turn it off when the surrounding page already owns a live region for this
     * content, to avoid announcing it twice.
     *
     * @param {boolean} enabled - Whether to announce each replacement.
     * @throws {Error} If `enabled` is not a boolean.
     * @returns {WebCalendar} This instance, for chaining.
     */
    announceUpdates(enabled) {
        if (typeof enabled !== 'boolean') {
            throw new Error(
                'Invalid type for announceUpdates on WebCalendar instance, must be of type boolean but found type: ' +
                    typeof enabled,
            );
        }
        if (false === enabled) {
            this.#announcer?.dispose();
            this.#announcer = null;
        } else if (null === this.#announcer) {
            this.#announcer = new LiveAnnouncer();
        }
        return this;
    }

    /**
     * The live region element, or `null` when announcements are off.
     *
     * @type {HTMLSpanElement|null}
     */
    get _liveRegion() {
        return this.#announcer?.element ?? null;
    }
```

- **5.** In the constructor, after the `latinInterface` block:

```javascript
        if (Object.hasOwn(options, 'announceUpdates')) {
            this.announceUpdates(options.announceUpdates);
        }
```

- **6.** Replace the mount in the `calendarFetched` listener. The existing
  `this.#attachedElement.replaceChildren(this.#domElement);` becomes `this.#swapIn();`, and after the
  `if/else` that logs the two missing-element errors add:

```javascript
            this.#announce();
```

with the two new private methods:

```javascript
    /**
     * Puts the freshly built table into the mount, leaving the live region be.
     *
     * `replaceChildren()` would remove the region along with the old table, and
     * a live region that is removed and re-inserted is not reliably announced —
     * assistive technology needs it present before its content changes. So every
     * child EXCEPT the region goes, the region is mounted if it is not yet, and
     * the table is inserted before it. With announcements off this is exactly
     * the `replaceChildren( table )` it replaces, including clearing whatever
     * placeholder content the consumer left in the target.
     *
     * @returns {void}
     * @private
     */
    #swapIn() {
        const region = this.#announcer?.element ?? null;
        for (const child of Array.from(this.#attachedElement.childNodes)) {
            if (child !== region) {
                child.remove();
            }
        }
        if (null !== this.#announcer) {
            this.#announcer.mountInto(this.#attachedElement);
        }
        // A null reference argument appends, which is what we want when there is
        // no region; otherwise the region stays last.
        this.#attachedElement.insertBefore(this.#domElement, region);
    }

    /**
     * Announces the calendar just rendered, as a summary and never the content.
     *
     * Silent on the first render — see `#hasRendered`. Reads `#calendarData`
     * rather than the DOM, so it is unaffected by `removeCaption()` and by the
     * asynchronous tail of `buildTable()`, which fills the tbody after this runs.
     *
     * @returns {void}
     * @private
     */
    #announce() {
        if (null === this.#announcer) {
            return;
        }
        if (false === this.#hasRendered) {
            this.#hasRendered = true;
            return;
        }
        const count = this.#calendarData.litcal.length;
        this.#announcer.announce(
            formatPluralMessage(
                'CALENDAR_UPDATED_ANNOUNCEMENT',
                this.#baseLocale,
                count,
                {
                    calendar: this.#captionText(),
                    count: new Intl.NumberFormat(this.#locale).format(count),
                },
            ),
        );
    }
```

- **7.** `dispose()` gains one line:

```javascript
    dispose() {
        this.#unsubscribe();
        this.#announcer?.dispose();
        this.#attachedElement = null;
    }
```

- [ ] **Step 4: Run the test, then the two neighbouring suites**

Run: `yarn test src/__tests__/WebCalendarAnnouncements.test.js src/__tests__/WebCalendarRiteCaption.test.js src/__tests__/WebCalendarDispose.test.js`
Expected: PASS. If `mounted()` reports `#hasRendered` never resetting between tests, check that each test
builds a fresh `WebCalendar`.

- [ ] **Step 5: Run the whole suite**

Run: `yarn test`
Expected: PASS. Anything that broke will be a suite asserting on the mount's children — `CalendarViewer*`
is the likely one. Fix by asserting on the table rather than on child counts, and note it in the commit.

- [ ] **Step 6: Format and commit**

```bash
yarn format:js:fix
git add src/WebCalendar/WebCalendar.js src/__tests__/WebCalendarAnnouncements.test.js
git commit -S -m "$(cat <<'EOF'
Announce each WebCalendar table replacement in a live region (#65)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `LiturgyOfAnyDay` announces

**Files:**

- Modify: `src/LiturgyOfAnyDay/LiturgyOfAnyDay.js` (constructor at :153-275, year listener at :207-226,
  `#handleDateChange()` at :316-365, `#renderEvents()` at :371-393, `listenTo()` at :919-966)
- Test: `src/__tests__/LiturgyOfAnyDayAnnouncements.test.js` (new)

**Interfaces:**

- Consumes: `LiveAnnouncer` (Task 3), `formatMessage` (Task 1), `LITURGY_UPDATED_ANNOUNCEMENT` (Task 2).
- Produces:
  - `LiturgyOfAnyDay.prototype.announceUpdates( enabled: boolean ): LiturgyOfAnyDay` (chainable)
  - a constructor option `announceUpdates: boolean`, default `true`
  - `LiturgyOfAnyDay.prototype._liveRegion: HTMLSpanElement | null` (getter)

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/LiturgyOfAnyDayAnnouncements.test.js`. Read
`src/__tests__/LiturgyOfAnyDay.test.js` first and reuse its fixture shape and its `ApiBase` setup.

```javascript
/** @jest-environment jsdom */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiClient from '../ApiClient/ApiClient.js';
import ApiBase from '../ApiClient/ApiBase.js';
import LiturgyOfAnyDay from '../LiturgyOfAnyDay/LiturgyOfAnyDay.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

/** A payload carrying one event on the widget's currently selected date. */
const payloadFor = (date) => ({
    litcal: [
        {
            event_key: 'Test',
            event_idx: 1,
            name: 'Test Celebration',
            color: ['white'],
            color_lcl: ['white'],
            grade: 3,
            grade_lcl: 'Memorial',
            grade_abbr: 'M',
            grade_display: null,
            common: [],
            common_lcl: '',
            date: date.toISOString(),
            liturgical_year: 'A',
        },
    ],
    settings: { year: date.getUTCFullYear(), locale: 'en' },
    metadata: { version: 'test' },
    messages: [],
});

let apiClient;

beforeEach(async () => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    apiClient = await ApiClient.init(API_URL);
    document.body.innerHTML = '';
});

/** A mounted, listening widget. */
const mounted = (options = {}) => {
    const widget = new LiturgyOfAnyDay({ locale: 'en', ...options })
        .buildDateControls()
        .listenTo(apiClient);
    widget.appendTo(document.body);
    return widget;
};

/** The UTC midnight of the widget's currently selected date. */
const selectedDate = (widget) => {
    const day = Number(widget._dayInput._domElement.value);
    const month = Number(widget._monthInput._domElement.value);
    const year = Number(widget._yearInput._domElement.value);
    return new Date(Date.UTC(year, month - 1, day));
};

describe('LiturgyOfAnyDay live region', () => {
    it('mounts a polite, atomic status region inside its own element', () => {
        const widget = mounted();
        const region = widget._domElement.querySelector('[role="status"]');
        expect(region).not.toBeNull();
        expect(region.getAttribute('aria-live')).toBe('polite');
        expect(region.getAttribute('aria-atomic')).toBe('true');
        expect(region.textContent).toBe('');
    });

    it('says nothing on the first render', () => {
        const widget = mounted();
        apiClient._eventBus.emit('calendarFetched', payloadFor(selectedDate(widget)));
        expect(widget._liveRegion.textContent).toBe('');
    });

    it('announces the new date when the day changes', () => {
        const widget = mounted();
        apiClient._eventBus.emit('calendarFetched', payloadFor(selectedDate(widget)));

        const dayInput = widget._dayInput._domElement;
        dayInput.value = String(Number(dayInput.value) === 1 ? 2 : 1);
        dayInput.dispatchEvent(new Event('change'));

        expect(widget._liveRegion.textContent).toBe(
            `Liturgy for ${widget._dateElement.textContent} updated`,
        );
    });

    it('keeps the same region node across renders', () => {
        const widget = mounted();
        const region = widget._liveRegion;
        apiClient._eventBus.emit('calendarFetched', payloadFor(selectedDate(widget)));
        apiClient._eventBus.emit('calendarFetched', payloadFor(selectedDate(widget)));
        expect(widget._domElement.querySelector('[role="status"]')).toBe(region);
    });

    it('announces once for a year change, not twice', async () => {
        // The year listener renders the CACHED payload immediately and then
        // refetches, so the render count is two. The first describes a year the
        // user has already left, so it must not be announced.
        const widget = mounted();
        apiClient._eventBus.emit('calendarFetched', payloadFor(selectedDate(widget)));

        const announcements = [];
        const observer = new MutationObserver(() =>
            announcements.push(widget._liveRegion.textContent),
        );
        observer.observe(widget._liveRegion, {
            childList: true,
            characterData: true,
            subtree: true,
        });

        const yearInput = widget._yearInput._domElement;
        yearInput.value = String(Number(yearInput.value) + 1);
        yearInput.dispatchEvent(new Event('change'));
        apiClient._eventBus.emit('calendarFetched', payloadFor(selectedDate(widget)));
        await Promise.resolve();
        observer.disconnect();

        expect(announcements.filter((text) => text !== '')).toEqual([
            `Liturgy for ${widget._dateElement.textContent} updated`,
        ]);
    });

    it('mounts no region when announcements are turned off', () => {
        const widget = mounted({ announceUpdates: false });
        expect(widget._domElement.querySelector('[role="status"]')).toBeNull();
        expect(widget._liveRegion).toBeNull();
    });

    it('removes a mounted region when turned off later, and is chainable', () => {
        const widget = mounted();
        expect(widget.announceUpdates(false)).toBe(widget);
        expect(widget._domElement.querySelector('[role="status"]')).toBeNull();
    });

    it('rejects a non-boolean', () => {
        expect(() => new LiturgyOfAnyDay().announceUpdates('yes')).toThrow(
            /LiturgyOfAnyDay/,
        );
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/LiturgyOfAnyDayAnnouncements.test.js`
Expected: FAIL — no region.

- [ ] **Step 3: Implement**

In `src/LiturgyOfAnyDay/LiturgyOfAnyDay.js`:

- **1.** Add the imports:

```javascript
import LiveAnnouncer from '../LiveAnnouncer.js';
import { formatMessage } from '../MessageFormat.js';
```

- **2.** Add three private fields next to `#domElement`:

```javascript
    /**
     * The hidden live region, or `null` when `announceUpdates( false )` was set.
     *
     * @type {LiveAnnouncer|null}
     */
    #announcer = new LiveAnnouncer();

    /**
     * Whether a render with data has already happened. The first is silent: it
     * is the page loading, not a user action.
     *
     * @type {boolean}
     */
    #hasRendered = false;

    /**
     * Whether this widget has a refetch of its own in flight.
     *
     * A year change renders the CACHED payload immediately and then refetches,
     * so it produces two renders for one user action. The first describes the
     * year the user has just left, so it is rendered but not announced.
     *
     * @type {boolean}
     */
    #refetchPending = false;
```

- **3.** In the constructor, after `this.#domElement.appendChild(this.#eventsElementsWrapper);`:

```javascript
        // Mounted once, as the last child, and never removed: `#renderEvents()`
        // only clears `#eventsElementsWrapper`, so the region stays in the DOM
        // across every re-render — which is what assistive technology needs in
        // order to announce a change to it at all.
        this.#announcer.mountInto(this.#domElement);
```

- **4.** In the options block, alongside the other `Object.hasOwn` branches:

```javascript
            if (Object.hasOwn(options, 'announceUpdates')) {
                this.announceUpdates(options.announceUpdates);
            }
```

- **5.** In the year input's `change` listener, as its first statement:

```javascript
            // A year change always ends in a refetch, either through
            // `#handleDateChange()`'s year_type branch or through the explicit
            // one below. Marking it here — before the immediate render — is what
            // keeps that intermediate, stale render silent.
            if (this.#apiClient) {
                this.#refetchPending = true;
            }
```

- **6.** In `listenTo()`'s `calendarFetched` handler, before `this.#renderEvents();`:

```javascript
            this.#refetchPending = false;
```

- **7.** At the end of `#renderEvents()` — after `#updateEventDetails()` and after the zero-events early return,
  so restructure that method's two `return` paths to fall through to one call:

```javascript
    #renderEvents() {
        // Clear previous events
        this.#eventsElementsWrapper.innerHTML = '';

        if (!this.#calendarData || !this.#calendarData.litcal) {
            return;
        }

        const selectedTimestamp = this.#selectedDate.getTime();
        const todaysEvents = this.#calendarData.litcal.filter((event) => {
            return new Date(event.date).getTime() === selectedTimestamp;
        });

        if (todaysEvents.length === 0) {
            const noEventsEl = document.createElement('p');
            noEventsEl.textContent =
                'No liturgical events found for this date.';
            this.#eventsElementsWrapper.appendChild(noEventsEl);
        } else {
            this.#updateEventDetails(todaysEvents);
        }

        this.#announce();
    }

    /**
     * Announces the date just rendered, as a summary and never the content.
     *
     * Silent on the first render, and silent while this widget's own refetch is
     * in flight — see `#hasRendered` and `#refetchPending`. Reuses the string
     * already in `#dateElement` so the announcement and the visible date cannot
     * drift.
     *
     * The announcement names the date but NOT the calendar, so changing only the
     * calendar or the rite while the date stays put produces identical text and
     * a screen reader may not repeat it. Naming the calendar would mean giving
     * this widget `WebCalendar`'s three-branch caption derivation and its rite
     * tracking; that is recorded as a follow-up rather than done here.
     *
     * @returns {void}
     * @private
     */
    #announce() {
        if (null === this.#announcer || this.#refetchPending) {
            return;
        }
        if (false === this.#hasRendered) {
            this.#hasRendered = true;
            return;
        }
        this.#announcer.announce(
            formatMessage(
                'LITURGY_UPDATED_ANNOUNCEMENT',
                this.#locale.language,
                { date: this.#dateElement.textContent },
            ),
        );
    }
```

- **8.** Add the setter and the getter, next to the other chainable methods and `_domElement`:

```javascript
    /**
     * Turns the live-region announcement on or off.
     *
     * Default `true`. An accessibility fix that is off by default fixes nobody.
     * Turn it off when the surrounding page already owns a live region for this
     * content, to avoid announcing it twice.
     *
     * @param {boolean} enabled - Whether to announce each replacement.
     * @throws {Error} If `enabled` is not a boolean.
     * @returns {LiturgyOfAnyDay} This instance, for chaining.
     */
    announceUpdates(enabled) {
        if (typeof enabled !== 'boolean') {
            throw new Error(
                'LiturgyOfAnyDay.announceUpdates(): invalid type for parameter, must be of type boolean but found type: ' +
                    typeof enabled,
            );
        }
        if (false === enabled) {
            this.#announcer?.dispose();
            this.#announcer = null;
        } else if (null === this.#announcer) {
            this.#announcer = new LiveAnnouncer();
            this.#announcer.mountInto(this.#domElement);
        }
        return this;
    }

    /**
     * The live region element, or `null` when announcements are off.
     *
     * @type {HTMLSpanElement|null}
     */
    get _liveRegion() {
        return this.#announcer?.element ?? null;
    }
```

- [ ] **Step 4: Run the test, then the existing widget suite**

Run: `yarn test src/__tests__/LiturgyOfAnyDayAnnouncements.test.js src/__tests__/LiturgyOfAnyDay.test.js`
Expected: PASS.

- [ ] **Step 5: Run the whole suite**

Run: `yarn test`
Expected: PASS. `DayViewer*` suites assert on the widget's DOM and are the likely breakage; fix by
asserting on the events wrapper rather than on `#domElement`'s child count.

- [ ] **Step 6: Format and commit**

```bash
yarn format:js:fix
git add src/LiturgyOfAnyDay/LiturgyOfAnyDay.js src/__tests__/LiturgyOfAnyDayAnnouncements.test.js
git commit -S -m "$(cat <<'EOF'
Announce each LiturgyOfAnyDay update in a live region (#65)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Confirm one announcement per user action

**Files:**

- Test: `src/__tests__/AnnouncementFrequency.test.js` (new)

**Interfaces:**

- Consumes: everything from Tasks 5 and 6.
- Produces: nothing. This task exists because #65 asks for the claim to be **confirmed**, not assumed.

- [ ] **Step 1: Write the test**

Create `src/__tests__/AnnouncementFrequency.test.js`, reusing the wiring from
`src/__tests__/ApiClientRequestCoalescing.test.js` (read it first — the `buildForm()` helper, the
`global.fetch` mock and the `settle()` helper are all there). Two differences: the mock must return a
non-empty `litcal`, because `WebCalendar` throws on an empty one, and a `WebCalendar` is added to the wiring.

```javascript
/** @jest-environment jsdom */
/**
 * #65 asks whether one user action can produce more than one render, since an
 * announcement per render would then be noisy. The coalescing added in 2.5.0
 * should make it one, and this file is what CONFIRMS that rather than assuming
 * it: it counts announcements, driven through the same real `change` events
 * `ApiClientRequestCoalescing.test.js` uses.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import WebCalendar from '../WebCalendar/WebCalendar.js';
import { ApiOptionsFilter } from '../Enums.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.innerHTML = '<div id="opts"></div><div id="cal"></div>';
    global.fetch = jest.fn((url, init) => {
        const lang = init?.headers?.['Accept-Language'] ?? 'en';
        return Promise.resolve({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: () =>
                Promise.resolve({
                    // Non-empty: WebCalendar rejects an empty litcal.
                    litcal: [
                        {
                            event_key: 'Advent1',
                            event_idx: 1,
                            name: 'Prima Domenica di Avvento',
                            color: ['morello'],
                            color_lcl: ['viola'],
                            grade: 7,
                            grade_lcl: 'solennità',
                            grade_abbr: 'S',
                            grade_display: '',
                            common: [],
                            common_lcl: '',
                            type: 'mobile',
                            date: '2026-11-15T00:00:00+00:00',
                            year: 2026,
                            month: 11,
                            month_short: 'Nov.',
                            month_long: 'November',
                            day: 15,
                            day_of_the_week_iso8601: 7,
                            day_of_the_week_short: 'Sun',
                            day_of_the_week_long: 'Sunday',
                            liturgical_year: 'A',
                            is_vigil_mass: false,
                            psalter_week: 1,
                            liturgical_season: 'ADVENT',
                            liturgical_season_lcl: 'Avvento',
                            holy_day_of_obligation: false,
                        },
                    ],
                    messages: [],
                    metadata: {},
                    settings: { locale: lang, year: 2026 },
                }),
        });
    });
});

/** Lets the coalescing microtask flush and its request settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

const userSelects = (element, value) => {
    element.value = value;
    element.dispatchEvent(new Event('change', { bubbles: true }));
};

const buildPage = async () => {
    const apiClient = await ApiClient.init(API_URL);
    const riteSelect = new RiteSelect('it');
    const calendarSelect = new CalendarSelect({ locale: 'it', allowNull: true });
    const apiOptions = new ApiOptions('it');
    apiOptions._localeInput.defaultValue('it');
    apiOptions.linkToCalendarSelect(calendarSelect).linkToRiteSelect(riteSelect);
    riteSelect.appendTo('#opts');
    calendarSelect.appendTo('#opts');
    apiOptions.filter(ApiOptionsFilter.ALL_CALENDARS).appendTo('#opts');
    const webCalendar = new WebCalendar();
    webCalendar.appendTo('#cal');
    webCalendar.listenTo(apiClient);
    apiClient.listenTo(calendarSelect).listenTo(riteSelect).listenTo(apiOptions);

    // Every non-empty text the region has held, in order. A MutationObserver
    // rather than a render counter: it counts what a screen reader would be
    // handed, which is the thing #65 is about.
    const announced = [];
    const observer = new MutationObserver(() => {
        const text = webCalendar._liveRegion.textContent;
        if ('' !== text) {
            announced.push(text);
        }
    });
    observer.observe(webCalendar._liveRegion, {
        childList: true,
        characterData: true,
        subtree: true,
    });
    return { apiClient, announced, riteSelect, calendarSelect, apiOptions };
};

describe('one user action produces one announcement', () => {
    it('announces once for a rite change', async () => {
        const { apiClient, announced, riteSelect } = await buildPage();
        await apiClient.fetchCalendar('it');
        await settle();
        announced.length = 0;

        userSelects(riteSelect._domElement, 'ambrosian');
        await settle();

        expect(announced).toHaveLength(1);
    });

    it('announces once for a calendar change', async () => {
        const { apiClient, announced, calendarSelect } = await buildPage();
        await apiClient.fetchCalendar('it');
        await settle();
        announced.length = 0;

        userSelects(calendarSelect._domElement, 'VA');
        await settle();

        expect(announced).toHaveLength(1);
    });

    it('announces once per action across three separate actions', async () => {
        const { apiClient, announced, riteSelect, calendarSelect } =
            await buildPage();
        await apiClient.fetchCalendar('it');
        await settle();
        announced.length = 0;

        userSelects(riteSelect._domElement, 'ambrosian');
        await settle();
        userSelects(riteSelect._domElement, 'roman');
        await settle();
        userSelects(calendarSelect._domElement, 'VA');
        await settle();

        expect(announced).toHaveLength(3);
    });
});
```

- [ ] **Step 2: Run it**

Run: `yarn test src/__tests__/AnnouncementFrequency.test.js`
Expected: PASS. **If any case reports more than one announcement per action, stop.** That falsifies the
issue's assumption, and the fix is to debounce the announcement onto a microtask in
`WebCalendar.#announce()` rather than to relax the assertion. Record whichever outcome occurs in the
final report.

- [ ] **Step 3: Format and commit**

```bash
yarn format:js:fix
git add src/__tests__/AnnouncementFrequency.test.js
git commit -S -m "$(cat <<'EOF'
Confirm one announcement per user action (#65)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Documentation

**Files:**

- Modify: `CHANGELOG.md` (under `## [Unreleased]`), `CLAUDE.md`, `README.md`, `docs/web-calendar.md`,
  `docs/liturgy-components.md`

**Interfaces:**

- Consumes: everything above.
- Produces: nothing consumed by code.

- [ ] **Step 1: `CHANGELOG.md`**

Add under `## [Unreleased]`, in the `### Added` section, keeping the file's existing prose register:

```markdown
- **A visually-hidden live region on `WebCalendar` and `LiturgyOfAnyDay`**, closing #65. Both replace all of
  their content when a `<select>` changes — a whole table, a whole event list — while focus stays on the
  select, so a screen-reader user got silence and no way to tell a successful update from a request that did
  nothing. Each now owns a `role="status"` / `aria-live="polite"` / `aria-atomic="true"` region, following the
  precedent `SubscriptionUrl` set in 2.7.0, and announces a short localized summary — never the content. A
  live region holding the table would be catastrophic. `WebCalendar` announces the caption text and the entry
  count (`General Roman Calendar - 2026, 561 entries`), reusing the very string the `<caption>` carries so the
  two cannot drift; `LiturgyOfAnyDay` announces the date (`Liturgy for Friday, 14 August 2026 updated`). The
  first render is deliberately silent — it is the page loading, not a user action. `announceUpdates: false`,
  as a constructor option or a chainable setter on either component, turns it off for a consumer that already
  owns a live region for the surrounding page.

- **`src/MessageFormat.js` and `src/LiveAnnouncer.js`**, both internal and neither exported from
  `src/index.js`, on the same reasoning as `LocaleValidation.js` and `Theme.js`. The first gives the
  `{placeholder}` convention `Messages.js` already used — `AMBROSIAN_CALENDAR_CAPTION` and the two other
  captions — one home, adding the English fallback each call site wrote by hand and an `Intl.PluralRules`
  form selection. The second owns the hidden-region markup `SubscriptionUrl` introduced; `SubscriptionUrl`
  now uses it, and its region gains `role="status"` and `aria-atomic="true"` in the process.

### Documentation

- `LiturgyOfTheDay` is deliberately **not** given a live region under #65. It appends to its events wrapper
  and never clears it, so a second `calendarFetched` duplicates the day's events rather than replacing them —
  announcing "updated" over a component that is accumulating would describe something that did not happen.
  That duplication is a real, separate defect, recorded here rather than fixed under this issue.
```

- [ ] **Step 2: `CLAUDE.md`**

Add a section after `## Internationalization`:

```markdown
## Live-region announcements

`WebCalendar` and `LiturgyOfAnyDay` each own a visually-hidden `role="status"` / `aria-live="polite"` /
`aria-atomic="true"` region and announce a **short summary** — never their content — whenever they replace it.
`announceUpdates` (constructor option and chainable setter, default `true`) turns it off. Five points are
load-bearing:

- **Default on.** An accessibility fix that is off by default fixes nobody. The opt-out exists for a consumer
  that already owns a live region for the surrounding page.
- **The first render is silent.** It is the page loading, not a user action, and a region firing then talks
  over whatever else is being announced. It is also the render that MOUNTS the region, and a live region has
  to be in the DOM before its content changes to be announced at all — so skipping it is not merely polite.
- **`WebCalendar`'s region must survive the table swap.** Its `calendarFetched` handler used
  `replaceChildren( table )`, which would take the region with it; `#swapIn()` removes every child except the
  region instead. Do not "simplify" it back — a region that is removed and re-inserted is not announced.
- **`LiturgyOfAnyDay` renders twice for one year change** — once from the cached payload, once from the
  refetch — so `#refetchPending` keeps the first, stale one silent. This is the ONE path where coalescing
  does not already give one render per action; `src/__tests__/AnnouncementFrequency.test.js` confirms the
  `ApiClient` path does.
- **No meta-component option.** `CalendarViewer` and `DayViewer` expose the child, so
  `viewer.webCalendar.announceUpdates( false )` reaches it without a seventh key in their option bags.

`src/MessageFormat.js` is where a `Messages` key with `{placeholders}` is resolved, interpolated and — via
`Intl.PluralRules` — pluralized. It is internal, like `LocaleValidation.js`. The three caption sites in
`WebCalendar.js` still inline the same regex; converting them is a refactor for its own change.
`src/LiveAnnouncer.js` owns the hidden-region markup, shared with `SubscriptionUrl`, and holds no policy
about **when** to announce — that belongs to each caller, since `SubscriptionUrl` must announce on its first
use while the two renderers must not.

`LiturgyOfTheDay` has no region, deliberately: `#updateEventDetails()` appends without clearing, so a second
fetch duplicates rather than replaces.
```

- [ ] **Step 3: `README.md`**

Find the `WebCalendar` and `LiturgyOfAnyDay` method tables/lists and add one row each:

```markdown
    .announceUpdates(true)                           // Announce updates in a live region (chainable)
```

Then add a short subsection near the accessibility-relevant prose, if any exists; otherwise place it after
the `LiturgyOfAnyDay` section:

```markdown
### Screen-reader announcements

`WebCalendar` and `LiturgyOfAnyDay` replace all of their content when a select changes. Each announces a short
summary of what it now shows through a visually-hidden `aria-live="polite"` region, so the change is not
silent for a screen-reader user. The first render is not announced, and `announceUpdates(false)` turns the
region off entirely for a page that owns its own.
```

- [ ] **Step 4: `docs/web-calendar.md` and `docs/liturgy-components.md`**

Read each first. Add `announceUpdates` to the options table and the chainable-methods table in
`docs/web-calendar.md`, with the same one-line description, plus a short "Screen-reader announcements"
subsection restating the summary, the silent first render and the opt-out. Do the same for
`LiturgyOfAnyDay` wherever `docs/liturgy-components.md` documents its methods.

- [ ] **Step 5: Run the markdown gates**

```bash
yarn format:md:fix && yarn format:md && yarn lint:md
```

Expected: `Summary: 0 issues in 0 files`.

- [ ] **Step 6: Commit**

```bash
git add CHANGELOG.md CLAUDE.md README.md docs/
git commit -S -m "$(cat <<'EOF'
Document the live-region announcements (#65)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Gates

**Files:** none.

- [ ] **Step 1: Run every gate, in order, capturing real output**

```bash
yarn test
yarn compile && yarn lint:dts
yarn format:js
yarn format:md
yarn lint:md
```

Expected: `yarn test` at 76 suites / at least 1350 + the new cases. `yarn lint:dts` matters most here — the
two new `_liveRegion` getters are typed `HTMLSpanElement|null` and a JSDoc slip in a getter is exactly the
class of bug `lint:dts` exists to catch, and which `yarn compile` cannot.

- [ ] **Step 2: Fix anything that fails, then re-run the full list**

Do not report a gate as passing from memory. Paste the output.

- [ ] **Step 3: Request code review**

Use `superpowers:requesting-code-review`, then `superpowers:receiving-code-review` for the findings —
verifying each claim against the code rather than agreeing reflexively.
