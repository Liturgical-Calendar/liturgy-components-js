/**
 * The rite select, calendar select and API options of a calendar page, wired to
 * one another and to an `ApiClient` — with no renderer.
 *
 * The renderer is the axis of variation and the wiring is not: the same 45-line
 * block appears byte-for-byte in a `WebCalendar` example and a FullCalendar one,
 * and again, minus the fetching, in the API explorer. This class is that block.
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
import { assertTheme, resolveChildTheme } from './Theme.js';

export default class CalendarControls {
    /** @type {string} */
    #locale = 'en';

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

    /** @type {HTMLElement|null} */
    #mount = null;

    /** @type {HTMLElement|null} */
    #messagesMount = null;

    /** @type {boolean} */
    #messagesSubscribed = false;

    /** @type {boolean} */
    #disposed = false;

    /** @type {boolean} */
    #riteLinked = false;

    /** @type {Array<function(Object): void>} */
    #fetchedCallbacks = [];

    /** @type {Array<function(Error): void>} */
    #errorCallbacks = [];

    /** @type {Array<{event: string, listener: function}>} */
    #subscriptions = [];

    /**
     * @param {Object|string|Intl.Locale} [options] - Options bag, or a locale.
     * @param {string|Intl.Locale} [options.locale] - The display locale.
     * @param {string} [options.filter] - Which `ApiOptions` inputs to show.
     * @param {Object} [options.theme] - The theme bag; see `Theme.js`.
     * @param {Object} [options.apiClient] - Binds to that client's API base.
     */
    constructor(options) {
        options = normalizeComponentOptions(options, 'CalendarControls');
        const { locale, filter, theme, apiClient } = options;

        if (locale !== undefined && locale !== null) {
            this.#locale = canonicalizeLocale(locale, 'CalendarControls');
        }
        // Used only for the calendar select's default label text fallback below —
        // its own children receive `this.#locale` directly and derive their own.
        const language = new Intl.Locale(this.#locale).language;
        assertTheme(theme, 'CalendarControls');
        this.#base = resolveBase(apiClient, 'CalendarControls');

        const riteTheme = resolveChildTheme(theme, 'riteSelect');
        this.#riteSelect = new RiteSelect({ locale: this.#locale });
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
                : (Messages[language]?.['SELECT_A_CALENDAR'] ??
                  Messages['en']['SELECT_A_CALENDAR']);
            this.#calendarSelect.label(labelOptions);
        }
        if (Object.hasOwn(calendarTheme, 'wrapperClass')) {
            this.#calendarSelect.wrapper({
                class: calendarTheme.wrapperClass,
            });
        }

        this.#apiOptions = new ApiOptions({
            locale: this.#locale,
            apiClient,
        }).filter(filter ?? ApiOptionsFilter.ALL_CALENDARS);
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
     * @param {string} caller - The calling method's name, for the message.
     * @returns {HTMLElement} The resolved element.
     * @throws {Error} If the target is neither, or matches nothing.
     */
    static #requireElement(target, slot, caller) {
        if (target instanceof HTMLElement) {
            return target;
        }
        if (typeof target !== 'string' || '' === target) {
            throw new Error(
                `CalendarControls.${caller}: the ${slot} target must be a non-empty CSS selector or an HTMLElement.`,
            );
        }
        const element = document.querySelector(target);
        if (null === element) {
            throw new Error(
                `CalendarControls.${caller}: Element not found for the ${slot} slot: ${target}`,
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
     * `linkToRiteSelect()` does NOT require the select to be in the document —
     * it only calls `addEventListener` and reads `.value`, both fine detached —
     * so the ordering is for form layout, nothing else.
     *
     * Callable more than once; the children are moved rather than copied.
     *
     * @param {string|HTMLElement|{controls: (string|HTMLElement), messages?: (string|HTMLElement)}} target - Where to mount.
     * @returns {void}
     * @throws {Error} If this instance has been disposed, or `target` is
     *   neither a single target nor a slots object naming `controls`.
     */
    appendTo(target) {
        this.#assertUsable();
        const single =
            typeof target === 'string' || target instanceof HTMLElement;

        // Anything that is neither a single target NOR a plausible slots object
        // must be rejected here, by name, rather than silently mounting nothing —
        // see `DayViewer.appendTo()` for the same guard against a bare number or
        // other malformed target.
        if (false === single) {
            try {
                assertPlainOptions(target, 'CalendarControls.appendTo');
            } catch {
                throw new Error(
                    `CalendarControls.appendTo: target must be a CSS selector, an HTMLElement, or a slots object naming { controls, messages } targets, but found type: ${describeType(target)}`,
                );
            }
        }
        const slots = single ? { controls: target } : target;
        if (false === Object.hasOwn(slots, 'controls')) {
            throw new Error(
                "CalendarControls.appendTo: a slots object must name a 'controls' target.",
            );
        }

        const element = CalendarControls.#requireElement(
            slots.controls,
            'controls',
            'appendTo',
        );
        this.#mount = element;
        this.#riteSelect.appendTo(element);
        this.#calendarSelect.appendTo(element);
        this.#apiOptions.appendTo(element);

        if (Object.hasOwn(slots, 'messages')) {
            this.#messagesMount = CalendarControls.#requireElement(
                slots.messages,
                'messages',
                'appendTo',
            );
            this.#registerMessagesRenderer();
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

        if (false === this.#riteLinked) {
            this.#apiOptions
                .linkToCalendarSelect(this.#calendarSelect)
                .linkToRiteSelect(this.#riteSelect);
            this.#riteLinked = true;
        }
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
        const listener = (payload) => callback(payload);
        this.#apiClient._eventBus.on(event, listener);
        this.#subscriptions.push({ event, listener });
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
     * Rows are built with `textContent`, not `innerHTML`. Both downstream
     * examples interpolate the API's strings into an HTML string, which would
     * render any markup a message contained.
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
            messageCell.textContent = String(message);
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
        if ('' === value) {
            return this.#apiClient.fetchCalendar();
        }
        const selected = element.options[element.selectedIndex];
        return 'diocesan' === selected?.dataset.calendartype
            ? this.#apiClient.fetchDiocesanCalendar(value)
            : this.#apiClient.fetchNationalCalendar(value);
    }
}
