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
import { hasThemePreset, expandThemePreset } from './ThemePresets.js';

/**
 * The flat theme key that supplies a child's `class`, by the child's role.
 * A `select` child takes its class from `theme.select`, a text or number input
 * from `theme.input` — the two are separated because a consumer styling
 * Bootstrap needs `form-select` on one and `form-control` on the other.
 *
 * **A role absent from this map takes NO flat class**, and that is now the whole
 * content of the map: {@link collectFlatDefaults} reads it without a fallback.
 * It used to read `CLASS_KEY_BY_ROLE[ role ] ?? 'select'`, so the two roles with no
 * entry — `liturgy`, and the `url` role the subscription control uses — silently
 * inherited `theme.select`. Neither is a `<select>`: a flat `select` therefore put a
 * framework's select styling (in Bootstrap's case a border, padding and a
 * dropdown-arrow background image) onto a `LiturgyOfAnyDay` card and onto a copy
 * `<button>`, which is not what "applied to every `<select>` child" has ever said in
 * the documentation. Issue #67 made the contradiction unignorable, since
 * `theme: 'bootstrap5'` would otherwise be unusable on `DayViewer` and
 * `SubscriptionBuilder`. A per-child `class` is how those two are styled, and was
 * always the intended way.
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
    // The subscription URL control: a `<button>` wrapping a `<code>`, with no label
    // and no wrapper of its own, so `class` is the only key `SubscriptionUrl` reads.
    // Naming the role here is what keeps `collectFlatDefaults()` from handing it a flat
    // `select` class it would then apply to a button — see `CLASS_KEY_BY_ROLE`.
    url: Object.freeze(['class']),
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
 * The names are `ApiOptions`' own canonical public accessors — which is also
 * exactly how `localeInput` was named when it became a top-level key in 2.7.0,
 * and exactly the keys of `ApiOptions`' private `#inputs` bag. That is what makes
 * `apiOptions[ key ]` in {@link applyApiOptionsTheme} a lookup rather than a
 * translation table. This map came first: issue #62 gave the accessors their
 * non-underscore names, and took these ten spellings as the vocabulary rather
 * than minting an eleventh.
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
 * The per-child theme keys `CalendarControls` itself resolves, named once
 * because three components forward their whole bag to it and share this set.
 *
 * `apiOptions` is here even though it is a nested bundle rather than a per-child
 * override: it is still a key the receiving component either has a use for or
 * does not, and a component bundling no `ApiOptions` must reject it.
 * `localeInput` is here for the same reason — it is the one input that also
 * answers to a top-level key (see {@link LEGACY_TOP_LEVEL_INPUT_KEYS}), so it
 * belongs to exactly the components that have an `ApiOptions` for it to reach.
 *
 * @type {Readonly<string[]>}
 */
const CALENDAR_CONTROLS_CHILD_KEYS = Object.freeze([
    'riteSelect',
    'calendarSelect',
    API_OPTIONS_KEY,
    ...LEGACY_TOP_LEVEL_INPUT_KEYS,
]);

/**
 * The theme keys each component actually resolves, by component name (issue #78).
 *
 * This is what makes {@link assertTheme} catch a MISPLACEMENT and not only a
 * misspelling. Before it, any key outside {@link FLAT_KEYS} was read as a
 * per-child override, accepted, and then dropped in silence by
 * {@link resolveChildTheme} when the component had no such child —
 * `theme.apiOptions` on a `CalendarResourcePicker`, `theme.liturgy` on a
 * `CalendarViewer` — which is precisely the issue-#43 failure mode this module's
 * comments are elsewhere emphatic about, arriving by a different route.
 *
 * Every entry is derived by reading that component's own `resolveChildTheme()`
 * and `applyApiOptionsTheme()` calls; nothing here is aspirational. Adding a
 * themed child to a meta-component means adding its key here, or the bag will
 * reject the very key the new child reads.
 *
 * `CalendarViewer` and `ApiExplorer` repeat `CalendarControls`' set rather than
 * extending it: their own children take no theme from this bag —
 * `CalendarViewer`'s `WebCalendar` is configured through the separate
 * `webCalendar` option, and `ApiExplorer`'s `PathBuilder` reads no theme at all.
 *
 * @type {Readonly<Object<string, Readonly<string[]>>>}
 */
