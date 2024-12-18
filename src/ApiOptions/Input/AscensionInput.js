import SelectInput from "../SelectInput.js";

export default class AscensionInput extends SelectInput {

    #options = null;

    constructor(locale = null) {
        super();
        this._domElement.name = 'ascension';
        this._domElement.id = 'ascension';
        this._labelElement.textContent = 'ascension';
        if (locale === null) {
            throw new Error('Locale cannot be null.');
        }
        if (false === locale instanceof Intl.Locale) {
            throw new Error('Invalid type for locale, must be of type `Intl.Locale` but found type: ' + typeof locale);
        }
        const weekdayFormatter = new Intl.DateTimeFormat(locale.language, { weekday: 'long' });
        const thursday = new Date(Date.UTC(2025, 0, 2, 0, 0, 0));
        const sunday = new Date(Date.UTC(2025, 0, 5, 0, 0, 0));
        this.#options = Object.freeze(Object.entries({
            '': '--',
            'THURSDAY': weekdayFormatter.format(thursday),
            'SUNDAY': weekdayFormatter.format(sunday)
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
