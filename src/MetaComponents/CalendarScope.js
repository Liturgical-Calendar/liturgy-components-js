/**
 * Resolves a "calendar scope" bag — a consumer's declaration of which
 * calendars a widget may show — into the rites and calendars it admits, plus
 * an initial selection.
 *
 * Deliberately NOT exported from `src/index.js`, on the same reasoning as
 * `Theme.js` and `FilterInputs.js`: internal contract between components, not
 * public API. Also exports `assertScope()`, which validates a scope bag
 * before it reaches this resolver, and `deriveVisibility()`, which turns a
 * resolved scope plus the currently selected rite and calendar into which
 * controls have a choice to offer. Later tasks add the components that
 * consume these.
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
import { assertPlainOptions } from '../OptionsValidation.js';

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
 * Whether a nation is known to the metadata at all — carrying a national
 * calendar, or at least one diocese under it in any rite. Mirrors
 * {@link nationHasRite}'s two-tier reasoning, but across every rite rather
 * than testing one, since a scope's `nation` need not resolve to a rite that
 * has a national tier to be a legitimate nation.
 *
 * @param {import('../ApiClient/ApiBase.js').default} apiBase - The loaded base.
 * @param {string} nation - The nation's calendar id.
 * @returns {boolean}
 */
function nationExists(apiBase, nation) {
    if (
        apiBase
            .nationalCalendars()
            .some((entry) => entry.calendar_id === nation)
    ) {
        return true;
    }
    return Object.values(Rite).some((rite) =>
        apiBase
            .diocesanCalendars(rite)
            .some((entry) => entry.nation === nation),
    );
}

/**
 * The keys a scope bag may carry.
 */
const SCOPE_KEYS = Object.freeze([
    'rite',
    'nation',
    'diocese',
    'locale',
    'includeDioceses',
]);

/**
 * Validates a scope bag before it is handed to {@link resolveScope}, so a
 * malformed scope fails loudly, naming the rejecting component, rather than
 * surfacing later as a confusing crash inside `resolveScope()` (an unmatched
 * diocese id, or a rite that leaves no calendar to resolve, would otherwise
 * throw a bare `TypeError` from deep inside its calendar-building helpers).
 *
 * Returns early, without throwing, for a nullish scope — the "no scope"
 * case `resolveScope()` itself treats as `null`. It does NOT special-case
 * `{}` or a scope naming none of `nation`/`diocese`/`rite`/`locale`: those
 * are syntactically valid scope bags (they simply resolve to "no scope"
 * downstream), so nothing here needs to reject them.
 *
 * A scope naming only `rite` and/or `locale`, with neither `nation` nor
 * `diocese`, is legitimate — `{ rite: 'roman' }` restricts the rite alone,
 * leaving every calendar of that rite in scope — and is validated the same
 * way as any other scope, not rejected for the missing keys.
 *
 * @param {unknown} scope - The candidate scope bag, or nullish for "no scope".
 * @param {string} componentName - The rejecting component's class name, used to
 *        prefix every message this throws.
 * @param {import('../ApiClient/ApiBase.js').default} apiBase - The loaded base to
 *        validate the scope against.
 * @returns {void}
 * @throws {Error} If the scope is not a plain object, names an unrecognised key,
 *         names a `nation` or `diocese` absent from the metadata, names a `nation`
 *         and `diocese` that contradict each other, names a `rite`
 *         that contradicts an inferred diocese rite or that has no overlap with
 *         the rites derivable for the scope, names an empty `rite` array, or
 *         names a `locale` the resolved calendar does not support.
 */
