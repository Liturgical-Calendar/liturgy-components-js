# liturgy-components-js
This component library for the Liturgical Calendar API is a collection of reusable frontend components, that work with the Liturgical Calendar API (currently hosted at https://litcal.johnromanodorazio.com/api/dev/).

You can also use a local instance of the API by passing in the url for your local API instance to the `ApiClient` class static `init()` method.

The components library is written as an ES6 module, so it can be imported using ES6 import statements.

## Installation

The `liturgy-components-js` component library can be used directly from a CDN (recommended), or you can install it locally in your project folder.

To install the `liturgy-components-js` component library locally, run one of the following commands in your project folder, according to your package manager:

```console
yarn add liturgy-components-js
```

or

```console
npm install liturgy-components-js
```

or

```console
pnpm add liturgy-components-js
```

## Usage

In order to use ES6 import statements without a build step in your project, your project's script file must be set to `type="module"` in the script tag in the HTML file that is including your script.

Example:

```html
<!-- myPage.html -->
<script type="module" src="myScript.js"></script>
```

If you are using __npm__ or __yarn v1__ or __pnpm__, the component library will be installed into the `node_modules` folder. Or if you are using __yarn v2__ or greater, and you have set either `nodeLinker:node_modules` or `nodeLinker:pnpm` in your project's `.yarnrc.yml`, the component library will be installed into the `node_modules` folder. The path is predictable, it will be simply `./node_modules/liturgy-components-js/dist/index.js`.

If instead you are using __yarn v2__ or greater with the default `pnp` node linker, the component library will be installed into the `.yarn/unplugged` folder. There is no direct way for the browser to detect the path to the installed component library within the `.yarn/unplugged` folder.

In either case, it can be helpful to define an `importmap` to assist the browser in finding the component library:

```json
// importmap.json (when component is installed to node_modules)
{
    "imports": {
        "liturgy-components-js": "./node_modules/liturgy-components-js/dist/index.js"
    }
}

// importmap.json (when component is installed to .yarn/unplugged)
// In this case, you have to manually check the path to the component library
// within the `.yarn/unplugged` folder, it should look something like this:
{
    "imports": {
        "liturgy-components-js": "./.yarn/unplugged/liturgy-components-js-file-764297067f/node_modules/liturgy-components-js/dist/index.js"
    }
}
// You will have to update the path in the importmap every time you update the component library
```

Then you can load the `importmap` before loading your `module` type script:

```html
<!-- myPage.html -->
<script type="importmap" src="importmap.json"></script>
<script type="module" src="myScript.js"></script>
```

With the `importmap` in place, you can now import the component library using ES6 import statements in your script file, without having to transpile or use any build tools, and without having to use folder paths in your import statements:
```javascript
//myScript.js
import { CalendarSelect } from 'liturgy-components-js';
```

By far the easiest way to use ES Modules in the browser is by importing from a CDN rather than pulling in locally via `yarn`, `npm`, or `pnpm`.

## Components

The Liturgical Calendar Components library `index.js` exports the following components and enums:
```javascript
export {
    ApiClient,
    CalendarSelect,
    ApiOptions,
    WebCalendar,
    LiturgyOfTheDay,
    Input,
    Grouping,
    ColorAs,
    Column,
    ColumnOrder,
    DateFormat,
    GradeDisplay,
    ApiOptionsFilter,
    CalendarSelectFilter,
    YearType
}
```

The first five are the main components of the library, and can be instantiated.

The remaining classes are used either as static classes (`Input`) or as Enums, to configure the `ApiOptions`, `WebCalendar` and `LiturgyOfTheDay` components.

### ApiClient

The `ApiClient` is not a UI component, but rather takes care of fetching data from the Liturgical Calendar API based on interactions with the UI components and providing the fetched data to the UI components.

The `ApiClient` must be statically initialized before any UI components can be used, since the UI components depend on the data provided by the ApiClient. By default, the `ApiClient` will initialize itself with the API URL at https://litcal.johnromanodorazio.com/api/dev/, but you can provide a different API URL, whether local or remote, by passing the url as a parameter to the `ApiClient.init()` method.

The `ApiClient.init()` method returns a promise that resolves when the metadata about available liturgical calendars has been fetched from the API. The promise will resolve to an instance of the `ApiClient` class if successful, or to false if an error occurs.

Example:

```javascript
import { ApiClient } from 'liturgy-components-js';

// Initialize the ApiClient with a local API URL
ApiClient.init('http://localhost:8000').then((apiClient) => {
    if (apiClient instanceof ApiClient) {
        // continue creating and configuring your UI components here
    }
});

// Initialize the ApiClient with the default remote API URL
ApiClient.init().then((apiClient) => {
    if (apiClient instanceof ApiClient) {
        // continue creating and configuring your UI components here
    }
});
```

Instances of the `ApiClient` can be configured to listen to changes in instances of the `CalendarSelect` and `ApiOptions` components.

Example:

```javascript
import { ApiClient } from 'liturgy-components-js';

// Initialize the ApiClient with a local API URL
ApiClient.init('http://localhost:8000').then((apiClient) => {
    if (apiClient instanceof ApiClient) {
        const calendarSelect = new CalendarSelect();
        const apiOptions = new ApiOptions();
        apiClient.listenTo(calendarSelect).listenTo(apiOptions);
    }
});
```

Then every time a new calendar is selected from the Calendar Select dropdown, the API Client will fetch the calendar data from the API. And every time a new API option is selected from the API Options form, the API Client will fetch the new calendar data from the API and emit an internal `calendarFetched` event that a `WebCalendar` component instance can listen to.

It is also possible to directly fetch calendar data from the API without listening to UI components, by calling one of the following publicly exposed instance methods:

* `apiClient.fetchCalendar()`: will fetch the General Roman Calendar with default options (as used in the Vatican)
* `apiClient.fetchNationalCalendar(calendar_id)`: will fetch a National Calendar by its ID
* `apiClient.fetchDiocesanCalendar(calendar_id)`: will fetch a Diocesan Calendar by its ID
* `apiClient.refetchCalendarData()`: will fetch the calendar data based on the current category and calendar ID (for an example of usage, see the `LiturgyOfTheDay` component)

Example:

```javascript
import { ApiClient } from 'liturgy-components-js';

// Initialize the ApiClient with a local API URL, and fetch the the Liturgical Calendar for Italy for the current liturgical year
ApiClient.init('http://localhost:8000').then((apiClient) => {
    if (apiClient instanceof ApiClient) {
        // instantiate a WebCalendar instance here, and set it to listen to the apiClient instance, then:
        apiClient.fetchNationalCalendar('IT');
    }
});

// Initialize the ApiClient with a local API URL, and fetch Diocesan Calendar for the Diocese of Rome for the current liturgical year
ApiClient.init('http://localhost:8000').then((apiClient) => {
    if (apiClient instanceof ApiClient) {
        // instantiate a WebCalendar instance here, and set it to listen to the apiClient instance, then:
        apiClient.fetchDiocesanCalendar('romamo_it');
    }
});
```

While the `ApiClient` component will generally be used in conjunction with UI components, it may however be useful to set the Year or the YearType parameters directly, without having to depend on interactions with the UI components. For this reason the following chainable instance methods are also provided:
* `setYear(year)`: will set the year parameter to the given year
* `setYearType(yearType)`: will set the yearType parameter to the given yearType (you can import the `YearType` enum to assist with this)

The `ApiClient` class exposes the following static readonly class properties:
* `_apiUrl`: the API URL that is being used by the `ApiClient` class
* `_metadata`: the metadata about available liturgical calendars that has been fetched from the API

And `ApiClient` instances expose the following readonly instance properties:
* `_eventBus`: an instance of the `EventEmitter` class, so as to inspect the events emitted by the `ApiClient` instance
* `_calendarData`: the JSON data representing the latest fetched calendar data from the API

### CalendarSelect

The CalendarSelect is a JavaScript class that generates a select element populated with available liturgical calendars from the Liturgical Calendar API. It allows you to easily add a liturgical calendar selector to your website.

In order to populate the select element with the current available liturgical calendars, whether national or diocesan, the `ApiClient` class must be statically initialized before instantiating the `CalendarSelect` class.

The `CalendarSelect` class can be instantiated with a `locale` parameter, which will determine the localization for the UI elements (display names of the nations for national calendars).
The default is 'en' (English). Locales with region extensions are also supported, such as 'en-US', 'en-GB', 'en-CA', etc. If the locale has underscores (as is the case with PHP locales), they will be replaced with hyphens.

By default, a `CalendarSelect` instance will be populated with all available national and diocesan calendars (grouped by nation).

It is also possible to filter the options in the select element to only include national calendars or diocesan calendars, by calling the `filter()` method and passing in a value of either `CalendarSelectFilter.NATIONAL_CALENDARS` or `CalendarSelectFilter.DIOCESAN_CALENDARS`.

Example:
```javascript
import { CalendarSelect, CalendarSelectFilter } from 'liturgy-components-js';
const calendarSelect = new CalendarSelect( 'en-US' );
calendarSelect.filter(CalendarSelectFilter.DIOCESAN_CALENDARS).appendTo( '#calendarOptions');
```

The `CalendarSelect` instance is inserted into the DOM by calling the `appendTo(elementSelector)` method, and passing the CSS selector for the element to which the select element should be appended.

All of the `CalendarSelect` configuration methods are chainable, except for the `appendTo()` method which must be called at the end of the chain.

Example:
```javascript
const calendarSelect = new CalendarSelect( 'en-US' );
calendarSelect.allowNull()
    .class('form-select')
    .label({
        class: 'form-label d-block mb-1'
    }).wrapper({
        class: 'form-group col col-md-3'
    }).appendTo( '#calendarOptions');
```

The following chainable configuration methods are available on the `CalendarSelect` instance:
* `class( className )`: sets the class or classes to apply to the select element
* `id( id )`: sets the id to apply to the select element (without an initial '#')
* `name( name )`: sets the name to apply to the select element (usually the same as the id, not very useful since we probably won't be submitting the form)
* `label( options )`: configures the <kbd>\<label\></kbd> element for the select element. The options object can have the following properties:
    * `class`: the class to apply to the label element
    * `id`: the id to apply to the label element
    * `text`: the text to use for the label element (default is __'Select a calendar'__)
* `wrapper( options )`: configures a wrapper element, which the select element will be wrapped in. The options object can have the following properties:
    * `as`: the tag name to use for the wrapper element (can be either __'div'__ or __'td'__, default is __'div'__)
    * `class`: the class to apply to the wrapper element
    * `id`: the id to apply to the wrapper element
* `disabled( disabled = true )`: sets the `disabled` attribute on the select element based on the boolean value passed in
* `filter(filter)`: filters the options in the select element to only include national calendars or diocesan calendars. The filter can have a value of either __`CalendarSelectFilter.NATIONAL_CALENDARS`__ or __`CalendarSelectFilter.DIOCESAN_CALENDARS`__ or __`CalendarSelectFilter.NONE`__.
* `allowNull( allowNull = true )`: sets whether the select element should include an empty option as the first option. If this method is not called, the default is false; if it is called without a parameter, the default is true. Otherwise, the method will take a boolean parameter to set whether the select element should include an empty option as the first option. An empty option corresponds with the General Roman Calendar for the API, since no national or diocesan calendar is selected.
* `after( htmlString )`: allows to insert HTML content after the select element, for example to add a description below the select element. The HTML content must be a string, and the string is sanitized and stripped of any PHP or JavaScript script tags.
* `linkToNationsSelect( calendarSelectInstance )`: in case the current `CalendarSelect` instance has the `CalendarSelectFilter.DIOCESAN_CALENDARS` filter applied, this method can be used to link the current CalendarSelect instance to a `CalendarSelectFilter.NATIONAL_CALENDARS` filtered CalendarSelect instance, so that the diocese options of the current CalendarSelect instance will be filtered according to the selected nation in the linked CalendarSelect instance.

All of the above stated methods can only be called once on the `CalendarSelect` instance. They are however idempotent, so if called multiple times with the same value no error will be thrown. If however you attempt to call them multiple times with different values, an error will be thrown.

And as previously stated, the following non chainable methods are available on the `CalendarSelect` instance, and so should be the last method of the chain:
* `appendTo(elementSelector)`: inserts the select element into the DOM, by passing the CSS selector for the element to which the select element should be appended. This must be a valid CSS selector, and the relative element must exist in the DOM, otherwise an error will be thrown.
* `replace(elementSelector)`: similar to the `appendTo()` method, but instead of being appended to the specified element, it will replace the specified element with the select element.

Once either of the two above non chainable methods are called, the `CalendarSelect` instance can no longer be configured using the chainable configuration methods.

The `CalendarSelect` instances expose the following readonly instance properties:
* `_domElement`: the underlying DOM element of the `CalendarSelect` instance
* `_filter`: the current filter applied to the `CalendarSelect` instance, if any. If none is applied, the value should be __'none'__ (which is the underlying value of `CalendarSelectFilter.NONE`).

### ApiOptions

The `ApiOptions` class is a JavaScript class that generates form controls for the Liturgical Calendar API options. It allows you to easily add an options form to your website, alongside a `CalendarSelect` widget.

The `ApiOptions` class can be instantiated with a `locale` parameter, which will determine the localization for the UI elements (such as values in the select dropdowns).

The `ApiOptions` class will instantiate eight form controls, four of which are only useful for the General Roman Calendar, while the other four are useful for any calendar, whether General Roman or National or Diocesan. Most applications will only find use for the first four form controls as follows, which are useful for any calendar.

#### Form controls useful for any calendar
* `_yearInput`: a number input for the calendar year
* `_yearTypeInput`: a select input with options for the type of year to produce, whether liturgical or civil
* `_localeInput`: a select input with options for the locale to use for the calendar response from the API
* `_acceptHeaderInput`: a select input with options for the Accept header to use for the calendar response from the API

#### Form controls useful only for the General Roman Calendar
These four form controls are useful when producing a liturgical calendar for a geographical area, when the national or diocesan data is not yet available in the API.

They allow to tweak parameters that the national or diocesan calendar would otherwise set, such as the date of the Epiphany, the date of the Ascension, the date of Corpus Christi, and whether the Eternal High Priest is celebrated.
* `_epiphanyInput`: a select input with options for when the Epiphany is celebrated
* `_ascensionInput`: a select input with options for when the Ascension is celebrated
* `_corpusChristiInput`: a select input with options for when Corpus Christi is celebrated
* `_eternalHighPriestInput`: a select input with options for whether the Eternal High Priest is celebrated

#### Filtering the form controls
The `ApiOptions` instance is inserted into the DOM by calling the non chainable `appendTo(elementSelector, inputsFilter=ApiOptionsFilter.NONE)` method, and passing the CSS selector for the element to which the form should be appended. You can optionally pass a second `inputsFilter` parameter to specify which form controls should be appended. The `inputsFilter` parameter can have a value of either __`ApiOptionsFilter.GENERAL_ROMAN`__ or __`ApiOptionsFilter.ALL_CALENDARS`__. If no inputs filter is passed, the default is __`ApiOptionsFilter.NONE`__ (which means all possible form controls will be appended). This can be useful if you're only interested in dealing with National or Diocesan liturgical calendars, and have no need for the tweakable options that only apply to the General Roman Calendar: in this case you would pass in an `inputsFilter` of __`OptionsFilter.ALL_CALENDARS`__. Whereas only the form controls that are useful only for the General Roman Calendar can be appended by passing an `inputsFilter` of __`ApiOptionsFilter.GENERAL_ROMAN`__.

Example:
```javascript
import { ApiOptions, ApiOptionsFilter } from 'liturgical-calendar-js';
const apiOptions = new ApiOptions( 'en-US' );
apiOptions.appendTo( '#calendarOptions', ApiOptionsFilter.ALL_CALENDARS);
```

#### Configuring the form controls
All of the form controls produced by the `ApiOptions` class inherit from a common `Input` class, and can be configured globally to have the same classes or wrapper elements. This can be accomplished with the following static class methods:
* `Input.setGlobalInputClass(className)`: a space separated string of class names to be assigned globally to each form control element
* `Input.setGlobalLabelClass(className)`: a space separated string of class names to be assigned globally to each form label element
* `Input.setGlobalWrapper(element)`: the tag name of the wrapper element that will wrap each form control element, currently only values of __'div'__ and __'td'__ are supported
* `Input.setGlobalWrapperClass(className)`: a space separated string of class names to be assigned globally to each wrapper element

For this very reason, the `Input` class is also exported by the `liturgy-components-js` package's main `dist/index.js`. The `Input` class is not meant to be instantiated, but rather used statically to simplify the global configuration of the form controls produced by the `ApiOptions` class.

Other than the global configurations, each individual form control can be configured using the following chainable configuration methods on the single form control instances:
* `class( className )`: sets the class or classes to apply to the form control element
* `id( id )`: sets the id to apply to the form control element (without an initial '#')
* `name( name )`: sets the name to apply to the form control element (usually the same as the id, not very useful since we probably won't be submitting the form)
* `labelClass( className )`: sets the class or classes to apply to the form label element
* `labelAfter( htmlString )`: an HTML string to append to the form label element, after the label text. The string is sanitized and stripped of any PHP or JavaScript script tags.
* `wrapper( tagName )`: configures a wrapper element, which the form control element will be wrapped in. The tag name can have a value of either __'div'__ or __'td'__.
* `wrapperClass( className )`: sets the class or classes to apply to the wrapper element
* `disabled( disabled = true )`: sets the `disabled` attribute on the form control element based on the boolean value passed in
* `data( data )`: the `data` parameter is a map of `key` => `value` pairs that represent the data attributes to be set on the form control element. The `key` is the data attribute name (without the initial `data-`), and the `value` is the data attribute value.
* `defaultValue(value)`: sets the default value to apply to the form control element.

Let's say we are using `bootstrap` to theme our UI interface, and we want to style the form controls with `bootstrap` classes. All of the form controls produced by the `ApiOptions` class are <kbd>\<select\></kbd> elements except for the `_yearInput` element which is an <kbd>\<input[type="number"]\></kbd> element. We we might want to apply a class of `form-select` globally to all form controls, but apply a class of `form-control` to the `_yearInput` form control.

Example:
```javascript
import { ApiOptions, Input } from "liturgy-components-js";

ApiClient.init('http://localhost:8000').then((apiClient) => {
    if (apiClient instanceof ApiClient) {
        Input.setGlobalInputClass('form-select');
        Input.setGlobalLabelClass('form-label d-block mb-1');
        Input.setGlobalWrapper('div');
        Input.setGlobalWrapperClass('form-group col col-md-3');

        const apiOptions = new ApiOptions( 'en-US' );
        apiOptions._yearInput.class( 'form-control' ); // override the global input class
        apiOptions._acceptHeaderInput.hide(); // prevent the Accept headerform control from being appended to the form
        apiOptions.appendTo( '#calendarOptions' ); // append the form controls to the #calendarOptions DOM element
    }
});
```

In most cases, we will only be requesting JSON data from the API, so we will not need the `_acceptHeaderInput` form control. The `_acceptHeaderInput` provides a chainable `hide(hide = true)` method which will prevent the form control from being appended to the form.

#### Dynamically updating the form controls based on selected calendar
We can also set our `ApiOptions` instance to "listen" to a `CalendarSelect` instance. This will allow us to dynamically update the form controls based on the selected calendar.

Example:
```javascript
const calendarSelect = new CalendarSelect( 'en-US' );
const apiOptions = new ApiOptions( 'en-US' );
calendarSelect.appendTo( '#calendarOptions' )
apiOptions.linkToCalendarSelect( calendarSelect ).appendTo( '#calendarOptions' );
```

Once the `ApiOptions` instance is linked to a `CalendarSelect` instance, the form controls will be dynamically updated based on the selected calendar:
* The selected calendar's settings will be used to populate the `_epiphanyInput`, `_ascensionInput`, `_corpusChristiInput`, and `_eternalHighPriestInput` select elements, and these will be disabled
* The options for the `_localeInput` select element will be filtered according to the selected calendar

### WebCalendar

The WebCalendar class is a JavaScript class that generates a Liturgical Calendar in an HTML table element.

The WebCalendar class instances provide a number of chainable methods to configure the Liturgical Calendar, such as:
* `id( id )`: sets the id to apply to the table element (without an initial '#')
* `class( className )`: sets the class or classes to apply to the table element
* `firstColumnGrouping( grouping )`: sets the grouping for the first column of the table, can be either `Grouping.BY_MONTH` or `Grouping.BY_LITURGICAL_SEASON` (the `Grouping` enum can be imported from the `liturgy-components-js` package)
* `psalterWeekColumn( boolVal=true )`: whether to show the psalter week column as the right hand most column of the table (psalter week values are grouped by default when enabled)
* `removeHeaderRow( boolVal=true )`: if we want to hide the header row
* `removeCaption( boolVal=true )`: if we want to hide the table caption
* `monthHeader( boolVal=true )`: if we want to enable a month header row at the start of each month
* `seasonColor(ColorAs.CSS_CLASS)`: sets how the color of a liturgical season is applied to the table, whether as a CSS class, an inline style, or a small colored circle (you can import the `ColorAs` enum to assist with these values: `ColorAs.CSS_CLASS`, `ColorAs.BACKGROUND`, `ColorAs.INDICATOR`, `ColorAs.NONE`)
* `seasonColorColumns(Column.LITURGICAL_SEASON)`: sets which columns should be affected by the `seasonColor` settings. You can import the `Column` enum to assist with these values: `Column.LITURGICAL_SEASON`, `Column.MONTH`, `Column.DATE`, `Column.EVENT_DETAILS`, `Column.GRADE`, `Column.PSALTER_WEEK`, `Column.ALL`, `Column.NONE`. Aside from `Column.ALL` and `Column.NONE`, the other column values are bitfield values, so they can be combined with a bitwise OR operator `|`.
* `eventColor(ColorAs.INDICATOR)`: sets how the color of the liturgical event is applied to the table (import the `ColorAs` enum to assist with these values: `ColorAs.CSS_CLASS`, `ColorAs.BACKGROUND`, `ColorAs.INDICATOR`, `ColorAs.NONE`)
* `eventColorColumns(Column.EVENT_DETAILS)`: sets which columns should be affected by the `eventColor` settings. You can import the `Column` enum to assist with these values, see the `seasonColorColumns()` method above for usage of the `Column` enum cases
* `dateFormat(DateFormat.DAY_ONLY)`: sets how the date should be displayed in the Date column. You can import the `DateFormat` enum to assist with these values: `DateFormat.FULL`, `DateFormat.LONG`, `DateFormat.MEDIUM`, `DateFormat.SHORT`, `DateFormat.DAY_ONLY`. Values of `FULL`, `LONG`, `MEDIUM` and `SHORT` correspond with the values that can be set on the `dateStyle` parameter of an `Intl.DateTimeFormat` instance, whereas `DAY_ONLY` will display only the day of the month and the weekday
* `columnOrder(ColumnOrder.GRADE_FIRST)`: whether the event details column should come before the liturgical grade column. You can import the `ColumnOrder` enum to assist with these values: `ColumnOrder.GRADE_FIRST`, `ColumnOrder.EVENT_DETAILS_FIRST`.
* `gradeDisplay(GradeDisplay.ABBREVIATED)`: whether the liturgical grade should be displayed in full or abbreviated form. You can import the `GradeDisplay` enum to assist with these values: `GradeDisplay.FULL`, `GradeDisplay.ABBREVIATED`.
* `attachTo( elementSelector )`: the selector for the DOM element in which the web calendar will be rendered, every time the calendar is updated
* `listenTo( apiClient )`: the `WebCalendar` instance will listen to the `calendarFetched` event emitted by the `ApiClient` instance, and update the calendar when the event is triggered. If the `ApiClient` instance is configured to listen to the `CalendarSelect` instance, the `WebCalendar` instance will dynamically update the calendar based on the selected calendar; if it is configured to listen to the `ApiOptions` instance, the `WebCalendar` instance will dynamically update the calendar based on the selected options.

Example:
```javascript
const apiClient = new ApiClient( 'en-US' );
const webCalendar = new WebCalendar();
webCalendar.listenTo( apiClient ).attachTo( '#litcalWebcalendar' );
```

For a full working example of a __Web Calendar component__ listening to an __API Client component__, which in turn is listening to __Calendar Select__ and __API Options__ components, see the `examples/WebCalendar` folder in the current repository.

This example also demonstrates how to style the calendar events based on liturgical grade. The `WebCalendar` component adds a number of CSS classes to the single table elements, and these classes also reflect the liturgical grade. This allows us to style an event or elements of the event differently based on liturgical grade.

### LiturgyOfTheDay

The LiturgyOfTheDay class is a JavaScript class that generates a widget for the Liturgy of the Day.

Instances of the LiturgyOfTheDay component can be instantiated with a locale code, which will determine the localization for the UI elements (title, date string).

The LiturgyOfTheDay class instances provide a few chainable methods to configure the Liturgy of the Day components, such as:
* `id( id )`: sets the id to apply to the widget element (without an initial '#')
* `class( className )`: sets the class or classes to apply to the widget DOM element
* `titleClass( className )`: sets the class or classes to apply to the title DOM element
* `dateClass( className )`: sets the class or classes to apply to the date string DOM element
* `eventsWrapperClass( className )`: sets the class or classes to apply to the events wrapper DOM element
* `eventClass( className )`: sets the class or classes to apply to the events DOM elements
* `eventGradeClass( className )`: sets the class or classes to apply to the liturgical grade DOM elements
* `eventYearCycleClass( className )`: sets the class or classes to apply to the liturgical year cycle DOM elements
* `listenTo( apiClient )`: the `LiturgyOfTheDay` instance will listen to the `calendarFetched` event emitted by the `ApiClient` instance, and update the calendar when the event is triggered

The class instance also provides these two non chainable methods:
* `appendTo( elementSelector )`: the selector for the DOM element in which the Liturgy of the Day widget will be rendered
* `replace( elementSelector )`: similar to the `appendTo()` method, but instead of being appended to the specified element, it will replace the specified element with the Liturgy of the Day widget, similarly to how many jQuery plugins work.

Example:
```javascript
import { ApiClient, LiturgyOfTheDay } from 'liturgy-components-js';

const now = new Date();
const dateToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

ApiClient.init('http://localhost:8000').then(apiClient => {
    if (false === apiClient || false === apiClient instanceof ApiClient) {
        alert('Error initializing the Liturgical Calendar API Client');
    } else {
        const liturgyOfTheDay = new LiturgyOfTheDay('it-IT');
        liturgyOfTheDay.id('LiturgyOfTheDay')
            .class('liturgy-of-the-day')
            .titleClass('liturgy-of-the-day-title')
            .dateClass('liturgy-of-the-day-date')
            .eventsWrapperClass('liturgy-of-the-day-events-wrapper')
            .eventClass('liturgy-of-the-day-event p-4 mt-4 border rounded')
            .listenTo(apiClient)
            .replace('#liturgyOfTheDay');

        apiClient.fetchDiocesanCalendar('romamo_it');
    }
});
```

There is one limitation in this simple example. By default a `year_type` of `LITURGICAL` is fetched from the API.
Let's assume the current year is 2024.
For the current year 2024, the ApiClient instance will fetch events from the First Sunday of Advent 2023, to Saturday of the 34th week of Ordinary Time 2024.
This means that it will not show the Vigil Mass for the First Sunday of Advent 2024, which is on Saturday of the 34th week of Ordinary Time 2024.
Nor will it show any events from the First Sunday of Advent 2024 until the end of the Civil year on December 31st 2024.

In order to see the Vigil Mass for the First Sunday of Advent 2024, you would need to detect whether the today's date is greater than or equal to Saturday of the 34th week of Ordinary Time 2023, and less than Monday of the First week of Advent 2024. If so, you will need to fetch a `year_type` of `CIVIL` for the year 2024.

If instead the today's date is greater than or equal to Monday of the First week of Advent 2024, and less than or equal to Dec 31st 2024, you will need to fetch a `year_type` of `LITURGICAL` while adding a year to the current year.

In order to accomplish this, we need to do some date calculations, based on the calendar data fetched the first time around. Then we can use the `apiClient.setYearType( yearType )` method to programmatically set the `year_type` parameter for the request to the API, and the `apiClient.setYear( year )` method to programmatically set the `year` parameter for the request to the API, and then use the `apiClient.refetchCalendarData()` method to refetch the calendar data.

This however is a little tricky, because we might wind up creating an infinite loop of refetched data. So we would also have to keep track of whether we have already refetched the calendar data or not. For a full working example, see the `examples/LiturgyOfTheDay` folder in the current repository.
