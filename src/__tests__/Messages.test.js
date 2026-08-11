import { describe, it, expect } from '@jest/globals';
import Messages from '../Messages.js';
import { Rite, RiteProperties } from '../Enums.js';

const REQUIRED = [
    'RITE_ROMAN',
    'RITE_AMBROSIAN',
    'SELECT_A_RITE',
    'GENERAL_ROMAN_CALENDAR',
    'AMBROSIAN_CALENDAR',
];

describe('rite message keys', () => {
    it('defines every required key in English, which is the fallback for all other locales', () => {
        REQUIRED.forEach((key) => {
            expect(Messages['en']).toHaveProperty(key);
            expect(Messages['en'][key].length).toBeGreaterThan(0);
        });
    });

    it('defines every required key in Italian', () => {
        REQUIRED.forEach((key) => {
            expect(Messages['it']).toHaveProperty(key);
            expect(Messages['it'][key].length).toBeGreaterThan(0);
        });
    });

    it('has an English message for every emptyOptionLabelKey the Rite map names', () => {
        Object.values(Rite).forEach((rite) => {
            expect(Messages['en']).toHaveProperty(
                RiteProperties[rite].emptyOptionLabelKey,
            );
        });
    });
});

describe('day/year/language keys', () => {
    // The same 12 locales that already carry SELECT_A_RITE. Chosen to match the
    // existing precedent rather than invent a second coverage rule, and because
    // they are exactly the languages the frontend serves.
    const TRANSLATED = [
        'de', 'en', 'es', 'fr', 'hu', 'id',
        'it', 'la', 'nl', 'pt', 'sk', 'vi',
    ];

    it.each(TRANSLATED)('defines DAY, YEAR and LANGUAGE for %s', (lang) => {
        expect(typeof Messages[lang].DAY).toBe('string');
        expect(typeof Messages[lang].YEAR).toBe('string');
        expect(typeof Messages[lang].LANGUAGE).toBe('string');
        expect(Messages[lang].DAY.length).toBeGreaterThan(0);
        expect(Messages[lang].YEAR.length).toBeGreaterThan(0);
        expect(Messages[lang].LANGUAGE.length).toBeGreaterThan(0);
    });

    it('carries the same coverage as SELECT_A_RITE', () => {
        const withRite = Object.keys(Messages).filter(
            (lang) => undefined !== Messages[lang].SELECT_A_RITE,
        );
        const withDay = Object.keys(Messages).filter(
            (lang) => undefined !== Messages[lang].DAY,
        );
        expect(withDay.sort()).toEqual(withRite.sort());
    });

    it('leaves untranslated locales undefined so callers fall back to English', () => {
        expect(Messages['zh'].DAY).toBeUndefined();
        expect(Messages['en'].DAY).toBe('Day');
    });
});