export const THEME_CHILD_KEYS = Object.freeze({
    CalendarResourcePicker: Object.freeze(['riteSelect', 'calendarSelect']),
    CalendarControls: CALENDAR_CONTROLS_CHILD_KEYS,
    CalendarViewer: CALENDAR_CONTROLS_CHILD_KEYS,
    ApiExplorer: CALENDAR_CONTROLS_CHILD_KEYS,
    DayViewer: Object.freeze([
        'riteSelect',
        'calendarSelect',
        'liturgy',
        'dateControls',
        API_OPTIONS_KEY,
        ...LEGACY_TOP_LEVEL_INPUT_KEYS,
    ]),
    SubscriptionBuilder: Object.freeze([
        ...CALENDAR_CONTROLS_CHILD_KEYS,
        'subscriptionUrl',
    ]),
});

/**
 * Which components accept each child key, derived from {@link THEME_CHILD_KEYS}.
 *
 * Used only to finish a rejection message with where the key WOULD be valid,
 * which is the difference between "this is wrong" and "you wrote this on the
 * wrong component" — the latter being what issue #78 was actually about.
 * Derived rather than written out, so the two cannot drift.
 *
 * Seeded with `Object.create( null )`, which is not a style preference: the key
 * looked up here is a THEME KEY the caller wrote, and `assertPlainOptions()`
 * accepts a bag carrying an own key of any name. Over an ordinary object literal
 * `{ toString: 'x' }` would find the INHERITED function rather than `undefined`,
 * and the hint would crash with `validOn.join is not a function` — an opaque
 * `TypeError` on the one path whose whole job is a legible message.
 * `OptionsValidation.js`'s own doc comment warns about exactly this.
 *
 * @type {Readonly<Object<string, Readonly<string[]>>>}
 */
const COMPONENTS_BY_CHILD_KEY = Object.freeze(
    Object.entries(THEME_CHILD_KEYS).reduce((map, [component, keys]) => {
        for (const key of keys) {
            map[key] = Object.freeze([...(map[key] ?? []), component]);
        }
        return map;
    }, Object.create(null)),
);

/**
 * The child keys registered for one component, or a throw.
 *
 * The single reader of {@link THEME_CHILD_KEYS}, so the two callers cannot
 * diverge on what an unregistered name means. An unregistered name is a
 * programmer error in THIS library — every call site passes a literal — and it
 * throws rather than falling back to a permissive or an empty set: a silent
 * fallback in `assertTheme()` would restore the very bug issue #78 closes, and
 * one in `narrowTheme()` would strip every child key out of a forwarded bag
 * while leaving every test passing.
 *
 * `Object.hasOwn()` rather than a bare lookup, for the reason
 * {@link COMPONENTS_BY_CHILD_KEY} gives: `THEME_CHILD_KEYS` is an object
 * literal, so `'toString'` would otherwise resolve to an inherited function and
 * fail later as `childKeys is not iterable`.
 *
 * @param {string} componentName - The component whose key set is wanted.
 * @returns {Readonly<string[]>} Its registered child keys.
 * @throws {Error} If no set is registered under that name.
 */
function childKeysFor(componentName) {
    if (false === Object.hasOwn(THEME_CHILD_KEYS, componentName)) {
        throw new Error(
            `Theme: no theme key set is registered for ${componentName}. Add one to THEME_CHILD_KEYS in Theme.js.`,
        );
    }
    return THEME_CHILD_KEYS[componentName];
}

/**
 * Every key any role accepts, for {@link assertTheme}'s typo check.
 *
 * A key legitimate for one ROLE but named on a child of another role still passes
 * this check and is then dropped by {@link resolveChildTheme}: this list is the
 * union across roles, because the two-level check does not know the child's role
 * the way {@link assertApiOptionsTheme}'s per-input check does. The narrower
 * per-role lists above are what decide what actually reaches a setter.
 *
 * That is now the ONLY misplacement this module accepts in silence. Issue #78
 * closed the wider one: which CHILDREN a bag may name is decided per component by
 * {@link THEME_CHILD_KEYS}, so `theme.liturgy` on a `CalendarViewer` throws
 * rather than being accepted and dropped.
 *
 * @type {Readonly<string[]>}
 */
const ALL_OVERRIDE_KEYS = Object.freeze([
    ...new Set(Object.values(OVERRIDE_KEYS_BY_ROLE).flat()),
]);

