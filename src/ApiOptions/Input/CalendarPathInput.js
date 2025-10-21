import SelectInput from "./SelectInput.js";
import Messages from "../../Messages.js";

export default class CalendarPathInput extends SelectInput {

    static #CALENDAR_PATHS = Object.freeze(['/calendar', '/calendar/nation/', '/calendar/diocese/']);

    /**
     * Constructor.
     *
     * @param {boolean} [as_return_type_param] - if true, the select element's name will be set to 'return_type' and the options will be set to the accepted return types of the API.  If false, the select element's name will be set to 'Accept' and the options will be set to the accepted accept headers of the API.
     *
     * @throws {Error} if as_return_type_param is set more than once.
     * @throws {Error} if as_return_type_param is not of type boolean.
     */
    constructor(locale) {
        super();
        if (locale && false === locale instanceof Intl.Locale) {
            throw new Error('CalendarPathInput: Invalid type for locale, must be of type Intl.Locale but found type: ' + typeof locale);
        }
        this._domElement.name = 'calendar_path';
        this._domElement.id = 'calendar_path';
        this._labelElement.textContent = Messages[locale.language]['SELECT_ROUTE'] ?? 'Select route';
        this._labelElement.htmlFor = this._domElement.id;
        this._domElement.append(...CalendarPathInput.#CALENDAR_PATHS.map(path => {
            const option = document.createElement('option');
            option.textContent = path;
            option.value = path;
            option.selected = this._selectedValue === path;
            return option;
        }));
    }
}
