/**
 * The rule `ApiOptions.#applyTemporalInputState()` applies, stated once in
 * `PredeterminedInputs.js` and read by both halves of it: the `disabled()` calls
 * and the payload `CalendarControls.selection` publishes.
 *
 * The agreement with `FilterInputs.js` is asserted rather than shared by import:
 * the two answer different questions ("what does GENERAL_ROMAN render" versus
 * "what does a calendar predetermine") and are the same five keys today. Should
 * a filter ever gain a sixth input, this fails and a human decides which list it
 * belongs to, rather than one list silently acquiring the other's member.
 */
import { describe, it, expect } from '@jest/globals';
import {
    predeterminedInputKeys,
    PREDETERMINABLE_INPUTS,
} from '../ApiOptions/PredeterminedInputs.js';
import { inputKeysForFilter } from '../ApiOptions/FilterInputs.js';
import { ApiOptionsFilter } from '../Enums.js';

describe('predeterminedInputKeys', () => {
    it('names nothing for the rite-level calendar of a rite that fixes nothing', () => {
        expect(
            predeterminedInputKeys({
                calendarSelected: false,
                riteFixesTemporalOptions: false,
            }),
        ).toEqual([]);
    });

    it('names all five when a nation or diocese is selected', () => {
        expect(
            predeterminedInputKeys({
                calendarSelected: true,
                riteFixesTemporalOptions: false,
            }),
        ).toEqual([
            'epiphanyInput',
            'ascensionInput',
            'corpusChristiInput',
            'eternalHighPriestInput',
            'holydaysOfObligationInput',
        ]);
    });

    it('names the four temporal inputs alone for a rite that fixes them', () => {
        // The Ambrosian rite-level calendar: the Missal fixes Epiphany,
        // Ascension and Corpus Domini and does not establish the Eternal High
        // Priest, but holy days of obligation stay the user's to choose.
        expect(
            predeterminedInputKeys({
                calendarSelected: false,
                riteFixesTemporalOptions: true,
            }),
        ).toEqual([
            'epiphanyInput',
            'ascensionInput',
            'corpusChristiInput',
            'eternalHighPriestInput',
        ]);
    });

    it('names all five when both halves hold', () => {
        expect(
            predeterminedInputKeys({
                calendarSelected: true,
                riteFixesTemporalOptions: true,
            }),
        ).toHaveLength(5);
    });

    it('returns a frozen array, so a consumer cannot mutate the reported state', () => {
        const keys = predeterminedInputKeys({
            calendarSelected: true,
            riteFixesTemporalOptions: false,
        });
        expect(Object.isFrozen(keys)).toBe(true);
    });

    it('covers exactly the inputs ApiOptionsFilter.GENERAL_ROMAN renders, in order', () => {
        expect(PREDETERMINABLE_INPUTS).toEqual(
            inputKeysForFilter(ApiOptionsFilter.GENERAL_ROMAN),
        );
    });
});
