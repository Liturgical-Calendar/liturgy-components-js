export default class LitCalApiClient {
  /**
   * @type {string}
   * @private
   * @static
   */
  static #apiUrl = 'https://litcal.johnromanodorazio.com/api/dev';

  /**
   * @type {Object}
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
   * @type {Object | null}
   * @private
   * @static
   */
  static #metadata = null;

  #calendarData = {};

  #headers = {
    'Content-Type': 'application/json'
  };
  #params = {};

  static init( url = null ) {
    if ( url ) {
      this.#apiUrl = url;
    }
    return LitCalApiClient.fetchCalendars();
  }

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

  constructor() {

  }

  fetchCalendar( year = null ) {
    return fetch( `${LitCalApiClient.#apiUrl}${LitCalApiClient.#paths.calendar}${year ? `/${year}` : ''}` ).then( response => {
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

  fetchNationalCalendar( calendar_id, year = null ) {
    return fetch( `${LitCalApiClient.#apiUrl}${LitCalApiClient.#paths.calendar}/nation/${calendar_id}${year ? `/${year}` : ''}` ).then( response => {
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

  fetchDiocesanCalendar( calendar_id, year = null ) {
    return fetch( `${LitCalApiClient.#apiUrl}${LitCalApiClient.#paths.calendar}/diocese/${calendar_id}${year ? `/${year}` : ''}` ).then( response => {
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

  static get _metadata() {
    return LitCalApiClient.#metadata;
  }

  get _calendarData() {
    return this.#calendarData;
  }
}
