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
 * Written as TWO assignments, one per direction, because a single one is only
 * half a check. Assigning a `Pick` of the ten canonical names to an object type
 * spelled in aliases catches a canonical accessor missing from the emit (TS2344
 * on the `Pick`) or emitted WIDER than its alias (TS2322) — but a canonical
 * narrower than its alias is still assignable, so alias-side drift passes.
 * Measured, not assumed: widening only `get _epiphanyInput()` in the emitted
 * declaration left `yarn lint:dts` green (CodeRabbit, PR #86). The mirrored
 * assignment below closes that half, so the pair is mutually assignable and
 * "different in either direction" is now literally what fails.
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

const aliasesMatchTheirCanonicalAccessors: {
    _epiphanyInput: ApiOptionsInstance['epiphanyInput'];
    _ascensionInput: ApiOptionsInstance['ascensionInput'];
    _corpusChristiInput: ApiOptionsInstance['corpusChristiInput'];
    _eternalHighPriestInput: ApiOptionsInstance['eternalHighPriestInput'];
    _holydaysOfObligationInput: ApiOptionsInstance['holydaysOfObligationInput'];
    _localeInput: ApiOptionsInstance['localeInput'];
    _yearTypeInput: ApiOptionsInstance['yearTypeInput'];
    _yearInput: ApiOptionsInstance['yearInput'];
    _acceptHeaderInput: ApiOptionsInstance['acceptHeaderInput'];
    _calendarPathInput: ApiOptionsInstance['calendarPathInput'];
} = null as unknown as Pick<
    ApiOptionsInstance,
    | '_epiphanyInput'
    | '_ascensionInput'
    | '_corpusChristiInput'
    | '_eternalHighPriestInput'
    | '_holydaysOfObligationInput'
    | '_localeInput'
    | '_yearTypeInput'
    | '_yearInput'
    | '_acceptHeaderInput'
    | '_calendarPathInput'
>;
void aliasesMatchTheirCanonicalAccessors;

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

/**
 * The `CalendarControls` selection payload (#68) must reach a consumer as a
 * usable type, not as `Object`.
 */
import { CalendarControls } from '../dist/index.js';

type ControlsInstance = InstanceType<typeof CalendarControls>;

const paint = ({
    calendarType,
    calendarId,
    predeterminedInputs,
}: ControlsInstance['selection']): void => {
    void calendarType;
    void calendarId;
    void predeterminedInputs;
};

const documentedRecipe = (controls: ControlsInstance): void => {
    paint(controls.selection);
    controls.onSelectionChange(paint);
};
void documentedRecipe;

const narrowedCalendarType: 'general' | 'national' | 'diocesan' =
    null as unknown as ControlsInstance['selection']['calendarType'];
void narrowedCalendarType;
