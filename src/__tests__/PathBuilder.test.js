import { describe, it, expect, beforeEach } from '@jest/globals';
import { CurrentEndpoint, CalendarType } from '../PathBuilder/PathBuilder.js';
import { Rite } from '../Enums.js';

beforeEach( () => {
    CurrentEndpoint.rite         = Rite.ROMAN;
    CurrentEndpoint.explicitRite = false;
    CurrentEndpoint.calendarType = null;
    CurrentEndpoint.calendarId   = null;
    CurrentEndpoint.calendarYear = null;
} );

describe( 'CurrentEndpoint path composition', () => {

    it( 'omits the rite segment for Roman when not explicit', () => {
        expect( CurrentEndpoint.path ).toBe( '/calendar' );

        CurrentEndpoint.calendarType = CalendarType.NATIONAL;
        CurrentEndpoint.calendarId   = 'IT';
        expect( CurrentEndpoint.path ).toBe( '/calendar/nation/IT' );

        CurrentEndpoint.calendarType = CalendarType.DIOCESAN;
        CurrentEndpoint.calendarId   = 'roma_it';
        expect( CurrentEndpoint.path ).toBe( '/calendar/diocese/roma_it' );
    } );

    it( 'emits the explicit roman segment when explicitRite is set', () => {
        CurrentEndpoint.explicitRite = true;
        expect( CurrentEndpoint.path ).toBe( '/calendar/roman' );

        CurrentEndpoint.calendarType = CalendarType.NATIONAL;
        CurrentEndpoint.calendarId   = 'IT';
        expect( CurrentEndpoint.path ).toBe( '/calendar/roman/nation/IT' );
    } );

    it( 'always emits the ambrosian segment', () => {
        CurrentEndpoint.rite         = Rite.AMBROSIAN;
        CurrentEndpoint.explicitRite = true;
        expect( CurrentEndpoint.path ).toBe( '/calendar/ambrosian' );

        CurrentEndpoint.calendarType = CalendarType.DIOCESAN;
        CurrentEndpoint.calendarId   = 'lugano_ch';
        expect( CurrentEndpoint.path ).toBe( '/calendar/ambrosian/diocese/lugano_ch' );

        CurrentEndpoint.calendarYear = 2026;
        expect( CurrentEndpoint.path ).toBe( '/calendar/ambrosian/diocese/lugano_ch/2026' );
    } );

    it( 'places the year after the calendar id for Roman too', () => {
        CurrentEndpoint.calendarType = CalendarType.NATIONAL;
        CurrentEndpoint.calendarId   = 'IT';
        CurrentEndpoint.calendarYear = 2026;
        expect( CurrentEndpoint.path ).toBe( '/calendar/nation/IT/2026' );
    } );
} );
