/** @jest-environment jsdom */
import { describe, it, expect, beforeEach } from '@jest/globals';
import CalendarControls from '../MetaComponents/CalendarControls.js';
import CalendarViewer from '../MetaComponents/CalendarViewer.js';
import ApiBase from '../ApiClient/ApiBase.js';
import { ApiOptionsFilter } from '../Enums.js';
import { FULL_METADATA } from '../__fixtures__/metadata.js';

const API_URL = 'http://localhost:8000';

beforeEach(() => {
    ApiBase.reset();
    ApiBase.fromMetadata(API_URL, FULL_METADATA);
    document.body.replaceChildren();
    for (const id of ['row1', 'row2', 'row3', 'calendar']) {
        const element = document.createElement('div');
        element.id = id;
        document.body.appendChild(element);
    }
});

/**
 * The `name` attributes of the inputs a container holds, in document order.
 *
 * The NAME rather than the id, for the reason `FilterInputs.test.js` gives: ids
 * come from a process-wide registry that suffixes collisions, so the second
 * `ApiOptions` built in this file would no longer answer to `#locale`.
 */
const namesIn = (selector) =>
    [...document.querySelector(selector).querySelectorAll('select, input')]
        .map((element) => element.getAttribute('name'))
        .filter((name) => null !== name && '' !== name);

describe('a bare controls target is unchanged', () => {
    it('mounts every input of the component filter into the one container', () => {
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo('#row1');
        expect(namesIn('#row1')).toEqual(
            expect.arrayContaining(['locale', 'year_type', 'year']),
        );
        expect(namesIn('#row2')).toEqual([]);
    });

    it('still accepts an HTMLElement', () => {
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo(document.getElementById('row1'));
        expect(namesIn('#row1')).toEqual(expect.arrayContaining(['locale']));
    });

    it('still rejects a value that is neither a target nor an object', () => {
        const controls = new CalendarControls({ locale: 'en' });
        expect(() => controls.appendTo({ controls: 42 })).toThrow(
            /the controls target must be a non-empty CSS selector or an HTMLElement/,
        );
    });

    it('points a bad controls target at the filter-keyed form', () => {
        // An array is the natural first guess at "split this across rows", and
        // is rejected as a target rather than read as a bag — so it is exactly
        // the error that should mention the form the caller was reaching for.
        const controls = new CalendarControls({ locale: 'en' });
        expect(() =>
            controls.appendTo({ controls: ['#row1', '#row2'] }),
        ).toThrow(
            /or an object keyed by ApiOptions filter \(generalRoman, allCalendars, pathBuilder, localeOnly, yearOnly\)/,
        );
    });
});

describe('rule 1: the component performs the passes, in its own order', () => {
    it('splits the form across the containers in one call', () => {
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo({
            controls: { allCalendars: '#row1', generalRoman: '#row2' },
        });
        expect(namesIn('#row1')).toEqual(
            expect.arrayContaining(['locale', 'year_type', 'year']),
        );
        expect(namesIn('#row2')).toEqual([
            'epiphany',
            'ascension',
            'corpus_christi',
            'eternal_high_priest',
            'holydays_of_obligation',
        ]);
    });

    it('mounts the rite and calendar selects into the first key named', () => {
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo({
            controls: { allCalendars: '#row1', generalRoman: '#row2' },
        });
        const row1 = document.getElementById('row1');
        const row2 = document.getElementById('row2');
        expect(row1.contains(controls.riteSelect._domElement)).toBe(true);
        expect(row1.contains(controls.calendarSelect._domElement)).toBe(true);
        expect(row2.contains(controls.riteSelect._domElement)).toBe(false);
    });

    it('follows the caller for which container the selects join, not the pass order', () => {
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo({
            controls: { generalRoman: '#row2', allCalendars: '#row1' },
        });
        expect(
            document
                .getElementById('row2')
                .contains(controls.riteSelect._domElement),
        ).toBe(true);
    });

    it.each([
        [
            'pathBuilder written first',
            { pathBuilder: '#row1', allCalendars: '#row2' },
        ],
        [
            'allCalendars written first',
            { allCalendars: '#row2', pathBuilder: '#row1' },
        ],
    ])(
        'lands the year input in the pathBuilder container whichever order the caller wrote (%s)',
        (_name, bag) => {
            const controls = new CalendarControls({ locale: 'en' });
            controls.appendTo({ controls: bag });
            expect(namesIn('#row1')).toContain('year');
            expect(namesIn('#row2')).not.toContain('year');
        },
    );

    it('appends in the canonical pass order, not the order the keys were written', () => {
        // THIS is what proves the ordering is the component's. The test above
        // does not: `ApiOptions.appendTo()` MOVES its inputs, so a later
        // pathBuilder pass would take the year input away from an earlier
        // allCalendars one and the final placement would match either way.
        // Pass order only becomes observable when two filters share one
        // container — which is legal — and here `allCalendars` is appended
        // first despite `generalRoman` being named first.
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo({
            controls: { generalRoman: '#row1', allCalendars: '#row1' },
        });
        expect(namesIn('#row1')).toEqual([
            'locale',
            'year_type',
            'return_type',
            'year',
            'epiphany',
            'ascension',
            'corpus_christi',
            'eternal_high_priest',
            'holydays_of_obligation',
        ]);
    });
});

