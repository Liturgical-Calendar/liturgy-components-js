/**
 * @enum {{BY_MONTH: 'BY_MONTH', BY_LITURGICAL_SEASON: 'BY_LITURGICAL_SEASON'}}
 */
const Grouping = Object.freeze({
    BY_MONTH: 'BY_MONTH',
    BY_LITURGICAL_SEASON: 'BY_LITURGICAL_SEASON'
});

/**
 * @enum {{GRADE_FIRST: 'GRADE_FIRST', EVENT_DETAILS_FIRST: 'EVENT_DETAILS_FIRST'}}
 */
const ColumnOrder = Object.freeze({
    GRADE_FIRST: 'GRADE_FIRST',
    EVENT_DETAILS_FIRST: 'EVENT_DETAILS_FIRST'
});

/**
 * @enum {{LITURGICAL_SEASON: 1, MONTH: 2, DATE: 4, EVENT_DETAILS: 8, GRADE: 16, PSALTER_WEEK: 32, ALL: 63, NONE: 0}}
 */
const Column = Object.freeze({
    LITURGICAL_SEASON: 1 << 0, // 1
    MONTH:             1 << 1, // 2
    DATE:              1 << 2, // 4
    EVENT_DETAILS:     1 << 3, // 8
    GRADE:             1 << 4, // 16
    PSALTER_WEEK:      1 << 5, // 32
    ALL:               (1 | 2 | 4 | 8 | 16 | 32), // 63
    NONE:              0
});

/**
 * @enum {{BACKGROUND: 'BACKGROUND', CSS_CLASS: 'CSS_CLASS', INDICATOR: 'INDICATOR', NONE: 'NONE'}}
 */
const ColorAs = Object.freeze({
    BACKGROUND: "BACKGROUND",
    CSS_CLASS: "CSS_CLASS",
    INDICATOR: "INDICATOR",
    NONE: "NONE"
});

/**
 * @enum {{FULL: 'full', LONG: 'long', MEDIUM: 'medium', SHORT: 'short', DAY_ONLY: 'day-only'}}
 */
const DateFormat = Object.freeze({
    FULL: 'full',
    LONG: 'long',
    MEDIUM: 'medium',
    SHORT: 'short',
    DAY_ONLY: 'day-only'
});

/**
 * @enum {{FULL: 'full', ABBREVIATED: 'abbreviated'}}
 */
const GradeDisplay = Object.freeze({
    FULL: 'full',
    ABBREVIATED: 'abbreviated'
});

/**
 * @enum {{GENERAL_ROMAN: 'basePath', ALL_CALENDARS: 'allPaths', BASE_PATH: 'basePath', ALL_PATHS: 'allPaths', PATH_BUILDER: 'pathBuilder', LOCALE_ONLY: 'localeOnly', YEAR_ONLY: 'yearOnly', NONE: null}}
 */
const ApiOptionsFilter = Object.freeze({
    GENERAL_ROMAN: 'basePath',
    ALL_CALENDARS: 'allPaths',
    PATH_BUILDER: 'pathBuilder',
    LOCALE_ONLY: 'localeOnly',
    YEAR_ONLY: 'yearOnly',
    BASE_PATH: 'basePath',
    ALL_PATHS: 'allPaths',
    NONE: null
});

/**
 * @enum {{NATIONAL_CALENDARS: 'nations', DIOCESAN_CALENDARS: 'dioceses', NONE: 'none'}}
 */
const CalendarSelectFilter = Object.freeze({
    NATIONAL_CALENDARS: 'nations',
    DIOCESAN_CALENDARS: 'dioceses',
    NONE: 'none'
});

/**
 * @enum {{LITURGICAL: 'LITURGICAL', CIVIL: 'CIVIL'}}
 */
const YearType = Object.freeze({
    LITURGICAL: 'LITURGICAL',
    CIVIL: 'CIVIL'
});

const monthsLatin = Object.freeze([
    '', // Placeholder for 0 index
    'Ianuarius', 'Februarius', 'Martius', 'Aprilis', 'Maius', 'Iunius',
    'Iulius', 'Augustus', 'September', 'October', 'November', 'December'
]);

const daysLatin = Object.freeze({
    'ecclesiastical': [
        'Dominica',    // Sunday
        'Feria II',    // Monday
        'Feria III',   // Tuesday
        'Feria IV',    // Wednesday
        'Feria V',     // Thursday
        'Feria VI',    // Friday
        'Sabbato'      // Saturday
    ],
    'civil': [
        'Dies Solis',    // Sunday
        'Dies Lunæ',     // Monday
        'Dies Martis',   // Tuesday
        'Dies Mercurii', // Wednesday
        'Dies Iovis',    // Thursday
        'Dies Veneris',  // Friday
        'Dies Saturni'   // Saturday
    ]
});

/**
 * @enum {{
 *   ECCLESIASTICAL: {month: function(number): string, dayOfTheWeek: function(number): string},
 *   CIVIL: {month: function(number): string, dayOfTheWeek: function(number): string}
 * }}
 */
const LatinInterface = Object.freeze({
    ECCLESIASTICAL: {
        month: function(month) {
            return monthsLatin[month] || '';
        },
        dayOfTheWeek: function(day) {
            return daysLatin.ecclesiastical[day] || '';
        }
    },
    CIVIL: {
        month: function(month) {
            return monthsLatin[month] || '';
        },
        dayOfTheWeek: function(day) {
            return daysLatin.civil[day] || '';
        }
    }
});

export { Grouping, ColumnOrder, Column, ColorAs, DateFormat, GradeDisplay, ApiOptionsFilter, CalendarSelectFilter, YearType, LatinInterface };
