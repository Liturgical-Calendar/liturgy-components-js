/** @jest-environment jsdom */
import { describe, it, expect, beforeAll, jest } from '@jest/globals';
import ApiClient from '../ApiClient/ApiClient.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import { Rite } from '../Enums.js';

/**
 * The shape the LIVE v5 API returns: diocesan entries carry NO `rite` field at
 * all. Only v6 (`/api/dev` at the time of writing) announces one.
 *
 * A consumer pinned to v5 who bumps this package gets this metadata, so strict
 * `obj.rite === this.#rite` filtering would drop every diocese and empty the
 * list with no error and no warning. A missing `rite` means Roman: the rite
 * partition is a v6 addition, and everything v5 ever served was Roman.
 *
 * Deliberately in its own test file: `CalendarSelect` caches metadata in a
 * static field, so a second fixture needs a fresh module registry, which Jest
 * gives per test file.
 */
const V5_METADATA = {
    national_calendars: [
        { calendar_id: 'IT', locales: [ 'it-IT' ] },
        { calendar_id: 'US', locales: [ 'en-US' ] },
        { calendar_id: 'VA', locales: [ 'la', 'it-IT' ] }
    ],
    diocesan_calendars: [
        { calendar_id: 'roma_it',   nation: 'IT', diocese: 'Diocesi di Roma' },
        { calendar_id: 'boston_us', nation: 'US', diocese: 'Archdiocese of Boston' }
    ]
};

beforeAll( async () => {
    global.fetch = jest.fn().mockResolvedValue( {
        ok: true,
        json: () => Promise.resolve( { litcal_metadata: V5_METADATA } )
    } );
    await ApiClient.init();
} );

describe( 'CalendarSelect against metadata with no rite field (live v5 API)', () => {

    it( 'offers every diocese under the Roman rite', () => {
        const cs = new CalendarSelect();
        expect( cs.diocesesInnerHtml ).toContain( 'value="roma_it"' );
        expect( cs.diocesesInnerHtml ).toContain( 'value="boston_us"' );
    } );

    it( 'still groups them under their nations', () => {
        const cs = new CalendarSelect();
        expect( cs.nationsInnerHtml ).toContain( 'value="IT"' );
        expect( cs.nationsInnerHtml ).toContain( 'value="US"' );
        expect( cs.diocesesInnerHtml ).toMatch( /<optgroup label="[^"]*">[^<]*<option[^>]*value="roma_it"/ );
    } );

    it( 'offers none of them under the Ambrosian rite', () => {
        const cs = new CalendarSelect().rite( Rite.AMBROSIAN );
        expect( cs.diocesesInnerHtml ).not.toContain( 'value="roma_it"' );
        expect( cs.diocesesInnerHtml ).not.toContain( 'value="boston_us"' );
    } );

    it( 'throws an explicit, labelled error — not a TypeError — for a rite-less diocese whose nation has no national calendar', () => {
        // `lugano_ch` has no `rite` field, matching the live v5 shape, so it is
        // filtered into the Roman rite by the `?? Rite.ROMAN` fallback. Its
        // nation `CH` is deliberately absent from `national_calendars`, which is
        // exactly the self-inconsistent-metadata case the dropped `undefined`
        // guard used to leave unguarded: `.find()` returns `undefined`, it gets
        // pushed, and `#addNationOption` dereferences `.calendar_id` on it,
        // throwing an unlabelled `TypeError` from deep inside `#buildAllOptions`.
        // The fix must throw its OWN labelled error, naming the nation, before
        // that dereference ever happens.
        V5_METADATA.diocesan_calendars.push( {
            calendar_id: 'lugano_ch',
            nation: 'CH',
            diocese: 'Diocesi di Lugano'
        } );

        let caught = null;
        try {
            new CalendarSelect();
        } catch ( e ) {
            caught = e;
        }

        expect( caught ).not.toBeNull();
        expect( caught ).not.toBeInstanceOf( TypeError );
        expect( caught.message ).toMatch( /CH/ );
        expect( caught.message ).toMatch( /inconsistent/i );
    } );
} );
