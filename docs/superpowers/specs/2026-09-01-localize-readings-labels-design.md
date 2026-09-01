# Localize the `ReadingsRenderer` labels (issue #105)

## Problem

`ReadingsRenderer` prints its reading and mass-schema labels from two frozen English literals. Nothing in
that path goes through `Messages.js`, so the component renders English whatever locale it was constructed
under — and it currently has no locale at all to construct under.

The reading **values** are already localized: the API serves the lectionary per locale, so the same entry
reads `"Numbers 6:22-27"` under `en` and `"Numeri 6:22-27"` under `la`. The labels beside them do not
follow, so a non-English page renders an English label against a localized citation:

```text
First Reading: Numeri 6:22-27
Gospel: Lucam 2:16-21
```

This was internal until #97 exported the class in 2.10.0. It is now public API.

### What the research established

Three findings shaped the decisions below, each checked rather than assumed:

1. **There is no existing translation to reuse.** Of the 22 distinct strings, exactly **one** — "Vigil
   Mass" — exists in the API's gettext catalogues, and there it names an _event_
   (`LiturgicalEventCollection.php`), not a readings section. The other 21 exist nowhere in the ecosystem.
   This forecloses "just point at the API's `.po` files".
2. **There are three divergent copies of this vocabulary, not two.** #97 named `sanctorale.js`, which
   copied `SCHEMA_ORDER` verbatim. `temporale.js` is a third: its `formatReadingKey()` derives labels
   mechanically from the key and so produces _different English_ — `palm_gospel` → "Palm Gospel" against
   this library's "Gospel at the Procession", `responsorial_psalm_2` → "Responsorial Psalm 2" against
   "Responsorial Psalm".
3. **`liturgy-components-php` does not render readings.** The multi-client argument for putting the
   vocabulary in the API is therefore weaker than it appears: only JS consumers have this problem today.

## Decisions

### D1 — The vocabulary lives in `Messages.js`, not in the API

Every other user-facing label in this library — `LANGUAGE`, `YEAR`, `SELECT_A_CALENDAR`, `RITE_ROMAN` —
resolves through `Messages.js`. A readings label is UI chrome naming a field, not calendar data. The
_values_ come from the API, correctly; the labels naming them do not have to.

The counter-argument was weighed and rejected on the evidence in finding 3: the API owns liturgical
translation and has a real Weblate pipeline across 14 locales, which is a genuine advantage, but sourcing
labels from it means a cross-repo change (API design, schema, release) before this library can fix
anything, and buys a shared source for exactly one client. Should the API ever publish reading labels,
this design does not foreclose preferring them — the lookup is behind one helper.

This is **not** in tension with the rule that rite settings come from `/calendars` rather than
`RiteProperties`. That rule is about liturgical _law_, which drifts when copied. A section heading is not
liturgical law.

### D2 — The public statics do not change shape

`readingLabels` and `massLabels` were published in 2.10.0, days ago, and carry two structural jobs beyond
labelling:

- `massLabels`' **key order is the render order**, iterated by `renderReadings()`.
- `massLabels`' **key set** is what `static #nestedSchemaKeys` derives from, and therefore what
  `hasNestedSchemas()` recognises.

Both stay exactly as they are: frozen, English, publicly readable, same keys in the same order. They
become the documented English fallback rather than a rival source. No call written against 2.10.0 changes
behaviour.

### D3 — The English strings are DERIVED from `Messages.en`, not restated beside it

The obvious implementation leaves the English in two places: the `Messages.en` block and the two static
literals. That is precisely the duplication #97 removed one layer down, when `#nestedSchemaKeys` became
`Object.keys( massLabels )`.

So the maps are built from the catalogue:

```javascript
static readingLabels = Object.freeze(
    Object.fromEntries(
        Object.entries( READING_MESSAGE_KEYS ).map( ( [ key, messageKey ] ) => [
            key,
            message( messageKey, 'en' ),
        ] ),
    ),
);
```

Three consequences, all wanted:

