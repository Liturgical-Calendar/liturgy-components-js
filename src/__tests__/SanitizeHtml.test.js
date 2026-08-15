/** @jest-environment jsdom */
/**
 * The API's `messages` array carries real markup — 38 anchors, 50 `<i>`, 24
 * `<span>`, 12 `<b>` across `CalendarHandler.php` and the model classes — so
 * rendering it with `textContent` shows a reader literal `<a href="…">` tags,
 * and rendering it with `innerHTML` would execute whatever the response
 * contained.
 *
 * Neither is acceptable, and "trust the API" is not available as a third
 * option, for two structural reasons:
 *
 *   - The API interpolates calendar SOURCE DATA into an href without escaping
 *     it (`'<a href="' . $metadata->url . '" …'`). The schemas do mark those
 *     fields `format: uri`, but `javascript:alert(1)` is a valid RFC 3986 URI,
 *     so that constraint does not exclude the scheme that matters.
 *   - `ApiClient.init( url )` accepts any base URL. Multi-base is a documented
 *     feature, so the library cannot assume a response came from a trusted
 *     origin.
 *
 * These tests are the specification for the allowlist. The evasion cases are
 * the point of the file: a sanitizer that passes only the happy path is worse
 * than none, because it looks like protection.
 */
import { describe, it, expect, jest } from '@jest/globals';
import { sanitizeHtml, escapeHtml } from '../SanitizeHtml.js';

/**
 * @param {string} html - Markup to sanitize.
 * @returns {HTMLElement} A detached div holding the sanitized result.
 */
const render = (html) => {
    const host = document.createElement('div');
    host.appendChild(sanitizeHtml(html));
    return host;
};

/**
 * @param {string} html - Markup to sanitize.
 * @returns {string} The sanitized markup, as a string.
 */
const html = (html) => render(html).innerHTML;

describe('sanitizeHtml() output type', () => {
    it('returns a DocumentFragment, never a string', () => {
        // A string return would invite the caller to reach for `innerHTML`,
        // which is the sink this function exists to remove. Handing back nodes
        // means there is no re-parse and nothing to misuse.
        expect(sanitizeHtml('hello')).toBeInstanceOf(DocumentFragment);
    });

    it('parses through a template, never through DOMParser', () => {
        // Implementation-coupled ON PURPOSE, like the `ownerDocument` check
        // below, because no assertion about the OUTPUT can see this and the
        // difference is security-relevant. MDN is explicit that a `DOMParser`
        // document "can download resources specified in `<iframe>` and `<img>`
        // elements", so parsing a response through it would hit the network at
        // parse time — leaking the visitor's IP and user agent — even though
        // the element is discarded immediately after. A `<template>`'s content
        // has no browsing context and fetches nothing.
        //
        // jsdom performs no subresource loading whatsoever, so a test that
        // watched for requests would pass under either implementation and
        // prove nothing. Pinning the primitive is the only guard available
        // here; confirming the network behaviour needs a real browser.
        const spy = jest.spyOn(DOMParser.prototype, 'parseFromString');
        try {
            sanitizeHtml('<img src="https://example.test/pixel.png">text');
            expect(spy).not.toHaveBeenCalled();
        } finally {
            spy.mockRestore();
        }
    });

    it('builds nodes in the caller document, adopting nothing from the parse', () => {
        // The parse happens in a detached DOMParser document. Nodes are BUILT
        // fresh here rather than imported, which is what makes the allowlist
        // constructive — see the destructive-versus-constructive note below.
        const node = render('<b>x</b>').firstElementChild;
        expect(node.ownerDocument).toBe(document);
    });
});

