import { ApiClient, CalendarSelect, ApiOptions, Input, ApiOptionsFilter } from 'liturgy-components-js';

Input.setGlobalInputClass('form-select');
Input.setGlobalLabelClass('form-label mb-1');
Input.setGlobalWrapper('div');
Input.setGlobalWrapperClass('form-group col col-md-3');


ApiClient.init('http://localhost:8000').then(apiClient => {
    if (false === apiClient || false === apiClient instanceof ApiClient) {
        alert('Error initializing the Liturgical Calendar API Client');
    } else {
        const apiOptions = (new ApiOptions( 'en-US' ));
        apiOptions._localeInput.defaultValue( 'la' );
        apiOptions._acceptHeaderInput.hide();
        apiOptions._yearInput.class( 'form-control' );
        apiOptions.filter( ApiOptionsFilter.PATH_BUILDER ).appendTo('#pathBuilder');

        const calendarSelect = (new CalendarSelect( 'en-US' )).allowNull();
        calendarSelect.label({
            class: 'form-label mb-1',
            id: 'calendarSelectLabel',
            text: 'Select a calendar'
        }).wrapper({
            class: 'form-group col col-md-3',
            id: 'calendarSelectWrapper'
        }).id('calendarSelect')
        .class('form-select')
        .insertAfter( apiOptions._calendarPathInput );

        apiOptions.filter( ApiOptionsFilter.BASE_PATH ).appendTo('#requestParametersBasePath');
        apiOptions.filter( ApiOptionsFilter.ALL_PATHS ).appendTo('#requestParametersAllPaths');
        apiOptions.linkToCalendarSelect( calendarSelect );

        apiClient.listenTo( calendarSelect );
        apiClient.listenTo( apiOptions );
        apiClient._eventBus.on( 'calendarFetched', ( data ) => {
            console.log('calendarFetch event received with data:', data );
        });
    }
});
