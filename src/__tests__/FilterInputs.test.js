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
 * container can be read back as a list of input KEYS.
 *
 * The NAME rather than the id: `Input` hands out ids from a process-wide
 * registry and suffixes a collision (`locale-2`), so a second `ApiOptions` in
 * the same test file would no longer answer to `#locale`. The name attribute is
 * a fixed string in each input's constructor.
 */
const KEY_BY_NAME = Object.freeze({
    epiphany: 'epiphanyInput',
    ascension: 'ascensionInput',
    corpus_christi: 'corpusChristiInput',
    eternal_high_priest: 'eternalHighPriestInput',
    holydays_of_obligation: 'holydaysOfObligationInput',
    locale: 'localeInput',
    year_type: 'yearTypeInput',
    return_type: 'acceptHeaderInput',
    year: 'yearInput',
    calendar_path: 'calendarPathInput',
});

/** The input keys a container holds, in document order. */
const mountedKeys = (container) =>
    [...container.querySelectorAll('select, input')]
        .map((element) => KEY_BY_NAME[element.getAttribute('name')])
        .filter((key) => undefined !== key);

/**
 * What each filter is INTENDED to render, written out independently of
 * `FilterInputs.js` itself.
 *
 * **This literal is the point of the file.** Since `ApiOptions.appendTo()` now
 * iterates the table, reading the mounted DOM back and comparing it with
 * `inputKeysForFilter()` proves nothing: widen the table and the append widens
 * with it, so the comparison agrees with itself. (That comparison WAS
 * meaningful for exactly one commit — the one that introduced the table, before
 * `appendTo()` consumed it, where it checked the extraction against the five
 * `if` branches it replaced.) A second, hand-written statement of the intent is
 * what makes a change to the table a deliberate two-place edit rather than a
 * silent widening of what a filter renders — and, since the same table now
 * drives the meta-components' overlap check, a silent change to which layouts
 * they accept.
 *
 * @type {Readonly<Object<string, Readonly<string[]>>>}
 */
const EXPECTED = Object.freeze({
    PATH_BUILDER: Object.freeze(['calendarPathInput', 'yearInput']),
    LOCALE_ONLY: Object.freeze(['localeInput']),
    YEAR_ONLY: Object.freeze(['yearInput']),
    ALL_CALENDARS: Object.freeze([
        'localeInput',
        'yearTypeInput',
        'acceptHeaderInput',
        'yearInput',
    ]),
    GENERAL_ROMAN: Object.freeze([
        'epiphanyInput',
        'ascensionInput',
        'corpusChristiInput',
        'eternalHighPriestInput',
        'holydaysOfObligationInput',
    ]),
    NONE: Object.freeze([
        'localeInput',
        'yearTypeInput',
        'acceptHeaderInput',
        'yearInput',
        'epiphanyInput',
        'ascensionInput',
        'corpusChristiInput',
        'eternalHighPriestInput',
        'holydaysOfObligationInput',
    ]),
});

const CASES = Object.entries(EXPECTED).map(([name, keys]) => [
    name,
    ApiOptionsFilter[name],
    keys,
]);

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.replaceChildren();
    const target = document.createElement('div');
    target.id = 'target';
    document.body.appendChild(target);
});

describe('the table states what each filter renders', () => {
    it.each(CASES)(
        '%s renders exactly the inputs it is meant to, in order',
        (_name, filter, keys) => {
            expect(inputKeysForFilter(filter)).toEqual(keys);
        },
    );

    it('covers every ApiOptionsFilter value exactly once', () => {
        // Six entries for eight members: GENERAL_ROMAN/BASE_PATH and
        // ALL_CALENDARS/ALL_PATHS are alias pairs sharing one value each.
        expect([...INPUT_KEYS_BY_FILTER.keys()].sort()).toEqual(
            [...new Set(Object.values(ApiOptionsFilter))].sort(),
        );
    });

    it('throws by name for a filter it does not know', () => {
        expect(() => inputKeysForFilter('nope')).toThrow(
            /inputKeysForFilter: unrecognised ApiOptions filter: nope/,
        );
    });
});

describe('ApiOptions.appendTo() honours the table', () => {
    it.each(CASES)(
        '%s mounts exactly those inputs, in that order',
        (_name, filter, keys) => {
            // Not a tautology despite `appendTo()` reading the same table: this
            // is what proves every key in it names an input that actually
            // exists on `#inputs` and can be mounted. A typo'd key throws here.
            const apiOptions = new ApiOptions({ locale: 'en' }).filter(filter);
            const target = document.getElementById('target');
            apiOptions.appendTo(target);
            expect(mountedKeys(target)).toEqual(keys);
        },
    );
});

describe('the two runtime skips, which are deliberately NOT in the table', () => {
    it('omits the accept-header input once it has been hidden', () => {
        const apiOptions = new ApiOptions({ locale: 'en' }).filter(
            ApiOptionsFilter.ALL_CALENDARS,
        );
        apiOptions._acceptHeaderInput.hide();
        const target = document.getElementById('target');
        apiOptions.appendTo(target);
        expect(mountedKeys(target)).toEqual([
            'localeInput',
            'yearTypeInput',
            'yearInput',
        ]);
    });

    it('does not append the year input a second time after a PATH_BUILDER pass', () => {
        const first = document.createElement('div');
        const second = document.createElement('div');
        document.body.append(first, second);
        const apiOptions = new ApiOptions({ locale: 'en' });
        apiOptions.filter(ApiOptionsFilter.PATH_BUILDER).appendTo(first);
        apiOptions.filter(ApiOptionsFilter.ALL_CALENDARS).appendTo(second);
        expect(mountedKeys(first)).toEqual(['calendarPathInput', 'yearInput']);
        expect(mountedKeys(second)).toEqual([
            'localeInput',
            'yearTypeInput',
            'acceptHeaderInput',
        ]);
    });

    it('still appends the year input under YEAR_ONLY after a PATH_BUILDER pass', () => {
        // The skip is scoped to the ALL_CALENDARS/NONE branch, as it always
        // was. Widening it to every filter would silently empty a YEAR_ONLY
        // container on a page that also builds a path.
        const first = document.createElement('div');
        const second = document.createElement('div');
        document.body.append(first, second);
        const apiOptions = new ApiOptions({ locale: 'en' });
        apiOptions.filter(ApiOptionsFilter.PATH_BUILDER).appendTo(first);
        apiOptions.filter(ApiOptionsFilter.YEAR_ONLY).appendTo(second);
        expect(mountedKeys(second)).toEqual(['yearInput']);
    });
});
