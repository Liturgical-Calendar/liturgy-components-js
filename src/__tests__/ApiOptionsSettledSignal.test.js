/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import { ApiOptionsFilter, CalendarSelectFilter } from '../Enums.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.innerHTML = '<div id="opts"></div>';
});

describe('ApiOptions.onSettled()', () => {
    it('notifies once for a burst of input changes in one turn', async () => {
        const apiOptions = new ApiOptions('en');
        const seen = jest.fn();
        apiOptions.onSettled(seen);

        apiOptions.yearInput._domElement.dispatchEvent(new Event('change'));
        apiOptions.localeInput._domElement.dispatchEvent(new Event('change'));
        await Promise.resolve();

        expect(seen).toHaveBeenCalledTimes(1);
    });

    it('notifies again for a second action in a separate turn', async () => {
        const apiOptions = new ApiOptions('en');
        const seen = jest.fn();
        apiOptions.onSettled(seen);

        apiOptions.yearInput._domElement.dispatchEvent(new Event('change'));
        await Promise.resolve();
        apiOptions.yearInput._domElement.dispatchEvent(new Event('change'));
        await Promise.resolve();

        expect(seen).toHaveBeenCalledTimes(2);
    });

    it('notifies for a lone edit that originates no cascade', async () => {
        const apiOptions = new ApiOptions('en');
        const seen = jest.fn();
        apiOptions.onSettled(seen);

        apiOptions.yearInput._domElement.dispatchEvent(new Event('change'));
        await Promise.resolve();

        expect(seen).toHaveBeenCalledTimes(1);
    });

    it('does not fire on subscribe', async () => {
        const apiOptions = new ApiOptions('en');
        const seen = jest.fn();
        apiOptions.onSettled(seen);

        await Promise.resolve();

        expect(seen).not.toHaveBeenCalled();
    });

    it('throws for a non-function', () => {
        const apiOptions = new ApiOptions('en');
        expect(() => apiOptions.onSettled('nope')).toThrow(
            /Expected a function/,
        );
    });

    it('stops notifying after the returned unsubscribe is called', async () => {
        const apiOptions = new ApiOptions('en');
        const seen = jest.fn();
        const unsubscribe = apiOptions.onSettled(seen);
        unsubscribe();

        apiOptions.yearInput._domElement.dispatchEvent(new Event('change'));
        await Promise.resolve();

        expect(seen).not.toHaveBeenCalled();
    });

    it('isolates a throwing callback from the others and reports it', async () => {
        const apiOptions = new ApiOptions('en');
        const errors = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        const after = jest.fn();
        apiOptions.onSettled(() => {
            throw new Error('subscriber blew up');
        });
        apiOptions.onSettled(after);

        apiOptions.yearInput._domElement.dispatchEvent(new Event('change'));
        await Promise.resolve();

        expect(after).toHaveBeenCalledTimes(1);
        expect(errors).toHaveBeenCalled();
        errors.mockRestore();
    });

    it('does not skip the next subscriber when one unsubscribes mid-flush', async () => {
        const apiOptions = new ApiOptions('en');
        const second = jest.fn();
        const unsubscribeFirst = apiOptions.onSettled(() => unsubscribeFirst());
        apiOptions.onSettled(second);

        apiOptions.yearInput._domElement.dispatchEvent(new Event('change'));
        await Promise.resolve();

        expect(second).toHaveBeenCalledTimes(1);
    });
});

describe('ApiOptions.onSettled() and the linked selects', () => {
    it('notifies once for a rite change, not once per cascaded input', async () => {
        const riteSelect = new RiteSelect('en');
        const apiOptions = new ApiOptions('en').linkToRiteSelect(riteSelect);
        const seen = jest.fn();
        apiOptions.onSettled(seen);

        riteSelect._domElement.value = 'ambrosian';
        riteSelect._domElement.dispatchEvent(new Event('change'));
        await Promise.resolve();

        expect(seen).toHaveBeenCalledTimes(1);
    });

    it('notifies once for a calendar change', async () => {
        const calendarSelect = new CalendarSelect('en');
        const apiOptions = new ApiOptions('en').linkToCalendarSelect(
            calendarSelect,
        );
        const seen = jest.fn();
        apiOptions.onSettled(seen);

        calendarSelect._domElement.value = 'IT';
        calendarSelect._domElement.dispatchEvent(new Event('change'));
        await Promise.resolve();

        expect(seen).toHaveBeenCalledTimes(1);
    });

    it('an unlinked ApiOptions still signals for its own inputs', async () => {
        const apiOptions = new ApiOptions('en');
        const seen = jest.fn();
        apiOptions.onSettled(seen);

        apiOptions.localeInput._domElement.dispatchEvent(new Event('change'));
        await Promise.resolve();

        expect(seen).toHaveBeenCalledTimes(1);
    });

    it('notifies once for a nation change in a linked nation/diocese pair', async () => {
        const nationSelect = new CalendarSelect('en').filter(
            CalendarSelectFilter.NATIONAL_CALENDARS,
        );
        const dioceseSelect = new CalendarSelect('en').filter(
            CalendarSelectFilter.DIOCESAN_CALENDARS,
        );
        const apiOptions = new ApiOptions('en').linkToCalendarSelect([
            nationSelect,
            dioceseSelect,
        ]);
        const seen = jest.fn();
        apiOptions.onSettled(seen);

        nationSelect._domElement.value = 'IT';
        nationSelect._domElement.dispatchEvent(new Event('change'));
        await Promise.resolve();

        expect(seen).toHaveBeenCalledTimes(1);
    });
});

describe('ApiOptions.onSettled() and the path builder', () => {
    it('notifies once for a calendar path change', async () => {
        const apiOptions = new ApiOptions('en').filter(
            ApiOptionsFilter.PATH_BUILDER,
        );
        apiOptions.appendTo('#opts');
        const seen = jest.fn();
        apiOptions.onSettled(seen);

        apiOptions.calendarPathInput._domElement.dispatchEvent(
            new Event('change'),
        );
        await Promise.resolve();

        expect(seen).toHaveBeenCalledTimes(1);
    });
});
