/**
 * The one place API-supplied markup becomes DOM.
 *
 * The API's `messages` array carries real markup — anchors to Vatican decrees,
 * `<i>`/`<b>` emphasis, highlighted `<span>`s — so `textContent` shows a reader
 * literal `<a href="…">` tags and `innerHTML` executes whatever arrived. This
 * module is the third option: parse the markup, then rebuild it from an
 * allowlist.
 *
 * **"Trust the API" is not available as a fourth option**, and that is a
 * structural claim rather than a cautious one:
 *
 * - The API interpolates calendar SOURCE DATA into an href without escaping it
 *   — `'<a href="' . $metadata->url . '" target="_blank">'` in
 *   `CalendarHandler.php`, and the same shape in `LitCalItemMakePatronMetadata`
 *   and `DecreeEventMetadata`. The schemas DO mark those fields `format: uri`,
 *   which is weaker than it looks: `format` is an annotation rather than an
 *   assertion unless a validator opts in, and `javascript:alert(1)` is a
 *   perfectly valid RFC 3986 URI in any case — scheme plus opaque path — so
 *   `format: uri` does not exclude the one scheme that matters. Only a scheme
 *   allowlist does, which is what `isSafeUrl()` below applies.
 * - `ApiClient.init( url )` accepts ANY base URL, and multi-base is a
 *   documented feature. The library therefore cannot assume a response came
 *   from an origin the consumer trusts.
 *
 * **The allowlist is CONSTRUCTIVE, not destructive**, which is the single most
 * important property here. A destructive sanitizer parses the input and then
 * removes what it dislikes, so anything it fails to think of survives — every
 * historical sanitizer bypass is a variation on that. This one never adopts a
 * parsed node at all: it walks the parse and BUILDS fresh elements in the
 * caller's document, copying across only attributes it has explicitly approved.
 * What it does not understand cannot survive, because nothing survives by
 * default. `ownerDocument` is asserted in the tests for exactly this reason.
 *
 * **`DOMParser` is the parse step because it is inert.** It executes no
 * scripts and — unlike `innerHTML` on a detached element, which is also
 * script-inert — it fetches no resources, so an `<img src>` in the input never
 * reaches the network even though the element is discarded a moment later.
 * `Utils.sanitizeInput()` already uses it, so this is the codebase's existing
 * mechanism rather than a new one; that function stays as it is, since for a
 * CSS class name or an element id "strip everything" remains correct.
 *
 * **`Element.setHTML()` was weighed and rejected**, though it is the obviously
 * right long-term answer. As of August 2026 it ships in Chrome/Edge 146+ and
 * Firefox 148+, is at 68% global support, and MDN still labels it "Limited
 * availability — not Baseline". Safari has not implemented it in ANY version,
 * on macOS or iOS. Since every iOS browser is WebKit-backed, adopting it would
 * exclude every iOS user regardless of the browser they chose — not merely
 * users on old versions. Feature-detecting with a fallback was rejected too, on
 * a narrower ground: jsdom implements no `setHTML`, so the native branch cannot
 * be covered by this suite at all, and shipping an untested path to the
 * majority of users while testing the minority path is backwards. Revisit when
 * Safari ships and it reaches Baseline — at which point this module becomes a
 * one-line delegate.
 *
 * Internal, and deliberately NOT exported from `src/index.js`, on the same
 * reasoning as `LocaleValidation.js`, `OptionsValidation.js` and
 * `MessageLookup.js`: contract between the components, not public API.
 *
 * @module SanitizeHtml
 * @author [John Romano D'Orazio](https://github.com/JohnRDOrazio)
 * @license Apache-2.0
 */

/** `Node.ELEMENT_NODE`, spelled out so this module needs no DOM global. */
const ELEMENT_NODE = 1;

/** `Node.TEXT_NODE`, likewise. */
const TEXT_NODE = 3;

/**
 * The elements a message may contain, as tag names.
 *
 * Sized from what the API actually emits rather than from a general-purpose
 * list: `<i>`, `<a>`, `<span>` and `<b>` account for every occurrence, with
 * `<p>` and `<br>` appearing a handful of times. `<em>` and `<strong>` are
 * included as the semantic spellings of `<i>` and `<b>`, so a future API
 * change to the more correct tags does not silently lose emphasis.
 *
 * Widening this set is a deliberate act. Nothing outside it can appear in the
 * output, because the output is built rather than filtered.
 *
 * @type {Set<string>}
 */
const ALLOWED_ELEMENTS = new Set([
    'A',
    'B',
    'BR',
    'EM',
    'I',
    'P',
    'SPAN',
    'STRONG',
]);

/**
 * Elements discarded together with their subtree, rather than unwrapped.
 *
 * Everything not allowed is normally UNWRAPPED — the element goes, its text
 * stays — because a message is information and silently dropping its words is
 * its own kind of bug. These are the exceptions: their text content is not
 * prose, so unwrapping would render CSS rules or JavaScript source as visible
 * copy. That is harmless, but it reads exactly like a sanitizer that failed,
 * and a reader cannot tell the two apart.
 *
 * Elements such as `<img>`, `<iframe>` and `<object>` need no entry: they are
 * not allowed, and they have no child nodes, so unwrapping them already yields
 * nothing.
 *
 * @type {Set<string>}
 */
