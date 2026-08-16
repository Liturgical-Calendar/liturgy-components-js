/** @jest-environment jsdom */
/**
 * `CalendarResourcePicker` accepts a `scope` option and derives its rite
 * select and calendar select's visibility from it. `CalendarResourcePicker`
 * builds its selects DIRECTLY rather than through `CalendarControls`, which
 * is why it needs its own copy of the wiring `CalendarControlsScope.test.js`
 * already covers for that class — see `src/MetaComponents/CalendarScope.js`
 * for the resolver both consume.
 *
 * Unlike `CalendarControls` and `DayViewer`, this picker has no locale input
 * — `deriveVisibility()`'s third field is simply never applied here.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import CalendarResourcePicker from '../MetaComponents/CalendarResourcePicker.js';
import CalendarControls from '../MetaComponents/CalendarControls.js';
import { CalendarSelectFilter } from '../Enums.js';

const API_URL = 'http://localhost:8000';

/**
 * Reproduces the real rite partition, with Lugano present so a nation scope
 * can be shown to exclude it. `US` has a Roman diocese and no Ambrosian one,
 * which is what makes the derived-rites rule observable. Copied verbatim
 * from `CalendarControlsScope.test.js` (itself copied from Task 4's
 * `CalendarScope.test.js`) rather than the shared `FULL_METADATA` fixture,
 * which CLAUDE.md requires stay byte-identical to the live `/calendars`
 * response — `lugano_ch` must not be invented there.
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

describe('CalendarResourcePicker with a scope', () => {
    it('hides both selects and selects the scoped calendar for a diocese scope', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
            scope: { diocese: 'romamo_it' },
        });
        picker.appendTo('#mount');
        expect(picker.riteSelect._domElement.hidden).toBe(true);
        expect(picker.calendarSelect._domElement.hidden).toBe(true);
        expect(picker.calendarSelect._domElement.value).toBe('romamo_it');
    });

    it('restricts the rite select to the rites in scope', () => {
        // `includeDioceses: true` is required here (F4): under
        // `DIOCESAN_CALENDARS`, `_restrictToScope()` now keeps only diocesan
        // entries, and a nation scope with no `includeDioceses` offers none —
        // `US` alone would leave the calendar select nothing to show and throw.
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
            scope: { nation: 'US', includeDioceses: true },
        });
        picker.appendTo('#mount');
        expect(
            [...picker.riteSelect._domElement.options].map((o) => o.value),
        ).toEqual(['roman']);
    });

    it('throws for an unknown scope key, naming the component', () => {
        expect(
            () =>
                new CalendarResourcePicker({
                    locale: 'en',
                    filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
                    scope: { natoin: 'IT' },
                }),
        ).toThrow(/CalendarResourcePicker.*natoin/s);
    });

    it("restricts the calendar select's OPTIONS to the scope for the current rite, excluding Lugano under Ambrosian", () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
            scope: { nation: 'IT', includeDioceses: true },
        });
        picker.appendTo('#mount');

        // `DIOCESAN_CALENDARS` (F4) keeps only diocesan entries: `IT` (national)
        // is filtered out, leaving just the diocese.
        expect(
            [...picker.calendarSelect._domElement.options].map((o) => o.value),
        ).toEqual(['romamo_it']);

        picker.riteSelect._domElement.value = 'ambrosian';
        picker.riteSelect._domElement.dispatchEvent(new Event('change'));

        // The rite-level stand-in ('') is also filtered out under
        // `DIOCESAN_CALENDARS` — it belongs to the national domain, not the
        // diocesan one (see `CalendarSelect.#TYPES_BY_FILTER`) — leaving only
        // Milan; Lugano (a Swiss diocese) must NOT appear.
        expect(
            [...picker.calendarSelect._domElement.options].map((o) => o.value),
        ).toEqual(['milano_it']);
    });

    it('leaves an unscoped instance exactly as before', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
        });
        picker.appendTo('#mount');
        expect(picker.riteSelect._domElement.hidden).toBe(false);
        expect(picker.calendarSelect._domElement.hidden).toBe(false);
    });
});

describe('CalendarResourcePicker scope under CalendarSelectFilter.NATIONAL_CALENDARS (F1)', () => {
    it('offers Roman only, with no rite select and no unreachable Ambrosian branch, for a scope that merely permits it', () => {
        // Italy also has an Ambrosian diocese (`milano_it`), so `resolveScope()`
        // itself resolves `rites: ['roman', 'ambrosian']` — but this filter has
        // no rite select to ever reach the Ambrosian branch, and the scope never
        // DEMANDED it, so it must be narrowed away rather than rejected or left
        // silently unreachable.
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
            scope: { nation: 'IT' },
        });
        picker.appendTo('#mount');
        expect(picker.riteSelect).toBeNull();
        expect(
            [...picker.calendarSelect._domElement.options].map((o) => o.value),
        ).toEqual(['IT']);
        expect(picker.calendarSelect._domElement.value).toBe('IT');
    });

    it('throws naming both the pinned rite and the filter when scope.rite cannot be surfaced under NATIONAL_CALENDARS', () => {
        expect(
            () =>
                new CalendarResourcePicker({
                    locale: 'en',
                    filter: CalendarSelectFilter.NATIONAL_CALENDARS,
                    scope: { rite: 'ambrosian' },
                }),
        ).toThrow(
            /CalendarResourcePicker.*scope\.rite.*ambrosian.*NATIONAL_CALENDARS/s,
        );
    });

    it('leaves the DIOCESAN_CALENDARS case unchanged: both rites remain reachable for the same nation scope', () => {
        // `includeDioceses: true` is required here (F4): with no dioceses in
        // scope, neither rite has a diocesan entry to survive `DIOCESAN_CALENDARS`'
        // type filtering, and construction would throw before the rite select
        // could even be inspected.
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
            scope: { nation: 'IT', includeDioceses: true },
        });
        picker.appendTo('#mount');
        expect(
            [...picker.riteSelect._domElement.options].map((o) => o.value),
        ).toEqual(['roman', 'ambrosian']);
    });

    it('throws naming the diocese and its rite when an Ambrosian diocese scope is pinned under NATIONAL_CALENDARS, rather than the opaque internal error', () => {
        // `milano_it` is an Ambrosian diocese. `resolveScope()` derives
        // `rites: ['ambrosian']` from the diocese alone and never sets
        // `scope.rite` — so the guard must fire on "nothing survives
        // narrowing", not on "scope.rite was named", or this reaches
        // `_restrictToScope()` with an undefined entries array and throws
        // the opaque "entries must be an array, but found type: undefined"
        // instead.
        let thrown;
        try {
            new CalendarResourcePicker({
                locale: 'en',
                filter: CalendarSelectFilter.NATIONAL_CALENDARS,
                scope: { diocese: 'milano_it' },
            });
        } catch (error) {
            thrown = error;
        }
        expect(thrown).toBeInstanceOf(Error);
        expect(thrown.message).toMatch(
            /CalendarResourcePicker.*scope\.diocese.*milano_it.*ambrosian.*NATIONAL_CALENDARS/s,
        );
        expect(thrown.message).not.toMatch(/entries must be an array/);
    });

    it('throws for a Roman diocese scope under NATIONAL_CALENDARS too: the rite survives narrowing, but the diocesan entry itself does not (F4)', () => {
        // `romamo_it` is a Roman diocese, so `#narrowScopeToNationalTier()`'s
        // RITE-level narrowing finds `reachable` non-empty (Roman has a
        // national tier) and construction proceeds past it. But
        // `_restrictToScope()`'s own TYPE-level check (F4) then runs: the
        // scope's only entry for "roman" is the diocesan `romamo_it` itself,
        // and a `NATIONAL_CALENDARS`-filtered select cannot show a diocesan
        // entry — so this now throws too, one level deeper than the
        // Ambrosian diocese case above, and for a different reason (a type
        // mismatch, not an unreachable rite).
        expect(
            () =>
                new CalendarResourcePicker({
                    locale: 'en',
                    filter: CalendarSelectFilter.NATIONAL_CALENDARS,
                    scope: { diocese: 'romamo_it' },
                }),
        ).toThrow(
            /CalendarSelect\._restrictToScope.*diocesan.*roman.*nations/s,
        );
    });
});

describe("CalendarSelect._restrictToScope respects the select's own CalendarSelectFilter for calendar TYPES, for all three filters (F4)", () => {
    it('NATIONAL_CALENDARS keeps only national (and rite-level) entries, dropping a diocese the scope also offers', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.NATIONAL_CALENDARS,
            scope: { nation: 'IT', includeDioceses: true },
        });
        picker.appendTo('#mount');
        expect(
            [...picker.calendarSelect._domElement.options].map((o) => o.value),
        ).toEqual(['IT']);
    });

    it('DIOCESAN_CALENDARS keeps only diocesan entries, dropping the national calendar the scope also offers', () => {
        const picker = new CalendarResourcePicker({
            locale: 'en',
            filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
            scope: { nation: 'IT', includeDioceses: true },
        });
        picker.appendTo('#mount');
        expect(
            [...picker.calendarSelect._domElement.options].map((o) => o.value),
        ).toEqual(['romamo_it']);
    });

    it("CalendarSelectFilter.NONE (CalendarControls' unfiltered select) keeps everything the scope offers — no behaviour change for it", () => {
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
    });

    it('DIOCESAN_CALENDARS throws naming the filter when type-filtering would empty the select (a nation scope with no dioceses in scope)', () => {
        expect(
            () =>
                new CalendarResourcePicker({
                    locale: 'en',
                    filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
                    scope: { nation: 'US' },
                }),
        ).toThrow(/CalendarSelect\._restrictToScope.*national.*dioceses/s);
    });
});
