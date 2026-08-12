/** @jest-environment jsdom */
/**
 * `Input.wrapper()`'s one-shot guard against the global wrapper statics.
 *
 * This is the interaction that decided how the guard had to be written. The
 * CONSTRUCTOR builds a wrapper element of its own whenever
 * `Input.setGlobalWrapper()` has been called (`Input.js`, in the constructor),
 * setting `#hasWrapper` true before any caller can touch the instance.
 * `LiturgicalCalendarFrontend` calls `setGlobalWrapper( 'div' )` at module
 * scope, and so do six of this repo's examples — so a guard keyed on "does a
 * wrapper already exist" would have thrown on every per-instance `wrapper()`
 * call on those pages, including the library's own `DayViewer` call for the
 * locale input. The guard therefore counts EXPLICIT `wrapper()` calls only.
 *
 * The other half is precedence: a bag that names a class must beat
 * `setGlobalWrapperClass()`, while a bag that names none must still inherit it.
 * `buildWrapperElement()` knows nothing about the globals, so that ordering
 * lives at the call site and is pinned here.
 *
 * Lives in its own file because the statics have no reset — `Input.reset()`
 * clears only the id registry — so these need a module registry no other test
 * has already written to.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import Input from '../ApiOptions/Input/Input.js';

beforeEach(() => {
    Input.reset();
    document.body.innerHTML = '<div id="mount"></div>';
});

describe('the constructor’s global wrapper does not consume the one-shot', () => {
    it('still allows one explicit wrapper() call', () => {
        Input.setGlobalWrapper('div');
        const instance = new Input('select');

        // The constructor already made a div. This is the caller's FIRST
        // explicit call, so it must be honoured, not refused.
        expect(() => instance.wrapper('td')).not.toThrow();
        expect(instance._wrapperElement.tagName).toBe('TD');
    });

    it('refuses the second explicit call, as everywhere else', () => {
        Input.setGlobalWrapper('div');
        const instance = new Input('select').wrapper('td');
        expect(() => instance.wrapper('div')).toThrow(/already been set/);
    });
});

describe('global wrapper class versus the bag', () => {
    it('inherits the global class when the bag names none', () => {
        Input.setGlobalWrapper('div');
        Input.setGlobalWrapperClass('form-group col col-md-3');
        const instance = new Input('select').wrapper({ as: 'td' });

        expect(instance._wrapperElement.className).toBe(
            'form-group col col-md-3',
        );
    });

    it('lets a bag class beat the global class', () => {
        Input.setGlobalWrapper('div');
        Input.setGlobalWrapperClass('form-group col col-md-3');
        const instance = new Input('select').wrapper({ class: 'col-md-6' });

        expect(instance._wrapperElement.className).toBe('col-md-6');
    });

    it('leaves wrapperClass() usable after a constructor-made wrapper', () => {
        // The pattern LiturgicalCalendarFrontend uses on every ApiOptions input:
        // globals set once at module scope, then a per-input wrapperClass()
        // override. The global class must not count as "already set".
        Input.setGlobalWrapper('div');
        Input.setGlobalWrapperClass('form-group col col-md-3');
        const instance = new Input('select');

        expect(() =>
            instance.wrapperClass('form-group col col-md-2'),
        ).not.toThrow();
        expect(instance._wrapperElement.className).toBe(
            'form-group col col-md-2',
        );
    });
});
