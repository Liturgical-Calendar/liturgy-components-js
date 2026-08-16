/** @jest-environment jsdom */
import {
    describe,
    it,
    expect,
    beforeEach,
    afterEach,
    jest,
} from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import RiteSelect from '../RiteSelect/RiteSelect.js';
import { Rite } from '../Enums.js';

const values = (riteSelect) =>
    [...riteSelect._domElement.options].map((option) => option.value);

describe('RiteSelect option set', () => {
    it('renders every rite when none is named', () => {
        expect(values(new RiteSelect('en'))).toEqual(Object.values(Rite));
    });

    it('renders only the rites named, in the order given', () => {
        const select = new RiteSelect({
            locale: 'en',
            rites: [Rite.AMBROSIAN, Rite.ROMAN],
        });
        expect(values(select)).toEqual([Rite.AMBROSIAN, Rite.ROMAN]);
    });

    it('selects the first named rite', () => {
        const select = new RiteSelect({
            locale: 'en',
            rites: [Rite.AMBROSIAN, Rite.ROMAN],
        });
        expect(select._domElement.value).toBe(Rite.AMBROSIAN);
    });

    it('keeps the localized label for each rite it renders', () => {
        const select = new RiteSelect({ locale: 'it', rites: [Rite.ROMAN] });
        expect(
            select._domElement.options[0].textContent.length,
        ).toBeGreaterThan(0);
    });

    it('is chainable as a setter', () => {
        const select = new RiteSelect('en');
        expect(select.rites([Rite.ROMAN])).toBe(select);
        expect(values(select)).toEqual([Rite.ROMAN]);
    });

    it('rejects a non-array', () => {
        expect(() => new RiteSelect({ locale: 'en', rites: 'roman' })).toThrow(
            /RiteSelect.*rites/,
        );
    });

    it('rejects an empty array', () => {
        expect(() => new RiteSelect({ locale: 'en', rites: [] })).toThrow(
            /RiteSelect.*empty/,
        );
    });

    it('rejects an unknown rite, naming it and the valid ones', () => {
        expect(
            () => new RiteSelect({ locale: 'en', rites: ['byzantine'] }),
        ).toThrow(/byzantine.*roman/s);
    });

    it('rejects a duplicate', () => {
        expect(
            () => new RiteSelect({ locale: 'en', rites: ['roman', 'roman'] }),
        ).toThrow(/RiteSelect.*duplicate/i);
    });
});

