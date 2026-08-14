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
 * ultimately reaches `Utils.validateClassName()`, which accepts any non-empty
 * space-separated token that carries no whitespace, quote character, backtick or
 * `<`. Utility-framework classes are therefore usable as they are written —
 * `md:w-1/2`, `hover:bg-blue-500`, `2xl:flex`, `p-1.5`, `bg-[#1da1f2]`,
 * `w-[calc(100%-2rem)]` and `[&>*]:mt-2` all pass.
 *
 * That was not always true. The validator previously demanded a CSS *identifier*
 * (`/^(?!\d|--|-?\d)[a-zA-Z_-][a-zA-Z\d_-]{1,}$/`), which a `class` attribute token
 * is not, so every one of the examples above THREW rather than merely failing to
 * style anything — a Tailwind consumer could not use these components at all. This
 * module still takes no position on what a valid class name is and does not enforce
 * anything itself; the rule lives in `Utils`, shared with every class-taking
 * component in this library.
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
 * The keys a per-child override may carry, BY ROLE, and which
 * {@link resolveChildTheme} copies through. Every one is handed to a child's
 * setter as a string, so every one must be a string here.
 *
 * Keyed by role rather than held as one flat list because the children are not
 * alike. A `select`- or `input`-shaped child takes a class, a label and a wrapper;
 * `LiturgyOfAnyDay` takes eight further class setters that mean nothing to a
 * `<select>`. Issue #43: the list used to be flat and select-shaped, so
 * `DayViewer`'s constructor — which names all eight `liturgy` keys and calls the
 * matching setter for each — could never receive them. That loop was unreachable,
 * and a consumer theming the event rows or the date header got library defaults
 * with no throw and no warning.
 *
 * @type {Readonly<Object<string, Readonly<string[]>>>}
 */
const OVERRIDE_KEYS_BY_ROLE = Object.freeze({
    select: Object.freeze([
        'class',
        'labelClass',
        'labelText',
        'wrapperClass',
        'wrapper',
    ]),
    input: Object.freeze([
        'class',
        'labelClass',
        'labelText',
        'wrapperClass',
        'wrapper',
    ]),
    liturgy: Object.freeze([
        'class',
        'titleClass',
        'dateClass',
        'dateControlsClass',
        'eventsWrapperClass',
        'eventClass',
        'eventGradeClass',
        'eventCommonClass',
        'eventYearCycleClass',
    ]),
});

/**
 * The reserved top-level key naming the `ApiOptions` bundle (issue #60).
 *
 * Unlike every other non-flat key, this one is not a per-child override but a
 * NESTED bag: flat role keys for the whole bundle, plus per-input overrides. It
 * is reserved rather than open precisely so a bag naming it gets the nested
 * validation below instead of being read as a per-child override.
 *
 * @type {string}
 */
export const API_OPTIONS_KEY = 'apiOptions';

/**
 * The ten `ApiOptions` inputs a theme may name, and the ROLE each one takes its
 * `class` from — nine `<select>`s and one `input[type="number"]`.
 *
 * The names are `ApiOptions`' own public accessors with the leading underscore
 * stripped, which is also exactly how `localeInput` was named when it became a
 * top-level key in 2.7.0, and exactly the keys of `ApiOptions`' private
 * `#inputs` bag. That is what makes `apiOptions[ '_' + key ]` in
 * {@link applyApiOptionsTheme} a lookup rather than a translation table.
 *
 * The shorter spellings the issue that asked for this suggested (`epiphany`,
 * `holydaysOfObligation`) were declined: they would have made the already-shipped
 * `localeInput` the odd one out, and they collide with the API query parameters
 * of the same name (`epiphany=JAN6`), which are a different thing entirely. Only
 * one spelling is accepted for each input — an alias would defeat the typo check.
 *
 * All ten exist on every `ApiOptions` regardless of its `filter`; the filter
 * decides only which of them are ever appended. Theming one that the current
 * filter does not render is therefore inert, never an error.
 *
 * @type {Readonly<Object<string, 'select'|'input'>>}
 */
export const API_OPTIONS_INPUT_ROLES = Object.freeze({
    epiphanyInput: 'select',
    ascensionInput: 'select',
    corpusChristiInput: 'select',
    eternalHighPriestInput: 'select',
    holydaysOfObligationInput: 'select',
    localeInput: 'select',
    yearTypeInput: 'select',
    yearInput: 'input',
    acceptHeaderInput: 'select',
    calendarPathInput: 'select',
});

