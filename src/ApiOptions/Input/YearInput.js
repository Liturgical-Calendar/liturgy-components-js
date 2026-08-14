import NumberInput from './NumberInput.js';
import { defaultLabelText } from './InputLabels.js';

export default class YearInput extends NumberInput {
    /**
     * Constructor for YearInput class.
     *
     * Calls the parent constructor with no arguments.
     * Sets the name, id, and localized label text content of the input element.
     * Sets the minimum value to 1970, maximum value to 9999, and step to 1.
     * Sets the current year as the default value.
     *
     * @param {Intl.Locale|null} [locale=null] - The locale whose `YEAR` label to use.
     *        `null` means "not supplied" and yields the English label, which is the
     *        only sane default for an input constructed without a locale.
     * @throws {Error} If `locale` is neither `null` nor an instance of `Intl.Locale`.
     * @memberof YearInput
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
                'YearInput: Invalid type for locale, must be of type `Intl.Locale` but found type: ' +
                    typeof locale,
            );
        }
        this._domElement.name = 'year';
        this._claimDefaultId('year');
        this._labelElement.textContent = defaultLabelText('YEAR', locale);
        this._domElement.min = 1970;
        this._domElement.max = 9999;
        this._domElement.step = 1;
        this._domElement.value = new Date().getFullYear();
    }

    /**
     * Set the minimum selectable year.
     *
     * Used to raise the floor to the Ambrosian rite's first reformed Missal (1976)
     * when the Ambrosian rite is selected, and to restore 1970 for the Roman rite.
     *
     * Deliberately has no "already set" guard: this value is re-set every time the rite changes.
     *
     * @param {number} year
     * @returns {YearInput} The current instance for method chaining.
     */
    min(year) {
        this._domElement.min = year;
        return this;
    }
}
