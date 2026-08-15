/**
 * Which `ApiOptions` inputs each `ApiOptionsFilter` renders, and in what order.
 *
 * Deliberately NOT exported from `src/index.js`, on the same reasoning as
 * `Theme.js`, `InputVisibility.js`, `LocaleValidation.js` and
 * `OptionsValidation.js`: internal contract between the components, not public
 * API.
 *
 * **Why this is a module rather than five `if` branches.** It used to be the
 * latter, inside `ApiOptions.appendTo()`. Issue #63 needed the same knowledge a
 * second time — a filter-keyed `controls` slot cannot tell whether two of its
 * keys would fight over an input without it — and a second copy is a mapping
 * free to drift the first time a filter gains an input. `appendTo()` now reads
 * this table too, so there is one copy and both consumers read it.
 *
 * **What is deliberately NOT here.** Two of `appendTo()`'s decisions are
 * runtime state, not properties of a filter, and stay where they are:
 * `acceptHeaderInput` is skipped once `AcceptHeaderInput.hide()` has been
 * called, and `yearInput` is skipped under `ALL_CALENDARS`/`NONE` once a
 * `PATH_BUILDER` pass has already claimed it (`#pathBuilderEnabled`).
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import { ApiOptionsFilter } from '../Enums.js';

/**
 * The inputs `ALL_CALENDARS` renders, in append order. Named because `NONE`
 * renders these followed by the General Roman five.
 *
 * @type {Readonly<string[]>}
 */
const ALL_CALENDARS_INPUTS = Object.freeze([
    'localeInput',
    'yearTypeInput',
    'acceptHeaderInput',
    'yearInput',
]);

/**
 * The five parameters a national or diocesan calendar predetermines, in append
 * order. Named for the same reason as {@link ALL_CALENDARS_INPUTS}.
 *
 * @type {Readonly<string[]>}
 */
const GENERAL_ROMAN_INPUTS = Object.freeze([
    'epiphanyInput',
    'ascensionInput',
    'corpusChristiInput',
    'eternalHighPriestInput',
    'holydaysOfObligationInput',
]);

/**
 * A `Map` rather than an object literal because `ApiOptionsFilter.NONE` is
 * `null`, which an object literal would coerce to the string `'null'` and so
 * fail to distinguish from a filter actually named that.
 *
 * `GENERAL_ROMAN`/`BASE_PATH` and `ALL_CALENDARS`/`ALL_PATHS` are alias pairs
 * sharing one value each, so there are six entries for eight enum members.
 *
 * @type {ReadonlyMap<string|null, Readonly<string[]>>}
 */
const INPUT_KEYS_BY_FILTER = new Map([
    [
        ApiOptionsFilter.PATH_BUILDER,
        Object.freeze(['calendarPathInput', 'yearInput']),
    ],
    [ApiOptionsFilter.LOCALE_ONLY, Object.freeze(['localeInput'])],
    [ApiOptionsFilter.YEAR_ONLY, Object.freeze(['yearInput'])],
    [ApiOptionsFilter.ALL_CALENDARS, ALL_CALENDARS_INPUTS],
    [ApiOptionsFilter.GENERAL_ROMAN, GENERAL_ROMAN_INPUTS],
    [
        ApiOptionsFilter.NONE,
        Object.freeze([...ALL_CALENDARS_INPUTS, ...GENERAL_ROMAN_INPUTS]),
    ],
]);

/**
 * The `ApiOptions` input keys a filter renders, in append order.
 *
 * @param {string|null} filter - An `ApiOptionsFilter` value.
 * @returns {Readonly<string[]>} The input keys, in append order.
 * @throws {Error} If the filter is not an `ApiOptionsFilter` value.
 */
function inputKeysForFilter(filter) {
    const keys = INPUT_KEYS_BY_FILTER.get(filter);
    if (undefined === keys) {
        throw new Error(
            `inputKeysForFilter: unrecognised ApiOptions filter: ${String(filter)}`,
        );
    }
    return keys;
}

export { INPUT_KEYS_BY_FILTER, inputKeysForFilter };
