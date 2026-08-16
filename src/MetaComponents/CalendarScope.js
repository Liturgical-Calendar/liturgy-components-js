/**
 * Resolves a "calendar scope" bag — a consumer's declaration of which
 * calendars a widget may show — into the rites and calendars it admits, plus
 * an initial selection.
 *
 * Deliberately NOT exported from `src/index.js`, on the same reasoning as
 * `Theme.js` and `FilterInputs.js`: internal contract between components, not
 * public API. Later tasks add scope validation and visibility derivation on
 * top of this pure resolver, and the components that consume it.
 *
 * `resolveScope()` returns `null` when the scope restricts nothing — a
 * nullish scope, `{}`, or a bag naming none of `nation`/`diocese`/`rite`/
 * `locale`. Callers skip scope handling entirely in that case, which is what
 * keeps every existing code path in the library untouched.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import { Rite, RiteProperties } from '../Enums.js';

/**
 * Finds a diocesan calendar across every rite, returning it with its rite.
 *
 * @param {import('../ApiClient/ApiBase.js').default} apiBase - The loaded base.
 * @param {string} dioceseId - The diocesan calendar id.
 * @returns {?{calendar_id: string, nation: string, locales: string[], rite: string}}
 */
function findDiocese(apiBase, dioceseId) {
    for (const rite of Object.values(Rite)) {
        const found = apiBase
            .diocesanCalendars(rite)
            .find((entry) => entry.calendar_id === dioceseId);
        if (undefined !== found) {
            return { ...found, rite };
        }
    }
    return null;
}

/**
 * Whether a rite is in scope for a nation.
 *
 * A rite is in scope iff the nation has a national calendar for it, or at
 * least one diocese of it. This is what keeps an Ambrosian option off a
 * United States widget, where it would lead only to the bare Ambrosian
 * calendar. A rite with no national tier can only qualify through a diocese.
 *
 * @param {import('../ApiClient/ApiBase.js').default} apiBase - The loaded base.
 * @param {string} nation - The nation's calendar id.
 * @param {string} rite - The rite to test.
 * @returns {boolean}
 */
function nationHasRite(apiBase, nation, rite) {
    if (
        RiteProperties[rite].hasNationalTier &&
        apiBase
            .nationalCalendars()
            .some((entry) => entry.calendar_id === nation)
    ) {
        return true;
    }
    return apiBase
        .diocesanCalendars(rite)
        .some((entry) => entry.nation === nation);
}

/**
 * The rite-level stand-in calendar for a rite: the General Roman Calendar for
 * the Roman rite, the bare Ambrosian calendar for the Ambrosian rite. Its
 * locales come from the rite's own `{rite}_calendars` entry when the API
 * publishes one; the Roman rite publishes none — there is no
 * `roman_calendars` key, because the General Roman Calendar is served in
 * every locale the API supports — so it falls back to the base's full
 * locale list.
 *
 * @param {import('../ApiClient/ApiBase.js').default} apiBase - The loaded base.
 * @param {string} rite - The rite to build the stand-in for.
 * @returns {{type: 'rite', id: '', locales: string[]}}
 */
function riteStandIn(apiBase, rite) {
    return {
        type: 'rite',
        id: '',
        locales: apiBase.riteCalendars(rite)[0]?.locales ?? apiBase.locales(),
    };
}

/**
 * The calendars a scope offers for a single rite.
 *
 * A `diocese` scope offers only that diocese, on its own rite. A `nation`
 * scope offers the nation's national calendar when the rite has a national
 * tier; when it does not (the Ambrosian rite has none), the rite-level
 * stand-in takes its place, since there is no national calendar to show. The
 * nation's dioceses of that rite are appended when `includeDioceses` is
 * `true`.
 *
 * When neither `nation` nor `diocese` is named — a scope restricting only
 * `rite` and/or `locale` — the rite itself is not otherwise narrowed, so
 * every calendar of that rite is offered: the rite-level stand-in, every
 * national calendar (only where the rite has a national tier), and every
 * diocesan calendar of that rite.
 *
 * @param {Object} scope - The scope bag.
 * @param {import('../ApiClient/ApiBase.js').default} apiBase - The loaded base.
 * @param {string} rite - The rite to build calendars for.
 * @returns {Array<{type: 'rite'|'national'|'diocesan', id: string, locales: string[]}>}
 */
