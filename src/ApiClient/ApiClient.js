import ApiOptions from '../ApiOptions/ApiOptions.js';
import CalendarSelect from '../CalendarSelect/CalendarSelect.js';
import EventEmitter from './EventEmitter.js';
import { YearType } from '../Enums.js';

/**
 * A client for interacting with the Liturgical Calendar API.
 * This class provides methods to fetch and manage liturgical calendar data,
 * including the General Roman Calendar, National Calendars, and Diocesan Calendars.
 *
 * @class
 * @description The ApiClient handles all API interactions for retrieving liturgical calendar data.
 * It supports fetching calendar metadata, managing calendar settings, and retrieving specific calendar types
 * (General Roman, National, or Diocesan). The class maintains internal state for calendar data and request parameters,
 * and provides methods to listen to UI component changes.
 *
 * @example
 * const client = new ApiClient();
 * // Initialize with default API URL
 * await ApiClient.init();
 * // Fetch General Roman Calendar
 * const calendarData = await client.fetchCalendar();
 *
 * @example
 * // Fetch a National Calendar
 * const client = new ApiClient();
 * const nationalCalendarData = client.fetchNationalCalendar('IT').then( data => {
 *   // Handle the response data
 * });
 */
export default class ApiClient {
  /**
   * @type {string}
   * @private
   * @static
   * @default 'https://litcal.johnromanodorazio.com/api/dev'
   */
  static #apiUrl = 'https://litcal.johnromanodorazio.com/api/dev';

