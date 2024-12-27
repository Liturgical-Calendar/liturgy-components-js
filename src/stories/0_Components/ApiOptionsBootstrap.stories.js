import { ApiOptions, ApiClient, ApiOptionsFilter, Input } from 'liturgy-components-js';
import { fn } from '@storybook/test';
import { withActions } from '@storybook/addon-actions/decorator';
import 'bootstrap/dist/css/bootstrap.min.css';

/**
 * ApiOptions component
 *
 * Here is an example of using the `ApiOptions` component in a bootstrap project.
 * We set all the necessary classes for bootstrap styled form controls.
 */
const meta = {
    title: 'Components/ApiOptions/Bootstrap',
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
        container.classList.add('row');

        if ( false === apiClient || false === apiClient instanceof ApiClient ) {
            container.textContent = 'Error initializing the Liturgical Calendar API Client, check that the API is running at ' + ApiClient._apiUrl;
        } else {
            Input.setGlobalInputClass('form-select');
            Input.setGlobalLabelClass('form-label d-block mb-1');
            Input.setGlobalWrapper('div');
            Input.setGlobalWrapperClass('form-group col col-md-3');

            const apiOptions = new ApiOptions( args.locale );
            //apiClient.listenTo(apiOptions);
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
