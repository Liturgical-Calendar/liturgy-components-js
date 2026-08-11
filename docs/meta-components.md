# Meta-Components

Meta-components bundle a fixed, tested wiring of the library's existing components and expose the
wired children publicly. They exist because several `LiturgicalCalendarFrontend` call sites were
re-deriving the same wiring by hand — including its ordering requirements and its silent-failure
traps — and the library is a better place for that logic than every consumer's own code.

The library owns wiring, ordering, failure behaviour and defaults. It ships nothing
framework-specific and takes no position on CSS: styling is entirely up to the consumer, through a
**theme bag** for the common case and the wired child instances for everything else.

This page documents `CalendarResourcePicker`.

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

### What it bundles

- **The rite select is offered only for a diocesan filter.** The Ambrosian rite has no national
  tier, so a `NATIONAL_CALENDARS`-filtered select under it would hold only the rite-level calendar
  and hide itself, stranding a required field the user cannot fill. This is derived from `filter`,
  not left for the caller to remember.
- **Append-then-link ordering.** The rite select is appended to the DOM before the calendar select
  is linked to it, because `linkToRiteSelect()` reads the rite select's element to attach its change
  listener.
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

The theme bag is written in HTML roles, never framework names, so a Tailwind or unstyled consumer is
never forced to write Bootstrap-shaped keys:

```javascript
theme: {
    select: 'form-select',                     // flat default, applied to every <select> child
    label: 'form-label',                       // flat default for every child's label
    riteSelect: { class: 'form-select mb-2' }, // per-child override, wins over the flat default
}
```

`CalendarResourcePicker` only has `select`-role children — a `select` and a `label` key are the only
flat defaults that apply. Per-child keys are named for the picker's public getters (`calendarSelect`,
`riteSelect`), so the override key and the escape-hatch getter are the same word. Resolution is
per-key and most specific first: a per-child override supplies whichever keys it names, and every key
it does not name falls back to the flat default.

### Public getters

All four throw once this picker has been disposed — see [`dispose()`](#dispose) below.

| Member           | Returns                  | Description                                                                               |
| ---------------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| `calendarSelect` | `CalendarSelect \| null` | The wired `CalendarSelect`, or `null` on a failed picker.                                 |
| `riteSelect`     | `RiteSelect \| null`     | The wired `RiteSelect`, or `null` for a national filter or a failed picker.               |
| `value`          | `string`                 | The selected calendar id, or `''` while the placeholder is selected or the picker failed. |
| `failed`         | `boolean`                | `true` when the failure control is mounted instead of a working select.                   |

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
    picker.calendarSelect.id('grantObjectId');
    picker.onChange((value) => {
        console.log('Selected calendar id:', value);
    });
}
```
