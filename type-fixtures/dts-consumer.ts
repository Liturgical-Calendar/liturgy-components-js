/**
 * Compile-time fixtures asserting things about the EMITTED declarations that no
 * runtime test can reach.
 *
 * Checked by `yarn lint:dts` (see `tsconfig.dts-check.json`, which lists this
 * file alongside `dist/index.d.ts`), so it type-checks the declarations exactly
 * as a downstream consumer's own `tsconfig.json` would. It is deliberately
 * outside `src/`: `tsconfig.json` includes only `./src/**\/*` and excludes
 * `**\/*.ts` besides, so nothing here can reach the build or `dist/`.
 *
 * Run `yarn compile` first — this imports from `dist/`, which `lint:dts` checks
 * but does not rebuild.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import { VERSION } from '../dist/index.js';

/**
 * `VERSION` must be declared `string`, never the string LITERAL of whatever
 * version happens to be current.
 *
 * `src/Version.js` carries a JSDoc `@type {string}` for this reason, and without
 * it `tsc` infers the `const` at its literal type and emits
 * `export const VERSION: "2.7.0"` — which turns a consumer's version-floor check
 * (`VERSION === '2.8.0'`, the comparison the constant exists for) into a TS2367
 * error rather than a boolean. That regression is invisible to `yarn compile`,
 * because `checkJs` is off, AND invisible to `yarn lint:dts` on its own, because
 * a narrowed literal is perfectly valid TypeScript. Verified by removing the
 * annotation: the declaration narrowed and every gate stayed green.
 *
 * The assertion is written as an assignment rather than as the version-floor
 * comparison it protects, because the comparison only errors while the literal
 * differs from the version — it would go quiet the moment someone bumped the
 * package to the very version being compared against, silently retiring the
 * guard. Assigning a `string` to `typeof VERSION` fails for ANY literal type, so
 * it stays honest across releases.
 */
const widenedNotLiteral: typeof VERSION = '' as string;
void widenedNotLiteral;
