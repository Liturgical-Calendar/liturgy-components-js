# @liturgical-calendar/components-js

This component library for the Liturgical Calendar API is a collection of reusable frontend components,
that work with the Liturgical Calendar API (currently hosted at [https://litcal.johnromanodorazio.com/api/dev/](https://litcal.johnromanodorazio.com/api/dev/)).

You can also use a local instance of the API by passing in the url for your local API instance to the `ApiClient` class static `init()` method.

The components library is written as an ES6 module, so it can be imported using ES6 import statements.

## Installation and usage

The `@liturgical-calendar/components-js` component library doesn't need to be installed via npm, yarn, or pnpm. Instead, it can be used directly from a CDN that supports ES6 modules.

Example:

```javascript
//myScript.js
import { ApiClient, CalendarSelect, ApiOptions, Input, WebCalendar, Grouping, ColorAs, Column, ColumnOrder, DateFormat, GradeDisplay, CalendarSelectFilter } from 'https://cdn.jsdelivr.net/npm/@liturgical-calendar/components-js@latest/+esm'
```

> [!TIP]
> In order to use ES6 import statements without a build step in your project, your project's script tag must have the attribute `type="module"`:
>
> ```html
> <!-- myPage.html -->
> <script type="module" src="myScript.js"></script>
> ```

The easiest way to use ES Modules in the browser is by importing directly from a CDN rather than pulling in locally via `yarn`, `npm`, or `pnpm`.

> [!NOTE]
> The jsdelivr CDN caches the packages for 7 days, so when requesting the `@latest` tag you might not actually get the latest version for another week or so.
> If you want to implement the most recent release before the CDN cache expires, you should explicitly request the version number
> instead of the `@latest` tag, e.g. `https://cdn.jsdelivr.net/npm/@liturgical-calendar/components-js@1.1.0/+esm`.

<!-- split between blockquotes -->

> [!TIP]
> You can optionally define an importmap so that you can import from `@liturgical-calendar/components-js` rather than from the full CDN path:
>
> ```html
> <!-- myPage.html -->
> <script type='importmap'>
>     {
>       "imports": {
>         "@liturgical-calendar/components-js": "https://cdn.jsdelivr.net/npm/@liturgical-calendar/components-js@1.1.0/+esm"
>       }
>     }
> </script>
> <script type="module" src="myScript.js"></script>
> ```
>
> ```javascript
> //myScript.js
> import { ApiClient, CalendarSelect, ApiOptions, Input, WebCalendar, Grouping, ColorAs, Column, ColumnOrder, DateFormat, GradeDisplay, CalendarSelectFilter } from '@liturgical-calendar/components-js'
> ```
>
> The importmap lets the browser know where to look for the `@liturgical-calendar/components-js` package.
> The importmap must be defined before the script that imports the `@liturgical-calendar/components-js` package.
> It's recommended to define the importmap in an inline `<script type="importmap">` rather than load it from a separate file,
> to avoid unnecessary network requests and possible timing conflicts in loading the importmap before any scripts that import the `@liturgical-calendar/components-js` package.

## Storybook

To showcase usage of the components, a storybook is included. Before launching storybook,
an instance of the Liturgical Calendar API must be running locally at [http://localhost:8000](http://localhost:8000).
You can then launch the storybook by running `yarn storybook` (after having installed dependencies with `yarn install`),
this will launch the storybook on a random free port (e.g. `http://localhost:6006`).
If you would like to launch storybook on a specific port, you can pass in a port number as a parameter to the `yarn storybook` command, e.g.: `yarn storybook --port 6006`.

If you have a running instance of the Liturgical Calendar API on a port other than 8000,
you can set the environment variable `STORYBOOK_API_PORT` to the port of your local API instance, e.g.: `STORYBOOK_API_PORT=8092 yarn storybook`.
An `.env.example` file is included to assist with this, just copy to `.env` and set the value of `STORYBOOK_API_PORT` to the port of your local API instance,
and the environment variable will be automatically picked up by storybook from the `.env` file.

To simplify getting a running instance of the Liturgical Calendar API on your local machine, you can use a docker container.
This way you don't have to worry about setting up PHP with the required packages, composer installing the API, and launching the API with the required environment variables.
Just simply build the docker image from the provided [Dockerfile](https://github.com/Liturgical-Calendar/LiturgicalCalendarAPI/blob/development/Dockerfile)
in the Liturgical Calendar API repository.
To simplify this even further, you can use the provided [docker-compose.yml](https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docker-compose.yml) file
to launch both the Liturgical Calendar API and the Liturgical Calendar Components storybook in one command: `docker compose up -d`.

If you would like to customize the port that the API will be running on, or the port that storybook will be running on,
you would again use a `.env` file in the same folder as the `docker-compose.yml` file,
and set the value of `STORYBOOK_API_PORT` to the port that you want the API to run on before issuing `docker compose up -d`.
Note that in this case, you would also have to mount the `.env` file into the container, otherwise storybook will not see the environment variable,
see the comments in [docker-compose.yml](https://github.com/Liturgical-Calendar/liturgy-components-js/blob/main/docker-compose.yml).
Note that the images that are built will be about 1.09GB and 657MB respectively, for a total of 1.76GB.

> [!NOTE]
> While it is often possible to reduce the size of docker images by using multi-stage builds with an alpine image in the last stage,
> in the case of the Liturgical Calendar API this is not possible due to the need to install system language packages, which are not available in the alpine image.

## Components

The `index.js` file of the Liturgical Calendar Components library exports the following components and enums:

```javascript
export {
    ApiClient,
    CalendarSelect,
    ApiOptions,
    WebCalendar,
    LiturgyOfTheDay,
    LiturgyOfAnyDay,
    PathBuilder,
    Input,
    Grouping,
    ColorAs,
    Column,
    ColumnOrder,
    DateFormat,
    GradeDisplay,
    ApiOptionsFilter,
    CalendarSelectFilter,
    YearType,
    LatinInterface
}
```

The first six are the main components of the library, and can be instantiated.

The remaining classes are used either as static classes (`Input`) or as Enums, to configure the `ApiOptions`, `WebCalendar` and `LiturgyOfTheDay` components.

### ApiClient

The `ApiClient` is not a UI component, but rather takes care of fetching data from the Liturgical Calendar API based on interactions with the UI components,
and providing the fetched data to the UI components.

The `ApiClient` must be statically initialized before any UI components can be used, since the UI components depend on the data provided by the ApiClient.
By default, the `ApiClient` will initialize itself with the API URL at [https://litcal.johnromanodorazio.com/api/dev/](https://litcal.johnromanodorazio.com/api/dev/),
but you can provide a different API URL, whether local or remote, by passing the url as a parameter to the `ApiClient.init()` method (for example: `ApiClient.init('http://localhost:8000')`).

The `ApiClient.init()` method returns a promise that resolves when the metadata about available liturgical calendars has been fetched from the API.
The promise will resolve to an instance of the `ApiClient` class if successful, or to false if an error occurs.

Example:

```javascript
import { ApiClient } from 'https://cdn.jsdelivr.net/npm/@liturgical-calendar/components-js@latest/+esm';

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
import { ApiClient } from 'https://cdn.jsdelivr.net/npm/@liturgical-calendar/components-js@latest/+esm';

// Initialize the ApiClient with a local API URL
ApiClient.init('http://localhost:8000').then((apiClient) => {
    if (apiClient instanceof ApiClient) {
        const calendarSelect = new CalendarSelect();
        const apiOptions = new ApiOptions();
        apiClient.listenTo(calendarSelect).listenTo(apiOptions);
    }
});
```

Then every time a new calendar is selected from the Calendar Select dropdown, the API Client will fetch the calendar data from the API.
And every time a new API option is selected from the API Options form, the API Client will fetch the new calendar data from the API
and emit an internal `calendarFetched` event that a `WebCalendar` component instance can listen to.

It is also possible to directly fetch calendar data from the API without listening to UI components, by calling one of the following publicly exposed instance methods:

* `apiClient.fetchCalendar()`: will fetch the General Roman Calendar with default options (as used in the Vatican)
* `apiClient.fetchNationalCalendar(calendar_id)`: will fetch a National Calendar by its ID
* `apiClient.fetchDiocesanCalendar(calendar_id)`: will fetch a Diocesan Calendar by its ID
* `apiClient.refetchCalendarData()`: will fetch the calendar data based on the current category and calendar ID (for an example of usage, see the `LiturgyOfTheDay` component)

Example:

```javascript
import { ApiClient } from 'https://cdn.jsdelivr.net/npm/@liturgical-calendar/components-js@latest/+esm';

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

While the `ApiClient` component will generally be used in conjunction with UI components, it may however be useful to set the `year` or `year_type` parameters directly,
without having to depend on interactions with the UI components. For this reason the following chainable instance methods are also provided:

* `setYear(year)`: will set the year parameter to the given year
* `setYearType(yearType)`: will set the yearType parameter to the given `YearType` (you can import the `YearType` enum to assist with this)

The `ApiClient` class exposes the following static readonly class properties:

* `_apiUrl`: the API URL that is being used by the `ApiClient` class
* `_metadata`: the metadata about available liturgical calendars that has been fetched from the API

And `ApiClient` instances expose the following readonly instance properties:

* `_eventBus`: an instance of the internal `EventEmitter` class which handles registering listeners and emitting events.
  The `EventEmitter` class in turn exposes a readonly instance property `_events` which can be used to inspect registered events
  (such as the `calendarFetched` event, which can be inspected from `_eventBus._events.calendarFetched`).
* `_calendarData`: the JSON data representing the latest fetched calendar data from the API

### CalendarSelect

The `CalendarSelect` component generates a select element populated with available liturgical calendars from the Liturgical Calendar API.
It allows you to easily add a liturgical calendar selector to your website.

The `ApiClient` class must be statically initialized before instantiating the `CalendarSelect` class.
This is the only way for the select element to be populated with the current available liturgical calendars, whether national or diocesan.

The `CalendarSelect` class can be instantiated with a `locale` parameter, which will determine the localization for the UI elements (display names of the nations for national calendars).
The default is 'en' (English). Locales with region extensions are also supported, such as 'en-US', 'en-GB', 'en-CA', etc.
If the locale has underscores (as is the case with PHP locales), they will be replaced with hyphens.

The `CalendarSelect` class can also be instantiated with an `options` parameter, as an object that can have the following properties:

* `locale`: The locale to use for the `CalendarSelect` UI elements.
* `id`: The ID of the `CalendarSelect` element.
* `class`: The class name for the `CalendarSelect` element.
* `name`: The name for the `CalendarSelect` element.
* `filter`: The `CalendarSelectFilter` to apply to the `CalendarSelect` element.
* `after`: an html string to append after the `CalendarSelect` element.
* `allowNull`: a boolean to indicate if the `CalendarSelect` element should allow null values.
* `disabled`: a boolean to indicate if the `CalendarSelect` element should be disabled.
* `label`: The label for the `CalendarSelect` element (an object with a `text` property, and optionally `class` and `id` properties).
* `wrapper`: The wrapper for the `CalendarSelect` element (an object with an `as` property, and optionally `class` and `id` properties).

Likewise, the same properties that can be passed in the `options` object, can also be set via the class instance methods of the same name as said properties.

By default, a `CalendarSelect` instance will be populated with all available national and diocesan calendars (grouped by nation).

It is also possible to filter the options in the select element to only include national calendars or diocesan calendars,
by calling the `filter()` method and passing in a value of either `CalendarSelectFilter.NATIONAL_CALENDARS` or `CalendarSelectFilter.DIOCESAN_CALENDARS`.

Example:

```javascript
import { CalendarSelect, CalendarSelectFilter } from 'https://cdn.jsdelivr.net/npm/@liturgical-calendar/components-js@latest/+esm';
const calendarSelect = new CalendarSelect( 'en-US' );
calendarSelect.filter(CalendarSelectFilter.DIOCESAN_CALENDARS).appendTo( '#calendarOptions');
```

The `CalendarSelect` instance is inserted into the DOM by calling the `appendTo(elementSelector)` method,
and passing the CSS selector for the element to which the select element should be appended.

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
* `filter(filter)`: filters the options in the select element to only include national calendars or diocesan calendars.
  The filter can have a value of either __`CalendarSelectFilter.NATIONAL_CALENDARS`__ , __`CalendarSelectFilter.DIOCESAN_CALENDARS`__, or __`CalendarSelectFilter.NONE`__.
* `allowNull( allowNull = true )`: sets whether the select element should include an empty option as the first option.
  If this method is not called, the default is false; if it is called without a parameter, the default is true.
  Otherwise, the method will take a boolean parameter to set whether the select element should include an empty option as the first option.
  An empty option corresponds to the General Roman Calendar for the API, since no national or diocesan calendar is selected.
* `after( htmlString )`: allows to insert HTML content after the select element, for example to add a description below the select element.
  The HTML content must be a string, and the string is sanitized and stripped of any PHP or JavaScript script tags.
* `linkToNationsSelect( calendarSelectInstance )`: in case the current `CalendarSelect` instance has the `CalendarSelectFilter.DIOCESAN_CALENDARS` filter applied,
  this method can be used to link the current CalendarSelect instance to a `CalendarSelectFilter.NATIONAL_CALENDARS` filtered CalendarSelect instance,
  so that the diocese options of the current CalendarSelect instance will be filtered according to the selected nation in the linked CalendarSelect instance.

All of the above stated methods can only be called once on the `CalendarSelect` instance.
They are however idempotent, so if called multiple times with the same value no error will be thrown.
If however you attempt to call them multiple times with different values, an error will be thrown.

And as previously stated, the following non chainable methods are available on the `CalendarSelect` instance, and so should be the last method of the chain:

* `appendTo(elementSelector)`: inserts the select element into the DOM, by passing the CSS selector for the element to which the select element should be appended.
  This must be a valid CSS selector, and the relative element must exist in the DOM, otherwise an error will be thrown.
* `replace(elementSelector)`: similar to the `appendTo()` method, but instead of being appended to the specified element, it will replace the specified element with the select element.

Once either of the two above non chainable methods are called, the `CalendarSelect` instance can no longer be configured using the chainable configuration methods.

The `CalendarSelect` instances expose the following readonly instance properties:

* `_domElement`: the underlying DOM element of the `CalendarSelect` instance
* `_filter`: the current filter applied to the `CalendarSelect` instance, if any.
  If none is applied, the value should be __'none'__ (which is the underlying value of `CalendarSelectFilter.NONE`).

#### Important Note: Vatican Calendar vs. General Roman Calendar

When using `CalendarSelect` __standalone__ (without `PathBuilder` or `CalendarPathInput`),
the component does __not__ distinguish between the "General Roman Calendar" and the "Vatican calendar":

* Selecting "Vatican" from the dropdown is treated the same as selecting no calendar (empty option),
  which corresponds to the General Roman Calendar
* This is intentional: users selecting "Vatican" from a standalone `CalendarSelect` probably expect
  to see the calendar in their own language, not forced into Latin
* When `ApiClient` is configured to listen to `ApiOptions` (via `apiClient.listenTo(apiOptions)`),
  the `Accept-Language` header is automatically set based on the `_localeInput` selection

__When using `CalendarSelect` with `PathBuilder`__ (or `CalendarPathInput`),
there __is__ an explicit distinction via API paths:

* `/calendar` = General Roman Calendar (supports any locale via `Accept-Language`)
* `/calendar/nation/VA` = Vatican calendar (inherently Latin)

This distinction matters because the General Roman Calendar is the universal liturgical calendar
that can be viewed in any supported locale, while the Vatican calendar as a "national calendar"
is specifically Latin.

__National/Diocesan calendars and language support__: National and diocesan calendars can support
multiple languages. When using `ApiOptions` linked to a `CalendarSelect` (via `linkToCalendarSelect()`),
the `_localeInput` component automatically updates its options to show only the locales
supported by the selected calendar. When `ApiClient` is configured to listen to `ApiOptions`
(via `apiClient.listenTo(apiOptions)`), the `Accept-Language` header is automatically set based on
the `_localeInput` selection when fetching calendar data.

### ApiOptions

The `ApiOptions` component generates form controls for the Liturgical Calendar API options.
It allows you to easily add an options form to your website, alongside a `CalendarSelect` widget.

The `ApiOptions` class can be instantiated with a `locale` parameter, which will determine the localization for the UI elements (such as values in the select dropdowns).

The `ApiOptions` class will instantiate nine form controls, four of which are only useful for the General Roman Calendar,
while the other four are useful for any calendar, whether General Roman or National or Diocesan.
Most applications will only find use for the first four form controls as follows, which are useful for any calendar.

#### Form controls useful for any calendar

* `_yearInput`: a number input for the calendar year
* `_yearTypeInput`: a select input with options for the type of year to produce, whether liturgical or civil
* `_localeInput`: a select input with options for the locale to use for the calendar response from the API
* `_acceptHeaderInput`: a select input with options for the Accept header to use for the calendar response from the API

#### Form controls useful only for the General Roman Calendar

These five form controls are useful for fine-tuning the General Roman Calendar, when the national or diocesan data is not requested,
for example to see what the API results would look like for a particular calendar that has not yet been implemented in the API.

They allow to tweak parameters that the national or diocesan calendar would otherwise set,
such as the date of Epiphany, the date of the Ascension, the date of Corpus Christi, whether Eternal High Priest is celebrated,
and which Holy Days of Obligation are observed.

* `_epiphanyInput`: a select input with options for when Epiphany is celebrated
* `_ascensionInput`: a select input with options for when Ascension is celebrated
* `_corpusChristiInput`: a select input with options for when Corpus Christi is celebrated
* `_eternalHighPriestInput`: a select input with options for whether Eternal High Priest is celebrated
* `_holydaysOfObligationInput`: a select input with options for setting Holy Days of Obligation

#### Path builder form control

A ninth form control is also available, which is useful to assist in building URLs for the API:

* `_calendarPathInput`: a select input with options for the path to use for the API requests

#### Filtering the form controls

The `ApiOptions` instance can be filtered to output only the form controls that are useful for "tweaking" the General Roman Calendar,
or only the form controls that are useful for any calendar.
The default filter value is __`ApiOptionsFilter.NONE`__ (which means all possible form controls will be appended).
If instead we want to apply a filter to the form controls,
we can do so by calling the `filter()` method and passing in a value of either __`ApiOptionsFilter.GENERAL_ROMAN`__ or __`ApiOptionsFilter.ALL_CALENDARS`__.

Applying a filter can be useful if for example you're only interested in dealing with National or Diocesan liturgical calendars,
and have no need for the tweakable options that only apply to the General Roman Calendar:
in this case you would call the `filter()` method with a value of __`OptionsFilter.ALL_CALENDARS`__.

If instead you would like to output only the form controls that are useful for the General Roman Calendar but not for other calendars,
you would call the `filter()` method with a value of __`ApiOptionsFilter.GENERAL_ROMAN`__.

Example:

```javascript
import { ApiOptions, ApiOptionsFilter } from '@liturgical-calendar/components-js';
const apiOptions = new ApiOptions( 'en-US' );
apiOptions.filter(ApiOptionsFilter.ALL_CALENDARS).appendTo( '#calendarOptions');
```

There is however one other possible filter, which is __`ApiOptionsFilter.PATH_BUILDER`__, which will only produce the `_calendarPathInput` form control and the `_yearInput` form control.
If this filter is set on the `ApiOptions` instance and the form controls are appended to the document,
a successive call to the `filter()` method with a value of __`ApiOptionsFilter.ALL_CALENDARS`__
will not include a `_yearInput` since it was already included in the __`ApiOptionsFilter.PATH_BUILDER`__ filter.
When the __`ApiOptionsFilter.PATH_BUILDER`__ filter is applied, and then the `ApiOptions` instance is linked to a `CalendarSelect` instance,
the current selected value of the `_calendarPathInput` form control will determine the options available in the `CalendarSelect` instance.

#### Configuring the form controls

All of the form controls produced by the `ApiOptions` class inherit from a common `Input` class, and can be configured globally to have the same classes or wrapper elements.
This can be accomplished with the following static class methods:

* `Input.setGlobalInputClass(className)`: a space separated string of class names to be assigned globally to each form control element
* `Input.setGlobalLabelClass(className)`: a space separated string of class names to be assigned globally to each form label element
* `Input.setGlobalWrapper(element)`: the tag name of the wrapper element that will wrap each form control element, currently only values of __'div'__ and __'td'__ are supported
* `Input.setGlobalWrapperClass(className)`: a space separated string of class names to be assigned globally to each wrapper element

For this very reason, the `Input` class is also exported by the `@liturgical-calendar/components-js` package's main `dist/index.js`.
The `Input` class is not meant to be instantiated, but rather used statically to simplify the global configuration of the form controls produced by the `ApiOptions` class.

Other than the global configurations, each individual form control can be configured using the following chainable configuration methods on the single form control instances:

* `class( className )`: sets the class or classes to apply to the form control element
* `id( id )`: sets the id to apply to the form control element (without an initial '#')
* `name( name )`: sets the name to apply to the form control element (usually the same as the id, not very useful since we probably won't be submitting the form)
* `labelClass( className )`: sets the class or classes to apply to the form label element
* `labelAfter( htmlString )`: an HTML string to append to the form label element, after the label text. The string is sanitized and stripped of any PHP or JavaScript script tags.
* `wrapper( tagName )`: configures a wrapper element, which the form control element will be wrapped in. The tag name can have a value of either __'div'__ or __'td'__.
* `wrapperClass( className )`: sets the class or classes to apply to the wrapper element
* `disabled( disabled = true )`: sets the `disabled` attribute on the form control element based on the boolean value passed in
* `data( data )`: the `data` parameter is a map of `key` => `value` pairs that represent the data attributes to be set on the form control element.
  The `key` is the data attribute name (without the initial `data-`), and the `value` is the data attribute value.
* `defaultValue(value)`: sets the default value to apply to the form control element.

Let's say we are using `bootstrap` to theme our UI interface, and we want to style the form controls with `bootstrap` classes.
All of the form controls produced by the `ApiOptions` class are <kbd>\<select\></kbd> elements except for the `_yearInput` element which is an <kbd>\<input[type="number"]\></kbd> element.
We we might want to apply a class of `form-select` globally to all form controls, but apply a class of `form-control` to the `_yearInput` form control.

Example:

```javascript
import { ApiOptions, Input } from "@liturgical-calendar/components-js";

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

In most cases, we will only be requesting JSON data from the API, so we will not need the `_acceptHeaderInput` form control.
The `_acceptHeaderInput` provides a chainable `hide(hide = true)` method which will prevent the form control from being appended to the form.

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

* The selected calendar's settings will be used to populate the `_epiphanyInput`, `_ascensionInput`, `_corpusChristiInput`,
  `_eternalHighPriestInput`, and `_holydaysOfObligationInput` select elements, and these will be disabled
* The options for the `_localeInput` select element will be filtered according to the selected calendar

> [!NOTE]
> Currently an `ApiOptions` instance can only to a single unfiltered `CalendarSelect` instance.
> Linking to dual filtered `CalendarSelect` instances, one that is filtered with National Calendars and another filtered for Diocesan Calendars,
> is on the roadmap, but not yet fully tested.

### WebCalendar

The `WebCalendar` component generates a Liturgical Calendar as an HTML table element.

The `WebCalendar` class instances provide a number of chainable methods to configure the Liturgical Calendar, such as:

* `id( id )`: sets the id to apply to the table element (without an initial '#')
* `class( className )`: sets the class or classes to apply to the table element
* `firstColumnGrouping( grouping )`: sets the grouping for the first column of the table, can be either `Grouping.BY_MONTH` or `Grouping.BY_LITURGICAL_SEASON`
  (the `Grouping` enum can be imported from the `@liturgical-calendar/components-js` package)
* `psalterWeekColumn( boolVal=true )`: whether to show the psalter week column as the right hand most column of the table (psalter week values are grouped by default when enabled)
* `removeHeaderRow( boolVal=true )`: if we want to hide the header row
* `removeCaption( boolVal=true )`: if we want to hide the table caption
* `monthHeader( boolVal=true )`: if we want to enable a month header row at the start of each month
* `seasonColor(ColorAs.CSS_CLASS)`: sets how the color of a liturgical season is applied to the table, whether as a CSS class, an inline style, or a small colored circle
  (you can import the `ColorAs` enum to assist with these values: `ColorAs.CSS_CLASS`, `ColorAs.BACKGROUND`, `ColorAs.INDICATOR`, `ColorAs.NONE`)
* `seasonColorColumns(Column.LITURGICAL_SEASON)`: sets which columns should be affected by the `seasonColor` settings.
  You can import the `Column` enum to assist with these values: `Column.LITURGICAL_SEASON`, `Column.MONTH`, `Column.DATE`, `Column.EVENT_DETAILS`,
  `Column.GRADE`, `Column.PSALTER_WEEK`, `Column.ALL`, `Column.NONE`. Aside from `Column.ALL` and `Column.NONE`, the other column values are bitfield values,
  so they can be combined with a bitwise OR operator `|`.
* `eventColor(ColorAs.INDICATOR)`: sets how the color of the liturgical event is applied to the table
  (import the `ColorAs` enum to assist with these values: `ColorAs.CSS_CLASS`, `ColorAs.BACKGROUND`, `ColorAs.INDICATOR`, `ColorAs.NONE`)
* `eventColorColumns(Column.EVENT_DETAILS)`: sets which columns should be affected by the `eventColor` settings.
  You can import the `Column` enum to assist with these values, see the `seasonColorColumns()` method above for usage of the `Column` enum cases
* `dateFormat(DateFormat.DAY_ONLY)`: sets how the date should be displayed in the Date column.
  You can import the `DateFormat` enum to assist with these values: `DateFormat.FULL`, `DateFormat.LONG`, `DateFormat.MEDIUM`, `DateFormat.SHORT`, `DateFormat.DAY_ONLY`.
  Values of `FULL`, `LONG`, `MEDIUM` and `SHORT` correspond with the values that can be set on the `dateStyle` parameter of an `Intl.DateTimeFormat` instance,
  whereas `DAY_ONLY` will display only the day of the month and the weekday
* `columnOrder(ColumnOrder.GRADE_FIRST)`: whether the event details column should come before the liturgical grade column.
  You can import the `ColumnOrder` enum to assist with these values: `ColumnOrder.GRADE_FIRST`, `ColumnOrder.EVENT_DETAILS_FIRST`.
* `gradeDisplay(GradeDisplay.ABBREVIATED)`: whether the liturgical grade should be displayed in full or abbreviated form.
  You can import the `GradeDisplay` enum to assist with these values: `GradeDisplay.FULL`, `GradeDisplay.ABBREVIATED`.
* `latinInterface( latinInterface )`: whether the days of the week should be displayed in ecclesiastical Latin or classic Latin, when a Latin locale is requested.
  You can import the `LatinInterface` enum to assist with these values: `LatinInterface.ECCLESIASTICAL`, `LatinInterface.CIVIL`.
* `attachTo( elementSelector )`: the selector for the DOM element in which the web calendar will be rendered, every time the calendar is updated
* `listenTo( apiClient )`: the `WebCalendar` instance will listen to the `calendarFetched` event emitted by the `ApiClient` instance,
  and update the calendar when the event is triggered. If the `ApiClient` instance is configured to listen to the `CalendarSelect` instance,
  the `WebCalendar` instance will dynamically update the calendar based on the selected calendar;
  if it is configured to listen to the `ApiOptions` instance, the `WebCalendar` instance will dynamically update the calendar based on the selected options.

Example:

```javascript
const apiClient = new ApiClient( 'en-US' );
const webCalendar = new WebCalendar();
webCalendar.listenTo( apiClient ).attachTo( '#litcalWebcalendar' );
```

For a full working example of a __Web Calendar component__ listening to an __API Client component__,
which in turn is listening to __Calendar Select__ and __API Options__ components, see the `examples/WebCalendar` folder in the current repository.

This example also demonstrates how to style the calendar events based on liturgical grade.
The `WebCalendar` component adds a number of CSS classes to the single table elements, and these classes also reflect the liturgical grade.
This allows us to style an event or elements of the event differently based on liturgical grade.

### LiturgyOfTheDay

The `LiturgyOfTheDay` component generates a widget for the Liturgy of the Day.

Instances of the `LiturgyOfTheDay` component can be instantiated with a locale code, which will determine the localization for the UI elements (title, date string).

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
* `replace( elementSelector )`: similar to the `appendTo()` method, but instead of being appended to the specified element,
  it will replace the specified element with the Liturgy of the Day widget, similarly to how many jQuery plugins work.

Example:

```javascript
import { ApiClient, LiturgyOfTheDay } from 'https://cdn.jsdelivr.net/npm/@liturgical-calendar/components-js@latest/+esm';

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

By default a `year_type` of `LITURGICAL` is fetched from the API,
though perhaps a `year_type` of `CIVIL` better suits this component so as to produce liturgical events from January 1st to December 31st,
otherwise there won't be any results for the current year after _Saturday of the 34th week of Ordinary Time_.
This can be achieved by calling the `setYearType( YearType.CIVIL )` method on the `ApiClient` instance before fetching the calendar, i.e.:

```javascript
apiClient.setYearType( YearType.CIVIL );
```

In case the calendar has already been fetched, it will need to be re-fetched:

```javascript
apiClient.setYearType( YearType.CIVIL ).refetchCalendarData();
```

> [!TIP]
> There is one limitation in this simple example: whichever `year_type` is requested from the `ApiClient` instance, whether `LITURGICAL` or `CIVIL`,
> there will always be a day in which not all events are included:
>
> * in the case of `LITURGICAL`, the _Vigil Mass for the First Sunday of Advent_ for the current solar year, which falls on _Saturday of the 34th week of Ordinary Time_,
>   as well as all events including and following the _First Sunday of Advent_ for the current solar year will not be included
> * in the case of `CIVIL`, the _Vigil Mass for Mary, Mother of God_ will not be included on _December 31st_
>
> If you would like to see all events for the current year, there are a couple approaches to achieving this:
>
> 1. initially set the `year_type` to `CIVIL`, then attach an event handler to the `calendarFetched` event emitted by the `ApiClient` instance
>    to re-fetch the calendar with `year_type` set to `LITURGICAL` and year set to the next year, if the current date is _December 31st_
> 1. initially leave the default `year_type` of `LITURGICAL`, then attach an event handler to the `calendarFetched` event emitted by the `ApiClient` instance
>    to re-fetch the calendar with `year_type` set to `CIVIL` if the current date is `greater than or equal to` _Saturday of the 34th week of Ordinary Time_
>    and `less than` _Monday of the First week of Advent_ of the following liturgical year (i.e. the current solar year),
>    but refetch the calendar with `year_type` set to `LITURGICAL` and year set to the next year
>    if the current date is `greater than or equal to` _Monday of the First week of Advent_.
>    For an example on achieving this while avoiding infinite fetch loops, see the [examples/LiturgyOfTheDay](examples/LiturgyOfTheDay/main.js) example,
>    or the [LiturgyOfTheDayNationalCalendar.stories.js](src/stories/0_Components/LiturgyOfTheDayNationalCalendar.stories.js) story,
>    or the [LiturgyOfTheDayDiocesanCalendar.stories.js](src/stories/0_Components/LiturgyOfTheDayDiocesanCalendar.stories.js) story.

### LiturgyOfAnyDay

The `LiturgyOfAnyDay` component generates a widget for viewing liturgical events on any selected date.
Unlike `LiturgyOfTheDay` which displays today's liturgy, this component includes date selection controls
(day, month, year) allowing users to browse the liturgical calendar for any date.

Instances of the `LiturgyOfAnyDay` component can be instantiated with a locale code or options object:

```javascript
// With locale string
const liturgyOfAnyDay = new LiturgyOfAnyDay('en-US');

// With options object
const liturgyOfAnyDay = new LiturgyOfAnyDay({ locale: 'en-US' });
```

The `LiturgyOfAnyDay` class instances provide chainable methods to configure the widget:

* `id( id )`: sets the id to apply to the widget element
* `class( className )`: sets the class or classes to apply to the widget DOM element
* `titleClass( className )`: sets the class or classes to apply to the title DOM element
* `dateClass( className )`: sets the class or classes to apply to the date display DOM element
* `dateControlsClass( className )`: sets the class or classes to apply to the date controls wrapper
* `eventsWrapperClass( className )`: sets the class or classes to apply to the events wrapper DOM element
* `eventClass( className )`: sets the class or classes to apply to the event DOM elements
* `eventGradeClass( className )`: sets the class or classes to apply to the liturgical grade DOM elements
* `eventCommonClass( className )`: sets the class or classes to apply to the common (saint type) DOM elements
* `eventYearCycleClass( className )`: sets the class or classes to apply to the liturgical year cycle DOM elements
* `dayInputConfig( options )`: configures the day input with `class`, `labelClass`, `labelText`, `wrapper`, `wrapperClass`
* `monthInputConfig( options )`: configures the month input with the same options as `dayInputConfig`
* `yearInputConfig( options )`: configures the year input with the same options as `dayInputConfig`
* `buildDateControls()`: appends the configured date controls to the date controls wrapper (must be called after configuring inputs)
* `listenTo( apiClient )`: the instance will listen to the `calendarFetched` event emitted by the `ApiClient` instance

The class instance also provides these two non-chainable methods:

* `appendTo( elementSelector )`: the selector for the DOM element in which the widget will be rendered
* `replace( elementSelector )`: replaces the specified element with the widget

#### Automatic Year Type Handling

The `LiturgyOfAnyDay` component automatically handles the special case of December 31st to ensure
the Vigil Mass for Mary Mother of God (January 1st) is included in the results:

* When the selected date is December 31st, the component automatically fetches with `year_type=LITURGICAL` and `year=selectedYear+1`
* When switching away from December 31st, it reverts to `year_type=CIVIL` with the selected year
* This logic is fully encapsulated within the component - no special handling is required by the implementing code
* The `listenTo(apiClient)` method configures the ApiClient with the correct initial year_type based on today's date

#### Date Change Behavior

* **Day/Month changes**: Re-renders events from cached calendar data (no API call)
* **Year changes**: Triggers an API refetch with the new year
* **December 31st transitions**: Triggers an API refetch with appropriate year_type

#### Visual Features

* **High-contrast text**: Automatically uses white text on dark backgrounds (green, red, purple) and black text on light backgrounds
* **White background border**: Events with white backgrounds have a subtle border to distinguish them from the parent container

Example:

```javascript
import { ApiClient, CalendarSelect, ApiOptions, ApiOptionsFilter, LiturgyOfAnyDay }
    from 'https://cdn.jsdelivr.net/npm/@liturgical-calendar/components-js@latest/+esm';

ApiClient.init('http://localhost:8000').then(apiClient => {
    if (false === apiClient || false === apiClient instanceof ApiClient) {
        alert('Error initializing the Liturgical Calendar API Client');
    } else {
        // Create CalendarSelect for calendar selection
        const calendarSelect = new CalendarSelect('en-US')
            .class('form-select')
            .allowNull(true);
        calendarSelect.appendTo('#calendarSelectContainer');
        calendarSelect._domElement.value = ''; // Select General Roman Calendar

        // Create ApiOptions with only locale input
        const apiOptions = new ApiOptions('en-US')
            .filter(ApiOptionsFilter.LOCALE_ONLY)
            .linkToCalendarSelect(calendarSelect);
        apiOptions.appendTo('#localeContainer');

        // Create LiturgyOfAnyDay widget
        const liturgyOfAnyDay = new LiturgyOfAnyDay({ locale: 'en-US' })
            .id('liturgyOfAnyDay')
            .class('card shadow m-2')
            .dateClass('card-header py-3')
            .dateControlsClass('row g-3 p-3')
            .eventsWrapperClass('card-body')
            .eventClass('liturgy-event p-3 mb-2 rounded')
            .eventGradeClass('small')
            .eventCommonClass('small fst-italic')
            .eventYearCycleClass('small')
            .dayInputConfig({
                wrapper: 'div',
                wrapperClass: 'col-md',
                class: 'form-control',
                labelClass: 'form-label',
                labelText: 'Day'
            })
            .monthInputConfig({
                wrapper: 'div',
                wrapperClass: 'col-md',
                class: 'form-select',
                labelClass: 'form-label',
                labelText: 'Month'
            })
            .yearInputConfig({
                wrapper: 'div',
                wrapperClass: 'col-md',
                class: 'form-control',
                labelClass: 'form-label',
                labelText: 'Year'
            })
            .buildDateControls()
            .listenTo(apiClient);

        // Hide the default title if the page already has a heading
        liturgyOfAnyDay._titleElement.style.display = 'none';

        liturgyOfAnyDay.appendTo('#liturgyOfAnyDayContainer');

        // Wire ApiClient to listen to UI components
        apiClient.listenTo(calendarSelect).listenTo(apiOptions);

        // Fetch the General Roman Calendar
        apiClient.fetchCalendar('en');
    }
});
```

### PathBuilder

The `PathBuilder` component assists in "building" an API `GET` request, by listening to `ApiOptions` and `CalendarSelect` instances
and displaying in a text field in real time the resulting GET request with all necessary path parameters based on the selections made.
Besides a text field, a button is also provided with a link to the same API `GET` request.

A `PathBuilder` component is instantiated by passing in the `ApiOptions` instance and the `CalendarSelect` instance.

Example:

```javascript
const apiOptions = new ApiOptions();
const calendarSelect = new CalendarSelect();
const pathBuilder = new PathBuilder( apiOptions, calendarSelect );
pathBuilder.appendTo( '#pathBuilder' );
```

For a full working example, see the `examples/PathBuilder` folder in the current repository.

### Enums

* __`Grouping`__ - `BY_MONTH`, `BY_LITURGICAL_SEASON`. Used in the `WebCalendar` component, to specify how to group the liturgical events.
* __`ColumnOrder`__ - `GRADE_FIRST`, `EVENT_DETAILS_FIRST`. Used in the `WebCalendar` component, to specify the order of the columns.
* __`Column`__ - `LITURGICAL_SEASON`, `MONTH`, `DATE`, `EVENT_DETAILS`, `GRADE`, `PSALTER_WEEK`, `ALL`, `NONE`.
  Bitfield values used in the `WebCalendar` component, to specify which columns to display.
* __`ColorAs`__ - `CSS_CLASS`, `BACKGROUND`, `INDICATOR`, `NONE`. Used in the `WebCalendar` component, to specify how to apply the liturgical color for each event.
* __`DateFormat`__ - `FULL`, `LONG`, `MEDIUM`, `SHORT`, `DAY_ONLY`. Used in the `WebCalendar` component, to specify how to display the date in the day column.
* __`GradeDisplay`__ - `FULL`, `ABBREVIATED`. Used in the `WebCalendar` component, to specify how to display the liturgical grade.
* __`ApiOptionsFilter`__ - `NONE`, `GENERAL_ROMAN`, `ALL_CALENDARS`, `PATH_BUILDER`, `LOCALE_ONLY`, `YEAR_ONLY`, `BASE_PATH`, `ALL_PATHS`.
  Used in the `ApiOptions` class, to specify which form controls to display.
  `LOCALE_ONLY` outputs only the locale input, `YEAR_ONLY` outputs only the year input.
* __`CalendarSelectFilter`__ - `NONE`, `NATIONAL_CALENDARS`, `DIOCESAN_CALENDARS`. Used in the `CalendarSelect` class, to specify which calendars should be included in the select element.
* __`YearType`__ - `LITURGICAL` or `CIVIL`. Used in the `ApiClient` class, to specify the type of the year for which to retrieve the calendar.
* __`LatinInterface`__ - `CIVIL` or `ECCLESIASTICAL`. Used in the `WebCalendar` component, to specify how to display the days of the week in Latin.
