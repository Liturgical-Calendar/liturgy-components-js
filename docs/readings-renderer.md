# ReadingsRenderer

The `ReadingsRenderer` component turns the `readings` object the API attaches to a liturgical event into
DOM. `LiturgyOfTheDay` and `LiturgyOfAnyDay` both use it internally; it is exported so that a consumer
rendering readings its own way can use the same vocabulary rather than rediscovering it.

## Why it is public API

**Readings are not a flat map.** Most celebrations carry one set of readings, keyed directly:

```json
{
    "first_reading": "Is 61:1-3",
    "responsorial_psalm": "Ps 145:1-2",
    "gospel": "Lk 4:16-21"
}
```

Some carry several, keyed by which Mass they belong to — Christmas has four, the Easter Vigil has its own
arrangement, and a handful of celebrations offer alternative schemas:

```json
{
    "vigil": { "first_reading": "Is 62:1-5", "gospel": "Mt 1:1-25" },
    "night": { "first_reading": "Is 9:1-6", "gospel": "Lk 2:1-14" },
    "dawn":  { "first_reading": "Is 62:11-12", "gospel": "Lk 2:15-20" },
    "day":   { "first_reading": "Is 52:7-10", "gospel": "Jn 1:1-18" }
}
```

The two shapes are not distinguishable without knowing which keys name a Mass, and that list is neither
obvious nor guessable. A consumer that treats every value as a string renders `[object Object]` wherever a
nested entry appears — which is exactly what happened while building the sanctorale viewer in
[LiturgicalCalendarFrontend#503][frontend-503], and what prompted issue #97.

[frontend-503]: https://github.com/Liturgical-Calendar/LiturgicalCalendarFrontend/pull/503

## The vocabulary

Four static members carry everything needed to render readings correctly, whatever markup you choose.
The three data members are frozen, and all four are reachable **without constructing a renderer** — a consumer that
wants the vocabulary and not this component's layout should not have to instantiate one:

| Member                                          | What it is                                                     |
| ----------------------------------------------- | -------------------------------------------------------------- |
| `ReadingsRenderer.hasNestedSchemas( readings )` | The predicate telling the two shapes above apart               |
| `ReadingsRenderer.massLabels`                   | The schema keys, in liturgical order, mapped to English labels |
| `ReadingsRenderer.readingOrder`                 | The reading keys, in the order they are read at Mass           |
| `ReadingsRenderer.readingLabels`                | Every reading key mapped to its English label                  |

`massLabels` names ten schema keys, and its **key order is the render order** — the renderer iterates it
rather than the object's own insertion order, so a `vigil` listed after `day` in the response still renders
first:

```javascript
{
    vigil: 'Vigil Mass',        night: 'Mass during the Night',
    dawn: 'Mass at Dawn',       day: 'Mass during the Day',
    evening: 'Evening Mass',
    schema_one: 'Schema I',     schema_two: 'Schema II',
    schema_three: 'Schema III',
    easter_season: 'Easter Season',
    outside_easter_season: 'Outside Easter Season',
}
```

`readingOrder` covers the full range the API can serve, including the Easter Vigil's seven Old Testament
readings with a psalm after each, the epistle, and the Palm Sunday procession gospel. Not every key appears
in any given celebration — iterate the order and skip what is absent, which is what `renderReadings()` does.

### Locale

The labels are localized. `ReadingsRenderer` takes a locale exactly as every other component in this
library does — a `string` or an `Intl.Locale`, interchangeably, as the bare constructor argument or the
options bag's `locale` property:

```javascript
const renderer = new ReadingsRenderer('it');
const renderer = new ReadingsRenderer({ locale: 'it', readingClassName: 'mb-1' });
```

`null` and `undefined` both mean "not supplied" and yield English. Anything else is rejected, naming the
component and the type found; an unparseable locale throws rather than silently falling back.

A locale whose catalogue block does not carry a readings key falls back to that key's English, per
`message()`. Only `en`, `it` and `la` are populated today — every other locale renders English labels,
which is the documented normal case for a partly translated key.

**The two static maps stay English whatever locale a renderer is given**, because a static cannot know
one. They remain the vocabulary and the render order; a localized label comes from rendering.

### Using the vocabulary without the renderer

```javascript
import { ReadingsRenderer } from '@liturgical-calendar/components-js';

if (ReadingsRenderer.hasNestedSchemas(event.readings)) {
    for (const [key, label] of Object.entries(ReadingsRenderer.massLabels)) {
        if (key in event.readings) {
            renderMyOwnWay(label, event.readings[key]);
        }
    }
} else {
    renderMyOwnWay(null, event.readings);
}
```

`hasNestedSchemas()` is callable both as a static and on an instance; the instance method delegates to the
static one, so the two can never disagree. It returns `false` rather than throwing for `null`, `undefined`
and non-objects.

## Rendering

```javascript
import { ReadingsRenderer } from '@liturgical-calendar/components-js';

const renderer = new ReadingsRenderer({
    readingsWrapperClassName: 'readings',
    readingsLabelClassName: 'fw-bold',
    readingClassName: 'mb-1',
});

renderer.renderReadings(event.readings, document.querySelector('#readings'));
```

`renderReadings()` appends a single wrapper `<div>` to the container. Nested schemas are stacked inside it,
each preceded by a label; a flat set is rendered directly. Reading values are written with `textContent`,
never as markup — the same boundary `sanitizeHtml()` exists for elsewhere in the library.

### Constructor Options

| Option                     | Type                      | Default | Purpose                             |
| -------------------------- | ------------------------- | ------- | ----------------------------------- |
| `locale`                   | `string` \| `Intl.Locale` | `'en'`  | Language the labels are read in     |
| `readingsWrapperClassName` | `string`                  | `''`    | Class for the wrapper element       |
| `readingsLabelClassName`   | `string`                  | `''`    | Class for reading and schema labels |
| `readingClassName`         | `string`                  | `''`    | Class for each reading row          |

A non-string value is ignored rather than rejected. Each has a chainable setter —
`setReadingsWrapperClassName()`, `setReadingsLabelClassName()`, `setReadingClassName()` — which **does**
throw a `TypeError` for a non-string.

### Methods

| Method                                                      | Returns            | Purpose                                   |
| ----------------------------------------------------------- | ------------------ | ----------------------------------------- |
| `renderReadings( readings, container )`                     | `void`             | Renders either shape into `container`     |
| `renderSingleReadings( readings, container, schemaLabel? )` | `void`             | Renders one flat set, optionally labelled |
| `hasNestedSchemas( readings )`                              | `boolean`          | Instance form of the static predicate     |
| `setReadingsWrapperClassName( className )`                  | `ReadingsRenderer` | Chainable                                 |
| `setReadingsLabelClassName( className )`                    | `ReadingsRenderer` | Chainable                                 |
| `setReadingClassName( className )`                          | `ReadingsRenderer` | Chainable                                 |

Both render methods throw if `container` is not an `HTMLElement`. `renderReadings()` checks `readings`
first, though, and returns silently when it is not an object — an event with no readings is ordinary rather
than an error, so that call is a no-op and never reaches the container check.

## When this renderer's markup will not fit

`renderReadings()` stacks the schemas vertically, each under its own label. That suits a one-day view, which
is what `LiturgyOfTheDay` and `LiturgyOfAnyDay` are.

It does not suit every layout. A view comparing one celebration's readings across **every locale at once**
gains nothing from nesting schemas inside each locale's rows — it turns six rows into eighteen and destroys
the comparison the table exists to make. The sanctorale viewer that prompted issue #97 put the schemas on
tabs instead and kept locale as the axis you read down.

That is the case the static vocabulary above is for: take `hasNestedSchemas`, `massLabels` and
`readingOrder`, and write the markup your view needs.
