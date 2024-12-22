import SelectInput from "./SelectInput.js";
import Messages from "../../Messages.js";

export default class YearTypeInput extends SelectInput {

    #options = null;

    /**
     * Constructs a YearTypeInput object.
     *
     * @param {Intl.Locale|null} locale - The locale to use for formatting options.
     *                                    Must be an instance of Intl.Locale and cannot be null.
     * @throws {Error} Throws an error if the locale is null or not an instance of Intl.Locale.
     *
     * This constructor initializes the year type input select element, setting its name, id, and
     * label text content. It also populates the select options with 'LITURGICAL' and 'CIVIL',
     * formatted according to the given locale. The options are immutable and each option's
     * selected state is determined by the current _selectedValue.
     */
    constructor(locale = null) {
        super();
        this._domElement.name = 'year_type';
        this._domElement.id = 'year_type';
        this._labelElement.textContent = 'year_type';
        if (locale === null) {
            throw new Error('Locale cannot be null.');
        }
        if (false === locale instanceof Intl.Locale) {
            throw new Error('Invalid type for locale, must be of type `Intl.Locale` but found type: ' + typeof locale);
        }
        this.#options = Object.freeze(Object.entries({
            'LITURGICAL': Messages[locale.language]['LITURGICAL_YEAR'],
            'CIVIL': Messages[locale.language]['CIVIL_YEAR']
        }));
        this.#options.forEach(([value, label]) => {
            const option = document.createElement('option');
            option.value = value;
            option.title = value;
            option.textContent = label;
            option.selected = this._selectedValue === value;
            this._domElement.appendChild(option);
        });
    }

}
