/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import { CalendarSelectFilter, Rite } from '../Enums.js';

/**
 * Carries two Ambrosian dioceses so a rite rebuild is observable by which
 * calendar ids survive it, and one Roman diocese that must not.
 */
const METADATA = {
    locales: ['en', 'it', 'la'],
    national_calendars: [
        { calendar_id: 'IT', locales: ['it-IT'], settings: {} },
        { calendar_id: 'VA', locales: ['la', 'it-IT'], settings: {} },
    ],
    diocesan_calendars: [
        {
            calendar_id: 'romamo_it',
            nation: 'IT',
            diocese: 'Diocesi di Roma',
            locales: ['it-IT'],
            rite: 'roman',
        },
        {
            calendar_id: 'milano_it',
            nation: 'IT',
            diocese: 'Diocesi di Milano',
            locales: ['it-IT'],
            rite: 'ambrosian',
        },
        {
            calendar_id: 'lugano_ch',
            nation: 'CH',
            diocese: 'Diocesi di Lugano',
            locales: ['it-IT'],
            rite: 'ambrosian',
        },
    ],
    ambrosian_calendars: [
        { calendar_id: 'ambrosian', rite: 'ambrosian', locales: ['it', 'la'] },
    ],
};

const API_URL = 'http://localhost:8000';

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, METADATA);
    document.body.innerHTML =
        '<div id="rite"></div><div id="nation"></div><div id="diocese"></div><div id="opts"></div>';
});

const buildParts = () => {
    const riteSelect = new RiteSelect('en');
    riteSelect.appendTo('#rite');

    const nationSelect = new CalendarSelect('en')
        .filter(CalendarSelectFilter.NATIONAL_CALENDARS)
        .allowNull(true);
    nationSelect.appendTo('#nation');

    const dioceseSelect = new CalendarSelect('en')
        .filter(CalendarSelectFilter.DIOCESAN_CALENDARS)
        .linkToNationsSelect(nationSelect)
        .allowNull(true);
    dioceseSelect.appendTo('#diocese');

    const apiOptions = new ApiOptions('en');

    return { riteSelect, nationSelect, dioceseSelect, apiOptions };
};

const chooseRite = (riteSelect, rite) => {
    riteSelect._domElement.value = rite;
    riteSelect._domElement.dispatchEvent(new Event('change'));
};

const dioceseValues = (dioceseSelect) =>
    [...dioceseSelect._domElement.options].map((o) => o.value);

describe('ApiOptions.linkToRiteSelect()', () => {
    it('drives the rite chain when called after linkToCalendarSelect()', () => {
        const { riteSelect, nationSelect, dioceseSelect, apiOptions } =
            buildParts();

        apiOptions.linkToCalendarSelect([nationSelect, dioceseSelect]);
        apiOptions.linkToRiteSelect(riteSelect);
        apiOptions.appendTo('#opts');

        chooseRite(riteSelect, Rite.AMBROSIAN);

        const values = dioceseValues(dioceseSelect);
        expect(values).toContain('milano_it');
        expect(values).toContain('lugano_ch');
        expect(values).not.toContain('romamo_it');
    });

    it('drives the rite chain when called before linkToCalendarSelect()', () => {
        const { riteSelect, nationSelect, dioceseSelect, apiOptions } =
            buildParts();

        apiOptions.linkToRiteSelect(riteSelect);
        apiOptions.linkToCalendarSelect([nationSelect, dioceseSelect]);
        apiOptions.appendTo('#opts');

        chooseRite(riteSelect, Rite.AMBROSIAN);

        const values = dioceseValues(dioceseSelect);
        expect(values).toContain('milano_it');
        expect(values).toContain('lugano_ch');
        expect(values).not.toContain('romamo_it');
    });
});

describe('ApiOptions.linkToRiteSelect() rejects', () => {
    it('an argument that is not a RiteSelect, naming the type found', () => {
        const { apiOptions } = buildParts();

        expect(() => apiOptions.linkToRiteSelect({})).toThrow(
            /must be of type `RiteSelect`/,
        );
    });

    it('a second call, as linkToCalendarSelect() does', () => {
        const { riteSelect, apiOptions } = buildParts();
        const otherRiteSelect = new RiteSelect('en');

        apiOptions.linkToRiteSelect(riteSelect);

        expect(() => apiOptions.linkToRiteSelect(otherRiteSelect)).toThrow(
            /already linked/,
        );
    });

    it('a call that would replace one made through the deprecated argument', () => {
        const { riteSelect, nationSelect, dioceseSelect, apiOptions } =
            buildParts();
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

        try {
            apiOptions.linkToCalendarSelect(
                [nationSelect, dioceseSelect],
                riteSelect,
            );

            expect(() => apiOptions.linkToRiteSelect(riteSelect)).toThrow(
                /already linked/,
            );
        } finally {
            warn.mockRestore();
        }
    });
});

describe('the deprecated second argument of linkToCalendarSelect()', () => {
    it('warns and names linkToRiteSelect() as the replacement', () => {
        const { riteSelect, nationSelect, dioceseSelect, apiOptions } =
            buildParts();
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

        try {
            apiOptions.linkToCalendarSelect(
                [nationSelect, dioceseSelect],
                riteSelect,
            );
            expect(warn).toHaveBeenCalledTimes(1);
            expect(warn.mock.calls[0][0]).toContain(
                'ApiOptions.linkToRiteSelect()',
            );
        } finally {
            warn.mockRestore();
        }
    });

    it('does not warn when no rite select is passed', () => {
        const { nationSelect, dioceseSelect, apiOptions } = buildParts();
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

        try {
            apiOptions.linkToCalendarSelect([nationSelect, dioceseSelect]);
            expect(warn).not.toHaveBeenCalled();
        } finally {
            warn.mockRestore();
        }
    });

    it('still drives the rite chain, so existing callers keep working', () => {
        const { riteSelect, nationSelect, dioceseSelect, apiOptions } =
            buildParts();
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

        try {
            apiOptions.linkToCalendarSelect(
                [nationSelect, dioceseSelect],
                riteSelect,
            );
            apiOptions.appendTo('#opts');

            chooseRite(riteSelect, Rite.AMBROSIAN);

            const values = dioceseValues(dioceseSelect);
            expect(values).toContain('milano_it');
            expect(values).not.toContain('romamo_it');
        } finally {
            warn.mockRestore();
        }
    });
});
