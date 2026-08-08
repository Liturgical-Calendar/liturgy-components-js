import Messages from '../Messages.js';
import Utils from '../Utils.js';
import { Rite } from '../Enums.js';
import { assertPlainOptions } from '../OptionsValidation.js';

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

    #domElement   = null;
    #labelElement = null;
    #hasLabel     = false;
    #labelSet     = false;
    #locale       = 'en';
    #idSet        = false;
    #nameSet      = false;

    /**
     * @param {string|object} [options='en'] Either a locale string, or an options object.
     * @param {string} [options.locale='en'] The locale to use for the rite option labels.
     * @param {string} [options.id] The id attribute for the select element.
     * @param {string} [options.class] The class attribute for the select element.
     * @param {string} [options.name] The name attribute for the select element.
     * @throws {Error} If `options` is neither a string nor a plain object.
     * @throws {Error} If the locale is invalid.
     */
    constructor( options = 'en' ) {
        if ( typeof options === 'string' ) {
            options = { locale: options };
        }
        else if ( null === options || typeof options === 'undefined' ) {
            // As in `CalendarSelect`: "no options given, use the defaults". See issue #32.
            options = { locale: 'en' };
        }
        else {
            assertPlainOptions( options, 'RiteSelect' );
        }

        const { locale: inputLocale, id, name } = options;
        if ( inputLocale !== undefined && inputLocale !== null ) {
            if ( typeof inputLocale !== 'string' ) {
                throw new Error( 'Invalid type for locale, must be of type `string` but found type: ' + typeof inputLocale );
            }
            // Matches CalendarSelect: canonicalize through `Intl.getCanonicalLocales`
            // so an invalid locale is reported with this library's own message
            // rather than as a raw `RangeError` out of `new Intl.Locale()`.
            const locale = inputLocale.replaceAll( '_', '-' );
            try {
                const canonicalLocales = Intl.getCanonicalLocales( locale );
                if ( canonicalLocales.length === 0 ) {
                    throw new Error( 'Invalid locale: ' + locale );
                }
                this.#locale = canonicalLocales[ 0 ];
            } catch ( e ) {
                throw new Error( 'Invalid locale: ' + locale );
            }
        }

        const language = new Intl.Locale( this.#locale ).language;

        this.#domElement = document.createElement( 'select' );
        this.#domElement.innerHTML = Object.values( Rite ).map( rite => {
            const key   = 'RITE_' + rite.toUpperCase();
            const label = Messages[ language ]?.[ key ] ?? Messages[ 'en' ][ key ];
            return `<option value="${rite}">${label}</option>`;
        } ).join( '' );
        this.#domElement.value = Rite.ROMAN;

        if ( Object.hasOwn( options, 'class' ) ) {
            this.class( options.class );
        }
        if ( id ) {
            this.id( id );
        }
        if ( name ) {
            this.name( name );
        }
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
    class( className ) {
        if ( typeof className !== 'string' ) {
            throw new Error( 'Invalid type for class name on RiteSelect instance, must be of type string but found type: ' + typeof className );
        }
        let classNames = className.split( /\s+/ );
        classNames = classNames.map( className => Utils.sanitizeInput( className ) );
        classNames.forEach( className => {
            if ( false === Utils.validateClassName( className ) ) {
                throw new Error( 'Invalid class name: ' + className );
            }
        } );
        className = classNames.join( ' ' );
        if ( className === '' ) {
            this.#domElement.removeAttribute( 'class' );
        } else {
            this.#domElement.setAttribute( 'class', className );
        }
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
    id( id ) {
        if ( this.#idSet && this.#domElement.id !== id ) {
            throw new Error( 'ID has already been set to `' + this.#domElement.id + '` on this RiteSelect instance.' );
        }
        if ( typeof id !== 'string' ) {
            throw new Error( 'Invalid type for id, must be of type string but found type: ' + typeof id );
        }
        id = Utils.sanitizeInput( id );
        if ( Utils.validateId( id ) === false ) {
            throw new Error( 'Invalid id, cannot contain any kind of whitespace character: ' + id );
        }
        this.#domElement.id = id;
        if ( this.#hasLabel ) {
            this.#labelElement.setAttribute( 'for', this.#domElement.id );
            if ( this.#labelElement.hasAttribute( 'id' ) ) {
                this.#domElement.setAttribute( 'aria-labelledby', this.#labelElement.id );
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
    name( name ) {
        if ( this.#nameSet && this.#domElement.name !== name ) {
            throw new Error( 'Name has already been set to `' + this.#domElement.name + '` on this RiteSelect instance.' );
        }
        if ( typeof name !== 'string' ) {
            throw new Error( 'Invalid type for name, must be of type string but found type: ' + typeof name );
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
    label( labelOptions = null ) {
        if ( this.#labelSet ) {
            throw new Error( 'Label has already been set on this RiteSelect instance.' );
        }
        if ( null === labelOptions ) {
            this.#hasLabel = false;
            this.#labelElement = null;
            this.#domElement.removeAttribute( 'aria-labelledby' );
            this.#labelSet = true;
            return this;
        }
        else if ( typeof labelOptions !== 'object' || Array.isArray( labelOptions ) ) {
            const labelOptionsType = Array.isArray( labelOptions ) ? 'array' : typeof labelOptions;
            throw new Error( 'Invalid type for label options, must be of type object (not null or array) but found type: ' + labelOptionsType );
        }
        else if ( Object.keys( labelOptions ).length === 0 || false === Object.keys( labelOptions ).some( key => [ 'class', 'id', 'text' ].includes( key ) ) ) {
            throw new Error( 'Invalid label options, must be an object with at least a `text`, `class` or `id` property' );
        }

        this.#labelElement = document.createElement( 'label' );
        this.#hasLabel = true;
        this.#labelSet = true;

        if ( this.#domElement.hasAttribute( 'id' ) ) {
            this.#labelElement.setAttribute( 'for', this.#domElement.id );
        }

        if ( Object.hasOwn( labelOptions, 'class' ) ) {
            if ( typeof labelOptions.class !== 'string' ) {
                throw new Error( 'Invalid type for label class, must be of type string but found type: ' + typeof labelOptions.class );
            }
            let classNames = labelOptions.class.split( /\s+/ );
            classNames = classNames.map( className => Utils.sanitizeInput( className ) );
            classNames.forEach( className => {
                if ( false === Utils.validateClassName( className ) ) {
                    throw new Error( 'Invalid class name: ' + className );
                }
            } );
            labelOptions.class = classNames.join( ' ' );
            this.#labelElement.className = labelOptions.class;
        }

        if ( Object.hasOwn( labelOptions, 'id' ) ) {
            if ( typeof labelOptions.id !== 'string' ) {
                throw new Error( 'Invalid type for label id, must be of type string but found type: ' + typeof labelOptions.id );
            }
            labelOptions.id = Utils.sanitizeInput( labelOptions.id );
            if ( false === Utils.validateId( labelOptions.id ) ) {
                throw new Error( 'Invalid id, cannot contain any kind of whitespace character and must be a valid CSS selector: ' + labelOptions.id );
            }
            this.#labelElement.id = labelOptions.id;
            this.#domElement.setAttribute( 'aria-labelledby', this.#labelElement.id );
        }

        if ( Object.hasOwn( labelOptions, 'text' ) ) {
            if ( typeof labelOptions.text !== 'string' ) {
                throw new Error( 'Invalid type for label text, must be of type string but found type: ' + typeof labelOptions.text );
            }
            labelOptions.text = Utils.sanitizeInput( labelOptions.text );
            this.#labelElement.textContent = labelOptions.text;
        } else {
            const language = new Intl.Locale( this.#locale ).language;
            this.#labelElement.textContent = Messages[ language ]?.[ 'SELECT_A_RITE' ] ?? Messages[ 'en' ][ 'SELECT_A_RITE' ];
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
    appendTo( element ) {
        let domNode;
        if ( typeof element === 'string' ) {
            domNode = Utils.validateElementSelector( element );
        }
        else if ( element instanceof HTMLElement ) {
            domNode = element;
        } else {
            throw new Error( 'RiteSelect.appendTo: parameter must be a valid CSS selector or an instance of HTMLElement' );
        }
        domNode.appendChild( this.#domElement );
        if ( this.#hasLabel ) {
            // Matches CalendarSelect.appendTo(): the select is appended first,
            // then the label is placed immediately before it via
            // insertAdjacentElement rather than appendChild, so the label
            // always ends up adjacent to (and before) the select regardless
            // of what else domNode already contains.
            this.#domElement.insertAdjacentElement( 'beforebegin', this.#labelElement );
        }
    }

    /**
     * Gets the underlying DOM element of the RiteSelect instance.
     *
     * @returns {HTMLElement} The underlying DOM element of the RiteSelect instance.
     * @readonly
     */
    get _domElement() {
        return this.#domElement;
    }

    /**
     * Gets the locale that was used to build this RiteSelect instance's option labels.
     *
     * @returns {string}
     * @readonly
     */
    get _locale() {
        return this.#locale;
    }
}
