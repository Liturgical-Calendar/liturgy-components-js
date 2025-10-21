import { ApiClient, CalendarSelect, ApiOptions, Input, WebCalendar, Grouping, ColorAs, Column, ColumnOrder, DateFormat, GradeDisplay } from '../../src/index.js';

Input.setGlobalInputClass('form-select');
Input.setGlobalLabelClass('form-label d-block mb-1');
Input.setGlobalWrapper('div');
Input.setGlobalWrapperClass('form-group col col-md-3');

const lang = 'it-IT';
const baseLang = lang.split('-')[0];

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

ApiClient.init('http://localhost:8000').then( (apiClient) => {
    const calendarSelect = new CalendarSelect( lang );
    calendarSelect.allowNull()
        .label({
            class: 'form-label d-block mb-1'
        }).wrapper({
            class: 'form-group col col-md-3'
        }).class('form-select')
        .appendTo( '#calendarOptions');

    const apiOptions = new ApiOptions( lang );
    apiOptions._localeInput.defaultValue( baseLang );
    apiOptions._acceptHeaderInput.hide();
    apiOptions._yearInput.class( 'form-control' ); // override the global input class
    apiOptions._ascensionInput.wrapperClass( 'form-group col col-md-2' );
    apiOptions._corpusChristiInput.wrapperClass( 'form-group col col-md-2' );
    apiOptions._eternalHighPriestInput.wrapperClass( 'form-group col col-md-2' );
    apiOptions._holydaysOfObligationInput.class('d-none');
    apiOptions.linkToCalendarSelect( calendarSelect ).appendTo( '#calendarOptions' );

    apiClient.listenTo( calendarSelect ).listenTo( apiOptions );

    // 1. Create a new container element for the virtual select
    const hdobVirtualSelect = document.createElement('div');
    hdobVirtualSelect.id = 'hdob-virtual-select';
    // 2. Insert it right after the original native select
    apiOptions._holydaysOfObligationInput._domElement.parentNode.insertBefore( hdobVirtualSelect, apiOptions._holydaysOfObligationInput._domElement.nextSibling );
    // 3. Build and initialize the virtual select from the native select
    buildAndInitVirtualSelectFromNativeSelect( apiOptions._holydaysOfObligationInput._domElement, 'hdob-virtual-select' );
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

    const webCalendar = new WebCalendar();
    webCalendar.id('LitCalTable')
                .firstColumnGrouping(Grouping.BY_LITURGICAL_SEASON)
                .psalterWeekColumn() // add psalter week column as the right hand most column
                .removeHeaderRow() // we don't need to see the header row
                .seasonColor(ColorAs.CSS_CLASS)
                .seasonColorColumns(Column.LITURGICAL_SEASON)
                .eventColor(ColorAs.INDICATOR)
                .eventColorColumns(Column.EVENT_DETAILS)
                .monthHeader() // enable month header at the start of each month
                .dateFormat(DateFormat.DAY_ONLY)
                .columnOrder(ColumnOrder.GRADE_FIRST)
                .gradeDisplay(GradeDisplay.ABBREVIATED)
                .attachTo( '#litcalWebcalendar' ) // the element in which the web calendar will be rendered, every time the calendar is updated
                .listenTo(apiClient);
    apiClient.fetchNationalCalendar('VA');
});
