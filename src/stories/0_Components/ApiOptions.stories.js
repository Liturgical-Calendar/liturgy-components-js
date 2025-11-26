import { ApiOptions, ApiClient, ApiOptionsFilter, Input } from '@liturgical-calendar/components-js';

/**
 * ApiOptions component
 *
 * The `ApiOptions` component is not styled out of the box, so it can be adapted to any use case in any project.
 *
 * The `ApiOptions` component generates form select controls that represent the parameters that can be set
 * in a request for Calendar data from the Liturgical Calendar API.
 *
 * The `ApiOptions` component can be instantiated with a `locale` parameter, which will determine the localization for the UI elements (such as values in the select dropdowns).
 *
 * The `ApiOptions` component can be filtered to only show `<select>` elements that are applicable
 * when requesting a National or Diocesan calendar (which will be the majority of use cases).
 * These `<select>` elements are:
 * * `locale` (the value should be sent in the request as the `Accept language` header)
 * * `Accept header` (this is probably not needed in most use cases, it can allow to request a media type other than JSON)
 * * `year` (the value should be sent in the request as a path parameter)
 * * `year_type` (the value should be sent in the request as a query parameter)
 *
 * However, if National or Dicoesan calendar data for a geographical area has not yet been defined in the Liturgical Calendar API,
 * yet we would like to produce a calendar in which the celebrations of `Epiphany`, `Ascension`, `Corpus Christi`,
 * and `Eternal High Priest` are calculated based on the rules laid down by an Episcopal Conference or Diocese,
 * we can opt to show all possible `<select>` inputs, by not applying any filter.
 */
const meta = {
    title: 'Components/ApiOptions/Unstyled',
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
        filter: {
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
        hideAcceptHeaderInput: {
            control: 'boolean',
            description: 'Hide the Accept header input. This option is not passed to the ApiOptions constructor, but when set to true we use the ApiOptions instance `_acceptHeaderInput.hide()` method to hide the Accept header input.',
            defaultValue: false
        },
        acceptHeaderAsReturnTypeParam: {
            control: 'boolean',
            description: 'When the Accept header input is not hidden, display the Accept header select as a `return type` parameter select. This option is not passed directly to the ApiOptions constructor, but when set to true we use the ApiOptions instance `_acceptHeaderInput.asReturnTypeParam(true)` method to display the Accept header input as a `return type` parameter select.',
            defaultValue: false
        }
    },
    render: ( args, { loaded: { apiClient } } ) => {
        const container = document.createElement( 'div' );
        container.id = 'apiOptionsContainer';

        if ( false === apiClient || false === (apiClient instanceof ApiClient) ) {
            container.textContent = 'Error initializing the Liturgical Calendar API Client, check that the API is running at ' + ApiClient._apiUrl;
        } else {
            Input.setGlobalInputClass('unstyled');
            Input.setGlobalLabelClass('unstyled');
            Input.setGlobalWrapper('div');
            Input.setGlobalWrapperClass('unstyled');

            //apiClient.listenTo(apiOptions);
            const apiOptions = new ApiOptions( args.locale );
            if ( args.filter ) {
                apiOptions.filter( args.filter );
            }
            if (args.hideAcceptHeaderInput) {
                apiOptions._acceptHeaderInput.hide();
            }
            if (args.acceptHeaderAsReturnTypeParam) {
                apiOptions._acceptHeaderInput.asReturnTypeParam(true);
            }
            apiOptions.appendTo( container );
        }
        return container;
    },
    parameters: {
        actions: {
            handles: [ 'change', 'change #apiOptionsContainer select' ],
        },
    },
    args: {}
}

export default meta;

export const Default = {
    args: {}
}

export const Italian = {
    args: {
        locale: 'it-IT'
    }
}

export const French = {
    args: {
        locale: 'fr-FR'
    }
}

export const Spanish = {
    args: {
        locale: 'es-ES'
    }
}

export const German = {
    args: {
        locale: 'de-DE'
    }
}

export const AllCalendars = {
    args: {
        locale: 'en-US',
        filter: ApiOptionsFilter.ALL_CALENDARS
    }
}

export const GeneralRoman = {
    args: {
        locale: 'en-US',
        filter: ApiOptionsFilter.GENERAL_ROMAN
    }
}

export const HideAcceptHeaderInput = {
    args: {
        locale: 'en-US',
        hideAcceptHeaderInput: true
    }
}

export const AllCalendarsHideAcceptHeaderInput = {
    args: {
        locale: 'en-US',
        filter: ApiOptionsFilter.ALL_CALENDARS,
        hideAcceptHeaderInput: true
    }
}

export const AcceptHeaderInputAsReturnTypeParameter = {
    args: {
        locale: 'en-US',
        filter: ApiOptionsFilter.ALL_CALENDARS,
        acceptHeaderAsReturnTypeParam: true
    }
}
