/** @jest-environment jsdom */
/**
 * `ApiOptions`' canonical, non-underscore accessors (issue #62).
 *
 * All fourteen accessors used to be underscore-prefixed, including the ten a
 * consumer is expected to touch. The prefix conventionally announces "private",
 * which is what led an automated reviewer on `Liturgical-Calendar/examples#49`
 * to recommend replacing five working uses with "the corresponding public
 * accessors" that did not exist.
 *
 * These tests pin the three halves of the answer: the ten canonical names, the
 * unchanged legacy aliases, and the four accessors that keep the prefix because
 * they really are package-internal.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
// Imported through the package entry point on purpose: the canonical accessors
// have to be reachable on the EXPORTED class, which is the only surface a
// consumer ever holds.
import { ApiOptions } from '../index.js';
import { API_OPTIONS_INPUT_KEYS } from '../MetaComponents/Theme.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

/**
 * The ten canonical accessor names, written out rather than derived from
 * `API_OPTIONS_INPUT_KEYS`, so that the equality test below is an assertion
 * about two independently-stated lists rather than a tautology.
 */
const CANONICAL_ACCESSORS = [
    'epiphanyInput',
    'ascensionInput',
    'corpusChristiInput',
    'eternalHighPriestInput',
    'holydaysOfObligationInput',
    'localeInput',
    'yearTypeInput',
    'yearInput',
    'acceptHeaderInput',
    'calendarPathInput',
];

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.innerHTML = '<div id="mount"></div>';
});

describe('ApiOptions canonical accessors', () => {
    it.each(CANONICAL_ACCESSORS)(
        '%s returns the very input its underscore alias returns',
        (name) => {
            const apiOptions = new ApiOptions('en');
            expect(apiOptions[name]).toBeDefined();
            expect(apiOptions[name]).toBe(apiOptions[`_${name}`]);
        },
    );

    it('spells the inputs exactly as the theme bag does', () => {
        // A second spelling for one input would be worse than the single ugly
        // one this issue replaced: `theme.apiOptions.yearInput` is public API.
        expect([...CANONICAL_ACCESSORS].sort()).toEqual(
            [...API_OPTIONS_INPUT_KEYS].sort(),
        );
    });

    it.each(CANONICAL_ACCESSORS)('%s is read-only', (name) => {
        // The docs call these read-only properties. A getter with no setter is
        // what makes that true: in a module (strict mode) an assignment throws
        // rather than shadowing the accessor with an own data property, which
        // would silently desynchronize the pair.
        const descriptor = Object.getOwnPropertyDescriptor(
            ApiOptions.prototype,
            name,
        );
        expect(descriptor).toBeDefined();
        expect(typeof descriptor.get).toBe('function');
        expect(descriptor.set).toBeUndefined();
    });

    it('warns on neither spelling', () => {
        // The library itself reads the underscore forms at some thirty call
        // sites, so a deprecation warning would fire on its own behaviour.
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const apiOptions = new ApiOptions('en');
        warn.mockClear();
        for (const name of CANONICAL_ACCESSORS) {
            void apiOptions[name];
            void apiOptions[`_${name}`];
        }
        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
    });
});

describe('ApiOptions internal accessors', () => {
    it('gives the four package-internal accessors no canonical alias', () => {
        const apiOptions = new ApiOptions('en');
        expect(apiOptions.base).toBeUndefined();
        expect(apiOptions.filtersSet).toBeUndefined();
        expect(apiOptions.currentEndpoint).toBeUndefined();
    });

    it('leaves `filter` the chainable setter method it has always been', () => {
        // This is also why `_filter` could not have been aliased as `filter`:
        // a same-named getter in the class body would have replaced the method.
        const apiOptions = new ApiOptions('en');
        expect(typeof apiOptions.filter).toBe('function');
    });

    it('keeps the underscore-only accessors working', () => {
        const apiOptions = new ApiOptions('en');
        expect(apiOptions._base).toBeDefined();
        expect(apiOptions._currentEndpoint).toBeDefined();
        expect(apiOptions._filtersSet).toBeDefined();
        expect(apiOptions._filter).toBeDefined();
    });
});