describe('rule 2: overlapping filters are rejected', () => {
    it('names both keys and the shared input', () => {
        const controls = new CalendarControls({ locale: 'en' });
        expect(() =>
            controls.appendTo({
                controls: { localeOnly: '#row1', allCalendars: '#row2' },
            }),
        ).toThrow(
            /both render localeInput\. Two filters that share an input would move it/,
        );
    });

    it('rejects yearOnly beside allCalendars', () => {
        const controls = new CalendarControls({ locale: 'en' });
        expect(() =>
            controls.appendTo({
                controls: { yearOnly: '#row1', allCalendars: '#row2' },
            }),
        ).toThrow(/both render yearInput/);
    });

    it('accepts the disjoint pairing the issue names', () => {
        const controls = new CalendarControls({ locale: 'en' });
        expect(() =>
            controls.appendTo({
                controls: { allCalendars: '#row1', generalRoman: '#row2' },
            }),
        ).not.toThrow();
    });

    it('accepts pathBuilder beside allCalendars, which share only the deduped year input', () => {
        const controls = new CalendarControls({ locale: 'en' });
        expect(() =>
            controls.appendTo({
                controls: { pathBuilder: '#row1', allCalendars: '#row2' },
            }),
        ).not.toThrow();
    });

    it('still rejects pathBuilder beside yearOnly, which nothing dedupes', () => {
        const controls = new CalendarControls({ locale: 'en' });
        expect(() =>
            controls.appendTo({
                controls: { pathBuilder: '#row1', yearOnly: '#row2' },
            }),
        ).toThrow(/both render yearInput/);
    });
});

describe('rule 3: NONE cannot participate', () => {
    it('rejects a none key', () => {
        const controls = new CalendarControls({ locale: 'en' });
        expect(() =>
            controls.appendTo({ controls: { none: '#row1' } }),
        ).toThrow(
            /cannot name 'none'\. ApiOptionsFilter\.NONE renders every input/,
        );
    });

    it('rejects a computed NONE key with the NONE message, not the unknown-key one', () => {
        // `ApiOptionsFilter.NONE` IS `null`, so the computed form a caller
        // reaches for by symmetry with the supported
        // `{ [ApiOptionsFilter.GENERAL_ROMAN]: t }` produces the key 'null'.
        const controls = new CalendarControls({ locale: 'en' });
        expect(() =>
            controls.appendTo({
                controls: { [ApiOptionsFilter.NONE]: '#row1' },
            }),
        ).toThrow(/ApiOptionsFilter\.NONE renders every input/);
    });

    it('rejects a filter-keyed bag on a component built with filter NONE', () => {
        const controls = new CalendarControls({
            locale: 'en',
            filter: ApiOptionsFilter.NONE,
        });
        expect(() =>
            controls.appendTo({ controls: { generalRoman: '#row1' } }),
        ).toThrow(/ApiOptionsFilter\.NONE, which renders every input/);
    });

    it('still accepts a bare target on a component built with filter NONE', () => {
        const controls = new CalendarControls({
            locale: 'en',
            filter: ApiOptionsFilter.NONE,
        });
        controls.appendTo('#row1');
        expect(namesIn('#row1')).toEqual(
            expect.arrayContaining(['locale', 'epiphany']),
        );
    });
});

