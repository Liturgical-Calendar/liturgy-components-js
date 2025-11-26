import { ApiOptions, ApiClient, ApiOptionsFilter, Input } from '@liturgical-calendar/components-js';
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
        container.classList.add('row');

        if (!apiClient || !(apiClient instanceof ApiClient)) {
            container.textContent = 'Error initializing the Liturgical Calendar API Client, check that the API is running at ' + ApiClient._apiUrl;
        } else {
            Input.setGlobalInputClass('form-select');
            Input.setGlobalLabelClass('form-label d-block mb-1');
            Input.setGlobalWrapper('div');
            Input.setGlobalWrapperClass('form-group col col-md-3');

            const apiOptions = new ApiOptions( args.locale );
            apiOptions._yearInput.class('form-control'); // override the global input class for number input
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
    args: {
        locale: 'en-US'
    }
}

export default meta;

export const Default = {}

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

/**
 * This story demonstrates using Bootstrap Multiselect for the HolydaysOfObligationInput.
 * Bootstrap Multiselect provides a jQuery-based multi-select dropdown UI that integrates
 * with Bootstrap styling.
 */
export const WithBootstrapMultiselect = {
    args: {
        locale: 'en-US',
        filter: ApiOptionsFilter.GENERAL_ROMAN,
        hideAcceptHeaderInput: true
    },
    render: (args, { loaded: { apiClient } }) => {
        const container = document.createElement('div');
        container.id = 'apiOptionsBsmsContainer';
        container.classList.add('row');

        if (!apiClient || !(apiClient instanceof ApiClient)) {
            container.textContent = 'Error initializing the Liturgical Calendar API Client';
        } else {
            Input.setGlobalInputClass('form-select');
            Input.setGlobalLabelClass('form-label d-block mb-1');
            Input.setGlobalWrapper('div');
            Input.setGlobalWrapperClass('form-group col col-md-3');

            const apiOptions = new ApiOptions(args.locale);
            apiOptions._yearInput.class('form-control'); // override the global input class for number input
            if (args.filter) {
                apiOptions.filter(args.filter);
            }
            if (args.hideAcceptHeaderInput) {
                apiOptions._acceptHeaderInput.hide();
            }
            apiOptions.appendTo(container);

            // Initialize bootstrap-multiselect after the container is in the DOM
            requestAnimationFrame(() => {
                // Defensive guards: check jQuery, plugin, and DOM element exist before initializing multiselect
                if (typeof window.jQuery === 'undefined') {
                    console.warn('bootstrap-multiselect: jQuery is not available, skipping multiselect initialization');
                    return;
                }
                if (typeof window.jQuery.fn?.multiselect !== 'function') {
                    console.warn('bootstrap-multiselect: plugin is not loaded, skipping multiselect initialization');
                    return;
                }
                if (!apiOptions._holydaysOfObligationInput || !apiOptions._holydaysOfObligationInput._domElement) {
                    console.warn('bootstrap-multiselect: HolydaysOfObligationInput or its DOM element is not available, skipping multiselect initialization');
                    return;
                }

                const $select = window.jQuery(apiOptions._holydaysOfObligationInput._domElement);
                $select.multiselect({
                    buttonWidth: '100%',
                    buttonClass: 'form-select',
                    templates: {
                        button: '<button type="button" class="multiselect dropdown-toggle" data-bs-toggle="dropdown"><span class="multiselect-selected-text"></span></button>'
                    },
                    maxHeight: 200,
                    includeSelectAllOption: true,
                    enableCaseInsensitiveFiltering: true,
                    onChange: (option, checked, select) => {
                        select.dispatchEvent(new CustomEvent('change', {
                            bubbles: true,
                            cancelable: true
                        }));
                    }
                });
            });
        }
        return container;
    }
}
