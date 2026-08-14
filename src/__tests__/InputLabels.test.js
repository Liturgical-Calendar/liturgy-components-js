import { describe, it, expect } from '@jest/globals';
import { defaultLabelText } from '../ApiOptions/Input/InputLabels.js';
import Messages from '../Messages.js';

describe('defaultLabelText', () => {
    it('returns the English message when no locale is supplied', () => {
        expect(defaultLabelText('YEAR_TYPE')).toBe('Year Type');
        expect(defaultLabelText('YEAR_TYPE', null)).toBe('Year Type');
    });

    it('returns the message for the locale language', () => {
        expect(defaultLabelText('YEAR_TYPE', new Intl.Locale('it-IT'))).toBe(
            Messages['it']['YEAR_TYPE'],
        );
    });

    it('falls back to English for a language with no block at all', () => {
        // `zz` is not one of the 84 blocks: the optional chain must not throw.
        expect(defaultLabelText('YEAR_TYPE', new Intl.Locale('zz'))).toBe(
            'Year Type',
        );
    });

    it('falls back to English for a block that lacks the key', () => {
        // `zh` is a real block, but carries none of the twelve-locale keys.
        expect(Messages['zh']['YEAR_TYPE']).toBeUndefined();
        expect(defaultLabelText('YEAR_TYPE', new Intl.Locale('zh'))).toBe(
            'Year Type',
        );
    });

    it('reads a key present in every block from that block', () => {
        expect(defaultLabelText('MONTH', new Intl.Locale('zh'))).toBe(
            Messages['zh']['MONTH'],
        );
    });
});
