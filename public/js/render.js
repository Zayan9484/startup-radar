/**
 * render.js — turns data into HTML cards.
 *
 * SAFETY: all text from outside sources goes through escapeHtml() and every
 * link goes through safeUrl(). Without this, a job title like
 * "<img src=x onerror=alert(1)>" could run code on our page (an "XSS" attack).
 *
 * ATTRIBUTION: every card shows where its data came from and links to the
 * original page. Links use rel="noopener" (security) but NOT "nofollow" or
 * "noreferrer", because sources like Remote OK and Remotive ask for normal
 * links back so they get credit for the traffic.
 */
import { getNiche } from './taxonomy.js';

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

/** Make text safe to put inside HTML. */
export function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
const e = escapeHtml; // short alias used in templates below

/** Only allow http(s) links; anything else (e.g. "javascript:") becomes "#". */
export function safeUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '#';
  } catch {
    return '#';
  }
}

/** An outbound link that opens in a new tab. */
const out = (url, label, cls = 'link-out') =>
  `<a class="${cls}" href="${e(safeUrl(url))}" target="_blank" rel="noopener">${e(label)}</a>`;

/** "CircuitHub" → "CI"; "Palo Alto Networks" → "PA". */
function initials(name = '?') {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] || '?') + (words[1]?.[0] || words[0]?.[1] || '')).toUpperCase();
}

