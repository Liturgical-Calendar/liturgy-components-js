import SelectInput from './SelectInput.js';
import { message } from '../../MessageLookup.js';
import { defaultLabelText } from './InputLabels.js';

export default class EternalHighPriestInput extends SelectInput {
    #options = null;

    /**
     * Constructs an EternalHighPriestInput object.
     *
     * @param {Intl.Locale|null} locale - The locale to use for formatting options.
     *                                    Must be an instance of Intl.Locale and cannot be null.
     * @throws {Error} Throws an error if the locale is null or not an instance of Intl.Locale.
     *
     * This constructor initializes the eternal high priest input select element, setting its name, id, and
     * label text content. It also populates the select options with 'false' and 'true',
     * formatted according to the given locale. The options are immutable and each option's
     * selected state is determined by the current _selectedValue.
     */
    constructor(locale = null) {
        super();
        this._domElement.name = 'eternal_high_priest';
        this._claimDefaultId('eternal_high_priest');
        if (locale === null) {
            throw new Error('Locale cannot be null.');
        }
        if (false === locale instanceof Intl.Locale) {
            throw new Error(
                'Invalid type for locale, must be of type `Intl.Locale` but found type: ' +
                    typeof locale,
            );
        }
        this._labelElement.textContent = defaultLabelText(
            'ETERNAL_HIGH_PRIEST',
            locale,
        );
        this.#options = Object.freeze(
            Object.entries({
                false: message('FALSE', locale),
                true: message('TRUE', locale),
            }),
        );
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
