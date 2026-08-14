/**
 * A `CalendarControls` paired with a rendered iCal subscription URL and a copy
 * control — meta-components phase 3, and the answer to issue #42.
 *
 * It NEVER calls `CalendarControls.listenTo()`, so no `ApiClient` listener is
 * ever installed and no calendar request is ever issued. The `apiClient` option
 * binds the selects to that client's API base so they populate from `/calendars`
 * metadata; it is never used to fetch a calendar. This is `ApiExplorer`'s
 * template, for the same reason.
 *
 * Issue #42 asked whether `CalendarResourcePicker` should gain a browse/subscribe
 * mode. It should not: the picker's rules are load-bearing for a resource id,
 * where empty is never valid. Here empty is a REAL, SELECTABLE choice meaning the
 * rite-level calendar. All three of the issue's requirements are satisfied by
 * `CalendarControls` as it stands — its `CalendarSelect` is built with
 * `allowNull: true` and no filter — so this component adds only the URL half.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import CalendarControls from '../MetaComponents/CalendarControls.js';
import SubscriptionUrl from './SubscriptionUrl.js';
import { ApiOptionsFilter } from '../Enums.js';
import {
    assertPlainOptions,
    describeType,
    normalizeComponentOptions,
} from '../OptionsValidation.js';
import { toIntlLocale } from '../LocaleValidation.js';
import { resolveChildTheme } from '../MetaComponents/Theme.js';

/** The slot names `appendTo()` accepts. */
const SLOT_NAMES = Object.freeze(['controls', 'url']);

export default class SubscriptionBuilder {
    /** @type {CalendarControls} */
    #controls;

    /** @type {SubscriptionUrl} */
    #url;

    /** @type {HTMLElement|null} */
    #controlsMount = null;

    /** @type {HTMLElement|null} */
    #urlMount = null;

    /** @type {boolean} */
    #disposed = false;

    /**
     * @param {Object|string|Intl.Locale} [options] - Options bag, or a locale.
     * @param {string|Intl.Locale} [options.locale] - The display locale.
     * @param {Object} [options.theme] - The theme bag; see `Theme.js`. Its
     *   `theme.subscriptionUrl` override reaches the URL control's `class`
     *   only; style the inner `<code>` element with a descendant selector on
     *   that class, and use the top-level `copiedClass` option below for the
     *   copied state — see `SubscriptionUrl`'s own constructor doc comment
     *   for why those are `class`'s only sibling keys.
     * @param {Object} [options.apiClient] - Binds the controls to that client's
     *   API base. Never used to fetch a calendar.
     * @param {'https'|'webcal'} [options.scheme='https'] - The URL scheme.
     * @param {string|null} [options.copyIcon] - HTML for the copy glyph.
     * @param {string} [options.copyTitle] - The copy control's title.
     * @param {string} [options.copiedText] - The copied announcement.
     * @param {string} [options.copiedClass] - The transient copied class.
     * @param {function(boolean, Error=): void} [options.onCopy] - Copy outcome.
     */
    constructor(options) {
        const bag = normalizeComponentOptions(options, 'SubscriptionBuilder');
        // Validated here, by name, BEFORE `CalendarControls` is constructed:
        // left to whichever child constructs first, an invalid locale would
        // reject under THAT child's own name, misattributing the failure to a
        // component the caller never directly touched. Same pattern as
        // `DayViewer`. Canonicalising once also means `CalendarControls`
        // parses an already-valid tag and cannot re-throw under its own name.
        const intlLocale = toIntlLocale(
            bag.locale ?? 'en',
            'SubscriptionBuilder',
        );
        const language = intlLocale.language;
        this.#controls = new CalendarControls({ ...bag, locale: intlLocale });
        // The rite -> calendar chain, wired directly rather than through
        // `CalendarControls.listenTo()`: that method also installs
        // `apiClient.listenTo( … )`, which fetches on every change.
        this.#controls.apiOptions
            .linkToCalendarSelect(this.#controls.calendarSelect)
            .linkToRiteSelect(this.#controls.riteSelect);
        // `CalendarControls` now themes its own `ApiOptions` — the locale input
        // since issue #56, the whole ten-input bundle since issue #60, via the
        // shared `applyApiOptionsTheme()` helper in `Theme.js` — so nothing
        // further is needed here: the whole `bag`,
        // including `theme`, already flows into the `new CalendarControls(…)`
        // call above. `Input.wrapper()` became one-shot in 2.6.0, so a second
        // theming pass here would have THROWN rather than being redundant.
        //
        // `language` is derived above, where the normalized locale lives, and
        // passed in: the locale input exposes no locale accessor for
        // `SubscriptionUrl` to read.
        const urlTheme = resolveChildTheme(bag.theme, 'subscriptionUrl');
        this.#url = new SubscriptionUrl(
            this.#controls.apiOptions,
            this.#controls.calendarSelect,
            this.#controls.riteSelect,
            { ...bag, language, urlTheme },
        );
    }

    /**
     * Guards every method a disposed builder cannot honour.
     *
     * @returns {void}
     * @throws {Error} If this builder has been disposed.
     */
    #assertUsable() {
        if (true === this.#disposed) {
            throw new Error(
                'SubscriptionBuilder: this builder has been disposed and can no longer be used.',
            );
        }
    }

