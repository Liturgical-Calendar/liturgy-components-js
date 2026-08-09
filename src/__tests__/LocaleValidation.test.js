/**
 * Direct tests for the shared locale helper.
 *
 * `canonicalizeLocale` and `toIntlLocale` are shared contract across six
 * components, in the same way `assertPlainOptions` and `resolveBase` are, so
 * they are tested here on their own terms rather than only through their call
 * sites.
 */
import { describe, it, expect } from '@jest/globals';
import { canonicalizeLocale, toIntlLocale } from '../LocaleValidation.js';

describe('canonicalizeLocale', () => {
    it('returns an already-canonical tag unchanged', () => {
        expect(canonicalizeLocale('en', 'Test')).toBe('en');
        expect(canonicalizeLocale('it-IT', 'Test')).toBe('it-IT');
        expect(canonicalizeLocale('sr-Latn-RS', 'Test')).toBe('sr-Latn-RS');
    });

    /**
     * The reason the underscore replacement must precede canonicalisation rather
     * than follow it: `Intl.getCanonicalLocales( 'it_IT' )` throws outright, so a
     * helper that canonicalised first would reject the form this library has
     * always accepted.
     */
    it('normalizes underscores to hyphens before canonicalizing', () => {
        expect(canonicalizeLocale('it_IT', 'Test')).toBe('it-IT');
        expect(canonicalizeLocale('en_US', 'Test')).toBe('en-US');
        expect(() => Intl.getCanonicalLocales('it_IT')).toThrow(RangeError);
    });

    it('canonicalizes case', () => {
        expect(canonicalizeLocale('EN-us', 'Test')).toBe('en-US');
        expect(canonicalizeLocale('sr-latn-rs', 'Test')).toBe('sr-Latn-RS');
    });

    it('canonicalizes deprecated subtags the way Intl does', () => {
        expect(canonicalizeLocale('iw', 'Test')).toBe('he');
        expect(canonicalizeLocale('in', 'Test')).toBe('id');
    });

    it('preserves Unicode extension sequences', () => {
        expect(canonicalizeLocale('en-US-u-ca-gregory', 'Test')).toBe(
            'en-US-u-ca-gregory',
        );
    });

    describe('rejection', () => {
        /**
         * The whole point of the wrap: `Intl`'s own `RangeError` reads
         * `Incorrect locale information provided` and names neither the tag nor
         * the component that rejected it.
         */
        it('names both the component and the offending tag', () => {
            expect(() =>
                canonicalizeLocale('not a locale', 'CalendarSelect'),
            ).toThrow('CalendarSelect: Invalid locale: not a locale');
        });

        /**
         * `it__IT` normalizes to `it--IT`, which is what `Intl` actually rejects, so
         * a message naming `it--IT` proves the throw reports the string validated
         * rather than the raw argument. `ApiOptions` has reported it this way from
         * the start and the shared helper keeps that choice for all six.
         */
        it('names the normalized tag, not the raw argument', () => {
            expect(() => canonicalizeLocale('it__IT', 'ApiOptions')).toThrow(
                'ApiOptions: Invalid locale: it--IT',
            );
        });

        /**
         * `Intl.getCanonicalLocales( '' )` throws on its own, so the guard is not
         * there to detect anything — it is there for the message. Left to `Intl`
         * the throw reads `Test: Invalid locale: ` and names nothing after the
         * colon, which tells a caller who passed `''` nothing at all. Blank tags
         * go the same way: an input trimmed to nothing is the same mistake.
         */
        it.each([
            ['an empty string', ''],
            ['a whitespace-only string', '   '],
            ['a tab and newline', '\t\n'],
        ])('rejects %s with a message of its own', (_label, value) => {
            expect(() => canonicalizeLocale(value, 'Test')).toThrow(
                'Test: Invalid locale, cannot be an empty or blank string',
            );
        });

        /**
         * An invalid locale must NEVER be quietly replaced with English. Silently
         * defaulting is the failure mode issue #31 removed; reinstating it for a
         * different input would undo that.
         */
        it('throws rather than falling back to English', () => {
            expect(() =>
                canonicalizeLocale('this is not a locale', 'Test'),
            ).toThrow();
        });
    });

    describe('type rejection', () => {
        it.each([
            ['a number', 123, 'number'],
            ['null', null, 'null'],
            ['undefined', undefined, 'undefined'],
            ['an array', ['en'], 'array'],
            ['a plain object', {}, 'Object'],
        ])(
            'rejects %s, naming the component and the type found',
            (_label, value, typeName) => {
                expect(() => canonicalizeLocale(value, 'RiteSelect')).toThrow(
                    `RiteSelect: Invalid type for locale, must be of type \`string\` or \`Intl.Locale\` but found type: ${typeName}`,
                );
            },
        );

        /**
         * Every OTHER class instance is still named by its constructor rather than
         * the useless `object` — the message issue #31 introduced, unchanged except
         * for now advertising the second accepted form.
         */
        it('names another class instance by its constructor rather than `object`', () => {
            class Whatever {}
            expect(() =>
                canonicalizeLocale(new Whatever(), 'ApiOptions'),
            ).toThrow(
                'ApiOptions: Invalid type for locale, must be of type `string` or `Intl.Locale` but found type: Whatever',
            );
        });

        /**
         * A `String` OBJECT is not a string, and is not an `Intl.Locale` either.
         * It is rejected like any other instance rather than coerced: silently
         * accepting one would be the "accept anything object-shaped" behaviour
         * issue #31 removed.
         */
        it('rejects a boxed String object', () => {
            // eslint-disable-next-line no-new-wrappers
            expect(() =>
                canonicalizeLocale(new String('it-IT'), 'Test'),
            ).toThrow(
                'Test: Invalid type for locale, must be of type `string` or `Intl.Locale` but found type: String',
            );
        });
    });

    /**
     * Issue #32, decision 1: an `Intl.Locale` is a locale, not a bad argument.
     *
     * The unwrap is `toString()` and nothing else, which is safe because
     * `Intl.Locale.prototype.toString` returns the CANONICAL tag — so the
     * canonicalisation step that follows is a no-op rather than a second,
     * potentially disagreeing, normalisation. Each row below is one way a tag can
     * be non-canonical, so what is pinned is that agreement rather than a single
     * lucky example.
     */
    describe('Intl.Locale', () => {
        it.each([
            ['a canonical tag', new Intl.Locale('it-IT'), 'it-IT'],
            ['mixed case', new Intl.Locale('EN-us'), 'en-US'],
            ['lowercase script', new Intl.Locale('en-latn-us'), 'en-Latn-US'],
            ['a deprecated language subtag', new Intl.Locale('iw'), 'he'],
            ['a macrolanguage', new Intl.Locale('cmn-Hans-CN'), 'zh-Hans-CN'],
            [
                'a Unicode extension in the tag',
                new Intl.Locale('it-IT-u-ca-gregory-nu-latn'),
                'it-IT-u-ca-gregory-nu-latn',
            ],
            [
                'a private-use subtag',
                new Intl.Locale('en-US-x-private'),
                'en-US-x-private',
            ],
        ])(
            'accepts one carrying %s and returns its canonical tag',
            (_label, locale, expected) => {
                expect(canonicalizeLocale(locale, 'Test')).toBe(expected);
            },
        );

        /**
         * Extensions supplied as CONSTRUCTOR OPTIONS never appear in the tag the
         * caller wrote, only in the one `toString()` produces — the case a naive
         * `locale.baseName` unwrap would silently drop.
         */
        it('keeps extensions supplied as constructor options', () => {
            const locale = new Intl.Locale('en', {
                calendar: 'buddhist',
                numberingSystem: 'thai',
            });
            expect(canonicalizeLocale(locale, 'Test')).toBe(
                'en-u-ca-buddhist-nu-thai',
            );
        });

        /**
         * The property the unwrap rests on, asserted against `Intl` itself rather
         * than against this helper: canonicalising an `Intl.Locale`'s own string
         * returns that same string, so nothing is lost or rewritten in the step
         * after the unwrap.
         */
        it.each([
            'it-IT',
            'EN-us',
            'en-latn-us',
            'iw',
            'cmn-Hans-CN',
            'it-IT-u-ca-gregory-nu-latn',
            'en-US-x-private',
        ])('agrees with Intl.getCanonicalLocales for %s', (tag) => {
            const locale = new Intl.Locale(tag);
            expect(Intl.getCanonicalLocales(locale.toString())[0]).toBe(
                locale.toString(),
            );
            expect(canonicalizeLocale(locale, 'Test')).toBe(
                canonicalizeLocale(tag, 'Test'),
            );
        });
    });
});

