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

/**
 * Wires up a virtual select for the holy days of obligation setting UI.
 * @param {ApiOptions} apiOptions - instance of ApiOptions
 * @param {CalendarSelect} calendarSelect - instance of CalendarSelect
 * @param {string} vsContainerId - id of virtual select container element
 * @throws {Error} if apiOptions is not an instance of ApiOptions
 * @throws {Error} if calendarSelect is not an instance of CalendarSelect
 * @throws {Error} if vsContainerId is not a non-empty string
 */
function wireHdobVS( apiOptions, calendarSelect, vsContainerId ) {
    if (false === (apiOptions instanceof ApiOptions)) {
        throw new Error('apiOptions must be an instance of ApiOptions');
    }
    if (false === (calendarSelect instanceof CalendarSelect)) {
        throw new Error('calendarSelect must be an instance of CalendarSelect');
    }
    if (false === (typeof vsContainerId === 'string' && vsContainerId.length > 0)) {
        throw new Error('vsContainerId must be a non-empty string');
    }
    // 1. Create a new container element for the virtual select
    const hdobVirtualSelect = document.createElement('div');
    hdobVirtualSelect.id = vsContainerId;
    // 2. Insert it right after the original native select
    apiOptions._holydaysOfObligationInput._domElement.parentNode.insertBefore( hdobVirtualSelect, apiOptions._holydaysOfObligationInput._domElement.nextSibling );
    // 3. Build and initialize the virtual select from the native select
    buildAndInitVirtualSelectFromNativeSelect( apiOptions._holydaysOfObligationInput._domElement, vsContainerId );
    if (calendarSelect._domElement.value === '') {
        hdobVirtualSelect.enable();
    } else {
        hdobVirtualSelect.disable();
    }
    // 4. Listen to changes on the calendar select to rebuild and enable/disable the virtual select
    calendarSelect._domElement.addEventListener('change', (ev) => {
        //console.log('calendar changed to:', ev.target.value);
        hdobVirtualSelect.destroy();
        buildAndInitVirtualSelectFromNativeSelect( apiOptions._holydaysOfObligationInput._domElement, vsContainerId );
        if (ev.target.value === '') {
            hdobVirtualSelect.enable();
        } else {
            hdobVirtualSelect.disable();
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

    wireHdobVS( apiOptions, calendarSelect, 'hdob-virtual-select' );

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
                .listenTo(apiClient);
    // appendTo() must be called separately as it doesn't return `this`
    webCalendar.appendTo('#litcalWebcalendar');
    apiClient.fetchNationalCalendar('VA');
});
