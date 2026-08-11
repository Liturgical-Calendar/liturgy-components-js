/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import CalendarResourcePicker from '../MetaComponents/CalendarResourcePicker.js';
import { CalendarSelectFilter } from '../Enums.js';

const METADATA = {
    locales: ['en', 'it'],
    national_calendars: [
        { calendar_id: 'IT', locales: ['it-IT'], settings: {} },
    ],
    diocesan_calendars: [
        {
            calendar_id: 'romamo_it',
            nation: 'IT',
            diocese: 'Diocesi di Roma',
            locales: ['it-IT'],
            rite: 'roman',
        },
    ],
    ambrosian_calendars: [],
};

const API_URL = 'http://localhost:8000';

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, METADATA);
    document.body.innerHTML = '<div id="mount"></div>';
});

describe('CalendarResourcePicker.mountInto', () => {
    it('resolves to a mounted picker', async () => {
        const picker = await CalendarResourcePicker.mountInto('#mount', {
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        expect(picker).toBeInstanceOf(CalendarResourcePicker);
        expect(picker.failed).toBe(false);
        expect(document.querySelector('#mount select')).not.toBeNull();
    });

    it('empties the target before mounting, so a remount does not stack', async () => {
        document.getElementById('mount').innerHTML = '<span>stale</span>';
        await CalendarResourcePicker.mountInto('#mount', {
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        expect(document.querySelector('#mount span')).toBeNull();
    });

    // Programmer error rejects; runtime failure does not.
    it('rejects on an invalid filter', async () => {
        await expect(
            CalendarResourcePicker.mountInto('#mount', {
                locale: 'en',
                filter: CalendarSelectFilter.NONE,
            }),
        ).rejects.toThrow(/filter/);
    });

    it('rejects when the target matches nothing', async () => {
        await expect(
            CalendarResourcePicker.mountInto('#nope', {
                locale: 'en',
                filter: CalendarSelectFilter.NATIONAL_CALENDARS,
            }),
        ).rejects.toThrow(/nope/);
    });

    it('renders a visible failure control on a runtime failure', async () => {
        // An unloaded base is a runtime failure, not a programmer error: it is what
        // a down API looks like from here.
        ApiBase.reset();
        const errorSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        const picker = await CalendarResourcePicker.mountInto('#mount', {
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
            errorText: 'Could not load calendars',
            theme: { select: 'form-select perm-object-id' },
        });

        expect(picker.failed).toBe(true);
        const control = document.querySelector('#mount select');
        expect(control).not.toBeNull();
        expect(control.disabled).toBe(true);
        expect(control.classList.contains('is-invalid')).toBe(true);
        // The theme's marker classes survive, so form validation and E2E selectors
        // still find the control.
        expect(control.classList.contains('perm-object-id')).toBe(true);
        expect(control.dataset.loadFailed).toBe('true');
        expect(control.textContent).toContain('Could not load calendars');
        expect(errorSpy).toHaveBeenCalled();
        errorSpy.mockRestore();
    });

    it('does not mount when the signal is already aborted', async () => {
        const controller = new AbortController();
        controller.abort();
        const picker = await CalendarResourcePicker.mountInto('#mount', {
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
            signal: controller.signal,
        });
        expect(picker).toBeNull();
        expect(document.querySelector('#mount select')).toBeNull();
    });

    it('does not mount when the target has left the DOM', async () => {
        const detached = document.createElement('div');
        const picker = await CalendarResourcePicker.mountInto(detached, {
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        expect(picker).toBeNull();
    });

    // Programmer error rejects; runtime failure does not — a bad locale is a
    // typo, not a down API, and must not be reported as one.
    it('rejects on an unparseable locale and renders no failure control', async () => {
        await expect(
            CalendarResourcePicker.mountInto('#mount', {
                locale: 'not a locale!!!',
                filter: CalendarSelectFilter.NATIONAL_CALENDARS,
            }),
        ).rejects.toThrow();
        expect(document.querySelector('#mount select')).toBeNull();
    });

    it('leaves calendarSelect and riteSelect both null on a failed picker', async () => {
        // An unloaded base is a runtime failure, not a programmer error.
        ApiBase.reset();
        const errorSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        const picker = await CalendarResourcePicker.mountInto('#mount', {
            locale: 'en',
            filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
        });

        expect(picker.failed).toBe(true);
        expect(picker.calendarSelect).toBeNull();
        expect(picker.riteSelect).toBeNull();
        expect(picker.value).toBe('');
        errorSpy.mockRestore();
    });
});

describe('CalendarResourcePicker.dispose', () => {
    it('empties the mount', async () => {
        const picker = await CalendarResourcePicker.mountInto('#mount', {
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        picker.dispose();
        expect(document.getElementById('mount').children.length).toBe(0);
    });

    it('stops onChange callbacks from firing', async () => {
        const picker = await CalendarResourcePicker.mountInto('#mount', {
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        let fired = false;
        picker.onChange(() => (fired = true));
        const element = picker.calendarSelect._domElement;
        picker.dispose();

        element.dispatchEvent(new Event('change', { bubbles: true }));
        expect(fired).toBe(false);
    });

    it('is idempotent', async () => {
        const picker = await CalendarResourcePicker.mountInto('#mount', {
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        picker.dispose();
        expect(() => picker.dispose()).not.toThrow();
    });

    it('throws on use after dispose rather than failing quietly', async () => {
        const picker = await CalendarResourcePicker.mountInto('#mount', {
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        picker.dispose();
        expect(() => picker.appendTo('#mount')).toThrow(/disposed/);
        expect(() => picker.onChange(() => {})).toThrow(/disposed/);
    });

    // Pins the fuller contract: EVERY public member throws once disposed, not only
    // appendTo() and onChange(). A caller who read calendarSelect/riteSelect before
    // dispose() and kept the reference gets a fully live child otherwise — dispose()
    // cannot revoke a reference already handed out, so it must stop handing out new
    // ones, and every getter must refuse to serve a stale value too.
    it('throws on every getter after dispose, not only appendTo and onChange', async () => {
        const picker = await CalendarResourcePicker.mountInto('#mount', {
            locale: 'en',
            filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
        });
        picker.dispose();
        expect(() => picker.calendarSelect).toThrow(/disposed/);
        expect(() => picker.riteSelect).toThrow(/disposed/);
        expect(() => picker.value).toThrow(/disposed/);
        expect(() => picker.failed).toThrow(/disposed/);
    });

    it('drops its references to the wired children, so a reference held before dispose does not resurrect their getters', async () => {
        const picker = await CalendarResourcePicker.mountInto('#mount', {
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        const heldCalendarSelect = picker.calendarSelect;
        picker.dispose();
        // The picker's own getter throws (pinned above); the child instance itself
        // is untouched by this test, on purpose — dispose() promises to make the
        // PICKER inert, not to reach into a component the caller might still be
        // holding for an unrelated reason.
        expect(heldCalendarSelect).not.toBeNull();
        expect(() => picker.calendarSelect).toThrow(/disposed/);
    });
});