/**
 * Expands a theme bag's preset, if it names one, before anything else reads it (#67).
 *
 * Applied at every entry point in this module that receives a RAW bag — the two
 * component-aware guards and the two resolvers — rather than at the six components'
 * call sites. Two things follow, and both are the point:
 *
 * 1. **No meta-component changes.** A component keeps its `theme` local exactly as the
 *    caller wrote it, string or bag, and every `Theme.js` call it makes expands for
 *    itself.
 * 2. **An unknown preset throws on every path**, not only on whichever happens to run
 *    first. `assertTheme()` does in fact run before the resolvers in all six
 *    constructors today — but relying on that is the ordering assumption that has
 *    silently disabled a check in this codebase before, and it would cost nothing to
 *    reintroduce by moving one line.
 *
 * **The `apiOptions` injection is what OPENS the opt-in gate for a preset, and it is
 * deliberate.** That gate exists so that no bag written before this key existed
 * restyles a form on upgrade; `preset` is a key no such bag contains, so nothing that
 * renders today can change. Against that stands issue #67's own purpose: a preset that
 * stopped short of the form would leave the ten inputs to the process-wide
 * `Input.setGlobal*` setters, which the theme bag exists to replace, and the issue says
 * as much. `{}` is all that is injected — the existing four-tier resolver then carries
 * the preset's own flat keys down as tier 4, which is exactly what `apiOptions: {}` has
 * always meant ("yes, style these too, with the defaults I already wrote"). A bundle the
 * caller wrote is kept untouched.
 *
 * This is only safe because a preset supplies no `wrapper` class. The gate's other
 * justification is that a flat wrapper consumes `Input.wrapper()`'s one-shot allowance
 * on ten inputs and closes `wrapperClass()` on them; `ThemePresets.js` never emits one,
 * and its doc comment records that as a rule rather than an omission. A caller who
 * writes a flat `wrapper` alongside a preset still gets that behaviour — that is the
 * existing rule, applied to a bag that has now opened the gate.
 *
 * Whether to inject is read from {@link THEME_CHILD_KEYS} via {@link childKeysFor},
 * never from a second list, so a component that gains or loses an `ApiOptions` needs no
 * change here.
 *
 * @param {unknown} theme - The caller's theme bag, possibly a preset name.
 * @param {string|null} componentName - The component, when the caller knows it.
 * @param {boolean} withApiOptions - Whether to open the `apiOptions` gate.
 * @returns {unknown} The expanded bag, or `theme` untouched when it names no preset.
 * @throws {Error} If the bag names a preset that does not exist.
 */
function expandTheme(theme, componentName, withApiOptions) {
    if (false === hasThemePreset(theme)) {
        return theme;
    }
    const expanded = expandThemePreset(theme, componentName);
    if (withApiOptions && false === Object.hasOwn(expanded, API_OPTIONS_KEY)) {
        expanded[API_OPTIONS_KEY] = {};
    }
    return expanded;
}

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
 * Since issue #78 it also checks WHICH CHILDREN the named component has, from
 * {@link THEME_CHILD_KEYS} — see {@link unknownThemeKeyError}.
 *
 * @param {unknown} theme - The candidate theme bag.
 * @param {string} componentName - The rejecting component's class name, AND the
 *        key this guard reads its allowed child keys under. Semantically
 *        significant since issue #78, not merely message text: a name with no
 *        entry in {@link THEME_CHILD_KEYS} throws.
 * @returns {void}
 * @throws {Error} If the bag names a key the component has no child for, or if
 *         the bag or any per-child override has the wrong shape.
 */
