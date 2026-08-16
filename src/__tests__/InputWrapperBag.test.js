/** @jest-environment jsdom */
/**
 * `Input.wrapper()` was the last wrapper API in the library with its own shape:
 * a bare tag name, paired with a separate `wrapperClass()` call, and no way to
 * give the wrapper an id at all. `CalendarSelect.wrapper()` and
 * `RiteSelect.wrapper()` both take an `{ as, class, id }` bag through the shared
 * `WrapperOptions.buildWrapperElement()`. This converges the third — see issue
 * #46 — additively: the bare-string form keeps working, because two callers
 * inside this very library use it (`DayViewer` for the locale input,
 * `LiturgyOfAnyDay` for its date inputs) and both example apps do too.
 *
 * The one-shot guard is the one behaviour change. Previously a second
 * `wrapper()` call silently replaced the element and reset its class to the
 * GLOBAL wrapper class, while leaving `#wrapperClassSet` true — so the class the
 * caller had set was discarded without a word, and the next `wrapperClass()`
 * call threw an error naming a class they had never set. That is not behaviour
 * anyone could have relied on; it is now an honest throw at the second call.
 *
 * Crucially the guard counts EXPLICIT `wrapper()` calls only. The constructor
 * builds a wrapper of its own whenever `Input.setGlobalWrapper()` has been
 * called, which `LiturgicalCalendarFrontend` and six of the examples all do at
 * module scope — a guard keyed on "a wrapper exists" would have thrown on every
 * per-instance call on those pages. That interaction is pinned separately in
 * InputWrapperGlobals.test.js, which needs a module registry with the statics
 * untouched.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import Input from '../ApiOptions/Input/Input.js';

beforeEach(() => {
    Input.reset();
    document.body.innerHTML = '<div id="mount"></div>';
});

/** A concrete input to exercise the inherited `wrapper()` on. */
const input = () => new Input('select');

describe('Input.wrapper() — the bare-string form still works', () => {
    it('defaults to a div', () => {
        const element = input().wrapper()._wrapperElement;
        expect(element.tagName).toBe('DIV');
    });

    it('accepts td', () => {
        expect(input().wrapper('td')._wrapperElement.tagName).toBe('TD');
    });

    it('is chainable', () => {
        const instance = input();
        expect(instance.wrapper('div')).toBe(instance);
    });

    it('rejects a non-string, non-object argument', () => {
        expect(() => input().wrapper(42)).toThrow(/wrapper/i);
    });

    it('rejects a tag name that is neither div nor td', () => {
        expect(() => input().wrapper('span')).toThrow(/div, td|div` or `td/);
    });

    it('still pairs with wrapperClass()', () => {
        const instance = input().wrapper('div').wrapperClass('col-md-6');
        expect(instance._wrapperElement.className).toBe('col-md-6');
    });
});

describe('Input.wrapper() — the { as, class, id } bag', () => {
    it('defaults as to div and applies the class', () => {
        const element = input().wrapper({ class: 'col-md-3' })._wrapperElement;
        expect(element.tagName).toBe('DIV');
        expect(element.className).toBe('col-md-3');
    });

    it('accepts as: td', () => {
        expect(input().wrapper({ as: 'td' })._wrapperElement.tagName).toBe(
            'TD',
        );
    });

    it('applies an id, which the bare-string form could never do', () => {
        const element = input().wrapper({ id: 'locale-wrap' })._wrapperElement;
        expect(element.id).toBe('locale-wrap');
    });

    it('applies all three at once', () => {
        const element = input().wrapper({
            as: 'td',
            class: 'form-group col-md-3',
            id: 'locale-wrap',
        })._wrapperElement;
        expect(element.tagName).toBe('TD');
        expect(element.className).toBe('form-group col-md-3');
        expect(element.id).toBe('locale-wrap');
    });

    it('reaches the document when appended', () => {
        const instance = input().wrapper({ class: 'col-md-3', id: 'wrap' });
        instance.appendTo('#mount');
        const wrapper = document.querySelector('#mount > div#wrap');
        expect(wrapper).not.toBeNull();
        expect(wrapper.className).toBe('col-md-3');
        expect(instance._domElement.parentElement).toBe(wrapper);
    });

    it('rejects an array', () => {
        expect(() => input().wrapper([])).toThrow(/array/);
    });

    it('rejects a bag naming none of as, class or id', () => {
        expect(() => input().wrapper({ nope: 'x' })).toThrow(
            /at least an `as`, `class` or `id`/,
        );
    });

    it('rejects an invalid as value', () => {
        expect(() => input().wrapper({ as: 'span' })).toThrow(/`div` or `td`/);
    });

    it('rejects a non-string class', () => {
        expect(() => input().wrapper({ class: 42 })).toThrow(
            /Invalid type for wrapper class/,
        );
    });

    it('rejects a class carrying a quote', () => {
        // `Utils.validateClassName()` rejects whitespace, quotes, backtick and
        // `<` — not punctuation at large, so `!!` is a VALID class name here and
        // makes a useless negative case.
        expect(() => input().wrapper({ class: 'a"b' })).toThrow(
            /Invalid class name/,
        );
    });

    it('rejects an invalid id', () => {
        // Asserted on the specific message, not on /id/i — which "Inval-id"
        // satisfies by accident, so the test would pass before the feature existed.
        expect(() => input().wrapper({ id: 'has space' })).toThrow(
            /cannot contain any kind of whitespace/,
        );
    });

    it('rejects null, which has no meaning here', () => {
        // `CalendarSelect.wrapper( null )` means "no wrapper", but an `Input` has
        // none until this method is called, so there is nothing to un-set — and
        // the one-shot guard means it could not be re-set afterwards anyway.
        expect(() => input().wrapper(null)).toThrow(/null/);
    });
});

