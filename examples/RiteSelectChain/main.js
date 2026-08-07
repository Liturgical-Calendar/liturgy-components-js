import { ApiClient, CalendarSelect, RiteSelect, ApiOptions, Input, CalendarSelectFilter } from 'liturgy-components-js';

Input.setGlobalInputClass('form-select');
Input.setGlobalLabelClass('form-label d-block mb-1');
Input.setGlobalWrapper('div');
Input.setGlobalWrapperClass('form-group col col-md-3');

// ApiClient.init() is still required: CalendarSelect reads the calendar metadata
// it fetches. This example simply never asks the client for a calendar.
ApiClient.init('http://localhost:8000').then(apiClient => {
    if (!apiClient || !(apiClient instanceof ApiClient)) {
        alert('Error initializing the Liturgical Calendar API Client');
        return;
    }

    const riteSelect = new RiteSelect('en-US')
        .class('form-select')
        .id('riteSelect')
        .label({ text: 'Select a rite', class: 'form-label d-block mb-1' });
    riteSelect.appendTo('#riteSelectWrapper');

    const nationSelect = new CalendarSelect('en-US')
        .filter(CalendarSelectFilter.NATIONAL_CALENDARS)
        .class('form-select')
        .id('nationSelect')
        .label({ text: 'Select a nation', class: 'form-label d-block mb-1' })
        .wrapper({ class: 'form-group col col-md-3' })
        .allowNull();
    nationSelect.appendTo('#calendarSelects');

    const dioceseSelect = new CalendarSelect('en-US')
        .filter(CalendarSelectFilter.DIOCESAN_CALENDARS)
        .class('form-select')
        .id('dioceseSelect')
        .label({ text: 'Select a diocese', class: 'form-label d-block mb-1' })
        .wrapper({ class: 'form-group col col-md-3' })
        .linkToNationsSelect(nationSelect)
        .after('<small class="text-secondary"><i class="fas fa-circle-info me-2"></i><i>Filtered by rite, and by the selected nation when the rite has a national tier.</i></small>')
        .allowNull();
    dioceseSelect.appendTo('#calendarSelects');

    const apiOptions = new ApiOptions('en-US');
    apiOptions._yearInput.class('form-control');
    apiOptions._acceptHeaderInput.hide();
    apiOptions._holydaysOfObligationInput.class('d-none');

    // The whole chain hangs off this one call: the rite select drives the
    // calendar selects, which in turn drive the option inputs.
    apiOptions.linkToCalendarSelect([ nationSelect, dioceseSelect ], riteSelect);
    apiOptions.appendTo('#calendarOptions');
});
