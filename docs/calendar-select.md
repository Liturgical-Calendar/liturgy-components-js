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
    rite: Rite.ROMAN,
    allowNull: true,
    disabled: false,
    label: { text: 'Select a calendar', class: 'form-label' },
    wrapper: { as: 'div', class: 'form-group' }
});
```

The `rite` option (a value of the `Rite` enum, see [Enums Reference](enums.md)) determines which
diocesan calendars are offered and whether a national tier is shown at all. It defaults to
`Rite.ROMAN` and can also be set after construction with the chainable `.rite()` method — see
[Filtering by Rite](#filtering-by-rite) below.

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

| Method                                            | Description                                              |
| ------------------------------------------------- | -------------------------------------------------------- |
| `class(className)`                                | CSS class(es) for the select element                     |
| `id(id)`                                          | ID for the select element (without '#')                  |
| `name(name)`                                      | Name attribute for the select element                    |
| `label(options)`                                  | Configure the label element (`text`, `class`, `id`)      |
| `wrapper(options)`                                | Configure wrapper element (`as`: 'div'/'td', `class`)    |
| `disabled(disabled=true)`                         | Set disabled state                                       |
| `filter(filter)`                                  | Filter calendar options (see Filtering section)          |
| `rite(rite=Rite.ROMAN)`                           | Set the rite this select is built for; settable once     |
| `allowNull(allowNull=true)`                       | Include the empty, rite-level calendar option            |
| `after(htmlString)`                               | HTML content after the select element                    |
| `linkToNationsSelect(instance)`                   | Link to national calendars select for filtering dioceses |
| `linkToRiteSelect(instance, dispatchChange=true)` | Link to a rite select; rebuilds on rite change           |
| `value(val?)`                                     | Get/set value; with arg sets value, returns `this`       |
| `onChange(callback)`                              | Register callback for change events; returns `this`      |

The empty option added by `allowNull()` selects the **rite-level** calendar, not the General Roman
Calendar specifically. It is labelled "General Roman Calendar" only when the select's rite is
`Rite.ROMAN`; under `Rite.AMBROSIAN` it is labelled "Ambrosian Calendar" and selects the
_comune ambrosiano_ at `/calendar/ambrosian`. The rite-specific label is applied in rite-aware mode
only — without a linked `RiteSelect` the empty option keeps the generic `---` text.

### DOM Insertion Methods (non-chainable)

| Method               | Description                         |
| -------------------- | ----------------------------------- |
| `appendTo(selector)` | Append to the specified DOM element |
| `replace(selector)`  | Replace the specified DOM element   |

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

## Filtering by Rite

Every `CalendarSelect` is built for a single `Rite` (see [Enums Reference](enums.md)), defaulting to
`Rite.ROMAN`. Diocesan calendars are filtered to those belonging to the selected rite, and for a rite
with no national tier (`Rite.AMBROSIAN`) the nation-grouping pass is skipped entirely: the select's
diocesan options are flat, with no `<optgroup>` and no nation options.

```javascript
import { CalendarSelect, Rite } from '@liturgical-calendar/components-js';

// Set via the constructor
const ambrosianSelect = new CalendarSelect({ locale: 'it-IT', rite: Rite.AMBROSIAN });

// Or via the chainable method
const romanSelect = new CalendarSelect('en-US').rite(Rite.ROMAN);
```

`.rite()` can only be set once per instance; calling it again throws. To change the rite of an
already-rendered select dynamically, use `RiteSelect` linked through
[`ApiOptions.linkToCalendarSelect()`](api-options.md#linking-to-calendarselect) — see
[RiteSelect](rite-select.md).

> **Back-compatibility note:** as of the introduction of rite awareness, a `CalendarSelect` that never
> sets `rite` still defaults to `Rite.ROMAN`, so its **markup does change** compared to earlier
> versions: the four Ambrosian dioceses (`milano_it`, `bergam_it`, `novara_it`, `lugano_ch`) no longer
> appear in the default diocese list, because they belong to `Rite.AMBROSIAN`, not `Rite.ROMAN`. This
> is a bug fix — Ambrosian dioceses never belonged under the Roman rite — but it is a visible change in
> rendered output for any integrator who was relying on the old, rite-unaware diocese list.

## Following a rite without an ApiOptions

`ApiOptions.linkToCalendarSelect()` accepts only a `none` filtered select or a nations/dioceses pair.
A select used on its own — to scope a permission or a test, say — links to the rite directly:

```javascript
const riteSelect = new RiteSelect( 'it' );
riteSelect.appendTo( '#riteWrapper' );

const calSelect = new CalendarSelect( 'it' )
    .filter( CalendarSelectFilter.DIOCESAN_CALENDARS )
    .allowNull( true )
    .linkToRiteSelect( riteSelect );
calSelect.appendTo( '#calendarWrapper' );
```

A `nations` filtered select is hidden while a rite with no national tier is selected — the
Ambrosian rite has no national calendars — and shown again when the rite has one.

## Instance Properties

Properties with a single underscore prefix are **intended for advanced use cases** such as direct DOM access
or reading internal state. This naming convention indicates "internal but accessible" - these are part of the
public API for advanced configuration.

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