describe('what survives', () => {
    it('passes plain text through unchanged', () => {
        expect(html('Saint Paul, Apostle')).toBe('Saint Paul, Apostle');
    });

    it('keeps the six elements the API actually emits', () => {
        expect(html('<i>a</i><b>b</b><span>c</span><p>d</p><br>')).toBe(
            '<i>a</i><b>b</b><span>c</span><p>d</p><br>',
        );
    });

    it('keeps an https anchor and its href', () => {
        const anchor = render(
            '<a href="https://www.vatican.va/x.html">Decree</a>',
        ).querySelector('a');
        expect(anchor.getAttribute('href')).toBe(
            'https://www.vatican.va/x.html',
        );
        expect(anchor.textContent).toBe('Decree');
    });

    it('keeps a relative href as written, without resolving it', () => {
        // Resolving would silently rewrite a consumer's relative links against
        // whatever `baseURI` happened to be.
        const anchor = render('<a href="/decrees/1">d</a>').querySelector('a');
        expect(anchor.getAttribute('href')).toBe('/decrees/1');
    });

    it('preserves text inside an element it removes', () => {
        // Unwrapping rather than deleting: the element goes, the prose stays.
        // A message is information, so losing its words is its own kind of bug.
        expect(html('<marquee>Ordinary Time</marquee>')).toBe('Ordinary Time');
        expect(html('<div><b>kept</b></div>')).toBe('<b>kept</b>');
    });
});

describe('script execution vectors', () => {
    it('drops a script element and its source text', () => {
        // Dropped ENTIRELY, not unwrapped: unwrapping would render `alert(1)`
        // as visible prose. Harmless, but it would look like the sanitizer had
        // failed, and a reader cannot tell those apart at a glance.
        expect(html('<script>alert(1)</script>')).toBe('');
        expect(html('before<script>alert(1)</script>after')).toBe(
            'beforeafter',
        );
    });

    it('drops an img with an onerror handler, leaving nothing', () => {
        // The classic payload for a sanitizer that only filters `<script>`.
        // `<img>` is not allowlisted and has no children, so unwrapping it
        // yields nothing at all.
        expect(html('<img src=x onerror="alert(1)">')).toBe('');
    });

    it('strips event handler attributes from an element it keeps', () => {
        const node = render('<b onclick="alert(1)" onmouseover="x()">t</b>');
        expect(node.innerHTML).toBe('<b>t</b>');
        expect(node.firstElementChild.hasAttribute('onclick')).toBe(false);
    });

    it('drops an svg payload', () => {
        expect(html('<svg><script>alert(1)</script></svg>')).toBe('');
    });

    it('drops an iframe', () => {
        expect(html('<iframe src="https://evil.test"></iframe>')).toBe('');
    });

    it('drops style and its text', () => {
        // `<style>` content is CSS, not prose, so unwrapping would print the
        // rules as visible text.
        expect(html('<style>body{display:none}</style>')).toBe('');
    });

    it('drops comments', () => {
        expect(html('a<!-- <script>alert(1)</script> -->b')).toBe('ab');
    });
});

