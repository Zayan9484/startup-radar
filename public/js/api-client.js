/**
 * api-client.js — the only place the browser talks to the network.
 *
 * Every function returns { data, error } instead of throwing. That way the
 * caller can always show *something* — results, or a friendly message —
 * and one failing request never crashes the whole page.
 */

/** Fetch JSON from a URL with a time limit. Never throws. */
async function getJson(url, timeoutMs = 30000) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    let body = null;
    try { body = await res.json(); } catch { /* not JSON */ }

    if (!res.ok || !body) {
      return { data: body, error: body?.error || `The server answered with an error (HTTP ${res.status}).` };
    }
    return { data: body, error: null };
  } catch (err) {
    const msg = err.name === 'TimeoutError' ? 'The request took too long.' : 'Could not reach the server. Check your connection.';
    return { data: null, error: msg };
  }
}

/** YC companies in our niches (from /api/yc). */
export const loadYc = () => getJson('/api/yc');

/** Merged remote jobs plus per-source status (from /api/jobs). */
export const loadJobs = () => getJson('/api/jobs');

/** The hand-picked company directory — a static file, no function needed. */
export const loadDirectory = () => getJson('/data/companies.json', 15000);
