/** @jest-environment jsdom */
/**
 * Characterization tests for `DayViewer`'s theming of `ApiOptions._localeInput`,
 * pinning its behaviour BEFORE that theming logic is extracted into a shared
 * `applyLocaleInputTheme()` helper in `Theme.js` (issue #56).
 *
 * `LocaleInput`'s constructor hardcodes its label to the literal string
 * `'locale'` (`LocaleInput.js:48`), with no i18n of its own, which is why
 * `DayViewer` themes this one child unconditionally rather than leaving it to
 * the theme bag alone: an un-themed `DayViewer` must still ship a localized
 * label, not the raw string. `SubscriptionBuilder` grew a near-identical block
 * that repeated this reasoning in a second place, which is the whole reason
 * for the extraction.
 *
 * These assert current behaviour, not desired behaviour. Do not modify this
 * file during the refactor — if one of these fails afterwards, the refactor is
 * wrong, not the test.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import DayViewer from '../MetaComponents/DayViewer.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.innerHTML = '<div id="mount"></div>';
});

describe('DayViewer locale input theme — characterization', () => {
    it('ships a localized label by default, never the raw "locale" LocaleInput hardcodes', () => {
        const viewer = new DayViewer({ locale: 'en' });
        viewer.appendTo('#mount');
        expect(viewer.localeInput._labelElement.textContent).not.toBe('locale');
        expect(viewer.localeInput._labelElement.textContent).toBe('Language');
    });

    it('localizes the default label per the message catalogue, for a non-English locale', () => {
        const viewer = new DayViewer({ locale: 'it' });
        viewer.appendTo('#mount');
        expect(viewer.localeInput._labelElement.textContent).toBe('Lingua');
    });

    it('applies a per-child class override to the locale input', () => {
        const viewer = new DayViewer({
            locale: 'en',
            theme: { localeInput: { class: 'form-select-sm' } },
        });
        viewer.appendTo('#mount');
        expect(viewer.localeInput._domElement.className).toBe('form-select-sm');
    });

    it('applies a per-child labelClass override to the locale input', () => {
        const viewer = new DayViewer({
            locale: 'en',
            theme: { localeInput: { labelClass: 'form-label' } },
        });
        viewer.appendTo('#mount');
        expect(viewer.localeInput._labelElement.className).toBe('form-label');
    });

    it('a theme-supplied labelText wins over the localized default', () => {
        const viewer = new DayViewer({
            locale: 'en',
            theme: { localeInput: { labelText: 'Preferred language' } },
        });
        viewer.appendTo('#mount');
        expect(viewer.localeInput._labelElement.textContent).toBe(
            'Preferred language',
        );
    });

    it('wraps the locale input via the flat theme.wrapper key', () => {
        const viewer = new DayViewer({
            locale: 'en',
            theme: { wrapper: 'col-md-3' },
        });
        viewer.appendTo('#mount');
        expect(
            viewer.localeInput._domElement.closest('.col-md-3'),
        ).not.toBeNull();
    });

    it('wraps the locale input via a per-child wrapperClass override', () => {
        const viewer = new DayViewer({
            locale: 'en',
            theme: { localeInput: { wrapperClass: 'col-lg-6' } },
        });
        viewer.appendTo('#mount');
        expect(
            viewer.localeInput._domElement.closest('.col-lg-6'),
        ).not.toBeNull();
    });

    it('wraps the locale input via a per-child wrapper element TYPE with no class', () => {
        document.body.innerHTML = '<table><tr id="row"></tr></table>';
        const viewer = new DayViewer({
            locale: 'en',
            theme: { localeInput: { wrapper: 'td' } },
        });
        viewer.appendTo('#row');
        expect(viewer.localeInput._domElement.closest('td')).not.toBeNull();
    });
});
