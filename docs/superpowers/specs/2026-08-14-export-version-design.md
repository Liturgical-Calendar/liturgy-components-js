# Export a `VERSION` constant — design

Closes [#64](https://github.com/Liturgical-Calendar/liturgy-components-js/issues/64).

## Problem

`src/index.js` exports no version constant and no component exposes one, so a page has no runtime way to
answer "which build is this?". This bites `LiturgicalCalendarFrontend`, which resolves the library through
a symlink into a sibling checkout in development and a pinned CDN tag in production. The two diverged by
five minor versions with nothing on the page saying so. A pinned importmap is not evidence either: jsDelivr
rebuilds `+esm` bundles, and a stale browser cache can serve an old module from a URL that reads current.

## Decision 1 — the constant is hand-maintained, and a test makes drift fail the build

`src/Version.js` holds a single literal, kept in step with `package.json` by
`src/__tests__/Version.test.js`, which reads `package.json` off disk and asserts equality.

Three mechanisms were weighed.

**Hand-maintained plus a drift test (chosen).** Zero build machinery. The file is plain ES2022 that works
untouched from `src/`, from `dist/`, and from a CDN, so it costs the "no build step" story nothing. The
release cost is one extra literal to bump — and because the test reads the real `package.json`, forgetting
that bump is a red `yarn test`, not a silent lie. That inversion is the whole point: the failure mode this
issue is about is a version claim nobody can trust, so the mechanism has to make an untrue claim loud.

**Generating the file at compile time (rejected).** It removes the manual bump, but `yarn compile` is plain
`tsc` today and three scripts would have to grow a generator step (`compile`, `compile:watch`, `docker`) —
and `compile:watch` cannot regenerate on a `package.json` change, so the watch build would drift exactly
where a developer is least likely to look. Worse, `dist/` is gitignored, so the generated file would have
to land in `src/`, which means it is either committed (identical to the chosen option, plus a script) or
gitignored (breaking `yarn test` and `yarn storybook` on a fresh clone before a first `yarn compile`). The
saving is one line per release; the cost is a build step in a library whose stated selling point is not
having one.

**Importing `package.json` directly with `with { type: 'json' }` (rejected, on measured evidence).** This
was probed rather than assumed. Two findings, both from reading the actual emit:

- `tsc` passes the import through **verbatim** into `dist/`. Nothing is inlined. So every consumer — Node,
  browser, CDN — evaluates a real JSON module import at run time.
- Without `resolveJsonModule` the declaration emits `export const VERSION: any;`. Turning it on fixes the
  type to `string`, so that part is solvable.

What is not solvable is the floor. Import attributes need Chrome 123+, Firefox 121+, Safari 17.2+ and
Node 20.10+. This package documents and genuinely requires Chrome 94+, Firefox 93+, Safari 15.4+, Node
16.11+. Trading roughly three years of browser support for a version string is not a trade worth making,
and it would contradict the ES2022 floor that `tsconfig.json` and the README both go out of their way to
state precisely.

## Decision 2 — `VERSION` only; `ApiClient.version` is declined

The issue floats `ApiClient.version` as optional. Declining it.

`ApiClient` and `ApiBase` deal in the Liturgical Calendar API's own versioned base URLs — the default base
is `https://litcal.johnromanodorazio.com/api/dev`. A `version` on the client class therefore reads most
naturally as "which version of the API does this client speak", which is a real and different question. A
name that answers a question other than the one a reader will ask of it is worse than no name. The bare
`VERSION` export carries the package name at its import site (`from '@liturgical-calendar/components-js'`),
which is precisely the disambiguation the static property would lack.

Cheap to add later if a consumer actually wants it; not cheap to un-name.

## Decision 3 — the declared type is `string`, not the literal

Left unannotated, `tsc` infers a `const` at its literal type and emits `export const VERSION: "2.7.0";`.
(Widening runs the other way — literal to base type — which is exactly what the annotation asks for.)
That breaks the issue's own stated use case: a consumer writing `if ( VERSION === '2.8.0' )` gets
TS2367 ("this comparison appears to be unintentional") because the two literal types have no overlap. A
JSDoc `@type {string}` annotation forces `export const VERSION: string;`.

`yarn lint:dts` is the gate that proves the declaration is usable, per `CLAUDE.md`'s warning that a green
`yarn compile` proves nothing about the emitted `.d.ts` (`checkJs` is off).

## Surface

```javascript
import { VERSION } from '@liturgical-calendar/components-js';
console.debug( `components-js ${VERSION}` );
```

- `src/Version.js` — `export const VERSION` (new).
- `src/index.js` — imports and re-exports it, alongside the existing exports.
- Emitted: `dist/index.js` carries the literal; `dist/index.d.ts` declares `export const VERSION: string;`.

## Tests

`src/__tests__/Version.test.js`:

1. `VERSION` equals `package.json`'s `version`, read off disk at test time — the drift gate.
2. `VERSION` is a non-empty string matching a semver-shaped pattern, so a bad edit fails on its own terms
   rather than only in the comparison above.
3. `VERSION` is re-exported from `src/index.js`, so the barrel export cannot be forgotten.

## Release note

The bump becomes a two-file edit: `package.json` and `src/Version.js`. Documented in `CLAUDE.md` so a
releaser meets it where they already look, and the drift test's failure message names the file to change.

## Out of scope

- Bumping the package version. This adds the mechanism; the next release ships it.
- `ApiClient.version` (Decision 2).
- Any generator script or change to `yarn compile` (Decision 1).
- Changing `LiturgicalCalendarFrontend` to log the version. That is a consumer change, in another repo.
