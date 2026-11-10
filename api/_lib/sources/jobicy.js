/**
 * Jobicy — https://jobicy.com
 *
 * USAGE RULES (from the API's "friendlyNotice" and https://jobi.cy/apidocs):
 *  - Clearly credit Jobicy with a direct link to the source.
 *  - All "apply" buttons must go to the original job URL from the feed.
 *  - Be gentle with request frequency (we cache for 2 hours).
 */
import { fetchJson } from '../fetch-helpers.js';

export default {
  id: 'jobicy',
  name: 'Jobicy',
  homepage: 'https://jobicy.com',
  ttlMs: 2 * 60 * 60 * 1000,

  async load() {
    // 100 is the largest page Jobicy allows; we filter by niche ourselves.
    const data = await fetchJson('https://jobicy.com/api/v2/remote-jobs?count=100');
    return (data.jobs || []).map((j) => ({
      id: `jobicy:${j.id}`,
      title: decodeEntities(j.jobTitle),
      company: decodeEntities(j.companyName),
      location: j.jobGeo || 'Worldwide',
      url: j.url, // original Jobicy URL — required by their terms
      postedAt: j.pubDate || null,
      salary: j.salaryMin && j.salaryMax
        ? `${j.salaryCurrency || ''} ${j.salaryMin.toLocaleString('en-US')} – ${j.salaryMax.toLocaleString('en-US')}${j.salaryPeriod ? ` / ${j.salaryPeriod}` : ''}`.trim()
        : '',
      tags: j.jobIndustry || [],
      // Jobicy labels the level, e.g. "Entry-Level, Junior", "Senior", "Any".
      levelHint: /entry|junior/i.test(j.jobLevel || '') ? 'junior' : /senior|director|lead/i.test(j.jobLevel || '') ? 'senior' : null,
    }));
  },
};

/** Jobicy sometimes sends HTML entities like "&amp;" in titles. */
function decodeEntities(s = '') {
  return String(s).replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&#8211;/g, '–');
}
