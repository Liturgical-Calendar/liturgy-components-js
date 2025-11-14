import Input from './Input.js';

export default class NumberInput extends Input {

    /**
     * Initializes a new instance of the NumberInput class.
     *
     * This class extends the Input class and initializes a new instance as an input[type="number"] element.
     *
     * @throws {Error} If the element parameter is not a string or is not one of the valid values.
     */
    constructor() {
        super('input', {type: 'number'});
    }
}
