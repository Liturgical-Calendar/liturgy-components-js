import { CalendarSelect, ApiClient } from '@liturgical-calendar/components-js';
import { fn } from '@storybook/test';
import { withActions } from '@storybook/addon-actions/decorator';

/**
 * CalendarSelect component
 *
 * The `CalendarSelect` component is not styled out of the box, so it can be adapted to any use case in any project.
 *
 * The `CalendarSelect` component generates a `<select>` element that allows the user to select a liturgical calendar.
 *
 * The available options are filled with the available liturgical calendars that can be requested from the Liturgical Calendar API.
 *
 * The component can be instantiated with a `locale` parameter, which will determine the localization for the UI elements (display names of the nations for national calendars).
 *
 * If we want to be able to request the General Roman Calendar, perhaps with custom settings, we can use the `allowNull()` method to allow the user
 * to send a request that does not specify a National or Diocesan calendar (in other words, a request for the General Roman Calendar).
 */
const meta = {
  title: 'Components/CalendarSelect/Unstyled',
  tags: ['autodocs'],
  argTypes: {
    locale: {
      control: 'text',
      description: 'Locale code for UI elements. This option is passed directly to the `CalendarSelect` constructor.'
    },
    id: {
      control: 'text',
      description: 'ID for the widget\'s underlying HTML element'
    },
    class: {
      control: 'text',
      description: 'CSS class(es) for the widget\'s underlying HTML element'
    },
    label: {
      text: {
        control: 'text',
        description: 'Text content for the select label\'s underlying HTML element'
      },
      class: {
        control: 'text',
        description: 'CSS class(es) for the select label\'s underlying HTML element'
      },
      id: {
        control: 'text',
        description: 'ID for the select label\'s underlying HTML element'
      }
    },
    wrapper: {
      id: {
        control: 'text',
        description: 'ID for the select wrapper\'s underlying HTML element'
      },
      class: {
        control: 'text',
        description: 'CSS class(es) for the select wrapper\'s underlying HTML element'
      }
    },
    after: {
      control: 'text',
      description: 'HTML string to append to the select or select wrapper\'s underlying HTML element'
    },
    onChange: {
      action: 'onChange'
    },
    allowNull: {
      control: 'boolean',
      description: 'Set whether the select element should include an empty option as the first option'
    }
  },
  render: (args, { loaded: { apiClient } }) => {
    const container = document.createElement('div');
    container.id = 'calendarSelectContainer';

    const calendarSelect = new CalendarSelect(args);

    if (false === apiClient || false === apiClient instanceof ApiClient) {
        container.textContent = 'Error initializing the Liturgical Calendar API Client';
    } else {
        //apiClient.listenTo(calendarSelect);
        calendarSelect.appendTo(container);
    }
    return container;
  },
  parameters: {
    actions: {
      handles: ['change', 'change #calendarSelectContainer select'],
    },
  },
  decorators: [withActions],
  args: {
    label: {
      text: 'Select a calendar',
      class: 'label-class',
      id: 'label_id'
    },
    wrapper: {
      as: 'div',
      class: 'wrapper-class',
      id: 'wrapper_id'
    },
    allowNull: false,
    onChange: fn()
  }
}

export default meta;

export const Default = {
  args: {}
}

export const EnglishWithAfter = {
  args: {
    locale: 'en-US',
    label: {
      text: 'Select a calendar'
    },
    after: '<small class="text-muted"><i>Liturgical calendars loaded from the Liturgical Calendar API</i></small>',
    wrapper: undefined
  }
}

export const EnglishAllowNull = {
  args: {
    locale: 'en-US',
    label: {
      text: 'Select a calendar'
    },
    wrapper: null,
    allowNull: true
  }
}

export const Italian = {
  args: {
    locale: 'it-IT',
    label: {
      text: 'Seleziona calendario'
    },
    wrapper: undefined
  }
}

export const French = {
  args: {
    locale: 'fr-FR',
    label: {
      text: 'Eligir calendrier'
    },
    wrapper: undefined
  }
}

export const Spanish = {
  args: {
    locale: 'es-ES',
    label: {
      text: 'Seleccione calendario'
    },
    wrapper: undefined
  }
}

export const German = {
  args: {
    locale: 'de-DE',
    label: {
      text: 'Kalender auswählen'
    },
    wrapper: undefined
  }
}
