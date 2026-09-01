/** @jest-environment jsdom */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import TodayViewer from '../MetaComponents/TodayViewer.js';
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

describe('TodayViewer construction', () => {
    it('builds all four children', () => {
        const viewer = new TodayViewer({ locale: 'en' });
        expect(viewer.calendarSelect).not.toBeNull();
        expect(viewer.riteSelect).not.toBeNull();
        expect(viewer.localeInput).not.toBeNull();
        expect(viewer.liturgy).not.toBeNull();
    });

    it('rejects an unparseable locale rather than falling back to English', () => {
        expect(() => new TodayViewer({ locale: 'not a locale' })).toThrow(
            /TodayViewer/,
        );
    });

    it('rejects a malformed theme, naming the component', () => {
        expect(
            () => new TodayViewer({ locale: 'en', theme: 'form-select' }),
        ).toThrow(/TodayViewer.*theme/);
    });

    it('throws for an unknown scope key, naming the component', () => {
        expect(
            () => new TodayViewer({ locale: 'en', scope: { natoin: 'IT' } }),
        ).toThrow(/TodayViewer.*natoin/s);
    });
});

describe('TodayViewer slot mounting', () => {
    it('mounts each child into its named slot', () => {
        const viewer = new TodayViewer({ locale: 'en' });
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
        const viewer = new TodayViewer({ locale: 'en' });
        viewer.appendTo('#single');
        expect(
            document.querySelectorAll('#single select').length,
        ).toBeGreaterThanOrEqual(3);
    });

    it('omits a child whose slot is not named', () => {
        const viewer = new TodayViewer({ locale: 'en' });
        viewer.appendTo({ calendar: '#calendar', liturgy: '#liturgy' });
        expect(document.querySelector('#rite select')).toBeNull();
        expect(document.querySelector('#calendar select')).not.toBeNull();
    });

    it('returns undefined from appendTo, per library convention', () => {
        const viewer = new TodayViewer({ locale: 'en' });
        expect(viewer.appendTo('#single')).toBeUndefined();
    });

    it('throws when a named slot matches nothing', () => {
        const viewer = new TodayViewer({ locale: 'en' });
        expect(() => viewer.appendTo({ calendar: '#nope' })).toThrow(/nope/);
    });

    it('names appendTo, not mountInto, when called directly', () => {
        const viewer = new TodayViewer({ locale: 'en' });
        expect(() => viewer.appendTo({ calendar: '#nope' })).toThrow(
            /TodayViewer\.appendTo: Element not found/,
        );
    });

    it('mounts the rite select before linking it', () => {
        const viewer = new TodayViewer({ locale: 'en' });
        viewer.appendTo({ rite: '#rite', calendar: '#calendar' });
        expect(viewer.riteSelect._domElement.isConnected).toBe(true);
    });

    it('rejects a number target, naming TodayViewer', () => {
        const viewer = new TodayViewer({ locale: 'en' });
        expect(() => viewer.appendTo(42)).toThrow(/TodayViewer/);
    });

    it('rejects a null target, naming TodayViewer', () => {
        const viewer = new TodayViewer({ locale: 'en' });
        expect(() => viewer.appendTo(null)).toThrow(/TodayViewer/);
    });

    it('rejects an array target, naming TodayViewer', () => {
        const viewer = new TodayViewer({ locale: 'en' });
        expect(() => viewer.appendTo(['#single'])).toThrow(/TodayViewer/);
    });
});

describe('TodayViewer title', () => {
    it('shows the title by default', () => {
        const viewer = new TodayViewer({ locale: 'en' });
        viewer.appendTo('#single');
        expect(viewer.liturgy._titleElement.style.display).not.toBe('none');
    });

    it('hides the title when showTitle is false', () => {
        const viewer = new TodayViewer({ locale: 'en', showTitle: false });
        viewer.appendTo('#single');
        expect(viewer.liturgy._titleElement.style.display).toBe('none');
    });
});

describe('TodayViewer default selection', () => {
    // Selecting Vatican would silently force Latin. The General Roman Calendar is
    // the universal calendar and is available in every supported locale.
    it('selects the General Roman Calendar rather than Vatican', () => {
        const viewer = new TodayViewer({ locale: 'en' });
        viewer.appendTo('#single');
        expect(viewer.calendarSelect._domElement.value).toBe('');
    });
});

