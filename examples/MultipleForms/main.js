import { ApiClient, CalendarSelect, ApiOptions, Input, WebCalendar, Grouping, ColorAs, Column, ColumnOrder, DateFormat, GradeDisplay, CalendarSelectFilter } from 'liturgy-components-js';

Input.setGlobalInputClass('form-select');
Input.setGlobalLabelClass('form-label d-block mb-1');
Input.setGlobalWrapper('div');
Input.setGlobalWrapperClass('form-group col col-md-3');

function buildVirtualSelectOptions( selectElement ) {
    return Array.from(selectElement.options).map(opt => ({
        label: opt.textContent,
        value: opt.value,
        selected: opt.selected
    }));
}

function buildAndInitVirtualSelectFromNativeSelect(nativeSelect, vsContainerId) {
  // 1) build options and selected values
  const opts = buildVirtualSelectOptions(nativeSelect);
  const selectedValues = opts.filter(o => o.selected).map(o => o.value);

  // 2) init VirtualSelect on the div container
  VirtualSelect.init({
    ele: `#${vsContainerId}`,
    showValueAsTags: true,
    //additionalToggleButtonClasses: "btn",
    additionalDropboxContainerClasses: "dropdown-menu",
    multiple: true,
    search: false,
    options: opts,
    selectedValue: selectedValues,
    onChange: function(value) {
        // value is an array in multiple mode
        // sync back to the native select
        Array.from(nativeSelect.options).forEach(opt => {
            opt.selected = value.includes(opt.value);
        });
        nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
}

/**
 * Wires up a virtual select for the holy days of obligation setting UI.
 * @param {ApiOptions} apiOptions - instance of ApiOptions
 * @param {CalendarSelect} calendarSelect - instance of CalendarSelect
 * @param {string} vsContainerId - id of virtual select container element
 * @throws {Error} if apiOptions is not an instance of ApiOptions
 * @throws {Error} if calendarSelect is not an instance of CalendarSelect
 * @throws {Error} if vsContainerId is not a non-empty string
 */
function wireHdobVS( apiOptions, calendarSelect, vsContainerId ) {
    if (false === (apiOptions instanceof ApiOptions)) {
        throw new Error('apiOptions must be an instance of ApiOptions');
    }
    if (false === (calendarSelect instanceof CalendarSelect)) {
        throw new Error('calendarSelect must be an instance of CalendarSelect');
    }
    if (false === (typeof vsContainerId === 'string' && vsContainerId.length > 0)) {
        throw new Error('vsContainerId must be a non-empty string');
    }
    // 1. Create a new container element for the virtual select
    const hdobVirtualSelect = document.createElement('div');
    hdobVirtualSelect.id = vsContainerId;
    // 2. Insert it right after the original native select
    apiOptions._holydaysOfObligationInput._domElement.parentNode.insertBefore( hdobVirtualSelect, apiOptions._holydaysOfObligationInput._domElement.nextSibling );
    // 3. Build and initialize the virtual select from the native select
    buildAndInitVirtualSelectFromNativeSelect( apiOptions._holydaysOfObligationInput._domElement, vsContainerId );
    if (calendarSelect.value() === '') {
        hdobVirtualSelect.enable();
    } else {
        hdobVirtualSelect.disable();
    }
    // 4. Listen to changes on the calendar select to rebuild and enable/disable the virtual select
    calendarSelect.onChange((ev) => {
        //console.log('calendar changed to:', ev.target.value);
        hdobVirtualSelect.destroy();
        buildAndInitVirtualSelectFromNativeSelect( apiOptions._holydaysOfObligationInput._domElement, vsContainerId );
        if (ev.target.value === '') {
            hdobVirtualSelect.enable();
        } else {
            hdobVirtualSelect.disable();
        }
    });
}

ApiClient.init('http://localhost:8000').then(apiClient => {
    if (false === apiClient) {
        alert('Error initializing the Liturgical Calendar API Client');
    } else {
        const liturgicalCalendarSelectEngNations = new CalendarSelect(); // default English
        const liturgicalCalendarSelectEngDioceses = new CalendarSelect(); // default English
        const liturgicalCalendarSelectEng = (new CalendarSelect( 'en-US' )).allowNull();
        const liturgicalCalendarSelectEsp = (new CalendarSelect( 'es-ES' )).allowNull();
        const liturgicalCalendarSelectIta = (new CalendarSelect( 'it-IT' )).allowNull();
        const liturgicalCalendarSelectDeu = (new CalendarSelect( 'de-DE' )).allowNull();
        const apiOptionsEng = new ApiOptions( 'en-US' );
        const apiOptionsEsp = new ApiOptions( 'es-ES' );
        const apiOptionsIta = new ApiOptions( 'it-IT' );
        const apiOptionsDeu = new ApiOptions( 'de-DE' );
        apiOptionsEng._localeInput.defaultValue( 'en' );
        apiOptionsEsp._localeInput.defaultValue( 'es' );
        apiOptionsIta._localeInput.defaultValue( 'it' );
        apiOptionsDeu._localeInput.defaultValue( 'de' );
        apiOptionsEng._acceptHeaderInput.hide();
        apiOptionsEsp._acceptHeaderInput.hide();
        apiOptionsIta._acceptHeaderInput.hide();
        apiOptionsDeu._acceptHeaderInput.hide();
        apiOptionsEng._yearInput.class( 'form-control' );
        apiOptionsEsp._yearInput.class( 'form-control' );
        apiOptionsIta._yearInput.class( 'form-control' );
        apiOptionsDeu._yearInput.class( 'form-control' );

        apiOptionsEng._ascensionInput.wrapperClass( 'form-group col col-md-2' );
        apiOptionsEng._corpusChristiInput.wrapperClass( 'form-group col col-md-2' );
        apiOptionsEng._eternalHighPriestInput.wrapperClass( 'form-group col col-md-2' );
        apiOptionsEng._holydaysOfObligationInput.class('d-none');

        apiOptionsEsp._ascensionInput.wrapperClass( 'form-group col col-md-2' );
        apiOptionsEsp._corpusChristiInput.wrapperClass( 'form-group col col-md-2' );
        apiOptionsEsp._eternalHighPriestInput.wrapperClass( 'form-group col col-md-2' );
        apiOptionsEsp._holydaysOfObligationInput.class('d-none');

        apiOptionsIta._ascensionInput.wrapperClass( 'form-group col col-md-2' );
        apiOptionsIta._corpusChristiInput.wrapperClass( 'form-group col col-md-2' );
        apiOptionsIta._eternalHighPriestInput.wrapperClass( 'form-group col col-md-2' );
        apiOptionsIta._holydaysOfObligationInput.class('d-none');

        apiOptionsDeu._ascensionInput.wrapperClass( 'form-group col col-md-2' );
        apiOptionsDeu._corpusChristiInput.wrapperClass( 'form-group col col-md-2' );
        apiOptionsDeu._eternalHighPriestInput.wrapperClass( 'form-group col col-md-2' );
        apiOptionsDeu._holydaysOfObligationInput.class('d-none');

        apiClient.listenTo( liturgicalCalendarSelectEng );
        apiClient.listenTo( apiOptionsEng );

        const webCalendar = new WebCalendar();
        webCalendar.id('LitCalTable')
        .firstColumnGrouping(Grouping.BY_LITURGICAL_SEASON)
        .psalterWeekColumn()
        .removeHeaderRow()
        .seasonColor(ColorAs.CSS_CLASS)
        .seasonColorColumns(Column.LITURGICAL_SEASON)
        .eventColor(ColorAs.INDICATOR)
        .eventColorColumns(Column.EVENT_DETAILS)
        .monthHeader()
        .dateFormat(DateFormat.DAY_ONLY)
        .columnOrder(ColumnOrder.GRADE_FIRST)
        .gradeDisplay(GradeDisplay.ABBREVIATED)
        .attachTo( '#litcalWebcalendar' ).listenTo(apiClient);

        /**
         * English
         */
        liturgicalCalendarSelectEngNations.label({
            class: 'form-label d-block mb-1',
            id: 'liturgicalCalendarSelectEngNationsLabel',
            text: 'Select a nation'
        }).wrapper({
            class: 'form-group col col-md-3',
            id: 'liturgicalCalendarSelectEngNationsWrapper'
        }).id('liturgicalCalendarSelectEngNations').class('form-select').filter(CalendarSelectFilter.NATIONAL_CALENDARS).appendTo( '#calendarSelectEnglish');

        liturgicalCalendarSelectEngDioceses.label({
            class: 'form-label d-block mb-1',
            id: 'liturgicalCalendarSelectEngDiocesesLabel',
            text: 'Select a diocese'
        }).wrapper({
            class: 'form-group col col-md-3',
            id: 'liturgicalCalendarSelectEngNationsWrapper'
        }).id('liturgicalCalendarSelectEngDioceses').class('form-select').filter(CalendarSelectFilter.DIOCESAN_CALENDARS)
            .linkToNationsSelect( liturgicalCalendarSelectEngNations )
            .after('<small class="text-secondary"><i class="fas fa-circle-info me-2"></i><i>This calendar selector is linked to the previous nations calendar selector.</i></small>')
            .appendTo( '#calendarSelectEnglish');

        liturgicalCalendarSelectEng.label({
            class: 'form-label d-block mb-1',
            id: 'liturgicalCalendarSelectEngLabel',
            text: 'Select a calendar'
        }).wrapper({
            class: 'form-group col col-md-3',
            id: 'liturgicalCalendarSelectEngNationsWrapper'
        }).id('liturgicalCalendarSelectEng').class('form-select').after('<small class="text-secondary"><i class="fas fa-circle-info me-2"></i><i>The WebCalendar instance is listening to this CalendarSelect instance; any changes will produce a calendar below all of the forms.</i></small>').appendTo( '#calendarOptionsEnglish');

        apiOptionsEng.linkToCalendarSelect( liturgicalCalendarSelectEng ).appendTo( '#calendarOptionsEnglish' )

        wireHdobVS(apiOptionsEng, liturgicalCalendarSelectEng, 'hdob-virtual-select-eng');

        /**
         * Spanish
         */
        liturgicalCalendarSelectEsp.label({
            class: 'form-label d-block mb-1',
            id: 'liturgicalCalendarSelectEspLabel',
            text: 'Selecciona calendario'
        }).wrapper({
            class: 'form-group col col-md-3',
            id: 'liturgicalCalendarSelectEspNationsWrapper'
        }).id('liturgicalCalendarSelectEsp').class('form-select').allowNull().appendTo( '#calendarOptionsSpanish');

        apiOptionsEsp.linkToCalendarSelect( liturgicalCalendarSelectEsp ).appendTo( '#calendarOptionsSpanish' );

        wireHdobVS(apiOptionsEsp, liturgicalCalendarSelectEsp, 'hdob-virtual-select-esp');


        /**
         * Italian
         */
        liturgicalCalendarSelectIta.label({
            class: 'form-label d-block mb-1',
            id: 'liturgicalCalendarSelectItaLabel',
            text: 'Seleziona calendario'
        }).wrapper({
            class: 'form-group col col-md-3',
            id: 'liturgicalCalendarSelectItaNationsWrapper'
        }).id('liturgicalCalendarSelectIta').class('form-select').appendTo( '#calendarOptionsItalian');

        apiOptionsIta.linkToCalendarSelect( liturgicalCalendarSelectIta ).appendTo( '#calendarOptionsItalian' );

        wireHdobVS(apiOptionsIta, liturgicalCalendarSelectIta, 'hdob-virtual-select-ita');


        /**
         * German
         */
        liturgicalCalendarSelectDeu.label({
            class: 'form-label d-block mb-1',
            id: 'liturgicalCalendarSelectDeuLabel',
            text: 'Kalender ausw&auml;hlen'
        }).wrapper({
            class: 'form-group col col-md-3',
            id: 'liturgicalCalendarSelectDeuNationsWrapper'
        }).id('liturgicalCalendarSelectDeu').class('form-select').appendTo( '#calendarOptionsGerman');

        apiOptionsDeu.linkToCalendarSelect( liturgicalCalendarSelectDeu ).appendTo( '#calendarOptionsGerman' );

        wireHdobVS(apiOptionsDeu, liturgicalCalendarSelectDeu, 'hdob-virtual-select-deu');

        // Fetch initial webcalendar
        apiClient.fetchNationalCalendar( 'VA' );
    }
});
