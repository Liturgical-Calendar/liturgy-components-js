/** @jest-environment jsdom */
/**
 * Every component that takes an options bag must reject one that is not a plain
 * object, rather than destructuring it to nothing and silently building itself
 * in English on every default.
 *
 * `new Intl.Locale( 'it' )` is the case that motivated issue #31: it is an object
 * and not an array, so the old `typeof options !== 'object' || Array.isArray()`
 * check passed it through, and it collides with none of the option names — so
 * the locale came out `undefined`, the existing `typeof inputLocale !== 'string'`
 * check was never reached, and the component rendered in English unwarned.
 *
 * The `null` expectations used to differ per component. Issue #32 settled that:
 * `null` and `undefined` both mean "no value supplied, use the default", for the
 * options argument itself AND for the `locale` property inside a bag. The full
 * matrix is asserted below by RESULTING LOCALE rather than by absence of a throw,
 * for the reason issue #31 exists: a component that ignored the locale entirely
 * would also not throw.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import WebCalendar from '../WebCalendar/WebCalendar.js';
import LiturgyOfTheDay from '../LiturgyOfTheDay/LiturgyOfTheDay.js';
import LiturgyOfAnyDay from '../LiturgyOfAnyDay/LiturgyOfAnyDay.js';
import Messages from '../Messages.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const DEV = 'http://localhost:8000';

class BareThing {}

/**
 * A one-event `/calendar` payload, enough for `WebCalendar.buildTable()` to emit a
 * table. `WebCalendar` exposes no accessor for its table element, so the only way
 * to observe the options its constructor applied is to let it render.
 *
 * @returns {Object} A fresh payload — `buildTable()` mutates `litcal[].date` in place.
 */
const CALENDAR_DATA = () => ({
    litcal: [
        {
            event_key: 'Advent1',
            event_idx: 1,
            name: 'Dominica I in Adventu Domini',
            color: ['purple'],
            color_lcl: ['viola'],
            grade: 7,
            grade_lcl: 'solennità',
            grade_abbr: 'S',
            grade_display: '',
            common: [],
            common_lcl: '',
            type: 'mobile',
            date: '2026-11-29T00:00:00+00:00',
            year: 2026,
            month: 11,
            month_short: 'Nov.',
            month_long: 'November',
            day: 29,
            day_of_the_week_iso8601: 7,
            day_of_the_week_short: 'Sun',
            day_of_the_week_long: 'Sunday',
            liturgical_year: 'A',
            is_vigil_mass: false,
            psalter_week: 1,
            liturgical_season: 'ADVENT',
            liturgical_season_lcl: 'Advent',
            holy_day_of_obligation: false,
        },
    ],
    settings: { year: 2026, locale: 'en', year_type: 'LITURGICAL' },
    metadata: { version: 'test' },
    messages: [],
});

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(DEV, FULL_METADATA);
});

/**
 * The four arguments that must be rejected by every component, whatever each one
 * does with `null`.
 *
 * @type {Array<[string, () => unknown, RegExp]>}
 */
const REJECTED = [
    ['a bare class instance', () => new BareThing(), /found type: BareThing/],
    ['a Date', () => new Date(), /found type: Date/],
    ['a boxed String', () => new String('it'), /found type: String/],
    ['an array', () => ['en'], /found type: array/],
    ['a number', () => 123, /found type: number/],
];

/**
 * @type {Array<{name: string, build: (options: unknown) => unknown}>}
 */
const COMPONENTS = [
    { name: 'CalendarSelect', build: (options) => new CalendarSelect(options) },
    { name: 'RiteSelect', build: (options) => new RiteSelect(options) },
    { name: 'ApiOptions', build: (options) => new ApiOptions(options) },
    {
        name: 'LiturgyOfTheDay',
        build: (options) => new LiturgyOfTheDay(options),
    },
    {
        name: 'LiturgyOfAnyDay',
        build: (options) => new LiturgyOfAnyDay(options),
    },
];

describe.each(COMPONENTS)(
    '$name rejects a non-plain-object options argument',
    ({ name, build }) => {
        it.each(REJECTED)(
            'rejects %s, naming the type it found',
            (_label, make, typeMatcher) => {
                expect(() => build(make())).toThrow(typeMatcher);
            },
        );

        it.each(REJECTED)(
            'names itself in the message when rejecting %s',
            (_label, make) => {
                expect(() => build(make())).toThrow(
                    new RegExp(`^${name}: Invalid type for options`),
                );
            },
        );
    },
);

/**
 * `CalendarSelect` keeps its locale private and offers no getter, but embeds it
 * verbatim in several of its own error messages. Reading it back through one of
 * them beats adding public surface for a test.
 *
 * @param {CalendarSelect} select - The select to interrogate.
 * @returns {string} The canonical tag the select stored.
 */
function calendarSelectLocale(select) {
    try {
        select.class(123);
    } catch (error) {
        return error.message.match(/with locale (.+?),/)[1];
    }
    throw new Error('CalendarSelect.class( 123 ) was expected to throw');
}

