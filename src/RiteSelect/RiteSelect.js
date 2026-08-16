import { message } from '../MessageLookup.js';
import Utils from '../Utils.js';
import { Rite } from '../Enums.js';
import { normalizeComponentOptions } from '../OptionsValidation.js';
import { canonicalizeLocale } from '../LocaleValidation.js';
import { buildWrapperElement } from '../WrapperOptions.js';

/**
 * A select menu for the liturgical rite a calendar request is computed under.
 *
 * Standalone rather than an `ApiOptions/Input/` class because rite is a PATH
 * segment, like nation and diocese, whereas the `Input` classes map to query
 * parameters.
 *
 * @example
 * const riteSelect = new RiteSelect( 'it-IT' );
 * riteSelect.class( 'form-select' ).appendTo( '#rite-select' );
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 * @see https://github.com/Liturgical-Calendar/liturgy-components-js
 */
export default class RiteSelect {
    #domElement = null;
    #labelElement = null;
    #hasLabel = false;
    #labelSet = false;
    #wrapperElement = null;
    #hasWrapper = false;
    #wrapperSet = false;
    #locale = 'en';
    #idSet = false;
    #nameSet = false;

    /** @type {string[]} The rites this select offers, in order. */
    #rites = Object.values(Rite);

    /**
     * Validates a rite list and returns it.
     *
     * @param {unknown} list - The candidate list.
     * @returns {string[]} The validated list.
     * @throws {Error} If it is not a non-empty array of distinct known rites.
     */
    static #assertRites(list) {
        if (false === Array.isArray(list)) {
            throw new Error(
                `RiteSelect: rites must be an array of rite names, but found type: ${typeof list}`,
            );
        }
        if (0 === list.length) {
            throw new Error(
                'RiteSelect: rites must name at least one rite, but the array is empty.',
            );
        }
        const known = Object.values(Rite);
        for (const rite of list) {
            if (false === known.includes(rite)) {
                throw new Error(
                    `RiteSelect: unknown rite '${rite}'. Valid rites are: ${known.join(', ')}.`,
                );
            }
        }
        if (new Set(list).size !== list.length) {
            throw new Error(
                `RiteSelect: rites contains a duplicate: ${list.join(', ')}.`,
            );
        }
        return [...list];
    }

    /**
     * Rebuilds the select's `innerHTML` from `#rites`, and selects the first one.
     *
     * Shared by the constructor and `rites()` so both paths render options the
     * same way.
     *
     * @private
     */
    #renderOptions() {
        this.#domElement.innerHTML = this.#rites
            .map((rite) => {
                const key = 'RITE_' + rite.toUpperCase();
                // Not `label`: that name now belongs to the destructured option
                // below. The shadowing was harmless while nothing outside this
                // callback used it, and stops being obvious the moment something does.
                const optionLabel = message(key, this.#locale);
                return `<option value="${rite}">${optionLabel}</option>`;
            })
            .join('');
        this.#domElement.value = this.#rites[0];
    }

    /**
     * @param {string|Intl.Locale|object} [options='en'] A locale string, an `Intl.Locale`, or an options object.
     *        `null` and `undefined` both mean "no options given" and take the defaults.
     * @param {string|Intl.Locale} [options.locale='en'] The locale to use for the rite option labels.
     * @param {string} [options.id] The id attribute for the select element.
     * @param {string} [options.class] The class attribute for the select element.
     * @param {string} [options.name] The name attribute for the select element.
     * @param {string[]} [options.rites] The rites to offer, in order. Omitting it offers every rite.
     * @param {object} [options.label] Label options, forwarded to {@link RiteSelect#label}.
     * @param {?object} [options.wrapper] Wrapper options, forwarded to {@link RiteSelect#wrapper}.
     * @throws {Error} If `options` is none of a string, an `Intl.Locale`, a plain object or nullish.
     * @throws {Error} If the locale is invalid.
     * @throws {Error} If `rites` is not a non-empty array of distinct known rites.
     * @throws {Error} If `label` or `wrapper` carries an invalid value; the same errors
     *         the corresponding method throws when called directly.
     */
    constructor(options = 'en') {
        options = normalizeComponentOptions(options, 'RiteSelect');

        const { locale: inputLocale, id, name, label, wrapper } = options;
        if (inputLocale !== undefined && inputLocale !== null) {
            this.#locale = canonicalizeLocale(inputLocale, 'RiteSelect');
        }

        this.#domElement = document.createElement('select');
        this.#renderOptions();

        if (Object.hasOwn(options, 'rites')) {
            this.rites(options.rites);
        }

        if (Object.hasOwn(options, 'class')) {
            this.class(options.class);
        }
        if (id) {
            this.id(id);
        }
        if (name) {
            this.name(name);
        }
        // `label` before `wrapper`, mirroring `CalendarSelect`'s constructor. Both
        // were silently DROPPED here until 2.4.0 — the bag accepted them, because
        // `normalizeComponentOptions()` rejects no unknown keys, and then nothing
        // read them. `CalendarSelect` has honoured both since it gained them, and
        // the two selects are documented as interchangeable in this respect, so a
        // caller reaching for the bag form on a rite select got silence.
        if (label) {
            this.label(label);
        }
        if (wrapper) {
            this.wrapper(wrapper);
        }
    }

    /**
     * Restricts the select to the named rites, in the order given.
     *
     * The first entry becomes the selected value, which is what makes
     * `scope.rite`'s first-element-is-initial rule visible in the DOM.
     *
     * **Calling this AFTER `linkToRiteSelect()` silently desynchronises the
     * link.** `#renderOptions()` rebuilds the `<select>` and resets its value
     * to `list[0]` directly on the element, without dispatching a `change`
     * event — so `ApiOptions`/`ApiClient`, which learn of a rite switch only
     * through that event, keep whatever rite they last saw and never learn
     * this one happened. The value shown in the DOM and the rite the next
     * fetch actually requests then disagree, with nothing to notice it by.
     * Every meta-component in this library only ever calls this at
     * CONSTRUCTION time, before `linkToRiteSelect()` runs, which is safe: the
     * one option is the `rites` key on the widening component's own
     * constructor bag (e.g. `CalendarControls({ scope: {...} })`), consumed
     * before the rite select is linked to anything. Calling it again later,
     * on an already-linked select, is unsupported and left undocumented
     * behaviour rather than fixed here — dispatching `change` unconditionally
     * would fire on every construction-time call too, which no consumer of
     * this method currently expects.
     *
     * @param {string[]} list - The rites to offer.
     * @returns {RiteSelect} This instance, for chaining.
     * @throws {Error} If the list is not a non-empty array of distinct known rites.
     */
    rites(list) {
        this.#rites = RiteSelect.#assertRites(list);
        this.#renderOptions();
        return this;
    }

    /**
     * Sets the class attribute for the RiteSelect instance's DOM element.
     *
     * Mirrors `CalendarSelect.class()`: the className is split on whitespace,
     * each token is sanitized and then validated (in that order), and the
     * cleaned tokens are joined back together. An empty result removes the
     * `class` attribute entirely.
     *
     * @param {string} className A space-separated string of class names to be assigned to the DOM element.
     * @throws {Error} If the className is not a string, or if any class name is invalid.
     * @returns {RiteSelect} The current `RiteSelect` instance for chaining.
     */
    class(className) {
        if (typeof className !== 'string') {
            throw new Error(
                'Invalid type for class name on RiteSelect instance, must be of type string but found type: ' +
                    typeof className,
            );
        }
        let classNames = className.split(/\s+/);
        classNames = classNames.map((className) =>
            Utils.sanitizeInput(className),
        );
        classNames.forEach((className) => {
            if (false === Utils.validateClassName(className)) {
                throw new Error('Invalid class name: ' + className);
            }
        });
        className = classNames.join(' ');
        if (className === '') {
            this.#domElement.removeAttribute('class');
        } else {
            this.#domElement.setAttribute('class', className);
        }
        return this;
    }

    /**
     * Wraps the select (and its label, when one is set) in a container element.
     *
     * Mirrors `CalendarSelect.wrapper()` exactly, rather than `Input.wrapper()`:
     * a rite select is a select, and `Input`'s split `wrapper()` /
     * `wrapperClass()` shape would give the meta-components' theme bag two
     * different contracts to drive for its two selects. `Input`'s convergence
     * onto this shape is tracked separately in issue #46.
     *
     * One-shot: a second call throws rather than silently replacing a wrapper
     * a previous call already configured.
     *
     * @param {?{as?: string, class?: string, id?: string}} [wrapperOptions=null] The wrapper
     *        configuration, or `null` for no wrapper. `as` is `'div'` or `'td'` and defaults
     *        to `'div'`.
     * @throws {Error} If a wrapper has already been set on this instance.
     * @throws {Error} If `wrapperOptions` is an array or a non-object, names none of
     *         `as`/`class`/`id`, or carries an invalid `as`, `class` or `id` value.
     * @returns {RiteSelect} The current `RiteSelect` instance for chaining.
     */
    wrapper(wrapperOptions = null) {
        if (this.#wrapperSet) {
            throw new Error(
                'Wrapper has already been set on RiteSelect instance with locale ' +
                    this.#locale +
                    '.',
            );
        }
        const element = buildWrapperElement(wrapperOptions, 'RiteSelect');
        this.#wrapperElement = element;
        this.#hasWrapper = null !== element;
        this.#wrapperSet = true;
        return this;
    }

    /**
     * Sets the `id` attribute of the select element.
     *
     * If the id has already been set to a different value, an error is thrown.
     * Setting it again to the same value is a no-op that returns `this`.
     * If a label has already been set, the label's `for` (and `aria-labelledby`
     * on the select, when the label itself has an id) are kept in sync.
     *
     * @param {string} id The id attribute of the select element.
     * @throws {Error} If the id is not a string, or if the id is invalid.
     * @returns {RiteSelect} The current `RiteSelect` instance for chaining.
     */
    id(id) {
        if (this.#idSet && this.#domElement.id !== id) {
            throw new Error(
                'ID has already been set to `' +
                    this.#domElement.id +
                    '` on this RiteSelect instance.',
            );
        }
        if (typeof id !== 'string') {
            throw new Error(
                'Invalid type for id, must be of type string but found type: ' +
                    typeof id,
            );
        }
        id = Utils.sanitizeInput(id);
        if (Utils.validateId(id) === false) {
            throw new Error(
                'Invalid id, cannot contain any kind of whitespace character: ' +
                    id,
            );
        }
        this.#domElement.id = id;
        if (this.#hasLabel) {
            this.#labelElement.setAttribute('for', this.#domElement.id);
            if (this.#labelElement.hasAttribute('id')) {
                this.#domElement.setAttribute(
                    'aria-labelledby',
                    this.#labelElement.id,
                );
            }
        }
        this.#idSet = true;
        return this;
    }

    /**
     * Sets the `name` attribute of the select element.
     *
     * @param {string} name The name attribute of the select element.
     * @throws {Error} If the name is not a string, or if it has already been set to a different value.
     * @returns {RiteSelect} The current `RiteSelect` instance for chaining.
     */
    name(name) {
        if (this.#nameSet && this.#domElement.name !== name) {
            throw new Error(
                'Name has already been set to `' +
                    this.#domElement.name +
                    '` on this RiteSelect instance.',
            );
        }
        if (typeof name !== 'string') {
            throw new Error(
                'Invalid type for name, must be of type string but found type: ' +
                    typeof name,
            );
        }
        this.#domElement.name = name;
        this.#nameSet = true;
        return this;
    }

    /**
     * Configures the `label` element for the `RiteSelect` DOM input.
     *
     * If `labelOptions` is `null`, any existing label is removed and no label
     * is created. Otherwise it must be a plain object with at least one of
     * `class`, `id` or `text`.
     *
     * @param {Object|null} [labelOptions=null] An object specifying label options, or null to disable the label.
     * @param {string} [labelOptions.class] CSS classes to apply to the label element.
     * @param {string} [labelOptions.id] The id attribute for the label element.
     * @param {string} [labelOptions.text] The text content for the label element.
     * @throws {Error} If the label has already been set, or the options are invalid.
     * @returns {RiteSelect} The current `RiteSelect` instance for chaining.
     */
    label(labelOptions = null) {
        if (this.#labelSet) {
            throw new Error(
                'Label has already been set on this RiteSelect instance.',
            );
        }
        if (null === labelOptions) {
            this.#hasLabel = false;
            this.#labelElement = null;
            this.#domElement.removeAttribute('aria-labelledby');
            this.#labelSet = true;
            return this;
        } else if (
            typeof labelOptions !== 'object' ||
            Array.isArray(labelOptions)
        ) {
            const labelOptionsType = Array.isArray(labelOptions)
                ? 'array'
                : typeof labelOptions;
            throw new Error(
                'Invalid type for label options, must be of type object (not null or array) but found type: ' +
                    labelOptionsType,
            );
        } else if (
            Object.keys(labelOptions).length === 0 ||
            false ===
                Object.keys(labelOptions).some((key) =>
                    ['class', 'id', 'text'].includes(key),
                )
        ) {
            throw new Error(
                'Invalid label options, must be an object with at least a `text`, `class` or `id` property',
            );
        }

        this.#labelElement = document.createElement('label');
        this.#hasLabel = true;
        this.#labelSet = true;

        if (this.#domElement.hasAttribute('id')) {
            this.#labelElement.setAttribute('for', this.#domElement.id);
        }

        if (Object.hasOwn(labelOptions, 'class')) {
            if (typeof labelOptions.class !== 'string') {
                throw new Error(
                    'Invalid type for label class, must be of type string but found type: ' +
                        typeof labelOptions.class,
                );
            }
            let classNames = labelOptions.class.split(/\s+/);
            classNames = classNames.map((className) =>
                Utils.sanitizeInput(className),
            );
            classNames.forEach((className) => {
                if (false === Utils.validateClassName(className)) {
                    throw new Error('Invalid class name: ' + className);
                }
            });
            labelOptions.class = classNames.join(' ');
            this.#labelElement.className = labelOptions.class;
        }

        if (Object.hasOwn(labelOptions, 'id')) {
            if (typeof labelOptions.id !== 'string') {
                throw new Error(
                    'Invalid type for label id, must be of type string but found type: ' +
                        typeof labelOptions.id,
                );
            }
            labelOptions.id = Utils.sanitizeInput(labelOptions.id);
            if (false === Utils.validateId(labelOptions.id)) {
                throw new Error(
                    'Invalid id, cannot contain any kind of whitespace character and must be a valid CSS selector: ' +
                        labelOptions.id,
                );
            }
            this.#labelElement.id = labelOptions.id;
            this.#domElement.setAttribute(
                'aria-labelledby',
                this.#labelElement.id,
            );
        }

        if (Object.hasOwn(labelOptions, 'text')) {
            if (typeof labelOptions.text !== 'string') {
                throw new Error(
                    'Invalid type for label text, must be of type string but found type: ' +
                        typeof labelOptions.text,
                );
            }
            labelOptions.text = Utils.sanitizeInput(labelOptions.text);
            this.#labelElement.textContent = labelOptions.text;
        } else {
            this.#labelElement.textContent = message(
                'SELECT_A_RITE',
                this.#locale,
            );
        }

        return this;
    }

    /**
     * Appends the select element (and its label, if set) to the element
     * matched by the provided element selector (or the element provided
     * directly).
     *
     * @param {string|HTMLElement} element The element selector of the element to append the select element to, or the element itself.
     * @throws {Error} If `element` is neither a valid CSS selector nor an HTMLElement.
     */
    appendTo(element) {
        let domNode;
        if (typeof element === 'string') {
            domNode = Utils.validateElementSelector(element);
        } else if (element instanceof HTMLElement) {
            domNode = element;
        } else {
            throw new Error(
                'RiteSelect.appendTo: parameter must be a valid CSS selector or an instance of HTMLElement',
            );
        }
        if (this.#hasWrapper) {
            domNode.appendChild(this.#wrapperElement);
            this.#wrapperElement.appendChild(this.#domElement);
        } else {
            domNode.appendChild(this.#domElement);
        }
        if (this.#hasLabel) {
            // Matches CalendarSelect.appendTo(): the select is appended first,
            // then the label is placed immediately before it via
            // insertAdjacentElement rather than appendChild, so the label
            // always ends up adjacent to (and before) the select regardless
            // of what else domNode already contains.
            this.#domElement.insertAdjacentElement(
                'beforebegin',
                this.#labelElement,
            );
        }
    }

    /**
     * Hide or show this select, preferring its wrapper when one was set via
     * `wrapper()` so the label goes with it.
     *
     * **With no wrapper, the label element (if any) is hidden too**, alongside
     * the select itself — see `CalendarSelect._setHidden()`'s doc comment for
     * why: a preset supplying no `wrapper` (`bootstrap5`, deliberately) would
     * otherwise leave "Select a rite" dangling over nothing once the select
     * hides. A no-op in effect when a wrapper IS present, since hiding it
     * already takes the label with it.
     *
     * @param {boolean} hidden
     */
    _setHidden(hidden) {
        if (null !== this.#wrapperElement) {
            this.#wrapperElement.hidden = hidden;
            return;
        }
        this.#domElement.hidden = hidden;
        if (null !== this.#labelElement) {
            this.#labelElement.hidden = hidden;
        }
    }

    /**
     * Gets the underlying DOM element of the RiteSelect instance.
     *
     * @returns {HTMLElement} The underlying DOM element of the RiteSelect instance.
     */
    get _domElement() {
        return this.#domElement;
    }

    /**
     * Gets the locale that was used to build this RiteSelect instance's option labels.
     *
     * @returns {string}
     */
    get _locale() {
        return this.#locale;
    }
}
