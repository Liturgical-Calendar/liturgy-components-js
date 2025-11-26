# CalendarSelect

The `CalendarSelect` component generates a select element populated with available liturgical calendars
from the Liturgical Calendar API.

## Prerequisites

The `ApiClient` must be statically initialized before instantiating `CalendarSelect`:

```javascript
import { ApiClient, CalendarSelect } from '@liturgical-calendar/components-js';

ApiClient.init('http://localhost:8000').then((apiClient) => {
    const calendarSelect = new CalendarSelect('en-US');
    calendarSelect.appendTo('#calendarOptions');
});
```

## Constructor Options

The constructor accepts a locale string or an options object:

```javascript
// With locale string
const calendarSelect = new CalendarSelect('en-US');

// With options object
const calendarSelect = new CalendarSelect({
    locale: 'en-US',
    id: 'calendar-select',
    class: 'form-select',
    name: 'selected_calendar',
    filter: CalendarSelectFilter.NATIONAL_CALENDARS,
    allowNull: true,
    disabled: false,
    label: { text: 'Select a calendar', class: 'form-label' },
    wrapper: { as: 'div', class: 'form-group' }
});
```

## Configuration Methods

All configuration methods are chainable except `appendTo()` and `replace()`:

```javascript
const calendarSelect = new CalendarSelect('en-US')
    .class('form-select')
    .id('calendar-select')
    .name('selected_calendar')
    .label({
        text: 'Select a Calendar',
        class: 'form-label',
        id: 'calendar-label'
    })
    .wrapper({
        as: 'div',
        class: 'form-group col col-md-3'
    })
    .allowNull()
    .disabled(false)
    .after('<p class="help-text">Choose your calendar</p>');

calendarSelect.appendTo('#calendarOptions');
```

### Available Methods

| Method | Description |
|--------|-------------|
| `class(className)` | CSS class(es) for the select element |
| `id(id)` | ID for the select element (without '#') |
| `name(name)` | Name attribute for the select element |
| `label(options)` | Configure the label element (`text`, `class`, `id`) |
| `wrapper(options)` | Configure wrapper element (`as`: 'div' or 'td', `class`, `id`) |
| `disabled(disabled=true)` | Set disabled state |
| `filter(filter)` | Filter calendar options (see Filtering section) |
| `allowNull(allowNull=true)` | Include empty option for General Roman Calendar |
| `after(htmlString)` | HTML content after the select element |
| `linkToNationsSelect(instance)` | Link to a national calendars select for filtering dioceses |
| `value(val?)` | Get or set the selected value. Without argument returns current value; with argument sets value and returns instance |
| `onChange(callback)` | Register a callback for change events. Returns instance for chaining |

### DOM Insertion Methods (non-chainable)

| Method | Description |
|--------|-------------|
| `appendTo(selector)` | Append to the specified DOM element |
| `replace(selector)` | Replace the specified DOM element |

## Filtering Calendars

Filter the select options to show only specific calendar types:

```javascript
import { CalendarSelect, CalendarSelectFilter } from '@liturgical-calendar/components-js';

// Show only national calendars
const nationalSelect = new CalendarSelect('en-US')
    .filter(CalendarSelectFilter.NATIONAL_CALENDARS);

// Show only diocesan calendars
const diocesanSelect = new CalendarSelect('en-US')
    .filter(CalendarSelectFilter.DIOCESAN_CALENDARS);

// Show all calendars (default)
const allSelect = new CalendarSelect('en-US')
    .filter(CalendarSelectFilter.NONE);
```

### Linking National and Diocesan Selects

Link a diocesan select to a national select so dioceses are filtered by selected nation:

```javascript
const nationalSelect = new CalendarSelect('en-US')
    .filter(CalendarSelectFilter.NATIONAL_CALENDARS);
nationalSelect.appendTo('#nationalContainer');

const diocesanSelect = new CalendarSelect('en-US')
    .filter(CalendarSelectFilter.DIOCESAN_CALENDARS)
    .linkToNationsSelect(nationalSelect);
diocesanSelect.appendTo('#diocesanContainer');
```

## Instance Properties

Properties with a single underscore prefix are **intended for advanced use cases** such as direct DOM access or reading internal state. This naming convention indicates "internal but accessible" - these are part of the public API for advanced configuration.

```javascript
calendarSelect._domElement  // The underlying DOM select element
calendarSelect._filter      // Current filter applied ('none', 'national_calendars', 'diocesan_calendars')
```

## Vatican Calendar vs. General Roman Calendar

When using `CalendarSelect` **standalone** (without `PathBuilder`):

- Selecting "Vatican" is treated the same as selecting no calendar (General Roman Calendar)
- This allows users to view the calendar in their preferred language
- When `ApiClient` listens to `ApiOptions`, the `Accept-Language` header is set automatically

When using `CalendarSelect` **with `PathBuilder`**:

- `/calendar` = General Roman Calendar (supports any locale)
- `/calendar/nation/VA` = Vatican calendar (Latin only)

## Example: Full Setup

```javascript
import { ApiClient, CalendarSelect, ApiOptions, ApiOptionsFilter } from '@liturgical-calendar/components-js';

ApiClient.init('http://localhost:8000').then((apiClient) => {
    if (!(apiClient instanceof ApiClient)) return;

    const calendarSelect = new CalendarSelect('en-US')
        .allowNull()
        .class('form-select')
        .label({ text: 'Calendar', class: 'form-label' })
        .wrapper({ as: 'div', class: 'col-md-6' });
    calendarSelect.appendTo('#calendarOptions');

    // Set General Roman Calendar as default
    calendarSelect.value('');

    const apiOptions = new ApiOptions('en-US')
        .filter(ApiOptionsFilter.LOCALE_ONLY)
        .linkToCalendarSelect(calendarSelect);
    apiOptions.appendTo('#calendarOptions');

    apiClient.listenTo(calendarSelect).listenTo(apiOptions);
    apiClient.fetchCalendar('en');
});
```
