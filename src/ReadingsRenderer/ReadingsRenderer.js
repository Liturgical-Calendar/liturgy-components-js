/**
 * ReadingsRenderer - Shared module for rendering liturgical readings.
 *
 * This module provides functionality for rendering lectionary readings
 * in both LiturgyOfTheDay and LiturgyOfAnyDay components.
 *
 * @module ReadingsRenderer
 */

/**
 * @typedef {Object} ReadingsRendererOptions
 * @property {string} [readingsWrapperClassName=''] - CSS class for the readings wrapper element.
 * @property {string} [readingsLabelClassName=''] - CSS class for reading labels.
 * @property {string} [readingClassName=''] - CSS class for individual reading elements.
 */

export default class ReadingsRenderer {
    /**
     * Mapping of reading property keys to human-readable labels.
     * @type {Object<string, string>}
     * @static
     * @readonly
     */
    static readingLabels = Object.freeze({
        first_reading: 'First Reading',
        responsorial_psalm: 'Responsorial Psalm',
        second_reading: 'Second Reading',
        gospel_acclamation: 'Gospel Acclamation',
        gospel: 'Gospel',
        palm_gospel: 'Gospel at the Procession',
        epistle: 'Epistle',
        responsorial_psalm_2: 'Responsorial Psalm',
        third_reading: 'Third Reading',
        responsorial_psalm_3: 'Responsorial Psalm',
        fourth_reading: 'Fourth Reading',
        responsorial_psalm_4: 'Responsorial Psalm',
        fifth_reading: 'Fifth Reading',
        responsorial_psalm_5: 'Responsorial Psalm',
        sixth_reading: 'Sixth Reading',
        responsorial_psalm_6: 'Responsorial Psalm',
        seventh_reading: 'Seventh Reading',
        responsorial_psalm_7: 'Responsorial Psalm',
        responsorial_psalm_epistle: 'Responsorial Psalm',
    });

    /**
     * Mapping of mass schema keys to human-readable labels.
     * @type {Object<string, string>}
     * @static
     * @readonly
     */
    static massLabels = Object.freeze({
        vigil: 'Vigil Mass',
        night: 'Mass during the Night',
        dawn: 'Mass at Dawn',
        day: 'Mass during the Day',
        evening: 'Evening Mass',
        schema_one: 'Schema I',
        schema_two: 'Schema II',
        schema_three: 'Schema III',
        easter_season: 'Easter Season',
        outside_easter_season: 'Outside Easter Season',
    });

    /**
     * Standard order for displaying liturgical readings.
     * @type {string[]}
     * @static
     * @readonly
     */
    static readingOrder = Object.freeze([
        'palm_gospel',
        'first_reading',
        'responsorial_psalm',
        'second_reading',
        'responsorial_psalm_2',
        'third_reading',
        'responsorial_psalm_3',
        'fourth_reading',
        'responsorial_psalm_4',
        'fifth_reading',
        'responsorial_psalm_5',
        'sixth_reading',
        'responsorial_psalm_6',
        'seventh_reading',
        'responsorial_psalm_7',
        'epistle',
        'responsorial_psalm_epistle',
        'gospel_acclamation',
        'gospel',
    ]);

