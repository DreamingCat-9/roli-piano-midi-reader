import {$} from './dom.js';

// Dark or light: Settings › Theme. The choice is kept in this browser and applied by a line in index.html before
// the page draws; style.css holds the colours of both, roll.js its own for the canvas.
const STORAGE_KEY = 'theme';
const systemLight = window.matchMedia('(prefers-color-scheme: light)');

// Whether the page shows in its light colours now ('system' follows the computer's setting).
export function isLight() {
  const theme = document.documentElement.dataset.theme;
  return theme === 'light' || (theme === 'system' && systemLight.matches);
}

export function initTheme() {
  const select = $('theme');
  select.value = document.documentElement.dataset.theme || 'dark';
  select.onchange = () => {
    document.documentElement.dataset.theme = select.value;
    try { localStorage.setItem(STORAGE_KEY, select.value); } catch {}
  };
}
