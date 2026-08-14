/**
 * A visually-hidden ARIA live region, and nothing else.
 *
 * The markup and the hiding technique are `SubscriptionUrl`'s, which introduced
 * both in 2.7.0; this class is where they now live, so that there is one
 * implementation rather than one per component. `role="status"` and
 * `aria-atomic="true"` are additions: the role names the region for assistive
 * technology that keys off roles rather than off `aria-live`, and atomic makes a
 * short summary be read whole instead of only its changed part.
 *
 * It holds NO policy about *when* to announce. "The first render" is a concept
 * only a renderer has, and `SubscriptionUrl` — which must announce on its first
 * use and self-clear on a timer — would have to opt out of any such policy. The
 * callers own the when; this owns the what.
 *
 * Internal. Deliberately not exported from `src/index.js`, on the same reasoning
 * as `LocaleValidation.js` and `WrapperOptions.js`.
 */
export default class LiveAnnouncer {
    /** @type {HTMLSpanElement} */
    #element;

    constructor() {
        this.#element = document.createElement('span');
        this.#element.setAttribute('role', 'status');
        this.#element.setAttribute('aria-live', 'polite');
        this.#element.setAttribute('aria-atomic', 'true');
        this.#element.style.position = 'absolute';
        this.#element.style.width = '1px';
        this.#element.style.height = '1px';
        this.#element.style.overflow = 'hidden';
        this.#element.style.whiteSpace = 'nowrap';
        // Two corrections to the 2.7.0 original, not a different technique.
        // `SubscriptionUrl` wrote `rect(0 0 0 0)`: the space-separated form is
        // not CSS2 `rect()` syntax, so a strict parser discards the declaration
        // and the element is left 1x1 with `overflow: hidden` rather than
        // clipped — measured, in jsdom, which reads the property back empty.
        // And `clip` is deprecated, so `clip-path` carries the modern engines
        // while `clip` stays for the older ones.
        this.#element.style.clip = 'rect(0, 0, 0, 0)';
        this.#element.style.clipPath = 'inset(50%)';
    }

    /**
     * The region element, for a caller that has to mount it itself.
     *
     * @type {HTMLSpanElement}
     */
    get element() {
        return this.#element;
    }

    /**
     * Mounts the region as the last child of `parent`, at most once.
     *
     * The idempotence is the point, not an optimization: a live region that is
     * removed and re-inserted is not reliably announced, because assistive
     * technology needs it present BEFORE its content changes. Callers that swap
     * sibling content on every render must therefore leave this node alone.
     *
     * @param {HTMLElement} parent - The element to mount into.
     * @returns {void}
     */
    mountInto(parent) {
        if (this.#element.parentNode !== parent) {
            parent.appendChild(this.#element);
        }
    }

    /**
     * Writes the text to be announced.
     *
     * @param {string} text - The announcement.
     * @returns {void}
     */
    announce(text) {
        this.#element.textContent = text;
    }

    /**
     * Empties the region without unmounting it.
     *
     * @returns {void}
     */
    clear() {
        this.#element.textContent = '';
    }

    /**
     * Empties the region and detaches it.
     *
     * @returns {void}
     */
    dispose() {
        this.clear();
        this.#element.remove();
    }
}
