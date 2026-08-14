/** @jest-environment jsdom */
/**
 * Issue #78: a theme key naming a child the receiving component does not have
 * must THROW, under that component's own name, rather than being accepted by
 * `assertTheme()` and then dropped in silence by `resolveChildTheme()`.
 *
 * The dropped-in-silence behaviour is the issue-#43 failure mode arriving by a
 * different route — markup rendered with library defaults, no throw and no
 * warning — which is why the guard now knows which children each component has.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
    assertTheme,
    narrowTheme,
    THEME_CHILD_KEYS,
} from '../MetaComponents/Theme.js';
import ApiBase from '../ApiClient/ApiBase.js';
import CalendarResourcePicker from '../MetaComponents/CalendarResourcePicker.js';
import CalendarViewer from '../MetaComponents/CalendarViewer.js';
import ApiExplorer from '../MetaComponents/ApiExplorer.js';
import SubscriptionBuilder from '../SubscriptionBuilder/SubscriptionBuilder.js';
import { CalendarSelectFilter } from '../Enums.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

describe('assertTheme is component-aware', () => {
    it('rejects theme.apiOptions on CalendarResourcePicker, which bundles none', () => {
        expect(() =>
            assertTheme(
                { apiOptions: { select: 'form-select' } },
                'CalendarResourcePicker',
            ),
        ).toThrow(
            /CalendarResourcePicker: theme\.apiOptions is not a recognised theme key/,
        );
    });

    it('rejects theme.localeInput on CalendarResourcePicker, which has no ApiOptions to hold one', () => {
        expect(() =>
            assertTheme(
                { localeInput: 'form-select' },
                'CalendarResourcePicker',
            ),
        ).toThrow(/CalendarResourcePicker: theme\.localeInput/);
    });

    it('rejects theme.liturgy on CalendarControls but accepts it on DayViewer', () => {
        expect(() =>
            assertTheme(
                { liturgy: { eventClass: 'card' } },
                'CalendarControls',
            ),
        ).toThrow(
            /CalendarControls: theme\.liturgy is not a recognised theme key/,
        );
        expect(() =>
            assertTheme({ liturgy: { eventClass: 'card' } }, 'DayViewer'),
        ).not.toThrow();
    });

    it('rejects theme.dateControls anywhere but on DayViewer', () => {
        expect(() =>
            assertTheme({ dateControls: 'col-md' }, 'CalendarViewer'),
        ).toThrow(
            /CalendarViewer: theme\.dateControls is not a recognised theme key/,
        );
        expect(() =>
            assertTheme({ dateControls: 'col-md' }, 'DayViewer'),
        ).not.toThrow();
    });

    it('rejects theme.subscriptionUrl everywhere but on SubscriptionBuilder', () => {
        for (const name of [
            'CalendarResourcePicker',
            'CalendarControls',
            'CalendarViewer',
            'ApiExplorer',
            'DayViewer',
        ]) {
            expect(() => assertTheme({ subscriptionUrl: 'x' }, name)).toThrow(
                /theme\.subscriptionUrl is not a recognised theme key/,
            );
        }
        expect(() =>
            assertTheme({ subscriptionUrl: 'x' }, 'SubscriptionBuilder'),
        ).not.toThrow();
    });

    it('names the components the misplaced key would be valid on', () => {
        let message = '';
        try {
            assertTheme({ liturgy: 'x' }, 'CalendarViewer');
        } catch (error) {
            message = error.message;
        }
        expect(message).toMatch(/theme\.liturgy is valid on DayViewer/);
    });

    it("lists the component's own valid keys in the message", () => {
        let message = '';
        try {
            assertTheme({ liturgy: 'x' }, 'CalendarResourcePicker');
        } catch (error) {
            message = error.message;
        }
        expect(message).toMatch(/riteSelect/);
        expect(message).toMatch(/calendarSelect/);
        expect(message).toMatch(/select, input, label, wrapper/);
    });

    it('still advises the nested spelling for an ApiOptions input on a component that has one', () => {
        expect(() =>
            assertTheme({ yearInput: { class: 'x' } }, 'CalendarControls'),
        ).toThrow(/Write it as theme\.apiOptions\.yearInput instead/);
    });

    it('reports an ApiOptions input as an unknown key where there is no ApiOptions to nest it in', () => {
        let message = '';
        try {
            assertTheme(
                { yearInput: { class: 'x' } },
                'CalendarResourcePicker',
            );
        } catch (error) {
            message = error.message;
        }
        expect(message).toMatch(/is not a recognised theme key/);
        // The nested spelling would be rejected too on this component, so
        // advising it would send the caller from one throw to another.
        expect(message).not.toMatch(/Write it as/);
    });

    it('throws for a component name it holds no key set for, rather than falling back to permissive', () => {
        expect(() => assertTheme({}, 'NotAComponent')).toThrow(/NotAComponent/);
    });

    // `assertPlainOptions()` accepts a bag carrying an own key of any name,
    // including one that collides with `Object.prototype` — and its own doc
    // comment warns that every reader must therefore use `Object.hasOwn()`.
    // Read with a bare `[key]`, the registry lookups hand back an inherited
    // FUNCTION instead of `undefined`, and the guard crashes with an opaque
    // `TypeError` on the very path that exists to produce a legible message.
    it.each(['toString', 'constructor', 'valueOf', 'hasOwnProperty'])(
        'rejects theme.%s with the unknown-key message, not a TypeError',
        (key) => {
            let error;
            try {
                assertTheme({ [key]: 'x' }, 'CalendarResourcePicker');
            } catch (caught) {
                error = caught;
            }
            expect(error).toBeInstanceOf(Error);
            expect(error).not.toBeInstanceOf(TypeError);
            expect(error.message).toMatch(
                new RegExp(
                    `CalendarResourcePicker: theme\\.${key} is not a recognised theme key`,
                ),
            );
        },
    );

    it('reports an unregistered component name that collides with Object.prototype', () => {
        let error;
        try {
            assertTheme({}, 'toString');
        } catch (caught) {
            error = caught;
        }
        expect(error).not.toBeInstanceOf(TypeError);
        expect(error.message).toMatch(/no theme key set is registered/);
    });

    it('accepts every key each component actually resolves', () => {
        for (const [name, keys] of Object.entries(THEME_CHILD_KEYS)) {
            for (const key of keys) {
                const bag =
                    'apiOptions' === key ? { apiOptions: {} } : { [key]: 'x' };
                expect(() => assertTheme(bag, name)).not.toThrow();
            }
        }
    });

    it('still accepts an ApiOptions input the current filter never renders', () => {
        // Out of scope for #78 and settled by #60: all ten inputs exist
        // regardless of `filter`, so theming a hidden one is inert, not an error.
        expect(() =>
            assertTheme(
                { apiOptions: { acceptHeaderInput: { class: 'x' } } },
                'DayViewer',
            ),
        ).not.toThrow();
    });
});

describe('narrowTheme', () => {
    it('passes a nullish theme straight through', () => {
        expect(narrowTheme(null, 'CalendarControls')).toBeNull();
        expect(narrowTheme(undefined, 'CalendarControls')).toBeUndefined();
    });

    it("keeps the flat keys and the target component's own child keys", () => {
        const narrowed = narrowTheme(
            {
                select: 'form-select',
                label: 'form-label',
                calendarSelect: { class: 'a' },
                subscriptionUrl: 'b',
            },
            'CalendarControls',
        );
        expect(narrowed).toEqual({
            select: 'form-select',
            label: 'form-label',
            calendarSelect: { class: 'a' },
        });
    });

    it('does not mutate the caller’s bag', () => {
        const theme = { select: 'form-select', subscriptionUrl: 'b' };
        narrowTheme(theme, 'CalendarControls');
        expect(theme).toEqual({ select: 'form-select', subscriptionUrl: 'b' });
    });

    // Silently returning "flat keys only" for an unregistered name would strip
    // `riteSelect`, `calendarSelect`, `apiOptions` and `localeInput` from every
    // forwarded bag, and every existing test would still pass — the same
    // silent-fallback failure `assertTheme()` refuses three lines away.
    it('throws for an unregistered target rather than silently stripping every child key', () => {
        expect(() =>
            narrowTheme({ select: 'a', riteSelect: 'b' }, 'CalenderControls'),
        ).toThrow(/no theme key set is registered for CalenderControls/);
    });
});

describe('forwarding components own their theme attribution', () => {
    beforeEach(() => {
        ApiBase.reset();
        ApiBase.fromMetadata(API_URL, FULL_METADATA);
        document.body.innerHTML = '';
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ litcal: [] }),
            }),
        );
    });

    it('reports a bad theme key on CalendarViewer under its own name', () => {
        expect(
            () => new CalendarViewer({ theme: { liturgy: { class: 'x' } } }),
        ).toThrow(/^CalendarViewer: theme\.liturgy/);
    });

    it('reports a bad theme key on ApiExplorer under its own name', () => {
        expect(
            () => new ApiExplorer({ theme: { liturgy: { class: 'x' } } }),
        ).toThrow(/^ApiExplorer: theme\.liturgy/);
    });

    it('reports a bad theme key on SubscriptionBuilder under its own name', () => {
        expect(
            () =>
                new SubscriptionBuilder({ theme: { liturgy: { class: 'x' } } }),
        ).toThrow(/^SubscriptionBuilder: theme\.liturgy/);
    });

    // The issue's headline example, and the one place where reject-versus-resolve
    // is a live decision: `assertTheme()` sits BEFORE the `try` whose `catch`
    // resolves with a disabled failure control. Moving it inside would quietly
    // downgrade a programmer error into a `dataset.loadFailed` stand-in.
    it('rejects a misplaced key from CalendarResourcePicker.mountInto(), rather than resolving with a failure control', async () => {
        document.body.innerHTML = '<div id="picker"></div>';
        await expect(
            CalendarResourcePicker.mountInto('#picker', {
                filter: CalendarSelectFilter.DIOCESAN_CALENDARS,
                theme: { apiOptions: { select: 'form-select' } },
            }),
        ).rejects.toThrow(/CalendarResourcePicker: theme\.apiOptions/);
        expect(document.querySelector('#picker').children).toHaveLength(0);
    });

    it('still accepts subscriptionUrl, which the CalendarControls it forwards to has never heard of', () => {
        const builder = new SubscriptionBuilder({
            theme: { select: 'form-select', subscriptionUrl: 'url-box' },
        });
        expect(builder.calendarSelect._domElement.className).toBe(
            'form-select',
        );
        builder.dispose();
    });
});
