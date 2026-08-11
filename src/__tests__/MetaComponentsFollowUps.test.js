/** @jest-environment jsdom */
/**
 * Covers the follow-ups folded in after the branch's first review round:
 *
 * - `required` on the picker's working select, closing the last documented reason
 *   to reach for `picker.calendarSelect._domElement`
 * - the failure control carrying NO `required`, because a disabled control is
 *   barred from constraint validation and the attribute would be inert
 * - `appendTo()` being safe to call twice, on both a working and a failed picker
 * - `DayViewer.listenTo()` refusing to rebind, and refusing a client bound to a
 *   different API base — both BEFORE any wiring happens, so a rejected call leaves
 *   the viewer exactly as it was
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import CalendarResourcePicker from '../MetaComponents/CalendarResourcePicker.js';
import DayViewer from '../MetaComponents/DayViewer.js';
import { CalendarSelectFilter } from '../Enums.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';
const OTHER_URL = 'http://localhost:9000';

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.replaceChildren();
    for (const id of ['mount', 'other']) {
        const el = document.createElement('div');
        el.id = id;
        document.body.appendChild(el);
    }
});

/**
 * @param {Object} [extra] - Extra constructor options.
 * @returns {CalendarResourcePicker} A mounted diocesan picker.
 */
const mountPicker = (extra = {}) => {
    const picker = new CalendarResourcePicker({
        locale: 'en',
        filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
        ...extra,
    });
    picker.appendTo('#mount');
    return picker;
};

describe('CalendarResourcePicker required', () => {
    it('is off by default', () => {
        expect(mountPicker().calendarSelect._domElement.required).toBe(false);
    });

    it('can be set through the constructor option', () => {
        const picker = mountPicker({ required: true });
        expect(picker.calendarSelect._domElement.required).toBe(true);
    });

    it('can be set through the chainable method, before mounting', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
        });
        expect(picker.required()).toBe(picker);
        picker.appendTo('#mount');
        expect(picker.calendarSelect._domElement.required).toBe(true);
    });

    it('can be set and cleared after mounting', () => {
        const picker = mountPicker();
        picker.required(true);
        expect(picker.calendarSelect._domElement.required).toBe(true);
        picker.required(false);
        expect(picker.calendarSelect._domElement.required).toBe(false);
    });

    it('rejects a non-boolean, naming the component', () => {
        expect(() => mountPicker().required('yes')).toThrow(
            /CalendarResourcePicker.*boolean.*string/,
        );
        expect(() => mountPicker({ required: 'yes' })).toThrow(
            /CalendarResourcePicker.*boolean.*string/,
        );
    });

    it('throws after dispose', () => {
        const picker = mountPicker();
        picker.dispose();
        expect(() => picker.required(true)).toThrow(/disposed/);
    });
});

describe('the failure control and constraint validation', () => {
    /** @returns {Promise<CalendarResourcePicker>} A failed picker, mounted. */
    const failedPicker = async () => {
        ApiBase.reset();
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const picker = await CalendarResourcePicker.mountInto('#mount', {
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
            errorText: 'Could not load calendars',
        });
        spy.mockRestore();
        return picker;
    };

    it('carries no required attribute, since disabled bars it from validation', async () => {
        const picker = await failedPicker();
        expect(picker.failed).toBe(true);
        const control = document.querySelector('#mount select');
        expect(control.disabled).toBe(true);
        expect(control.required).toBe(false);
        expect(control.hasAttribute('required')).toBe(false);
    });

    it('ignores required() rather than throwing', async () => {
        const picker = await failedPicker();
        expect(() => picker.required(true)).not.toThrow();
        expect(document.querySelector('#mount select').required).toBe(false);
    });
});

describe('CalendarResourcePicker.appendTo is idempotent', () => {
    it('does not double-apply the placeholder listener on re-mount', () => {
        const picker = mountPicker({ placeholderText: 'Pick one...' });
        let applications = 0;
        // Count how many times a rite change reaches a listener on the rite select
        // by observing the placeholder being re-applied.
        const observed = () => {
            applications += 1;
        };
        picker.riteSelect._domElement.addEventListener('change', observed);

        picker.appendTo('#mount');
        picker.riteSelect._domElement.dispatchEvent(
            new Event('change', { bubbles: true }),
        );
        expect(applications).toBe(1);

        // The placeholder must still be intact after that single rite change.
        const option =
            picker.calendarSelect._domElement.querySelector('option[value=""]');
        expect(option.textContent).toBe('Pick one...');
        expect(option.disabled).toBe(true);
    });

    it('moves the children rather than duplicating them', () => {
        const picker = mountPicker();
        picker.appendTo('#other');
        expect(document.querySelectorAll('#mount select').length).toBe(0);
        expect(document.querySelectorAll('#other select').length).toBe(2);
    });

    it('leaves no orphaned failure control when a failed picker is re-mounted', async () => {
        ApiBase.reset();
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const picker = await CalendarResourcePicker.mountInto('#mount', {
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
            errorText: 'boom',
        });
        spy.mockRestore();

        picker.appendTo('#other');
        expect(document.querySelectorAll('#mount select').length).toBe(0);
        expect(document.querySelectorAll('#other select').length).toBe(1);
    });

    it('keeps dispose tracking only the active mount', () => {
        const picker = mountPicker();
        picker.appendTo('#other');
        picker.dispose();
        expect(document.getElementById('other').children.length).toBe(0);
    });
});

describe('DayViewer.listenTo guards', () => {
    it('refuses to rebind to a second client, naming DayViewer', async () => {
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: () => Promise.resolve({ litcal: [] }),
            }),
        );
        const first = await ApiClient.init(API_URL);
        const second = await ApiClient.init(API_URL);
        const viewer = new DayViewer({ locale: 'en' });
        viewer.appendTo('#mount');
        viewer.listenTo(first);

        expect(() => viewer.listenTo(second)).toThrow(
            /DayViewer\.listenTo.*already wired/,
        );
    });

    it('refuses a client bound to a different API base, before wiring anything', async () => {
        ApiBase.fromMetadata(OTHER_URL, FULL_METADATA);
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: () => Promise.resolve({ litcal: [] }),
            }),
        );
        const otherClient = await ApiClient.init(OTHER_URL);
        const viewer = new DayViewer({ locale: 'en' });
        viewer.appendTo('#mount');

        expect(() => viewer.listenTo(otherClient)).toThrow(
            /different API bases/,
        );

        // The rejected call must leave the viewer unwired, so a correct client
        // still works afterwards.
        const goodClient = await ApiClient.init(API_URL);
        expect(() => viewer.listenTo(goodClient)).not.toThrow();
    });
});
