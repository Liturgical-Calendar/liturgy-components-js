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
     * Liveness is relied upon: `ApiClient#discardRequest` reads this on every failed
     * request to decide whether anything is subscribed to `calendarFetchFailed`, and
     * must see subscriptions made since it last looked — a page that subscribes after
     * its first fetch would otherwise keep logging to the console forever. Returning a
     * copy would also allocate one map and one array per failure to answer a question
     * settled by a length check.
     *
     * Read-only by convention: mutating the returned object mutates the emitter's
     * registrations. Subscribe through `on()`.
     *
     * @type {Object<string, Array<function>>}
     * @returns {Object<string, Array<function>>} The emitter's own map of registered events to their listeners.
     * @readonly
     */
    get _events() {
        return this.#events;
    }
}