function calendarsForRite(scope, apiBase, rite) {
    if (undefined !== scope.diocese) {
        const diocese = findDiocese(apiBase, scope.diocese);
        return [
            {
                type: 'diocesan',
                id: diocese.calendar_id,
                locales: diocese.locales,
            },
        ];
    }

    if (undefined === scope.nation) {
        const calendars = [riteStandIn(apiBase, rite)];
        if (RiteProperties[rite].hasNationalTier) {
            calendars.push(
                ...apiBase.nationalCalendars().map((entry) => ({
                    type: 'national',
                    id: entry.calendar_id,
                    locales: entry.locales,
                })),
            );
        }
        calendars.push(
            ...apiBase.diocesanCalendars(rite).map((entry) => ({
                type: 'diocesan',
                id: entry.calendar_id,
                locales: entry.locales,
            })),
        );
        return calendars;
    }

    const calendars = [];
    if (RiteProperties[rite].hasNationalTier) {
        const national = apiBase
            .nationalCalendars()
            .find((entry) => entry.calendar_id === scope.nation);
        calendars.push({
            type: 'national',
            id: national.calendar_id,
            locales: national.locales,
        });
    } else {
        calendars.push(riteStandIn(apiBase, rite));
    }

    if (true === scope.includeDioceses) {
        const dioceses = apiBase
            .diocesanCalendars(rite)
            .filter((entry) => entry.nation === scope.nation)
            .map((entry) => ({
                type: 'diocesan',
                id: entry.calendar_id,
                locales: entry.locales,
            }));
        calendars.push(...dioceses);
    }

    return calendars;
}

/**
 * Resolves a calendar scope against a loaded `ApiBase` into the rites and
 * calendars it admits, plus an initial selection.
 *
 * @param {?Object} scope - The scope bag (`nation`, `diocese`, `rite`, `locale`, `includeDioceses`), or
 *   nullish for "no scope".
 * @param {import('../ApiClient/ApiBase.js').default} apiBase - The loaded base to resolve the scope against.
 * @returns {?{
 *   rites: string[],
 *   calendarsByRite: Object<string, Array<{type: 'rite'|'national'|'diocesan', id: string, locales: string[]}>>,
 *   initial: {rite: string, calendarType: 'rite'|'national'|'diocesan', calendarId: string, locale: ?string},
 * }}
 */
function resolveScope(scope, apiBase) {
    if (
        null === scope ||
        undefined === scope ||
        (undefined === scope.nation &&
            undefined === scope.diocese &&
            undefined === scope.rite &&
            undefined === scope.locale)
    ) {
        return null;
    }

    let rites;
    if (undefined !== scope.diocese) {
        rites = [findDiocese(apiBase, scope.diocese).rite];
    } else if (undefined !== scope.nation) {
        rites = Object.values(Rite).filter((rite) =>
            nationHasRite(apiBase, scope.nation, rite),
        );
    } else {
        rites = Object.values(Rite);
    }

    if (undefined !== scope.rite) {
        const scopeRites = Array.isArray(scope.rite)
            ? scope.rite
            : [scope.rite];
        rites = scopeRites.filter((rite) => rites.includes(rite));
    }

    const calendarsByRite = {};
    for (const rite of rites) {
        calendarsByRite[rite] = calendarsForRite(scope, apiBase, rite);
    }

    const initialRite = rites[0];
    const initialCalendar = calendarsByRite[initialRite][0];

    return {
        rites,
        calendarsByRite,
        initial: {
            rite: initialRite,
            calendarType: initialCalendar.type,
            calendarId: initialCalendar.id,
            locale: scope.locale ?? null,
        },
    };
}

export { resolveScope };