  /**
   * @type {{calendars: '/calendars', calendar: '/calendar', events: '/events', easter: '/easter', decrees: '/decrees', data: '/data', missals: '/missals', tests: '/tests', schemas: '/schemas'}}
   * @private
   * @constant
   */
  static #paths = Object.freeze({
    calendars: '/calendars',
    calendar: '/calendar',
    events: '/events',
    easter: '/easter',
    decrees: '/decrees',
    data: '/data',
    missals: '/missals',
    tests: '/tests',
    schemas: '/schemas'
  });

  /**
   * @type {import('../typedefs.js').CalendarMetadata | null}
   * @private
   * @static
   * Response object from the API /calendars path
   */
  static #metadata = null;

  /**
   * @type {{litcal: import('../typedefs.js').CalendarEvent[], settings: import('../typedefs.js').CalendarSettings, metadata: import('../typedefs.js').CalendarMetadata, messages: string[]}}
   * @private
   * @static
   */
  #calendarData = {};

  /**
   * @type {{'Content-Type': 'application/json', Accept: 'application/json', ['Accept-Language']: string}}
   */
  #fetchCalendarHeaders = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };

  /**
   * Parameters for the API request sent as a JSON object representing key - value pairs, in the body of the request
   * @type {{year: number, epiphany: string, ascension: string, corpus_christi: string, year_type: string, eternal_high_priest: boolean, holydays_of_obligation: {[key: string]: boolean}}}
   */
  #params = {
    year: new Date().getFullYear(),
    epiphany: 'JAN6',
    ascension: 'THURSDAY',
    corpus_christi: 'THURSDAY',
    eternal_high_priest: false,
    holydays_of_obligation: {
      "Christmas": true,
      "Epiphany": true,
      "Ascension": true,
      "CorpusChristi": true,
      "MaryMotherOfGod": true,
      "ImmaculateConception": true,
      "Assumption": true,
      "StJoseph": true,
      "StsPeterPaulAp": true,
      "AllSaints": true
    },
    year_type: YearType.LITURGICAL
  };

  /**
   * An empty value for category means the General Roman Calendar.
   * A value of 'national' means a national calendar, based on a Roman Missal as published in the given country / nation.
   * A value of 'diocesan' means a diocesan calendar, which is based on the national calendar,
   *  with the addition of a few local celebrations.
   * @type {'' | 'national' | 'diocesan'}
   * @private
   */
  #currentCategory = '';

  /**
   * The current calendar ID, which is used to fetch the corresponding calendar data.
   * @type {string}
   * @private
   */
  #currentCalendarId = '';

  /**
   * The event bus that can be used to subscribe to events emitted by the ApiClient.
   * @type {EventEmitter}
   * @private
   */
  #eventBus = null;

  /**
   * Initializes the ApiClient with an optional API URL.
   * If a URL is provided, it sets the internal API URL to the given value.
   * Then, it fetches the available liturgical calendars from the API.
   *
   * @param {string|null} url - Optional API URL to override the default URL.
   * @returns {Promise<ApiClient|boolean>} A promise that resolves to an `ApiClient` instance when the calendar metadata has been fetched, or `false` if an error occurs.
   * @static
   */
  static init( url = null ) {
    if ( url ) {
      this.#apiUrl = url;
    }
    return ApiClient.#fetchCalendars();
  }

  /**
   * Fetches metadata about available liturgical calendars from the API.
   *
   * This method sends a GET request to the API endpoint for calendars metadata when the `#metadata` property is null, and processes the response.
   * If the request is successful, it extracts the `litcal_metadata` from the response data
   * and assigns it to the `#metadata` property of the `ApiClient` class.
   * If the `#metadata` property is not null, it returns a resolved promise with the `ApiClient` instance.
   * This way, if the static init method is called more than once, initialization is only performed once, and only one fetch request is made to the API.
   *
   * @returns {Promise<ApiClient|boolean>} A promise that resolves to an `ApiClient` instance if the request is successful, or `false` if an error occurs.
   */
  static #fetchCalendars() {
    if ( null === this.#metadata ) {
      return fetch( `${this.#apiUrl}${this.#paths.calendars}` ).then(response => {
        if ( response.ok ) {
          return response.json();
        }
      }).then(data => {
        const { litcal_metadata } = data;
        ApiClient.#metadata = litcal_metadata;
        return new ApiClient();
      }).catch(error => {
        console.error( error );
        return false;
      });
    } else {
      return Promise.resolve(new ApiClient());
    }
  }

  /**
   * Instantiates a new instance of the ApiClient class.
   *
   * The constructor does not perform any specific actions, but it provides
   * access to instance methods and private properties of the class.
   * This allows the client to interact with the Liturgical Calendar API,
   * possibly listening to changes in the UI components.
   */
  constructor() {
    this.#eventBus = new EventEmitter();
  }

  /**
   * Refetches calendar data based on the current category and calendar ID.
   *
   * This method determines the current category of the calendar (national, diocesan, or general)
   * and fetches the corresponding calendar data. It logs the fetched calendar type and the
   * calendar data to the console once the data is retrieved.
   *
   * If the current category is 'national', it fetches the national calendar using the current
   * calendar ID. If the category is 'diocesan', it fetches the diocesan calendar. For any other
   * category, it fetches the General Roman Calendar.
   */
  refetchCalendarData() {
    if ( this.#currentCategory === 'national' ) {
      this.fetchNationalCalendar( this.#currentCalendarId );
    } else if ( this.#currentCategory === 'diocesan' ) {
      this.fetchDiocesanCalendar( this.#currentCalendarId );
    } else {
      this.fetchCalendar();
    }
  }

  /**
   * Fetches the General Roman Calendar data from the API for a given year.
   *
   * @param {string|null} locale The locale for the General Roman Calendar. If null, the default or last set locale is used.
   *
   * This method sends a POST request to the calendar endpoint with the configured parameters.
   * The year parameter is extracted from the request body and placed in the URL path.
   * The remaining parameters are sent in the request body as JSON.
   *
   */
  fetchCalendar(locale = null) {
    // Since the year parameter will be placed in the path, we extract it from the body params.
    const { year, ...params } = this.#params;
    if (locale !== null) {
      if (typeof locale !== 'string') {
        throw new Error('ApiClient.fetchCalendar: locale must be a string');
      }
      if (locale === '') {
        throw new Error('ApiClient.fetchCalendar: Invalid locale identifier, cannot be an empty string');
      }
      locale = locale.replace(/_/g, '-');
      try {
        const testLocale = new Intl.Locale(locale);
        if (ApiClient.#metadata.locales.includes(testLocale.language)) {
          this.#fetchCalendarHeaders['Accept-Language'] = locale;
        };
      } catch (e) {
        console.error(e);
      }
    }
    fetch(`${ApiClient.#apiUrl}${ApiClient.#paths.calendar}${year ? `/${year}` : ''}`, {
      method: 'POST',
      headers: this.#fetchCalendarHeaders,
      body: JSON.stringify( params )
    }).then( response => {
      if ( response.ok ) {
        return response.json();
      }
    }).then( data => {
      this.#calendarData = data;
      this.#eventBus.emit( 'calendarFetched', data );
      return this.#calendarData;
    }).catch( error => {
      console.error( error );
      return false;
    });
  }

  /**
   * Fetches a national liturgical calendar from the API
   * @param {string} calendar_id - The identifier for the national calendar to fetch
   * @param {string} [locale] - The locale for the national calendar
   * @throws {Error} When network request fails
   * @description This method fetches a national liturgical calendar by its ID, and optionally a supported locale. It extracts the year from params
   * to use in the URL path and sends other relevant parameters in the request body. Parameters that determine the dates for
   * epiphany, ascension, corpus_christi, eternal_high_priest are excluded from the request parameters,
   * as these options are built into the National calendar being requested.
   */
  fetchNationalCalendar( calendar_id, locale = '' ) {
    // Since the year parameter will be placed in the path, we extract it from the body params.
    // However, the only body param we need in this case is year_type,
    // so we also extract out all other params in order to discard them.
    const { year, epiphany, ascension, corpus_christi, eternal_high_priest, holydays_of_obligation, ...params } = this.#params;
    this.#currentCategory = 'national';
    this.#currentCalendarId = calendar_id;
    if (
      typeof locale === 'string'
      && locale !== ''
    ) {
      const phpLocale = locale.replace(/-/g, '_');
      const jsLocale = phpLocale.replace(/_/g, '-');
      const nationalCalendarMetadata = ApiClient.#metadata.national_calendars.filter(
        calendar => calendar.calendar_id === calendar_id
      )[0];
      if ( nationalCalendarMetadata.locales.includes(phpLocale) ) {
        this.#fetchCalendarHeaders['Accept-Language'] = jsLocale;
      }
    }
    fetch(`${ApiClient.#apiUrl}${ApiClient.#paths.calendar}/nation/${calendar_id}${year ? `/${year}` : ''}`, {
      method: 'POST',
      headers: this.#fetchCalendarHeaders,
      body: JSON.stringify( params )
    }).then( response => {
      if ( response.ok ) {
        return response.json();
      }
    }).then( data => {
      this.#calendarData = data;
      this.#eventBus.emit( 'calendarFetched', data );
      return this.#calendarData;
    }).catch( error => {
      console.error( error );
      return false;
    });
  }

  /**
   * Fetches a diocesan liturgical calendar from the API
   * @param {string} calendar_id - The identifier for the diocesan calendar to fetch
   * @throws {Error} When network request fails
   * @description This method fetches a diocesan liturgical calendar by its ID. It extracts the year from params
   * to use in the URL path and sends other relevant parameters in the request body. Parameters that determine the dates for
   * epiphany, ascension, corpus_christi, eternal_high_priest are excluded from the request parameters,
   * as these options are built into the Diocesan calendar being requested.
   */
  fetchDiocesanCalendar( calendar_id ) {
    // Since the year parameter will be placed in the path, we extract it from the body params.
    // However, the only body param we need in this case is year_type,
    // so we also extract out all other params in order to discard them.
    const { year, epiphany, ascension, corpus_christi, eternal_high_priest, holydays_of_obligation, ...params } = this.#params;
    this.#currentCategory = 'diocesan';
    this.#currentCalendarId = calendar_id;
    fetch(`${ApiClient.#apiUrl}${ApiClient.#paths.calendar}/diocese/${calendar_id}${year ? `/${year}` : ''}`, {
      method: 'POST',
      headers: this.#fetchCalendarHeaders,
      body: JSON.stringify( params )
    }).then( response => {
      if ( response.ok ) {
        return response.json();
      }
    }).then( data => {
      this.#calendarData = data;
      this.#eventBus.emit( 'calendarFetched', data );
      return this.#calendarData;
    }).catch( error => {
      console.error( error );
      return false;
    });
  }

  listenTo( uiComponent = null ) {
    if ( false === uiComponent instanceof CalendarSelect && false === uiComponent instanceof ApiOptions ) {
      throw new Error( 'ApiClient.listenTo(): Expected an instance of CalendarSelect or ApiOptions' );
    }
    if (uiComponent instanceof CalendarSelect) {
      return this.#listenToCalendarSelect( uiComponent );
    } else if (uiComponent instanceof ApiOptions) {
      return this.#listenToApiOptions( uiComponent );
    }
  }

  /**
   * Listens to changes in the CalendarSelect instance and fetches the corresponding calendar from the API.
   * @param {CalendarSelect} calendarSelect - The CalendarSelect instance to listen to
   * @throws {Error} If the provided argument is not an instance of CalendarSelect
   * @returns {ApiClient} The current instance
   */
  #listenToCalendarSelect( calendarSelect = null ) {
    if ( false === calendarSelect instanceof CalendarSelect ) {
      throw new Error( 'Expected an instance of CalendarSelect' );
    }
    if ( null === calendarSelect ) {
      throw new Error( 'Expected an instance of CalendarSelect' );
    }
    calendarSelect._domElement.addEventListener( 'change', () => {
      const selectedOption = calendarSelect._domElement.selectedOptions[0];
      this.#currentCalendarId = selectedOption.value;
      this.#currentCategory = selectedOption.dataset.calendartype ?? '';
      if ( this.#currentCategory === 'national' ) {
        this.fetchNationalCalendar( this.#currentCalendarId );
      } else if ( this.#currentCategory === 'diocesan' ) {
        this.fetchDiocesanCalendar( this.#currentCalendarId );
      } else {
        this.fetchCalendar();
      }
    });
    return this;
  }

  /**
   * Listens to changes in the API options and updates the parameters accordingly.
   *
   * This function attaches event listeners to various inputs within the ApiOptions instance.
   * When the user changes the value of these inputs, the corresponding parameter in the
   * request configuration is updated. If the current category is not set, it triggers
   * a refetch of the calendar data.
   *
   * @param {ApiOptions} apiOptions - The ApiOptions instance containing inputs to listen to
   * @throws {Error} If the provided argument is not an instance of ApiOptions
   * @returns {ApiClient} The current instance
   */
  #listenToApiOptions(apiOptions = null) {
    if (false === apiOptions instanceof ApiOptions) {
      throw new Error('Expected an instance of ApiOptions');
    }
    if (null === apiOptions) {
      throw new Error('Expected an instance of ApiOptions');
    }
    apiOptions._epiphanyInput._domElement.addEventListener( 'change', event => {
      this.#params.epiphany = event.target.value;
      console.log(`updated epiphany to ${this.#params.epiphany}`);
      if (this.#currentCategory === '') {
        this.refetchCalendarData();
      }
    });
    apiOptions._ascensionInput._domElement.addEventListener( 'change', event => {
      this.#params.ascension = event.target.value;
      console.log(`updated ascension to ${this.#params.ascension}`);
      if (this.#currentCategory === '') {
        this.refetchCalendarData();
      }
    });
    apiOptions._corpusChristiInput._domElement.addEventListener( 'change', event => {
      this.#params.corpus_christi = event.target.value;
      console.log(`updated corpus_christi to ${this.#params.corpus_christi}`);
      if (this.#currentCategory === '') {
        this.refetchCalendarData();
      }
    });
    apiOptions._eternalHighPriestInput._domElement.addEventListener( 'change', event => {
      this.#params.eternal_high_priest = event.target.value === 'true';
      console.log(`updated eternal_high_priest to ${this.#params.eternal_high_priest}`);
      if (this.#currentCategory === '') {
        this.refetchCalendarData();
      }
    });
    apiOptions._holydaysOfObligationInput._domElement.addEventListener( 'change', event => {
      const selectedStates = Object.fromEntries(
        Array.from(event.target.options, opt => [opt.value, opt.selected])
      );
      this.#params.holydays_of_obligation = selectedStates;
      console.log(`updated holydays_of_obligation to ${this.#params.holydays_of_obligation}`);
      if (this.#currentCategory === '') {
        this.refetchCalendarData();
      }
    });
    apiOptions._yearInput._domElement.addEventListener( 'change', event => {
      this.#params.year = event.target.value;
      console.log(`updated year to ${this.#params.year}`);
      this.refetchCalendarData();
    });
    apiOptions._yearTypeInput._domElement.addEventListener( 'change', event => {
      this.#params.year_type = event.target.value;
      console.log(`updated year_type to ${this.#params.year_type}`);
      this.refetchCalendarData();
    });
    apiOptions._localeInput._domElement.addEventListener( 'change', event => {
      this.#fetchCalendarHeaders['Accept-Language'] = event.target.value;
      console.log(`updated locale to ${this.#fetchCalendarHeaders['Accept-Language']}`);
      this.refetchCalendarData();
    });
    return this;
  }

  /**
   * Set the year for which the calendar is to be retrieved.
   * @param {number} year - The year for which to retrieve the calendar. Must be a number and be between 1970 and 9999.
   * @throws {Error} If no year is given, or if the year is not a number, or if the year is not between 1970 and 9999.
   */
  setYear( year ) {
    if (year !== undefined) {
      if (typeof year !== 'number' || !Number.isInteger(year) || year < 1970 || year > 9999) {
        throw new Error('year must be a number and be between 1970 and 9999');
      }
      this.#params.year = year;
    } else {
      throw new Error('year parameter is required');
    }
    return this;
  }

  /**
   * Set the type of the year for which the calendar is to be retrieved.
   * @param {YearType} year_type - The type of the year for which to retrieve the calendar. Must be either LITURGICAL or CIVIL.
   * @throws {Error} If no year_type is given, or if the year_type is not either LITURGICAL or CIVIL.
   */
  setYearType( year_type ) {
    if (year_type !== undefined) {
      if (year_type !== YearType.LITURGICAL && year_type !== YearType.CIVIL) {
        throw new Error('year_type must be either LITURGICAL or CIVIL');
      }
      this.#params.year_type = year_type;
    }
    return this;
  }

  /**
   * This static getter provides access to the metadata object that contains information
   * about the available liturgical calendars, including national and diocesan calendars.
   * The metadata is initially fetched from the API during the client initialization.
   *
   * @returns {import('../typedefs.js').CalendarMetadata} An object containing the metadata of the liturgical calendars.
   */
  static get _metadata() {
    return ApiClient.#metadata;
  }

  /**
   * Static getter provides access to the internal API URL
   * used by the ApiClient to make requests to the liturgical calendar API.
   *
   * @returns {string} The API URL.
   */
  static get _apiUrl() {
    return ApiClient.#apiUrl;
  }

  /**
   * The metadata object that contains information about the available liturgical
   * calendars, including national and diocesan calendars.
   * The metadata is initially fetched from the API during static ApiClient initialization.
   *
   * @type {import('../typedefs.js').CalendarMetadata}
   */
  get _metadata() {
    return ApiClient.#metadata;
  }

  /**
   * The internal API URL used by the ApiClient to make requests to the liturgical calendar API.
   *
   * @returns {string} The API URL.
   */
  get _apiUrl() {
    return ApiClient.#apiUrl;
  }

  /**
   * @returns {import('../typedefs.js').CalendarData} The currently cached calendar data.
   * This property can be used to retrieve the current liturgical calendar data.
   * Note that the data is only available after `fetchCalendar()`, `fetchNationalCalendar()`,
   * or `fetchDiocesanCalendar()` has been called.
   */
  get _calendarData() {
    return this.#calendarData;
  }

  /**
   * The event bus that can be used to subscribe to events emitted by the ApiClient.
   *
   * The event bus emits events of type `calendarFetched` when a new calendar is fetched
   * from the API. The event detail is an object of type `CalendarData` containing the
   * liturgical events of the fetched calendar.
   * @type {EventEmitter}
   */
  get _eventBus() {
    return this.#eventBus;
  }
}