- One English source. The catalogue and the public map cannot disagree.
- A key missing from `Messages.en` throws **at module load**, by `message()`'s existing contract, rather
  than assigning `undefined` to a `textContent`. Loud beats wrong.
- The key ORDER of `READING_MESSAGE_KEYS` and `MASS_MESSAGE_KEYS` becomes load-bearing, because it
  determines the public maps' key order and hence the render order. This must be pinned by test, not left
  to care.

`ReadingsRenderer` currently has no imports at all; it gains one, on `MessageLookup.js`.

### D4 — Message keys: 22 new, none reused

Nineteen reading keys collapse onto twelve message keys, because the psalm variants already share a
string. The mapping is explicit rather than derived from the key name — `temporale.js` is the cautionary
example of deriving it.

| Readings key(s)                                                 | Message key            | English                  |
| --------------------------------------------------------------- | ---------------------- | ------------------------ |
| `first_reading`                                                 | `READING_FIRST`        | First Reading            |
| `second_reading`                                                | `READING_SECOND`       | Second Reading           |
| `third_reading`                                                 | `READING_THIRD`        | Third Reading            |
| `fourth_reading`                                                | `READING_FOURTH`       | Fourth Reading           |
| `fifth_reading`                                                 | `READING_FIFTH`        | Fifth Reading            |
| `sixth_reading`                                                 | `READING_SIXTH`        | Sixth Reading            |
| `seventh_reading`                                               | `READING_SEVENTH`      | Seventh Reading          |
| `responsorial_psalm`, `responsorial_psalm_2` … `_7`, `_epistle` | `RESPONSORIAL_PSALM`   | Responsorial Psalm       |
| `gospel_acclamation`                                            | `GOSPEL_ACCLAMATION`   | Gospel Acclamation       |
| `gospel`                                                        | `GOSPEL`               | Gospel                   |
| `palm_gospel`                                                   | `GOSPEL_AT_PROCESSION` | Gospel at the Procession |
| `epistle`                                                       | `EPISTLE`              | Epistle                  |

| Schema key              | Message key             | English               |
| ----------------------- | ----------------------- | --------------------- |
| `vigil`                 | `MASS_VIGIL`            | Vigil Mass            |
| `night`                 | `MASS_NIGHT`            | Mass during the Night |
| `dawn`                  | `MASS_DAWN`             | Mass at Dawn          |
| `day`                   | `MASS_DAY`              | Mass during the Day   |
| `evening`               | `MASS_EVENING`          | Evening Mass          |
| `schema_one`            | `SCHEMA_ONE`            | Schema I              |
| `schema_two`            | `SCHEMA_TWO`            | Schema II             |
| `schema_three`          | `SCHEMA_THREE`          | Schema III            |
| `easter_season`         | `EASTER_SEASON`         | Easter Season         |
| `outside_easter_season` | `OUTSIDE_EASTER_SEASON` | Outside Easter Season |

No existing key is reused. `GOSPEL` and `EPISTLE` are new; nothing in the catalogue currently carries
either.

### D5 — `ReadingsRenderer` gains a locale, under the library-wide contract

Per CLAUDE.md's "How components take a locale", and via `LocaleValidation.js` / `OptionsValidation.js`:

- `string` or `Intl.Locale`, interchangeably, as the bare constructor argument **or** the bag's `locale`.
- `null` and `undefined` both mean "not supplied" and yield `'en'`.
- Anything else is rejected, naming the component and the type found.
- An unparseable locale throws and is never silently replaced with English.

The bare-argument form is new here — the constructor previously took only an options bag of class names —
and is added for consistency with the other six components rather than because a caller needs it.

### D6 — No locale-aware statics: the renderer-only path, deliberately

Two statics were proposed and **declined** — `ReadingsRenderer.readingLabel( key, locale )` and
`massLabel( key, locale )`, which would have let a consumer read a localized label without rendering.

