import Input from "../Input.js";
import Messages from "../Messages.js";

export default class EpiphanyInput extends Input {

    #options = null;

    constructor(locale = null) {
        super();
        this._domElement.name = 'epiphany';
        this._domElement.id = 'epiphany';
        if (locale === null) {
            throw new Error('Locale cannot be null.');
        }
        if (false === locale instanceof Intl.Locale) {
            throw new Error('Invalid type for locale, must be of type `Intl.Locale` but found type: ' + typeof locale);
        }
        const monthDayFormatter = new Intl.DateTimeFormat(locale.language, { month: 'long', day: 'numeric' });
        const weekdayFormatter = new Intl.DateTimeFormat(locale.language, { weekday: 'long' });
        const jan6 = new Date(Date.UTC(2025, 0, 6, 0, 0, 0));
        // const jan2 = new Date(Date.UTC(2025, 0, 2, 0, 0, 0));
        // const jan8 = new Date(Date.UTC(2025, 0, 8, 0, 0, 0));
        // const sunday = new Date(Date.UTC(2025, 0, 5, 0, 0, 0));
        this.#options = Object.freeze(Object.entries({
            '': '--',
            'JAN6': monthDayFormatter.format(jan6),
            'SUNDAY_JAN2_JAN8': Messages[locale.language]['SUNDAY_JAN2_JAN8']
        }));
   }

    #processInput() {
        this._labelElement.textContent = 'epiphany';
        this.#options.forEach(([value, label]) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            option.selected = this._selectedValue === value;
            this._domElement.appendChild(option);
        });
    }

    appendTo( elementSelector = '' ) {
        if (typeof elementSelector !== 'string') {
            throw new Error('Invalid type for elementSelector, must be of type string but found type: ' + typeof elementSelector);
        }
        if (elementSelector === '') {
            throw new Error('Element selector cannot be empty.');
        }
        const element = document.querySelector(elementSelector);
        if (element === null) {
            throw new Error('Element not found: ' + elementSelector);
        }
        this.#processInput();
        if (null !== this._wrapperElement) {
            this._wrapperElement.appendChild(this._labelElement);
            this._wrapperElement.appendChild(this._domElement);
            element.appendChild(this._wrapperElement);
        } else {
            element.appendChild(this._labelElement);
            element.appendChild(this._domElement);
        }
    }
}
