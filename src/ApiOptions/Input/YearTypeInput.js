import SelectInput from "../SelectInput.js";
import Messages from "../Messages.js";

export default class YearTypeInput extends SelectInput {

    #options = null;

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
