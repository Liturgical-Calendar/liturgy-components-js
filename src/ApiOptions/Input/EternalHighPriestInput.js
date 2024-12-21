import SelectInput from "../SelectInput.js";
import Messages from "../../Messages.js";

export default class EternalHighPriestInput extends SelectInput {

    #options = null;

    constructor(locale = null) {
        super();
        this._domElement.name = 'eternal_high_priest';
        this._domElement.id = 'eternal_high_priest';
        this._labelElement.textContent = 'eternal_high_priest';
        if (locale === null) {
            throw new Error('Locale cannot be null.');
        }
        if (false === locale instanceof Intl.Locale) {
            throw new Error('Invalid type for locale, must be of type `Intl.Locale` but found type: ' + typeof locale);
        }
        this.#options = Object.freeze(Object.entries({
            'false': Messages[locale.language]['FALSE'],
            'true': Messages[locale.language]['TRUE']
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
