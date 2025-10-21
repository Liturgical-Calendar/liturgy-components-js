import { ApiClient, CalendarSelect, ApiOptions, Input, ApiOptionsFilter, PathBuilder } from 'liturgy-components-js';

Input.setGlobalInputClass('form-select');
Input.setGlobalLabelClass('form-label mb-1');
Input.setGlobalWrapper('div');
Input.setGlobalWrapperClass('form-group col col-md-3');

function buildVirtualSelectOptions( selectElement ) {
    return Array.from(selectElement.options).map(opt => ({
        label: opt.textContent,
        value: opt.value,
        selected: opt.selected
    }));
}

function buildAndInitVirtualSelectFromNativeSelect(nativeSelect, vsContainerId) {
  // 1) build options and selected values
  const opts = buildVirtualSelectOptions(nativeSelect);
  const selectedValues = opts.filter(o => o.selected).map(o => o.value);

  // 2) init VirtualSelect on the div container
  VirtualSelect.init({
    ele: `#${vsContainerId}`,
    showValueAsTags: true,
    //additionalToggleButtonClasses: "btn",
    additionalDropboxContainerClasses: "dropdown-menu",
    multiple: true,
    search: false,
    options: opts,
    selectedValue: selectedValues,
    onChange: function(value) {
        // value is an array in multiple mode
        // sync back to the native select
        Array.from(nativeSelect.options).forEach(opt => {
            opt.selected = value.includes(opt.value);
        });
        nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
}

ApiClient.init('http://localhost:8000').then(apiClient => {
    if (false === apiClient || false === apiClient instanceof ApiClient) {
        alert('Error initializing the Liturgical Calendar API Client');
    } else {
        const apiOptions = new ApiOptions( 'en-US' );
        apiOptions._localeInput.defaultValue( 'la' );
        apiOptions._acceptHeaderInput.hide();
        apiOptions._yearInput.class( 'form-control' );
        apiOptions._ascensionInput.wrapperClass( 'form-group col col-md-2' );
        apiOptions._corpusChristiInput.wrapperClass( 'form-group col col-md-2' );
        apiOptions._eternalHighPriestInput.wrapperClass( 'form-group col col-md-2' );
        apiOptions._holydaysOfObligationInput.class('d-none');
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
        .class('form-control select-input')
        .insertAfter( apiOptions._calendarPathInput );

        apiOptions.filter( ApiOptionsFilter.ALL_PATHS ).appendTo('#requestParametersAllPaths');
        apiOptions.filter( ApiOptionsFilter.BASE_PATH ).appendTo('#requestParametersBasePath');

        // 1. Create a new container element for the virtual select
        const hdobVirtualSelect = document.createElement('div');
        hdobVirtualSelect.id = 'hdob-virtual-select';
        // 2. Insert it right after the original native select
        apiOptions._holydaysOfObligationInput._domElement.parentNode.insertBefore( hdobVirtualSelect, apiOptions._holydaysOfObligationInput._domElement.nextSibling );
        // 3. Build and initialize the virtual select from the native select
        buildAndInitVirtualSelectFromNativeSelect( apiOptions._holydaysOfObligationInput._domElement, 'hdob-virtual-select' );
        apiOptions.linkToCalendarSelect( calendarSelect );
        if (calendarSelect._domElement.value === '') {
            hdobVirtualSelect.enable();
        } else {
            hdobVirtualSelect.disable();
        }
        // 4. Listen to changes on the calendar select to update the virtual select accordingly
        calendarSelect._domElement.addEventListener('change', (ev) => {
            console.log('calendar changed to:', ev.target.value);
            const vsElement = document.querySelector('#hdob-virtual-select');
            vsElement.destroy();
            buildAndInitVirtualSelectFromNativeSelect( apiOptions._holydaysOfObligationInput._domElement, 'hdob-virtual-select' );
            if (ev.target.value === '') {
                vsElement.enable();
            } else {
                vsElement.disable();
            }
        });

        const pathBuilder = new PathBuilder(apiOptions, calendarSelect)
            .class('row align-items-center ps-2')
            .id('pathBuilderResult')
            .pathWrapperClass('col-sm-7 border border-secondary rounded bg-light px-3 py-1')
            .buttonWrapperClass('col-sm-3')
            .buttonClass('btn btn-primary')
            .replace('#pathBuilderResult');
        /*apiClient.listenTo( calendarSelect );
        apiClient.listenTo( apiOptions );
        apiClient._eventBus.on( 'calendarFetched', ( data ) => {
            console.log('calendarFetch event received with data:', data );
        });*/
    }
});
