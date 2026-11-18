import {status} from './dom.js';
import {state} from './state.js';

// Right after a deploy, the browser may still show the previous version of the published page: GitHub Pages lets
// it keep the page for 10 minutes. That version works (its files carry its own version, scripts/stamp-version.mjs),
// but lacks what was just published. So at start the page asks the server which version is published and, when it
// is another one, reloads once to get it. Locally the files carry no version and nothing is checked.
const RELOADED_FOR = 'reloadedFor'; // sessionStorage: the version a reload was made for, so it is made only once

// The version stamped in a published page, or null.
export const publishedVersion = html => html.match(/src\/app\.js\?v=([\w.-]+)/)?.[1] ?? null;

export async function checkForUpdate(running) {
  if (!running) return;
  let published;
  try {
    const response = await fetch(location.href.split('#')[0], {cache: 'no-store'});
    if (!response.ok) return;
    published = publishedVersion(await response.text());
  } catch {
    return; // offline: keep this version
  }
  if (!published || published === running) return;
  let reloadedAlready = true;
  try {
    reloadedAlready = sessionStorage.getItem(RELOADED_FOR) === published;
    if (!reloadedAlready) sessionStorage.setItem(RELOADED_FOR, published);
  } catch {} // without storage, no automatic reload: it could repeat
  // Reload by itself only before the notice is accepted, when nothing has been done on the page yet
  if (!reloadedAlready && !state.noticeAccepted) location.reload();
  else status('A newer version of the player is published. Reload the page (F5) to get it.');
}
