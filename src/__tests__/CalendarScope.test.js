/**
 * The scope resolver, as a pure function. No DOM: this file is about the
 * mapping from a scope bag plus metadata to rites, calendars and an initial
 * selection.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import { resolveScope, assertScope } from '../MetaComponents/CalendarScope.js';
import { Rite } from '../Enums.js';

const API_URL = 'http://localhost:8000';

/**
 * Reproduces the real rite partition, with Lugano present so a nation scope
 * can be shown to exclude it. `US` has a Roman diocese and no Ambrosian one,
 * which is what makes the derived-rites rule observable.
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

let base;

beforeEach(() => {
    ApiBase.reset();
    base = ApiBase.fromMetadata(API_URL, METADATA);
});

const ids = (resolved, rite) =>
    resolved.calendarsByRite[rite].map((calendar) => calendar.id);

describe('an empty scope', () => {
    it('resolves to null so existing behaviour is untouched', () => {
        expect(resolveScope(undefined, base)).toBeNull();
        expect(resolveScope(null, base)).toBeNull();
        expect(resolveScope({}, base)).toBeNull();
    });
});

describe('rites in scope are derived from the metadata', () => {
    it('gives a nation with both a national calendar and an Ambrosian diocese both rites', () => {
        expect(resolveScope({ nation: 'IT' }, base).rites).toEqual([
            Rite.ROMAN,
            Rite.AMBROSIAN,
        ]);
    });

    it('gives a nation with no Ambrosian diocese the Roman rite alone', () => {
        expect(resolveScope({ nation: 'US' }, base).rites).toEqual([
            Rite.ROMAN,
        ]);
    });

    it('gives a diocese scope exactly its own rite', () => {
        expect(resolveScope({ diocese: 'milano_it' }, base).rites).toEqual([
            Rite.AMBROSIAN,
        ]);
    });
});

describe('calendars per rite', () => {
    it('offers only the national calendar when includeDioceses is absent', () => {
        const resolved = resolveScope({ nation: 'IT' }, base);
        expect(ids(resolved, Rite.ROMAN)).toEqual(['IT']);
    });

    it('adds the nation’s dioceses when includeDioceses is true', () => {
        const resolved = resolveScope(
            { nation: 'IT', includeDioceses: true },
            base,
        );
        expect(ids(resolved, Rite.ROMAN)).toEqual(['IT', 'romamo_it']);
    });

    it('excludes a diocese belonging to another nation', () => {
        const resolved = resolveScope(
            { nation: 'IT', includeDioceses: true },
            base,
        );
        expect(ids(resolved, Rite.AMBROSIAN)).not.toContain('lugano_ch');
        expect(ids(resolved, Rite.AMBROSIAN)).toContain('milano_it');
    });

    it('stands the rite-level calendar in where the rite has no national tier', () => {
        const resolved = resolveScope({ nation: 'IT' }, base);
        expect(resolved.calendarsByRite[Rite.AMBROSIAN][0].type).toBe('rite');
    });
});

describe('scope.rite', () => {
    it('accepts a string and restricts to it', () => {
        expect(
            resolveScope({ nation: 'IT', rite: 'roman' }, base).rites,
        ).toEqual([Rite.ROMAN]);
    });

    it('accepts an array and preserves its order as the initial', () => {
        const resolved = resolveScope(
            { nation: 'IT', rite: ['ambrosian', 'roman'] },
            base,
        );
        expect(resolved.rites).toEqual([Rite.AMBROSIAN, Rite.ROMAN]);
        expect(resolved.initial.rite).toBe(Rite.AMBROSIAN);
    });
});

describe('the initial selection', () => {
    it('names the first calendar of the first rite', () => {
        const resolved = resolveScope({ nation: 'IT' }, base);
        expect(resolved.initial).toMatchObject({
            rite: Rite.ROMAN,
            calendarType: 'national',
            calendarId: 'IT',
        });
    });

    it('carries a pinned locale through', () => {
        const resolved = resolveScope(
            { nation: 'CA', rite: 'roman', locale: 'fr-CA' },
            base,
        );
        expect(resolved.initial.locale).toBe('fr-CA');
    });

    it('leaves locale null when none is pinned', () => {
        expect(resolveScope({ nation: 'CA' }, base).initial.locale).toBeNull();
    });
});

describe('a scope naming only rite and/or locale, with no nation or diocese', () => {
    it('resolves "rite: roman" alone to the Roman rite with more than the stand-in calendar', () => {
        const resolved = resolveScope({ rite: 'roman' }, base);
        expect(resolved.rites).toEqual([Rite.ROMAN]);
        expect(resolved.calendarsByRite[Rite.ROMAN].length).toBeGreaterThan(1);
    });

    it('resolves "rite: [roman, ambrosian]" alone without throwing', () => {
        expect(() =>
            resolveScope({ rite: [Rite.ROMAN, Rite.AMBROSIAN] }, base),
        ).not.toThrow();
    });

    it('resolves "locale" alone without throwing', () => {
        expect(() => resolveScope({ locale: 'it' }, base)).not.toThrow();
    });
});

describe("the rite-level stand-in's locales", () => {
    it("report the Ambrosian rite calendar's own locales", () => {
        const resolved = resolveScope({ rite: Rite.AMBROSIAN }, base);
        const standIn = resolved.calendarsByRite[Rite.AMBROSIAN][0];
        expect(standIn.type).toBe('rite');
        expect(standIn.locales).toEqual(['it', 'la']);
    });

    it('fall back to the base locales for the Roman rite, which publishes no rite calendars', () => {
        const resolved = resolveScope({ rite: Rite.ROMAN }, base);
        const standIn = resolved.calendarsByRite[Rite.ROMAN][0];
        expect(standIn.type).toBe('rite');
        expect(standIn.locales).toEqual(base.locales());
    });
});

describe('assertScope()', () => {
    it('accepts a nullish scope', () => {
        expect(() =>
            assertScope(undefined, 'CalendarViewer', base),
        ).not.toThrow();
        expect(() => assertScope(null, 'CalendarViewer', base)).not.toThrow();
    });

    it('rejects a non-object', () => {
        expect(() => assertScope('IT', 'CalendarViewer', base)).toThrow(
            /CalendarViewer.*scope/,
        );
    });

    it('rejects an unknown key, naming it and the accepted ones', () => {
        expect(() =>
            assertScope({ natoin: 'IT' }, 'CalendarViewer', base),
        ).toThrow(/natoin.*nation/s);
    });

    it('rejects a nation absent from the metadata', () => {
        expect(() => assertScope({ nation: 'ZZ' }, 'DayViewer', base)).toThrow(
            /DayViewer.*ZZ/,
        );
    });

    it('rejects a diocese absent from the metadata', () => {
        expect(() =>
            assertScope({ diocese: 'nowhere_xx' }, 'DayViewer', base),
        ).toThrow(/nowhere_xx/);
    });

    it('rejects a rite that contradicts the diocese, naming both', () => {
        expect(() =>
            assertScope(
                { rite: 'ambrosian', diocese: 'romamo_it' },
                'CalendarViewer',
                base,
            ),
        ).toThrow(/ambrosian.*romamo_it/s);
    });

    it('rejects a rite outside the set derived for the nation', () => {
        expect(() =>
            assertScope(
                { nation: 'US', rite: 'ambrosian' },
                'CalendarViewer',
                base,
            ),
        ).toThrow(/ambrosian.*roman/s);
    });

    it('rejects an empty rite array', () => {
        expect(() =>
            assertScope({ nation: 'IT', rite: [] }, 'CalendarViewer', base),
        ).toThrow(/empty/);
    });

    it('rejects a locale the resolved calendar does not support, listing those it does', () => {
        expect(() =>
            assertScope({ nation: 'IT', locale: 'de' }, 'CalendarViewer', base),
        ).toThrow(/de.*it/s);
    });

    it('accepts a locale the resolved calendar supports', () => {
        expect(() =>
            assertScope(
                { nation: 'CA', locale: 'fr-CA' },
                'CalendarViewer',
                base,
            ),
        ).not.toThrow();
    });
});