describe('href scheme filtering', () => {
    // Every case here defeats a `href.startsWith( 'javascript:' )` check,
    // which is why the implementation parses with `new URL()` instead. The
    // URL parser lowercases the scheme and strips tabs and newlines before
    // reporting `protocol`, so all three collapse to the same verdict.

    it('drops a javascript: href but keeps the anchor text', () => {
        const anchor = render(
            '<a href="javascript:alert(1)">click</a>',
        ).querySelector('a');
        expect(anchor.hasAttribute('href')).toBe(false);
        expect(anchor.textContent).toBe('click');
    });

    it('drops a javascript: href written in mixed case', () => {
        const anchor = render(
            '<a href="JaVaScRiPt:alert(1)">x</a>',
        ).querySelector('a');
        expect(anchor.hasAttribute('href')).toBe(false);
    });

    it('drops a javascript: href split by a tab or newline', () => {
        expect(
            render('<a href="java\tscript:alert(1)">x</a>')
                .querySelector('a')
                .hasAttribute('href'),
        ).toBe(false);
        expect(
            render('<a href="java\nscript:alert(1)">x</a>')
                .querySelector('a')
                .hasAttribute('href'),
        ).toBe(false);
    });

    it('drops a javascript: href with leading whitespace', () => {
        expect(
            render('<a href="  javascript:alert(1)">x</a>')
                .querySelector('a')
                .hasAttribute('href'),
        ).toBe(false);
    });

    it('drops a data: href', () => {
        // `data:text/html` is a same-origin document in some contexts and a
        // phishing surface in all of them.
        expect(
            render('<a href="data:text/html,<script>alert(1)</script>">x</a>')
                .querySelector('a')
                .hasAttribute('href'),
        ).toBe(false);
    });

    it('drops an href with an unknown scheme', () => {
        expect(
            render('<a href="foo:bar">x</a>')
                .querySelector('a')
                .hasAttribute('href'),
        ).toBe(false);
    });

    it('drops an href the URL parser rejects outright', () => {
        // `new URL()` THROWS rather than returning null for a malformed host,
        // so the guard needs its `catch` — this is the input that reaches it.
        expect(
            render('<a href="http://[">x</a>')
                .querySelector('a')
                .hasAttribute('href'),
        ).toBe(false);
    });

    it('keeps garbage that the parser resolves as a relative path', () => {
        // `ht tp://%%%` has no valid scheme, so the URL parser treats it as a
        // relative path and it resolves against the page's own origin: a
        // broken same-origin link, not an injection vector. Asserted so the
        // behaviour is a recorded decision rather than an accident — the
        // scheme allowlist is the security boundary, and link correctness is
        // not this module's job.
        expect(
            render('<a href="ht tp://%%%">x</a>')
                .querySelector('a')
                .getAttribute('href'),
        ).toBe('ht tp://%%%');
    });
});

describe('anchor attributes', () => {
    it('adds rel="noopener noreferrer" to a _blank anchor', () => {
        // The API sets `target="_blank"` on every anchor it emits. Modern
        // browsers imply `noopener`, so this is belt-and-braces rather than
        // the whole defence — but it costs nothing and covers the older
        // engines still inside this package's documented floor.
        const anchor = render(
            '<a href="https://x.test" target="_blank">d</a>',
        ).querySelector('a');
        expect(anchor.getAttribute('target')).toBe('_blank');
        expect(anchor.getAttribute('rel')).toBe('noopener noreferrer');
    });

    it('replaces an attacker-supplied rel rather than merging it', () => {
        // Merging would let `rel="opener"` survive beside our own value, and
        // the last token wins in some engines.
        const anchor = render(
            '<a href="https://x.test" target="_blank" rel="opener">d</a>',
        ).querySelector('a');
        expect(anchor.getAttribute('rel')).toBe('noopener noreferrer');
    });

    it('does not add rel when there is no _blank target', () => {
        const anchor = render('<a href="https://x.test">d</a>').querySelector(
            'a',
        );
        expect(anchor.hasAttribute('rel')).toBe(false);
    });

    it('drops a target naming a frame', () => {
        // Only `_blank` is allowed through. An arbitrary frame name lets a
        // message retarget a consumer's own frames.
        const anchor = render(
            '<a href="https://x.test" target="victimFrame">d</a>',
        ).querySelector('a');
        expect(anchor.hasAttribute('target')).toBe(false);
    });

    it('strips every other attribute from an anchor', () => {
        const anchor = render(
            '<a href="https://x.test" id="x" class="y" ping="https://evil.test" download>d</a>',
        ).querySelector('a');
        expect(anchor.getAttributeNames().sort()).toEqual(['href']);
    });
});

describe('style attributes', () => {
    it('keeps the span but strips its inline style', () => {
        // The API emits a yellow-highlight style on 12 spans. The library
        // documents that it takes no position on CSS, so an API response must
        // not inject declarations into a consumer's page — and CSS is not
        // inert regardless: `background:url()` exfiltrates, `position:fixed`
        // redresses.
        const node = render(
            '<span style="background-color:#FFC;color:Red">note</span>',
        );
        expect(node.innerHTML).toBe('<span>note</span>');
    });
});