    /**
     * Keys that indicate nested mass schemas in readings objects, in the order
     * they are rendered.
     *
     * DERIVED from {@link ReadingsRenderer.massLabels} rather than restated, so
     * the keys the renderer recognises and the labels it prints for them cannot
     * drift apart — and so a consumer reading the public `massLabels` is reading
     * the whole schema vocabulary, order included, rather than half of it.
     *
     * `Object.keys()` on a frozen object returns a fresh array, hence the
     * freeze. `massLabels` is declared above this field because static field
     * initializers run in source order.
     *
     * @type {string[]}
     * @static
     * @readonly
     */
    static #nestedSchemaKeys = Object.freeze(
        Object.keys(ReadingsRenderer.massLabels),
    );

    /** @type {string} */
    #readingsWrapperClassName = '';

    /** @type {string} */
    #readingsLabelClassName = '';

    /** @type {string} */
    #readingClassName = '';

    /**
     * Creates a new ReadingsRenderer instance.
     *
     * @param {ReadingsRendererOptions} [options={}] - Configuration options.
     */
    constructor(options = {}) {
        if (
            options.readingsWrapperClassName &&
            typeof options.readingsWrapperClassName === 'string'
        ) {
            this.#readingsWrapperClassName = options.readingsWrapperClassName;
        }
        if (
            options.readingsLabelClassName &&
            typeof options.readingsLabelClassName === 'string'
        ) {
            this.#readingsLabelClassName = options.readingsLabelClassName;
        }
        if (
            options.readingClassName &&
            typeof options.readingClassName === 'string'
        ) {
            this.#readingClassName = options.readingClassName;
        }
    }

    /**
     * Updates the CSS class for the readings wrapper element.
     *
     * @param {string} className - The CSS class name.
     * @returns {ReadingsRenderer} This instance for chaining.
     * @throws {TypeError} If className is not a string.
     */
    setReadingsWrapperClassName(className) {
        if (typeof className !== 'string') {
            throw new TypeError(
                'ReadingsRenderer.setReadingsWrapperClassName: className must be a string',
            );
        }
        this.#readingsWrapperClassName = className;
        return this;
    }

    /**
     * Updates the CSS class for reading labels.
     *
     * @param {string} className - The CSS class name.
     * @returns {ReadingsRenderer} This instance for chaining.
     * @throws {TypeError} If className is not a string.
     */
    setReadingsLabelClassName(className) {
        if (typeof className !== 'string') {
            throw new TypeError(
                'ReadingsRenderer.setReadingsLabelClassName: className must be a string',
            );
        }
        this.#readingsLabelClassName = className;
        return this;
    }

    /**
     * Updates the CSS class for individual reading elements.
     *
     * @param {string} className - The CSS class name.
     * @returns {ReadingsRenderer} This instance for chaining.
     * @throws {TypeError} If className is not a string.
     */
    setReadingClassName(className) {
        if (typeof className !== 'string') {
            throw new TypeError(
                'ReadingsRenderer.setReadingClassName: className must be a string',
            );
        }
        this.#readingClassName = className;
        return this;
    }

    /**
     * Checks if the readings object has nested mass schemas (vigil/day, night/dawn, etc.)
     *
     * Readings are not a flat map: some celebrations carry several sets, keyed
     * by the schema names {@link ReadingsRenderer.massLabels} names. A consumer
     * that renders without telling the two shapes apart prints `[object Object]`
     * wherever a nested entry appears, which is what issue #97 was filed about.
     *
     * STATIC because this predicate, `massLabels` and `readingOrder` are the
     * parts a consumer needs in order to render readings correctly at all,
     * independently of whether it wants this renderer's markup — and reaching a
     * predicate should not require constructing a renderer whose layout the
     * caller has already decided against.
     *
     * @param {Object} readings - The readings object to check.
     * @returns {boolean} True if the readings have nested schemas, false otherwise.
     * @static
     */
    static hasNestedSchemas(readings) {
        if (!readings || typeof readings !== 'object') return false;
        const keys = Object.keys(readings);
        return keys.some((key) =>
            ReadingsRenderer.#nestedSchemaKeys.includes(key),
        );
    }

    /**
     * Checks if the readings object has nested mass schemas (vigil/day, night/dawn, etc.)
     *
     * Delegates to {@link ReadingsRenderer.hasNestedSchemas}, which is the
     * implementation. Kept because it is the spelling `LiturgyOfTheDay` and
     * `LiturgyOfAnyDay` were written against, and the only one that existed
     * before the class was exported (#97); the two cannot disagree.
     *
     * @param {Object} readings - The readings object to check.
     * @returns {boolean} True if the readings have nested schemas, false otherwise.
     */
    hasNestedSchemas(readings) {
        return ReadingsRenderer.hasNestedSchemas(readings);
    }

    /**
     * Renders a single set of readings (ferial or festive format).
     *
     * @param {Object} readings - The readings object.
     * @param {HTMLElement} container - The container to append readings to.
     * @param {string} [schemaLabel] - Optional label for the schema (e.g., "Vigil Mass").
     */
    renderSingleReadings(readings, container, schemaLabel = null) {
        if (!(container instanceof HTMLElement)) {
            throw new Error(
                'ReadingsRenderer.renderSingleReadings: container must be an HTMLElement',
            );
        }

        if (schemaLabel) {
            const schemaLabelEl = document.createElement('div');
            if (this.#readingsLabelClassName !== '') {
                schemaLabelEl.classList.add(
                    ...this.#readingsLabelClassName.split(' '),
                );
            }
            schemaLabelEl.textContent = schemaLabel;
            container.appendChild(schemaLabelEl);
        }

        for (const key of ReadingsRenderer.readingOrder) {
            if (
                Object.prototype.hasOwnProperty.call(readings, key) &&
                readings[key]
            ) {
                const readingEl = document.createElement('div');
                if (this.#readingClassName !== '') {
                    readingEl.classList.add(
                        ...this.#readingClassName.split(' '),
                    );
                }

                const labelEl = document.createElement('span');
                if (this.#readingsLabelClassName !== '') {
                    labelEl.classList.add(
                        ...this.#readingsLabelClassName.split(' '),
                    );
                }
                labelEl.textContent =
                    ReadingsRenderer.readingLabels[key] + ': ';

                const valueEl = document.createElement('span');
                valueEl.textContent = readings[key];

                readingEl.appendChild(labelEl);
                readingEl.appendChild(valueEl);
                container.appendChild(readingEl);
            }
        }
    }

    /**
     * Renders the lectionary readings for a celebration.
     *
     * @param {Object} readings - The readings object from the API.
     * @param {HTMLElement} container - The container to append readings to.
     */
    renderReadings(readings, container) {
        if (!readings || typeof readings !== 'object') return;

        if (!(container instanceof HTMLElement)) {
            throw new Error(
                'ReadingsRenderer.renderReadings: container must be an HTMLElement',
            );
        }

        const readingsWrapper = document.createElement('div');
        if (this.#readingsWrapperClassName !== '') {
            readingsWrapper.classList.add(
                ...this.#readingsWrapperClassName.split(' '),
            );
        }

        if (this.hasNestedSchemas(readings)) {
            // Handle nested schemas (Christmas, Easter Vigil with day, etc.)
            // Iterate in predefined liturgical sequence rather than insertion order
            for (const schemaKey of ReadingsRenderer.#nestedSchemaKeys) {
                if (Object.prototype.hasOwnProperty.call(readings, schemaKey)) {
                    const schemaLabel =
                        ReadingsRenderer.massLabels[schemaKey] || schemaKey;
                    this.renderSingleReadings(
                        readings[schemaKey],
                        readingsWrapper,
                        schemaLabel,
                    );
                }
            }
        } else {
            // Simple readings (ferial or festive)
            this.renderSingleReadings(readings, readingsWrapper);
        }

        container.appendChild(readingsWrapper);
    }
}
