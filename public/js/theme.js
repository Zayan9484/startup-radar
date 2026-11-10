/**
 * theme.js — the light/dark mode switch.
 *
 * The current theme is stored as <html data-theme="light|dark">, and the CSS
 * colour variables change based on it. A small script in index.html sets it
 * before the page draws; this file only handles the toggle button.
 *
 * Until you click the button, the site follows your device setting (and
 * updates live if your device switches, e.g. at sunset). After you click,
 * your choice is saved in localStorage and wins.
 */
const KEY = 'startupRadar.theme';
const root = document.documentElement;
const media = window.matchMedia('(prefers-color-scheme: dark)');

function savedTheme() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

function apply(theme) {
  root.dataset.theme = theme;
  // Keep the browser UI colour (mobile address bar) in sync.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0e1018' : '#4f46e5');
  // The button describes what it WILL do, for screen readers and tooltips.
  const btn = document.getElementById('theme-toggle');
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  btn?.setAttribute('aria-label', label);
  btn?.setAttribute('title', label);
}

export function initTheme() {
  apply(root.dataset.theme === 'dark' ? 'dark' : 'light');

  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    apply(next);
    try { localStorage.setItem(KEY, next); } catch { /* not saved, still works now */ }
  });

  // Follow the device setting only while the user hasn't chosen.
  media.addEventListener?.('change', (e) => {
    if (!savedTheme()) apply(e.matches ? 'dark' : 'light');
  });
}