describe('malformed and hostile input', () => {
    it('does not throw on unbalanced markup', () => {
        expect(() => sanitizeHtml('<b><i>unclosed')).not.toThrow();
        expect(() => sanitizeHtml('</b></i>')).not.toThrow();
        expect(() => sanitizeHtml('<<>>')).not.toThrow();
    });

    it('handles a non-string input without throwing', () => {
        expect(() => sanitizeHtml(null)).not.toThrow();
        expect(() => sanitizeHtml(undefined)).not.toThrow();
        expect(() => sanitizeHtml(42)).not.toThrow();
    });

    it('escapes text that looks like markup', () => {
        // `&lt;script&gt;` in the response is prose ABOUT a script tag, and
        // must come out the other side as visible text, not as an element.
        const node = render('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(node.querySelector('script')).toBeNull();
        expect(node.textContent).toBe('<script>alert(1)</script>');
    });

    it('does not let a nested payload escape an allowed element', () => {
        expect(html('<b><img src=x onerror="alert(1)"><i>ok</i></b>')).toBe(
            '<b><i>ok</i></b>',
        );
    });
});

/**
 * `escapeHtml()` is the counterpart for the opposite situation: a field that is
 * plain text and must not become markup, where the surrounding code assembles a
 * STRING rather than nodes. `CalendarSelect` is its one caller, because its
 * `nationsInnerHtml`/`diocesesInnerHtml` are public getters returning markup, so
 * rebuilding it around nodes would break its API rather than fix a bug.
 *
 * Tested directly rather than only through that component: one of its three
 * call sites — the `<optgroup>` label — cannot be reached with a hostile value
 * at all, because `Intl.DisplayNames.of()` rejects a malformed region code
 * first. The escape is defence in depth there, and defence in depth still needs
 * to work.
 */
describe('escapeHtml()', () => {
    it('escapes the five characters that change meaning in markup', () => {
        expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;');
    });

    it('escapes the ampersand once, not twice', () => {
        // Chaining `.replace()` calls with `&` handled last yields
        // `&amp;lt;` — the classic double-escape. One pass cannot.
        expect(escapeHtml('<')).toBe('&lt;');
        expect(escapeHtml('&lt;')).toBe('&amp;lt;');
    });

    it('neutralizes an attribute breakout', () => {
        const value = 'x" onmouseover="alert(1)';
        const parsed = new DOMParser().parseFromString(
            `<select><option value="${escapeHtml(value)}">t</option></select>`,
            'text/html',
        );
        const option = parsed.querySelector('option');
        expect(option.hasAttribute('onmouseover')).toBe(false);
        expect(option.getAttribute('value')).toBe(value);
    });

    it('neutralizes an element injection in text position', () => {
        const parsed = new DOMParser().parseFromString(
            `<div>${escapeHtml('<img src=x onerror="alert(1)">')}</div>`,
            'text/html',
        );
        expect(parsed.querySelector('img')).toBeNull();
        expect(parsed.querySelector('div').textContent).toBe(
            '<img src=x onerror="alert(1)">',
        );
    });

    it('round-trips ordinary text through the parser unchanged', () => {
        // Escaping must not turn `Diocèse d'Abidjan` into entity soup once the
        // browser parses it back.
        for (const value of ["Diocèse d'Abidjan", 'Côte d’Ivoire', 'A & B']) {
            const parsed = new DOMParser().parseFromString(
                `<div>${escapeHtml(value)}</div>`,
                'text/html',
            );
            expect(parsed.querySelector('div').textContent).toBe(value);
        }
    });

    it('coerces a non-string rather than throwing', () => {
        expect(escapeHtml(42)).toBe('42');
        expect(escapeHtml(null)).toBe('null');
    });
});
