# Meta-Components

Meta-components bundle a fixed, tested wiring of the library's existing components and expose the
wired children publicly. They exist because several `LiturgicalCalendarFrontend` call sites were
re-deriving the same wiring by hand — including its ordering requirements and its silent-failure
traps — and the library is a better place for that logic than every consumer's own code.

The library owns wiring, ordering, failure behaviour and defaults. It ships nothing
framework-specific and takes no position on CSS: styling is entirely up to the consumer, through a
**theme bag** for the common case and the wired child instances for everything else.

This page documents `CalendarResourcePicker`, `DayViewer`, `CalendarControls`, `CalendarViewer` and
`ApiExplorer`.

## CalendarResourcePicker

Bundles a `RiteSelect` and a filtered `CalendarSelect` into one mount: a rite select for choosing
Roman or Ambrosian, and a calendar select scoped to either national or diocesan calendars.

```javascript
import { CalendarResourcePicker, CalendarSelectFilter } from '@liturgical-calendar/components-js';

const picker = await CalendarResourcePicker.mountInto('#grantObjectIdMount', {
    locale: 'en',
    filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
    placeholderText: 'Select calendar ID...',
    errorText: 'Could not load calendars — try reloading the page',
    theme: {
        select: 'form-select form-select-sm perm-object-id',
        riteSelect: { class: 'form-select form-select-sm mb-2 perm-object-rite' },
    },
});
picker.calendarSelect.id('grantObjectId');
```

This minimal snippet omits failure handling for brevity — see the
[worked example](#worked-bootstrap-example) below for the `picker.failed` guard a real call site needs
before touching `calendarSelect`.

### What it bundles

- **The rite select is offered only for a diocesan filter.** The Ambrosian rite has no national
  tier, so a `NATIONAL_CALENDARS`-filtered select under it would hold only the rite-level calendar
  and hide itself, stranding a required field the user cannot fill. This is derived from `filter`,
  not left for the caller to remember.
- **Append-then-link ordering.** The rite select is appended to the DOM before the calendar select is
  linked to it, so that it reads first in the form. This is not because `linkToRiteSelect()` requires
  the rite select to already be attached: it only calls `addEventListener` and reads `.value`, both of
  which work identically on a detached node. The ordering is kept for form layout, not because the
  wiring would otherwise fail.
- **Placeholder re-application on every rite change.** `allowNull(true)` plus a disabled, selected,
  empty placeholder option is the default — an empty value means "General Roman Calendar", which is
  never a valid national or diocesan resource id. `linkToRiteSelect()` rebuilds the calendar select's
  option list from scratch on every rite change, which would otherwise discard that customization; the
  picker reapplies it automatically.
- **A visible failure control.** If construction fails at runtime — the API down, metadata
  unparseable — `mountInto()` renders a disabled, `is-invalid` select carrying `errorText` and
  `dataset.loadFailed = 'true'`, keeping the theme's marker classes so form validation and end-to-end
  test selectors still find the control. An empty container is otherwise indistinguishable from "still
  loading".

Native `change` events continue to bubble to the mount, exactly as they would from either child used
standalone.

### Constructor options

| Option            | Type                    | Description                                                                                                                                 |
| ----------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `locale`          | `string \| Intl.Locale` | Display locale. `null`/`undefined` take the default `'en'`; anything else throws, naming the type found.                                    |
| `filter`          | `CalendarSelectFilter`  | Required. `CalendarSelectFilter.NATIONAL_CALENDARS` or `.DIOCESAN_CALENDARS`. `.NONE` is rejected — a resource id must be one or the other. |
| `theme`           | `Object`                | The theme bag; see below. Omitted, the picker renders unstyled markup.                                                                      |
| `apiClient`       | `ApiClient`             | Binds this picker's `CalendarSelect` to that client's API base. Omitted, binds to the first base registered.                                |
| `placeholderText` | `string`                | Text for the disabled placeholder option. Omitted, the empty option keeps its normal label.                                                 |
| `required`        | `boolean`               | Marks the working select `required`. Default `false`. See the note below on the failure control.                                            |
| `errorText`       | `string`                | `mountInto()` only. Text shown in the failure control on a runtime failure.                                                                 |
| `signal`          | `AbortSignal`           | `mountInto()` only. Cancels the mount; see below.                                                                                           |

#### `required` and the failure control

`required` may be passed as a constructor option or set later with the chainable `required(bool)`.
Either way it applies to the **working** select only.

It is deliberately never applied to the failure control, because it could not do anything there: that
control is `disabled`, and a disabled element is barred from constraint validation and excluded from
form submission entirely. Setting `required` on it would imply a guarantee it cannot make.

So a form that must not submit without a calendar needs two things — `required` for the ordinary case,
and its own check of `picker.failed` for the case where the calendar list could not be loaded at all:

```javascript
form.addEventListener('submit', (event) => {
    if (picker.failed) {
        event.preventDefault(); // the field is disabled, so the browser will not stop this for you
        showMessage('The calendar list could not be loaded. Reload and try again.');
    }
});
```

This exists so that a form needing a required calendar field no longer has to reach through the
component with `picker.calendarSelect._domElement.required = true`.

### The theme bag's role vocabulary

The theme bag is written in HTML roles, never framework names, so a Bootstrap or unstyled consumer is
never forced to write framework-shaped keys:

```javascript
theme: {
    select: 'form-select',                     // flat default, applied to every <select> child
    label: 'form-label',                       // flat default for every child's label
    riteSelect: { class: 'form-select mb-2' }, // per-child override, wins over the flat default
}
```

`CalendarResourcePicker` has `select`- and `label`-role children, plus one `wrapper`-role child
(`calendarSelect`, via its `wrapperClass` — see below) — `select`, `label` and `wrapper` are the flat
defaults that apply. Per-child keys are named for the picker's public getters (`calendarSelect`,
`riteSelect`), so the override key and the escape-hatch getter are the same word. Resolution is
per-key and most specific first: a per-child override supplies whichever keys it names, and every key
it does not name falls back to the flat default.

**`labelText`, a per-child-only key with no flat equivalent,** sets a child's label TEXT rather than
its class — `riteSelect: { labelText: 'Choose a rite' }`. It exists because `CalendarSelect.label()`
and `RiteSelect.label()` are one-shot: once the theme bag has called either (which it does whenever
`label`/`labelClass` themes that child), calling `picker.calendarSelect.label({ text: '...' })`
afterwards throws `Label has already been set`. `labelText` is therefore the only way to set custom
label text on a themed child — the escape-hatch getters below still work for anything the theme bag
left untouched (an id, a data attribute, a child the theme never themed at all), but not for
re-configuring something the theme bag already configured.

**Per-child keys depend on what the child is.** A `<select>`-shaped child (`riteSelect`,
`calendarSelect`, `localeInput`, `dateControls`) accepts `class`, `labelClass`, `labelText`,
`wrapperClass` and `wrapper`. `DayViewer`'s `liturgy` child is a `LiturgyOfAnyDay`, which has eight
further class setters and no label or wrapper of its own, so it accepts `class` plus:

| Key                   | Styles                    |
| --------------------- | ------------------------- |
| `titleClass`          | the widget's heading      |
| `dateClass`           | the date header           |
| `dateControlsClass`   | the day/month/year row    |
| `eventsWrapperClass`  | the events container      |
| `eventClass`          | each event                |
| `eventGradeClass`     | the liturgical grade text |
| `eventCommonClass`    | the "common" text         |
| `eventYearCycleClass` | the year-cycle text       |

