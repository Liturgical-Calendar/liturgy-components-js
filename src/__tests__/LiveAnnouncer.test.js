/** @jest-environment jsdom */
import { describe, it, expect } from '@jest/globals';
import LiveAnnouncer from '../LiveAnnouncer.js';

describe('LiveAnnouncer', () => {
    it('builds a polite, atomic status region', () => {
        const { element } = new LiveAnnouncer();
        expect(element.tagName).toBe('SPAN');
        expect(element.getAttribute('role')).toBe('status');
        expect(element.getAttribute('aria-live')).toBe('polite');
        expect(element.getAttribute('aria-atomic')).toBe('true');
    });

    it('hides the region without hiding it from assistive technology', () => {
        // `display: none` and `visibility: hidden` would take the region out of
        // the accessibility tree along with the layout, so the clip-based recipe
        // is the only one that works here.
        const { element } = new LiveAnnouncer();
        expect(element.style.position).toBe('absolute');
        expect(element.style.width).toBe('1px');
        expect(element.style.height).toBe('1px');
        expect(element.style.overflow).toBe('hidden');
        expect(element.style.whiteSpace).toBe('nowrap');
        expect(element.style.clipPath).toBe('inset(50%)');
    });

    it('writes a clip that a strict CSS parser actually accepts', () => {
        // SubscriptionUrl set `clip: rect(0 0 0 0)`. The space-separated form is
        // not CSS2 `rect()` syntax, so a strict parser — jsdom's, for one —
        // discards the declaration outright and the property reads back empty.
        // The comma form is the specified one and parses everywhere.
        const { element } = new LiveAnnouncer();
        expect(element.style.clip).not.toBe('');
    });

    it('starts empty', () => {
        expect(new LiveAnnouncer().element.textContent).toBe('');
    });

    it('mounts once, and never re-inserts the same node', () => {
        // Re-inserting a live region is what stops it being announced, so this
        // is the property the whole class exists to hold.
        const announcer = new LiveAnnouncer();
        const parent = document.createElement('div');
        announcer.mountInto(parent);
        announcer.mountInto(parent);
        expect(parent.childNodes).toHaveLength(1);
        expect(parent.firstChild).toBe(announcer.element);
    });

    it('moves to a new parent when asked', () => {
        const announcer = new LiveAnnouncer();
        const first = document.createElement('div');
        const second = document.createElement('div');
        announcer.mountInto(first);
        announcer.mountInto(second);
        expect(first.childNodes).toHaveLength(0);
        expect(second.firstChild).toBe(announcer.element);
    });

    it('writes and clears the announcement text', () => {
        const announcer = new LiveAnnouncer();
        announcer.announce('Calendar updated');
        expect(announcer.element.textContent).toBe('Calendar updated');
        announcer.clear();
        expect(announcer.element.textContent).toBe('');
    });

    it('detaches and empties on dispose', () => {
        const announcer = new LiveAnnouncer();
        const parent = document.createElement('div');
        announcer.mountInto(parent);
        announcer.announce('Calendar updated');
        announcer.dispose();
        expect(parent.childNodes).toHaveLength(0);
        expect(announcer.element.textContent).toBe('');
    });
});
