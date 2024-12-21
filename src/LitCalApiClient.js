import ApiOptions from './ApiOptions.js';
import CalendarSelect from './CalendarSelect.js';
import EventEmitter from './EventEmitter.js';

/**
 * A client for interacting with the Liturgical Calendar API.
 * This class provides methods to fetch and manage liturgical calendar data,
 * including the General Roman Calendar, National Calendars, and Diocesan Calendars.
 *
 * @class
 * @description The LitCalApiClient handles all API interactions for retrieving liturgical calendar data.
 * It supports fetching calendar metadata, managing calendar settings, and retrieving specific calendar types
 * (General Roman, National, or Diocesan). The class maintains internal state for calendar data and request parameters,
 * and provides methods to listen to UI component changes.
 *
 * @example
 * const client = new LitCalApiClient();
 * // Initialize with default API URL
 * await LitCalApiClient.init();
 * // Fetch General Roman Calendar
 * const calendarData = await client.fetchCalendar();
 *
 * @example
 * // Fetch a National Calendar
 * const client = new LitCalApiClient();
 * const nationalCalendarData = client.fetchNationalCalendar('IT').then( data => {
 *   // Handle the response data
 * });
 */
export default class LitCalApiClient {
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
   * @type {import('./typedefs.js').CalendarMetadata | null}
   * @private
   * @static
   * Response object from the API /calendars path
   */
  static #metadata = null;

  /**
   * @type {{litcal: import('./typedefs.js').CalendarEvent[], settings: import('./typedefs.js').CalendarSettings, metadata: import('./typedefs.js').CalendarMetadata, messages: string[]}}
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
   * @type {{year: number, epiphany: string, ascension: string, corpus_christi: string, year_type: string, eternal_high_priest: boolean}}
   */
  #params = {
    year: new Date().getFullYear(),
    epiphany: 'JAN6',
    ascension: 'THURSDAY',
    corpus_christi: 'THURSDAY',
    eternal_high_priest: false,
    year_type: 'LITURGICAL'
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

  #eventBus = null;

  /**
   * Initializes the LitCalApiClient with an optional API URL.
   * If a URL is provided, it sets the internal API URL to the given value.
   * Then, it fetches the available liturgical calendars from the API.
   *
   * @param {string|null} url - Optional API URL to override the default URL.
   * @returns {Promise} A promise that resolves when the calendar metadata has been fetched.
   * @static
   */
  static init( url = null ) {
    if ( url ) {
      this.#apiUrl = url;
    }
    return LitCalApiClient.fetchCalendars();
  }

  /**
   * Fetches metadata about available liturgical calendars from the API.
   *
   * This method sends a GET request to the API endpoint for calendars metadata and processes the response.
   * If the request is successful, it extracts the `litcal_metadata` from the response data and
   * assigns it to the `#metadata` property of the `LitCalApiClient` class.
   *
   * @returns {Promise<import('./typedefs.js').CalendarMetadata|boolean>} A promise that resolves to the metadata object if the request
   * is successful, or `false` if an error occurs.
   */
  static fetchCalendars() {
    return fetch( `${this.#apiUrl}${this.#paths.calendars}` ).then(response => {
      if ( response.ok ) {
        return response.json();
      }
    }).then(data => {
      const { litcal_metadata } = data;
      LitCalApiClient.#metadata = litcal_metadata;
      return this.#metadata;
    }).catch(error => {
      console.error( error );
      return false;
    });
  }

