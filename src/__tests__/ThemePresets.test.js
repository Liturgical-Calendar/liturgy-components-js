/**
 * The theme preset table and its expansion helper (issue #67).
 *
 * The drift test here is the reason the names and the table live in ONE file:
 * `ThemePreset` is public API and `PRESET_CLASSES` is not, so nothing outside this
 * suite would notice a member added to one and not the other.
 */

import {
    ThemePreset,
    THEME_PRESET_NAMES,
    hasThemePreset,
    expandThemePreset,
} from '../MetaComponents/ThemePresets.js';

describe('ThemePresets', () => {
    it('names exactly the presets it defines', () => {
        expect(Object.values(ThemePreset).sort()).toEqual([
            'bootstrap4',
            'bootstrap5',
        ]);
        expect([...THEME_PRESET_NAMES].sort()).toEqual(
            Object.values(ThemePreset).sort(),
        );
    });

    it('recognises both spellings, and nothing else', () => {
        expect(hasThemePreset('bootstrap5')).toBe(true);
        expect(hasThemePreset({ preset: 'bootstrap5' })).toBe(true);
        expect(hasThemePreset({ select: 'form-select' })).toBe(false);
        expect(hasThemePreset(null)).toBe(false);
        expect(hasThemePreset(undefined)).toBe(false);
        expect(hasThemePreset(42)).toBe(false);
    });

    it('expands bootstrap5 to the three control roles', () => {
        expect(expandThemePreset('bootstrap5')).toEqual({
            select: 'form-select',
            input: 'form-control',
            label: 'form-label',
        });
    });

    // `.form-label` is a Bootstrap 5 class. Emitting it for Bootstrap 4 would be
    // inventing CSS, which is the one thing a framework preset must not do.
    it('expands bootstrap4 without a label class, which Bootstrap 4 does not define', () => {
        expect(expandThemePreset('bootstrap4')).toEqual({
            select: 'form-control',
            input: 'form-control',
        });
    });

    it('never emits a wrapper class, on either preset', () => {
        for (const name of THEME_PRESET_NAMES) {
            expect(expandThemePreset(name)).not.toHaveProperty('wrapper');
        }
    });

    it('lets the caller keys win per key, and drops the preset key itself', () => {
        expect(
            expandThemePreset({
                preset: 'bootstrap5',
                select: 'form-select-lg',
                riteSelect: { class: 'x' },
            }),
        ).toEqual({
            select: 'form-select-lg',
            input: 'form-control',
            label: 'form-label',
            riteSelect: { class: 'x' },
        });
    });

    it('never mutates the caller bag', () => {
        const theme = { preset: 'bootstrap5', select: 'x' };
        expandThemePreset(theme);
        expect(theme).toEqual({ preset: 'bootstrap5', select: 'x' });
    });

    it('throws for an unknown preset, naming it and the valid ones', () => {
        expect(() => expandThemePreset('bootstrap6', 'CalendarViewer')).toThrow(
            "CalendarViewer: theme preset 'bootstrap6' is not recognised. Valid presets are: bootstrap4, bootstrap5.",
        );
    });

    it('falls back to a Theme prefix when no component name is known', () => {
        expect(() => expandThemePreset({ preset: 'nope' })).toThrow(
            /^Theme: theme preset 'nope' is not recognised\./,
        );
    });

    it('throws for a non-string preset value, naming the type', () => {
        expect(() => expandThemePreset({ preset: 5 }, 'DayViewer')).toThrow(
            'DayViewer: theme.preset must be of type `string` but found type: number',
        );
    });
});
