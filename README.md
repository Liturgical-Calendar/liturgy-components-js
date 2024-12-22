# liturgy-components-js
This component library for the Liturgical Calendar API is a collection of reusable frontend components, that work with the Liturgical Calendar API (currently hosted at https://litcal.johnromanodorazio.com/api/dev/).

You can also use a local instance of the API by passing in the url for your local API instance to the `ApiClient` class upon instantiation.

The components library is written as an ES6 module, so it can be imported using ES6 import statements.

## Installation

The `liturgy-components-js` component library can be used directly from a CDN (recommended), or you can install it locally in your project folder.

To install the `liturgy-components-js` component library locally, run one of the following commands in your project folder, according to your package manager:

```bash
yarn add liturgy-components-js
```

or

```bash
npm install liturgy-components-js
```

or

```bash
pnpm add liturgy-components-js
```

## Usage

In order to use ES6 import statements without a build step in your project, your project's script file must be set to `type: module` either in your `package.json` file, or in the script tag of the HTML file that is including your script.

Example:

```html
<!-- myPage.html -->
<script type="module" src="myScript.js"></script>
```

or

```json
// package.json
{
    "main": "myScript.js",
    "type": "module"
}
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
// in this case, you have to manually check the path to the component library
// within the `.yarn/unplugged` folder, it should look something like this:
{
    "imports": {
        "liturgy-components-js": "./.yarn/unplugged/liturgy-components-js-file-764297067f/node_modules/liturgy-components-js/dist/index.js"
    }
}
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


## Components

The Liturgical Calendar Components library `index.js` exports the following components:
```javascript
export {
    ApiClient,
    CalendarSelect,
    ApiOptions,
    WebCalendar,
    Input,
    Grouping,
    ColorAs,
    Column,
    ColumnOrder,
    DateFormat,
    GradeDisplay,
    ApiOptionsFilter
}
```

The first four are the main components of the library.

The remaining components are classes that are used to configure the `ApiOptions` and `WebCalendar` components.

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

It is also possible to filter the options in the select element to only include national calendars or diocesan calendars, by calling the `filter()` method.

Example:
```javascript
const calendarSelect = new CalendarSelect( 'en-US' );
calendarSelect.filter('diocesan').appendTo( '#calendarOptions');
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
* `_filter`: the current filter applied to the `CalendarSelect` instance, if any. If none is applied, the value should be __'none'__.

### ApiOptions

The `ApiOptions` class is a JavaScript class that generates form controls for the Liturgical Calendar API options. It allows you to easily add an options form to your website, alongside a `CalendarSelect` widget.

The `ApiOptions` class can be instantiated with a `locale` parameter, which will determine the localization for the UI elements (such as values in the select dropdowns).

The `ApiOptions` class will instantiate eight form controls, four of which are only useful for the General Roman Calendar, while the other four are useful for any calendar, whether General Roman or National or Diocesan. Most applications will only find use for the first four form controls, which are useful for any calendar.

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
The `ApiOptions` instance is inserted into the DOM by calling the non chainable `appendTo(elementSelector, inputsFilter=ApiOptionsFilter.NONE)` method, and passing the CSS selector for the element to which the form should be appended. You can optionally pass a second `inputsFilter` parameter to specify which form controls should be appended. The `inputsFilter` parameter can have a value of either __ApiOptionsFilter.GENERAL_ROMAN__ or __ApiOptionsFilter.ALL_CALENDARS__. If no inputs filter is passed, the default is __ApiOptionsFilter.NONE__ (which means all possible form controls will be appended). This can be useful if you're only interested in dealing with National or Diocesan liturgical calendars, and have no need for the tweakable options that only apply to the General Roman Calendar: in this case you would pass in an `inputsFilter` of __OptionsFilter.ALL_CALENDARS__. Whereas only the form controls that are useful only for the General Roman Calendar can be appended by passing an `inputsFilter` of __ApiOptionsFilter.GENERAL_ROMAN__.

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

For this very reason, the `Input` class is also exported by the `liturgy-components-js` package's main `dist/index.js`. Exporting the `Input` class is not meant for instantiation, but rather for simplifying the global configuration of the form controls produced by the `ApiOptions` class.

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
* `attachTo( elementSelector )`: the element in which the web calendar will be rendered, every time the calendar is updated
* `listenTo( apiClient )`: the `WebCalendar` instance will listen to the `calendarFetched` event emitted by the `ApiClient` instance, and update the calendar when the event is triggered. If the `ApiClient` instance is configured to listen to the `CalendarSelect` instance, the `WebCalendar` instance will dynamically update the calendar based on the selected calendar; if it is configured to listen to the `ApiOptions` instance, the `WebCalendar` instance will dynamically update the calendar based on the selected options.

Example:
```javascript
const apiClient = new ApiClient( 'en-US' );
const webCalendar = new WebCalendar();
webCalendar.listenTo( apiClient ).attachTo( '#litcalWebcalendar' );
```

## Final example

```html
<!-- myPage.html -->
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Liturgical Calendar Components JS</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.1/css/all.min.css" integrity="sha512-5Hs3dF2AEPkpNAR7UiOHba+lRSJNeM2ECkwxUIxC1Q/FLycGTbNapWXB4tP889k5T5Ju8fs4b1P5z/iB4nMfSQ==" crossorigin="anonymous" referrerpolicy="no-referrer" />
    <link rel="stylesheet" type="text/css" media="screen" href="main.css" />
</head>
<body class="p-4">
    <h1>Liturgical Calendar Components JS</h1>
    <form id="litcalForm">
        <div class="row mb-4" id="calendarOptions">
            <h2>Calendar Select / Options</h2>
        </div>
    </form>
    <div id="litcalWebcalendar"></div>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" integrity="sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz" crossorigin="anonymous"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.1/js/all.min.js" integrity="sha512-1JkMy1LR9bTo3psH+H4SV5bO2dFylgOy+UJhMus1zF4VEFuZVu5lsi4I6iIndE4N9p01z1554ZDcvMSjMaqCBQ==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
    <script type="importmap">
        {
            "imports": {
                "liturgy-components-js": "./.yarn/unplugged/liturgy-components-js-file-d72298a6ec/node_modules/liturgy-components-js/dist/index.js"
            }
        }
    </script>
    <script type="module" src="main.js"></script>
</body>
</html>
```

```javascript
// main.js
import { ApiClient, CalendarSelect, ApiOptions, Input, WebCalendar, Grouping, ColorAs, Column, ColumnOrder, DateFormat, GradeDisplay } from "liturgy-components-js";

Input.setGlobalInputClass('form-select');
Input.setGlobalLabelClass('form-label d-block mb-1');
Input.setGlobalWrapper('div');
Input.setGlobalWrapperClass('form-group col col-md-3');

ApiClient.init('http://localhost:8000').then( (apiClient) => {
    const calendarSelect = new CalendarSelect( 'en-US' );
    calendarSelect.allowNull()
        .label({
            class: 'form-label d-block mb-1'
        }).wrapper({
            class: 'form-group col col-md-3'
        }).class('form-select')
        .appendTo( '#calendarOptions');

    const apiOptions = new ApiOptions( 'en-US' );
    apiOptions._localeInput.defaultValue( 'en' );
    apiOptions._acceptHeaderInput.hide();
    apiOptions._yearInput.class( 'form-control' ); // override the global input class
    apiOptions.linkToCalendarSelect( calendarSelect ).appendTo( '#calendarOptions' );

    apiClient.listenToCalendarSelect( calendarSelect ).listenToApiOptions( apiOptions );

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
});
```

You will probably want to adjust the CSS styling too. The `WebCalendar` component adds a number of CSS classes to the single table elements, based also on liturgical grade. Here is a sample stylsheet to fit the current example, which styles different ranked celebrations differently:

```css
/** main.css */
#LitCalTable {
    width: 90%;
    margin: 30px auto;
    padding: 10px;
    background: white;
    border-collapse: collapse;
    border-spacing: 1px;
}

#LitCalTable caption {
    caption-side: top;
    text-align: center;
}

#LitCalTable colgroup .col2 {
    width: 10%;
}

#LitCalTable td {
    padding: 4px 6px;
    border: 1px dashed lightgray;
}

#LitCalTable td.rotate {
    width: 1.5em;
    white-space: nowrap;
    text-align: center;
    vertical-align: middle;
}

#LitCalTable td.rotate div {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    font-size: 1.8em;
    font-weight:bold;
    writing-mode: vertical-rl;
    transform: rotate(180.0deg);
}

#LitCalTable .monthHeader {
    text-align: center;
    background-color: #ECA;
    color: darkslateblue;
    font-weight: bold;
}

#LitCalTable .dateEntry {
    font-family: 'Trebuchet MS', 'Lucida Sans Unicode', 'Lucida Grande', 'Lucida Sans', Arial, sans-serif;
    font-size:.8em;
}

#LitCalTable .eventDetails {
    color: #BD752F;
}

#LitCalTable .liturgicalGrade {
    text-align: center;
    font-family:'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
}

#LitCalTable .liturgicalGrade.liturgicalGrade_0 {
    visibility: hidden;
}

#LitCalTable .liturgicalGrade_0, #LitCalTable .liturgicalGrade_1, #LitCalTable .liturgicalGrade_2 {
    font-size: .9em;
}

#LitCalTable .liturgicalGrade_3 {
    font-size: .9em;
}

#LitCalTable .liturgicalGrade_4, #LitCalTable .liturgicalGrade_5 {
    font-size: 1em;
}

#LitCalTable .liturgicalGrade_6, #LitCalTable .liturgicalGrade_7 {
    font-size: 1em;
    font-weight: bold;
}

.liturgicalGrade.liturgicalGrade_0, .liturgicalGrade.liturgicalGrade_1, .liturgicalGrade.liturgicalGrade_2 {
    font-style: italic;
    color: gray;
}

#LitCalTable td.purple {
    background-color: plum;
    color: black;
}

#LitCalTable td.EASTER_TRIDUUM.purple {
    background-color: palevioletred;
    color: white;
}

#LitCalTable td.white {
    background-color: whitesmoke;
    color: black;
}

#LitCalTable td.red {
    background-color: lightpink;
    color: black;
}

#LitCalTable td.pink {
    background-color: mistyrose;
    color: black;
}

#LitCalTable td.green {
    background-color: lightgreen;
    color: black;
}
```
