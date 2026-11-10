/**
 * app.js — the page's "brain".
 *
 * The pattern is simple and worth knowing:
 *
 *   state  →  render()  →  HTML on screen
 *     ↑                         │
 *     └──── event handlers ◄────┘  (clicks, typing)
 *
 * 1. All filter choices live in one `state` object.
 * 2. render() reads state + loaded data and redraws the visible tab.
 * 3. When the user clicks or types, we update state and call render() again.
 * We never edit bits of the page by hand; we always redraw from state.
 */
import { NICHES, REGIONS, getRegion, hasAnyWord } from './taxonomy.js';
import { loadYc, loadJobs, loadDirectory } from './api-client.js';
import * as watchlist from './watchlist.js';
import { initTheme } from './theme.js';
import {
  ycCard, dirCard, jobRow, watchCard, notice, skeletons, sourcePills,
  ycSnapshot, dirSnapshot, jobCompanySnapshot, jobCompanyId,
} from './render.js';

const PAGE_SIZE = 24; // how many cards to show before "Show more"
const $ = (id) => document.getElementById(id);

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

const state = {
  tab: 'yc',
  niche: 'all',  // 'all' or a niche id from taxonomy.js
  region: 'any', // a region id from taxonomy.js
  yc: { q: '', batch: '', hiring: false, remote: false, active: true, limit: PAGE_SIZE },
  dir: { q: '', remote: false, kind: '', hiring: false, noYc: false },
  jobs: { q: '', level: 'not-senior', source: '', worldwide: true, limit: PAGE_SIZE },
};

/* Loaded data. `null` = still loading. */
const data = {
  yc: null, ycError: null,
  dir: null, dirError: null,
  jobs: null, jobsError: null, jobSources: [],
  boards: {},        // live hiring stats per directory company (from /api/jobs)
  ycHosts: new Set(), // website hostnames of YC companies, to label "YC-backed"
};

/**
 * Main domain of a website, so two URLs for the same company match:
 * "https://about.gitlab.com/jobs" → "gitlab.com", "https://www.n8n.io" → "n8n.io".
 * (Keeps 3 parts for addresses like "example.co.uk".)
 */
function hostOf(url) {
  try {
    const parts = new URL(url).hostname.split('.');
    const keep = parts.length > 2 && parts.at(-2).length <= 3 && parts.at(-1).length === 2 ? 3 : 2;
    return parts.slice(-keep).join('.');
  } catch {
    return '';
  }
}
const isYcBacked = (c) => data.ycHosts.has(hostOf(c.website));

/* Remember the niche/region/tab between visits (a convenience only). */
const PREFS_KEY = 'startupRadar.prefs.v1';
function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    if (p.niche === 'all' || NICHES.some((n) => n.id === p.niche)) state.niche = p.niche;
    if (REGIONS.some((r) => r.id === p.region)) state.region = p.region;
    if (['yc', 'dir', 'jobs', 'watch'].includes(p.tab)) state.tab = p.tab;
  } catch { /* ignore */ }
}
function savePrefs() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify({ niche: state.niche, region: state.region, tab: state.tab })); } catch { /* ignore */ }
}

/* ------------------------------------------------------------------ */
/* Filters — pure functions: (item, state) → true/false                */
/* ------------------------------------------------------------------ */

const matchesNiche = (niches) => state.niche === 'all' || niches.includes(state.niche);

/** Case-insensitive "does any of these fields contain the search text?" */
const matchesText = (q, ...fields) => !q || fields.join(' ').toLowerCase().includes(q.toLowerCase().trim());

function filterYc() {
  const region = getRegion(state.region);
  const f = state.yc;
  return (data.yc || []).filter((c) =>
    matchesNiche(c.niches) &&
    (!region.ycRegions.length || c.regions.some((r) => region.ycRegions.includes(r))) &&
    (!f.batch || c.batch === f.batch) &&
    (!f.hiring || c.isHiring) &&
    (!f.remote || c.isRemote) &&
    (!f.active || c.status === 'Active' || c.status === 'Public') &&
    matchesText(f.q, c.name, c.oneLiner, c.tags.join(' '), c.location)
  );
}

function filterDir() {
  const f = state.dir;
  return (data.dir || []).filter((c) =>
    matchesNiche(c.niches) &&
    (state.region === 'any' || c.regions.includes(state.region) || (state.region === 'remote' && c.remote)) &&
    (!f.remote || c.remote) &&
    (!f.kind || c.kind === f.kind) &&
    (!f.hiring || data.boards[c.id]?.open > 0) &&
    (!f.noYc || !isYcBacked(c)) &&
    matchesText(f.q, c.name, c.services, c.hq)
  );
}

