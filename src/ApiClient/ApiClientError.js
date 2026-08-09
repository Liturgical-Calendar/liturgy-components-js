/**
 * An error raised by the ApiClient when a request to the Liturgical Calendar API fails.
 *
 * Carries the request context as plain public properties rather than private fields
 * with getters: errors are routinely logged, serialized and inspected in a console,
 * and plain properties survive all three.
 *
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */
export default class ApiClientError extends Error {
    /**
     * @param {string} message - A human readable description of the failure.
     * @param {object} [context] - The request context.
     * @param {string|null} [context.url] - The URL that was requested.
     * @param {number|null} [context.status] - The HTTP status, or null if the request never completed.
     * @param {string|null} [context.statusText] - The HTTP status text, or null if the request never completed.
     * @param {string|null} [context.body] - The response body as text, when it could be read.
     * @param {Error|null} [context.cause] - The underlying error, when the request never completed.
     */
    constructor(
        message,
        {
            url = null,
            status = null,
            statusText = null,
            body = null,
            cause = null,
        } = {},
    ) {
        super(message, cause === null ? undefined : { cause });
        this.name = 'ApiClientError';
        this.url = url;
        this.status = status;
        this.statusText = statusText;
        this.body = body;
        // `super()` already sets `cause` where the runtime honours ES2022 `error-cause` (and silently
        // drops it, with no exception, on ES-module-capable runtimes that predate it, e.g. Chrome 61-92,
        // Safari 11-14) — but even when it is set, the spec defines it as non-enumerable, and a plain
        // `this.cause = cause` here would only update that existing property's value, not its
        // enumerability ([[Set]] cannot do that). `Object.defineProperty` forces `cause` to be
        // enumerable in both the "supplied" and "omitted" cases, so it behaves like its four siblings
        // above: visible to `Object.keys`, `JSON.stringify` and log serializers, whether it holds an
        // error or `null`.
        Object.defineProperty(this, 'cause', {
            value: cause,
            writable: true,
            enumerable: true,
            configurable: true,
        });
    }
}
