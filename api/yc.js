/**
 * GET /api/yc — YC companies in our three niches.
 *
 * WHERE THE DATA COMES FROM
 *   yc-oss/api (https://github.com/yc-oss/api) — a free, community-maintained,
 *   UNOFFICIAL dataset of publicly launched Y Combinator companies, rebuilt
 *   daily from YC's public company directory. No API key needed.
 *
 * WHAT THIS FUNCTION DOES
 *   1. Downloads the full company list (~11 MB, ~6,400 companies).
 *   2. Keeps only companies that match one of our niches (see taxonomy.js).
 *   3. Strips each company down to the few fields the page shows.
 *   4. Sends back a small JSON list (a few hundred KB instead of 11 MB).
 *
 * Region, batch, "hiring" and text search are applied in the BROWSER on this
 * list, so changing a filter is instant and this URL is always the same —
 * which means Vercel's CDN can cache one copy for everybody.
 */
import { NICHES } from '../public/js/taxonomy.js';
import { cached, fetchJson, jsonResponse, errorMessage } from './_lib/fetch-helpers.js';

const YC_ALL_URL = 'https://yc-oss.github.io/api/companies/all.json';
const SIX_HOURS = 6 * 60 * 60 * 1000; // the dataset only updates once a day

/** Work out which of our niches a YC company belongs to (can be several). */
function nichesFor(company) {
  const tags = company.tags || [];
  const text = `${company.one_liner || ''} ${company.long_description || ''}`.toLowerCase();

  return NICHES.filter(({ yc }) =>
    tags.some((t) => yc.tags.includes(t)) ||
    yc.subindustries.includes(company.subindustry) ||
    yc.keywords.some((k) => text.includes(k))
  ).map((n) => n.id);
}

/** Keep only what the page needs. Smaller response = faster page. */
function slim(company, niches) {
  return {
    id: `yc:${company.slug}`,
    name: company.name,
    oneLiner: company.one_liner || '',
    website: company.website || '',
    ycUrl: company.url, // the company's official YC profile page (our source link)
    batch: company.batch || 'Unspecified',
    status: company.status, // Active / Acquired / Inactive / Public
    teamSize: company.team_size || null,
    location: company.all_locations || '',
    regions: company.regions || [],
    tags: (company.tags || []).slice(0, 6),
    isHiring: Boolean(company.isHiring),
    // YC marks remote-friendly companies with these region labels.
    isRemote: (company.regions || []).some((r) => /remote/i.test(r)),
    launchedAt: company.launched_at || 0,
    niches,
  };
}

/** Vercel calls this for GET requests to /api/yc. */
export async function GET() {
  try {
    const { value: companies, stale } = await cached('yc-all', SIX_HOURS, async () => {
      const all = await fetchJson(YC_ALL_URL, { timeoutMs: 25000 }); // big file → longer timeout
      if (!Array.isArray(all)) throw new Error('Unexpected YC data format');

      const result = [];
      for (const c of all) {
        const niches = nichesFor(c);
        if (niches.length) result.push(slim(c, niches));
      }
      // Newest companies first — usually the most interesting to explore.
      return result.sort((a, b) => b.launchedAt - a.launchedAt);
    });

    return jsonResponse(
      {
        ok: true,
        stale, // true = upstream failed, this is our last good copy
        count: companies.length,
        source: {
          name: 'yc-oss/api (unofficial, community-maintained)',
          url: 'https://github.com/yc-oss/api',
          note: 'Built from Y Combinator’s public company directory. Not affiliated with or endorsed by Y Combinator.',
        },
        companies,
      },
      { cdnSeconds: 6 * 60 * 60 } // CDN keeps it for 6 hours
    );
  } catch (err) {
    // Fail softly: the page shows a friendly message, other tabs keep working.
    return jsonResponse({ ok: false, error: `YC data is unavailable right now: ${errorMessage(err)}`, companies: [] }, { status: 502 });
  }
}
