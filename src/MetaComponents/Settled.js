/**
 * The two halves of `settled`'s contract, in one place.
 *
 * `CalendarControls`, `CalendarViewer` and `DayViewer` each expose a `settled`
 * promise observing their initial fetch, and each publishes the same guarantee:
 * it **always resolves, never rejects**, with `undefined`. Both functions here
 * exist to make that guarantee structural rather than conventional, and both used
 * to be triplicated — one rule with three places to drift from.
 *
 * Deliberately NOT exported from `src/index.js`, on the same reasoning as
 * `Theme.js`, `InputVisibility.js` and `LocaleValidation.js`: internal contract
 * between the components, not public API.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

/**
 * Normalizes whatever a component stored into the promise `settled` publishes.
 *
 * **Derived on every read rather than stored.** What the component holds may be
 * the very promise its `fetch()` handed the caller, and attaching a handler to it
 * eagerly would mark that promise object handled — rejection tracking is per
 * promise object — silently removing the platform's unhandled-rejection report
 * for a caller who ignores the `fetch()` result. That report is the premise on
 * which `fetch()` declines to log at all.
 *
 * The two-callback `then()` is what makes every clause structural: it resolves
 * whatever happened, resolves with `undefined` rather than the payload a
 * `.catch()` alone would pass through, and cannot reject. The result is a fresh
 * promise object per read, but it always settles at the same instant.
 *
 * @param {Promise<unknown>} stored - The promise the component is holding.
 * @returns {Promise<void>} A promise that resolves with `undefined`, always.
 */
export function normalizeSettled(stored) {
    return stored.then(
        () => {},
        () => {},
    );
}

/**
 * Reports a failed initial fetch without ever throwing.
 *
 * The factories build their stored `settled` branch out of this, so it must not
 * throw: the delivery it performs calls **consumer** callbacks, and a callback
 * that throws would otherwise propagate into the branch and reject it. Two things
 * followed from that, both real (CodeRabbit, PR #76):
 *
 * - `CalendarViewer.mountInto()` **awaits** its stored branch, so a throwing
 *   `onError()` callback made the whole factory reject and the caller received no
 *   viewer at all — a subscriber's own bug turned into a failed mount.
 * - On the paths that do not await, the stored branch rejected with nothing
 *   attached to it, producing exactly the unhandled-rejection report that
 *   `settled`'s "never rejects" clause exists to rule out. `normalizeSettled()`
 *   cannot help there: it only attaches a handler when somebody actually *reads*
 *   `settled`.
 *
 * A callback that throws is still **reported**, never swallowed — the failure is
 * the consumer's own and they should see it — but it is reported to the console
 * rather than through a promise nobody is in a position to catch.
 *
 * @param {string} componentName - The reporting component's class name.
 * @param {Error} error - The fetch failure to deliver.
 * @param {function(Error): boolean} deliver - The component's own delivery, which
 *        returns `false` when nothing was subscribed to receive the error.
 * @returns {void}
 */
export function deliverFetchFailure(componentName, error, deliver) {
    try {
        if (false === deliver(error)) {
            console.error(
                `${componentName}: could not load the calendar: ${error.message}`,
            );
        }
    } catch (callbackError) {
        console.error(
            `${componentName}: an onError callback threw while handling a failed initial fetch.`,
            callbackError,
        );
    }
}
