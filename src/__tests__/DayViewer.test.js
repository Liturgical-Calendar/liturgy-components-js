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

    // The rite select must be in the DOM before it is linked, so it is mounted first.
    it('mounts the rite select before linking it', () => {
        const viewer = new DayViewer({ locale: 'en' });
        viewer.appendTo({ rite: '#rite', calendar: '#calendar' });
        expect(viewer.riteSelect._domElement.isConnected).toBe(true);
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

    it('falls back to English for an untranslated locale', () => {
        const viewer = new DayViewer({ locale: 'zh' });
        viewer.appendTo('#single');
        const text = document.getElementById('single').textContent;
        expect(text).toContain('Day');
    });
});
