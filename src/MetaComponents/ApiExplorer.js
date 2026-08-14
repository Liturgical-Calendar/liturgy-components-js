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
 * **This class never calls `CalendarControls.listenTo()`.** That method wires
 * TWO separate things under one name: the rite -> calendar chain
 * (`apiOptions.linkToCalendarSelect().linkToRiteSelect()`, which rebuilds the
 * calendar list and disables fixed-temporal-option inputs — no `ApiClient`
 * involved) AND `apiClient.listenTo( calendarSelect ).listenTo( riteSelect
 * ).listenTo( apiOptions )` — which is what turns every rite, calendar and
 * option change into a live `/calendar/...` request. `ApiExplorer` needs only
 * the first half: it links the rite -> calendar chain directly in its
 * constructor, and never touches `apiClient.listenTo()` at all, so an
 * `ApiClient` passed to this class is used solely to populate the selects from
 * `/calendars` metadata (via `resolveBase()`, inside `CalendarControls`'
 * own constructor) — never to fetch a calendar.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import CalendarControls from './CalendarControls.js';
import { resolveInputVisibility } from './InputVisibility.js';
import PathBuilder from '../PathBuilder/PathBuilder.js';
import { ApiOptionsFilter } from '../Enums.js';
import {
    normalizeComponentOptions,
    assertPlainOptions,
    describeType,
} from '../OptionsValidation.js';

