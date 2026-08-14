/** @jest-environment jsdom */
/**
 * Issue #59: every `ApiOptions` input rendered the raw snake_case API parameter
 * name as its `<label>`, in every language. Since the `<label>` is what a screen
 * reader announces for the control, that was an accessibility defect and not
 * only a cosmetic one.
 *
 * These tests pin the localized label to the input's OWN constructor, which is
 * the layer a consumer who writes `new ApiOptions( 'it' )` — with no
 * meta-component anywhere — actually reaches. 2.7.0 fixed only `LocaleInput`,
 * and only through `Theme.js`'s theming pass, which that consumer never runs.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import Messages from '../Messages.js';
import Input from '../ApiOptions/Input/Input.js';
import AscensionInput from '../ApiOptions/Input/AscensionInput.js';
import CorpusChristiInput from '../ApiOptions/Input/CorpusChristiInput.js';
import EpiphanyInput from '../ApiOptions/Input/EpiphanyInput.js';
import EternalHighPriestInput from '../ApiOptions/Input/EternalHighPriestInput.js';
import HolydaysOfObligationInput from '../ApiOptions/Input/HolydaysOfObligationInput.js';
import YearTypeInput from '../ApiOptions/Input/YearTypeInput.js';
import YearInput from '../ApiOptions/Input/YearInput.js';
import DayInput from '../ApiOptions/Input/DayInput.js';
import MonthInput from '../ApiOptions/Input/MonthInput.js';
import ApiOptions from '../ApiOptions/ApiOptions.js';
import ApiBase from '../ApiClient/ApiBase.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';
import { applyLocaleInputTheme } from '../MetaComponents/Theme.js';

/** Every input that requires a locale, with the Messages key it must use. */
const LOCALE_REQUIRED = [
    ['AscensionInput', AscensionInput, 'ASCENSION'],
    ['CorpusChristiInput', CorpusChristiInput, 'CORPUS_CHRISTI'],
    ['EpiphanyInput', EpiphanyInput, 'EPIPHANY'],
    ['EternalHighPriestInput', EternalHighPriestInput, 'ETERNAL_HIGH_PRIEST'],
    ['YearTypeInput', YearTypeInput, 'YEAR_TYPE'],
    ['MonthInput', MonthInput, 'MONTH'],
];

/** Every input whose locale is optional, with its Messages key. */
const LOCALE_OPTIONAL = [
    ['YearInput', YearInput, 'YEAR'],
    ['DayInput', DayInput, 'DAY'],
];

beforeEach(() => {
    Input.reset();
});

describe('localized input labels', () => {
    it.each(LOCALE_REQUIRED)(
        '%s renders the English label for en',
        (_name, Klass, key) => {
            const input = new Klass(new Intl.Locale('en'));
            expect(input._labelElement.textContent).toBe(Messages['en'][key]);
        },
    );

    it.each(LOCALE_REQUIRED)(
        '%s renders the Italian label for it',
        (_name, Klass, key) => {
            const input = new Klass(new Intl.Locale('it-IT'));
            expect(input._labelElement.textContent).toBe(Messages['it'][key]);
        },
    );

    it.each(LOCALE_OPTIONAL)(
        '%s renders the English label when constructed with no locale',
        (_name, Klass, key) => {
            const input = new Klass();
            expect(input._labelElement.textContent).toBe(Messages['en'][key]);
        },
    );

    it.each(LOCALE_OPTIONAL)(
        '%s renders the Italian label when given a locale',
        (_name, Klass, key) => {
            const input = new Klass(new Intl.Locale('it-IT'));
            expect(input._labelElement.textContent).toBe(Messages['it'][key]);
        },
    );

    it.each(LOCALE_OPTIONAL)(
        '%s rejects a non-Intl.Locale locale',
        (name, Klass) => {
            expect(() => new Klass('it-IT')).toThrow(name);
        },
    );

    it('HolydaysOfObligationInput renders the English label with no locale', () => {
        const input = new HolydaysOfObligationInput();
        expect(input._labelElement.textContent).toBe(
            Messages['en']['HOLYDAYS_OF_OBLIGATION'],
        );
    });

    it('HolydaysOfObligationInput renders the Italian label when given a locale', () => {
        const input = new HolydaysOfObligationInput(
            [],
            new Intl.Locale('it-IT'),
        );
        expect(input._labelElement.textContent).toBe(
            Messages['it']['HOLYDAYS_OF_OBLIGATION'],
        );
    });

    it('HolydaysOfObligationInput rejects a non-Intl.Locale locale', () => {
        expect(() => new HolydaysOfObligationInput([], 'it-IT')).toThrow(
            'HolydaysOfObligationInput',
        );
    });

    it('no input ships its raw API parameter name as a label', () => {
        const raw = [
            'ascension',
            'corpus_christi',
            'epiphany',
            'eternal_high_priest',
            'year_type',
            'month',
            'year',
            'day',
            'holydays_of_obligation',
        ];
        const labels = [
            ...LOCALE_REQUIRED.map(
                ([, Klass]) =>
                    new Klass(new Intl.Locale('it-IT'))._labelElement
                        .textContent,
            ),
            ...LOCALE_OPTIONAL.map(
                ([, Klass]) =>
                    new Klass(new Intl.Locale('it-IT'))._labelElement
                        .textContent,
            ),
            new HolydaysOfObligationInput([], new Intl.Locale('it-IT'))
                ._labelElement.textContent,
        ];
        labels.forEach((label) => expect(raw).not.toContain(label));
    });
});

describe('a caller-supplied label still wins', () => {
    beforeEach(() => {
        ApiBase.reset();
        Input.reset();
        ApiBase.fromMetadata('http://localhost:8000', FULL_METADATA);
    });

    it('ApiOptions localizes every one of its inputs with no theming at all', () => {
        const apiOptions = new ApiOptions('it');
        expect(apiOptions._localeInput._labelElement.textContent).toBe(
            Messages['it']['LANGUAGE'],
        );
        expect(apiOptions._yearTypeInput._labelElement.textContent).toBe(
            Messages['it']['YEAR_TYPE'],
        );
        expect(apiOptions._yearInput._labelElement.textContent).toBe(
            Messages['it']['YEAR'],
        );
        expect(apiOptions._epiphanyInput._labelElement.textContent).toBe(
            Messages['it']['EPIPHANY'],
        );
        expect(apiOptions._ascensionInput._labelElement.textContent).toBe(
            Messages['it']['ASCENSION'],
        );
        expect(apiOptions._corpusChristiInput._labelElement.textContent).toBe(
            Messages['it']['CORPUS_CHRISTI'],
        );
        expect(
            apiOptions._eternalHighPriestInput._labelElement.textContent,
        ).toBe(Messages['it']['ETERNAL_HIGH_PRIEST']);
        expect(
            apiOptions._holydaysOfObligationInput._labelElement.textContent,
        ).toBe(Messages['it']['HOLYDAYS_OF_OBLIGATION']);
    });

    it('a theme-supplied labelText overrides the constructor default', () => {
        const apiOptions = new ApiOptions('it');
        applyLocaleInputTheme(
            apiOptions._localeInput,
            { labelText: 'Idioma' },
            Messages['it']['LANGUAGE'],
        );
        expect(apiOptions._localeInput._labelElement.textContent).toBe(
            'Idioma',
        );
    });
});