Those eight were accepted by the bag but silently discarded before 2.3.0 (issue #43), so a consumer
theming the event rows or the date header got library defaults with no throw and no warning. They work
now. **An unrecognised per-child key throws**, naming the key — the same misspelling that produced that
issue is now reported rather than ignored.

**What a class-string value may contain:** every class string in this bag — flat or per-child —
reaches the same validator every other class-taking method in this library uses
(`Utils.validateClassName()`). It accepts any non-empty, space-separated token that contains no
whitespace, quote character, backtick or `<`. Utility-framework classes work as written:

| Framework style      | Example               |
| -------------------- | --------------------- |
| Bootstrap            | `form-select`         |
| Tailwind variant     | `hover:bg-blue-500`   |
| Tailwind responsive  | `md:w-1/2`            |
| Tailwind breakpoint  | `2xl:flex`            |
| Tailwind decimal     | `p-1.5`               |
| Arbitrary value      | `bg-[#1da1f2]`        |
| Arbitrary expression | `w-[calc(100%-2rem)]` |
| Arbitrary variant    | `[&>*]:mt-2`          |

The rejected characters are the ones that can only arrive by mistake — whitespace you forgot to split
on, or a quote or `<` that means markup leaked into a class string. Those still throw
`Invalid class name: …`.

This was not always so. Before 2.2.0 the validator demanded a CSS _identifier_
(`/^(?!\d|--|-?\d)[a-zA-Z_-][a-zA-Z\d_-]{1,}$/`), which is not what a `class` attribute holds, so
every Tailwind example above threw rather than merely failing to style anything. The rule was widened
across the whole library, not just for the theme bag.

**`RiteSelect` has no wrapper concept.** The flat `wrapper` key and any `riteSelect.wrapperClass`
override are silently unused for the rite select — there is no `RiteSelect.wrapper()` method to apply
them to. `calendarSelect` and, on `DayViewer`, `localeInput` both support a wrapper; `riteSelect` does
not, on either meta-component.

### Public getters

All four throw once this picker has been disposed — see [`dispose()`](#dispose) below.

| Member           | Returns                  | Description                                                                               |
| ---------------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| `calendarSelect` | `CalendarSelect \| null` | The wired `CalendarSelect`, or `null` on a failed picker.                                 |
| `riteSelect`     | `RiteSelect \| null`     | The wired `RiteSelect`, or `null` for a national filter or a failed picker.               |
| `value`          | `string`                 | The selected calendar id, or `''` while the placeholder is selected or the picker failed. |
| `failed`         | `boolean`                | `true` when the failure control is mounted instead of a working select.                   |

**A failed picker's ACTION methods are safe, not just its getters.** `onChange()` is a no-op on a failed
picker — its failure control is a disabled `<select>` that never changes, so there is nothing to
subscribe to, but the call does not throw. `appendTo()` re-renders the same failure control into the new
target rather than crashing on the missing `calendarSelect`. Both let the documented
[worked example](#worked-bootstrap-example)'s `if ( null !== picker )` guard call them unconditionally;
only reaching into `calendarSelect`/`riteSelect` themselves needs the additional `picker.failed` check,
because those two getters return `null` on a failed picker.

### `mountInto()` versus the constructor

Like every meta-component, `CalendarResourcePicker` has a synchronous constructor and a static async
factory:

- **`new CalendarResourcePicker(options)`** is synchronous and requires an already-initialised
  `ApiBase`, exactly as `CalendarSelect` does today. Pair it with `appendTo(target)`, which — like
  every other component in this library — returns `undefined` and cannot be chained off.
- **`CalendarResourcePicker.mountInto(target, options)`** is what every real call site needs: it
  resolves the target, constructs the picker, mounts it, and installs the failure control on a
  runtime failure. It is the option documented above and in the worked example.

```javascript
// Constructor + appendTo — used when an ApiBase is already known to be ready
const picker = new CalendarResourcePicker({ locale: 'en', filter: CalendarSelectFilter.NATIONAL_CALENDARS });
picker.appendTo('#mount');

// mountInto — awaits the client, handles failure and cancellation
const picker = await CalendarResourcePicker.mountInto('#mount', {
    locale: 'en',
    filter: CalendarSelectFilter.NATIONAL_CALENDARS,
});
```

### Reject versus resolve

Programmer error and runtime failure are treated differently, on purpose:

| Kind                                                                                | Behaviour                                                                                            |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Invalid options (unparseable locale, unknown filter, a target that matches nothing) | **Rejects.** A typo should not be silently papered over.                                             |
| Runtime failure (API down, metadata unparseable)                                    | **Resolves** with a picker whose `failed` is `true` and whose failure control is already in the DOM. |

`mountInto()` also resolves to `null`, without throwing or rejecting, when the mount was cancelled —
either because the `signal` passed in was already aborted, or because the target element left the DOM
while the API client was resolving:

```javascript
const controller = new AbortController();
const picker = CalendarResourcePicker.mountInto('#mount', {
    locale: 'en',
    filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
    signal: controller.signal,
});
// A scope change elsewhere on the page:
controller.abort();
```

### `dispose()`

All three known call sites for this picker rebuild it whenever the selected scope changes, and this
was the first component in the library that needed any form of teardown. `dispose()` removes every
listener the picker attached — including a consumer's own `onChange()` callbacks — and empties the
mount:

```javascript
const picker = await CalendarResourcePicker.mountInto('#mount', {
    locale: 'en',
    filter: CalendarSelectFilter.NATIONAL_CALENDARS,
});
picker.onChange((value) => console.log(value));

// Scope changed: tear down and rebuild.
picker.dispose();
```

`dispose()` is idempotent — calling it twice is safe and does nothing the second time. A disposed
picker throws on further use rather than failing quietly, and that covers every public member, not
only the two DOM-facing methods: `appendTo()`, `onChange()`, and the `calendarSelect`, `riteSelect`,
`value` and `failed` getters all throw naming "disposed" once `dispose()` has run. `dispose()` also
drops the picker's own references to the wired `CalendarSelect` and `RiteSelect`, so a stale reference
used by mistake fails loudly at the point of misuse instead of leaving the caller's next assertion to
fail somewhere unrelated.

This only makes the _picker_ inert — it does not reach into a child instance the caller separately
kept a reference to before disposing. `const cs = picker.calendarSelect; picker.dispose();` leaves
`cs` itself fully functional; only `picker.calendarSelect` (a second read, after disposal) throws.
Nothing currently gives a meta-component a way to revoke a reference it has already handed out, so
"disposed" is a property of the picker you call it on, not of every value it ever returned.

## Worked Bootstrap example

```javascript
import { CalendarResourcePicker, CalendarSelectFilter } from '@liturgical-calendar/components-js';

const picker = await CalendarResourcePicker.mountInto('#grantObjectIdMount', {
    locale: 'en',
    filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
    placeholderText: 'Select calendar ID...',
    errorText: 'Could not load calendars — try reloading the page',
    signal: scopeChange.signal,
    theme: {
        select: 'form-select form-select-sm perm-object-id',
        riteSelect: { class: 'form-select form-select-sm mb-2 perm-object-rite' },
    },
});
if (null !== picker) {
    // `onChange()` is always safe to call — it is a no-op on a failed picker,
    // since the failure control's `<select>` is disabled and never changes.
    picker.onChange((value) => {
        console.log('Selected calendar id:', value);
    });
    // `calendarSelect` is `null` on a failed picker (its failure control is a
    // bare `<select>`, not a wired `CalendarSelect` instance), so anything that
    // reaches into it — `.id(...)` here — must be guarded by `picker.failed` too.
    if (false === picker.failed) {
        picker.calendarSelect.id('grantObjectId');
    }
}
```

## DayViewer

Bundles a complete "liturgy of any day" page into one mount: a `RiteSelect`, a `CalendarSelect`, an
`ApiOptions` locale input and the `LiturgyOfAnyDay` widget, wired to one another and to an `ApiClient`.
It exists because the rite needs **two** separate wires to work correctly —
`ApiOptions.linkToRiteSelect()` (which rebuilds the calendar list and disables the temporal options
the rite fixes) and `apiClient.listenTo(riteSelect)` (which is the only one of the two that turns the
rite into a path segment) — and wiring only the first fails silently: the form reads `ambrosian` while
every request still goes to `/calendar/roman/`. See "Rite Wiring" in the project `CLAUDE.md` for the
general shape of this trap; `DayViewer` is the fix for it.

```javascript
import { DayViewer } from '@liturgical-calendar/components-js';

const viewer = await DayViewer.mountInto('#liturgyOfAnyDayMount', {
    locale: 'en',
    apiClient,
    theme: {
        select: 'form-select',
        label: 'form-label',
        riteSelect: { class: 'form-select mb-2' },
    },
});
```

### Slots

`appendTo()` (called internally by `mountInto()`) accepts either a single target, which receives all
four children, or a slots object naming a target per child:

```javascript
viewer.appendTo({
    rite: '#riteContainer',
    calendar: '#calendarContainer',
    locale: '#localeContainer',
    liturgy: '#liturgyContainer',
});
```

An omitted slot means that child is not rendered. The rite select is always mounted before the
calendar select is linked to it, mirroring `CalendarResourcePicker`'s own append-then-link convention —
kept for form layout (the rite select reads first), not because `linkToRiteSelect()` requires the rite
select to already be attached to the document. It only calls `addEventListener` and reads `.value`,
both of which work identically on a detached node.

### Constructor options

| Option      | Type                    | Description                                                                                                                                               |
| ----------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `locale`    | `string \| Intl.Locale` | Display locale. `null`/`undefined` take the default `'en'`; anything else throws, naming the type found.                                                  |
| `theme`     | `Object`                | The theme bag; see below. Omitted, the viewer renders unstyled markup.                                                                                    |
| `showTitle` | `boolean`               | Default `true`. `false` hides the `LiturgyOfAnyDay` widget's own heading, for a page that supplies its own.                                               |
| `apiClient` | `ApiClient`             | Binds the viewer's `CalendarSelect` to that client's API base. `mountInto()` only: also wires the viewer via `listenTo()` and performs the initial fetch. |

`mountInto()` additionally accepts:

| Option    | Type                    | Description                                                                                    |
| --------- | ----------------------- | ---------------------------------------------------------------------------------------------- |
| `signal`  | `AbortSignal`           | Cancels the mount before it happens; see below.                                                |
| `onError` | `function(Error): void` | Registered before the initial fetch, so a failure of that very first request still reaches it. |

### The theme bag

The same HTML-role vocabulary as `CalendarResourcePicker` — see
[that component's section](#the-theme-bags-role-vocabulary) for the general rules of resolution,
including the class-name character constraint and the note on `RiteSelect` having no wrapper concept
(true here too: `riteSelect.wrapperClass` and the flat `wrapper` key are both silently unused for the
rite select). Four flat keys and five per-child override keys are understood, plus the `labelText`
per-child key documented below:

```javascript
theme: {
    select: 'form-select',                      // flat default, applied to every <select> child
    label: 'form-label',                        // flat default for every child's label
    input: 'form-control',                      // flat default for every text/number input (the date controls)
    wrapper: 'mb-3',                             // flat default wrapper class — see the note below
    riteSelect: { class: 'form-select mb-2', labelText: 'Choose a rite' }, // labelText: see below
    calendarSelect: { class: '...' },            // per-child override for the CalendarSelect
    localeInput: { class: '...', wrapperClass: 'col-md-4' }, // wrapperClass: see below
    liturgy: { class: '...' },                   // per-child override for the LiturgyOfAnyDay widget's own root
    dateControls: { class: '...' },              // per-child override for all three date inputs together
}
```

`dateControls` is shared by the day, month and year inputs rather than split three ways: styling them
differently from one another is a case nobody has needed, and the `liturgy` getter (below) reaches the
individual inputs directly if that changes.

**The flat `wrapper` key applies to `calendarSelect` and `localeInput`, not to `riteSelect`.** Both of
the first two support a wrapper (`CalendarSelect.wrapper()`, `Input.wrapper()`/`wrapperClass()`); the
rite select has no equivalent method to apply it to, so `theme.wrapper` and any `riteSelect.wrapperClass`
override are both silently no-ops for it — this is a genuine capability limit of `RiteSelect`, not an
omission in `DayViewer`.

**Note on the flat `wrapper` key and the date controls:** the flat `wrapper` key supplies only a wrapper
**class**, not a wrapper **element type**, and `LiturgyOfAnyDay`'s date inputs need an element type
(`wrapper('div')`, say) to already exist before a wrapper class can be applied to them. `DayViewer`
supplies that default (`'div'`) automatically whenever a flat `theme.wrapper` — or a `dateControls`
override that names `wrapperClass` without `wrapper` — would otherwise reach the date controls with no
element type, so the flat key works exactly as it does for every other child. The locale input's wrapper
gets the same default, for the same reason. `'div'` is also what `LiturgyOfAnyDay` already wraps its own
date controls container in, so nothing about the rendered structure changes from mounting the widget
standalone. To use a **different** wrapper element for the date controls specifically, name it
explicitly: `theme.dateControls = { wrapper: 'span', wrapperClass: '...' }`.

### Public members

All getters below, `appendTo()`, `onError()` and `fetch()` throw once this viewer has been disposed —
see [`dispose()`](#dispose-1) below.

| Member           | Returns                                  | Description                                                                                                                |
| ---------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `calendarSelect` | `CalendarSelect`                         | The wired calendar select.                                                                                                 |
| `riteSelect`     | `RiteSelect`                             | The wired rite select.                                                                                                     |
| `localeInput`    | The `ApiOptions` locale input's own type | The wired locale input.                                                                                                    |
| `liturgy`        | `LiturgyOfAnyDay`                        | The wired liturgy widget — the escape hatch for anything the theme bag does not cover, such as the individual date inputs. |
| `selectedLocale` | `string`                                 | The locale chosen by the cascade below, and currently selected in the locale input.                                        |

### The locale cascade

`appendTo()` picks the locale the viewer requests from those the _selected calendar_ supports — not
necessarily the `locale` the viewer was constructed with, since a national or diocesan calendar may not
serve every locale the library does. The order is: an exact match, then a language-prefix match (so a
viewer constructed with `it-CH` gets Italian rather than English), then the first available option,
then finally the constructed `locale` itself. `selectedLocale` reports the result, and the locale input
is pre-selected to match it.

### `showTitle` and labels

`showTitle: false` hides only `LiturgyOfAnyDay`'s own heading — everything else (the rite, calendar and
locale selects) is unaffected, for a page embedding the viewer under its own heading.

The date controls (`DAY`, `YEAR`) and the locale input's label (`LANGUAGE`) are translated for the same
12 locales that carry `SELECT_A_RITE`, while `MONTH` and `SELECT_A_CALENDAR` are translated for all 84
locales the library ships messages for. The fallback to English is per **key**, not per **locale**: a
locale missing only `DAY` still shows its own translation for `MONTH` rather than reverting the whole
viewer to English.

### `mountInto()` versus the constructor

Exactly the same split as `CalendarResourcePicker`:

- **`new DayViewer(options)`** is synchronous and requires an already-initialised `ApiBase`. Pair it
  with `appendTo(target)`, and wire it separately with `listenTo(apiClient)` if it needs to fetch.
- **`DayViewer.mountInto(target, options)`** resolves the target, constructs the viewer, mounts it,
  wires it to `options.apiClient` when given, and performs the initial fetch.

```javascript
// Constructor + appendTo + listenTo — used when an ApiBase is already known to be ready
const viewer = new DayViewer({ locale: 'en' });
viewer.appendTo('#mount');
viewer.listenTo(apiClient);

// mountInto — constructs, mounts, wires and fetches in one call
const viewer = await DayViewer.mountInto('#mount', { locale: 'en', apiClient });
```

### Reject versus resolve

| Kind                                                                                      | Behaviour                                                                                                                                                       |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invalid options (unparseable locale, malformed theme, a slot target that matches nothing) | **Rejects.** A typo should not be silently papered over.                                                                                                        |
| A failed initial fetch (API down, network error)                                          | **Resolves** with a mounted, fully working viewer. The failure reaches `onError()` if one was registered, and falls back to `console.error` only when none was. |

`mountInto()` also resolves to `null`, without throwing or rejecting, when a supplied `signal` was
already aborted before mounting could happen.

### `onError()` and `fetch()`

```javascript
const viewer = new DayViewer({ locale: 'en' });
viewer.appendTo('#mount');
viewer.onError((error) => console.error('Could not load the calendar:', error.message));
viewer.listenTo(apiClient);
await viewer.fetch();
```

`onError(callback)` subscribes `callback` to the client's `calendarFetchFailed` event. Subscribing here
is what stops the library falling back to `console.error` behind the caller's back — `ApiClient` logs a
failure only when nothing is listening for that event. A callback registered before `listenTo()` is
replayed once `listenTo()` runs; a callback registered after a client is already wired subscribes
immediately. Either way each callback is attached exactly once.

**Failures raised before a request is issued reach it too.** `ApiClient` deliberately emits no
`calendarFetchFailed` for an error thrown before anything goes over the wire — an unserviceable rite,
an unusable locale — because that event reports a request that failed, not one that was never made.
`mountInto()`'s initial fetch therefore hands such a failure to the callbacks directly, and falls back
to `console.error` only when nothing received it. Before 2.3.0 it did neither: the callback was bound
to an event that never fired, the log was skipped because a callback existed, and the rejection was
swallowed — so registering `onError()` made that class of failure _less_ visible than omitting it.

`fetch()` performs a calendar fetch using `selectedLocale`, and returns the same promise
`ApiClient.fetchCalendar()` does. That promise is the caller's to handle — rejections also reach any
`onError()` callbacks, but the rejection itself is never swallowed. Calling `fetch()` before
`listenTo()` throws, naming the missing wiring.

### `dispose()`

```javascript
const viewer = await DayViewer.mountInto('#mount', { locale: 'en', apiClient });
viewer.onError((error) => console.error(error));

// Page navigated away, or the viewer is being rebuilt:
viewer.dispose();
```

`dispose()` is idempotent, and a disposed viewer throws on further use rather than failing quietly —
every getter, `appendTo()`, `onError()` and `fetch()` all throw naming "disposed" once it has run.

**What `dispose()` releases:** every subscription the viewer itself made on the client's event bus
through `onError()`/`listenTo()` — unsubscribed via `EventEmitter.off()`, added in this same phase for
exactly this purpose — and the DOM: every element the viewer was mounted into is emptied.

**What survives `dispose()`, and why it must:** the `change` listeners `ApiClient.listenTo()` attaches
internally to the rite select, calendar select and `ApiOptions` inputs, and the `calendarFetched`
listener `LiturgyOfAnyDay.listenTo()` attaches to the client's event bus. All of these are anonymous
closures created inside methods `DayViewer` does not own, attached via `addEventListener`/`on()` with
no reference stored anywhere `DayViewer` — or, for the `ApiClient` ones, even `ApiClient` itself — can
reach. This is a pre-existing gap in the wired components, not something `dispose()` papers over by
claiming otherwise: a disposed viewer's own DOM and event-bus footprint are gone, but the `ApiClient` it
was wired to can still be driven by the same selects if a caller kept a separate reference to them and
the client, exactly as `CalendarResourcePicker.dispose()` documents for the same reason.

## Worked Bootstrap example — DayViewer

```javascript
import { ApiClient, DayViewer } from '@liturgical-calendar/components-js';

const apiClient = await ApiClient.init('https://litcal.johnromanodorazio.com/api/dev');

const viewer = await DayViewer.mountInto(
    {
        rite: '#riteContainer',
        calendar: '#calendarContainer',
        locale: '#localeContainer',
        liturgy: '#liturgyContainer',
    },
    {
        locale: 'en',
        apiClient,
        theme: {
            select: 'form-select',
            label: 'form-label',
            riteSelect: { class: 'form-select mb-2' },
        },
        onError: (error) => {
            console.error('Could not load the calendar:', error.message);
        },
    },
);
```

## CalendarControls

Bundles a `RiteSelect`, a `CalendarSelect` and an `ApiOptions` into one mount, wired to one another and
to an `ApiClient` — with **no renderer**. It exists because the same 45-line wiring block appeared,
structurally identical (differing only in locale source, comment wording and minor content), in a
`WebCalendar` example and a FullCalendar one, and again, minus the fetching, in an API explorer page: the
renderer is the axis of variation for two of this class' three compositions.
`CalendarViewer` is a thin composition of this class with a renderer (`WebCalendar`) added, driven
through `listenTo()` exactly as documented below. `ApiExplorer` is the odd one out: it reuses this
class' CONSTRUCTION (the rite select, calendar select and `ApiOptions`, and the direct
`linkToCalendarSelect().linkToRiteSelect()` call that rebuilds the calendar list on a rite change) but
never calls `listenTo()` — because that method also wires the `ApiClient` to fetch on every change, which
a page that only builds request URLs must never do. See `ApiExplorer`'s own section below for the detail.

```javascript
import { CalendarControls, ApiOptionsFilter } from '@liturgical-calendar/components-js';

const controls = await CalendarControls.mountInto('#calendarOptions', {
    locale: 'en',
    apiClient,
    filter: ApiOptionsFilter.ALL_CALENDARS,
    theme: {
        select: 'form-select',
        label: 'form-label d-block mb-1',
        riteSelect: { class: 'form-select mb-2' },
    },
});
controls.onCalendarFetched((data) => console.log('Fetched:', data));
```

### What it bundles

- **The rite's two wires.** `ApiOptions.linkToRiteSelect()` rebuilds the calendar list and disables the
  temporal options the rite fixes; only `apiClient.listenTo(riteSelect)` turns the rite into a URL path
  segment. This is the trap the whole meta-component family exists for: wire only the first and the form
  reads `ambrosian` while every request still goes to `/calendar/roman/`. `listenTo()` installs both,
  every time.
- **`onCalendarFetched(cb)` and `onError(cb)`**, replacing `apiClient._eventBus.on('calendarFetched', …)`
  — a private-field reach that predates `ApiClient.on()` being public, still present in both of the
  examples this class was extracted from.
- **The initial fetch, dispatched three ways.** `CalendarSelect` marks each option with
  `data-calendartype="national"` or `"diocesan"`; an empty value means the General Roman Calendar. So
  `fetch()` calls `fetchCalendar()` for an empty selection, `fetchNationalCalendar()` for a national one,
  and `fetchDiocesanCalendar()` for a diocesan one — one of the two examples this class replaces wrote
  only the first two dispatch branches by hand, so a diocesan initial selection there called
  `fetchNationalCalendar()` with a diocese id.
- **Mount ordering.** The rite select is appended first, so it reads first in the form — the same
  append-then-link convention as `CalendarResourcePicker` and `DayViewer`, kept for form layout, not
  because `linkToRiteSelect()` requires the rite select to already be attached.
- **An optional `messages` slot.** Named, it renders the API's `messages` array, one `<tr>` per message,
  built with `textContent` — not `innerHTML`, unlike both examples this class replaces, so a message
  containing markup renders as text rather than as elements. Omitted, nothing is rendered. It lives on
  `CalendarControls` rather than only on `CalendarViewer` because the FullCalendar-style consumer wants
  it and will never use `CalendarViewer`. A refetch replaces the rows rather than appending to them.
- **The locale cascade.** Ported from `DayViewer` — see [its own section](#the-locale-cascade) for the
  rule — so requests actually carry the locale these controls were constructed with, instead of
  whichever `Accept-Language` (none, on the first request) happened to already be in force. See
  [below](#the-locale-cascade-1) for the `CalendarControls`-specific detail.

**Two deliberate non-goals:** this class does not call `Input.setGlobalInputClass()` or its siblings —
those are process-wide mutations that leak onto every other component on the page, and the theme bag is
the scoped replacement — and it does not absorb any jQuery/Bootstrap-plugin treatment of an individual
`ApiOptions` input (such as a `multiselect` widget on the holydays-of-obligation input). That stays with
the consumer, reached through `controls.apiOptions._holydaysOfObligationInput`.

### Constructor options

| Option      | Type                    | Description                                                                                                         |
| ----------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `locale`    | `string \| Intl.Locale` | Display locale. `null`/`undefined` take the default `'en'`; anything else throws, naming the type found.            |
| `filter`    | `ApiOptionsFilter`      | Which `ApiOptions` inputs to show. Default (on `undefined` only — see below) `ApiOptionsFilter.ALL_CALENDARS`.      |
| `theme`     | `Object`                | The theme bag; see below. Omitted, the controls render unstyled markup.                                             |
| `apiClient` | `ApiClient`             | Binds the `CalendarSelect` and `ApiOptions` to that client's API base. Omitted, binds to the first base registered. |

**`filter` defaults to `ApiOptionsFilter.ALL_CALENDARS` only when it is `undefined` — an explicitly-passed
`ApiOptionsFilter.NONE` (itself `null`) is honoured as its own, distinct choice, not silently converted to
`ALL_CALENDARS`.** `NONE` renders every `ApiOptions` input unfiltered — both the calendar-related set
(locale, year type, accept header, year) and the general-Roman-specific set (epiphany, ascension, corpus
christi, eternal high priest, holydays of obligation) — which is what the FullCalendar-style consumer this
class was extracted from actually wants. An unrecognised `filter` value is rejected here, naming
`CalendarControls`, rather than surfacing from `ApiOptions.filter()`'s own "Invalid filter: …" message,
which names neither class.

`mountInto()` additionally accepts:

| Option         | Type                    | Description                                                                                                                                                                                                                                                                                                       |
| -------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apiClient`    | `ApiClient`             | Same option, but `mountInto()` also wires it via `listenTo()` and, unless `initialFetch` is `false`, performs the initial fetch.                                                                                                                                                                                  |
| `initialFetch` | `boolean`               | Default `true`. Set `false` to wire the client without performing the INITIAL fetch — subsequent changes still fetch normally, since `listenTo()` also wires `apiClient.listenTo( calendarSelect ).listenTo( riteSelect ).listenTo( apiOptions )`. See the note below on why this is not what `ApiExplorer` uses. |
| `signal`       | `AbortSignal`           | Cancels the mount; see below.                                                                                                                                                                                                                                                                                     |
| `onError`      | `function(Error): void` | Registered before the initial fetch, so a failure of that very first request still reaches it.                                                                                                                                                                                                                    |

### The theme bag

The same HTML-role vocabulary as `CalendarResourcePicker` and `DayViewer` — see
[that component's section](#the-theme-bags-role-vocabulary) for the general resolution rules, the
class-name character constraint, and the note on `RiteSelect` having no wrapper concept. Only two flat
keys and two per-child override keys are understood here:

```javascript
theme: {
    select: 'form-select',                       // flat default, applied to riteSelect and calendarSelect
    label: 'form-label',                          // flat default for their labels
    riteSelect: { class: 'form-select mb-2', labelText: 'Choose a rite' },
    calendarSelect: { class: '...', labelClass: '...', wrapperClass: 'col-md-4' },
}
```

**`apiOptions` is not a themeable child.** Neither the flat `select`/`label` keys nor a per-child
`apiOptions` override key reach any of the `ApiOptions` inputs — `filter` controls which inputs render,
but their styling is untouched by this bag. This is a genuine gap between what `CalendarControls` themes
and what `DayViewer` themes (its `localeInput` per-child key reaches one specific `ApiOptions` input),
not an oversight: `ApiOptions` bundles a variable number of inputs depending on `filter`, so there is no
fixed set of per-child keys to name the way `riteSelect`/`calendarSelect` are named. Reach the individual
inputs directly through `controls.apiOptions` for anything the theme bag does not cover.

### Public getters

All four throw once these controls have been disposed — see [`dispose()`](#dispose-2) below.

| Member           | Returns          | Description                                                                         |
| ---------------- | ---------------- | ----------------------------------------------------------------------------------- |
| `riteSelect`     | `RiteSelect`     | The wired rite select.                                                              |
| `calendarSelect` | `CalendarSelect` | The wired calendar select.                                                          |
| `apiOptions`     | `ApiOptions`     | The wired `ApiOptions`.                                                             |
| `selectedLocale` | `string`         | The locale chosen by the cascade below, and currently selected in the locale input. |

### The locale cascade

Ported from `DayViewer` — see [that component's section](#the-locale-cascade) for the full rule — so the
two components behave alike rather than each inventing their own version of the same behaviour.
`appendTo()` picks the locale these controls request from those the selected calendar supports: an exact
match, then a language-prefix match, then the first available option, then finally the constructed
`locale` itself. `selectedLocale` reports the result, the locale input is pre-selected to match it, and
`fetch()` requests that locale on every call — including the very first one, which is the case that was
broken before this existed: a `CalendarControls` constructed with `locale: 'it'` used to show `it` nowhere
and send no `Accept-Language` at all, silently falling back to Latin.

### `appendTo()` and its slots

Takes either a single target, mounted into for `controls` only (no messages rendering), or a slots
object naming `{ controls, messages }`:

```javascript
controls.appendTo('#calendarOptions'); // controls only

controls.appendTo({
    controls: '#calendarOptions',
    messages: '#LitCalMessages tbody',
});
```

`controls` is required in the slots form; `messages` is optional, and omitting it means the API's
`messages` array is never rendered, exactly as omitting it from `mountInto()`'s target does. Callable
more than once — the children are moved, not copied.

### `mountInto()` versus the constructor

Exactly the same split as `CalendarResourcePicker` and `DayViewer`:

- **`new CalendarControls(options)`** is synchronous and requires an already-initialised `ApiBase`. Pair
  it with `appendTo(target)`, and wire it separately with `listenTo(apiClient)` if it needs to fetch.
- **`CalendarControls.mountInto(target, options)`** resolves the target, constructs the controls, mounts
  them, wires them to `options.apiClient` when given, and — unless `initialFetch` is `false` — performs
  the initial fetch.

```javascript
// Constructor + appendTo + listenTo — used when an ApiBase is already known to be ready
const controls = new CalendarControls({ locale: 'en' });
controls.appendTo('#mount');
controls.listenTo(apiClient);

// mountInto — constructs, mounts, wires and fetches in one call
const controls = await CalendarControls.mountInto('#mount', { locale: 'en', apiClient });

// initialFetch: false — wires the client (so subsequent changes DO fetch) but skips
// the one fetch that would otherwise happen immediately on mount
const controls = await CalendarControls.mountInto('#mount', {
    locale: 'en',
    apiClient,
    initialFetch: false,
});
```

**`initialFetch: false` is NOT what `ApiExplorer` uses, and does not by itself produce a
"never fetches" component.** It only ever suppresses the ONE fetch `mountInto()` would otherwise perform
immediately; `listenTo()` — called either way — still wires `apiClient.listenTo( calendarSelect ).listenTo(
riteSelect ).listenTo( apiOptions )`, so a rite, calendar or option change fetches exactly as it would
without the option. `ApiExplorer` needs every change to be fetch-free, not only the first one, so it never
calls `CalendarControls.listenTo()` — or, by extension, `CalendarControls.mountInto()` — at all. See its
own section [below](#apiexplorer) for how it links the rite -> calendar chain directly instead.

### Reject versus resolve

| Kind                                                                                 | Behaviour                                                                                                                                                     |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invalid options (unparseable locale, malformed theme, a target that matches nothing) | **Rejects.** A typo should not be silently papered over.                                                                                                      |
| The API metadata cannot be loaded (API down, `ApiClient` never initialised)          | **Rejects.**                                                                                                                                                  |
| A failed initial fetch (API down mid-session, network error)                         | **Resolves** with mounted, fully wired controls. The failure reaches `onError()` if one was registered, and falls back to `console.error` only when none was. |

`mountInto()` also resolves to `null`, without throwing or rejecting, when a supplied `signal` was
already aborted, or when `target` — or a slots object's `controls` element — was passed as an already
resolved `HTMLElement` that has since left the document.

**Why this component has no failure control.** `CalendarResourcePicker` is the one component in this
family that renders a stand-in when its metadata cannot load — a disabled, `is-invalid` `<select>`
carrying an error message — and it does so because it substitutes for a **single required form field**,
where an empty slot is indistinguishable from "still loading" and produces an end-to-end timeout with
nothing to point at. `CalendarControls` bundles a whole form, and a whole form has no equivalent
stand-in: if the metadata is gone there is no meaningful partial form to render — a `RiteSelect` and
`CalendarSelect` with no calendars to list are not a smaller working form, they are no form at all. So
construction is simply left to throw, exactly as `DayViewer` already does, and this is a deliberate
difference from the picker rather than an inconsistency waiting to be "fixed" into agreement with it.

**Why the initial fetch's rejection is different.** `mountInto()` resolves to the controls, not to the
calendar data, so the initial fetch's promise is dropped — the exact fire-and-forget case
`ApiClient#_discardRequest` exists for (the same seam `LiturgyOfAnyDay` uses for its own three dropped
requests). Routing it through that seam, rather than reimplementing the log-or-suppress decision by
hand, means a dropped initial fetch can never produce an unhandled rejection, and is logged to
`console.error` only when the failure reached no `calendarFetchFailed` listener — `onError()`, registered
immediately before the fetch, counts as one. This is the opposite case from `fetch()` itself, whose
returned promise is handed directly to the caller and never routed through `_discardRequest`: a promise
the caller holds and can `.catch()` or `await`/`try` would otherwise be logged twice. See `fetch()`'s own
doc comment in the source for the full reasoning.

### `dispose()`

```javascript
const controls = await CalendarControls.mountInto('#mount', { locale: 'en', apiClient });
controls.onError((error) => console.error(error));

// Scope changed: tear down and rebuild.
controls.dispose();
```

`dispose()` is idempotent, and a disposed instance throws on further use rather than failing quietly —
every getter, `appendTo()`, `listenTo()`, `onCalendarFetched()`, `onError()` and `fetch()` all throw
naming "disposed" once it has run.

**What `dispose()` releases:** every subscription these controls made on the client's event bus through
`onCalendarFetched()`/`onError()`/`listenTo()` — including the messages renderer, when a `messages` slot
was named — all unsubscribed via `EventEmitter.off()`. Both mounts (`controls` and, if named, `messages`)
are emptied.

**What survives `dispose()`, and why it must — the same gap `DayViewer.dispose()` documents:** the
`change` listeners `ApiClient.listenTo()` attaches internally to the rite select, calendar select and
`ApiOptions` inputs. These are anonymous closures created inside `ApiClient`'s own private
`#listenToCalendarSelect`/`#listenToRiteSelect`/`#listenToApiOptions` methods, attached via
`addEventListener`, with no reference stored anywhere `CalendarControls` — or `ApiClient` itself — can
reach. A disposed instance's own DOM and event-bus footprint are gone, but the `ApiClient` it was wired
to can still be driven by the same selects if a caller kept a separate reference to them and the client.

## CalendarViewer

A `CalendarControls` paired with a `WebCalendar` — the whole `WebCalendar` example page in one call. It
exists so that a page using the table renderer no longer has to re-derive `CalendarControls`' own wiring,
mount ordering and fetch dispatch by hand around a `WebCalendar` it owns separately.

```javascript
import { CalendarViewer, Grouping, DateFormat } from '@liturgical-calendar/components-js';

const viewer = await CalendarViewer.mountInto(
    { controls: '#calendarOptions', calendar: '#calendarTable', messages: '#LitCalMessages tbody' },
    {
        locale: 'en',
        apiClient,
        theme: {
            select: 'form-select',
            label: 'form-label d-block mb-1',
            riteSelect: { class: 'form-select mb-2' },
        },
        webCalendar: {
            class: 'table table-striped',
            firstColumnGrouping: Grouping.BY_LITURGICAL_SEASON,
            dateFormat: DateFormat.FULL,
        },
    },
);
```

### What it adds over `CalendarControls`

Everything about the form — the rite's two wires, the three-way fetch dispatch, the messages slot, mount
ordering — is exactly `CalendarControls`, reached through `viewer.controls`; this class does not
reimplement any of it. It adds exactly two things:

- **A `calendar` slot**, holding a `WebCalendar` wired to the same `ApiClient` via `listenTo()`, so the
  table renders and re-renders on every fetch `CalendarControls` triggers.
- **A `webCalendar` option bag**, applying named `WebCalendar` methods by key — see below.

### The `webCalendar` bag

Unlike the theme bag's HTML-role vocabulary, this bag is named directly for `WebCalendar`'s own chainable
methods, because `WebCalendar` is a single child with no styling/behaviour split to express:

```javascript
webCalendar: {
    class: 'table table-striped',
    id: 'LitCalTable',
    dateFormat: DateFormat.FULL,
    removeCaption: false,
    removeHeaderRow: false,
    firstColumnGrouping: Grouping.BY_MONTH,
    columnOrder: ColumnOrder.EVENT_DETAILS_FIRST,
    psalterWeekColumn: true,
    eventColor: ColorAs.INDICATOR,
    seasonColor: ColorAs.BACKGROUND,
    seasonColorColumns: Column.EVENT,
    eventColorColumns: Column.EVENT,
    monthHeader: true,
    gradeDisplay: GradeDisplay.FULL,
    latinInterface: LatinInterface.ECCLESIASTICAL,
    locale: 'en-US',
}
```

Each present key is applied as `webCalendar[key](bag[key])`. Naming any key outside this list — a typo,
or a `WebCalendar` method this bag does not expose — rejects immediately, naming the offending key:

```text
CalendarViewer: unknown webCalendar option `notAMethod`
```

**`rite` is deliberately not one of these keys, even though `WebCalendar` has a `rite()` method.**
`WebCalendar.listenTo()` reassigns its rite from each fetch's OWN metadata, taking the rite the _request_
was made under rather than the client's current rite — precisely so that two in-flight requests landing
out of order cannot caption one rite's data with the other rite's name (see `WebCalendar.js`'s own doc
comment on `listenTo()`). A static `rite` supplied through this bag would be overwritten by the very first
fetch, appearing to work right up until data actually arrived; the rite this table captions with comes
from the rite select, through the client, never from a fixed bag value.

### Constructor options

As `CalendarControls`, plus:

| Option        | Type     | Description                                                                                       |
| ------------- | -------- | ------------------------------------------------------------------------------------------------- |
| `webCalendar` | `Object` | `WebCalendar` methods to call, by name — see above. Omitted, the table renders with its defaults. |

`mountInto()` accepts the same additional options as `CalendarControls.mountInto()` — `initialFetch`,
`signal` and `onError` — applied to the controls half exactly as documented [there](#constructor-options-2).

### Public getters

Both throw once this viewer has been disposed — see [`dispose()`](#dispose-3) below.

| Member        | Returns            | Description                                                                                       |
| ------------- | ------------------ | ------------------------------------------------------------------------------------------------- |
| `controls`    | `CalendarControls` | The wired rite select, calendar select and API options, bundled — see [above](#calendarcontrols). |
| `webCalendar` | `WebCalendar`      | The wired table renderer.                                                                         |

### `mountInto()` versus the constructor

The same split as every other meta-component in this family:

- **`new CalendarViewer(options)`** is synchronous and requires an already-initialised `ApiBase` — it
  builds both halves but mounts neither.
- **`CalendarViewer.mountInto(slots, options)`** resolves both targets, constructs the viewer, mounts
  both halves, wires them to `options.apiClient` when given, and — unless `initialFetch` is `false` —
  performs the initial fetch.

```javascript
const slots = { controls: '#calendarOptions', calendar: '#calendarTable' };

// mountInto — constructs, mounts, wires and fetches in one call
const viewer = await CalendarViewer.mountInto(slots, { locale: 'en', apiClient });
```

**Registration order, and why it matters.** `listenTo()` wires `controls` to the `ApiClient` before it
wires `webCalendar` to it. `EventEmitter.emit()` is a synchronous `forEach` over listeners in registration
order, and `WebCalendar`'s own `calendarFetched` listener throws on malformed or empty calendar data (see
`WebCalendar.js`) — a throw that would abort the iteration for any listener registered after it. Wiring
`controls` first means its own `calendarFetched` listeners — including the messages renderer, when a
`messages` slot was named — always run before `webCalendar`'s, so a `WebCalendar` failure can never
suppress a messages render that was already due to happen. The dropped initial-fetch promise is routed
through `apiClient._discardRequest()`, exactly as `CalendarControls.mountInto()` routes its own — see that
method's [reject-versus-resolve section](#reject-versus-resolve-2) for what that seam does and does not log.

### Reject versus resolve

Which cases reject and which resolve is exactly `CalendarControls`' own table — see
[that section](#reject-versus-resolve-2) — extended with one more invalid-options case: an unknown
`webCalendar` key rejects for the same reason an unparseable locale or a malformed theme does.
`mountInto()` resolves to `null`, without throwing or rejecting, under the same condition as
`CalendarControls.mountInto()`: a supplied `signal` already aborted, or either slot passed as an
already-resolved `HTMLElement` that has since left the document.

**The TIMING is not the same, on purpose.** `CalendarControls.mountInto()` and `DayViewer.mountInto()`
both drop the initial fetch's promise into `apiClient._discardRequest()` and resolve immediately,
without waiting for it to settle — the fetch keeps running after the returned promise has already
resolved. `CalendarViewer.mountInto()` instead `await`s that same dropped promise (wrapped in
`.catch(() => {})` so a rejection cannot reach this factory) before resolving. This is deliberate, not
an oversight to reconcile: a viewer's whole reason to exist is the rendered table, so `mountInto()`
resolving before the fetch's promise chain — including `WebCalendar`'s `calendarFetched` listener and
the messages render — has even run would hand back a `CalendarViewer` whose table is still empty for a
caller who assumed otherwise. `CalendarControls` and `DayViewer` have no such renderer to wait for, so
resolving immediately loses nothing. Do not "fix" `CalendarViewer.mountInto()` to match the other two by
removing the `await`.

### `dispose()`

```javascript
const viewer = await CalendarViewer.mountInto(slots, { locale: 'en', apiClient });

// Scope changed: tear down and rebuild.
viewer.dispose();
```

Delegates the controls half entirely to `CalendarControls.dispose()` — see [that
section](#dispose-2) for exactly what it releases — and additionally empties the `calendar` mount.

**What survives `dispose()`, and why it must.** `WebCalendar` has no `dispose()` of its own, and the
`calendarFetched` listener its `listenTo()` attaches is an anonymous closure with no reference this class
— or `WebCalendar` itself — can reach to unsubscribe. Disposing a viewer therefore does not stop its
`webCalendar` from still redrawing against the same `ApiClient` if a caller kept a separate reference to
it and the client; only the mounted DOM can be reclaimed from here, and it is. This is the same
pre-existing gap `CalendarControls.dispose()` and `DayViewer.dispose()` document for their own
anonymously-wired children.

## ApiExplorer

A `CalendarControls` paired with a `PathBuilder`, with fetching turned off — the whole "explore the API"
page in one call. It is the last new component in this family, and deliberately the odd one out: every
other meta-component here adds a renderer that reacts to fetched calendar data, while `ApiExplorer` never
fetches at all. Its only job is to let a visitor build and preview an API request URL.

```javascript
import { ApiExplorer } from '@liturgical-calendar/components-js';

const explorer = await ApiExplorer.mountInto(
    {
        pathBuilder: '#pathBuilderOptions',
        basePath: '#basePathOptions',
        allPaths: '#allPathsOptions',
        riteSelect: '#riteSelectContainer',
        builder: '#pathBuilderOutput',
    },
    { locale: 'en', apiClient },
);
```

### Why this is the awkward member of the family

`CalendarControls.appendTo()` mounts `riteSelect`, `calendarSelect` and `apiOptions` into ONE target.
That layout does not fit the page this class was extracted from
(`LiturgicalCalendarFrontend/assets/js/index.js`), which spreads the SAME `ApiOptions` instance across
three separate containers under three different filters, and positions the calendar select relative to
one specific input rather than inside a container of its own. `ApiExplorer` therefore bypasses
`CalendarControls.appendTo()` entirely and drives `controls.riteSelect`, `controls.calendarSelect` and
`controls.apiOptions` directly through `CalendarControls`' own getters.

### The three-filter layout

| Slot          | Filter                          | Inputs shown                                                                             |
| ------------- | ------------------------------- | ---------------------------------------------------------------------------------------- |
| `pathBuilder` | `ApiOptionsFilter.PATH_BUILDER` | The calendar-path and year inputs, plus (via `insertAfter()`) the calendar select itself |
| `basePath`    | `ApiOptionsFilter.BASE_PATH`    | Epiphany, Ascension, Corpus Christi, Eternal High Priest, holydays-of-obligation         |
| `allPaths`    | `ApiOptionsFilter.ALL_PATHS`    | Locale, year type, and (when relevant) the Accept header input                           |

`ApiOptions.filter()` may be called more than once on the same instance — each call switches which of its
underlying inputs the NEXT `appendTo()` call moves — so this is not three separate `ApiOptions` objects
appearing to duplicate a single field. It is one instance, its inputs distributed across three panels by
three successive `filter().appendTo()` pairs, exactly as the extracted page does by hand.

**The calendar select has no slot of its own.** It is positioned with
`calendarSelect.insertAfter( apiOptions._calendarPathInput )`, landing as a DOM sibling immediately after
the calendar-path input inside the `pathBuilder` container — matching the page this was extracted from,
not a container `ApiExplorer` names separately. Because `insertAfter()` needs the calendar-path input
already in the document to insert next to, **`pathBuilder` is therefore the one slot `appendTo()`
requires**: `insertAdjacentElement('afterend', …)` on a node with no parent is a silent no-op, so omitting
`pathBuilder` used to leave the calendar select permanently detached from the document with nothing to
show for it. Omitting it is now rejected instead — see [below](#appendto-and-its-slots-1).

### It never fetches

`ApiExplorer` never calls `CalendarControls.listenTo()`, and has no `listenTo()` of its own. That method
wires TWO different things under one name: the rite -> calendar chain
(`apiOptions.linkToCalendarSelect().linkToRiteSelect()` — rebuilds the calendar list and disables the
fixed-temporal-option inputs, with no `ApiClient` involved) AND `apiClient.listenTo( calendarSelect
).listenTo( riteSelect ).listenTo( apiOptions )` — which is what turns every rite, calendar and option
change into a live `/calendar/...` request. `ApiExplorer` needs only the first half, so its constructor
calls `apiOptions.linkToCalendarSelect( calendarSelect ).linkToRiteSelect( riteSelect )` directly, and
never touches `apiClient.listenTo()` at all.

The `apiClient` constructor option therefore does one job only: it binds the controls to that client's API
base (via `resolveBase()`, inside `CalendarControls`' own constructor) so the selects populate from
`/calendars` metadata — the same request `ApiClient.init()` already makes for every other meta-component.
It is never used to fetch a calendar. Unlike every other meta-component's `mountInto()`, there is no
`initialFetch` option here, and no `onError` option: both concern a fetch this class never performs, under
any circumstance — including after a rite, calendar or option change, not only at mount time. A
`/calendars` request is legitimate and expected; no `/calendar/...` request is ever issued on this class'
behalf.

### Two things this does NOT absorb

Reached through `explorer.controls.apiOptions`, both deliberately left to the consumer, the same way
`CalendarControls`' own two non-goals are:

- **The per-input `id()` calls** the extracted page makes on individual `ApiOptions` inputs — page-specific
  anchors used by that page's own CSS/JS, not something a reusable component should assume every consumer
  wants.
- **The label-after tooltip nodes** the extracted page splices into some of those inputs' label elements —
  page-specific help text markup, not a themed or generic capability this library models.

### Constructor options

As `CalendarControls` — `locale`, `theme`, `apiClient` — forwarded to it unchanged. `filter` is accepted
but has no lasting effect: `appendTo()` overwrites it three times regardless of what was passed.

### Public getters

Both throw once this explorer has been disposed — see [`dispose()`](#dispose-4) below.

| Member        | Returns            | Description                                                                              |
| ------------- | ------------------ | ---------------------------------------------------------------------------------------- |
| `controls`    | `CalendarControls` | The wired rite select, calendar select and API options — see [above](#calendarcontrols). |
| `pathBuilder` | `PathBuilder`      | The wired path builder, reading its state from the same `apiOptions`/`calendarSelect`.   |

### `appendTo()` and its slots

Takes a slots object naming up to five targets — `pathBuilder`, `basePath`, `allPaths`, `riteSelect`,
`builder`. **`pathBuilder` is required** — the calendar select has no slot of its own and can only be
positioned as a side effect of mounting it, so omitting it is rejected rather than silently leaving the
calendar select detached. The other four stay optional; an omitted one simply skips that append. A named
slot that matches nothing throws, naming `ApiExplorer` and the slot, and a slots object naming no key from
the five above at all — an empty object, or every key misspelled — is rejected too, by name, rather than
resolving having silently mounted nothing:

```javascript
explorer.appendTo({
    pathBuilder: '#pathBuilderOptions',
    basePath: '#basePathOptions',
    allPaths: '#allPathsOptions',
    riteSelect: '#riteSelectContainer',
    builder: '#pathBuilderOutput',
});
```

### `mountInto()` versus the constructor

The same split as every other meta-component in this family:

- **`new ApiExplorer(options)`** is synchronous and requires an already-initialised `ApiBase` — it builds
  the controls (linking the rite -> calendar chain directly, as described above) and the path builder, but
  mounts neither.
- **`ApiExplorer.mountInto(slots, options)`** resolves every named slot, constructs the explorer, and
  mounts it. There is no separate wiring step — the rite -> calendar chain is already linked by the
  constructor above — and no fetch, ever.

```javascript
// Constructor + appendTo — used when an ApiBase is already known to be ready
const explorer = new ApiExplorer({ locale: 'en', apiClient });
explorer.appendTo({ pathBuilder: '#pathBuilderOptions', builder: '#pathBuilderOutput' });

// mountInto — constructs and mounts in one call, without fetching
const explorer = await ApiExplorer.mountInto(slots, { locale: 'en', apiClient });
```

### Reject versus resolve

| Kind                                                                                                                                                                  | Behaviour                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Invalid options (unparseable locale, malformed theme, a named slot that matches nothing, an unknown slot key, `pathBuilder` omitted, or every slots key unrecognised) | **Rejects.** A typo should not be silently papered over. |
| The API metadata cannot be loaded (API down, `ApiClient` never initialised)                                                                                           | **Rejects.**                                             |

`mountInto()` also resolves to `null`, without throwing or rejecting, when a supplied `signal` was already
aborted, or when a slot was passed as an already-resolved `HTMLElement` that has since left the document.
There is no "failed initial fetch" row in this table, unlike `CalendarControls`' and `CalendarViewer`'s own
— there is no initial fetch to fail.

### `dispose()`

```javascript
const explorer = await ApiExplorer.mountInto(slots, { locale: 'en', apiClient });

// Scope changed: tear down and rebuild.
explorer.dispose();
```

Delegates the controls half entirely to `CalendarControls.dispose()` — see [that section](#dispose-2) for
exactly what it releases — and additionally empties every slot this explorer itself mounted into. `PathBuilder`
has no `dispose()` of its own and no way to unsubscribe the `change` listeners it attaches internally to the
underlying inputs; only its mounted DOM (the `builder` slot) can be reclaimed from here, and it is — the same
pre-existing gap `CalendarViewer.dispose()` documents for `WebCalendar`.