describe('the key vocabulary', () => {
    it('rejects an unknown key by name, listing the valid ones', () => {
        const controls = new CalendarControls({ locale: 'en' });
        expect(() =>
            controls.appendTo({ controls: { generalRomanOptions: '#row1' } }),
        ).toThrow(
            /'generalRomanOptions' is not a recognised ApiOptions filter key in the controls slot\. Valid keys are: generalRoman, allCalendars, pathBuilder, localeOnly, yearOnly/,
        );
    });

    it('accepts the enum values as aliases, including as computed keys', () => {
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo({
            controls: {
                [ApiOptionsFilter.ALL_CALENDARS]: '#row1',
                [ApiOptionsFilter.GENERAL_ROMAN]: '#row2',
            },
        });
        expect(namesIn('#row2')).toContain('epiphany');
        expect(namesIn('#row1')).toContain('locale');
    });

    it('rejects the same filter named twice under both spellings', () => {
        const controls = new CalendarControls({ locale: 'en' });
        expect(() =>
            controls.appendTo({
                controls: { generalRoman: '#row1', basePath: '#row2' },
            }),
        ).toThrow(
            /names the same filter twice, as 'generalRoman' and 'basePath'/,
        );
    });

    it('rejects an empty bag', () => {
        const controls = new CalendarControls({ locale: 'en' });
        expect(() => controls.appendTo({ controls: {} })).toThrow(
            /must name at least one filter/,
        );
    });

    it('accepts a single key, which is the bare target spelled declaratively', () => {
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo({ controls: { generalRoman: '#row2' } });
        expect(namesIn('#row2')).toContain('epiphany');
        expect(namesIn('#row2')).not.toContain('locale');
    });
});

describe('nothing is mounted until every target resolves', () => {
    it('leaves the document untouched when a later container is missing', () => {
        const controls = new CalendarControls({ locale: 'en' });
        expect(() =>
            controls.appendTo({
                controls: { allCalendars: '#row1', generalRoman: '#nope' },
            }),
        ).toThrow(
            /Element not found for the controls\.generalRoman slot: #nope/,
        );
        expect(namesIn('#row1')).toEqual([]);
    });
});

describe('re-mounting', () => {
    it('moves everything again when called with another bag', () => {
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo({
            controls: { allCalendars: '#row1', generalRoman: '#row2' },
        });
        controls.appendTo({
            controls: { allCalendars: '#row3', generalRoman: '#row2' },
        });
        expect(namesIn('#row1')).toEqual([]);
        expect(namesIn('#row3')).toContain('locale');
        expect(namesIn('#row2')).toContain('epiphany');
    });

    it('leaves the filter at the last pass, so a later BARE append moves only that filter', () => {
        // Records a consequence rather than endorsing it: `ApiOptions.filter()`
        // is stateful, so this is exactly what the two-pass idiom has always
        // left behind. Pinned so a future change to it is deliberate.
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo({
            controls: { allCalendars: '#row1', generalRoman: '#row2' },
        });
        controls.appendTo('#row3');
        expect(namesIn('#row3')).toContain('epiphany');
        expect(namesIn('#row3')).not.toContain('locale');
        expect(namesIn('#row1')).toContain('locale');
        expect(namesIn('#row2')).toEqual([]);
    });
});

describe('dispose empties every container it filled', () => {
    it('clears both rows', () => {
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo({
            controls: { allCalendars: '#row1', generalRoman: '#row2' },
        });
        controls.dispose();
        expect(namesIn('#row1')).toEqual([]);
        expect(namesIn('#row2')).toEqual([]);
    });

    it('clears a container a later re-mount stopped naming', () => {
        // A re-mount naming FEWER filters leaves the dropped filters' inputs
        // exactly where they were — nothing in the new bag moves them — so a
        // `#mounts` list that only tracked the latest call would leave them in
        // the document after `dispose()`.
        const controls = new CalendarControls({ locale: 'en' });
        controls.appendTo({
            controls: { pathBuilder: '#row1', allCalendars: '#row2' },
        });
        expect(namesIn('#row1')).toContain('calendar_path');
        controls.appendTo({
            controls: { allCalendars: '#row3', generalRoman: '#row2' },
        });
        expect(namesIn('#row1')).toContain('calendar_path');
        controls.dispose();
        expect(namesIn('#row1')).toEqual([]);
        expect(namesIn('#row2')).toEqual([]);
        expect(namesIn('#row3')).toEqual([]);
    });
});

