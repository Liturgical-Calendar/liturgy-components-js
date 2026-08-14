import SelectInput from './SelectInput.js';
import { defaultLabelText } from './InputLabels.js';
//import Messages from "../../Messages.js";

export default class HolydaysOfObligationInput extends SelectInput {
    #options = null;

    static BASE_OPTIONS = Object.freeze([
        Object.freeze({
            value: 'Christmas',
            label: 'Christmas',
            selected: true,
        }),
        Object.freeze({ value: 'Epiphany', label: 'Epiphany', selected: true }),
        Object.freeze({
            value: 'Ascension',
            label: 'Ascension',
            selected: true,
        }),
        Object.freeze({
            value: 'CorpusChristi',
            label: 'Corpus Christi',
            selected: true,
        }),
        Object.freeze({
            value: 'MaryMotherOfGod',
            label: 'Mary, Mother of God',
            selected: true,
        }),
        Object.freeze({
            value: 'ImmaculateConception',
            label: 'Immaculate Conception',
            selected: true,
        }),
        Object.freeze({
            value: 'Assumption',
            label: 'Assumption',
            selected: true,
        }),
        Object.freeze({
            value: 'StJoseph',
            label: 'St. Joseph',
            selected: true,
        }),
        Object.freeze({
            value: 'StsPeterPaulAp',
            label: 'Sts. Peter and Paul, Apostles',
            selected: true,
        }),
        Object.freeze({
            value: 'AllSaints',
            label: 'All Saints',
            selected: true,
        }),
    ]);

    /**
     * Asserts that every entry is a well-formed option, and returns a shallow copy.
     *
     * Extracted from {@link HolydaysOfObligationInput.mergeOptions} so that the
     * non-merging branch of {@link HolydaysOfObligationInput#setOptions} validates
     * by exactly the same rule rather than by a second, drifting copy of it.
     *
     * Unlike `mergeOptions()`, a non-array is an ERROR here rather than a request
     * for the base options: there is no base list to fall back to on this path.
     *
     * @param {Array<{value:string,label:string,selected:boolean}>} options
     * @returns {Array<{value:string,label:string,selected:boolean}>}
     * @throws {Error} If `options` is not an array, or any entry is malformed.
     */
    static validateOptions(options) {
        if (!Array.isArray(options)) {
            throw new Error(
                'HolydaysOfObligationInput: options must be an array, but found type: ' +
                    typeof options,
            );
        }
        options.forEach((o, i) => {
            if (
                !o ||
                typeof o.value !== 'string' ||
                typeof o.label !== 'string' ||
                typeof o.selected !== 'boolean'
            ) {
                throw new Error(`Invalid option at index ${i}`);
            }
        });
        return [...options];
    }

    static mergeOptions(customOptions) {
        if (!Array.isArray(customOptions) || customOptions.length === 0) {
            return [...HolydaysOfObligationInput.BASE_OPTIONS];
        }
        HolydaysOfObligationInput.validateOptions(customOptions);

        // Convert custom options into a map for quick lookup
        const customMap = new Map(customOptions.map((opt) => [opt.value, opt]));

        // Start from base options, merge overrides, and include any new ones
        const merged = [
            ...HolydaysOfObligationInput.BASE_OPTIONS.map((base) => ({
                ...base,
                ...(customMap.get(base.value) || {}),
            })),
            ...customOptions.filter(
                (opt) =>
                    !HolydaysOfObligationInput.BASE_OPTIONS.some(
                        (b) => b.value === opt.value,
                    ),
            ),
        ];

        return merged;
    }

