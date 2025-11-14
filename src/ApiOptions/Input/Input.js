import Utils from '../../Utils.js';

export default class Input {
    /** @type {string | null} */
    static #globalInputClass   = null;
    /** @type {string | null} */
    static #globalLabelClass   = null;
    /** @type {string | null} */
    static #globalWrapper      = null;
    /** @type {string | null} */
    static #globalWrapperClass = null;
    /** @type {HTMLSelectElement | HTMLInputElement | null} */
    #domElement       = null;
    /** @type {HTMLElement|null} */
    #labelElement     = null;
    /** @type {DocumentFragment|null} */
    #labelAfter       = null;
    /** @type {HTMLElement|null} */
    #wrapperElement   = null;
    #idSet            = false;
    #nameSet          = false;
    #classSet         = false;
    #dataSet          = false;
    #labelClassSet    = false;
    #hasWrapper       = false;
    #wrapperClassSet  = false;
    #defaultValue    = '';

    /**
     * Sets a global class attribute for all input elements created by this class.
     *
     * Validates the input class name(s) to ensure they are strings and conform to
     * CSS class naming conventions. The input class name is sanitized and assigned
     * to the global input class.
     *
     * @param {string} [className=''] - A space-separated string of class names to be
     * assigned globally.
     * @throws {Error} If the className is not a string, or if any class name is invalid.
     */
    static setGlobalInputClass( className = '' ) {
        if (typeof className !== 'string') {
            throw new Error('Invalid type for value passed to globalInputClass, must be of type string but found type: ' + typeof className);
        }
        className = Utils.sanitizeInput(className);
        const classNames = className.split(/\s+/);
        classNames.forEach(className => {
            if (false === Utils.validateClassName(className)) {
                throw new Error('Invalid class value passed to globalInputClass: ' + className);
            }
        });
        Input.#globalInputClass = classNames.join(' ');
    }

    /**
     * Sets a global class attribute for all label elements created by this class.
     *
     * Validates the class name(s) to ensure they are strings and conform to CSS class naming conventions.
     * The input class name is sanitized and assigned to the global label class.
     *
     * @param {string} [className=''] - A space-separated string of class names to be assigned globally.
     * @throws {Error} If the className is not a string, or if any class name is invalid.
     */
    static setGlobalLabelClass( className = '' ) {
        if (typeof className !== 'string') {
            throw new Error('Invalid type for value passed to globalLabelClass, must be of type string but found type: ' + typeof className);
        }
        className = Utils.sanitizeInput(className);
        const classNames = className.split(/\s+/);
        classNames.forEach(className => {
            if (false === Utils.validateClassName(className)) {
                throw new Error('Invalid class value passed to globalLabelClass: ' + className);
            }
        });
        Input.#globalLabelClass = classNames.join(' ');
    }

    /**
     * Sets a global wrapper element for all input elements created by this class.
     *
     * Validates the wrapper element to ensure it is a string and is one of the valid values.
     * The input wrapper element is sanitized and assigned to the global wrapper element.
     *
     * @param {string} [wrapper] - The wrapper element, currently only 'div' and 'td' are supported.
     * @throws {Error} If the wrapper is not a string, or if the wrapper is not one of the valid values.
     */
    static setGlobalWrapper( wrapper ) {
        if (typeof wrapper !== 'string') {
            throw new Error('Invalid type for wrapper, must be of type string but found type: ' + typeof wrapper);
        }
        if (false === ['div', 'td'].includes(wrapper)) {
            throw new Error('Invalid wrapper: ' + wrapper + ', valid values are: div, td');
        }
        Input.#globalWrapper = wrapper;
    }

