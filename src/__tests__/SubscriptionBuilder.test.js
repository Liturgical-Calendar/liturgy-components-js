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

describe('SubscriptionBuilder.mountInto', () => {
    it('resolves to a mounted builder', async () => {
        const sub = await SubscriptionBuilder.mountInto(
            { controls: '#controls', url: '#url' },
            { locale: 'en' },
        );
        expect(sub).toBeInstanceOf(SubscriptionBuilder);
        expect(document.querySelector('#url button')).not.toBeNull();
    });

    it('rejects an unparseable locale', async () => {
        await expect(
            SubscriptionBuilder.mountInto(
                { controls: '#controls', url: '#url' },
                { locale: 'not a locale' },
            ),
        ).rejects.toThrow(/SubscriptionBuilder/);
    });

    it('rejects an unknown scheme', async () => {
        await expect(
            SubscriptionBuilder.mountInto(
                { controls: '#controls', url: '#url' },
                { locale: 'en', scheme: 'ftp' },
            ),
        ).rejects.toThrow(/'https' or 'webcal'/);
    });

    it('resolves to null when the signal is already aborted', async () => {
        const controller = new AbortController();
        controller.abort();
        const sub = await SubscriptionBuilder.mountInto(
            { controls: document.getElementById('controls'), url: '#url' },
            { locale: 'en', signal: controller.signal },
        );
        expect(sub).toBeNull();
    });
});

describe('SubscriptionBuilder never fetches', () => {
    it('issues no request, whatever the user changes', async () => {
        const sub = await SubscriptionBuilder.mountInto(
            { controls: '#controls', url: '#url' },
            { locale: 'en' },
        );
        const change = (element, value) => {
            element.value = value;
            element.dispatchEvent(new Event('change', { bubbles: true }));
        };
        change(sub.riteSelect._domElement, 'ambrosian');
        change(sub.riteSelect._domElement, 'roman');
        change(sub.calendarSelect._domElement, 'VA');
        change(sub.localeInput._domElement, 'it');
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(global.fetch).not.toHaveBeenCalled();
    });
});

describe('SubscriptionBuilder.dispose', () => {
    it('is idempotent and makes further use throw', async () => {
        const sub = await SubscriptionBuilder.mountInto(
            { controls: '#controls', url: '#url' },
            { locale: 'en' },
        );
        sub.dispose();
        sub.dispose();
        expect(() => sub.url).toThrow(/disposed/);
        expect(document.querySelector('#url button')).toBeNull();
    });
});

describe('SubscriptionBuilder theming', () => {
    it('reaches all three controls and the URL wrapper', () => {
        const sub = new SubscriptionBuilder({
            locale: 'en',
            theme: {
                select: 'form-select',
                label: 'form-label',
                wrapper: 'form-group col-md',
                subscriptionUrl: { class: 'bg-light border rounded p-2' },
            },
        });
        sub.appendTo({ controls: '#controls', url: '#url' });

        expect(sub.riteSelect._domElement.className).toBe('form-select');
        expect(sub.calendarSelect._domElement.className).toBe('form-select');
        expect(sub.localeInput._domElement.className).toBe('form-select');
        expect(
            sub.riteSelect._domElement.closest('.form-group'),
        ).not.toBeNull();
        expect(document.querySelector('#url button').className).toBe(
            'bg-light border rounded p-2',
        );
    });
});
