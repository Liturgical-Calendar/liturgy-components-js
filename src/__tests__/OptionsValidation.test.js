/**
 * Direct tests for the shared options guard.
 *
 * `assertPlainOptions`, `describeType` and `normalizeComponentOptions` are shared
 * contract across five components, in the same way `resolveBase` and
 * `assertSameBase` are, so they are tested here on their own terms rather than
 * only through their call sites.
 */
import { describe, it, expect } from '@jest/globals';
import {
    assertPlainOptions,
    describeType,
    normalizeComponentOptions,
} from '../OptionsValidation.js';

class BareThing {}

describe('describeType', () => {
    it('distinguishes null from object', () => {
        expect(describeType(null)).toBe('null');
    });

    it('distinguishes an array from object', () => {
        expect(describeType(['en'])).toBe('array');
    });

    /**
     * The case the whole guard exists for: `found type: object` would tell a
     * caller who passed an `Intl.Locale` nothing at all.
     */
    it('names a class instance by its constructor', () => {
        expect(describeType(new Intl.Locale('it'))).toBe('Locale');
        expect(describeType(new BareThing())).toBe('BareThing');
    });

    it('names a plain object `Object`', () => {
        expect(describeType({})).toBe('Object');
    });

    it('falls back to `object` for a null-prototype object, which has no constructor', () => {
        expect(describeType(Object.create(null))).toBe('object');
    });

    it('reports primitives by their typeof', () => {
        expect(describeType(123)).toBe('number');
        expect(describeType('en')).toBe('string');
        expect(describeType(true)).toBe('boolean');
        expect(describeType(undefined)).toBe('undefined');
        expect(describeType(() => {})).toBe('function');
    });
});

describe('assertPlainOptions', () => {
    it('accepts a plain object', () => {
        expect(() => assertPlainOptions({}, 'Component')).not.toThrow();
        expect(() =>
            assertPlainOptions({ locale: 'it' }, 'Component'),
        ).not.toThrow();
    });

    /**
     * A null-prototype object carries no inherited keys to collide with option
     * names, which is exactly the property the guard is protecting. Rejecting it
     * would be arbitrary.
     */
    it('accepts a null-prototype object', () => {
        expect(() =>
            assertPlainOptions(Object.create(null), 'Component'),
        ).not.toThrow();
    });

    it('rejects null', () => {
        expect(() => assertPlainOptions(null, 'Component')).toThrow(
            /found type: null/,
        );
    });

    it('rejects undefined', () => {
        expect(() => assertPlainOptions(undefined, 'Component')).toThrow(
            /found type: undefined/,
        );
    });

    it('rejects an array', () => {
        expect(() => assertPlainOptions(['en'], 'Component')).toThrow(
            /found type: array/,
        );
    });

    it('rejects a number', () => {
        expect(() => assertPlainOptions(123, 'Component')).toThrow(
            /found type: number/,
        );
    });

    /**
     * `Object.getPrototypeOf( new Intl.Locale( 'it' ) ) !== Object.prototype`, which
     * is what a bare `typeof options === 'object' && !Array.isArray( options )` misses.
     */
    it('rejects an Intl.Locale', () => {
        expect(() =>
            assertPlainOptions(new Intl.Locale('it'), 'Component'),
        ).toThrow(/found type: Locale/);
    });

    it('rejects any other class instance', () => {
        expect(() => assertPlainOptions(new BareThing(), 'Component')).toThrow(
            /found type: BareThing/,
        );
    });

    it('names the component in the message, so the caller knows which constructor rejected', () => {
        expect(() => assertPlainOptions(123, 'CalendarSelect')).toThrow(
            'CalendarSelect: Invalid type for options, must be of type `object` but found type: number',
        );
    });
});

/**
 * Issue #32 settled the two questions the components used to answer differently:
 * an `Intl.Locale` IS a locale, and `null` means "not given" exactly as
 * `undefined` does. Both answers live in this one normaliser rather than in five
 * hand-rolled constructor branches.
 *
 * What must NOT change is the hole issue #31 closed. `assertPlainOptions` still
 * rejects an `Intl.Locale`, as its own suite above pins; the normaliser claims it
 * BEFORE reaching that test, as a recognised third argument form, so no other
 * class instance gains entry alongside it.
 */
describe('normalizeComponentOptions', () => {
    it('wraps a locale string as { locale }', () => {
        expect(normalizeComponentOptions('it-IT', 'Component')).toEqual({
            locale: 'it-IT',
        });
    });

    it('wraps an Intl.Locale as { locale }, unconverted', () => {
        const locale = new Intl.Locale('it-IT');
        const normalized = normalizeComponentOptions(locale, 'Component');
        expect(normalized.locale).toBe(locale);
    });

    it.each([
        ['null', null],
        ['undefined', undefined],
    ])(
        "returns an empty bag for %s, so the caller's own defaults apply",
        (_label, value) => {
            expect(normalizeComponentOptions(value, 'Component')).toEqual({});
        },
    );

    it('returns a plain bag unchanged, by identity', () => {
        const options = { locale: 'it', class: 'form-select' };
        expect(normalizeComponentOptions(options, 'Component')).toBe(options);
    });

    it('returns a null-prototype bag unchanged, by identity', () => {
        const options = Object.assign(Object.create(null), { locale: 'it' });
        expect(normalizeComponentOptions(options, 'Component')).toBe(options);
    });

    /**
     * The order that matters: `Intl.Locale` is tested ahead of the plain-object
     * check, so it is a recognised form rather than an exception carved into the
     * guard. Every other class instance still falls through to the guard.
     */
    it.each([
        [
            'another class instance',
            () => new BareThing(),
            /found type: BareThing/,
        ],
        ['an array', () => ['en'], /found type: array/],
        ['a number', () => 123, /found type: number/],
        ['a boxed String', () => new String('it'), /found type: String/],
        ['a Date', () => new Date(), /found type: Date/],
    ])('still rejects %s', (_label, make, matcher) => {
        expect(() => normalizeComponentOptions(make(), 'Component')).toThrow(
            matcher,
        );
    });

    it('names the component when it rejects', () => {
        expect(() =>
            normalizeComponentOptions(new BareThing(), 'ApiOptions'),
        ).toThrow(
            'ApiOptions: Invalid type for options, must be of type `object` but found type: BareThing',
        );
    });
});
