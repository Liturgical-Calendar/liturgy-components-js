/**
 * The rite select, calendar select and API options of a calendar page, wired to
 * one another and to an `ApiClient` — with no renderer.
 *
 * The renderer is the axis of variation and the wiring is not: the same 45-line
 * block appears, structurally identical, in a `WebCalendar` example and a
 * FullCalendar one — they differ in locale source, comment wording and minor
 * content, not in shape — and again, minus the fetching, in the API explorer.
 * This class is that block.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import ApiClient from '../ApiClient/ApiClient.js';
import { resolveBase, assertSameBase } from '../ApiClient/ApiBase.js';
import Messages from '../Messages.js';
import { ApiOptionsFilter } from '../Enums.js';
import {
    normalizeComponentOptions,
    assertPlainOptions,
    describeType,
} from '../OptionsValidation.js';
import { canonicalizeLocale } from '../LocaleValidation.js';
import { sanitizeHtml } from '../SanitizeHtml.js';
import { resolveInputVisibility } from './InputVisibility.js';
import {
    assertScope,
    resolveScope,
    deriveVisibility,
} from './CalendarScope.js';
import {
    isFilterKeyedControls,
    resolveControlSlots,
    CONTROLS_TARGET_HINT,
} from './ControlSlots.js';
import { normalizeSettled, deliverFetchFailure } from './Settled.js';
import {
    assertTheme,
    resolveChildTheme,
    resolveWrapperBag,
    applyApiOptionsTheme,
} from './Theme.js';

/**
 * The filters `ApiOptions.filter()` accepts, validated here by name so a typo
 * is reported as a `CalendarControls` problem rather than surfacing from
 * `ApiOptions.filter()` under a component the caller never directly touched
 * (that method's own thrown message names neither class).
 *
 * `ApiOptionsFilter.NONE` is included, unlike `CalendarResourcePicker`'s own
 * `ACCEPTED_FILTERS`: there a resource id has to be national or diocesan, so
 * `NONE` is meaningless, but here it is a legitimate, documented choice — it
 * renders every `ApiOptions` input unfiltered, which is what the FullCalendar
 * example (one of this class' own extraction sources) needs.
 *
 * @type {Readonly<Array<string|null>>}
 */
const ACCEPTED_FILTERS = Object.freeze([
    ApiOptionsFilter.ALL_CALENDARS,
    ApiOptionsFilter.GENERAL_ROMAN,
    ApiOptionsFilter.PATH_BUILDER,
    ApiOptionsFilter.LOCALE_ONLY,
    ApiOptionsFilter.YEAR_ONLY,
    ApiOptionsFilter.NONE,
]);

/**
 * The slot names `appendTo()` accepts.
 *
 * Enumerated so a typo is rejected with the offending key named, rather than
 * mounting nothing and returning successfully — the silent-failure shape this
 * family exists to close, and the same rule `ApiExplorer.appendTo()` and
 * `CalendarViewer`'s `webCalendar` bag already apply.
 *
 * @type {Readonly<string[]>}
 */
const SLOT_NAMES = Object.freeze(['controls', 'messages']);

export default class CalendarControls {
    /** @type {string} */
    #locale = 'en';

    /** @type {string} */
    #language = 'en';

    /** @type {string} */
    #selectedLocale = '';

    /** @type {RiteSelect} */
    #riteSelect;

    /** @type {CalendarSelect} */
    #calendarSelect;

    /** @type {ApiOptions} */
    #apiOptions;

    /** @type {ApiClient|null} */
    #apiClient = null;

    /** @type {import('../ApiClient/ApiBase.js').default} */
    #base;

    /**
     * `resolveScope()`'s result, or `null` for no scope — the "restricts
     * nothing" case that keeps every existing code path untouched. Read by
     * `#applyScopeVisibility()` on every call, so a rite or calendar change
     * always re-derives against the SAME resolved scope rather than a stale
     * copy.
     *
     * @type {?Object}
     */
    #scope = null;

    /**
     * The `{ riteSelect, calendarSelect, localeInput }` overrides from
     * `options.inputs`, kept for `#applyScopeVisibility()` to pass to
     * `deriveVisibility()` on every re-derivation.
     *
     * @type {Object<string, boolean>}
     */
    #inputVisibility = {};

    /**
     * Every container this instance has EVER mounted into — one for a single
     * target, one per pass for a filter-keyed `controls` slot (#63), unioned
     * across calls by `#rememberMounts()`. `dispose()` empties all of them.
     *
     * @type {HTMLElement[]}
     */
    #mounts = [];

    /** @type {HTMLElement|null} */
    #messagesMount = null;

    /** @type {boolean} */
    #messagesSubscribed = false;

    /** @type {boolean} */
    #disposed = false;

    /**
     * The most recent fetch this component issued — `mountInto()`'s initial one,
     * or the caller's own `fetch()` — already resolved when none has been
     * issued. See the `settled` getter for the contract.
     *
     * @type {Promise<void>}
     * @private
     */
    #settled = Promise.resolve();

    /** @type {Array<function(Object): void>} */
    #fetchedCallbacks = [];

    /** @type {Array<function(Error): void>} */
    #errorCallbacks = [];

    /**
     * Errors already handed to the `onError()` callbacks, so a failure that
     * travelled the event bus is not delivered a second time by `#deliverError()`.
     * A `WeakSet` because it holds error objects only to answer "seen this one?",
     * and must not keep them alive.
     *
     * @type {WeakSet<object>}
     */
    #deliveredErrors = new WeakSet();

    /** @type {Array<{event: string, listener: function}>} */
    #subscriptions = [];

    /** @type {Array<function(import('../typedefs.js').CalendarSelection): void>} */
    #selectionCallbacks = [];

    /** @type {Array<{element: HTMLElement, listener: function}>} */
    #selectionListeners = [];

    /** @type {?Promise<void>} */
    #pendingSelectionNotify = null;

    /**
     * The last payload handed to the `onSelectionChange()` callbacks, flattened
     * to one string — seeded in the constructor, so the first notification
     * compares against the state these controls started in rather than against
     * nothing.
     *
     * @type {string}
     */
    #lastSelectionKey = '';