/** Same name → same colour, so avatars look consistent between visits. */
function colourFor(name = '') {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 45%)`;
}

const avatar = (name) => `<div class="avatar" style="background:${colourFor(name)}" aria-hidden="true">${e(initials(name))}</div>`;

/** Star button that saves/unsaves a company. `data-*` tells app.js what to do. */
const saveButton = (kind, id, name, saved) =>
  `<button class="save-btn" data-action="save" data-kind="${kind}" data-id="${e(id)}"
     aria-pressed="${saved}" title="${saved ? 'Remove from' : 'Save to'} watchlist"
     aria-label="${saved ? 'Remove' : 'Save'} ${e(name)} ${saved ? 'from' : 'to'} watchlist">${saved ? '★' : '☆'}</button>`;

const nicheTags = (ids = []) =>
  ids.map((id) => getNiche(id)).filter(Boolean)
    .map((n) => `<span class="tag tag-accent">${n.emoji} ${e(n.label)}</span>`).join('');

/** Long location lists ("Albania, Andorra, Austria, …") → "Albania, Andorra, Austria +40 more". */
export function shortLocation(loc = '') {
  const parts = String(loc).split(/[,;]\s*/).filter(Boolean);
  return parts.length > 4 ? `${parts.slice(0, 3).join(', ')} +${parts.length - 3} more` : loc;
}

/** "2026-11-08T…" → "2 days ago". */
export function timeAgo(iso) {
  const t = Date.parse(iso);
  if (!t) return '';
  const days = Math.round((Date.now() - t) / 86400000);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (days < 1) return 'today';
  if (days < 30) return rtf.format(-days, 'day');
  if (days < 365) return rtf.format(-Math.round(days / 30), 'month');
  return rtf.format(-Math.round(days / 365), 'year');
}

/* ------------------------------------------------------------------ */
/* Cards                                                               */
/* ------------------------------------------------------------------ */

/** A YC company card. */
export function ycCard(c, saved) {
  const badges = [
    c.isHiring ? '<span class="tag tag-good">● Hiring</span>' : '',
    c.isRemote ? '<span class="tag tag-info">Remote-friendly</span>' : '',
    c.status && c.status !== 'Active' ? `<span class="tag tag-warn">${e(c.status)}</span>` : '',
  ].join('');

  return `
  <article class="card">
    <div class="card-head">
      ${avatar(c.name)}
      <div class="grow-1">
        <h3 class="card-title">${e(c.name)}</h3>
        <p class="card-sub">${e(c.batch)}${c.location ? ` · ${e(shortLocation(c.location))}` : ''}${c.teamSize ? ` · ${e(c.teamSize)} people` : ''}</p>
      </div>
      ${saveButton('yc', c.id, c.name, saved)}
    </div>
    ${c.oneLiner ? `<p class="card-body">${e(c.oneLiner)}</p>` : ''}
    <div class="meta">${badges}${nicheTags(c.niches)}</div>
    <div class="card-foot">
      ${out(c.ycUrl, 'YC profile')}
      ${c.website ? out(c.website, 'Website') : ''}
      ${c.isHiring ? out(`${c.ycUrl}/jobs`, 'YC jobs') : ''}
    </div>
  </article>`;
}

/**
 * Live hiring badge for a directory company.
 * `board` comes from /api/jobs → boards[company.id]; `loading` = jobs not loaded yet.
 */
function hiringBadge(c, board, loading) {
  if (!c.jobBoard) return '';
  if (loading) return '<span class="tag">Checking openings…</span>';
  if (!board || !board.ok) return '<span class="tag tag-warn" title="The careers board could not be reached. Use the Careers link.">Openings unavailable</span>';
  if (!board.open) return '<span class="tag">No open roles listed today</span>';
  return `<span class="tag tag-good">● Hiring · ${board.open} open role${board.open === 1 ? '' : 's'}</span>` +
    (board.junior ? `<span class="tag tag-good">${board.junior} junior / intern</span>` : '');
}

/**
 * A company-directory card.
 * `extra` = { board, loading, ycBacked } — live info computed in app.js.
 */
export function dirCard(c, saved, { board = null, loading = false, ycBacked = false } = {}) {
  const live = c.jobBoard && board?.ok;
  return `
  <article class="card">
    <div class="card-head">
      ${avatar(c.name)}
      <div class="grow-1">
        <h3 class="card-title">${e(c.name)}</h3>
        <p class="card-sub">${e(c.hq)}</p>
      </div>
      ${saveButton('dir', c.id, c.name, saved)}
    </div>
    <p class="card-body">${e(c.services)}</p>
    <div class="meta">
      ${hiringBadge(c, board, loading)}
      ${c.kind === 'startup' ? '<span class="tag tag-accent">Startup</span>' : ''}
      ${ycBacked ? `<span class="tag tag-warn" title="Also listed in the YC directory">${c.ycBatch ? `YC ${e(c.ycBatch)}` : 'YC-backed'}</span>` : ''}
      ${!c.careersUrl ? '<span class="tag" title="We could not find a public careers or jobs page">No public careers page</span>' : ''}
      ${c.remote ? '<span class="tag tag-info">Remote-friendly</span>' : ''}
      ${nicheTags(c.niches)}
    </div>
    <div class="card-foot">
      ${live ? out(board.boardUrl, 'Open roles') : c.careersUrl ? out(c.careersUrl, 'Careers') : ''}
      ${out(c.website, 'Website')}
      ${live && board.open ? `<button class="link-btn" data-action="company-jobs" data-name="${e(c.name)}">Matching jobs →</button>` : ''}
      <span class="via">Source: ${live ? `official careers page (${e(board.ats)})` : 'official website'}</span>
    </div>
  </article>`;
}

const LEVEL_BADGE = {
  junior: '<span class="tag tag-good">Junior / entry</span>',
  senior: '<span class="tag">Senior</span>',
  unspecified: '<span class="tag">Level not stated</span>',
};

/** A job row. The source credit + link back are required by the feeds' terms. */
export function jobRow(j, saved) {
  const companyId = jobCompanyId(j);
  return `
  <article class="card job">
    ${avatar(j.company || j.title)}
    <div class="job-main">
      <h3 class="card-title">${e(j.title)}</h3>
      <p class="card-sub">
        <strong>${e(j.company || 'Unknown company')}</strong>
        · <span title="${e(j.location)}">${e(shortLocation(j.location))}</span>
        ${j.postedAt ? ` · ${e(timeAgo(j.postedAt))}` : ''}
      </p>
      <div class="meta">
        ${LEVEL_BADGE[j.level] || ''}
        ${j.salary ? `<span class="tag">${e(j.salary)}</span>` : ''}
        ${nicheTags(j.niches)}
      </div>
    </div>
    <div class="job-actions">
      <a class="btn-primary" href="${e(safeUrl(j.url))}" target="_blank" rel="noopener">View on ${e(shortSourceName(j.sourceName))} ↗</a>
      <span class="via">via <a href="${e(safeUrl(j.sourceHome))}" target="_blank" rel="noopener">${e(j.sourceName)}</a></span>
      ${saveButton('job', companyId, j.company || j.title, saved)}
    </div>
  </article>`;
}

/** A saved company in the Watchlist view, with a personal note box. */
export function watchCard(item) {
  return `
  <article class="card">
    <div class="card-head">
      ${avatar(item.name)}
      <div class="grow-1">
        <h3 class="card-title">${e(item.name)}</h3>
        <p class="card-sub">${e(item.subtitle || '')}</p>
      </div>
      <button class="save-btn" data-action="unsave" data-id="${e(item.id)}" aria-pressed="true"
        title="Remove from watchlist" aria-label="Remove ${e(item.name)} from watchlist">★</button>
    </div>
    ${item.description ? `<p class="card-body">${e(item.description)}</p>` : ''}
    <div class="meta">${nicheTags(item.niches)}</div>
    <textarea class="note" data-action="note" data-id="${e(item.id)}" rows="2"
      placeholder="Your notes, e.g. applied 10 Nov, follow up next week…" aria-label="Notes for ${e(item.name)}">${e(item.note || '')}</textarea>
    <div class="card-foot">
      ${(item.links || []).map((l) => out(l.url, l.label)).join('')}
      <span class="via">Source: ${e(item.sourceLabel || '')} · saved ${e(timeAgo(new Date(item.savedAt).toISOString()))}</span>
    </div>
  </article>`;
}

/* ------------------------------------------------------------------ */
/* Snapshots for the watchlist                                         */
/* ------------------------------------------------------------------ */
/* When you save a company we store a small copy of the important fields.
   Each kind of card produces the same shape, so the Watchlist view can
   show them all the same way. */

export const ycSnapshot = (c) => ({
  id: c.id, kind: 'yc', name: c.name,
  subtitle: [c.batch, shortLocation(c.location)].filter(Boolean).join(' · '),
  description: c.oneLiner, niches: c.niches, sourceLabel: 'YC directory (via yc-oss)',
  links: [{ label: 'YC profile', url: c.ycUrl }, ...(c.website ? [{ label: 'Website', url: c.website }] : [])],
});

export const dirSnapshot = (c) => ({
  id: c.id, kind: 'dir', name: c.name, subtitle: c.hq, description: c.services,
  niches: c.niches, sourceLabel: 'official website',
  links: [{ label: 'Careers', url: c.careersUrl }, { label: 'Website', url: c.website }].filter((l) => l.url),
});

export const jobCompanyId = (j) => `job-co:${(j.company || j.title).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

export const jobCompanySnapshot = (j) => ({
  id: jobCompanyId(j), kind: 'job', name: j.company || j.title,
  subtitle: `Seen hiring: ${j.title}`, description: '', niches: j.niches, sourceLabel: j.sourceName,
  links: [{ label: `Job on ${shortSourceName(j.sourceName)}`, url: j.url }],
});

/** "Canonical careers (Greenhouse)" → "Greenhouse" for compact buttons. */
function shortSourceName(name = '') {
  const m = name.match(/\(([^)]+)\)/);
  return m ? m[1] : name;
}

/* ------------------------------------------------------------------ */
/* Status blocks                                                       */
/* ------------------------------------------------------------------ */

export const skeletons = (n = 6) => Array.from({ length: n }, () => '<div class="skeleton"></div>').join('');

export function notice(message, { error = false, retry = null } = {}) {
  return `<div class="notice${error ? ' error' : ''}">
    <div>${e(message)}</div>
    ${retry ? `<button class="btn" data-action="retry" data-what="${e(retry)}">Try again</button>` : ''}
  </div>`;
}

/** One small pill per job source: green = OK, amber = old copy, red = down. */
export function sourcePills(sources = []) {
  return sources.map((s) => {
    const cls = !s.ok ? 'down' : s.stale ? 'stale' : 'ok';
    const label = !s.ok ? `${s.name}: unavailable` : `${s.name}: ${s.count}${s.stale ? ' (cached)' : ''}`;
    const title = !s.ok ? `This source failed: ${s.error}. Other sources still work.` : `${s.count} matching jobs`;
    return `<span class="source-pill ${cls}" title="${e(title)}">${e(label)}</span>`;
  }).join('');
}
