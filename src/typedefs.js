/**
 * @typedef {Object} CalendarEvent
 * @prop {string} event_key - The "key" or "tag" or "id" of the liturgical event
 * @prop {int} event_idx - The progressive index, one for each liturgical event
 * @prop {string} name - The name of the liturgical event according to the requested locale
 * @prop {Date|string} date - The date of the liturgical event
 * @prop {int} month - The month of the liturgical event
 * @prop {string} month_long - The month of the liturgical event in the requested locale
 * @prop {string} month_short - The month of the liturgical event in the requested locale
 * @prop {int} day - The day of the liturgical event
 * @prop {string} day_of_the_week_iso8601 - The day of the liturgical event according to the ISO 8601 standard
 * @prop {string} day_of_the_week_long - The day of the liturgical event in the requested locale
 * @prop {string} day_of_the_week_short - The day of the liturgical event in the requested locale
 * @prop {int} grade - The liturgical grade of the liturgical event
 * @prop {string[]} common - An array of the liturgical commons of the liturgical event
 * @prop {string} common_lcl - The liturgical commons of the liturgical event in the requested locale
 * @prop {string[]} color - An array of the liturgical colors of the liturgical event
 * @prop {string[]} color_lcl - The liturgical colors of the liturgical event in the requested locale
 * @prop {string} grade_lcl - The liturgical grade of the liturgical event in the requested locale
 * @prop {string | null} grade_display - The liturgical grade of the liturgical event as it should be displayed
 * @prop {string} grade_abbr - The abbreviated form of the liturgical grade
 * @prop {string} liturgical_season - The liturgical season of the liturgical event
 * @prop {string} liturgical_season_lcl - The liturgical season of the liturgical event in the requested locale
 * @prop {string} [liturgical_year] - The liturgical cycle (festive A, B, or C; or weekday I or II) of the liturgical event
 * @prop {string} [is_vigil_for] - The liturgical event for which the current event is a Vigil Mass
 * @prop {boolean} [is_vigil_mass] - Will have a boolean value of 'true' if the event is a Vigil Mass for a Solemnity or Sunday
 * @prop {boolean} [has_vesper_i] - Will have a boolean value of 'true' if the expected First Vespers are confirmed
 * @prop {boolean} [has_vesper_ii] - Will have a boolean value of 'true' if the expected Second Vespers are confirmed
 * @prop {boolean} [has_vigil_mass] - Will have a boolean value of 'true' if the expected Vigil Mass is confirmed
 * @prop {string} [psalter_week] - The psalter week in which the liturgical event falls
 * @prop {boolean} [holy_day_of_obligation] - Will have a boolean value of 'true' if the liturgical event is observed as a holy day of obligation
 * @prop {['mobile', 'fixed']} type - The type of the liturgical event
 */


/**
 * @typedef {Object} CalendarSettings
 * @prop {number} year - The year for which the calendar is calculated
 * @prop {['JAN6', 'SUNDAY_JAN2_JAN8']} epiphany - When Epiphany is celebrated
 * @prop {['THURSDAY', 'SUNDAY"]} ascension - When the Ascension is celebrated
 * @prop {['THURSDAY', 'SUNDAY']} corpus_christi - When Corpus Christi is celebrated
 * @prop {string} locale - The locale for the calendar
 * @prop {['JSON', 'XML', 'YML', 'ICS']} return_type - The type of the response data
 * @prop {['LITURGICAL', 'CIVIL']} year_type - The type of the year whether it is liturgical or civil
 * @prop {boolean} eternal_high_priest - Whether the feast of the Eternal High Priest is celebrated
 * @prop {object} [holydays_of_obligation] - An object where the keys are the event_keys of the liturgical events and the values are booleans indicating whether the liturgical event is observed as a holy day of obligation or not
 * @prop {string} [national_calendar] - The national calendar used for the calculation
 * @prop {string} [diocesan_calendar] - The diocesan calendar used for the calculation
 */

/**
 * @typedef {Object} CalendarMetadata
 * @prop {string} version - The version of the API
 * @prop {int} timestamp - The timestamp for when the API response was generated / cached
 * @prop {string} date_time - The ISO-8601 formatted date and time for when the API response was generated / cached
 * @prop {{Accept: string, 'Accept-Language': string}} request_headers - The headers received in the request
 * @prop {{event_key: string, date: string, timezone_type: number, timezone: string}[]} solemnities - An array of solemnities keys and dates in the current calendar calculation
 * @prop {string[]} solemnities_keys - An array of solemnities keys in the current calendar calculation
 * @prop {{event_key: string, date: string, timezone_type: number, timezone: string}[]} feasts - An array of feasts keys and dates in the current calendar calculation
 * @prop {string[]} feasts_keys - An array of feasts keys in the current calendar calculation
 * @prop {{event_key: string, date: string, timezone_type: number, timezone: string}[]} memorials - An array of memorials keys and dates in the current calendar calculation
 * @prop {string[]} memorials_keys - An array of memorials keys in the current calendar calculation
 * @prop {{event_key: string, date: string, timezone_type: number, timezone: string}[]} suppressed_events - An array of liturgical events with their keys and dates that were suppressed in the current calendar calculation
 * @prop {string[]} suppressed_events_keys - An array of liturgical events keys that were suppressed in the current calendar calculation
 * @prop {{event_key: string, date: string, timezone_type: number, timezone: string}[]} reinstated_events - An array of liturgical events with their keys and dates that are having been suppressed were reinstated for whatever reason in the current calendar calculation (usually because of a transferral defined in a national calendar)
 * @prop {string[]} reinstated_events_keys - An array of liturgical events keys that are having been suppressed were reinstated for whatever reason in the current calendar calculation (usually because of a transferral defined in a national calendar)
 * @prop {string} [diocese_name] - The name of the diocese for which the calendar was calculated
 */

/**
 * @typedef {Object} Counter
 * @prop {number} cm - The count of the liturgical events within the same month
 * @prop {number} cs - The count of the liturgical events within the same season
 * @prop {number} cw - The count of the liturgical events within the same week
 * @prop {number} cd - The count of the liturgical events within the same day
 */

export default {};
