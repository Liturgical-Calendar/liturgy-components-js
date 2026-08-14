/**
 * @jest-environment jsdom
 */

/**
 * The drift gate for the exported version constant.
 *
 * The jsdom docblock above is not about this test's own assertions, which are
 * pure string comparisons. It is because the third one imports the whole barrel,
 * `src/index.js`, which pulls in every component in the library — this is the
 * only test in the suite that does. Under the default `node` environment it
 * passes today, but the first component to touch `document` at module scope
 * would break it with a failure message about versions, which is the wrong place
 * to learn about a DOM problem. 52 of the suite's other test files carry the same
 * docblock.
 *
 * `src/Version.js` is hand-maintained rather than generated (see
 * `docs/superpowers/specs/2026-08-14-export-version-design.md`, Decision 1), so
 * the one thing that has to be mechanical is catching a release that bumps
 * `package.json` and forgets the constant. A version constant nobody can trust
 * is the exact failure #64 is about, so an untrue claim has to be loud.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { VERSION } from '../Version.js';
import * as index from '../index.js';

/**
 * `fileURLToPath` rather than handing the `URL` straight to `readFileSync`:
 * under the jsdom environment the global `URL` is jsdom's, and Yarn PnP's patched
 * `readFileSync` rejects it outright with `Unsupported path type: URL {}`. Passing
 * a plain string sidesteps which realm the `URL` came from.
 */
const packageJson = JSON.parse(
    readFileSync(
        fileURLToPath(new URL('../../package.json', import.meta.url)),
        'utf8',
    ),
);

describe('VERSION', () => {
    it("matches package.json's version", () => {
        expect(VERSION).toBe(packageJson.version);
    });

    /**
     * Asserted on its own terms as well as against `package.json`, so a bad edit
     * to either file fails with a message about the thing that is actually wrong
     * rather than only as a mismatch between two equally suspect strings.
     */
    it('is a non-empty semver-shaped string', () => {
        expect(typeof VERSION).toBe('string');
        expect(VERSION).toMatch(
            /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/,
        );
    });

    it('is re-exported from the package entry point', () => {
        expect(index.VERSION).toBe(VERSION);
    });
});
