# The `inputs` option, and `settled` on the constructor path

Design for issue #61. Two complementary changes, neither of which alters any default behaviour.

## The problem, restated

`settled` — the promise that observes `mountInto()`'s initial fetch, added in 2.6.0 for #45 — exists only on
the `mountInto()` path. Every real consumer is nevertheless on the **constructor** path, forced there by a
single line:

```javascript
viewer.controls.apiOptions._acceptHeaderInput.hide(); // flag read at append time
```

`AcceptHeaderInput.hide()` sets a flag that `ApiOptions.appendTo()` reads (`ApiOptions.js:1173`), so it is
only meaningful in the window between construction and the append — a window `mountInto()` does not expose.
`docs/meta-components.md` documents that window as the intended reason to avoid `mountInto()`, which leaves
the library telling consumers to take the path that withholds the signal built for them.

Two fixes, implemented together:

1. **Remove the reason.** Make the flag expressible in the options bag, so `mountInto()` covers the case.
2. **Remove the asymmetry.** Expose `settled` on the constructor path too, for anyone who stays there for
   some other reason.

## Fix 1 — the `inputs` option

### Shape: `inputs: { acceptHeader: false }`

Three shapes were weighed.

| Shape                            | Verdict                                                                                                                                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `acceptHeader: false` (flat)     | Rejected. Shortest, but reads ambiguously at the top level of a bag that already carries `locale`, `filter`, `theme`, `apiClient`, `signal`, `onError`, `initialFetch`, `webCalendar` — is `acceptHeader: false` a visibility toggle or "send no Accept header"? And a second such toggle would put `year`/`yearType` beside `filter` at the top level, where they read as values rather than as visibility. |
| `inputs: { acceptHeader: false }` | **Chosen.** Names its domain — which `ApiOptions` inputs render — and is extensible without further top-level keys. It has an exact precedent in this codebase: `CalendarViewer`'s `webCalendar: { … }` bag, a namespaced bag of child configuration whose unknown keys are rejected by name (`CalendarViewer.js`'s `#applyWebCalendarBag`). |
| `onBeforeMount( instance )` hook | Rejected. It is an open-ended escape hatch for arbitrary ordering-sensitive code — the very thing the meta-components exist to encapsulate — it cannot be validated at all (a hook is correct by construction), and it muddies `mountInto()`'s reject-versus-resolve contract, since a consumer callback throwing mid-mount would surface as a rejection indistinguishable from a library one. The concrete need here is one boolean. |

### Semantics

- `inputs.acceptHeader === false` hides the accept-header input; the meta-component calls
  `apiOptions._acceptHeaderInput.hide()` **in its constructor**, so both construction paths honour it
  (`ApiOptions.appendTo()` reads the flag whenever it runs).
- `true`, and the key's absence, are the default: the input renders exactly as it does today. Because
  `hide()` is irreversible and a freshly constructed input starts visible, `acceptHeader: true` is a no-op
  rather than an un-hide — documented as such.
- A key present with an explicit `undefined` value is treated as absent, matching `#applyWebCalendarBag()`
  and `resolveChildTheme()`.

### Validation — reject for programmer error

Following `assertTheme()` and the `webCalendar` bag:

- `inputs` that is not a plain object (and not `null`/`undefined`) throws, naming the component and the
  type found, via `describeType()`.
- Any key outside `{ acceptHeader }` throws, **naming the offending key**.
- A non-boolean value throws, naming the key and the type found.
- Validation runs before anything is mounted (the constructor runs before `appendTo()` in every
  `mountInto()`), so a rejected bag leaves nothing in the document.

The validator is a new internal module, `src/MetaComponents/InputVisibility.js`, exporting
`resolveInputVisibility( inputs, componentName )` → `{ acceptHeader: boolean }`. It is deliberately **not**
put in `Theme.js` (that module resolves styling, and is being edited on a sibling branch) and not in
`OptionsValidation.js` (which knows what shape an options *argument* may take, not what an `ApiOptions`
input is). It is not exported from `src/index.js`, on the same reasoning as `Theme.js`,
`LocaleValidation.js` and `OptionsValidation.js`.

### Which components take it

