/** @jest-environment jsdom */
/**
 * `SubscriptionBuilder` is meta-components phase 3, and the answer to issue #42.
 *
 * It composes a `CalendarControls` and NEVER calls `listenTo()`, so it never
 * fetches — `ApiExplorer`'s template. Issue #42's three picker requirements (an
 * all-calendars scope, a selectable empty option meaning the rite-level
 * calendar, and a rite select offered alongside) are satisfied by
 * `CalendarControls` as it already stands: its `CalendarSelect` is built with
 * `allowNull: true` and no filter.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import SubscriptionBuilder from '../SubscriptionBuilder/SubscriptionBuilder.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.innerHTML = '<div id="controls"></div><div id="url"></div>';
    global.fetch = jest.fn(() =>
        Promise.reject(new Error('no request should ever be issued')),
    );
});

describe('SubscriptionBuilder construction', () => {
    it('builds the three controls and the URL', () => {
        const sub = new SubscriptionBuilder({ locale: 'en' });
        expect(sub.riteSelect).not.toBeNull();
        expect(sub.calendarSelect).not.toBeNull();
        expect(sub.localeInput).not.toBeNull();
        expect(sub.url).toContain('/calendar/roman');
    });

    it('offers an unfiltered calendar list with a selectable empty option', () => {
        // Issue #42's first two requirements, inherited from CalendarControls.
        const sub = new SubscriptionBuilder({ locale: 'en' });
        const options = [...sub.calendarSelect._domElement.options];
        expect(options[0].value).toBe('');
        expect(options[0].disabled).toBe(false);
        expect(options.some((o) => o.dataset.calendartype === 'national')).toBe(
            true,
        );
        expect(options.some((o) => o.dataset.calendartype === 'diocesan')).toBe(
            true,
        );
    });
});

describe('SubscriptionBuilder.appendTo', () => {
    it('mounts all three controls and the URL', () => {
        const sub = new SubscriptionBuilder({ locale: 'en' });
        sub.appendTo({ controls: '#controls', url: '#url' });
        expect(document.querySelectorAll('#controls select').length).toBe(3);
        expect(document.querySelector('#url button')).not.toBeNull();
    });

    it('rejects a bare target', () => {
        const sub = new SubscriptionBuilder({ locale: 'en' });
        expect(() => sub.appendTo('#controls')).toThrow(
            /must be an object naming \{ controls, url \}/,
        );
    });

    it('rejects an unknown slot, naming it', () => {
        const sub = new SubscriptionBuilder({ locale: 'en' });
        expect(() =>
            sub.appendTo({ controls: '#controls', url: '#url', nope: '#x' }),
        ).toThrow(/unknown slot name\(s\): nope/);
    });

    it('rejects a missing slot, naming it', () => {
        const sub = new SubscriptionBuilder({ locale: 'en' });
        expect(() => sub.appendTo({ controls: '#controls' })).toThrow(
            /'url' is missing/,
        );
    });

    it('rejects a slot matching nothing', () => {
        const sub = new SubscriptionBuilder({ locale: 'en' });
        expect(() => sub.appendTo({ controls: '#nope', url: '#url' })).toThrow(
            /Element not found for the controls slot/,
        );
    });
});
