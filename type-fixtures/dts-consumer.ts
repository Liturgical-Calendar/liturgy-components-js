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

import {
    ApiOptions,
    CalendarControls,
    CalendarResourcePicker,
    CalendarViewer,
    DayViewer,
    SubscriptionBuilder,
    ThemePreset,
    TodayViewer,
    VERSION,
} from '../dist/index.js';

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
 * `onSettled` (task 1 of the settled-signal work) must reach `dist/index.d.ts`
 * as a function returning an unsubscribe function. `yarn compile` cannot see
 * this — `checkJs` is off — so a malformed JSDoc return type would otherwise
 * ship silently, the same class of bug the `VERSION` and `@readonly`-getter
 * traps above describe.
 */
const apiOptions: ApiOptionsInstance = null as unknown as ApiOptionsInstance;
const unsubscribeSettled: () => void = apiOptions.onSettled(() => {});
unsubscribeSettled();

/**
 * #67: the preset names must reach `dist/` as a usable VALUE, not only as a type.
 *
 * `ThemePreset` is the only export that originates in `src/MetaComponents/`, every
 * other member of which is deliberately unexported, so it is the one most likely to be
 * dropped from `src/index.js` by someone tidying that boundary.
 */
const bootstrap5Preset: string = ThemePreset.BOOTSTRAP_5;
void bootstrap5Preset;

/**
 * The `CalendarControls` selection payload (#68) must reach a consumer as a
 * usable type, not as `Object`.
 */
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

/**
 * `TodayViewer` (calendar scope, task 9) must reach `dist/` at a usable type,
 * and its documented `scope` recipe — `mountInto()`, `await settled`,
 * `dispose()` — must compile for a consumer exactly as written in the docs.
 * No runtime test can see a `.d.ts`-only regression here, the same class of
 * bug as the `VERSION` and `@readonly`-getter traps above.
 */
async function scopedTodayViewer(): Promise<void> {
    const viewer = await TodayViewer.mountInto('#today', {
        locale: 'it',
        scope: { rite: 'roman', diocese: 'romamo_it' },
    });
    await viewer?.settled;
    viewer?.dispose();
}
void scopedTodayViewer;

/**
 * `scope` (task 10) must reach the emitted declarations as the named
 * `CalendarScopeOptions` type, on every component that accepts it — not the
 * bare `Object` (or, worse, an ENTIRELY ABSENT key) that let any object
 * literal through and proved nothing. See `src/typedefs.js`'s doc comment on
 * `CalendarScopeOptions` for the history: `grep -c "scope" dist/index.d.ts`
 * printed `0`, and `scopedTodayViewer()` below — unchanged since task 9 —
 * compiled throughout, because a bare `Object` parameter accepts any object
 * literal regardless of its shape.
 *
 * The regressing check is the indexed access itself, not the assignment: for
 * `CalendarControls`, `CalendarViewer` and `CalendarResourcePicker`, `scope`
 * was undocumented on `mountInto()`'s OWN `@param` tags before this fix —
 * `tsc` synthesises a factory's options type from that factory's own tags
 * alone, so the "as the constructor, plus those below" prose is not honoured
 * by the compiler — and `['scope']` on the emitted options type was a
 * compile error (TS2339), not merely a loosely-typed pass.
 */
type ControlsScope = NonNullable<
    NonNullable<Parameters<typeof CalendarControls.mountInto>[1]>['scope']
>;
type ViewerScope = NonNullable<
    NonNullable<Parameters<typeof CalendarViewer.mountInto>[1]>['scope']
>;
type DayViewerScope = NonNullable<
    NonNullable<Parameters<typeof DayViewer.mountInto>[1]>['scope']
>;
type PickerScope = NonNullable<
    NonNullable<Parameters<typeof CalendarResourcePicker.mountInto>[1]>['scope']
>;
type SubscriptionBuilderScope = NonNullable<
    NonNullable<Parameters<typeof SubscriptionBuilder.mountInto>[1]>['scope']
>;

