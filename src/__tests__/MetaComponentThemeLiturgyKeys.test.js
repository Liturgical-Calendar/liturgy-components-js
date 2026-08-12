/** @jest-environment jsdom */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import DayViewer from '../MetaComponents/DayViewer.js';
import { resolveChildTheme, assertTheme } from '../MetaComponents/Theme.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

const LITURGY_KEYS = [
    'titleClass',
    'dateClass',
    'dateControlsClass',
    'eventsWrapperClass',
    'eventClass',
    'eventGradeClass',
    'eventCommonClass',
    'eventYearCycleClass',
];

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.replaceChildren();
    const el = document.createElement('div');
    el.id = 'mount';
    document.body.appendChild(el);
});

describe('issue #43: LiturgyOfAnyDay styling keys reach the widget', () => {
    it('the liturgy role passes all eight through', () => {
        const bag = {};
        for (const key of LITURGY_KEYS) {
            bag[key] = `x-${key}`;
        }
        const resolved = resolveChildTheme(
            { liturgy: bag },
            'liturgy',
            'liturgy',
        );
        for (const key of LITURGY_KEYS) {
            expect(resolved[key]).toBe(`x-${key}`);
        }
    });

    it('the select role does not, since a <select> has no such setters', () => {
        const resolved = resolveChildTheme(
            { riteSelect: { eventClass: 'x' } },
            'riteSelect',
        );
        expect(Object.hasOwn(resolved, 'eventClass')).toBe(false);
    });

    // The reported symptom: DayViewer's constructor names all eight and calls the
    // matching setter, but resolveChildTheme() stripped them, so that loop never
    // executed and a consumer's classes were silently ignored.
    it('DayViewer applies them to the rendered markup', () => {
        const viewer = new DayViewer({
            locale: 'en',
            theme: {
                liturgy: {
                    eventsWrapperClass: 'card-body',
                    dateClass: 'card-header',
                    titleClass: 'h3',
                },
            },
        });
        viewer.appendTo('#mount');
        expect(document.querySelector('#mount .card-body')).not.toBeNull();
        expect(document.querySelector('#mount .card-header')).not.toBeNull();
        expect(document.querySelector('#mount .h3')).not.toBeNull();
    });

    // The issue's second ask: an unrecognised per-child key must not pass silently.
    it('rejects an unrecognised per-child key, naming it', () => {
        expect(() =>
            assertTheme({ liturgy: { eventClas: 'typo' } }, 'DayViewer'),
        ).toThrow(/eventClas is not a recognised per-child theme key/);
    });

    it('still accepts every recognised key', () => {
        const bag = { class: 'a' };
        for (const key of LITURGY_KEYS) {
            bag[key] = 'b';
        }
        expect(() => assertTheme({ liturgy: bag }, 'DayViewer')).not.toThrow();
    });
});
