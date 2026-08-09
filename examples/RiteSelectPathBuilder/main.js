import {
    ApiClient,
    CalendarSelect,
    RiteSelect,
    ApiOptions,
    Input,
    ApiOptionsFilter,
    PathBuilder,
} from 'liturgy-components-js';

Input.setGlobalInputClass('form-select');
Input.setGlobalLabelClass('form-label mb-1');
Input.setGlobalWrapper('div');
Input.setGlobalWrapperClass('form-group col col-md-3');

ApiClient.init('http://localhost:8000')
    .then((apiClient) => {
        const riteSelect = new RiteSelect('en-US')
            .class('form-select')
            .id('riteSelect')
            .label({ text: 'Select a rite', class: 'form-label mb-1' });
        riteSelect.appendTo('#riteSelectWrapper');

        const apiOptions = new ApiOptions('en-US');
        apiOptions._localeInput.defaultValue('la');
        apiOptions._acceptHeaderInput.hide();
        apiOptions._yearInput.class('form-control');
        apiOptions._holydaysOfObligationInput.class('d-none');
        apiOptions
            .filter(ApiOptionsFilter.PATH_BUILDER)
            .appendTo('#pathBuilder');

        // PathBuilder requires a `none` filtered CalendarSelect.
        const calendarSelect = new CalendarSelect('en-US').allowNull();
        calendarSelect
            .label({
                class: 'form-label mb-1',
                id: 'calendarSelectLabel',
                text: 'Select a calendar',
            })
            .wrapper({
                class: 'form-group col col-md-3',
                id: 'calendarSelectWrapper',
            })
            .id('calendarSelect')
            .class('form-control select-input')
            .insertAfter(apiOptions._calendarPathInput);

        apiOptions
            .filter(ApiOptionsFilter.ALL_PATHS)
            .appendTo('#requestParameters');
        apiOptions.linkToCalendarSelect(calendarSelect, riteSelect);

        const pathBuilder = new PathBuilder(apiOptions, calendarSelect)
            .class('row align-items-center ps-2')
            .id('pathBuilderResult')
            .pathWrapperClass(
                'col-sm-7 border border-secondary rounded bg-light px-3 py-1',
            )
            .buttonWrapperClass('col-sm-3')
            .buttonClass('btn btn-primary');
        pathBuilder.replace('#pathBuilderResult');
    })
    .catch((error) => {
        document.querySelector('#pathBuilderResult').textContent =
            `Could not reach the Liturgical Calendar API at ${error.url ?? 'the configured base'}: ${error.message}`;
    });
