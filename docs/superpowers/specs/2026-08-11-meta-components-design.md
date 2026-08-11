# Meta-components: bundled components and wiring — design

Phase 1 of a family. This spec covers the shared contract plus two meta-components:
`CalendarResourcePicker` and `DayViewer`.

## Problem

`LiturgicalCalendarFrontend` has five distinct consumers of this library, and each one re-derives the
same wiring by hand. The repetition is structural, not stylistic:

| Repeated block                                                               | Where                                                                                                | Size                                                                   |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `RiteSelect` + filtered `CalendarSelect` + placeholder + failure fallback    | `assets/js/admin-permissions.js:124-203`, `permission-requests.js:226-300`, `admin-tests.js:520-555` | ~80 lines x 3, near-identical down to the comments                     |
| `ApiOptions(PATH_BUILDER)` + `CalendarSelect` + `RiteSelect` + `PathBuilder` | `assets/js/index.js:16-86`                                                                           | ~70 lines                                                              |
| `ApiOptions` + selects + `ApiClient` + `WebCalendar` + messages table        | `examples/javascript/main.js`                                                                        | ~110 lines                                                             |
| `CalendarSelect` + `RiteSelect` + `LOCALE_ONLY` + `LiturgyOfAnyDay`          | `assets/js/liturgyOfAnyDay.js:109-239`                                                               | ~130 lines, plus a 90-line copied translation map                      |
| Calendar subscription URL builder                                            | `assets/js/usage.js:10-80`                                                                           | ~70 hand-rolled lines duplicating `src/PathBuilder/CurrentEndpoint.js` |

Two things make this more than a DRY exercise.

**The wiring has silent-failure traps the library documents but cannot enforce.** A rite needs _two_
wires — `linkToRiteSelect()` **and** `listenTo()`. Wire only the first and the form reads `ambrosian`
while every request still goes to `/calendar/roman/`. The select must also be in the DOM _before_
`linkToRiteSelect()`, which reads the element to attach its change listener. Every consumer carries a
paragraph-long comment explaining these. Those comments are the design smell: they mark an
abstraction that should exist and does not.

**Every consumer reaches into private fields.** `_localeInput`, `_domElement`, `_labelElement`,
`_titleElement` and `_eventBus` all appear in frontend code. The current public API is not sufficient
to build a real page, so the encapsulation is nominal.

The same pressure is visible inside this repository. `src/stories/1_CombinedComponents/` holds four
hand-wired combinations, and `0_Components/` carries `CalendarSelectBootstrap.stories.js` and
`ApiOptionsBootstrap.stories.js` — theming by duplicating the story. Both are the informal version of
what this spec proposes.

## Approach

The library gains **meta-components**: objects that own a fixed, tested wiring of existing components
and expose the wired children publicly. Styling stays entirely with the consumer, through a theme bag
for the common case and the child instances for everything else.

Division of responsibility, decided up front:

- **The library** owns wiring, ordering, failure behaviour and defaults. It ships nothing
  framework-specific and takes no position on CSS.
- **The consumer** owns appearance, passing a theme bag whose vocabulary is HTML roles
  (`select`, `label`, `wrapper`, `input`), never framework names.

The alternative considered and rejected was a frontend-local `assets/js/components/` layer. It would
be faster and could hardcode Bootstrap and jQuery, but it leaves the wiring traps unenforced for every
other consumer — the CDN examples in `examples.php`, the Storybook combinations, and any third party
embedding the widgets. The traps are library-level problems and belong in the library.

Also rejected: shipping `Preset.bootstrap5` / `Preset.vanilla` presets in the library. It would shrink
the frontend further, but the library would start holding opinions about a CSS framework it does not
depend on and cannot test against.

No base class. A shared internal module resolves themes; each meta-component is otherwise standalone.
A `MetaComponent` base inheriting behaviour across two very different shapes — a pure form control and
a fetching widget bundle — is how this kind of library accretes a god object.

## The shared contract

New directory `src/MetaComponents/`, exported from `src/index.js`. One shared internal module,
`src/MetaComponents/Theme.js`, whose sole job is resolving a theme bag into per-child class strings.
It is not exported, on the same reasoning as `LocaleValidation.js` and `OptionsValidation.js`:
internal contract between components, not public API.

### Theme bag

```js
theme: {
    select:  'form-select',                      // flat default for every child of that role
    label:   'form-label mb-1',
    wrapper: 'form-group col col-md-3',
    input:   'form-control',
    riteSelect: { class: 'form-select mb-2' }    // per-child override, wins over the flat default
}
```

Per-child keys are named for the child getters (`riteSelect`, `calendarSelect`, `localeInput`,
`liturgy`, `dateControls`), so the override key and the escape-hatch getter are the same word.
Omitting `theme` yields unstyled markup.

Resolution order per child, most specific first: per-child key, flat role default, nothing. A
per-child value may be a bare string (shorthand for `{ class: … }`) or an object carrying `class`,
`labelClass`, `wrapperClass` and `wrapper`.