const DROPPED_ELEMENTS = new Set([
    'NOSCRIPT',
    'SCRIPT',
    'STYLE',
    'TEXTAREA',
    'TITLE',
]);

/**
 * URL schemes an `href` may use.
 *
 * `javascript:` is the attack; `data:` is a phishing surface and, in some
 * contexts, a same-origin document. Nothing else is needed — the API emits only
 * `https:` links today, and `http:` is kept so a consumer's own relative links
 * resolve on a plain-HTTP development server.
 *
 * @type {Set<string>}
 */
const SAFE_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Whether an `href` may be carried across to the rebuilt anchor.
 *
 * **Parses rather than prefix-matches, and that is load-bearing.** A
 * `href.startsWith( 'javascript:' )` check is defeated three separate ways, all
 * of which appear in `SanitizeHtml.test.js`: `JaVaScRiPt:` (the scheme is
 * case-insensitive), `java\tscript:` (the HTML parser strips tabs and newlines
 * from attribute values before the URL is ever resolved), and leading
 * whitespace. `new URL()` performs exactly the normalization the browser
 * performs before navigating, then reports a lowercased `protocol`, so all
 * three collapse to one verdict.
 *
 * Relative URLs are resolved against `document.baseURI` only to CLASSIFY them.
 * The original string is what gets written back, so a relative link stays
 * relative rather than being silently rewritten against whatever base the
 * consumer's page happens to have.
 *
 * @param {string} href - The raw attribute value.
 * @returns {boolean} `true` if the scheme is allowed.
 */
function isSafeUrl(href) {
    try {
        return SAFE_PROTOCOLS.has(new URL(href, document.baseURI).protocol);
    } catch {
        // An unparseable href is not a safe one. `new URL()` throws rather
        // than returning null, and a throw here must not take the render down.
        return false;
    }
}

/**
 * Copies the approved attributes from a parsed element onto a rebuilt one.
 *
 * Only `<a>` carries any. Everything else is rebuilt bare, which is what
 * removes `on*` handlers, `style`, `id`, `class` and `ping` without needing to
 * enumerate them — they are never copied in the first place.
 *
 * @param {Element} source - The parsed element, from the inert document.
 * @param {Element} rebuilt - The fresh element in the caller's document.
 * @returns {void}
 */
function applyAllowedAttributes(source, rebuilt) {
    if ('A' !== source.tagName.toUpperCase()) {
        return;
    }
    const href = source.getAttribute('href');
    if (null !== href && isSafeUrl(href)) {
        rebuilt.setAttribute('href', href);
    }
    // Only `_blank` passes. An arbitrary frame name would let a message
    // retarget one of the consumer's own frames.
    if ('_blank' === source.getAttribute('target')) {
        rebuilt.setAttribute('target', '_blank');
        // Written unconditionally, never merged with the source's own `rel`.
        // Merging would let an attacker-supplied `opener` survive beside this
        // value, and the later token wins in some engines.
        rebuilt.setAttribute('rel', 'noopener noreferrer');
    }
}

/**
 * Walks a parsed subtree, appending rebuilt nodes to `target`.
 *
 * @param {Node} source - Node in the inert parsed document whose children to walk.
 * @param {Node} target - Node in the caller's document to append to.
 * @returns {void}
 */
function rebuildInto(source, target) {
    for (const child of source.childNodes) {
        if (TEXT_NODE === child.nodeType) {
            // `data` is the parsed text, so entities have already been decoded
            // and `createTextNode` re-escapes on serialization. `&lt;script&gt;`
            // in the response is prose ABOUT a script tag and comes out as
            // visible text, which is what a reader expects.
            target.appendChild(document.createTextNode(child.data));
            continue;
        }
        if (ELEMENT_NODE !== child.nodeType) {
            // Comments, processing instructions and CDATA. A comment can hide a
            // payload from a careless reader and carries nothing a message needs.
            continue;
        }
        const tagName = child.tagName.toUpperCase();
        if (DROPPED_ELEMENTS.has(tagName)) {
            continue;
        }
        if (false === ALLOWED_ELEMENTS.has(tagName)) {
            // Unwrap: keep the prose, discard the element.
            rebuildInto(child, target);
            continue;
        }
        const rebuilt = document.createElement(tagName.toLowerCase());
        applyAllowedAttributes(child, rebuilt);
        rebuildInto(child, rebuilt);
        target.appendChild(rebuilt);
    }
}

/**
 * Sanitizes a string of API-supplied markup into safe, live DOM nodes.
 *
 * Returns a `DocumentFragment` rather than a string, deliberately: a string
 * return would invite the caller to assign it to `innerHTML`, which is the
 * exact sink this function exists to remove. Handing back nodes means there is
 * no second parse and nothing left to misuse.
 *
 * @param {string} input - Markup from an API response. A non-string is
 *        coerced, so `null`, `undefined` and numbers are safe to pass.
 * @returns {DocumentFragment} The sanitized nodes, owned by the caller's
 *          document and ready to append.
 * @example
 * messageCell.appendChild( sanitizeHtml( message ) );
 */
export function sanitizeHtml(input) {
    const fragment = document.createDocumentFragment();
    if (null === input || undefined === input) {
        return fragment;
    }
    const parsed = new DOMParser().parseFromString(String(input), 'text/html');
    rebuildInto(parsed.body, fragment);
    return fragment;
}
