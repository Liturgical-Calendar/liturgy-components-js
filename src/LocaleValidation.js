/**
 * The shared locale sanitisation every component's constructor needs.
 *
 * Deliberately NOT exported from `src/index.js`, for the same reason as
 * {@link module:OptionsValidation}: this is an internal contract between the
 * components, not public API — the choice `resolveBase` and `assertSameBase`
 * made in `ApiClient/ApiBase.js` — and the reason it does not live in
 * `Utils.js`, which IS exported.
 *
 * It sits in its own module rather than inside `OptionsValidation.js` on the
 * same reasoning that put `assertPlainOptions` outside `ApiBase.js`: what a
 * locale tag is has nothing to do with what shape an options bag is. The two
 * concerns only ever meet at a call site. `WebCalendar.locale()` makes the
 * split concrete — it takes a bare locale argument, never an options bag, so
 * it needs this module and not the other one.
 *
 * @module LocaleValidation
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import { describeType } from './OptionsValidation.js';

/**
 * Normalises a caller-supplied locale tag and returns its canonical form.
 *
 * Three steps, in this order and only this order:
 *
 * 1. Reject a non-string, naming the component and the type actually found.
 * 2. Replace `_` with `-`. This MUST precede canonicalisation, not follow it:
 *    `Intl.getCanonicalLocales( 'it_IT' )` throws where `'it-IT'` succeeds, so
 *    canonicalising first would reject the underscore form this library has
 *    always accepted. Applied unconditionally — an `includes( '_' )` guard, as
 *    `CalendarSelect` had, only skips a no-op replace.
 * 3. Canonicalise through `Intl.getCanonicalLocales`, whose own `RangeError`
 *    reads `Incorrect locale information provided` and names neither the
 *    offending tag nor the component that rejected it. Hence the wrap.
 *
 * A locale that is present but unparseable THROWS. It is never quietly
 * replaced with `'en'`: silently falling back to English is precisely the
 * failure mode issue #31 removed, and reinstating it for a different input
 * would undo that. Deciding what an ABSENT locale means is the caller's job,
 * not this function's — the components do not agree on it and the
 * disagreement is a live question (issue #32) rather than an oversight.
 *
 * `Intl.getCanonicalLocales` given a single string either throws or returns
 * exactly one element, so the `length === 0` branch the call sites used to
 * carry was unreachable and is not reproduced here.
 *
 * @param {unknown} locale - The caller-supplied locale tag.
 * @param {string} componentName - The rejecting component's name, for the message.
 * @returns {string} The canonical BCP 47 tag, e.g. `'it-IT'` for `'it_IT'` or `'EN-us'`.
 * @throws {Error} If `locale` is not a string, or is not a parseable locale tag.
 */
export function canonicalizeLocale( locale, componentName ) {
    if ( typeof locale !== 'string' ) {
        throw new Error( `${componentName}: Invalid type for locale, must be of type \`string\` but found type: ${describeType( locale )}` );
    }
    const normalizedLocale = locale.replaceAll( '_', '-' );
    try {
        return Intl.getCanonicalLocales( normalizedLocale )[ 0 ];
    } catch {
        // The normalised tag, not the raw one: it is what was actually rejected,
        // and `ApiOptions` has reported it that way from the start.
        throw new Error( `${componentName}: Invalid locale: ${normalizedLocale}` );
    }
}

/**
 * As {@link canonicalizeLocale}, but returns the parsed `Intl.Locale`.
 *
 * A thin adapter rather than a second implementation, because the two families
 * agree: for every tag `Intl.getCanonicalLocales` accepts,
 * `new Intl.Locale( tag )` accepts it too and its `toString()` is that same
 * canonical tag. So parsing the canonical form cannot throw, and cannot yield a
 * locale different from the one the raw tag would have produced.
 *
 * It exists at all because three of the six call sites (`ApiOptions`,
 * `LiturgyOfTheDay`, `LiturgyOfAnyDay`) store an `Intl.Locale` rather than a
 * string, and making each of them write the `new Intl.Locale( … )` wrap would
 * re-duplicate, three times over, the thing this module exists to remove.
 *
 * @param {unknown} locale - The caller-supplied locale tag.
 * @param {string} componentName - The rejecting component's name, for the message.
 * @returns {Intl.Locale} The parsed locale.
 * @throws {Error} If `locale` is not a string, or is not a parseable locale tag.
 */
export function toIntlLocale( locale, componentName ) {
    return new Intl.Locale( canonicalizeLocale( locale, componentName ) );
}
