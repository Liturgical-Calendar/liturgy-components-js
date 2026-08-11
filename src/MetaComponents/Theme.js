/**
 * Resolves a meta-component's theme bag into per-child styling values.
 *
 * Deliberately NOT exported from `src/index.js`, on the same reasoning as
 * `LocaleValidation.js` and `OptionsValidation.js`: internal contract between
 * components, not public API.
 *
 * The bag's vocabulary is HTML roles — `select`, `input`, `label`, `wrapper` —
 * never framework names, so a Tailwind or vanilla consumer is not writing
 * Bootstrap-shaped keys. Per-child keys are named for the meta-component's public
 * getters, so the override key and the escape hatch are the same word.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import { assertPlainOptions, describeType } from '../OptionsValidation.js';

/**
 * The flat theme key that supplies a child's `class`, by the child's role.
 * A `select` child takes its class from `theme.select`, a text or number input
 * from `theme.input` — the two are separated because a consumer styling
 * Bootstrap needs `form-select` on one and `form-control` on the other.
 *
 * @type {Readonly<Object<string, string>>}
 */
const CLASS_KEY_BY_ROLE = Object.freeze({
    select: 'select',
    input: 'input',
});

/**
 * The reserved flat role keys. Any other key in the bag is read as a per-child
 * override, which is what keeps the bag open to children added later without
 * this module needing to know their names.
 *
 * @type {Readonly<string[]>}
 */
const FLAT_KEYS = Object.freeze(['select', 'input', 'label', 'wrapper']);

/**
 * Validates a theme bag's shape, throwing with the component's name and the type
 * actually found.
 *
 * Shape only. Class strings are never inspected: this module takes no position on
 * what a valid class name is, which is the whole point of the role vocabulary.
 *
 * @param {unknown} theme - The candidate theme bag.
 * @param {string} componentName - The rejecting component's class name.
 * @returns {void}
 * @throws {Error} If the bag or any per-child override has the wrong shape.
 */
export function assertTheme(theme, componentName) {
    if (null === theme || undefined === theme) {
        return;
    }
    assertPlainOptions(theme, `${componentName}: theme`);
    for (const key of Object.keys(theme)) {
        const value = theme[key];
        if (FLAT_KEYS.includes(key)) {
            if (typeof value !== 'string') {
                throw new Error(
                    `${componentName}: theme.${key} must be of type \`string\` but found type: ${describeType(value)}`,
                );
            }
            continue;
        }
        if (typeof value === 'string') {
            continue;
        }
        try {
            assertPlainOptions(value, `${componentName}: theme.${key}`);
        } catch {
            throw new Error(
                `${componentName}: theme.${key} must be a class string or an object but found type: ${describeType(value)}`,
            );
        }
    }
}

/**
 * Resolves the styling for one child of a meta-component.
 *
 * Resolution is per-key and most-specific-first: a per-child override supplies
 * whichever keys it names, and every key it does not name falls back to the flat
 * role default. A per-child override therefore adjusts a child rather than
 * replacing its styling wholesale, which is what makes
 * `{ select: 'form-select', riteSelect: { class: 'form-select mb-2' } }` leave the
 * shared label class in place.
 *
 * Unset keys are OMITTED rather than set to `undefined`, so a caller can use
 * `Object.hasOwn()` to distinguish "not themed" from "themed as empty" and avoid
 * calling a component's setter with an empty string.
 *
 * @param {Object|null|undefined} theme - The meta-component's theme bag.
 * @param {string} childKey - The child's public getter name, e.g. `riteSelect`.
 * @param {'select'|'input'} [role='select'] - Which flat key supplies `class`.
 * @returns {{class?: string, labelClass?: string, wrapperClass?: string, wrapper?: string}} The resolved styling.
 */
export function resolveChildTheme(theme, childKey, role = 'select') {
    if (null === theme || undefined === theme) {
        return {};
    }

    const resolved = {};
    const classKey = CLASS_KEY_BY_ROLE[role] ?? 'select';
    if (typeof theme[classKey] === 'string') {
        resolved.class = theme[classKey];
    }
    if (typeof theme.label === 'string') {
        resolved.labelClass = theme.label;
    }
    if (typeof theme.wrapper === 'string') {
        resolved.wrapperClass = theme.wrapper;
    }

    let override = theme[childKey];
    if (typeof override === 'string') {
        override = { class: override };
    }
    if (null === override || typeof override !== 'object') {
        return resolved;
    }
    for (const key of ['class', 'labelClass', 'wrapperClass', 'wrapper']) {
        if (Object.hasOwn(override, key)) {
            resolved[key] = override[key];
        }
    }
    return resolved;
}
