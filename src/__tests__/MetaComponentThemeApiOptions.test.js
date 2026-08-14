/** @jest-environment jsdom */
/**
 * `theme.apiOptions` — the themeable `ApiOptions` bundle (issue #60).
 *
 * Before this key existed the theme bag reached `riteSelect`, `calendarSelect`
 * and `localeInput` and nothing else, so every consumer still had to open with
 * the four process-wide `Input.setGlobal*` mutations to style the rest of the
 * form. These tests pin the shape, the validation, the precedence and the
 * application of the replacement.
 */
import { describe, it, expect } from '@jest/globals';
import {
    assertTheme,
    API_OPTIONS_INPUT_KEYS,
    resolveApiOptionsInputTheme,
} from '../MetaComponents/Theme.js';

describe('assertTheme — theme.apiOptions', () => {
    it('names all ten ApiOptions inputs', () => {
        expect([...API_OPTIONS_INPUT_KEYS].sort()).toEqual([
            'acceptHeaderInput',
            'ascensionInput',
            'calendarPathInput',
            'corpusChristiInput',
            'epiphanyInput',
            'eternalHighPriestInput',
            'holydaysOfObligationInput',
            'localeInput',
            'yearInput',
            'yearTypeInput',
        ]);
    });

    it('accepts flat role keys and per-input overrides together', () => {
        expect(() =>
            assertTheme(
                {
                    apiOptions: {
                        select: 'form-select',
                        input: 'form-control',
                        label: 'form-label',
                        wrapper: 'col-md-2',
                        epiphanyInput: { wrapperClass: 'col-md-3' },
                        yearInput: 'form-control-sm',
                    },
                },
                'CalendarControls',
            ),
        ).not.toThrow();
    });

    it('rejects an explicitly-undefined apiOptions, as every other top-level key does', () => {
        expect(() =>
            assertTheme({ apiOptions: undefined }, 'CalendarControls'),
        ).toThrow(/theme\.apiOptions must be an object/);
    });

    it('rejects a class-string apiOptions, naming the object form', () => {
        expect(() =>
            assertTheme({ apiOptions: 'form-select' }, 'CalendarControls'),
        ).toThrow(/CalendarControls: theme\.apiOptions must be an object/);
    });

    it('rejects an unrecognised key inside apiOptions, naming it', () => {
        expect(() =>
            assertTheme(
                { apiOptions: { epiphany: { class: 'x' } } },
                'CalendarControls',
            ),
        ).toThrow(/theme\.apiOptions\.epiphany is not a recognised/);
    });

    it('points an unrecognised key at the accepted spellings', () => {
        expect(() =>
            assertTheme(
                { apiOptions: { holydaysOfObligation: 'x' } },
                'CalendarControls',
            ),
        ).toThrow(/holydaysOfObligationInput/);
    });

    it('rejects a non-string flat value inside apiOptions', () => {
        expect(() =>
            assertTheme({ apiOptions: { select: 42 } }, 'CalendarControls'),
        ).toThrow(/theme\.apiOptions\.select must be of type `string`/);
    });

    it('rejects an unrecognised per-input key, naming it', () => {
        expect(() =>
            assertTheme(
                { apiOptions: { epiphanyInput: { titleClass: 'x' } } },
                'CalendarControls',
            ),
        ).toThrow(
            /theme\.apiOptions\.epiphanyInput\.titleClass is not a recognised/,
        );
    });

    it('rejects a non-string per-input value', () => {
        expect(() =>
            assertTheme(
                { apiOptions: { epiphanyInput: { class: 42 } } },
                'CalendarControls',
            ),
        ).toThrow(
            /theme\.apiOptions\.epiphanyInput\.class must be of type `string`/,
        );
    });

    it('rejects a non-object, non-string per-input override', () => {
        expect(() =>
            assertTheme(
                { apiOptions: { epiphanyInput: 42 } },
                'CalendarControls',
            ),
        ).toThrow(/theme\.apiOptions\.epiphanyInput/);
    });

    it('allows an explicitly-undefined per-input override value', () => {
        expect(() =>
            assertTheme(
                { apiOptions: { epiphanyInput: { class: undefined } } },
                'CalendarControls',
            ),
        ).not.toThrow();
    });
});

