/**
 * watchlist.js — the saved-companies list, stored in the browser.
 *
 * HOW localStorage WORKS
 *   localStorage is a tiny key → text store built into every browser. It
 *   survives page reloads and restarts, but it lives ONLY in this browser on
 *   this device — nothing is sent to any server. We store our whole watchlist
 *   as one JSON string under a single key.
 *
 * Every read/write is wrapped in try/catch because localStorage can be
 * unavailable (private browsing, storage full, blocked cookies). In that
 * case the watchlist still works for the current visit, it just won't persist.
 */

const KEY = 'startupRadar.watchlist.v1'; // "v1" lets us change the format later safely

let items = load();          // { [id]: savedCompany }
const listeners = new Set(); // functions to call whenever the list changes

/** Read the saved list from localStorage (or start empty). */
function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Write the list back and tell everyone who's listening. */
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable: keep working in memory for this visit */
  }
  listeners.forEach((fn) => fn());
}

/** Run `fn` every time the watchlist changes. */
export function onChange(fn) {
  listeners.add(fn);
}

export const isSaved = (id) => Boolean(items[id]);
export const count = () => Object.keys(items).length;

/** All saved companies, newest first. */
export const all = () => Object.values(items).sort((a, b) => b.savedAt - a.savedAt);

/**
 * Save or un-save a company. `company` is a small "snapshot" object
 * (name, links, location…) so the watchlist still shows something useful
 * even if the original source changes or goes offline.
 * Returns true if it is now saved.
 */
export function toggle(company) {
  if (items[company.id]) {
    delete items[company.id];
    persist();
    return false;
  }
  items[company.id] = { ...company, note: '', savedAt: Date.now() };
  persist();
  return true;
}

export function remove(id) {
  delete items[id];
  persist();
}

/** Update the personal note on a saved company. */
export function setNote(id, note) {
  if (!items[id]) return;
  items[id].note = String(note).slice(0, 1000);
  // Save quietly (no re-render) so typing in the note box isn't interrupted.
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* ignore */ }
}

export function clear() {
  items = {};
  persist();
}

/** Download the watchlist as a .json file (a simple backup). */
export function exportJson() {
  const blob = new Blob([JSON.stringify(all(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: `startup-radar-watchlist-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
