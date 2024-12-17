import { LitCalApiClient, CalendarSelect, ApiOptions, Input } from "../src/index.js";

Input.setGlobalInputClass('form-select');
Input.setGlobalLabelClass('form-label d-block mb-1');
Input.setGlobalWrapper('div');
Input.setGlobalWrapperClass('form-group col col-md-3');

LitCalApiClient.init('http://localhost:8000').then( () => {
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
    apiOptionsEng.localeInput.selectedValue( 'en' );
    apiOptionsEsp.localeInput.selectedValue( 'es' );
    apiOptionsIta.localeInput.selectedValue( 'it' );
    apiOptionsDeu.localeInput.selectedValue( 'de' );
    apiOptionsEng.linkToCalendarSelect( liturgicalCalendarSelectEng );
    apiOptionsEsp.linkToCalendarSelect( liturgicalCalendarSelectEsp );
    apiOptionsIta.linkToCalendarSelect( liturgicalCalendarSelectIta );
    apiOptionsDeu.linkToCalendarSelect( liturgicalCalendarSelectDeu );

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
    }).id('liturgicalCalendarSelectEngNations').class('form-select').filter('nations').appendTo( '#calendarSelectEnglish');

    liturgicalCalendarSelectEngDioceses.label({
        class: 'form-label d-block mb-1',
        id: 'liturgicalCalendarSelectEngDiocesesLabel',
        text: 'Select a diocese'
    }).wrapper({
        class: 'form-group col col-md-3',
        id: 'liturgicalCalendarSelectEngNationsWrapper'
    }).id('liturgicalCalendarSelectEngDioceses').class('form-select').filter('dioceses')
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
    }).id('liturgicalCalendarSelectEng').class('form-select').appendTo( '#calendarSelectEnglish');

    apiOptionsEng.appendTo( '#calendarOptionsEnglish' );

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
    }).id('liturgicalCalendarSelectEsp').class('form-select').allowNull().appendTo( '#calendarSelectOtherLangs');

    apiOptionsEsp.appendTo( '#calendarOptionsSpanish' );

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
    }).id('liturgicalCalendarSelectIta').class('form-select').appendTo( '#calendarSelectOtherLangs');

    apiOptionsIta.appendTo( '#calendarOptionsItalian' );

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
    }).id('liturgicalCalendarSelectDeu').class('form-select').appendTo( '#calendarSelectOtherLangs');

    apiOptionsDeu.appendTo( '#calendarOptionsGerman' );
});
