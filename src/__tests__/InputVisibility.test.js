/**
 * `inputs: { acceptHeader: false }` is how a meta-component's caller expresses
 * what used to require reaching into the mounted form:
 *
 *     viewer.controls.apiOptions._acceptHeaderInput.hide();
 *
 * That call sets a flag `ApiOptions.appendTo()` reads, so it was only meaningful
 * between construction and the append — a window `mountInto()` never opens, which
 * is what forced every real consumer onto the constructor path and away from
 * `settled` (#61).
 *
 * This module validates the bag the way `Theme.js` validates a theme bag: an
 * unknown key is rejected BY NAME rather than dropped in silence, because a
 * misspelled visibility toggle would otherwise render a control the caller
 * believes they turned off.
 */
import { describe, it, expect } from '@jest/globals';
import { resolveInputVisibility } from '../MetaComponents/InputVisibility.js';

describe('resolveInputVisibility', () => {
    it('defaults every input to visible when no bag is given', () => {
        expect(resolveInputVisibility(undefined, 'CalendarControls')).toEqual({
            acceptHeader: true,
        });
        expect(resolveInputVisibility(null, 'CalendarControls')).toEqual({
            acceptHeader: true,
        });
    });

    it('reads an explicit boolean', () => {
        expect(
            resolveInputVisibility({ acceptHeader: false }, 'CalendarControls'),
        ).toEqual({ acceptHeader: false });
        expect(
            resolveInputVisibility({ acceptHeader: true }, 'CalendarControls'),
        ).toEqual({ acceptHeader: true });
    });

    it('treats a key present with an explicit undefined as absent', () => {
        // Matches `CalendarViewer`'s own `webCalendar` bag and
        // `resolveChildTheme()`: an explicitly-undefined key is not an
        // instruction, so it takes the default rather than throwing.
        expect(
            resolveInputVisibility(
                { acceptHeader: undefined },
                'CalendarControls',
            ),
        ).toEqual({ acceptHeader: true });
    });

    it('rejects a bag that is not a plain object, naming the type', () => {
        expect(() =>
            resolveInputVisibility('acceptHeader', 'ApiExplorer'),
        ).toThrow(/ApiExplorer: inputs .*found type: string/);
        expect(() => resolveInputVisibility([1], 'ApiExplorer')).toThrow(
            /found type: array/,
        );
        expect(() =>
            resolveInputVisibility(new Intl.Locale('it-IT'), 'ApiExplorer'),
        ).toThrow(/found type: Locale/);
    });

    it('rejects an unknown key by name', () => {
        expect(() =>
            resolveInputVisibility({ acceptHeder: false }, 'CalendarViewer'),
        ).toThrow('CalendarViewer: unknown inputs option `acceptHeder`');
    });

    it('rejects a non-boolean value, naming the key and the type', () => {
        expect(() =>
            resolveInputVisibility({ acceptHeader: 'no' }, 'CalendarControls'),
        ).toThrow(
            /CalendarControls: inputs\.acceptHeader.*boolean.*found type: string/,
        );
        expect(() =>
            resolveInputVisibility({ acceptHeader: null }, 'CalendarControls'),
        ).toThrow(/found type: null/);
    });

    it('rejects an unknown key before reading any value, so nothing applies partially', () => {
        expect(() =>
            resolveInputVisibility(
                { acceptHeader: false, nope: true },
                'CalendarControls',
            ),
        ).toThrow('CalendarControls: unknown inputs option `nope`');
    });
});
