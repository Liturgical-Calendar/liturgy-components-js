/** @jest-environment jsdom */
/**
 * Theme presets as `Theme.js` resolves them (issue #67).
 *
 * The suite is deliberately split between this file's unit-level checks of the four
 * `Theme.js` entry points and the end-to-end block at the bottom, which constructs
 * every one of the six theme-taking components. The unit checks say what the resolver
 * computes; only the end-to-end block says what a consumer actually sees, and the two
 * have to agree.
 *
 * **The split is not belt-and-braces, it is load-bearing**, and the `url` role proves
 * it: a unit test that calls `resolveChildTheme( theme, 'subscriptionUrl', 'url' )`
 * passes whether or not `SubscriptionBuilder` actually asks for that role. Reverting
 * the call site left every unit test green. Only the mounted assertion goes red.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import Input from '../ApiOptions/Input/Input.js';
import { CalendarSelectFilter } from '../Enums.js';
import CalendarResourcePicker from '../MetaComponents/CalendarResourcePicker.js';
import CalendarControls from '../MetaComponents/CalendarControls.js';
import CalendarViewer from '../MetaComponents/CalendarViewer.js';
import ApiExplorer from '../MetaComponents/ApiExplorer.js';
import DayViewer from '../MetaComponents/DayViewer.js';
import SubscriptionBuilder from '../SubscriptionBuilder/SubscriptionBuilder.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

import {
    assertTheme,
    narrowTheme,
    resolveChildTheme,
    resolveApiOptionsInputTheme,
    THEME_CHILD_KEYS,
} from '../MetaComponents/Theme.js';
import { THEME_PRESET_NAMES } from '../MetaComponents/ThemePresets.js';

const API_URL = 'http://localhost:8000';

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    Input.reset();
    document.body.innerHTML =
        '<div id="controls"></div><div id="url"></div><div id="mount"></div>';
});

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

// A prerequisite for the preset, not a bonus. `collectFlatDefaults()` used to read
// `CLASS_KEY_BY_ROLE[ role ] ?? 'select'`, so the two roles with no entry inherited
// `theme.select` — and `theme: 'bootstrap5'` would have put Bootstrap's select styling
// (border, padding, dropdown-arrow background image) onto a `LiturgyOfAnyDay` card and
// onto the subscription URL's copy `<button>`. Neither is a `<select>`, and the flat key
// has always been documented as applying to "every `<select>` child".
describe('a flat theme class reaches controls only', () => {
    it('does not reach the liturgy child, which is not a select', () => {
        expect(
            resolveChildTheme('bootstrap5', 'liturgy', 'liturgy'),
        ).not.toHaveProperty('class');
        expect(
            resolveChildTheme({ select: 'form-select' }, 'liturgy', 'liturgy'),
        ).not.toHaveProperty('class');
    });

    it('still honours a per-child class on the liturgy child', () => {
        expect(
            resolveChildTheme(
                { preset: 'bootstrap5', liturgy: { class: 'card shadow' } },
                'liturgy',
                'liturgy',
            ),
        ).toEqual({ class: 'card shadow' });
    });

    it('does not reach the subscription URL control, which is a button', () => {
        expect(
            resolveChildTheme('bootstrap5', 'subscriptionUrl', 'url'),
        ).not.toHaveProperty('class');
        expect(
            resolveChildTheme(
                { select: 'form-select' },
                'subscriptionUrl',
                'url',
            ),
        ).not.toHaveProperty('class');
    });

    it('still honours a per-child class on the subscription URL control', () => {
        expect(
            resolveChildTheme(
                { preset: 'bootstrap5', subscriptionUrl: 'url-box' },
                'subscriptionUrl',
                'url',
            ),
        ).toEqual({ class: 'url-box' });
    });

    it('still reaches the select- and input-role children', () => {
        expect(resolveChildTheme('bootstrap5', 'riteSelect', 'select')).toEqual(
            { class: 'form-select', labelClass: 'form-label' },
        );
        expect(
            resolveChildTheme('bootstrap5', 'dateControls', 'input'),
        ).toEqual({ class: 'form-control', labelClass: 'form-label' });
    });
});

describe('a preset on a mounted component', () => {
    it('styles a CalendarResourcePicker, which has no ApiOptions', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
            theme: 'bootstrap5',
        });
        expect(picker.riteSelect._domElement.className).toBe('form-select');
        expect(picker.calendarSelect._domElement.className).toBe('form-select');
        picker.dispose();
    });

    it('styles a CalendarControls, form included', () => {
        const controls = new CalendarControls({
            locale: 'en',
            theme: 'bootstrap5',
        });
        expect(controls.riteSelect._domElement.className).toBe('form-select');
        expect(controls.calendarSelect._domElement.className).toBe(
            'form-select',
        );
        expect(controls.apiOptions.epiphanyInput._domElement.className).toBe(
            'form-select',
        );
        expect(controls.apiOptions.yearInput._domElement.className).toBe(
            'form-control',
        );
        expect(controls.apiOptions.localeInput._labelElement.className).toBe(
            'form-label',
        );
        controls.dispose();
    });

    it('styles a CalendarViewer through the controls it forwards to', () => {
        const viewer = new CalendarViewer({
            locale: 'en',
            theme: 'bootstrap5',
            initialFetch: false,
        });
        expect(viewer.controls.calendarSelect._domElement.className).toBe(
            'form-select',
        );
        expect(
            viewer.controls.apiOptions.yearTypeInput._domElement.className,
        ).toBe('form-select');
        viewer.dispose();
    });

    it('styles an ApiExplorer through the controls it forwards to', () => {
        const explorer = new ApiExplorer({
            locale: 'en',
            theme: 'bootstrap5',
        });
        expect(explorer.controls.riteSelect._domElement.className).toBe(
            'form-select',
        );
        expect(
            explorer.controls.apiOptions.calendarPathInput._domElement
                .className,
        ).toBe('form-select');
        explorer.dispose();
    });

    it('styles a DayViewer without styling its liturgy card as a select', () => {
        const viewer = new DayViewer({
            locale: 'en',
            theme: 'bootstrap5',
            initialFetch: false,
        });
        expect(viewer.riteSelect._domElement.className).toBe('form-select');
        expect(viewer.localeInput._domElement.className).toBe('form-select');
        // The liturgy card is a `<div>`, not a control: a flat class must not reach it.
        expect(viewer.liturgy._domElement.className).not.toContain(
            'form-select',
        );
        viewer.dispose();
    });

    // The one assertion that catches `SubscriptionBuilder` asking for the wrong role.
    it('styles a SubscriptionBuilder without styling its copy button as a select', () => {
        const builder = new SubscriptionBuilder({
            locale: 'en',
            theme: 'bootstrap5',
        });
        builder.appendTo({ controls: '#controls', url: '#url' });
        expect(builder.calendarSelect._domElement.className).toBe(
            'form-select',
        );
        const button = document.querySelector('#url button');
        expect(button).not.toBeNull();
        expect(button.className).not.toContain('form-select');
        builder.dispose();
    });

    it('applies bootstrap4, which styles selects with form-control and labels not at all', () => {
        const controls = new CalendarControls({
            locale: 'en',
            theme: 'bootstrap4',
        });
        expect(controls.calendarSelect._domElement.className).toBe(
            'form-control',
        );
        expect(controls.apiOptions.epiphanyInput._domElement.className).toBe(
            'form-control',
        );
        expect(controls.apiOptions.localeInput._labelElement.className).toBe(
            '',
        );
        controls.dispose();
    });

    it('lets a per-child override beat the preset on the mounted markup', () => {
        const controls = new CalendarControls({
            locale: 'en',
            theme: {
                preset: 'bootstrap5',
                calendarSelect: { class: 'form-select form-select-lg' },
            },
        });
        expect(controls.calendarSelect._domElement.className).toBe(
            'form-select form-select-lg',
        );
        expect(controls.riteSelect._domElement.className).toBe('form-select');
        controls.dispose();
    });

    // The escape-hatch consequence of opening the gate, and the half of it a preset
    // deliberately avoids. Documented in `docs/meta-components.md`; pinned here because
    // a page mid-migration off `Input.setGlobal*` still calls `wrapperClass()` per input,
    // and a preset that closed it would break exactly the migration it exists to enable.
    it('closes class() and labelClass() on the ten inputs, but leaves wrapperClass() open', () => {
        Input.setGlobalWrapper('div');
        const controls = new CalendarControls({
            locale: 'en',
            theme: 'bootstrap5',
        });
        const year = controls.apiOptions.yearInput;
        // Re-asserting the same string is allowed; a different one is the caller
        // contradicting the theme they wrote, and is reported.
        expect(() => year.class('form-control')).not.toThrow();
        expect(() => year.class('form-control-sm')).toThrow(
            /Class has already been set/,
        );
        expect(() => year.labelClass('form-label-x')).toThrow(
            /Label class has already been set/,
        );
        // No wrapper came from the preset, so this is still the caller's to set.
        expect(() =>
            year.wrapperClass('form-group col col-md-2'),
        ).not.toThrow();
        expect(year._wrapperElement.className).toBe('form-group col col-md-2');
        controls.dispose();
    });

    it('rejects an unknown preset from a constructor, naming the component', () => {
        expect(
            () => new CalendarControls({ locale: 'en', theme: 'bootstrap6' }),
        ).toThrow(/^CalendarControls: theme preset 'bootstrap6'/);
        expect(
            () =>
                new SubscriptionBuilder({ locale: 'en', theme: 'bootstrap6' }),
        ).toThrow(/^SubscriptionBuilder: theme preset 'bootstrap6'/);
    });
});
