/** @jest-environment jsdom */
import { describe, it, expect } from '@jest/globals';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import { Rite } from '../Enums.js';

const values = (riteSelect) =>
    [...riteSelect._domElement.options].map((option) => option.value);

describe('RiteSelect option set', () => {
    it('renders every rite when none is named', () => {
        expect(values(new RiteSelect('en'))).toEqual(Object.values(Rite));
    });

    it('renders only the rites named, in the order given', () => {
        const select = new RiteSelect({
            locale: 'en',
            rites: [Rite.AMBROSIAN, Rite.ROMAN],
        });
        expect(values(select)).toEqual([Rite.AMBROSIAN, Rite.ROMAN]);
    });

    it('selects the first named rite', () => {
        const select = new RiteSelect({
            locale: 'en',
            rites: [Rite.AMBROSIAN, Rite.ROMAN],
        });
        expect(select._domElement.value).toBe(Rite.AMBROSIAN);
    });

    it('keeps the localized label for each rite it renders', () => {
        const select = new RiteSelect({ locale: 'it', rites: [Rite.ROMAN] });
        expect(
            select._domElement.options[0].textContent.length,
        ).toBeGreaterThan(0);
    });

    it('is chainable as a setter', () => {
        const select = new RiteSelect('en');
        expect(select.rites([Rite.ROMAN])).toBe(select);
        expect(values(select)).toEqual([Rite.ROMAN]);
    });

    it('rejects a non-array', () => {
        expect(() => new RiteSelect({ locale: 'en', rites: 'roman' })).toThrow(
            /RiteSelect.*rites/,
        );
    });

    it('rejects an empty array', () => {
        expect(() => new RiteSelect({ locale: 'en', rites: [] })).toThrow(
            /RiteSelect.*empty/,
        );
    });

    it('rejects an unknown rite, naming it and the valid ones', () => {
        expect(
            () => new RiteSelect({ locale: 'en', rites: ['byzantine'] }),
        ).toThrow(/byzantine.*roman/s);
    });

    it('rejects a duplicate', () => {
        expect(
            () => new RiteSelect({ locale: 'en', rites: ['roman', 'roman'] }),
        ).toThrow(/RiteSelect.*duplicate/i);
    });
});

describe('RiteSelect._setHidden', () => {
    it('hides and shows the select', () => {
        const select = new RiteSelect('en');
        select._setHidden(true);
        expect(select._domElement.hidden).toBe(true);
        select._setHidden(false);
        expect(select._domElement.hidden).toBe(false);
    });

    it('hides the wrapper, not the bare select, when a wrapper was configured', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const select = new RiteSelect('en').wrapper({ as: 'div' });
        select.appendTo(container);

        select._setHidden(true);

        expect(select._domElement.hidden).toBe(false);
        expect(select._domElement.parentElement.hidden).toBe(true);
    });

    // F3 (final whole-branch review): with NO wrapper configured — the
    // `bootstrap5` preset deliberately supplies none — hiding the select must
    // also hide its label, or the label dangles over nothing.
    it('hides the label too when there is no wrapper', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const select = new RiteSelect('en').label({ text: 'Select a rite' });
        select.appendTo(container);
        const label = container.querySelector('label');

        expect(label.hidden).toBe(false);
        select._setHidden(true);

        expect(select._domElement.hidden).toBe(true);
        expect(label.hidden).toBe(true);

        select._setHidden(false);
        expect(select._domElement.hidden).toBe(false);
        expect(label.hidden).toBe(false);
    });
});
