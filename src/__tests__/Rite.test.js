import { describe, it, expect } from '@jest/globals';
import { Rite, RiteProperties } from '../Enums.js';

describe('Rite enum', () => {
    it('has exactly the two rites the API defines', () => {
        expect(Object.values(Rite)).toEqual(['roman', 'ambrosian']);
    });

    it('is frozen', () => {
        expect(Object.isFrozen(Rite)).toBe(true);
    });
});

describe('RiteProperties', () => {
    it('gives the Roman rite a national tier and no fixed temporal options', () => {
        expect(RiteProperties[Rite.ROMAN].hasNationalTier).toBe(true);
        expect(RiteProperties[Rite.ROMAN].hasFixedTemporalOptions).toBe(false);
        expect(RiteProperties[Rite.ROMAN].minYear).toBe(1970);
        expect(RiteProperties[Rite.ROMAN].emptyOptionLabelKey).toBe(
            'GENERAL_ROMAN_CALENDAR',
        );
    });

    it('gives the Ambrosian rite no national tier and fixed temporal options', () => {
        expect(RiteProperties[Rite.AMBROSIAN].hasNationalTier).toBe(false);
        expect(RiteProperties[Rite.AMBROSIAN].hasFixedTemporalOptions).toBe(
            true,
        );
        expect(RiteProperties[Rite.AMBROSIAN].minYear).toBe(1976);
        expect(RiteProperties[Rite.AMBROSIAN].emptyOptionLabelKey).toBe(
            'AMBROSIAN_CALENDAR',
        );
    });

    it('covers every rite in the enum', () => {
        Object.values(Rite).forEach((rite) => {
            expect(RiteProperties).toHaveProperty(rite);
        });
    });
});
