import { describe, it, expect, beforeEach } from '@jest/globals';
import ApiBase from '../ApiClient/ApiBase.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import { Rite, CalendarSelectFilter } from '../Enums.js';

/**
 * Reproduces the real rite partition. `lugano_ch` is Ambrosian and its nation
 * `CH` has NO Roman national calendar — the crash case. `milano_it` is also
 * Ambrosian but its nation `IT` DOES have a Roman national calendar, so before
 * rite filtering it was silently grouped under Italy as though it were Roman.
 * `romamo_it` is the Roman control.
 *
 * Local rather than the shared `FULL_METADATA`: the crash case needs a diocese
 * whose nation has no national calendar at all, which the shared fixture — a
 * self-consistent index — deliberately does not contain.
 */
const METADATA = {
    national_calendars: [
        { calendar_id: 'IT', locales: [ 'it-IT' ] },
        { calendar_id: 'VA', locales: [ 'la', 'it-IT' ] }
    ],
    diocesan_calendars: [
        { calendar_id: 'romamo_it',   nation: 'IT', diocese: 'Diocesi di Roma',    rite: 'roman' },
        { calendar_id: 'milano_it', nation: 'IT', diocese: 'Diocesi di Milano',  rite: 'ambrosian' },
        { calendar_id: 'lugano_ch', nation: 'CH', diocese: 'Diocesi di Lugano',  rite: 'ambrosian' }
    ],
    ambrosian_calendars: [ { calendar_id: 'ambrosian' } ]
};

global.document = {
    createElement: () => ( {} )
};

const API_URL = 'http://localhost:8000';

beforeEach( () => {
    ApiBase.reset();
    ApiBase.fromMetadata( API_URL, METADATA );
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
        expect( cs.diocesesInnerHtml ).toContain( 'value="romamo_it"' );
        expect( cs.nationsInnerHtml ).toContain( 'value="IT"' );
        expect( cs.diocesesInnerHtml ).toMatch( /<optgroup label="[^"]*">[^<]*<option[^>]*value="romamo_it"/ );
    } );
} );

describe( 'CalendarSelect rite filtering — Ambrosian', () => {

    it( 'includes only Ambrosian dioceses', () => {
        const cs = new CalendarSelect().rite( Rite.AMBROSIAN );
        expect( cs.diocesesInnerHtml ).toContain( 'value="lugano_ch"' );
        expect( cs.diocesesInnerHtml ).toContain( 'value="milano_it"' );
        expect( cs.diocesesInnerHtml ).not.toContain( 'value="romamo_it"' );
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

describe( 'CalendarSelect filter() duplicate guard', () => {

    /**
     * Pins the fix to the dead-code guard in `filter()`: it used to compare
     * `filter !== this.#filter` AFTER already assigning `this.#filter = filter`,
     * so the comparison was always false and `#filterSet` never became true.
     * That let `.filter()` be called any number of times with any values with
     * no error at all. Comparing BEFORE assigning is what makes a second,
     * different call actually throw.
     */
    it( 'throws when filter() is called a second time with a different value', () => {
        const cs = new CalendarSelect().filter( CalendarSelectFilter.NATIONAL_CALENDARS );
        expect( () => cs.filter( CalendarSelectFilter.DIOCESAN_CALENDARS ) ).toThrow( /Filter has already been set/ );
    } );

    it( 'does not throw when filter() is called again with the SAME value', () => {
        const cs = new CalendarSelect().filter( CalendarSelectFilter.NATIONAL_CALENDARS );
        expect( () => cs.filter( CalendarSelectFilter.NATIONAL_CALENDARS ) ).not.toThrow();
    } );
} );
