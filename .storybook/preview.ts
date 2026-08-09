import type { Preview } from "@storybook/html-vite"
import { ApiClient } from "@liturgical-calendar/components-js"

const API_URL = 'http://localhost:' + (import.meta.env.STORYBOOK_API_PORT || 8000);

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    }
  },
  loaders: [
    // `ApiClient.init()` rejects when the API cannot be reached. A rejecting loader
    // fails the whole Storybook run rather than only the story that needed a client,
    // so the rejection is converted into a sentinel here: `apiClient` stays the
    // loader's key and becomes `null`, which is what every story's guard already
    // tests for. The error travels alongside it under `apiClientError` so that a
    // story can name the URL it actually tried, rather than reading the deprecated
    // `ApiClient._apiUrl` static.
    async () => {
      try {
        return { apiClient: await ApiClient.init(API_URL), apiClientError: null };
      } catch (apiClientError) {
        return { apiClient: null, apiClientError };
      }
    }
  ]
};

export default preview;
