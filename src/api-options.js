import { AcceptHeaderInput, AscensionInput, CorpusChristiInput, EpiphanyInput, LocaleInput, EternalHighPriestInput, YearTypeInput } from './ApiOptions/Input/index.js';
import { CalendarSelect, LitCalApiClient } from './index.js';

export default class ApiOptions {
    #locale                = null;
    epiphanyInput          = null;
    ascensionInput         = null;
    corpusChristiInput     = null;
    localeInput            = null;
    eternalHighPriestInput = null;
    yearTypeInput          = null;
    acceptHeaderInput      = null;
    #linked                = false;

    constructor( locale = 'en' ) {
        locale = locale.replaceAll('_', '-');
        const canonicalLocales = Intl.getCanonicalLocales(locale);
        if (canonicalLocales.length === 0) {
            throw new Error('Invalid locale: ' + locale);
        }
        this.#locale = new Intl.Locale(canonicalLocales[0]);
        console.log(`typeof ApiOptions.#locale: ${typeof this.#locale}`);
        this.epiphanyInput = new EpiphanyInput();
        this.ascensionInput = new AscensionInput();
        this.corpusChristiInput = new CorpusChristiInput();
        this.localeInput = new LocaleInput(this.#locale);
        this.eternalHighPriestInput = new EternalHighPriestInput();
        this.yearTypeInput = new YearTypeInput();
        this.acceptHeaderInput = new AcceptHeaderInput();
    }

    linkToCalendarSelect(calendarSelect) {
        if (this.#linked) {
            throw new Error('Current ApiOptions instance already linked to another CalendarSelect instance');
        }
        if (Array.isArray(calendarSelect)) {
            if (calendarSelect.length > 2) {
                throw new Error('Cannot link more than two CalendarSelect instances');
            }
            calendarSelect.forEach(calendarSelectInstance => {
                if (false === calendarSelectInstance instanceof CalendarSelect) {
                    throw new Error('Invalid type for items passed to linkToCalendarSelect, must be of type `CalendarSelect` but found type: ' + typeof calendarSelect);
                }
            });
            if (
                (calendarSelect[0].getFilter === 'nations' && calendarSelect[1].getFilter !== 'dioceses')
                ||
                (calendarSelect[0].getFilter === 'dioceses' && calendarSelect[1].getFilter !== 'nations')
            ) {
                throw new Error('When linking two CalendarSelect instances, one instance must be a `nations` filtered CalendarSelect and the other a `dioceses` filtered CalendarSelect, instead we found: ' + calendarSelect[0].getFilter() + ' and ' + calendarSelect[1].getFilter());
            }
        } else {
            if (false === calendarSelect instanceof CalendarSelect) {
                throw new Error('Invalid type for parameter passed to linkToCalendarSelect, must be of type `CalendarSelect` but found type: ' + typeof calendarSelect);
            }
            if (calendarSelect.getFilter() !== 'none') {
                throw new Error('When linking a single CalendarSelect instance, it must be a `none` filtered CalendarSelect, instead we found: ' + calendarSelect.getFilter());
            }
            calendarSelect.getDomElement().addEventListener('change', (ev) => {
                // TODO: set selected values based on selected calendar
                // TODO: set available options for locale select based on selected calendar
                if (ev.target.value === '') {
                    // all API options enabled
                    this.epiphanyInput.disabled(false);
                    this.ascensionInput.disabled(false);
                    this.corpusChristiInput.disabled(false);
                    this.eternalHighPriestInput.disabled(false);
                } else {
                    // all API options disabled
                    this.epiphanyInput.disabled(true);
                    this.ascensionInput.disabled(true);
                    this.corpusChristiInput.disabled(true);
                    this.eternalHighPriestInput.disabled(true);
                }
            })
        }
        this.#linked = true;
        return this;
    }

    appendTo(element, pathType = null) {
        if (null === pathType || pathType === 'basePath') {
            this.epiphanyInput.appendTo(element);
            this.ascensionInput.appendTo(element);
            this.corpusChristiInput.appendTo(element);
            this.eternalHighPriestInput.appendTo(element);
        }
        if (null === pathType || pathType === 'allPaths') {
            this.localeInput.appendTo(element);
            this.yearTypeInput.appendTo(element);
            if (false === this.acceptHeaderInput.isHidden()) {
                this.acceptHeaderInput.appendTo(element);
            }
        }
    }
}