/**
 * Every component's resulting locale, asserted the strongest way that component
 * allows.
 *
 * NOT "did not throw". A component that accepted the argument and then ignored
 * the locale entirely would satisfy a throw-free assertion while reproducing
 * exactly the silent-English defect issue #31 existed to remove; so each entry
 * below reads back something the locale demonstrably determined.
 *
 * `ApiOptions` and the two widgets expose no tag, so they are compared against a
 * reference instance built from the plain string form — which also pins the other
 * half of the contract, that the new argument forms produce the SAME result the
 * string always did, rather than merely some result.
 *
 * @type {Array<{name: string, build: (options?: unknown) => unknown, expectLocale: (instance: unknown, tag: string) => void}>}
 */
const LOCALE_OBSERVERS = [
    {
        name: 'CalendarSelect',
        build: (options) => new CalendarSelect(options),
        expectLocale: (instance, tag) =>
            expect(calendarSelectLocale(instance)).toBe(tag),
    },
    {
        name: 'RiteSelect',
        build: (options) => new RiteSelect(options),
        expectLocale: (instance, tag) => expect(instance._locale).toBe(tag),
    },
    {
        name: 'ApiOptions',
        build: (options) => new ApiOptions(options),
        expectLocale: (instance, tag) => {
            // `LocaleInput` labels the API's locales through
            // `Intl.DisplayNames( [ locale.language ] )`, so the label for Italian
            // reads `italiano` under `it` and `Italian` under `en`.
            const labels = [...instance._localeInput._domElement.options].map(
                (option) => option.textContent,
            );
            const expected = new Intl.DisplayNames(
                [new Intl.Locale(tag).language],
                { type: 'language' },
            ).of('it');
            expect(labels).toContain(expected);
        },
    },
    {
        name: 'LiturgyOfTheDay',
        build: (options) => new LiturgyOfTheDay(options),
        expectLocale: (instance, tag) => {
            const reference = new LiturgyOfTheDay(tag);
            expect(instance._titleElement.textContent).toBe(
                reference._titleElement.textContent,
            );
            // `dateStyle: 'full'` renders differently per REGION, so this proves the
            // region subtag survived rather than only the language.
            expect(instance._dateElement.textContent).toBe(
                reference._dateElement.textContent,
            );
        },
    },
    {
        name: 'LiturgyOfAnyDay',
        build: (options) => new LiturgyOfAnyDay(options),
        expectLocale: (instance, tag) => {
            const reference = new LiturgyOfAnyDay(tag);
            expect(instance._titleElement.textContent).toBe(
                reference._titleElement.textContent,
            );
            expect(instance._dateElement.textContent).toBe(
                reference._dateElement.textContent,
            );
        },
    },
];

/**
 * The full argument matrix issue #32 settled, and the locale each form must
 * produce.
 *
 * `NO_ARGUMENT` is distinguished from an explicit `undefined` on purpose: they
 * must agree, and the only way to show that is to exercise both.
 *
 * @type {symbol}
 */
const NO_ARGUMENT = Symbol('no argument');

/** @type {Array<[string, () => unknown, string]>} */
const ACCEPTED = [
    ['no argument at all', () => NO_ARGUMENT, 'en'],
    ['a bare null', () => null, 'en'],
    ['a bare undefined', () => undefined, 'en'],
    ['an empty bag', () => ({}), 'en'],
    ['a bag with locale: null', () => ({ locale: null }), 'en'],
    ['a bag with locale: undefined', () => ({ locale: undefined }), 'en'],
    ['a locale string', () => 'it-IT', 'it-IT'],
    ['a bag with a locale string', () => ({ locale: 'it-IT' }), 'it-IT'],
    ['a bare Intl.Locale', () => new Intl.Locale('it-IT'), 'it-IT'],
    [
        'a bag with an Intl.Locale',
        () => ({ locale: new Intl.Locale('it-IT') }),
        'it-IT',
    ],
    [
        'a bare Intl.Locale needing canonicalization',
        () => new Intl.Locale('EN-us'),
        'en-US',
    ],
    [
        'a bag with an Intl.Locale needing canonicalization',
        () => ({ locale: new Intl.Locale('EN-us') }),
        'en-US',
    ],
];

describe.each(LOCALE_OBSERVERS)(
    '$name resolves the locale of every accepted argument form',
    ({ build, expectLocale }) => {
        it.each(ACCEPTED)(
            'given %s, resolves to the expected locale',
            (_label, make, expectedTag) => {
                const argument = make();
                const instance =
                    argument === NO_ARGUMENT ? build() : build(argument);
                expectLocale(instance, expectedTag);
            },
        );
    },
);

describe.each(LOCALE_OBSERVERS)(
    '$name still rejects a non-Intl.Locale class instance as the bag',
    ({ build }) => {
        /**
         * The hole issue #31 closed, verified still closed now that ONE class is
         * recognised. An `Intl.Locale` is a third accepted argument form, checked
         * ahead of the plain-object test; nothing else joined it.
         */
        it.each(REJECTED)('rejects %s', (_label, make, matcher) => {
            expect(() => build(make())).toThrow(matcher);
        });
    },
);

