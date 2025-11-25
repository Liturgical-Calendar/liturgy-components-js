import NumberInput from "./NumberInput.js";

export default class DayInput extends NumberInput {

    /**
     * Constructor for DayInput class.
     *
     * Calls the parent constructor with no arguments.
     * Sets the name, id, and label text content of the input element.
     * Sets the minimum value to 1, maximum value to 31, and step to 1.
     * Sets the current day of the month as the default value.
     *
     * @memberof DayInput
     */
    constructor() {
        super();
        this._domElement.name = 'day';
        this._domElement.id = 'day';
        this._labelElement.textContent = 'day';
        this._labelElement.htmlFor = this._domElement.id;
        this._domElement.min = 1;
        this._domElement.max = 31;
        this._domElement.step = 1;
        this._domElement.value = new Date().getDate();
    }

    /**
     * Updates the maximum day value based on the given month and year.
     *
     * @param {number} month - The month (1-12)
     * @param {number} year - The year (for leap year calculation)
     */
    updateMaxDay(month, year) {
        const daysInMonth = new Date(year, month, 0).getDate();
        this._domElement.max = daysInMonth;
        if (parseInt(this._domElement.value, 10) > daysInMonth) {
            this._domElement.value = daysInMonth;
        }
    }
}
