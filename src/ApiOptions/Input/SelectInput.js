import Input from './Input.js';

export default class SelectInput extends Input {

    /**
     * Initializes a SelectInput instance as a select element.
     *
     * This constructor calls the parent Input class constructor,
     * specifying 'select' as the input element type.
     * @param {boolean} [multiple=false] - Whether the select input allows multiple selections.
     */
    constructor(multiple = false) {
        super('select', {multiple: multiple});
    }
}
