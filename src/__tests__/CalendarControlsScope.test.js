/** @jest-environment jsdom */
/**
 * `CalendarControls` accepts a `scope` option and derives its three children's
 * visibility from it — see `src/MetaComponents/CalendarScope.js` for the
 * resolver this consumes, and that file's `deriveVisibility()` doc comment
 * for why visibility must be re-derived on every rite AND calendar change
 * rather than computed once at construction.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import CalendarControls from '../MetaComponents/CalendarControls.js';

const API_URL = 'http://localhost:8000';

/**
 * Reproduces the real rite partition, with Lugano present so a nation scope
 * can be shown to exclude it. `US` has a Roman diocese and no Ambrosian one,
 * which is what makes the derived-rites rule observable. Copied verbatim from
 * `CalendarScope.test.js` (Task 4) rather than the shared `FULL_METADATA`
 * fixture, which CLAUDE.md requires stay byte-identical to the live
 * `/calendars` response — `lugano_ch` must not be invented there.
 */
const METADATA = {
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

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, METADATA);
    document.body.replaceChildren();
    const mount = document.createElement('div');
    mount.id = 'mount';
    document.body.appendChild(mount);
});

describe('CalendarControls with a scope', () => {
    it('hides every control for a diocese scope', () => {
        const controls = new CalendarControls({
            locale: 'en',
            scope: { diocese: 'romamo_it' },
        });
        controls.appendTo('#mount');
        expect(controls.riteSelect._domElement.hidden).toBe(true);
        expect(controls.calendarSelect._domElement.hidden).toBe(true);
    });

    it('shows the rite select for a two-rite national scope', () => {
        const controls = new CalendarControls({
            locale: 'en',
            scope: { nation: 'IT' },
        });
        controls.appendTo('#mount');
        expect(controls.riteSelect._domElement.hidden).toBe(false);
        expect(controls.calendarSelect._domElement.hidden).toBe(true);
    });

    it('restricts the rite select to the rites in scope', () => {
        const controls = new CalendarControls({
            locale: 'en',
            scope: { nation: 'US' },
        });
        controls.appendTo('#mount');
        expect(
            [...controls.riteSelect._domElement.options].map((o) => o.value),
        ).toEqual(['roman']);
    });

    it('selects the scope’s calendar', () => {
        const controls = new CalendarControls({
            locale: 'en',
            scope: { diocese: 'romamo_it' },
        });
        controls.appendTo('#mount');
        expect(controls.calendarSelect._domElement.value).toBe('romamo_it');
    });

    it('re-derives visibility when the rite changes', () => {
        const controls = new CalendarControls({
            locale: 'en',
            scope: { nation: 'CH', includeDioceses: true },
        });
        controls.appendTo('#mount');
        expect(controls.calendarSelect._domElement.hidden).toBe(true);
        controls.riteSelect._domElement.value = 'ambrosian';
        controls.riteSelect._domElement.dispatchEvent(new Event('change'));
        expect(controls.calendarSelect._domElement.hidden).toBe(false);
    });

    it('throws for an unknown scope key, naming the component', () => {
        expect(
            () =>
                new CalendarControls({ locale: 'en', scope: { natoin: 'IT' } }),
        ).toThrow(/CalendarControls.*natoin/s);
    });

    it('leaves an unscoped instance exactly as before', () => {
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#mount');
        expect(controls.riteSelect._domElement.hidden).toBe(false);
    });
});
