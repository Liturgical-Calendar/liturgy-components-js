import Input from './Input.js';

export default class SelectInput extends Input {

    /**
     * Initializes a SelectInput instance as a select element.
     *
     * This constructor calls the parent Input class constructor,
     * specifying 'select' as the input element type.
     */
    constructor() {
        super('select');
    }
}
