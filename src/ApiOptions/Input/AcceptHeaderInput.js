import Input from "../Input.js";

export default class AcceptHeaderInput extends Input {

    #asReturnTypeParam = false;
    #hidden = false;
    #RETURN_TYPE_PARAM_VALS = Object.freeze(['JSON', 'XML', 'YML', 'ICS']);
    #ACCEPT_HEADER_VALS     = Object.freeze([
        'application/json',
        'application/xml',
        'application/yaml',
        'text/calendar'
    ]);

    constructor() {
        super();
        this._domElement.name = 'return_type';
        this._domElement.id = 'return_type';
    }

    asReturnTypeParam( as_return_type_param = true) {
        if (typeof as_return_type_param !== 'boolean') {
            throw new Error('Invalid type for as_return_type_param, must be of type boolean but found type: ' + typeof as_return_type_param);
        }
        this.as_return_type_param = as_return_type_param;
        return this;
    }

    hide() {
        this.#hidden = true;
        return this;
    }

    isHidden() {
        return this.#hidden;
    }

    #processInput() {
        this._labelElement.textContent = this.#asReturnTypeParam ? 'return_type' : 'Accept Header';

        if (this.#asReturnTypeParam) {
            this.#RETURN_TYPE_PARAM_VALS.forEach(value => {
                const option = document.createElement('option');
                option.textContent = value;
                option.value = value;
                option.selected = this._selectedValue === value;
                this._domElement.appendChild(option);
            });
        } else {
            this.#ACCEPT_HEADER_VALS.forEach(value => {
                const option = document.createElement('option');
                option.textContent = value;
                option.value = value;
                option.selected = this._selectedValue === value;
                this._domElement.appendChild(option);
            });
        }
    }

    appendTo( elementSelector = '' ) {
        if (typeof elementSelector !== 'string') {
            throw new Error('Invalid type for elementSelector, must be of type string but found type: ' + typeof elementSelector);
        }
        if (elementSelector === '') {
            throw new Error('Element selector cannot be empty.');
        }
        const element = document.querySelector(elementSelector);
        if (element === null) {
            throw new Error('Element not found: ' + elementSelector);
        }
        this.#processInput();
        if (null !== this._wrapperElement) {
            this._wrapperElement.appendChild(this._labelElement);
            this._wrapperElement.appendChild(this._domElement);
            element.appendChild(this._wrapperElement);
        } else {
            element.appendChild(this._labelElement);
            element.appendChild(this._domElement);
        }
    }
}
