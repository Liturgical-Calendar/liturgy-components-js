# ApiOptions

The `ApiOptions` component generates form controls for the Liturgical Calendar API options.

## Constructor

```javascript
import { ApiOptions } from '@liturgical-calendar/components-js';

const apiOptions = new ApiOptions('en-US');
```

## Form Controls

The `ApiOptions` class creates nine form controls:

### Universal Form Controls

These are useful for any calendar (General Roman, National, or Diocesan):

| Property | Type | Description |
|----------|------|-------------|
| `_yearInput` | number input | Calendar year |
| `_yearTypeInput` | select | Year type (liturgical or civil) |
| `_localeInput` | select | Locale for API response |
| `_acceptHeaderInput` | select | Accept header format |

### General Roman Calendar Controls

These fine-tune the General Roman Calendar when national/diocesan data is not requested:

| Property | Type | Description |
|----------|------|-------------|
| `_epiphanyInput` | select | When Epiphany is celebrated |
| `_ascensionInput` | select | When Ascension is celebrated |
| `_corpusChristiInput` | select | When Corpus Christi is celebrated |
| `_eternalHighPriestInput` | select | Whether Eternal High Priest is celebrated |
| `_holydaysOfObligationInput` | select | Holy Days of Obligation settings |

### Path Builder Control

| Property | Type | Description |
|----------|------|-------------|
| `_calendarPathInput` | select | API request path |

## Filtering Form Controls

Filter which controls are displayed using `ApiOptionsFilter`:

```javascript
import { ApiOptions, ApiOptionsFilter } from '@liturgical-calendar/components-js';

// Show all controls (default)
const apiOptions = new ApiOptions('en-US')
    .filter(ApiOptionsFilter.NONE);

// Show only universal controls (year, yearType, locale, acceptHeader)
const apiOptions = new ApiOptions('en-US')
    .filter(ApiOptionsFilter.ALL_CALENDARS);

// Show only General Roman controls
const apiOptions = new ApiOptions('en-US')
    .filter(ApiOptionsFilter.GENERAL_ROMAN);

// Show only locale input
const apiOptions = new ApiOptions('en-US')
    .filter(ApiOptionsFilter.LOCALE_ONLY);

// Show only year input
const apiOptions = new ApiOptions('en-US')
    .filter(ApiOptionsFilter.YEAR_ONLY);

// Show path builder controls (calendarPath + year)
const apiOptions = new ApiOptions('en-US')
    .filter(ApiOptionsFilter.PATH_BUILDER);
```

## Global Configuration

Configure all form controls globally using the `Input` static class:

```javascript
import { ApiOptions, Input } from '@liturgical-calendar/components-js';

Input.setGlobalInputClass('form-select');
Input.setGlobalLabelClass('form-label d-block mb-1');
Input.setGlobalWrapper('div');
Input.setGlobalWrapperClass('form-group col col-md-3');

const apiOptions = new ApiOptions('en-US');
apiOptions.appendTo('#calendarOptions');
```

## Individual Control Configuration

Configure individual form controls using chainable methods:

```javascript
apiOptions._yearInput
    .class('form-control')        // Override global class
    .id('year-input')
    .name('year')
    .labelClass('form-label')
    .labelAfter('<span class="required">*</span>')
    .wrapper('div')
    .wrapperClass('col-md-3')
    .disabled(false)
    .data({ custom: 'value' })
    .defaultValue(2025);

// Hide a control
apiOptions._acceptHeaderInput.hide();
```

### Available Control Methods

| Method | Description |
|--------|-------------|
| `class(className)` | CSS class(es) for the control |
| `id(id)` | ID for the control |
| `name(name)` | Name attribute |
| `labelClass(className)` | CSS class(es) for the label |
| `labelAfter(htmlString)` | HTML to append after label text |
| `wrapper(tagName)` | Wrapper element ('div' or 'td') |
| `wrapperClass(className)` | CSS class(es) for wrapper |
| `disabled(disabled=true)` | Set disabled state |
| `data(dataMap)` | Set data attributes |
| `defaultValue(value)` | Set default value |
| `hide(hide=true)` | Hide the control |

## Linking to CalendarSelect

Link `ApiOptions` to a `CalendarSelect` to dynamically update controls based on selected calendar:

```javascript
const calendarSelect = new CalendarSelect('en-US');
calendarSelect.appendTo('#calendarOptions');

const apiOptions = new ApiOptions('en-US')
    .linkToCalendarSelect(calendarSelect);
apiOptions.appendTo('#calendarOptions');
```

When linked:
- General Roman controls are populated with the selected calendar's settings and disabled
- Locale options are filtered based on the selected calendar's supported locales

## Example: Bootstrap Styling

```javascript
import { ApiClient, ApiOptions, Input } from '@liturgical-calendar/components-js';

ApiClient.init('http://localhost:8000').then((apiClient) => {
    if (!(apiClient instanceof ApiClient)) return;

    // Global Bootstrap styling
    Input.setGlobalInputClass('form-select');
    Input.setGlobalLabelClass('form-label d-block mb-1');
    Input.setGlobalWrapper('div');
    Input.setGlobalWrapperClass('form-group col col-md-3');

    const apiOptions = new ApiOptions('en-US');

    // Override for number input
    apiOptions._yearInput.class('form-control');

    // Hide Accept header (usually only need JSON)
    apiOptions._acceptHeaderInput.hide();

    apiOptions.appendTo('#calendarOptions');
});
```
