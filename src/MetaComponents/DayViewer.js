/**
 * A complete "liturgy of any day" page: a rite select, a calendar select, a locale
 * input and the `LiturgyOfAnyDay` widget, wired to one another and to an `ApiClient`.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import ApiClient from '../ApiClient/ApiClient.js';
import { resolveBase, assertSameBase } from '../ApiClient/ApiBase.js';
import LiturgyOfAnyDay from '../LiturgyOfAnyDay/LiturgyOfAnyDay.js';
import Messages from '../Messages.js';
import { ApiOptionsFilter } from '../Enums.js';
import {
    normalizeComponentOptions,
    assertPlainOptions,
    describeType,
} from '../OptionsValidation.js';
import { canonicalizeLocale } from '../LocaleValidation.js';
import { normalizeSettled, deliverFetchFailure } from './Settled.js';
import {
    assertScope,
    resolveScope,
    deriveVisibility,
} from './CalendarScope.js';
import {
    assertTheme,
    resolveChildTheme,
    resolveWrapperBag,
    applyApiOptionsTheme,
} from './Theme.js';

/** The slots a caller may name, in mount order. @type {Readonly<string[]>} */
const SLOT_NAMES = Object.freeze(['rite', 'calendar', 'locale', 'liturgy']);

export default class DayViewer {
    /** @type {string} */
    #locale = 'en';

    /** @type {string} */
    #language = 'en';

    /** @type {CalendarSelect} */
    #calendarSelect;

    /** @type {RiteSelect} */
    #riteSelect;

    /** @type {ApiOptions} */
    #apiOptions;

    /** @type {LiturgyOfAnyDay} */
    #liturgy;

    /** @type {string} */
    #selectedLocale = '';

    /** @type {HTMLElement[]} */
    #mounts = [];

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

    /** @type {ApiClient|null} */
    #apiClient = null;

    /**
     * The API base this viewer's children were bound to at construction.
     *
     * Resolved once and held, matching `CalendarSelect`: whichever base the
     * `apiClient` option named — or the default in force at the time — is the one
     * this viewer keeps for its lifetime, whatever is registered later. Held so
     * `listenTo()` can refuse a client bound to a different base.
     *
     * @type {import('../ApiClient/ApiBase.js').default}
     */
    #base;

    /**
     * `resolveScope()`'s result, or `null` for no scope — the "restricts
     * nothing" case that keeps every existing code path untouched. Read by
     * `#applyScopeVisibility()` on every call, so a rite or calendar change
     * always re-derives against the SAME resolved scope rather than a stale
     * copy. See `CalendarControls.js`'s identical field for the full
     * reasoning; this viewer builds its selects directly rather than through
     * `CalendarControls`, which is why it needs its own copy of the wiring.
     *
     * @type {?Object}
     */
    #scope = null;

    /**
     * The `change` listeners this viewer attached to the rite select and the
     * calendar select for scope re-derivation, so `dispose()` can remove
     * them — mirroring `CalendarControls`' `#selectionListeners`.
     *
     * @type {Array<{element: HTMLElement, listener: function}>}
     */
    #scopeListeners = [];

    /**
     * Every subscription this viewer made on the client's event bus, kept so that
     * `dispose()` can pass the exact same references back to `off()`.
     *
     * @type {Array<{event: string, listener: function}>}
     */
    #subscriptions = [];

    /** @type {Array<function(Error): void>} */
    #errorCallbacks = [];

    /**
     * Errors already handed to the `onError()` callbacks, so a failure that
     * travelled the event bus is not delivered a second time by `#deliverError()`.
     *
     * @type {WeakSet<object>}
     */
    #deliveredErrors = new WeakSet();