### Options and locale

The options bag goes through the existing `normalizeComponentOptions()` (`src/OptionsValidation.js`)
and `validateLocale()` (`src/LocaleValidation.js`). `locale`, `apiClient` and the
`string | Intl.Locale | null` contract therefore behave identically to every other component,
including multi-base binding via `apiClient`.

### Construction and mounting

Each meta-component has a **sync constructor** and a **static async factory**:

- `new X(options)` — synchronous, requires an already-initialised `ApiBase`, exactly as
  `CalendarSelect` does today. `appendTo()` returns `undefined`, so the library's documented
  `appendTo()` contract is unbroken.
- `X.mountInto(target, options)` — returns a promise. Awaits the client, constructs, mounts, and
  installs the failure control on runtime failure. This is what every real call site needs.

`theme` is a constructor option, not a chainable `.theme()`. Children are constructed and wired in the
constructor, so a late theme swap would mean rebuilding them. Post-construction changes go through the
getters.

### Error handling

Programmer error and runtime failure are treated differently:

| Kind                                                                | Behaviour                                                           |
| ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Invalid options (unparseable locale, unknown filter, missing mount) | **Rejects**, matching the library's 2.0.0 direction                 |
| Runtime failure (API down, metadata unparseable)                    | **Resolves** with the component in a failed state, control rendered |

The second is deliberate. These mount into forms where an empty container is indistinguishable from
"still loading"; the only symptom is a Playwright `waitFor` timing out ten seconds later with nothing
to point at. This reasoning is already recorded at `permission-requests.js:158-165`.

## `CalendarResourcePicker`

New file `src/MetaComponents/CalendarResourcePicker.js`. Bundles a `RiteSelect` and a filtered
`CalendarSelect` into one mount.

The three existing copies differ only in class strings, one marker class or id, the log prefix, and
the staleness guard. The logic — including the comments — is otherwise identical, so one component
covers all three.

```js
const picker = await CalendarResourcePicker.mountInto('#grantObjectIdMount', {
    locale: LITCAL_LOCALE,
    filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
    placeholderText: config.i18n.selectCalendarId,
    errorText: config.i18n.calendarIdLoadFailed,
    signal: scopeChange.signal,
    theme: {
        select: 'form-select form-select-sm perm-object-id',
        riteSelect: { class: 'form-select form-select-sm mb-2 perm-object-rite' }
    }
});
picker.calendarSelect.id('grantObjectId');
```

### Behaviour absorbed

Each item below is traceable to a live comment in the frontend:

- **The rite select is offered for diocesan filters only.** The Ambrosian rite has no national tier,
  so a `nations`-filtered select under it holds only the rite-level calendar and hides itself,
  stranding the user with a required field they cannot fill. Derived from `filter` rather than left to
  the caller to remember.
- **Append-then-link ordering**, which `linkToRiteSelect()` requires.
- **Placeholder re-application on every rite change.** `linkToRiteSelect()` rebuilds the option list
  from scratch and discards the disabled-empty-option customisation. Three files currently re-register
  this listener by hand.
- **The failure control.** A disabled `is-invalid` select carrying `errorText` and
  `dataset.loadFailed`, keeping the theme's marker classes so form validation and the Playwright suite
  still find the element.

`allowNull(true)` plus a disabled, selected, empty placeholder option is the default: an empty value
semantically means "General Roman Calendar", which is never a valid national or diocesan resource id.

### Staleness

The three copies guard differently (`row.isConnected`, `grantObjectType.value !== objectType`) against
a scope change landing while the client resolves. A standard `AbortSignal` passed as `signal` covers
both; the picker additionally self-cancels if its mount has left the DOM.

### Public surface

| Member             | Purpose                                                 |
| ------------------ | ------------------------------------------------------- |
| `calendarSelect`   | the wired `CalendarSelect` instance                     |
| `riteSelect`       | the wired `RiteSelect`, or `null` for a national filter |
| `value`            | selected calendar id                                    |
| `failed`           | `true` when the failure control is mounted              |
| `onChange(cb)`     | selection changes                                       |
| `appendTo(target)` | returns `undefined`, per library convention             |

Native change events continue to bubble to the mount; `admin-tests.js:692` depends on that.

## `DayViewer`

New file `src/MetaComponents/DayViewer.js`. Bundles `CalendarSelect`, `RiteSelect`, an
`ApiOptions(LOCALE_ONLY)` locale input and `LiturgyOfAnyDay`, wired to an `ApiClient`.

### Slots

`liturgyOfAnyDay.php` mounts its parts into four separate containers, so a single `appendTo(target)`
cannot express the page. The target may be a slots object or a single target:

