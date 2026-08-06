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

The constructor accepts a locale string or an options object:

```javascript
// With locale string
const riteSelect = new RiteSelect('it-IT');

// With options object
const riteSelect = new RiteSelect({
    locale: 'it-IT',
    id: 'rite-select',
    class: 'form-select',
    name: 'selected_rite'
});
```

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

| Method | Description |
|--------|-------------|
| `class(className)` | CSS class(es) for the select element |
| `id(id)` | ID for the select element (without '#') |
| `name(name)` | Name attribute for the select element |
| `label(options)` | Configure the label element (`text`, `class`, `id`), or `null` to remove it |

### DOM Insertion Methods (non-chainable)

| Method | Description |
|--------|-------------|
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
rite selection into the rest of a form, pass it as the optional second argument to
`ApiOptions.linkToCalendarSelect()`:

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

    apiOptions.linkToCalendarSelect( [ nationSelect, dioceseSelect ], riteSelect );
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

## Back-Compatibility

An embed that never instantiates `RiteSelect` and never passes one to `linkToCalendarSelect()` is
unaffected in the requests it makes: the resulting API **paths** are byte-identical to before rite
awareness was added, and `CalendarSelect`'s empty option still reads `---` rather than a rite-specific
label.

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
several embeds, one embed becoming rite-aware leaves every other embed's path exactly as it was.
