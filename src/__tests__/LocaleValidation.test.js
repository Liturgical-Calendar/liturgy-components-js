/**
 * Direct tests for the shared locale helper.
 *
 * `canonicalizeLocale` and `toIntlLocale` are shared contract across six
 * components, in the same way `assertPlainOptions` and `resolveBase` are, so
 * they are tested here on their own terms rather than only through their call
 * sites.
 */
import { describe, it, expect } from '@jest/globals';
import { canonicalizeLocale, toIntlLocale } from '../LocaleValidation.js';

describe( 'canonicalizeLocale', () => {

    it( 'returns an already-canonical tag unchanged', () => {
        expect( canonicalizeLocale( 'en', 'Test' ) ).toBe( 'en' );
        expect( canonicalizeLocale( 'it-IT', 'Test' ) ).toBe( 'it-IT' );
        expect( canonicalizeLocale( 'sr-Latn-RS', 'Test' ) ).toBe( 'sr-Latn-RS' );
    } );

    /**
     * The reason the underscore replacement must precede canonicalisation rather
     * than follow it: `Intl.getCanonicalLocales( 'it_IT' )` throws outright, so a
     * helper that canonicalised first would reject the form this library has
     * always accepted.
     */
    it( 'normalizes underscores to hyphens before canonicalizing', () => {
        expect( canonicalizeLocale( 'it_IT', 'Test' ) ).toBe( 'it-IT' );
        expect( canonicalizeLocale( 'en_US', 'Test' ) ).toBe( 'en-US' );
        expect( () => Intl.getCanonicalLocales( 'it_IT' ) ).toThrow( RangeError );
    } );

    it( 'canonicalizes case', () => {
        expect( canonicalizeLocale( 'EN-us', 'Test' ) ).toBe( 'en-US' );
        expect( canonicalizeLocale( 'sr-latn-rs', 'Test' ) ).toBe( 'sr-Latn-RS' );
    } );

    it( 'canonicalizes deprecated subtags the way Intl does', () => {
        expect( canonicalizeLocale( 'iw', 'Test' ) ).toBe( 'he' );
        expect( canonicalizeLocale( 'in', 'Test' ) ).toBe( 'id' );
    } );

    it( 'preserves Unicode extension sequences', () => {
        expect( canonicalizeLocale( 'en-US-u-ca-gregory', 'Test' ) ).toBe( 'en-US-u-ca-gregory' );
    } );

    describe( 'rejection', () => {

        /**
         * The whole point of the wrap: `Intl`'s own `RangeError` reads
         * `Incorrect locale information provided` and names neither the tag nor
         * the component that rejected it.
         */
        it( 'names both the component and the offending tag', () => {
            expect( () => canonicalizeLocale( 'not a locale', 'CalendarSelect' ) )
                .toThrow( 'CalendarSelect: Invalid locale: not a locale' );
        } );

        /**
         * `it__IT` normalizes to `it--IT`, which is what `Intl` actually rejects, so
         * a message naming `it--IT` proves the throw reports the string validated
         * rather than the raw argument. `ApiOptions` has reported it this way from
         * the start and the shared helper keeps that choice for all six.
         */
        it( 'names the normalized tag, not the raw argument', () => {
            expect( () => canonicalizeLocale( 'it__IT', 'ApiOptions' ) )
                .toThrow( 'ApiOptions: Invalid locale: it--IT' );
        } );

        /**
         * `Intl.getCanonicalLocales( '' )` throws on its own, so the guard is not
         * there to detect anything — it is there for the message. Left to `Intl`
         * the throw reads `Test: Invalid locale: ` and names nothing after the
         * colon, which tells a caller who passed `''` nothing at all. Blank tags
         * go the same way: an input trimmed to nothing is the same mistake.
         */
        it.each( [
            [ 'an empty string', '' ],
            [ 'a whitespace-only string', '   ' ],
            [ 'a tab and newline', '\t\n' ]
        ] )( 'rejects %s with a message of its own', ( _label, value ) => {
            expect( () => canonicalizeLocale( value, 'Test' ) )
                .toThrow( 'Test: Invalid locale, cannot be an empty or blank string' );
        } );

        /**
         * An invalid locale must NEVER be quietly replaced with English. Silently
         * defaulting is the failure mode issue #31 removed; reinstating it for a
         * different input would undo that.
         */
        it( 'throws rather than falling back to English', () => {
            expect( () => canonicalizeLocale( 'this is not a locale', 'Test' ) ).toThrow();
        } );

    } );

    describe( 'type rejection', () => {

        it.each( [
            [ 'a number', 123, 'number' ],
            [ 'null', null, 'null' ],
            [ 'undefined', undefined, 'undefined' ],
            [ 'an array', [ 'en' ], 'array' ],
            [ 'a plain object', {}, 'Object' ]
        ] )( 'rejects %s, naming the component and the type found', ( _label, value, typeName ) => {
            expect( () => canonicalizeLocale( value, 'RiteSelect' ) )
                .toThrow( `RiteSelect: Invalid type for locale, must be of type \`string\` but found type: ${typeName}` );
        } );

        /**
         * The realistic slip, given that `LocaleInput` DOES take an `Intl.Locale`.
         * Whether the components should accept one as a locale argument is issue
         * #32; until it is answered they do not, and the message says so usefully.
         */
        it( 'names an Intl.Locale by its constructor rather than `object`', () => {
            expect( () => canonicalizeLocale( new Intl.Locale( 'it' ), 'ApiOptions' ) )
                .toThrow( 'ApiOptions: Invalid type for locale, must be of type `string` but found type: Locale' );
        } );

    } );

} );

describe( 'toIntlLocale', () => {

    it( 'returns an Intl.Locale', () => {
        expect( toIntlLocale( 'it-IT', 'Test' ) ).toBeInstanceOf( Intl.Locale );
    } );

    it( 'normalizes and canonicalizes exactly as canonicalizeLocale does', () => {
        expect( toIntlLocale( 'it_IT', 'Test' ).baseName ).toBe( 'it-IT' );
        expect( toIntlLocale( 'EN-us', 'Test' ).baseName ).toBe( 'en-US' );
        expect( toIntlLocale( 'it_IT', 'Test' ).language ).toBe( 'it' );
        expect( toIntlLocale( 'it_IT', 'Test' ).region ).toBe( 'IT' );
    } );

    /**
     * The equivalence the adapter rests on: parsing the canonical form yields the
     * same locale the raw tag would have, so the extra parse cannot throw and
     * cannot drift. Pinned rather than assumed, because the components that store
     * an `Intl.Locale` used to build it straight from the normalized tag.
     */
    it.each( [ 'en', 'it_IT', 'EN-us', 'sr-latn-rs', 'iw', 'en-US-u-ca-gregory' ] )(
        'agrees with `new Intl.Locale( normalized )` for %s',
        ( tag ) => {
            const normalized = tag.replaceAll( '_', '-' );
            expect( toIntlLocale( tag, 'Test' ).toString() ).toBe( new Intl.Locale( normalized ).toString() );
        }
    );

    it( 'propagates the rejection, naming the component', () => {
        expect( () => toIntlLocale( 'not a locale', 'LiturgyOfTheDay' ) )
            .toThrow( 'LiturgyOfTheDay: Invalid locale: not a locale' );
        expect( () => toIntlLocale( 123, 'LiturgyOfAnyDay' ) )
            .toThrow( /^LiturgyOfAnyDay: Invalid type for locale/ );
    } );

} );
