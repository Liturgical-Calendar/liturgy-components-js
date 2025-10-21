import SelectInput from "./SelectInput.js";
import Messages from "../../Messages.js";

export default class HolydaysOfObligationInput extends SelectInput {

    #options = null;

    static BASE_OPTIONS = [
        { value: "Christmas",            label: "Christmas",                     selected: true },
        { value: "Epiphany",             label: "Epiphany",                      selected: true },
        { value: "Ascension",            label: "Ascension",                     selected: true },
        { value: "CorpusChristi",        label: "Corpus Christi",                selected: true },
        { value: "MaryMotherOfGod",      label: "Mary, Mother of God",           selected: true },
        { value: "ImmaculateConception", label: "Immaculate Conception",         selected: true },
        { value: "Assumption",           label: "Assumption",                    selected: true },
        { value: "StJoseph",             label: "St. Joseph",                    selected: true },
        { value: "StsPeterPaulAp",       label: "Sts. Peter and Paul, Apostles", selected: true },
        { value: "AllSaints",            label: "All Saints",                    selected: true },
    ];

    static mergeOptions(customOptions) {
        if (!Array.isArray(customOptions) || customOptions.length === 0) {
            return HolydaysOfObligationInput.BASE_OPTIONS;
        }

        // Convert custom options into a map for quick lookup
        const customMap = new Map(customOptions.map(opt => [opt.value, opt]));

        // Start from base options, merge overrides, and include any new ones
        const merged = [
        ...HolydaysOfObligationInput.BASE_OPTIONS.map(base => ({
            ...base,
            ...(customMap.get(base.value) || {}),
        })),
        ...customOptions.filter(opt => !HolydaysOfObligationInput.BASE_OPTIONS.some(b => b.value === opt.value))
        ];

        return merged;
    }

    setOptions(options) {
        console.info('setting holy days of obligation options:', options);
        this.#options = Object.freeze(HolydaysOfObligationInput.mergeOptions(options));
        // Clear existing options
        while (this._domElement.firstChild) {
            this._domElement.removeChild(this._domElement.firstChild);
        }
        // Add new options
        this.#options.forEach(({ label, value, selected }) => {
            const optionElement = document.createElement('option');
            optionElement.value = value;
            optionElement.title = value;
            optionElement.textContent = label;
            if (selected) {
                optionElement.setAttribute('selected', 'selected');
            }
            this._domElement.appendChild(optionElement);
        });
    }

    get _options() {
        return this.#options;
    }

    /**
     * Constructs an HolydaysOfObligationInput object.
     *
     * @param {Array<{value:string,label:string,selected:boolean}>} options - An array of objects where each object has the following properties:
     *   - value: The value attribute for the option element.
     *   - label: The text content for the option element.
     *   - selected: A boolean indicating whether the option is selected by default (i.e. whether the liturgical event is celebrated as a holy day of obligation or not).
     * @throws {Error} Throws an error if the locale is null or not an instance of Intl.Locale.
     *
     * This constructor initializes the holy days of obligation input select element, setting its name, id, and
     * label text content, with the multiple attribute set to true.
     * It also populates the select options with a minimal set of base options merged with any provided custom options,
     * which can override the base options. The options are immutable and each option's
     * selected state is determined by the `selected` boolean property for each option.
     */
    constructor(options = []) {
        super(true);
        this._domElement.name = 'holydays_of_obligation';
        this._domElement.id = 'holydays_of_obligation';
        this._labelElement.textContent = 'holydays_of_obligation';
        this._labelElement.htmlFor = this._domElement.id;
        this.#options = Object.freeze(HolydaysOfObligationInput.mergeOptions(options));
        this.#options.forEach(({ label, value, selected }) => {
            const optionElement = document.createElement('option');
            optionElement.value = value;
            optionElement.title = value;
            optionElement.textContent = label;
            if (selected) {
                optionElement.setAttribute('selected', 'selected');
            }
            this._domElement.appendChild(optionElement);
        });
    }

}
