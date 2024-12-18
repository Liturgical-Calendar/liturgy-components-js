import SelectInput from "../SelectInput.js";

export default class AcceptHeaderInput extends SelectInput {

    static #RETURN_TYPE_PARAM_VALS = Object.freeze(['JSON', 'XML', 'YML', 'ICS']);
    static #ACCEPT_HEADER_VALS     = Object.freeze([
        'application/json',
        'application/xml',
        'application/yaml',
        'text/calendar'
    ]);
    static #returnTypeOptions = [];
    static #acceptHeaderOptions = [];
    #asReturnTypeParam = false;
    #asReturnTypeParamSet = false;
    #hidden = false;

    constructor(as_return_type_param = null) {
        super();
        if (null !== as_return_type_param) {
            this.#asReturnTypeParam = as_return_type_param;
            this.#asReturnTypeParamSet = true;
        }
        this._domElement.name = 'return_type';
        this._domElement.id = 'return_type';
        this._labelElement.textContent = this.#asReturnTypeParam ? 'return_type' : 'Accept Header';
        if (AcceptHeaderInput.#returnTypeOptions.length === 0) {
            AcceptHeaderInput.#returnTypeOptions = AcceptHeaderInput.#RETURN_TYPE_PARAM_VALS.map(value => {
                const option = document.createElement('option');
                option.textContent = value;
                option.value = value;
                option.selected = this._selectedValue === value;
                return option;
            });
        }
        if (AcceptHeaderInput.#acceptHeaderOptions.length === 0) {
            AcceptHeaderInput.#acceptHeaderOptions = AcceptHeaderInput.#ACCEPT_HEADER_VALS.map(value => {
                const option = document.createElement('option');
                option.textContent = value;
                option.value = value;
                option.selected = this._selectedValue === value;
                return option;
            });
        }
        if (this.#asReturnTypeParam) {
            this._domElement.replaceChildren(...AcceptHeaderInput.#returnTypeOptions);
        } else {
            this._domElement.replaceChildren(...AcceptHeaderInput.#acceptHeaderOptions);
        }
    }

    asReturnTypeParam( as_return_type_param = true) {
        if (this.#asReturnTypeParamSet && this.#asReturnTypeParam !== as_return_type_param) {
            throw new Error('Cannot set as_return_type_param more than once.');
        }
        if (typeof as_return_type_param !== 'boolean') {
            throw new Error('Invalid type for as_return_type_param, must be of type boolean but found type: ' + typeof as_return_type_param);
        }
        this._labelElement.textContent = as_return_type_param ? 'return_type' : 'Accept Header';
        // If we are setting this field for the first time, then we replace options.
        // There's really no need to replace them with themselves when the field is already set.
        if (as_return_type_param && false === this.#asReturnTypeParamSet) {
            this._domElement.replaceChildren(...AcceptHeaderInput.#returnTypeOptions);
        } else if (false === as_return_type_param && false === this.#asReturnTypeParamSet) {
            this._domElement.replaceChildren(...AcceptHeaderInput.#acceptHeaderOptions);
        }
        this.#asReturnTypeParam = as_return_type_param;
        this.#asReturnTypeParamSet = true;
        return this;
    }

    hide() {
        this.#hidden = true;
        return this;
    }

    isHidden() {
        return this.#hidden;
    }

}
