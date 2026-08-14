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
    // Exactly what `GET /calendars` returns for this entry — `calendar_id`,
    // `locales` and `rite`, and nothing else. Verified against the dev API.
    //
    // It previously carried a `missals: []` and a `settings` block with the four
    // temporal options the Ambrosian Missal fixes. **The API serves neither.** A
    // fixture that is AHEAD of the API is the worst direction for one to be wrong
    // in: a test asserting that a rite's settings reach the option inputs would
    // have passed against this while production did nothing at all, because there
    // is no `settings` to read. See issue #70, and
    // Liturgical-Calendar/LiturgicalCalendarAPI#776 for publishing them.
    //
    // Nothing in the library reads more than `calendar_id` and `locales` from a
    // rite calendar — `ApiOptions.#applyRiteToLocaleInput()` is the only consumer
    // — so the removed keys were never exercised, only believed.
    ambrosian_calendars: [
        {
            calendar_id: 'ambrosian',
            rite: 'ambrosian',
            locales: ['it', 'la'],
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
