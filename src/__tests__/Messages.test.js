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

    it.each(LABEL_KEYS)(
        'defines %s in English, the fallback for all',
        (key) => {
            expect(typeof Messages['en'][key]).toBe('string');
            expect(Messages['en'][key].length).toBeGreaterThan(0);
        },
    );

    it.each(TRANSLATED)('defines every label key for %s', (lang) => {
        LABEL_KEYS.forEach((key) => {
            expect(typeof Messages[lang][key]).toBe('string');
            expect(Messages[lang][key].length).toBeGreaterThan(0);
        });
    });

    it.each(LABEL_KEYS)(
        'gives %s the same coverage as SELECT_A_RITE',
        (key) => {
            const withRite = Object.keys(Messages).filter(
                (lang) => undefined !== Messages[lang].SELECT_A_RITE,
            );
            const withKey = Object.keys(Messages).filter(
                (lang) => undefined !== Messages[lang][key],
            );
            expect(withKey.sort()).toEqual(withRite.sort());
        },
    );

    it('reuses DAY, MONTH, YEAR and LANGUAGE rather than adding parallel keys', () => {
        expect(Messages['en'].DAY).toBe('Day');
        expect(Messages['en'].MONTH).toBe('Month');
        expect(Messages['en'].YEAR).toBe('Year');
        expect(Messages['en'].LANGUAGE).toBe('Language');
    });
});

describe('live-region announcement keys', () => {
    const ANNOUNCEMENT_KEYS = [
        'CALENDAR_UPDATED_ANNOUNCEMENT_ONE',
        'CALENDAR_UPDATED_ANNOUNCEMENT_OTHER',
        'LITURGY_UPDATED_ANNOUNCEMENT',
    ];

    it.each(ANNOUNCEMENT_KEYS)(
        'gives %s the same coverage as SELECT_A_RITE',
        (key) => {
            const withRite = Object.keys(Messages).filter(
                (lang) => undefined !== Messages[lang].SELECT_A_RITE,
            );
            const withKey = Object.keys(Messages).filter(
                (lang) => undefined !== Messages[lang][key],
            );
            expect(withKey.sort()).toEqual(withRite.sort());
        },
    );

    it.each(ANNOUNCEMENT_KEYS)('names its placeholders in %s', (key) => {
        const placeholders = key.startsWith('CALENDAR_')
            ? ['{calendar}', '{count}']
            : ['{date}'];
        Object.keys(Messages)
            .filter((lang) => undefined !== Messages[lang][key])
            .forEach((lang) => {
                placeholders.forEach((placeholder) => {
                    expect(Messages[lang][key]).toContain(placeholder);
                });
            });
    });
});

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
