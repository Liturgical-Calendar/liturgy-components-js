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

The `apiClient` option binds the form to that client's API base, which is where `localeInput` reads the
supported locales from. Omitting it binds to the first base initialized, and warns once if more than one is
registered. See [Using two API bases on one page](api-client.md#api-bases).

## Form Controls

The `ApiOptions` class creates ten form controls, each exposed as a read-only property. Reaching into them is
the expected way to customize an individual control — set a default, hide one, restyle one, or read what the
user chose.

Every one of the ten also answers to its name with a leading underscore (`_localeInput`, `_yearInput`, …),
which is the only spelling releases up to 2.7.0 offered. **Those aliases are supported and are not going
away**, and they emit no deprecation warning; the non-underscore name is simply the canonical spelling, and
the one this documentation uses from here on. Nothing needs migrating.

> **Why both.** The underscore prefix conventionally announces "private, do not touch", which is the opposite
> of what these are. An automated reviewer reading it at face value once recommended replacing five working
> uses with "the corresponding public accessors" — accessors that did not then exist ([#62]). Adding the
> canonical names fixed that without breaking a single existing page.

[#62]: https://github.com/Liturgical-Calendar/liturgy-components-js/issues/62

### Universal Form Controls

These are useful for any calendar (General Roman, National, or Diocesan):

| Property            | Legacy alias         | Type         | Description                     |
| ------------------- | -------------------- | ------------ | ------------------------------- |
| `yearInput`         | `_yearInput`         | number input | Calendar year                   |
| `yearTypeInput`     | `_yearTypeInput`     | select       | Year type (liturgical or civil) |
| `localeInput`       | `_localeInput`       | select       | Locale for API response         |
| `acceptHeaderInput` | `_acceptHeaderInput` | select       | Accept header format            |

### General Roman Calendar Controls

These fine-tune the General Roman Calendar when national/diocesan data is not requested:

| Property                    | Legacy alias                 | Type   | Description                               |
| --------------------------- | ---------------------------- | ------ | ----------------------------------------- |
| `epiphanyInput`             | `_epiphanyInput`             | select | When Epiphany is celebrated               |
| `ascensionInput`            | `_ascensionInput`            | select | When Ascension is celebrated              |
| `corpusChristiInput`        | `_corpusChristiInput`        | select | When Corpus Christi is celebrated         |
| `eternalHighPriestInput`    | `_eternalHighPriestInput`    | select | Whether Eternal High Priest is celebrated |
| `holydaysOfObligationInput` | `_holydaysOfObligationInput` | select | Holy Days of Obligation settings          |

### Path Builder Control

| Property            | Legacy alias         | Type   | Description      |
| ------------------- | -------------------- | ------ | ---------------- |
| `calendarPathInput` | `_calendarPathInput` | select | API request path |

### Accessors that are NOT public

Four accessors keep the underscore and have no canonical form, because they really are package-internal. On
`ApiOptions`, that is now what the prefix means.

- **`_base`** — the `ApiBase` this form reads its metadata from. `PathBuilder` uses it to check that the form
  and the `CalendarSelect` beside it are bound to the same API.
- **`_currentEndpoint`** — returned by reference precisely so `PathBuilder` can mutate it. A mutable internal
  is not something to hand out.
- **`_filtersSet`** — the filters applied so far, in order. Nothing outside the class reads it.
- **`_filter`** — the current filter. Nothing outside the class reads it either, and it could not have been
  aliased in any case: `filter()` is already the chainable setter method, so a `get filter()` in the same
  class body would replace it. If you need to read the current filter, open an issue for `currentFilter`.

### Input labels

Each control localizes its own `<label>` from the locale the `ApiOptions` was constructed with, so
`new ApiOptions( 'it' )` renders Italian labels with no meta-component and no theming involved. Before #59
these labels were the raw snake_case API parameter names (`year_type`, `epiphany`, …) in every language,
which is what a screen reader announced for the control.

| Control                     | `Messages` key           |
| --------------------------- | ------------------------ |
| `yearInput`                 | `YEAR`                   |
| `yearTypeInput`             | `YEAR_TYPE`              |
| `localeInput`               | `LANGUAGE`               |
| `epiphanyInput`             | `EPIPHANY`               |
| `ascensionInput`            | `ASCENSION`              |
| `corpusChristiInput`        | `CORPUS_CHRISTI`         |
| `eternalHighPriestInput`    | `ETERNAL_HIGH_PRIEST`    |
| `holydaysOfObligationInput` | `HOLYDAYS_OF_OBLIGATION` |

`LiturgyOfAnyDay`'s own date controls follow the same rule, keyed `DAY`, `MONTH` and `YEAR`.

Nine of these ten keys are carried by only twelve of `Messages.js`' 84 locale blocks — the six newer ones
and the reused `DAY`, `YEAR` and `LANGUAGE` alike. Every other locale falls back to English for them rather
than throwing, through the internal `message( key, locale )` in `src/MessageLookup.js`. `MONTH` is the one
exception, present in all 84 because `WebCalendar` has long used it as a column header.

The controls' **option** text follows the same rule since #69. `epiphanyInput`, `yearTypeInput`,
`eternalHighPriestInput` and `calendarPathInput` used to read their option and route labels through an
unguarded `Messages[locale.language][KEY]`, which threw for any language with no block at all — and, because
`ApiOptions` builds every input in its constructor, took the whole page with it wherever an `ApiOptions` is
built. That is five of the six composed components: `CalendarControls` and `DayViewer` build one directly,
and `CalendarViewer`, `ApiExplorer` and `SubscriptionBuilder` inherit it through `CalendarControls`.
`CalendarResourcePicker` is the exception — it bundles only a `RiteSelect` and a `CalendarSelect`, and
references `ApiOptions` nowhere. There is no warning on the fallback: a block that lacks a key is the documented
normal case here, not an anomaly.

`acceptHeaderInput` is **not** localized — it still renders `return_type` or `Accept Header` — because it
takes no locale and its label flips at runtime in `asReturnTypeParam()`.

To override a label, assign to the control's `_labelElement` after construction:

```javascript
apiOptions.yearTypeInput._labelElement.textContent = 'Tipo de año';
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
apiOptions.yearInput
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
apiOptions.acceptHeaderInput.hide();
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
| `hide()`                  | Hide the control — `acceptHeaderInput` only, and not reversible    |

**`hide()` is read at append time**, by `ApiOptions.appendTo()`, so it must be called before the append.
On a bare `ApiOptions` that is simply the order to write it in. Inside `CalendarControls`, `CalendarViewer`
or `ApiExplorer` there is no such window on the `mountInto()` path, so those take the same instruction as
an option instead — `inputs: { acceptHeader: false }`; see
[the `inputs` bag](meta-components.md#the-inputs-bag).

### The wrapper bag

`wrapper()` takes the same `{ as, class, id }` bag `CalendarSelect.wrapper()` and `RiteSelect.wrapper()`
take, validated by the same shared helper, so one call does what previously took two:

```javascript
apiOptions.yearInput.wrapper({
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
- `epiphanyInput`, `ascensionInput`, `corpusChristiInput` and `eternalHighPriestInput` are disabled
  for rites that fix their own temporal cycle
- those same four inputs, and `holydaysOfObligationInput`, are **set** to the rite's own published
  settings — see below
- `yearInput`'s minimum year is adjusted to the rite's floor

When a `RiteSelect` is linked, the resulting request path also spells out the rite explicitly, even for
the Roman rite (`/calendar/roman/...` instead of `/calendar/...`) — both forms request the same thing.
Without a `RiteSelect`, paths are unaffected and stay in the shorter form.

#### A rite's own settings

`/calendars` publishes a `settings` block for a rite that has one — `ambrosian_calendars[0].settings`
carries `epiphany`, `ascension`, `corpus_christi`, `eternal_high_priest` and `holydays_of_obligation` —
and a rite change applies it, so the form states what the rite fixes rather than freezing at the values
the previously selected nation put there. The values come from the API, never from a table in the
library.

Two rules differ between the value inputs and the list input, deliberately:

| Input                                      | Rite publishes settings      | Rite publishes none                 |
| ------------------------------------------ | ---------------------------- | ----------------------------------- |
| `epiphanyInput` … `eternalHighPriestInput` | set to the published value   | left exactly as they are            |
| `holydaysOfObligationInput`                | options replaced by the list | options restored to the input's own |

The four are values drawn from a fixed list of options, so an unpublished rite has nothing to say about
them and leaving them untouched is the only non-destructive choice — the **Roman** rite is that case, on
every page, because the General Roman Calendar has no `roman_calendars` entry to publish anything under.
Holy days of obligation are an option **list** the rite defines, exactly as locales are, so they follow
the locale input's rule instead: narrow to what the rite publishes, restore the defaults when it
publishes none. Without that, an Ambrosian-only entry such as `StAmbrose` would survive a switch back to
the Roman rite and be offered — and requested — for the General Roman Calendar.

A published value the input has no `<option>` for is skipped rather than assigned, since assigning an
unmatched value to a `<select>` blanks it. Each input that actually moves dispatches `change`, so a
listening `ApiClient` sends the rite's values rather than the ones the user picked under the previous
rite; `ApiClient` coalesces the burst into a single refetch.

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
    apiOptions.yearInput.class('form-control');

    // Hide Accept header (usually only need JSON)
    apiOptions.acceptHeaderInput.hide();

    apiOptions.appendTo('#calendarOptions');
}).catch((error) => {
    console.error(`Could not reach the API at ${error.url ?? 'the configured base'}: ${error.message}`);
});
```
