# RiteSelect

The `RiteSelect` component generates a select element populated with the liturgical rites supported by
the Liturgical Calendar API: Roman and Ambrosian.

`RiteSelect` is a **standalone** component. Unlike the `ApiOptions` form controls, a rite is a path
segment (like a nation or a diocese), not a query parameter, so it lives in its own module rather than
under `ApiOptions/Input/`. Selecting a rite in it does nothing by itself: `RiteSelect` only becomes
useful once it is linked, and linking is entirely opt-in.

## Prerequisites

Unlike `CalendarSelect`, `RiteSelect` does not read from the API's metadata, so it does not require
`ApiClient` to be initialized first. It can be instantiated as soon as the DOM is ready:

```javascript
import { RiteSelect } from '@liturgical-calendar/components-js';

const riteSelect = new RiteSelect('en-US');
riteSelect.appendTo('#riteOptions');
```

## Constructor Options

The constructor accepts a locale, an options object, or nothing at all:

```javascript
// With locale string
const riteSelect = new RiteSelect('it-IT');

// With an Intl.Locale
const riteSelect = new RiteSelect(new Intl.Locale('it-IT'));

// With options object
const riteSelect = new RiteSelect({
    locale: 'it-IT',
    id: 'rite-select',
    class: 'form-select',
    name: 'selected_rite'
});
```

A locale may be given as a `string` or as an `Intl.Locale`, interchangeably, both as the bare argument and as
the `locale` property. `null` and `undefined` both mean "not supplied" in either position and take the default
of `'en'`; anything else is rejected, naming the type it found.

The select is populated with one `<option>` per value of the `Rite` enum (`roman` and `ambrosian`),
labeled with the `RITE_ROMAN` / `RITE_AMBROSIAN` message keys for the given locale. It defaults to
`Rite.ROMAN` and, unlike `CalendarSelect`, never includes an empty option — there is always a rite
selected.

## Configuration Methods

`RiteSelect` exposes a smaller surface than `CalendarSelect`: there is no `filter()` (there is nothing
to filter — only two rites exist) and no `replace()` (only `appendTo()` is supported for DOM insertion).

```javascript
const riteSelect = new RiteSelect('en-US')
    .class('form-select')
    .id('rite-select')
    .name('selected_rite')
    .label({
        text: 'Select a Rite',
        class: 'form-label',
        id: 'rite-label'
    });

riteSelect.appendTo('#riteOptions');
```

| Method             | Description                                                                 |
| ------------------ | --------------------------------------------------------------------------- |
| `class(className)` | CSS class(es) for the select element                                        |
| `id(id)`           | ID for the select element (without '#')                                     |
| `name(name)`       | Name attribute for the select element                                       |
| `label(options)`   | Configure the label element (`text`, `class`, `id`), or `null` to remove it |

### DOM Insertion Methods (non-chainable)

| Method               | Description                         |
| -------------------- | ----------------------------------- |
| `appendTo(selector)` | Append to the specified DOM element |

## Instance Properties

Properties with a single underscore prefix are **intended for advanced use cases** such as direct DOM
access or reading internal state.

```javascript
riteSelect._domElement  // The underlying DOM select element
riteSelect._locale      // The locale used to build the option labels
```

## Linking to CalendarSelect and ApiOptions

On its own, `RiteSelect` is inert — changing its value has no effect on any other component. To wire a
rite selection into the rest of a form, pass it to `ApiOptions.linkToRiteSelect()`:

```javascript
import { ApiClient, ApiOptions, CalendarSelect, RiteSelect, CalendarSelectFilter } from '@liturgical-calendar/components-js';

ApiClient.init().then( () => {
    const riteSelect    = new RiteSelect( 'it-IT' ).class( 'form-select' );
    const nationSelect  = new CalendarSelect( 'it-IT' ).filter( CalendarSelectFilter.NATIONAL_CALENDARS );
    const dioceseSelect = new CalendarSelect( 'it-IT' ).filter( CalendarSelectFilter.DIOCESAN_CALENDARS );
    const apiOptions    = new ApiOptions( 'it-IT' );

    riteSelect.appendTo( '#rite' );
    nationSelect.appendTo( '#nation' );
    dioceseSelect.appendTo( '#diocese' );

    apiOptions
        .linkToCalendarSelect( [ nationSelect, dioceseSelect ] )
        .linkToRiteSelect( riteSelect );
} ).catch( ( error ) => {
    console.error( `Could not reach the API at ${error.url ?? 'the configured base'}: ${error.message}` );
} );
```

