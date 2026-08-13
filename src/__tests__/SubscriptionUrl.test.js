/** @jest-environment jsdom */
/**
 * `SubscriptionUrl` is `SubscriptionBuilder`'s private renderer. It borrows the
 * `CurrentEndpoint` instance `ApiOptions` owns — the same one `PathBuilder`
 * borrows — so the URL model is shared and only the presentation is not.
 *
 * Two pins are load-bearing and easy to lose:
 *   - `return_type = 'ICS'` is what makes the URL a subscription rather than a
 *     JSON request. It is not user-selectable, unlike `PathBuilder`'s.
 *   - `explicitRite = true` forces `/roman` into the path. Without it
 *     `CurrentEndpoint.path` omits the rite for Roman, and the frontend card
 *     this replaces emits it unconditionally.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import SubscriptionUrl from '../SubscriptionBuilder/SubscriptionUrl.js';
import { ApiOptionsFilter } from '../Enums.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.innerHTML = '<div id="mount"></div>';
});

/**
 * The three controls a SubscriptionUrl wires to, built the way
 * SubscriptionBuilder will build them.
 *
 * @param {Object} [options] - Forwarded to SubscriptionUrl.
 * @returns {Object} The controls and the renderer.
 */
const build = (options = {}) => {
    const riteSelect = new RiteSelect('en');
    const calendarSelect = new CalendarSelect({
        locale: 'en',
        allowNull: true,
    });
    const apiOptions = new ApiOptions('en').filter(
        ApiOptionsFilter.LOCALE_ONLY,
    );
    apiOptions
        .linkToCalendarSelect(calendarSelect)
        .linkToRiteSelect(riteSelect);
    const url = new SubscriptionUrl(
        apiOptions,
        calendarSelect,
        riteSelect,
        options,
    );
    return { apiOptions, calendarSelect, riteSelect, url };
};

describe('SubscriptionUrl serialization', () => {
    it('renders the rite-level calendar with ICS and CIVIL pinned', () => {
        const { url } = build();
        expect(url.url).toBe(
            `${API_URL}/calendar/roman?year_type=CIVIL&return_type=ICS`,
        );
    });

    it('renders the Ambrosian rite-level calendar', () => {
        const { url, riteSelect } = build();
        riteSelect._domElement.value = 'ambrosian';
        riteSelect._domElement.dispatchEvent(new Event('change'));
        expect(url.url).toContain('/calendar/ambrosian');
    });

    it('emits /roman explicitly rather than omitting it', () => {
        // `CurrentEndpoint.path` drops the rite for Roman unless `explicitRite`
        // is set. The card this replaces always emits it, and URLs already
        // pasted into calendar apps depend on the explicit form resolving.
        const { url } = build();
        expect(url.url).toContain('/calendar/roman');
    });

    it('rejects an unknown scheme', () => {
        expect(() => build({ scheme: 'ftp' })).toThrow(
            /must be 'https' or 'webcal'/,
        );
    });

    it('rewrites only the scheme for webcal', () => {
        const https = build().url.url;
        const webcal = build({ scheme: 'webcal' }).url.url;
        expect(webcal).toBe(https.replace(/^https?:/, 'webcal:'));
        expect(webcal.startsWith('webcal:')).toBe(true);
    });
});