describe('CalendarControls.mountInto with a filter-keyed controls slot', () => {
    it('does not treat a filter-keyed bag as a cancelled mount', async () => {
        const controls = await CalendarControls.mountInto(
            {
                controls: {
                    allCalendars: document.getElementById('row1'),
                    generalRoman: document.getElementById('row2'),
                },
            },
            { locale: 'en', initialFetch: false },
        );
        expect(controls).not.toBeNull();
        expect(namesIn('#row2')).toContain('epiphany');
        controls.dispose();
    });

    it('resolves to null when the first named container has left the document', async () => {
        const detached = document.createElement('div');
        const controls = await CalendarControls.mountInto(
            { controls: { allCalendars: detached, generalRoman: '#row2' } },
            { locale: 'en', initialFetch: false },
        );
        expect(controls).toBeNull();
    });

    it('rejects an empty bag rather than mounting nothing', async () => {
        await expect(
            CalendarControls.mountInto(
                { controls: {} },
                { locale: 'en', initialFetch: false },
            ),
        ).rejects.toThrow(/must name at least one filter/);
    });
});

describe('CalendarViewer forwards the bag', () => {
    it('splits the controls and still mounts the calendar', () => {
        const viewer = new CalendarViewer({ locale: 'en' });
        viewer.appendTo({
            controls: { allCalendars: '#row1', generalRoman: '#row2' },
            calendar: '#calendar',
        });
        expect(namesIn('#row1')).toContain('locale');
        expect(namesIn('#row2')).toContain('epiphany');
        viewer.dispose();
        expect(namesIn('#row2')).toEqual([]);
    });

    it('reports a bad controls key under its own name', () => {
        const viewer = new CalendarViewer({ locale: 'en' });
        expect(() =>
            viewer.appendTo({
                controls: { nope: '#row1' },
                calendar: '#calendar',
            }),
        ).toThrow(/^CalendarViewer\.appendTo: 'nope' is not a recognised/);
    });
});

describe('CalendarViewer.mountInto with a filter-keyed controls slot', () => {
    /**
     * A programmer error inside the bag must outrank the cancellation probe.
     *
     * `CalendarViewer.#targetElement()` reads only the FIRST keyed value, so a
     * bag whose first container is a disconnected `HTMLElement` used to reach
     * `mountInto()`'s `return null` with an unknown, overlapping or `none` key
     * still unexamined — answering "cancelled" to what is a typo. Measured
     * before the fix: all three returned `null` rather than throwing
     * (CodeRabbit, PR #87). These pin the ordering, not merely the messages.
     */
    const invalidBags = [
        ['an unknown filter key', { nosuchFilter: null }, /not a recognised/i],
        [
            'two filters that share an input',
            { allCalendars: null, localeOnly: null },
            /both render/i,
        ],
        ['ApiOptionsFilter.NONE', { none: null }, /cannot name 'none'/i],
    ];

    for (const [label, shape, expected] of invalidBags) {
        it(`rejects ${label} even when the first container is disconnected`, async () => {
            const controls = {};
            let first = true;
            for (const key of Object.keys(shape)) {
                // The FIRST value is detached — the one the probe looks at.
                controls[key] = first
                    ? document.createElement('div')
                    : document.createElement('div');
                if (false === first) {
                    document.body.appendChild(controls[key]);
                }
                first = false;
            }

            await expect(
                CalendarViewer.mountInto(
                    { controls, calendar: '#calendarMount' },
                    { locale: 'en' },
                ),
            ).rejects.toThrow(expected);
        });
    }

    it('does not treat a filter-keyed bag as a cancelled mount', async () => {
        const viewer = await CalendarViewer.mountInto(
            {
                controls: {
                    allCalendars: document.getElementById('row1'),
                    generalRoman: document.getElementById('row2'),
                },
                calendar: '#calendar',
            },
            { locale: 'en', initialFetch: false },
        );
        expect(viewer).not.toBeNull();
        expect(namesIn('#row2')).toContain('epiphany');
        viewer.dispose();
    });

    it('resolves to null when the first named container has left the document', async () => {
        const detached = document.createElement('div');
        const viewer = await CalendarViewer.mountInto(
            {
                controls: { allCalendars: detached, generalRoman: '#row2' },
                calendar: '#calendar',
            },
            { locale: 'en', initialFetch: false },
        );
        expect(viewer).toBeNull();
    });
});
