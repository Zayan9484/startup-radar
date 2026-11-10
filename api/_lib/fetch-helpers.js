/**
 * fetch-helpers.js — small, reusable tools for the serverless functions.
 *
 * Why the "_lib" folder name? Vercel turns every file in /api into a public
 * URL, EXCEPT files/folders whose name starts with an underscore. So helpers
 * living here stay private.
 *
 * What lives here:
 *   fetchJson()   → fetch a URL as JSON, with a time limit and a polite User-Agent
 *   cached()      → remember a result in memory for a while (and keep the last
 *                   good copy as a backup if the source later fails)
 *   jsonResponse()→ build an HTTP response with the right caching headers
 */

/** Identify ourselves politely to the data sources. Some (like Remote OK) require a User-Agent. */
const USER_AGENT = 'StartupRadar/1.0 (open-source startup and job explorer)';

/**
 * Fetch a URL and parse it as JSON.
 * - Gives up after `timeoutMs` so one slow source can't freeze the whole app.
 * - Throws a readable Error if the status is not 2xx or the body isn't JSON.
 */
export async function fetchJson(url, { timeoutMs = 8000 } = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    // AbortSignal.timeout() cancels the request automatically after N ms.
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${new URL(url).hostname}`);
  }
  return res.json();
}

/* ------------------------------------------------------------------ */
/* In-memory cache                                                     */
/* ------------------------------------------------------------------ */
/*
 * A serverless function "instance" can stay warm and handle many requests.
 * Anything stored in a module-level variable survives between those requests,
 * so we use a simple Map as a cache. It is NOT shared between instances and
 * disappears on a cold start — that's fine, the Vercel CDN cache (set via the
 * Cache-Control header in jsonResponse) does the heavy lifting.
 */
const memory = new Map(); // key -> { value, expires }

/**
 * Return a cached value if it's still fresh; otherwise run `loader()`.
 * If `loader()` fails but we have an OLD value, return the old one instead
 * of failing — a slightly stale list is better than an empty page.
 *
 * Returns { value, stale } so callers can tell the user when data is old.
 */
export async function cached(key, ttlMs, loader) {
  const hit = memory.get(key);
  if (hit && hit.expires > Date.now()) return { value: hit.value, stale: false };

  try {
    const value = await loader();
    memory.set(key, { value, expires: Date.now() + ttlMs });
    return { value, stale: false };
  } catch (err) {
    if (hit) return { value: hit.value, stale: true }; // fall back to last good copy
    throw err; // nothing to fall back to — let the caller handle it
  }
}

/* ------------------------------------------------------------------ */
/* Responses                                                           */
/* ------------------------------------------------------------------ */

/**
 * Build a JSON Response.
 *
 * `cdnSeconds` sets `s-maxage`, which tells Vercel's CDN to cache this exact
 * URL for that many seconds. While cached, visitors get the saved copy and
 * our function (and the upstream feeds) are not called at all. That keeps us
 * well inside the free plan AND inside each feed's "don't call us too often"
 * rules. `stale-while-revalidate` lets the CDN serve the old copy instantly
 * while it fetches a fresh one in the background.
 */
export function jsonResponse(data, { status = 200, cdnSeconds = 0 } = {}) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8' };
  headers['Cache-Control'] = cdnSeconds > 0
    ? `public, max-age=0, s-maxage=${cdnSeconds}, stale-while-revalidate=${cdnSeconds * 2}`
    : 'no-store';
  return new Response(JSON.stringify(data), { status, headers });
}

/** Turn any thrown value into a short, safe message for the browser. */
export function errorMessage(err) {
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') return 'The source took too long to respond.';
  return err?.message ? String(err.message).slice(0, 200) : 'Unknown error';
}
