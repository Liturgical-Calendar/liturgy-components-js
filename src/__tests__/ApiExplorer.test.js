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

    // C2: `insertAdjacentElement('afterend', …)` on a node with no parent is a
    // silent no-op — nothing anywhere else in the suite actually checked that
    // the calendar select ends up where the doc comment says it does.
    it('positions the calendar select inside the pathBuilder container, immediately after the calendar-path input', async () => {
        const explorer = await mountExplorer();
        const calendarPathInputEl =
            explorer.controls.apiOptions._calendarPathInput._domElement;
        const calendarSelectEl = explorer.controls.calendarSelect._domElement;
        const container = document.querySelector('#pathBuilder');

        expect(container.contains(calendarSelectEl)).toBe(true);
        // DOCUMENT_POSITION_FOLLOWING: calendarSelectEl comes AFTER
        // calendarPathInputEl in document order, regardless of whatever
        // (label, wrapper, ...) sits between them.
        expect(
            Boolean(
                calendarPathInputEl.compareDocumentPosition(calendarSelectEl) &
                Node.DOCUMENT_POSITION_FOLLOWING,
            ),
        ).toBe(true);
    });

    // C2: the calendar select has no slot of its own — it can only be
    // positioned as a side effect of mounting `pathBuilder`. Omitting that
    // slot used to leave it silently detached from the document; this must
    // now be a loud rejection instead.
    it('rejects when the pathBuilder slot is omitted, since the calendar select could not be positioned', async () => {
        const apiClient = await ApiClient.init(API_URL);
        await expect(
            ApiExplorer.mountInto(
                { builder: '#builder' },
                { locale: 'en', apiClient },
            ),
        ).rejects.toThrow(/pathBuilder/);
    });

    // I4: a slots object naming no known slot at all — an empty object, or
    // every key misspelled — must not resolve having silently mounted
    // nothing, matching the rule `CalendarControls.appendTo` and
    // `CalendarViewer`'s own `webCalendar`-bag unknown-key rejection already
    // apply elsewhere in this family.
    it('rejects an empty slots object', async () => {
        const apiClient = await ApiClient.init(API_URL);
        await expect(
            ApiExplorer.mountInto({}, { locale: 'en', apiClient }),
        ).rejects.toThrow(/pathBuilder/);
    });

    it('rejects a slots object naming only an unknown key', async () => {
        const apiClient = await ApiClient.init(API_URL);
        await expect(
            ApiExplorer.mountInto(
                { pathBulider: '#pathBuilder' },
                { locale: 'en', apiClient },
            ),
        ).rejects.toThrow(/unknown slot/);
    });

    // I3: a bad slot target reached through `mountInto()` must be reported
    // under that name, not under `appendTo` — a method the caller of
    // `mountInto()` never called.
    it('reports a missing slot target naming mountInto, not appendTo', async () => {
        const apiClient = await ApiClient.init(API_URL);
        await expect(
            ApiExplorer.mountInto(
                { pathBuilder: '#nope' },
                { locale: 'en', apiClient },
            ),
        ).rejects.toThrow(/ApiExplorer\.mountInto: Element not found/);
    });

    it('never fetches a calendar', async () => {
        await mountExplorer();
        const calls = global.fetch.mock.calls.map((c) => String(c[0]));
        expect(calls.some((u) => /\/calendar(\/|\?|$)/.test(u))).toBe(false);
    });

    // I7: the earlier "never fetches" coverage only ever drove the rite
    // select — re-adding `apiClient.listenTo(apiOptions)` alone (restoring
    // the bug this class exists to avoid) would survive that test untouched,
    // since nothing here changed an ApiOptions input at all. This drives the
    // year-type input instead, one of the `allPaths`-filtered inputs.
    it('never fetches a calendar after an ApiOptions input changes', async () => {
        const explorer = await mountExplorer();
        const yearTypeEl =
            explorer.controls.apiOptions._yearTypeInput._domElement;
        yearTypeEl.value =
            yearTypeEl.value === 'LITURGICAL' ? 'CIVIL' : 'LITURGICAL';
        yearTypeEl.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 0));

        const calls = global.fetch.mock.calls.map((c) => String(c[0]));
        expect(calls.some((u) => /\/calendar(\/|\?|$)/.test(u))).toBe(false);
    });

    it('rebuilds the calendar list on a rite change without ever fetching a calendar', async () => {
        const explorer = await mountExplorer();
        const calendarSelectEl = explorer.controls.calendarSelect._domElement;
        const riteSelectEl = explorer.controls.riteSelect._domElement;

        const beforeOptions = Array.from(calendarSelectEl.options).map(
            (option) => option.value,
        );

        riteSelectEl.value = 'ambrosian';
        riteSelectEl.dispatchEvent(new Event('change'));

        const afterOptions = Array.from(calendarSelectEl.options).map(
            (option) => option.value,
        );

        // The replacement wiring (`linkToCalendarSelect().linkToRiteSelect()`,
        // called directly rather than through `CalendarControls.listenTo()`)
        // must still rebuild the calendar list for the new rite ...
        expect(afterOptions).not.toEqual(beforeOptions);

        // ... while issuing no `/calendar/...` request at any point, even after
        // the interaction. `/calendars` (the metadata index, requested once by
        // `ApiClient.init()` in `mountExplorer()` above) is legitimate and must
        // still be permitted — the regex below only rejects a `/calendar` segment
        // followed by `/`, `?`, or end of string, never `/calendars`.
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
    // Review of PR #44: only the post-dispose throw was covered. `dispose()` also
    // has to empty every slot it mounted into — there are five, more than any
    // other component in this family — and be idempotent.
    it('empties all five mount slots on dispose', async () => {
        const explorer = await mountExplorer();
        for (const id of [
            'pathBuilder',
            'basePath',
            'allPaths',
            'rite',
            'builder',
        ]) {
            expect(document.getElementById(id).children.length).toBeGreaterThan(
                0,
            );
        }

        explorer.dispose();

        for (const id of [
            'pathBuilder',
            'basePath',
            'allPaths',
            'rite',
            'builder',
        ]) {
            expect(document.getElementById(id).children.length).toBe(0);
        }
    });

    it('is idempotent', async () => {
        const explorer = await mountExplorer();
        explorer.dispose();
        expect(() => explorer.dispose()).not.toThrow();
    });
});
