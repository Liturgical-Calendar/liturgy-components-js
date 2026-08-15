/**
 * Shared `/calendars` fixtures for the test suite.
 *
 * Lives in `src/__fixtures__/` rather than `src/__tests__/` because Jest's default
 * `testMatch` collects every file under `__tests__` as a test suite, and a module
 * of fixtures contains no tests.
 */

/** A rite-aware (v6) index: announces `ambrosian_calendars`. */
export const FULL_METADATA = {
    national_calendars: [
        {
            calendar_id: 'IT',
            locales: ['it_IT'],
            missals: ['EDITIO_TYPICA_1970'],
            settings: {
                epiphany: 'JAN6',
                ascension: 'SUNDAY',
                corpus_christi: 'SUNDAY',
                eternal_high_priest: false,
            },
        },
        {
            calendar_id: 'US',
            locales: ['en_US'],
            missals: ['EDITIO_TYPICA_1970'],
            settings: {
                epiphany: 'SUNDAY_JAN2_JAN8',
                ascension: 'SUNDAY',
                corpus_christi: 'SUNDAY',
                eternal_high_priest: false,
            },
        },
        {
            calendar_id: 'VA',
            locales: ['la', 'it_IT'],
            missals: ['EDITIO_TYPICA_1970'],
            settings: {
                epiphany: 'JAN6',
                ascension: 'THURSDAY',
                corpus_christi: 'THURSDAY',
                eternal_high_priest: false,
            },
        },
    ],
    national_calendars_keys: ['IT', 'US', 'VA'],
    diocesan_calendars: [
        {
            calendar_id: 'romamo_it',
            nation: 'IT',
            diocese: 'Diocesi di Roma',
            locales: ['it_IT'],
            timezone: 'Europe/Rome',
            rite: 'roman',
        },
        {
            calendar_id: 'boston_us',
            nation: 'US',
            diocese: 'Archdiocese of Boston',
            locales: ['en_US'],
            timezone: 'America/New_York',
            rite: 'roman',
        },
        {
            calendar_id: 'milano_it',
            nation: 'IT',
            diocese: 'Arcidiocesi di Milano',
            locales: ['it_IT'],
            timezone: 'Europe/Rome',
            rite: 'ambrosian',
        },
    ],
    diocesan_calendars_keys: ['romamo_it', 'boston_us', 'milano_it'],
    diocesan_groups: [],
    wider_regions: [
        {
            name: 'Europe',
            locales: ['it_IT', 'la'],
            api_path: '/data/widerregion/Europe',
        },
    ],
    wider_regions_keys: ['Europe'],
    locales: ['en', 'it', 'la'],
    // Exactly what `GET /calendars` returns for this entry, verified against the
    // dev API on 2026-08-14 — including the `settings` block, which the API now
    // publishes (Liturgical-Calendar/LiturgicalCalendarAPI#776, shipped in PR 779).
    // There is still no `missals` key.
    //
    // This block has been wrong in BOTH directions, which is why it is worth a
    // comment. It once carried a hand-written `settings` the API did not serve, so
    // a test asserting that a rite's settings reach the option inputs passed while
    // production did nothing at all; `dab21b5` (PR #71) removed it. The API then
    // shipped one, leaving the fixture behind reality instead of ahead of it —
    // equally wrong, and the reason issue #70 could not be tested against the
    // shared fixture until this commit. Keep it byte-identical to what the live
    // response serves, and re-check it whenever the API's metadata changes.
    //
    // `ApiOptions.#applyRiteToLocaleInput()` reads `locales`;
    // `ApiOptions.#applyRiteToTemporalInputs()` reads `settings`. Nothing reads
    // `rite` off a rite calendar, but the API serves it, so it stays.
    ambrosian_calendars: [
        {
            calendar_id: 'ambrosian',
            rite: 'ambrosian',
            locales: ['it', 'la'],
            settings: {
                epiphany: 'JAN6',
                ascension: 'THURSDAY',
                corpus_christi: 'THURSDAY',
                eternal_high_priest: false,
                holydays_of_obligation: {
                    Christmas: true,
                    Circoncisione: true,
                    Epiphany: true,
                    Ascension: true,
                    Pentecost: true,
                    ImmaculateConception: true,
                    Assumption: true,
                    AllSaints: true,
                    StAmbrose: true,
                    DedicationDuomo: true,
                },
            },
        },
    ],
};

/**
 * The shape the live v5 API returns: no `ambrosian_calendars` key, and diocesan
 * entries carry no `rite` field. A missing `rite` means Roman.
 */
export const V5_METADATA = {
    national_calendars: [
        {
            calendar_id: 'IT',
            locales: ['it_IT'],
            missals: ['EDITIO_TYPICA_1970'],
            settings: {
                epiphany: 'JAN6',
                ascension: 'SUNDAY',
                corpus_christi: 'SUNDAY',
                eternal_high_priest: false,
            },
        },
        {
            calendar_id: 'US',
            locales: ['en_US'],
            missals: ['EDITIO_TYPICA_1970'],
            settings: {
                epiphany: 'SUNDAY_JAN2_JAN8',
                ascension: 'SUNDAY',
                corpus_christi: 'SUNDAY',
                eternal_high_priest: false,
            },
        },
        {
            calendar_id: 'VA',
            locales: ['la', 'it_IT'],
            missals: ['EDITIO_TYPICA_1970'],
            settings: {
                epiphany: 'JAN6',
                ascension: 'THURSDAY',
                corpus_christi: 'THURSDAY',
                eternal_high_priest: false,
            },
        },
    ],
    national_calendars_keys: ['IT', 'US', 'VA'],
    diocesan_calendars: [
        {
            calendar_id: 'romamo_it',
            nation: 'IT',
            diocese: 'Diocesi di Roma',
            locales: ['it_IT'],
            timezone: 'Europe/Rome',
        },
        {
            calendar_id: 'boston_us',
            nation: 'US',
            diocese: 'Archdiocese of Boston',
            locales: ['en_US'],
            timezone: 'America/New_York',
        },
    ],
    diocesan_calendars_keys: ['romamo_it', 'boston_us'],
    diocesan_groups: [],
    wider_regions: [],
    wider_regions_keys: [],
    locales: ['en', 'it', 'la'],
};

/** A second, deliberately different index, for asserting that two bases stay isolated. */
export const OTHER_METADATA = {
    national_calendars: [
        {
            calendar_id: 'NL',
            locales: ['nl_NL'],
            missals: ['EDITIO_TYPICA_1970'],
            settings: {
                epiphany: 'SUNDAY_JAN2_JAN8',
                ascension: 'SUNDAY',
                corpus_christi: 'SUNDAY',
                eternal_high_priest: false,
            },
        },
    ],
    national_calendars_keys: ['NL'],
    diocesan_calendars: [
        {
            calendar_id: 'haarlem_nl',
            nation: 'NL',
            diocese: 'Bisdom Haarlem-Amsterdam',
            locales: ['nl_NL'],
            timezone: 'Europe/Amsterdam',
            rite: 'roman',
        },
    ],
    diocesan_calendars_keys: ['haarlem_nl'],
    diocesan_groups: [],
    wider_regions: [],
    wider_regions_keys: [],
    locales: ['nl'],
};
