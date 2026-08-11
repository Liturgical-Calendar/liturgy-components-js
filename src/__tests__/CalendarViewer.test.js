/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import CalendarViewer from '../MetaComponents/CalendarViewer.js';
import { Grouping, DateFormat } from '../Enums.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

const captureRequests = () => {
    const urls = [];
    global.fetch = jest.fn((url) => {
        urls.push(String(url));
        return Promise.resolve({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: () =>
                Promise.resolve({
                    litcal: [],
                    settings: {},
                    metadata: {},
                    messages: [],
                }),
        });
    });
    return urls;
};

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.replaceChildren();
    for (const id of ['controls', 'calendar', 'messages']) {
        const el = document.createElement('div');
        el.id = id;
        document.body.appendChild(el);
    }
});

describe('CalendarViewer', () => {
    it('mounts controls and a calendar into their slots', async () => {
        captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const viewer = await CalendarViewer.mountInto(
            { controls: '#controls', calendar: '#calendar' },
            { locale: 'en', apiClient },
        );
        expect(
            document.querySelectorAll('#controls select').length,
        ).toBeGreaterThanOrEqual(2);
        expect(viewer.webCalendar).not.toBeNull();
        expect(viewer.controls).not.toBeNull();
    });

    it('forwards the webCalendar bag to the matching methods', async () => {
        captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const viewer = await CalendarViewer.mountInto(
            { controls: '#controls', calendar: '#calendar' },
            {
                locale: 'en',
                apiClient,
                webCalendar: {
                    id: 'LitCalTable',
                    firstColumnGrouping: Grouping.BY_LITURGICAL_SEASON,
                    dateFormat: DateFormat.DAY_ONLY,
                    psalterWeekColumn: true,
                },
            },
        );
        expect(viewer.webCalendar).not.toBeNull();
    });

    it('rejects an unknown webCalendar key, naming it', async () => {
        const apiClient = await ApiClient.init(API_URL);
        await expect(
            CalendarViewer.mountInto(
                { controls: '#controls', calendar: '#calendar' },
                { locale: 'en', apiClient, webCalendar: { notAMethod: 1 } },
            ),
        ).rejects.toThrow(/notAMethod/);
    });

    it('renders messages when the slot is named', async () => {
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: () =>
                    Promise.resolve({
                        litcal: [],
                        settings: {},
                        metadata: {},
                        messages: ['a message'],
                    }),
            }),
        );
        const apiClient = await ApiClient.init(API_URL);
        await CalendarViewer.mountInto(
            {
                controls: '#controls',
                calendar: '#calendar',
                messages: '#messages',
            },
            { locale: 'en', apiClient },
        );
        expect(document.querySelectorAll('#messages tr').length).toBe(1);
    });

    it('disposes both halves', async () => {
        captureRequests();
        const apiClient = await ApiClient.init(API_URL);
        const viewer = await CalendarViewer.mountInto(
            { controls: '#controls', calendar: '#calendar' },
            { locale: 'en', apiClient },
        );
        viewer.dispose();
        expect(() => viewer.controls).toThrow(/disposed/);
        expect(document.getElementById('controls').children.length).toBe(0);
    });
});
