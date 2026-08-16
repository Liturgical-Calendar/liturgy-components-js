/**
 * The scope resolver, as a pure function. No DOM: this file is about the
 * mapping from a scope bag plus metadata to rites, calendars and an initial
 * selection.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import { resolveScope } from '../MetaComponents/CalendarScope.js';
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
