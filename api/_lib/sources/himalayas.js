/**
 * Himalayas — https://himalayas.app
 *
 * USAGE RULES (https://himalayas.app/api):
 *  - Credit Himalayas as the source and link back to the listing on Himalayas.
 *  - Don't resubmit their jobs to other job boards. (We don't.)
 *
 * Himalayas has 100k+ jobs, so instead of downloading everything we use its
 * search endpoint with a couple of keywords per niche (20 results per call).
 */
import { fetchJson } from '../fetch-helpers.js';

// A few searches that cover our niches. The niche filter in jobs.js
// still checks every title afterwards, so loose results get dropped.
// The "junior …" searches surface early-career roles that would otherwise be
// buried under senior ones.
const SEARCHES = [
  'devops', 'cloud engineer', 'security engineer', 'cybersecurity', 'ai engineer', 'automation engineer',
  'junior devops', 'junior cloud', 'junior security', 'security analyst', 'junior ai', 'entry level',
];

export default {
  id: 'himalayas',
  name: 'Himalayas',
  homepage: 'https://himalayas.app',
  ttlMs: 6 * 60 * 60 * 1000,

  async load() {
    // Run the searches in parallel; if a single search fails, keep the others.
    const settled = await Promise.allSettled(
      SEARCHES.map((q) => fetchJson(`https://himalayas.app/jobs/api/search?q=${encodeURIComponent(q)}&sort=recent`))
    );
    const ok = settled.filter((s) => s.status === 'fulfilled');
    if (!ok.length) throw settled[0].reason; // every search failed → report the source as down

    const jobs = ok.flatMap((s) => s.value.jobs || []);
    return jobs.map((j) => ({
      id: `himalayas:${j.guid}`,
      title: j.title,
      company: j.companyName,
      location: j.locationRestrictions?.length ? j.locationRestrictions.join(', ') : 'Worldwide',
      url: j.applicationLink || j.guid, // the listing page on Himalayas
      postedAt: j.pubDate ? new Date(j.pubDate * 1000).toISOString() : null,
      salary: j.minSalary && j.maxSalary ? `${j.currency || ''} ${j.minSalary.toLocaleString('en-US')} – ${j.maxSalary.toLocaleString('en-US')}`.trim() : '',
      tags: j.parentCategories || [],
      levelHint: (j.seniority || []).some((s) => /entry/i.test(s)) ? 'junior'
        : (j.seniority || []).some((s) => /senior|lead|director|executive/i.test(s)) ? 'senior' : null,
    }));
  },
};
