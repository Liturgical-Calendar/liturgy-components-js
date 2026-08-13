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
import CalendarControls from '../MetaComponents/CalendarControls.js';
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
    // supports a wrapper exactly as `CalendarSelect` does.
    //
    // `riteSelect` was the third such omission and was pinned here as a genuine
    // capability limit, `RiteSelect` having had no `wrapper()` at all. It has one
    // now (see `RiteSelect.wrapper()`), so the flat key must reach it too: a
    // `wrapper` role honoured for one of two selects is not a role vocabulary.
    it('wraps every DayViewer child that can take a wrapper, and only those', () => {
        const viewer = new DayViewer({ locale: 'en', theme: FLAT_BAG });
        viewer.appendTo('#mount');

        expect(
            viewer.calendarSelect._domElement.closest('.col-md-3'),
        ).not.toBeNull();
        expect(
            viewer.localeInput._domElement.closest('.col-md-3'),
        ).not.toBeNull();
        expect(
            viewer.riteSelect._domElement.closest('.col-md-3'),
        ).not.toBeNull();
    });

    it('wraps both selects for CalendarResourcePicker', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
            theme: FLAT_BAG,
        });
        picker.appendTo('#mount');

        expect(
            picker.calendarSelect._domElement.closest('.col-md-3'),
        ).not.toBeNull();
        expect(
            picker.riteSelect._domElement.closest('.col-md-3'),
        ).not.toBeNull();
    });

    it('wraps both selects for CalendarControls', () => {
        const controls = new CalendarControls({
            locale: 'en',
            theme: FLAT_BAG,
        });
        controls.appendTo('#mount');

        expect(
            controls.calendarSelect._domElement.closest('.col-md-3'),
        ).not.toBeNull();
        expect(
            controls.riteSelect._domElement.closest('.col-md-3'),
        ).not.toBeNull();
    });

    it('honours an explicit riteSelect.wrapperClass override over the flat key', () => {
        const controls = new CalendarControls({
            locale: 'en',
            theme: { ...FLAT_BAG, riteSelect: { wrapperClass: 'col-md-2' } },
        });
        controls.appendTo('#mount');

        expect(
            controls.riteSelect._domElement.closest('.col-md-2'),
        ).not.toBeNull();
        expect(controls.riteSelect._domElement.closest('.col-md-3')).toBeNull();
    });
});

/**
 * The second half of the same symmetry, and the one the flat-bag cases above
 * could not reach. `wrapper` is an accepted PER-CHILD key for the select and
 * input roles (`Theme.js`, OVERRIDE_KEYS_BY_ROLE), where it names the wrapper's
 * element TYPE — as against the FLAT `theme.wrapper`, which `resolveChildTheme()`
 * maps onto a wrapperCLASS. Every meta-component gated its wrapper call on
 * `wrapperClass` alone, so a per-child theme naming only the type was accepted by
 * the resolver, carried all the way to the call site, and dropped there in
 * silence — no wrapper, no throw, no warning.
 *
 * `DayViewer`'s locale input was fixed first (see `DayViewer.test.js`); these pin
 * the same property for both SELECT children of all three components, so the key
 * cannot be honoured for some children and ignored for others again. The shared
 * `resolveWrapperBag()` is what makes that structural rather than a promise.
 */
describe('a per-child wrapper TYPE is honoured wherever it is accepted', () => {
    beforeEach(() => {
        document.body.innerHTML = '<table><tr id="row"></tr></table>';
    });

    const wrappedIn = (element, tag) => element.closest(tag);

    it('wraps DayViewer’s selects in the themed element type', () => {
        const viewer = new DayViewer({
            locale: 'en',
            theme: {
                riteSelect: { wrapper: 'td' },
                calendarSelect: { wrapper: 'td' },
            },
        });
        viewer.appendTo('#row');

        expect(wrappedIn(viewer.riteSelect._domElement, 'td')).not.toBeNull();
        expect(
            wrappedIn(viewer.calendarSelect._domElement, 'td'),
        ).not.toBeNull();
    });

    it('wraps CalendarControls’ selects in the themed element type', () => {
        const controls = new CalendarControls({
            locale: 'en',
            theme: {
                riteSelect: { wrapper: 'td' },
                calendarSelect: { wrapper: 'td' },
            },
        });
        controls.appendTo('#row');

        expect(wrappedIn(controls.riteSelect._domElement, 'td')).not.toBeNull();
        expect(
            wrappedIn(controls.calendarSelect._domElement, 'td'),
        ).not.toBeNull();
    });

    it('wraps CalendarResourcePicker’s selects in the themed element type', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
            theme: {
                riteSelect: { wrapper: 'td' },
                calendarSelect: { wrapper: 'td' },
            },
        });
        picker.appendTo('#row');

        expect(wrappedIn(picker.riteSelect._domElement, 'td')).not.toBeNull();
        expect(
            wrappedIn(picker.calendarSelect._domElement, 'td'),
        ).not.toBeNull();
    });

    it('applies the type and the class together', () => {
        const controls = new CalendarControls({
            locale: 'en',
            theme: {
                calendarSelect: { wrapper: 'td', wrapperClass: 'col-md-4' },
            },
        });
        controls.appendTo('#row');

        const wrapper = wrappedIn(controls.calendarSelect._domElement, 'td');
        expect(wrapper).not.toBeNull();
        expect(wrapper.className).toBe('col-md-4');
    });

    it('still defaults the type to div when only a class is themed', () => {
        document.body.innerHTML = '<div id="mount"></div>';
        const controls = new CalendarControls({
            locale: 'en',
            theme: { calendarSelect: { wrapperClass: 'col-md-4' } },
        });
        controls.appendTo('#mount');

        const wrapper = wrappedIn(
            controls.calendarSelect._domElement,
            '.col-md-4',
        );
        expect(wrapper).not.toBeNull();
        expect(wrapper.tagName).toBe('DIV');
    });
});