describe('Input.wrapper() — the one-shot guard', () => {
    it('throws on a second call', () => {
        const instance = input().wrapper('div');
        expect(() => instance.wrapper('td')).toThrow(/already been set/);
    });

    it('throws on a second call in the bag form too', () => {
        const instance = input().wrapper({ as: 'div' });
        expect(() => instance.wrapper({ as: 'td' })).toThrow(
            /already been set/,
        );
    });

    it('leaves the first wrapper intact when the second call throws', () => {
        const instance = input().wrapper({ as: 'div', class: 'kept' });
        expect(() => instance.wrapper('td')).toThrow();
        expect(instance._wrapperElement.tagName).toBe('DIV');
        expect(instance._wrapperElement.className).toBe('kept');
    });
});

describe('Input.wrapper() — interaction with wrapperClass()', () => {
    it('treats a class set through the bag as already set', () => {
        // Same contract `wrapperClass()` has always had with itself: setting the
        // class twice to different values is a mistake worth naming, and the
        // message now names a class the caller actually set.
        const instance = input().wrapper({ class: 'col-md-3' });
        expect(() => instance.wrapperClass('col-md-6')).toThrow(/col-md-3/);
    });

    it('permits wrapperClass() to repeat the same value', () => {
        const instance = input().wrapper({ class: 'col-md-3' });
        expect(() => instance.wrapperClass('col-md-3')).not.toThrow();
    });

    it('leaves wrapperClass() free after a bag that named no class', () => {
        const instance = input().wrapper({ as: 'td' });
        expect(() => instance.wrapperClass('col-md-6')).not.toThrow();
        expect(instance._wrapperElement.className).toBe('col-md-6');
    });
});

describe('Input._setHidden', () => {
    it('hides and shows the bare input, when no wrapper was configured', () => {
        const instance = input();
        instance._setHidden(true);
        expect(instance._domElement.hidden).toBe(true);
        instance._setHidden(false);
        expect(instance._domElement.hidden).toBe(false);
    });

    it('hides the wrapper, not the bare input, when a wrapper was configured', () => {
        const instance = input().wrapper({ as: 'div' });
        instance.appendTo('#mount');

        instance._setHidden(true);

        expect(instance._domElement.hidden).toBe(false);
        expect(instance._domElement.parentElement.hidden).toBe(true);
    });

    // F3 (final whole-branch review): with no wrapper configured, hiding the
    // input must also hide its label — `Input`'s constructor always builds
    // one (`#labelElement`), unlike `CalendarSelect`/`RiteSelect` — or the
    // label dangles over nothing once the input is gone.
    it('hides the label too when there is no wrapper', () => {
        const instance = input();
        instance.appendTo('#mount');
        const label = document.querySelector('#mount label');

        expect(label.hidden).toBe(false);
        instance._setHidden(true);

        expect(instance._domElement.hidden).toBe(true);
        expect(label.hidden).toBe(true);

        instance._setHidden(false);
        expect(instance._domElement.hidden).toBe(false);
        expect(label.hidden).toBe(false);
    });
});