/**
 * The input names {@link API_OPTIONS_INPUT_ROLES} covers, in one list.
 *
 * @type {Readonly<string[]>}
 */
export const API_OPTIONS_INPUT_KEYS = Object.freeze(
    Object.keys(API_OPTIONS_INPUT_ROLES),
);

/**
 * The `ApiOptions` inputs that ALSO answer to a top-level per-child key.
 *
 * `localeInput` alone, and only because 2.7.0 shipped `theme.localeInput` as
 * public API before this bundle existed. It is a resolution TIER, not a second
 * path: see {@link resolveApiOptionsInputTheme}.
 *
 * @type {Readonly<string[]>}
 */
const LEGACY_TOP_LEVEL_INPUT_KEYS = Object.freeze(['localeInput']);

/**
 * Every key any role accepts, for {@link assertTheme}'s typo check.
 *
 * A key legitimate for one role but named on a child of another role still passes
 * this check and is then dropped by {@link resolveChildTheme} — `assertTheme()`
 * validates a bag without knowing which children a given meta-component has, so it
 * can catch a misspelling but not a misplacement. The narrower per-role lists above
 * are what decide what actually reaches a setter.
 *
 * @type {Readonly<string[]>}
 */
const ALL_OVERRIDE_KEYS = Object.freeze([
    ...new Set(Object.values(OVERRIDE_KEYS_BY_ROLE).flat()),
]);

/**
 * Validates a theme bag's shape, throwing with the component's name and the type
 * actually found.
 *
 * Checks shape and value TYPES, both at the top level and inside a per-child
 * override — so `{ calendarSelect: { class: 42 } }` is rejected here, under the
 * meta-component's name, rather than later under the child's.
 *
 * It does not inspect class-string CONTENT: this module takes no position on what a
 * valid class name is (that lives in `Utils.validateClassName()`), which is the
 * whole point of the role vocabulary.
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
        if (API_OPTIONS_KEY === key) {
            assertApiOptionsTheme(value, componentName);
            continue;
        }
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
        // The override's own VALUES are checked here too, not only its shape.
        // Without this, `{ calendarSelect: { class: 42 } }` passed this guard and
        // failed later inside `CalendarSelect.class()` — reporting the caller's
        // mistake under the CHILD's name, which is precisely the misattribution the
        // meta-components validate locales and filters here to avoid. An explicit
        // `undefined` is allowed: `resolveChildTheme()` treats it as absent and
        // falls back to the flat default.
        for (const overrideKey of Object.keys(value)) {
            // An unrecognised key is rejected rather than dropped in silence.
            // Issue #43 was invisible for exactly that reason: eight keys were
            // accepted by this guard, discarded by `resolveChildTheme()`, and the
            // markup simply rendered with library defaults — no throw, no warning,
            // and the reporter only noticed because an end-to-end selector broke.
            if (false === ALL_OVERRIDE_KEYS.includes(overrideKey)) {
                throw new Error(
                    `${componentName}: theme.${key}.${overrideKey} is not a recognised per-child theme key. Valid keys are: ${ALL_OVERRIDE_KEYS.join(', ')}.`,
                );
            }
            const overrideValue = value[overrideKey];
            if (
                undefined !== overrideValue &&
                typeof overrideValue !== 'string'
            ) {
                throw new Error(
                    `${componentName}: theme.${key}.${overrideKey} must be of type \`string\` but found type: ${describeType(overrideValue)}`,
                );
            }
        }
    }
}

/**
 * Validates the nested `theme.apiOptions` bag (issue #60).
 *
 * Split out of {@link assertTheme} rather than inlined because this is a THIRD
 * kind of top-level value — neither a flat class string nor a per-child override
 * — and it is one level deeper than anything that guard had validated before.
 * The typo-catching property has to survive that extra depth: an unrecognised
 * key here is rejected by name, exactly as an unrecognised per-child key is, and
 * for the reason issue #43 recorded at length above. A key silently dropped at
 * depth two is no more findable than one dropped at depth one.
 *
 * A bare class string is REJECTED here, unlike a per-child override, which reads
 * one as `{ class }`. `apiOptions` covers nine `<select>`s and one number input,
 * so a lone string would have to guess which of the `select` and `input` roles
 * the caller meant; the message names the object form instead of guessing.
 *
 * The per-input check is STRICTER than {@link assertTheme}'s two-level one,
 * which accepts any key any role uses because it cannot know the child's role.
 * Here the role is known from {@link API_OPTIONS_INPUT_ROLES}, so a `liturgy`-role
 * key such as `titleClass` is caught rather than accepted-and-dropped.
 *
 * @param {unknown} bundle - The candidate `theme.apiOptions` value.
 * @param {string} componentName - The rejecting component's class name.
 * @returns {void}
 * @throws {Error} If the bundle or any of its entries has the wrong shape.
 */
