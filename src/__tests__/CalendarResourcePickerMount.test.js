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

    // F2: an unknown scope key is a typo, the same class of programmer error
    // as an invalid filter above — not a runtime "API is down" condition —
    // so it must REJECT rather than resolve with a disabled failure control.
    it('rejects on an unknown scope key, naming the component, rather than resolving with a failed picker', async () => {
        await expect(
            CalendarResourcePicker.mountInto('#mount', {
                locale: 'en',
                filter: CalendarSelectFilter.NATIONAL_CALENDARS,
                scope: { natoin: 'IT' },
            }),
        ).rejects.toThrow(/CalendarResourcePicker.*natoin/s);
    });

    // The doc's own worked example: a filter that structurally cannot show a
    // PINNED rite is likewise a programmer error, previously swallowed by the
    // try below scope validation was hoisted out of it.
    it('rejects when scope pins a rite the filter cannot surface, rather than resolving with a failed picker', async () => {
        await expect(
            CalendarResourcePicker.mountInto('#mount', {
                locale: 'en',
                filter: CalendarSelectFilter.NATIONAL_CALENDARS,
                scope: { rite: 'ambrosian' },
            }),
        ).rejects.toThrow(
            /CalendarResourcePicker.*ambrosian.*NATIONAL_CALENDARS/s,
        );
    });

    // F1 (post-PR review): the rite check above only catches a scope that
    // PINS a rite this filter cannot surface AT ALL. A diocese scope under
    // NATIONAL_CALENDARS pins the Roman rite, which DOES have a national
    // tier, so that check passes — but the scope resolves to only a
    // diocesan entry, which this filter's select cannot show either. That
    // mismatch used to surface only inside `_restrictToScope()`, deep in the
    // constructor's `try`, and so was reported as a runtime "API is down"
    // failure instead of the programmer error it is.
    it('rejects when a diocese scope resolves to only diocesan entries under a NATIONAL_CALENDARS filter, rather than resolving with a failed picker', async () => {
        await expect(
            CalendarResourcePicker.mountInto('#mount', {
                locale: 'en',
                filter: CalendarSelectFilter.NATIONAL_CALENDARS,
                scope: { diocese: 'romamo_it' },
            }),
        ).rejects.toThrow(
            /CalendarResourcePicker.*diocesan.*NATIONAL_CALENDARS/s,
        );
    });

    // Same class of mismatch, the other direction: a nation scope with no
    // `includeDioceses` resolves to only a national entry, which a
    // DIOCESAN_CALENDARS filter cannot show.
    it('rejects when a nation scope with no includeDioceses resolves to only a national entry under a DIOCESAN_CALENDARS filter, rather than resolving with a failed picker', async () => {
        await expect(
            CalendarResourcePicker.mountInto('#mount', {
                locale: 'en',
                filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
                scope: { nation: 'IT' },
            }),
        ).rejects.toThrow(
            /CalendarResourcePicker.*national.*DIOCESAN_CALENDARS/s,
        );
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

// C1: a failed picker's ACTION methods must be safe to call, not only its
// getters. `docs/meta-components.md`'s worked example guards only
// `null !== picker` before calling `onChange()` and (indirectly, through
// `appendTo()`-based remounting) reaching `appendTo()` — both used to throw a raw
// `TypeError` because `#calendarSelect` is `null` on a failed picker.
describe('CalendarResourcePicker failed-picker safety', () => {
    /** @returns {Promise<CalendarResourcePicker>} A picker whose construction failed. */
    const mountFailed = async () => {
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
        errorSpy.mockRestore();
        return picker;
    };

    it('does not throw when onChange() is called on a failed picker', async () => {
        const picker = await mountFailed();
        expect(() => picker.onChange(() => {})).not.toThrow();
    });

    it('returns this from onChange() on a failed picker, so it stays chainable', async () => {
        const picker = await mountFailed();
        expect(picker.onChange(() => {})).toBe(picker);
    });

    it('never invokes an onChange() callback registered on a failed picker', async () => {
        const picker = await mountFailed();
        let fired = false;
        picker.onChange(() => (fired = true));
        // The failure control's own <select> is disabled and carries no working
        // CalendarSelect to dispatch through; nothing should ever call back.
        const control = document.querySelector('#mount select');
        control.dispatchEvent(new Event('change', { bubbles: true }));
        expect(fired).toBe(false);
    });

    it('does not throw when appendTo() is called again on a failed picker', async () => {
        const picker = await mountFailed();
        const other = document.createElement('div');
        other.id = 'other-mount';
        document.body.appendChild(other);
        expect(() => picker.appendTo('#other-mount')).not.toThrow();
    });

    it('re-renders the same failure control when appendTo() is called again on a failed picker', async () => {
        const picker = await mountFailed();
        const other = document.createElement('div');
        other.id = 'other-mount';
        document.body.appendChild(other);

        picker.appendTo('#other-mount');

        const control = other.querySelector('select');
        expect(control).not.toBeNull();
        expect(control.disabled).toBe(true);
        expect(control.classList.contains('is-invalid')).toBe(true);
        expect(control.classList.contains('perm-object-id')).toBe(true);
        expect(control.dataset.loadFailed).toBe('true');
        expect(control.textContent).toContain('Could not load calendars');
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
