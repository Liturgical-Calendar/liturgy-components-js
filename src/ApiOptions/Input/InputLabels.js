/**
 * The default `<label>` text for an `ApiOptions` input, looked up in `Messages`.
 *
 * Every `Input` subclass used to hardcode its label to the raw snake_case API
 * parameter name — `year_type`, `epiphany`, `holydays_of_obligation` — which is
 * what a screen reader announced for the control in every language (issue #59).
 * Localizing here, in the constructor's own lookup rather than in a
 * meta-component's theming pass, is what reaches a consumer who constructs
 * `new ApiOptions( 'it' )` directly: `ApiOptions` is public API in its own right,
 * and the theme path only covers callers who mount a meta-component.
 *
 * A theme-supplied `labelText` still wins, because all theming is applied AFTER
 * construction — see `Theme.js`'s `applyLocaleInputTheme()` and
 * `LiturgyOfAnyDay`'s three `*InputConfig()` bags.
 *
 * Deliberately NOT exported from `src/index.js`, on the same reasoning as
 * `LocaleValidation.js`, `OptionsValidation.js` and `WrapperOptions.js`: internal
 * contract between the components, not public API.
 *
 * **The fallback is the point of this function existing** rather than ten
 * inlined lookups. It now delegates to `src/MessageLookup.js`'s `message()`,
 * which is the library's single guarded read of the catalogue (issue #69): four
 * of the six sites that still threw were neither inputs nor labels, so the guard
 * had to move somewhere both this module and `CalendarSelect` could reach. This
 * wrapper survives that move because it carries a rationale `message()` does not
 * — the `null`-means-English default appropriate to a LABEL — and because ten
 * call sites read better naming what they are looking up.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import { message } from '../../MessageLookup.js';

/**
 * Looks up a label in the message catalogue, falling back to English.
 *
 * @param {string} key - The `Messages` key, e.g. `YEAR_TYPE`.
 * @param {Intl.Locale|null} [locale=null] - The locale whose language to read.
 *        `null` means "not supplied" and yields the English message, which is the
 *        only sane default for an input constructed without a locale.
 * @returns {string} The localized label, or the English one.
 */
export function defaultLabelText(key, locale = null) {
    return message(key, locale);
}
