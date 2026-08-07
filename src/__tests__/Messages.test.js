import { describe, it, expect } from '@jest/globals';
import Messages from '../Messages.js';
import { Rite, RiteProperties } from '../Enums.js';

const REQUIRED = [ 'RITE_ROMAN', 'RITE_AMBROSIAN', 'SELECT_A_RITE', 'GENERAL_ROMAN_CALENDAR', 'AMBROSIAN_CALENDAR' ];

describe( 'rite message keys', () => {

    it( 'defines every required key in English, which is the fallback for all other locales', () => {
        REQUIRED.forEach( key => {
            expect( Messages[ 'en' ] ).toHaveProperty( key );
            expect( Messages[ 'en' ][ key ].length ).toBeGreaterThan( 0 );
        } );
    } );

    it( 'defines every required key in Italian', () => {
        REQUIRED.forEach( key => {
            expect( Messages[ 'it' ] ).toHaveProperty( key );
            expect( Messages[ 'it' ][ key ].length ).toBeGreaterThan( 0 );
        } );
    } );

    it( 'has an English message for every emptyOptionLabelKey the Rite map names', () => {
        Object.values( Rite ).forEach( rite => {
            expect( Messages[ 'en' ] ).toHaveProperty( RiteProperties[ rite ].emptyOptionLabelKey );
        } );
    } );
} );
