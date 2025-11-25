import SelectInput from "./SelectInput.js";

export default class MonthInput extends SelectInput {

    /** @type {Intl.Locale} */
    #locale = null;

    /**
     * Constructor for MonthInput class.
     *
     * Creates a select element with options for each month (1-12),
     * using localized month names based on the provided locale.
     *
     * @param {Intl.Locale} locale - The locale to use for month names.
     * @throws {Error} If the locale is not an instance of Intl.Locale.
     * @memberof MonthInput
     */
    constructor(locale) {
        super();
        if (false === locale instanceof Intl.Locale) {
            throw new Error('MonthInput: Invalid type for locale, must be of type `Intl.Locale` but found type: ' + typeof locale);
        }
        this.#locale = locale;
        this._domElement.name = 'month';
        this._domElement.id = 'month';
        this._labelElement.textContent = 'month';
        this._labelElement.htmlFor = this._domElement.id;

        const currentMonth = new Date().getMonth() + 1; // 1-12
        const formatter = new Intl.DateTimeFormat(locale.baseName, { month: 'long' });
        const tempDate = new Date();

        for (let month = 1; month <= 12; month++) {
            tempDate.setMonth(month - 1);
            const option = document.createElement('option');
            option.value = month;
            option.textContent = formatter.format(tempDate);
            option.selected = month === currentMonth;
            this._domElement.appendChild(option);
        }
    }

    /**
     * Gets the currently selected month value (1-12).
     *
     * @returns {number} The selected month number.
     */
    get value() {
        return parseInt(this._domElement.value, 10);
    }
}
