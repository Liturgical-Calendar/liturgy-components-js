import Input from "../input.js";


export default class AscensionInput extends Input {

    static #options = Object.freeze(Object.entries({
        '': '--',
        'THURSDAY': 'Thursday',
        'SUNDAY': 'Sunday'
    }));

    constructor() {
        super();
        this._domElement.name = 'ascension';
        this._domElement.id = 'ascension';
    }

    #processInput() {
        this._labelElement.textContent = 'ascension';
        AscensionInput.#options.forEach(([value, label]) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            option.selected = this.selectedOption === value;
            this._domElement.appendChild(option);
        });
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
