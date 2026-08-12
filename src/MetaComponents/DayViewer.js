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
import { assertTheme, resolveChildTheme } from './Theme.js';

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
     * Every subscription this viewer made on the client's event bus, kept so that
     * `dispose()` can pass the exact same references back to `off()`.
     *
     * @type {Array<{event: string, listener: function}>}
     */
    #subscriptions = [];

    /** @type {Array<function(Error): void>} */
    #errorCallbacks = [];

    /**
     * @param {Object|string|Intl.Locale} [options] - Options bag, or a locale.
     * @param {string|Intl.Locale} [options.locale] - The display locale.
     * @param {Object} [options.theme] - The theme bag; see `Theme.js`.
     * @param {boolean} [options.showTitle=true] - Whether to show the widget's own heading.
     * @param {Object} [options.apiClient] - Binds this viewer to that client's API base.
     */
    constructor(options) {
        options = normalizeComponentOptions(options, 'DayViewer');
        const { locale, theme, showTitle, apiClient } = options;

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

        // No `text` on the rite label when `labelText` was not themed: omitting it
        // lets RiteSelect supply its own localized label (with its own English
        // fallback) rather than forcing a hardcoded one.
        const riteTheme = resolveChildTheme(theme, 'riteSelect');
        this.#riteSelect = new RiteSelect({ locale: this.#locale });
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
        if (Object.hasOwn(calendarTheme, 'wrapperClass')) {
            this.#calendarSelect.wrapper({ class: calendarTheme.wrapperClass });
        }

        this.#apiOptions = new ApiOptions({
            locale: this.#locale,
            apiClient,
        }).filter(ApiOptionsFilter.LOCALE_ONLY);
        const localeTheme = resolveChildTheme(theme, 'localeInput');
        if (Object.hasOwn(localeTheme, 'class')) {
            this.#apiOptions._localeInput.class(localeTheme.class);
        }
        if (Object.hasOwn(localeTheme, 'labelClass')) {
            this.#apiOptions._localeInput.labelClass(localeTheme.labelClass);
        }
        // `wrapperClass` can arrive from the flat `theme.wrapper` key too, which —
        // like the date controls below — supplies a class only, with no wrapper
        // element TYPE. `Input.wrapperClass()` requires a wrapper element to
        // already exist, so `'div'` is supplied as the default type whenever an
        // override does not name one explicitly. This was previously the one
        // per-child block in this constructor that read `class`/`labelClass` but
        // never `wrapperClass` at all — `LocaleInput` supports a wrapper exactly as
        // `CalendarSelect` does, so the flat `theme.wrapper` key silently applied to
        // every OTHER select-role child and not to this one.
        if (Object.hasOwn(localeTheme, 'wrapperClass')) {
            this.#apiOptions._localeInput.wrapper(localeTheme.wrapper ?? 'div');
            this.#apiOptions._localeInput.wrapperClass(
                localeTheme.wrapperClass,
            );
        }
        this.#apiOptions._localeInput._labelElement.textContent = Object.hasOwn(
            localeTheme,
            'labelText',
        )
            ? localeTheme.labelText
            : this.#message('LANGUAGE');
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
            const listener = (error) => callback(error);
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
            const listener = (error) => callback(error);
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
        return this.#apiClient.fetchCalendar(this.#selectedLocale);
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
     *   `#subscriptions` are cleared.
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
            // result await `viewer.fetch()` themselves.
            viewer.fetch().catch((error) => {
                if (0 === viewer.#errorCallbacks.length) {
                    console.error(
                        `DayViewer: could not load the calendar: ${error.message}`,
                    );
                }
            });
        }

        return viewer;
    }
}
