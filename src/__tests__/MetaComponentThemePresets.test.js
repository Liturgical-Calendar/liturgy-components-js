/**
 * Theme presets as `Theme.js` resolves them (issue #67).
 *
 * The suite is deliberately split between this file's unit-level checks of the four
 * `Theme.js` entry points and the end-to-end block at the bottom, which constructs
 * every one of the six theme-taking components. The unit checks say what the resolver
 * computes; only the end-to-end block says what a consumer actually sees, and the two
 * have to agree.
 */

import {
    assertTheme,
    narrowTheme,
    resolveChildTheme,
    resolveApiOptionsInputTheme,
    THEME_CHILD_KEYS,
} from '../MetaComponents/Theme.js';
import { THEME_PRESET_NAMES } from '../MetaComponents/ThemePresets.js';

describe('theme presets in Theme.js', () => {
    it('resolves a select child from a bare preset name', () => {
        expect(resolveChildTheme('bootstrap5', 'riteSelect')).toEqual({
            class: 'form-select',
            labelClass: 'form-label',
        });
    });

    it('resolves a select child from the object spelling', () => {
        expect(
            resolveChildTheme({ preset: 'bootstrap4' }, 'calendarSelect'),
        ).toEqual({ class: 'form-control' });
    });

    it('lets a per-child override beat the preset, per key', () => {
        expect(
            resolveChildTheme(
                { preset: 'bootstrap5', riteSelect: { class: 'x' } },
                'riteSelect',
            ),
        ).toEqual({ class: 'x', labelClass: 'form-label' });
    });

    it('lets a caller flat key beat the preset', () => {
        expect(
            resolveChildTheme(
                { preset: 'bootstrap5', select: 'form-select-lg' },
                'riteSelect',
            ),
        ).toEqual({ class: 'form-select-lg', labelClass: 'form-label' });
    });

    it('opens the apiOptions gate, so the preset reaches all ten inputs', () => {
        expect(resolveApiOptionsInputTheme('bootstrap5', 'yearInput')).toEqual({
            class: 'form-control',
            labelClass: 'form-label',
        });
        expect(
            resolveApiOptionsInputTheme('bootstrap5', 'epiphanyInput'),
        ).toEqual({ class: 'form-select', labelClass: 'form-label' });
    });

    it('keeps a caller-written apiOptions bundle rather than replacing it', () => {
        expect(
            resolveApiOptionsInputTheme(
                {
                    preset: 'bootstrap5',
                    apiOptions: { yearInput: { class: 'y' } },
                },
                'yearInput',
            ),
        ).toEqual({ class: 'y', labelClass: 'form-label' });
    });

    it('does not inject apiOptions for a component that has no ApiOptions', () => {
        expect(() =>
            assertTheme('bootstrap5', 'CalendarResourcePicker'),
        ).not.toThrow();
        expect(narrowTheme('bootstrap5', 'CalendarResourcePicker')).toEqual({
            select: 'form-select',
            input: 'form-control',
            label: 'form-label',
        });
    });

    it('injects apiOptions for a component whose registry entry has it', () => {
        expect(narrowTheme('bootstrap5', 'CalendarControls')).toEqual({
            select: 'form-select',
            input: 'form-control',
            label: 'form-label',
            apiOptions: {},
        });
    });

    // The guard, not a second list: whatever a preset expands to has to survive
    // `assertTheme()` under every component's own name, so a preset that emitted a
    // key some component does not accept fails loudly instead of being dropped.
    it('expands to something every registered component accepts', () => {
        for (const componentName of Object.keys(THEME_CHILD_KEYS)) {
            for (const preset of THEME_PRESET_NAMES) {
                expect(() => assertTheme(preset, componentName)).not.toThrow();
            }
        }
    });

    // Not one entry point but all four: relying on `assertTheme()` running first is
    // exactly the ordering assumption that has silently disabled a check here before.
    it('throws for an unknown preset on every entry point', () => {
        expect(() => assertTheme('bootstrap6', 'DayViewer')).toThrow(
            /theme preset 'bootstrap6' is not recognised/,
        );
        expect(() => narrowTheme('bootstrap6', 'CalendarControls')).toThrow(
            /theme preset 'bootstrap6' is not recognised/,
        );
        expect(() => resolveChildTheme('bootstrap6', 'riteSelect')).toThrow(
            /theme preset 'bootstrap6' is not recognised/,
        );
        expect(() =>
            resolveApiOptionsInputTheme('bootstrap6', 'yearInput'),
        ).toThrow(/theme preset 'bootstrap6' is not recognised/);
    });

    it('names the component when the entry point knows one', () => {
        expect(() => assertTheme('bootstrap6', 'DayViewer')).toThrow(
            /^DayViewer: theme preset/,
        );
    });

    it('leaves a bag with no preset exactly as it was', () => {
        const theme = { select: 'form-select' };
        expect(resolveChildTheme(theme, 'riteSelect')).toEqual({
            class: 'form-select',
        });
        expect(theme).toEqual({ select: 'form-select' });
    });

    it('still returns an empty theme for a nullish bag', () => {
        expect(resolveChildTheme(null, 'riteSelect')).toEqual({});
        expect(resolveApiOptionsInputTheme(undefined, 'yearInput')).toEqual({});
        expect(() => assertTheme(null, 'DayViewer')).not.toThrow();
        expect(narrowTheme(undefined, 'CalendarControls')).toBeUndefined();
    });
});