describe('resolveApiOptionsInputTheme — the opt-in gate', () => {
    it('returns nothing for a non-locale input while the gate is closed', () => {
        expect(
            resolveApiOptionsInputTheme(
                { select: 'form-select', label: 'form-label' },
                'epiphanyInput',
            ),
        ).toEqual({});
    });

    it('keeps 2.7.0 behaviour for localeInput while the gate is closed', () => {
        expect(
            resolveApiOptionsInputTheme(
                {
                    select: 'form-select',
                    label: 'form-label',
                    wrapper: 'col',
                    localeInput: { class: 'sm' },
                },
                'localeInput',
            ),
        ).toEqual({
            class: 'sm',
            labelClass: 'form-label',
            wrapperClass: 'col',
        });
    });

    it('lets an empty apiOptions bag open the gate to the outer flat keys', () => {
        expect(
            resolveApiOptionsInputTheme(
                { select: 'form-select', apiOptions: {} },
                'epiphanyInput',
            ),
        ).toEqual({ class: 'form-select' });
    });

    it('returns nothing for a nullish theme', () => {
        expect(resolveApiOptionsInputTheme(null, 'epiphanyInput')).toEqual({});
        expect(resolveApiOptionsInputTheme(undefined, 'localeInput')).toEqual(
            {},
        );
    });
});

describe('resolveApiOptionsInputTheme — precedence', () => {
    it('prefers the bundle flat key over the outer one', () => {
        expect(
            resolveApiOptionsInputTheme(
                { select: 'outer', apiOptions: { select: 'inner' } },
                'epiphanyInput',
            ),
        ).toEqual({ class: 'inner' });
    });

    it('gives yearInput the input role, not the select role', () => {
        expect(
            resolveApiOptionsInputTheme(
                {
                    apiOptions: {
                        select: 'form-select',
                        input: 'form-control',
                    },
                },
                'yearInput',
            ),
        ).toEqual({ class: 'form-control' });
    });

    it('prefers a per-input override over the bundle flat key', () => {
        expect(
            resolveApiOptionsInputTheme(
                {
                    apiOptions: {
                        select: 'inner',
                        epiphanyInput: { class: 'own' },
                    },
                },
                'epiphanyInput',
            ),
        ).toEqual({ class: 'own' });
    });

    it('accepts a per-input class-string shorthand', () => {
        expect(
            resolveApiOptionsInputTheme(
                { apiOptions: { epiphanyInput: 'own' } },
                'epiphanyInput',
            ),
        ).toEqual({ class: 'own' });
    });

    it('merges per key rather than replacing a child wholesale', () => {
        expect(
            resolveApiOptionsInputTheme(
                {
                    apiOptions: {
                        select: 'inner',
                        label: 'lbl',
                        epiphanyInput: { class: 'own' },
                    },
                },
                'epiphanyInput',
            ),
        ).toEqual({ class: 'own', labelClass: 'lbl' });
    });

    it('ranks apiOptions.localeInput above the legacy top-level localeInput', () => {
        expect(
            resolveApiOptionsInputTheme(
                {
                    localeInput: { class: 'legacy', labelClass: 'legacy-lbl' },
                    apiOptions: { localeInput: { class: 'new' } },
                },
                'localeInput',
            ),
        ).toEqual({ class: 'new', labelClass: 'legacy-lbl' });
    });

    it('ranks the legacy top-level localeInput above the bundle flat key', () => {
        expect(
            resolveApiOptionsInputTheme(
                {
                    localeInput: { class: 'legacy' },
                    apiOptions: { select: 'inner' },
                },
                'localeInput',
            ),
        ).toEqual({ class: 'legacy' });
    });

    it('treats an explicitly-undefined override key as absent', () => {
        expect(
            resolveApiOptionsInputTheme(
                {
                    apiOptions: {
                        select: 'inner',
                        epiphanyInput: { class: undefined },
                    },
                },
                'epiphanyInput',
            ),
        ).toEqual({ class: 'inner' });
    });

    it('maps the flat wrapper key onto wrapperClass, and the per-input one onto the type', () => {
        expect(
            resolveApiOptionsInputTheme(
                {
                    apiOptions: {
                        wrapper: 'col-md-2',
                        epiphanyInput: { wrapper: 'td' },
                    },
                },
                'epiphanyInput',
            ),
        ).toEqual({ wrapperClass: 'col-md-2', wrapper: 'td' });
    });
});
