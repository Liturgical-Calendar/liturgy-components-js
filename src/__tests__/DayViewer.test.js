/** @jest-environment jsdom */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import DayViewer from '../MetaComponents/DayViewer.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

const SLOTS = `
    <div id="rite"></div>
    <div id="calendar"></div>
    <div id="locale"></div>
    <div id="liturgy"></div>
    <div id="single"></div>
`;

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.innerHTML = SLOTS;
});

describe('DayViewer construction', () => {
    it('builds all four children', () => {
        const viewer = new DayViewer({ locale: 'en' });
        expect(viewer.calendarSelect).not.toBeNull();
        expect(viewer.riteSelect).not.toBeNull();
        expect(viewer.localeInput).not.toBeNull();
        expect(viewer.liturgy).not.toBeNull();
    });

    it('rejects an unparseable locale rather than falling back to English', () => {
        expect(() => new DayViewer({ locale: 'not a locale' })).toThrow(
            /DayViewer/,
        );
    });

    it('rejects a malformed theme, naming the component', () => {
        expect(
            () => new DayViewer({ locale: 'en', theme: 'form-select' }),
        ).toThrow(/DayViewer.*theme/);
    });
});

describe('DayViewer slot mounting', () => {
    it('mounts each child into its named slot', () => {
        const viewer = new DayViewer({ locale: 'en' });
        viewer.appendTo({
            rite: '#rite',
            calendar: '#calendar',
            locale: '#locale',
            liturgy: '#liturgy',
        });
        expect(document.querySelector('#rite select')).not.toBeNull();
        expect(document.querySelector('#calendar select')).not.toBeNull();
        expect(document.querySelector('#locale select')).not.toBeNull();
        expect(
            document.querySelector('#liturgy').children.length,
        ).toBeGreaterThan(0);
    });

    it('mounts everything into one container when given a single target', () => {
        const viewer = new DayViewer({ locale: 'en' });
        viewer.appendTo('#single');
        expect(
            document.querySelectorAll('#single select').length,
        ).toBeGreaterThanOrEqual(3);
    });

    it('omits a child whose slot is not named', () => {
        const viewer = new DayViewer({ locale: 'en' });
        viewer.appendTo({ calendar: '#calendar', liturgy: '#liturgy' });
        expect(document.querySelector('#rite select')).toBeNull();
        expect(document.querySelector('#calendar select')).not.toBeNull();
    });

    it('returns undefined from appendTo, per library convention', () => {
        const viewer = new DayViewer({ locale: 'en' });
        expect(viewer.appendTo('#single')).toBeUndefined();
    });

    it('throws when a named slot matches nothing', () => {
        const viewer = new DayViewer({ locale: 'en' });
        expect(() => viewer.appendTo({ calendar: '#nope' })).toThrow(/nope/);
    });

    // M3: a direct `appendTo()` call must still name `appendTo` — only a call
    // routed through `mountInto()` (see DayViewerMount.test.js) should name that
    // method instead. `#requireElement`'s `caller` parameter must default correctly
    // for the direct path, not merely accept an override for the indirect one.
    it('names appendTo, not mountInto, when called directly', () => {
        const viewer = new DayViewer({ locale: 'en' });
        expect(() => viewer.appendTo({ calendar: '#nope' })).toThrow(
            /DayViewer\.appendTo: Element not found/,
        );
    });

    // The rite select must be in the DOM before it is linked, so it is mounted first.
    it('mounts the rite select before linking it', () => {
        const viewer = new DayViewer({ locale: 'en' });
        viewer.appendTo({ rite: '#rite', calendar: '#calendar' });
        expect(viewer.riteSelect._domElement.isConnected).toBe(true);
    });

    // A malformed target must throw, naming DayViewer, rather than either mounting
    // nothing silently (a number coerces through Object.hasOwn to "no slot named")
    // or throwing an unnamed raw TypeError (null throws inside Object.hasOwn itself).
    it('rejects a number target, naming DayViewer', () => {
        const viewer = new DayViewer({ locale: 'en' });
        expect(() => viewer.appendTo(42)).toThrow(/DayViewer/);
    });

    it('rejects a null target, naming DayViewer', () => {
        const viewer = new DayViewer({ locale: 'en' });
        expect(() => viewer.appendTo(null)).toThrow(/DayViewer/);
    });

    it('rejects an array target, naming DayViewer', () => {
        const viewer = new DayViewer({ locale: 'en' });
        expect(() => viewer.appendTo(['#single'])).toThrow(/DayViewer/);
    });
});

describe('DayViewer title', () => {
    it('shows the title by default', () => {
        const viewer = new DayViewer({ locale: 'en' });
        viewer.appendTo('#single');
        expect(viewer.liturgy._titleElement.style.display).not.toBe('none');
    });

    it('hides the title when showTitle is false', () => {
        const viewer = new DayViewer({ locale: 'en', showTitle: false });
        viewer.appendTo('#single');
        expect(viewer.liturgy._titleElement.style.display).toBe('none');
    });
});

