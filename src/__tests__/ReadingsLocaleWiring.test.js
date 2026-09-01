/** @jest-environment jsdom */
import { describe, it, expect } from '@jest/globals';
import LiturgyOfTheDay from '../LiturgyOfTheDay/LiturgyOfTheDay.js';
import LiturgyOfAnyDay from '../LiturgyOfAnyDay/LiturgyOfAnyDay.js';

/**
 * Both widgets validate a locale into `#locale` and then build a
 * `ReadingsRenderer`. The wiring is asserted through the DOM the renderer
 * produces: rendering a known readings object and reading the label back,
 * rather than inspecting the renderer's own private locale.
 *
 * `_readingsRenderer` is a package-internal getter (underscored, not exported
 * in any documentation — see CLAUDE.md on what the prefix means) added on both
 * widgets for exactly this: reaching the renderer instance to render through it
 * directly, without duplicating either widget's own render call.
 */
const renderReadingsVia = (widget, readings) => {
    const container = document.createElement('div');
    widget._readingsRenderer.renderReadings(readings, container);
    return container.textContent;
};

describe('the widgets forward their locale to ReadingsRenderer', () => {
    const READINGS = { first_reading: 'Numeri 6:22-27' };

    it('LiturgyOfTheDay renders readings labels in its own locale', () => {
        const widget = new LiturgyOfTheDay({ locale: 'it' });
        expect(renderReadingsVia(widget, READINGS)).toContain('Prima lettura');
    });

    it('LiturgyOfAnyDay renders readings labels in its own locale', () => {
        const widget = new LiturgyOfAnyDay({ locale: 'it' });
        expect(renderReadingsVia(widget, READINGS)).toContain('Prima lettura');
    });

    it('both default to English', () => {
        expect(renderReadingsVia(new LiturgyOfTheDay(), READINGS)).toContain(
            'First Reading',
        );
        expect(renderReadingsVia(new LiturgyOfAnyDay(), READINGS)).toContain(
            'First Reading',
        );
    });

    it('constructing with both a locale and a readings class option does not throw (constructor-ordering hazard)', () => {
        expect(
            () =>
                new LiturgyOfTheDay({
                    locale: 'it',
                    readingsWrapperClass: 'readings',
                }),
        ).not.toThrow();
        expect(
            () =>
                new LiturgyOfAnyDay({
                    locale: 'it',
                    readingsWrapperClass: 'readings',
                }),
        ).not.toThrow();
    });
});
