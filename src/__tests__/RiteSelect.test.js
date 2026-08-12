/** @jest-environment jsdom */
import { describe, it, expect } from '@jest/globals';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import { Rite } from '../Enums.js';

describe('RiteSelect', () => {
    it('renders one option per rite, Roman first', () => {
        const rs = new RiteSelect('en');
        expect(rs._domElement.innerHTML).toContain('value="roman"');
        expect(rs._domElement.innerHTML).toContain('value="ambrosian"');
        expect(rs._domElement.innerHTML.indexOf('value="roman"')).toBeLessThan(
            rs._domElement.innerHTML.indexOf('value="ambrosian"'),
        );
    });

    it('defaults to Roman', () => {
        const rs = new RiteSelect('en');
        expect(rs._domElement.value).toBe(Rite.ROMAN);
    });

    it('has no empty option — a request always has a rite', () => {
        const rs = new RiteSelect('en');
        expect(rs._domElement.innerHTML).not.toContain('value=""');
    });

    it('supports the same chainable surface as CalendarSelect', () => {
        const rs = new RiteSelect('en').class('form-select').id('riteSelect');
        expect(rs._domElement.className).toBe('form-select');
        expect(rs._domElement.id).toBe('riteSelect');
    });

    it('rejects an invalid locale with the same message CalendarSelect uses', () => {
        // Without running the locale through `Intl.getCanonicalLocales`, this
        // surfaces as a raw `RangeError: Incorrect locale information provided`
        // from `new Intl.Locale()` instead of the library's own message.
        expect(() => new RiteSelect('this is not a locale')).toThrow(
            /Invalid locale/,
        );
    });

    it('canonicalizes the locale, underscores included', () => {
        expect(new RiteSelect('it_IT')._locale).toBe('it-IT');
        expect(new RiteSelect('EN-us')._locale).toBe('en-US');
    });

    describe('wrapper()', () => {
        it('wraps the select in a div by default, with the label inside and before it', () => {
            document.body.innerHTML = '<div id="mount"></div>';
            const rs = new RiteSelect('en');
            rs.label({ text: 'Rite' });
            rs.wrapper({ class: 'form-group col col-md-2' });
            rs.appendTo('#mount');

            const mount = document.getElementById('mount');
            const wrapper = mount.firstElementChild;
            expect(wrapper.tagName).toBe('DIV');
            expect(wrapper.className).toBe('form-group col col-md-2');
            expect(rs._domElement.parentElement).toBe(wrapper);
            expect(rs._domElement.previousElementSibling.tagName).toBe('LABEL');
        });

        it('appends the select directly when no wrapper is set', () => {
            document.body.innerHTML = '<div id="mount"></div>';
            const rs = new RiteSelect('en');
            rs.appendTo('#mount');
            expect(rs._domElement.parentElement).toBe(
                document.getElementById('mount'),
            );
        });

        it('accepts `td` and defaults `as` to `div`', () => {
            const asTd = new RiteSelect('en').wrapper({ as: 'td' });
            const asDefault = new RiteSelect('en').wrapper({ class: 'x' });
            document.body.innerHTML = '<table><tr id="row"></tr></table>';
            asTd.appendTo('#row');
            expect(document.querySelector('#row td')).not.toBeNull();

            document.body.innerHTML = '<div id="mount"></div>';
            asDefault.appendTo('#mount');
            expect(document.querySelector('#mount div')).not.toBeNull();
        });

        it('rejects an `as` value other than div or td', () => {
            expect(() => new RiteSelect('en').wrapper({ as: 'span' })).toThrow(
                /must be one of `div` or `td`/,
            );
        });

        it('rejects a non-string `as`', () => {
            expect(() => new RiteSelect('en').wrapper({ as: 42 })).toThrow(
                /wrapper `as` property/,
            );
        });

        it('treats null as "no wrapper" and still marks the setting as made', () => {
            document.body.innerHTML = '<div id="mount"></div>';
            const rs = new RiteSelect('en');
            rs.wrapper(null);
            rs.appendTo('#mount');
            expect(rs._domElement.parentElement).toBe(
                document.getElementById('mount'),
            );
            expect(() => rs.wrapper({ class: 'x' })).toThrow(
                /already been set/,
            );
        });

        it('rejects an options object naming none of as, class or id', () => {
            expect(() => new RiteSelect('en').wrapper({})).toThrow(
                /at least an `as`, `class` or `id` property/,
            );
        });

        it('rejects an array and a non-object', () => {
            expect(() => new RiteSelect('en').wrapper([])).toThrow(
                /must be of type object/,
            );
            expect(() => new RiteSelect('en').wrapper('div')).toThrow(
                /must be of type object/,
            );
        });

        it('throws on a second call', () => {
            const rs = new RiteSelect('en').wrapper({ class: 'a' });
            expect(() => rs.wrapper({ class: 'b' })).toThrow(
                /already been set/,
            );
        });

        // The class name below MUST contain a backtick, not HTML tags.
        // `Utils.sanitizeInput()` (Utils.js:122-125) runs its input through
        // `DOMParser` and returns `textContent`, so tag-like substrings are
        // STRIPPED BEFORE `validateClassName()` ever sees them:
        // `'has<bad>chars'` sanitizes to the perfectly valid `'haschars'` and
        // does not throw at all. `validateClassName()` rejects /[\s"'`<]/
        // (Utils.js:75), and a backtick survives sanitization, so it is what
        // actually reaches the validator. This was established empirically in
        // Task 1 — do not "simplify" it back to an HTML-looking string.
        //
        // `'has space'` for the id is correct as written: whitespace survives
        // sanitization and `validateId()` rejects it.
        it('rejects an invalid class name and an invalid id', () => {
            expect(() =>
                new RiteSelect('en').wrapper({ class: 'has`backtick' }),
            ).toThrow(/Invalid class name/);
            expect(() =>
                new RiteSelect('en').wrapper({ id: 'has space' }),
            ).toThrow(/Invalid id/);
        });

        it('sets the wrapper id', () => {
            document.body.innerHTML = '<div id="mount"></div>';
            const rs = new RiteSelect('en').wrapper({ id: 'riteWrapper' });
            rs.appendTo('#mount');
            expect(document.getElementById('riteWrapper')).not.toBeNull();
        });

        it('is chainable', () => {
            const rs = new RiteSelect('en');
            expect(rs.wrapper({ class: 'x' })).toBe(rs);
        });
    });
});

import YearInput from '../ApiOptions/Input/YearInput.js';

describe('YearInput minimum', () => {
    it('defaults to 1970', () => {
        expect(new YearInput()._domElement.min).toBe('1970');
    });

    it('can be raised and lowered again', () => {
        const yi = new YearInput();
        yi.min(1976);
        expect(yi._domElement.min).toBe('1976');
        yi.min(1970);
        expect(yi._domElement.min).toBe('1970');
    });
});