The argument for them was that #97's whole point is that a consumer may want the vocabulary without this
renderer's markup, so localization only the renderer can reach re-creates that gap one release later. The
argument against, which prevailed: it is API surface added on speculation, in the same release that adds
the mechanism, before any consumer has asked for it. Keep it simple; widening later is purely additive,
whereas an accessor pair shipped now is permanent.

**What this means concretely, so it is not discovered later as a surprise:** a consumer rendering readings
with its own markup can still read `readingLabels` and `massLabels`, but those are English. There is no
supported way to obtain a localized label without going through `renderReadings()`. That is the accepted
cost of this decision, not an oversight.

**The likely future answer is not these two statics but a consumer-supplied translation bundle** — letting
a developer attach their own labels, which serves both the consumer-markup case and any locale this
library never populates, and subsumes the accessor pair rather than duplicating it. Out of scope here; the
`Messages.js` lookup is behind one helper, so either direction stays open.

### D7 — Both widgets forward the locale they already hold

`LiturgyOfTheDay` and `LiturgyOfAnyDay` each validate a locale into `#locale` and then construct
`ReadingsRenderer` as a bare field initializer, passing nothing. The field initializer runs before the
constructor body, so the renderer must be constructed (or reconfigured) after `#locale` is known.

### D8 — This is a deliberate behaviour change, with no opt-out

Every non-English page using either widget starts rendering localized labels. That is the defect being
fixed, not a side effect, so it is recorded in the CHANGELOG under **Changed** rather than **Added**.

No opt-out flag: a consumer wanting English passes `'en'`, and the pre-existing `announceUpdates`-style
boolean pattern is not warranted for a component whose English output was never a deliberate choice.

Minor version — 2.11.0. Additive API, and the changed output is a bug fix.

### D9 — Translation scope: `en` authoritative, `it` and `la` for review

These are liturgical terms of art with canonical renderings in each language's Lectionary. A confidently
wrong Croatian "Responsorial Psalm" is worse for a reader than the English fallback, which `message()`
already provides and which CLAUDE.md documents as the normal case: the six `ApiOptions` keys added for
issue #59 are populated in twelve of the 84 blocks.

So: `en` written authoritatively; `it` and `la` drafted and **flagged in the PR for the maintainer to
verify against the Missal**; the remaining 81 blocks left to fall back. Adding locales later is purely
additive.

## Explicitly out of scope

- **The frontend's three copies.** `sanctorale.js`'s `SCHEMA_ORDER` and `temporale.js`'s
  `formatReadingKey()` are in another repo and another release cycle. This change makes absorbing them
  possible; it does not do it.
- **Sourcing labels from the API.** See D1. Worth revisiting if the API ever publishes them.
- **`renderReadings()`'s markup.** Unchanged, as in #97.
- **Localizing anything else that bypasses `Messages.js`.** The `MessageLookup.test.js` scan already
  covers the library's reads; this adds call sites that obey it rather than widening the audit.

## Testing

- `ReadingsRenderer.test.js` extends: the constructor's locale contract (both forms, nullish, rejection,
  unparseable); labels rendering localized under `it`; falling back to English under an unpopulated locale;
  the English fallback when a locale has no block for the key.
- **A hand-written second statement of the English maps**, asserting the derived `readingLabels` and
  `massLabels` equal an independently written literal — key order included. This is the
  `FilterInputs.test.js` pattern, and it is what makes D3's derivation safe: comparing the derived map to
  the catalogue it was built from would agree with itself.
- `Messages.test.js` gains coverage assertions for the 22 partly-translated keys, as it already does for
  the other partly-translated sets.
- Regression: `LiturgyOfTheDay` and `LiturgyOfAnyDay` render localized labels end to end.

## Documentation

- `docs/readings-renderer.md` — its "The labels are English. Localizing them is not yet implemented"
  paragraph becomes the localization section; add the message-key table and the two statics.
- `CLAUDE.md`'s `ReadingsRenderer` section — replace the third bullet (which records the gap) with the
  derivation rule from D3 and the key-order constraint.
- `CHANGELOG.md` — a `[Unreleased]` entry under **Changed**, per D8.
