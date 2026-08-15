# Public, non-underscore `ApiOptions` accessors — design

Issue: [#62](https://github.com/Liturgical-Calendar/liturgy-components-js/issues/62)
Date: 2026-08-15
Status: approved (design calls delegated to the implementer)

## Problem

`ApiOptions` exposes fourteen getters and every one is underscore-prefixed. Ten of them are the documented,
expected way for a consumer to reach an individual form control — `docs/api-options.md` calls
`_acceptHeaderInput.hide()` in a worked example, and `docs/meta-components.md` directs consumers to
"reach the individual inputs directly through `controls.apiOptions`". The prefix conventionally announces
"private, do not touch", so it invites exactly the wrong conclusion: on `Liturgical-Calendar/examples#49` an
automated reviewer recommended replacing all five uses with "the corresponding public accessors available in
2.7.0" — accessors that do not exist. A lint rule keyed on underscore access, or a human reviewer, would
reach the same wrong conclusion.

The prefix also carries no information today, because it is applied uniformly to `_yearInput` (which every
consumer is expected to touch) and to `_base` (which only `PathBuilder` has any business reading).

## Goal

Make the prefix mean something, without breaking anything. Purely additive.

## Decisions

### D1 — Ten public aliases, named exactly as the theme bag already names them

Add non-underscore getters for the ten form controls:

| Canonical                   | Legacy alias                 |
| --------------------------- | ---------------------------- |
| `epiphanyInput`             | `_epiphanyInput`             |
| `ascensionInput`            | `_ascensionInput`            |
| `corpusChristiInput`        | `_corpusChristiInput`        |
| `eternalHighPriestInput`    | `_eternalHighPriestInput`    |
| `holydaysOfObligationInput` | `_holydaysOfObligationInput` |
| `localeInput`               | `_localeInput`               |
| `yearTypeInput`             | `_yearTypeInput`             |
| `yearInput`                 | `_yearInput`                 |
| `acceptHeaderInput`         | `_acceptHeaderInput`         |
| `calendarPathInput`         | `_calendarPathInput`         |

The names are not chosen freshly here. `src/MetaComponents/Theme.js`'s `API_OPTIONS_INPUT_ROLES` already
uses exactly these ten strings as the theme bag's per-input override vocabulary — `theme.apiOptions.yearInput`
has been public API since PR #75 — and they are also the keys of `ApiOptions`' own private `#inputs` bag.
Any other spelling would give one input two public names, which is worse than the single ugly one it has now.
A test asserts the alias set equals `API_OPTIONS_INPUT_KEYS`, so the two cannot drift.

### D2 — Four keep the prefix, and are documented as genuinely internal

`_filter`, `_filtersSet`, `_currentEndpoint` and `_base` gain no alias.

- **`_base`** — its own JSDoc already says "Package-internal": `PathBuilder` and `SubscriptionUrl` read it to
  check that the form and the `CalendarSelect` beside it are bound to the same API. A consumer has no use for it.
- **`_currentEndpoint`** — returned by reference precisely so `PathBuilder` can mutate it. Handing that out as
  public API would publish a mutable internal.
- **`_filtersSet`** — read nowhere in the repository outside its own declaration. Nothing to promote.
- **`_filter`** — read nowhere on an `ApiOptions` instance either. (Every `._filter` read in `src/` and in the
  tests is on a `CalendarSelect`, which has its own same-named getter and is out of scope here.) It is also
  the one accessor for which the obvious alias is _impossible_: `ApiOptions.prototype.filter` is already the
  chainable setter method, and a `get filter()` in the same class body would replace it. Inventing
  `currentFilter` to work around that would ship a name nobody has asked for, for a value nobody reads — so
  YAGNI decides it. If a consumer ever needs it, `currentFilter` is the name to add.

After this change the rule reads: **on `ApiOptions`, a leading underscore means package-internal, with ten
named legacy exceptions listed in the docs.**

### D3 — No deprecation warnings, and the underscore forms are NOT deprecated

The issue suggested leaving the underscore forms "in place as deprecated aliases". They stay in place; they
are not marked deprecated and emit no `console.warn`. Three reasons, in order of weight:

1. **The library reads them itself, at roughly thirty call sites** — `ApiClient.js` (eight), `PathBuilder.js`
   (nine), `CalendarControls.js` (four), `DayViewer.js` (four), `ApiExplorer.js`, `SubscriptionUrl.js` (three)
   and `SubscriptionBuilder.js`. A warning would fire on the library's own behaviour, on every page, before a
   consumer had written a single underscore. That trains consumers to ignore the library's warnings, which
   costs more than the naming confusion this issue is about.
2. **Even after migrating those**, warning on the only spelling that has ever existed would make every
   existing consumer's _correct_ code noisy in a minor release. The issue asked for "purely additive, no
   breakage"; a warning is not breakage, but it is not additive either.
3. **The harm the issue documents is a reading error, not a runtime one.** A reviewer — human or automated —
   concluded the wrong thing from the name. That is fixed by documenting a canonical spelling and using it
   everywhere the project shows worked code, which this change does. A runtime warning reaches the one
   audience that already knows the accessor works.

The docs say so explicitly, so a future reader does not have to re-derive it: _the underscore forms remain
supported and are not scheduled for removal; the non-underscore form is the canonical spelling._

### D4 — The non-underscore getter is primary; the underscore one delegates

Each pair is one implementation: the canonical getter reads `this.#inputs.<name>` and carries the doc comment;
the underscore getter is a one-line delegate returning `this.<name>`. Both are emitted into `dist/index.d.ts`,
so both are visible to TypeScript consumers, and neither can drift from the other.

### D5 — `Theme.js` drops its `'_' + key` concatenation

`applyApiOptionsTheme()` reaches each instance with `apiOptions[`_${inputKey}`]`. `CLAUDE.md` records that
"should those accessors ever gain non-underscore aliases, that map is the single place this has to change" —
this is that change. It becomes `apiOptions[inputKey]`, and the surrounding doc paragraph is rewritten. That
is the only edit `Theme.js` receives, so the held issue-#67 work in the same file has minimal surface to
conflict with.

### D6 — The library's other internal call sites are NOT migrated

`ApiClient.js`, `PathBuilder.js`, `CalendarControls.js`, `DayViewer.js`, `ApiExplorer.js`, `SubscriptionUrl.js`
and `SubscriptionBuilder.js` keep reading the underscore forms. Migrating them is pure churn against code
covered only by behaviour tests, it would collide with the parallel issue-#63 work in `CalendarControls.js`,
and — because the underscore forms are fully supported (D3) — there is no correctness argument for it.
`Theme.js` is the exception because the alias is what its lookup was waiting for. Recorded as a follow-up.

### D7 — Everything the project shows as worked code moves to the canonical spelling

`CLAUDE.md`, `README.md`, `docs/*.md` and `examples/*/main.js` are rewritten to the non-underscore form for
the ten inputs. `docs/api-options.md`'s "Form Controls" preamble — currently _"exposed as properties with a
single underscore prefix … This naming convention indicates these are intended for advanced configuration"_ —
is replaced with the new policy, including the list of the four that stay internal and why. Its property
tables list the canonical name with the legacy alias in a second column.

`docs/superpowers/specs/` and `docs/superpowers/plans/` are left alone: they are dated records of what was
decided at the time, not live documentation.

**`src/stories/` is included too**, added after code review pointed out that this section had not named it.
Five story files carry twenty-one underscore reads, four of them inside Storybook `description` strings —
which `yarn build-storybook` publishes as this library's own component documentation. _"When set to true we
use the `ApiOptions` instance `_acceptHeaderInput.hide()` method"_ is plausibly the most-read sentence
describing that control, so leaving it would have reproduced the exact harm #62 is about in the one place
most likely to be copied. `_domElement` reads inside those files are left alone, being out of scope like
every other `Input` accessor.

### D8 — Tests

A new `src/__tests__/ApiOptionsPublicAccessors.test.js` asserts:

- for each of the ten, `apiOptions[name]` is the _same object_ as `apiOptions['_' + name]`;
- the set of canonical alias names equals `Theme.js`'s `API_OPTIONS_INPUT_KEYS`, so D1 cannot silently drift;
- neither spelling warns (`console.warn` spy sees nothing);
- the four internal accessors have no public alias — `base`, `filtersSet` and `currentEndpoint` are
  `undefined`, and `filter` is still the chainable _method_, not a getter.

`applyApiOptionsTheme()`'s new lookup is already covered end-to-end by
`src/__tests__/MetaComponentThemeApiOptions.test.js`; a theme that reached no input would fail there.

### D9 — A compile-time assertion about the emitted declarations

`type-fixtures/dts-consumer.ts` gains a type-only assertion that each of the ten canonical accessors exists on
the emitted `ApiOptions` declaration and is mutually assignable with its underscore counterpart. No runtime
test can see this: a getter that vanished from the `.d.ts` (for instance because a stray `@readonly` tag made
`tsc` emit the invalid `readonly get foo(): T;`) would still pass `yarn test`.

## Non-goals

- `CalendarSelect._filter` / `._base`, and `LiturgyOfAnyDay._yearInput`, which have the same shape. The issue
  is scoped to `ApiOptions`; extending it is a separate change.
- `Input._domElement` / `._labelElement`, reached in several worked examples. Same shape, same argument, out
  of scope here.
- Removing or deprecating anything.
