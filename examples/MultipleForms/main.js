import { ApiClient, CalendarSelect, ApiOptions, Input, WebCalendar, Grouping, ColorAs, Column, ColumnOrder, DateFormat, GradeDisplay, CalendarSelectFilter } from 'https://esm.run/@liturgical-calendar/components-js';

Input.setGlobalInputClass('form-select');
Input.setGlobalLabelClass('form-label d-block mb-1');
Input.setGlobalWrapper('div');
Input.setGlobalWrapperClass('form-group col col-md-3');

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

        /**
         * Spanish
         */
        liturgicalCalendarSelectEsp.label({
            class: 'form-label d-block mb-1',
            id: 'liturgicalCalendarSelectEspLabel',
            text: 'Selecciona calendario'
        }).wrapper({
            class: 'form-group col col-md-3',
            id: 'liturgicalCalendarSelectEngNationsWrapper'
        }).id('liturgicalCalendarSelectEsp').class('form-select').allowNull().appendTo( '#calendarOptionsSpanish');

        apiOptionsEsp.linkToCalendarSelect( liturgicalCalendarSelectEsp ).appendTo( '#calendarOptionsSpanish' );

        /**
         * Italian
         */
        liturgicalCalendarSelectIta.label({
            class: 'form-label d-block mb-1',
            id: 'liturgicalCalendarSelectItaLabel',
            text: 'Seleziona calendario'
        }).wrapper({
            class: 'form-group col col-md-3',
            id: 'liturgicalCalendarSelectEngNationsWrapper'
        }).id('liturgicalCalendarSelectIta').class('form-select').appendTo( '#calendarOptionsItalian');

        apiOptionsIta.linkToCalendarSelect( liturgicalCalendarSelectIta ).appendTo( '#calendarOptionsItalian' );

        /**
         * German
         */
        liturgicalCalendarSelectDeu.label({
            class: 'form-label d-block mb-1',
            id: 'liturgicalCalendarSelectDeuLabel',
            text: 'Kalender ausw&auml;hlen'
        }).wrapper({
            class: 'form-group col col-md-3',
            id: 'liturgicalCalendarSelectEngNationsWrapper'
        }).id('liturgicalCalendarSelectDeu').class('form-select').appendTo( '#calendarOptionsGerman');

        apiOptionsDeu.linkToCalendarSelect( liturgicalCalendarSelectDeu ).appendTo( '#calendarOptionsGerman' );
    }
});
