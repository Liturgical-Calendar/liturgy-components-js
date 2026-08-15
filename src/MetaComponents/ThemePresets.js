/**
 * Named framework presets for a meta-component's theme bag (issue #67).
 *
 * Every consuming page in this org rewrote the same mapping from HTML role to
 * Bootstrap class — `form-select` for a `<select>`, `form-control` for a text or
 * number input, `form-label` for a label — in its theme bag, its `Input.setGlobal*`
 * calls and its per-input overrides, and one example carried a runtime
 * Bootstrap-version probe to choose between two spellings of it. None of that is the
 * consumer's decision: it is what the framework calls those things, and it is where
 * pages drift apart.
 *
 * **Scope, stated so it can be held to.** A preset names CONTROLS, never LAYOUT. It
 * supplies no wrapper class, no grid span and no spacing utility, and it ships no
 * class the named framework does not itself define. It also does not DETECT anything:
 * which framework a page loaded is a page fact this library cannot see, so the probe
 * stays with the consumer — it simply chooses a preset name now instead of a dozen
 * class strings. `CLAUDE.md`'s "ships nothing framework-specific and takes no position
 * on CSS" stands everywhere else; this is a bounded, deliberate exception, and the
 * bound is the framework's own control vocabulary.
 *
 * The class table is deliberately NOT exported from `src/index.js` — only the
 * {@link ThemePreset} names are. The strings must stay free to be corrected in a patch
 * release when a framework moves, or when a mapping here turns out to be wrong (the
 * Bootstrap 4 label decision below is exactly the sort of judgement that might need
 * revisiting); exporting them would freeze a mapping we specifically want to be able to
 * fix. The names and the table live in ONE file so that the public half and the private
 * half cannot drift.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import { describeType } from '../OptionsValidation.js';

/**
 * The preset names a theme bag may use.
 *
 * Exported from `src/index.js`, like every other closed set of magic strings in this
 * library (`ApiOptionsFilter`, `CalendarSelectFilter`, `YearType`, `Grouping`), so a
 * TypeScript consumer gets completion and a compile error rather than a runtime throw.
 *
 * @enum {{BOOTSTRAP_4: 'bootstrap4', BOOTSTRAP_5: 'bootstrap5'}}
 */
export const ThemePreset = Object.freeze({
    BOOTSTRAP_4: 'bootstrap4',
    BOOTSTRAP_5: 'bootstrap5',
});

/**
 * What each preset resolves to, in the theme bag's own flat role vocabulary.
 *
 * Three keys at most, and **never `wrapper`**. A wrapper class is layout, not control
 * vocabulary: Bootstrap 4's `.form-group` was removed in Bootstrap 5 in favour of
 * spacing utilities, a grid form wraps in `.col-md-*` instead, and the spans are
 * budgeted per row by the page — the motivating example budgets two rows to twelve
 * columns each, `2 + 4 + 2 + 2 + 2` and `3 + 2 + 2 + 2 + 3`, numbers no preset could
 * know. Emitting one would also consume `Input.wrapper()`'s one-shot allowance on all
 * ten `ApiOptions` inputs and close `wrapperClass()` on them, which is one of the two
 * reasons `theme.apiOptions` is an opt-in gate — and therefore the reason a preset may
 * open that gate safely. See `expandTheme()` in `Theme.js`.
 *
 * This is why only ONE of the two Bootstrap differences issue #67 names is covered
 * here. They are not the same kind of difference: `.form-select` is a class Bootstrap 5
 * introduced for selects, where Bootstrap 4 styles them with `.form-control`, whereas
 * `col col-md-N` versus `col-md-N` is a choice about how columns behave below the `md`
 * breakpoint — `.col` and `.col-md-*` exist in both versions and mean the same thing in
 * both, so there is no renaming for a preset to absorb.
 *
 * **`bootstrap4` emits no `label` on purpose.** `.form-label` is a Bootstrap 5 class;
 * Bootstrap 4 form labels carry no class at all (`.col-form-label` is a different
 * thing, for horizontal forms). Emitting it anyway would be inventing CSS, which is the
 * one thing this module must not do. A Bootstrap 4 consumer who wants label utilities
 * writes them: `{ preset: 'bootstrap4', label: 'd-block mb-1' }`.
 *
 * @type {Readonly<Object<string, Readonly<{select: string, input: string, label?: string}>>>}
 */
const PRESET_CLASSES = Object.freeze({
    [ThemePreset.BOOTSTRAP_4]: Object.freeze({
        select: 'form-control',
        input: 'form-control',
    }),
    [ThemePreset.BOOTSTRAP_5]: Object.freeze({
        select: 'form-select',
        input: 'form-control',
        label: 'form-label',
    }),
});

/**
 * The valid preset names, for the rejection message and for the drift test.
 *
 * @type {Readonly<string[]>}
 */
export const THEME_PRESET_NAMES = Object.freeze(Object.keys(PRESET_CLASSES));

