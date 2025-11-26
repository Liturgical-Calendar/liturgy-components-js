import { ApiOptions, ApiClient, ApiOptionsFilter, Input, CalendarSelect } from '@liturgical-calendar/components-js';
import 'bootstrap/dist/css/bootstrap.min.css';

/**
 * `CalendarSelect` and `ApiOptions`
 *
 * The `ApiOptions` component is linked to the `CalendarSelect` component.
 * This means that when you select a calendar from the `CalendarSelect` component,
 * the `ApiOptions` are updated to reflect the options available for that calendar.
 * For example, the `locale` input will only show locales that are supported by the current selected calendar.
 *
 * The `ApiOptions` instance is filtered to only show `<select>` elements that are applicable
 * not only to the General Roman Calendar, but also to National and Diocesan Calendars
 * (`filter(ApiOptionsFilter.ALL_CALENDARS)`).
 *
 * In this example in fact we are not interested in the options that are only applicable
 * to the generic case of the General Roman Calendar
 * (we have not set `allowNull()` on the `CalendarSelect` instance).
 */
const meta = {
    title: 'Combined Components/CalendarSelect - ApiOptions/National and Diocesan Calendars',
    tags: [ 'autodocs' ],
    argTypes: {
        locale: {
            control: 'text',
            description: 'Locale code for UI elements, applicable via the `CalendarSelect.locale("en-US")` instance method and the `ApiOptions.locale("en-US")` instance method',
            defaultValue: 'en-US'
        },
        onChange: {
            action: 'onChange'
        },
        apiOptionsfilter: {
            control: { type: 'select' },
            options: [ ApiOptionsFilter.NONE, ApiOptionsFilter.ALL_CALENDARS, ApiOptionsFilter.GENERAL_ROMAN ],
            labels: {
                [ ApiOptionsFilter.NONE ]: 'None',
                [ ApiOptionsFilter.ALL_CALENDARS ]: 'National / Diocesan Calendars only',
                [ ApiOptionsFilter.GENERAL_ROMAN ]: 'General Roman Calendar only'
            },
            description: 'Filter for the ApiOptions instance, applicable via the `ApiOptions.filter(ApiOptionsFilter.ALL_CALENDARS)` instance method',
            defaultValue: ApiOptionsFilter.NONE
        },
        calendarSelectClass: {
            control: 'text',
            description: 'CSS class(es) for the widget\'s underlying HTML element, applicable via the `CalendarSelect.class("my-class")` instance method'
        },
        calendarSelectLabelClass: {
            control: 'text',
            description: 'CSS class(es) for the select label\'s underlying HTML element, applicable via the `CalendarSelect.label({text: "Select a calendar", class: "my-class"})` instance method'
        },
        calendarSelectLabelText: {
            control: 'text',
            description: 'Text for the select label\'s underlying HTML element, applicable via the `CalendarSelect.label({text: "Select a calendar", class: "my-class"})` instance method',
            defaultValue: 'Select a calendar'
        },
        calendarSelectWrapperClass: {
            control: 'text',
            description: 'CSS class(es) for the select wrapper\'s underlying HTML element, applicable via the `CalendarSelect.wrapper({class: "my-class"})` instance method'
        },
        calendarSelectAfter: {
            control: 'text',
            description: 'HTML string to append to the select or select wrapper\'s underlying HTML element, applicable via the `CalendarSelect.after("<div>...</div>")` instance method'
        },
        localeInputAfter: {
            control: 'text',
            description: 'HTML string to show below the ApiOptions locale input, applicable via the `ApiOptions._localeInput.after("<div>...</div>")` instance method'
        }
    },
    render: ( args, { loaded: { apiClient } } ) => {
        const container = document.createElement( 'div' );
        container.id = 'apiOptionsCalendarSelectContainer';
        container.classList.add('row');

        if ( false === apiClient || false === (apiClient instanceof ApiClient) ) {
            container.textContent = 'Error initializing the Liturgical Calendar API Client, check that the API is running at ' + ApiClient._apiUrl;
        } else {
            Input.setGlobalInputClass('form-select');
            Input.setGlobalLabelClass('form-label');
            Input.setGlobalWrapper('div');
            Input.setGlobalWrapperClass('form-group col col-md-3');

            const calendarSelect = new CalendarSelect( args.locale );
            const apiOptions = new ApiOptions( args.locale );
            apiOptions.linkToCalendarSelect( calendarSelect );
            //apiClient.listenTo(apiOptions);
            if ( args.apiOptionsFilter ) {
                apiOptions.filter( args.apiOptionsFilter );
            }
            if ( args.calendarSelectLabelText || args.calendarSelectLabelClass ) {
                const label = {};
                if ( args.calendarSelectLabelText ) {
                    label.text = args.calendarSelectLabelText;
                }
                if ( args.calendarSelectLabelClass ) {
                    label.class = args.calendarSelectLabelClass;
                }
                calendarSelect.label( label );
            }
            if ( args.calendarSelectClass ) {
                calendarSelect.class( args.calendarSelectClass );
            }
            if ( args.calendarSelectWrapperClass ) {
                const wrapper = {};
                wrapper.class = args.calendarSelectWrapperClass;
                calendarSelect.wrapper( wrapper );
            }
            apiOptions._acceptHeaderInput.hide();
            calendarSelect.appendTo( container );
            apiOptions.appendTo( container );
        }
        return container;
    },
    parameters: {
        actions: {
            handles: [ 'change', 'change #apiOptionsContainer select' ],
        },
    },
    args: {
        calendarSelectClass: 'form-select',
        calendarSelectLabelClass: 'form-label d-block mb-1',
        calendarSelectWrapperClass: 'form-group col col-md-3',
        apiOptionsFilter: ApiOptionsFilter.ALL_CALENDARS
    }
}

