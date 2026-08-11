import { describe, it, expect } from '@jest/globals';
import EventEmitter from '../ApiClient/EventEmitter.js';

describe('EventEmitter.off', () => {
    it('stops a removed listener from being called', () => {
        const emitter = new EventEmitter();
        const calls = [];
        const listener = (data) => calls.push(data);

        emitter.on('ping', listener);
        emitter.emit('ping', 'first');
        emitter.off('ping', listener);
        emitter.emit('ping', 'second');

        expect(calls).toEqual(['first']);
    });

    it('leaves other listeners for the same event registered', () => {
        const emitter = new EventEmitter();
        const kept = [];
        const removed = () => {
            throw new Error('should not be called');
        };
        const keeper = (data) => kept.push(data);

        emitter.on('ping', removed);
        emitter.on('ping', keeper);
        emitter.off('ping', removed);
        emitter.emit('ping', 'payload');

        expect(kept).toEqual(['payload']);
    });

    it('removes only one registration when the same listener was added twice', () => {
        const emitter = new EventEmitter();
        let count = 0;
        const listener = () => {
            count += 1;
        };

        emitter.on('ping', listener);
        emitter.on('ping', listener);
        emitter.off('ping', listener);
        emitter.emit('ping', null);

        expect(count).toBe(1);
    });

    it('is a no-op for an unknown event or an unregistered listener', () => {
        const emitter = new EventEmitter();
        expect(() => emitter.off('nope', () => {})).not.toThrow();
        emitter.on('ping', () => {});
        expect(() => emitter.off('ping', () => {})).not.toThrow();
    });

    // `emit()` iterates the listener array. Removing during iteration must not
    // cause `forEach` to skip the next listener, which is what an in-place
    // `splice` would do.
    it('does not skip a listener when one unsubscribes during emit', () => {
        const emitter = new EventEmitter();
        const seen = [];
        const first = () => {
            seen.push('first');
            emitter.off('ping', first);
        };
        const second = () => seen.push('second');

        emitter.on('ping', first);
        emitter.on('ping', second);
        emitter.emit('ping', null);

        expect(seen).toEqual(['first', 'second']);
    });

    // ApiClient:433 reads `_events['calendarFetchFailed']?.length > 0` to decide
    // whether a failure reaches a handler. An emptied array must read as zero.
    it('leaves an empty array that reads as no listeners', () => {
        const emitter = new EventEmitter();
        const listener = () => {};
        emitter.on('calendarFetchFailed', listener);
        emitter.off('calendarFetchFailed', listener);

        expect(emitter._events['calendarFetchFailed']?.length > 0).toBe(false);
    });
});
