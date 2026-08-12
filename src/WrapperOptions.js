/**
 * Shared validation and construction for the `{ as, class, id }` wrapper bag
 * that `CalendarSelect.wrapper()` and `RiteSelect.wrapper()` both accept.
 *
 * Internal, and deliberately NOT exported from `src/index.js` — contract
 * between the components, not public API, on the same reasoning as
 * `LocaleValidation.js` and `OptionsValidation.js`.
 *
 * `Input.wrapper()` deliberately does NOT use this: it takes a bare tag name
 * and pairs with a separate `wrapperClass()`. Converging it is tracked in
 * issue #46 and is explicitly out of scope here.
 *
 * The caller keeps its own "already set" guard: that message names the calling
 * class and its instance state, which this module cannot see.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import Utils from './Utils.js';

/**
 * Validates a wrapper bag and builds the element it describes.
 *
 * @param {?{as?: string, class?: string, id?: string}} wrapperOptions The wrapper
 *        configuration, or `null` for no wrapper.
 * @param {string} componentName The calling class' name, for error messages.
 * @returns {HTMLElement|null} The configured element, or `null` when
 *          `wrapperOptions` is `null` (meaning "no wrapper").
 * @throws {Error} If `wrapperOptions` is an array or a non-object, names none of
 *         `as`/`class`/`id`, or carries an invalid `as`, `class` or `id` value.
 */
export function buildWrapperElement(wrapperOptions, componentName) {
    if (null === wrapperOptions) {
        return null;
    }
    if (typeof wrapperOptions !== 'object' || Array.isArray(wrapperOptions)) {
        const wrapperOptionsType = Array.isArray(wrapperOptions)
            ? 'array'
            : typeof wrapperOptions;
        throw new Error(
            'Invalid type for wrapper options, must be of type object (not null or array) but found type: ' +
                wrapperOptionsType,
        );
    }
    if (
        Object.keys(wrapperOptions).length === 0 ||
        false ===
            Object.keys(wrapperOptions).some((key) =>
                ['as', 'class', 'id'].includes(key),
            )
    ) {
        throw new Error(
            'Invalid wrapper options, must be an object with at least an `as`, `class` or `id` property',
        );
    }

    let as = 'div';
    if (Object.hasOwn(wrapperOptions, 'as')) {
        if (typeof wrapperOptions.as !== 'string') {
            throw new Error(
                'Invalid type for wrapper `as` property, must be of type string but found type: ' +
                    typeof wrapperOptions.as,
            );
        }
        if (false === ['div', 'td'].includes(wrapperOptions.as)) {
            throw new Error(
                'Invalid value for wrapper `as` property, must be one of `div` or `td` but found: ' +
                    wrapperOptions.as,
            );
        }
        as = wrapperOptions.as;
    }

    const element = document.createElement(as);

    if (Object.hasOwn(wrapperOptions, 'class')) {
        if (typeof wrapperOptions.class !== 'string') {
            throw new Error(
                'Invalid type for wrapper class, must be of type string but found type: ' +
                    typeof wrapperOptions.class,
            );
        }
        let classNames = wrapperOptions.class.split(/\s+/);
        classNames = classNames.map((className) =>
            Utils.sanitizeInput(className),
        );
        classNames.forEach((className) => {
            if (false === Utils.validateClassName(className)) {
                throw new Error('Invalid class name: ' + className);
            }
        });
        element.className = classNames.join(' ');
    }

    if (Object.hasOwn(wrapperOptions, 'id')) {
        if (typeof wrapperOptions.id !== 'string') {
            throw new Error(
                'Invalid type for wrapper id, must be of type string but found type: ' +
                    typeof wrapperOptions.id,
            );
        }
        const id = Utils.sanitizeInput(wrapperOptions.id);
        if (false === Utils.validateId(id)) {
            throw new Error(
                'Invalid id, cannot contain any kind of whitespace character and must be a valid CSS selector: ' +
                    id,
            );
        }
        element.id = id;
    }

    return element;
}
