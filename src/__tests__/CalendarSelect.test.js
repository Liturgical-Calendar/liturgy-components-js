import { describe, it, expect, beforeAll, jest } from '@jest/globals';
import ApiClient from '../ApiClient/ApiClient.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import { Rite } from '../Enums.js';

/**
 * Reproduces the real rite partition. `lugano_ch` is Ambrosian and its nation
 * `CH` has NO Roman national calendar — the crash case. `milano_it` is also
 * Ambrosian but its nation `IT` DOES have a Roman national calendar, so before
 * rite filtering it was silently grouped under Italy as though it were Roman.
 * `roma_it` is the Roman control.
 */
const METADATA = {
    national_calendars: [
        { calendar_id: 'IT', locales: [ 'it-IT' ] },
        { calendar_id: 'VA', locales: [ 'la', 'it-IT' ] }
    ],
    diocesan_calendars: [
        { calendar_id: 'roma_it',   nation: 'IT', diocese: 'Diocesi di Roma',    rite: 'roman' },
        { calendar_id: 'milano_it', nation: 'IT', diocese: 'Diocesi di Milano',  rite: 'ambrosian' },
        { calendar_id: 'lugano_ch', nation: 'CH', diocese: 'Diocesi di Lugano',  rite: 'ambrosian' }
    ],
    ambrosian_calendars: [ { calendar_id: 'ambrosian' } ]
};

global.document = {
    createElement: () => ( {} )
};

beforeAll( async () => {
    global.fetch = jest.fn().mockResolvedValue( {
        ok: true,
        json: () => Promise.resolve( { litcal_metadata: METADATA } )
    } );
    await ApiClient.init();
} );

describe( 'CalendarSelect rite filtering — Roman (default)', () => {

    it( 'does not crash on an Ambrosian diocese whose nation has no Roman national calendar', () => {
        expect( () => new CalendarSelect() ).not.toThrow();
    } );

    it( 'excludes Ambrosian dioceses entirely', () => {
        const cs = new CalendarSelect();
        expect( cs.diocesesInnerHtml ).not.toContain( 'value="lugano_ch"' );
        expect( cs.diocesesInnerHtml ).not.toContain( 'value="milano_it"' );
    } );

    it( 'never fabricates a CH nation', () => {
        const cs = new CalendarSelect();
        expect( cs.nationsInnerHtml ).not.toContain( 'value="CH"' );
    } );

    it( 'keeps Roman dioceses grouped under their nation', () => {
        const cs = new CalendarSelect();
        expect( cs.diocesesInnerHtml ).toContain( 'value="roma_it"' );
        expect( cs.nationsInnerHtml ).toContain( 'value="IT"' );
        expect( cs.diocesesInnerHtml ).toMatch( /<optgroup label="[^"]*">[^<]*<option[^>]*value="roma_it"/ );
    } );
} );

describe( 'CalendarSelect rite filtering — Ambrosian', () => {

    it( 'includes only Ambrosian dioceses', () => {
        const cs = new CalendarSelect().rite( Rite.AMBROSIAN );
        expect( cs.diocesesInnerHtml ).toContain( 'value="lugano_ch"' );
        expect( cs.diocesesInnerHtml ).toContain( 'value="milano_it"' );
        expect( cs.diocesesInnerHtml ).not.toContain( 'value="roma_it"' );
    } );

    it( 'produces no nation options at all', () => {
        const cs = new CalendarSelect().rite( Rite.AMBROSIAN );
        expect( cs.nationsInnerHtml ).not.toContain( 'value="IT"' );
        expect( cs.nationsInnerHtml ).not.toContain( 'value="CH"' );
        expect( cs.nationsInnerHtml ).not.toContain( 'value="VA"' );
    } );

    it( 'lists dioceses flat, with no nation optgroup', () => {
        const cs = new CalendarSelect().rite( Rite.AMBROSIAN );
        expect( cs.diocesesInnerHtml ).not.toContain( '<optgroup' );
    } );
} );

describe( 'CalendarSelect rite isolation and rebuild hygiene', () => {

    /**
     * What actually prevents cross-build leaks is that `#buildAllOptions()`
     * resets its derived arrays (`#nationalCalendarsWithDioceses`,
     * `#nationOptions`, `#dioceseOptions`, `#dioceseOptionsGrouped`) at the
     * top of every rebuild. Within one synchronous build, `static` and
     * instance storage for `#nationalCalendarsWithDioceses` are NOT
     * separately observable here — a same-instance rebuild re-enters
     * `#buildAllOptions()` on the same object either way, so this test
     * cannot (and is not meant to) tell static and instance storage apart.
     * It pins the reset instead: delete those four reset lines and calling
     * `_applyRite()` a second time on the same rite re-derives on top of
     * the previous build's arrays instead of starting clean, duplicating
     * every option.
     */
    it( 'does not duplicate nation options when the same instance is rebuilt for the same rite', () => {
        const cs     = new CalendarSelect();
        const before = cs.nationsInnerHtml;

        cs._applyRite( Rite.ROMAN );

        expect( cs.nationsInnerHtml ).toBe( before );
    } );

    /**
     * NON-DISCRIMINATING BY CONSTRUCTION, kept as documentation only.
     *
     * `#nationalCalendarsWithDioceses` was moved from `static` to instance
     * state, and this test reads like the check on that move — but it cannot
     * fail either way. The per-build reset above already prevents the leak, so
     * reverting the field to `static` leaves this green (verified). Its name
     * says so out loud rather than leaving a future reader to trust a test that
     * has no failing mode.
     */
    it( 'keeps an existing Roman select unaffected by constructing an Ambrosian instance afterward (non-discriminating: passes with static storage too — the per-build reset, pinned above, is what protects)', () => {
        const roman  = new CalendarSelect();
        const before = roman.nationsInnerHtml;

        new CalendarSelect().rite( Rite.AMBROSIAN );

        expect( roman.nationsInnerHtml ).toBe( before );
    } );
} );

describe( 'CalendarSelect rite validation', () => {

    it( 'throws on an unknown rite', () => {
        expect( () => new CalendarSelect().rite( 'byzantine' ) ).toThrow( /Invalid rite/ );
    } );
} );
