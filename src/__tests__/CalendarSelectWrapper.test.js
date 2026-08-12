/** @jest-environment jsdom */
/**
 * Characterization tests for `CalendarSelect.wrapper()`, pinning its behaviour
 * branch by branch BEFORE it is refactored onto the shared `WrapperOptions`
 * helper. Their job is to fail loudly if that refactor changes anything a
 * caller can observe.
 *
 * These assert current behaviour, not desired behaviour. Do not modify this
 * file during the refactor — if one of these fails afterwards, the refactor is
 * wrong, not the test.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.innerHTML = '<div id="mount"></div>';
});

const select = () => new CalendarSelect('en');

describe('CalendarSelect.wrapper() — characterization', () => {
    it('defaults `as` to div and applies the class', () => {
        const cs = select().wrapper({ class: 'col-md-3' });
        cs.appendTo('#mount');
        const wrapper = document.querySelector('#mount > div');
        expect(wrapper).not.toBeNull();
        expect(wrapper.className).toBe('col-md-3');
        expect(cs._domElement.parentElement).toBe(wrapper);
    });

    it('accepts as: td', () => {
        document.body.innerHTML = '<table><tr id="row"></tr></table>';
        const cs = select().wrapper({ as: 'td' });
        cs.appendTo('#row');
        expect(document.querySelector('#row > td')).not.toBeNull();
    });

    it('rejects an `as` outside div and td', () => {
        expect(() => select().wrapper({ as: 'span' })).toThrow(
            'Invalid value for wrapper `as` property, must be one of `div` or `td` but found: span',
        );
    });

    it('rejects a non-string `as`', () => {
        expect(() => select().wrapper({ as: 42 })).toThrow(
            'Invalid type for wrapper `as` property, must be of type string but found type: number',
        );
    });

    it('treats null as no wrapper, and still marks the setting as made', () => {
        const cs = select();
        cs.wrapper(null);
        cs.appendTo('#mount');
        expect(cs._domElement.parentElement).toBe(
            document.getElementById('mount'),
        );
        expect(() => cs.wrapper({ class: 'x' })).toThrow(
            /Wrapper has already been set on CalendarSelect instance/,
        );
    });

    it('rejects an object naming none of as, class or id', () => {
        expect(() => select().wrapper({})).toThrow(
            'Invalid wrapper options, must be an object with at least an `as`, `class` or `id` property',
        );
        expect(() => select().wrapper({ nope: 'x' })).toThrow(
            'Invalid wrapper options, must be an object with at least an `as`, `class` or `id` property',
        );
    });

    it('rejects an array and a string', () => {
        expect(() => select().wrapper([])).toThrow(
            'Invalid type for wrapper options, must be of type object (not null or array) but found type: array',
        );
        expect(() => select().wrapper('div')).toThrow(
            'Invalid type for wrapper options, must be of type object (not null or array) but found type: string',
        );
    });

    it('throws on a second call, naming the locale', () => {
        const cs = select().wrapper({ class: 'a' });
        expect(() => cs.wrapper({ class: 'b' })).toThrow(
            /Wrapper has already been set on CalendarSelect instance with locale en/,
        );
    });

    it('rejects a non-string class and an invalid class name', () => {
        expect(() => select().wrapper({ class: 42 })).toThrow(
            'Invalid type for wrapper class, must be of type string but found type: number',
        );
        expect(() => select().wrapper({ class: 'has`backtick' })).toThrow(
            /Invalid class name/,
        );
    });

    it('collapses whitespace between class names', () => {
        const cs = select().wrapper({ class: 'a   b' });
        cs.appendTo('#mount');
        expect(document.querySelector('#mount > div').className).toBe('a b');
    });

    it('rejects a non-string id and an invalid id', () => {
        expect(() => select().wrapper({ id: 42 })).toThrow(
            'Invalid type for wrapper id, must be of type string but found type: number',
        );
        expect(() => select().wrapper({ id: 'has space' })).toThrow(
            /Invalid id/,
        );
    });

    it('sets the wrapper id', () => {
        const cs = select().wrapper({ id: 'calendarWrapper' });
        cs.appendTo('#mount');
        expect(document.getElementById('calendarWrapper')).not.toBeNull();
    });

    it('returns this', () => {
        const cs = select();
        expect(cs.wrapper({ class: 'x' })).toBe(cs);
    });

    it('places the label inside the wrapper, immediately before the select', () => {
        const cs = select();
        cs.label({ text: 'Calendar' });
        cs.wrapper({ class: 'col-md-3' });
        cs.appendTo('#mount');
        const wrapper = document.querySelector('#mount > div');
        expect(cs._domElement.parentElement).toBe(wrapper);
        expect(cs._domElement.previousElementSibling.tagName).toBe('LABEL');
    });

    // Deliberate 2.4.0 behaviour change (WrapperOptions extraction): the OLD
    // `wrapper()` assigned `#wrapperElement`/`#hasWrapper`/`#wrapperSet` right
    // after handling `as`, BEFORE validating `class`/`id` — so a throw from
    // class validation left `#wrapperSet === true` behind, and a caller who
    // caught the error and retried with a valid bag got "Wrapper has already
    // been set" about a wrapper that never actually existed. The new
    // `buildWrapperElement()` validates fully before `wrapper()` assigns
    // anything, so it is all-or-nothing: a throw leaves the instance
    // untouched and a retry succeeds. Use a backtick to trigger the throw —
    // `Utils.sanitizeInput()` strips HTML-like substrings before
    // `validateClassName()` runs, so something like `'has<bad>chars'`
    // sanitizes to a valid class name and would not throw.
    it('after an invalid class throws, a retry with a valid bag succeeds (2.4.0 behaviour change)', () => {
        const cs = select();
        expect(() => cs.wrapper({ class: 'has`backtick' })).toThrow(
            /Invalid class name/,
        );
        const returned = cs.wrapper({ class: 'valid' });
        expect(returned).toBe(cs);
        returned.appendTo('#mount');
        const wrapper = document.querySelector('#mount > div');
        expect(wrapper).not.toBeNull();
        expect(wrapper.className).toBe('valid');
    });

    // Same 2.4.0 behaviour change as above, pinned for the `id` branch.
    // Whitespace survives `Utils.sanitizeInput()`, so `'has space'` still
    // throws from `validateId()`.
    it('after an invalid id throws, a retry with a valid bag succeeds (2.4.0 behaviour change)', () => {
        const cs = select();
        expect(() => cs.wrapper({ id: 'has space' })).toThrow(/Invalid id/);
        const returned = cs.wrapper({ id: 'validId' });
        expect(returned).toBe(cs);
        returned.appendTo('#mount');
        expect(document.getElementById('validId')).not.toBeNull();
    });

    // Deliberate 2.4.0 behaviour change: the OLD `wrapper()` mutated the
    // caller's `wrapperOptions` object in place (writing back the resolved
    // `as`, the whitespace-collapsed `class`, and the sanitized `id`). The
    // new `buildWrapperElement()` only reads the bag and never writes to it,
    // so a frozen options object no longer throws. This also proves the
    // whitespace collapsing lands on the ELEMENT's className, not on the
    // caller's bag.
    it("does not mutate the caller's wrapper options object (2.4.0 behaviour change)", () => {
        const options = Object.freeze({ class: 'a   b' });
        const cs = select();
        expect(() => cs.wrapper(options)).not.toThrow();
        expect(options).toEqual({ class: 'a   b' });
        cs.appendTo('#mount');
        expect(document.querySelector('#mount > div').className).toBe('a b');
    });
});