// F4 (post-PR review): `rites()` is new public API, not bound to the
// construction-time-only way the meta-components happen to call it. After a
// caller has linked this select through `linkToRiteSelect()`, a later
// `rites()` call must not leave the DOM showing one rite while every linked
// consumer (`ApiOptions`, `ApiClient`) keeps requesting the previous one.
describe('RiteSelect.rites() dispatches change conditionally (F4)', () => {
    it('dispatches change when the selected value actually changes', () => {
        const select = new RiteSelect({ locale: 'en', rites: [Rite.ROMAN] });
        const listener = jest.fn();
        select._domElement.addEventListener('change', listener);

        select.rites([Rite.AMBROSIAN, Rite.ROMAN]);

        expect(listener).toHaveBeenCalledTimes(1);
        expect(select._domElement.value).toBe(Rite.AMBROSIAN);
    });

    it('dispatches nothing when the first entry equals the current selection', () => {
        const select = new RiteSelect({ locale: 'en', rites: [Rite.ROMAN] });
        const listener = jest.fn();
        select._domElement.addEventListener('change', listener);

        select.rites([Rite.ROMAN]);

        expect(listener).not.toHaveBeenCalled();
        expect(select._domElement.value).toBe(Rite.ROMAN);
    });

    it('dispatches nothing on the construction-time call, since nothing is listening yet', () => {
        // Every meta-component only ever calls `rites()` at construction time,
        // through the `rites` constructor option, before anything is linked —
        // this pins that no listener attached AFTER construction observes a
        // dispatch that happened during it.
        const select = new RiteSelect({
            locale: 'en',
            rites: [Rite.AMBROSIAN, Rite.ROMAN],
        });
        const listener = jest.fn();
        select._domElement.addEventListener('change', listener);

        expect(listener).not.toHaveBeenCalled();
    });

    describe('wired regression: a linked ApiOptions/ApiClient chain follows rites()', () => {
        const API_URL = 'http://localhost:8000';
        const METADATA = {
            locales: ['en', 'it', 'la'],
            national_calendars: [
                { calendar_id: 'IT', locales: ['it-IT'], settings: {} },
            ],
            diocesan_calendars: [
                {
                    calendar_id: 'romamo_it',
                    nation: 'IT',
                    diocese: 'Diocesi di Roma',
                    locales: ['it-IT'],
                    rite: 'roman',
                },
                {
                    calendar_id: 'lugano_ch',
                    nation: 'CH',
                    diocese: 'Diocesi di Lugano',
                    locales: ['it-IT'],
                    rite: 'ambrosian',
                },
            ],
            ambrosian_calendars: [{ calendar_id: 'ambrosian' }],
        };

        beforeEach(() => {
            ApiBase.reset();
            ApiBase.fromMetadata(API_URL, METADATA);
            document.body.innerHTML = '<div id="opts"></div>';
            // `#listenToRiteSelect()`'s change handler schedules a microtask
            // refetch; mocked here, matching ApiClientRite.test.js, so that
            // refetch resolves instead of logging an unmocked-fetch error.
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({
                        litcal: [],
                        settings: {},
                        metadata: {},
                        messages: [],
                    }),
            });
        });

        afterEach(() => {
            delete global.fetch;
        });

        it('propagates to a linked ApiClient when rites() changes the selection', async () => {
            const riteSelect = new RiteSelect({
                locale: 'en',
                rites: [Rite.ROMAN, Rite.AMBROSIAN],
            });
            const apiOptions = new ApiOptions('en');
            apiOptions.linkToRiteSelect(riteSelect);
            apiOptions.appendTo('#opts');

            const apiClient = await ApiClient.init(API_URL);
            apiClient.rite(Rite.ROMAN).listenTo(riteSelect);

            expect(riteSelect._domElement.value).toBe(Rite.ROMAN);

            riteSelect.rites([Rite.AMBROSIAN, Rite.ROMAN]);

            expect(riteSelect._domElement.value).toBe(Rite.AMBROSIAN);
            // The ApiClient's own change listener runs synchronously off the
            // dispatched event, ahead of the microtask-deferred refetch.
            expect(apiClient._currentRite).toBe(Rite.AMBROSIAN);
            // Flushes the scheduled refetch so it settles within this test.
            await Promise.resolve();
        });

        it('does not propagate when rites() leaves the selection unchanged', async () => {
            const riteSelect = new RiteSelect({
                locale: 'en',
                rites: [Rite.ROMAN, Rite.AMBROSIAN],
            });
            const apiClient = await ApiClient.init(API_URL);
            apiClient.rite(Rite.ROMAN).listenTo(riteSelect);

            riteSelect.rites([Rite.ROMAN, Rite.AMBROSIAN]);

            expect(riteSelect._domElement.value).toBe(Rite.ROMAN);
            expect(apiClient._currentRite).toBe(Rite.ROMAN);
            expect(global.fetch).not.toHaveBeenCalled();
        });
    });
});

describe('RiteSelect._setHidden', () => {
    it('hides and shows the select', () => {
        const select = new RiteSelect('en');
        select._setHidden(true);
        expect(select._domElement.hidden).toBe(true);
        select._setHidden(false);
        expect(select._domElement.hidden).toBe(false);
    });

    it('hides the wrapper, not the bare select, when a wrapper was configured', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const select = new RiteSelect('en').wrapper({ as: 'div' });
        select.appendTo(container);

        select._setHidden(true);

        expect(select._domElement.hidden).toBe(false);
        expect(select._domElement.parentElement.hidden).toBe(true);
    });

    // F3 (final whole-branch review): with NO wrapper configured — the
    // `bootstrap5` preset deliberately supplies none — hiding the select must
    // also hide its label, or the label dangles over nothing.
    it('hides the label too when there is no wrapper', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const select = new RiteSelect('en').label({ text: 'Select a rite' });
        select.appendTo(container);
        const label = container.querySelector('label');

        expect(label.hidden).toBe(false);
        select._setHidden(true);

        expect(select._domElement.hidden).toBe(true);
        expect(label.hidden).toBe(true);

        select._setHidden(false);
        expect(select._domElement.hidden).toBe(false);
        expect(label.hidden).toBe(false);
    });
});
