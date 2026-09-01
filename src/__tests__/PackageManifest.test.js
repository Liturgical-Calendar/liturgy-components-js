/**
 * What actually reaches the published tarball.
 *
 * `.npmignore` was a DENYLIST, so anything nobody thought to exclude shipped by
 * default. Two files reached the published 2.0.0 that way (issue #37), and by
 * the time issue #38 was acted on four more had joined them —
 * `.claude/settings.local.json`, `.serena/project.yml`, `.gitattributes` and
 * `type-fixtures/dts-consumer.ts` — every one of them a root entry added after
 * the denylist was last audited. That is the failure mode: silent, recurring on
 * its own, and visible only to someone who thinks to run `npm pack --dry-run`.
 *
 * `package.json`'s `files` array inverts the default, so a new root entry is
 * excluded until someone opts it in. This file is the other half: it pins the
 * invariants an over-broad entry ADDED to that array would break, which the
 * allowlist cannot defend against by itself.
 *
 * It deliberately does not pin the full file list. A 232-path manifest would
 * have to be regenerated for every new source file, and a check that is noisy
 * on ordinary work stops being read. These four assertions cover the two things
 * that actually go wrong — a stray shipping, and `src/` being dropped — at no
 * maintenance cost.
 *
 * It asks npm rather than reimplementing its rules, because the interesting
 * cases are precisely where those rules surprise: `dist/` is GITIGNORED and
 * ships only because `files` outranks `.gitignore`, and `CHANGELOG.md` is NOT
 * on npm's always-included list and ships only because it is named explicitly.
 * Both were verified against npm 11.18.0 and both are one edit away from
 * silently reversing.
 */
import { describe, it, expect, beforeAll } from '@jest/globals';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/**
 * The one manifest out of `npm pack --dry-run --json`, whichever envelope the
 * running npm used.
 *
 * npm 11 emits an ARRAY of manifests; npm 12 emits an OBJECT keyed by package
 * name. Both are read rather than pinning a version, because the two workflows
 * legitimately run different npms: `ci.yml` takes whatever Node 22 bundles,
 * while `npm-publish.yml` installs `npm@latest` because trusted publishing
 * needs a recent CLI. Pinning either shape breaks the other.
 *
 * An unrecognised shape THROWS naming the command, rather than yielding
 * `undefined` for the caller to trip over one property access later — which is
 * how this surfaced the first time, as a bare `Cannot read properties of
 * undefined (reading 'files')` that named neither npm nor its version.
 *
 * @param {unknown} parsed The parsed stdout of `npm pack --dry-run --json`.
 * @returns {{ files: { path: string }[] }} That single package's manifest.
 */
const manifestFrom = (parsed) => {
    const manifest = Array.isArray(parsed)
        ? parsed[0]
        : Object.values(parsed ?? {})[0];
    if (
        undefined === manifest ||
        null === manifest ||
        undefined === manifest.files
    ) {
        throw new Error(
            'Could not read a manifest out of `npm pack --dry-run --json`. Expected ' +
                "either npm 11's array of manifests or npm 12's object keyed by " +
                `package name, and got: ${JSON.stringify(parsed)?.slice(0, 200)}`,
        );
    }
    return manifest;
};

/** @type {string[]} Every path `npm pack` would place in the tarball. */
let paths;

beforeAll(() => {
    // `dist/` is gitignored, so a fresh clone has none until `yarn compile`
    // runs. CI compiles before it tests, but a developer running `yarn test`
    // directly would otherwise see three of the four assertions below fail as
    // unrelated-looking mismatches — a missing top-level entry, an absent
    // `dist/index.js`, a `0 !== 57` count — none of which names the cause.
    //
    // It THROWS rather than skipping. A skip would let the guard pass
    // vacuously the day a change dropped `yarn compile` from CI, which is
    // exactly when this file is the thing that should object. `yarn lint:dts`
    // carries the same prerequisite for the same reason, and CLAUDE.md
    // documents it as intended rather than papering over it with a rebuild:
    // a test that builds is slow on every run and is no longer only a test.
    if (false === existsSync(join(ROOT, 'dist', 'index.js'))) {
        throw new Error(
            'dist/ has not been built. Run `yarn compile` before `yarn test`: ' +
                'this file inspects what `npm pack` would ship, and dist/ is ' +
                'gitignored, so it does not exist on a fresh clone.',
        );
    }
    // `--dry-run` writes no tarball; `--json` puts the manifest on stdout.
    const output = execFileSync('npm', ['pack', '--dry-run', '--json'], {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
    });
    paths = manifestFrom(JSON.parse(output)).files.map((file) => file.path);
});

