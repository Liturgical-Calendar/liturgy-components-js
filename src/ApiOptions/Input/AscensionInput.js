import SelectInput from "./SelectInput.js";

export default class AscensionInput extends SelectInput {

    #options = null;

    /**
     * Constructs an AscensionInput object.
     *
     * @param {Intl.Locale|null} locale - The locale to use for formatting options.
     *                                    Must be an instance of Intl.Locale and cannot be null.
     * @throws {Error} Throws an error if the locale is null or not an instance of Intl.Locale.
     *
     * This constructor initializes the ascension input select element, setting its name, id, and
     * label text content. It also populates the select options with 'THURSDAY' and 'SUNDAY',
     * formatted according to the given locale. The options are immutable and each option's
     * selected state is determined by the current _selectedValue.
     */
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
