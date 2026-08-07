import {
    AcceptHeaderInput,
    AscensionInput,
    CorpusChristiInput,
    EpiphanyInput,
    LocaleInput,
    EternalHighPriestInput,
    HolydaysOfObligationInput,
    YearInput,
    YearTypeInput,
    CalendarPathInput
} from './Input/index.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import ApiClient from '../ApiClient/ApiClient.js';
import { ApiOptionsFilter, CalendarSelectFilter, RiteProperties } from '../Enums.js';
import { CurrentEndpoint } from '../PathBuilder/CurrentEndpoint.js';
import Utils from '../Utils.js';

/**
 * Class to generate form controls for request options to the Liturgical Calendar API.
 *
 * The form controls can be fully customized using the methods provided by the class.
 *
 * - __constructor()__ Initializes the ApiOptions object with default or provided settings:
 *   - __locale__: The locale to use for the API options form.
 *
 * The following properties are initialized on the object instance:
 * - ___epiphanyInput__: The select input with options for when the Epiphany is celebrated.
 * - ___ascensionInput__: The select input with options for when the Ascension is celebrated.
 * - ___corpusChristiInput__: The select input with options for when Corpus Christi is celebrated.
 * - ___eternalHighPriestInput__: The select input with options for whether the Eternal High Priest is celebrated.
 * - ___holydaysOfObligationInput__: The select input with options for which holy days of obligation are observed.
 * - ___yearTypeInput__: The select input with options for the type of year to produce, whether liturgical or civil.
 * - ___localeInput__: The select input with options for the locale to use for the calendar response from the API.
 * - ___acceptHeaderInput__: The select input with options for the Accept header to use for the calendar response from the API.
 *
 * @example
 * const apiOptions = new ApiOptions();
 * apiOptions.localeInput.defaultValue( 'en' );
 * apiOptions.acceptHeaderInput.hide();
 *
 * @example
 * const apiOptions = new ApiOptions('it-IT');
 * apiOptions.localeInput.defaultValue( 'it' );
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 * @see https://github.com/Liturgical-Calendar/liturgy-components-js
 */
export default class ApiOptions {

