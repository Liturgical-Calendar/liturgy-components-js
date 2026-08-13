/**
 * The renderer half of `SubscriptionBuilder`: it turns the current rite,
 * calendar and locale selections into an iCal subscription URL, renders it, and
 * offers a copy control.
 *
 * Internal, and deliberately NOT exported from `src/index.js` — this component's
 * private renderer, the same relationship `CurrentEndpoint.js` has to
 * `PathBuilder.js`.
 *
 * It borrows `apiOptions._currentEndpoint` rather than constructing one, exactly
 * as `PathBuilder` does, so the URL model is shared between the two renderers
 * and cannot drift. What is NOT shared is the presentation: `PathBuilder`'s
 * button navigates to the API and its `return_type` is user-selectable, both of
 * which are wrong for a subscription.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

import { CalendarType } from '../PathBuilder/CurrentEndpoint.js';

/** The schemes a subscription URL may be rendered under. */
const SCHEMES = Object.freeze(['https', 'webcal']);

export default class SubscriptionUrl {
    /** @type {Object} The ApiBase this renderer's URL is built against. */
    #base;

    /** @type {Object} Borrowed from ApiOptions; never constructed here. */
    #currentEndpoint;

    /** @type {HTMLElement} */
    #domElement;

    /** @type {HTMLElement} */
    #codeElement;

    /** @type {'https'|'webcal'} */
    #scheme;

    /**
     * @param {Object} apiOptions - The ApiOptions owning the CurrentEndpoint.
     * @param {Object} calendarSelect - The calendar select to follow.
     * @param {Object} riteSelect - The rite select to follow.
     * @param {Object} [options] - Renderer options.
     * @param {'https'|'webcal'} [options.scheme='https'] - The URL scheme.
     * @throws {Error} If `scheme` is neither 'https' nor 'webcal'.
     */
    constructor(apiOptions, calendarSelect, riteSelect, options = {}) {
        const scheme = options.scheme ?? 'https';
        if (false === SCHEMES.includes(scheme)) {
            throw new Error(
                `SubscriptionUrl: the scheme option must be 'https' or 'webcal', but found: ${String(scheme)}`,
            );
        }
        this.#scheme = scheme;
        this.#base = apiOptions._base;
        this.#currentEndpoint = apiOptions._currentEndpoint;

        // `return_type` is what makes this a subscription rather than a JSON
        // request, so it is pinned here and never wired to an input — unlike
        // `PathBuilder`, which lets the accept-header input drive it.
        this.#currentEndpoint.requestPayload.return_type = 'ICS';
        this.#currentEndpoint.requestPayload.year_type = 'CIVIL';
        // Without this, `CurrentEndpoint.path` omits the rite whenever it is
        // Roman, and the card this replaces emits `/roman` unconditionally.
        this.#currentEndpoint.explicitRite = true;

        this.#domElement = document.createElement('button');
        this.#domElement.setAttribute('type', 'button');
        this.#codeElement = document.createElement('code');
        this.#domElement.append(this.#codeElement);

        this.#render();
    }

    /** @returns {string} The serialized subscription URL. */
    get url() {
        const full = `${this.#base.url}${this.#currentEndpoint.serialize()}`;
        return 'webcal' === this.#scheme
            ? full.replace(/^https?:/, 'webcal:')
            : full;
    }

    /** @returns {HTMLElement} The rendered control, for tests and mounting. */
    get _domElement() {
        return this.#domElement;
    }

    /**
     * Repaints the rendered URL.
     *
     * @returns {void}
     */
    #render() {
        this.#codeElement.textContent = this.url;
    }

    /**
     * Mounts the control, replacing whatever the target held.
     *
     * @param {HTMLElement} target - The element to mount into.
     * @returns {void}
     */
    appendTo(target) {
        target.replaceChildren(this.#domElement);
    }
}