describe('TodayViewer theme', () => {
    it('applies a per-child class override to the liturgy widget', () => {
        const viewer = new TodayViewer({
            locale: 'en',
            theme: { liturgy: { class: 'card shadow' } },
        });
        viewer.appendTo('#single');
        expect(viewer.liturgy._domElement.classList.contains('card')).toBe(
            true,
        );
    });

    it('overrides the calendar select label text', () => {
        const viewer = new TodayViewer({
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
});

/**
 * Reproduces the real rite partition, with Lugano present so a nation scope
 * can be shown to exclude it. Copied verbatim from
 * `CalendarControlsScope.test.js` (itself copied from Task 4's
 * `CalendarScope.test.js`) rather than the shared `FULL_METADATA` fixture,
 * which CLAUDE.md requires stay byte-identical to the live `/calendars`
 * response — `lugano_ch` must not be invented there.
 */
const SCOPE_METADATA = {
    locales: ['en', 'it', 'fr', 'la'],
    national_calendars: [
        { calendar_id: 'IT', locales: ['it'] },
        { calendar_id: 'US', locales: ['en'] },
        { calendar_id: 'CA', locales: ['fr-CA', 'en-CA'] },
        { calendar_id: 'CH', locales: ['de', 'fr', 'it'] },
    ],
    diocesan_calendars: [
        {
            calendar_id: 'romamo_it',
            nation: 'IT',
            diocese: 'Roma',
            locales: ['it'],
            rite: 'roman',
        },
        {
            calendar_id: 'milano_it',
            nation: 'IT',
            diocese: 'Milano',
            locales: ['it'],
            rite: 'ambrosian',
        },
        {
            calendar_id: 'lugano_ch',
            nation: 'CH',
            diocese: 'Lugano',
            locales: ['it'],
            rite: 'ambrosian',
        },
        {
            calendar_id: 'boston_us',
            nation: 'US',
            diocese: 'Boston',
            locales: ['en'],
            rite: 'roman',
        },
    ],
    ambrosian_calendars: [{ calendar_id: 'AMBROSIAN', locales: ['it', 'la'] }],
};

describe('TodayViewer scope narrowing', () => {
    beforeEach(() => {
        ApiBase.reset();
        ApiBase.fromMetadata(API_URL, SCOPE_METADATA);
        document.body.innerHTML = '<div id="mount"></div>';
    });

    it("restricts the calendar select's OPTIONS to the scope for the current rite, excluding Lugano under Ambrosian", () => {
        const viewer = new TodayViewer({
            locale: 'en',
            scope: { nation: 'IT', includeDioceses: true },
        });
        viewer.appendTo('#mount');

        expect(
            [...viewer.calendarSelect._domElement.options].map((o) => o.value),
        ).toEqual(['IT', 'romamo_it']);

        viewer.riteSelect._domElement.value = 'ambrosian';
        viewer.riteSelect._domElement.dispatchEvent(new Event('change'));

        // The rite-level stand-in (value '') plus Milan; Lugano (a Swiss
        // diocese) must NOT appear.
        expect(
            [...viewer.calendarSelect._domElement.options].map((o) => o.value),
        ).toEqual(['', 'milano_it']);
    });

    it('hides both selects and selects the scoped calendar for a diocese scope', () => {
        const viewer = new TodayViewer({
            locale: 'en',
            scope: { diocese: 'romamo_it' },
        });
        viewer.appendTo('#mount');
        expect(viewer.riteSelect._domElement.hidden).toBe(true);
        expect(viewer.calendarSelect._domElement.hidden).toBe(true);
        expect(viewer.calendarSelect._domElement.value).toBe('romamo_it');
    });

    it('leaves an unscoped instance exactly as before', () => {
        const viewer = new TodayViewer({ locale: 'en' });
        viewer.appendTo('#mount');
        expect(viewer.riteSelect._domElement.hidden).toBe(false);
        expect(viewer.calendarSelect._domElement.hidden).toBe(false);
        expect(viewer.localeInput._domElement.hidden).toBe(false);
    });
});
