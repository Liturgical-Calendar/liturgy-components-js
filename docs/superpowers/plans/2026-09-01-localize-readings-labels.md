# Localize the `ReadingsRenderer` labels — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** Make `ReadingsRenderer` render its reading and mass-schema labels in the locale it is given, instead of always English.

**Architecture:** Twenty-two new keys in `Messages.js`; two internal key→message-key maps in
`ReadingsRenderer`; the existing public static label maps rebuilt from `Messages.en` through those maps so the
English lives in one place; a `locale` on the renderer following the library-wide contract; and the two
widgets forwarding the locale they already hold.

**Tech Stack:** ES2022 JavaScript, JSDoc-typed, Jest 30 (jsdom), prettier (4-space, single quotes), markdownlint-cli2.

**Spec:** `docs/superpowers/specs/2026-09-01-localize-readings-labels-design.md`

## Global Constraints

- **Message lookups go through `message( key, locale )`** from `src/MessageLookup.js`. Never index
  `Messages[lang][KEY]` directly — `src/__tests__/MessageLookup.test.js` scans for that shape and has no
  exemption mechanism.
- **The public statics `readingLabels` and `massLabels` keep their exact keys, in their exact current order.**
  `massLabels`' key order is the render order, and its key set is what `static #nestedSchemaKeys` derives from.
- **Locale contract:** `string` or `Intl.Locale` interchangeably, as the bare argument or the bag's `locale`;
  `null`/`undefined` mean "not supplied" and yield `'en'`; anything else is rejected naming the component and
  the type; an unparseable locale throws. Use `normalizeComponentOptions( options, 'ReadingsRenderer' )` and
  `toIntlLocale( locale, 'ReadingsRenderer' )`.
- **Formatting:** run `yarn format:js:fix` before every commit; `yarn format:md:fix` when markdown changed.
- **Never use `--no-verify`.**
- **Translation scope:** `en` authoritative; `it` and `la` are drafts requiring maintainer review; all other locale blocks are deliberately left to fall back to English.
- **Full gate command** (run before the final commit of each task): `yarn compile && yarn test && yarn lint:dts && yarn format:js && yarn format:md && yarn lint:md`

---

### Task 1: Add the 22 message keys

**Files:**

- Modify: `src/Messages.js` — `en` block (ends line ~514), `it` block (ends line ~1134), `la` block (ends line ~1329)
- Test: `src/__tests__/Messages.test.js`

**Interfaces:**

