import { describe, it, expect } from '@jest/globals';
import { resolveChildTheme, assertTheme } from '../MetaComponents/Theme.js';

describe('resolveChildTheme', () => {
    it('returns an empty result for an absent theme', () => {
        expect(resolveChildTheme(null, 'riteSelect')).toEqual({});
        expect(resolveChildTheme(undefined, 'riteSelect')).toEqual({});
    });

    it('applies the flat role defaults', () => {
        const theme = {
            select: 'form-select',
            label: 'form-label',
            wrapper: 'col-md-3',
        };
        expect(resolveChildTheme(theme, 'riteSelect')).toEqual({
            class: 'form-select',
            labelClass: 'form-label',
            wrapperClass: 'col-md-3',
        });
    });

    it('reads the input role rather than the select role', () => {
        const theme = { select: 'form-select', input: 'form-control' };
        expect(resolveChildTheme(theme, 'yearInput', 'input')).toEqual({
            class: 'form-control',
        });
    });

    it('lets a per-child override beat the flat default', () => {
        const theme = {
            select: 'form-select',
            riteSelect: { class: 'form-select mb-2' },
        };
        expect(resolveChildTheme(theme, 'riteSelect').class).toBe(
            'form-select mb-2',
        );
        expect(resolveChildTheme(theme, 'calendarSelect').class).toBe(
            'form-select',
        );
    });

    it('accepts a bare string as shorthand for a class override', () => {
        const theme = { select: 'form-select', riteSelect: 'custom' };
        expect(resolveChildTheme(theme, 'riteSelect').class).toBe('custom');
    });

    it('merges per-key rather than replacing the whole result', () => {
        const theme = {
            select: 'form-select',
            label: 'form-label',
            riteSelect: { class: 'custom' },
        };
        expect(resolveChildTheme(theme, 'riteSelect')).toEqual({
            class: 'custom',
            labelClass: 'form-label',
        });
    });

    it('omits keys that were never set rather than emitting undefined values', () => {
        const result = resolveChildTheme({ select: 'a' }, 'riteSelect');
        expect(Object.hasOwn(result, 'labelClass')).toBe(false);
    });

    it('carries a per-child wrapper element name through', () => {
        const theme = { dateControls: { wrapper: 'div', wrapperClass: 'col' } };
        expect(resolveChildTheme(theme, 'dateControls', 'input')).toEqual({
            wrapper: 'div',
            wrapperClass: 'col',
        });
    });
});

describe('assertTheme', () => {
    it('accepts an absent theme', () => {
        expect(() => assertTheme(null, 'DayViewer')).not.toThrow();
        expect(() => assertTheme(undefined, 'DayViewer')).not.toThrow();
    });

    it('rejects a non-object theme, naming the component and the type', () => {
        expect(() => assertTheme('form-select', 'DayViewer')).toThrow(
            /DayViewer.*theme.*string/,
        );
        expect(() => assertTheme(['a'], 'DayViewer')).toThrow(
            /DayViewer.*theme.*array/,
        );
    });

    it('rejects a per-child override that is neither string nor object', () => {
        expect(() =>
            assertTheme({ riteSelect: 42 }, 'CalendarResourcePicker'),
        ).toThrow(/riteSelect.*number/);
    });
});
