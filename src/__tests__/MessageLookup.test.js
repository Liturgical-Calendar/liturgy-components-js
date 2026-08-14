/** @jest-environment jsdom */
/**
 * Issue #69: `Messages` holds 84 locale blocks, so `Messages[language][key]` —
 * two unguarded index operations — throws a bare
 * `TypeError: Cannot read properties of undefined` for any language the
 * catalogue has no block for. It named neither the component, nor the locale,
 * nor the fact that it was the message catalogue rather than the API that
 * lacked the language.
 *
 * `message()` is the single guarded lookup the whole library now routes
 * through. These tests pin its contract; the source scan at the bottom is what
 * keeps a seventh unguarded read from being written next time.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Messages from '../Messages.js';
import { message } from '../MessageLookup.js';
import Input from '../ApiOptions/Input/Input.js';
import CalendarPathInput from '../ApiOptions/Input/CalendarPathInput.js';
import EpiphanyInput from '../ApiOptions/Input/EpiphanyInput.js';
import EternalHighPriestInput from '../ApiOptions/Input/EternalHighPriestInput.js';
import YearTypeInput from '../ApiOptions/Input/YearTypeInput.js';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import ApiBase from '../ApiClient/ApiBase.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import LiturgyOfTheDay from '../LiturgyOfTheDay/LiturgyOfTheDay.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

/**
 * Cebuano: a real language the API can serve, and one of the many the catalogue
 * has no block for. Every key the six broken sites read is present in all 84
 * blocks, so a merely SPARSE block never reached the bug — only a language with
 * no block at all did, which is why these cases must not use `zh`.
 */
const NO_BLOCK = 'ceb';

describe('message()', () => {
    it('returns the English message when no locale is supplied', () => {
        expect(message('YEAR_TYPE')).toBe('Year Type');
        expect(message('YEAR_TYPE', null)).toBe('Year Type');
        expect(message('YEAR_TYPE', undefined)).toBe('Year Type');
    });

    it('reads the block for an Intl.Locale', () => {
        expect(message('YEAR_TYPE', new Intl.Locale('it-IT'))).toBe(
            Messages['it']['YEAR_TYPE'],
        );
    });

    it('reads the block for a locale tag string, region and all', () => {
        expect(message('YEAR_TYPE', 'it-IT')).toBe(Messages['it']['YEAR_TYPE']);
        expect(message('YEAR_TYPE', 'it')).toBe(Messages['it']['YEAR_TYPE']);
    });

    it('falls back to English for a language with no block at all', () => {
        // Cebuano is a real language the API can serve and the catalogue does
        // not carry. This is issue #69's case, and the only one that threw:
        // SUNDAY_JAN2_JAN8 is present in all 84 blocks, so a sparse block never
        // reached it.
        expect(Messages['ceb']).toBeUndefined();
        expect(message('SUNDAY_JAN2_JAN8', new Intl.Locale('ceb'))).toBe(
            Messages['en']['SUNDAY_JAN2_JAN8'],
        );
    });

    it('falls back to English for a block that lacks the key', () => {
        expect(Messages['zh']['YEAR_TYPE']).toBeUndefined();
        expect(message('YEAR_TYPE', new Intl.Locale('zh'))).toBe('Year Type');
    });

    it('reads a key present in every block from that block', () => {
        expect(message('MONTH', new Intl.Locale('zh'))).toBe(
            Messages['zh']['MONTH'],
        );
    });

    it('accepts the underscore form the rest of the library accepts', () => {
        // `canonicalizeLocale()` normalizes `_` to `-` for every other component,
        // so a lookup must not be the one place `'it_IT'` is rejected.
        expect(message('YEAR_TYPE', 'it_IT')).toBe(Messages['it']['YEAR_TYPE']);
    });

    it('throws for an unparseable locale rather than silently using English', () => {
        // The library-wide contract: "absent" and "invalid" are different
        // things, and only "absent" means English.
        expect(() => message('YEAR_TYPE', 'not a tag!')).toThrow();
    });

    it('names the offending tag when it rejects one', () => {
        // Reintroducing `Incorrect locale information provided` — which names
        // neither the tag nor the layer — would be the very complaint #69 was
        // filed about, moved onto the invalid-tag path.
        expect(() => message('YEAR_TYPE', 'not a tag!')).toThrow(
            /MessageLookup: Invalid locale: not a tag!/,
        );
        expect(() => message('YEAR_TYPE', '   ')).toThrow(/blank/);
    });

    it('throws for a key the English block does not carry, naming the key', () => {
        // A key is a string literal in the source, so one missing from English
        // is a typo that is broken in every locale — not a translation gap.
        expect(() => message('NO_SUCH_KEY_AT_ALL')).toThrow(
            /NO_SUCH_KEY_AT_ALL/,
        );
        expect(() => message('NO_SUCH_KEY_AT_ALL')).toThrow(/catalogue/i);
    });
});

