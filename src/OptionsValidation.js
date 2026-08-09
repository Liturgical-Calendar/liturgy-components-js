/**
 * The shared guard for component constructors that take an options bag.
 *
 * Deliberately NOT exported from `src/index.js`. This is an internal contract
 * between the components, not public API — the same choice made for `resolveBase`
 * and `assertSameBase` in `ApiClient/ApiBase.js`, and the reason it does not live
 * in `Utils.js`, which IS exported. It sits in its own module rather than in
 * `ApiBase.js` because validating an options argument has nothing to do with API
 * bases; every component takes options, only some bind to a base.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

/**
 * Whether a value is a plain options object.
 *
 * A bare `typeof options === 'object' && false === Array.isArray( options )` is not
 * enough, and the gap is not theoretical: `new Intl.Locale( 'it-IT' )` satisfies it,
 * and passing one is a plausible slip precisely because `LocaleInput` DOES take an
 * `Intl.Locale`. Destructured as a component's options it yields `{}` — it shares
 * not one property name with `locale`, `id`, `name`, `filter`, `after`, `label`,
 * `wrapper`, `allowNull`, `disabled`, `rite` or `apiClient` — so the locale comes
 * out `undefined`, the `typeof locale !== 'string'` check every component already
 * carries is never reached, and the component renders in English with no warning.
 *
 * Tested by prototype, so ANY class instance is rejected rather than just this one.
 * A null-prototype object is accepted: it carries no inherited keys to collide with
 * option names, which is the property being protected here.
 *
 * Because of that, and because an ordinary bag may carry a `hasOwnProperty` key of
 * its own, every call site MUST read an accepted bag with `Object.hasOwn( bag, key )`
 * rather than `bag.hasOwnProperty( key )`. The latter is a method looked up ON the
 * caller's object: absent from a null-prototype bag, and shadowed by an own key of
 * that name on a bag that has `Object.prototype` — which no prototype test can
 * detect, since such a bag is plain by every definition. Reading it either way threw
 * a bare `TypeError`, so the guard promised a shape its call sites then rejected.
 *
 * @param {unknown} options - The candidate options object.
 * @returns {boolean} True only for `{}`-shaped objects and null-prototype objects.
 */
function isPlainOptionsObject(options) {
    if (
        null === options ||
        typeof options !== 'object' ||
        Array.isArray(options)
    ) {
        return false;
    }
    const prototype = Object.getPrototypeOf(options);
    return null === prototype || prototype === Object.prototype;
}

/**
 * Names a value's type for an error message.
 *
 * Distinguishes `null` and `array` from `object`, and names a class instance by its
 * constructor — so an `Intl.Locale` reads `found type: Locale` rather than the
 * useless `must be of type \`object\` but found type: object`. A null-prototype
 * object has no constructor to name and falls back to `object`.
 *
 * Exported alongside {@link assertPlainOptions} because the same components need it
 * for their own type messages — `ApiOptions` uses it for the locale it rejects, not
 * only for the options bag.
 *
 * @param {unknown} value - The value to describe.
 * @returns {string} A human-readable type name.
 */
export function describeType(value) {
    if (null === value) {
        return 'null';
    }
    if (Array.isArray(value)) {
        return 'array';
    }
    if (typeof value === 'object') {
        return value.constructor?.name ?? 'object';
    }
    return typeof value;
}

/**
 * Asserts that a constructor argument is a plain options object, and throws naming
 * both the rejecting component and the type it actually received.
 *
 * `null` and `undefined` are rejected here, and that is deliberate even though every
 * component treats them as "no options given". This function ASSERTS; it returns
 * `void` and so cannot hand a substitute bag back to a caller that is about to
 * destructure. Widening it to pass nullish through would therefore not spare a
 * single call site its own branch — each would still have to turn `null` into
 * something destructurable — while costing the guard its ability to report a
 * nullish argument at all. {@link normalizeComponentOptions} is where the nullish
 * case is answered, once, for all five components.
 *
 * @param {unknown} options - The constructor argument to check.
 * @param {string} componentName - The rejecting component's class name, for the message.
 * @returns {void}
 * @throws {Error} If `options` is not a plain object.
 */
export function assertPlainOptions(options, componentName) {
    if (false === isPlainOptionsObject(options)) {
        throw new Error(
            `${componentName}: Invalid type for options, must be of type \`object\` but found type: ${describeType(options)}`,
        );
    }
}

/**
 * Normalises a component constructor's argument into a plain options bag.
 *
 * Every component that takes an options bag takes the same three forms, and used
 * to spell the same branch out for itself — badly, and differently: `ApiOptions`
 * rejected `null` where its four siblings defaulted it, and each of the five had
 * to remember to run {@link assertPlainOptions} on the remaining case. Issue #32
 * settled both questions in one direction, so the branch is written once here.
 *
 * The three accepted forms, tested IN THIS ORDER:
 *
 * 1. An `Intl.Locale` — a locale, wrapped as `{ locale }`. Tested first, and
 *    ahead of the plain-object test rather than as an exception inside it: an
 *    `Intl.Locale` IS an object, so the order is what makes it a recognised third
 *    form instead of a hole in the guard. {@link isPlainOptionsObject} keeps
 *    rejecting it, along with every other class instance, exactly as issue #31
 *    left it — nothing reaches that test that this branch already claimed.
 * 2. A string — a locale, likewise wrapped.
 * 3. `null` or `undefined` — no options given, so an empty bag, from which every
 *    caller's own defaults follow. `null` and `undefined` mean the same thing:
 *    passing an absent value through a variable is ordinary JavaScript and is not
 *    a different act from omitting the argument.
 *
 * Anything else must be a plain object, or {@link assertPlainOptions} throws.
 *
 * The locale is NOT validated here, and the `Intl.Locale` is NOT converted to a
 * tag: this module knows what SHAPE an options argument may take, and
 * `LocaleValidation` knows what a locale is. The bag returned carries whatever
 * the caller wrote, for the caller's own `canonicalizeLocale`/`toIntlLocale`
 * call to judge.
 *
 * @param {unknown} options - The constructor argument.
 * @param {string} componentName - The rejecting component's class name, for the message.
 * @returns {Object} A plain options bag — the caller's own, or one synthesised for a locale or an absent argument.
 * @throws {Error} If `options` is none of the three accepted forms.
 */
export function normalizeComponentOptions(options, componentName) {
    if (options instanceof Intl.Locale || typeof options === 'string') {
        return { locale: options };
    }
    if (null === options || undefined === options) {
        return {};
    }
    assertPlainOptions(options, componentName);
    return options;
}
