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
    constructor( message, { url = null, status = null, statusText = null, body = null, cause = null } = {} ) {
        super( message, cause === null ? undefined : { cause } );
        this.name       = 'ApiClientError';
        this.url        = url;
        this.status     = status;
        this.statusText = statusText;
        this.body       = body;
        // Set explicitly as a plain property, like its siblings above: the native `cause` option
        // passed to `super()` is honoured on modern runtimes, but is silently dropped (no exception,
        // `err.cause` simply `undefined`) on ES2022-`error-cause`-less runtimes that otherwise support
        // ES modules (e.g. Chrome 61-92, Safari 11-14). This property survives on all of them.
        this.cause      = cause;
    }

}
