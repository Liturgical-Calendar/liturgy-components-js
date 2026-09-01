/** @jest-environment jsdom */
import { describe, it, expect } from '@jest/globals';
import * as publicApi from '../index.js';
import ReadingsRenderer from '../ReadingsRenderer/ReadingsRenderer.js';

/**
 * A celebration carrying several Masses, keyed by schema. The shape a consumer
 * renders `[object Object]` for when it does not know that this shape exists —
 * which is what issue #97 was filed about.
 */
const NESTED_READINGS = Object.freeze({
    day: {
        first_reading: 'Is 52:7-10',
        responsorial_psalm: 'Ps 98:1-6',
        gospel: 'Jn 1:1-18',
    },
    vigil: {
        first_reading: 'Is 62:1-5',
        gospel: 'Mt 1:1-25',
    },
});

/** A celebration carrying one Mass, keyed directly by reading. */
const FLAT_READINGS = Object.freeze({
    gospel: 'Lk 4:16-21',
    first_reading: 'Is 61:1-3',
    responsorial_psalm: 'Ps 145:1-2',
});

describe('ReadingsRenderer is public API', () => {
    /**
     * The whole of issue #97: the class solves a problem consumers have too,
     * and was reachable only from inside the package.
     */
    it('is exported from src/index.js', () => {
        expect(publicApi.ReadingsRenderer).toBe(ReadingsRenderer);
    });

    it('exposes its vocabulary as frozen statics', () => {
        expect(Object.isFrozen(ReadingsRenderer.massLabels)).toBe(true);
        expect(Object.isFrozen(ReadingsRenderer.readingLabels)).toBe(true);
        expect(Object.isFrozen(ReadingsRenderer.readingOrder)).toBe(true);
    });

    /**
     * `readingOrder` is the sequence a consumer iterates; `readingLabels` is
     * what it prints for each key. A key in the order with no label prints
     * `undefined: `, so the two lists have to agree.
     */
    it('has a label for every key in readingOrder', () => {
        const unlabelled = ReadingsRenderer.readingOrder.filter(
            (key) =>
                !Object.prototype.hasOwnProperty.call(
                    ReadingsRenderer.readingLabels,
                    key,
                ),
        );
        expect(unlabelled).toEqual([]);
    });
});

describe('ReadingsRenderer.hasNestedSchemas', () => {
    /**
     * The predicate that tells the two shapes apart is the first thing a
     * consumer needs and the last thing it can guess. Reaching it must not
     * require constructing a renderer whose markup the consumer may not want —
     * the sanctorale viewer in LiturgicalCalendarFrontend#503 wants the
     * vocabulary and its own layout.
     */
    it('is callable as a static, with no instance', () => {
        expect(typeof ReadingsRenderer.hasNestedSchemas).toBe('function');
        expect(ReadingsRenderer.hasNestedSchemas(NESTED_READINGS)).toBe(true);
        expect(ReadingsRenderer.hasNestedSchemas(FLAT_READINGS)).toBe(false);
    });

    /**
     * The instance method predates the static one and is what both
     * `LiturgyOfTheDay` and `LiturgyOfAnyDay` call. It stays, and stays in
     * agreement.
     */
    it('agrees with the instance method it delegates to', () => {
        const renderer = new ReadingsRenderer();
        const cases = [
            NESTED_READINGS,
            FLAT_READINGS,
            {},
            { schema_one: {} },
            null,
            undefined,
            'not an object',
            42,
        ];
        for (const readings of cases) {
            expect(renderer.hasNestedSchemas(readings)).toBe(
                ReadingsRenderer.hasNestedSchemas(readings),
            );
        }
    });

    it('rejects non-objects rather than throwing', () => {
        expect(ReadingsRenderer.hasNestedSchemas(null)).toBe(false);
        expect(ReadingsRenderer.hasNestedSchemas(undefined)).toBe(false);
        expect(ReadingsRenderer.hasNestedSchemas('vigil')).toBe(false);
        expect(ReadingsRenderer.hasNestedSchemas(42)).toBe(false);
    });

    /**
     * The schema keys the predicate recognises and the labels a consumer prints
     * for them are ONE list, so a consumer reading `massLabels` is reading the
     * whole schema vocabulary. Asserted through the predicate rather than
     * against the private field, so it holds whichever way the derivation is
     * spelled.
     */
    it('recognises every key massLabels names, and only those', () => {
        for (const schemaKey of Object.keys(ReadingsRenderer.massLabels)) {
            expect(ReadingsRenderer.hasNestedSchemas({ [schemaKey]: {} })).toBe(
                true,
            );
        }
        for (const readingKey of ReadingsRenderer.readingOrder) {
            expect(
                ReadingsRenderer.hasNestedSchemas({ [readingKey]: 'Jn 1:1' }),
            ).toBe(false);
        }
    });
});

describe('ReadingsRenderer rendering', () => {
    /**
     * Nested schemas render in the vocabulary's own order, not the object's
     * insertion order — the fixture above lists `day` before `vigil` precisely
     * to catch a renderer that iterates `Object.keys( readings )`.
     */
    it('renders nested schemas in liturgical sequence, labelled', () => {
        const container = document.createElement('div');
        new ReadingsRenderer().renderReadings(NESTED_READINGS, container);

        const text = container.textContent;
        expect(text).toContain('Vigil Mass');
        expect(text).toContain('Mass during the Day');
        expect(text.indexOf('Vigil Mass')).toBeLessThan(
            text.indexOf('Mass during the Day'),
        );
        expect(text).toContain('First Reading: Is 62:1-5');
    });

    it('renders a flat set in readingOrder, unlabelled by schema', () => {
        const container = document.createElement('div');
        new ReadingsRenderer().renderReadings(FLAT_READINGS, container);

        const readings = [...container.firstElementChild.children].map(
            (el) => el.textContent,
        );
        expect(readings).toEqual([
            'First Reading: Is 61:1-3',
            'Responsorial Psalm: Ps 145:1-2',
            'Gospel: Lk 4:16-21',
        ]);
    });

    /**
     * Reading values are written as text, never as markup: the API interpolates
     * calendar source data into its responses, so this boundary is the same one
     * `SanitizeHtml.js` exists for.
     */
    it('writes reading values as text, not markup', () => {
        const container = document.createElement('div');
        new ReadingsRenderer().renderReadings(
            { gospel: '<img src=x onerror="alert(1)">' },
            container,
        );

        expect(container.querySelector('img')).toBeNull();
        expect(container.textContent).toContain(
            '<img src=x onerror="alert(1)">',
        );
    });

    it('applies the configured class names', () => {
        const container = document.createElement('div');
        new ReadingsRenderer({
            readingsWrapperClassName: 'readings wrap',
            readingsLabelClassName: 'label',
            readingClassName: 'reading',
        }).renderReadings(FLAT_READINGS, container);

        const wrapper = container.firstElementChild;
        expect([...wrapper.classList]).toEqual(['readings', 'wrap']);
        expect([...wrapper.firstElementChild.classList]).toEqual(['reading']);
        expect([
            ...wrapper.firstElementChild.firstElementChild.classList,
        ]).toEqual(['label']);
    });
});
