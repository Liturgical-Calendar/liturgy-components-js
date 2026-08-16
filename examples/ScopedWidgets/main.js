import { ApiClient, TodayViewer } from 'liturgy-components-js';

const API_URL = 'https://litcal.johnromanodorazio.com/api/dev';

/**
 * The two widgets this page mounts, each restricted by its own `scope`.
 *
 * `{ diocese: 'romamo_it' }` pins one calendar outright, so `TodayViewer` renders no
 * rite select, no calendar select and no locale input for it — there is never more
 * than one choice for any of the three. `{ nation: 'IT' }` restricts the space to
 * Italy without pinning a rite, so the rite select stays visible: Italy has an
 * Ambrosian diocese (Milan) even though Ambrosian has no national tier, so both
 * `roman` and `ambrosian` are genuinely reachable here. The calendar select never
 * appears, because each rite still resolves to exactly one calendar — but the
 * locale input is NOT similarly fixed: it is derived from the CURRENT calendar's
 * own `locales`, not from the calendar count, and the two rites' calendars carry
 * different locale lists. Switching to Ambrosian therefore makes the locale input
 * appear: the bare Ambrosian calendar (the rite-level stand-in, since Ambrosian has
 * no national tier) supports both `it` and `la`, while Italy's own national
 * calendar under Roman supports only `it`.
 *
 * @type {Array<{scope: Object, controls: string, liturgy: string}>}
 */
const WIDGETS = [
    {
        scope: { diocese: 'romamo_it' },
        controls: '#romeControls',
        liturgy: '#romeLiturgy',
    },
    {
        scope: { nation: 'IT' },
        controls: '#italyControls',
        liturgy: '#italyLiturgy',
    },
];

const apiClient = await ApiClient.init(API_URL).catch((error) => {
    // `textContent`, not `insertAdjacentHTML`: an API failure can carry a response
    // body into `error.message`, so this is a page, not a template.
    const warning = document.createElement('div');
    warning.className = 'alert alert-warning';
    warning.textContent = `Could not reach ${API_URL}: ${error.message}`;
    document.body.insertAdjacentElement('afterbegin', warning);
    return null;
});

if (null !== apiClient) {
    for (const widget of WIDGETS) {
        try {
            // Every control this viewer might render still needs a slot: a hidden
            // control still holds its value and still drives the fetch, which is
            // what makes the Diocese of Rome case work at all — its calendar
            // select is hidden, and is still what tells the client to fetch
            // `romamo_it`.
            await TodayViewer.mountInto(
                {
                    rite: widget.controls,
                    calendar: widget.controls,
                    locale: widget.controls,
                    liturgy: widget.liturgy,
                },
                {
                    locale: 'it',
                    apiClient,
                    scope: widget.scope,
                    theme: { preset: 'bootstrap5' },
                    onError: (error) => {
                        document.querySelector(widget.liturgy).textContent =
                            `Request failed: ${error.message}`;
                    },
                },
            );
        } catch (error) {
            // A rejection here is a programmer error in the scope itself (an
            // unknown diocese id, a contradiction) rather than a runtime fetch
            // failure — `onError` above already covers the latter.
            document.querySelector(widget.liturgy).textContent =
                `Could not build this widget: ${error.message}`;
        }
    }
}