    /** @returns {CalendarControls} The wired controls. */
    get controls() {
        this.#assertUsable();
        return this.#controls;
    }

    /** @returns {Object} The wired rite select. */
    get riteSelect() {
        this.#assertUsable();
        return this.#controls.riteSelect;
    }

    /** @returns {Object} The wired calendar select. */
    get calendarSelect() {
        this.#assertUsable();
        return this.#controls.calendarSelect;
    }

    /** @returns {Object} The wired locale input. */
    get localeInput() {
        this.#assertUsable();
        return this.#controls.apiOptions._localeInput;
    }

    /** @returns {string} The serialized subscription URL. */
    get url() {
        this.#assertUsable();
        return this.#url.url;
    }

    /**
     * Registers a callback fired whenever the URL changes.
     *
     * @param {function(string): void} callback - Receives the new URL.
     * @returns {SubscriptionBuilder} This instance, for chaining.
     */
    onChange(callback) {
        this.#assertUsable();
        this.#url.onChange(callback);
        return this;
    }

    /**
     * Resolves a mount target to an element.
     *
     * @param {string|HTMLElement} target - A CSS selector or an element.
     * @param {string} slot - The slot name, for the message.
     * @param {string} caller - The `Class.method` prefix for the message.
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
     * Mounts the controls and the URL into two named slots.
     *
     * Both are REQUIRED, and a bare target is rejected: this component has two
     * mandatory mounts, and a lone target would have to pick one of them
     * silently. Matches `CalendarViewer` and `ApiExplorer`.
     *
     * The three controls all mount into the single `controls` container. Column
     * layout is the theme bag's job, through its `wrapper` keys — there is no
     * per-control slot.
     *
     * @param {{controls: (string|HTMLElement), url: (string|HTMLElement)}} slots - Where to mount.
     * @param {string} [caller='SubscriptionBuilder.appendTo'] - Internal only.
     * @returns {void}
     * @throws {Error} If disposed, if `slots` is not a plain object, names an
     *   unknown slot, omits either slot, or a slot matches nothing.
     */
    appendTo(slots, caller = 'SubscriptionBuilder.appendTo') {
        this.#assertUsable();
        try {
            assertPlainOptions(slots, caller);
        } catch {
            throw new Error(
                `${caller}: slots must be an object naming { controls, url } targets, but found type: ${describeType(slots)}`,
            );
        }

        const unknownKeys = Object.keys(slots).filter(
            (key) => false === SLOT_NAMES.includes(key),
        );
        if (unknownKeys.length > 0) {
            throw new Error(
                `${caller}: unknown slot name(s): ${unknownKeys.join(', ')}. Known slots are { controls, url }.`,
            );
        }
        for (const slot of SLOT_NAMES) {
            if (false === Object.hasOwn(slots, slot)) {
                throw new Error(
                    `${caller}: slots must name both a 'controls' and a 'url' target; '${slot}' is missing.`,
                );
            }
        }

        const controlsTarget = SubscriptionBuilder.#requireElement(
            slots.controls,
            'controls',
            caller,
        );
        const urlTarget = SubscriptionBuilder.#requireElement(
            slots.url,
            'url',
            caller,
        );

        if (controlsTarget === urlTarget) {
            throw new Error(
                `${caller}: the 'controls' and 'url' slots must be different elements. The URL control replaces its target's children, so mounting both into one element would destroy the controls that were just appended.`,
            );
        }

        this.#controls.riteSelect.appendTo(controlsTarget);
        this.#controls.calendarSelect.appendTo(controlsTarget);
        this.#controls.apiOptions
            .filter(ApiOptionsFilter.LOCALE_ONLY)
            .appendTo(controlsTarget);
        this.#controlsMount = controlsTarget;

        this.#url.appendTo(urlTarget);
        this.#urlMount = urlTarget;
    }

    /**
     * Releases every mount and listener this builder used.
     *
     * Idempotent; further use throws.
     *
     * Subject to the same documented, pre-existing gap as the rest of the
     * family: the anonymous listeners `ApiOptions.linkToCalendarSelect()` and
     * `linkToRiteSelect()` attach internally are not exposed anywhere this
     * could reach them, and are not released.
     *
     * @returns {void}
     */
    dispose() {
        if (true === this.#disposed) {
            return;
        }
        this.#url.dispose();
        this.#controls.dispose();
        this.#controlsMount?.replaceChildren();
        this.#urlMount?.replaceChildren();
        this.#controlsMount = null;
        this.#urlMount = null;
        this.#disposed = true;
    }

    /**
     * Resolves the slots argument to an already-attached element, for the
     * cancellation check in `mountInto()` only.
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
     * Resolves the targets, constructs the builder and mounts it.
     *
     * **Rejects** on invalid options — an unparseable locale, an unknown
     * `scheme`, an unknown or missing slot, a target matching nothing — and on
     * metadata that cannot be loaded at all. The second matches
     * `CalendarControls`, `CalendarViewer` and `ApiExplorer`: this bundles a
     * whole form, and a rite select and calendar select with no calendars to
     * list are not a smaller working form but no form at all. It does NOT grow a
     * failure control like `CalendarResourcePicker`'s, which substitutes for a
     * single required field.
     *
     * There is no `settled`, no `onError` and no `initialFetch`: this component
     * never fetches a calendar, exactly as `ApiExplorer` never does.
     *
     * @param {{controls: (string|HTMLElement), url: (string|HTMLElement)}} slots - Where to mount.
     * @param {Object} [options] - As the constructor, plus `signal`.
     * @param {AbortSignal} [options.signal] - Cancels the mount.
     * @returns {Promise<SubscriptionBuilder|null>} The mounted builder, or
     *   `null` when the mount was cancelled.
     */
    static async mountInto(slots, options = {}) {
        const bag = normalizeComponentOptions(options, 'SubscriptionBuilder');
        const { signal } = bag;

        const builder = new SubscriptionBuilder(bag);

        try {
            assertPlainOptions(slots, 'SubscriptionBuilder.mountInto');
        } catch {
            throw new Error(
                `SubscriptionBuilder.mountInto: slots must be an object naming { controls, url } targets, but found type: ${describeType(slots)}`,
            );
        }

        const element = SubscriptionBuilder.#targetElement(slots);
        if (
            true === signal?.aborted ||
            (null !== element && false === element.isConnected)
        ) {
            return null;
        }

        builder.appendTo(slots, 'SubscriptionBuilder.mountInto');

        return builder;
    }
}