  /**
   * Instantiates a new instance of the LitCalApiClient class.
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
      this.fetchNationalCalendar( this.#currentCalendarId ).then(() => {
        console.log( 'Fetched national calendar' );
        console.log( this.#calendarData );
        this.#eventBus.emit( 'calendarFetched', this.#calendarData );
      });
    } else if ( this.#currentCategory === 'diocesan' ) {
      this.fetchDiocesanCalendar( this.#currentCalendarId ).then(() => {
        console.log( 'Fetched diocesan calendar' );
        console.log( this.#calendarData );
        this.#eventBus.emit( 'calendarFetched', this.#calendarData );
      });
    } else {
      this.fetchCalendar().then(() => {
        console.log( 'Fetched General Roman Calendar' );
        console.log( this.#calendarData );
        this.#eventBus.emit( 'calendarFetched', this.#calendarData );
      });
    }
  }

  /**
   * Fetches the General Roman Calendar data from the API for a given year.
   *
   * This method sends a POST request to the calendar endpoint with the configured parameters.
   * The year parameter is extracted from the request body and placed in the URL path.
   * The remaining parameters are sent in the request body as JSON.
   *
   * @returns {Promise<{
  *   litcal: import('./typedefs.js').CalendarEvent[],
  *   settings: import('./typedefs.js').CalendarSettings,
  *   metadata: import('./typedefs.js').CalendarMetadata,
  *   messages: string[]
  * }|boolean>} A promise that resolves to:
  * - The calendar data object containing liturgical events, settings, metadata and messages if successful
  * - false if an error occurs during the request
  */
 fetchCalendar() {
    // Since the year parameter will be placed in the path, we extract it from the body params.
    const { year, ...params } = this.#params;
    return fetch(`${LitCalApiClient.#apiUrl}${LitCalApiClient.#paths.calendar}${year ? `/${year}` : ''}`, {
      method: 'POST',
      headers: this.#fetchCalendarHeaders,
      body: JSON.stringify( params )
    }).then( response => {
      if ( response.ok ) {
        return response.json();
      }
    }).then( data => {
      this.#calendarData = data;
      return this.#calendarData;
    }).catch( error => {
      console.error( error );
      return false;
    });
  }

  /**
   * Fetches a national liturgical calendar from the API
   * @param {string} calendar_id - The identifier for the national calendar to fetch
   * @returns {Promise<{
   *   litcal: import('./typedefs.js').CalendarEvent[],
   *   settings: import('./typedefs.js').CalendarSettings,
   *   metadata: import('./typedefs.js').CalendarMetadata,
   *   messages: string[]
   * }|boolean>} A promise that resolves to:
   * - The calendar data object containing liturgical events, settings, metadata and messages if successful
   * - false if an error occurs during the request
   * @throws {Error} When network request fails
   * @description This method fetches a national liturgical calendar by its ID. It extracts the year from params
   * to use in the URL path and sends other relevant parameters in the request body. Parameters that determine the dates for
   * epiphany, ascension, corpus_christi, eternal_high_priest are excluded from the request parameters,
   * as these options are built into the National calendar being requested.
   */
  fetchNationalCalendar( calendar_id ) {
    // Since the year parameter will be placed in the path, we extract it from the body params.
    // However, the only body param we need in this case is year_type,
    // so we also extract out all other params in order to discard them.
    const { year, epiphany, ascension, corpus_christi, eternal_high_priest, ...params } = this.#params;
    return fetch(`${LitCalApiClient.#apiUrl}${LitCalApiClient.#paths.calendar}/nation/${calendar_id}${year ? `/${year}` : ''}`, {
      method: 'POST',
      headers: this.#fetchCalendarHeaders,
      body: JSON.stringify( params )
    }).then( response => {
      if ( response.ok ) {
        return response.json();
      }
    }).then( data => {
      this.#calendarData = data;
      return this.#calendarData;
    }).catch( error => {
      console.error( error );
      return false;
    });
  }

