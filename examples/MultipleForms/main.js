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

        // 1. Create a new container element for the virtual select
        const hdobVirtualSelectEng = document.createElement('div');
        hdobVirtualSelectEng.id = 'hdob-virtual-select-eng';
        // 2. Insert it right after the original native select
        apiOptionsEng._holydaysOfObligationInput._domElement.parentNode.insertBefore( hdobVirtualSelectEng, apiOptionsEng._holydaysOfObligationInput._domElement.nextSibling );
        // 3. Build and initialize the virtual select from the native select
        buildAndInitVirtualSelectFromNativeSelect( apiOptionsEng._holydaysOfObligationInput._domElement, 'hdob-virtual-select-eng' );
        if (liturgicalCalendarSelectEng._domElement.value === '') {
            hdobVirtualSelectEng.enable();
        } else {
            hdobVirtualSelectEng.disable();
        }
        // 4. Listen to changes on the calendar select to rebuild and enable/disable the virtual select
        liturgicalCalendarSelectEng._domElement.addEventListener('change', (ev) => {
            console.log('calendar changed to:', ev.target.value);
            const vsElement = document.querySelector('#hdob-virtual-select-eng');
            vsElement.destroy();
            buildAndInitVirtualSelectFromNativeSelect( apiOptionsEng._holydaysOfObligationInput._domElement, 'hdob-virtual-select-eng' );
            if (ev.target.value === '') {
                vsElement.enable();
            } else {
                vsElement.disable();
            }
        });

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

        // 1. Create a new container element for the virtual select
        const hdobVirtualSelectEsp = document.createElement('div');
        hdobVirtualSelectEsp.id = 'hdob-virtual-select-esp';
        // 2. Insert it right after the original native select
        apiOptionsEsp._holydaysOfObligationInput._domElement.parentNode.insertBefore( hdobVirtualSelectEsp, apiOptionsEsp._holydaysOfObligationInput._domElement.nextSibling );
        // 3. Build and initialize the virtual select from the native select
        buildAndInitVirtualSelectFromNativeSelect( apiOptionsEsp._holydaysOfObligationInput._domElement, 'hdob-virtual-select-esp' );
        if (liturgicalCalendarSelectEsp._domElement.value === '') {
            hdobVirtualSelectEsp.enable();
        } else {
            hdobVirtualSelectEsp.disable();
        }
        // 4. Listen to changes on the calendar select to rebuild and enable/disable the virtual select
        liturgicalCalendarSelectEsp._domElement.addEventListener('change', (ev) => {
            console.log('calendar changed to:', ev.target.value);
            const vsElement = document.querySelector('#hdob-virtual-select-esp');
            vsElement.destroy();
            buildAndInitVirtualSelectFromNativeSelect( apiOptionsEsp._holydaysOfObligationInput._domElement, 'hdob-virtual-select-esp' );
            if (ev.target.value === '') {
                vsElement.enable();
            } else {
                vsElement.disable();
            }
        });


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

        // 1. Create a new container element for the virtual select
        const hdobVirtualSelectIta = document.createElement('div');
        hdobVirtualSelectIta.id = 'hdob-virtual-select-ita';
        // 2. Insert it right after the original native select
        apiOptionsIta._holydaysOfObligationInput._domElement.parentNode.insertBefore( hdobVirtualSelectIta, apiOptionsIta._holydaysOfObligationInput._domElement.nextSibling );
        // 3. Build and initialize the virtual select from the native select
        buildAndInitVirtualSelectFromNativeSelect( apiOptionsIta._holydaysOfObligationInput._domElement, 'hdob-virtual-select-ita' );
        if (liturgicalCalendarSelectIta._domElement.value === '') {
            hdobVirtualSelectIta.enable();
        } else {
            hdobVirtualSelectIta.disable();
        }
        // 4. Listen to changes on the calendar select to rebuild and enable/disable the virtual select
        liturgicalCalendarSelectIta._domElement.addEventListener('change', (ev) => {
            console.log('calendar changed to:', ev.target.value);
            const vsElement = document.querySelector('#hdob-virtual-select-ita');
            vsElement.destroy();
            buildAndInitVirtualSelectFromNativeSelect( apiOptionsIta._holydaysOfObligationInput._domElement, 'hdob-virtual-select-ita' );
            if (ev.target.value === '') {
                vsElement.enable();
            } else {
                vsElement.disable();
            }
        });


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

        // 1. Create a new container element for the virtual select
        const hdobVirtualSelectDeu = document.createElement('div');
        hdobVirtualSelectDeu.id = 'hdob-virtual-select-deu';
        // 2. Insert it right after the original native select
        apiOptionsDeu._holydaysOfObligationInput._domElement.parentNode.insertBefore( hdobVirtualSelectDeu, apiOptionsDeu._holydaysOfObligationInput._domElement.nextSibling );
        // 3. Build and initialize the virtual select from the native select
        buildAndInitVirtualSelectFromNativeSelect( apiOptionsDeu._holydaysOfObligationInput._domElement, 'hdob-virtual-select-deu' );
        if (liturgicalCalendarSelectDeu._domElement.value === '') {
            hdobVirtualSelectDeu.enable();
        } else {
            hdobVirtualSelectDeu.disable();
        }
        // 4. Listen to changes on the calendar select to rebuild and enable/disable the virtual select
        liturgicalCalendarSelectDeu._domElement.addEventListener('change', (ev) => {
            console.log('calendar changed to:', ev.target.value);
            const vsElement = document.querySelector('#hdob-virtual-select-deu');
            vsElement.destroy();
            buildAndInitVirtualSelectFromNativeSelect( apiOptionsDeu._holydaysOfObligationInput._domElement, 'hdob-virtual-select-deu' );
            if (ev.target.value === '') {
                vsElement.enable();
            } else {
                vsElement.disable();
            }
        });

        // Fetch initial webcalendar
        apiClient.fetchNationalCalendar( 'VA' );
    }
});
