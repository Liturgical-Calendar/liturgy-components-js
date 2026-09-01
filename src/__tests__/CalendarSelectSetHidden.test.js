/** @jest-environment jsdom */
/**
 * `CalendarSelect._setHidden()` — F3 (final whole-branch review). With no
 * wrapper configured, hiding the select must also hide its label, or the
 * label dangles over nothing once the select is gone. The `bootstrap5` theme
 * preset supplies no `wrapper` deliberately (see CLAUDE.md), which is exactly
 * the configuration a diocesan or bishops'-conference site scoped down to a
 * single calendar is likeliest to use.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.innerHTML = '<div id="mount"></div>';
});

describe('CalendarSelect._setHidden', () => {
    it('hides and shows the bare select when there is no wrapper and no label', () => {
        const cs = new CalendarSelect('en');
        cs.appendTo('#mount');
        cs._setHidden(true);
        expect(cs._domElement.hidden).toBe(true);
        cs._setHidden(false);
        expect(cs._domElement.hidden).toBe(false);
    });

    it('hides the wrapper, not the bare select, when a wrapper was configured', () => {
        const cs = new CalendarSelect('en').wrapper({ as: 'div' });
        cs.appendTo('#mount');
        cs._setHidden(true);
        expect(cs._domElement.hidden).toBe(false);
        expect(cs._domElement.parentElement.hidden).toBe(true);
    });

    it('hides the label too when there is no wrapper', () => {
        const cs = new CalendarSelect('en').label({
            text: 'Select a calendar',
        });
        cs.appendTo('#mount');
        const label = document.querySelector('#mount label');

        expect(label.hidden).toBe(false);
        cs._setHidden(true);

        expect(cs._domElement.hidden).toBe(true);
        expect(label.hidden).toBe(true);

        cs._setHidden(false);
        expect(cs._domElement.hidden).toBe(false);
        expect(label.hidden).toBe(false);
    });
});
