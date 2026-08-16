/**
 * Resolves a meta-component's `inputs` bag into per-input visibility flags.
 *
 * Deliberately NOT exported from `src/index.js`, on the same reasoning as
 * `Theme.js`, `LocaleValidation.js` and `OptionsValidation.js`: internal contract
 * between the components, not public API.
 *
 * **Why the bag exists at all.** `AcceptHeaderInput.hide()` sets a flag that
 * `ApiOptions.appendTo()` reads, so it is only meaningful in the window between
 * construction and the append — a window `mountInto()` does not open. A single
 * boolean toggle therefore cost a caller the entire factory path, and with it
 * `settled`, the one signal that path publishes (#61). Naming it in the options
 * bag moves the decision to where both construction paths can honour it.
 *
 * **Why a namespaced bag rather than a flat `acceptHeader` option.** The
 * meta-components' top-level bag already carries `locale`, `filter`, `theme`,
 * `apiClient`, `signal`, `onError` and `initialFetch`; a bare `acceptHeader:
 * false` beside those reads as a request payload value as easily as a visibility
 * toggle. `CalendarViewer`'s own `webCalendar` bag is the precedent: a namespaced
 * bag of child configuration whose unknown keys are rejected by name.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import { assertPlainOptions, describeType } from '../OptionsValidation.js';

/**
 * The keys an `inputs` bag may name.
 *
 * Only inputs whose visibility a meta-component can actually act on belong here.
 * `acceptHeader` has a fixed default (`true`, applied via `AcceptHeaderInput.hide()`
 * at construction). `riteSelect`, `calendarSelect` and `localeInput` are different:
 * they are the three controls a calendar `scope` can hide, and their visibility is
 * otherwise RUNTIME-derived by `CalendarScope.js`'s `deriveVisibility()` — so these
 * three carry no default here, and are absent from {@link DEFAULTS} deliberately.
 * A caller who names one is overriding the derived value for that key; a caller who
 * doesn't leaves the derivation alone.
 *
 * @type {Readonly<string[]>}
 */
const INPUT_KEYS = Object.freeze([
    'acceptHeader',
    'riteSelect',
    'calendarSelect',
    'localeInput',
]);

/**
 * `acceptHeader` renders unless the bag says otherwise, so an absent bag is
 * exactly today's behaviour. `riteSelect`, `calendarSelect` and `localeInput`
 * have no entry here — see {@link INPUT_KEYS} — so they are simply absent from
 * the resolved bag until a caller names one, which is what lets
 * `deriveVisibility()` tell "not overridden" from "overridden to true".
 *
 * @type {Readonly<Object<string, boolean>>}
 */
const DEFAULTS = Object.freeze({ acceptHeader: true });

/**
 * Validates an `inputs` bag and resolves it against the defaults.
 *
 * Every key is checked against {@link INPUT_KEYS} BEFORE any value is read, so a
 * bag naming one good key and one bad key never applies partially — it always
 * throws with nothing changed. This mirrors `CalendarViewer.#applyWebCalendarBag()`,
 * and so does the treatment of a key present with an explicit `undefined` value:
 * it counts as absent rather than as an instruction.
 *
 * @param {unknown} inputs - The candidate `inputs` bag, or `null`/`undefined`.
 * @param {string} componentName - The rejecting component's class name.
 * @returns {{acceptHeader: boolean, riteSelect?: boolean, calendarSelect?: boolean, localeInput?: boolean}} The resolved visibility flags.
 * @throws {Error} If the bag is not a plain object, names an unknown key, or
 *   carries a non-boolean value.
 */
export function resolveInputVisibility(inputs, componentName) {
    if (null === inputs || undefined === inputs) {
        return { ...DEFAULTS };
    }
    try {
        assertPlainOptions(inputs, `${componentName}: inputs`);
    } catch {
        throw new Error(
            `${componentName}: inputs must be an object naming { acceptHeader, riteSelect, calendarSelect, localeInput }, but found type: ${describeType(inputs)}`,
        );
    }
    for (const key of Object.keys(inputs)) {
        if (false === INPUT_KEYS.includes(key)) {
            throw new Error(
                `${componentName}: unknown inputs option \`${key}\``,
            );
        }
    }
    const resolved = { ...DEFAULTS };
    for (const key of INPUT_KEYS) {
        if (false === Object.hasOwn(inputs, key) || undefined === inputs[key]) {
            continue;
        }
        if (typeof inputs[key] !== 'boolean') {
            throw new Error(
                `${componentName}: inputs.${key} must be of type \`boolean\` but found type: ${describeType(inputs[key])}`,
            );
        }
        resolved[key] = inputs[key];
    }
    return resolved;
}
