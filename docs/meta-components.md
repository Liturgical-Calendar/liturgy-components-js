# Meta-Components

Meta-components bundle a fixed, tested wiring of the library's existing components and expose the
wired children publicly. They exist because several `LiturgicalCalendarFrontend` call sites were
re-deriving the same wiring by hand — including its ordering requirements and its silent-failure
traps — and the library is a better place for that logic than every consumer's own code.

The library owns wiring, ordering, failure behaviour and defaults. It ships nothing
framework-specific and takes no position on CSS: styling is entirely up to the consumer, through a
**theme bag** for the common case and the wired child instances for everything else.

This page documents `CalendarResourcePicker` and `DayViewer`.

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
| `errorText`       | `string`                | `mountInto()` only. Text shown in the failure control on a runtime failure.                                                                 |
| `signal`          | `AbortSignal`           | `mountInto()` only. Cancels the mount; see below.                                                                                           |

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

**What a class-string value may contain:** every class string in this bag — flat or per-child —
ultimately reaches the same validator every other class-taking method in this library uses
(`Utils.validateClassName()`), which accepts only letters, digits, underscores and hyphens per
space-separated class: `/^(?!\d|--|-?\d)[a-zA-Z_-][a-zA-Z\d_-]{1,}$/`. Tailwind's variant prefixes
(`md:flex`, `hover:bg-blue-500`) and fractional utilities (`w-1/2`) both contain a character (`:` or
`/`) outside that set and are rejected outright — not left unstyled, but thrown as
`Invalid class name: md:flex`. This is a pre-existing, shared constraint the theme bag does not relax
or work around; a build step that strips those characters before the string reaches the component is
the only way to use them today.

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
