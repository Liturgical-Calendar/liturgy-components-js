/**
 * The version of this package, as a string.
 *
 * Hand-maintained, and kept honest by `src/__tests__/Version.test.js`, which
 * reads `package.json` off disk and fails when the two drift. Bumping a release
 * therefore means editing two files: `package.json` and this one.
 *
 * Generating this file at build time was considered and rejected: `dist/` is
 * gitignored, so a generated file would have to land in `src/` — either
 * committed (identical to this, plus a generator) or gitignored (breaking
 * `yarn test` and `yarn storybook` on a fresh clone). Importing `package.json`
 * with `with { type: 'json' }` was also rejected: `tsc` emits that import
 * verbatim, so every consumer would evaluate it at run time, and import
 * attributes need Chrome 123+/Firefox 121+/Safari 17.2+/Node 20.10+ against this
 * package's documented ES2022 floor of Chrome 94+/Firefox 93+/Safari 15.4+/Node
 * 16.11+.
 *
 * Annotated `string` rather than left to infer its literal type: without the
 * annotation `tsc` declares `export const VERSION: "2.10.0"`, and a consumer
 * comparing it against any other literal — the version-floor check this constant
 * exists for — gets TS2367 instead of a boolean. Removing the annotation is
 * caught by `type-fixtures/dts-consumer.ts` under `yarn lint:dts`; neither
 * `yarn compile` nor the runtime tests can see it.
 *
 * @type {string}
 */
export const VERSION = '2.10.0';