function assertScope(scope, componentName, apiBase) {
    if (null === scope || undefined === scope) {
        return;
    }

    assertPlainOptions(scope, `${componentName}: scope`);

    for (const key of Object.keys(scope)) {
        if (false === SCOPE_KEYS.includes(key)) {
            throw new Error(
                `${componentName}: scope.${key} is not a recognised scope key. Valid keys are: ${SCOPE_KEYS.join(', ')}.`,
            );
        }
    }

    let dioceseEntry = null;
    if (undefined !== scope.diocese) {
        dioceseEntry = findDiocese(apiBase, scope.diocese);
        if (null === dioceseEntry) {
            throw new Error(
                `${componentName}: scope.diocese "${scope.diocese}" is not a known diocesan calendar.`,
            );
        }
    }

    if (
        undefined !== scope.nation &&
        false === nationExists(apiBase, scope.nation)
    ) {
        throw new Error(
            `${componentName}: scope.nation "${scope.nation}" is not a known national calendar.`,
        );
    }

    // Both keys individually valid, but naming different nations: `nation`
    // silently winning over `diocese` would resolve a scope the caller never
    // asked for. Ordered after both existence checks above, so an unknown id
    // is still reported as "unknown", not misreported as a mismatch.
    if (
        undefined !== scope.nation &&
        null !== dioceseEntry &&
        false === apiBase.isValidDioceseForNation(scope.diocese, scope.nation)
    ) {
        throw new Error(
            `${componentName}: scope.diocese "${scope.diocese}" belongs to nation "${dioceseEntry.nation}", not scope.nation "${scope.nation}".`,
        );
    }

    let availableRites;
    if (null !== dioceseEntry) {
        availableRites = [dioceseEntry.rite];
    } else if (undefined !== scope.nation) {
        availableRites = Object.values(Rite).filter((rite) =>
            nationHasRite(apiBase, scope.nation, rite),
        );
    } else {
        availableRites = Object.values(Rite);
    }

    if (undefined !== scope.rite) {
        const requestedRites = Array.isArray(scope.rite)
            ? scope.rite
            : [scope.rite];
        if (0 === requestedRites.length) {
            throw new Error(
                `${componentName}: scope.rite must not be an empty array.`,
            );
        }
        const overlap = requestedRites.filter((rite) =>
            availableRites.includes(rite),
        );
        if (0 === overlap.length) {
            if (null !== dioceseEntry) {
                throw new Error(
                    `${componentName}: scope.rite "${requestedRites.join(', ')}" contradicts scope.diocese "${scope.diocese}", whose rite is "${dioceseEntry.rite}".`,
                );
            }
            const suffix =
                undefined !== scope.nation
                    ? ` for scope.nation "${scope.nation}"`
                    : '';
            throw new Error(
                `${componentName}: scope.rite "${requestedRites.join(', ')}" is not available${suffix}. Available rite(s): ${availableRites.join(', ')}.`,
            );
        }
    }

    if (undefined !== scope.locale) {
        const resolved = resolveScope(scope, apiBase);
        const initialCalendar =
            resolved.calendarsByRite[resolved.initial.rite][0];
        if (false === initialCalendar.locales.includes(scope.locale)) {
            throw new Error(
                `${componentName}: scope.locale "${scope.locale}" is not among the resolved calendar's locales: ${initialCalendar.locales.join(', ')}.`,
            );
        }
    }
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

/**
 * The number of locale choices the current calendar offers.
 *
 * A pinned `scope.locale` counts as one choice regardless of what the
 * current calendar itself supports — the input has nothing to offer once
 * the scope has already decided it. Otherwise this reads the CURRENT
 * calendar's own `locales` array (matched by rite and calendar id) rather
 * than re-deriving locales from the base, so it inherits whatever locale
 * list that calendar entry carries — including the rite-level stand-in's
 * fallback to the base's full locale list.
 *
 * @param {Object} resolved - `resolveScope()`'s non-null result.
 * @param {string} currentRite - The rite now selected.
 * @param {string} currentCalendarId - The calendar id now selected; `''` for rite-level.
 * @returns {number}
 */
function localeChoiceCount(resolved, currentRite, currentCalendarId) {
    if (null !== resolved.initial.locale) {
        return 1;
    }
    const calendars = resolved.calendarsByRite[currentRite] ?? [];
    const current =
        calendars.find((calendar) => calendar.id === currentCalendarId) ??
        calendars[0];
    return current?.locales.length ?? 0;
}

/**
 * Which controls have a choice to offer.
 *
 * Two of the three are RUNTIME-dependent rather than mount-time constants:
 * switching rite changes the calendar set, and switching calendar changes the
 * locale set. Callers must therefore re-derive on every rite and calendar
 * change, in the one place both land — `CalendarSelect._setHidden()`'s doc
 * comment records what happens when visibility is derived on the rite side
 * alone.
 *
 * @param {?Object} resolved - `resolveScope()`'s result, or `null` for no scope.
 * @param {string} currentRite - The rite now selected.
 * @param {string} currentCalendarId - The calendar id now selected; `''` for rite-level.
 * @param {Object<string, boolean>} inputs - Per-control overrides.
 * @returns {{riteSelect: boolean, calendarSelect: boolean, localeInput: boolean}}
 */
export function deriveVisibility(
    resolved,
    currentRite,
    currentCalendarId,
    inputs = {},
) {
    const derived =
        null === resolved
            ? { riteSelect: true, calendarSelect: true, localeInput: true }
            : {
                  riteSelect: resolved.rites.length > 1,
                  calendarSelect:
                      (resolved.calendarsByRite[currentRite] ?? []).length > 1,
                  localeInput:
                      localeChoiceCount(
                          resolved,
                          currentRite,
                          currentCalendarId,
                      ) > 1,
              };
    for (const key of ['riteSelect', 'calendarSelect', 'localeInput']) {
        if (typeof inputs?.[key] === 'boolean') {
            derived[key] = inputs[key];
        }
    }
    return derived;
}

export { resolveScope, assertScope };
