import Messages from './Messages.js';

/**
 * Placeholder interpolation for `Messages` templates.
 *
 * The `{name}` syntax and this regex are not new: `Messages.js` has carried
 * `AMBROSIAN_CALENDAR_CAPTION: 'Ambrosian Calendar - {year}'` — and the diocesan
 * and national captions before it — since long before this module, interpolated
 * inline at three sites in `WebCalendar.js`. This lifts that convention into one
 * place rather than inventing a second one. The three caption sites still inline
 * it; converting them is a refactor of shipped behaviour and belongs to its own
 * change.
 *
 * A placeholder with no replacement is left as written. The inlined sites emit
 * the string `'undefined'` in that case, which is strictly less debuggable, and
 * no existing call site reaches the difference.
 *
 * @param {string} template - The message template.
 * @param {Object<string, unknown>} replacements - Values by placeholder name.
 * @returns {string} The interpolated string.
 */
export function interpolate(template, replacements) {
    return template.replace(/{(.*?)}/g, (match, name) =>
        Object.hasOwn(replacements, name) ? String(replacements[name]) : match,
    );
}

/**
 * Resolves a message key for a language and interpolates it.
 *
 * Applies the same `Messages[ language ]?.[ KEY ] ?? Messages[ 'en' ][ KEY ]`
 * fallback every call site in this library already writes by hand, so a language
 * whose block is unpopulated for this key — or absent entirely — degrades to
 * English rather than throwing.
 *
 * @param {string} key - The `Messages` key.
 * @param {string} language - A language subtag, e.g. `'it'`.
 * @param {Object<string, unknown>} [replacements] - Values by placeholder name.
 * @returns {string} The resolved, interpolated message.
 */
export function formatMessage(key, language, replacements = {}) {
    const template = Messages[language]?.[key] ?? Messages['en'][key];
    return interpolate(template, replacements);
}

/**
 * Resolves a count-dependent message and interpolates it.
 *
 * The key is the base key with the `Intl.PluralRules` category appended in upper
 * case, so `one` reads `<BASE>_ONE`. Only `_ONE` and `_OTHER` are populated, so a
 * language whose rules select `few` or `many` — Slovak at 2–4, for instance —
 * takes its OWN `_OTHER` before English is considered. Each `_OTHER` translation
 * is therefore written in the form its language uses with a large count, which is
 * the only count a full liturgical year produces.
 *
 * @param {string} baseKey - The key without its plural suffix.
 * @param {string} language - A language subtag, e.g. `'sk'`.
 * @param {number} count - The count the plural form is selected for.
 * @param {Object<string, unknown>} [replacements] - Values by placeholder name.
 * @returns {string} The resolved, interpolated message.
 */
export function formatPluralMessage(
    baseKey,
    language,
    count,
    replacements = {},
) {
    const category = new Intl.PluralRules(language).select(count);
    const key = `${baseKey}_${category.toUpperCase()}`;
    const otherKey = `${baseKey}_OTHER`;
    const template =
        Messages[language]?.[key] ??
        Messages[language]?.[otherKey] ??
        Messages['en'][key] ??
        Messages['en'][otherKey];
    return interpolate(template, replacements);
}
