/** @jest-environment jsdom */
/**
 * Pins one property shared across meta-components: the theme bag is a common HTML-
 * role vocabulary (`select`, `label`, `wrapper`, `input`), and the SAME flat bag
 * must not behave differently — let alone crash — from one meta-component to the
 * next. `{ select, label, wrapper }` is the theme bag's own canonical example (see
 * `docs/meta-components.md`), which makes it the most likely bag a consumer writes
 * first.
 *
 * This was found to be false for `DayViewer`: `resolveChildTheme(theme,
 * 'dateControls', 'input')` handed back a `wrapperClass` with no `wrapper` element
 * TYPE, and `Input.wrapperClass()` (via `LiturgyOfAnyDay`'s
 * `dayInputConfig()`/`monthInputConfig()`/`yearInputConfig()`) requires a wrapper
 * element to already exist — so the exact bag below threw
 * `"Wrapper has not been set, cannot set wrapper class on Input instance."` from
 * `DayViewer`'s constructor while working fine on `CalendarResourcePicker`, which
 * has no theme-bag consumer with that precondition. Fixed at the `DayViewer` call
 * site (defaulting `controls.wrapper` to `'div'` whenever a `wrapperClass` arrives
 * with no explicit element type), not in the shared `resolveChildTheme()` — the gap
 * belongs to the one meta-component whose child actually has that precondition.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import DayViewer from '../MetaComponents/DayViewer.js';
import CalendarResourcePicker from '../MetaComponents/CalendarResourcePicker.js';
import { CalendarSelectFilter } from '../Enums.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

/** The theme bag's own canonical example — the shape a consumer reaches for first. */
const FLAT_BAG = {
    select: 'form-select',
    label: 'form-label',
    wrapper: 'col-md-3',
};

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.innerHTML = '<div id="mount"></div>';
});

describe('Theme bag symmetry: { select, label, wrapper }', () => {
    it('constructs and mounts DayViewer without throwing', () => {
        expect(() => {
            const viewer = new DayViewer({ locale: 'en', theme: FLAT_BAG });
            viewer.appendTo('#mount');
        }).not.toThrow();
        expect(
            document.querySelectorAll('#mount select').length,
        ).toBeGreaterThan(0);
    });

    it('constructs and mounts CalendarResourcePicker without throwing', () => {
        expect(() => {
            const picker = new CalendarResourcePicker({
                locale: 'en',
                filter: CalendarSelectFilter.NATIONAL_CALENDARS,
                theme: FLAT_BAG,
            });
            picker.appendTo('#mount');
        }).not.toThrow();
        expect(
            document.querySelectorAll('#mount select').length,
        ).toBeGreaterThan(0);
    });

    // I1: `.not.toThrow()` alone cannot tell "the wrapper applied" apart from "the
    // wrapper was silently skipped" — both pass it. These assert the resulting DOM
    // structure instead: which children actually got wrapped, and which did not.
    // Found this way: with `{ select, label, wrapper }`, `DayViewer` wrapped its
    // `calendarSelect` but silently skipped `localeInput`, even though `LocaleInput`
    // supports a wrapper exactly as `CalendarSelect` does — an omission, not a
    // capability limit (unlike `riteSelect`, which genuinely has none).
    it('wraps every DayViewer child that can take a wrapper, and only those', () => {
        const viewer = new DayViewer({ locale: 'en', theme: FLAT_BAG });
        viewer.appendTo('#mount');

        const calendarWrapper =
            viewer.calendarSelect._domElement.closest('.col-md-3');
        expect(calendarWrapper).not.toBeNull();

        const localeWrapper =
            viewer.localeInput._domElement.closest('.col-md-3');
        expect(localeWrapper).not.toBeNull();

        // RiteSelect has no wrapper concept: the flat key must not invent one for
        // it, and the select's parent must be the mount itself.
        expect(viewer.riteSelect._domElement.closest('.col-md-3')).toBeNull();
        expect(viewer.riteSelect._domElement.parentElement).toBe(
            document.getElementById('mount'),
        );
    });

    it('wraps only the calendar select for CalendarResourcePicker, since RiteSelect has none', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
            theme: FLAT_BAG,
        });
        picker.appendTo('#mount');

        expect(
            picker.calendarSelect._domElement.closest('.col-md-3'),
        ).not.toBeNull();
        expect(picker.riteSelect._domElement.closest('.col-md-3')).toBeNull();
    });
});