    /**
     * Replaces the select's options.
     *
     * @param {Array<{value:string,label:string,selected:boolean}>} options - The options to apply.
     * @param {boolean} [merge=true] - Whether to overlay `options` onto
     *   {@link HolydaysOfObligationInput.BASE_OPTIONS} (the default, and what every
     *   caller did before this parameter existed) or to use `options` verbatim.
     *
     *   The default is right for a NATIONAL or DIOCESAN calendar: every
     *   `holydays_of_obligation` the API publishes for one names all ten base keys,
     *   so merging and replacing agree, and merging keeps a partial list from
     *   shrinking the select. It is wrong for a RITE's published list, which is a
     *   different set of celebrations rather than a re-selection of the Roman one —
     *   the Ambrosian list omits four base entries and adds three of its own, so
     *   merging would leave the form asserting that `StJoseph` and `StsPeterPaulAp`
     *   are Ambrosian holy days of obligation. See issue #70.
     *
     *   The two branches differ on an EMPTY array, deliberately. Merging one
     *   yields the base options — which is what makes `setOptions( [] )` the way
     *   to restore the defaults — while replacing with one empties the select,
     *   the honest rendering of a calendar that observes no holy days of
     *   obligation at all.
     * @throws {Error} If any option is malformed, or — on the replacing branch
     *   only — if `options` is not an array.
     */
    setOptions(options, merge = true) {
        //console.info('setting holy days of obligation options:', options);
        this.#options = Object.freeze(
            merge
                ? HolydaysOfObligationInput.mergeOptions(options)
                : HolydaysOfObligationInput.validateOptions(options),
        );
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
                // Prefer the 'selected' attribute over selected state so that the VirtualSelect can pick it up
                optionElement.setAttribute('selected', 'selected');
            }
            this._domElement.appendChild(optionElement);
        });
    }

    get _options() {
        return this.#options;
    }

    /**
     * Constructs a HolydaysOfObligationInput object.
     *
     * @param {Array<{value:string,label:string,selected:boolean}>} options - An array of objects where each object has the following properties:
     *   - value: The value attribute for the option element.
     *   - label: The text content for the option element.
     *   - selected: A boolean indicating whether the option is selected by default (i.e. whether the liturgical event is celebrated as a holy day of obligation or not).
     *
     * @param {Intl.Locale|null} [locale=null] - The locale whose `HOLYDAYS_OF_OBLIGATION`
     *   label to use. `null` means "not supplied" and yields the English label, which is
     *   the only sane default for an input constructed without a locale.
     *
     * This constructor initializes the holy days of obligation input select element, setting its name, id, and
     * localized label text content, with the multiple attribute set to true.
     * It also populates the select options with a minimal set of base options merged with any provided custom options,
     * which can override the base options. The options are immutable and each option's
     * selected state is determined by the `selected` boolean property for each option.
     *
     * @throws {Error} If `locale` is neither `null` nor an instance of `Intl.Locale`.
     */
    constructor(options = [], locale = null) {
        super(true);
        // Guard BEFORE `_claimDefaultId()`, unlike the five inputs that predate
        // #59 and throw after it: a throwing constructor here leaves the id
        // registry untouched. Deliberate, and not an inconsistency to "fix" in
        // either direction — reordering the older five would change which ids a
        // throwing constructor has already claimed.
        if (null !== locale && false === locale instanceof Intl.Locale) {
            throw new Error(
                'HolydaysOfObligationInput: Invalid type for locale, must be of type `Intl.Locale` but found type: ' +
                    typeof locale,
            );
        }
        this._domElement.name = 'holydays_of_obligation';
        this._claimDefaultId('holydays_of_obligation');
        this._labelElement.textContent = defaultLabelText(
            'HOLYDAYS_OF_OBLIGATION',
            locale,
        );
        this.#options = Object.freeze(
            HolydaysOfObligationInput.mergeOptions(options),
        );
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

    /**
     * Override the general Input disabled method.
     *
     * If set to true, the input element will be readonly and each of its options will be disabled, and the user will not be able to interact with it.
     * If set to false, the input element and each of its options will be enabled and the user will be able to interact with it.
     *
     * If no parameter is provided, defaults to true.
     *
     * @param {boolean} [boolValue=true] - Whether the input element should be disabled.
     * @returns {import('./Input.js').default} The current instance for method chaining.
     * @throws {Error} If the type of boolValue is not a boolean.
     */
    disabled(boolValue = true) {
        if (typeof boolValue !== 'boolean') {
            throw new Error(
                'Invalid type for disabled, must be of type boolean but found type: ' +
                    typeof boolValue,
            );
        }
        this._domElement.readonly = boolValue;
        [...this._domElement.options].forEach(
            (option) => (option.disabled = boolValue),
        );
        return this;
    }
}