    /**
     * @param {Object|string|Intl.Locale} [options] - Options bag, or a locale.
     * @param {string|Intl.Locale} [options.locale] - The display locale.
     * @param {Object} [options.theme] - The theme bag; see `Theme.js`.
     * @param {boolean} [options.showTitle=true] - Whether to show the widget's own heading.
     * @param {Object} [options.apiClient] - Binds this viewer to that client's API base.
     * @param {import('../typedefs.js').CalendarScopeOptions} [options.scope] - Restricts
     *   which calendars this viewer may show; see `CalendarScope.js`. A nullish
     *   or unrestricting scope leaves every control visible, exactly as before
     *   this option existed.
     */
    constructor(options) {
        options = normalizeComponentOptions(options, 'DayViewer');
        const { locale, theme, showTitle, apiClient, scope } = options;

        // Validated here, by name, rather than left to whichever child happens to
        // construct first: each child would reject an invalid locale under its OWN
        // name, misattributing the failure to a component the caller never
        // directly touched. Canonicalising once and handing the canonical tag to
        // every child also means none of them re-derives it.
        if (locale !== undefined && locale !== null) {
            this.#locale = canonicalizeLocale(locale, 'DayViewer');
        }
        this.#language = new Intl.Locale(this.#locale).language;
        assertTheme(theme, 'DayViewer');

        // Resolved here, under this component's own name, so an `apiClient` that
        // carries no base is reported as a DayViewer problem rather than by whichever
        // child happens to construct first.
        this.#base = resolveBase(apiClient, 'DayViewer');

        // Validated and resolved BEFORE any child is built, same reasoning as
        // `CalendarControls`: a bad scope (an unknown key, an unmatched
        // diocese, a rite that leaves no calendar to resolve) is a programmer
        // error and must reject before anything half-mounts. `resolveScope()`
        // returns `null` for a scope that restricts nothing, and every scope
        // path below is a no-op on that value.
        assertScope(scope, 'DayViewer', this.#base);
        this.#scope = resolveScope(scope, this.#base);

        // No `text` on the rite label when `labelText` was not themed: omitting it
        // lets RiteSelect supply its own localized label (with its own English
        // fallback) rather than forcing a hardcoded one.
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
            const riteLabelOptions = {};
            if (Object.hasOwn(riteTheme, 'labelClass')) {
                riteLabelOptions.class = riteTheme.labelClass;
            }
            if (Object.hasOwn(riteTheme, 'labelText')) {
                riteLabelOptions.text = riteTheme.labelText;
            }
            this.#riteSelect.label(riteLabelOptions);
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
            this.#calendarSelect.label({
                ...(Object.hasOwn(calendarTheme, 'labelClass')
                    ? { class: calendarTheme.labelClass }
                    : {}),
                text: Object.hasOwn(calendarTheme, 'labelText')
                    ? calendarTheme.labelText
                    : this.#message('SELECT_A_CALENDAR'),
            });
        }
        const calendarWrapper = resolveWrapperBag(calendarTheme);
        if (null !== calendarWrapper) {
            this.#calendarSelect.wrapper(calendarWrapper);
        }

        // The scope's initial option list and selection. `_restrictToScope()`
        // MUST run before `value()`: the select's own default rite
        // (`Rite.ROMAN`, since no `rite` option is passed above) may not be
        // the scope's initial rite, so the UNRESTRICTED, Roman-built list may
        // not even carry the scope's initial calendar id — and `value()`
        // throws for any id no current option carries. See
        // `CalendarControls`' identical comment for the full reasoning.
        if (null !== this.#scope) {
            this.#calendarSelect._restrictToScope(
                this.#scope.calendarsByRite[this.#scope.initial.rite],
                this.#scope.initial.rite,
            );
            this.#calendarSelect.value(this.#scope.initial.calendarId);
        }

        this.#apiOptions = new ApiOptions({
            locale: this.#locale,
            apiClient,
        }).filter(ApiOptionsFilter.LOCALE_ONLY);
        // The whole bundle, not just the locale input (issue #60), through the
        // same helper `CalendarControls` calls. This viewer's `ApiOptions` is
        // `LOCALE_ONLY`-filtered, so `localeInput` is the only one of the ten
        // it ever appends — but the other nine exist here as they do anywhere
        // else, and resolving them costs nothing when the bag names none of
        // them. Routing this through the shared helper is also what keeps
        // `theme.localeInput` and `theme.apiOptions.localeInput` meaning the
        // same thing here as they do on `CalendarControls`.
        applyApiOptionsTheme(
            this.#apiOptions,
            theme,
            this.#message('LANGUAGE'),
        );
        this.#apiOptions._localeInput.defaultValue(this.#language);

        this.#liturgy = new LiturgyOfAnyDay({ locale: this.#locale });
        // The `liturgy` role, not the default `select` one: `LiturgyOfAnyDay`
        // takes eight further class setters that a `<select>` has no notion of,
        // and the loop below is written to call them. Before issue #43 this asked
        // for the select-shaped list, so all eight were stripped in transit and
        // that loop never executed once.
        const liturgyTheme = resolveChildTheme(theme, 'liturgy', 'liturgy');
        if (Object.hasOwn(liturgyTheme, 'class')) {
            this.#liturgy.class(liturgyTheme.class);
        }
        for (const key of [
            'titleClass',
            'dateClass',
            'dateControlsClass',
            'eventsWrapperClass',
            'eventClass',
            'eventGradeClass',
            'eventCommonClass',
            'eventYearCycleClass',
        ]) {
            if (Object.hasOwn(liturgyTheme, key)) {
                this.#liturgy[key](liturgyTheme[key]);
            }
        }

        // The three date controls share one theme entry and differ only by label,
        // because a consumer styling them differently from one another is a case
        // nobody has needed; `liturgy` getter access covers it if that changes.
        const controls = resolveChildTheme(theme, 'dateControls', 'input');

        // `resolveChildTheme` can hand back a `wrapperClass` (from the flat
        // `theme.wrapper` key, or a `dateControls.wrapperClass` override) with no
        // `wrapper` element TYPE alongside it — the flat key supplies a class only.
        // `dayInputConfig()`/`monthInputConfig()`/`yearInputConfig()` each call
        // `Input.wrapperClass()` only when a wrapper element already exists, and
        // `DayInput`/`MonthInput`/`YearInput` start with none, so a bare
        // `{ select, label, wrapper }` bag — the theme bag's own canonical example,
        // and the shape most consumers reach for first — crashed here with "Wrapper
        // has not been set". `CalendarResourcePicker` never hits this because none of
        // its children read `wrapperClass` without first reading `wrapper` too, so
        // the fix belongs here, at the one call site that has the gap, rather than in
        // `resolveChildTheme` itself, which every other meta-component also calls and
        // has no such gap to paper over. `'div'` matches the element
        // `LiturgyOfAnyDay` already wraps its own date controls in, so this changes
        // no visual structure a caller could not already have gotten by passing
        // `dateControls: { wrapper: 'div', wrapperClass: '...' }` explicitly — it
        // only supplies the same default automatically for the flat key.
        if (
            Object.hasOwn(controls, 'wrapperClass') &&
            false === Object.hasOwn(controls, 'wrapper')
        ) {
            controls.wrapper = 'div';
        }

        this.#liturgy
            .dayInputConfig({ ...controls, labelText: this.#message('DAY') })
            .monthInputConfig({
                ...controls,
                labelText: this.#message('MONTH'),
            })
            .yearInputConfig({ ...controls, labelText: this.#message('YEAR') })
            .buildDateControls();

        if (false === showTitle) {
            this.#liturgy._titleElement.style.display = 'none';
        }

        // Attached unconditionally, matching `CalendarControls`: a no-op for
        // an unscoped viewer, since `#applyScopeVisibility()` itself is a
        // no-op when `#scope` is `null`. This single listener, attached to
        // BOTH the rite select and the calendar select, is deliberately the
        // one place a rite change and a calendar change both land — see
        // `CalendarScope.js`'s `deriveVisibility()` doc comment for why
        // visibility must not be re-derived from only one side of that pair.
        this.#listenForScopeChange(this.#riteSelect._domElement);
        this.#listenForScopeChange(this.#calendarSelect._domElement);
    }

    /**
     * Re-derives, for a resolved scope, which OPTIONS the calendar select may
     * offer for the currently selected rite, and which of the rite select,
     * calendar select and locale input have a choice to offer at all —
     * applying the first via `CalendarSelect._restrictToScope()` and the rest
     * via `_setHidden()`. Unlike `CalendarResourcePicker`, this viewer HAS a
     * locale input — `ApiOptions._localeInput` — so all three fields of
     * `deriveVisibility()`'s return value are applied here, not just the
     * first two.
     *
     * A no-op in effect when no scope was given: `_restrictToScope()` is
     * never called, and `deriveVisibility( null, … )` always returns
     * all-true, whose `_setHidden( false )` on an already-visible control
     * changes nothing — which is what keeps an unscoped viewer behaving
     * exactly as before this option existed.
     *
     * **The restriction runs BEFORE the visibility derivation**, same
     * reasoning as `CalendarControls.#applyScopeVisibility()`: a rite change
     * can leave the calendar select's previous value no longer among the new
     * rite's entries, and `deriveVisibility()`'s `localeInput` answer depends
     * on which calendar ends up selected, not which was selected before this
     * ran.
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
        );
        this.#riteSelect._setHidden(false === visibility.riteSelect);
        this.#calendarSelect._setHidden(false === visibility.calendarSelect);
        this.#apiOptions._localeInput._setHidden(
            false === visibility.localeInput,
        );
    }

    /**
     * Attaches the `change` listener that re-derives scope visibility,
     * recording it so `dispose()` can remove it. Mirrors
     * `CalendarControls#listenForSelection()`.
     *
     * @param {HTMLElement} element - The select to listen to.
     * @returns {void}
     */
    #listenForScopeChange(element) {
        const listener = () => this.#applyScopeVisibility();
        element.addEventListener('change', listener);
        this.#scopeListeners.push({ element, listener });
    }

    /**
     * Reads a message key for this viewer's language, falling back to English.
     *
     * The fallback is per-KEY, not per-locale: `DAY`, `YEAR` and `LANGUAGE` are
     * translated for the same 12 locales that carry `SELECT_A_RITE`, while `MONTH`
     * and `SELECT_A_CALENDAR` are translated for all 84 — so a single locale can
     * legitimately hit the fallback for one key and not another.
     *
     * @param {string} key - The message key.
     * @returns {string} The translated string, or the English one.
     */
    #message(key) {
        return Messages[this.#language]?.[key] ?? Messages['en'][key];
    }

    /**
     * Chooses the locale to request, from those the selected calendar supports.
     *
     * Exact match, then language-prefix match, then the first available option,
     * then the configured locale. Written once here because every consumer wrote it
     * out by hand, and because the order is not self-evident: a page asking for
     * `it-CH` should get Italian rather than English.
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
     * The wired `CalendarSelect`.
     *
     * Throws once this viewer has been disposed; see [`dispose()`](#dispose).
     *
     * @returns {CalendarSelect} The wired calendar select.
     * @throws {Error} If this viewer has been disposed.
     */
    get calendarSelect() {
        this.#assertUsable();
        return this.#calendarSelect;
    }

    /**
     * The wired `RiteSelect`.
     *
     * Throws once this viewer has been disposed; see [`dispose()`](#dispose).
     *
     * @returns {RiteSelect} The wired rite select.
     * @throws {Error} If this viewer has been disposed.
     */
    get riteSelect() {
        this.#assertUsable();
        return this.#riteSelect;
    }

    /**
     * The `ApiOptions` locale input.
     *
     * Throws once this viewer has been disposed; see [`dispose()`](#dispose).
     *
     * @returns {Object} The `ApiOptions` locale input.
     * @throws {Error} If this viewer has been disposed.
     */
    get localeInput() {
        this.#assertUsable();
        return this.#apiOptions._localeInput;
    }

    /**
     * The wired `LiturgyOfAnyDay` widget.
     *
     * Throws once this viewer has been disposed; see [`dispose()`](#dispose).
     *
     * @returns {LiturgyOfAnyDay} The wired liturgy widget.
     * @throws {Error} If this viewer has been disposed.
     */
    get liturgy() {
        this.#assertUsable();
        return this.#liturgy;
    }

    /**
     * The locale chosen by the cascade and selected in the locale input.
     *
     * Throws once this viewer has been disposed; see [`dispose()`](#dispose).
     *
     * @returns {string} The selected locale.
     * @throws {Error} If this viewer has been disposed.
     */
    get selectedLocale() {
        this.#assertUsable();
        return this.#selectedLocale;
    }

    /**
     * Resolves once the most recent fetch this viewer issued has settled —
     * `mountInto()`'s initial one, or the latest `fetch()` call.
     *
     * Always resolves with `undefined`, never rejects, and is already resolved
     * when nothing has been issued. `CalendarControls#settled` carries the full
     * contract and the reasoning; this is the same property on the viewer.
     *
     * This factory resolves without awaiting the initial fetch — deliberately, so
     * a caller is handed a working viewer immediately — which is what makes this
     * property load-bearing here rather than merely convenient.
     *
     * The refetches `LiturgyOfAnyDay` drives for itself, through the client, are
     * not observed here: this tracks the requests THIS class issues.
     *
     * Throws once this viewer has been disposed; see [`dispose()`](#dispose).
     *
     * @returns {Promise<void>} Settles when the latest fetch has finished.
     * @throws {Error} If this viewer has been disposed.
     */
    get settled() {
        this.#assertUsable();
        // The rule, and the reason for it, live in `Settled.js` — one place
        // rather than three near-identical copies of the same nine-line
        // rationale.
        return normalizeSettled(this.#settled);
    }

    /**
     * Guards every method a disposed viewer cannot honour.
     *
     * A disposed component that quietly does nothing is worse than one that
     * throws: the caller's next assertion then fails somewhere unrelated.
     *
     * @returns {void}
     * @throws {Error} If this viewer has been disposed.
     */
    #assertUsable() {
        if (true === this.#disposed) {
            throw new Error(
                'DayViewer: this viewer has been disposed and can no longer be used.',
            );
        }
    }

    /**
     * Wires this viewer's controls to an `ApiClient`.
     *
     * The rite needs BOTH wires, and this is the whole reason the meta-component
     * exists. `linkToRiteSelect()` rebuilds the calendar list and disables the
     * temporal options the rite fixes; only `listenTo()` on the client turns the
     * rite into a path segment. Wire just the first and the failure is silent: the
     * form reads `ambrosian` while every request still goes to `/calendar/roman/`.
     *
     * `linkToRiteSelect()` is called here, from `listenTo()`, rather than in the
     * constructor — matching `mountInto()`'s own append-then-wire order and
     * `CalendarResourcePicker`'s append-then-link convention for the same pairing.
     * This is a house convention, not a DOM requirement: `CalendarSelect`'s half of
     * `linkToRiteSelect()` only calls `addEventListener` and reads `.value`, both of
     * which work identically on a detached node, and rebuilds its option list
     * synchronously from the in-memory calendar index rather than reading anything
     * from the document.
     *
     * @param {ApiClient} apiClient - The client to drive.
     * @returns {DayViewer} This instance.
     */
    listenTo(apiClient) {
        this.#assertUsable();

        // Rebinding is refused BEFORE anything is wired, so a rejected call leaves
        // the original client and its subscriptions exactly as they were.
        //
        // A second call already failed — `ApiOptions.linkToCalendarSelect()` is
        // one-shot and throws — but it threw under `ApiOptions`' name, naming a
        // component the caller never touched, and only by accident of being the
        // first statement. Refusing here states the rule instead of relying on a
        // child to enforce it.
        if (null !== this.#apiClient) {
            throw new Error(
                'DayViewer.listenTo: this viewer is already wired to an ApiClient. A viewer drives one client for its lifetime; build a second DayViewer to drive a second client.',
            );
        }

        // Checked before any wiring for the same reason. A client bound to a
        // different API base than the children would otherwise produce a viewer
        // whose selects list one API's calendars while its requests go to another.
        assertSameBase(
            this.#base,
            apiClient?.base,
            'DayViewer.listenTo: this viewer and the ApiClient passed to it',
            'A viewer whose selects are filled from one API while its requests go to another would describe neither.',
        );

        this.#apiOptions
            .linkToCalendarSelect(this.#calendarSelect)
            .linkToRiteSelect(this.#riteSelect);
        this.#liturgy.listenTo(apiClient);
        apiClient
            .listenTo(this.#calendarSelect)
            .listenTo(this.#riteSelect)
            .listenTo(this.#apiOptions);
        this.#apiClient = apiClient;

        // Replays every callback registered through `onError()` BEFORE a client was
        // wired: `onError()` only subscribes directly once `#apiClient` is already
        // set, so a callback registered earlier would otherwise never be attached to
        // the bus at all. The two paths are mutually exclusive — this loop replays
        // only what was registered before `listenTo()` ran, and `onError()` subscribes
        // directly only once a client already exists — so no callback is ever
        // subscribed twice.
        for (const callback of this.#errorCallbacks) {
            const listener = (error) => {
                // Recorded so `#deliverError()` can tell a failure the bus already
                // delivered from one it never will.
                if (null !== error) {
                    this.#deliveredErrors.add(error);
                }
                callback(error);
            };
            apiClient._eventBus.on('calendarFetchFailed', listener);
            this.#subscriptions.push({
                event: 'calendarFetchFailed',
                listener,
            });
        }

        return this;
    }

    /**
     * Resolves a mount target to an element.
     *
     * @param {string|HTMLElement} target - A CSS selector or an element.
     * @param {string} slot - The slot name, for the message.
     * @param {string} caller - The method name the caller invoked, for the
     *   message — `'appendTo'` for a direct call, `'mountInto'` when this runs
     *   inside that factory, so the thrown message names the method the caller
     *   actually used rather than always naming `appendTo`.
     * @returns {HTMLElement} The resolved element.
     * @throws {Error} If the target is neither, or matches nothing.
     */
    static #requireElement(target, slot, caller) {
        if (target instanceof HTMLElement) {
            return target;
        }
        if (typeof target !== 'string' || '' === target) {
            throw new Error(
                `DayViewer.${caller}: the ${slot} target must be a non-empty CSS selector or an HTMLElement.`,
            );
        }
        const element = document.querySelector(target);
        if (null === element) {
            throw new Error(
                `DayViewer.${caller}: Element not found for the ${slot} slot: ${target}`,
            );
        }
        return element;
    }

    /**
     * Mounts the viewer's children.
     *
     * Takes either a slots object naming a target per child, or a single target
     * receiving all of them. The page this was extracted from mounts its parts into
     * four separate containers, which a single target cannot express; a third party
     * embedding the widget wants the single target.
     *
     * An omitted slot means that child is not rendered.
     *
     * Returns `undefined`, matching every other component in this library.
     *
     * @param {string|HTMLElement|Object<string, string|HTMLElement>} target - Slots, or one target.
     * @param {string} [caller='appendTo'] - Internal only: the method name to
     *   report in a thrown message. `mountInto()` passes `'mountInto'` here so
     *   that a bad target it forwards is reported under the name the caller
     *   actually used, rather than always under `appendTo`.
     * @returns {void}
     * @throws {Error} If this viewer has been disposed.
     */
    appendTo(target, caller = 'appendTo') {
        this.#assertUsable();
        const single =
            typeof target === 'string' || target instanceof HTMLElement;

        // Anything that is neither a single target NOR a plausible slots object
        // must be rejected here, by name: `Object.hasOwn(42, 'rite')` coerces a
        // number to an object and returns `false` for every slot name, so without
        // this guard the mount loop below silently does nothing, and `null`
        // reaches `Object.hasOwn(null, ...)` and throws an unnamed raw TypeError.
        // `assertPlainOptions` already rejects null, arrays, and any non-plain
        // object (an `Intl.Locale`, a `Map`, ...) — exactly the shapes that are
        // neither a target nor a slots object — so it is reused here rather than
        // re-implementing the same check.
        if (false === single) {
            try {
                assertPlainOptions(target, `DayViewer.${caller}`);
            } catch {
                throw new Error(
                    `DayViewer.${caller}: target must be a CSS selector, an HTMLElement, or a slots object naming { rite, calendar, locale, liturgy } targets, but found type: ${describeType(target)}`,
                );
            }
        }
        const slots = single
            ? Object.fromEntries(SLOT_NAMES.map((name) => [name, target]))
            : target;

        const children = {
            rite: this.#riteSelect,
            calendar: this.#calendarSelect,
            locale: this.#apiOptions,
            liturgy: this.#liturgy,
        };

        for (const name of SLOT_NAMES) {
            if (false === Object.hasOwn(slots, name)) {
                continue;
            }
            const element = DayViewer.#requireElement(
                slots[name],
                name,
                caller,
            );
            this.#mounts.push(element);
            children[name].appendTo(element);
        }

        // Selecting Vatican would silently force Latin. The General Roman Calendar
        // is the universal calendar and is available in every supported locale, so
        // it is the honest default for a page that offers a language picker.
        this.#calendarSelect._domElement.value = '';

        // After the locale input is populated: its options come from the metadata
        // and are not present until it is built.
        this.#selectedLocale = this.#matchLocale();
        this.#apiOptions._localeInput._domElement.value = this.#selectedLocale;

        // Settles the rite select, calendar select and locale input's
        // visibility against the rite and calendar this viewer was
        // constructed or just re-mounted with. A no-op for an unscoped
        // viewer; see `#applyScopeVisibility()`.
        this.#applyScopeVisibility();
    }

    /**
     * Hands an error to the `onError()` callbacks if the event bus has not already
     * done so, and reports whether anything received it.
     *
     * `onError()` subscribes to `calendarFetchFailed`, and `ApiClient` deliberately
     * does NOT emit that event for a failure raised BEFORE a request goes out — an
     * unserviceable rite, an unusable locale — on the reasoning that it reports a
     * request that failed, not one that was never made. That reasoning holds for the
     * client, but it left this class promising through `onError()` that a caller
     * would hear about failures while that whole class of failure bypassed it.
     *
     * The `WeakSet` is what stops an error travelling both paths and firing a
     * callback twice.
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
     * Registers a callback for calendar fetch failures.
     *
     * Subscribing here is what stops the library falling back to `console.error`
     * behind the caller's back: `ApiClient` logs a failure only when nothing is
     * listening for `calendarFetchFailed`.
     *
     * @param {function(Error): void} callback - Receives the ApiClientError.
     * @returns {DayViewer} This instance.
     * @throws {Error} If this viewer has been disposed.
     */
    onError(callback) {
        this.#assertUsable();
        this.#errorCallbacks.push(callback);
        if (null !== this.#apiClient) {
            const listener = (error) => {
                if (null !== error) {
                    this.#deliveredErrors.add(error);
                }
                callback(error);
            };
            this.#apiClient._eventBus.on('calendarFetchFailed', listener);
            this.#subscriptions.push({
                event: 'calendarFetchFailed',
                listener,
            });
        }
        return this;
    }

    /**
     * Performs a calendar fetch using the locale chosen by the cascade.
     *
     * The returned promise is the caller's to handle. Rejections also reach any
     * `onError()` callbacks, so a page that registered one does not have to handle
     * the promise as well — but the rejection is never swallowed.
     *
     * @returns {Promise<Object>} The fetched calendar data.
     * @throws {Error} If this viewer has been disposed, or if no client has been
     *   wired with `listenTo()`.
     */
    fetch() {
        this.#assertUsable();
        if (null === this.#apiClient) {
            throw new Error(
                'DayViewer.fetch: no ApiClient is wired. Call listenTo( apiClient ) first, or pass apiClient to mountInto().',
            );
        }
        const promise = this.#apiClient.fetchCalendar(this.#selectedLocale);
        // `settled` tracks the most recent fetch this viewer issued, so a
        // hand-constructed viewer publishes the same signal `mountInto()` does
        // (#61). Stored RAW and normalized in the getter — see
        // `CalendarControls.fetch()` for why attaching a handler here would
        // silence the caller's own unhandled-rejection report.
        this.#settled = promise;
        return promise;
    }

    /**
     * Releases this viewer's listeners and subscriptions and empties its mounts.
     *
     * Precisely what this DOES and does NOT release:
     *
     * - **Released:** every subscription this viewer made on the client's event
     *   bus through `onError()`/`listenTo()` — the `off()` calls this makes are why
     *   `EventEmitter.off()` was added in this same phase. Without it teardown could
     *   only ever be partial, with these subscriptions still firing against a
     *   detached tree. The mounted DOM is also emptied, and `#errorCallbacks` and
     *   `#subscriptions` are cleared. So are the `change` listeners this viewer
     *   attached to the rite select and calendar select for scope re-derivation
     *   (`#scopeListeners`) — these are this viewer's OWN listeners, unlike the
     *   ones described next.
     * - **NOT released, and cannot be from here:** two gaps, both pre-existing in
     *   the wired components and neither closable from `DayViewer` itself:
     *   - The `change` listeners `ApiClient.listenTo()` attaches to the calendar
     *     select, rite select and `ApiOptions` inputs. Those are anonymous closures
     *     created inside `ApiClient`'s own private `#listenToCalendarSelect`/
     *     `#listenToRiteSelect`/`#listenToApiOptions` methods, attached via
     *     `addEventListener`, with no reference stored anywhere `DayViewer` can
     *     reach — not even by `ApiClient` itself.
     *   - The `calendarFetched` listener `LiturgyOfAnyDay.listenTo()` attaches to
     *     the client's event bus, for the same reason: an anonymous closure inside
     *     a method `DayViewer` does not own, with no reference `DayViewer` (or
     *     `LiturgyOfAnyDay`) can reach to unsubscribe.
     *
     *   Disposing a viewer therefore does not stop its selects or its `liturgy`
     *   widget from still driving the same `ApiClient` if a caller kept a separate
     *   reference to them and the client — exactly as `CalendarResourcePicker.dispose()`
     *   documents for the same reason.
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
        for (const { element, listener } of this.#scopeListeners) {
            element.removeEventListener('change', listener);
        }
        this.#scopeListeners = [];
        this.#subscriptions = [];
        this.#errorCallbacks = [];
        for (const mount of this.#mounts) {
            mount.replaceChildren();
        }
        this.#mounts = [];
        this.#apiClient = null;
        this.#disposed = true;
    }

    /**
     * Builds a viewer, mounts it, wires it and performs the initial fetch.
     *
     * Programmer error and runtime failure are answered differently, exactly as in
     * `CalendarResourcePicker.mountInto()`: invalid options or an unusable target
     * REJECT, while a failed calendar fetch reaches `onError()` (and, absent one,
     * `console.error`) and leaves a working, mounted form behind — a page whose
     * fetch failed is still a page the user can correct their selection on.
     *
     * Resolves to `null` when a supplied signal aborted before mounting could
     * happen.
     *
     * @param {string|HTMLElement|Object<string, string|HTMLElement>} target - Slots, or one target.
     * @param {Object} [options] - As the constructor, plus those below.
     * @param {import('../typedefs.js').CalendarScopeOptions} [options.scope] - Restricts
     *   which calendars this viewer may show; see `CalendarScope.js`.
     * @param {Object} [options.apiClient] - The client to wire; when given, the initial fetch runs.
     * @param {AbortSignal} [options.signal] - Cancels the mount.
     * @param {function(Error): void} [options.onError] - Registered before the initial fetch.
     * @returns {Promise<DayViewer|null>} The viewer, or `null` if cancelled.
     * @throws {Error} If the options or any slot target are invalid.
     */
    static async mountInto(target, options = {}) {
        const bag = normalizeComponentOptions(options, 'DayViewer');
        const { apiClient, signal, onError } = bag;

        // Constructed BEFORE the abort check so that an invalid locale or theme
        // rejects even on an aborted mount: a typo should be reported whether or
        // not the caller changed their mind.
        const viewer = new DayViewer(bag);
        if (true === signal?.aborted) {
            return null;
        }

        viewer.appendTo(target, 'mountInto');

        if (apiClient !== undefined && apiClient !== null) {
            viewer.listenTo(apiClient);
            if (typeof onError === 'function') {
                viewer.onError(onError);
            }
            // The rejection is handled here rather than returned, because this
            // factory's promise resolves to the viewer. Callers wanting the fetch
            // RESULT await `viewer.fetch()` themselves; callers wanting to know
            // when this one finished read `viewer.settled`, which is the promise
            // captured here, and the `settled` getter normalizes it into a
            // promise that resolves with `undefined` either way; see
            // `CalendarControls.mountInto()` for that reasoning.
            viewer.#settled = viewer.fetch().catch((error) => {
                // The guard here used to be `0 === viewer.#errorCallbacks.length`,
                // which assumed "a callback exists, therefore it will handle this".
                // That is exactly false for a failure raised before the request goes
                // out: no `calendarFetchFailed` is emitted, so the bus-bound callback
                // never runs, the log was skipped because a callback existed, and
                // this `.catch()` swallowed the rejection — total silence, and
                // registering `onError()` made it strictly worse than omitting it.
                deliverFetchFailure('DayViewer', error, (raised) =>
                    viewer.#deliverError(raised),
                );
            });
        }

        return viewer;
    }
}
