import { ApiOptions, ApiClient, ApiOptionsFilter } from 'liturgy-components-js';
import { fn } from '@storybook/test';
import { withActions } from '@storybook/addon-actions/decorator';

// Meta configuration
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
            description: 'Hide the Accept header input',
            defaultValue: false
        },
        acceptHeaderAsReturnTypeParam: {
            control: 'boolean',
            description: 'Display the Accept header select as a `return type` parameter select',
            defaultValue: false
        }
    },
    render: ( args, { loaded: { apiClient } } ) => {
        const container = document.createElement( 'div' );
        container.id = 'apiOptionsContainer';

        if ( false === apiClient || false === apiClient instanceof ApiClient ) {
            container.textContent = 'Error initializing the Liturgical Calendar API Client, check that the API is running at ' + ApiClient._apiUrl;
        } else {
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
    decorators: [ withActions ],
    args: {
        onChange: fn()
    }
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