describe('toIntlLocale', () => {
    it('returns an Intl.Locale', () => {
        expect(toIntlLocale('it-IT', 'Test')).toBeInstanceOf(Intl.Locale);
    });

    it('normalizes and canonicalizes exactly as canonicalizeLocale does', () => {
        expect(toIntlLocale('it_IT', 'Test').baseName).toBe('it-IT');
        expect(toIntlLocale('EN-us', 'Test').baseName).toBe('en-US');
        expect(toIntlLocale('it_IT', 'Test').language).toBe('it');
        expect(toIntlLocale('it_IT', 'Test').region).toBe('IT');
    });

    /**
     * The equivalence the adapter rests on: parsing the canonical form yields the
     * same locale the raw tag would have, so the extra parse cannot throw and
     * cannot drift. Pinned rather than assumed, because the components that store
     * an `Intl.Locale` used to build it straight from the normalized tag.
     */
    it.each(['en', 'it_IT', 'EN-us', 'sr-latn-rs', 'iw', 'en-US-u-ca-gregory'])(
        'agrees with `new Intl.Locale( normalized )` for %s',
        (tag) => {
            const normalized = tag.replaceAll('_', '-');
            expect(toIntlLocale(tag, 'Test').toString()).toBe(
                new Intl.Locale(normalized).toString(),
            );
        },
    );

    it('propagates the rejection, naming the component', () => {
        expect(() => toIntlLocale('not a locale', 'LiturgyOfTheDay')).toThrow(
            'LiturgyOfTheDay: Invalid locale: not a locale',
        );
        expect(() => toIntlLocale(123, 'LiturgyOfAnyDay')).toThrow(
            /^LiturgyOfAnyDay: Invalid type for locale/,
        );
    });

    /**
     * An `Intl.Locale` in, an equal `Intl.Locale` out — but a FRESH one, not the
     * caller's own reference, since the argument goes through the same unwrap and
     * re-parse a string does.
     */
    describe('Intl.Locale', () => {
        it('round-trips one to an equal but distinct instance', () => {
            const given = new Intl.Locale('it-IT');
            const stored = toIntlLocale(given, 'Test');
            expect(stored).toBeInstanceOf(Intl.Locale);
            expect(stored.toString()).toBe(given.toString());
            expect(stored).not.toBe(given);
        });

        it('preserves the parts the components actually read', () => {
            const stored = toIntlLocale(new Intl.Locale('EN-us'), 'Test');
            expect(stored.language).toBe('en');
            expect(stored.region).toBe('US');
            expect(stored.baseName).toBe('en-US');
        });

        it('keeps a Unicode extension through the round trip', () => {
            const stored = toIntlLocale(
                new Intl.Locale('en', { calendar: 'buddhist' }),
                'Test',
            );
            expect(stored.toString()).toBe('en-u-ca-buddhist');
            expect(stored.language).toBe('en');
        });
    });
});
