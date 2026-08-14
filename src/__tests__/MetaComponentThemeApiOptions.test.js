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
import { describe, it, expect, beforeEach } from '@jest/globals';
import {
    assertTheme,
    API_OPTIONS_INPUT_KEYS,
    resolveApiOptionsInputTheme,
    applyApiOptionsTheme,
} from '../MetaComponents/Theme.js';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import { ApiOptionsFilter } from '../Enums.js';
import CalendarControls from '../MetaComponents/CalendarControls.js';
import CalendarViewer from '../MetaComponents/CalendarViewer.js';
import ApiExplorer from '../MetaComponents/ApiExplorer.js';
import DayViewer from '../MetaComponents/DayViewer.js';
import SubscriptionBuilder from '../SubscriptionBuilder/SubscriptionBuilder.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.innerHTML = '<div id="mount"></div>';
});

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

describe('applyApiOptionsTheme', () => {
    it('applies the bundle flat class by role — select to selects, input to the year input', () => {
        const apiOptions = new ApiOptions('en');
        applyApiOptionsTheme(
            apiOptions,
            { apiOptions: { select: 'form-select', input: 'form-control' } },
            'Language',
        );
        expect(apiOptions._epiphanyInput._domElement.className).toBe(
            'form-select',
        );
        expect(apiOptions._yearTypeInput._domElement.className).toBe(
            'form-select',
        );
        expect(apiOptions._yearInput._domElement.className).toBe(
            'form-control',
        );
    });

    it('applies the bundle label class to every input label', () => {
        const apiOptions = new ApiOptions('en');
        applyApiOptionsTheme(
            apiOptions,
            { apiOptions: { label: 'form-label' } },
            'Language',
        );
        expect(apiOptions._ascensionInput._labelElement.className).toBe(
            'form-label',
        );
        expect(apiOptions._acceptHeaderInput._labelElement.className).toBe(
            'form-label',
        );
    });

    it('wraps every input from the bundle flat wrapper key, defaulting the element to a div', () => {
        const apiOptions = new ApiOptions('en');
        applyApiOptionsTheme(
            apiOptions,
            { apiOptions: { wrapper: 'col col-md-2' } },
            'Language',
        );
        const wrapper = apiOptions._corpusChristiInput._wrapperElement;
        expect(wrapper.tagName).toBe('DIV');
        expect(wrapper.className).toBe('col col-md-2');
    });

    it('lets a per-input wrapperClass override the bundle default', () => {
        const apiOptions = new ApiOptions('en');
        applyApiOptionsTheme(
            apiOptions,
            {
                apiOptions: {
                    wrapper: 'col col-md-2',
                    epiphanyInput: { wrapperClass: 'col col-md-3' },
                },
            },
            'Language',
        );
        expect(apiOptions._epiphanyInput._wrapperElement.className).toBe(
            'col col-md-3',
        );
        expect(apiOptions._ascensionInput._wrapperElement.className).toBe(
            'col col-md-2',
        );
    });

    it('applies a per-input labelText, and leaves the others alone', () => {
        const apiOptions = new ApiOptions('en');
        const untouched = apiOptions._ascensionInput._labelElement.textContent;
        applyApiOptionsTheme(
            apiOptions,
            { apiOptions: { epiphanyInput: { labelText: 'Epiphany' } } },
            'Language',
        );
        expect(apiOptions._epiphanyInput._labelElement.textContent).toBe(
            'Epiphany',
        );
        expect(apiOptions._ascensionInput._labelElement.textContent).toBe(
            untouched,
        );
    });

    it('still gives the locale input its localized label unconditionally', () => {
        const apiOptions = new ApiOptions('en');
        applyApiOptionsTheme(apiOptions, undefined, 'Language');
        expect(apiOptions._localeInput._labelElement.textContent).toBe(
            'Language',
        );
    });

    it('leaves every other input untouched while the gate is closed', () => {
        const apiOptions = new ApiOptions('en');
        applyApiOptionsTheme(
            apiOptions,
            { select: 'form-select', label: 'form-label', wrapper: 'col' },
            'Language',
        );
        expect(apiOptions._epiphanyInput._domElement.className).toBe('');
        expect(apiOptions._epiphanyInput._wrapperElement).toBeNull();
        expect(apiOptions._localeInput._domElement.className).toBe(
            'form-select',
        );
    });

    it('themes an input the current filter never renders, without throwing', () => {
        const apiOptions = new ApiOptions('en').filter(
            ApiOptionsFilter.LOCALE_ONLY,
        );
        expect(() =>
            applyApiOptionsTheme(
                apiOptions,
                { apiOptions: { calendarPathInput: { class: 'x' } } },
                'Language',
            ),
        ).not.toThrow();
        expect(apiOptions._calendarPathInput._domElement.className).toBe('x');
    });
});