Once linked, `ApiOptions` drives the whole rite -> calendar chain on every change of `riteSelect`:

- The linked `CalendarSelect` instance(s) are rebuilt for the newly selected rite, and their calendar
  selection is reset — a `calendar_id` from one rite is never valid under another.
- If the diocesan `CalendarSelect` was linked to a national one with `linkToNationsSelect()`, its
  per-nation filtering is re-derived after the rebuild, from the (reset) nation selection.
- The empty option's label switches from the generic `---` to the rite's own name (e.g. "General Roman
  Calendar" or "Ambrosian Calendar").
- `ApiOptions._epiphanyInput`, `_ascensionInput`, `_corpusChristiInput` and `_eternalHighPriestInput`
  are enabled or disabled. The rule composes two halves, and **both** must hold for an input to be
  enabled: the rite must not fix the celebration itself, **and** no nation or diocese may be selected.
  So under a rite that fixes them, selecting a diocese and then returning to the rite-level calendar
  leaves them disabled — they are not released by the calendar half alone.
- `ApiOptions._yearInput`'s minimum year is adjusted to the rite's floor.
- The `/calendar/nation/` route offered by `ApiOptions._calendarPathInput` (the `PATH_BUILDER` filter)
  is disabled for a rite with no national tier, since no such route exists for it. If that route was
  selected at the time of the rite change, the selection falls back to `/calendar`.

> **On a page that fetches, this is only half the wiring.** `ApiOptions` rebuilds the form; it does not
> issue requests. Only the client turns the rite into a path segment, so it needs the rite select too:
>
> ```javascript
> apiClient.listenTo( calendarSelect ).listenTo( riteSelect ).listenTo( apiOptions );
> ```
>
> Omit `listenTo( riteSelect )` and the failure is silent: the form reads `ambrosian`, the calendar list
> rebuilds with the Ambrosian dioceses, the temporal inputs disable themselves — and every request still
> goes to `/calendar/roman/`. A page that only renders a form, with no `ApiClient`, needs no second wire.

### Selecting the Ambrosian rite

Selecting Ambrosian:

- **Hides the nation select**, when a paired national + diocesan `CalendarSelect` array is linked. The
  Ambrosian rite has no national tier: it is celebrated in a small number of dioceses only, so there is
  nothing to group by nation.
- **Disables the Epiphany, Ascension, Corpus Christi and Eternal High Priest inputs.** This is not an
  arbitrary restriction: the reformed Ambrosian Missal fixes these celebrations itself — Epiphany to 6
  January, Ascension to the fortieth day of Easter, and Corpus Domini to the Thursday after Trinity —
  so the corresponding API parameters have no meaning under that rite. The Eternal High Priest is not
  established in the Ambrosian rite at all.
- **Raises the year floor to 1976**, the first year of the reformed Ambrosian Missal. Years before that
  cannot be computed under the Ambrosian rite.

Switching back to Roman reverses all of the above.

## Driving a CalendarSelect without an ApiOptions

`RiteSelect` is usually passed to `ApiOptions.linkToRiteSelect()`, which drives the option inputs as
well as the calendar select — but only once `linkToCalendarSelect()` has been called too. Neither link
does anything on its own: whichever is called second completes the pairing.

When there is no `ApiOptions` on the page, link the calendar select to the rite directly instead:

```javascript
const calSelect = new CalendarSelect( 'it' )
    .filter( CalendarSelectFilter.NATIONAL_CALENDARS )
    .linkToRiteSelect( riteSelect );
```

See [`linkToRiteSelect()`](calendar-select.md#following-a-rite-without-an-apioptions) for the full
behaviour.

## Back-Compatibility

An embed that never instantiates `RiteSelect` and never passes one to `linkToCalendarSelect()` keeps
making equivalent requests, and `CalendarSelect`'s empty option still reads `---` rather than a
rite-specific label.

The request **paths** are no longer byte-identical against a rite-aware API, however. In that case
`ApiClient` emits the rite segment for every rite, so what was `/calendar/nation/IT` is now
`/calendar/roman/nation/IT`. Against v5 the segment is omitted and the old paths are unchanged. Both are the same request —
the API router accepts `roman` as an explicit rite segment — so responses are unchanged; only the URL
string differs.

The **rendered markup of `CalendarSelect` does change**, however: the four Ambrosian dioceses
(`milano_it`, `bergam_it`, `novara_it`, `lugano_ch`) no longer appear in the default (Roman) diocese
list, because `CalendarSelect` now filters dioceses by rite even when no `RiteSelect` is linked and
defaults to `Rite.ROMAN`. Those dioceses only appear once a `CalendarSelect` is built for (or switched
to) `Rite.AMBROSIAN`. This is the bug this feature fixes — Ambrosian dioceses do not belong under the
Roman rite — and integrators relying on the old, rite-unaware diocese list should be aware of it when
upgrading.

Rite filtering also tolerates metadata that predates the rite partition. The `rite` field on diocesan
entries is announced by the API from v6 on; the live v5 `/calendars` response carries none. A diocesan
entry with no `rite` is treated as Roman, so an integrator pinned to v5 keeps the full (Roman) diocese
list rather than an empty one.

Path-wise, linking a `RiteSelect` also changes how a Roman-rite request is spelled, though not what it
requests: with a `RiteSelect` linked, `ApiOptions` sets `explicitRite = true` on its own endpoint state,
so a Roman-rite request emits the explicit `/calendar/roman/...` form instead of the shorter
`/calendar/...` form. Both are the same request to the API — the API's router accepts `roman` as an
explicit rite segment — so this only affects the URL string, not the response.

That change is scoped to the `ApiOptions` instance that linked the `RiteSelect`, and to the
`PathBuilder` built against it. Each `ApiOptions` owns its own endpoint state, so on a page hosting
several embeds, one embed becoming rite-aware leaves every other embed's displayed path exactly as it
was. `ApiClient`'s own requests are separate from this and carry the segment whenever the API supports
one, as described under Back-Compatibility above and in API version compatibility below.

## API version compatibility

Rite support is detected from the `/calendars` metadata rather than configured: a rite-aware API
announces `ambrosian_calendars`, and API v5 does not. There is no version field in the response to read,
and no `apiVersion` option to set.

- Against **v5**, `ApiClient` omits the rite segment entirely, so this release keeps working for
  everything v5 supports. v5 rejects the segment on _every_ route, not only Ambrosian ones, so emitting
  it unconditionally would break even a plain Roman national calendar. Requesting the Ambrosian rite
  there rejects the fetch method's promise with an explicit error naming the version requirement, rather
  than emitting a request the API answers with a bare 400.
- Against **v6 or `dev`**, the segment is always emitted and the Ambrosian rite is available.

## ApiClient

`ApiClient` is rite-aware in its own right. It accepts a `RiteSelect` in `listenTo()`, exactly as it
accepts a `CalendarSelect`, and exposes a chainable `rite()` setter:

```javascript
import { ApiClient, RiteSelect, Rite } from '@liturgical-calendar/components-js';

// One try/catch around the awaits covers both the init() and the fetch rejection.
try {
    const apiClient = await ApiClient.init();
    const riteSelect = new RiteSelect( 'en-US' );
    riteSelect.appendTo( '#rite' );

    apiClient.listenTo( riteSelect ); // changing the rite refetches
    apiClient.rite( Rite.AMBROSIAN ); // or set it directly; chainable
    await apiClient.fetchCalendar(); // POST /calendar/ambrosian
} catch ( error ) {
    console.error( `Could not load the Ambrosian calendar: ${error.message}` );
}
```

Two behaviours are worth knowing:

- **A rite change drops the current calendar selection** and re-targets the request at the rite-level
  calendar. A `calendar_id` from one rite is never valid under another, in either direction —
  `/calendar/ambrosian/diocese/romamo_it` and `/calendar/roman/diocese/lugano_ch` are both rejected.
- **`fetchNationalCalendar()` refuses a rite with no national tier.** There is no
  `/calendar/ambrosian/nation/...` route, so the client rejects the promise it returns rather than
  emitting a request that cannot succeed. Use `fetchCalendar()` for the rite-level calendar, or
  `fetchDiocesanCalendar()` for one of its dioceses. Like every other failure of the three fetch methods
  this arrives as a rejection, never as a synchronous throw, so the `try`/`catch` around the `await`
  above catches it.

The rite also participates in `ApiClient`'s cache key, so switching rite at the same year, locale and
calendar id issues a fresh request instead of returning the previous rite's calendar.

`WebCalendar` takes the rite from the `ApiClient` it listens to, so a rite-level calendar is captioned by
its own name — "Ambrosian Calendar - 2026" rather than "General Roman Calendar - 2026". Set it explicitly
with `WebCalendar.rite()` when not listening to a client.