const controlsScope: ControlsScope = { rite: 'roman' };
const viewerScope: ViewerScope = { rite: ['roman', 'ambrosian'] };
const dayViewerScope: DayViewerScope = { nation: 'US', includeDioceses: true };
const pickerScope: PickerScope = { diocese: 'romamo_it' };
const subscriptionBuilderScope: SubscriptionBuilderScope = { nation: 'IT' };
void controlsScope;
void viewerScope;
void dayViewerScope;
void pickerScope;
void subscriptionBuilderScope;

/**
 * F9 (final whole-branch review, Ruling 24): `scope` must reach the
 * CONSTRUCTOR path too, not only `mountInto()`. CLAUDE.md documents the
 * constructor as the path every REAL consumer is actually on — "a real
 * import would make it a value" is why `mountInto()` alone was not enough.
 * Before this fix every constructor's emitted signature was the bare
 * `options?: Object | string | Intl.Locale`, because an explicit UNION type
 * on `[options]` suppresses `tsc`'s usual synthesis of an anonymous object
 * type from dotted `@param [options.foo]` tags — that synthesis only fires
 * when the top-level tag is the bare word `Object`, which is what makes
 * `mountInto()`'s own `options` parameter (never a union — it never accepts
 * a bare locale) work. Checked with an EXPLICITLY TYPED binding on each: a
 * bare object literal would compile against the untyped `Object` union
 * member regardless of its shape and prove nothing, exactly as the
 * `mountInto()` regression above describes.
 *
 * The constructor's parameter is a UNION (`... | string | Intl.Locale`), so
 * `['scope']` cannot be indexed directly off it — only one member of the
 * union carries that key. `CtorOptionsBag` picks out that member the same
 * way a caller narrowing the union would: excluding the two non-bag forms
 * rather than trying to intersect them away.
 */
type CtorOptionsBag<T> = Exclude<NonNullable<T>, string | Intl.Locale>;

type ControlsCtorScope = NonNullable<
    CtorOptionsBag<ConstructorParameters<typeof CalendarControls>[0]>['scope']
>;
type ViewerCtorScope = NonNullable<
    CtorOptionsBag<ConstructorParameters<typeof CalendarViewer>[0]>['scope']
>;
type DayViewerCtorScope = NonNullable<
    CtorOptionsBag<ConstructorParameters<typeof DayViewer>[0]>['scope']
>;
type PickerCtorScope = NonNullable<
    CtorOptionsBag<
        ConstructorParameters<typeof CalendarResourcePicker>[0]
    >['scope']
>;
type TodayViewerCtorScope = NonNullable<
    CtorOptionsBag<ConstructorParameters<typeof TodayViewer>[0]>['scope']
>;
type SubscriptionBuilderCtorScope = NonNullable<
    CtorOptionsBag<
        ConstructorParameters<typeof SubscriptionBuilder>[0]
    >['scope']
>;

const controlsCtorScope: ControlsCtorScope = { rite: 'roman' };
const viewerCtorScope: ViewerCtorScope = { rite: ['roman', 'ambrosian'] };
const dayViewerCtorScope: DayViewerCtorScope = {
    nation: 'US',
    includeDioceses: true,
};
const pickerCtorScope: PickerCtorScope = { diocese: 'romamo_it' };
const todayViewerCtorScope: TodayViewerCtorScope = { rite: 'roman' };
const subscriptionBuilderCtorScope: SubscriptionBuilderCtorScope = {
    nation: 'IT',
};
void controlsCtorScope;
void viewerCtorScope;
void dayViewerCtorScope;
void pickerCtorScope;
void todayViewerCtorScope;
void subscriptionBuilderCtorScope;

/**
 * `scope.rite` must accept both a string and a string array (a set with one
 * member, and a set with several) — see `CalendarScope.js` and the calendar
 * scope design doc for why the array form is future-proofing rather than
 * dead weight today. Checked against the REAL emitted `rite` field via
 * `TodayViewerScope`, not a standalone literal untethered from it.
 */
type TodayViewerScope = NonNullable<
    NonNullable<Parameters<typeof TodayViewer.mountInto>[1]>['scope']
>;

const scopeRiteAcceptsString: TodayViewerScope['rite'] = 'roman';
const scopeRiteAcceptsArray: TodayViewerScope['rite'] = ['roman', 'ambrosian'];
void scopeRiteAcceptsString;
void scopeRiteAcceptsArray;
