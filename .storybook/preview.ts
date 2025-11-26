import type { Preview } from "@storybook/html-vite"
import { ApiClient } from "@liturgical-calendar/components-js"

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
    async () => ({
      apiClient: await ApiClient.init('http://localhost:' + (import.meta.env.STORYBOOK_API_PORT || 8000))
    })
  ]
};

export default preview;
