import { LitcalApiClient, CalendarSelect } from "../src/index.js";

LitcalApiClient.init('http://localhost:8000').then( () => {
    const liturgicalCalendarSelectEngNations = new CalendarSelect(); // default English
    const liturgicalCalendarSelectEngDioceses = new CalendarSelect(); // default English
    const liturgicalCalendarSelectEsp = new CalendarSelect( 'es-ES' );
    const liturgicalCalendarSelectIta = new CalendarSelect( 'it-IT' );
    const liturgicalCalendarSelectDeu = new CalendarSelect( 'de-DE' );

    liturgicalCalendarSelectEngNations.filter('nations').appendTo( '#litcalForm');
    liturgicalCalendarSelectEngDioceses.filter('dioceses').linkToNationsSelect( liturgicalCalendarSelectEngNations ).appendTo( '#litcalForm');
    liturgicalCalendarSelectEsp.appendTo( '#litcalForm');
    liturgicalCalendarSelectIta.appendTo( '#litcalForm');
    liturgicalCalendarSelectDeu.appendTo( '#litcalForm');
});
