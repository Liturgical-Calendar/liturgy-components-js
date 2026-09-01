/** @jest-environment jsdom */
import { describe, it, expect } from '@jest/globals';
import LiturgyOfTheDay from '../LiturgyOfTheDay/LiturgyOfTheDay.js';
import LiturgyOfAnyDay from '../LiturgyOfAnyDay/LiturgyOfAnyDay.js';

/**
 * Both widgets validate a locale into `#locale` and then build a
 * `ReadingsRenderer`. The renderer is not reachable from outside, so the wiring
 * is asserted through the DOM it produces: rendering a known readings object
 * and reading the label back.
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