/** Job locations are free text ("USA", "EMEA", "Worldwide"…), so we look for keywords. */
const WORLDWIDE_WORDS = ['worldwide', 'anywhere', 'global', 'remote'];
function jobInRegion(job) {
  const region = getRegion(state.region);
  if (region.id === 'any') return true;
  const loc = job.location || 'Worldwide';
  const isWorldwide = hasAnyWord(loc, WORLDWIDE_WORDS);
  if (region.id === 'remote') return isWorldwide;
  return hasAnyWord(loc, region.jobKeywords) || (state.jobs.worldwide && isWorldwide);
}

function filterJobs() {
  const f = state.jobs;
  return (data.jobs || []).filter((j) =>
    matchesNiche(j.niches) &&
    jobInRegion(j) &&
    (f.level === 'all' || (f.level === 'junior' ? j.level === 'junior' : j.level !== 'senior')) &&
    (!f.source || j.source === f.source) &&
    matchesText(f.q, j.title, j.company)
  );
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function renderFocus() {
  // Niche chips ("All" + one per niche). aria-checked marks the active one.
  const chips = [{ id: 'all', label: 'All niches', emoji: '✨' }, ...NICHES];
  $('niche-chips').innerHTML = chips.map((n) =>
    `<button class="chip" role="radio" data-action="niche" data-id="${n.id}" aria-checked="${state.niche === n.id}">${n.emoji} ${n.label}</button>`
  ).join('');
  $('region-select').value = state.region;
}

function renderTabs() {
  document.querySelectorAll('.tab').forEach((t) => {
    const on = t.dataset.tab === state.tab;
    t.setAttribute('aria-selected', on);
    t.tabIndex = on ? 0 : -1;
  });
  document.querySelectorAll('.panel').forEach((p) => { p.hidden = p.id !== `panel-${state.tab}`; });
  // The niche/region bar doesn't apply to the watchlist.
  $('focus').hidden = state.tab === 'watch';

  // Live counts in the tab labels.
  setCount('yc', data.yc ? filterYc().length : '');
  setCount('dir', data.dir ? filterDir().length : '');
  setCount('jobs', data.jobs ? filterJobs().length : '');
  setCount('watch', watchlist.count() || '');
}
const setCount = (tab, n) => { document.querySelector(`[data-count="${tab}"]`).textContent = n; };

/** Shared logic for a paged list: loading → error → empty → cards + "Show more". */
function renderList({ items, error, all, container, summary, moreBtn, limit, card, emptyMsg, retry, noun, plural = noun + "s" }) {
  if (error && !all) {
    container.innerHTML = notice(error, { error: true, retry });
    summary.textContent = '';
    if (moreBtn) moreBtn.hidden = true;
    return;
  }
  if (!all) { // still loading
    container.innerHTML = skeletons(6);
    summary.textContent = 'Loading…';
    if (moreBtn) moreBtn.hidden = true;
    return;
  }
  summary.textContent = `${items.length.toLocaleString()} ${items.length === 1 ? noun : plural} match your focus`;
  container.innerHTML = items.length ? items.slice(0, limit).map(card).join('') : notice(emptyMsg);
  if (moreBtn) moreBtn.hidden = items.length <= limit;
}

function renderYc() {
  renderList({
    items: data.yc ? filterYc() : [], all: data.yc, error: data.ycError,
    container: $('yc-results'), summary: $('yc-summary'), moreBtn: $('yc-more'),
    limit: state.yc.limit, noun: 'YC company', plural: 'YC companies', retry: 'yc',
    card: (c) => ycCard(c, watchlist.isSaved(c.id)),
    emptyMsg: 'No YC companies match. Try another region, turn off a filter, or pick "All niches".',
  });
}

function renderDir() {
  renderList({
    items: data.dir ? filterDir() : [], all: data.dir, error: data.dirError,
    container: $('dir-results'), summary: $('dir-summary'), moreBtn: null,
    limit: Infinity, noun: 'company', plural: 'companies', retry: 'dir',
    card: (c) => dirCard(c, watchlist.isSaved(c.id), {
      board: data.boards[c.id],
      loading: !data.jobs && !data.jobsError, // jobs (and board stats) still loading
      ycBacked: isYcBacked(c),
    }),
    emptyMsg: 'No companies in the directory match this niche and region yet.',
  });
}

function renderJobs() {
  $('jobs-sources').innerHTML = sourcePills(data.jobSources);
  renderList({
    items: data.jobs ? filterJobs() : [], all: data.jobs, error: data.jobsError,
    container: $('jobs-results'), summary: $('jobs-summary'), moreBtn: $('jobs-more'),
    limit: state.jobs.limit, noun: 'job', retry: 'jobs',
    card: (j) => jobRow(j, watchlist.isSaved(jobCompanyId(j))),
    emptyMsg: 'No matching jobs right now. Try "All levels", "Include worldwide", or another region. New jobs arrive every few hours.',
  });
}

function renderWatch() {
  const items = watchlist.all();
  $('watch-results').innerHTML = items.length
    ? items.map(watchCard).join('')
    : notice('Your watchlist is empty. Tap ☆ on any company or job to save the company here. You can save a company even if it isn’t hiring today.');
  $('watch-export').disabled = $('watch-clear').disabled = !items.length;
}

/** Redraw the tab bar and the visible panel. */
function render() {
  renderTabs();
  ({ yc: renderYc, dir: renderDir, jobs: renderJobs, watch: renderWatch })[state.tab]();
}

/* ------------------------------------------------------------------ */
/* Data loading — each source loads independently                      */
/* ------------------------------------------------------------------ */

async function fetchYc() {
  data.yc = null; data.ycError = null; render();
  const { data: body, error } = await loadYc();
  if (error) data.ycError = error;
  else {
    data.yc = body.companies;
    data.ycHosts = new Set(body.companies.map((c) => hostOf(c.website)).filter(Boolean));
    fillBatchOptions(body.companies);
  }
  render();
}

async function fetchDir() {
  data.dir = null; data.dirError = null; render();
  const { data: body, error } = await loadDirectory();
  if (error) data.dirError = error;
  else data.dir = body.companies;
  render();
}

async function fetchJobs() {
  data.jobs = null; data.jobsError = null; data.jobSources = []; render();
  const { data: body, error } = await loadJobs();
  data.jobSources = body?.sources || [];
  data.boards = body?.boards || {};
  if (error) data.jobsError = error;
  else {
    data.jobs = body.jobs;
    fillSourceOptions(body.sources);
  }
  render();
}

/** Fill the batch dropdown, newest batch first ("Fall 2026", "Summer 2026"…). */
function fillBatchOptions(companies) {
  const season = { Winter: 0, Spring: 1, Summer: 2, Fall: 3 };
  const score = (b) => { const [s, y] = b.split(' '); return (Number(y) || 0) * 10 + (season[s] ?? -1); };
  const batches = [...new Set(companies.map((c) => c.batch))].sort((a, b) => score(b) - score(a));
  $('yc-batch').innerHTML = '<option value="">All batches</option>' +
    batches.map((b) => `<option value="${b}">${b}</option>`).join('');
  $('yc-batch').value = state.yc.batch;
}

function fillSourceOptions(sources = []) {
  $('jobs-source').innerHTML = '<option value="">All sources</option>' +
    sources.filter((s) => s.ok).map((s) => `<option value="${s.id}">${s.name}</option>`).join('');
  $('jobs-source').value = state.jobs.source;
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

/** Run `fn` only after the user stops typing for `ms` milliseconds. */
function debounce(fn, ms = 200) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

/** Find the item behind a ☆ button and build its watchlist snapshot. */
function snapshotFor(kind, id) {
  if (kind === 'yc') { const c = data.yc?.find((x) => x.id === id); return c && ycSnapshot(c); }
  if (kind === 'dir') { const c = data.dir?.find((x) => x.id === id); return c && dirSnapshot(c); }
  if (kind === 'job') { const j = data.jobs?.find((x) => jobCompanyId(x) === id); return j && jobCompanySnapshot(j); }
  return null;
}

function bindEvents() {
  // Tabs (click + arrow keys for keyboard users)
  document.querySelectorAll('.tab').forEach((t) => {
    t.addEventListener('click', () => { state.tab = t.dataset.tab; savePrefs(); render(); });
  });
  document.querySelector('.tabs').addEventListener('keydown', (ev) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(ev.key)) return;
    const tabs = [...document.querySelectorAll('.tab')];
    const i = tabs.findIndex((t) => t.dataset.tab === state.tab);
    const next = tabs[(i + (ev.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    state.tab = next.dataset.tab; savePrefs(); render(); next.focus();
  });

  // Region dropdown
  $('region-select').innerHTML = REGIONS.map((r) => `<option value="${r.id}">${r.label}</option>`).join('');
  $('region-select').addEventListener('change', (ev) => {
    state.region = ev.target.value;
    state.yc.limit = state.jobs.limit = PAGE_SIZE;
    savePrefs(); render();
  });

  // One click handler for the whole page ("event delegation").
  // Buttons carry data-action="…" telling us what to do.
  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-action]');
    if (!btn) return;
    const { action, id, kind, what } = btn.dataset;

    if (action === 'niche') {
      state.niche = id;
      state.yc.limit = state.jobs.limit = PAGE_SIZE;
      savePrefs(); renderFocus(); render();
    } else if (action === 'save') {
      const snap = watchlist.isSaved(id) ? { id } : snapshotFor(kind, id);
      if (!snap) return;
      const nowSaved = watchlist.toggle(snap);
      toast(nowSaved ? `Saved ${snap.name} to your watchlist` : 'Removed from watchlist');
    } else if (action === 'unsave') {
      watchlist.remove(id);
      toast('Removed from watchlist');
    } else if (action === 'company-jobs') {
      // "Matching jobs →" on a company card: open the Jobs tab searching for that company.
      // Show every level, otherwise a company hiring only seniors looks empty.
      state.jobs.q = btn.dataset.name;
      $('jobs-search').value = btn.dataset.name;
      state.jobs.level = 'all';
      $('jobs-level').value = 'all';
      state.jobs.limit = PAGE_SIZE;
      state.tab = 'jobs';
      savePrefs(); render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (action === 'retry') {
      ({ yc: fetchYc, dir: fetchDir, jobs: fetchJobs })[what]?.();
    }
  });

  // Watchlist notes save as you type.
  document.addEventListener('input', debounce((ev) => {
    if (ev.target.dataset?.action === 'note') watchlist.setNote(ev.target.dataset.id, ev.target.value);
  }, 400));

  // YC filters
  $('yc-search').addEventListener('input', debounce((ev) => { state.yc.q = ev.target.value; state.yc.limit = PAGE_SIZE; render(); }));
  $('yc-batch').addEventListener('change', (ev) => { state.yc.batch = ev.target.value; state.yc.limit = PAGE_SIZE; render(); });
  for (const key of ['hiring', 'remote', 'active']) {
    $(`yc-${key}`).addEventListener('change', (ev) => { state.yc[key] = ev.target.checked; state.yc.limit = PAGE_SIZE; render(); });
  }
  $('yc-more').addEventListener('click', () => { state.yc.limit += PAGE_SIZE; render(); });

  // Directory filters
  $('dir-search').addEventListener('input', debounce((ev) => { state.dir.q = ev.target.value; render(); }));
  $('dir-remote').addEventListener('change', (ev) => { state.dir.remote = ev.target.checked; render(); });
  $('dir-kind').addEventListener('change', (ev) => { state.dir.kind = ev.target.value; render(); });
  $('dir-hiring').addEventListener('change', (ev) => { state.dir.hiring = ev.target.checked; render(); });
  $('dir-noyc').addEventListener('change', (ev) => { state.dir.noYc = ev.target.checked; render(); });

  // Job filters
  $('jobs-search').addEventListener('input', debounce((ev) => { state.jobs.q = ev.target.value; state.jobs.limit = PAGE_SIZE; render(); }));
  $('jobs-level').addEventListener('change', (ev) => { state.jobs.level = ev.target.value; state.jobs.limit = PAGE_SIZE; render(); });
  $('jobs-source').addEventListener('change', (ev) => { state.jobs.source = ev.target.value; state.jobs.limit = PAGE_SIZE; render(); });
  $('jobs-worldwide').addEventListener('change', (ev) => { state.jobs.worldwide = ev.target.checked; render(); });
  $('jobs-more').addEventListener('click', () => { state.jobs.limit += PAGE_SIZE; render(); });

  // Watchlist buttons
  $('watch-export').addEventListener('click', () => watchlist.exportJson());
  $('watch-clear').addEventListener('click', () => {
    if (confirm('Remove every company from your watchlist? This cannot be undone.')) watchlist.clear();
  });

  // Whenever the watchlist changes, redraw (stars, counts, watchlist view).
  watchlist.onChange(render);
}

/* ------------------------------------------------------------------ */
/* Start                                                               */
/* ------------------------------------------------------------------ */

initTheme();
loadPrefs();
bindEvents();
renderFocus();
render();
// Load all three data sets in parallel. Each one fails on its own without
// affecting the others.
fetchYc();
fetchDir();
fetchJobs();