  /**
   * Fetches a diocesan liturgical calendar from the API
   * @param {string} calendar_id - The identifier for the diocesan calendar to fetch
   * @returns {Promise<{
   *   litcal: import('./typedefs.js').CalendarEvent[],
   *   settings: import('./typedefs.js').CalendarSettings,
   *   metadata: import('./typedefs.js').CalendarMetadata,
   *   messages: string[]
   * }|boolean>} A promise that resolves to:
   * - The calendar data object containing liturgical events, settings, metadata and messages if successful
   * - false if an error occurs during the request
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
    const { year, epiphany, ascension, corpus_christi, eternal_high_priest, ...params } = this.#params;
    return fetch(`${LitCalApiClient.#apiUrl}${LitCalApiClient.#paths.calendar}/diocese/${calendar_id}${year ? `/${year}` : ''}`, {
      method: 'POST',
      headers: this.#fetchCalendarHeaders,
      body: JSON.stringify( params )
    }).then( response => {
      if ( response.ok ) {
        return response.json();
      }
    }).then( data => {
      this.#calendarData = data;
      return this.#calendarData;
    }).catch( error => {
      console.error( error );
      return false;
    });
  }

  /**
   * Listens to changes in the CalendarSelect instance and fetches the corresponding calendar from the API.
   * @param {CalendarSelect} calendarSelect - The CalendarSelect instance to listen to
   */
  listenToCalendarSelect( calendarSelect = null ) {
    if ( false === calendarSelect instanceof CalendarSelect ) {
      throw new Error( 'Expected an instance of CalendarSelect' );
    }
    if ( null === calendarSelect ) {
      throw new Error( 'Expected an instance of CalendarSelect' );
    }
    calendarSelect._domElement.addEventListener( 'change', event => {
      const selectedOption = calendarSelect._domElement.selectedOptions[0];
      this.#currentCalendarId = selectedOption.value;
      this.#currentCategory = selectedOption.dataset.calendartype ?? '';
      if ( this.#currentCategory === 'national' ) {
        this.fetchNationalCalendar( this.#currentCalendarId ).then(() => {
          console.log( 'Fetched national calendar' );
          console.log( this.#calendarData );
          this.#eventBus.emit( 'calendarFetched', this.#calendarData );
        });
      } else if ( this.#currentCategory === 'diocesan' ) {
        this.fetchDiocesanCalendar( this.#currentCalendarId ).then(() => {
          console.log( 'Fetched diocesan calendar' );
          console.log( this.#calendarData );
          this.#eventBus.emit( 'calendarFetched', this.#calendarData );
        });
      } else {
        this.fetchCalendar().then(() => {
          console.log( 'Fetched General Roman Calendar' );
          console.log( this.#calendarData );
          this.#eventBus.emit( 'calendarFetched', this.#calendarData );
        });
      }
    });
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
   */
  listenToApiOptions(apiOptions = null) {
    if (false === apiOptions instanceof ApiOptions) {
      throw new Error('Expected an instance of ApiOptions');
    }
    if (null === apiOptions) {
      throw new Error('Expected an instance of ApiOptions');
    }
    apiOptions.epiphanyInput._domElement.addEventListener( 'change', event => {
      this.#params.epiphany = event.target.value;
      console.log(`updated epiphany to ${this.#params.epiphany}`);
      if (this.#currentCategory === '') {
        this.refetchCalendarData();
      }
    });
    apiOptions.ascensionInput._domElement.addEventListener( 'change', event => {
      this.#params.ascension = event.target.value;
      console.log(`updated ascension to ${this.#params.ascension}`);
      if (this.#currentCategory === '') {
        this.refetchCalendarData();
      }
    });
    apiOptions.corpusChristiInput._domElement.addEventListener( 'change', event => {
      this.#params.corpus_christi = event.target.value;
      console.log(`updated corpus_christi to ${this.#params.corpus_christi}`);
      if (this.#currentCategory === '') {
        this.refetchCalendarData();
      }
    });
    apiOptions.eternalHighPriestInput._domElement.addEventListener( 'change', event => {
      this.#params.eternal_high_priest = event.target.value === 'true';
      console.log(`updated eternal_high_priest to ${this.#params.eternal_high_priest}`);
      if (this.#currentCategory === '') {
        this.refetchCalendarData();
      }
    });
    apiOptions.yearInput._domElement.addEventListener( 'change', event => {
      this.#params.year = event.target.value;
      console.log(`updated year to ${this.#params.year}`);
      this.refetchCalendarData();
    });
    apiOptions.yearTypeInput._domElement.addEventListener( 'change', event => {
      this.#params.year_type = event.target.value;
      console.log(`updated year_type to ${this.#params.year_type}`);
      this.refetchCalendarData();
    });
    apiOptions.localeInput._domElement.addEventListener( 'change', event => {
      this.#fetchCalendarHeaders['Accept-Language'] = event.target.value;
      console.log(`updated locale to ${this.#fetchCalendarHeaders['Accept-Language']}`);
      this.refetchCalendarData();
    });
  }

  /**
   * This static getter provides access to the metadata object that contains information
   * about the available liturgical calendars, including national and diocesan calendars.
   * The metadata is initially fetched from the API during the client initialization.
   *
   * @returns {import('./typedefs.js').CalendarMetadata} An object containing the metadata of the liturgical calendars.
   */
  static get _metadata() {
    return LitCalApiClient.#metadata;
  }

  /**
   * @returns {import('./typedefs.js').CalendarData} The currently cached calendar data.
   * This property can be used to retrieve the current liturgical calendar data.
   * Note that the data is only available after `fetchCalendar()`, `fetchNationalCalendar()`,
   * or `fetchDiocesanCalendar()` has been called.
   */
  get _calendarData() {
    return this.#calendarData;
  }

  get _eventBus() {
    return this.#eventBus;
  }
}
