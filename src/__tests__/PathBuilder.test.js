import { describe, it, expect, beforeEach } from '@jest/globals';
import { CurrentEndpoint, CalendarType } from '../PathBuilder/PathBuilder.js';
import { Rite } from '../Enums.js';

/**
 * A fresh instance per test rather than a reset of module-level statics:
 * `CurrentEndpoint` is per-`ApiOptions` state, so construction is the reset.
 * @type {CurrentEndpoint}
 */
let endpoint;

beforeEach(() => {
    endpoint = new CurrentEndpoint();
});

describe('CurrentEndpoint path composition', () => {
    it('defaults to Roman with no explicit rite, calendar or year', () => {
        expect(endpoint.rite).toBe(Rite.ROMAN);
        expect(endpoint.explicitRite).toBe(false);
        expect(endpoint.calendarType).toBeNull();
        expect(endpoint.calendarId).toBeNull();
        expect(endpoint.calendarYear).toBeNull();
    });

    it('omits the rite segment for Roman when not explicit', () => {
        expect(endpoint.path).toBe('/calendar');

        endpoint.calendarType = CalendarType.NATIONAL;
        endpoint.calendarId = 'IT';
        expect(endpoint.path).toBe('/calendar/nation/IT');

        endpoint.calendarType = CalendarType.DIOCESAN;
        endpoint.calendarId = 'romamo_it';
        expect(endpoint.path).toBe('/calendar/diocese/romamo_it');
    });

    it('emits the explicit roman segment when explicitRite is set', () => {
        endpoint.explicitRite = true;
        expect(endpoint.path).toBe('/calendar/roman');

        endpoint.calendarType = CalendarType.NATIONAL;
        endpoint.calendarId = 'IT';
        expect(endpoint.path).toBe('/calendar/roman/nation/IT');
    });

    it('always emits the ambrosian segment', () => {
        // Deliberately NOT setting `explicitRite = true` here: a fresh instance
        // already leaves it `false`, and setting it would let this test pass
        // even if Ambrosian stopped emitting on rite alone — it would prove
        // only that `explicitRite` forces the segment, which the earlier test
        // already covers.
        endpoint.rite = Rite.AMBROSIAN;
        expect(endpoint.path).toBe('/calendar/ambrosian');

        endpoint.calendarType = CalendarType.DIOCESAN;
        endpoint.calendarId = 'lugano_ch';
        expect(endpoint.path).toBe('/calendar/ambrosian/diocese/lugano_ch');

        endpoint.calendarYear = 2026;
        expect(endpoint.path).toBe(
            '/calendar/ambrosian/diocese/lugano_ch/2026',
        );
    });

    it('places the year after the calendar id for Roman too', () => {
        endpoint.calendarType = CalendarType.NATIONAL;
        endpoint.calendarId = 'IT';
        endpoint.calendarYear = 2026;
        expect(endpoint.path).toBe('/calendar/nation/IT/2026');
    });

    it('keeps two endpoints fully independent of one another', () => {
        // The whole point of `CurrentEndpoint` being instance state: when these
        // were statics, mutating one embed's rite rewrote every other embed's
        // path on the page.
        const other = new CurrentEndpoint();

        endpoint.rite = Rite.AMBROSIAN;
        endpoint.explicitRite = true;
        endpoint.calendarType = CalendarType.DIOCESAN;
        endpoint.calendarId = 'lugano_ch';
        endpoint.calendarYear = 2026;

        expect(endpoint.path).toBe(
            '/calendar/ambrosian/diocese/lugano_ch/2026',
        );
        expect(other.path).toBe('/calendar');
    });
});

describe('CurrentEndpoint query parameter serialization', () => {
    it('returns the bare path when no parameters are set', () => {
        expect(endpoint.serialize()).toBe('/calendar');
    });

    it('appends non-null, non-empty parameters', () => {
        endpoint.requestPayload.locale = 'it';
        endpoint.requestPayload.return_type = 'JSON';
        expect(endpoint.serialize()).toBe(
            '/calendar?locale=it&return_type=JSON',
        );
    });

    it('percent-encodes reserved characters in parameter values', () => {
        // Not a hypothetical: `AcceptHeaderInput` in its `Accept` mode offers
        // MIME types (`application/json`, `text/calendar`, ...), and PathBuilder
        // writes the selected one straight into `return_type`. Left unencoded,
        // the `/` would read as another path segment rather than as part of the
        // value. The values in the test above are all encoding-invariant, so
        // this is the only case here that would fail if `encodeURIComponent`
        // were dropped from `serialize()`.
        endpoint.requestPayload.return_type = 'application/json';
        expect(endpoint.serialize()).toBe(
            '/calendar?return_type=application%2Fjson',
        );
    });

    it('skips parameters left null or set to the empty string', () => {
        endpoint.requestPayload.locale = '';
        endpoint.requestPayload.year_type = 'LITURGICAL';
        expect(endpoint.serialize()).toBe('/calendar?year_type=LITURGICAL');
    });

    it('gives each endpoint its own payload', () => {
        const other = new CurrentEndpoint();
        endpoint.requestPayload.locale = 'it';

        expect(endpoint.serialize()).toBe('/calendar?locale=it');
        expect(other.serialize()).toBe('/calendar');
    });
});
