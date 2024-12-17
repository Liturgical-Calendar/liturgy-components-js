import Input from "../input.js";


export default class EternalHighPriestInput extends Input {

    static #options = Object.freeze(Object.entries({
        'false': 'False',
        'true': 'True'
    }));

    constructor() {
        super();
        this._domElement.name = 'eternal_high_priest';
        this._domElement.id = 'eternal_high_priest';
    }

    #processInput() {
        this._labelElement.textContent = 'eternal_high_priest';
        EternalHighPriestInput.#options.forEach(([value, label]) => {
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
