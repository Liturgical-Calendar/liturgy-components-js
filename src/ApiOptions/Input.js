
export default class Input {
    static #globalInputClass   = null;
    static #globalLabelClass   = null;
    static #globalWrapper      = null;
    static #globalWrapperClass = null;
    #domElement       = null;
    #idSet            = false;
    #nameSet          = false;
    #classSet         = false;
    #dataSet          = false;
    #labelElement     = null;
    #labelClassSet    = false;
    #labelAfter       = null;
    #wrapperElement   = null;
    #wrapperClassSet  = false;
    #selectedValue    = '';

    static #sanitizeInput(input) {
        let doc = new DOMParser().parseFromString(input, 'text/html');
        return doc.body.textContent || "";
    }

    static #isValidClassName( className ) {
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

    static #isValidId( id ) {
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

    static setGlobalInputClass( className = '' ) {
        if (typeof className !== 'string') {
            throw new Error('Invalid type for value passed to globalInputClass, must be of type string but found type: ' + typeof className);
        }
        className = Input.#sanitizeInput(className);
        const classNames = className.split(/\s+/);
        classNames.forEach(className => {
            if (false === Input.#isValidClassName(className)) {
                throw new Error('Invalid class value passed to globalInputClass: ' + className);
            }
        });
        Input.#globalInputClass = classNames.join(' ');
    }

    static setGlobalLabelClass( className = '' ) {
        if (typeof className !== 'string') {
            throw new Error('Invalid type for value passed to globalLabelClass, must be of type string but found type: ' + typeof className);
        }
        className = Input.#sanitizeInput(className);
        const classNames = className.split(/\s+/);
        classNames.forEach(className => {
            if (false === Input.#isValidClassName(className)) {
                throw new Error('Invalid class value passed to globalLabelClass: ' + className);
            }
        });
        Input.#globalLabelClass = classNames.join(' ');
    }

    static setGlobalWrapper( wrapper = '' ) {
        if (typeof wrapper !== 'string') {
            throw new Error('Invalid type for wrapper, must be of type string but found type: ' + typeof wrapper);
        }
        if (false === ['div', 'td'].includes(wrapper)) {
            throw new Error('Invalid wrapper: ' + wrapper + ', valid values are: div, td');
        }
        Input.#globalWrapper = wrapper;
    }

    static setGlobalWrapperClass( className = '' ) {
        if (typeof className !== 'string') {
            throw new Error('Invalid type for value passed to globalWrapperClass, must be of type string but found type: ' + typeof className);
        }
        className = Input.#sanitizeInput(className);
        const classNames = className.split(/\s+/);
        classNames.forEach(className => {
            if (false === Input.#isValidClassName(className)) {
                throw new Error('Invalid class value passed to globalWrapperClass: ' + className);
            }
        });
        Input.#globalWrapperClass = classNames.join(' ');
    }

    constructor() {
        this.#domElement = document.createElement('select');
        if (Input.#globalInputClass !== null) {
            this.#domElement.className = Input.#globalInputClass;
        }

        this.#labelElement = document.createElement('label');
        if (Input.#globalLabelClass !== null) {
            this.#labelElement.className = Input.#globalLabelClass;
        }

        if (Input.#globalWrapper !== null) {
            this.#wrapperElement = document.createElement(Input.#globalWrapper);
            if (Input.#globalWrapperClass !== null) {
                this.#wrapperElement.className = Input.#globalWrapperClass;
            }
        }
    }

    id( id = '' ) {
        if (this.#idSet && this.#domElement.id !== id) {
            console.error('ID has already been set to `' + this.#domElement.id + '` on Input instance.');
            console.error(this);
            throw new Error('ID has already been set to `' + this.#domElement.id + '` on Input instance.');
        }
        if (false === (typeof id === 'string')) {
            throw new Error('Invalid type for id on Input instance, must be of type string but found type: ' + typeof id);
        }
        id = Input.#sanitizeInput(id);
        if (false === Input.#isValidId(id)) {
            throw new Error(`Invalid id '${id}' on Input instance, must be a valid CSS selector`);
        }
        this.#domElement.id = id;
        this.#idSet = true;
        return this;
    }

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
        this.#domElement.name = Input.#sanitizeInput(name);
        this.#nameSet = true;
        return this;
    }

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
        className = Input.#sanitizeInput(className);
        const classNames = className.split(/\s+/);
        classNames.forEach(className => {
            if (false === Input.#isValidClassName(className)) {
                throw new Error('Invalid class name: ' + className);
            }
        });
        this.#domElement.className = classNames.join(' ');
        this.#classSet = true;
        return this;
    }

    labelClass( labelClass = '' ) {
        if (this.#labelClassSet && this.#labelElement.className !== labelClass) {
            console.error('Label class has already been set to `' + this.#labelElement.className + '` on Input instance.');
            console.error(this);
            throw new Error('Label class has already been set to `' + this.#labelElement.className + '` on Input instance.');
        }
        if (false === (typeof labelClass === 'string')) {
            throw new Error('Invalid type for label class on Input instance, must be of type string but found type: ' + typeof labelClass);
        }
        labelClass = Input.#sanitizeInput(labelClass);
        const classNames = labelClass.split(/\s+/);
        classNames.forEach(className => {
            if (false === Input.#isValidClassName(className)) {
                throw new Error(`Invalid label class '${className}' on Input instance, must be a valid CSS class`);
            }
        });
        this.#labelElement.className = classNames.join(' ');
        this.#labelClassSet = true;
        return this;
    }

    labelAfter( contents = '' ) {
        // remove php tags and script tags from contents
        // the regex is doing the following:
        //  - `<\?(?:php)?` matches the start of a php tag, optionally with the word "php" after the "?"
        //  - `|` is a logical OR operator
        //  - `\?>` matches the end of a php tag
        //  - `|` is a logical OR operator
        //  - `<script(.*?)>.*?<\/script>` matches the start of a script tag, any attributes, the contents of the script tag, and the end of the script tag
        //  - `g` flag makes the regex replacement global, so it will replace all occurrences of the regex, not just the first one
        contents = contents.replace(/<\?(?:php)?|\?>|<script(.*?)>.*?<\/script>/g, '');

        const fragment = document.createRange().createContextualFragment(contents);
        this.#labelAfter = fragment;
        return this;
    }

    wrapper( wrapper = 'div' ) {
        if (typeof wrapper !== 'string') {
            throw new Error('Invalid type for wrapper, must be of type string but found type: ' + typeof wrapper);
        }
        wrapper = Input.#sanitizeInput(wrapper);
        if (false === ['div', 'td'].includes(wrapper)) {
            throw new Error('Invalid wrapper: ' + wrapper + ', valid values are: div, td');
        }
        this.#wrapperElement = document.createElement(wrapper);
        if (Input.#globalWrapperClass !== null) {
            this.#wrapperElement.className = Input.#globalWrapperClass;
        }
        return this;
    }

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
        wrapperClass = Input.#sanitizeInput(wrapperClass);
        const classNames = wrapperClass.split(/\s+/);
        classNames.forEach(className => {
            if (false === Input.#isValidClassName(className)) {
                throw new Error(`Invalid wrapper class '${className}' on Input instance, must be a valid CSS class`);
            }
        });
        this.#wrapperElement.className = classNames.join(' ');
        this.#wrapperClassSet = true;
        return this;
    }

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
            key = Input.#sanitizeInput(key);
            if (typeof value !== 'string') {
                throw new Error('Invalid type for data value, must be of type string but found type: ' + typeof value);
            }
            value = Input.#sanitizeInput(value);

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

    disabled( boolValue = true ) {
        if (typeof boolValue !== 'boolean') {
            throw new Error('Invalid type for disabled, must be of type boolean but found type: ' + typeof boolValue);
        }
        this.#domElement.disabled = boolValue;
        return this;
    }

    selectedValue( value = '' )
    {
        if (typeof value !== 'string') {
            throw new Error('Invalid type for selectedValue, must be of type string but found type: ' + typeof value);
        }
        this.#domElement.value = Input.#sanitizeInput(value);
        this.#selectedValue = value;
        return this;
    }

    get _domElement() {
        return this.#domElement;
    }

    get _classSet() {
        return this.#classSet;
    }

    get _labelElement() {
        return this.#labelElement;
    }

    get _labelClassSet() {
        return this.#labelClassSet;
    }

    get _labelAfter() {
        return this.#labelAfter;
    }

    get _wrapperElement() {
        return this.#wrapperElement;
    }

    get _wrapperClassSet() {
        return this.#wrapperClassSet;
    }

    get _selectedValue() {
        return this.#selectedValue;
    }
}
