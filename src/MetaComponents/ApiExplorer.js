/**
 * A `CalendarControls` paired with a `PathBuilder`, with fetching turned off — the
 * whole "explore the API" page in one call.
 *
 * This is the awkward member of the family, for two reasons documented in detail
 * on `appendTo()` below: it appends the SAME `ApiOptions` instance three times,
 * under three different filters, into three different containers — because that is
 * what the page this was extracted from actually does
 * (`LiturgicalCalendarFrontend/assets/js/index.js`) — and it never fetches a
 * calendar at all. It exists only to let a visitor build and preview an API
 * request URL, so `CalendarControls.appendTo()`'s single-mount-point layout does
 * not fit it: this class bypasses that method entirely and drives
 * `riteSelect`/`calendarSelect`/`apiOptions` directly through `CalendarControls`'
 * own getters instead.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import CalendarControls from './CalendarControls.js';
import PathBuilder from '../PathBuilder/PathBuilder.js';
import ApiClient from '../ApiClient/ApiClient.js';
import { ApiOptionsFilter } from '../Enums.js';
import {
    normalizeComponentOptions,
    assertPlainOptions,
    describeType,
} from '../OptionsValidation.js';

export default class ApiExplorer {
    /** @type {CalendarControls} */
    #controls;

    /** @type {PathBuilder} */
    #pathBuilder;

    /** @type {HTMLElement|null} */
    #pathBuilderMount = null;

    /** @type {HTMLElement|null} */
    #riteMount = null;

    /** @type {HTMLElement|null} */
    #basePathMount = null;

    /** @type {HTMLElement|null} */
    #allPathsMount = null;

    /** @type {HTMLElement|null} */
    #builderMount = null;

    /** @type {boolean} */
    #disposed = false;

    /**
     * @param {Object|string|Intl.Locale} [options] - Options bag, or a locale,
     *   forwarded to `CalendarControls` as-is.
     * @param {string|Intl.Locale} [options.locale] - The display locale.
     * @param {Object} [options.theme] - The theme bag; see `Theme.js`.
     * @param {Object} [options.apiClient] - Binds to that client's API base.
     */
    constructor(options) {
        const bag = normalizeComponentOptions(options, 'ApiExplorer');
        this.#controls = new CalendarControls(bag);
        this.#pathBuilder = new PathBuilder(
            this.#controls.apiOptions,
            this.#controls.calendarSelect,
        );
    }

    /**
     * Guards every method a disposed explorer cannot honour.
     *
     * @returns {void}
     * @throws {Error} If this explorer has been disposed.
     */
    #assertUsable() {
        if (true === this.#disposed) {
            throw new Error(
                'ApiExplorer: this explorer has been disposed and can no longer be used.',
            );
        }
    }

    /** @returns {CalendarControls} The wired controls. */
    get controls() {
        this.#assertUsable();
        return this.#controls;
    }

    /** @returns {PathBuilder} The wired path builder. */
    get pathBuilder() {
        this.#assertUsable();
        return this.#pathBuilder;
    }

    /**
     * Resolves a mount target to an element.
     *
     * @param {string|HTMLElement} target - A CSS selector or an element.
     * @param {string} slot - The slot name, for the message.
     * @returns {HTMLElement} The resolved element.
     * @throws {Error} If the target is neither, or matches nothing.
     */
    static #requireElement(target, slot) {
        if (target instanceof HTMLElement) {
            return target;
        }
        if (typeof target !== 'string' || '' === target) {
            throw new Error(
                `ApiExplorer.appendTo: the ${slot} target must be a non-empty CSS selector or an HTMLElement.`,
            );
        }
        const element = document.querySelector(target);
        if (null === element) {
            throw new Error(
                `ApiExplorer.appendTo: Element not found for the ${slot} slot: ${target}`,
            );
        }
        return element;
    }

    /**
     * Mounts the wired children into up to five named slots, reproducing what
     * `LiturgicalCalendarFrontend/assets/js/index.js` does by hand.
     *
     * `apiOptions` is appended THREE TIMES, under three different filters, into
     * three different containers — `ApiOptionsFilter.PATH_BUILDER` into
     * `pathBuilder`, `ApiOptionsFilter.BASE_PATH` into `basePath`, and
     * `ApiOptionsFilter.ALL_PATHS` into `allPaths`. This is not a mistake: each
     * `filter()` call switches which of `ApiOptions`' underlying inputs the next
     * `appendTo()` call moves, so the one instance ends up with its calendar-path
     * and year inputs in one container, its Epiphany/Ascension/Corpus
     * Christi/Eternal High Priest/holydays-of-obligation inputs in a second, and
     * its locale/year-type/year inputs in a third — exactly the three-panel layout
     * the extracted page renders. Calling `filter()` more than once on the same
     * `ApiOptions` is supported precisely for this: see `ApiOptions.filter()`'s own
     * doc comment for why switching between two non-`NONE` filters never throws.
     *
     * `calendarSelect` has no slot of its own: it is positioned with
     * `insertAfter( apiOptions._calendarPathInput )`, immediately after the
     * calendar-path input inside the `pathBuilder` container — matching the page
     * this was extracted from — rather than appended into a container it owns.
     * Because `insertAfter()` inserts the select as a DOM sibling of the
     * calendar-path input, this only runs, and only makes sense, when the
     * `pathBuilder` slot itself is named: the calendar-path input must already be
     * in the document for `insertAdjacentElement( 'afterend', … )` to have a
     * parent to insert next to.
     *
     * Every slot is optional; an omitted one simply skips that append (and, for
     * `pathBuilder`, skips positioning the calendar select too). A named slot that
     * matches nothing throws, naming `ApiExplorer` and the slot.
     *
     * @param {{pathBuilder?: (string|HTMLElement), basePath?: (string|HTMLElement), allPaths?: (string|HTMLElement), riteSelect?: (string|HTMLElement), builder?: (string|HTMLElement)}} slots - Where to mount each piece.
     * @returns {void}
     * @throws {Error} If this instance has been disposed, `slots` is not a plain
     *   object, or a named slot matches nothing.
     */
    appendTo(slots) {
        this.#assertUsable();
        try {
            assertPlainOptions(slots, 'ApiExplorer.appendTo');
        } catch {
            throw new Error(
                `ApiExplorer.appendTo: slots must be an object naming { pathBuilder, basePath, allPaths, riteSelect, builder } targets, but found type: ${describeType(slots)}`,
            );
        }

        if (Object.hasOwn(slots, 'pathBuilder')) {
            const target = ApiExplorer.#requireElement(
                slots.pathBuilder,
                'pathBuilder',
            );
            this.#controls.apiOptions
                .filter(ApiOptionsFilter.PATH_BUILDER)
                .appendTo(target);
            this.#controls.calendarSelect.insertAfter(
                this.#controls.apiOptions._calendarPathInput,
            );
            this.#pathBuilderMount = target;
        }

        if (Object.hasOwn(slots, 'riteSelect')) {
            const target = ApiExplorer.#requireElement(
                slots.riteSelect,
                'riteSelect',
            );
            this.#controls.riteSelect.appendTo(target);
            this.#riteMount = target;
        }

        if (Object.hasOwn(slots, 'basePath')) {
            const target = ApiExplorer.#requireElement(
                slots.basePath,
                'basePath',
            );
            this.#controls.apiOptions
                .filter(ApiOptionsFilter.BASE_PATH)
                .appendTo(target);
            this.#basePathMount = target;
        }

        if (Object.hasOwn(slots, 'allPaths')) {
            const target = ApiExplorer.#requireElement(
                slots.allPaths,
                'allPaths',
            );
            this.#controls.apiOptions
                .filter(ApiOptionsFilter.ALL_PATHS)
                .appendTo(target);
            this.#allPathsMount = target;
        }

        if (Object.hasOwn(slots, 'builder')) {
            const target = ApiExplorer.#requireElement(
                slots.builder,
                'builder',
            );
            this.#pathBuilder.appendTo(target);
            this.#builderMount = target;
        }
    }

    /**
     * Wires this explorer's controls to an `ApiClient` — WITHOUT ever fetching a
     * calendar. `ApiExplorer` builds request URLs; it has no renderer to feed, so
     * there is nothing for a fetch to be for.
     *
     * Delegates entirely to `CalendarControls.listenTo()`, which is what installs
     * BOTH of the rite's wires: `ApiOptions.linkToRiteSelect()` (rebuilds the
     * calendar list for the selected rite) and `apiClient.listenTo( riteSelect )`
     * (turns the rite into a URL path segment). Both are needed here even though
     * nothing fetches — omitting either would leave the calendar list, or the
     * built path, out of sync with the rite select.
     *
     * @param {ApiClient} apiClient - The client to wire.
     * @returns {ApiExplorer} This instance.
     */
    listenTo(apiClient) {
        this.#assertUsable();
        this.#controls.listenTo(apiClient);
        return this;
    }

    /**
     * Releases the controls' listeners and subscriptions, and empties every mount
     * this explorer used.
     *
     * Delegates the controls half entirely to `CalendarControls.dispose()` — see
     * that method's own doc comment for exactly what it releases and what
     * survives it, for the same reason `CalendarViewer.dispose()` documents.
     * `PathBuilder` has no `dispose()` of its own and no way to unsubscribe its
     * internally-attached `change` listeners; only its mounted DOM (`builder`) can
     * be reclaimed from here, and it is.
     *
     * Idempotent; further use throws.
     *
     * @returns {void}
     */
    dispose() {
        if (true === this.#disposed) {
            return;
        }
        this.#controls.dispose();
        this.#pathBuilderMount?.replaceChildren();
        this.#riteMount?.replaceChildren();
        this.#basePathMount?.replaceChildren();
        this.#allPathsMount?.replaceChildren();
        this.#builderMount?.replaceChildren();
        this.#pathBuilderMount = null;
        this.#riteMount = null;
        this.#basePathMount = null;
        this.#allPathsMount = null;
        this.#builderMount = null;
        this.#disposed = true;
    }

    /**
     * Resolves the slots argument to an already-attached element, for the
     * cancellation check in `mountInto()` only — the same narrow purpose as
     * `CalendarViewer.#targetElement()`: it recognises an `HTMLElement` given
     * directly for any of the five slots, and returns `null` for a selector
     * string, which is resolved fresh (and reported as "not found" rather than
     * "cancelled" if it matches nothing) by `#requireElement()` inside
     * `appendTo()` itself.
     *
     * @param {Object} slots - The `mountInto()` slots argument.
     * @returns {HTMLElement|null} The first resolved element found, or `null`.
     */
    static #targetElement(slots) {
        for (const key of [
            'pathBuilder',
            'basePath',
            'allPaths',
            'riteSelect',
            'builder',
        ]) {
            const candidate = slots?.[key];
            if (candidate instanceof HTMLElement) {
                return candidate;
            }
        }
        return null;
    }

    /**
     * Builds an explorer, mounts it, and wires it to `options.apiClient` when
     * given — but NEVER fetches. See `listenTo()`'s own doc comment for why: this
     * class has no renderer, only a `PathBuilder` that reads request state
     * straight off the same `ApiOptions`/`CalendarSelect` `CalendarControls`
     * already wires, with no fetch involved at any point.
     *
     * Modelled on `CalendarViewer.mountInto()`: the explorer is constructed BEFORE
     * `slots` is validated and the cancellation check runs, so an invalid locale
     * or theme rejects even on a mount the caller already cancelled. Unlike every
     * other meta-component's `mountInto()`, there is no `initialFetch` option here
     * — it would have nothing to control, since this method never calls
     * `controls.fetch()` at all, under any circumstances.
     *
     * Resolves to `null`, without throwing or rejecting, when a supplied `signal`
     * was already aborted, or when a slot's target was passed as an already
     * resolved `HTMLElement` that has since left the document — see
     * `#targetElement()` for why only an already-resolved element can be checked
     * that way.
     *
     * @param {{pathBuilder?: (string|HTMLElement), basePath?: (string|HTMLElement), allPaths?: (string|HTMLElement), riteSelect?: (string|HTMLElement), builder?: (string|HTMLElement)}} slots - Where to mount each piece.
     * @param {Object} [options] - As the constructor, plus those below.
     * @param {Object} [options.apiClient] - The client to wire; when given, this
     *   instance is wired with `listenTo()`. No fetch ever runs.
     * @param {AbortSignal} [options.signal] - Cancels the mount; see above.
     * @returns {Promise<ApiExplorer|null>} The explorer, or `null` if cancelled.
     * @throws {Error} If the options or `slots` are invalid, or if the API
     *   metadata cannot be loaded.
     */
    static async mountInto(slots, options = {}) {
        const bag = normalizeComponentOptions(options, 'ApiExplorer');
        const { apiClient, signal } = bag;

        const explorer = new ApiExplorer(bag);

        try {
            assertPlainOptions(slots, 'ApiExplorer.mountInto');
        } catch {
            throw new Error(
                `ApiExplorer.mountInto: slots must be an object naming { pathBuilder, basePath, allPaths, riteSelect, builder } targets, but found type: ${describeType(slots)}`,
            );
        }

        const element = ApiExplorer.#targetElement(slots);
        if (
            true === signal?.aborted ||
            (null !== element && false === element.isConnected)
        ) {
            return null;
        }

        explorer.appendTo(slots);

        if (apiClient !== undefined && apiClient !== null) {
            explorer.listenTo(apiClient);
        }

        return explorer;
    }
}