function assertApiOptionsTheme(bundle, componentName) {
    const validKeys = [...FLAT_KEYS, ...API_OPTIONS_INPUT_KEYS].join(', ');
    try {
        assertPlainOptions(
            bundle,
            `${componentName}: theme.${API_OPTIONS_KEY}`,
        );
    } catch {
        throw new Error(
            `${componentName}: theme.${API_OPTIONS_KEY} must be an object of flat role keys and per-input overrides but found type: ${describeType(bundle)}. Valid keys are: ${validKeys}.`,
        );
    }
    for (const key of Object.keys(bundle)) {
        const value = bundle[key];
        if (FLAT_KEYS.includes(key)) {
            if (typeof value !== 'string') {
                throw new Error(
                    `${componentName}: theme.${API_OPTIONS_KEY}.${key} must be of type \`string\` but found type: ${describeType(value)}`,
                );
            }
            continue;
        }
        if (false === API_OPTIONS_INPUT_KEYS.includes(key)) {
            throw new Error(
                `${componentName}: theme.${API_OPTIONS_KEY}.${key} is not a recognised ApiOptions theme key. Valid keys are: ${validKeys}.`,
            );
        }
        if (typeof value === 'string') {
            continue;
        }
        try {
            assertPlainOptions(
                value,
                `${componentName}: theme.${API_OPTIONS_KEY}.${key}`,
            );
        } catch {
            throw new Error(
                `${componentName}: theme.${API_OPTIONS_KEY}.${key} must be a class string or an object but found type: ${describeType(value)}`,
            );
        }
        const roleKeys = OVERRIDE_KEYS_BY_ROLE[API_OPTIONS_INPUT_ROLES[key]];
        for (const overrideKey of Object.keys(value)) {
            if (false === roleKeys.includes(overrideKey)) {
                throw new Error(
                    `${componentName}: theme.${API_OPTIONS_KEY}.${key}.${overrideKey} is not a recognised per-input theme key. Valid keys are: ${roleKeys.join(', ')}.`,
                );
            }
            const overrideValue = value[overrideKey];
            if (
                undefined !== overrideValue &&
                typeof overrideValue !== 'string'
            ) {
                throw new Error(
                    `${componentName}: theme.${API_OPTIONS_KEY}.${key}.${overrideKey} must be of type \`string\` but found type: ${describeType(overrideValue)}`,
                );
            }
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
    const resolved = collectFlatDefaults(theme, role);
    collectOverride(resolved, theme[childKey], role);
    return resolved;
}

/**
 * Reads a bag's FLAT role keys into a fresh resolved-theme object.
 *
 * Extracted from {@link resolveChildTheme} so that
 * {@link resolveApiOptionsInputTheme} can apply the same reading to two bags —
 * the outer theme and the nested `apiOptions` bundle — instead of restating the
 * `select`/`input`/`label`/`wrapper` mapping a second time and letting the two
 * copies drift.
 *
 * @param {Object} bag - A theme bag, or the nested `apiOptions` bundle.
 * @param {string} role - Which flat key supplies `class`.
 * @returns {{class?: string, labelClass?: string, wrapperClass?: string}} The flat defaults.
 */
function collectFlatDefaults(bag, role) {
    const resolved = {};
    const classKey = CLASS_KEY_BY_ROLE[role] ?? 'select';
    if (typeof bag[classKey] === 'string') {
        resolved.class = bag[classKey];
    }
    if (typeof bag.label === 'string') {
        resolved.labelClass = bag.label;
    }
    if (typeof bag.wrapper === 'string') {
        resolved.wrapperClass = bag.wrapper;
    }
    return resolved;
}

/**
 * Layers one per-child (or per-input) override onto an already-resolved theme.
 *
 * Mutates `resolved` rather than returning a copy, because the caller applies
 * several layers in order of increasing specificity and each must win over the
 * one before it, per key.
 *
 * @param {Object} resolved - The resolved theme so far; mutated in place.
 * @param {unknown} override - The override value: a class string, an object, or
 *        anything else, which is ignored.
 * @param {string} role - Which key list the override may draw on.
 * @returns {void}
 */
function collectOverride(resolved, override, role) {
    if (typeof override === 'string') {
        override = { class: override };
    }
    if (null === override || typeof override !== 'object') {
        return;
    }
    for (const key of OVERRIDE_KEYS_BY_ROLE[role] ??
        OVERRIDE_KEYS_BY_ROLE.select) {
        // `override[key] !== undefined` is load-bearing, not redundant with
        // `Object.hasOwn`: a key explicitly present with value `undefined` must
        // fall back to the flat default rather than overwrite it with
        // `undefined` — see the "explicitly-undefined" paragraph above.
        if (Object.hasOwn(override, key) && override[key] !== undefined) {
            resolved[key] = override[key];
        }
    }
}

/**
 * Resolves the styling for one of `ApiOptions`' ten inputs (issue #60).
 *
 * **`theme.apiOptions` is an opt-in GATE.** While it is absent, this returns `{}`
 * for nine of the ten inputs, and for `localeInput` returns exactly what 2.7.0
 * returned — so a bag that predates this key styles precisely what it styled
 * before. That is deliberate and not an oversight to tidy away later: letting the
 * outer flat keys reach all ten automatically would restyle every existing
 * consumer's form in a MINOR release, and a flat `theme.wrapper` would silently
 * consume `Input.wrapper()`'s one-shot allowance on ten inputs at construction
 * time, so the consumer's own later `wrapperClass()` calls — the globals-plus-
 * per-input-override pairing every such page is built on — would begin to throw.
 * Opening the gate wider later is backward compatible; closing it again would not
 * be.
 *
 * Naming the key at all opens the gate, `{}` included: an empty bundle is an
 * explicit "yes, style these too, with the defaults I already wrote".
 *
 * Resolution is per key and most specific first, over four tiers:
 *
 * 1. `theme.apiOptions[ inputKey ]` — the per-input override.
 * 2. `theme[ inputKey ]` — the legacy top-level key, `localeInput` only.
 * 3. `theme.apiOptions`' own flat role keys.
 * 4. the outer bag's flat role keys.
 *
 * Tier 2 is what keeps 2.7.0's `theme.localeInput` working unchanged. It is a
 * TIER of one resolution, not a competing path: `theme.localeInput` and
 * `theme.apiOptions.localeInput` merge per key exactly as a flat default and a
 * per-child override already do, with the more specific spelling winning key by
 * key. There is nothing for the two to silently disagree about.
 *
 * @param {Object|null|undefined} theme - The meta-component's theme bag.
 * @param {string} inputKey - One of {@link API_OPTIONS_INPUT_KEYS}.
 * @returns {{class?: string, labelClass?: string, labelText?: string, wrapperClass?: string, wrapper?: string}} The resolved styling.
 */
export function resolveApiOptionsInputTheme(theme, inputKey) {
    if (null === theme || undefined === theme) {
        return {};
    }
    const role = API_OPTIONS_INPUT_ROLES[inputKey] ?? 'select';
    const legacyTopLevel = LEGACY_TOP_LEVEL_INPUT_KEYS.includes(inputKey);
    const bundle = theme[API_OPTIONS_KEY];
    if (null === bundle || typeof bundle !== 'object') {
        return legacyTopLevel ? resolveChildTheme(theme, inputKey, role) : {};
    }
    const resolved = collectFlatDefaults(theme, role);
    Object.assign(resolved, collectFlatDefaults(bundle, role));
    if (legacyTopLevel) {
        collectOverride(resolved, theme[inputKey], role);
    }
    collectOverride(resolved, bundle[inputKey], role);
    return resolved;
}

/**
 * Turns a resolved child theme into the `{ as, class }` bag its wrapper setter
 * takes, or `null` when the theme asks for no wrapper at all.
 *
 * Two keys reach here and they mean different things. A per-child `wrapper`
 * names the wrapper's element TYPE — it is an accepted override key for the
 * `select` and `input` roles, see `OVERRIDE_KEYS_BY_ROLE` above. The FLAT
 * `theme.wrapper` names a CLASS, which `resolveChildTheme()` has already mapped
 * onto `wrapperClass`. **Either one alone is a complete instruction**, which is
 * the whole reason this exists: every meta-component used to gate its wrapper
 * call on `wrapperClass` alone, so a theme naming only the type was accepted by
 * the resolver, carried to the call site, and dropped there in silence — no
 * wrapper, no throw, no warning. Six call sites repeated that same gate, which is
 * exactly how a rule ends up honoured in some of them and not others.
 *
 * `class` is present only when the theme named one, never as `undefined`. Both
 * `CalendarSelect.wrapper()` and `Input.wrapper()` reject a non-string `class`,
 * and `Input.wrapper()` additionally treats a class named in the bag as FINAL,
 * closing `wrapperClass()` afterwards — neither of which a theme that never
 * mentioned a class should provoke.
 *
 * Internal to the meta-components, like the rest of this module. The value it
 * returns is handed straight to `CalendarSelect.wrapper()`,
 * `RiteSelect.wrapper()` or `Input.wrapper()`, which validate it.
 *
 * @param {{wrapper?: string, wrapperClass?: string}} childTheme - A theme already
 *        resolved by `resolveChildTheme()`.
 * @returns {{as: string, class?: string}|null} The bag to pass to the child's
 *          `wrapper()`, or `null` when the theme named neither key.
 */
export function resolveWrapperBag(childTheme) {
    const hasType = Object.hasOwn(childTheme, 'wrapper');
    const hasClass = Object.hasOwn(childTheme, 'wrapperClass');
    if (false === hasType && false === hasClass) {
        return null;
    }
    return {
        as: hasType ? childTheme.wrapper : 'div',
        ...(hasClass ? { class: childTheme.wrapperClass } : {}),
    };
}

/**
 * Applies a resolved theme to an `ApiOptions` locale input — `class`,
 * `labelClass`, its wrapper, and its label text — all in one place, since two
 * meta-components (`DayViewer`, and formerly `SubscriptionBuilder`) needed the
 * identical block and had started to drift the moment the second copy existed.
 *
 * **The label text is set UNCONDITIONALLY, unlike every other key here.**
 * `LocaleInput`'s constructor hardcodes its label to the literal string
 * `'locale'` (`LocaleInput.js:48`), with no i18n of its own — so a caller that
 * themes nothing would otherwise ship that raw, untranslated string to every
 * locale. This is the one key this function cannot leave to "not themed means
 * library default", because the library default is wrong. A theme-supplied
 * `labelText` still wins, since it is read first; `defaultLabelText` is what a
 * caller sees only in its absence.
 *
 * Takes an already-resolved child theme, not the whole bag — call
 * `resolveChildTheme( theme, 'localeInput' )` first, exactly as every other
 * per-child theming block in this module does.
 *
 * @param {Object} localeInput - The `ApiOptions._localeInput` to theme.
 * @param {{class?: string, labelClass?: string, labelText?: string, wrapper?: string, wrapperClass?: string}} childTheme -
 *   The resolved theme, from `resolveChildTheme( theme, 'localeInput' )`.
 * @param {string} defaultLabelText - The localized label to use when the
 *   theme names no `labelText` of its own — a caller's own message-catalogue
 *   lookup, since this module has no locale of its own to translate with.
 * @returns {void}
 */
export function applyLocaleInputTheme(
    localeInput,
    childTheme,
    defaultLabelText,
) {
    if (Object.hasOwn(childTheme, 'class')) {
        localeInput.class(childTheme.class);
    }
    if (Object.hasOwn(childTheme, 'labelClass')) {
        localeInput.labelClass(childTheme.labelClass);
    }
    const wrapper = resolveWrapperBag(childTheme);
    if (null !== wrapper) {
        localeInput.wrapper(wrapper);
    }
    // Set UNCONDITIONALLY: LocaleInput's constructor hardcodes its label to the
    // literal string 'locale' with no i18n of its own, so a caller that themes
    // nothing would otherwise ship that raw string to every locale. A
    // theme-supplied labelText still wins, being read first.
    localeInput._labelElement.textContent = Object.hasOwn(
        childTheme,
        'labelText',
    )
        ? childTheme.labelText
        : defaultLabelText;
}