The option is honoured wherever the bundled `ApiOptions` can actually render the accept-header input —
which `ApiOptions.appendTo()` does only under the `ALL_CALENDARS`/`ALL_PATHS` and `NONE` filters:

| Component                | Takes `inputs`? | Why                                                                                              |
| ------------------------ | --------------- | -------------------------------------------------------------------------------------------------- |
| `CalendarControls`       | Yes             | Owns the `ApiOptions`; its filter defaults to `ALL_CALENDARS` and the caller may set it.         |
| `CalendarViewer`         | Yes             | Forwards its whole bag to `CalendarControls`.                                                    |
| `ApiExplorer`            | Yes             | Its `allPaths` slot appends under `ALL_PATHS`, which **does** render the input.                  |
| `SubscriptionBuilder`    | Accepted, inert | Forwards its bag, so the option is validated, but it pins its `ApiOptions` to `LOCALE_ONLY`.     |
| `DayViewer`              | No              | Builds its own `ApiOptions`, pinned to `LOCALE_ONLY`; the input never renders.                   |
| `CalendarResourcePicker` | No              | Has no `ApiOptions` at all.                                                                      |

**`ApiExplorer`'s default must not change.** It deliberately shows the accept-header input as part of its
path-building UI: `PathBuilder` listens to that select's `change` to set `return_type` in the composed URL.
The option lets a consumer turn it off; it is never off by default anywhere.

## Fix 2 — `settled` on the constructor path

### What it observes

`settled` becomes: **the most recent fetch this component itself issued** — the initial fetch on the
`mountInto()` path, or the latest `fetch()` call on the constructor path. Every clause of the published
contract is preserved:

- **Always resolves, never rejects, with `undefined`.** `fetch()` stores `promise.catch( () => {} )` — a
  handled derived branch. The promise the caller receives is unchanged and still theirs to handle, so no
  unhandled rejection is created or removed.
- **Always a promise**, already resolved before any fetch has been issued.
- **Stored after the existing `.catch`** on the `mountInto()` path: those factories keep their current
  assignment, which runs *after* `fetch()`'s own, so `settled` remains the error-delivering branch it is
  today and its resolution ordering relative to `onError()` is unchanged.
- **Throws once disposed**, via the existing `#assertUsable()` guard.

### Replacement, not accumulation

Each `fetch()` call **replaces** `settled`. A consumer who fetches twice wants to know when the latest one
finished; keeping only the first would make the property dead after one use, and combining them would
invent an "all fetches" semantics nothing asks for. Overlapping explicit fetches are the caller's own
business — they hold each promise.

`fetch()` throwing synchronously (no client wired) leaves `settled` untouched: no fetch was issued.

### What it still does not observe

Refetches driven by `ApiClient`'s own `listenTo()` change listeners — a user picking a different calendar
— are not observed, on either path. Those requests are issued inside `ApiClient` and the meta-component
never sees their promises. This is unchanged, and documented rather than papered over.

### Which components

`CalendarControls`, `CalendarViewer` and `DayViewer` — the three that already have `settled`.
`CalendarResourcePicker`, `ApiExplorer` and `SubscriptionBuilder` still have none, because none of them
fetches; that asymmetry is the documented rule, and nothing here changes it.

## Documentation

- `docs/meta-components.md`: the "**Use the constructor path when something must happen between
  construction and the mount**" passage cites this exact `AcceptHeaderInput.hide()` case and must be
  rewritten, not merely amended — the case it names no longer requires that path. Both worked examples
  that call `hide()` between construction and append switch to the option; `settled`'s section gains the
  constructor-path behaviour; each component's option table gains `inputs`.
- `CLAUDE.md`: the meta-components contract summary — `settled`'s clause, and a new note on the `inputs`
  bag beside the theme bag's.
- `CHANGELOG.md`: one `## [Unreleased]` entry, scoped to #61.
- `README.md`: no change — it does not document meta-component options.

## Out of scope

- Renaming or aliasing `_acceptHeaderInput` (#62, on hold).
- A `controls` slot keyed by filter (#63, on hold).
- Any change to `appendTo()`'s slot shapes.
- Making `AcceptHeaderInput.hide()` reversible, or giving `Input` a general `hide()`. Neither is needed
  here, and both would widen a public surface the issue does not ask about.
- Observing `ApiOptions`' synthetic change cascade (#55).
