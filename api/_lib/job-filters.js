/**
 * job-filters.js — decides which niche a job belongs to and how senior it is.
 *
 * All rules come from taxonomy.js; this file just applies them.
 */
import { NICHES, JUNIOR_WORDS, SENIOR_WORDS, hasAnyWord } from '../../public/js/taxonomy.js';

/**
 * Which niches does this job title belong to?
 * A title must contain an "include" word and no "exclude" word.
 * Example: "Junior DevOps Engineer" → ['cloud']
 *          "Senior Full-Stack Developer" → [] (generic software role, dropped)
 */
export function nichesForTitle(title = '') {
  return NICHES.filter(
    (n) => hasAnyWord(title, n.jobs.include) && !hasAnyWord(title, n.jobs.exclude)
  ).map((n) => n.id);
}

/**
 * Classify experience level:
 *   'junior'      → clear early-career signal (title words or the feed's own label)
 *   'senior'      → clearly not a beginner role
 *   'unspecified' → no signal either way (often still open to juniors!)
 *
 * Senior words in the title win over everything, because "Senior Associate"
 * is not an entry-level job even though it contains "associate".
 */
export function experienceLevel(rawTitle = '', levelHint = null) {
  // Remove job-ID codes like "JR-216948" or "REQ12345" first, otherwise
  // "JR-216948 DevOps Engineer" would look like a junior role.
  const title = rawTitle.replace(/\b[a-z]{1,4}-?\d{3,}\b/gi, ' ');
  if (hasAnyWord(title, SENIOR_WORDS)) return 'senior';
  if (hasAnyWord(title, JUNIOR_WORDS)) return 'junior';
  if (levelHint === 'junior' || levelHint === 'senior') return levelHint;
  return 'unspecified';
}
