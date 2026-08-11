/** @jest-environment jsdom */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import ApiClient from '../ApiClient/ApiClient.js';
import ApiExplorer from '../MetaComponents/ApiExplorer.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    global.fetch = jest.fn(() =>
        Promise.resolve({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: () => Promise.resolve({ litcal: [] }),
        }),
    );
    document.body.replaceChildren();
    for (const id of [
        'pathBuilder',
        'basePath',
        'allPaths',
        'rite',
        'builder',
    ]) {
        const el = document.createElement('div');
        el.id = id;
        document.body.appendChild(el);
    }
});

/** @returns {Promise<ApiExplorer>} A mounted explorer. */
const mountExplorer = async () => {
    const apiClient = await ApiClient.init(API_URL);
    return ApiExplorer.mountInto(
        {
            pathBuilder: '#pathBuilder',
            basePath: '#basePath',
            allPaths: '#allPaths',
            riteSelect: '#rite',
            builder: '#builder',
        },
        { locale: 'en', apiClient },
    );
};

describe('ApiExplorer', () => {
    it('mounts the option groups into their three slots', async () => {
        await mountExplorer();
        expect(
            document.querySelector('#pathBuilder').children.length,
        ).toBeGreaterThan(0);
        expect(
            document.querySelector('#basePath').children.length,
        ).toBeGreaterThan(0);
        expect(
            document.querySelector('#allPaths').children.length,
        ).toBeGreaterThan(0);
    });

    it('mounts the rite select into its own slot', async () => {
        const explorer = await mountExplorer();
        expect(document.querySelector('#rite select')).toBe(
            explorer.controls.riteSelect._domElement,
        );
    });

    it('never fetches a calendar', async () => {
        await mountExplorer();
        const calls = global.fetch.mock.calls.map((c) => String(c[0]));
        expect(calls.some((u) => /\/calendar(\/|\?|$)/.test(u))).toBe(false);
    });

    it('exposes the path builder', async () => {
        const explorer = await mountExplorer();
        expect(explorer.pathBuilder).not.toBeNull();
    });

    it('throws on use after dispose', async () => {
        const explorer = await mountExplorer();
        explorer.dispose();
        expect(() => explorer.controls).toThrow(/disposed/);
    });
});
