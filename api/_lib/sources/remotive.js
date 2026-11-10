/**
 * Remotive — https://remotive.com
 *
 * USAGE RULES (from the "legal notice" inside every API response and
 * https://remotive.com/api-documentation):
 *  - Link back to the job's URL on Remotive AND mention Remotive as the source.
 *  - Don't request too often: "max. 4 times a day" is advised.
 *    → We cache for 6 hours, so at most ~4 calls/day per server instance,
 *      and the Vercel CDN cache sits in front of that.
 *  - Don't put Remotive jobs on third-party job boards, and don't hide jobs
 *    behind sign-ups/email collection. (We do neither.)
 *  - Listings in the free API are delayed by 24 hours.
 */
import { fetchJson } from '../fetch-helpers.js';

export default {
  id: 'remotive',
  name: 'Remotive',
  homepage: 'https://remotive.com',
  ttlMs: 6 * 60 * 60 * 1000,

  async load() {
    const data = await fetchJson('https://remotive.com/api/remote-jobs');
    return (data.jobs || []).map((j) => ({
      id: `remotive:${j.id}`,
      title: j.title,
      company: j.company_name,
      location: j.candidate_required_location || 'Worldwide',
      url: j.url, // the Remotive listing page — required by their terms
      // Remotive dates have no timezone (e.g. "2026-11-08T21:47:58"); treat them as UTC.
      postedAt: toIsoUtc(j.publication_date),
      salary: j.salary || '',
      tags: j.tags || [],
      levelHint: null, // Remotive doesn't say; we use the title instead
    }));
  },
};

function toIsoUtc(s) {
  if (!s) return null;
  const hasZone = /(Z|[+-]\d\d:?\d\d)$/.test(s);
  const d = new Date(hasZone ? s : `${s}Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
