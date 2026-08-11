/**
 * Resolves a meta-component's theme bag into per-child styling values.
 *
 * Deliberately NOT exported from `src/index.js`, on the same reasoning as
 * `LocaleValidation.js` and `OptionsValidation.js`: internal contract between
 * components, not public API.
 *
 * The bag's vocabulary is HTML roles — `select`, `input`, `label`, `wrapper` —
 * never framework names, so a Bootstrap or vanilla consumer is not writing
 * framework-named keys. Per-child keys are named for the meta-component's public
 * getters, so the override key and the escape hatch are the same word.
 *
 * **What a class-string VALUE may contain, regardless of key:** every value here
 * ultimately reaches `Utils.validateClassName()` (or `LiturgyOfAnyDay`'s private
 * copy of the same pattern), which accepts only
 * `/^(?!\d|--|-?\d)[a-zA-Z_-][a-zA-Z\d_-]{1,}$/` per space-separated class — letters,
 * digits, underscores and hyphens, and nothing else. Tailwind's variant prefixes
 * (`md:flex`, `hover:bg-blue-500`) and fractional utilities (`w-1/2`) both contain a
 * character (`:` or `/`) outside that set and are therefore rejected outright, not
 * merely left unstyled. This module takes no position on what a valid class name is
 * and does not enforce this itself — it is a pre-existing constraint shared with
 * every other class-taking component in this library, named here so a theme author
 * learns it before writing a bag that depends on it.
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
 * calling a component's setter with an empty string. A per-child override key
 * explicitly set to `undefined` (`{ riteSelect: { class: undefined } }`, the shape
 * that results from spreading a config object whose own key is absent) is treated
 * as not naming that key at all: it falls back to the flat default exactly as an
 * omitted key would, rather than being copied through and overwriting it with
 * `undefined`.
 *
 * @param {Object|null|undefined} theme - The meta-component's theme bag.
 * @param {string} childKey - The child's public getter name, e.g. `riteSelect`.
 * @param {'select'|'input'} [role='select'] - Which flat key supplies `class`.
 * @returns {{class?: string, labelClass?: string, labelText?: string, wrapperClass?: string, wrapper?: string}} The resolved styling.
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
    for (const key of [
        'class',
        'labelClass',
        'labelText',
        'wrapperClass',
        'wrapper',
    ]) {
        // `override[key] !== undefined` is load-bearing, not redundant with
        // `Object.hasOwn`: a key explicitly present with value `undefined` must
        // fall back to the flat default below rather than overwrite it with
        // `undefined` — see the "explicitly-undefined" paragraph above.
        if (Object.hasOwn(override, key) && override[key] !== undefined) {
            resolved[key] = override[key];
        }
    }
    return resolved;
}
