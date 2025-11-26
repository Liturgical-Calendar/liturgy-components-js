import { ApiOptions, ApiClient, ApiOptionsFilter, Input, CalendarSelect } from '@liturgical-calendar/components-js';
import 'bootstrap/dist/css/bootstrap.min.css';

/**
 * CalendarSelect and ApiOptions - Allow Null on Calendar Select
 *
 * The ApiOptions component is linked to the Calendar Select component.
 * This means that when you select a calendar from the CalendarSelect component,
 * the ApiOptions are updated to reflect the options for that calendar.
 * For example, the `locale` input will only show locales that are supported by the current selected calendar.
 *
 * The ApiOptions are not filtered, so we see all possible select inputs.
 *
 * We have also set `allowNull()` on the CalendarSelect, so when we select an empty value in the CalendarSelect
 * (which corresponds to a generic value of "General Roman Calendar"), the ApiOptions select inputs that can tweak
 * the General Roman Calendar are enable. We also see that in this case the `locale` select input
 * will have only the values that are supported by the General Roman Calendar (i.e. locale options without national extensions).
 *
 * If instead we select any other National or Diocesan calendar from the CalendarSelect,
 * the ApiOptions select inputs that can tweak the General Roman Calendar are disabled,
 * because these settings are determined by the selected National or Diocesan calendar
 * (and in fact the values of these select inputs will be updated to reflect this).
 */
