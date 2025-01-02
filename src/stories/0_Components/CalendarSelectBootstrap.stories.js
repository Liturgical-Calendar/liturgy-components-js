import { CalendarSelect, ApiClient } from '@liturgical-calendar/components-js';
import { fn } from '@storybook/test';
import { withActions } from '@storybook/addon-actions/decorator';
import 'bootstrap/dist/css/bootstrap.min.css';

/**
 * CalendarSelect component
 *
 * Here is an example of using the `CalendarSelect` component in a bootstrap project.
 * We set all the necessary classes for bootstrap styled form controls.
 */
const meta = {
  title: 'Components/CalendarSelect/Boostrap',
  tags: ['autodocs'],
  argTypes: {
    locale: {
      control: 'text',
      description: 'Locale code for UI elements',
      defaultValue: 'en-US'
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
    class: 'form-select',
    label: {
      text: 'Select a calendar',
      class: 'form-label',
      id: 'label_id'
    },
    wrapper: {
      as: 'div',
      class: 'form-group col col-md-4',
      id: 'wrapper_id'
    },
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
    label: null,
    wrapper: null,
    after: '<small class="text-muted"><i>Liturgical calendars available on the Liturgical Calendar API</i></small>'
  }
}

export const ItalianBootstrap = {
  args: {
    locale: 'it-IT',
    label: {
      text: 'Seleziona calendario',
      class: 'form-label'
    },
    wrapper: null,
    after: '<small class="text-muted"><i>Calendari liturgici disponibili nell\'API del Calendar Liturgico</i></small>'
  }
}

export const FrenchBootstrap = {
  args: {
    locale: 'fr-FR',
    label: {
      text: 'Eligir calendrier',
      class: 'form-label'
    },
    wrapper: null,
    after: '<small class="text-muted"><i>Calendriers liturgiques disponibles sur l\'API du Calendrier Liturgique</i></small>'
  }
}

export const SpanishBootstrap = {
  args: {
    locale: 'es-ES',
    label: {
      text: 'Seleccione calendario',
      class: 'form-label'
    },
    wrapper: null,
    after: '<small class="text-muted"><i>Calendarios liturgicos disponibles en la API del Calendario Liturgico</i></small>'
  }
}

export const GermanBootstrap = {
  args: {
    locale: 'de-DE',
    label: {
      text: 'Kalender auswählen',
      class: 'form-label'
    },
    wrapper: null,
    after: '<small class="text-muted"><i>Verfügbare liturgische Kalender in der Liturgischen Kalender-API</i></small>'
  }
}
