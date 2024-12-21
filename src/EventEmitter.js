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
     */
    emit(event, data) {
        if (this.#events[event]) {
            this.#events[event].forEach((listener) => listener(data));
        }
    }
}
