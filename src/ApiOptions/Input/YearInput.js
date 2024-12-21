import NumberInput from "../NumberInput.js";

export default class YearInput extends NumberInput {

    /**
     * Constructor for YearInput class.
     *
     * Calls the parent constructor with no arguments.
     * Sets the name, id, and label text content of the input element.
     * Sets the minimum value to 1970, maximum value to 9999, and step to 1.
     * Sets the current year as the default value.
     *
     * @memberof YearInput
     */
    constructor() {
        super();
        this._domElement.name = 'year';
        this._domElement.id = 'year';
        this._labelElement.textContent = 'year';
        this._domElement.min = 1970;
        this._domElement.max = 9999;
        this._domElement.step = 1;
        this._domElement.value = new Date().getFullYear();
    }
}