export function assertTheme(theme, componentName) {
    // Looked UP rather than passed in, so a component's name and its key set can
    // never disagree. That pairing is exactly what went wrong in the second half
    // of issue #78 — a `CalendarViewer` bag reported under `CalendarControls`'
    // name — and a `childKeys` argument would leave a call site free to
    // reintroduce it. An unregistered name throws rather than falling back to
    // the old permissive behaviour, which would silently restore the bug.
    const childKeys = childKeysFor(componentName);
    // Before the nullish shortcut and before every shape check: a preset expands to
    // the bag this guard then validates, so the library's own expansion goes through
    // exactly the same `THEME_CHILD_KEYS` check a caller's key does, rather than being
    // trusted (#67).
    theme = expandTheme(
        theme,
        componentName,
        childKeys.includes(API_OPTIONS_KEY),
    );
    if (null === theme || undefined === theme) {
        return;
    }
    assertPlainOptions(theme, `${componentName}: theme`);
    const validKeys = [...FLAT_KEYS, ...childKeys];
    for (const key of Object.keys(theme)) {
        const value = theme[key];
        // FIRST, ahead of every shape check: a component with no `ApiOptions`
        // must report `theme.epiphanyInput` as a key it does not have, rather
        // than advising a nested spelling it would also reject.
        if (false === validKeys.includes(key)) {
            throw unknownThemeKeyError(
                key,
                componentName,
                validKeys,
                childKeys,
            );
        }
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
 * Builds the error for a top-level theme key the named component does not accept.
 *
 * Three shapes, most specific first:
 *
 * 1. An `ApiOptions` input name on a component that HAS an `ApiOptions` keeps the
 *    message issue #60 added, pointing at the nested spelling. That misplacement
 *    is plausible precisely because #60 ships ten key names that work under
 *    `apiOptions` while ONE of them, `localeInput`, also works at the top level —
 *    so `{ localeInput: …, yearInput: … }` written by analogy would otherwise
 *    have half of it silently ignored. On a component with no `ApiOptions` this
 *    branch is skipped, since the nested spelling would be rejected too and the
 *    advice would only send the caller from one throw to another.
 * 2. A key valid on some OTHER component names those components. This is the
 *    difference between "this is wrong" and "you wrote this on the wrong
 *    component", and it is the case issue #78 was filed about.
 * 3. Anything else — a genuine misspelling — gets the same sentence without the
 *    closing hint.
 *
 * @param {string} key - The offending top-level key.
 * @param {string} componentName - The rejecting component's class name.
 * @param {string[]} validKeys - Every top-level key this component does accept.
 * @param {Readonly<string[]>} childKeys - Its child keys, without the flat ones.
 * @returns {Error} The error for {@link assertTheme} to throw.
 */
function unknownThemeKeyError(key, componentName, validKeys, childKeys) {
    if (
        API_OPTIONS_INPUT_KEYS.includes(key) &&
        childKeys.includes(API_OPTIONS_KEY)
    ) {
        return new Error(
            `${componentName}: theme.${key} is an ApiOptions input, which the theme bag reaches through the nested key. Write it as theme.${API_OPTIONS_KEY}.${key} instead.`,
        );
    }
    const hint = Object.hasOwn(COMPONENTS_BY_CHILD_KEY, key)
        ? ` theme.${key} is valid on ${COMPONENTS_BY_CHILD_KEY[key].join(', ')}.`
        : '';
    return new Error(
        `${componentName}: theme.${key} is not a recognised theme key for this component. Valid keys are: ${validKeys.join(', ')}.${hint}`,
    );
}

/**
 * Narrows a theme bag to the keys one component owns, for forwarding (issue #78).
 *
 * `CalendarViewer`, `ApiExplorer` and `SubscriptionBuilder` each hand their whole
 * options bag — `theme` included — to a `CalendarControls`, which validates it
 * again under its own name. Now that {@link assertTheme} is component-aware, that
 * inner pass would reject a key that is legitimately the OUTER component's:
 * `SubscriptionBuilder`'s `subscriptionUrl` names a child `CalendarControls` has
 * never heard of. Narrowing states the rule instead — a key naming this
 * component's own child is not the controls' business — rather than widening
 * `CalendarControls`' own set, which would re-admit `subscriptionUrl` on a bare
 * `CalendarControls` and reopen the very hole this closes.
 *
 * Flat keys always survive: they are the shared vocabulary, and the controls'
 * own children read them.
 *
 * All three forwarders call this, not only the one whose set differs today, so
 * the rule holds mechanically if either of the other two ever gains a themed
 * child of its own.
 *
 * @param {Object|null|undefined} theme - The caller's whole theme bag.
 * @param {string} componentName - The component the narrowed bag is FOR.
 * @returns {Object|null|undefined} A fresh narrowed bag, or the nullish input.
 * @throws {Error} If no key set is registered under `componentName`.
 */
export function narrowTheme(theme, componentName) {
    // Resolved BEFORE the nullish shortcut, so a mistyped target is caught on
    // every call rather than only on the calls that happen to carry a theme.
    const childKeys = childKeysFor(componentName);
    // Expanded here too, so the bag handed down to `CalendarControls` is already plain
    // and its own `assertTheme()` pass never sees a `preset` key (#67).
    theme = expandTheme(
        theme,
        componentName,
        childKeys.includes(API_OPTIONS_KEY),
    );
    if (null === theme || undefined === theme) {
        return theme;
    }
    const keep = [...FLAT_KEYS, ...childKeys];
    const narrowed = {};
    for (const key of Object.keys(theme)) {
        if (keep.includes(key)) {
            narrowed[key] = theme[key];
        }
    }
    return narrowed;
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
    // `false`: this function never reads `apiOptions`, so opening that gate here would
    // be inert. `resolveApiOptionsInputTheme()` is the one that needs it (#67).
    theme = expandTheme(theme, null, false);
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
    // No `?? 'select'` fallback: a role this map does not name takes no flat class at
    // all. See `CLASS_KEY_BY_ROLE`'s own comment for what the fallback used to do to
    // the `liturgy` and `url` roles, neither of which is a `<select>`.
    const classKey = CLASS_KEY_BY_ROLE[role];
    if (undefined !== classKey && typeof bag[classKey] === 'string') {
        resolved.class = bag[classKey];
    }
    // `label` and `wrapper` are gated on the ROLE's own key list rather than on a
    // second map, because unlike `class` they map onto keys that list already names.
    // A `liturgy` or `url` child has no label and no wrapper of its own, so a flat
    // `theme.label` resolved for one was a key the caller's own component would then
    // ignore — the same accepted-and-dropped shape issue #43 was filed about, and the
    // reason `collectOverride()` has been role-keyed since.
    const roleKeys =
        OVERRIDE_KEYS_BY_ROLE[role] ?? OVERRIDE_KEYS_BY_ROLE.select;
    if (roleKeys.includes('labelClass') && typeof bag.label === 'string') {
        resolved.labelClass = bag.label;
    }
    if (roleKeys.includes('wrapperClass') && typeof bag.wrapper === 'string') {
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
    // `true`: only `applyApiOptionsTheme()` reaches here, and only from a component
    // that has an `ApiOptions` for the bundle to describe — so a preset opens the gate
    // (#67). See `expandTheme()` for why that is deliberate and why it is safe.
    theme = expandTheme(theme, null, true);
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
 * **The label text is still set UNCONDITIONALLY, but no longer because it has
 * to be.** It once did: `LocaleInput`'s constructor hardcoded its label to the
 * literal string `'locale'`, with no i18n of its own, so a caller that themed
 * nothing shipped that raw, untranslated string to every locale — the library
 * default was simply wrong, and this was the one key that could not be left to
 * "not themed means library default". Since issue #59 the constructor looks
 * `LANGUAGE` up in `Messages` from its own locale, which is the very lookup
 * every caller here passes as `defaultLabelText`: `CalendarControls.#language`
 * is `new Intl.Locale( locale ).language`, exactly what `ApiOptions` hands
 * `LocaleInput`. The write is therefore a no-op in every current call. It is
 * kept rather than removed so that a caller passing a `defaultLabelText` drawn
 * from a different catalogue still has it honoured. A theme-supplied
 * `labelText` wins over both, since it is read first.
 *
 * Takes an already-resolved child theme, not the whole bag — call
 * `resolveApiOptionsInputTheme( theme, 'localeInput' )` first, exactly as every
 * other per-child theming block in this module does.
 *
 * Since issue #60 the meta-components reach this through
 * {@link applyApiOptionsTheme} rather than calling it directly, so that the
 * locale input is themed by the same pass as its nine siblings. It stays
 * exported because it, not that loop, is the single definition of this one
 * input's unconditional-label rule.
 *
 * @param {Object} localeInput - The `ApiOptions.localeInput` to theme.
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
    applyInputTheme(localeInput, childTheme);
    // Still unconditional in effect, though since #59 LocaleInput's constructor
    // already produces this same string from its own locale, so the write is a
    // no-op in every current call. Kept so a caller passing a defaultLabelText
    // drawn from another catalogue is still honoured. A theme-supplied labelText
    // wins over both — `applyInputTheme()` has already written it, which is why
    // this branch fires only in its absence.
    if (false === Object.hasOwn(childTheme, 'labelText')) {
        localeInput._labelElement.textContent = defaultLabelText;
    }
}

/**
 * Applies a resolved theme to one `ApiOptions` input.
 *
 * The generic half of {@link applyLocaleInputTheme}, which is now this plus one
 * locale-specific fallback. Every key is applied only when the theme NAMED it,
 * including `labelText`: the raw-`'locale'` problem that forces the locale input's
 * label unconditionally is that one input's, and defaulting the other nine here
 * would silently overwrite whatever label text they carry.
 *
 * `wrapper()` rather than `wrapperClass()`, always, and via
 * {@link resolveWrapperBag}: that helper supplies `as: 'div'` when the theme named
 * a class but no element type, so the "Wrapper has not been set" failure that
 * `Input.wrapperClass()` raises on a wrapper-less input cannot arise here. It also
 * omits `class` entirely rather than passing `undefined`, because a class named in
 * the bag beats `setGlobalWrapperClass()` AND closes `wrapperClass()` for the rest
 * of that input's life — neither of which a theme that never mentioned a class
 * should provoke.
 *
 * @param {Object} input - The `Input` to theme.
 * @param {{class?: string, labelClass?: string, labelText?: string, wrapper?: string, wrapperClass?: string}} childTheme -
 *   The resolved theme, from {@link resolveApiOptionsInputTheme}.
 * @returns {void}
 */
function applyInputTheme(input, childTheme) {
    if (Object.hasOwn(childTheme, 'class')) {
        input.class(childTheme.class);
    }
    if (Object.hasOwn(childTheme, 'labelClass')) {
        input.labelClass(childTheme.labelClass);
    }
    const wrapper = resolveWrapperBag(childTheme);
    if (null !== wrapper) {
        input.wrapper(wrapper);
    }
    if (Object.hasOwn(childTheme, 'labelText')) {
        input._labelElement.textContent = childTheme.labelText;
    }
}

/**
 * Themes every one of an `ApiOptions`' ten inputs from a meta-component's theme
 * bag (issue #60).
 *
 * This is what replaced the four process-wide `Input.setGlobalInputClass()` /
 * `setGlobalLabelClass()` / `setGlobalWrapper()` / `setGlobalWrapperClass()` calls
 * every consumer of the meta-components used to open with. Those are mutations on
 * the `Input` CLASS: they leak onto every other component on the page, including
 * ones the caller never meant to touch, and two embeds with different styling
 * cannot coexist behind them. The theme bag is the scoped replacement, and until
 * this existed it did not actually cover the form it claimed to.
 *
 * All ten are themed unconditionally — the resolver, not this loop, decides what
 * that amounts to, and for nine of them an absent `theme.apiOptions` means an
 * empty resolved theme and no setter call at all. `filter` is deliberately not
 * consulted: every input exists whatever the filter, so theming one the filter
 * never appends is inert rather than an error, and a caller need not know which
 * filter renders which input to write a bag that works for all of them.
 *
 * `apiOptions[ inputKey ]` is a direct lookup, not a translation table, because
 * {@link API_OPTIONS_INPUT_ROLES}' keys ARE `ApiOptions`' canonical accessor names.
 * They used to be those names minus a leading underscore, which this line had to
 * add back; issue #62 gave the accessors their canonical spellings and the
 * concatenation went away. Should the two ever diverge again, that map is the
 * single place this has to change.
 *
 * @param {Object} apiOptions - The `ApiOptions` whose inputs to theme.
 * @param {Object|null|undefined} theme - The meta-component's whole theme bag,
 *        unresolved: this function resolves each input itself, since the four
 *        tiers differ per input.
 * @param {string} defaultLocaleLabelText - The localized label the locale input
 *        falls back to; see {@link applyLocaleInputTheme}.
 * @returns {void}
 */
export function applyApiOptionsTheme(
    apiOptions,
    theme,
    defaultLocaleLabelText,
) {
    for (const inputKey of API_OPTIONS_INPUT_KEYS) {
        const childTheme = resolveApiOptionsInputTheme(theme, inputKey);
        const input = apiOptions[inputKey];
        if ('localeInput' === inputKey) {
            applyLocaleInputTheme(input, childTheme, defaultLocaleLabelText);
            continue;
        }
        applyInputTheme(input, childTheme);
    }
}