export default meta;

export const Default = {
    args: {}
}

/**
 * `CalendarSelect` e `ApiOptions`
 *
 * Il componente `ApiOptions` è collegato al componente `CalendarSelect`.
 * Ciò significa che quando selezioni un calendario dal componente `CalendarSelect`,
 * le opzioni negli elementi `<select>` dell'istanza `ApiOptions` vengono aggiornate
 * per riflettere le opzioni disponibili per quel calendario.
 * Ad esempio, l'input `locale` mostrerà solo le lingue supportate dal calendario selezionato.
 *
 * L'istanza di `ApiOptions` è filtrata per mostrare solo gli elementi `<select>` che sono applicabili
 * ai Calendari Nazionali e Diocesani oltre che al Calendario Romano Generale
 * (`filter(ApiOptionsFilter.ALL_CALENDARS)`).
 *
 * In questo esempio, infatti, non siamo interessati alle opzioni applicabili solo
 * al caso generico del Calendario Romano Generale
 * (non abbiamo impostato `allowNull()` sull'istanza di `CalendarSelect`).
 */
export const Italian = {
    args: {
        locale: 'it-IT',
        calendarSelectLabelText: 'Seleziona calendario'
    }
}

/**
 * `CalendarSelect` et `ApiOptions`
 *
 * Le composant `ApiOptions` est lié au composant `CalendarSelect`.
 * Cela signifie que lorsque vous sélectionnez un calendrier à partir du composant `CalendarSelect`,
 * les options dans les éléments `<select>` de l'instance `ApiOptions` sont mises à jour
 * pour refléter les options disponibles pour ce calendrier.
 * Par exemple, l'entrée `locale` n'affichera que les langues prises en charge par le calendrier sélectionné.
 *
 * L'instance de `ApiOptions` est filtrée pour ne montrer que les éléments `<select>` qui sont applicables
 * aux Calendriers Nationaux et Diocésains ainsi qu'au Calendrier Romain Général
 * (`filter(ApiOptionsFilter.ALL_CALENDARS)`).
 *
 * Dans cet exemple, en fait, nous ne nous intéressons pas aux options applicables uniquement
 * au cas générique du Calendrier Romain Général
 * (nous n'avons pas défini `allowNull()` sur l'instance `CalendarSelect`).
 */
export const French = {
    args: {
        locale: 'fr-FR',
        calendarSelectLabelText: 'Sélectionnez calendrier'
    }
}

/**
 * `CalendarSelect` y `ApiOptions`
 *
 * El componente `ApiOptions` está vinculado al componente `CalendarSelect`.
 * Esto significa que cuando seleccionas un calendario del componente `CalendarSelect`,
 * las opciones en los elementos `<select>` de la instancia `ApiOptions` se actualizan
 * para reflejar las opciones disponibles para ese calendario.
 * Por ejemplo, la entrada `locale` mostrará solo los idiomas soportados por el calendario seleccionado.
 *
 * La instancia de `ApiOptions` está filtrada para mostrar solo los elementos `<select>` que son aplicables
 * a los Calendarios Nacionales y Diocesanos, así como al Calendario Romano General
 * (`filter(ApiOptionsFilter.ALL_CALENDARS)`).
 *
 * En este ejemplo, de hecho, no estamos interesados en las opciones aplicables solo
 * al caso genérico del Calendario Romano General
 * (no hemos establecido `allowNull()` en la instancia de `CalendarSelect`).
 */
export const Spanish = {
    args: {
        locale: 'es-ES',
        calendarSelectLabelText: 'Seleccione calendario'
    }
}

/**
 * `CalendarSelect` und `ApiOptions`
 *
 * Die Komponente `ApiOptions` ist mit der Komponente `CalendarSelect` verbunden.
 * Das bedeutet, dass, wenn Sie einen Kalender aus der Komponente `CalendarSelect` auswählen,
 * die Optionen in den `<select>`-Elementen der `ApiOptions`-Instanz aktualisiert werden,
 * um die für diesen Kalender verfügbaren Optionen widerzuspiegeln.
 * Zum Beispiel zeigt die Eingabe `locale` nur die vom ausgewählten Kalender unterstützten Sprachen an.
 *
 * Die Instanz von `ApiOptions` ist gefiltert, um nur die `<select>`-Elemente zu zeigen, die anwendbar sind
 * sowohl auf die Nationalen und Diözesanen Kalender als auch auf den Allgemeinen Römischen Kalender
 * (`filter(ApiOptionsFilter.ALL_CALENDARS)`).
 *
 * In diesem Beispiel, in der Tat, sind wir nicht an den Optionen interessiert, die nur anwendbar sind
 * auf den generischen Fall des Allgemeinen Römischen Kalenders
 * (wir haben nicht `allowNull()` auf der Instanz von `CalendarSelect` gesetzt).
 */
export const German = {
    args: {
        locale: 'de-DE',
        calendarSelectLabelText: 'Wählen Sie ein Kalender'
    }
}
