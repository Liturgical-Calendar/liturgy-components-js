# Live-region announcements for `WebCalendar` and `LiturgyOfAnyDay` — design

Issue: [#65](https://github.com/Liturgical-Calendar/liturgy-components-js/issues/65).
Blocked on #59, which shipped as PR #74.

## The defect

`WebCalendar` replaces an entire table on every `calendarFetched`, and `LiturgyOfAnyDay` replaces its whole
event list whenever the date or the calendar changes. Both are driven by `<select>` changes, so focus stays on
the select and nothing tells a screen-reader user that several hundred rows underneath were just replaced —
there is no way to distinguish a successful update from a request that did nothing.

`aria-live` appears exactly once in `src/`, in `SubscriptionBuilder/SubscriptionUrl.js`, where 2.7.0 added a
visually-hidden polite region for a successful copy. That is the precedent this design follows.

## What is announced

A short summary, never the content. A live region holding the table would be catastrophic.

| Component         | Message key                                       | Rendered (en)                                |
| ----------------- | ------------------------------------------------- | -------------------------------------------- |
| `WebCalendar`     | `CALENDAR_UPDATED_ANNOUNCEMENT_ONE` / `..._OTHER` | `General Roman Calendar - 2026, 561 entries` |
| `LiturgyOfAnyDay` | `LITURGY_UPDATED_ANNOUNCEMENT`                    | `Liturgy for Friday, 14 August 2026 updated` |

`{calendar}` is **the same string the `<caption>` carries**, not a second derivation. `buildTable()`'s caption
branch — diocesan, national, rite-level — is extracted into a private `#captionText()` that both the caption
and the announcement call. That is what keeps the announcement consistent with what is on screen, and what
avoids a second set of calendar-name translations. It is computed even when `removeCaption( true )` hides the
caption element, because the announcement is not the caption.

`{date}` for `LiturgyOfAnyDay` is the string already in `#dateElement` — the same
`Intl.DateTimeFormat( locale, { dateStyle: 'full', timeZone: 'UTC' } )` output the widget displays.

### Pluralization

`{count}` is formatted with `Intl.NumberFormat`, and the noun comes from a key chosen by
`Intl.PluralRules( language ).select( count )`: the category is uppercased and appended to the base key, so
`one` reads `CALENDAR_UPDATED_ANNOUNCEMENT_ONE`. Lookup falls back, in order, to the same language's `_OTHER`,
then to English's category key, then to English's `_OTHER`. Only `_ONE` and `_OTHER` are populated, so a
language whose rules select `few`/`many` (Slovak at 2–4, for instance) takes its own `_OTHER` form. Each
`_OTHER` translation is therefore written in the form that language uses with a **large** count, which is the
only count a full liturgical year can produce — a `WebCalendar` payload with one entry exists in tests, not in
the API.

## Where the message lives

A new internal `src/MessageFormat.js`, not exported from `src/index.js` — the same standing as
`LocaleValidation.js`, `WrapperOptions.js` and `Theme.js`.

`Messages.js` already establishes the placeholder convention with
`AMBROSIAN_CALENDAR_CAPTION: 'Ambrosian Calendar - {year}'`, interpolated at three sites in
`WebCalendar.js` by `template.replace( /{(.*?)}/g, ( match, p1 ) => replacements[ p1 ] )`. `MessageFormat.js`
lifts exactly that syntax and regex into `interpolate()`, adds the `Messages[ language ]?.[ KEY ] ??
Messages[ 'en' ][ KEY ]` fallback each call site already applies, and adds the plural selection above. It is
not a second convention; it is the existing one with one home.

`InputLabels.js`'s `defaultLabelText( key, locale )` (from #59) is left alone: it resolves a label from a fixed
key with no placeholders, which is a different job, and it is reached from constructors rather than from
render paths.

The three existing caption sites in `WebCalendar.js` keep their inlined regex. Converting them is a pure
refactor of shipped behaviour with its own regression surface, and #65 is not the change that should carry it.
This is recorded as a follow-up rather than done here.

## Where the region lives

`src/LiveAnnouncer.js` — also internal, also unexported. It owns one thing: a visually-hidden
`<span role="status" aria-live="polite" aria-atomic="true">` plus `mountInto()`, `announce()`, `clear()` and
`dispose()`. The hiding technique is `SubscriptionUrl`'s, verbatim (absolute, 1×1, `overflow: hidden`,
`clip: rect(0 0 0 0)`), so there is one implementation of it rather than three.

`SubscriptionUrl` is converted to use it. Its region gains `role="status"` and `aria-atomic="true"`, which
it did not set; both are additive and its existing tests query `[aria-live="polite"]`, which still matches.
Its own lifecycle — announce on the **first** copy, self-clear after two seconds, mounted as a sibling of the
button by `SubscriptionBuilder.appendTo()` — stays in `SubscriptionUrl`. `LiveAnnouncer` therefore holds no
policy about _when_ to announce; "first render" is a concept only the two renderers have.

