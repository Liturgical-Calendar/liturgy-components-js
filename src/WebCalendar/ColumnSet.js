import { Column } from '../Enums.js';

/**
 * Manages a set of column flags for the WebCalendar.
 */
export default class ColumnSet {
    /**
     * A bitfield of Column flags.
     * @type {number}
     */
    #columnFlags;

    /**
     * Constructor for ColumnSet class.
     * @param {number|Column} columnFlag The initial column flags to set
     */
    constructor(columnFlag = Column.NONE) {
        this.set(columnFlag);
    }

    /**
     * Adds a column flag to the columnFlags property.
     * @param {Column} columnFlag The column flag to add
     */
    add(columnFlag) {
        this.#columnFlags |= columnFlag;
    }

    /**
     * Removes a column flag from the columnFlags property.
     * @param {Column} columnFlag The column flag to remove
     */
    remove(columnFlag) {
        this.#columnFlags &= ~columnFlag;
    }

    /**
     * Toggles a column flag.
     * @param {Column} columnFlag The column flag to toggle
     */
    toggle(columnFlag) {
        this.#columnFlags ^= columnFlag;
    }

    /**
     * Resets the columnFlags property to Column.NONE
     */
    clear() {
        this.#columnFlags = Column.NONE;
    }

    /**
     * Sets all column flags by setting columnFlags to Column.ALL
     */
    setAll() {
        this.#columnFlags = Column.ALL;
    }

    /**
     * Sets the columnFlags property to the given value.
     * @param {number|Column} columnFlag The column flag to set
     * @throws {Error} If the column flag is invalid
     */
    set(columnFlag) {
        const flag = typeof columnFlag === 'number' ? columnFlag : columnFlag;
        if ((flag & Column.ALL) === 0 && flag !== Column.NONE) {
            throw new Error('Invalid column flag');
        }
        this.#columnFlags = flag;
    }

    /**
     * Checks if a given column flag is set in the columnFlags property.
     * @param {Column} columnFlag The column flag to check
     * @returns {boolean} True if the given column flag is set
     */
    has(columnFlag) {
        return (columnFlag & this.#columnFlags) === columnFlag;
    }

    /**
     * Returns the value of the columnFlags property.
     * @returns {number} The value of the columnFlags property
     */
    get() {
        return this.#columnFlags;
    }
}