```js
const viewer = await DayViewer.mountInto({
    rite:     '#riteSelectContainer',
    calendar: '#calendarSelectContainer',
    locale:   '#localeSelectContainer',
    liturgy:  '#liturgyOfAnyDayContainer'
}, {
    locale: currentLocale.language,
    showTitle: false,
    theme: {
        select: 'form-select',
        label:  'form-label',
        liturgy: { class: 'card shadow m-2', eventClass: 'liturgy-event p-3 mb-2 rounded' },
        dateControls: { wrapper: 'div', wrapperClass: 'col-md', class: 'form-control' }
    }
});
```

A string target mounts everything into one container, which is what a third party embedding the widget
wants. An omitted slot means that part is not rendered.

### Behaviour absorbed

- **Both rite wires** — `linkToRiteSelect()` for the calendar-list rebuild and temporal-option
  disabling, `listenTo()` on the client for the path segment.
- **General Roman Calendar as the default selection** rather than Vatican, per the root `CLAUDE.md`.
- **The locale matching cascade** — exact match, then language-prefix match, then first option.
  Currently 15 lines in `liturgyOfAnyDay.js` and also written out prose-style in the root `CLAUDE.md`.
  Result exposed as `viewer.selectedLocale`.
- **Initial fetch** with its rejection handled, surfaced through `onError(cb)` and the existing
  `calendarFetchFailed` event, so it never falls back to `console.error` behind the caller's back.
- **`showTitle: false`**, replacing `liturgyOfAnyDay._titleElement.style.display = 'none'`.

### Message keys

`liturgyOfAnyDay.js:19-104` carries a 90-line hand-copied translation map for _day / month / year /
language_, introduced because `Messages` is not exported. `LiturgyOfAnyDay` supplies no default labels
for its day, month and year inputs (`src/LiturgyOfAnyDay/LiturgyOfAnyDay.js:819-898` apply `labelText`
only when the caller passes one), which is what forced the copy.

Current coverage in `src/Messages.js`, which holds 84 locales:

| Key                                                | Coverage                                        |
| -------------------------------------------------- | ----------------------------------------------- |
| `SELECT_A_CALENDAR`, `MONTH`, `LITURGY_OF_THE_DAY` | 84 / 84                                         |
| `SELECT_A_RITE`                                    | 12 / 84 — `de en es fr hu id it la nl pt sk vi` |
| `DAY`, `YEAR`, `LANGUAGE`                          | absent entirely                                 |

Add `DAY`, `YEAR` and `LANGUAGE` **for the same 12 locales that already carry `SELECT_A_RITE`**, with
English fallback beyond. That set is exactly the languages the frontend serves, it matches the
existing precedent rather than inventing a second coverage rule, and it deletes all 90 copied lines.
Translating three new keys into the other 72 locales is a much larger, mostly speculative job, and
machine-translated liturgical UI is not worth the risk.

`Messages` stays unexported. The meta-component consuming it internally is the point.

### Public surface

| Member                                                   | Purpose                        |
| -------------------------------------------------------- | ------------------------------ |
| `calendarSelect`, `riteSelect`, `localeInput`, `liturgy` | the wired child instances      |
| `apiClient`                                              | the bound client               |
| `selectedLocale`                                         | result of the matching cascade |
| `onError(cb)`                                            | fetch failures                 |
| `appendTo(target)`                                       | returns `undefined`            |

## Testing

Jest 30 with jsdom, ESM via `--experimental-vm-modules`. Bases are built with
`ApiBase.fromMetadata(url, metadata)` against the `FULL_METADATA` fixture, with `ApiBase.reset()` in
`beforeEach`, so no test touches the network.

Beyond per-option coverage, three tests pin the bugs that motivated the work:

1. A rite change on `DayViewer` produces a request to `/calendar/ambrosian/…`, not `/calendar/roman/…`.
   This is the silent failure the two-wire requirement exists to prevent, and nothing currently
   tests it.
2. The picker's placeholder survives a rite change.
3. A rejected metadata load leaves a disabled, `is-invalid`, theme-classed control in the mount rather
   than an empty container.

`yarn lint:dts` must pass. These add real public API and `checkJs` is off, so a green `yarn compile`
proves nothing about whether the emitted `.d.ts` is valid for a downstream TypeScript consumer.

One Storybook story per meta-component, rendered twice from one source with different theme bags —
Bootstrap and unstyled — replacing the duplicate-story pattern in `0_Components/`.

## Delivery

Library ships as **2.2.0**: purely additive, no existing component API changes.

The frontend migration is a separate follow-up, because `examples.php` pins the CDN version. It
updates four files: `admin-permissions.js`, `permission-requests.js`, `admin-tests.js` and
`liturgyOfAnyDay.js`.

Incidental fix while in the area: the comment at `assets/js/index.js:49-50` claims the library
translates `SELECT_A_RITE` "for en and it so far". It is 12 locales.

## Non-goals

- `CalendarViewer`, `ApiExplorer` and `SubscriptionBuilder` — phase 2, their own spec.
- Exporting `Messages`.
- Translating the new keys beyond the 12 locales.
- Parity work in `liturgy-components-php` or `liturgy-components-react`.
- Any change to existing component APIs.
- Bootstrap or other framework presets shipped from the library.