describe('a language the catalogue has no block for', () => {
    beforeEach(() => {
        Input.reset();
        ApiBase.reset();
        ApiBase.fromMetadata('http://localhost:8000', FULL_METADATA);
    });

    it('does not stop ApiOptions from being constructed', () => {
        // The headline symptom: every meta-component builds an `ApiOptions`, so
        // this one throw reached six components a consumer never touched.
        expect(() => new ApiOptions(NO_BLOCK)).not.toThrow();
    });

    it('gives EpiphanyInput the English option label', () => {
        const input = new EpiphanyInput(new Intl.Locale(NO_BLOCK));
        const labels = [...input._domElement.options].map(
            (option) => option.textContent,
        );
        expect(labels).toContain(Messages['en']['SUNDAY_JAN2_JAN8']);
    });

    it('gives EternalHighPriestInput the English option labels', () => {
        const input = new EternalHighPriestInput(new Intl.Locale(NO_BLOCK));
        const labels = [...input._domElement.options].map(
            (option) => option.textContent,
        );
        expect(labels).toEqual([
            Messages['en']['FALSE'],
            Messages['en']['TRUE'],
        ]);
    });

    it('gives YearTypeInput the English option labels', () => {
        const input = new YearTypeInput(new Intl.Locale(NO_BLOCK));
        const labels = [...input._domElement.options].map(
            (option) => option.textContent,
        );
        expect(labels).toEqual([
            Messages['en']['LITURGICAL_YEAR'],
            Messages['en']['CIVIL_YEAR'],
        ]);
    });

    it('gives CalendarPathInput the English label', () => {
        const input = new CalendarPathInput(new Intl.Locale(NO_BLOCK));
        expect(input._labelElement.textContent).toBe(
            Messages['en']['SELECT_ROUTE'],
        );
    });

    it('gives CalendarPathInput the English label with no locale at all', () => {
        // Its own argument check — `if ( locale && ... )` — permits an omitted
        // locale, but the old lookup then died on `locale.language`.
        const input = new CalendarPathInput();
        expect(input._labelElement.textContent).toBe(
            Messages['en']['SELECT_ROUTE'],
        );
    });

    it('gives CalendarSelect the English default label', () => {
        const container = document.createElement('div');
        container.id = 'calendar-select-container';
        document.body.appendChild(container);
        const select = new CalendarSelect(NO_BLOCK);
        select.label({ class: 'form-label' });
        select.appendTo('#calendar-select-container');
        expect(container.querySelector('label').textContent).toBe(
            Messages['en']['SELECT_A_CALENDAR'],
        );
    });

    it('gives LiturgyOfTheDay the English title', () => {
        const liturgy = new LiturgyOfTheDay({ locale: NO_BLOCK });
        expect(liturgy._domElement.querySelector('h1').textContent).toBe(
            Messages['en']['LITURGY_OF_THE_DAY'],
        );
    });
});

/**
 * Files that still carry the unguarded pattern. `src/WebCalendar/WebCalendar.js`
 * and `src/LiturgyOfAnyDay/LiturgyOfAnyDay.js` belong to issue #65, which is
 * editing them; they are excluded here rather than fixed from under it. The
 * list is a ceiling, not a floor — guarding them keeps this test green.
 */
const ALLOWED_UNGUARDED = [
    join('WebCalendar', 'WebCalendar.js'),
    join('LiturgyOfAnyDay', 'LiturgyOfAnyDay.js'),
];

