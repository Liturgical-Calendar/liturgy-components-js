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
 * Five steps, in this order and only this order:
 *
 * 0. Unwrap an `Intl.Locale` to its string tag. Accepted because it is the more
 *    precise representation of the very thing this function parses, and the one
 *    the library already uses internally — `ApiOptions` stores one and hands it
 *    to every input it builds — so a caller holding one had to downgrade it to a
 *    string for the library to take it (issue #32).
 *
 *    No special handling is needed beyond `toString()`, and that is a property
 *    of `Intl.Locale` rather than a happy accident: its `toString()` is defined
 *    to return the canonical tag for the locale it holds, and it canonicalises
 *    the same way `Intl.getCanonicalLocales` does. Verified, not assumed, for
 *    each way a tag can be non-canonical: case (`'EN-us'` → `'en-US'`), script
 *    casing (`'en-latn-us'` → `'en-Latn-US'`), deprecated subtags (`'iw'` →
 *    `'he'`), macrolanguage collapse (`'cmn-Hans-CN'` → `'zh-Hans-CN'`),
 *    Unicode extensions both spelled in the tag and passed as constructor
 *    options (`new Intl.Locale( 'en', { calendar: 'buddhist' } )` →
 *    `'en-u-ca-buddhist'`), and private-use subtags (`'en-US-x-private'`, kept).
 *    In every case `Intl.getCanonicalLocales( String( locale ) )` returns that
 *    same string, so step 4 below is a no-op on an unwrapped locale rather than
 *    a second, possibly disagreeing, canonicalisation. Extensions survive: they
 *    are part of the canonical tag, not stripped by either family.
 *
 *    An `Intl.Locale` also cannot reach steps 2 or 3 in a failing state — its
 *    `toString()` is never empty and never contains `_`, since the constructor
 *    would have thrown on such an input long before this function saw it.
 * 1. Reject anything that is neither, naming the component and the type found.
 * 2. Reject an empty or whitespace-only tag with a message of its own. This is
 *    not a redundant guard: `Intl.getCanonicalLocales( '' )` does throw, so the
 *    step below would reject it anyway — but the message it produces reads
 *    `Invalid locale: ` and names nothing after the colon, which tells a caller
 *    who passed `''` (or a trimmed-to-nothing form value) nothing at all. A
 *    blank tag is a distinct kind of mistake from a malformed one wherever it
 *    arrives, so it is reported distinctly, once, for all six components rather
 *    than hand-rolled at the call sites that happened to notice.
 * 3. Replace `_` with `-`. This MUST precede canonicalisation, not follow it:
 *    `Intl.getCanonicalLocales( 'it_IT' )` throws where `'it-IT'` succeeds, so
 *    canonicalising first would reject the underscore form this library has
 *    always accepted. Applied unconditionally — an `includes( '_' )` guard, as
 *    `CalendarSelect` had, only skips a no-op replace.
 * 4. Canonicalise through `Intl.getCanonicalLocales`, whose own `RangeError`
 *    reads `Incorrect locale information provided` and names neither the
 *    offending tag nor the component that rejected it. Hence the wrap.
 *
 * A locale that is present but unparseable THROWS. It is never quietly
 * replaced with `'en'`: silently falling back to English is precisely the
 * failure mode issue #31 removed, and reinstating it for a different input
 * would undo that. Deciding what an ABSENT locale means is the caller's job,
 * not this function's — though since issue #32 the callers all agree, and
 * `null` and `undefined` alike mean "not supplied, use the default".
 *
 * `Intl.getCanonicalLocales` given a single string either throws or returns
 * exactly one element, so the `length === 0` branch the call sites used to
 * carry was unreachable and is not reproduced here.
 *
 * @param {unknown} locale - The caller-supplied locale tag or `Intl.Locale`.
 * @param {string} componentName - The rejecting component's name, for the message.
 * @returns {string} The canonical BCP 47 tag, e.g. `'it-IT'` for `'it_IT'` or `'EN-us'`.
 * @throws {Error} If `locale` is neither a string nor an `Intl.Locale`, is empty or blank, or is not a parseable locale tag.
 */
export function canonicalizeLocale(locale, componentName) {
    // `describeType( locale )` below reports the ORIGINAL argument, not the
    // unwrapped tag: a caller who passed a number needs to hear `number`.
    const tag = locale instanceof Intl.Locale ? locale.toString() : locale;
    if (typeof tag !== 'string') {
        throw new Error(
            `${componentName}: Invalid type for locale, must be of type \`string\` or \`Intl.Locale\` but found type: ${describeType(locale)}`,
        );
    }
    if (tag.trim() === '') {
        throw new Error(
            `${componentName}: Invalid locale, cannot be an empty or blank string`,
        );
    }
    const normalizedLocale = tag.replaceAll('_', '-');
    try {
        return Intl.getCanonicalLocales(normalizedLocale)[0];
    } catch {
        // The normalised tag, not the raw one: it is what was actually rejected,
        // and `ApiOptions` has reported it that way from the start.
        throw new Error(
            `${componentName}: Invalid locale: ${normalizedLocale}`,
        );
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
 * An `Intl.Locale` handed in is therefore round-tripped rather than returned as
 * it came: unwrapped to its canonical tag by `canonicalizeLocale`, then parsed
 * back. The result is `equals`-identical to the argument by the same reasoning,
 * and the round trip is what keeps a caller from mutating library state through
 * a reference it still holds — `Intl.Locale` is immutable in practice, but the
 * components hold their locale for their whole lifetime and a fresh instance
 * costs nothing.
 *
 * @param {unknown} locale - The caller-supplied locale tag or `Intl.Locale`.
 * @param {string} componentName - The rejecting component's name, for the message.
 * @returns {Intl.Locale} The parsed locale.
 * @throws {Error} If `locale` is neither a string nor an `Intl.Locale`, is empty or blank, or is not a parseable locale tag.
 */
export function toIntlLocale(locale, componentName) {
    return new Intl.Locale(canonicalizeLocale(locale, componentName));
}
