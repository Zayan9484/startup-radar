/**
 * Company job boards — live openings straight from companies' own careers pages.
 *
 * Many startups publish their careers page through an "applicant tracking
 * system" (ATS) such as Ashby, Greenhouse or Lever. These systems offer a
 * PUBLIC, read-only job-board API that employers enable precisely so their
 * openings can be listed elsewhere. No key is needed.
 *
 * Which companies? Every entry in public/data/companies.json that has a
 * "jobBoard" field, for example:
 *     "jobBoard": { "type": "ashby", "token": "n8n" }
 * The token is the last part of the company's board URL:
 *     jobs.ashbyhq.com/<token> · job-boards.greenhouse.io/<token> · jobs.lever.co/<token>
 *
 * This source returns two things:
 *   jobs   → every opening (jobs.js later keeps only niche-matching titles)
 *   boards → per-company stats ({ open, junior, ok }) so the Companies tab
 *            can show a live "Hiring · 23 open roles" badge
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fetchJson, errorMessage } from '../fetch-helpers.js';
import { experienceLevel } from '../job-filters.js';

/** How to talk to each job-board system. */
const ADAPTERS = {
  ashby: {
    label: 'Ashby',
    api: (t) => `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(t)}`,
    page: (t) => `https://jobs.ashbyhq.com/${encodeURIComponent(t)}`,
    jobs: (data) => (data.jobs || []).filter((j) => j.isListed !== false).map((j) => ({
      id: j.id,
      title: j.title,
      location: [j.location, ...(j.secondaryLocations || []).map((s) => s.location)].filter(Boolean).join(', ') + (j.isRemote && !/remote/i.test(j.location || '') ? ' (Remote)' : ''),
      url: j.jobUrl,
      postedAt: j.publishedAt || null,
    })),
  },
  greenhouse: {
    label: 'Greenhouse',
    api: (t) => `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(t)}/jobs`,
    page: (t) => `https://job-boards.greenhouse.io/${encodeURIComponent(t)}`,
    jobs: (data) => (data.jobs || []).map((j) => ({
      id: j.id,
      title: j.title,
      location: j.location?.name || '',
      url: j.absolute_url,
      postedAt: j.first_published || j.updated_at || null,
    })),
  },
  lever: {
    label: 'Lever',
    api: (t) => `https://api.lever.co/v0/postings/${encodeURIComponent(t)}?mode=json`,
    page: (t) => `https://jobs.lever.co/${encodeURIComponent(t)}`,
    jobs: (data) => (Array.isArray(data) ? data : []).map((j) => ({
      id: j.id,
      title: j.text,
      location: j.categories?.allLocations?.join(', ') || j.categories?.location || '',
      url: j.hostedUrl,
      postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
    })),
  },
};

/**
 * Read the directory file. process.cwd() is the project root both locally
 * and on Vercel; vercel.json's "includeFiles" makes sure the file is
 * bundled with the function.
 */
async function loadDirectory() {
  const file = path.join(process.cwd(), 'public', 'data', 'companies.json');
  return JSON.parse(await readFile(file, 'utf8')).companies || [];
}

export default {
  id: 'boards',
  name: 'Company careers pages',
  homepage: '/#companies',
  ttlMs: 3 * 60 * 60 * 1000,

  async load() {
    const companies = (await loadDirectory()).filter((c) => c.jobBoard && ADAPTERS[c.jobBoard.type]);

    // Fetch every board in parallel. One broken board never affects the others.
    const settled = await Promise.allSettled(companies.map(async (c) => {
      const ats = ADAPTERS[c.jobBoard.type];
      const data = await fetchJson(ats.api(c.jobBoard.token), { timeoutMs: 10000 });
      return ats.jobs(data);
    }));

    const jobs = [];
    const boards = {};
    settled.forEach((res, i) => {
      const c = companies[i];
      const ats = ADAPTERS[c.jobBoard.type];
      const boardUrl = ats.page(c.jobBoard.token);

      if (res.status === 'rejected') {
        boards[c.id] = { ok: false, error: errorMessage(res.reason), boardUrl, ats: ats.label };
        return;
      }
      let junior = 0;
      for (const j of res.value) {
        if (!j.title || !j.url) continue;
        if (experienceLevel(j.title) === 'junior') junior++;
        jobs.push({
          id: `board:${c.id}:${j.id}`,
          title: j.title,
          company: c.name,
          companyId: c.id,
          location: j.location || c.hq,
          url: j.url, // the official posting on the company's own careers board
          postedAt: j.postedAt,
          salary: '',
          tags: [],
          levelHint: null,
          // Per-job attribution: "via n8n careers (Ashby)"
          sourceName: `${c.name} careers (${ats.label})`,
          sourceHome: boardUrl,
        });
      }
      boards[c.id] = { ok: true, open: res.value.length, junior, boardUrl, ats: ats.label };
    });

    if (companies.length && Object.values(boards).every((b) => !b.ok)) {
      throw new Error('Every company job board failed to load');
    }
    return { jobs, boards };
  },
};
