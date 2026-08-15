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

import { ApiOptions, VERSION } from '../dist/index.js';

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

/**
 * Every canonical `ApiOptions` accessor (issue #62) must reach the emitted
 * declarations, and must carry the same type as the underscore alias it is the
 * canonical spelling of.
 *
 * No runtime test can see this. `yarn test` reads the JS, where the getters are
 * fine; a JSDoc mistake that dropped one from the `.d.ts` — a stray `@readonly`
 * tag, which `tsc` emits as the syntactically invalid `readonly get foo(): T;` —
 * is invisible to it, and to `yarn compile`, because `checkJs` is off.
 *
 * Written as an assignment of a `Pick` of the ten canonical names to an object
 * type spelled out in terms of the ten aliases. That fails in either direction:
 * a canonical accessor missing from the emit is a TS2344 on the `Pick`, and one
 * emitted at a different or wider type than its alias is a TS2322 on the
 * assignment. Asserting only that the names exist would let the types drift.
 */
type ApiOptionsInstance = InstanceType<typeof ApiOptions>;

const canonicalAccessorsMatchTheirAliases: {
    epiphanyInput: ApiOptionsInstance['_epiphanyInput'];
    ascensionInput: ApiOptionsInstance['_ascensionInput'];
    corpusChristiInput: ApiOptionsInstance['_corpusChristiInput'];
    eternalHighPriestInput: ApiOptionsInstance['_eternalHighPriestInput'];
    holydaysOfObligationInput: ApiOptionsInstance['_holydaysOfObligationInput'];
    localeInput: ApiOptionsInstance['_localeInput'];
    yearTypeInput: ApiOptionsInstance['_yearTypeInput'];
    yearInput: ApiOptionsInstance['_yearInput'];
    acceptHeaderInput: ApiOptionsInstance['_acceptHeaderInput'];
    calendarPathInput: ApiOptionsInstance['_calendarPathInput'];
} = null as unknown as Pick<
    ApiOptionsInstance,
    | 'epiphanyInput'
    | 'ascensionInput'
    | 'corpusChristiInput'
    | 'eternalHighPriestInput'
    | 'holydaysOfObligationInput'
    | 'localeInput'
    | 'yearTypeInput'
    | 'yearInput'
    | 'acceptHeaderInput'
    | 'calendarPathInput'
>;
void canonicalAccessorsMatchTheirAliases;

/**
 * The four package-internal accessors must NOT have grown a canonical alias.
 *
 * `_filter` is deliberately absent from this list: `filter()` is a real method
 * on the class, so `'filter' extends keyof ApiOptionsInstance` is true and
 * always will be. The other three have no method of the same name, so this
 * assertion fails the moment one of them is quietly promoted without the
 * documentation that promotion is supposed to come with.
 */
type HasKey<K extends string> = K extends keyof ApiOptionsInstance
    ? true
    : false;

const internalAccessorsStayInternal: [false, false, false] = [
    null as unknown as HasKey<'base'>,
    null as unknown as HasKey<'filtersSet'>,
    null as unknown as HasKey<'currentEndpoint'>,
];
void internalAccessorsStayInternal;