    /** @type {string[]} */
    static #expectedSettingsKeys = [
        'year',
        'year_type',
        'locale',
        'epiphany',
        'ascension',
        'corpus_christi',
        'eternal_high_priest',
        'holydays_of_obligation'
    ];

    /** @type {boolean} */
    #linked                = false;

    /** @type {?Intl.Locale} */
    #locale                = null;

    /** @type {boolean} */
    #pathBuilderEnabled    = false;

    /**
     * @type {{
     *  epiphanyInput: ?EpiphanyInput,
     *  ascensionInput: ?AscensionInput,
     *  corpusChristiInput: ?CorpusChristiInput,
     *  eternalHighPriestInput: ?EternalHighPriestInput,
     *  holydaysOfObligationInput: ?HolydaysOfObligationInput,
     *  localeInput: ?LocaleInput,
     *  yearInput: ?YearInput,
     *  yearTypeInput: ?YearTypeInput,
     *  acceptHeaderInput: ?AcceptHeaderInput,
     *  calendarPathInput: ?CalendarPathInput
     * }}
     */
    #inputs                = {
        epiphanyInput: null,
        ascensionInput: null,
        corpusChristiInput: null,
        eternalHighPriestInput: null,
        holydaysOfObligationInput: null,
        localeInput: null,
        yearInput: null,
        yearTypeInput: null,
        acceptHeaderInput: null,
        calendarPathInput: null
    };

    #filter                = ApiOptionsFilter.NONE;
    #filtersSet            = [];

    /**
     * Whether the currently selected rite fixes the four temporal options
     * (Epiphany, Ascension, Corpus Christi, Eternal High Priest) itself.
     *
     * Only ever set by `#handleLinkedRiteSelect`, so it stays `false` for
     * embeds that never link a `RiteSelect` — for them the enable/disable rule
     * reduces to the calendar-selection half it has always been.
     *
     * @type {boolean}
     */
    #riteFixesTemporalOptions = false;

    /**
     * This instance's endpoint state — path segments plus query parameters.
     *
     * One per `ApiOptions`, never shared: the `PathBuilder` constructed against
     * this instance reads it via the `_currentEndpoint` getter, so two embeds on
     * one page cannot overwrite each other's rite, calendar or year. See the doc
     * comment on `CurrentEndpoint` for why this is instance state.
     *
     * @type {CurrentEndpoint}
     */
    #currentEndpoint = new CurrentEndpoint();

    /**
     * Constructs an instance of the ApiOptions class, initializing various input components
     * with the given locale. Throws an error if the locale is invalid.
     *
     * @param {string} locale - The locale to use for initialization, defaults to 'en'.
     *                          Underscores in the locale string are replaced with hyphens.
     *
     * @throws {Error} If the locale is invalid or not recognized.
     */
    constructor( locale = 'en' ) {
        locale = locale.replaceAll('_', '-');
        const canonicalLocales = Intl.getCanonicalLocales(locale);
        if (canonicalLocales.length === 0) {
            throw new Error('Invalid locale: ' + locale);
        }
        this.#locale = new Intl.Locale(canonicalLocales[0]);
        this.#inputs.epiphanyInput = new EpiphanyInput(this.#locale);
        this.#inputs.ascensionInput = new AscensionInput(this.#locale);
        this.#inputs.corpusChristiInput = new CorpusChristiInput(this.#locale);
        this.#inputs.eternalHighPriestInput = new EternalHighPriestInput(this.#locale);
        this.#inputs.holydaysOfObligationInput = new HolydaysOfObligationInput();
        this.#inputs.localeInput = new LocaleInput(this.#locale);
        this.#inputs.yearInput = new YearInput();
        this.#inputs.yearTypeInput = new YearTypeInput(this.#locale);
        this.#inputs.acceptHeaderInput = new AcceptHeaderInput();
        this.#inputs.calendarPathInput = new CalendarPathInput(this.#locale);
    }

    /**
     * Basic heuristic to make Holy Days of Obligation select options labels human-friendly
     *
     * TODO: It would be even better to retrieve the actual "name" of the corresponding liturgical events from the current calendar,
     *       but this would require fetching the calendar data first, which is not ideal.
     *       So for now, this private method just applies some basic transformations to make the keys more readable.
     *       We don't have access to any calendar data in ApiClient._calendarData, because it is not a static property, it is an instance property.
     *       Had we access to that instance property, and calendar data had been fetched,
     *       we could filter the calendar data to find the corresponding localized event names.
     *
     * @param {string} key
     * @returns {string}
     */
    static #prettifyLabel(key) {
        return key
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, s => s.toUpperCase())
            .trim()
            .replace(/^(St(?:s?))/, '$1.')
            .replace('Mary Mother Of God', 'Mary, Mother of God')
            .replace('Peter Paul Ap', 'Peter and Paul, Apostles');
    }

    /**
     * Applies the given settings to the corresponding input components.
     *
     * @param {Object} settings - An object containing key-value pairs representing the settings to apply.
     *                            The keys should correspond to the expected settings keys defined in {@link ApiOptions.#expectedSettingsKeys}.
     *                            Boolean values will be converted to 'true' or 'false' strings.
     *                            For the 'holydays_of_obligation' key, the value should be an object where each key is an option key
     *                            and the value is a boolean indicating whether the option is selected.
     *                            Any keys not in the expected settings keys will be ignored.
     * @see {@link ApiOptions.#expectedSettingsKeys}
     * @private
     */
    #applySettingsToInputs(settings) {
        Object.entries(settings).forEach(([key, value]) => {
            // skip keys that are not expected, so that the script doesn't break when an unexpected key is encountered
            if (!ApiOptions.#expectedSettingsKeys.includes(key)) {
                return;
            }
            // transform the key from snake_case to camelCase
            key = key.replaceAll('_', ' ');
            key = key.split(' ').map((word, index) => index === 0 ? word.charAt(0).toLowerCase() + word.slice(1) : word.charAt(0).toUpperCase() + word.slice(1)).join('');
            //console.log(`national settings: transformed key: ${key}, value type: ${typeof value}`);
            if (typeof value === 'boolean') {
                value = (value ? 'true' : 'false');
            }
            if (key === 'holydaysOfObligation' && typeof value === 'object') {
                const optionsArray = Object.entries(value).map(([optionKey, optionSelected]) => ({
                    label: ApiOptions.#prettifyLabel(optionKey),
                    value: optionKey,
                    selected: Boolean(optionSelected)
                }));
                this.#inputs[`${key}Input`].setOptions(optionsArray);
            } else {
                this.#inputs[`${key}Input`]._domElement.value = value;
            }
        });
    }

    /**
     * Applies, underneath a diocese's own settings, the settings of the national
     * calendar the diocese belongs to — but ONLY for a rite that has a national
     * tier.
     *
     * For a rite with `hasNationalTier === false` there is no national tier to
     * consult, so the lookup is skipped entirely rather than guarded with a
     * fallback or a placeholder. Both failure modes it removes are real:
     *
     * - `lugano_ch` is Ambrosian and its nation `CH` has no national calendar
     *   at all, so the lookup returned `undefined` and `.settings` threw a
     *   `TypeError` from inside a `change` listener, where it surfaced as an
     *   unhandled exception with no labelled error;
     * - `milano_it` / `bergam_it` / `novara_it` are Ambrosian but their nation
     *   `IT` DOES have a (Roman) national calendar, so the lookup silently
     *   applied Italy's Roman settings to an Ambrosian diocese.
     *
     * The rite is read from the CalendarSelect itself rather than from a linked
     * `RiteSelect`, so a select built for a rite through the constructor option
     * is handled the same way as one driven by a rite select.
     *
     * @param {CalendarSelect} calendarSelect - The linked calendar select the diocese was chosen from.
     * @param {Object} diocesanCalendar - The selected diocesan calendar's metadata entry.
     * @private
     */
    #applyNationalSettingsForDiocese( calendarSelect, diocesanCalendar ) {
        if ( false === RiteProperties[ calendarSelect._rite ].hasNationalTier ) {
            return;
        }
        const nationalCalendarForDiocese = ApiClient._metadata.national_calendars.find( nationCalendarObj => nationCalendarObj.calendar_id === diocesanCalendar.nation );
        //console.info('handling national calendar settings for diocesan calendar:', nationalCalendarForDiocese.settings);
        this.#applySettingsToInputs( nationalCalendarForDiocese.settings );
    }

    /**
     * Applies the enable/disable rule for the temporal option inputs.
     *
     * The rule composes two independent halves, and BOTH must hold for an input
     * to be enabled:
     *
     * - the rite must not fix the celebration itself (the Ambrosian Missal
     *   fixes Epiphany to 6 January, Ascension to the fortieth day of Easter
     *   and Corpus Domini to the Thursday after Trinity, and does not establish
     *   the Eternal High Priest at all);
     * - no nation or diocese may be selected, since a selected calendar carries
     *   its own settings for these.
     *
     * Implementing only the rite half is what let a user return to the
     * rite-level empty option under Ambrosian and re-enable the inputs, making
     * `/calendar/ambrosian?ascension=SUNDAY` reachable — a request that moves a
     * feast the Missal fixes.
     *
     * Holy days of obligation are not fixed by any rite, so they follow the
     * calendar-selection half alone.
     *
     * @param {boolean} calendarSelected - Whether a nation or diocese is currently selected.
     * @private
     */
    #applyTemporalInputState( calendarSelected ) {
        const fixedTemporalDisabled = calendarSelected || this.#riteFixesTemporalOptions;
        this.#inputs.epiphanyInput.disabled( fixedTemporalDisabled );
        this.#inputs.ascensionInput.disabled( fixedTemporalDisabled );
        this.#inputs.corpusChristiInput.disabled( fixedTemporalDisabled );
        this.#inputs.eternalHighPriestInput.disabled( fixedTemporalDisabled );
        this.#inputs.holydaysOfObligationInput.disabled( calendarSelected );
    }

    /**
     * Enables or disables the `/calendar/nation/` route offered by the
     * calendar path input, according to whether the rite has a national tier.
     *
     * There is no `/calendar/ambrosian/nation/...` route: the API rejects a
     * non-null national calendar for a rite with no national tier outright. If
     * that route was already selected when the rite changed, the selection
     * falls back to the rite-level route.
     *
     * @param {boolean} hasNationalTier
     * @private
     */
    /**
     * Narrows the locale input to the locales the rite-level calendar is actually
     * published in.
     *
     * The Ambrosian rite has liturgical books in Italian and Latin only, and the
     * API's metadata says so — `ambrosian_calendars[].locales` is `['it','la']`.
     * Without this the select kept offering every locale the API supports
     * globally, so a user could request an Ambrosian calendar in a language that
     * has no Ambrosian books behind it.
     *
     * Looks the rite up by convention rather than by branching on it: metadata
     * announces a rite's own calendars under `{rite}_calendars`. The Roman rite
     * has no such key, because its rite-level calendar is the General Roman
     * Calendar, served in every locale the API supports — so the absence of the
     * key correctly falls back to the full list.
     *
     * Only the RITE-LEVEL calendar is handled here. Once an actual nation or
     * diocese is selected, its own `locales` take over via
     * `setOptionsForCalendarLocales()` on the calendar-select path.
     *
     * @param {string} rite - The newly selected rite.
     * @private
     */
    #applyRiteToLocaleInput( rite ) {
        const riteCalendars = ApiClient._metadata?.[ `${rite}_calendars` ];
        const riteLevelCalendar = Array.isArray( riteCalendars )
            ? riteCalendars.find( calendar => calendar.calendar_id === rite )
            : null;

        if ( Array.isArray( riteLevelCalendar?.locales ) && riteLevelCalendar.locales.length > 0 ) {
            this.#inputs.localeInput.setOptionsForCalendarLocales( riteLevelCalendar.locales );
        } else {
            this.#inputs.localeInput.resetOptions();
        }
    }

    #applyRiteToCalendarPathInput( hasNationalTier ) {
        const calendarPathElement = this.#inputs.calendarPathInput._domElement;
        const nationPathOption = calendarPathElement.querySelector( 'option[value="/calendar/nation/"]' );
        if ( null === nationPathOption ) {
            return;
        }
        nationPathOption.disabled = false === hasNationalTier;
        if ( nationPathOption.disabled && calendarPathElement.value === nationPathOption.value ) {
            calendarPathElement.value = '/calendar';
            calendarPathElement.dispatchEvent( new Event( 'change' ) );
        }
    }

    /**
     * Wire a `RiteSelect` to the linked calendar select(s) and to the four
     * fixed-temporal-option inputs and the year floor.
     *
     * Mirrors what `#handleMultipleLinkedCalendarSelects` already does for the
     * nation -> diocese chain, one level up: on every rite change it rebuilds
     * the calendar select(s) for the new rite, shows/hides the nation select
     * when linked as a pair, applies the rite's structural constraints to the
     * option inputs, and resets the calendar selection, since a calendar_id
     * from one rite is never valid under another.
     *
     * @param {RiteSelect} riteSelect - The `RiteSelect` instance to wire up.
     * @param {CalendarSelect | [CalendarSelect, CalendarSelect]} calendarSelect - The linked CalendarSelect instance(s).
     * @private
     */
    #handleLinkedRiteSelect( riteSelect, calendarSelect ) {
        const selects = Array.isArray( calendarSelect ) ? calendarSelect : [ calendarSelect ];

        // The calendar-side rebuild lives on CalendarSelect, so there is one
        // implementation of it. Linked FIRST so that each select's listener is
        // registered before the one below: listeners fire in registration order, and
        // the option state applied here assumes the selection has already been reset.
        selects.forEach( cs => cs.linkToRiteSelect( riteSelect ) );

        const applyRite = ( rite ) => {
            const riteProps = RiteProperties[ rite ];

            this.#currentEndpoint.rite = rite;
            this.#riteFixesTemporalOptions = riteProps.hasFixedTemporalOptions;

            // The selection has just been reset to the rite-level calendar, so the
            // calendar-selection half of the rule is false here; the rite half is
            // carried by `#riteFixesTemporalOptions`, set above.
            this.#applyTemporalInputState( false );

            this.#inputs.yearInput.min( riteProps.minYear );
            // Decision 5: pre-empt an invalid request rather than let it through.
            // Raising `min` alone leaves an already-entered year below the new floor
            // untouched — e.g. 1970 (valid Roman) is below the Ambrosian floor of
            // 1976 — which the API would reject. Clamp it up and notify listeners
            // with a `change` event, matching how a user edit would.
            const yearInputElement = this.#inputs.yearInput._domElement;
            if ( Number( yearInputElement.value ) < riteProps.minYear ) {
                yearInputElement.value = riteProps.minYear;
                yearInputElement.dispatchEvent( new Event( 'change' ) );
            }
            this.#applyRiteToCalendarPathInput( riteProps.hasNationalTier );
            this.#applyRiteToLocaleInput( rite );

            this.#currentEndpoint.calendarType = null;
            this.#currentEndpoint.calendarId   = null;

            // `linkToRiteSelect()` already dispatched its own `change` on each
            // eligible select as part of the rebuild above (registered first, so it
            // ran before this listener). `PathBuilder` (when constructed on this
            // same select) is one of the listeners on the receiving end of that
            // dispatch, and it renders from `#currentEndpoint` — which at that
            // point still held the PREVIOUS rite, because this listener (the one
            // that updates `#currentEndpoint`) had not run yet. Re-dispatching here,
            // now that `#currentEndpoint` is current, is what makes the displayed
            // path catch up.
            //
            // Filtered the same way `linkToRiteSelect()` filters its own dispatch:
            // a select with dependent diocese selects (the nation half of a linked
            // pair) carries its own `change` listener that would re-derive the
            // diocese options for the now-empty nation value and stomp the flat
            // list `_applyRite()` just built for a tierless rite.
            selects
                .filter( cs => false === cs._hasDependentDioceseSelects )
                .forEach( cs => cs._domElement.dispatchEvent( new Event( 'change' ) ) );
        };

        riteSelect._domElement.addEventListener( 'change', ( ev ) => applyRite( ev.target.value ) );
        applyRite( riteSelect._domElement.value );
    }

    /**
     * Applies a selected calendar's own settings and locales to the option inputs.
     *
     * Extracted so both linked forms behave alike. This work used to be inlined
     * in `#handleSingleLinkedCalendarSelect()` only — twice, once at link time and
     * once in its change listener — while the paired nation/diocese form did none
     * of it, so picking a calendar there left the locale select offering every
     * locale the API supports and the inputs showing settings from a different
     * calendar.
     *
     * @param {CalendarSelect} calendarSelect - The select the calendar was chosen
     *   in. Supplies the rite, which decides whether a diocese inherits national
     *   settings.
     * @param {string} calendarId - The selected `calendar_id`.
     * @param {?string} calendarType - `national` or `diocesan`, from the option's
     *   `data-calendartype`.
     * @param {boolean} [notify=false] - Whether to dispatch `change` on the locale
     *   input afterwards, so a listening `ApiClient` picks the new locale up. Not
     *   wanted at link time, when nothing has changed yet.
     * @returns {boolean} `false` if `calendarType` is neither known value, so each
     *   caller can keep its own handling of that case — the link-time path throws,
     *   the change paths ignore it.
     * @private
     */
    #applyCalendarToInputs( calendarSelect, calendarId, calendarType, notify = false ) {
        switch ( calendarType ) {
            case 'national': {
                const nationalCalendar = ApiClient._metadata.national_calendars.find( obj => obj.calendar_id === calendarId );
                this.#applySettingsToInputs( nationalCalendar.settings );
                this.#inputs.localeInput.setOptionsForCalendarLocales( nationalCalendar.locales );
                break;
            }
            case 'diocesan': {
                const diocesanCalendar = ApiClient._metadata.diocesan_calendars.find( obj => obj.calendar_id === calendarId );
                this.#applyNationalSettingsForDiocese( calendarSelect, diocesanCalendar );
                if ( Object.hasOwn( diocesanCalendar, 'settings' ) ) {
                    this.#applySettingsToInputs( diocesanCalendar.settings );
                }
                this.#inputs.localeInput.setOptionsForCalendarLocales( diocesanCalendar.locales );
                break;
            }
            default:
                return false;
        }
        if ( notify ) {
            this.#inputs.localeInput._domElement.dispatchEvent( new Event( 'change' ) );
        }
        return true;
    }

    // TODO: add support for multiple linked calendar selects
    #handleMultipleLinkedCalendarSelects(calendarSelects) {
        const nationSelector = calendarSelects[0]._filter === CalendarSelectFilter.NATIONAL_CALENDARS ? calendarSelects[0] : calendarSelects[1];
        const dioceseSelector = calendarSelects[0]._filter === CalendarSelectFilter.DIOCESAN_CALENDARS ? calendarSelects[0] : calendarSelects[1];

        /**
         * Both selects describe ONE calendar between them, so both listeners run
         * the same routine over the combined state rather than each reacting only
         * to its own element.
         *
         * The more specific selection wins: a diocese carries its own locales and
         * inherits its nation's settings, so once one is chosen the nation adds
         * nothing. With neither chosen the calendar is the rite-level one.
         */
        const applySelection = () => {
            const nationValue  = nationSelector._domElement.value;
            const dioceseValue = dioceseSelector._domElement.value;

            if ( dioceseValue !== '' ) {
                this.#applyCalendarToInputs( dioceseSelector, dioceseValue, 'diocesan', true );
            } else if ( nationValue !== '' ) {
                this.#applyCalendarToInputs( nationSelector, nationValue, 'national', true );
            } else {
                this.#applyRiteToLocaleInput( this.#currentEndpoint.rite );
            }

            this.#applyTemporalInputState( nationValue !== '' || dioceseValue !== '' );
        };

        nationSelector._domElement.addEventListener('change', applySelection);
        dioceseSelector._domElement.addEventListener('change', applySelection);
    }


    /**
     * Handles the events for a single linked calendar select.
     *
     * This function is called whenever the select element of the single linked calendar select changes.
     * It takes the value of the currently selected calendar and a boolean indicating whether the select element is disabled.
     *
     * @param {CalendarSelect} calendarSelect - The single linked calendar select to handle events for.
     * @private
     */
    #handleSingleLinkedCalendarSelect(calendarSelect) {
        //console.log('handling single linked calendar select', calendarSelect, this.#filtersSet);
        if (this.#filtersSet.includes(ApiOptionsFilter.PATH_BUILDER)) {
            calendarSelect.allowNull(false).disabled()._domElement.innerHTML = '<option value="">GENERAL ROMAN</option>';
            let lastCalendarPathValue = this.#inputs.calendarPathInput._domElement.value;
            let lastCalendarSelectValue = calendarSelect._domElement.value;
            this.#inputs.calendarPathInput._domElement.addEventListener('change', (ev) => {
                if (ev.target.value !== lastCalendarPathValue) {
                    lastCalendarPathValue = ev.target.value;
                    switch (ev.target.value) {
                        case '/calendar':
                            calendarSelect.disabled(true)._domElement.innerHTML = '<option value="">GENERAL ROMAN</option>';
                            break;
                        // _applyFilter, not filter(): the user can switch back and
                        // forth between these two paths, and filter() refuses a
                        // second, different value. See CalendarSelect._applyFilter.
                        case '/calendar/nation/':
                            calendarSelect.disabled(false)._applyFilter(CalendarSelectFilter.NATIONAL_CALENDARS);
                            break;
                        case '/calendar/diocese/':
                            calendarSelect.disabled(false)._applyFilter(CalendarSelectFilter.DIOCESAN_CALENDARS);
                            break;
                    }
                    if (calendarSelect._domElement.firstChild.getAttribute('value') !== lastCalendarSelectValue) {
                        lastCalendarSelectValue = calendarSelect._domElement.value;
                        calendarSelect._domElement.dispatchEvent(new Event('change'));
                    }
                }
            });
        }

        let currentSelectedCalendarId = calendarSelect._domElement.value;
        if (currentSelectedCalendarId !== '') {
            let currentSelectedCalendarType = calendarSelect._domElement.querySelector(':checked').getAttribute('data-calendartype');
            if ( false === this.#applyCalendarToInputs( calendarSelect, currentSelectedCalendarId, currentSelectedCalendarType ) ) {
                throw new Error('Unknown calendar type: ' + currentSelectedCalendarType);
            }
            this.#applyTemporalInputState( true );
        } else {
            this.#applyTemporalInputState( false );
            // An empty selection IS the rite-level calendar, so offer that
            // calendar's locales rather than every locale the API supports.
            // Falls back to the full list for a rite that does not restrict
            // them, which is what the Roman rite does.
            this.#applyRiteToLocaleInput( this.#currentEndpoint.rite );
        }
        calendarSelect._domElement.addEventListener('change', (ev) => {
            if (ev.target.value === '') {
                this.#applyTemporalInputState( false );
                // See above: empty means the rite-level calendar.
                this.#applyRiteToLocaleInput( this.#currentEndpoint.rite );
            } else {
                const selectedCalendarType = calendarSelect._domElement.querySelector(':checked').getAttribute('data-calendartype');
                // An unrecognised type is ignored here rather than thrown, as it
                // always has been on this path.
                this.#applyCalendarToInputs( calendarSelect, ev.target.value, selectedCalendarType, true );
                this.#applyTemporalInputState( true );
            }
        });
    }

    /**
     * Sets the filter for the ApiOptions instance.
     *
     * The filter can be either `ApiOptionsFilter.ALL_CALENDARS`, `ApiOptionsFilter.GENERAL_ROMAN`, `ApiOptionsFilter.PATH_BUILDER`, `ApiOptionsFilter.LOCALE_ONLY`, `ApiOptionsFilter.YEAR_ONLY`, or `ApiOptionsFilter.NONE`.
     * - `ApiOptionsFilter.ALL_CALENDARS` will show only the form controls that are useful for all calendars: locale, yearType, year, and conditionally acceptHeader inputs.
     * - `ApiOptionsFilter.GENERAL_ROMAN` will show only the form controls that are useful for the General Roman Calendar: epiphany, ascension, corpusChristi, and eternalHighPriest inputs.
     * - `ApiOptionsFilter.PATH_BUILDER` will show only the form controls that are useful for the Path Builder: calendarPath and year inputs.
     * - `ApiOptionsFilter.LOCALE_ONLY` will show only the locale input, useful when you only need language selection.
     * - `ApiOptionsFilter.YEAR_ONLY` will show only the year input, useful when used with LiturgyOfAnyDay component.
     * - `ApiOptionsFilter.NONE` will show all possible form controls.
     *
     * If the filter is set to a value that is not a valid value for the `ApiOptionsFilter` enum,
     * an error will be thrown.
     *
     * If the filter has been previously set to a value that is not ApiOptionsFilter.NONE,
     * the select elements will be filtered accordingly, but a value of ApiOptionsFilter.NONE cannot be set.
     *
     * If the filter has been previously set to ApiOptionsFilter.NONE,
     * the select elements will be filtered accordingly, but a value other than ApiOptionsFilter.NONE cannot be set.
     *
     * @param {string} [filter=ApiOptionsFilter.NONE] The filter to set.
     * @throws {Error} If the filter is set to a value that is not a valid value for the `ApiOptionsFilter` enum.
     * @throws {Error} If the filter is set to a value that is different from the current filter.
     * @returns {ApiOptions} The ApiOptions instance.
     */
    filter( filter = ApiOptionsFilter.NONE ) {
        if (
            ApiOptionsFilter.ALL_CALENDARS !== filter
            && ApiOptionsFilter.GENERAL_ROMAN !== filter
            && ApiOptionsFilter.PATH_BUILDER !== filter
            && ApiOptionsFilter.LOCALE_ONLY !== filter
            && ApiOptionsFilter.YEAR_ONLY !== filter
            && ApiOptionsFilter.NONE !== filter
        ) {
            throw new Error('Invalid filter: ' + filter + ', must be one of `ApiOptionsFilter.ALL_CALENDARS`, `ApiOptionsFilter.GENERAL_ROMAN`, `ApiOptionsFilter.PATH_BUILDER`, `ApiOptionsFilter.LOCALE_ONLY`, `ApiOptionsFilter.YEAR_ONLY`, or `ApiOptionsFilter.NONE`');
        }
        if (
            filter === ApiOptionsFilter.NONE
            && [ApiOptionsFilter.ALL_CALENDARS, ApiOptionsFilter.GENERAL_ROMAN, ApiOptionsFilter.PATH_BUILDER, ApiOptionsFilter.LOCALE_ONLY, ApiOptionsFilter.YEAR_ONLY].includes(this.#filter)
        ) {
            throw new Error('Cannot set filter to `ApiOptionsFilter.NONE` when filter has already been set to a value that is not `ApiOptionsFilter.NONE`');
        }
        if (
            [ApiOptionsFilter.ALL_CALENDARS, ApiOptionsFilter.GENERAL_ROMAN, ApiOptionsFilter.PATH_BUILDER, ApiOptionsFilter.LOCALE_ONLY, ApiOptionsFilter.YEAR_ONLY].includes(filter)
            && this.#filtersSet.includes(ApiOptionsFilter.NONE)
        ) {
            throw new Error('Cannot set filter to a value that is not `ApiOptionsFilter.NONE` when filter has already been set explicitly to `ApiOptionsFilter.NONE`');
        }
        this.#filter = filter;
        this.#filtersSet.push(filter);
        return this;
    }

    /**
     * Link the ApiOptions instance to a CalendarSelect instance or an array of two CalendarSelect instances.
     * When a CalendarSelect instance is linked, the selected calendar's settings will be used to populate the
     * API options. When the selected calendar is changed, the API options will be updated accordingly.
     * If two CalendarSelect instances are linked, one must be a `nations` filtered CalendarSelect and the other a
     * `dioceses` filtered CalendarSelect. When the selected calendar is changed in either of the two CalendarSelect
     * instances, the API options will be updated accordingly.
     * @param {CalendarSelect | [CalendarSelect, CalendarSelect]} calendarSelect - The CalendarSelect instance or
     * an array of two CalendarSelect instances (one for nations and one for dioceses) to link to the ApiOptions instance.
     * @param {?RiteSelect} [riteSelect=null] - An optional `RiteSelect` instance. When provided, `ApiOptions`
     * drives the whole rite -> calendar chain: the linked CalendarSelect(s) are rebuilt for the selected rite,
     * the nation select (when linked as a pair) is hidden for rites with no national tier, the fixed-temporal-option
     * inputs are disabled for rites that fix their own temporal cycle, the year floor is adjusted, and the calendar
     * selection is reset on every rite change. This instance's `explicitRite` is set to `true`, so the rite segment
     * is always spelled out in the resulting path, even for the Roman rite.
     *
     * `explicitRite` is scoped to THIS instance's `CurrentEndpoint` (see `_currentEndpoint`),
     * so linking a `RiteSelect` here affects only the `PathBuilder` constructed against this
     * same `ApiOptions`. A page mixing rite-aware and legacy embeds keeps the legacy embeds'
     * displayed paths byte-identical to what they were before rite awareness existed. Note
     * that it is still one-way WITHIN this instance — `linkToCalendarSelect` throws on a
     * second call, so there is no supported way to un-link a `RiteSelect` and revert to the
     * implicit form.
     * @returns {ApiOptions} - The ApiOptions instance.
     * @throws {Error} If `riteSelect` is provided but is not an instance of `RiteSelect`.
     */
    linkToCalendarSelect(calendarSelect, riteSelect = null) {
        if (this.#linked) {
            throw new Error('Current ApiOptions instance already linked to another CalendarSelect instance');
        }
        // Type-check only: no side effects here yet. The actual rite wiring
        // (mutating `CurrentEndpoint`, attaching the rite-change listener,
        // rebuilding the calendar select(s)) is deferred until AFTER the
        // `calendarSelect` validation below has fully passed, so a rejected
        // `calendarSelect` never leaves `CurrentEndpoint` mutated or a
        // listener attached behind a thrown error.
        if (null !== riteSelect && false === riteSelect instanceof RiteSelect) {
            throw new Error('ApiOptions.linkToCalendarSelect: riteSelect must be of type `RiteSelect` but found type: ' + typeof riteSelect);
        }
        if (Array.isArray(calendarSelect)) {
            if (calendarSelect.length > 2) {
                throw new Error('Cannot link more than two CalendarSelect instances');
            }
            calendarSelect.forEach(calendarSelectInstance => {
                if (false === calendarSelectInstance instanceof CalendarSelect) {
                    throw new Error('ApiOptions.linkToCalendarSelect: Invalid type for items passed in parameter, must be of type `CalendarSelect` but found type: ' + typeof calendarSelect);
                }
            });
            if (
                (calendarSelect[0]._filter === 'nations' && calendarSelect[1]._filter !== 'dioceses')
                ||
                (calendarSelect[0]._filter === 'dioceses' && calendarSelect[1]._filter !== 'nations')
            ) {
                throw new Error('When linking two CalendarSelect instances, one instance must be a `nations` filtered CalendarSelect and the other a `dioceses` filtered CalendarSelect, instead we found: ' + calendarSelect[0]._filter + ' and ' + calendarSelect[1]._filter);
            }
            this.#handleMultipleLinkedCalendarSelects(calendarSelect);
        } else {
            if (false === calendarSelect instanceof CalendarSelect) {
                throw new Error('ApiOptions.linkToCalendarSelect: Invalid type for parameter, must be of type `CalendarSelect` but found type: ' + typeof calendarSelect);
            }
            if (calendarSelect._filter !== 'none') {
                throw new Error('ApiOptions.linkToCalendarSelect: When linking a single CalendarSelect instance, it must be a `none` filtered CalendarSelect, instead we found: ' + calendarSelect._filter);
            }
            if (calendarSelect._domElement.children.length === 0) {
                throw new Error('ApiOptions.linkToCalendarSelect: You seem to be attempting to link to a CalendarSelect instance that is not fully initialized.');
            }
            this.#handleSingleLinkedCalendarSelect(calendarSelect);
        }
        // Only now, with `calendarSelect` fully validated, do the rite side
        // effects run: mutating `CurrentEndpoint`, attaching the rite-change
        // listener, and rebuilding the calendar select(s) for the current
        // rite. A `riteSelect` rejected above never reaches this point either,
        // since the type-check threw before we got here.
        if (null !== riteSelect) {
            this.#currentEndpoint.explicitRite = true;
            this.#handleLinkedRiteSelect(riteSelect, calendarSelect);
        }
        this.#linked = true;
        return this;
    }

    /**
     * Appends input elements to the specified DOM element, optionally filtered based on the ApiOptionsFilter.
     *
     * @param {string|HTMLElement} elementSelector - The CSS selector for the DOM element to which the input elements will be appended.
     */
    appendTo(elementSelector) {
        let domNode;
        if (typeof elementSelector === 'string') {
            domNode = Utils.validateElementSelector( elementSelector );
        }
        else if(elementSelector instanceof HTMLElement) {
            domNode = elementSelector;
        } else {
            throw new Error('ApiOptions.appendTo: parameter must be a valid CSS selector or an instance of HTMLElement');
        }
        if (ApiOptionsFilter.PATH_BUILDER === this.#filter) {
            this.#inputs.calendarPathInput.appendTo(domNode);
            this.#inputs.yearInput.appendTo(domNode);
            this.#pathBuilderEnabled = true;
        }
        if (ApiOptionsFilter.LOCALE_ONLY === this.#filter) {
            this.#inputs.localeInput.appendTo(domNode);
        }
        if (ApiOptionsFilter.YEAR_ONLY === this.#filter) {
            this.#inputs.yearInput.appendTo(domNode);
        }
        if (ApiOptionsFilter.NONE === this.#filter || ApiOptionsFilter.ALL_CALENDARS === this.#filter) {
            this.#inputs.localeInput.appendTo(domNode);
            this.#inputs.yearTypeInput.appendTo(domNode);
            if (false === this.#inputs.acceptHeaderInput._hidden) {
                this.#inputs.acceptHeaderInput.appendTo(domNode);
            }
            // If we have implemented a Path builder, it will have already appended the year input,
            // so we shouldn't append it again
            if (false === this.#pathBuilderEnabled) {
                this.#inputs.yearInput.appendTo(domNode);
            }
        }
        if (ApiOptionsFilter.NONE === this.#filter || ApiOptionsFilter.GENERAL_ROMAN === this.#filter) {
            this.#inputs.epiphanyInput.appendTo(domNode);
            this.#inputs.ascensionInput.appendTo(domNode);
            this.#inputs.corpusChristiInput.appendTo(domNode);
            this.#inputs.eternalHighPriestInput.appendTo(domNode);
            this.#inputs.holydaysOfObligationInput.appendTo(domNode);
        }
        // This should only be the case when no filter has been set explicitly via the filter method,
        // and therefore this.#filter = ApiOptionsFilter.NONE
        if (this.#filtersSet.length === 0) {
            this.#filtersSet.push(this.#filter);
        }
    }

    /**
     * Gets the Epiphany input element.
     *
     * @returns {EpiphanyInput} The Epiphany input element.
     * @readonly
     */
    get _epiphanyInput() {
        return this.#inputs.epiphanyInput;
    }

    /**
     * Gets the Ascension input element.
     *
     * @returns {AscensionInput} The Ascension input element.
     * @readonly
     */
    get _ascensionInput() {
        return this.#inputs.ascensionInput;
    }

    /**
     * Gets the Corpus Christi input element.
     *
     * @returns {CorpusChristiInput} The Corpus Christi input element.
     * @readonly
     */
    get _corpusChristiInput() {
        return this.#inputs.corpusChristiInput;
    }

    /**
     * Gets the Eternal High Priest input element.
     *
     * @returns {EternalHighPriestInput} The Eternal High Priest input element.
     * @readonly
     */
    get _eternalHighPriestInput() {
        return this.#inputs.eternalHighPriestInput;
    }

    /**
     * Gets the Holydays of Obligation input element.
     *
     * @returns {HolydaysOfObligationInput} The Holydays of Obligation input element.
     * @readonly
     */
    get _holydaysOfObligationInput() {
        return this.#inputs.holydaysOfObligationInput;
    }

    /**
     * Gets the locale input element.
     *
     * @returns {LocaleInput} The locale input element.
     * @readonly
     */
    get _localeInput() {
        return this.#inputs.localeInput;
    }

    /**
     * Gets the year type input element.
     *
     * @returns {YearTypeInput} The year type input element.
     * @readonly
     */
    get _yearTypeInput() {
        return this.#inputs.yearTypeInput;
    }

    /**
     * Gets the year input element.
     *
     * @returns {YearInput} The year input element.
     * @readonly
     */
    get _yearInput() {
        return this.#inputs.yearInput;
    }

    /**
     * Gets the Accept header input element.
     *
     * @returns {AcceptHeaderInput} The Accept header input element.
     * @readonly
     */
    get _acceptHeaderInput() {
        return this.#inputs.acceptHeaderInput;
    }

    /**
     * Gets the calendar path input element.
     *
     * @returns {CalendarPathInput} The calendar path input element.
     * @readonly
     */
    get _calendarPathInput() {
        return this.#inputs.calendarPathInput;
    }

    /**
     * Gets the CURRENT filter of the ApiOptions instance.
     * The filter can be set explicitly multiple times, and the last set filter will be returned.
     *
     * The filter can be either `ApiOptionsFilter.GENERAL_ROMAN`, `ApiOptionsFilter.ALL_CALENDARS`, `ApiOptionsFilter.PATH_BUILDER`, `ApiOptionsFilter.LOCALE_ONLY`, `ApiOptionsFilter.YEAR_ONLY`, or `ApiOptionsFilter.NONE`.
     * - `ApiOptionsFilter.ALL_CALENDARS` will show only the form controls that are useful for all calendars: locale, yearType, year, and conditionally acceptHeader inputs.
     * - `ApiOptionsFilter.GENERAL_ROMAN` will show only the form controls that are useful for the General Roman Calendar: epiphany, ascension, corpusChristi, and eternalHighPriest inputs.
     * - `ApiOptionsFilter.PATH_BUILDER` will show only the form controls that are useful for the Path Builder: calendarPath and year inputs.
     * - `ApiOptionsFilter.LOCALE_ONLY` will show only the locale input, useful when you only need language selection.
     * - `ApiOptionsFilter.YEAR_ONLY` will show only the year input, useful when used with LiturgyOfAnyDay component.
     * - `ApiOptionsFilter.NONE` will show all possible form controls.
     *
     * @returns {string} The current filter of the ApiOptions instance.
     * @readonly
     */
    get _filter() {
        return this.#filter;
    }

    /**
     * Gets the set of filters that have been applied to the ApiOptions instance.
     *
     * This is a list of filter values that have been set, and may contain multiple
     * entries if filters have been set in succession.
     *
     * @returns {Array<string>} An array of filter values applied to the ApiOptions instance.
     * @readonly
     */
    get _filtersSet() {
        return this.#filtersSet;
    }

    /**
     * Gets this instance's endpoint state (path segments plus query parameters).
     *
     * Intended for the `PathBuilder` constructed against this `ApiOptions`, which
     * mutates the returned object as the user changes inputs and serializes it to
     * render the displayed path. Returned by reference, not copied, precisely so
     * that both sides share one object — but only ever this instance's, never a
     * module-level one shared with other embeds on the page.
     *
     * @returns {CurrentEndpoint} This instance's CurrentEndpoint.
     * @readonly
     */
    get _currentEndpoint() {
        return this.#currentEndpoint;
    }
}