/**
 * Whether a theme bag ASKS for a preset — regardless of whether the name is valid.
 *
 * Separated from {@link expandThemePreset} so that "asks for a preset" and "names a
 * preset that exists" are two questions with two answers. Folded together, an unknown
 * name would be indistinguishable from no preset at all, and the caller would carry on
 * with the caller's own bag rather than throwing — the silent-drop failure mode this
 * module's neighbours are emphatic about, arriving by a third route.
 *
 * A bare string is a preset name. That spelling is purely additive: a string was never
 * a valid `theme`, since `assertTheme()` runs `assertPlainOptions()` on it and throws.
 * It cannot be confused with the per-child string form (`theme.riteSelect:
 * 'form-select'`, meaning `{ class }`), which lives one level down and is never read
 * here.
 *
 * A NULLISH `preset` still answers `true` here, and is handled by
 * {@link expandThemePreset} rather than by this predicate — the bag must still go
 * through the expansion so the dead `preset` key is stripped before `assertTheme()`
 * reaches its unknown-key check. This function answers "is there a `preset` key to
 * deal with", not "is there a preset".
 *
 * @param {unknown} theme - The candidate theme bag.
 * @returns {boolean} Whether it asks for a preset.
 */
export function hasThemePreset(theme) {
    if (null === theme || undefined === theme) {
        return false;
    }
    if (typeof theme === 'string') {
        return true;
    }
    if (typeof theme !== 'object') {
        return false;
    }
    return Object.hasOwn(theme, 'preset');
}

/**
 * Whether a theme bag names a preset that {@link expandThemePreset} will actually
 * apply — as opposed to merely carrying a `preset` key.
 *
 * The two differ on exactly one input, `{ preset: undefined }` (or `null`), and the
 * distinction is load-bearing rather than pedantic. That bag still has to go through
 * the expansion, so the dead key is stripped before `assertTheme()` reaches its
 * unknown-key check — which is what {@link hasThemePreset} answers. But it must NOT
 * open the `theme.apiOptions` gate, because it asked for no preset: "nullish means not
 * supplied" has to be true of the gate as well as of the class strings, or a bag
 * spread from a config object with no `preset` would silently restyle a whole
 * `ApiOptions` form. `Theme.js`'s `expandTheme()` is the only caller.
 *
 * @param {unknown} theme - The candidate theme bag.
 * @returns {boolean} Whether a preset name was supplied.
 */
export function namesThemePreset(theme) {
    if (false === hasThemePreset(theme)) {
        return false;
    }
    if (typeof theme === 'string') {
        return true;
    }
    return null !== theme.preset && undefined !== theme.preset;
}

/**
 * Expands a preset-bearing theme bag into a plain one.
 *
 * The preset's flat keys are spread FIRST and the caller's own keys second, so a
 * caller's explicit key beats the preset's, per key. Everything downstream — the flat
 * default versus per-child override in `resolveChildTheme()`, the four tiers in
 * `resolveApiOptionsInputTheme()` — then applies unchanged: a preset is one more tier
 * below the flat keys, expressed as a shallow spread rather than as a parallel merge.
 *
 * The `preset` key itself is removed, so nothing downstream ever sees it and
 * `assertTheme()` need not learn a fifth flat key.
 *
 * Call only when {@link hasThemePreset} is true.
 *
 * @param {string|Object} theme - A preset name, or a bag carrying a `preset` key.
 * @param {string|null} [componentName=null] - The rejecting component, when known. The
 *        two component-aware entry points in `Theme.js` pass it; the two resolvers
 *        cannot, and get a `Theme:` prefix instead.
 * @returns {Object} A fresh plain bag, with `preset` removed.
 * @throws {Error} If the preset name is not a string, or is not a known preset.
 */
export function expandThemePreset(theme, componentName = null) {
    const prefix = null === componentName ? 'Theme' : componentName;
    const name = typeof theme === 'string' ? theme : theme.preset;
    // **A `preset` present but NULLISH means no preset**, not an invalid one — the
    // rule the rest of this library already states twice: `CLAUDE.md`'s locale
    // contract ("`null` and `undefined` both mean 'not supplied'"), and
    // `resolveChildTheme()`'s explicitly-undefined paragraph, which names the very
    // shape that produces this one — a bag spread from a config object whose own key
    // is absent, `{ preset: cfg.preset, … }`. A preset must not be the one key in the
    // bag that throws for it. The key is still STRIPPED here rather than left for
    // `assertTheme()` to reject as unrecognised.
    //
    // An empty string is a different matter and falls through to the throw below: it
    // was supplied and it names nothing, exactly as an unparseable locale is not an
    // absent locale.
    if (null === name || undefined === name) {
        const withoutPreset = { ...theme };
        delete withoutPreset.preset;
        return withoutPreset;
    }
    if (typeof name !== 'string') {
        throw new Error(
            `${prefix}: theme.preset must be of type \`string\` but found type: ${describeType(name)}`,
        );
    }
    if (false === Object.hasOwn(PRESET_CLASSES, name)) {
        throw new Error(
            `${prefix}: theme preset '${name}' is not recognised. Valid presets are: ${THEME_PRESET_NAMES.join(', ')}.`,
        );
    }
    const rest = typeof theme === 'string' ? {} : { ...theme };
    delete rest.preset;
    return { ...PRESET_CLASSES[name], ...rest };
}