- Consumes: nothing.
- Produces: 22 keys readable via `message( key, locale )` — `READING_FIRST`, `READING_SECOND`, `READING_THIRD`,
  `READING_FOURTH`, `READING_FIFTH`, `READING_SIXTH`, `READING_SEVENTH`, `RESPONSORIAL_PSALM`,
  `GOSPEL_ACCLAMATION`, `GOSPEL`, `GOSPEL_AT_PROCESSION`, `EPISTLE`, `MASS_VIGIL`, `MASS_NIGHT`, `MASS_DAWN`,
  `MASS_DAY`, `MASS_EVENING`, `SCHEMA_ONE`, `SCHEMA_TWO`, `SCHEMA_THREE`, `EASTER_SEASON`,
  `OUTSIDE_EASTER_SEASON`.

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/Messages.test.js`:

```javascript
describe('readings label keys', () => {
    // en is authoritative; it and la are maintainer-reviewed drafts. Every other
    // block reaches English through message()'s fallback, deliberately.
    const TRANSLATED = ['en', 'it', 'la'];

    const READING_KEYS = [
        'READING_FIRST',
        'READING_SECOND',
        'READING_THIRD',
        'READING_FOURTH',
        'READING_FIFTH',
        'READING_SIXTH',
        'READING_SEVENTH',
        'RESPONSORIAL_PSALM',
        'GOSPEL_ACCLAMATION',
        'GOSPEL',
        'GOSPEL_AT_PROCESSION',
        'EPISTLE',
    ];

    const SCHEMA_KEYS = [
        'MASS_VIGIL',
        'MASS_NIGHT',
        'MASS_DAWN',
        'MASS_DAY',
        'MASS_EVENING',
        'SCHEMA_ONE',
        'SCHEMA_TWO',
        'SCHEMA_THREE',
        'EASTER_SEASON',
        'OUTSIDE_EASTER_SEASON',
    ];

    const ALL_KEYS = [...READING_KEYS, ...SCHEMA_KEYS];

    it('adds exactly 22 keys', () => {
        expect(ALL_KEYS.length).toBe(22);
        expect(new Set(ALL_KEYS).size).toBe(22);
    });

    it.each(ALL_KEYS)('defines %s in English, the fallback for all', (key) => {
        expect(typeof Messages['en'][key]).toBe('string');
        expect(Messages['en'][key].length).toBeGreaterThan(0);
    });

    it.each(TRANSLATED)('defines every readings key for %s', (lang) => {
        ALL_KEYS.forEach((key) => {
            expect(typeof Messages[lang][key]).toBe('string');
            expect(Messages[lang][key].length).toBeGreaterThan(0);
        });
    });

    it('leaves untranslated locales undefined so callers fall back', () => {
        expect(Messages['de'].READING_FIRST).toBeUndefined();
        expect(Messages['fr'].MASS_VIGIL).toBeUndefined();
    });

    it('does not collide with an existing key', () => {
        // GOSPEL and EPISTLE are short enough to be plausible collisions.
        // Their values must be the readings labels, not something reused.
        expect(Messages['en'].GOSPEL).toBe('Gospel');
        expect(Messages['en'].EPISTLE).toBe('Epistle');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/__tests__/Messages.test.js -t "readings label keys"`
Expected: FAIL — `expect(typeof Messages['en']['READING_FIRST']).toBe('string')` receives `"undefined"`.

- [ ] **Step 3: Add the English keys**

In `src/Messages.js`, in the `en` block, immediately after the line
`LITURGY_UPDATED_ANNOUNCEMENT: 'Liturgy for {date} updated',`:

```javascript
        READING_FIRST: 'First Reading',
        READING_SECOND: 'Second Reading',
        READING_THIRD: 'Third Reading',
        READING_FOURTH: 'Fourth Reading',
        READING_FIFTH: 'Fifth Reading',
        READING_SIXTH: 'Sixth Reading',
        READING_SEVENTH: 'Seventh Reading',
        RESPONSORIAL_PSALM: 'Responsorial Psalm',
        GOSPEL_ACCLAMATION: 'Gospel Acclamation',
        GOSPEL: 'Gospel',
        GOSPEL_AT_PROCESSION: 'Gospel at the Procession',
        EPISTLE: 'Epistle',
        MASS_VIGIL: 'Vigil Mass',
        MASS_NIGHT: 'Mass during the Night',
        MASS_DAWN: 'Mass at Dawn',
        MASS_DAY: 'Mass during the Day',
        MASS_EVENING: 'Evening Mass',
        SCHEMA_ONE: 'Schema I',
        SCHEMA_TWO: 'Schema II',
        SCHEMA_THREE: 'Schema III',
        EASTER_SEASON: 'Easter Season',
        OUTSIDE_EASTER_SEASON: 'Outside Easter Season',
```

**These English strings must match the current `ReadingsRenderer` literals byte for byte.** Task 2
rebuilds the public maps from them, and Task 2's test compares the result against a hand-written copy of
today's values.

- [ ] **Step 4: Add the Italian draft**

In the `it` block, after `LITURGY_UPDATED_ANNOUNCEMENT: 'Liturgia per {date} aggiornata',`:

```javascript
        READING_FIRST: 'Prima lettura',
        READING_SECOND: 'Seconda lettura',
        READING_THIRD: 'Terza lettura',
        READING_FOURTH: 'Quarta lettura',
        READING_FIFTH: 'Quinta lettura',
        READING_SIXTH: 'Sesta lettura',
        READING_SEVENTH: 'Settima lettura',
        RESPONSORIAL_PSALM: 'Salmo responsoriale',
        GOSPEL_ACCLAMATION: 'Canto al Vangelo',
        GOSPEL: 'Vangelo',
        GOSPEL_AT_PROCESSION: 'Vangelo della processione',
        EPISTLE: 'Epistola',
        MASS_VIGIL: 'Messa della vigilia',
        MASS_NIGHT: 'Messa della notte',
        MASS_DAWN: "Messa dell'aurora",
        MASS_DAY: 'Messa del giorno',
        MASS_EVENING: 'Messa vespertina',
        SCHEMA_ONE: 'Primo schema',
        SCHEMA_TWO: 'Secondo schema',
        SCHEMA_THREE: 'Terzo schema',
        EASTER_SEASON: 'Tempo di Pasqua',
        OUTSIDE_EASTER_SEASON: 'Fuori del tempo di Pasqua',
```

`MASS_VIGIL` deliberately reuses the API's own Italian for "Vigil Mass" (`Messa della vigilia`, in
`i18n/it/LC_MESSAGES/litcal.po`) rather than the Missal's fuller `Messa vespertina nella vigilia`, so the
two projects agree on one rendering. `MASS_DAWN` uses double quotes because the value contains an
apostrophe — this is what prettier emits; do not "fix" it to a single-quoted escape.

- [ ] **Step 5: Add the Latin draft**

In the `la` block, after `LITURGY_UPDATED_ANNOUNCEMENT: 'Liturgia diei {date} renovata',`:

```javascript
        READING_FIRST: 'Lectio prima',
        READING_SECOND: 'Lectio secunda',
        READING_THIRD: 'Lectio tertia',
        READING_FOURTH: 'Lectio quarta',
        READING_FIFTH: 'Lectio quinta',
        READING_SIXTH: 'Lectio sexta',
        READING_SEVENTH: 'Lectio septima',
        RESPONSORIAL_PSALM: 'Psalmus responsorius',
        GOSPEL_ACCLAMATION: 'Acclamatio ante Evangelium',
        GOSPEL: 'Evangelium',
        GOSPEL_AT_PROCESSION: 'Evangelium ad processionem',
        EPISTLE: 'Epistola',
        MASS_VIGIL: 'Missa in Vigilia',
        MASS_NIGHT: 'Missa in nocte',
        MASS_DAWN: 'Missa in aurora',
        MASS_DAY: 'Missa in die',
        MASS_EVENING: 'Missa vespertina',
        SCHEMA_ONE: 'Schema I',
        SCHEMA_TWO: 'Schema II',
        SCHEMA_THREE: 'Schema III',
        EASTER_SEASON: 'Tempore paschali',
        OUTSIDE_EASTER_SEASON: 'Extra tempus paschale',
```

- [ ] **Step 6: Run tests and formatter**

Run: `yarn format:js:fix && yarn test src/__tests__/Messages.test.js`
Expected: PASS, all suites.

- [ ] **Step 7: Commit**

```bash
git add src/Messages.js src/__tests__/Messages.test.js
git commit -m "Add the 22 readings label keys to the message catalogue (#105)

English is authoritative. Italian and Latin are drafts for maintainer review
against the Missal; every other block falls back to English through message(),
which is the documented normal case for a partly translated key."
```

---

### Task 2: Derive the public English maps from the catalogue

**Files:**

- Modify: `src/ReadingsRenderer/ReadingsRenderer.js:1-91` (add import + two module-level maps; replace the two static literals)
- Test: `src/__tests__/ReadingsRenderer.test.js`

**Interfaces:**

- Consumes: the 22 keys from Task 1; `message( key, locale )` from `src/MessageLookup.js`.
- Produces: module-level `READING_MESSAGE_KEYS` and `MASS_MESSAGE_KEYS` (both `Object<string,string>`, frozen, internal — **not** exported from `src/index.js`), consumed by Task 3.

**This task must produce ZERO behaviour change.** The maps must come out identical to today's literals, keys and order included.

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/ReadingsRenderer.test.js`:

```javascript
describe('the English label maps are derived, not restated', () => {
    /**
     * A hand-written second statement of both maps, in their exact current
     * order. Deliberately NOT read from `Messages.en` — comparing the derived
     * map against the catalogue it was built from would agree with itself and
     * prove nothing. This is the FilterInputs.test.js pattern.
     */
    const EXPECTED_READING_LABELS = {
        first_reading: 'First Reading',
        responsorial_psalm: 'Responsorial Psalm',
        second_reading: 'Second Reading',
        gospel_acclamation: 'Gospel Acclamation',
        gospel: 'Gospel',
        palm_gospel: 'Gospel at the Procession',
        epistle: 'Epistle',
        responsorial_psalm_2: 'Responsorial Psalm',
        third_reading: 'Third Reading',
        responsorial_psalm_3: 'Responsorial Psalm',
        fourth_reading: 'Fourth Reading',
        responsorial_psalm_4: 'Responsorial Psalm',
        fifth_reading: 'Fifth Reading',
        responsorial_psalm_5: 'Responsorial Psalm',
        sixth_reading: 'Sixth Reading',
        responsorial_psalm_6: 'Responsorial Psalm',
        seventh_reading: 'Seventh Reading',
        responsorial_psalm_7: 'Responsorial Psalm',
        responsorial_psalm_epistle: 'Responsorial Psalm',
    };

    const EXPECTED_MASS_LABELS = {
        vigil: 'Vigil Mass',
        night: 'Mass during the Night',
        dawn: 'Mass at Dawn',
        day: 'Mass during the Day',
        evening: 'Evening Mass',
        schema_one: 'Schema I',
        schema_two: 'Schema II',
        schema_three: 'Schema III',
        easter_season: 'Easter Season',
        outside_easter_season: 'Outside Easter Season',
    };

    it('yields exactly the published English values', () => {
        expect({ ...ReadingsRenderer.readingLabels }).toEqual(
            EXPECTED_READING_LABELS,
        );
        expect({ ...ReadingsRenderer.massLabels }).toEqual(
            EXPECTED_MASS_LABELS,
        );
    });

    /**
     * Key ORDER is load-bearing and `toEqual` does not check it: massLabels'
     * order is the render order, and readingLabels' order is part of the
     * published shape.
     */
    it('preserves the published key order', () => {
        expect(Object.keys(ReadingsRenderer.readingLabels)).toEqual(
            Object.keys(EXPECTED_READING_LABELS),
        );
        expect(Object.keys(ReadingsRenderer.massLabels)).toEqual(
            Object.keys(EXPECTED_MASS_LABELS),
        );
    });

    it('keeps both maps frozen', () => {
        expect(Object.isFrozen(ReadingsRenderer.readingLabels)).toBe(true);
        expect(Object.isFrozen(ReadingsRenderer.massLabels)).toBe(true);
    });
});
```

- [ ] **Step 2: Run test to verify it passes for the wrong reason**

Run: `yarn test src/__tests__/ReadingsRenderer.test.js -t "derived, not restated"`
Expected: **PASS** — the literals still exist and already hold these values.

This test is a characterization net: it pins today's output so Step 3 cannot change it. Confirm it is green
BEFORE editing the source, so a failure in Step 5 is unambiguously caused by the refactor.

- [ ] **Step 3: Add the import and the two mapping tables**

At the top of `src/ReadingsRenderer/ReadingsRenderer.js`, after the `@module` doc comment and before the
`@typedef`:

```javascript
import { message } from '../MessageLookup.js';

/**
 * Maps each readings key to the `Messages` key naming it.
 *
 * Nineteen keys collapse onto twelve messages, because the psalm variants have
 * always shared one label. The mapping is EXPLICIT rather than derived from the
 * key name: `LiturgicalCalendarFrontend`'s `temporale.js` derives it
 * mechanically and gets `palm_gospel` wrong as "Palm Gospel".
 *
 * KEY ORDER IS LOAD-BEARING — it becomes the key order of the public
 * {@link ReadingsRenderer.readingLabels}, which shipped in 2.10.0.
 *
 * @type {Object<string, string>}
 */
const READING_MESSAGE_KEYS = Object.freeze({
    first_reading: 'READING_FIRST',
    responsorial_psalm: 'RESPONSORIAL_PSALM',
    second_reading: 'READING_SECOND',
    gospel_acclamation: 'GOSPEL_ACCLAMATION',
    gospel: 'GOSPEL',
    palm_gospel: 'GOSPEL_AT_PROCESSION',
    epistle: 'EPISTLE',
    responsorial_psalm_2: 'RESPONSORIAL_PSALM',
    third_reading: 'READING_THIRD',
    responsorial_psalm_3: 'RESPONSORIAL_PSALM',
    fourth_reading: 'READING_FOURTH',
    responsorial_psalm_4: 'RESPONSORIAL_PSALM',
    fifth_reading: 'READING_FIFTH',
    responsorial_psalm_5: 'RESPONSORIAL_PSALM',
    sixth_reading: 'READING_SIXTH',
    responsorial_psalm_6: 'RESPONSORIAL_PSALM',
    seventh_reading: 'READING_SEVENTH',
    responsorial_psalm_7: 'RESPONSORIAL_PSALM',
    responsorial_psalm_epistle: 'RESPONSORIAL_PSALM',
});

/**
 * Maps each nested mass-schema key to the `Messages` key naming it.
 *
 * KEY ORDER IS LOAD-BEARING TWICE OVER: it becomes the key order of the public
 * {@link ReadingsRenderer.massLabels}, which is the order `renderReadings()`
 * stacks the schemas in, and it is the key SET that
 * `ReadingsRenderer.hasNestedSchemas()` recognises.
 *
 * @type {Object<string, string>}
 */
const MASS_MESSAGE_KEYS = Object.freeze({
    vigil: 'MASS_VIGIL',
    night: 'MASS_NIGHT',
    dawn: 'MASS_DAWN',
    day: 'MASS_DAY',
    evening: 'MASS_EVENING',
    schema_one: 'SCHEMA_ONE',
    schema_two: 'SCHEMA_TWO',
    schema_three: 'SCHEMA_THREE',
    easter_season: 'EASTER_SEASON',
    outside_easter_season: 'OUTSIDE_EASTER_SEASON',
});

/**
 * Builds an English label map from a key→message-key table.
 *
 * The English strings live in `Messages.en` alone; this is what keeps the
 * public maps from becoming a second copy free to drift, the same duplication
 * #97 removed when `#nestedSchemaKeys` became `Object.keys( massLabels )`.
 * `message()` throws for a key absent from English, so a typo fails at module
 * load rather than rendering the word "undefined".
 *
 * @param {Object<string, string>} messageKeys - Key to `Messages` key.
 * @returns {Object<string, string>} Frozen key to English label.
 */
function englishLabels(messageKeys) {
    return Object.freeze(
        Object.fromEntries(
            Object.entries(messageKeys).map(([key, messageKey]) => [
                key,
                message(messageKey, 'en'),
            ]),
        ),
    );
}
```

- [ ] **Step 4: Replace the two static literals**

Replace the whole `static readingLabels = Object.freeze({ … });` block with:

```javascript
    /**
     * Mapping of reading property keys to human-readable English labels.
     *
     * DERIVED from `Messages.en` — see {@link englishLabels}. English regardless
     * of any locale, because a static cannot know one; a localized label comes
     * from rendering with a locale. Public since 2.10.0: same keys, same order.
     *
     * @type {Object<string, string>}
     * @static
     * @readonly
     */
    static readingLabels = englishLabels(READING_MESSAGE_KEYS);
```

Replace the whole `static massLabels = Object.freeze({ … });` block with:

```javascript
    /**
     * Mapping of mass schema keys to human-readable English labels.
     *
     * DERIVED from `Messages.en` — see {@link englishLabels}. Its key ORDER is
     * the order `renderReadings()` stacks schemas in, and its key SET is what
     * `static #nestedSchemaKeys` derives from, so both come from
     * {@link MASS_MESSAGE_KEYS} and neither may be reordered casually.
     *
     * @type {Object<string, string>}
     * @static
     * @readonly
     */
    static massLabels = englishLabels(MASS_MESSAGE_KEYS);
```

Leave `static readingOrder` and `static #nestedSchemaKeys` exactly as they are.

- [ ] **Step 5: Run the full suite**

Run: `yarn format:js:fix && yarn test`
Expected: PASS, all 105+ suites. The characterization test from Step 1 proves the refactor changed nothing;
the pre-existing `ReadingsRenderer`, `LiturgyOfTheDay` and `LiturgyOfAnyDay` suites prove rendering is
unchanged.

- [ ] **Step 6: Verify the declarations still emit**

Run: `yarn compile && yarn lint:dts`
Expected: both exit 0. Confirm the statics did not lose their type:

Run: `grep -A2 "static readonly readingLabels" dist/ReadingsRenderer/ReadingsRenderer.d.ts`
Expected: `static readonly readingLabels: { [x: string]: string; };` — the same declaration as before. If it
emitted `any`, add an explicit `@type {Object<string, string>}` to `englishLabels`' return.

- [ ] **Step 7: Commit**

```bash
git add src/ReadingsRenderer/ReadingsRenderer.js src/__tests__/ReadingsRenderer.test.js
git commit -m "Derive the English readings labels from the catalogue (#105)

No behaviour change: a characterization test pins both maps against a
hand-written copy of the published values, key order included, and was green
before the refactor. The English now lives in Messages.en alone."
```

---

### Task 3: `ReadingsRenderer` takes a locale and renders localized labels

**Files:**

- Modify: `src/ReadingsRenderer/ReadingsRenderer.js` — the `@typedef`, the constructor, `renderSingleReadings()`, `renderReadings()`
- Test: `src/__tests__/ReadingsRenderer.test.js`

**Interfaces:**

- Consumes: `READING_MESSAGE_KEYS`, `MASS_MESSAGE_KEYS`, `message()` from Task 2;
  `normalizeComponentOptions( options, componentName )` from `src/OptionsValidation.js`;
  `toIntlLocale( locale, componentName )` from `src/LocaleValidation.js`.
- Produces: `new ReadingsRenderer( localeOrOptions )` accepting `string | Intl.Locale | Object | null`, consumed by Task 4.

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/ReadingsRenderer.test.js`:

```javascript
describe('ReadingsRenderer locale', () => {
    const FLAT = { first_reading: 'Numeri 6:22-27', gospel: 'Lucam 2:16-21' };

    const renderText = (localeOrOptions, readings = FLAT) => {
        const container = document.createElement('div');
        new ReadingsRenderer(localeOrOptions).renderReadings(
            readings,
            container,
        );
        return container.textContent;
    };

    it('renders localized labels for a translated locale', () => {
        expect(renderText('it')).toContain('Prima lettura: Numeri 6:22-27');
        expect(renderText('it')).toContain('Vangelo: Lucam 2:16-21');
    });

    it('accepts a bare string, an Intl.Locale and an options bag alike', () => {
        expect(renderText('it')).toContain('Prima lettura');
        expect(renderText(new Intl.Locale('it-IT'))).toContain('Prima lettura');
        expect(renderText({ locale: 'it' })).toContain('Prima lettura');
    });

    it('falls back to English for a block that lacks the readings keys', () => {
        // `de` IS a catalogue block; Task 1 deliberately left it untranslated.
        expect(renderText('de')).toContain('First Reading');
    });

    it('falls back to English for a language with no block at all', () => {
        // `ceb` has no block in `Messages.js`, a different path through
        // `message()` than the one above: `Messages[language]?.[key]` short-
        // circuits on the optional chain rather than on the key.
        expect(renderText('ceb')).toContain('First Reading');
    });

    it('defaults to English when no locale is supplied', () => {
        expect(renderText(undefined)).toContain('First Reading');
        expect(renderText(null)).toContain('First Reading');
        expect(renderText({})).toContain('First Reading');
        expect(renderText({ locale: null })).toContain('First Reading');
    });

    it('rejects a locale that is neither a string nor an Intl.Locale', () => {
        expect(() => new ReadingsRenderer({ locale: 42 })).toThrow(
            /ReadingsRenderer/,
        );
        expect(() => new ReadingsRenderer(['it'])).toThrow(/ReadingsRenderer/);
    });

    it('throws for an unparseable locale rather than silently using English', () => {
        expect(() => new ReadingsRenderer('not a locale!')).toThrow(
            /ReadingsRenderer/,
        );
    });

    it('localizes the schema labels too', () => {
        const text = renderText('it', {
            vigil: { gospel: 'Mt 1:1-25' },
            day: { gospel: 'Jn 1:1-18' },
        });
        expect(text).toContain('Messa della vigilia');
        expect(text).toContain('Messa del giorno');
    });

    it('still accepts the class-name bag alongside a locale', () => {
        const container = document.createElement('div');
        new ReadingsRenderer({
            locale: 'it',
            readingsWrapperClassName: 'readings',
        }).renderReadings(FLAT, container);
        expect([...container.firstElementChild.classList]).toEqual([
            'readings',
        ]);
        expect(container.textContent).toContain('Prima lettura');
    });

    it('leaves the public statics English regardless of the locale', () => {
        new ReadingsRenderer('it');
        expect(ReadingsRenderer.readingLabels.first_reading).toBe(
            'First Reading',
        );
        expect(ReadingsRenderer.massLabels.vigil).toBe('Vigil Mass');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/__tests__/ReadingsRenderer.test.js -t "ReadingsRenderer locale"`
Expected: FAIL — the first assertion receives `'First Reading: Numeri 6:22-27'`.

- [ ] **Step 3: Add the imports and the locale field**

Add to the imports at the top of `src/ReadingsRenderer/ReadingsRenderer.js`:

```javascript
import { toIntlLocale } from '../LocaleValidation.js';
import { normalizeComponentOptions } from '../OptionsValidation.js';
```

Extend the `@typedef` block:

```javascript
/**
 * @typedef {Object} ReadingsRendererOptions
 * @property {string|Intl.Locale} [locale='en'] - The locale whose language the labels are read in.
 * @property {string} [readingsWrapperClassName=''] - CSS class for the readings wrapper element.
 * @property {string} [readingsLabelClassName=''] - CSS class for reading labels.
 * @property {string} [readingClassName=''] - CSS class for individual reading elements.
 */
```

Add beside the other private fields, after `#readingClassName`:

```javascript
    /** @type {Intl.Locale} */
    #locale;
```

- [ ] **Step 4: Rewrite the constructor**

Replace the whole existing constructor with:

```javascript
    /**
     * Creates a new ReadingsRenderer instance.
     *
     * @param {ReadingsRendererOptions|string|Intl.Locale|null} [options={}] - Configuration
     *        options, or a bare locale as a string or an `Intl.Locale`. `null` and
     *        `undefined` mean "not supplied", both as the argument and as the `locale`
     *        property, and yield English.
     * @throws {Error} If `options` is none of a string, an `Intl.Locale`, a plain object
     *         or nullish, or if the locale is invalid.
     */
    constructor(options = {}) {
        options = normalizeComponentOptions(options, 'ReadingsRenderer');
        // A nullish READ, not `Object.hasOwn`: `{ ...defaults, locale }` with an
        // unset `locale` is ordinary JavaScript and must not throw. Issue #32.
        this.#locale = toIntlLocale(
            options.locale ?? 'en',
            'ReadingsRenderer',
        );
        if (
            options.readingsWrapperClassName &&
            typeof options.readingsWrapperClassName === 'string'
        ) {
            this.#readingsWrapperClassName = options.readingsWrapperClassName;
        }
        if (
            options.readingsLabelClassName &&
            typeof options.readingsLabelClassName === 'string'
        ) {
            this.#readingsLabelClassName = options.readingsLabelClassName;
        }
        if (
            options.readingClassName &&
            typeof options.readingClassName === 'string'
        ) {
            this.#readingClassName = options.readingClassName;
        }
    }
```

- [ ] **Step 5: Resolve the reading label through the catalogue**

In `renderSingleReadings()`, replace:

```javascript
                labelEl.textContent =
                    ReadingsRenderer.readingLabels[key] + ': ';
```

with:

```javascript
                labelEl.textContent =
                    message(READING_MESSAGE_KEYS[key], this.#locale) + ': ';
```

Every key `renderSingleReadings()` iterates comes from `ReadingsRenderer.readingOrder`, and every one of
those is a key of `READING_MESSAGE_KEYS`, so the lookup cannot miss.

- [ ] **Step 6: Resolve the schema label through the catalogue**

In `renderReadings()`, replace:

```javascript
                    const schemaLabel =
                        ReadingsRenderer.massLabels[schemaKey] || schemaKey;
```

with:

```javascript
                    const schemaLabel = MASS_MESSAGE_KEYS[schemaKey]
                        ? message(MASS_MESSAGE_KEYS[schemaKey], this.#locale)
                        : schemaKey;
```

The `schemaKey` fallback is kept: it was there before, and `message()` throws for an unknown key rather
than returning the key, so the guard has to happen before the call rather than after it.

- [ ] **Step 7: Run tests**

Run: `yarn format:js:fix && yarn test`
Expected: PASS, all suites. The Task 2 characterization test must still be green — the statics stay English.

- [ ] **Step 8: Commit**

```bash
git add src/ReadingsRenderer/ReadingsRenderer.js src/__tests__/ReadingsRenderer.test.js
git commit -m "ReadingsRenderer renders its labels in the locale it is given (#105)

Follows the library-wide locale contract: string or Intl.Locale, bare or in the
bag, nullish meaning English, anything else rejected by name. The public
statics stay English — a static cannot know a locale."
```

---

### Task 4: The two widgets forward the locale they already hold

**Files:**

- Modify: `src/LiturgyOfTheDay/LiturgyOfTheDay.js:63` (field initializer) and its constructor
- Modify: `src/LiturgyOfAnyDay/LiturgyOfAnyDay.js:115` (field initializer) and its constructor
- Test: `src/__tests__/ReadingsLocaleWiring.test.js` (create)

**Interfaces:**

- Consumes: `new ReadingsRenderer( { locale } )` from Task 3.
- Produces: nothing further.

**The trap:** both classes construct the renderer as a **field initializer**, which runs BEFORE the
constructor body — so `this.#locale` is still `null` at that point. The construction must move into the
constructor body, after `this.#validateLocale( … )`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/ReadingsLocaleWiring.test.js`:

```javascript
/** @jest-environment jsdom */
import { describe, it, expect } from '@jest/globals';
import LiturgyOfTheDay from '../LiturgyOfTheDay/LiturgyOfTheDay.js';
import LiturgyOfAnyDay from '../LiturgyOfAnyDay/LiturgyOfAnyDay.js';

/**
 * Both widgets validate a locale into `#locale` and then build a
 * `ReadingsRenderer`. The renderer is not reachable from outside, so the wiring
 * is asserted through the DOM it produces: rendering a known readings object
 * and reading the label back.
 */
const renderReadingsVia = (widget, readings) => {
    const container = document.createElement('div');
    widget._readingsRenderer.renderReadings(readings, container);
    return container.textContent;
};

describe('the widgets forward their locale to ReadingsRenderer', () => {
    const READINGS = { first_reading: 'Numeri 6:22-27' };

    it('LiturgyOfTheDay renders readings labels in its own locale', () => {
        const widget = new LiturgyOfTheDay({ locale: 'it' });
        expect(renderReadingsVia(widget, READINGS)).toContain('Prima lettura');
    });

    it('LiturgyOfAnyDay renders readings labels in its own locale', () => {
        const widget = new LiturgyOfAnyDay({ locale: 'it' });
        expect(renderReadingsVia(widget, READINGS)).toContain('Prima lettura');
    });

    it('both default to English', () => {
        expect(renderReadingsVia(new LiturgyOfTheDay(), READINGS)).toContain(
            'First Reading',
        );
        expect(renderReadingsVia(new LiturgyOfAnyDay(), READINGS)).toContain(
            'First Reading',
        );
    });
});
```

This requires a package-internal `_readingsRenderer` getter on each widget — the same `_`-prefixed,
internal-accessor convention `ApiOptions._filter` and `CalendarSelect._base` already use, and documented
in CLAUDE.md as meaning "internal, no canonical alias". Add to each class:

```javascript
    /**
     * The readings renderer, for tests asserting the locale reached it.
     *
     * Package-internal, hence the underscore: see CLAUDE.md on what the prefix
     * means. Not part of the public API and not exported in any documentation.
     *
     * @returns {ReadingsRenderer} The renderer this widget renders readings with.
     */
    get _readingsRenderer() {
        return this.#readingsRenderer;
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/__tests__/ReadingsLocaleWiring.test.js`
Expected: FAIL — `Cannot read properties of undefined (reading 'renderReadings')`, because the getter does
not exist yet.

- [ ] **Step 3: Move the renderer construction in `LiturgyOfTheDay`**

At `src/LiturgyOfTheDay/LiturgyOfTheDay.js:62-63`, change the field initializer from:

```javascript
    /** @type {ReadingsRenderer} */
    #readingsRenderer = new ReadingsRenderer();
```

to:

```javascript
    /**
     * @type {ReadingsRenderer}
     * Assigned in the constructor, not here: a field initializer runs BEFORE the
     * constructor body, so `#locale` would still be null and every label would
     * come out English however the widget was constructed.
     */
    #readingsRenderer;
```

In the constructor, immediately after `this.#validateLocale(options.locale ?? 'en');`:

```javascript
        this.#readingsRenderer = new ReadingsRenderer({
            locale: this.#locale,
        });
```

Then add the `_readingsRenderer` getter from Step 1 beside the class's other getters.

- [ ] **Step 4: Do the same in `LiturgyOfAnyDay`**

At `src/LiturgyOfAnyDay/LiturgyOfAnyDay.js:114-115`, apply the identical change: replace the field
initializer with a bare `#readingsRenderer;` carrying the same comment, assign
`this.#readingsRenderer = new ReadingsRenderer({ locale: this.#locale });` immediately after
`this.#validateLocale(options.locale ?? 'en');` at line ~188, and add the same `_readingsRenderer` getter.

- [ ] **Step 5: Run the full suite**

Run: `yarn format:js:fix && yarn test`
Expected: PASS. Watch especially `LiturgyOfTheDay`'s and `LiturgyOfAnyDay`'s own suites — if either
constructs the renderer before validating the locale, a `TypeError` on `undefined` surfaces there first.

- [ ] **Step 6: Commit**

```bash
git add src/LiturgyOfTheDay/LiturgyOfTheDay.js src/LiturgyOfAnyDay/LiturgyOfAnyDay.js src/__tests__/ReadingsLocaleWiring.test.js
git commit -m "Forward each widget's locale to its ReadingsRenderer (#105)

The renderer moves from a field initializer into the constructor body: a field
initializer runs before the constructor, so #locale was still null and every
label came out English however the widget was constructed."
```

---

### Task 5: Documentation and changelog

**Files:**

- Modify: `docs/readings-renderer.md` — the "The labels are English…" paragraph and the constructor-options table
- Modify: `CLAUDE.md` — the `ReadingsRenderer` section's third bullet
- Modify: `CHANGELOG.md` — a new `[Unreleased]` section
- Modify: `type-fixtures/dts-consumer.ts` — assert the constructor's locale forms reach `dist/`

**Interfaces:**

- Consumes: everything from Tasks 1–4.
- Produces: nothing.

- [ ] **Step 1: Add the `.d.ts` assertion**

Append to `type-fixtures/dts-consumer.ts`:

```typescript
/**
 * #105: `ReadingsRenderer`'s constructor must accept all three locale forms in
 * the emitted declarations, not only the options bag.
 *
 * An explicitly typed binding on each, because a bare literal would compile
 * against a loose `Object` parameter regardless of shape and prove nothing —
 * the same trap the `scope` block above describes.
 */
type ReadingsRendererCtorArg = ConstructorParameters<
    typeof ReadingsRenderer
>[0];

const readingsLocaleAsString: ReadingsRendererCtorArg = 'it';
const readingsLocaleAsIntl: ReadingsRendererCtorArg = new Intl.Locale('it-IT');
const readingsLocaleInBag: ReadingsRendererCtorArg = {
    locale: 'it',
    readingClassName: 'mb-1',
};
void readingsLocaleAsString;
void readingsLocaleAsIntl;
void readingsLocaleInBag;
```

- [ ] **Step 2: Verify the declarations**

Run: `yarn compile && yarn lint:dts`
Expected: both exit 0. If the constructor emitted only `options?: ReadingsRendererOptions`, the union in
the `@param` tag was not written as in Task 3 Step 4 — fix the JSDoc, not the fixture.

- [ ] **Step 3: Update `docs/readings-renderer.md`**

Replace this paragraph:

```markdown
The labels are English. Localizing them is not yet implemented, in this component or anywhere else in the
library's readings handling.
```

with:

```markdown
### Locale

The labels are localized. `ReadingsRenderer` takes a locale exactly as every other component in this
library does — a `string` or an `Intl.Locale`, interchangeably, as the bare constructor argument or the
options bag's `locale` property:

    const renderer = new ReadingsRenderer('it');
    const renderer = new ReadingsRenderer({ locale: 'it', readingClassName: 'mb-1' });

`null` and `undefined` both mean "not supplied" and yield English. Anything else is rejected, naming the
component and the type found; an unparseable locale throws rather than silently falling back.

A locale whose catalogue block does not carry a readings key falls back to that key's English, per
`message()`. Only `en`, `it` and `la` are populated today — every other locale renders English labels,
which is the documented normal case for a partly translated key.

**The two static maps stay English whatever locale a renderer is given**, because a static cannot know
one. They remain the vocabulary and the render order; a localized label comes from rendering.
```

Add a `locale` row to the Constructor Options table, above `readingsWrapperClassName`:

```markdown
| `locale`                   | `string` \| `Intl.Locale` | `'en'` | Language the labels are read in |
```

- [ ] **Step 4: Update `CLAUDE.md`**

In the `## ReadingsRenderer` section, replace this bullet:

```markdown
- **The labels are English and are NOT routed through `Messages.js`.** That is a real gap, deliberately
  left as its own issue rather than folded into the export: #97 asked for the vocabulary to be reachable,
  and localizing it would change what every existing consumer of `LiturgyOfTheDay` renders.
```

with:

```markdown
- **The labels ARE routed through `Messages.js` (#105), and the English is DERIVED, not restated.**
  `READING_MESSAGE_KEYS` and `MASS_MESSAGE_KEYS` map each key to its `Messages` key; the public
  `readingLabels`/`massLabels` are built from `Messages.en` through them, so the English lives in one
  place. **Their key ORDER is load-bearing**: it becomes the public maps' order, which is the render order
  and — via `#nestedSchemaKeys` — the key set `hasNestedSchemas()` recognises. A hand-written second
  statement of both maps in `ReadingsRenderer.test.js` pins this; do not "simplify" it into reading
  `Messages.en` back, which would agree with itself.
- **The statics stay ENGLISH whatever locale a renderer holds**, because a static cannot know one. There
  is deliberately no `readingLabel( key, locale )` accessor pair: it was proposed and declined as
  speculative surface, and the likely future answer is a consumer-supplied translation bundle, which
  subsumes it. So a consumer rendering its own markup reads English labels — an accepted cost, recorded in
  the design doc rather than discovered later.
- **Only `en`, `it` and `la` are populated.** The other 81 blocks fall back through `message()`, the
  documented normal case. `it`/`la` were drafted for maintainer review; `MASS_VIGIL`'s Italian
  deliberately matches the API's own `Messa della vigilia` so the two projects agree.
```

- [ ] **Step 5: Add the changelog entry**

Insert immediately above `## 2.10.0` in `CHANGELOG.md`:

```markdown
## [Unreleased]

### Changed

- **`ReadingsRenderer` renders its labels in the locale it is given**, closing #105. Every non-English
  page using `LiturgyOfTheDay` or `LiturgyOfAnyDay` renders different text: this is the defect being
  fixed, not a side effect. The API already serves the lectionary per locale, so a non-English page was
  rendering an English label against a localized citation — `First Reading: Numeri 6:22-27`.

  The renderer now takes a locale under the library-wide contract (a `string` or an `Intl.Locale`, bare or
  as the bag's `locale`; nullish means English; anything else is rejected by name), and `LiturgyOfTheDay`
  and `LiturgyOfAnyDay` forward the locale they already held. There is no opt-out: a consumer wanting
  English passes `'en'`.

  Twenty-two keys were added to `Messages.js`, populated for `en`, `it` and `la`. Every other locale falls
  back to English through `message()`, which is the documented normal case for a partly translated key.
  **The Italian and Latin are drafts pending review against the Missal.**

- **The public `readingLabels` and `massLabels` are now derived from `Messages.en`** rather than restating
  it. **No behaviour change** — a characterization test pins both against a hand-written copy of the
  published values, key order included, and was green before the refactor. They stay English, frozen, and
  keep the same keys in the same order; a static cannot know a locale.
```

- [ ] **Step 6: Run every gate**

Run: `yarn compile && yarn test && yarn lint:dts && yarn format:js && yarn format:md && yarn lint:md`
Expected: all six exit 0. If `format:md` reports the changed files, run `yarn format:md:fix` and re-check.

- [ ] **Step 7: Commit**

```bash
git add docs/readings-renderer.md CLAUDE.md CHANGELOG.md type-fixtures/dts-consumer.ts
git commit -m "Document the readings label localization (#105)

Records the derivation rule and its load-bearing key order, the declined
accessor pair, and that it/la are drafts pending review against the Missal."
```

---

## Final verification

- [ ] `yarn compile && yarn test && yarn lint:dts && yarn format:js && yarn format:md && yarn lint:md` — all six exit 0
- [ ] `git log --oneline main..HEAD` shows five commits, one per task
- [ ] Open the PR **flagging the Italian and Latin as drafts needing review against the Missal** — this is the one thing in the change a reviewer cannot check by reading the diff