    /**
     * @param {Object|string|Intl.Locale} [options] - Options bag, or a locale.
     * @param {string|Intl.Locale} [options.locale] - The display locale.
     * @param {string} [options.filter] - Which `ApiOptions` inputs to show.
     * @param {Object} [options.theme] - The theme bag; see `Theme.js`.
     * @param {Object} [options.inputs] - Which `ApiOptions` inputs to render, and
     *   which of the three scoped controls to force visible or hidden; see
     *   `InputVisibility.js`. `{ acceptHeader, riteSelect, calendarSelect,
     *   localeInput }`, all optional. `acceptHeader` is only meaningful under a
     *   filter that renders that input at all (`ALL_CALENDARS`, which is the
     *   default, and `NONE`); the other three override `deriveVisibility()`'s
     *   own, scope-derived answer for that control.
     * @param {Object} [options.apiClient] - Binds to that client's API base.
     * @param {import('../typedefs.js').CalendarScopeOptions} [options.scope] - Restricts
     *   which calendars this widget may show; see `CalendarScope.js`. A nullish
     *   or unrestricting scope leaves every control visible, exactly as before
     *   this option existed.
     */
    constructor(options) {
        options = normalizeComponentOptions(options, 'CalendarControls');
        const { locale, filter, theme, inputs, apiClient, scope } = options;

        if (locale !== undefined && locale !== null) {
            this.#locale = canonicalizeLocale(locale, 'CalendarControls');
        }
        // Used for the calendar select's default label text fallback below, and
        // for the locale cascade `#matchLocale()` runs in `appendTo()` — its own
        // children receive `this.#locale` directly and derive their own.
        this.#language = new Intl.Locale(this.#locale).language;
        assertTheme(theme, 'CalendarControls');
        // Resolved BEFORE `resolveBase()` and before any child is built, so a
        // misspelled key rejects as the programmer error it is rather than
        // behind an unrelated runtime failure, and never half-applies. Applied
        // further down, once `#apiOptions` exists.
        const inputVisibility = resolveInputVisibility(
            inputs,
            'CalendarControls',
        );
        this.#inputVisibility = inputVisibility;
        this.#base = resolveBase(apiClient, 'CalendarControls');

        // Validated and resolved BEFORE any child is built, same reasoning as
        // `inputVisibility` above: a bad scope (an unknown key, an unmatched
        // diocese, a rite that leaves no calendar to resolve) is a programmer
        // error and must reject before anything half-mounts. `resolveScope()`
        // returns `null` for a scope that restricts nothing, and every scope
        // path below is a no-op on that value — `RiteSelect` gets no `rites`
        // override, the calendar select gets no forced initial value, and
        // `deriveVisibility( null, … )` always returns all-true — which is what
        // keeps an unscoped instance behaving exactly as before this option
        // existed.
        assertScope(scope, 'CalendarControls', this.#base);
        this.#scope = resolveScope(scope, this.#base);

        const riteTheme = resolveChildTheme(theme, 'riteSelect');
        this.#riteSelect = new RiteSelect({
            locale: this.#locale,
            ...(null !== this.#scope ? { rites: this.#scope.rites } : {}),
        });
        if (Object.hasOwn(riteTheme, 'class')) {
            this.#riteSelect.class(riteTheme.class);
        }
        if (
            Object.hasOwn(riteTheme, 'labelClass') ||
            Object.hasOwn(riteTheme, 'labelText')
        ) {
            const labelOptions = {};
            if (Object.hasOwn(riteTheme, 'labelClass')) {
                labelOptions.class = riteTheme.labelClass;
            }
            if (Object.hasOwn(riteTheme, 'labelText')) {
                labelOptions.text = riteTheme.labelText;
            }
            this.#riteSelect.label(labelOptions);
        }
        const riteWrapper = resolveWrapperBag(riteTheme);
        if (null !== riteWrapper) {
            this.#riteSelect.wrapper(riteWrapper);
        }

        const calendarTheme = resolveChildTheme(theme, 'calendarSelect');
        this.#calendarSelect = new CalendarSelect({
            locale: this.#locale,
            apiClient,
            allowNull: true,
        });
        if (Object.hasOwn(calendarTheme, 'class')) {
            this.#calendarSelect.class(calendarTheme.class);
        }
        if (
            Object.hasOwn(calendarTheme, 'labelClass') ||
            Object.hasOwn(calendarTheme, 'labelText')
        ) {
            const labelOptions = {};
            if (Object.hasOwn(calendarTheme, 'labelClass')) {
                labelOptions.class = calendarTheme.labelClass;
            }
            // ALWAYS a real string, unlike the rite select above: unlike
            // `RiteSelect.label()`, `CalendarSelect.label()` has no English
            // fallback of its own when `text` is omitted — it reads
            // `Messages[language]['SELECT_A_CALENDAR']` directly, which throws
            // for any locale outside the catalogue (e.g. `ceb`). Matches
            // `CalendarResourcePicker`'s and `DayViewer`'s own calendar-select
            // label handling for the same reason.
            labelOptions.text = Object.hasOwn(calendarTheme, 'labelText')
                ? calendarTheme.labelText
                : (Messages[this.#language]?.['SELECT_A_CALENDAR'] ??
                  Messages['en']['SELECT_A_CALENDAR']);
            this.#calendarSelect.label(labelOptions);
        }
        const calendarWrapper = resolveWrapperBag(calendarTheme);
        if (null !== calendarWrapper) {
            this.#calendarSelect.wrapper(calendarWrapper);
        }

        // The scope's initial option list and selection. `_restrictToScope()`
        // MUST run before `value()`: the select's own default rite (`Rite.ROMAN`,
        // since no `rite` option is passed above) may not be the scope's initial
        // rite — a diocese scope resolving to an Ambrosian diocese is the case
        // that makes this observable — so the UNRESTRICTED, Roman-built list may
        // not even carry the scope's initial calendar id, and `value()` throws
        // for any id no current option carries.
        //
        // `resolved.initial.calendarId` is already `''` for a `'rite'`
        // calendarType — `riteStandIn()` in `CalendarScope.js` sets `id: ''` —
        // so this needs no branch on `calendarType`; `CalendarSelect.value('')`
        // is the documented rite-level spelling `value()`'s own doc comment
        // describes.
        if (null !== this.#scope) {
            this.#calendarSelect._restrictToScope(
                this.#scope.calendarsByRite[this.#scope.initial.rite],
                this.#scope.initial.rite,
            );
            this.#calendarSelect.value(this.#scope.initial.calendarId);
        }

        // `?? ApiOptionsFilter.ALL_CALENDARS` would default `undefined` AND
        // `null` alike, silently converting an explicitly-passed
        // `ApiOptionsFilter.NONE` (itself `null`) into `ALL_CALENDARS` — a
        // documented filter value would then render the wrong set of inputs
        // with no error at all. Defaulting only on `undefined` keeps `NONE` a
        // real, distinct choice.
        const resolvedFilter =
            undefined === filter ? ApiOptionsFilter.ALL_CALENDARS : filter;
        if (false === ACCEPTED_FILTERS.includes(resolvedFilter)) {
            throw new Error(
                `CalendarControls: the filter option must be one of ApiOptionsFilter.ALL_CALENDARS, .GENERAL_ROMAN, .PATH_BUILDER, .LOCALE_ONLY, .YEAR_ONLY, or .NONE, but found: ${String(filter)}`,
            );
        }
        // F2: `CalendarPathInput` (rendered under `PATH_BUILDER`) composes ANY
        // API route — including `/calendar/nation/{anything the metadata
        // carries}` — entirely outside `deriveVisibility()`'s reach, which is a
        // full bypass of a scope's contract rather than a cosmetic gap. Making
        // `CalendarPathInput` scope-aware was considered and rejected: its whole
        // reason to exist is composing an unrestricted route, which is
        // definitionally incompatible with restricting which calendars are
        // reachable. Rejected here, by construction, rather than left to be
        // silently bypassed.
        if (
            null !== this.#scope &&
            ApiOptionsFilter.PATH_BUILDER === resolvedFilter
        ) {
            throw new Error(
                'CalendarControls: scope cannot be combined with ApiOptionsFilter.PATH_BUILDER. ' +
                    'CalendarPathInput composes ANY API route, which is incompatible with restricting ' +
                    'which calendars are reachable. Construct without a scope, or use a different filter.',
            );
        }
        this.#apiOptions = new ApiOptions({
            locale: this.#locale,
            apiClient,
        }).filter(resolvedFilter);

        // Applied HERE rather than left to the caller between construction and
        // the append. `AcceptHeaderInput.hide()` sets a flag that
        // `ApiOptions.appendTo()` reads, so a caller could only express it in a
        // window `mountInto()` never opens — which is what forced every real
        // consumer onto the constructor path and away from `settled` (#61).
        // Setting the flag in the constructor makes both paths equivalent,
        // because the flag is read at append time either way.
        //
        // There is no `true` branch: `hide()` is irreversible and the input
        // starts visible, so `acceptHeader: true` is the default reasserted,
        // not an un-hide.
        if (false === inputVisibility.acceptHeader) {
            this.#apiOptions._acceptHeaderInput.hide();
        }

        // Unlike `riteSelect`/`calendarSelect` above, the `ApiOptions` inputs
        // were reached by the theme bag only from 2.7.0 (issue #56) and then
        // only for `localeInput`; issue #60 extended it to the whole bundle
        // through `theme.apiOptions`. One call covers both, because
        // `applyApiOptionsTheme()` resolves each input itself and, with no
        // `apiOptions` key in the bag, resolves the other nine to nothing —
        // so a 2.7.0 theme still styles exactly what it styled then. It is the
        // same helper `DayViewer` calls for its own `ApiOptions`, so the two
        // behave alike rather than each inventing their own version.
        applyApiOptionsTheme(
            this.#apiOptions,
            theme,
            Messages[this.#language]?.['LANGUAGE'] ??
                Messages['en']['LANGUAGE'],
        );

        // Ported from `DayViewer`, which already gets this right (C3): a
        // constructed-with `it` viewer must show `it` in the locale input and
        // send `Accept-Language: it` on its first request, exactly as a
        // themed `it` locale input reads Italian in the select — not `la`,
        // and not silent. `defaultValue()` is what `LocaleInput.resetOptions()`
        // falls back to (instead of `'la'`) on a rite change, so setting it
        // here — regardless of `filter`, since the underlying input exists
        // whether or not this filter renders it — keeps that fallback correct
        // too, not only the very first render.
        this.#apiOptions._localeInput.defaultValue(this.#language);

        // Attached to the only two inputs that can move the selection payload.
        // A locale, year or year-type change moves nothing in it, so listening
        // to the whole `ApiOptions` would produce only notifications the dedupe
        // below has to drop. Attached HERE rather than on first subscription so
        // that `#lastSelectionKey` is seeded from the state these controls were
        // constructed in, which is what makes the dedupe independent of when a
        // caller happens to subscribe.
        this.#lastSelectionKey = CalendarControls.#selectionKey(
            this.#readSelection(),
        );
        this.#listenForSelection(this.#riteSelect._domElement);
        this.#listenForSelection(this.#calendarSelect._domElement);
    }

    /** @returns {RiteSelect} The wired rite select. */
    get riteSelect() {
        this.#assertUsable();
        return this.#riteSelect;
    }

    /** @returns {CalendarSelect} The wired calendar select. */
    get calendarSelect() {
        this.#assertUsable();
        return this.#calendarSelect;
    }

    /** @returns {ApiOptions} The wired ApiOptions. */
    get apiOptions() {
        this.#assertUsable();
        return this.#apiOptions;
    }

    /**
     * The locale chosen by the cascade and currently selected in the locale
     * input.
     *
     * Throws once these controls have been disposed; see
     * [`dispose()`](#dispose).
     *
     * @returns {string} The selected locale.
     * @throws {Error} If these controls have been disposed.
     */
    get selectedLocale() {
        this.#assertUsable();
        return this.#selectedLocale;
    }

    /**
     * What is selected, and which `ApiOptions` inputs that selection fixes.
     *
     * The state both migrated examples were deriving by hand from a raw `change`
     * listener plus a `value === ''` test (#68). Two things that test cannot
     * express and this can: WHICH inputs are affected, by name, and the case
     * where the rite predetermines them with no calendar selected at all — the
     * Ambrosian rite-level calendar, where `value === ''` reports "editable" for
     * four inputs `ApiOptions` has disabled.
     *
     * `calendarType` is the `data-calendartype` vocabulary (`national`,
     * `diocesan`) extended with `'general'` for the rite-level calendar, which is
     * `ApiClient`'s own cache-key category for it. It is deliberately NOT the
     * exported `CalendarType` enum, whose values are the URL segments
     * `nation`/`diocese` — that describes a path, not a selection. `calendarId`
     * is `null` rather than `''` there, so the empty-string test this replaces is
     * not simply rewritten against the payload.
     *
     * Read synchronously, so it is also the initial state a consumer paints
     * before subscribing — see `onSelectionChange()`, which deliberately does not
     * fire on registration.
     *
     * Throws once these controls have been disposed; see [`dispose()`](#dispose).
     *
     * @returns {import('../typedefs.js').CalendarSelection} The current selection.
     * @throws {Error} If these controls have been disposed.
     */
    get selection() {
        this.#assertUsable();
        return this.#readSelection();
    }

    /**
     * Builds the selection payload from the calendar select and the `ApiOptions`.
     *
     * Split from the getter so the notifier can read it without going through
     * `#assertUsable()`, and so the two cannot describe the state differently.
     *
     * **The three-way dispatch is `fetch()`'s, deliberately identical.** The
     * empty value is the rite-level calendar, `data-calendartype="diocesan"` is
     * a diocese, and **anything else non-empty is a nation** — including an
     * option carrying no such attribute at all, which `fetch()` also sends to
     * `fetchNationalCalendar()`. Reading a missing attribute as `'general'`
     * instead would emit a payload contradicting itself, `'general'` beside a
     * non-null `calendarId`, and would describe a calendar differently from the
     * request this same class would issue for it.
     *
     * `selectedIndex === -1` — a value no option carries, which
     * `CalendarSelect#applyLinkedRite()` produces routinely — reads as the
     * rite-level calendar, exactly as every other reader in this library treats
     * it (#66), because `element.value` is `''` in that state too.
     *
     * **`predeterminedInputs` is what `ApiOptions` has APPLIED**, not an
     * abstract property of the selection: it is read from
     * `_predeterminedInputs`, which only a `change` event updates. Two
     * consequences, both documented in `docs/meta-components.md`: controls that
     * were never wired report the empty set, because nothing ever applied
     * anything to their form; and a programmatic `CalendarSelect.value()`
     * dispatches no `change`, so — exactly as `ApiClient` would not refetch for
     * it — this does not see it until a `change` is dispatched. Deriving it live
     * here instead would make this ONE key react to a select that the rest of an
     * unwired form still ignores, which is a less coherent payload, not a more
     * accurate one.
     *
     * @returns {import('../typedefs.js').CalendarSelection} The current selection.
     */
    #readSelection() {
        const element = this.#calendarSelect._domElement;
        const value = element.value;
        const selected = element.options[element.selectedIndex];
        let calendarType = 'general';
        if ('' !== value) {
            calendarType =
                'diocesan' === selected?.dataset.calendartype
                    ? 'diocesan'
                    : 'national';
        }
        return {
            calendarType,
            calendarId: '' === value ? null : value,
            predeterminedInputs: this.#apiOptions._predeterminedInputs,
        };
    }

    /**
     * Attaches the `change` listener that schedules a selection notification,
     * recording it so `dispose()` can remove it.
     *
     * Unlike the listeners `ApiClient.listenTo()` attaches — anonymous closures
     * created inside that class, which `dispose()` documents it cannot reach —
     * these are this class' own and are stored, so they ARE released.
     *
     * @param {HTMLElement} element - The select to listen to.
     * @returns {void}
     */
    #listenForSelection(element) {
        // `#applyScopeVisibility()` is called from HERE, synchronously, rather
        // than from `#scheduleSelectionNotify()`'s microtask — a scoped
        // control's `hidden` must already reflect the new selection by the
        // time this handler returns, not one turn later. This single listener
        // is attached to BOTH the rite select and the calendar select below,
        // which is deliberately the one place a rite change and a calendar
        // change both land: see `CalendarScope.js`'s `deriveVisibility()` doc
        // comment for what went wrong the last time visibility was re-derived
        // from only one side of that pair.
        const listener = () => {
            this.#scheduleSelectionNotify();
            this.#applyScopeVisibility();
        };
        element.addEventListener('change', listener);
        this.#selectionListeners.push({ element, listener });
    }

    /**
     * Re-derives, for a resolved scope, which OPTIONS the calendar select may
     * offer for the currently selected rite, and which of the three scoped
     * controls have a choice to offer at all — applying the first via
     * `CalendarSelect._restrictToScope()` and the second via `_setHidden()`.
     *
     * A no-op in effect when no scope was given: `_restrictToScope()` is never
     * called, and `deriveVisibility( null, … )` always returns all-true, whose
     * `_setHidden( false )` on an already-visible control changes nothing —
     * which is what keeps an unscoped instance behaving exactly as before this
     * option existed.
     *
     * **The restriction runs BEFORE the visibility derivation**, because a rite
     * change can leave the calendar select's previous value no longer among
     * the new rite's entries — `_restrictToScope()` then falls back to the new
     * list's first entry — and `deriveVisibility()`'s `localeInput` answer
     * depends on which calendar ends up selected, not which was selected before
     * this ran.
     *
     * Called once after mounting, in `appendTo()`, and again from
     * `#listenForSelection()`'s listener on every rite or calendar change —
     * see that method's doc comment for why that one listener is the correct
     * single place to call this from, rather than duplicating the call in a
     * rite-only and a calendar-only handler. Calling `_restrictToScope()` from
     * a CALENDAR change too (not only a rite change) is deliberate and safe:
     * the entries for an unchanged rite are identical, so `_restrictToScope()`
     * preserves the just-chosen value rather than reverting it — see that
     * method's own doc comment.
     *
     * @returns {void}
     */
    #applyScopeVisibility() {
        if (null !== this.#scope) {
            const currentRite = this.#riteSelect._domElement.value;
            this.#calendarSelect._restrictToScope(
                this.#scope.calendarsByRite[currentRite] ?? [],
                currentRite,
            );
        }
        const visibility = deriveVisibility(
            this.#scope,
            this.#riteSelect._domElement.value,
            this.#calendarSelect._domElement.value,
            this.#inputVisibility,
        );
        this.#riteSelect._setHidden(false === visibility.riteSelect);
        this.#calendarSelect._setHidden(false === visibility.calendarSelect);
        this.#apiOptions._localeInput._setHidden(
            false === visibility.localeInput,
        );
    }

    /**
     * A selection payload flattened to one string, for the change comparison.
     *
     * @param {import('../typedefs.js').CalendarSelection} selection - The payload.
     * @returns {string} A key equal for equal payloads.
     */
    static #selectionKey({ calendarType, calendarId, predeterminedInputs }) {
        return `${calendarType}|${calendarId ?? ''}|${predeterminedInputs.join(',')}`;
    }

    /**
     * Collapses the notifications one user action provokes into one, on a
     * microtask.
     *
     * One action moves several inputs: a rite change makes `ApiOptions` rewrite
     * the calendar list, the locale options and the year floor, each dispatching
     * its own synchronous `change`, and the calendar select's own listener fires
     * in that same burst. Notifying synchronously would hand a subscriber an
     * intermediate payload naming the calendar the user had just left — and
     * would hand it out before `ApiOptions`' own `change` listener had
     * necessarily run, so `predeterminedInputs` could still describe the
     * previous selection. Every dispatch in that burst is synchronous, so a
     * microtask flush reads settled state and nothing beyond the current turn is
     * swallowed.
     *
     * The same shape as `SubscriptionUrl.#scheduleNotify()` and
     * `ApiClient.#scheduleRefetch()`, for the structurally identical problem.
     *
     * @returns {void}
     */
    #scheduleSelectionNotify() {
        if (null !== this.#pendingSelectionNotify) {
            return;
        }
        this.#pendingSelectionNotify = Promise.resolve().then(() => {
            this.#pendingSelectionNotify = null;
            // NOT what stops a disposed instance notifying — `dispose()` empties
            // `#selectionCallbacks` before this ever runs, so the loop below
            // would already visit nothing. What this prevents is a disposed
            // instance doing pointless work in a turn it no longer belongs to:
            // reading its children's DOM and rewriting `#lastSelectionKey`. It
            // returns rather than throwing through `#assertUsable()`, because
            // this body runs on a microtask and a throw here would surface as an
            // unhandled rejection with no caller to catch it.
            if (true === this.#disposed) {
                return;
            }
            const selection = this.#readSelection();
            const key = CalendarControls.#selectionKey(selection);
            // The documented contract is that this fires when the selection
            // CHANGES. A `change` event that altered nothing it reports — a raw
            // dispatch, reselecting the option already selected — notifies
            // nobody, since there is nothing for a consumer to restyle.
            // Compared against the LAST NOTIFIED key, not a set of every key
            // ever seen, so changing away and back notifies both times.
            if (key === this.#lastSelectionKey) {
                return;
            }
            this.#lastSelectionKey = key;
            // `forEach`, not `for...of`: it captures the length before it
            // starts, so a callback that registers ANOTHER callback does not
            // have that new one fired inside this same flush — which would
            // contradict "does not fire on subscribe". `SubscriptionUrl` and
            // `EventEmitter.emit()` both notify this way, for the same reason.
            //
            // A callback that THROWS still aborts the rest of the batch, here as
            // in both of those. That is the library's existing behaviour for
            // subscriptions rather than a choice made here, and it is documented
            // rather than silently diverged from.
            this.#selectionCallbacks.forEach((callback) => callback(selection));
        });
    }

    /**
     * Registers a callback fired whenever the selection changes.
     *
     * Receives the same payload as [`selection`](#selection): what kind of
     * calendar is selected, its id, and which `ApiOptions` inputs that selection
     * predetermines. This is what replaces a raw `change` listener on the
     * calendar select plus a `value === ''` test (#68) — a test that is also
     * wrong under the Ambrosian rite, where the Missal predetermines four inputs
     * with no calendar selected at all.
     *
     * **Fired once per user action, on a microtask, and only when the payload
     * changed.** One action moves several inputs; see
     * `#scheduleSelectionNotify()`.
     *
     * **It does NOT fire on subscribe.** The initial state is available
     * synchronously and race-free from `selection`, so painting it is one extra
     * line, and a callback invoked inside the registration call would run
     * consumer code before the registering statement had returned. This matches
     * `onCalendarFetched()`, `onError()` and `SubscriptionBuilder.onChange()`,
     * none of which replay:
     *
     * ```javascript
     * const paint = ( { predeterminedInputs } ) => { … };
     * paint( controls.selection );
     * controls.onSelectionChange( paint );
     * ```
     *
     * @param {function(import('../typedefs.js').CalendarSelection): void} callback - Receives the new selection.
     * @returns {CalendarControls} This instance, for chaining.
     * @throws {Error} If these controls have been disposed, or `callback` is not
     *   a function.
     */
    onSelectionChange(callback) {
        this.#assertUsable();
        if (typeof callback !== 'function') {
            throw new Error(
                `CalendarControls.onSelectionChange: callback must be a function, but found type: ${typeof callback}`,
            );
        }
        this.#selectionCallbacks.push(callback);
        return this;
    }

    /**
     * Chooses the locale to request, from those the selected calendar
     * supports.
     *
     * Ported verbatim from `DayViewer.#matchLocale()`: exact match, then
     * language-prefix match, then the first available option, then the
     * configured locale — so a `CalendarControls` constructed with `it-CH`
     * gets Italian rather than English, exactly as `DayViewer` does, rather
     * than the two components inventing different cascades for the same
     * documented behaviour.
     *
     * @returns {string} The locale to request.
     */
    #matchLocale() {
        const options = this.#apiOptions._localeInput.options();
        const exact = options.find((value) => value === this.#locale);
        const language = options.find(
            (value) => value.split(/[-_]/)[0] === this.#language,
        );
        return exact ?? language ?? options[0] ?? this.#locale;
    }

    /**
     * Resolves once the most recent fetch these controls issued has settled.
     *
     * `mountInto()` resolves to the controls, not to the calendar data, and drops
     * the initial fetch's promise — so a caller had no way to sequence on that
     * first request: not to hide a spinner, not to assert in a test, not to know
     * it had finished at all. `onCalendarFetched()` and `onError()` between them
     * observe everything about that fetch EXCEPT when it finished. This is that
     * one missing signal, and only that: it answers "has it finished", never
     * "did it work".
     *
     * **What it observes.** `mountInto()`'s initial fetch, and every `fetch()`
     * call, on both construction paths — each REPLACING what came before, so it
     * always names the latest request this component issued rather than the
     * first. A caller who fetches twice wants to know when the second finished;
     * keeping only the first would make the property dead after one use. It was
     * once reachable only from `mountInto()`, which was exactly backwards: a
     * single pre-append flag (`_acceptHeaderInput.hide()`, now the
     * `inputs: { acceptHeader }` option) put every real consumer on the
     * constructor path, where this signal did not exist (#61).
     *
     * It does NOT observe the refetches `ApiClient`'s own `listenTo()` change
     * listeners drive — a user picking a different calendar. Those requests are
     * issued inside `ApiClient` and their promises never reach this class.
     *
     * **It always resolves, never rejects**, with `undefined`. A property present
     * on every mounted instance that could reject would produce an unhandled
     * rejection for every caller who never reads it — precisely the trap
     * `mountInto()` avoids today by discarding. What is stored is a HANDLED
     * derived branch of the fetch promise, built with a two-callback `then()`:
     * the promise `fetch()` hands back is untouched and still the caller's to
     * handle, and the branch resolves with `undefined` on success as well as on
     * failure. (A bare `.catch( handler )` would not: it passes a fulfilled value
     * straight through, so this used to resolve with the whole calendar payload —
     * a second data channel free to drift from `onCalendarFetched()`.) Success
     * and failure stay with `onError()`, which also reports the failures raised
     * before a request is ever issued.
     *
     * It is **always a promise**, already resolved when nothing has been issued —
     * `initialFetch: false`, no `apiClient`, or a hand-constructed instance whose
     * caller has not called `fetch()` yet. A `fetch()` that throws synchronously,
     * for want of a wired client, issues nothing and so leaves it untouched. An
     * absent property would break `.then()` and force callers to feature-detect.
     *
     * `CalendarResourcePicker` and `ApiExplorer` have no such property, and that
     * absence is deliberate: neither ever fetches, so neither has anything to
     * settle. `CalendarViewer` has it, but its factory already awaits the initial
     * fetch before resolving, so there it is settled by the time the caller can
     * reach it.
     *
     * Throws once these controls have been disposed; see [`dispose()`](#dispose).
     *
     * @returns {Promise<void>} Settles when the latest fetch has finished.
     * @throws {Error} If this instance has been disposed.
     */
    get settled() {
        this.#assertUsable();
        // The rule, and the reason for it, live in `Settled.js` — one place
        // rather than three near-identical copies of the same nine-line
        // rationale.
        return normalizeSettled(this.#settled);
    }

    /**
     * Guards every method a disposed instance cannot honour.
     *
     * @returns {void}
     * @throws {Error} If this instance has been disposed.
     */
    #assertUsable() {
        if (true === this.#disposed) {
            throw new Error(
                'CalendarControls: these controls have been disposed and can no longer be used.',
            );
        }
    }

    /**
     * Resolves a mount target to an element.
     *
     * @param {string|HTMLElement} target - A CSS selector or an element.
     * @param {string} slot - The slot name, for the message.
     * @param {string} caller - The FULL `Class.method` prefix to report the
     *   message under — e.g. `'CalendarControls.appendTo'` for a direct call,
     *   `'CalendarControls.mountInto'` when this runs inside that factory, or
     *   a composing class' own name (`'CalendarViewer.mountInto'`) when this
     *   method is reached through that class instead, so the thrown message
     *   names whichever class and method the caller actually used.
     * @returns {HTMLElement} The resolved element.
     * @throws {Error} If the target is neither, or matches nothing.
     */
    static #requireElement(target, slot, caller, hint = '') {
        if (target instanceof HTMLElement) {
            return target;
        }
        if (typeof target !== 'string' || '' === target) {
            throw new Error(
                `${caller}: the ${slot} target must be a non-empty CSS selector or an HTMLElement${hint}.`,
            );
        }
        const element = document.querySelector(target);
        if (null === element) {
            throw new Error(
                `${caller}: Element not found for the ${slot} slot: ${target}`,
            );
        }
        return element;
    }

    /**
     * Mounts the three children, and optionally a messages table, rite select
     * first so it reads first in the form.
     *
     * Takes either a single target — mounted into for `controls` only, with no
     * messages rendering — or a slots object naming `{ controls, messages }`.
     * `controls` is required in the slots form; `messages` is optional, and its
     * absence means the API's `messages` array is never rendered.
     *
     * **`controls` itself may be a single target — every input the filter
     * selects in one container — or an object keyed by `ApiOptions` filter**
     * (`generalRoman`, `allCalendars`, `pathBuilder`, `localeOnly`,
     * `yearOnly`, plus `basePath`/`allPaths` as aliases of the first two),
     * which splits the form across one container per filter. The rite and
     * calendar selects mount into the FIRST key named; the passes themselves
     * run in a canonical order this class chooses. See `ControlSlots.js` and
     * `#appendByFilter()` for what is rejected and why. This widens what the
     * slot's VALUE may be; the slot NAMES are unchanged.
     *
     * `linkToRiteSelect()` does NOT require the select to be in the document —
     * it only calls `addEventListener` and reads `.value`, both fine detached —
     * so the ordering is for form layout, nothing else.
     *
     * Callable more than once; the children are moved rather than copied.
     *
     * @param {string|HTMLElement|{controls: (string|HTMLElement|Object<string, (string|HTMLElement)>), messages?: (string|HTMLElement)}} target - Where to mount.
     * @param {string} [caller='CalendarControls.appendTo'] - Internal only: the
     *   full `Class.method` prefix to report in a thrown message.
     *   `mountInto()` passes `'CalendarControls.mountInto'` here, and a
     *   composing class (`CalendarViewer`) passes its OWN name, so a bad
     *   target is reported under the name the caller actually used rather
     *   than always under `CalendarControls.appendTo`.
     * @returns {void}
     * @throws {Error} If this instance has been disposed, or `target` is
     *   neither a single target nor a slots object naming `controls`.
     * @throws {Error} If `target` names a slot outside `{ controls, messages }`.
     */
    appendTo(target, caller = 'CalendarControls.appendTo') {
        this.#assertUsable();
        const single =
            typeof target === 'string' || target instanceof HTMLElement;

        // Anything that is neither a single target NOR a plausible slots object
        // must be rejected here, by name, rather than silently mounting nothing —
        // see `DayViewer.appendTo()` for the same guard against a bare number or
        // other malformed target.
        if (false === single) {
            try {
                assertPlainOptions(target, caller);
            } catch {
                throw new Error(
                    `${caller}: target must be a CSS selector, an HTMLElement, or a slots object naming { controls, messages } targets, but found type: ${describeType(target)}`,
                );
            }
        }
        const slots = single ? { controls: target } : target;
        const unknownKeys = Object.keys(slots).filter(
            (key) => false === SLOT_NAMES.includes(key),
        );
        if (unknownKeys.length > 0) {
            throw new Error(
                `${caller}: unknown slot name(s): ${unknownKeys.join(', ')}. Known slots are { controls, messages }.`,
            );
        }
        if (false === Object.hasOwn(slots, 'controls')) {
            throw new Error(
                `${caller}: a slots object must name a 'controls' target.`,
            );
        }

        // `controls` may be a single target — every input the filter selects in
        // one container, the behaviour this class shipped with, unchanged — or
        // an object keyed by `ApiOptions` filter, which splits the form across
        // as many containers as it names (#63). Doing that by hand needed a
        // two-pass `filter().appendTo()` idiom that reached through this class
        // for the `ApiOptions` it owns, and rested on three rules nothing
        // enforced; all three are checked in `ControlSlots.js` and below,
        // before a single element is resolved.
        if (isFilterKeyedControls(slots.controls)) {
            this.#appendByFilter(slots.controls, caller);
        } else {
            const element = CalendarControls.#requireElement(
                slots.controls,
                'controls',
                caller,
                CONTROLS_TARGET_HINT,
            );
            this.#rememberMounts([element]);
            this.#riteSelect.appendTo(element);
            this.#calendarSelect.appendTo(element);
            this.#apiOptions.appendTo(element);
        }

        // After the locale input is mounted, matching `DayViewer.appendTo()`'s
        // own ordering for the same cascade (C3): computed here rather than in
        // the constructor so a later `linkToCalendarSelect()` narrowing the
        // locale options (via `listenTo()`) is not required for this to run —
        // it only needs `#apiOptions` to exist, which it already does.
        this.#selectedLocale = this.#matchLocale();
        this.#apiOptions._localeInput._domElement.value = this.#selectedLocale;

        // Settles the three scoped controls' visibility against the rite and
        // calendar this instance was constructed or just re-mounted with. A
        // no-op for an unscoped instance; see `#applyScopeVisibility()`.
        this.#applyScopeVisibility();

        // The messages mount is reassigned on EVERY call, not only when the slot
        // is named. Re-mounting to a target that omits `messages` — or names a
        // different one — must stop rendering into the previous element: the
        // renderer subscription is permanent once registered, so leaving
        // `#messagesMount` pointing at the old node meant a later `calendarFetched`
        // kept writing into a container the caller had stopped naming, and only
        // `dispose()` ever cleared it.
        const previousMessagesMount = this.#messagesMount;
        this.#messagesMount = Object.hasOwn(slots, 'messages')
            ? CalendarControls.#requireElement(
                  slots.messages,
                  'messages',
                  caller,
              )
            : null;
        if (
            null !== previousMessagesMount &&
            previousMessagesMount !== this.#messagesMount
        ) {
            previousMessagesMount.replaceChildren();
        }
        if (null !== this.#messagesMount) {
            this.#registerMessagesRenderer();
        }
    }

    /**
     * Records containers this instance has mounted into, for `dispose()`.
     *
     * **Accumulates across calls, and deduplicates.** Deduplicating because
     * nothing stops a caller naming one container for two filters — legal, and
     * simply the single-target layout for those two passes. Accumulating
     * because a re-mount that names FEWER filters than the previous one leaves
     * the dropped filters' inputs exactly where they were: nothing in the new
     * bag moves them. Replacing the list would then hand `dispose()` a set of
     * containers that no longer covers everything this instance put in the
     * document, and those inputs would survive it. Re-clearing a container the
     * caller has stopped naming is the same call `appendTo()` already makes for
     * a `messages` mount it stops rendering into, for the same reason; the
     * containers emptied by moves are already empty, so it is a no-op there.
     *
     * @param {HTMLElement[]} elements - Containers just mounted into.
     * @returns {void}
     */
    #rememberMounts(elements) {
        this.#mounts = [...new Set([...this.#mounts, ...elements])];
    }

    /**
     * Mounts the three children across the containers a filter-keyed `controls`
     * slot names.
     *
     * **Ordering is this class' responsibility, not the caller's** — the first
     * of the three rules the two-pass idiom left unenforced. `ControlSlots.js`
     * returns the passes in a canonical order, so the same bag written with its
     * keys in either order mounts identically.
     *
     * **Every target is resolved BEFORE anything is appended**, so a typo in
     * the last container throws with the document untouched rather than leaving
     * a half-mounted form. That is the same rule `CalendarViewer.appendTo()`
     * already applies to its own `calendar` slot.
     *
     * **This leaves `#apiOptions`' filter set to the LAST pass**, because that
     * is what `ApiOptions.filter()` means. Re-mounting with another bag is
     * therefore fine — every pass sets the filter it needs — but a subsequent
     * BARE `appendTo( target )` moves only the inputs of that last filter, not
     * the whole form. This is exactly what the two-pass idiom has always left
     * behind, inherited rather than introduced; resetting the filter here would
     * be a new rule about an object the caller can also drive directly through
     * the `apiOptions` getter, so the state is left honest instead.
     * `ControlsSlotByFilter.test.js` records the consequence.
     *
     * **A `pathBuilder` pass also claims the year input PERMANENTLY on that
     * `ApiOptions`**, since `#pathBuilderEnabled` never resets. Re-mount with a
     * bag that omits `pathBuilder` and the overlap check will let
     * `allCalendars` claim the year input, while `ApiOptions.appendTo()` still
     * skips it — so it stays where the earlier pass put it. `#rememberMounts()`
     * is what keeps `dispose()` covering that container regardless; resetting
     * the flag would be a change to `ApiOptions`' own state machine, which this
     * slot-handling change deliberately stays out of.
     *
     * @param {Object<string, (string|HTMLElement)>} bag - The filter-keyed
     *   `controls` value.
     * @param {string} caller - The `Class.method` prefix to report under.
     * @returns {void}
     * @throws {Error} If this instance was constructed with
     *   `ApiOptionsFilter.NONE`, or the bag violates any of `ControlSlots.js`'
     *   rules, or one of its targets matches nothing.
     */
    #appendByFilter(bag, caller) {
        // Checked HERE rather than left to `ApiOptions.filter()`, which refuses
        // to move off an explicitly-set `NONE` with a message naming neither
        // this class nor the option the caller actually passed. `NONE` renders
        // every input, so there is nothing to split in the first place — the
        // same reason `ControlSlots.js` rejects `none` as a KEY.
        if (ApiOptionsFilter.NONE === this.#apiOptions._filter) {
            throw new Error(
                `${caller}: a filter-keyed controls slot cannot be used with filter: ApiOptionsFilter.NONE, which renders every input. Construct with a narrower filter, or name a single controls target.`,
            );
        }
        const { passes, selectsTarget } = resolveControlSlots(bag, caller);
        const resolved = passes.map((pass) => ({
            filter: pass.filter,
            element: CalendarControls.#requireElement(
                pass.target,
                `controls.${pass.key}`,
                caller,
            ),
        }));
        // Resolved separately rather than looked up among `resolved`: the
        // selects follow the caller's FIRST key, while the passes run in the
        // canonical order, so the two lists are not indexed alike.
        const selectsElement = CalendarControls.#requireElement(
            selectsTarget,
            'controls',
            caller,
        );

        this.#rememberMounts([
            selectsElement,
            ...resolved.map(({ element }) => element),
        ]);
        this.#riteSelect.appendTo(selectsElement);
        this.#calendarSelect.appendTo(selectsElement);
        for (const { filter, element } of resolved) {
            this.#apiOptions.filter(filter).appendTo(element);
        }
    }

    /**
     * Wires the controls to an `ApiClient`.
     *
     * The rite needs BOTH wires: `ApiOptions.linkToRiteSelect()` rebuilds the
     * calendar list and disables the temporal options the rite fixes, while only
     * `ApiClient.listenTo( riteSelect )` turns the rite into a URL path segment.
     * Wire just the first and the failure is silent — the form reads `ambrosian`
     * while every request still goes to `/calendar/roman/`.
     *
     * Rebinding is refused before anything is wired, so a rejected call leaves
     * the previous client and its subscriptions untouched.
     *
     * @param {ApiClient} apiClient - The client to drive.
     * @returns {CalendarControls} This instance.
     */
    listenTo(apiClient) {
        this.#assertUsable();
        if (null !== this.#apiClient) {
            throw new Error(
                'CalendarControls.listenTo: these controls are already wired to an ApiClient. Build a second CalendarControls to drive a second client.',
            );
        }
        assertSameBase(
            this.#base,
            apiClient?.base,
            'CalendarControls.listenTo: these controls and the ApiClient passed to them',
            'Controls filled from one API while their requests go to another would describe neither.',
        );

        // `#assertUsable()`'s equivalent check above (`null !== this.#apiClient`)
        // already refuses a second call before this point is reached, so a
        // separate `#riteLinked` guard is unreachable dead code — `listenTo()`
        // itself is one-shot, which makes the link below one-shot too.
        this.#apiOptions
            .linkToCalendarSelect(this.#calendarSelect)
            .linkToRiteSelect(this.#riteSelect);
        apiClient
            .listenTo(this.#calendarSelect)
            .listenTo(this.#riteSelect)
            .listenTo(this.#apiOptions);
        this.#apiClient = apiClient;

        for (const callback of this.#fetchedCallbacks) {
            this.#subscribe('calendarFetched', callback);
        }
        for (const callback of this.#errorCallbacks) {
            this.#subscribe('calendarFetchFailed', callback);
        }
        this.#registerMessagesRenderer();

        return this;
    }

    /**
     * Registers a callback for successfully fetched calendar data.
     *
     * This replaces reaching for `apiClient._eventBus.on( 'calendarFetched', … )`,
     * which both downstream examples do although `ApiClient.on()` has been public
     * since 2.0.0.
     *
     * @param {function(Object): void} callback - Receives the calendar payload.
     * @returns {CalendarControls} This instance.
     */
    onCalendarFetched(callback) {
        this.#assertUsable();
        this.#fetchedCallbacks.push(callback);
        this.#subscribe('calendarFetched', callback);
        return this;
    }

    /**
     * Registers a callback for calendar fetch failures.
     *
     * Subscribing is what stops `ApiClient` falling back to `console.error`: it
     * logs only when nothing is listening for `calendarFetchFailed`.
     *
     * @param {function(Error): void} callback - Receives the ApiClientError.
     * @returns {CalendarControls} This instance.
     */
    onError(callback) {
        this.#assertUsable();
        this.#errorCallbacks.push(callback);
        this.#subscribe('calendarFetchFailed', callback);
        return this;
    }

    /**
     * Subscribes one callback to one client event, recording the registration so
     * `dispose()` can pass the same reference back to `off()`.
     *
     * A callback registered before `listenTo()` is replayed by it; this method
     * subscribes directly only once a client exists, so the two paths are
     * mutually exclusive and nothing is ever subscribed twice.
     *
     * @param {string} event - The event name.
     * @param {function} callback - The consumer's callback.
     * @returns {void}
     */
    #subscribe(event, callback) {
        if (null === this.#apiClient) {
            return;
        }
        const listener = (payload) => {
            // Recorded so `#deliverError()` can tell an error the bus already
            // delivered from one it never will — see that method.
            if ('calendarFetchFailed' === event && null !== payload) {
                this.#deliveredErrors.add(payload);
            }
            callback(payload);
        };
        this.#apiClient._eventBus.on(event, listener);
        this.#subscriptions.push({ event, listener });
    }

    /**
     * Hands an error to the `onError()` callbacks if the event bus has not already
     * done so, and reports whether anything received it.
     *
     * `onError()` subscribes to `calendarFetchFailed`, and `ApiClient` deliberately
     * does NOT emit that event for a failure raised BEFORE a request goes out — an
     * unserviceable rite, an unusable locale — on the reasoning that it reports a
     * request that failed, not one that was never made. That reasoning holds for the
     * client. It left the meta-components saying `onError()` means "you will hear
     * about failures" while that whole class of failure bypassed it silently.
     *
     * So the bus is one delivery path and this is the other, and the `WeakSet` is
     * what stops an error travelling both and firing a callback twice.
     *
     * @param {Error} error - The failure to deliver.
     * @returns {boolean} True if any callback received it, here or via the bus.
     */
    #deliverError(error) {
        if (this.#deliveredErrors.has(error)) {
            return true;
        }
        if (0 === this.#errorCallbacks.length) {
            return false;
        }
        this.#deliveredErrors.add(error);
        for (const callback of this.#errorCallbacks) {
            callback(error);
        }
        return true;
    }

    /**
     * Internal seam onto {@link CalendarControls##deliverError}, for a composing
     * class whose own `mountInto()` drops an initial fetch.
     *
     * `CalendarViewer` holds a `CalendarControls` and forwards `onError()` to it,
     * so the callbacks live in THIS instance's `#errorCallbacks` — which a private
     * field puts out of that class' reach. Without this seam its factory had to
     * fall back to `apiClient._discardRequest()`, and that is exactly the bug #43
     * closed here: `_discardRequest` logs what the event bus never delivered, but
     * it cannot reach `onError()`, and a failure raised BEFORE the request goes out
     * never reaches the bus at all — so `onError()` silently missed that whole class
     * of failure. `_`-prefixed by this codebase's convention for internal-but-reachable
     * members (`_domElement`, `_discardRequest`); not part of the public API.
     *
     * @param {Error} error - The error to deliver.
     * @returns {boolean} `true` if a callback received it (or already had),
     *   `false` if nothing is subscribed and the caller should log instead.
     */
    _deliverError(error) {
        return this.#deliverError(error);
    }

    /**
     * Registers `#renderMessages()` on `calendarFetched`, once a client exists
     * and a messages slot was named.
     *
     * `appendTo()` may run before `listenTo()`, in which case `#subscribe()` is
     * still a no-op and this leaves `#messagesSubscribed` false; `listenTo()`
     * calls this again once `#apiClient` is set, which is what actually performs
     * the registration. Guarded so a call from both places — or a repeated
     * `appendTo()` naming `messages` again — never double-subscribes.
     *
     * @returns {void}
     */
    #registerMessagesRenderer() {
        if (
            null === this.#messagesMount ||
            true === this.#messagesSubscribed ||
            null === this.#apiClient
        ) {
            return;
        }
        this.#subscribe('calendarFetched', (data) =>
            this.#renderMessages(data),
        );
        this.#messagesSubscribed = true;
    }

    /**
     * Renders the API's `messages` array into the messages slot.
     *
     * The message cell goes through {@link module:SanitizeHtml}'s
     * `sanitizeHtml()`, which returns nodes rather than a string. `innerHTML`
     * would execute whatever the response contained, and `textContent` — what
     * this used to do — showed the reader literal `<a href="…">` tags, because
     * the API's messages genuinely carry markup: anchors to Vatican decrees,
     * `<i>`/`<b>` emphasis, highlighted `<span>`s. Neither was right; the
     * allowlist is the third option.
     *
     * The INDEX cell keeps `textContent`. It is a number this code generates,
     * so there is nothing to sanitize and routing it through a parser would
     * only suggest otherwise.
     *
     * Replaces rather than appends, so a refetch does not accumulate rows.
     *
     * @param {Object} data - The fetched calendar payload.
     * @returns {void}
     */
    #renderMessages(data) {
        if (null === this.#messagesMount) {
            return;
        }
        const messages = Array.isArray(data?.messages) ? data.messages : [];
        const rows = messages.map((message, index) => {
            const tr = document.createElement('tr');
            const indexCell = document.createElement('td');
            indexCell.textContent = String(index);
            const messageCell = document.createElement('td');
            messageCell.appendChild(sanitizeHtml(message));
            tr.append(indexCell, messageCell);
            return tr;
        });
        this.#messagesMount.replaceChildren(...rows);
    }

    /**
     * Fetches the calendar the select currently names.
     *
     * Dispatched three ways, from the `data-calendartype` attribute
     * `CalendarSelect` puts on each option: an empty value is the General Roman
     * Calendar, `national` is a nation, `diocesan` is a diocese. The FullCalendar
     * example writes only the first two by hand, so a diocesan selection there
     * calls `fetchNationalCalendar()` with a diocese id.
     *
     * The promise is returned directly, never routed through
     * `ApiClient#_discardRequest`. That seam exists for requests the library
     * fires and drops — `LiturgyOfAnyDay`'s year handling, the `listenTo()`
     * change listeners — where nothing else could observe the rejection, so it
     * falls back to `console.error` when no `calendarFetchFailed` listener
     * received it. A promise `fetch()` HANDS BACK is the opposite case: the
     * caller holds it and can `.catch()` or `await`/`try` it, so logging on top
     * of that would report a handled failure twice. `onError()` subscribers are
     * unaffected by this: the underlying fetch methods emit `calendarFetchFailed`
     * themselves before rejecting, independently of what this method does with
     * the returned promise.
     *
     * `#selectedLocale` (C3) is passed to whichever fetch method is chosen, so
     * the request carries the locale the cascade in `appendTo()` chose — and
     * the locale input currently shows — rather than whatever `Accept-Language`
     * happened to be left in force (nothing, on the very first call), which
     * silently fell back to Latin.
     *
     * @returns {Promise<Object>} The fetched calendar data.
     * @throws {Error} If no client has been wired.
     */
    fetch() {
        this.#assertUsable();
        if (null === this.#apiClient) {
            throw new Error(
                'CalendarControls.fetch: no ApiClient is wired. Call listenTo( apiClient ) first, or pass apiClient to mountInto().',
            );
        }
        const element = this.#calendarSelect._domElement;
        const value = element.value;
        let promise;
        if ('' === value) {
            promise = this.#apiClient.fetchCalendar(this.#selectedLocale);
        } else {
            const selected = element.options[element.selectedIndex];
            promise =
                'diocesan' === selected?.dataset.calendartype
                    ? this.#apiClient.fetchDiocesanCalendar(
                          value,
                          this.#selectedLocale,
                      )
                    : this.#apiClient.fetchNationalCalendar(
                          value,
                          this.#selectedLocale,
                      );
        }
        // `settled` tracks the most recent fetch this component issued, so a
        // hand-constructed instance publishes the same signal `mountInto()`
        // does (#61).
        //
        // Stored RAW, with no handler attached, and normalized only when the
        // `settled` getter is read. Deriving here instead — `promise.then( …,
        // … )` — would mark THIS promise object handled, and it is the very
        // object returned below: a caller who calls `fetch()` and ignores the
        // result would silently lose the platform's unhandled-rejection report.
        // That report is the premise of the paragraph above, which declines to
        // log precisely because the caller holds the promise. Rejection
        // tracking is per promise object, so the only way to keep it is to
        // attach nothing until someone actually asks.
        this.#settled = promise;
        return promise;
    }

    /**
     * Releases this instance's listeners and subscriptions and empties its mounts.
     *
     * Precisely what this DOES and does NOT release — the same split
     * `DayViewer.dispose()` documents, for the same reason:
     *
     * - **Released:** every subscription this instance made on the client's event
     *   bus through `onCalendarFetched()`/`onError()`/`listenTo()` (including the
     *   messages renderer `#registerMessagesRenderer()` subscribed) — unsubscribed
     *   via `EventEmitter.off()`, added in this same phase for exactly this
     *   purpose. The mounted DOM is also emptied: both the controls mount and, if
     *   named, the messages mount. `#subscriptions`, `#fetchedCallbacks` and
     *   `#errorCallbacks` are all cleared.
     * - **NOT released, and cannot be from here:** the `change` listeners
     *   `ApiClient.listenTo()` attaches to the calendar select, rite select and
     *   `ApiOptions` inputs. Those are anonymous closures created inside
     *   `ApiClient`'s own private `#listenToCalendarSelect`/`#listenToRiteSelect`/
     *   `#listenToApiOptions` methods, attached via `addEventListener`, with no
     *   reference stored anywhere this class — or `ApiClient` itself — can reach.
     *   This is a pre-existing gap in the wired components, not something
     *   `dispose()` papers over by claiming otherwise: a disposed instance's own
     *   DOM and event-bus footprint are gone, but the `ApiClient` it was wired to
     *   can still be driven by the same selects if a caller kept a separate
     *   reference to them and the client.
     *
     * Idempotent; further use throws.
     *
     * @returns {void}
     */
    dispose() {
        if (true === this.#disposed) {
            return;
        }
        if (null !== this.#apiClient) {
            for (const { event, listener } of this.#subscriptions) {
                this.#apiClient._eventBus.off(event, listener);
            }
        }
        for (const { element, listener } of this.#selectionListeners) {
            element.removeEventListener('change', listener);
        }
        this.#selectionListeners = [];
        this.#selectionCallbacks = [];
        this.#pendingSelectionNotify = null;
        this.#subscriptions = [];
        this.#fetchedCallbacks = [];
        this.#errorCallbacks = [];
        for (const mount of this.#mounts) {
            mount.replaceChildren();
        }
        this.#messagesMount?.replaceChildren();
        this.#mounts = [];
        this.#messagesMount = null;
        this.#apiClient = null;
        this.#disposed = true;
    }

    /**
     * Resolves a single-target mount argument to an already-attached element, for
     * the cancellation check in `mountInto()` only.
     *
     * Deliberately narrow: it recognises an `HTMLElement` given directly — either
     * as the whole `target` or as a slots object's `controls` key — and returns
     * `null` for everything else, including a CSS selector string. A selector is
     * resolved fresh by `appendTo()`/`#requireElement()`, and a selector that no
     * longer matches anything is reported there as "Element not found", which is
     * the correct REJECT for "this was never there" as much as for "this left the
     * DOM" — the two are indistinguishable from a selector alone. An already
     * resolved `HTMLElement` is different: the caller is holding a live reference,
     * so THIS instance leaving the document is a fact `isConnected` can actually
     * answer, and answering it is what lets `mountInto()` resolve to `null`
     * instead of mounting into a detached, invisible node.
     *
     * @param {string|HTMLElement|{controls?: (string|HTMLElement|Object<string, (string|HTMLElement)>)}} target - The `mountInto()` target argument.
     * @returns {HTMLElement|null} The resolved element, or `null` if none could be determined this way.
     */
    static #targetElement(target) {
        const single =
            typeof target === 'string' || target instanceof HTMLElement;
        let candidate = single ? target : target?.controls;
        // A filter-keyed `controls` slot has no single element to check. The
        // first container the caller named is the one the selects mount into,
        // so it is the right stand-in for "did this leave the document?" — and
        // without this the check would silently stop applying the moment a
        // caller adopted the filter-keyed form.
        if (isFilterKeyedControls(candidate)) {
            candidate = Object.values(candidate)[0];
        }
        return candidate instanceof HTMLElement ? candidate : null;
    }

    /**
     * Builds controls, mounts them, wires them to `options.apiClient` when given,
     * and performs the initial fetch.
     *
     * Modelled on `DayViewer.mountInto()`: options are normalised and the
     * instance is constructed BEFORE the cancellation check, so an invalid
     * locale or theme rejects even on a mount the caller already cancelled —
     * and, unlike `CalendarResourcePicker`, that same construction is where an
     * unloadable API base throws too. **This component has no failure
     * control.** `CalendarResourcePicker` renders one because it substitutes for
     * a single required form field, where an empty slot is indistinguishable
     * from "still loading" and produces an end-to-end timeout with nothing to
     * point at. A whole form has no equivalent: if the metadata is gone there is
     * no meaningful partial form to render, so construction is simply left to
     * throw and this factory rejects with it. See "Reject versus resolve" in
     * `docs/meta-components.md` for the full rule this follows.
     *
     * Resolves to `null`, without throwing or rejecting, when a supplied
     * `signal` was already aborted, or when `target` (or a slots object's
     * `controls` element) is an `HTMLElement` that has since left the document —
     * see `#targetElement()` for why only an already-resolved element can be
     * checked that way.
     *
     * **The initial fetch's rejection.** This factory resolves to the controls,
     * not to the calendar data, so the initial fetch's promise is dropped here —
     * exactly the fire-and-forget case `ApiClient#_discardRequest` exists for
     * (see `LiturgyOfAnyDay`'s three uses of it). It is therefore routed through
     * that seam rather than reimplemented by hand: `_discardRequest` logs to
     * `console.error` only when the failure reached no `calendarFetchFailed`
     * listener, checked against the same `deliveredFailures` bookkeeping every
     * other fire-and-forget request in this library relies on. `onError()` is
     * registered (when given) on the line immediately before this call, on the
     * very same client event bus `_discardRequest` checks, so a failure of this
     * very first request still reaches it — and is never logged twice. This
     * differs from `fetch()` itself, whose returned promise is handed directly
     * to the caller and never routed through `_discardRequest` — see that
     * method's own doc comment for why the two cases are opposite rather than
     * inconsistent.
     *
     * @param {string|HTMLElement|{controls: (string|HTMLElement|Object<string, (string|HTMLElement)>), messages?: (string|HTMLElement)}} target - Where to mount.
     * @param {Object} [options] - As the constructor, plus those below.
     * @param {import('../typedefs.js').CalendarScopeOptions} [options.scope] - Restricts
     *   which calendars this widget may show; see `CalendarScope.js`.
     * @param {Object} [options.apiClient] - The client to wire; when given, this
     *   instance is wired with `listenTo()` and, unless `initialFetch` is
     *   `false`, the initial fetch runs.
     * @param {boolean} [options.initialFetch=true] - Set `false` to wire the
     *   client without performing the ONE fetch `mountInto()` would otherwise
     *   perform immediately — a subsequent rite, calendar or option change
     *   still fetches normally, since `listenTo()` (called either way) also
     *   wires `apiClient.listenTo( calendarSelect ).listenTo( riteSelect
     *   ).listenTo( apiOptions )`. **This is NOT what `ApiExplorer` uses**,
     *   and does not by itself produce a component that never fetches:
     *   `ApiExplorer` needs every change to be fetch-free, not only the
     *   first one, so it never calls `listenTo()` at all — see that class'
     *   own doc comment for how it links the rite -> calendar chain
     *   directly instead.
     * @param {AbortSignal} [options.signal] - Cancels the mount; see above.
     * @param {function(Error): void} [options.onError] - Registered before the
     *   initial fetch, so a failure of that very first request still reaches it.
     * @returns {Promise<CalendarControls|null>} The controls, or `null` if cancelled.
     * @throws {Error} If the options or `target` are invalid, or if the API
     *   metadata cannot be loaded.
     */
    static async mountInto(target, options = {}) {
        const bag = normalizeComponentOptions(options, 'CalendarControls');
        const { apiClient, signal, onError, initialFetch } = bag;

        const controls = new CalendarControls(bag);
        const element = CalendarControls.#targetElement(target);
        if (
            true === signal?.aborted ||
            (null !== element && false === element.isConnected)
        ) {
            return null;
        }

        controls.appendTo(target, 'CalendarControls.mountInto');

        if (apiClient !== undefined && apiClient !== null) {
            controls.listenTo(apiClient);
            if (typeof onError === 'function') {
                controls.onError(onError);
            }
            if (false !== initialFetch) {
                // Handled here rather than through `apiClient._discardRequest()`,
                // which this used to call. That seam logs anything the event bus
                // never delivered, which covers a dropped promise correctly — but
                // it cannot reach `onError()`, and a failure raised BEFORE the
                // request goes out never reaches the bus either. The result was
                // that `onError()` silently missed that whole class of failure.
                //
                // `#deliverError()` tries the callbacks; only if nothing received
                // the error at all does it fall back to the console, so a failure
                // is never silent and never double-reported.
                // Captured rather than merely dropped, so `settled` observes
                // this fetch. The expression assigned is the branch that has
                // ALREADY delivered the failure — `fetch()` stored the raw
                // promise a moment ago and this overwrites it, which is what
                // keeps `await controls.settled` ordered after `onError()`
                // rather than racing it. The `settled` getter normalizes
                // whatever is stored here into a promise that resolves with
                // `undefined`, so this `.catch()` passing a fulfilled payload
                // through is of no consequence to that contract.
                controls.#settled = controls
                    .fetch()
                    .catch((error) =>
                        deliverFetchFailure(
                            'CalendarControls',
                            error,
                            (raised) => controls.#deliverError(raised),
                        ),
                    );
            }
        }

        return controls;
    }
}
