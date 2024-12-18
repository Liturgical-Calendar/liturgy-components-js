import NumberInput from "../NumberInput.js";

export default class YearInput extends NumberInput {

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
