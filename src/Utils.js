
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
    static validateElementSelector( element ) {
        if (typeof element !== 'string') {
            throw new Error('Invalid type for element selector, must be of type string but found type: ' + typeof element);
        }
        const domNode = document.querySelector( element );
        if ( null === domNode ) {
            throw new Error('Invalid element selector: ' + element);
        }
        return domNode;
    }

    /**
     * Checks if the provided class name is valid.
     *
     * The regex pattern used to validate class names:
     *   - `^` asserts the start of a line
     *   - `(?!\d|--|-?\d)` is a negative look ahead that prevents the class name
     *                  from starting with a digit, or a sequence of dashes, or a number with a leading dash
     *   - `[a-zA-Z_-]` matches any character that is a letter, a dash or an underscore
     *   - `[a-zA-Z\d_-]{1,}` matches any alphanumeric character, a dash or an underscore
     *
     * @param {string} className - The class name to be validated.
     * @returns {boolean} `true` if the class name is valid, `false` otherwise.
     */
    static validateClassName( className ) {
        /**
         * The regex pattern used to validate class names:
         *   - `^` asserts the start of a line
         *   - `(?!\d|--|-?\d)` is a negative look ahead that prevents the class name
         *                  from starting with a digit, or a sequence of dashes, or a number with a leading dash
         *   - `[a-zA-Z_-]` matches any character that is a letter, a dash or an underscore
         *   - `[a-zA-Z\d_-]{1,}` matches any alphanumeric character, a dash or an underscore at least once
         *   - `$` asserts the end of a line
         */
        const pattern = /^(?!\d|--|-?\d)[a-zA-Z_-][a-zA-Z\d_-]{1,}$/;
        return pattern.test(className);
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
    static validateId( id ) {
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
        const pattern = /^(?!\d|--|-?\d)(?:[_-][a-zA-Z][\w\-]*|[a-zA-Z][\w\-]*)$/;
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
        return doc.body.textContent || "";
    }
}