describe('a plain options object is still accepted everywhere', () => {
    it.each(COMPONENTS)('$name accepts { locale }', ({ build }) => {
        expect(() => build({ locale: 'it' })).not.toThrow();
    });

    it.each(COMPONENTS)('$name accepts a locale string', ({ build }) => {
        expect(() => build('it')).not.toThrow();
    });
});

/**
 * The two bag shapes on which `options.hasOwnProperty( key )` does not work.
 *
 * The first is the one `isPlainOptionsObject()` explicitly documents as accepted:
 * a null-prototype object inherits no `hasOwnProperty` to call, so every guarded
 * read threw `TypeError: options.hasOwnProperty is not a function` and the bag
 * never reached the component it was accepted for.
 *
 * The second is the one that matters more, and the one no prototype-based guard
 * can ever catch: an ORDINARY plain object that happens to carry a `hasOwnProperty`
 * key of its own. It has `Object.prototype`, so it passes every shape check there
 * is; the own property simply shadows the method the read relied on. Unusual, but
 * entirely legal — and the failure was a bare `TypeError` naming nothing useful.
 *
 * Both are fixed by reading with `Object.hasOwn( bag, key )`, which depends on
 * neither the bag's prototype nor its keys.
 *
 * Each case asserts that the option INSIDE the bag took effect, not merely that
 * construction did not throw: a component that swallowed the bag and defaulted
 * everything would also not throw.
 *
 * @type {Array<[string, (props: Object) => Object]>}
 */
const AWKWARD_BAGS = [
    [
        'a null-prototype bag',
        (props) => Object.assign(Object.create(null), props),
    ],
    [
        'a bag whose own `hasOwnProperty` key shadows the method',
        (props) => ({ ...props, hasOwnProperty: 'not a function' }),
    ],
];

describe.each(AWKWARD_BAGS)('options carried by %s are read', (_label, bag) => {
    it('CalendarSelect applies the class the bag carries', () => {
        const select = new CalendarSelect(
            bag({ locale: 'it', class: 'form-select' }),
        );
        expect(select._domElement.className).toBe('form-select');
    });

    it('CalendarSelect.label() applies the label options the bag carries', () => {
        const container = document.createElement('div');
        const select = new CalendarSelect({ locale: 'it' });
        select.label(bag({ text: 'Calendario', class: 'form-label' }));
        select.appendTo(container);
        const label = container.querySelector('label');
        expect(label.textContent).toBe('Calendario');
        expect(label.className).toBe('form-label');
    });

    it('CalendarSelect.wrapper() applies the wrapper options the bag carries', () => {
        const select = new CalendarSelect({ locale: 'it' });
        select.wrapper(bag({ as: 'td', class: 'wrap' }));
        expect(select._wrapperElement.tagName).toBe('TD');
        expect(select._wrapperElement.className).toBe('wrap');
    });

    it('RiteSelect applies the class and locale the bag carries', () => {
        const select = new RiteSelect(
            bag({ locale: 'it', class: 'form-select' }),
        );
        expect(select._domElement.className).toBe('form-select');
        expect(select._locale).toBe('it');
    });

    it('RiteSelect.label() applies the label options the bag carries', () => {
        const container = document.createElement('div');
        const select = new RiteSelect({ locale: 'it' });
        select.label(bag({ text: 'Rito', class: 'form-label' }));
        select.appendTo(container);
        const label = container.querySelector('label');
        expect(label.textContent).toBe('Rito');
        expect(label.className).toBe('form-label');
    });

    it('ApiOptions applies the locale the bag carries', () => {
        const apiOptions = new ApiOptions(bag({ locale: 'it' }));
        const optionLabels = [
            ...apiOptions._yearTypeInput._domElement.options,
        ].map((option) => option.textContent);
        expect(optionLabels).toContain(Messages['it']['LITURGICAL_YEAR']);
    });

    it('LiturgyOfTheDay applies the locale and class the bag carries', () => {
        const widget = new LiturgyOfTheDay(
            bag({ locale: 'it', class: 'card' }),
        );
        expect(widget._titleElement.textContent).toBe(
            Messages['it']['LITURGY_OF_THE_DAY'],
        );
        expect(widget._domElement.className).toBe('card');
    });

    it('LiturgyOfAnyDay applies the locale and class the bag carries', () => {
        const widget = new LiturgyOfAnyDay(
            bag({ locale: 'it', class: 'card' }),
        );
        expect(widget._titleElement.textContent).toBe(
            Messages['it']['LITURGY_OF_THE_DAY'],
        );
        expect(widget._domElement.className).toBe('card');
    });

    it('WebCalendar applies the id and class the bag carries', async () => {
        const apiClient = await ApiClient.init(DEV);
        const container = document.createElement('div');
        const webCalendar = new WebCalendar(
            bag({ id: 'litcal', class: 'table' }),
        );
        webCalendar.appendTo(container);
        webCalendar.listenTo(apiClient);
        apiClient._eventBus.emit('calendarFetched', CALENDAR_DATA());
        await new Promise((resolve) => setTimeout(resolve, 0));
        const table = container.querySelector('table');
        expect(table.id).toBe('litcal');
        expect(table.className).toBe('table');
    });
});
