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
import { ApiOptionsFilter } from '../Enums.js';

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

    // F2 (post-PR review): a diocesan entry with no `rite` key (v5 style,
    // meaning Roman) whose nation has no national calendar used to reach
    // `calendarsForRite()` and dereference `undefined`, throwing a bare
    // `TypeError` from a public constructor instead of a named error — the
    // same class of defect this branch already fixed twice.
    it('throws a named, component-labelled error rather than a bare TypeError when metadata declares a diocese but no national calendar for a nation', () => {
        ApiBase.reset();
        ApiBase.fromMetadata(API_URL, {
            locales: ['en', 'it'],
            national_calendars: [{ calendar_id: 'IT', locales: ['it'] }],
            diocesan_calendars: [
                {
                    calendar_id: 'chur_ch',
                    nation: 'CH',
                    diocese: 'Chur',
                    locales: ['de'],
                    // No `rite` key: v5 style, meaning Roman.
                },
            ],
            ambrosian_calendars: [],
        });
        expect(
            () =>
                new CalendarControls({ locale: 'en', scope: { nation: 'CH' } }),
        ).toThrow(/CalendarControls.*CH.*roman/s);
    });

    it('leaves an unscoped instance exactly as before', () => {
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#mount');
        expect(controls.riteSelect._domElement.hidden).toBe(false);
        expect(controls.calendarSelect._domElement.hidden).toBe(false);
        expect(controls.apiOptions.localeInput._domElement.hidden).toBe(false);
    });

    it("restricts the calendar select's OPTIONS to the scope for the current rite (F1)", () => {
        // The spec's worked-cases table headline: `{ nation: 'IT', includeDioceses:
        // true }` must OFFER "Italy + Italian Roman dioceses" under Roman and
        // "Ambrosian + Milan (not Lugano)" under Ambrosian — not still list every
        // nation and diocese worldwide underneath a visible select.
        const controls = new CalendarControls({
            locale: 'en',
            scope: { nation: 'IT', includeDioceses: true },
        });
        controls.appendTo('#mount');

        expect(
            [...controls.calendarSelect._domElement.options].map(
                (o) => o.value,
            ),
        ).toEqual(['IT', 'romamo_it']);

        controls.riteSelect._domElement.value = 'ambrosian';
        controls.riteSelect._domElement.dispatchEvent(new Event('change'));

        // The rite-level stand-in (value '') plus Milan; Lugano (a Swiss diocese)
        // must NOT appear — this is the headline Lugano-exclusion behaviour.
        expect(
            [...controls.calendarSelect._domElement.options].map(
                (o) => o.value,
            ),
        ).toEqual(['', 'milano_it']);
    });

    it('preserves the selected calendar across a same-rite restriction rebuild', () => {
        // A calendar change re-derives visibility through the same listener that
        // restricts the option list — `_restrictToScope()` must not revert the
        // user's own selection back to the list's first entry when the rite (and
        // so the entries) has not changed.
        const controls = new CalendarControls({
            locale: 'en',
            scope: { nation: 'IT', includeDioceses: true },
        });
        controls.appendTo('#mount');
        controls.calendarSelect._domElement.value = 'romamo_it';
        controls.calendarSelect._domElement.dispatchEvent(new Event('change'));
        expect(controls.calendarSelect._domElement.value).toBe('romamo_it');
    });
});

describe('CalendarControls scope combined with ApiOptionsFilter.PATH_BUILDER (F2)', () => {
    it('rejects a scope combined with PATH_BUILDER, naming both', () => {
        expect(
            () =>
                new CalendarControls({
                    locale: 'en',
                    scope: { nation: 'IT' },
                    filter: ApiOptionsFilter.PATH_BUILDER,
                }),
        ).toThrow(/CalendarControls.*scope.*PATH_BUILDER/is);
    });

    it('still accepts a scope under other filters', () => {
        expect(
            () =>
                new CalendarControls({
                    locale: 'en',
                    scope: { nation: 'IT' },
                    filter: ApiOptionsFilter.GENERAL_ROMAN,
                }),
        ).not.toThrow();
        expect(
            () =>
                new CalendarControls({
                    locale: 'en',
                    scope: { nation: 'IT' },
                    filter: ApiOptionsFilter.LOCALE_ONLY,
                }),
        ).not.toThrow();
        expect(
            () =>
                new CalendarControls({
                    locale: 'en',
                    scope: { nation: 'IT' },
                    filter: ApiOptionsFilter.ALL_CALENDARS,
                }),
        ).not.toThrow();
    });
});

describe('CalendarControls scope + inputs overrides (F3)', () => {
    it('inputs.riteSelect forces the rite select visible when the scope would hide it', () => {
        const controls = new CalendarControls({
            locale: 'en',
            scope: { diocese: 'romamo_it' },
            inputs: { riteSelect: true },
        });
        controls.appendTo('#mount');
        expect(controls.riteSelect._domElement.hidden).toBe(false);
    });

    it('inputs.riteSelect forces the rite select hidden when the scope would show it', () => {
        const controls = new CalendarControls({
            locale: 'en',
            scope: { nation: 'IT' },
            inputs: { riteSelect: false },
        });
        controls.appendTo('#mount');
        expect(controls.riteSelect._domElement.hidden).toBe(true);
    });

    it('inputs.calendarSelect forces the calendar select visible when the scope would hide it', () => {
        const controls = new CalendarControls({
            locale: 'en',
            scope: { diocese: 'romamo_it' },
            inputs: { calendarSelect: true },
        });
        controls.appendTo('#mount');
        expect(controls.calendarSelect._domElement.hidden).toBe(false);
    });

    it('inputs.calendarSelect forces the calendar select hidden when the scope would show it', () => {
        const controls = new CalendarControls({
            locale: 'en',
            scope: { nation: 'CH', includeDioceses: true },
            inputs: { calendarSelect: false },
        });
        controls.appendTo('#mount');
        controls.riteSelect._domElement.value = 'ambrosian';
        controls.riteSelect._domElement.dispatchEvent(new Event('change'));
        expect(controls.calendarSelect._domElement.hidden).toBe(true);
    });

    it('inputs.localeInput forces the locale input visible when the scope would hide it', () => {
        const controls = new CalendarControls({
            locale: 'en',
            scope: { diocese: 'romamo_it' },
            inputs: { localeInput: true },
        });
        controls.appendTo('#mount');
        expect(controls.apiOptions.localeInput._domElement.hidden).toBe(false);
    });

    it('inputs.localeInput forces the locale input hidden when the scope would show it', () => {
        const controls = new CalendarControls({
            locale: 'en',
            scope: { nation: 'CH' },
            inputs: { localeInput: false },
        });
        controls.appendTo('#mount');
        expect(controls.apiOptions.localeInput._domElement.hidden).toBe(true);
    });

    it('rejects a non-boolean value for the new inputs keys, naming the key and type', () => {
        expect(
            () =>
                new CalendarControls({
                    locale: 'en',
                    scope: { nation: 'IT' },
                    inputs: { riteSelect: 'yes' },
                }),
        ).toThrow(/CalendarControls.*riteSelect.*boolean/is);
    });
});
