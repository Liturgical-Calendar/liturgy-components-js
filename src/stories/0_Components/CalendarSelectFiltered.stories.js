import { CalendarSelect, ApiClient, CalendarSelectFilter } from '@liturgical-calendar/components-js';
import 'bootstrap/dist/css/bootstrap.min.css';

/**
 * CalendarSelect component
 *
 * We can split the `CalendarSelect` component into two instances, one for national calendars and one for diocesan calendars.
 * To do this, we apply a filter to each instance.
 */
const meta = {
    title: 'Components/CalendarSelect/Filtered',
    tags: [ 'autodocs' ],
    argTypes: {
        locale: {
            control: 'text',
            description: 'Locale code for UI elements',
            defaultValue: 'en-US'
        },
        class: {
            control: 'text',
            description: 'CSS class(es) for the widget\'s underlying HTML element'
        },
        labelClass: {
            control: 'text',
            description: 'CSS class(es) for the select label\'s underlying HTML element'
        },
        nationsLabelText: {
            control: 'text',
            description: 'Text for the select label\'s underlying HTML element',
            defaultValue: 'Select a nation'
        },
        diocesesLabelText: {
            control: 'text',
            description: 'Text for the select label\'s underlying HTML element',
            defaultValue: 'Select a diocese'
        },
        wrapperClass: {
            control: 'text',
            description: 'CSS class(es) for the select wrapper\'s underlying HTML element'
        },
        nationsAfter: {
            control: 'text',
            description: 'HTML string to insert after the select\'s underlying HTML element'
        },
        diocesesAfter: {
            control: 'text',
            description: 'HTML string to insert after the select\'s underlying HTML element'
        }
    },
    render: ( args, { loaded: { apiClient } } ) => {
        const container = document.createElement( 'div' );
        container.id = 'calendarSelectFilteredContainer';
        const calendarSelectNations = new CalendarSelect( args.locale ).filter( CalendarSelectFilter.NATIONAL_CALENDARS );
        const calendarSelectDioceses = new CalendarSelect( args.locale ).filter( CalendarSelectFilter.DIOCESAN_CALENDARS );
        calendarSelectDioceses.linkToNationsSelect( calendarSelectNations );

        if ( args.class ) {
            calendarSelectNations.class( args.class );
            calendarSelectDioceses.class( args.class );
        }
        if ( args.labelClass || args.nationsLabelText || args.diocesesLabelText ) {
            const nationsLabel = {};
            const diocesesLabel = {};
            if ( args.labelClass ) {
                nationsLabel.class = args.labelClass;
                diocesesLabel.class = args.labelClass;
            }
            if ( args.nationsLabelText ) {
                nationsLabel.text = args.nationsLabelText;
            }
            if ( args.diocesesLabelText ) {
                diocesesLabel.text = args.diocesesLabelText;
            }
            calendarSelectNations.label( nationsLabel );
            calendarSelectDioceses.label( diocesesLabel );
        }
        if ( args.wrapperClass ) {
            const wrapper = {
                class: args.wrapperClass
            };
            calendarSelectNations.wrapper( wrapper );
            calendarSelectDioceses.wrapper( wrapper );
        }
        if ( args.nationsAfter ) {
            calendarSelectNations.after( args.nationsAfter );
        }
        if ( args.diocesesAfter ) {
            calendarSelectDioceses.after( args.diocesesAfter );
        }

        if ( false === apiClient || false === apiClient instanceof ApiClient ) {
            container.textContent = 'Error initializing the Liturgical Calendar API Client';
        } else {
            //apiClient.listenTo(calendarSelect);
            calendarSelectNations.appendTo( container );
            calendarSelectDioceses.appendTo( container );
        }
        return container;
    },
    parameters: {
        actions: {
            handles: [ 'change', 'change #calendarSelectFilteredContainer select' ],
        },
    },
    args: {
        nationsLabelText: 'Select a nation',
        diocesesLabelText: 'Select a diocese',
        class: 'form-select',
        labelClass: 'form-label',
        wrapperClass: 'form-group col col-md-4'
    }
}

export default meta;

export const DefaultBoostrap = {
    args: {}
};

export const EnglishBootstrap = {
    args: {
        locale: 'en-US',
        nationsLabelText: 'Select a nation',
        diocesesLabelText: 'Select a diocese',
        nationsAfter: '<small class="text-muted"><i>Selections made here will determine the available diocese options</i></small>',
        diocesesAfter: '<small class="text-muted"><i>Available diocese options depend on the nation selection</i></small>'
    }
}

export const ItalianBootstrap = {
    args: {
        locale: 'it-IT',
        nationsLabelText: 'Seleziona nazione',
        diocesesLabelText: 'Seleziona diocesi',
        nationsAfter: '<small class="text-muted"><i>Selezioni fatte qui determineranno le opzioni di diocesi disponibili</i></small>',
        diocesesAfter: '<small class="text-muted"><i>Le opzioni di diocesi disponibili dipendono dalla selezione della nazione</i></small>'
    }
}

export const SpanishBootstrap = {
    args: {
        locale: 'es-ES',
        nationsLabelText: 'Seleccione una nación',
        diocesesLabelText: 'Seleccione un diocesis',
        nationsAfter: '<small class="text-muted"><i>Las opciones seleccionadas aquí determinarán las opciones de diocesis disponibles</i></small>',
        diocesesAfter: '<small class="text-muted"><i>Las opciones de diocesis disponibles dependen de la selección de la nación</i></small>'
    }
}

export const FrenchBootstrap = {
    args: {
        locale: 'fr-FR',
        nationsLabelText: 'Sélectionnez une nation',
        diocesesLabelText: 'Sélectionnez un diocese',
        nationsAfter: '<small class="text-muted"><i>Les sélections faites ici détermineront les options de diocese disponibles</i></small>',
        diocesesAfter: '<small class="text-muted"><i>Les options de diocese disponibles dépendent de la sélection de la nation</i></small>'
    }
}

export const GermanBootstrap = {
    args: {
        locale: 'de-DE',
        nationsLabelText: 'Wählen Sie eine Nation',
        diocesesLabelText: 'Wählen Sie eine Diocese',
        nationsAfter: '<small class="text-muted"><i>Die ausgewählten Optionen hier bestimmen die verfügbaren Diocese-Optionen</i></small>',
        diocesesAfter: '<small class="text-muted"><i>Die verfügbaren Diocese-Optionen sind abhängig von der ausgewählten Nation</i></small>'
    }
}