describe('DayViewer default selection', () => {
    // Selecting Vatican would silently force Latin. The General Roman Calendar is
    // the universal calendar and is available in every supported locale.
    it('selects the General Roman Calendar rather than Vatican', () => {
        const viewer = new DayViewer({ locale: 'en' });
        viewer.appendTo('#single');
        expect(viewer.calendarSelect._domElement.value).toBe('');
    });
});

describe('DayViewer labels', () => {
    it('labels the date controls from the message catalogue', () => {
        const viewer = new DayViewer({ locale: 'it' });
        viewer.appendTo('#single');
        const text = document.getElementById('single').textContent;
        expect(text).toContain('Giorno');
        expect(text).toContain('Anno');
    });

    // The fallback is per KEY, not per LOCALE: `zh` has no `DAY` translation but
    // does have `MONTH` ('月'). Asserting only the English fallback ('Day') cannot
    // distinguish this implementation from a per-locale one that reverts a locale
    // missing ANY key to English wholesale — that wrong implementation would also
    // show 'Day', but it would show 'Month' instead of '月'. Asserting both in the
    // same render is what actually pins the per-key behaviour the design depends on.
    it('falls back to English per key, not per locale, for an untranslated locale', () => {
        const viewer = new DayViewer({ locale: 'zh' });
        viewer.appendTo('#single');
        const text = document.getElementById('single').textContent;
        expect(text).toContain('Day');
        expect(text).toContain('月');
        expect(text).not.toContain('Month');
    });
});

// I1: the flat `wrapper` key must reach every child that CAN take a wrapper, not
// only `calendarSelect`. Asserted on the resulting DOM, not merely `.not.toThrow()`
// — see `MetaComponentThemeWrapperSymmetry.test.js` for why that distinction
// matters here.
describe('DayViewer theme wrapper', () => {
    it('wraps the locale input, not only the calendar select', () => {
        const viewer = new DayViewer({
            locale: 'en',
            theme: { select: 'form-select', wrapper: 'col-md-3' },
        });
        viewer.appendTo('#single');

        const localeSelect = viewer.localeInput._domElement;
        const localeWrapper = localeSelect.closest('.col-md-3');
        expect(localeWrapper).not.toBeNull();
        expect(localeWrapper.tagName).toBe('DIV');

        const calendarWrapper =
            viewer.calendarSelect._domElement.closest('.col-md-3');
        expect(calendarWrapper).not.toBeNull();
    });

    // RiteSelect has no wrapper concept at all: the flat key must not throw or
    // silently invent one for it, and no wrapper element should appear around it.
    it('leaves the rite select unwrapped, since RiteSelect has no wrapper concept', () => {
        const viewer = new DayViewer({
            locale: 'en',
            theme: { select: 'form-select', wrapper: 'col-md-3' },
        });
        viewer.appendTo('#single');
        const riteSelect = viewer.riteSelect._domElement;
        expect(riteSelect.closest('.col-md-3')).toBeNull();
        expect(riteSelect.parentElement).toBe(
            document.getElementById('single'),
        );
    });

    it('applies a per-child wrapperClass override to the locale input', () => {
        const viewer = new DayViewer({
            locale: 'en',
            theme: { localeInput: { wrapperClass: 'col-lg-6' } },
        });
        viewer.appendTo('#single');
        expect(
            viewer.localeInput._domElement.closest('.col-lg-6'),
        ).not.toBeNull();
    });
});

// I3: `labelText` is the theme bag's escape hatch for a themed child's label TEXT,
// since `CalendarSelect.label()`/`RiteSelect.label()` are one-shot and calling them
// again from the child getter throws once the theme bag has already called them.
describe('DayViewer theme labelText', () => {
    it('overrides the calendar select label text', () => {
        const viewer = new DayViewer({
            locale: 'en',
            theme: {
                label: 'form-label',
                calendarSelect: { labelText: 'Choose a calendar' },
            },
        });
        viewer.appendTo('#single');
        expect(
            viewer.calendarSelect._domElement.previousElementSibling
                .textContent,
        ).toBe('Choose a calendar');
    });

    it('overrides the rite select label text', () => {
        const viewer = new DayViewer({
            locale: 'en',
            theme: {
                label: 'form-label',
                riteSelect: { labelText: 'Choose a rite' },
            },
        });
        viewer.appendTo('#single');
        expect(
            viewer.riteSelect._domElement.previousElementSibling.textContent,
        ).toBe('Choose a rite');
    });

    it('overrides the locale input label text', () => {
        const viewer = new DayViewer({
            locale: 'en',
            theme: { localeInput: { labelText: 'Preferred language' } },
        });
        viewer.appendTo('#single');
        expect(viewer.localeInput._labelElement.textContent).toBe(
            'Preferred language',
        );
    });
});
