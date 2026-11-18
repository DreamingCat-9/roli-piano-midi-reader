// Gives every file the page loads a URL that changes with each deploy, so a browser never mixes files from two
// versions of the player. GitHub Pages lets browsers keep each file for 10 minutes: right after a deploy, a
// returning visitor could get the new index.html with the old style.css and modules, and the player would break.
//
// The Pages workflow runs it with the commit id:  node scripts/stamp-version.mjs <version>
// It adds ?v=<version> to style.css and src/app.js, and an import map that does the same for every module app.js
// imports. Nothing is stamped locally: npm start sends every file with no-cache.
import {readFileSync, writeFileSync, readdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const STYLE = 'href="style.css"';
const ENTRY = '<script type="module" src="src/app.js"';

// Returns `html` with the stylesheet, the entry module and `modules` (file names in src/) at versioned URLs.
export function stampHtml(html, version, modules) {
  if (!/^[\w.-]+$/.test(version ?? '')) throw Error(`Unusable version: ${version}`);
  if (!html.includes(STYLE) || !html.includes(ENTRY)) throw Error('index.html no longer links style.css and src/app.js as expected.');
  const imports = Object.fromEntries(modules.map(name => [`./src/${name}`, `./src/${name}?v=${version}`]));
  return html
    .replace(STYLE, `href="style.css?v=${version}"`)
    .replace(ENTRY, `<script type="importmap">${JSON.stringify({imports})}</script>${ENTRY.replace('app.js', `app.js?v=${version}`)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = new URL('../', import.meta.url), file = new URL('index.html', root), version = process.argv[2];
  const modules = readdirSync(new URL('src/', root)).filter(name => name.endsWith('.js'));
  writeFileSync(file, stampHtml(readFileSync(file, 'utf8'), version, modules));
  console.log(`index.html stamped with version ${version} for style.css and ${modules.length} modules.`);
}
