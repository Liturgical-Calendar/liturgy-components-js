/** @jest-environment jsdom */
/**
 * I2: pins the actual, current behaviour of the class-name validators the theme
 * bag's values are handed to, so the documented constraint (Theme.js's module
 * doc, docs/meta-components.md's "role vocabulary" section) cannot silently
 * drift out of sync with the code again.
 *
 * `Utils.validateClassName()` — and `LiturgyOfAnyDay`'s own private copy of the
 * same pattern — accept only `/^(?!\d|--|-?\d)[a-zA-Z_-][a-zA-Z\d_-]{1,}$/` per
 * space-separated class: letters, digits, underscores and hyphens. Tailwind's
 * variant prefixes (`md:`, `hover:`) and fractional utilities (`w-1/2`) both
 * contain a character (`:` or `/`) outside that set, so a theme bag built with
 * real Tailwind utility classes throws rather than rendering unstyled. This is a
 * pre-existing, shared constraint — these tests do NOT relax it; they only
 * confirm it still holds.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import Utils from '../Utils.js';
import ApiBase from '../ApiClient/ApiBase.js';
import CalendarResourcePicker from '../MetaComponents/CalendarResourcePicker.js';
import DayViewer from '../MetaComponents/DayViewer.js';
import { CalendarSelectFilter } from '../Enums.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.innerHTML = '<div id="mount"></div>';
});

describe('Utils.validateClassName and Tailwind syntax', () => {
    it('rejects a variant-prefixed utility class', () => {
        expect(Utils.validateClassName('md:flex')).toBe(false);
    });

    it('rejects a fractional utility class', () => {
        expect(Utils.validateClassName('w-1/2')).toBe(false);
    });

    it('accepts an ordinary hyphenated class name', () => {
        expect(Utils.validateClassName('form-select')).toBe(true);
    });
});

describe('A theme bag built with real Tailwind utility classes', () => {
    it('throws when a flat select class carries a variant prefix', () => {
        expect(() => {
            const picker = new CalendarResourcePicker({
                locale: 'en',
                filter: CalendarSelectFilter.NATIONAL_CALENDARS,
                theme: { select: 'w-full md:w-1/2' },
            });
            picker.appendTo('#mount');
        }).toThrow(/Invalid class name/);
    });

    it('throws when a flat label class carries a variant prefix', () => {
        expect(() => {
            const picker = new CalendarResourcePicker({
                locale: 'en',
                filter: CalendarSelectFilter.NATIONAL_CALENDARS,
                theme: { select: 'form-select', label: 'text-sm md:text-base' },
            });
            picker.appendTo('#mount');
        }).toThrow(/Invalid class name/);
    });

    it("throws through LiturgyOfAnyDay's own validator for the liturgy child", () => {
        expect(() => {
            new DayViewer({
                locale: 'en',
                theme: { liturgy: { class: 'md:flex p-4' } },
            });
        }).toThrow(/Invalid class name/);
    });
});
