/**
 * GET /api/jobs — remote jobs from several free feeds, merged into one list.
 *
 * HOW IT WORKS
 *   1. Ask every source for its jobs AT THE SAME TIME (Promise.allSettled).
 *      "allSettled" waits for all of them but never fails as a whole — if
 *      Remote OK is down, we still return Remotive, Jobicy, etc.
 *   2. Keep only jobs whose TITLE matches one of our niches.
 *   3. Label each job junior / senior / unspecified.
 *   4. Remove duplicates (the same job is often on several boards).
 *   5. Return the jobs plus a status report for every source, so the page
 *      can say "Remote OK is unavailable right now" instead of breaking.
 *   6. Also return live hiring stats per directory company (from their own
 *      careers boards), used by the Companies tab.
 *
 * Region and experience filters are applied in the browser on this list.
 */
import remotive from './_lib/sources/remotive.js';
import remoteok from './_lib/sources/remoteok.js';
import jobicy from './_lib/sources/jobicy.js';
import himalayas from './_lib/sources/himalayas.js';
import companyBoards from './_lib/sources/company-boards.js';
import { cached, jsonResponse, errorMessage } from './_lib/fetch-helpers.js';
import { nichesForTitle, experienceLevel } from './_lib/job-filters.js';

// Company boards go FIRST: when the same job is also on a job board, the
// de-duplication keeps the official careers-page link.
const SOURCES = [companyBoards, remotive, remoteok, jobicy, himalayas];
const MAX_JOBS = 1200; // keeps the response small

export async function GET() {
  // Step 1 — fetch every source in parallel, each with its own cache.
  const settled = await Promise.allSettled(
    SOURCES.map((src) => cached(`jobs:${src.id}`, src.ttlMs, () => src.load()))
  );

  const jobs = [];
  const seen = new Set();
  const sources = []; // per-source status for the UI
  let boards = {};    // per-company hiring stats from company careers boards

  settled.forEach((result, i) => {
    const src = SOURCES[i];

    if (result.status === 'rejected') {
      // This source failed and we had no cached copy. Report it and move on.
      sources.push({ id: src.id, name: src.name, homepage: src.homepage, ok: false, error: errorMessage(result.reason), count: 0 });
      return;
    }

    // A source returns either a plain list of jobs, or { jobs, boards }.
    const value = result.value.value;
    const list = Array.isArray(value) ? value : value.jobs;
    if (value.boards) boards = value.boards;

    let kept = 0;
    for (const job of list) {
      if (!job.title || !job.url) continue;

      // Step 2 — niche filter (title-based).
      const niches = nichesForTitle(job.title);
      if (!niches.length) continue;

      // Step 4 — de-duplicate by company + title.
      const key = `${(job.company || '').toLowerCase().trim()}|${job.title.toLowerCase().trim()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Step 3 — experience level. Then attach source info for attribution.
      jobs.push({
        ...job,
        niches,
        level: experienceLevel(job.title, job.levelHint),
        source: src.id,
        // A job may carry its own credit (e.g. "n8n careers (Ashby)").
        sourceName: job.sourceName || src.name,
        sourceHome: job.sourceHome || src.homepage,
      });
      kept++;
    }
    sources.push({ id: src.id, name: src.name, homepage: src.homepage, ok: true, stale: result.value.stale, count: kept });
  });

  // Newest first; jobs without a date go to the bottom.
  jobs.sort((a, b) => (Date.parse(b.postedAt) || 0) - (Date.parse(a.postedAt) || 0));

  const allFailed = sources.every((s) => !s.ok);
  const someFailed = sources.some((s) => !s.ok);

  return jsonResponse(
    {
      ok: !allFailed,
      fetchedAt: new Date().toISOString(),
      count: Math.min(jobs.length, MAX_JOBS),
      sources,
      boards,
      jobs: jobs.slice(0, MAX_JOBS),
    },
    {
      status: allFailed ? 502 : 200,
      // Healthy → CDN caches 6 h (respects Remotive's "max 4 times a day").
      // Partly broken → retry sooner (1 h) so a recovered feed shows up.
      // Fully broken → don't cache the failure at all.
      cdnSeconds: allFailed ? 0 : someFailed ? 60 * 60 : 6 * 60 * 60,
    }
  );
}
