# SubscriptionBuilder — meta-components phase 3

Phase 3 of the meta-component family, and the answer to
[issue #42](https://github.com/Liturgical-Calendar/liturgy-components-js/issues/42).

`SubscriptionBuilder` is the sixth meta-component and the only one that is a **new feature** rather than
an extraction of wiring the library already had. It bundles the rite, calendar and locale selects with a
rendered iCal subscription URL and a copy control, replacing the hand-rolled card in
`LiturgicalCalendarFrontend`'s `usage.php`.

## The problem

`usage.php`'s calendar-subscription card lets a visitor pick any calendar and copy an iCal subscription
URL. It is assembled by hand from three pieces:

- `usage.js`'s `buildCalendarControls()` — a `RiteSelect`, an unfiltered `CalendarSelect` with
  `allowNull( true )`, and `linkToRiteSelect()`;
- `assets/js/subscriptionUrl.js` — a **near-duplicate of the library's own
  `src/PathBuilder/CurrentEndpoint.js`**, defining the same `CalendarType`, the same `RequestPayload`
  with the same seven fields, and the same `CurrentEndpoint` with the same `serialize()`, down to the
  same explanatory comment about emitting `/roman` explicitly;
- `usage.js`'s `copyUrlToClipboard()` and `selectUrlOnMouseUp()` — a clipboard write with an
  `execCommand` fallback, reporting through **toastr**.

The duplication is not accidental. `subscriptionUrl.js`'s own docblock explains it: "`@liturgical-calendar/components-js`
resolves only through the browser importmap, so importing it here would break the Vitest suite." That is
a test-harness constraint, not a design one, and it dissolves once the library owns the whole card.

### Issue #42, and what it actually needs

Issue #42 asks whether `CalendarResourcePicker` should gain a browse/subscribe mode for this card, and
correctly anticipates that it "is arguably a different component". [#44](https://github.com/Liturgical-Calendar/liturgy-components-js/pull/44)
answered that it is, and recorded three requirements for this component: an all-calendars scope, a
**selectable and labelled** empty option carrying the rite-level calendar, and the rite select offered
for that scope.

**All three are already satisfied by `CalendarControls`.** Its `CalendarSelect` is constructed with
`allowNull: true` and **no filter** (`CalendarControls.js:175-179`) — an unfiltered list of nations and
dioceses in one grouped list, with a real selectable empty option — and it bundles a `RiteSelect`
alongside. So the picker half of #42 needs no new code at all; only the URL half is new.

## Composition

```text
SubscriptionBuilder
├─ CalendarControls( bag )                     ← rite + calendar + ApiOptions
│   ├─ CalendarSelect: allowNull, unfiltered     ← issue #42, already true
│   ├─ apiOptions.filter( LOCALE_ONLY )
│   ├─ linkToCalendarSelect() + linkToRiteSelect()
│   └─ listenTo() NEVER called                   ← never fetches
└─ SubscriptionUrl (internal, not exported)
    ├─ borrows apiOptions._currentEndpoint
    ├─ return_type pinned to ICS, year_type CIVIL
    ├─ scheme: 'https' (default) | 'webcal'
    └─ copy control
```

This is `ApiExplorer`'s template exactly: construct a `CalendarControls`, wire the rite→calendar chain by
hand with `linkToCalendarSelect().linkToRiteSelect()`, and never call `listenTo()`, so no `ApiClient`
listener is ever installed and no calendar request is ever issued. `ApiExplorer.js:85-101` is the
reference implementation.

`CurrentEndpoint` is **instance** state in the library — unlike `subscriptionUrl.js`'s static copy — owned
by `ApiOptions` as `_currentEndpoint` and _borrowed_ by renderers (`PathBuilder.js:79` does exactly this).
`SubscriptionUrl` borrows the same way, so two builders on one page never share endpoint state.

## Decisions

### The URL renderer is dedicated, not a mode on `PathBuilder`

`PathBuilder`'s button navigates to the API, and its `return_type` is user-selectable. Both are actively
wrong for a subscription, which must always be ICS and must never navigate. Adding a mode flag would make
three of `PathBuilder`'s behaviours conditional — the same argument that kept #42 out of
`CalendarResourcePicker`, applied to the renderer instead of the picker.

What is genuinely shared is the URL _model_, and that is already extracted: `CurrentEndpoint`.
`SubscriptionUrl` uses it directly. `PathBuilder` is not modified by this work. A further benefit:
`SubscriptionUrl` can have a real `dispose()`, which `PathBuilder` lacks (noted at `ApiExplorer.js:308`).

### The locale select is a control, not an option

A subscription URL **cannot carry an `Accept-Language` header** — a calendar app simply GETs the URL — so
the selected language has to travel as `?locale=…`. `ApiOptions` filtered to `ApiOptionsFilter.LOCALE_ONLY`
and linked to the calendar select already narrows its options to the locales the selected calendar
supports, and `PathBuilder.js:239-240` already demonstrates feeding that input's value into
`requestPayload.locale`. `SubscriptionUrl` does the same.

This also resolves a naming collision cleanly: the component's `locale` option keeps its library-wide
meaning of "the component's own display locale", and the subscription's language comes from a UI control
rather than a second option competing for the same word.

### Query parameters are fixed

`return_type=ICS` is pinned — it is what makes the URL a subscription — and `year_type=CIVIL` matches what
the card sends today. The remaining `RequestPayload` fields (`epiphany`, `ascension`, `corpus_christi`,
`eternal_high_priest`) stay unset, exactly as `usage.js` leaves them. No `params` option: every key in
such a bag would be unused on arrival, and a subscription URL carrying mobile-feast overrides is a feature
nobody has asked for. If one is wanted later it arrives with a real use case attached.

### `scheme: 'https' | 'webcal'`

Defaults to `'https'`, which is what the card emits today and what all four of its platform-instruction
tabs tell users to paste. `'webcal'` rewrites the leading scheme after serialization, for consumers who
want a link that opens the OS calendar application directly.

The option exists rather than the `https`-only status quo because the two forms serve genuinely different
interaction models — copy-then-paste versus click-to-subscribe — and a consumer building the second should
not have to string-replace the library's output.

### The copy control's wrapper **is** the button

The current card renders `<div role="button" title="Click to copy to the clipboard!">` with a click
handler. The discoverability design is good — the tooltip, the pointer cursor and the clipboard glyph make
the affordance obvious, and a whole-box click is the right target for a short URL presented as a thing to
take (npm's install box works this way).

The defect is elsewhere: **`role="button"` on a `<div>` with no `tabindex` and no key handler is worse
than no role at all.** A screen reader announces a button that cannot be focused and cannot be activated,
because Enter and Space do nothing without a handler.

The fix is to make the wrapper a real `<button type="button">` with the `<code>` inside it — valid HTML,
since `<code>` is phrasing content. Whole-box click, pointer cursor and tooltip are unchanged; keyboard
focus, Enter/Space activation and a correct accessibility tree come for free; and no `role` attribute is
needed. **There is no UX trade-off** — the earlier draft of this design proposed a separate small copy
button, which would have shrunk the click target to fix a problem that was never about the click target.

`type="button"` is explicit so the control never submits a surrounding form.

One consequence for consumers: a `<button>` carries default browser chrome and does not fill its container
the way a `<div>` does. The library renders it unstyled; `usage.php`'s existing
`text-center bg-light border border-info rounded p-2` still applies and will likely want `w-100` added.

Partial text selection is not a loss here: `selectUrlOnMouseUp()` already selects the _entire_ contents on
mouseup, so selecting a substring was traded away deliberately long ago. That behaviour is preserved.

### The icon is an inline SVG, overridable

The library ships a small inline SVG clipboard glyph: no font, no stylesheet, no network request, so the
component is genuinely framework-agnostic and the affordance works out of the box. A `copyIcon` option
takes an HTML string to replace it — letting `usage.php` keep its exact
`<i class="fas fa-clipboard float-end text-info"></i>` — or `null` for no glyph.

Injection uses `createContextualFragment`, the same path `Input.labelAfter()` already uses for
consumer-supplied markup.

### Copy feedback: a built-in default plus a callback

`onCopy( ok, error )` lets `usage.php` keep routing to toastr exactly as it does now. Without a default,
though, a consumer who registers nothing gets a control that appears to do nothing — reopening by another
route the accessibility gap the `<button>` change closes. So the control also toggles a CSS class for
roughly two seconds and announces the outcome through an `aria-live="polite"` region. No notification
library, no styling opinion beyond a class name the consumer can theme.

## Public API

```javascript
const sub = await SubscriptionBuilder.mountInto(
    { controls: '#subscriptionControls', url: '#calSubscriptionUrlWrapper' },
    {
        locale: 'it',
        apiClient,
        scheme: 'https',
        copyIcon: '<i class="fas fa-clipboard float-end text-info"></i>',
        copyTitle: Messages['Click to copy to the clipboard!'],
        copiedText: Messages['URL copied to clipboard'],
        onCopy: (ok, error) =>
            ok
                ? toastr.success(Messages['URL copied to clipboard'])
                : toastr.error(Messages['Failed to copy URL']),
        theme: { select: 'form-select', label: 'form-label', wrapper: 'form-group col-md' },
    },
);

sub.url; // the serialized subscription URL
sub.onChange((url) => {}); // fires whenever it changes
sub.riteSelect;
sub.calendarSelect;
sub.localeInput;
sub.controls; // the underlying CalendarControls
sub.dispose();
```

A synchronous constructor exists too, per the family contract, paired with `appendTo( slots )` — usable
when the `ApiBase` is already known to be ready.

**No `settled`, no `onError`, no `initialFetch`.** This component never fetches a calendar, so it has none
of the three, exactly as `ApiExplorer` has none of them. The `apiClient` option binds the selects to that
client's API base so they populate from `/calendars` metadata; it is never used to fetch a calendar.

## Slots and layout

`{ controls, url }`, both **required**. A bare target is rejected, matching `CalendarViewer` and
`ApiExplorer`: there is more than one mandatory mount, and a lone target would have to pick one silently.
An unknown slot name is rejected, naming it.

`usage.php` currently places the rite and calendar selects in two sibling `.form-group.col-md` divs. Those
do **not** become slots. All three controls mount into the single `controls` container, which the consumer
styles as the row, and each child receives its column class through the theme bag's wrapper keys — the
flat `wrapper` key for all three, or per-child `riteSelect` / `calendarSelect` / `localeInput` overrides.

## Theming

The standard role vocabulary (`select`, `label`, `input`, `wrapper`) plus per-child override keys named
for this component's public getters: `riteSelect`, `calendarSelect`, `localeInput`. Resolution is
`Theme.js`'s, unchanged.

The URL half adds one per-child key, `subscriptionUrl`, accepting `class` (on the `<button>` wrapper),
`codeClass` (on the `<code>`) and `copiedClass` (the transient class toggled on a successful copy,
defaulting to a library-owned name).

## Messages

Two new keys, `COPY_TO_CLIPBOARD` and `COPIED_TO_CLIPBOARD`, added to **all twelve** locale blocks in
`Messages.js` (de, en, es, fr, hu, id, it, la, nl, pt, sk, vi) — `SELECT_A_RITE` is translated in every one
of them, so partial coverage would be a regression in this file's standard rather than a continuation of
it. The `copyTitle` and `copiedText` options override them, so `usage.php` keeps its own gettext strings.

Note for implementation: `CLAUDE.md` claims thirteen languages while `Messages.js` has twelve locale
blocks. Count before editing, and correct whichever is wrong as a side fix.

## Errors

`mountInto()` **rejects** on invalid options (an unparseable locale, an unknown slot name, an unknown
`scheme`, a target matching nothing) and on metadata that cannot be loaded at all. The second matches
`CalendarControls`, `CalendarViewer` and `ApiExplorer` and for the same reason: this bundles a whole form,
and a rite select and calendar select with no calendars to list are not a smaller working form but no form
at all. It does **not** grow a failure control like `CalendarResourcePicker`'s, which substitutes for a
single required field.

A clipboard failure is not a mount failure: it reports through `onCopy( false, error )` and the built-in
transient state, and never rejects anything.

## `dispose()`

Idempotent; further use throws. Releases every listener the builder itself attached — the rite, calendar
and locale `change` listeners, and the copy control's `click`. Subject to the same documented,
pre-existing gap as the rest of the family: anonymous listeners installed inside
`ApiOptions.linkToCalendarSelect()` and `linkToRiteSelect()` are not reachable and are not released.

## Testing

Two new suites.

`SubscriptionUrl.test.js` — the renderer in isolation:

- serialization for a rite-level, a national and a diocesan target, under both rites
- the empty option serializing to `/calendar/roman` and `/calendar/ambrosian`, i.e. issue #42's
  requirement that empty is a _meaningful, selectable_ choice
- `return_type=ICS` present and not overridable; `year_type=CIVIL`
- the locale select reaching the query as `?locale=…`
- `scheme: 'webcal'` rewriting the leading scheme, and leaving the rest of the URL byte-identical
- copy success; the `execCommand` fallback when `navigator.clipboard` is absent; failure on both paths
- `onCopy` firing with `true` and with `false` plus an error
- the built-in transient class and the `aria-live` announcement
- `copyIcon` default, override and `null`
- the wrapper being a `<button type="button">`, focusable, and activating on Enter — the regression test
  for the accessibility defect

`SubscriptionBuilder.test.js` — the composition:

- both slots required; a bare target rejected; an unknown slot rejected, naming it
- rite, calendar and locale changes each re-rendering the URL
- **no request is ever issued**, mirroring `ApiExplorer`'s equivalent assertion, including after every
  control has been changed
- `mountInto()` rejecting for each invalid-option case and for unloadable metadata
- `dispose()` idempotency, and that a disposed instance throws
- the theme bag reaching all three children plus the URL wrapper

## Frontend migration

Out of scope for this repository, but the target state is what justifies the design. `usage.php` /
`usage.js` would delete:

- `assets/js/subscriptionUrl.js` entirely — the duplicated `CurrentEndpoint`
- `buildCalendarControls()`
- `copyUrlToClipboard()` and `selectUrlOnMouseUp()`
- `updateSubscriptionURL()` and its listeners

and keep its four platform-instruction tabs, which are prose and belong to that page.

## Non-goals

- **The platform tabs.** `usage.php`'s Google / iPhone / Android / Outlook tabs are Bootstrap tabs
  containing per-platform _instructions_, not deep links. They are documentation and stay there.
- **A `params` option.** See "Query parameters are fixed" above.
- **Modifying `PathBuilder`.** See "The URL renderer is dedicated" above.
- **The `LiturgicalCalendarFrontend` migration**, which belongs in that repository with its own review.

## Delivery

Ships as **2.7.0**: additive, no existing component API changes. `PathBuilder`, `CalendarControls` and
`ApiExplorer` are untouched; `Messages.js` gains two keys.
