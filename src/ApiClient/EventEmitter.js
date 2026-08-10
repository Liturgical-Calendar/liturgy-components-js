export default class EventEmitter {
    /** @type {Object<string, Array<function>>} */
    #events;

    /**
     * Creates a new instance of EventEmitter.
     *
     * The constructor initializes a new, empty object to store event listeners.
     */
    constructor() {
        this.#events = {};
    }

    /**
     * Adds a listener for the specified event.
     *
     * @param {string} event - The event to listen for.
     * @param {function} listener - The listener to invoke when the event occurs.
     */
    on(event, listener) {
        if (!this.#events[event]) {
            this.#events[event] = [];
        }
        this.#events[event].push(listener);
    }

    /**
     * Emits a specified event, invoking all registered listeners with the provided data.
     *
     * @param {string} event - The name of the event to emit.
     * @param {*} data - The data to pass to each event listener.
     * @param {*} [meta] - Optional second argument describing the emission itself
     *   rather than its payload, such as the parameters the request was made
     *   with. Listeners that declare only `data` are unaffected.
     * @returns {void}
     */
    emit(event, data, meta) {
        if (this.#events[event]) {
            this.#events[event].forEach((listener) => listener(data, meta));
        }
    }

    /**
     * The live map of event names to their registered listeners — the emitter's own
     * object, NOT a copy.
     *
     * Liveness is relied upon: `ApiClient#emitCalendarFetchFailed` reads this
     * immediately before every `calendarFetchFailed` emit, to record whether the
     * error is about to reach at least one listener — the answer that
     * `ApiClient#discardRequest` later uses to decide whether to log it. Reading a
     * stale snapshot here would misreport a listener subscribed since the emitter
     * was constructed. `ApiClient#discardRequest` itself no longer reads this getter:
     * it now checks whether the specific error it caught was recorded as delivered,
     * not whether a listener merely exists at catch time — the two diverge for a
     * throwing `calendarFetched` listener and for an argument/state error, neither of
     * which ever reaches an emit. Returning a copy here would also allocate one map
     * and one array per emit to answer a question settled by a length check.
     *
     * Read-only by convention: mutating the returned object mutates the emitter's
     * registrations. Subscribe through `on()`.
     *
     * @type {Object<string, Array<function>>}
     * @returns {Object<string, Array<function>>} The emitter's own map of registered events to their listeners.
     */
    get _events() {
        return this.#events;
    }
}
