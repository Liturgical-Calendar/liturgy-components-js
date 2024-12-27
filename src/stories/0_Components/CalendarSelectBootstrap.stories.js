import { CalendarSelect, ApiClient } from 'liturgy-components-js';
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
    labelId: {
      control: 'text',
      description: 'ID for the select label\'s underlying HTML element'
    },
    labelClass: {
      control: 'text',
      description: 'CSS class(es) for the select label\'s underlying HTML element'
    },
    labelText: {
      control: 'text',
      description: 'Text for the select label\'s underlying HTML element',
      defaultValue: 'Select a calendar'
    },
    wrapperId: {
      control: 'text',
      description: 'ID for the select wrapper\'s underlying HTML element'
    },
    wrapperClass: {
      control: 'text',
      description: 'CSS class(es) for the select wrapper\'s underlying HTML element'
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
    const calendarSelect = new CalendarSelect(args.locale);

    if (args.id) {
      calendarSelect.id(args.id);
    }
    if (args.class) {
      calendarSelect.class(args.class);
    }
    if (args.labelId || args.labelClass || args.labelText) {
      const label = {};
      if (args.labelId) {
        label.id = args.labelId;
      }
      if (args.labelClass) {
        label.class = args.labelClass;
      }
      if (args.labelText) {
        label.text = args.labelText;
      }
      calendarSelect.label(label);
    }
    if (args.wrapperId || args.wrapperClass) {
      const wrapper = {};
      if (args.wrapperId) {
        wrapper.id = args.wrapperId;
      }
      if (args.wrapperClass) {
        wrapper.class = args.wrapperClass;
      }
      calendarSelect.wrapper(wrapper);
    }
    if (args.after) {
      calendarSelect.after(args.after);
    }

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
    labelText: 'Select a calendar',
    class: 'form-select',
    labelClass: 'form-label',
    wrapperClass: 'form-group col col-md-4',
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
    after: '<small class="text-muted"><i>Liturgical calendars available on the Liturgical Calendar API</i></small>'
  }
}

export const ItalianBootstrap = {
  args: {
    locale: 'it-IT',
    labelText: 'Seleziona calendario',
    after: '<small class="text-muted"><i>Calendari liturgici disponibili nell\'API del Calendar Liturgico</i></small>'
  }
}

export const FrenchBootstrap = {
  args: {
    locale: 'fr-FR',
    labelText: 'Eligir calendrier',
    after: '<small class="text-muted"><i>Calendriers liturgiques disponibles sur l\'API du Calendrier Liturgique</i></small>'
  }
}

export const SpanishBootstrap = {
  args: {
    locale: 'es-ES',
    labelText: 'Seleccione calendario',
    after: '<small class="text-muted"><i>Calendarios liturgicos disponibles en la API del Calendario Liturgico</i></small>'
  }
}

export const GermanBootstrap = {
  args: {
    locale: 'de-DE',
    labelText: 'Kalender auswählen',
    after: '<small class="text-muted"><i>Verfügbare liturgische Kalender in der Liturgischen Kalender-API</i></small>'
  }
}