    /**
     * Sets a global class attribute for all wrapper elements created by this class.
     *
     * Validates the class name(s) to ensure they are strings and conform to CSS class naming conventions.
     * The input class name is sanitized and assigned to the global wrapper class.
     *
     * @param {string} [className=''] - A space-separated string of class names to be assigned globally.
     * @throws {Error} If the className is not a string, or if any class name is invalid.
     */
    static setGlobalWrapperClass( className = '' ) {
        if (typeof className !== 'string') {
            throw new Error('Invalid type for value passed to globalWrapperClass, must be of type string but found type: ' + typeof className);
        }
        className = Utils.sanitizeInput(className);
        const classNames = className.split(/\s+/);
        classNames.forEach(className => {
            if (false === Utils.validateClassName(className)) {
                throw new Error('Invalid class value passed to globalWrapperClass: ' + className);
            }
        });
        Input.#globalWrapperClass = classNames.join(' ');
    }

    /**
     * @param {string} [element='select'] - The element to create as the input element.
     *     Valid values are: `select`, `input`.
     * @param {object} [attributes={multiple: false}] - Key-value pairs of attributes to set on the element.
     *     When the element is `input`, the only current supported attribute is `type` with a value of `number` (which will produce an `input[type="number"]` element).
     *     When the element is `select`, the `multiple` attribute can be set to `true` to create a multi-select element.
     * @throws {Error} If the element parameter is not a string or is not one of the valid values.
     */
    constructor(element = 'select', attributes = {multiple: false}) {
        if (typeof element !== 'string') {
            throw new Error('Invalid type for element parameter, must be of type string but found type: ' + typeof element);
        }
        if (false === ['select', 'input'].includes(element)) {
            throw new Error('Invalid `element` parameter: ' + element + ', valid values are: `select` and `input`');
        }
        if (attributes !== undefined && (attributes === null || typeof attributes !== 'object')) {
            throw new Error('Invalid type for attributes parameter, when set it must be of type object but found type: ' + typeof attributes);
        }
        switch (element) {
            case 'select':
                if (attributes && typeof attributes.multiple !== 'undefined') {
                    if (typeof attributes.multiple !== 'boolean') {
                        throw new Error('Invalid type for multiple attribute, when set it must be of type boolean but found type: ' + typeof attributes.multiple);
                    }
                }
                break;
            case 'input':
                if (attributes && typeof attributes.type !== 'undefined') {
                    if (typeof attributes.type !== 'string') {
                        throw new Error('Invalid type for type attribute, when set it must be of type string but found type: ' + typeof attributes.type);
                    }
                    if (false === ['number'].includes(attributes.type)) {
                        throw new Error('Invalid type attribute for input element: ' + attributes.type + ', valid values are: `number`');
                    }
                }
                break;
        }
        this.#domElement = document.createElement(element);
        if (attributes && typeof attributes === 'object') {
            switch (element) {
                case 'select':
                    if (attributes.multiple !== undefined && attributes.multiple === true) {
                        this.#domElement.setAttribute('multiple', 'multiple');
                    }
                    break;
                case 'input':
                    if (attributes.type !== undefined && attributes.type === 'number') {
                        this.#domElement.setAttribute('type', 'number');
                    }
                    break;
            }
        }

        if (Input.#globalInputClass !== null) {
            this.#domElement.className = Input.#globalInputClass;
        }

        this.#labelElement = document.createElement('label');
        if (Input.#globalLabelClass !== null) {
            this.#labelElement.className = Input.#globalLabelClass;
        }

        if (Input.#globalWrapper !== null) {
            this.#wrapperElement = document.createElement(Input.#globalWrapper);
            this.#hasWrapper = true;
            if (Input.#globalWrapperClass !== null) {
                this.#wrapperElement.className = Input.#globalWrapperClass;
            }
        }
    }

