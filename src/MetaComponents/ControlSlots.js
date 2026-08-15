/**
 * Validates a filter-keyed `controls` slot and orders its passes.
 *
 * Deliberately NOT exported from `src/index.js`, on the same reasoning as
 * `Theme.js` and `InputVisibility.js`: internal contract between the
 * components, not public API.
 *
 * **What it replaces.** Splitting a controls form across rows used to need a
 * documented two-pass idiom — `viewer.controls.apiOptions.filter( X
 * ).appendTo( target )` after the mount — which reached through the component
 * for an object the component owns, and rested on three rules nothing
 * enforced: the second pass had to run after `appendTo()`, the filters could
 * not overlap, and `ApiOptionsFilter.NONE` could not participate. Each of the
 * three failed silently or confusingly when forgotten (#63). Naming the
 * containers by filter moves all three into the component.
 *
 * The idiom itself is NOT deprecated and does not warn: it is `ApiOptions`
 * public API, both migrated examples use it, `ApiExplorer` uses it internally,
 * and it is still the only way to reach a container the component does not own.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import { ApiOptionsFilter } from '../Enums.js';
import { inputKeysForFilter } from '../ApiOptions/FilterInputs.js';
import { assertPlainOptions } from '../OptionsValidation.js';

/**
 * The keys a filter-keyed `controls` slot may name, mapped to the filter each
 * one selects.
 *
 * The canonical five are the camelCase forms of the `ApiOptionsFilter` member
 * names, as issue #63 writes them. `basePath` and `allPaths` are accepted as
 * ALIASES of `generalRoman` and `allCalendars` for three reasons, none of them
 * "be permissive":
 *
 * - the enum already ships `BASE_PATH`/`ALL_PATHS` as alias members of exactly
 *   those two;
 * - their runtime VALUES are `'basePath'` and `'allPaths'`, so
 *   `{ [ ApiOptionsFilter.GENERAL_ROMAN ]: '#x' }` — a computed key a reader
 *   would expect to work, since the enum value IS the string — would otherwise
 *   throw;
 * - `ApiExplorer`'s existing slot names are literally `basePath` and
 *   `allPaths`, so accepting them keeps one vocabulary across the library.
 *
 * The other three keys are already identical under both spellings, which is why
 * only two aliases exist. Naming one filter under both spellings is rejected as
 * a duplicate rather than silently collapsed.
 *
 * @type {Readonly<Object<string, string>>}
 */
const FILTER_BY_SLOT_KEY = Object.freeze({
    generalRoman: ApiOptionsFilter.GENERAL_ROMAN,
    allCalendars: ApiOptionsFilter.ALL_CALENDARS,
    pathBuilder: ApiOptionsFilter.PATH_BUILDER,
    localeOnly: ApiOptionsFilter.LOCALE_ONLY,
    yearOnly: ApiOptionsFilter.YEAR_ONLY,
    basePath: ApiOptionsFilter.GENERAL_ROMAN,
    allPaths: ApiOptionsFilter.ALL_CALENDARS,
});

/**
 * The five canonical keys, for error messages.
 *
 * @type {Readonly<string[]>}
 */
const CANONICAL_KEYS = Object.freeze([
    'generalRoman',
    'allCalendars',
    'pathBuilder',
    'localeOnly',
    'yearOnly',
]);

/**
 * The order the passes RUN in, regardless of the order the caller wrote the
 * keys in — ordering is the component's responsibility now, which is the whole
 * point of #63's first rule.
 *
 * Exactly one constraint here is real: `PATH_BUILDER` must run before
 * `ALL_CALENDARS`, so `ApiOptions`' `#pathBuilderEnabled` is set before the
 * pass that would otherwise mount the year input a second time.
 * `ApiExplorer.appendTo()` already hard-codes that same precedence for its own
 * three fixed slots.
 *
 * Fixing the order is also what makes {@link claimedInputs}' exemption
 * order-independent: under caller order, `{ allCalendars, pathBuilder }` and
 * `{ pathBuilder, allCalendars }` would differ in which container ended up with
 * the year input — which is rule two's silent failure relocated rather than
 * removed. Pass order is otherwise unobservable, because no two passes may
 * share an input and each targets its own container.
 *
 * @type {Readonly<Array<string>>}
 */
const PASS_ORDER = Object.freeze([
    ApiOptionsFilter.PATH_BUILDER,
    ApiOptionsFilter.ALL_CALENDARS,
    ApiOptionsFilter.LOCALE_ONLY,
    ApiOptionsFilter.YEAR_ONLY,
    ApiOptionsFilter.GENERAL_ROMAN,
]);

/**
 * Whether a `controls` slot value is a filter-keyed bag rather than a single
 * target.
 *
 * A single target is a string or an `HTMLElement`, so anything else that
 * survives `assertPlainOptions()` is a bag. Callers ask this BEFORE validating,
 * so a value that is neither — a number, an array, a `Date` — still reaches
 * their own "must be a selector, an element, or a filter-keyed object" message
 * rather than being reported as a bad bag.
 *
 * @param {unknown} value - The `controls` slot value.
 * @returns {boolean} `true` when the value should be read as a filter-keyed bag.
 */