const meta = {
    title: 'Combined Components/CalendarSelect - ApiOptions/Allow Null on CalendarSelect',
    tags: [ 'autodocs' ],
    argTypes: {
        locale: {
            control: 'text',
            description: 'Locale code for UI elements',
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
                [ ApiOptionsFilter.ALL_CALENDARS ]: 'All Calendars',
                [ ApiOptionsFilter.GENERAL_ROMAN ]: 'General Roman'
            },
            description: 'Filter for the ApiOptions instance',
            defaultValue: ApiOptionsFilter.NONE
        },
        calendarSelectClass: {
            control: 'text',
            description: 'CSS class(es) for the widget\'s underlying HTML element'
        },
        calendarSelectLabelClass: {
            control: 'text',
            description: 'CSS class(es) for the select label\'s underlying HTML element'
        },
        calendarSelectLabelText: {
            control: 'text',
            description: 'Text for the select label\'s underlying HTML element',
            defaultValue: 'Select a calendar'
        },
        calendarSelectWrapperClass: {
            control: 'text',
            description: 'CSS class(es) for the select wrapper\'s underlying HTML element'
        },
        calendarSelectAfter: {
            control: 'text',
            description: 'HTML string to append to the select or select wrapper\'s underlying HTML element'
        },
        calendarSelectAllowNull: {
            control: 'boolean',
            description: 'Allow the select to have an empty value, which corresponds to General Roman Calendar',
            defaultValue: false
        },
        localeInputAfter: {
            control: 'text',
            description: 'HTML string to show below the ApiOptions locale input'
        }
    },
    render: ( args, { loaded: { apiClient } } ) => {
        const container = document.createElement( 'div' );
        container.id = 'apiOptionsCalendarSelectContainer';
        container.classList.add('row');

        if (!apiClient || !(apiClient instanceof ApiClient)) {
            container.textContent = 'Error initializing the Liturgical Calendar API Client, check that the API is running at ' + ApiClient._apiUrl;
        } else {
            Input.setGlobalInputClass('form-select');
            Input.setGlobalLabelClass('form-label');
            Input.setGlobalWrapper('div');
            Input.setGlobalWrapperClass('form-group col col-md-3');

            const calendarSelect = new CalendarSelect( args.locale );
            const apiOptions = new ApiOptions( args.locale );
            apiOptions._yearInput.class('form-control'); // override the global input class for number input
            apiOptions.linkToCalendarSelect( calendarSelect );
            //apiClient.listenTo(apiOptions);
            if ( args.apiOptionsFilter ) {
                apiOptions.filter( args.apiOptionsFilter );
            }
            if ( args.calendarSelectAllowNull ) {
                calendarSelect.allowNull( args.calendarSelectAllowNull );
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
        calendarSelectAllowNull: true
    }
}

export default meta;

export const Default = {
    args: {}
}

/**
 * `CalendarSelect` e `ApiOptions` - Permettere un valore Nullo nel `CalendarSelect`
 *
 * Il componente `ApiOptions` è collegato al componente `CalendarSelect`.
 * Quando un calendario viene selezionato dal componente `CalendarSelect`,
 * le opzioni negli elementi `<select>` del comoponente `ApiOptions` vengono aggiornate per riflettere le opzioni del calendario selezionato.
 * Ad esempio, l'input `locale` mostrerà solo le lingue compatibili con il calendario selezionato.
 *
 * Il componente `ApiOptions` non ha un filtro impostato, pertanto vengono mostrati tutti gli elementi `select`.
 *
 * Inoltre abbiamo impostato `allowNull()` sul componente `CalendarSelect`, perciò quando viene selezionato un valore vuoto nel `CalendarioSelect`
 * (che corrisponde al valore generico "Calendario Romano Generale"), gli elementi `<select>` che possono modificare il Calendario Romano Generale vengono abilitate.
 * L'input `locale` mostrerà le lingue compatibili con il Calendario Romano Generale (ovvero lingue senza estensioni nazionali).
 *
 * Se invece viene selezionato un calendario nazionale o diocesano,
 * gli elementi `<select>` che possono modificare il Calendario Romano Generale vengono disabilitate,
 * perché queste opzioni sono determinate dal calendario nazionale o diocesano selezionato
 * (e di conseguenza i valori di queste opzioni rifletteranno le impostazioni predefinite del calendario selezionato).
 */
export const Italian = {
    args: {
        locale: 'it-IT',
        calendarSelectLabelText: 'Seleziona calendario'
    }
}

/**
 * `CalendarSelect` et `ApiOptions` - Permettre une valeur nulle dans `CalendarSelect`
 *
 * Le composant `ApiOptions` est lié au composant `CalendarSelect`.
 * Lorsqu'un calendrier est sélectionné depuis le composant `CalendarSelect`,
 * les options dans les éléments `<select>` du composant `ApiOptions` sont mises à jour pour refléter les options du calendrier sélectionné.
 * Par exemple, l'entrée `locale` affichera uniquement les langues compatibles avec le calendrier sélectionné.
 *
 * Le composant `ApiOptions` n'a pas de filtre configuré, par conséquent, tous les éléments `select` sont affichés.
 *
 * En outre, nous avons configuré `allowNull()` sur le composant `CalendarSelect`, donc lorsqu'une valeur vide est sélectionnée dans `CalendarSelect`
 * (ce qui correspond à la valeur générique "Calendrier Romain Général"), les éléments `<select>` qui peuvent modifier le Calendrier Romain Général sont activés.
 * L'entrée `locale` affichera les langues compatibles avec le Calendrier Romain Général (c'est-à-dire des langues sans extensions nationales).
 *
 * Si, en revanche, un calendrier national ou diocésain est sélectionné,
 * les éléments `<select>` qui peuvent modifier le Calendrier Romain Général sont désactivés,
 * car ces options sont déterminées par le calendrier national ou diocésain sélectionné
 * (et en conséquence, les valeurs de ces options refléteront les paramètres par défaut du calendrier sélectionné).
 */
export const French = {
    args: {
        locale: 'fr-FR',
        calendarSelectLabelText: 'Sélectionnez calendrier'
    }
}

/**
 * `CalendarSelect` y `ApiOptions` - Permitir un valor nulo en `CalendarSelect`
 *
 * El componente `ApiOptions` está vinculado al componente `CalendarSelect`.
 * Cuando se selecciona un calendario desde el componente `CalendarSelect`,
 * las opciones en los elementos `<select>` del componente `ApiOptions` se actualizan para reflejar las opciones del calendario seleccionado.
 * Por ejemplo, la entrada `locale` mostrará solo los idiomas compatibles con el calendario seleccionado.
 *
 * El componente `ApiOptions` no tiene un filtro configurado, por tanto se muestran todos los elementos `select`.
 *
 * Además, hemos configurado `allowNull()` en el componente `CalendarSelect`, por lo que cuando se selecciona un valor vacío en `CalendarSelect`
 * (que corresponde al valor genérico "Calendario Romano General"), los elementos `<select>` que pueden modificar el Calendario Romano General son habilitados.
 * La entrada `locale` mostrará los idiomas compatibles con el Calendario Romano General (es decir, idiomas sin extensiones nacionales).
 *
 * Si en cambio se selecciona un calendario nacional o diocesano,
 * los elementos `<select>` que pueden modificar el Calendario Romano General son deshabilitados,
 * porque estas opciones son determinadas por el calendario nacional o diocesano seleccionado
 * (y en consecuencia los valores de estas opciones reflejarán la configuración predeterminada del calendario seleccionado).
 */
export const Spanish = {
    args: {
        locale: 'es-ES',
        calendarSelectLabelText: 'Seleccione calendario'
    }
}

/**
 * `CalendarSelect` und `ApiOptions` - Erlauben Sie einen Nullwert in `CalendarSelect`
 *
 * Die Komponente `ApiOptions` ist mit der Komponente `CalendarSelect` verbunden.
 * Wenn ein Kalender aus der Komponente `CalendarSelect` ausgewählt wird,
 * werden die Optionen in den `<select>`-Elementen der Komponente `ApiOptions` aktualisiert, um die Optionen des ausgewählten Kalenders widerzuspiegeln.
 * Zum Beispiel zeigt die Eingabe `locale` nur die mit dem ausgewählten Kalender kompatiblen Sprachen an.
 *
 * Die Komponente `ApiOptions` hat keinen Filter konfiguriert, daher werden alle `select`-Elemente angezeigt.
 *
 * Außerdem haben wir `allowNull()` in der Komponente `CalendarSelect` konfiguriert, sodass bei Auswahl eines leeren Wertes in `CalendarSelect`
 * (was dem generischen Wert "Allgemeiner Römischer Kalender" entspricht), die `<select>`-Elemente, die den Allgemeinen Römischen Kalender ändern können, aktiviert werden.
 * Die Eingabe `locale` zeigt die mit dem Allgemeinen Römischen Kalender kompatiblen Sprachen an (d.h. Sprachen ohne nationale Erweiterungen).
 *
 * Wenn jedoch ein nationaler oder diözesaner Kalender ausgewählt wird,
 * werden die `<select>`-Elemente, die den Allgemeinen Römischen Kalender ändern können, deaktiviert,
 * da diese Optionen durch den ausgewählten nationalen oder diözesanen Kalender bestimmt werden
 * (und dementsprechend die Werte dieser Optionen die Standardeinstellungen des ausgewählten Kalenders widerspiegeln).
 */
export const German = {
    args: {
        locale: 'de-DE',
        calendarSelectLabelText: 'Wählen Sie ein Kalender'
    }
}
