export default class Utils {
    /**
     * Validates a given element selector and returns the corresponding DOM element.
     *
     * If the element selector is not a string, an error is thrown.
     * If the element selector is a string, it is validated against the DOM and if the element is not found, an error is thrown.
     *
     * @param {string} element - The element selector to be validated.
     * @returns {Element} The DOM element corresponding to the element selector.
     * @throws {Error} If the type of element is not a string.
     * @throws {Error} If the element selector is not found in the DOM.
     */
    static validateElementSelector(element) {
        if (typeof element !== 'string') {
            throw new Error(
                'Invalid type for element selector, must be of type string but found type: ' +
                    typeof element,
            );
        }
        const domNode = document.querySelector(element);
        if (null === domNode) {
            throw new Error('Invalid element selector: ' + element);
        }
        return domNode;
    }

    /**
     * Checks whether one space-separated class token is usable in a `class` attribute.
     *
     * **This is deliberately permissive, and was deliberately widened.** It previously
     * demanded `/^(?!\d|--|-?\d)[a-zA-Z_-][a-zA-Z\d_-]{1,}$/` — letters, digits,
     * underscores and hyphens only, never leading with a digit. That describes a CSS
     * *identifier*, which is not what a `class` attribute holds: the attribute is a
     * space-separated token list, and a token may contain any character except
     * whitespace. Utility-first frameworks rely on exactly the characters the old
     * pattern excluded, and every one of these is a legitimate class a consumer may
     * pass:
     *
     * | Token                 | Excluded by the old pattern because |
     * | --------------------- | ----------------------------------- |
     * | `md:w-1/2`            | `:` and `/`                         |
     * | `hover:bg-blue-500`   | `:`                                 |
     * | `2xl:flex`            | leading digit, and `:`              |
     * | `p-1.5`               | `.`                                 |
     * | `bg-[#1da1f2]`        | `[`, `#`, `]`                       |
     * | `[&>*]:mt-2`          | `[`, `&`, `>`, `*`, `]`, `:`        |
     * | `w-[calc(100%-2rem)]` | `[`, `(`, `%`, `)`, `]`             |
     *
     * Rejecting those did not leave a page unstyled — it THREW, so a Tailwind
     * consumer could not use this library's components at all.
     *
     * **Why relaxing is safe here.** Every call site splits on whitespace, runs each
     * token through {@link Utils.sanitizeInput} (which parses as HTML and keeps only
     * the text content, so markup cannot survive), and then assigns via
     * `setAttribute('class', …)` or `element.className`. Neither is an HTML-string
     * interpolation, so there is no injection vector for this function to defend.
     * What remains is catching a caller's mistake, and the mistakes worth catching
     * are an empty token, a token carrying whitespace the caller forgot to split on,
     * and a token containing quote characters or `<` — none of which can appear in a
     * class anyone meant to write, and all of which signal that markup or a quoting
     * error leaked in.
     *
     * `>` is accepted even though `<` is not: `>` occurs inside Tailwind's arbitrary
     * variants (`[&>*]:mt-2`), while `<` only ever indicates markup.
     *
     * @param {string} className - A single class token, already split on whitespace.
     * @returns {boolean} `true` if the token is usable, `false` otherwise.
     */
    static validateClassName(className) {
        if (typeof className !== 'string' || '' === className) {
            return false;
        }
        // Whitespace: the caller was supposed to split first. Quotes, backtick and
        // `<`: markup or a quoting error, never a class anyone intended.
        return false === /[\s"'`<]/.test(className);
    }

    /**
     * Validates if the given string is a valid CSS selector.
     *
     * A valid CSS selector must:
     * - Not start with a digit, a sequence of dashes, or a number with a leading dash.
     * - Consist of letters, dashes, or underscores.
     * - Contain at least one alphanumeric character, dash, or underscore.
     *
     * @param {string} className - The class name to validate.
     * @returns {boolean} True if the class name is valid, false otherwise.
     */
    static validateId(id) {
        /**
         * The regex pattern used to validate IDs:
         *   - `^` asserts the start of a line
         *   - `(?!\d|--|-?\d)` is a negative lookahead that prevents the ID
         *     from starting with a digit, a sequence of dashes, or a number with a leading dash
         *   - `(?:[_-][a-zA-Z][\w\-]*|[a-zA-Z][\w\-]*)` matches either a sequence starting with an underscore or dash
         *      followed by a letter followed by zero or more word characters or dashes,
         *      or it matches a letter followed by zero or more word characters or dashes
         *   - `$` asserts the end of a line
         *
         * >> Technically, the value for an ID attribute may contain any other Unicode character.
         * >> However, when used in CSS selectors,
         * >>  either from JavaScript using APIs like Document.querySelector()
         * >>  or in CSS stylesheets, ID attribute values must be valid CSS identifiers.
         * https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/id
         */
        const pattern =
            /^(?!\d|--|-?\d)(?:[_-][a-zA-Z][\w\-]*|[a-zA-Z][\w\-]*)$/;
        return pattern.test(id);
    }

    /**
     * Sanitizes the given input string to prevent XSS attacks.
     *
     * It uses the DOMParser to parse the string as HTML and then extracts the
     * text content of the parsed HTML document. This effectively strips any HTML
     * tags from the input string.
     *
     * @param {string} input - The input string to sanitize.
     * @returns {string} The sanitized string.
     * @see https://stackoverflow.com/a/47140708/394921
     */
    static sanitizeInput(input) {
        let doc = new DOMParser().parseFromString(input, 'text/html');
        return doc.body.textContent || '';
    }

    /**
     * Get user's preferred languages from browser settings.
     * Returns an array of language codes in order of preference.
     *
     * @returns {string[]} Array of language codes (e.g., ['en-US', 'en', 'fr'])
     * @example
     * const userLangs = Utils.getUserLanguages();
     * // Returns: ['en-US', 'en'] based on browser settings
     */
    static getUserLanguages() {
        if (navigator.languages && navigator.languages.length > 0) {
            return [...navigator.languages];
        }
        if (navigator.language) {
            return [navigator.language];
        }
        return ['en'];
    }

    /**
     * Find the best matching locale from available options based on user's language preferences.
     * Tries exact match first, then language prefix match, for each preferred language in order.
     *
     * @param {string[]} userLanguages - User's preferred languages in order of preference
     * @param {string[]} availableLocales - Array of available locale strings to match against
     * @returns {string} The best matching locale value, or the first available option, or 'en' as fallback
     * @example
     * const userLangs = Utils.getUserLanguages(); // ['en-US', 'en']
     * const available = ['it', 'en', 'fr', 'de'];
     * const bestLocale = Utils.findBestLocale(userLangs, available);
     * // Returns: 'en' (matches 'en-US' prefix)
     */
    static findBestLocale(userLanguages, availableLocales) {
        for (const userLang of userLanguages) {
            // Try exact match first (e.g., "en-US" matches "en-US")
            const exactMatch = availableLocales.find(
                (locale) => locale.toLowerCase() === userLang.toLowerCase(),
            );
            if (exactMatch) {
                return exactMatch;
            }

            // Try language prefix match (e.g., "en-US" matches "en" or "en_GB")
            const userLangPrefix = userLang.split(/[-_]/)[0].toLowerCase();
            const prefixMatch = availableLocales.find(
                (locale) =>
                    locale.split(/[-_]/)[0].toLowerCase() === userLangPrefix,
            );
            if (prefixMatch) {
                return prefixMatch;
            }
        }

        // Fall back to first available locale
        return availableLocales[0] || 'en';
    }
}