### It must not be removed and re-inserted

A live region that is inserted into the DOM in the same task as its text is not reliably announced — the
region has to be present before the content changes. That constrains the mount:

- **`LiturgyOfAnyDay`** appends the region to its own `#domElement` in the constructor. `#renderEvents()`
  only clears `#eventsElementsWrapper`, so the region is never touched.
- **`WebCalendar`** is the awkward one: its `calendarFetched` handler does
  `#attachedElement.replaceChildren( #domElement )`, which would wipe a sibling region on every render. The
  swap becomes: remove every child **except** the region, append the region if it is not mounted yet, then
  `insertBefore( table, region )`. With announcements disabled that reduces to exactly the previous
  `replaceChildren` semantics — the consumer's placeholder content is still cleared on first render.
  The region is the target's **last** child, so `firstElementChild` is still the table.

## When it announces

- **Not on the first render.** A live region that fires as the page loads talks over whatever the page is
  already announcing, and the user did not act. Each component skips its first announcement; the region's
  `textContent` stays empty until the second render. This also disposes of the "must exist before the
  content changes" problem for free, since the first render is what mounts the region.
- **Once per user action.** Confirmed, not assumed, by a test that counts renders per action through the
  same wiring `ApiClientRequestCoalescing.test.js` uses: one rite change, one calendar change and one locale
  change each produce exactly one `calendarFetched` and one announcement. Coalescing (2.5.0) is what makes
  this true.
- **`LiturgyOfAnyDay` has one path that renders twice per action**, and it is not the client's. A year
  change renders immediately from the cached (previous-year) payload and _then_ issues a refetch whose
  response renders again — two renders, and both would announce the same date. The widget therefore sets a
  `#refetchPending` flag when its year listener issues a refetch and clears it when the response lands;
  renders while it is set do not announce. The intermediate render is showing data for a year the user has
  already left, so suppressing it is correct on its own terms.

## The opt-out

A boolean `announceUpdates`, **default `true`**, as a constructor option and as a chainable setter on both
components. Non-boolean throws, naming the component.

Default-on because an accessibility fix that is off by default fixes nobody: the consumers who need it are
the least likely to know the option exists. The cost of the default is a double announcement for a consumer
who already owns a live region for the surrounding page, who is by construction a consumer who knows what a
live region is and can turn this one off.

A boolean rather than a bag: the message is already localized through `Messages`, so the only thing a bag
would carry is a custom template, and a consumer who wants their own wording can turn this off and own their
own region. Widening a boolean to a bag later is backward compatible.

**No meta-component option.** `CalendarViewer` and `DayViewer` expose their child (`.webCalendar`,
`.liturgyOfAnyDay`), so `viewer.webCalendar.announceUpdates( false )` is available and works after mounting,
since the setter is not construction-time-only. Adding a seventh option key to the meta-components' bags
would collide with issue #78's work on their validation for no reach that consumers do not already have.

## `LiturgyOfTheDay` is deliberately excluded

It is not named in the issue, and it does not have the defect as described. `#updateEventDetails()` **appends**
to `#eventsElementsWrapper` and never clears it, so a second `calendarFetched` duplicates the day's events
rather than replacing them. Announcing "updated" over a component that is accumulating rather than replacing
would describe a state that is not what happened. The widget is also pinned to today's date and exposes no
controls of its own, so the select-driven silence #65 describes does not arise from anything it owns. The
duplication is a real, separate defect; it is recorded as a follow-up, not fixed under #65.

## Known limitation, recorded rather than hidden

`LiturgyOfAnyDay`'s announcement names the date but not the calendar. When only the calendar or the rite
changes and the date stays put, the text is identical to the previous announcement and a screen reader may
not repeat it. Naming the calendar would mean giving the widget the three-branch caption derivation _and_
rite tracking, which `WebCalendar` has and it does not — a larger change than #65 asks for. Recorded as a
follow-up.

## Testing, and what it proves

New suites assert on the DOM the components produce:

- the region exists, is a child of the expected element, and carries `role="status"`,
  `aria-live="polite"`, `aria-atomic="true"` and the clip-based hiding styles;
- its `textContent` is empty after the first render and carries the expected summary after the second;
- the summary is localized, interpolated and pluralized as specified;
- `announceUpdates( false )` mounts no region at all, and removes one already mounted;
- `WebCalendar`'s region survives the table swap — the same node object, still a child, across renders;
- one user action produces exactly one announcement, driven through real `change` events.

**This verifies structure, not speech.** No test here proves a screen reader announces anything: jsdom has no
accessibility tree and no AT. What the tests pin down is that the markup a screen reader needs is present,
correctly attributed, stable across re-render, and updated exactly once per action. Verifying the announcement
itself needs a real browser and a real screen reader, and is out of scope.
