/**
 * The one guarded read of the message catalogue.
 *
 * `Messages` holds 84 locale blocks, unevenly populated, so a lookup is two
 * index operations and **both** can miss: `Messages[ language ]` is `undefined`
 * for any language with no block at all, and `Messages[ language ][ key ]` is
 * `undefined` for a block that simply lacks that key. Written inline, the first
 * miss throws a bare `TypeError: Cannot read properties of undefined`, naming
 * neither the component, nor the locale, nor the fact that it is this catalogue
 * — not the API — that lacks the language. That was issue #69: `ApiOptions`
 * builds ten inputs in its constructor, and five of the six composed components
 * build an `ApiOptions` — `CalendarControls` and `DayViewer` directly, and
 * `CalendarViewer`, `ApiExplorer` and `SubscriptionBuilder` through
 * `CalendarControls` — so a `locale` wired from `document.documentElement.lang`
 * could take down a page through a component the consumer never touched.
 * (`CalendarResourcePicker` is the exception: it bundles only a `RiteSelect` and
 * a `CalendarSelect`, and both were guarded here too.)
 *
 * The fix is one shared implementation rather than a guard per call site,
 * because a guard per call site is exactly the shape that produced the bug:
 * six sites had remembered it and six had not. It lives at the top of `src/`
 * beside {@link module:LocaleValidation}, {@link module:OptionsValidation} and
 * `WrapperOptions.js` — not under `ApiOptions/Input/`, where issue #59 had put
 * the label-only version — because four of the six broken sites were neither
 * inputs nor labels. Deliberately NOT exported from `src/index.js`, on the same
 * reasoning as those three: internal contract between the components, not
 * public API.
 *
 * **There is deliberately no `console.warn` on the fallback.** A block that
 * lacks a key is the documented normal case, not an anomaly: `SELECT_A_RITE`
 * and the six #59 label keys are carried by exactly twelve of the 84 blocks, so
 * warning would fire for 72 locales that are working exactly as designed, once
 * per input constructed. It would also start logging on four paths
 * (`RiteSelect`, `CalendarSelect`, `SubscriptionUrl`, `defaultLabelText`) that
 * already fell back silently and are documented to do so. The gap stays visible
 * where it is actionable instead — `src/__tests__/Messages.test.js` asserts
 * per-key locale coverage.
 *
 * @module MessageLookup
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import Messages from './Messages.js';
import { toIntlLocale } from './LocaleValidation.js';

/**
 * Resolves the language subtag a catalogue block is keyed by.
 *
 * A supplied tag goes through {@link module:LocaleValidation}'s `toIntlLocale`
 * rather than a bare `new Intl.Locale( … )`, for two reasons that only show up
 * on the paths a bare parse gets wrong. `canonicalizeLocale` normalizes `_` to
 * `-`, so `'it_IT'` resolves here exactly as it does at every other locale
 * entry point in the library — a lookup must not be the one place that form is
 * rejected. And its errors name the offending tag and the rejecting layer,
 * where `Intl.Locale`'s own `RangeError` reads `Incorrect locale information
 * provided` and names nothing: reintroducing that would be issue #69's original
 * complaint, moved onto the invalid-tag path.
 *
 * An `Intl.Locale` skips the round trip: it is already parsed, and its
 * `language` is already canonical, so there is nothing left to normalize.
 *
 * @param {Intl.Locale|string|null|undefined} locale - An `Intl.Locale`, a locale
 *        tag (`'it'`, `'it-IT'` and `'it_IT'` resolve alike), or
 *        `null`/`undefined` for "not supplied".
 * @returns {string} The language subtag, or `'en'` when nothing was supplied.
 * @throws {Error} If a supplied tag cannot be parsed. "Absent" and "invalid"
 *         are different things, and only "absent" means English.
 */
function languageOf(locale) {
    if (null === locale || undefined === locale) {
        return 'en';
    }
    if (locale instanceof Intl.Locale) {
        return locale.language;
    }
    return toIntlLocale(locale, 'MessageLookup').language;
}

/**
 * Looks up a message in the catalogue, falling back to English.
 *
 * @param {string} key - The `Messages` key, e.g. `SELECT_A_CALENDAR`.
 * @param {Intl.Locale|string|null} [locale=null] - The locale whose language to
 *        read. `null` and `undefined` both mean "not supplied" and yield the
 *        English message.
 * @returns {string} The localized message, or the English one when the
 *          catalogue has no block for the language, or a block without the key.
 * @throws {Error} If the English block does not carry the key. Every key is a
 *         string literal in the source, so one missing from English is a typo
 *         that is broken in every locale rather than a translation gap — and
 *         failing by name beats assigning `undefined` to a `textContent` and
 *         rendering the word "undefined". It is deterministic too: it cannot
 *         depend on which locale the page happens to run in.
 */
export function message(key, locale = null) {
    const language = languageOf(locale);
    const localized = Messages[language]?.[key];
    if (undefined !== localized) {
        return localized;
    }
    const english = Messages['en'][key];
    if (undefined === english) {
        throw new Error(
            `No message catalogue entry for key "${key}": it is absent even from the English block, so no locale can resolve it.`,
        );
    }
    return english;
}
