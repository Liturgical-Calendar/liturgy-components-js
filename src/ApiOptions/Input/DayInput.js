import NumberInput from './NumberInput.js';
import { defaultLabelText } from './InputLabels.js';

export default class DayInput extends NumberInput {
    /**
     * Constructor for DayInput class.
     *
     * Calls the parent constructor with no arguments.
     * Sets the name, id, and localized label text content of the input element.
     * Sets the minimum value to 1, maximum value to 31, and step to 1.
     * Sets the current day of the month as the default value.
     *
     * @param {Intl.Locale|null} [locale=null] - The locale whose `DAY` label to use.
     *        `null` means "not supplied" and yields the English label, which is the
     *        only sane default for an input constructed without a locale.
     * @throws {Error} If `locale` is neither `null` nor an instance of `Intl.Locale`.
     * @memberof DayInput
     */
    constructor(locale = null) {
        super();
        // Guard BEFORE `_claimDefaultId()`, unlike the five inputs that predate
        // #59 and throw after it: a throwing constructor here leaves the id
        // registry untouched. Deliberate, and not an inconsistency to "fix" in
        // either direction — reordering the older five would change which ids a
        // throwing constructor has already claimed.
        if (null !== locale && false === locale instanceof Intl.Locale) {
            throw new Error(
                'DayInput: Invalid type for locale, must be of type `Intl.Locale` but found type: ' +
                    typeof locale,
            );
        }
        this._domElement.name = 'day';
        this._claimDefaultId('day');
        this._labelElement.textContent = defaultLabelText('DAY', locale);
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
