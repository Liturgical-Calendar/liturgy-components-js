# Localize the `ApiOptions` input labels — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps
> use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every `ApiOptions`/`LiturgyOfAnyDay` form control renders a localized `<label>` instead of the raw snake_case API parameter name, for every consumer — meta-component or not.

**Architecture:** Each `Input` subclass looks its own label up in `Messages` from the locale it already
receives, through one shared internal helper that applies the `??` English fallback. Theming continues to
overwrite the label after construction, so a theme-supplied `labelText` still wins.

**Tech Stack:** ES2022 JavaScript modules, Jest 29 (jsdom), prettier, markdownlint-cli2, Yarn 4 PnP.

## Global Constraints

- Work only in `/home/johnrdorazio/development/LiturgicalCalendar/liturgy-components-js/.claude/worktrees/issue-59`, branch `feat/localize-api-options-input-labels`.
- Every `Messages` read added by this plan MUST use `Messages[language]?.[KEY] ?? Messages['en'][KEY]`.
  Do not "fix" any pre-existing unguarded read (`EpiphanyInput`, `EternalHighPriestInput`, `YearTypeInput`,
  `CalendarPathInput`) — that is issue #69.
- `src/MetaComponents/Theme.js`: comments only. No code change, no restructuring of override resolution (issue #60 owns it).
- Do not rename or alias `ApiOptions`' underscore accessors (issue #62 on hold). Do not add aria-live regions (issue #65 on hold).
- Do not add a public `Input.labelText()` setter.
- Formatting: prettier owns `src/`. Run `yarn format:js:fix` before each commit.
- The twelve translated locales, in this exact order, are the same twelve that already carry `SELECT_A_RITE`: `de en es fr hu id it la nl pt sk vi`.
- Baseline before any change: 64 suites / 1191 tests passing.

---

### Task 1: Six new `Messages` keys

**Files:**

- Modify: `src/Messages.js` (twelve locale blocks)
- Test: `src/__tests__/Messages.test.js`

**Interfaces:**

- Produces: `Messages[lang].YEAR_TYPE`, `.EPIPHANY`, `.ASCENSION`, `.CORPUS_CHRISTI`,
  `.ETERNAL_HIGH_PRIEST`, `.HOLYDAYS_OF_OBLIGATION` — all `string`, defined for exactly the twelve
  locales above.

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/Messages.test.js`:

```javascript
describe('ApiOptions input label keys', () => {
    // The same twelve locales that already carry SELECT_A_RITE, DAY, YEAR and
    // LANGUAGE. Every other block reaches English through the `??` fallback.
    const TRANSLATED = [
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

    const LABEL_KEYS = [
        'YEAR_TYPE',
        'EPIPHANY',
        'ASCENSION',
        'CORPUS_CHRISTI',
        'ETERNAL_HIGH_PRIEST',
        'HOLYDAYS_OF_OBLIGATION',
    ];

    it.each(LABEL_KEYS)('defines %s in English, the fallback for all', (key) => {
        expect(typeof Messages['en'][key]).toBe('string');
        expect(Messages['en'][key].length).toBeGreaterThan(0);
    });

    it.each(TRANSLATED)('defines every label key for %s', (lang) => {
        LABEL_KEYS.forEach((key) => {
            expect(typeof Messages[lang][key]).toBe('string');
            expect(Messages[lang][key].length).toBeGreaterThan(0);
        });
    });

    it.each(LABEL_KEYS)('gives %s the same coverage as SELECT_A_RITE', (key) => {
        const withRite = Object.keys(Messages).filter(
            (lang) => undefined !== Messages[lang].SELECT_A_RITE,
        );
        const withKey = Object.keys(Messages).filter(
            (lang) => undefined !== Messages[lang][key],
        );
        expect(withKey.sort()).toEqual(withRite.sort());
    });

    it('reuses DAY, MONTH, YEAR and LANGUAGE rather than adding parallel keys', () => {
        expect(Messages['en'].DAY).toBe('Day');
        expect(Messages['en'].MONTH).toBe('Month');
        expect(Messages['en'].YEAR).toBe('Year');
        expect(Messages['en'].LANGUAGE).toBe('Language');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/Messages.test.js`
Expected: FAIL — `expected undefined to be a string` for `YEAR_TYPE` and the rest.

- [ ] **Step 3: Add the keys to the twelve blocks**

In `src/Messages.js`, insert the six keys into each of the twelve blocks, immediately after that block's
`COPIED_TO_CLIPBOARD` entry (which is the last of the 2.7.0 cluster and present in exactly these twelve).
Values verbatim:

```javascript
// de
YEAR_TYPE: 'Jahrestyp',
EPIPHANY: 'Erscheinung des Herrn',
ASCENSION: 'Christi Himmelfahrt',
CORPUS_CHRISTI: 'Fronleichnam',
ETERNAL_HIGH_PRIEST: 'Jesus Christus, Ewiger Hoherpriester',
HOLYDAYS_OF_OBLIGATION: 'Gebotene Feiertage',

// en
YEAR_TYPE: 'Year Type',
EPIPHANY: 'Epiphany',
ASCENSION: 'Ascension',
CORPUS_CHRISTI: 'Corpus Christi',
ETERNAL_HIGH_PRIEST: 'Eternal High Priest',
HOLYDAYS_OF_OBLIGATION: 'Holy Days of Obligation',

// es
YEAR_TYPE: 'Tipo de año',
EPIPHANY: 'Epifanía',
ASCENSION: 'Ascensión del Señor',
CORPUS_CHRISTI: 'Corpus Christi',
ETERNAL_HIGH_PRIEST: 'Jesucristo, Sumo y Eterno Sacerdote',
HOLYDAYS_OF_OBLIGATION: 'Fiestas de precepto',

// fr
YEAR_TYPE: "Type d'année",
EPIPHANY: 'Épiphanie',
ASCENSION: 'Ascension',
CORPUS_CHRISTI: 'Fête-Dieu',
ETERNAL_HIGH_PRIEST: 'Jésus-Christ, Souverain Prêtre',
HOLYDAYS_OF_OBLIGATION: "Fêtes d'obligation",

// hu
YEAR_TYPE: 'Év típusa',
EPIPHANY: 'Vízkereszt',
ASCENSION: 'Urunk mennybemenetele',
CORPUS_CHRISTI: 'Úrnapja',
ETERNAL_HIGH_PRIEST: 'Jézus Krisztus, az örök főpap',
HOLYDAYS_OF_OBLIGATION: 'Kötelező ünnepek',

// id
YEAR_TYPE: 'Jenis tahun',
EPIPHANY: 'Penampakan Tuhan',
ASCENSION: 'Kenaikan Tuhan',
CORPUS_CHRISTI: 'Tubuh dan Darah Kristus',
ETERNAL_HIGH_PRIEST: 'Yesus Kristus Imam Agung Abadi',
HOLYDAYS_OF_OBLIGATION: 'Hari Raya Wajib',

// it
YEAR_TYPE: 'Tipo di anno',
EPIPHANY: 'Epifania',
ASCENSION: 'Ascensione',
CORPUS_CHRISTI: 'Corpus Domini',
ETERNAL_HIGH_PRIEST: 'Gesù Cristo Sommo ed Eterno Sacerdote',
HOLYDAYS_OF_OBLIGATION: 'Feste di precetto',

// la
YEAR_TYPE: 'Genus anni',
EPIPHANY: 'Epiphania',
ASCENSION: 'Ascensio Domini',
CORPUS_CHRISTI: 'Corpus Christi',
ETERNAL_HIGH_PRIEST: 'Iesus Christus Summus et Aeternus Sacerdos',
HOLYDAYS_OF_OBLIGATION: 'Festa de praecepto',

// nl
YEAR_TYPE: 'Jaartype',
EPIPHANY: 'Openbaring des Heren',
ASCENSION: 'Hemelvaart van de Heer',
CORPUS_CHRISTI: 'Sacramentsdag',
ETERNAL_HIGH_PRIEST: 'Jezus Christus, eeuwige Hogepriester',
HOLYDAYS_OF_OBLIGATION: 'Verplichte feestdagen',

// pt
YEAR_TYPE: 'Tipo de ano',
EPIPHANY: 'Epifania',
ASCENSION: 'Ascensão do Senhor',
CORPUS_CHRISTI: 'Corpus Christi',
ETERNAL_HIGH_PRIEST: 'Jesus Cristo, Sumo e Eterno Sacerdote',
HOLYDAYS_OF_OBLIGATION: 'Festas de preceito',

// sk
YEAR_TYPE: 'Typ roka',
EPIPHANY: 'Zjavenie Pána',
ASCENSION: 'Nanebovstúpenie Pána',
CORPUS_CHRISTI: 'Božie telo',
ETERNAL_HIGH_PRIEST: 'Ježiš Kristus, najvyšší a večný kňaz',
HOLYDAYS_OF_OBLIGATION: 'Prikázané sviatky',

// vi
YEAR_TYPE: 'Loại năm',
EPIPHANY: 'Lễ Hiển Linh',
ASCENSION: 'Lễ Chúa Thăng Thiên',
CORPUS_CHRISTI: 'Lễ Mình và Máu Thánh Chúa',
ETERNAL_HIGH_PRIEST: 'Chúa Giêsu Kitô, Thượng Tế đời đời',
HOLYDAYS_OF_OBLIGATION: 'Lễ buộc',
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test src/__tests__/Messages.test.js`
Expected: PASS.

- [ ] **Step 5: Format and commit**

```bash
yarn format:js:fix
git add src/Messages.js src/__tests__/Messages.test.js
git commit -m "Add six ApiOptions input label keys to Messages (#59)"
```

---

### Task 2: The shared `defaultLabelText()` helper

**Files:**

- Create: `src/ApiOptions/Input/InputLabels.js`
- Test: `src/__tests__/InputLabels.test.js`

**Interfaces:**

- Consumes: `Messages` from Task 1.
- Produces: `export function defaultLabelText( key, locale = null ): string`. `locale` is
  `Intl.Locale | null`; `null` (or a locale whose language has no block) yields the English value.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/InputLabels.test.js`:

```javascript
import { describe, it, expect } from '@jest/globals';
import { defaultLabelText } from '../ApiOptions/Input/InputLabels.js';
import Messages from '../Messages.js';

describe('defaultLabelText', () => {
    it('returns the English message when no locale is supplied', () => {
        expect(defaultLabelText('YEAR_TYPE')).toBe('Year Type');
        expect(defaultLabelText('YEAR_TYPE', null)).toBe('Year Type');
    });

    it('returns the message for the locale language', () => {
        expect(defaultLabelText('YEAR_TYPE', new Intl.Locale('it-IT'))).toBe(
            Messages['it']['YEAR_TYPE'],
        );
    });

    it('falls back to English for a language with no block at all', () => {
        // `zz` is not one of the 84 blocks: the optional chain must not throw.
        expect(defaultLabelText('YEAR_TYPE', new Intl.Locale('zz'))).toBe(
            'Year Type',
        );
    });

    it('falls back to English for a block that lacks the key', () => {
        // `zh` is a real block, but carries none of the twelve-locale keys.
        expect(Messages['zh']['YEAR_TYPE']).toBeUndefined();
        expect(defaultLabelText('YEAR_TYPE', new Intl.Locale('zh'))).toBe(
            'Year Type',
        );
    });

    it('reads a key present in every block from that block', () => {
        expect(defaultLabelText('MONTH', new Intl.Locale('zh'))).toBe(
            Messages['zh']['MONTH'],
        );
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/InputLabels.test.js`
Expected: FAIL — `Cannot find module '../ApiOptions/Input/InputLabels.js'`.

- [ ] **Step 3: Write the implementation**

Create `src/ApiOptions/Input/InputLabels.js`:

```javascript
/**
 * The default `<label>` text for an `ApiOptions` input, looked up in `Messages`.
 *
 * Every `Input` subclass used to hardcode its label to the raw snake_case API
 * parameter name — `year_type`, `epiphany`, `holydays_of_obligation` — which is
 * what a screen reader announced for the control in every language (issue #59).
 * Localizing here, in the constructor's own lookup rather than in a
 * meta-component's theming pass, is what reaches a consumer who constructs
 * `new ApiOptions( 'it' )` directly: `ApiOptions` is public API in its own right,
 * and the theme path only covers callers who mount a meta-component.
 *
 * A theme-supplied `labelText` still wins, because all theming is applied AFTER
 * construction — see `Theme.js`'s `applyLocaleInputTheme()` and
 * `LiturgyOfAnyDay`'s three `*InputConfig()` bags.
 *
 * Deliberately NOT exported from `src/index.js`, on the same reasoning as
 * `LocaleValidation.js`, `OptionsValidation.js` and `WrapperOptions.js`: internal
 * contract between the components, not public API.
 *
 * **The `??` fallback is the point of this function existing** rather than ten
 * inlined lookups. `Messages` holds 84 unevenly populated locale blocks, so an
 * unguarded `Messages[language][key]` throws for a language with no block and
 * yields `undefined` for a block missing the key. Centralizing the guard makes
 * that class of bug impossible for these labels.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import Messages from '../../Messages.js';

/**
 * Looks up a label in the message catalogue, falling back to English.
 *
 * @param {string} key - The `Messages` key, e.g. `YEAR_TYPE`.
 * @param {Intl.Locale|null} [locale=null] - The locale whose language to read.
 *        `null` means "not supplied" and yields the English message, which is the
 *        only sane default for an input constructed without a locale.
 * @returns {string} The localized label, or the English one.
 */
export function defaultLabelText(key, locale = null) {
    const language = locale?.language ?? 'en';
    return Messages[language]?.[key] ?? Messages['en'][key];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test src/__tests__/InputLabels.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Format and commit**

```bash
yarn format:js:fix
git add src/ApiOptions/Input/InputLabels.js src/__tests__/InputLabels.test.js
git commit -m "Add the shared defaultLabelText() label lookup (#59)"
```

---

### Task 3: Localize all ten input labels

**Files:**

- Modify: `src/ApiOptions/Input/AscensionInput.js`, `CorpusChristiInput.js`, `EpiphanyInput.js`,
  `EternalHighPriestInput.js`, `YearTypeInput.js`, `LocaleInput.js`, `MonthInput.js` (label line only)
- Modify: `src/ApiOptions/Input/DayInput.js`, `YearInput.js`, `HolydaysOfObligationInput.js` (new optional `locale` parameter)
- Modify: `src/ApiOptions/ApiOptions.js:218-220` (pass `this.#locale`)
- Modify: `src/LiturgyOfAnyDay/LiturgyOfAnyDay.js:195,197` (pass `this.#locale`)
- Test: `src/__tests__/InputLabelLocalization.test.js`

**Interfaces:**

- Consumes: `defaultLabelText( key, locale )` from Task 2.
- Produces: `new DayInput( locale = null )`, `new YearInput( locale = null )`, `new HolydaysOfObligationInput( options = [], locale = null )`.

**Key → input mapping (do not invent others):**

| Class                       | Key                      |
| --------------------------- | ------------------------ |
| `AscensionInput`            | `ASCENSION`              |
| `CorpusChristiInput`        | `CORPUS_CHRISTI`         |
| `EpiphanyInput`             | `EPIPHANY`               |
| `EternalHighPriestInput`    | `ETERNAL_HIGH_PRIEST`    |
| `HolydaysOfObligationInput` | `HOLYDAYS_OF_OBLIGATION` |
| `YearTypeInput`             | `YEAR_TYPE`              |
| `YearInput`                 | `YEAR`                   |
| `DayInput`                  | `DAY`                    |
| `MonthInput`                | `MONTH`                  |
| `LocaleInput`               | `LANGUAGE`               |

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/InputLabelLocalization.test.js`:

```javascript
/**
 * Issue #59: every ApiOptions input rendered the raw snake_case API parameter
 * name as its `<label>`, in every language. These tests pin the localized label
 * to the input's own constructor, which is the layer a consumer who writes
 * `new ApiOptions( 'it' )` — with no meta-component anywhere — actually reaches.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import Messages from '../Messages.js';
import Input from '../ApiOptions/Input/Input.js';
import AscensionInput from '../ApiOptions/Input/AscensionInput.js';
import CorpusChristiInput from '../ApiOptions/Input/CorpusChristiInput.js';
import EpiphanyInput from '../ApiOptions/Input/EpiphanyInput.js';
import EternalHighPriestInput from '../ApiOptions/Input/EternalHighPriestInput.js';
import HolydaysOfObligationInput from '../ApiOptions/Input/HolydaysOfObligationInput.js';
import YearTypeInput from '../ApiOptions/Input/YearTypeInput.js';
import YearInput from '../ApiOptions/Input/YearInput.js';
import DayInput from '../ApiOptions/Input/DayInput.js';
import MonthInput from '../ApiOptions/Input/MonthInput.js';

/** Every input that requires a locale, with the Messages key it must use. */
const LOCALE_REQUIRED = [
    ['AscensionInput', AscensionInput, 'ASCENSION'],
    ['CorpusChristiInput', CorpusChristiInput, 'CORPUS_CHRISTI'],
    ['EpiphanyInput', EpiphanyInput, 'EPIPHANY'],
    ['EternalHighPriestInput', EternalHighPriestInput, 'ETERNAL_HIGH_PRIEST'],
    ['YearTypeInput', YearTypeInput, 'YEAR_TYPE'],
    ['MonthInput', MonthInput, 'MONTH'],
];

/** Every input whose locale is optional, with its Messages key. */
const LOCALE_OPTIONAL = [
    ['YearInput', YearInput, 'YEAR'],
    ['DayInput', DayInput, 'DAY'],
];

beforeEach(() => {
    Input.reset();
});

describe('localized input labels', () => {
    it.each(LOCALE_REQUIRED)(
        '%s renders the English label for en',
        (_name, Klass, key) => {
            const input = new Klass(new Intl.Locale('en'));
            expect(input._labelElement.textContent).toBe(Messages['en'][key]);
        },
    );

    it.each(LOCALE_REQUIRED)(
        '%s renders the Italian label for it',
        (_name, Klass, key) => {
            const input = new Klass(new Intl.Locale('it-IT'));
            expect(input._labelElement.textContent).toBe(Messages['it'][key]);
        },
    );

    it.each(LOCALE_REQUIRED)(
        '%s falls back to English for a language with no catalogue block',
        (_name, Klass, key) => {
            const input = new Klass(new Intl.Locale('zz'));
            expect(input._labelElement.textContent).toBe(Messages['en'][key]);
        },
    );

    it.each(LOCALE_OPTIONAL)(
        '%s renders the English label when constructed with no locale',
        (_name, Klass, key) => {
            const input = new Klass();
            expect(input._labelElement.textContent).toBe(Messages['en'][key]);
        },
    );

    it.each(LOCALE_OPTIONAL)(
        '%s renders the Italian label when given a locale',
        (_name, Klass, key) => {
            const input = new Klass(new Intl.Locale('it-IT'));
            expect(input._labelElement.textContent).toBe(Messages['it'][key]);
        },
    );

    it.each(LOCALE_OPTIONAL)(
        '%s rejects a non-Intl.Locale locale',
        (name, Klass) => {
            expect(() => new Klass('it-IT')).toThrow(name);
        },
    );

    it('HolydaysOfObligationInput renders the English label with no locale', () => {
        const input = new HolydaysOfObligationInput();
        expect(input._labelElement.textContent).toBe(
            Messages['en']['HOLYDAYS_OF_OBLIGATION'],
        );
    });

    it('HolydaysOfObligationInput renders the Italian label when given a locale', () => {
        const input = new HolydaysOfObligationInput(
            [],
            new Intl.Locale('it-IT'),
        );
        expect(input._labelElement.textContent).toBe(
            Messages['it']['HOLYDAYS_OF_OBLIGATION'],
        );
    });

    it('HolydaysOfObligationInput rejects a non-Intl.Locale locale', () => {
        expect(() => new HolydaysOfObligationInput([], 'it-IT')).toThrow(
            'HolydaysOfObligationInput',
        );
    });

    it('no input ships its raw API parameter name as a label', () => {
        const raw = [
            'ascension',
            'corpus_christi',
            'epiphany',
            'eternal_high_priest',
            'year_type',
            'month',
            'year',
            'day',
            'holydays_of_obligation',
        ];
        const labels = [
            ...LOCALE_REQUIRED.map(
                ([, Klass]) =>
                    new Klass(new Intl.Locale('it-IT'))._labelElement
                        .textContent,
            ),
            ...LOCALE_OPTIONAL.map(
                ([, Klass]) =>
                    new Klass(new Intl.Locale('it-IT'))._labelElement
                        .textContent,
            ),
            new HolydaysOfObligationInput([], new Intl.Locale('it-IT'))
                ._labelElement.textContent,
        ];
        labels.forEach((label) => expect(raw).not.toContain(label));
    });
});
```

Then, in the same file, the two integration checks that the escape hatches still win:

```javascript
import ApiOptions from '../ApiOptions/ApiOptions.js';
import ApiBase from '../ApiClient/ApiBase.js';
import metadata from '../__fixtures__/metadata.js';
import { applyLocaleInputTheme } from '../MetaComponents/Theme.js';

describe('a caller-supplied label still wins', () => {
    beforeEach(() => {
        ApiBase.reset();
        Input.reset();
        ApiBase.fromMetadata('http://localhost:8000', metadata);
    });

    it('ApiOptions localizes every one of its inputs with no theming at all', () => {
        const apiOptions = new ApiOptions('it');
        expect(apiOptions._localeInput._labelElement.textContent).toBe(
            Messages['it']['LANGUAGE'],
        );
        expect(apiOptions._yearTypeInput._labelElement.textContent).toBe(
            Messages['it']['YEAR_TYPE'],
        );
        expect(apiOptions._yearInput._labelElement.textContent).toBe(
            Messages['it']['YEAR'],
        );
        expect(apiOptions._epiphanyInput._labelElement.textContent).toBe(
            Messages['it']['EPIPHANY'],
        );
        expect(apiOptions._ascensionInput._labelElement.textContent).toBe(
            Messages['it']['ASCENSION'],
        );
        expect(apiOptions._corpusChristiInput._labelElement.textContent).toBe(
            Messages['it']['CORPUS_CHRISTI'],
        );
        expect(
            apiOptions._eternalHighPriestInput._labelElement.textContent,
        ).toBe(Messages['it']['ETERNAL_HIGH_PRIEST']);
        expect(
            apiOptions._holydaysOfObligationInput._labelElement.textContent,
        ).toBe(Messages['it']['HOLYDAYS_OF_OBLIGATION']);
    });

    it('a theme-supplied labelText overrides the constructor default', () => {
        const apiOptions = new ApiOptions('it');
        applyLocaleInputTheme(
            apiOptions._localeInput,
            { labelText: 'Idioma' },
            Messages['it']['LANGUAGE'],
        );
        expect(apiOptions._localeInput._labelElement.textContent).toBe(
            'Idioma',
        );
    });
});
```

Note: confirm the fixture module path and export name before writing this block —
follow whatever `src/__tests__/CalendarControls.test.js` already imports, and reuse it verbatim. If the
accessor names differ from the guesses above, take them from `ApiOptions`' own getters; do not rename them.

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/InputLabelLocalization.test.js`
Expected: FAIL — labels come back as `'ascension'`, `'year_type'`, … and the three
`rejects a non-Intl.Locale locale` cases do not throw.

- [ ] **Step 3: Localize the six locale-requiring inputs**

In each of `AscensionInput.js`, `CorpusChristiInput.js`, `EpiphanyInput.js`,
`EternalHighPriestInput.js`, `YearTypeInput.js`:

1. Add `import { defaultLabelText } from './InputLabels.js';` below the existing imports.
2. Delete the `this._labelElement.textContent = '<raw>';` line from its current position (immediately
   after `_claimDefaultId`).
3. Re-add it immediately **after** the two locale guards (`locale === null` and
   `instanceof Intl.Locale`), as `this._labelElement.textContent = defaultLabelText( '<KEY>', locale );`.

`_domElement.name` and `_claimDefaultId()` stay exactly where they are, so which ids a throwing constructor
has already claimed does not change.

For `MonthInput.js`, the guard already precedes the label line; only replace the string:

```javascript
this._labelElement.textContent = defaultLabelText('MONTH', locale);
```

For `LocaleInput.js`, the `'locale'` assignment sits above both the base guard and the locale guards. Move it
below them, keyed on `LANGUAGE`:

```javascript
this._labelElement.textContent = defaultLabelText('LANGUAGE', locale);
```

- [ ] **Step 4: Give `DayInput`, `YearInput` and `HolydaysOfObligationInput` a locale**

`DayInput.js` — new signature and guard, JSDoc updated:

```javascript
    /**
     * Constructor for DayInput class.
     *
     * Sets the name, id, and localized label text of the input element, a minimum
     * of 1, a maximum of 31 and a step of 1, and the current day as the default.
     *
     * @param {Intl.Locale|null} [locale=null] - The locale whose `DAY` label to use.
     *        `null` means "not supplied" and yields the English label.
     * @throws {Error} If `locale` is neither `null` nor an `Intl.Locale`.
     * @memberof DayInput
     */
    constructor(locale = null) {
        super();
        if (null !== locale && false === locale instanceof Intl.Locale) {
            throw new Error(
                'DayInput: Invalid type for locale, must be of type `Intl.Locale` but found type: ' +
                    typeof locale,
            );
        }
        this._domElement.name = 'day';
        this._claimDefaultId('day');
        this._labelElement.textContent = defaultLabelText('DAY', locale);
        this._domElement.min = 1;
        this._domElement.max = 31;
        this._domElement.step = 1;
        this._domElement.value = new Date().getDate();
    }
```

with `import { defaultLabelText } from './InputLabels.js';` added at the top.

`YearInput.js` — same shape, `'YearInput:'` in the message, `defaultLabelText( 'YEAR', locale )`, and the
existing `min`/`max`/`step`/`value` lines left untouched.

`HolydaysOfObligationInput.js` — the locale is a **second** parameter, after the existing `options`:

```javascript
    constructor(options = [], locale = null) {
        super(true);
        if (null !== locale && false === locale instanceof Intl.Locale) {
            throw new Error(
                'HolydaysOfObligationInput: Invalid type for locale, must be of type `Intl.Locale` but found type: ' +
                    typeof locale,
            );
        }
        this._domElement.name = 'holydays_of_obligation';
        this._claimDefaultId('holydays_of_obligation');
        this._labelElement.textContent = defaultLabelText(
            'HOLYDAYS_OF_OBLIGATION',
            locale,
        );
        // ... the existing #options block, unchanged
    }
```

with the import added and the `@param {Intl.Locale|null} [locale=null]` line added to its JSDoc.

- [ ] **Step 5: Update the four call sites**

`src/ApiOptions/ApiOptions.js`:

```javascript
this.#inputs.holydaysOfObligationInput = new HolydaysOfObligationInput(
    [],
    this.#locale,
);
this.#inputs.localeInput = new LocaleInput(this.#locale, this.#base);
this.#inputs.yearInput = new YearInput(this.#locale);
```

`src/LiturgyOfAnyDay/LiturgyOfAnyDay.js` (around lines 195-197):

```javascript
this.#dayInput = new DayInput(this.#locale);
this.#monthInput = new MonthInput(this.#locale);
this.#yearInput = new YearInput(this.#locale);
```

Check that `LiturgyOfAnyDay.#locale` is an `Intl.Locale` at that point — it is the value already handed to
`MonthInput`, which throws on anything else, so it is. If a later refactor changes that, the new guards will
say so loudly rather than silently mislabelling.

- [ ] **Step 6: Run the new test to verify it passes**

Run: `yarn test src/__tests__/InputLabelLocalization.test.js`
Expected: PASS.

- [ ] **Step 7: Run the whole suite for regressions**

Run: `yarn test`
Expected: every suite passes. Two existing assertions (`SubscriptionBuilder.test.js:222` and
`DayViewerLocaleInputTheme.test.js:36`) assert the locale label is `not.toBe('locale')` — they must still
pass, now for a second reason.

- [ ] **Step 8: Format and commit**

```bash
yarn format:js:fix
git add src/ApiOptions src/LiturgyOfAnyDay src/__tests__/InputLabelLocalization.test.js
git commit -m "Localize every ApiOptions input label in its own constructor (#59)"
```

---

### Task 4: Documentation and the stale `Theme.js` rationale

**Files:**

- Modify: `src/MetaComponents/Theme.js` (comments only)
- Modify: `CHANGELOG.md`, `CLAUDE.md`, `docs/api-options.md`, `docs/meta-components.md`

**Interfaces:** none — documentation and comments.

- [ ] **Step 1: Rewrite the two stale comments in `Theme.js`**

`applyLocaleInputTheme()`'s doc block justifies its unconditional label set by citing `LocaleInput.js:48`'s
hardcoded `'locale'`. That is no longer true. Replace the `**The label text is set UNCONDITIONALLY…**`
paragraph with:

```text
 * **The label text is still set unconditionally, but no longer because it has
 * to be.** It once did: `LocaleInput`'s constructor hardcoded its label to the
 * literal string `'locale'` with no i18n of its own, so a caller who themed
 * nothing shipped that raw string to every locale. Since #59 the constructor
 * looks `LANGUAGE` up in `Messages` from its own locale, which is the same
 * lookup every caller passes as `defaultLabelText` — `CalendarControls.#language`
 * is `new Intl.Locale( locale ).language`, exactly what `ApiOptions` hands
 * `LocaleInput`. The write is therefore a no-op in every current call, and is
 * kept rather than removed so that a caller passing a `defaultLabelText` from a
 * different catalogue still gets it. A theme-supplied `labelText` wins over
 * both, being read first.
```

and replace the matching inline comment above the assignment with a one-line
`// Still unconditional; since #59 the constructor already produces this same string. A theme-supplied labelText wins, being read first.`

Change nothing else in the file.

- [ ] **Step 2: Update `CLAUDE.md`'s Internationalization section**

The section says newer keys "are present in exactly twelve of the 84, the same twelve that carry
`SELECT_A_RITE`". Extend the list of such keys with the six new ones and record where the lookup now lives:

```text
`Messages.js` holds 84 locale blocks, unevenly populated: not every key exists in every block. Newer keys —
`COPY_TO_CLIPBOARD`/`COPIED_TO_CLIPBOARD` for `SubscriptionUrl`'s copy control, and the six `ApiOptions`
input labels added in #59 (`YEAR_TYPE`, `EPIPHANY`, `ASCENSION`, `CORPUS_CHRISTI`, `ETERNAL_HIGH_PRIEST`,
`HOLYDAYS_OF_OBLIGATION`) — are present in exactly twelve of the 84, the same twelve that carry
`SELECT_A_RITE`. Every other locale reaches English through the `??` fallback each call site already applies
(`Messages[language]?.[KEY] ?? Messages['en'][KEY]`), so an unpopulated block degrades to English for that
key rather than throwing.

**Input labels are localized by the input's own constructor**, through
`src/ApiOptions/Input/InputLabels.js`'s `defaultLabelText( key, locale )` — internal, and not exported from
`src/index.js`, on the same reasoning as `LocaleValidation.js`. That layer, rather than a meta-component's
theming pass, is what reaches a consumer who writes `new ApiOptions( 'it' )` with no meta-component
anywhere. `DayInput`, `YearInput` and `HolydaysOfObligationInput` therefore take an optional `Intl.Locale`;
`null` means "not supplied" and yields the English label. A theme-supplied `labelText` still wins, because
theming is applied after construction.
```

- [ ] **Step 3: Update `docs/api-options.md` and `docs/meta-components.md`**

In `docs/api-options.md`, add a short "Input labels" subsection stating that each input's `<label>` is
localized from the `ApiOptions` locale, listing the ten key names in a table, and noting the English
fallback and that the escape hatch is `input._labelElement.textContent` (or a meta-component theme's
`labelText`).

In `docs/meta-components.md`, find the passage near line 734 describing `applyLocaleInputTheme()` as the
thing that localizes the locale input's label, and the passage near line 755 saying the escape hatch "still
works, unchanged, for `year_type`, `year` and the rest of `ApiOptions`' inputs". Correct the first to say
the constructor now localizes and the helper only applies the theme on top; leave the second's claim about
the escape hatch intact but note those inputs are now localized by default.

- [ ] **Step 4: Add the CHANGELOG entry**

Insert a new `## [Unreleased]` section immediately below the preamble paragraph and above `## 2.7.0`. Keep
it tightly scoped to #59 — four sibling branches each add their own entry under the same heading:

```markdown
## [Unreleased]

### Changed

- **Every `ApiOptions` input now renders a localized `<label>`**, closing #59. Nine inputs shipped the raw
  snake_case API parameter name — `ascension`, `corpus_christi`, `epiphany`, `eternal_high_priest`,
  `holydays_of_obligation`, `year_type`, `year`, `day`, `month` — and `LocaleInput` shipped `locale`, in
  every language; since the `<label>` is what a screen reader announces, this was an accessibility defect
  and not only a cosmetic one. 2.7.0 fixed only `locale`, and only for callers who mounted a
  meta-component. The lookup now lives in each input's own constructor, via the internal
  `defaultLabelText( key, locale )` in `src/ApiOptions/Input/InputLabels.js`, so a consumer who writes
  `new ApiOptions( 'it' )` with no meta-component gets localized labels too. **This changes rendered text
  for any consumer that never set a label of its own.** The existing escape hatches are unchanged: a
  meta-component theme's `labelText`, `LiturgyOfAnyDay`'s `dayInputConfig`/`monthInputConfig`/
  `yearInputConfig` bags, and direct assignment to `input._labelElement.textContent` — all of which are
  applied after construction and still win.

### Added

- Six `Messages` keys backing those labels — `YEAR_TYPE`, `EPIPHANY`, `ASCENSION`, `CORPUS_CHRISTI`,
  `ETERNAL_HIGH_PRIEST`, `HOLYDAYS_OF_OBLIGATION` — populated for the same twelve locales that already
  carry `SELECT_A_RITE`, with the other 72 blocks degrading to English through the usual `??`. The four
  existing keys `DAY`, `MONTH`, `YEAR` and `LANGUAGE` are reused rather than duplicated.
- `DayInput`, `YearInput` and `HolydaysOfObligationInput` take an optional `Intl.Locale` —
  `new DayInput( locale )`, `new YearInput( locale )`, `new HolydaysOfObligationInput( options, locale )`.
  `null` (the default) means "not supplied" and yields the English label, so existing calls are unaffected;
  anything that is neither `null` nor an `Intl.Locale` throws.

### Known gaps

- `AcceptHeaderInput` still renders `return_type` / `Accept Header` raw. It takes no locale, its label
  flips at runtime in `asReturnTypeParam()`, and it is `PathBuilder`-only; left for its own issue.
- `Input` has no public `labelText()` setter — the supported override remains
  `input._labelElement.textContent`, which the library itself uses.
```

- [ ] **Step 5: Run every gate**

```bash
yarn test
yarn compile && yarn lint:dts
yarn format:js
yarn format:md:fix && yarn format:md
yarn lint:md
```

Expected: `yarn test` green with 66 suites (the two new files) and more than 1191 tests;
`lint:dts` clean; both formatters reporting nothing to change; `lint:md` reporting 0 issues.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Document the localized input labels and refresh the stale Theme.js rationale (#59)"
```

---

## Self-Review

**Spec coverage:** D1 → Task 3; D2 → Task 2; D3 → Task 1; D4 → Task 3 steps 4-5; D5 → Task 4 step 1;
D6 → Task 4 step 4 (CHANGELOG "Changed" + "Known gaps"); D7 → Task 3 step 3. Testing section → Tasks 1-3.
Documentation section → Task 4.

**Placeholders:** none. The one instruction that defers to the repository — the fixture import in Task 3
step 1 — names the file to copy it from and forbids renaming accessors, rather than leaving it open.

**Type consistency:** `defaultLabelText( key, locale = null )` is defined in Task 2 and called with that
exact signature in Task 3 and quoted with it in Task 4. The ten key names are fixed by the table in Task 3
and match the six added in Task 1 plus the four pre-existing ones.
