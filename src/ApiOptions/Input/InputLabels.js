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
 * **The `??` fallback is the point of this function existing** rather than ten
 * inlined lookups. `Messages` holds 84 unevenly populated locale blocks, so an
 * unguarded `Messages[language][key]` throws for a language with no block at all
 * and yields `undefined` for a block that simply lacks the key. Centralizing the
 * guard makes that class of bug impossible for these labels.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import Messages from '../../Messages.js';

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
    const language = locale?.language ?? 'en';
    return Messages[language]?.[key] ?? Messages['en'][key];
}
