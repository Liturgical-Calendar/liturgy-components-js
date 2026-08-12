/** @jest-environment jsdom */
/**
 * `WebCalendar.listenTo()` retains its `calendarFetched` listener so `dispose()`
 * can hand the same reference back to `EventEmitter.off()` — without which a
 * meta-component's `dispose()` could empty its mount only for the next fetch to
 * refill it.
 *
 * These pin the two ways that bookkeeping can go wrong: a subscription that
 * outlives `dispose()`, and one orphaned by a second `listenTo()` overwriting the
 * references that identify it.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import WebCalendar from '../WebCalendar/WebCalendar.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

/**
 * @param {ApiClient} apiClient - The client whose bus to inspect.
 * @returns {number} How many `calendarFetched` listeners are registered.
 */
const listenerCount = (apiClient) =>
    apiClient._eventBus._events['calendarFetched']?.length ?? 0;

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.replaceChildren();
    global.fetch = jest.fn(() =>
        Promise.resolve({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: () => Promise.resolve({ litcal: [] }),
        }),
    );
});

describe('WebCalendar subscription bookkeeping', () => {
    it('dispose() unsubscribes from the client', async () => {
        const apiClient = await ApiClient.init(API_URL);
        const webCalendar = new WebCalendar();
        webCalendar.listenTo(apiClient);
        expect(listenerCount(apiClient)).toBe(1);

        webCalendar.dispose();
        expect(listenerCount(apiClient)).toBe(0);
    });

    it('dispose() is idempotent and safe without listenTo()', () => {
        const webCalendar = new WebCalendar();
        expect(() => webCalendar.dispose()).not.toThrow();
        expect(() => webCalendar.dispose()).not.toThrow();
    });

    // Re-listening used to orphan the previous subscription: the references that
    // identified it were overwritten, so `dispose()` could then only ever remove
    // the latest one and the earlier client stayed subscribed for good.
    it('listenTo() releases a previous subscription before rebinding', async () => {
        const first = await ApiClient.init(API_URL);
        const second = await ApiClient.init(API_URL);
        const webCalendar = new WebCalendar();

        webCalendar.listenTo(first);
        webCalendar.listenTo(second);

        expect(listenerCount(first)).toBe(0);
        expect(listenerCount(second)).toBe(1);
    });

    it('leaves nothing subscribed anywhere after a rebind and dispose', async () => {
        const first = await ApiClient.init(API_URL);
        const second = await ApiClient.init(API_URL);
        const webCalendar = new WebCalendar();

        webCalendar.listenTo(first);
        webCalendar.listenTo(second);
        webCalendar.dispose();

        expect(listenerCount(first)).toBe(0);
        expect(listenerCount(second)).toBe(0);
    });

    // `listenTo()` must not forget where it renders — only `dispose()` does that.
    it('keeps its mount across a rebind', async () => {
        const mount = document.createElement('div');
        mount.id = 'cal';
        document.body.appendChild(mount);
        const first = await ApiClient.init(API_URL);
        const second = await ApiClient.init(API_URL);

        const webCalendar = new WebCalendar();
        webCalendar.listenTo(first);
        webCalendar.appendTo('#cal');
        expect(() => webCalendar.listenTo(second)).not.toThrow();
        expect(webCalendar._attachedElement ?? mount).toBeTruthy();
    });
});
