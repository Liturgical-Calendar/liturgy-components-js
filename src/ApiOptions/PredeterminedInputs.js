/**
 * Which `ApiOptions` inputs the current rite and calendar selection predetermine.
 *
 * Deliberately NOT exported from `src/index.js`, on the same reasoning as
 * `FilterInputs.js`, `Theme.js`, `InputVisibility.js` and `LocaleValidation.js`:
 * internal contract between the components, not public API.
 *
 * **Why this is a module rather than five lines inside `#applyTemporalInputState()`.**
 * It was the latter. Issue #68 needed the same knowledge a second time — every
 * consumer was re-deriving "is this input effectively read-only" from a raw
 * `change` event plus a `value === ''` test, which is both the library's own
 * domain knowledge and, under the Ambrosian rite, wrong: four inputs are
 * predetermined there with no calendar selected at all.
 * `#applyTemporalInputState()` now applies what this returns and
 * `ApiOptions._predeterminedInputs` reports it, so the disabling half and the
 * reporting half cannot drift. The same one-source-two-readers shape
 * `FilterInputs.js` gave the filter -> inputs mapping in issue #63.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

/**
 * The four inputs a rite can fix for itself, in canonical order.
 *
 * The Ambrosian Missal fixes Epiphany to 6 January, Ascension to the fortieth
 * day of Easter and Corpus Domini to the Thursday after Trinity, and does not
 * establish the Eternal High Priest at all. A selected nation or diocese fixes
 * the same four through its own published settings.
 *
 * @type {Readonly<string[]>}
 */
const RITE_FIXABLE_INPUTS = Object.freeze([
    'epiphanyInput',
    'ascensionInput',
    'corpusChristiInput',
    'eternalHighPriestInput',
]);

/**
 * The one input that follows the calendar selection alone.
 *
 * Holy days of obligation are not fixed by any rite — they are an option LIST a
 * rite may replace, which is a different thing from a value it fixes — so this
 * follows the calendar half of the rule by itself.
 *
 * @type {string}
 */
const CALENDAR_ONLY_INPUT = 'holydaysOfObligationInput';

/**
 * Every input this module can name, in canonical order.
 *
 * The same five `ApiOptionsFilter.GENERAL_ROMAN` renders, and for the same
 * reason — `FilterInputs.js` describes them as "the five parameters a national
 * or diocesan calendar predetermines". The two lists are stated independently
 * because they answer different questions, and
 * `src/__tests__/PredeterminedInputs.test.js` asserts they agree, so a filter
 * that gained a sixth input would fail there rather than silently join this set.
 *
 * @type {Readonly<string[]>}
 */
const PREDETERMINABLE_INPUTS = Object.freeze([
    ...RITE_FIXABLE_INPUTS,
    CALENDAR_ONLY_INPUT,
]);

/**
 * The inputs whose values the current rite and calendar selection fix.
 *
 * The two halves are independent and either alone is enough for the four
 * temporal inputs: implementing only the calendar half is what let a user return
 * to the rite-level empty option under Ambrosian and re-enable them, making
 * `/calendar/ambrosian?ascension=SUNDAY` reachable — a request that moves a
 * feast the Missal fixes.
 *
 * @param {Object} state - The state the rule reads.
 * @param {boolean} state.calendarSelected - Whether a nation or diocese is selected.
 * @param {boolean} state.riteFixesTemporalOptions - Whether the current rite fixes them.
 * @returns {Readonly<string[]>} The predetermined input keys, in canonical order.
 */
function predeterminedInputKeys({
    calendarSelected,
    riteFixesTemporalOptions,
}) {
    const keys = [];
    if (calendarSelected || riteFixesTemporalOptions) {
        keys.push(...RITE_FIXABLE_INPUTS);
    }
    if (calendarSelected) {
        keys.push(CALENDAR_ONLY_INPUT);
    }
    return Object.freeze(keys);
}

export { predeterminedInputKeys, PREDETERMINABLE_INPUTS };
