import SelectInput from "./SelectInput.js";

export default class CorpusChristiInput extends SelectInput {

    #options = null;

    /**
     * Constructor for the CorpusChristiInput class.
     *
     * @param {string|Intl.Locale|null} locale - The locale to use for the Corpus Christi input.
     *                                          The locale should be a valid string that can be parsed by the
     *                                          Intl.getCanonicalLocales function or an instance of Intl.Locale.
     *                                          If the locale string contains an underscore, the underscore will be replaced
     *                                          with a hyphen.
     *
     * @throws {Error} If the locale is invalid.
     */
    constructor(locale = null) {
        super();
        this._domElement.name = 'corpus_christi';
        this._domElement.id = 'corpus_christi';
        this._labelElement.textContent = 'corpus_christi';
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