/** The slots a caller may name. @type {Readonly<string[]>} */
const SLOT_NAMES = Object.freeze([
    'pathBuilder',
    'basePath',
    'allPaths',
    'riteSelect',
    'builder',
]);

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
     * @param {Object} [options.inputs] - Which `ApiOptions` inputs to render;
     *   forwarded to `CalendarControls`. `{ acceptHeader: false }` drops the
     *   accept-header select from the `allPaths` slot — which is rendered by
     *   default here, and deliberately so: `PathBuilder` turns that select's
     *   `change` into the composed URL's `return_type`.
     * @param {Object} [options.apiClient] - Binds the controls to that client's
     *   API base, so the selects populate from `/calendars` metadata. Never used
     *   to fetch a calendar — see the class doc comment above.
     */
    constructor(options) {
        const bag = normalizeComponentOptions(options, 'ApiExplorer');
        // Validated here purely for ATTRIBUTION, and the result discarded — see
        // `CalendarViewer`'s constructor for why: `CalendarControls` applies the
        // same bag below, but names itself when rejecting it.
        resolveInputVisibility(bag.inputs, 'ApiExplorer');
        this.#controls = new CalendarControls(bag);
        // The rite -> calendar chain, wired directly rather than through
        // `CalendarControls.listenTo()` — see the class doc comment above for
        // why: that method also installs `apiClient.listenTo( … )`, which is
        // what fetches on every change. `linkToRiteSelect()` rebuilds the
        // calendar list and disables the fixed-temporal-option inputs entirely
        // on its own, with no `ApiClient` involved, so this line preserves that
        // behaviour without opening the door to any fetch.
        this.#controls.apiOptions
            .linkToCalendarSelect(this.#controls.calendarSelect)
            .linkToRiteSelect(this.#controls.riteSelect);
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
     * @param {string} caller - The full `Class.method` prefix to report the
     *   message under — `'ApiExplorer.appendTo'` for a direct call,
     *   `'ApiExplorer.mountInto'` when this runs inside that factory, so the
     *   thrown message names the method the caller actually used rather than
     *   always naming `appendTo`.
     * @returns {HTMLElement} The resolved element.
     * @throws {Error} If the target is neither, or matches nothing.
     */
    static #requireElement(target, slot, caller) {
        if (target instanceof HTMLElement) {
            return target;
        }
        if (typeof target !== 'string' || '' === target) {
            throw new Error(
                `${caller}: the ${slot} target must be a non-empty CSS selector or an HTMLElement.`,
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
     * **`pathBuilder` is the one REQUIRED slot**, unlike the other four: the
     * calendar select has no slot of its own and is positioned only as a side
     * effect of mounting `pathBuilder` (see above). Omitting it would leave
     * `calendarSelect` permanently detached from the document with no error
     * raised anywhere — `insertAdjacentElement('afterend', …)` on a node with
     * no parent is a silent no-op — so it is rejected here instead. The other
     * four slots stay optional; an omitted one simply skips that append. A
     * named slot that matches nothing throws, naming `ApiExplorer` and the
     * slot, and a slots object naming no key from `{ pathBuilder, basePath,
     * allPaths, riteSelect, builder }` at all — an empty object, or every key
     * misspelled — throws too, rather than silently mounting nothing.
     *
     * @param {{pathBuilder: (string|HTMLElement), basePath?: (string|HTMLElement), allPaths?: (string|HTMLElement), riteSelect?: (string|HTMLElement), builder?: (string|HTMLElement)}} slots - Where to mount each piece.
     * @param {string} [caller='ApiExplorer.appendTo'] - Internal only: the
     *   full `Class.method` prefix to report in a thrown message.
     *   `mountInto()` passes `'ApiExplorer.mountInto'` here, so a bad slot it
     *   forwards is reported under the name the caller actually used.
     * @returns {void}
     * @throws {Error} If this instance has been disposed, `slots` is not a
     *   plain object, names no known slot, names an unknown slot, omits
     *   `pathBuilder`, or a named slot matches nothing.
     */
    appendTo(slots, caller = 'ApiExplorer.appendTo') {
        this.#assertUsable();
        try {
            assertPlainOptions(slots, caller);
        } catch {
            throw new Error(
                `${caller}: slots must be an object naming { pathBuilder, basePath, allPaths, riteSelect, builder } targets, but found type: ${describeType(slots)}`,
            );
        }

        // A typo'd or empty slots object would otherwise mount nothing at
        // all and resolve successfully — the exact silent-failure shape I4
        // exists to close. Checked as two separate rules: any key outside
        // the known set is rejected by name (consistent with the
        // `webCalendar` bag's own unknown-key rejection on `CalendarViewer`),
        // and — narrower than "at least one known key" — `pathBuilder`
        // itself is required; see the doc comment above for why.
        const unknownKeys = Object.keys(slots).filter(
            (key) => false === SLOT_NAMES.includes(key),
        );
        if (unknownKeys.length > 0) {
            throw new Error(
                `${caller}: unknown slot name(s): ${unknownKeys.join(', ')}. Known slots are { pathBuilder, basePath, allPaths, riteSelect, builder }.`,
            );
        }
        if (false === Object.hasOwn(slots, 'pathBuilder')) {
            throw new Error(
                `${caller}: slots must name a 'pathBuilder' target. The calendar select has no slot of its own — it is positioned relative to the calendar-path input inside 'pathBuilder' — so omitting that slot would leave the calendar select permanently detached from the document.`,
            );
        }

        const pathBuilderTarget = ApiExplorer.#requireElement(
            slots.pathBuilder,
            'pathBuilder',
            caller,
        );
        this.#controls.apiOptions
            .filter(ApiOptionsFilter.PATH_BUILDER)
            .appendTo(pathBuilderTarget);
        this.#controls.calendarSelect.insertAfter(
            this.#controls.apiOptions._calendarPathInput,
        );
        this.#pathBuilderMount = pathBuilderTarget;

        if (Object.hasOwn(slots, 'riteSelect')) {
            const target = ApiExplorer.#requireElement(
                slots.riteSelect,
                'riteSelect',
                caller,
            );
            this.#controls.riteSelect.appendTo(target);
            this.#riteMount = target;
        }

        if (Object.hasOwn(slots, 'basePath')) {
            const target = ApiExplorer.#requireElement(
                slots.basePath,
                'basePath',
                caller,
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
                caller,
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
                caller,
            );
            this.#pathBuilder.appendTo(target);
            this.#builderMount = target;
        }
    }

    /**
     * Releases every mount this explorer used, and delegates to
     * `CalendarControls.dispose()` for its own half.
     *
     * This class never calls `CalendarControls.listenTo()` (see the class doc
     * comment above), so `controls`' own client-subscription bookkeeping is
     * always empty by the time this runs — `CalendarControls.dispose()` is still
     * called for symmetry and in case a caller reached `controls` directly and
     * wired it themselves, but ordinarily it has nothing to unsubscribe.
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
        for (const key of SLOT_NAMES) {
            const candidate = slots?.[key];
            if (candidate instanceof HTMLElement) {
                return candidate;
            }
        }
        return null;
    }

    /**
     * Builds an explorer and mounts it. `options.apiClient`, when given, is used
     * only to construct the controls against that client's API base (so the
     * selects populate from `/calendars` metadata) — see the class doc comment
     * above for why this class has no client-wiring step of its own and never
     * fetches a calendar, under any circumstance.
     *
     * Modelled on `CalendarViewer.mountInto()`: the explorer is constructed BEFORE
     * `slots` is validated and the cancellation check runs, so an invalid locale
     * or theme rejects even on a mount the caller already cancelled. Unlike every
     * other meta-component's `mountInto()`, there is no `initialFetch` option and
     * no `onError` option here — both concern a fetch this class never performs.
     *
     * Resolves to `null`, without throwing or rejecting, when a supplied `signal`
     * was already aborted, or when a slot's target was passed as an already
     * resolved `HTMLElement` that has since left the document — see
     * `#targetElement()` for why only an already-resolved element can be checked
     * that way.
     *
     * @param {{pathBuilder: (string|HTMLElement), basePath?: (string|HTMLElement), allPaths?: (string|HTMLElement), riteSelect?: (string|HTMLElement), builder?: (string|HTMLElement)}} slots - Where to mount each piece.
     * @param {Object} [options] - As the constructor.
     * @param {AbortSignal} [options.signal] - Cancels the mount; see above.
     * @returns {Promise<ApiExplorer|null>} The explorer, or `null` if cancelled.
     * @throws {Error} If the options or `slots` are invalid — including an
     *   empty or unknown-keys-only `slots`, or one omitting `pathBuilder` —
     *   or if the API metadata cannot be loaded.
     */
    static async mountInto(slots, options = {}) {
        const bag = normalizeComponentOptions(options, 'ApiExplorer');
        const { signal } = bag;

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

        explorer.appendTo(slots, 'ApiExplorer.mountInto');

        return explorer;
    }
}
