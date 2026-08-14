import { describe, it, expect } from '@jest/globals';
import {
    interpolate,
    formatMessage,
    formatPluralMessage,
} from '../MessageFormat.js';

describe('interpolate', () => {
    it('replaces every named placeholder', () => {
        expect(interpolate('{a} and {b}', { a: 'first', b: 'second' })).toBe(
            'first and second',
        );
    });

    it('stringifies a non-string replacement', () => {
        expect(interpolate('{year}', { year: 2026 })).toBe('2026');
    });

    it('leaves a placeholder with no replacement intact', () => {
        // The inlined caption sites in WebCalendar.js emit the string
        // 'undefined' here. Leaving the placeholder is strictly more debuggable
        // and reaches no existing call site.
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

    it("falls back to English's OTHER when English has no key for the category", () => {
        // The LAST link in the chain, and the only one nothing else reaches.
        // Russian has a Messages block but no announcement keys, and its rules
        // select `many` for 5 — a category English has no key for either, since
        // only _ONE and _OTHER are populated. `zz` above stops at the third
        // link, because its category is already `other`.
        expect(new Intl.PluralRules('ru').select(5)).toBe('many');
        expect(
            formatPluralMessage('CALENDAR_UPDATED_ANNOUNCEMENT', 'ru', 5, {
                calendar: 'X',
                count: '5',
            }),
        ).toBe('X, 5 entries');
    });
});
