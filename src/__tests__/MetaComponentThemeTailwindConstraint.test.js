/** @jest-environment jsdom */
/**
 * Pins that a theme bag built from real utility-framework classes works, through
 * every validator a theme value can reach: `Utils.validateClassName()`, and the
 * `LiturgyOfAnyDay` / `LiturgyOfTheDay` private wrappers that now delegate to it.
 *
 * This file previously asserted the OPPOSITE. The validators demanded
 * `/^(?!\d|--|-?\d)[a-zA-Z_-][a-zA-Z\d_-]{1,}$/` — a CSS *identifier*, not a class
 * attribute token — so `md:w-1/2`, `p-1.5` and `bg-[#1da1f2]` did not merely fail
 * to style anything, they THREW, and a Tailwind consumer could not use these
 * components at all. The rule was widened deliberately; these tests were inverted
 * with it, and they are what stops it narrowing again by accident.
 *
 * The characters still rejected are the ones that can only arrive by mistake:
 * whitespace the caller forgot to split on, quotes, a backtick, or `<`.
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
    document.body.replaceChildren();
    const mount = document.createElement('div');
    mount.id = 'mount';
    document.body.appendChild(mount);
});

describe('Utils.validateClassName accepts utility-framework tokens', () => {
    const ACCEPTED = [
        'form-select', // plain Bootstrap
        'col-md-3',
        '-mt-4', // leading hyphen
        'md:w-1/2', // variant prefix + fraction
        'hover:bg-blue-500',
        'sm:hover:text-white', // stacked variants
        '2xl:flex', // leading digit
        'p-1.5', // decimal
        'bg-[#1da1f2]', // arbitrary value
        'w-[calc(100%-2rem)]', // arbitrary value with parens and %
        '[&>*]:mt-2', // arbitrary variant, contains `>`
    ];

    it.each(ACCEPTED)('accepts %s', (token) => {
        expect(Utils.validateClassName(token)).toBe(true);
    });

    const REJECTED = [
        ['an empty token', ''],
        ['a token containing a space', 'form select'],
        ['a token containing a tab', 'form\tselect'],
        ['a token containing a double quote', 'form"select'],
        ['a token containing a single quote', "form'select"],
        ['a token containing a backtick', 'form`select'],
        ['a token containing a less-than sign', 'form<select'],
    ];

    it.each(REJECTED)('rejects %s', (_label, token) => {
        expect(Utils.validateClassName(token)).toBe(false);
    });

    it('rejects a non-string', () => {
        expect(Utils.validateClassName(42)).toBe(false);
        expect(Utils.validateClassName(null)).toBe(false);
        expect(Utils.validateClassName(undefined)).toBe(false);
    });
});

describe('A theme bag built with real Tailwind utility classes', () => {
    it('mounts a picker themed with variant prefixes and fractions', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
            theme: { select: 'w-full md:w-1/2', label: 'text-sm md:text-base' },
        });
        expect(() => picker.appendTo('#mount')).not.toThrow();
        expect(picker.calendarSelect._domElement.className).toBe(
            'w-full md:w-1/2',
        );
    });

    it("passes them through LiturgyOfAnyDay's own validator too", () => {
        let viewer;
        expect(() => {
            viewer = new DayViewer({
                locale: 'en',
                theme: { liturgy: { class: 'md:flex p-4' } },
            });
        }).not.toThrow();
        viewer.appendTo('#mount');
        expect(viewer.liturgy._domElement.className).toBe('md:flex p-4');
    });

    it('still rejects a class string carrying a quote', () => {
        expect(() => {
            const picker = new CalendarResourcePicker({
                locale: 'en',
                filter: CalendarSelectFilter.NATIONAL_CALENDARS,
                theme: { select: 'form-select"' },
            });
            picker.appendTo('#mount');
        }).toThrow(/Invalid class name/);
    });
});