const under = (prefix) => paths.filter((path) => path.startsWith(prefix));

describe('the npm pack --dry-run --json envelope', () => {
    // npm 12 changed the shape: 11 returns an ARRAY of manifests, 12 returns an
    // OBJECT keyed by package name. Only `npm-publish.yml` saw it, because it
    // runs `npm install -g npm@latest` for trusted publishing while `ci.yml`
    // uses whatever npm Node 22 bundles — so the same commit passed `verify`
    // under npm 11 and failed the publish job under npm 12, with a TypeError
    // that named neither npm nor the version.
    it('reads the array form npm 11 emits', () => {
        expect(
            manifestFrom([{ name: 'pkg', files: [{ path: 'a.js' }] }]),
        ).toEqual({
            name: 'pkg',
            files: [{ path: 'a.js' }],
        });
    });

    it('reads the object form npm 12 emits', () => {
        expect(
            manifestFrom({ pkg: { name: 'pkg', files: [{ path: 'a.js' }] } }),
        ).toEqual({
            name: 'pkg',
            files: [{ path: 'a.js' }],
        });
    });

    it('throws naming npm and the shape when it recognises neither', () => {
        expect(() => manifestFrom({})).toThrow(/npm pack --dry-run --json/);
        expect(() => manifestFrom([])).toThrow(/npm pack --dry-run --json/);
    });
});

describe('the published tarball', () => {
    it('contains exactly these top-level entries', () => {
        // The assertion that would have caught all six historical strays: each
        // was a new entry at the package root. `package.json`, `README.md` and
        // `LICENSE` are included by npm whatever `files` says; `CHANGELOG.md`
        // is not, and is named explicitly.
        const topLevel = [...new Set(paths.map((p) => p.split('/')[0]))].sort();
        expect(topLevel).toEqual([
            'CHANGELOG.md',
            'LICENSE',
            'README.md',
            'dist',
            'package.json',
            'src',
        ]);
    });

    it('ships the compiled entry points', () => {
        // `dist/` is listed in `.gitignore`. It reaches the tarball only
        // because `files` outranks the ignore file — reverse that and the
        // package publishes with no code in it at all, while every assertion
        // about `src/` below still passes.
        expect(paths).toContain('dist/index.js');
        expect(paths).toContain('dist/index.d.ts');
        expect(under('dist/').length).toBeGreaterThan(100);
    });

    it('ships one src/ source per declaration map', () => {
        // `tsconfig.json` sets `declarationMap: true`, and each `.d.ts.map` in
        // `dist/` points at `../src/<name>.js`. That is what gives a consumer
        // "Go to Definition" into the real source instead of a `.d.ts` stub, so
        // dropping `src/` would degrade every consumer's editor with no error
        // raised anywhere. Comparing the two counts states the dependency that
        // makes `src/` non-optional, rather than pinning a number that has to
        // be edited whenever a source file is added.
        const sources = under('src/');
        const maps = under('dist/').filter((p) => p.endsWith('.d.ts.map'));
        expect(sources.length).toBeGreaterThan(0);
        expect(sources.length).toBe(maps.length);
        expect(sources.every((p) => p.endsWith('.js'))).toBe(true);
    });

    it('ships no tests, stories or fixtures', () => {
        // These are the `files` array's three negated entries. Negation inside
        // `files` is the whole reason `.npmignore` could be deleted rather than
        // kept alongside it for the carve-outs — two mechanisms describing one
        // boundary is how the original confusion started.
        expect(
            under('src/').filter((p) =>
                /__tests__|__fixtures__|\/stories\//.test(p),
            ),
        ).toEqual([]);
    });
});