function isFilterKeyedControls(value) {
    if (typeof value === 'string' || value instanceof HTMLElement) {
        return false;
    }
    try {
        assertPlainOptions(value, 'controls');
    } catch {
        return false;
    }
    return true;
}

/**
 * The input keys a pass actually claims, given the whole set of filters in the
 * bag.
 *
 * The single exemption mirrors `ApiOptions`' `#pathBuilderEnabled`: when a
 * `PATH_BUILDER` pass is present it mounts the year input, and the
 * `ALL_CALENDARS` pass then skips it — so the two do not really collide, and
 * `{ pathBuilder, allCalendars }` stays a legal, useful pairing rather than a
 * spurious error. `NONE` never reaches here; it is rejected as a key.
 *
 * @param {string} filter - The pass' filter.
 * @param {Array<string>} allFilters - Every filter named in the bag.
 * @returns {Array<string>} The input keys this pass claims.
 */
function claimedInputs(filter, allFilters) {
    const keys = [...inputKeysForFilter(filter)];
    if (
        ApiOptionsFilter.ALL_CALENDARS === filter &&
        allFilters.includes(ApiOptionsFilter.PATH_BUILDER)
    ) {
        return keys.filter((key) => 'yearInput' !== key);
    }
    return keys;
}

/**
 * Validates a filter-keyed `controls` bag and returns its passes in the order
 * they must run.
 *
 * Everything is checked BEFORE the caller resolves a single element, so a bag
 * naming one good container and one bad one never half-mounts — the same rule
 * `CalendarViewer.appendTo()` already applies to its `calendar` slot.
 *
 * @param {object} value - The filter-keyed `controls` bag.
 * @param {string} caller - The `Class.method` prefix to report under.
 * @returns {{passes: Array<{key: string, filter: string, target: (string|HTMLElement)}>, selectsTarget: (string|HTMLElement)}}
 *   The passes in canonical order, and the target the rite and calendar
 *   selects mount into — the FIRST key in the caller's own insertion order,
 *   which is what the two-pass idiom produced and what a caller listing
 *   containers in page order means.
 * @throws {Error} If the bag is empty, names an unknown key, names `none`,
 *   names one filter twice, or names two filters that share an input.
 */
function resolveControlSlots(value, caller) {
    const keys = Object.keys(value);
    if (0 === keys.length) {
        throw new Error(
            `${caller}: the controls slot object must name at least one filter. Valid keys are: ${CANONICAL_KEYS.join(', ')}.`,
        );
    }

    // Every key is checked before any value is read, so a bag naming one good
    // key and one bad key never applies partially — the rule
    // `InputVisibility.js` and `CalendarViewer.#applyWebCalendarBag()` already
    // state for their own bags.
    const keyByFilter = new Map();
    for (const key of keys) {
        if ('none' === key) {
            throw new Error(
                `${caller}: the controls slot object cannot name 'none'. ApiOptionsFilter.NONE renders every input, so it cannot be one of several passes, and ApiOptions.filter() refuses to mix it with any other filter.`,
            );
        }
        if (false === Object.hasOwn(FILTER_BY_SLOT_KEY, key)) {
            throw new Error(
                `${caller}: '${key}' is not a recognised ApiOptions filter key in the controls slot. Valid keys are: ${CANONICAL_KEYS.join(', ')} (basePath and allPaths are accepted as aliases of generalRoman and allCalendars).`,
            );
        }
        const filter = FILTER_BY_SLOT_KEY[key];
        if (keyByFilter.has(filter)) {
            throw new Error(
                `${caller}: the controls slot object names the same filter twice, as '${keyByFilter.get(filter)}' and '${key}'.`,
            );
        }
        keyByFilter.set(filter, key);
    }

    // Overlap is computed from the inputs each filter RENDERS, not from the key
    // names: `localeOnly` and `allCalendars` are different keys that both mount
    // the locale input, which a name comparison could never see.
    const allFilters = [...keyByFilter.keys()];
    const claims = new Map(
        allFilters.map((filter) => [filter, claimedInputs(filter, allFilters)]),
    );
    for (let i = 0; i < allFilters.length; i++) {
        for (let j = i + 1; j < allFilters.length; j++) {
            const first = allFilters[i];
            const second = allFilters[j];
            const shared = claims
                .get(first)
                .filter((key) => claims.get(second).includes(key));
            if (shared.length > 0) {
                throw new Error(
                    `${caller}: the controls slot keys '${keyByFilter.get(first)}' and '${keyByFilter.get(second)}' both render ${shared.join(', ')}. Two filters that share an input would move it to whichever container mounted last; name each input under exactly one filter.`,
                );
            }
        }
    }

    const passes = PASS_ORDER.filter((filter) => keyByFilter.has(filter)).map(
        (filter) => ({
            key: keyByFilter.get(filter),
            filter,
            target: value[keyByFilter.get(filter)],
        }),
    );
    return { passes, selectsTarget: value[keys[0]] };
}

export { isFilterKeyedControls, resolveControlSlots, FILTER_BY_SLOT_KEY };
