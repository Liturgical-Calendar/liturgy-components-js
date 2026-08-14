# ApiOptions

The `ApiOptions` component generates form controls for the Liturgical Calendar API options.

## Constructor

```javascript
import { ApiOptions } from '@liturgical-calendar/components-js';

const apiOptions = new ApiOptions('en-US');

// Or with an options object, binding the form to a specific API base
const bound = new ApiOptions({ locale: 'en-US', apiClient });

// A locale may also be given as an Intl.Locale, bare or inside the bag
const italian = new ApiOptions(new Intl.Locale('it-IT'));
```

The constructor accepts a locale — a `string` or an `Intl.Locale`, interchangeably — or a plain options object
with `locale` and `apiClient` keys, and throws for anything else, naming the type it found. So
`new ApiOptions(new Date())` reads `found type: Date` instead of the
`TypeError: locale.replaceAll is not a function` it raised before 2.0.0.

`null` and `undefined` both mean "not supplied", as the argument itself and as the `locale` property alike, and
take the default of `'en'`. An unparseable locale still throws: "absent" and "invalid" are different things.

The `apiClient` option binds the form to that client's API base, which is where `_localeInput` reads the
supported locales from. Omitting it binds to the first base initialized, and warns once if more than one is
registered. See [Using two API bases on one page](api-client.md#api-bases).

## Form Controls

The `ApiOptions` class creates nine form controls, exposed as properties with a single underscore prefix
(e.g., `_localeInput`). This naming convention indicates these are **intended for advanced configuration**
rather than being strictly private. Accessing these properties is the expected pattern for customizing
individual form controls.

> **Note:** The single underscore prefix is a JavaScript convention indicating "internal but accessible"
> properties. These are part of the public API for advanced use cases like custom styling, linking to other
> components, or reading current values.

### Universal Form Controls

These are useful for any calendar (General Roman, National, or Diocesan):

| Property             | Type         | Description                     |
| -------------------- | ------------ | ------------------------------- |
| `_yearInput`         | number input | Calendar year                   |
| `_yearTypeInput`     | select       | Year type (liturgical or civil) |
| `_localeInput`       | select       | Locale for API response         |
| `_acceptHeaderInput` | select       | Accept header format            |

### General Roman Calendar Controls

These fine-tune the General Roman Calendar when national/diocesan data is not requested:

| Property                     | Type   | Description                               |
| ---------------------------- | ------ | ----------------------------------------- |
| `_epiphanyInput`             | select | When Epiphany is celebrated               |
| `_ascensionInput`            | select | When Ascension is celebrated              |
| `_corpusChristiInput`        | select | When Corpus Christi is celebrated         |
| `_eternalHighPriestInput`    | select | Whether Eternal High Priest is celebrated |
| `_holydaysOfObligationInput` | select | Holy Days of Obligation settings          |

### Path Builder Control

| Property             | Type   | Description      |
| -------------------- | ------ | ---------------- |
| `_calendarPathInput` | select | API request path |

### Input labels

Each control localizes its own `<label>` from the locale the `ApiOptions` was constructed with, so
`new ApiOptions( 'it' )` renders Italian labels with no meta-component and no theming involved. Before #59
these labels were the raw snake_case API parameter names (`year_type`, `epiphany`, …) in every language,
which is what a screen reader announced for the control.

| Control                      | `Messages` key           |
| ---------------------------- | ------------------------ |
| `_yearInput`                 | `YEAR`                   |
| `_yearTypeInput`             | `YEAR_TYPE`              |
| `_localeInput`               | `LANGUAGE`               |
| `_epiphanyInput`             | `EPIPHANY`               |
| `_ascensionInput`            | `ASCENSION`              |
| `_corpusChristiInput`        | `CORPUS_CHRISTI`         |
| `_eternalHighPriestInput`    | `ETERNAL_HIGH_PRIEST`    |
| `_holydaysOfObligationInput` | `HOLYDAYS_OF_OBLIGATION` |

`LiturgyOfAnyDay`'s own date controls follow the same rule, keyed `DAY`, `MONTH` and `YEAR`.

Only twelve of `Messages.js`' 84 locale blocks carry the six newer keys; every other locale falls back to
English for them rather than throwing, through the usual `Messages[language]?.[KEY] ?? Messages['en'][KEY]`.
`MONTH` is present in all 84.

`_acceptHeaderInput` is **not** localized — it still renders `return_type` or `Accept Header` — because it
takes no locale and its label flips at runtime in `asReturnTypeParam()`.

To override a label, assign to the control's `_labelElement` after construction:

```javascript
apiOptions._yearTypeInput._labelElement.textContent = 'Tipo de año';
```

A meta-component theme's `localeInput.labelText` and `LiturgyOfAnyDay`'s
`dayInputConfig`/`monthInputConfig`/`yearInputConfig` bags do the same thing, and still win, because all of
them are applied after construction.

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

| Method                    | Description                                                        |
| ------------------------- | ------------------------------------------------------------------ |
| `class(className)`        | CSS class(es) for the control                                      |
| `id(id)`                  | ID for the control                                                 |
| `name(name)`              | Name attribute                                                     |
| `labelClass(className)`   | CSS class(es) for the label                                        |
| `labelAfter(htmlString)`  | HTML to append after label text                                    |
| `wrapper(bag \| tagName)` | Wrapper element — `{ as, class, id }` or a bare `'div'`/`'td'`     |
| `wrapperClass(className)` | CSS class(es) for wrapper                                          |
| `disabled(disabled=true)` | Set disabled state                                                 |
| `data(dataMap)`           | Set data attributes                                                |
| `defaultValue(value)`     | Set initial/default value                                          |
| `value(val?)`             | Get or set current value; with argument sets value, returns `this` |
| `options()`               | Returns array of option values (for select elements only)          |
| `hide()`                  | Hide the control — `_acceptHeaderInput` only, and not reversible   |

### The wrapper bag

`wrapper()` takes the same `{ as, class, id }` bag `CalendarSelect.wrapper()` and `RiteSelect.wrapper()`
take, validated by the same shared helper, so one call does what previously took two:

```javascript
apiOptions._yearInput.wrapper({
    as: 'div', // 'div' (default) or 'td'
    class: 'form-group col col-md-3',
    id: 'year-wrapper', // not available before 2.6.0, and not available on the globals
});
```

The bare tag name it has always taken still works — `wrapper('td')` is `wrapper({ as: 'td' })` — so
existing code needs no change, and `wrapperClass()` remains for callers already using it.

**`id` is per-instance only.** `setGlobalWrapper()` deliberately takes no `id`: the globals apply to every
`Input` a page builds, and `ApiOptions` alone builds more than a dozen, so one global id would be stamped
onto every wrapper and emit invalid HTML with duplicate ids.

**`wrapper()` may be called once.** A second call throws. Previously it silently replaced the element and
reset its class to the _global_ wrapper class, so a class set through `wrapperClass()` was discarded without
a word and the next `wrapperClass()` call threw an error naming a class the caller had never set:

```javascript
input.wrapperClass('form-group col-md-3'); // ok
input.wrapper('div'); // before 2.6.0: silently discarded that class
input.wrapperClass('form-group col-md-3'); // before 2.6.0: threw, naming the global class
```

`setGlobalWrapper()` does not consume that one allowance. It makes the _constructor_ build a wrapper, which
is not the caller's own, so a page that sets the global still gets one per-instance `wrapper()` call.

A `class` named in the bag beats `setGlobalWrapperClass()` and counts as the class being set, so a later
`wrapperClass()` naming something different throws. A bag naming no class still inherits the global one and
leaves `wrapperClass()` free — the pairing pages built on the globals rely on.

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

### Linking a RiteSelect

`linkToRiteSelect()` drives the rite -> calendar chain alongside the calendar link (see
[RiteSelect](rite-select.md)). It is chainable, and may be called before or after
`linkToCalendarSelect()` — whichever arrives second completes the pairing:

```javascript
import { ApiOptions, CalendarSelect, RiteSelect, CalendarSelectFilter } from '@liturgical-calendar/components-js';

const riteSelect    = new RiteSelect('en-US');
const nationSelect  = new CalendarSelect('en-US').filter(CalendarSelectFilter.NATIONAL_CALENDARS);
const dioceseSelect = new CalendarSelect('en-US').filter(CalendarSelectFilter.DIOCESAN_CALENDARS);

const apiOptions = new ApiOptions('en-US')
    .linkToCalendarSelect([nationSelect, dioceseSelect])
    .linkToRiteSelect(riteSelect);
```

> **Deprecated:** passing the `RiteSelect` as a second argument to `linkToCalendarSelect()` does the same
> thing and still works, but warns. It reads as though it wires the rite completely, when in fact a
> fetching page must also call `apiClient.listenTo(riteSelect)` — only the client turns the rite into a
> path segment. Use `linkToRiteSelect()`, so each wiring step is its own call.

`linkToCalendarSelect()` accepts either a single `CalendarSelect` or a `[nationSelect, dioceseSelect]`
pair, exactly as without a `RiteSelect`. Once a rite select is linked, `ApiOptions` takes over the whole
rite -> calendar chain on every rite change:

- The linked `CalendarSelect`(s) are rebuilt for the selected rite, and the calendar selection is reset
- A linked nation select is hidden for rites with no national tier (e.g. Ambrosian)
- `_epiphanyInput`, `_ascensionInput`, `_corpusChristiInput` and `_eternalHighPriestInput` are disabled
  for rites that fix their own temporal cycle
- `_yearInput`'s minimum year is adjusted to the rite's floor

When a `RiteSelect` is linked, the resulting request path also spells out the rite explicitly, even for
the Roman rite (`/calendar/roman/...` instead of `/calendar/...`) — both forms request the same thing.
Without a `RiteSelect`, paths are unaffected and stay in the shorter form.

`riteSelect` must be `null` (the default) or an instance of `RiteSelect`; passing anything else throws.

## Example: Bootstrap Styling

```javascript
import { ApiClient, ApiOptions, Input } from '@liturgical-calendar/components-js';

ApiClient.init('http://localhost:8000').then((apiClient) => {
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
}).catch((error) => {
    console.error(`Could not reach the API at ${error.url ?? 'the configured base'}: ${error.message}`);
});
```