describe('CalendarControls — theme.apiOptions', () => {
    it('styles every ApiOptions input the bundle names', () => {
        const controls = new CalendarControls({
            locale: 'en',
            theme: {
                apiOptions: {
                    select: 'form-select',
                    input: 'form-control',
                    label: 'form-label d-block mb-1',
                    wrapper: 'form-group col col-md-2',
                    epiphanyInput: { wrapperClass: 'form-group col col-md-3' },
                    holydaysOfObligationInput: {
                        wrapperClass: 'form-group col col-md-3',
                    },
                },
            },
        });
        controls.appendTo('#mount');
        const options = controls.apiOptions;
        expect(options._epiphanyInput._domElement.className).toBe(
            'form-select',
        );
        expect(options._yearInput._domElement.className).toBe('form-control');
        expect(options._ascensionInput._labelElement.className).toBe(
            'form-label d-block mb-1',
        );
        expect(options._ascensionInput._wrapperElement.className).toBe(
            'form-group col col-md-2',
        );
        expect(options._epiphanyInput._wrapperElement.className).toBe(
            'form-group col col-md-3',
        );
        expect(
            options._holydaysOfObligationInput._wrapperElement.className,
        ).toBe('form-group col col-md-3');
    });

    it('leaves the ApiOptions inputs alone when the bag names no apiOptions key', () => {
        const controls = new CalendarControls({
            locale: 'en',
            theme: { select: 'form-select', label: 'form-label' },
        });
        controls.appendTo('#mount');
        expect(controls.apiOptions._epiphanyInput._domElement.className).toBe(
            '',
        );
        expect(controls.apiOptions._localeInput._domElement.className).toBe(
            'form-select',
        );
    });

    it('lets apiOptions.localeInput win over the legacy top-level localeInput', () => {
        const controls = new CalendarControls({
            locale: 'en',
            theme: {
                localeInput: { class: 'legacy', labelClass: 'legacy-label' },
                apiOptions: { localeInput: { class: 'scoped' } },
            },
        });
        controls.appendTo('#mount');
        expect(controls.apiOptions._localeInput._domElement.className).toBe(
            'scoped',
        );
        expect(controls.apiOptions._localeInput._labelElement.className).toBe(
            'legacy-label',
        );
    });

    it('does not throw when theming an input the chosen filter never renders', () => {
        expect(
            () =>
                new CalendarControls({
                    locale: 'en',
                    filter: ApiOptionsFilter.LOCALE_ONLY,
                    theme: {
                        apiOptions: {
                            select: 'form-select',
                            wrapper: 'col',
                        },
                    },
                }),
        ).not.toThrow();
    });

    it('rejects a misspelled input key, naming CalendarControls', () => {
        expect(
            () =>
                new CalendarControls({
                    locale: 'en',
                    theme: { apiOptions: { epiphany: 'form-select' } },
                }),
        ).toThrow(/CalendarControls: theme\.apiOptions\.epiphany/);
    });
});

describe('the composed components inherit theme.apiOptions', () => {
    const theme = { apiOptions: { select: 'form-select' } };

    it('CalendarViewer', () => {
        const viewer = new CalendarViewer({ locale: 'en', theme });
        expect(
            viewer.controls.apiOptions._yearTypeInput._domElement.className,
        ).toBe('form-select');
    });

    it('ApiExplorer', () => {
        const explorer = new ApiExplorer({ locale: 'en', theme });
        expect(
            explorer.controls.apiOptions._calendarPathInput._domElement
                .className,
        ).toBe('form-select');
    });

    it('SubscriptionBuilder', () => {
        const builder = new SubscriptionBuilder({ locale: 'en', theme });
        expect(
            builder.controls.apiOptions._yearTypeInput._domElement.className,
        ).toBe('form-select');
    });

    it('DayViewer', () => {
        const viewer = new DayViewer({
            locale: 'en',
            theme: { apiOptions: { localeInput: { class: 'form-select' } } },
        });
        viewer.appendTo('#mount');
        expect(viewer.localeInput._domElement.className).toBe('form-select');
    });
});