    /**
     * Sets the id attribute for the Input instance's DOM element.
     *
     * Validates the input id to ensure it is a string and conforms to
     * CSS id naming conventions. If the id is valid, it is sanitized
     * and assigned to the element. If the id has already been set,
     * an error is thrown.
     *
     * @param {string} id - A string to be assigned to the id attribute of the DOM element.
     * @throws {Error} If the id is not a string, or if the id is invalid, or if the id has already been set.
     * @returns {Input} The current Input instance for chaining.
     */
    id( id = '' ) {
        if (this.#idSet && this.#domElement.id !== id) {
            console.error('ID has already been set to `' + this.#domElement.id + '` on Input instance.');
            console.error(this);
            throw new Error('ID has already been set to `' + this.#domElement.id + '` on Input instance.');
        }
        if (false === (typeof id === 'string')) {
            throw new Error('Invalid type for id on Input instance, must be of type string but found type: ' + typeof id);
        }
        id = Utils.sanitizeInput(id);
        if (false === Utils.validateId(id)) {
            throw new Error(`Invalid id '${id}' on Input instance, must be a valid CSS selector`);
        }
        this.#domElement.id = id;
        this.#idSet = true;
        this.#labelElement.htmlFor = this.#domElement.id;
        return this;
    }

    /**
     * Sets the name attribute for the Input instance's DOM element.
     *
     * Validates the input name to ensure it is a non-empty string. If the name is valid,
     * it is sanitized and assigned to the element. If the name is an empty string,
     * or if the name has already been set, an error will be thrown.
     *
     * @param {string} name The name attribute of the select element.
     * @throws {Error} If the name is not a string, or if the name has already been set.
     * @returns {Input} The current Input instance for chaining.
     */
    name( name = '' ) {
        if (this.#nameSet && this.#domElement.name !== name) {
            console.error('Name has already been set to `' + this.#domElement.name + '` on Input instance.');
            console.error(this);
            throw new Error('Name has already been set to `' + this.#domElement.name + '` on Input instance.');
        }
        if (false === (typeof name === 'string')) {
            throw new Error('Invalid type for name on Input instance, must be of type string but found type: ' + typeof name);
        }
        if ( '' === name ) {
            throw new Error('Name cannot be empty on Input instance.');
        }
        this.#domElement.name = Utils.sanitizeInput(name);
        this.#nameSet = true;
        return this;
    }

    /**
     * Sets the class attribute for the Input instance's DOM element.
     *
     * Validates the input class name(s) to ensure they are strings and conform to
     * CSS class naming conventions. If the class name is valid, it is sanitized
     * and assigned to the element. If the class name is an empty string, the
     * class attribute is removed.
     *
     * @param {string} className - A space-separated string of class names to be
     * assigned to the DOM element.
     * @throws {Error} If the className is not a string, or if any class name is
     * invalid.
     * @returns {Input} The current Input instance for chaining.
     */
    class( className = '' ) {
        if (this.#classSet && this.#domElement.className !== className) {
            console.error('Class has already been set to `' + this.#domElement.className + '` on Input instance:');
            console.error(this);
            throw new Error('Class has already been set to `' + this.#domElement.className + '` on Input instance.');
        }
        if (typeof className !== 'string') {
            console.error('Invalid type for class name on Input instance, must be of type string but found type: ' + typeof className);
            console.error(this);
            throw new Error('Invalid type for class name on Input instance, must be of type string but found type: ' + typeof className);
        }
        className = Utils.sanitizeInput(className);
        const classNames = className.split(/\s+/);
        classNames.forEach(className => {
            if (false === Utils.validateClassName(className)) {
                throw new Error('Invalid class name: ' + className);
            }
        });
        this.#domElement.className = classNames.join(' ');
        this.#classSet = true;
        return this;
    }

    /**
     * Sets the class or classes to apply to the label element of the Input instance.
     *
     * This method validates the provided class name(s) to ensure they are strings
     * and conform to CSS class naming conventions. It sanitizes the class name(s)
     * and assigns them to the label element. If the class name is already set and
     * differs from the provided value, an error is thrown. The class name(s) can be
     * space-separated.
     *
     * @param {string} labelClass - A space-separated string of class names to be
     * assigned to the label element.
     * @throws {Error} If the labelClass is not a string, or if any class name is invalid.
     * @returns {Input} The current Input instance for chaining.
     */
    labelClass( labelClass = '' ) {
        if (this.#labelClassSet && this.#labelElement.className !== labelClass) {
            console.error('Label class has already been set to `' + this.#labelElement.className + '` on Input instance.');
            console.error(this);
            throw new Error('Label class has already been set to `' + this.#labelElement.className + '` on Input instance.');
        }
        if (false === (typeof labelClass === 'string')) {
            throw new Error('Invalid type for label class on Input instance, must be of type string but found type: ' + typeof labelClass);
        }
        labelClass = Utils.sanitizeInput(labelClass);
        const classNames = labelClass.split(/\s+/);
        classNames.forEach(className => {
            if (false === Utils.validateClassName(className)) {
                throw new Error(`Invalid label class '${className}' on Input instance, must be a valid CSS class`);
            }
        });
        this.#labelElement.className = classNames.join(' ');
        this.#labelClassSet = true;
        return this;
    }

    /**
     * Sets content to be inserted after the label element.
     *
     * This method allows appending content after the label element by creating
     * a DocumentFragment from the provided content string. The content string is
     * sanitized to remove PHP and script tags for security purposes. If no content
     * is provided (null), it removes any previously set content. Throws an error
     * if the method is called more than once since the content can only be set once.
     *
     * @param {string|null} contents - The content to be set after the label element.
     * @throws {Error} If content is attempted to be set more than once.
     * @returns {Input} The current instance for method chaining.
     */
    labelAfter( contents = '' ) {
        if (this.#labelAfter !== null) {
            //console.error('Label after content has already been set on Input instance.');
            //console.error(this);
            throw new Error('labelAfter content has already been set on Input instance.');
        }
        if (contents === null) {
            this.#labelAfter = null;
            return this;
        }
        // remove php tags and script tags from contents
        // the regex is doing the following:
        //  - `<\?(?:php)?` matches the start of a php tag, optionally with the word "php" after the "?"
        //  - `|` is a logical OR operator
        //  - `\?>` matches the end of a php tag
        //  - `|` is a logical OR operator
        //  - `<script(.*?)>.*?<\/script>` matches the start of a script tag, any attributes, the contents of the script tag, and the end of the script tag
        //  - `g` flag makes the regex replacement global, so it will replace all occurrences of the regex, not just the first one
        contents = contents.replace(/<\?(?:php)?|\?>|<script(.*?)>.*?<\/script>/g, '');
        if (contents !== '') {
            const fragment = document.createRange().createContextualFragment(contents);
            this.#labelAfter = fragment;
        }
        return this;
    }

    /**
     * Sets the type of HTML element to use as the wrapper element.
     *
     * If the `wrapper` argument is not provided, the wrapper element will be set to `div`.
     * If the `wrapper` argument is provided but is not a string, an error will be thrown.
     * If the `wrapper` argument is provided and is a string, it must be one of the following valid values:
     * - 'div'
     * - 'td'
     *
     * @param {string} [wrapper='div'] The type of HTML element to use as the wrapper element.
     *
     * @return {Input} The current instance for method chaining.
     *
     * @throws {Error} If the `wrapper` argument is not a string or is not one of the valid values.
     */
    wrapper( wrapper = 'div' ) {
        if (typeof wrapper !== 'string') {
            throw new Error('Invalid type for wrapper, must be of type string but found type: ' + typeof wrapper);
        }
        wrapper = Utils.sanitizeInput(wrapper);
        if (false === ['div', 'td'].includes(wrapper)) {
            throw new Error('Invalid wrapper: ' + wrapper + ', valid values are: div, td');
        }
        this.#wrapperElement = document.createElement(wrapper);
        this.#hasWrapper = true;
        if (Input.#globalWrapperClass !== null) {
            this.#wrapperElement.className = Input.#globalWrapperClass;
        }
        return this;
    }

    /**
     * Sets the class for the wrapper element.
     *
     * If a wrapper element has not been set, an error will be thrown.
     * If the wrapper element has already been set with a class, an error will be thrown.
     * This method accepts a string of space-separated class names.
     * The class names will be validated to ensure they are valid CSS classes.
     * If any of the class names are invalid, an error will be thrown.
     *
     * @param {string} [wrapperClass=''] - The class for the wrapper element.
     * @throws {Error} If the type of wrapperClass is not a string.
     * @throws {Error} If the wrapper element has not been set.
     * @throws {Error} If the wrapper element has already been set with a class.
     * @throws {Error} If any of the class names are invalid.
     * @return {Input} - The same instance of Input.
     */
    wrapperClass( wrapperClass = '') {
        if (this.#wrapperClassSet && this.#wrapperElement.className !== wrapperClass) {
            console.error('Wrapper class has already been set to `' + this.#wrapperElement.className + '` on Input instance.');
            console.error(this);
            throw new Error('Wrapper class has already been set to `' + this.#wrapperElement.className + '` on Input instance.');
        }
        if (typeof wrapperClass !== 'string') {
            throw new Error('Invalid type for wrapper class on Input instance, must be of type string but found type: ' + typeof wrapperClass);
        }
        if (null === this.#wrapperElement) {
            throw new Error('Wrapper has not been set, cannot set wrapper class on Input instance.');
        }
        wrapperClass = Utils.sanitizeInput(wrapperClass);
        const classNames = wrapperClass.split(/\s+/);
        classNames.forEach(className => {
            if (false === Utils.validateClassName(className)) {
                throw new Error(`Invalid wrapper class '${className}' on Input instance, must be a valid CSS class`);
            }
        });
        this.#wrapperElement.className = classNames.join(' ');
        this.#wrapperClassSet = true;
        return this;
    }

    /**
     * Sets the data attributes for the input element.
     *
     * This method accepts an associative array where the keys are the data attribute names
     * (without the 'data-' prefix) and the values are the corresponding attribute values.
     * These data attributes will be used to form the 'data-*' attributes in the HTML input element.
     *
     * @param {object} [data={}] An associative array representing data attributes for the input element.
     *
     * @return {Input} Returns the current instance to allow method chaining.
     */
    data( data = {} ) {
        if (this.#dataSet) {
            console.error('Data attributes have already been set on Input instance.');
            console.error(this);
            throw new Error('Data attributes have already been set on Input instance.');
        }
        if (typeof data !== 'object') {
            throw new Error('Invalid type for data, must be of type object but found type: ' + typeof data);
        }
        Object.entries(data).forEach(([key, value]) => {
            if (typeof key !== 'string') {
                throw new Error('Invalid type for data key, must be of type string but found type: ' + typeof key);
            }
            key = Utils.sanitizeInput(key);
            if (typeof value !== 'string') {
                throw new Error('Invalid type for data value, must be of type string but found type: ' + typeof value);
            }
            value = Utils.sanitizeInput(value);

            // This regex ensures that the key is a valid HTML data attribute name.
            // It starts with a letter, and is followed by any number of alphanumeric characters, underscores, or dashes.
            const dataNameRegex = /^[a-z][\w-]*$/;
            if (!dataNameRegex.test(key)) {
                throw new Error(`Invalid data name: ${key}`);
            }
            this.#domElement.dataset[key] = value;
        });
        this.#dataSet = true;
        return this;
    }

    /**
     * Sets the disabled property on the input element.
     *
     * If set to true, the input element will be disabled and the user will not be able to interact with it.
     * If set to false, the input element will be enabled and the user will be able to interact with it.
     *
     * If not provided, defaults to true.
     *
     * @param {boolean} [boolValue=true] - Whether the input element should be disabled.
     * @returns {Input} The current instance for method chaining.
     * @throws {Error} If the type of boolValue is not a boolean.
     */
    disabled( boolValue = true ) {
        if (typeof boolValue !== 'boolean') {
            throw new Error('Invalid type for disabled, must be of type boolean but found type: ' + typeof boolValue);
        }
        this.#domElement.disabled = boolValue;
        return this;
    }

    /**
     * Sets the default value of the input element.
     *
     * @param {string} [value=''] - The default value of the input element.
     * @throws {Error} If the type of value is not a string.
     * @return {Input} - The same instance of Input.
     */
    defaultValue( value = '' )
    {
        if (typeof value !== 'string') {
            throw new Error('Invalid type for defaultValue, must be of type string but found type: ' + typeof value);
        }
        this.#domElement.value = Utils.sanitizeInput(value);
        this.#defaultValue = value;
        return this;
    }

    /**
     * Appends the input element to the element matched by the provided element selector.
     *
     * If a wrapper element has been set, the input element is appended to the wrapper element.
     * If a label element has been set, the label element is inserted before the input element.
     * If an after element has been set, the after element is inserted after the input element.
     *
     * @param {string|HTMLElement} [elementSelector=''] - Element selector for the element to append the input element to.
     * @throws {Error} If the type of elementSelector is not a string.
     * @throws {Error} If the element selector is invalid.
     * @throws {Error} If the element selector does not match any element.
     * @return {Input} - The same instance of Input.
     */
    appendTo( elementSelector = '' ) {
        let domNode;
        if (typeof elementSelector === 'string') {
            if (elementSelector === '') {
                throw new Error('Input.appendTo: Element selector cannot be empty.');
            }
            domNode = document.querySelector(elementSelector);
            if (domNode === null) {
                throw new Error('Input.appendTo: Element not found: ' + elementSelector);
            }
        }
        else if (elementSelector instanceof HTMLElement) {
            domNode = elementSelector;
        }
        else {
            throw new Error('Input.appendTo: Invalid type for elementSelector, must be either a valid CSS selector or an instance of HTMLElement but found type: ' + typeof elementSelector);
        }
        if (this._labelAfter instanceof DocumentFragment) {
            // If wrapper, we append after input inside wrapper; otherwise after input in domNode
            if (null !== this._wrapperElement) {
                this._wrapperElement.appendChild(this._labelElement);
                this._wrapperElement.appendChild(this._domElement);
                this._wrapperElement.appendChild(this._labelAfter);
                domNode.appendChild(this._wrapperElement);
            } else {
                domNode.appendChild(this._labelElement);
                domNode.appendChild(this._domElement);
                domNode.appendChild(this._labelAfter);
            }
        }
        else {
            if (null !== this._wrapperElement) {
                this._wrapperElement.appendChild(this._labelElement);
                this._wrapperElement.appendChild(this._domElement);
                domNode.appendChild(this._wrapperElement);
            } else {
                domNode.appendChild(this._labelElement);
                domNode.appendChild(this._domElement);
            }
        }
    }

    /**
     * Retrieves the underlying DOM element of the input instance.
     *
     * @returns {HTMLElement} The DOM element associated with the input instance.
     * @readonly
     */
    get _domElement() {
        return this.#domElement;
    }

    /**
     * Whether or not the class has been set.
     *
     * @returns {boolean}
     * @readonly
     */
    get _classSet() {
        return this.#classSet;
    }

    /**
     * The label element.
     *
     * @returns {HTMLLabelElement}
     * @readonly
     */
    get _labelElement() {
        return this.#labelElement;
    }

    /**
     * Whether or not the label class has been set.
     *
     * @returns {boolean}
     * @readonly
     */
    get _labelClassSet() {
        return this.#labelClassSet;
    }

    /**
     * The element to insert after the label element.
     *
     * @returns {DocumentFragment|null}
     * @readonly
     */
    get _labelAfter() {
        return this.#labelAfter;
    }

    /**
     * The wrapper element.
     *
     * @returns {HTMLElement|null}
     * @readonly
     */
    get _wrapperElement() {
        return this.#wrapperElement;
    }

    /**
     * Whether or not the wrapper class has been set.
     *
     * @returns {boolean}
     * @readonly
     */
    get _wrapperClassSet() {
        return this.#wrapperClassSet;
    }

    /**
     * The default value of the input element, set with the defaultValue() method.
     *
     * @returns {string}
     * @readonly
     */
    get _defaultValue() {
        return this.#defaultValue;
    }

    /**
     * Whether a wrapper element has been set.
     *
     * @returns {boolean}
     * @readonly
     */
    get _hasWrapper() {
        return this.#hasWrapper;
    }
}