/**
 * A read of the shape `Messages[ EXPR ][` where EXPR is not the literal `'en'`.
 * `Messages['en'][ key ]` is the terminal fallback and is always safe; anything
 * locale-dependent must be written `?.[` or go through `message()`.
 *
 * `[^\]]` deliberately admits newlines, and the lookahead tolerates whitespace,
 * because prettier wraps at 80 columns: `WebCalendar.js` alone has four of these
 * split across lines, and a line-anchored pattern would have called that file
 * clean. It cannot run away, since it may not cross the first `]`.
 *
 * `Messages\??\.?\[` also catches `Messages?.[lang][KEY]`, which LOOKS guarded
 * and is not — the `?.` guards `Messages` itself being nullish, which it never
 * is, and does nothing about the missing block. That is the most plausible way
 * this bug gets rewritten.
 *
 * **This is a shape check, not a proof.** It is written to catch the shape the
 * bug actually took, and it knowingly does not see: a nested index
 * (`Messages[langs[0]][KEY]`), an aliased default import
 * (`import Msg from './Messages.js'`), a two-statement form
 * (`const b = Messages[lang]; b[KEY]`), or a line break INSIDE the first
 * bracket. Widening it to cover those would cost more in false positives than
 * the shapes are worth; `message()` existing at all is the real defence, and
 * this is the tripwire on the road back.
 */
const UNGUARDED_READ = /Messages\??\.?\[(?!\s*'en'\s*\])[^\]]+\]\s*\[/g;

const SRC_DIR = fileURLToPath(new URL('..', import.meta.url));

/**
 * Strips block comments and whole-line `//` comments, so that a doc comment
 * QUOTING the unguarded pattern — this module's own does, and so do
 * `CalendarControls` and `CalendarResourcePicker` — is not mistaken for one.
 *
 * Trailing `//` comments are deliberately left in place: cutting at the first
 * `//` on a line would also cut inside a `'http://…'` literal and could hide a
 * real match later on that same line. A false positive from a trailing comment
 * is a comment to reword; a false negative is the bug shipping again.
 *
 * @param {string} source
 * @returns {string}
 */
function stripComments(source) {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^[ \t]*\/\/.*$/gm, '');
}

/**
 * @param {string} dir
 * @param {string} [prefix]
 * @returns {string[]} Paths relative to `src/`.
 */
function collectSources(dir, prefix = '') {
    return readdirSync(dir).flatMap((entry) => {
        const absolute = join(dir, entry);
        const relative = join(prefix, entry);
        if (statSync(absolute).isDirectory()) {
            if (['__tests__', '__fixtures__', 'stories'].includes(entry)) {
                return [];
            }
            return collectSources(absolute, relative);
        }
        if (false === entry.endsWith('.js') || entry === 'Messages.js') {
            return [];
        }
        return [relative];
    });
}

describe('no unguarded catalogue reads remain', () => {
    const sources = collectSources(SRC_DIR);

    it('finds source files to scan', () => {
        expect(sources.length).toBeGreaterThan(30);
    });

    it.each(
        sources.filter((file) => false === ALLOWED_UNGUARDED.includes(file)),
    )('%s indexes Messages safely', (file) => {
        const code = stripComments(readFileSync(join(SRC_DIR, file), 'utf8'));
        expect(code.match(UNGUARDED_READ)).toBeNull();
    });

    it('would catch the pattern it is looking for', () => {
        expect(
            "Messages[locale.language]['SUNDAY_JAN2_JAN8']".match(
                UNGUARDED_READ,
            ),
        ).not.toBeNull();
        // Wrapped across lines by prettier — the shape a line-anchored pattern
        // would have missed, and the shape four of `WebCalendar`'s reads take.
        expect(
            'captionText =\n    Messages[this.#baseLocale][\n        captionKey\n    ];'.match(
                UNGUARDED_READ,
            ),
        ).not.toBeNull();
        // `Messages?.[lang][KEY]` LOOKS guarded and throws exactly like the
        // unguarded form: the `?.` protects against `Messages` itself being
        // nullish, which it never is, and not against the missing block.
        expect(
            "Messages?.[locale.language]['SUNDAY_JAN2_JAN8']".match(
                UNGUARDED_READ,
            ),
        ).not.toBeNull();
        expect(
            "Messages[language]?.[key] ?? Messages['en'][key]".match(
                UNGUARDED_READ,
            ),
        ).toBeNull();
        expect("Messages?.['en'][key]".match(UNGUARDED_READ)).toBeNull();
        // The terminal English read, wrapped, must stay exempt.
        expect("Messages[\n    'en'\n][key]".match(UNGUARDED_READ)).toBeNull();
    });
});
