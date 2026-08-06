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

describe( 'CalendarSelect rite isolation between instances', () => {

    it( 'does not let an Ambrosian instance leak nations into a Roman one', () => {
        const roman  = new CalendarSelect();
        const before = roman.nationsInnerHtml;

        new CalendarSelect().rite( Rite.AMBROSIAN );

        const after = new CalendarSelect().nationsInnerHtml;
        expect( after ).toBe( before );
    } );
} );

describe( 'CalendarSelect rite validation', () => {

    it( 'throws on an unknown rite', () => {
        expect( () => new CalendarSelect().rite( 'byzantine' ) ).toThrow( /Invalid rite/ );
    } );
} );
