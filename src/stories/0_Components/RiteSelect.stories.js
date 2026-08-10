import { RiteSelect, ApiClient } from '@liturgical-calendar/components-js';

/**
 * RiteSelect component
 *
 * The `RiteSelect` component is not styled out of the box, so it can be adapted to any use case in any project.
 *
 * The `RiteSelect` component generates a `<select>` element that allows the user to select a liturgical rite:
 * Roman or Ambrosian.
 *
 * Unlike `CalendarSelect`, `RiteSelect` does not depend on API metadata and is populated from a fixed, static
 * set of two rites. It also has a smaller configuration surface than `CalendarSelect`: there is no `filter()`
 * (only two rites exist) and no `allowNull()` (a rite is always selected).
 *
 * On its own, selecting a rite has no effect on any other component. To drive a `CalendarSelect` (and the
 * relevant `ApiOptions` controls) from the selected rite, pass this component as the second argument to
 * `ApiOptions.linkToCalendarSelect()` — see the `docs/rite-select.md` documentation for a full example.
 */
const meta = {
    title: 'Components/RiteSelect/Unstyled',
    tags: ['autodocs'],
    argTypes: {
        locale: {
            control: 'text',
            description:
                'Locale code for UI elements. This option is passed directly to the `RiteSelect` constructor.',
        },
        id: {
            control: 'text',
            description: "ID for the widget's underlying HTML element",
        },
        class: {
            control: 'text',
            description:
                "CSS class(es) for the widget's underlying HTML element",
        },
        label: {
            text: {
                control: 'text',
                description:
                    "Text content for the select label's underlying HTML element",
            },
            class: {
                control: 'text',
                description:
                    "CSS class(es) for the select label's underlying HTML element",
            },
            id: {
                control: 'text',
                description:
                    "ID for the select label's underlying HTML element",
            },
        },
        onChange: {
            action: 'onChange',
        },
    },
    render: (args, { loaded: { apiClient } }) => {
        const container = document.createElement('div');
        container.id = 'riteSelectContainer';

        const riteSelect = new RiteSelect(args);

        if (args.label) {
            riteSelect.label(args.label);
        }

        if (!apiClient || !(apiClient instanceof ApiClient)) {
            container.textContent =
                'Error initializing the Liturgical Calendar API Client';
        } else {
            riteSelect.appendTo(container);
        }
        return container;
    },
    parameters: {
        actions: {
            handles: ['change', 'change #riteSelectContainer select'],
        },
    },
    args: {
        label: {
            text: 'Select a rite',
            class: 'label-class',
            id: 'label_id',
        },
    },
};

export default meta;

export const Default = {
    args: {},
};

export const English = {
    args: {
        locale: 'en-US',
        label: {
            text: 'Select a rite',
        },
    },
};

export const Italian = {
    args: {
        locale: 'it-IT',
        label: {
            text: 'Seleziona un rito',
        },
    },
};

export const French = {
    args: {
        locale: 'fr-FR',
        label: {
            text: 'Sélectionnez un rite',
        },
    },
};
