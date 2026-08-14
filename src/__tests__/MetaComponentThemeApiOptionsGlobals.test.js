/** @jest-environment jsdom */
/**
 * `theme.apiOptions` against the process-wide `Input.setGlobal*` statics.
 *
 * The whole point of issue #60 is to let a consumer STOP calling those four
 * setters — but a page does not migrate in one step, and
 * `LiturgicalCalendarFrontend` plus six of this repo's examples still call them
 * at module scope. So the two have to coexist, and the rules that make them
 * coexist are the subtle half of `Input`:
 *
 * - The constructor builds a wrapper of its own whenever `setGlobalWrapper()`
 *   has been called, setting `#hasWrapper` but NOT `#wrapperSet` — so the
 *   library's own `wrapper()` call, made once per input by
 *   `applyApiOptionsTheme()`, is still the caller's FIRST explicit one and must
 *   be honoured rather than refused.
 * - A bag naming a class beats `setGlobalWrapperClass()` and closes
 *   `wrapperClass()`; a bag naming none inherits the global and leaves
 *   `wrapperClass()` free. `resolveWrapperBag()` omits `class` entirely when the
 *   theme named none, which is what keeps the second half true.
 *
 * Before this file, nothing pinned that interaction for the ten-input path: a
 * regression would have broken every input on every such page at once, with no
 * test signal at all.
 *
 * Lives in its own file because the statics have no reset — `Input.reset()`
 * clears only the id registry — so these need a module registry no other test
 * has already written to, the same reason `InputWrapperGlobals.test.js` is
 * separate.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import Input from '../ApiOptions/Input/Input.js';
import CalendarControls from '../MetaComponents/CalendarControls.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    Input.reset();
    document.body.innerHTML = '<div id="mount"></div>';
});

describe('theme.apiOptions alongside the Input globals', () => {
    it('honours the theme wrapper as the first explicit call, and its class beats the global', () => {
        Input.setGlobalWrapper('div');
        Input.setGlobalWrapperClass('col-md');
        Input.setGlobalInputClass('legacy-select');

        const controls = new CalendarControls({
            locale: 'en',
            theme: {
                apiOptions: {
                    select: 'form-select',
                    wrapper: 'form-group col col-md-2',
                },
            },
        });
        controls.appendTo('#mount');

        const input = controls.apiOptions._epiphanyInput;
        // The constructor's global wrapper did not consume the one-shot, so the
        // library's own call went through rather than throwing.
        expect(input._wrapperElement.tagName).toBe('DIV');
        expect(input._wrapperElement.className).toBe('form-group col col-md-2');
        // The global input class is a default the theme overrides, and
        // `Input.class()` does not treat the constructor's global as "already
        // set", so this neither throws nor loses to `legacy-select`.
        expect(input._domElement.className).toBe('form-select');
    });

    it('inherits the global wrapper class when the theme names only a wrapper TYPE, leaving wrapperClass() free', () => {
        Input.setGlobalWrapper('div');
        Input.setGlobalWrapperClass('col-md');

        const controls = new CalendarControls({
            locale: 'en',
            theme: {
                apiOptions: { epiphanyInput: { wrapper: 'td' } },
            },
        });
        controls.appendTo('#mount');

        const input = controls.apiOptions._epiphanyInput;
        expect(input._wrapperElement.tagName).toBe('TD');
        expect(input._wrapperElement.className).toBe('col-md');
        // Not closed: the class it carries came from the global, not from the
        // theme's bag, so the per-input override every consuming page is built
        // on still works afterwards.
        expect(() => input.wrapperClass('col col-md-3')).not.toThrow();
        expect(input._wrapperElement.className).toBe('col col-md-3');
    });

    it('leaves the globals in sole charge of the inputs while the gate is closed', () => {
        Input.setGlobalWrapper('div');
        Input.setGlobalWrapperClass('col-md');
        Input.setGlobalInputClass('legacy-select');

        const controls = new CalendarControls({
            locale: 'en',
            theme: { select: 'form-select', wrapper: 'ignored-by-the-gate' },
        });
        controls.appendTo('#mount');

        const input = controls.apiOptions._yearTypeInput;
        expect(input._domElement.className).toBe('legacy-select');
        expect(input._wrapperElement.className).toBe('col-md');
        // Still free, because no theme wrapper was ever applied to it — the
        // migration-in-one-step trap the opt-in gate exists to avoid.
        expect(() => input.wrapperClass('col col-md-2')).not.toThrow();
    });

    // The fourth setter. This file opens by naming all four, and covered three:
    // `setGlobalLabelClass()` had no case at all, even though it is the one whose
    // one-shot behaviour differs most visibly from the input class beside it.
    it('lets theme.apiOptions.label beat the global label class, and CLOSES labelClass() after', () => {
        Input.setGlobalLabelClass('legacy-label');

        const controls = new CalendarControls({
            locale: 'en',
            theme: { apiOptions: { label: 'form-label d-block mb-1' } },
        });
        controls.appendTo('#mount');

        const input = controls.apiOptions._epiphanyInput;
        expect(input._labelElement.className).toBe('form-label d-block mb-1');
        // `labelClass()` is one-shot on a CHANGED value, and unlike the wrapper
        // there is no `resolveWrapperBag()`-style omission to keep it open: the
        // theme named a label class, so `applyInputTheme()` called the setter and
        // `#labelClassSet` is now true. Same consequence the wrapper carries, and
        // the reason this is a documented behaviour change rather than a pure
        // addition.
        expect(() => input.labelClass('something-else')).toThrow(
            /Label class has already been set/,
        );
        // Re-asserting the SAME value is not a change, so it is still allowed.
        expect(() => input.labelClass('form-label d-block mb-1')).not.toThrow();
    });

    it('leaves the global label class in force, and labelClass() free, while the gate is closed', () => {
        Input.setGlobalLabelClass('legacy-label');

        const controls = new CalendarControls({
            locale: 'en',
            // A flat `label`, with no `apiOptions` key: the gate stays shut, so
            // this reaches riteSelect/calendarSelect/localeInput and no further.
            theme: { label: 'ignored-by-the-gate' },
        });
        controls.appendTo('#mount');

        const input = controls.apiOptions._epiphanyInput;
        expect(input._labelElement.className).toBe('legacy-label');
        // Free, and this is the asymmetry worth pinning: the constructor assigns
        // the global straight to the element WITHOUT setting `#labelClassSet`, so
        // an inherited global — unlike a themed class — leaves the per-input
        // override every consuming page still relies on available.
        expect(input._labelClassSet).toBe(false);
        expect(() => input.labelClass('form-label')).not.toThrow();
        expect(input._labelElement.className).toBe('form-label');
    });
});
