/**
 * Remote OK — https://remoteok.com
 *
 * USAGE RULES (from the "legal" item at the start of the API response):
 *  - Link back to the job's URL on Remote OK (a normal link, NOT rel="nofollow")
 *    and mention "Remote OK" as the source.
 *  - Don't use the Remote OK logo; using the name "Remote OK" is fine.
 *  - Send a User-Agent header (fetchJson does this for us).
 */
import { fetchJson } from '../fetch-helpers.js';

export default {
  id: 'remoteok',
  name: 'Remote OK',
  homepage: 'https://remoteok.com',
  ttlMs: 3 * 60 * 60 * 1000,

  async load() {
    const data = await fetchJson('https://remoteok.com/api');
    // Item 0 is the legal notice, not a job — skip anything without a position.
    return data
      .filter((j) => j && j.position && j.url)
      .map((j) => ({
        id: `remoteok:${j.id}`,
        title: j.position,
        company: j.company,
        location: j.location || 'Worldwide',
        url: j.url, // the Remote OK listing page — required by their terms
        postedAt: j.date || null,
        salary: j.salary_min && j.salary_max ? `$${j.salary_min.toLocaleString('en-US')} – $${j.salary_max.toLocaleString('en-US')}` : '',
        tags: j.tags || [],
        levelHint: null,
      }));
  },
};
