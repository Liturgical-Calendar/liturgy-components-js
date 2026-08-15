/** @jest-environment jsdom */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import ApiBase from '../ApiClient/ApiBase.js';
import { ApiOptionsFilter } from '../Enums.js';
import {
    INPUT_KEYS_BY_FILTER,
    inputKeysForFilter,
} from '../ApiOptions/FilterInputs.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

/**
 * The `name` attribute each `ApiOptions` input renders with, so a mounted
 * container can be read back as a set of input KEYS and compared with the
 * mapping.
 *
 * The NAME rather than the id: `Input` hands out ids from a process-wide
 * registry and suffixes a collision (`locale-2`), so a second `ApiOptions` in
 * the same test file would no longer answer to `#locale`. The name attribute is
 * a fixed string in each input's constructor.
 */
const NAME_BY_INPUT_KEY = Object.freeze({
    epiphanyInput: 'epiphany',
    ascensionInput: 'ascension',
    corpusChristiInput: 'corpus_christi',
    eternalHighPriestInput: 'eternal_high_priest',
    holydaysOfObligationInput: 'holydays_of_obligation',
    localeInput: 'locale',
    yearTypeInput: 'year_type',
    acceptHeaderInput: 'return_type',
    yearInput: 'year',
    calendarPathInput: 'calendar_path',
});

const mountedKeys = (container) =>
    Object.entries(NAME_BY_INPUT_KEY)
        .filter(
            ([, name]) => null !== container.querySelector(`[name="${name}"]`),
        )
        .map(([key]) => key);

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.innerHTML = '<div id="target"></div>';
});

describe('FilterInputs', () => {
    it.each([
        ['PATH_BUILDER', ApiOptionsFilter.PATH_BUILDER],
        ['LOCALE_ONLY', ApiOptionsFilter.LOCALE_ONLY],
        ['YEAR_ONLY', ApiOptionsFilter.YEAR_ONLY],
        ['ALL_CALENDARS', ApiOptionsFilter.ALL_CALENDARS],
        ['GENERAL_ROMAN', ApiOptionsFilter.GENERAL_ROMAN],
        ['NONE', ApiOptionsFilter.NONE],
    ])(
        'the mapping for %s matches what ApiOptions.appendTo() appends',
        (_name, filter) => {
            const apiOptions = new ApiOptions({ locale: 'en' }).filter(filter);
            const target = document.getElementById('target');
            apiOptions.appendTo(target);
            expect(mountedKeys(target).sort()).toEqual(
                [...inputKeysForFilter(filter)].sort(),
            );
        },
    );

    it('covers every ApiOptionsFilter value exactly once', () => {
        expect([...INPUT_KEYS_BY_FILTER.keys()].sort()).toEqual(
            [
                ApiOptionsFilter.PATH_BUILDER,
                ApiOptionsFilter.LOCALE_ONLY,
                ApiOptionsFilter.YEAR_ONLY,
                ApiOptionsFilter.ALL_CALENDARS,
                ApiOptionsFilter.GENERAL_ROMAN,
                ApiOptionsFilter.NONE,
            ].sort(),
        );
    });

    it('throws by name for a filter it does not know', () => {
        expect(() => inputKeysForFilter('nope')).toThrow(
            /inputKeysForFilter: unrecognised ApiOptions filter: nope/,
        );
    });
});
