import {$, status, closeOnBackdropClick} from './dom.js';
import {state} from './state.js';
import {parseMidi, barAt} from './midi.js';
import {loadSong, loadDemo} from './song.js';
import {current} from './transport.js';

// Your songs: every MIDI file you open is kept in this browser (IndexedDB) with where you stopped in it, and listed
// in the Songs sheet to open again. The song open when you left opens by itself next time, where you stopped.
// Files can also be dropped anywhere on the page. Nothing leaves the computer.
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const LAST_SONG = 'lastSong'; // localStorage: library id of the song open when the page was left
const DB_NAME = 'roli-learn', STORE = 'songs';
// A kept song: {id, title, data: the file's ArrayBuffer, duration, barCount, added, lastPlayed, position, bar}

let database = null;
function db() {
  database ??= new Promise((resolve, reject) => {
    const opening = indexedDB.open(DB_NAME, 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore(STORE, {keyPath: 'id'});
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(opening.error);
  });
  return database;
}

async function request(mode, use) {
  const store = (await db()).transaction(STORE, mode).objectStore(STORE);
  return new Promise((resolve, reject) => {
    const pending = use(store);
    pending.onsuccess = () => resolve(pending.result);
    pending.onerror = () => reject(pending.error);
  });
}
const getSong = id => request('readonly', store => store.get(id));
const allSongs = () => request('readonly', store => store.getAll());
const putSong = song => request('readwrite', store => store.put(song));
const deleteSong = id => request('readwrite', store => store.delete(id));

function rememberLast(id) {
  try {
    if (id) localStorage.setItem(LAST_SONG, id);
    else localStorage.removeItem(LAST_SONG);
  } catch {}
}

const formatTime = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

function whenPlayed(time, now = Date.now()) {
  const day = t => new Date(t).toDateString();
  if (day(time) === day(now)) return 'today';
  if (day(time) === day(now - 864e5)) return 'yesterday';
  return new Date(time).toLocaleDateString('en', {month: 'short', day: 'numeric'});
}

// Keeps where the open song is, to continue from there. Runs every few seconds and when the page is left.
let lastSaved = {id: null, position: -1};
async function savePosition() {
  const id = state.songId, position = current(), bars = state.song?.bars ?? [];
  if (!id || (lastSaved.id === id && Math.abs(lastSaved.position - position) < .5)) return;
  lastSaved = {id, position};
  try {
    const song = await getSong(id);
    if (!song) return;
    Object.assign(song, {position, bar: barAt(bars, position) + 1, lastPlayed: Date.now()});
    await putSong(song);
  } catch {} // a browser that cannot keep songs still plays them
}

// Loads a kept song, paused where it was left (unless that was its end).
function openSong(song) {
  const parsed = parseMidi(song.data);
  loadSong(parsed, song.title, song.id);
  rememberLast(song.id);
  lastSaved = {id: song.id, position: song.position ?? 0};
  if (song.position > 0 && song.position < parsed.duration - 1) {
    state.position = song.position;
    status(`${song.title}: continuing at bar ${barAt(parsed.bars, song.position) + 1}. Press Play.`);
  }
}

// Plays a file chosen or dropped, and keeps it. A file kept already continues where it was left.
async function openFile(file) {
  try {
    if (file.size > MAX_FILE_SIZE) throw Error('Please use a MIDI file smaller than 20 MB.');
    const data = await file.arrayBuffer();
    const parsed = parseMidi(data); // a file that is not MIDI stops here, before being kept
    const title = file.name.replace(/\.midi?$/i, ''), id = `${title}|${data.byteLength}`;
    await savePosition();
    let song = null;
    try { song = await getSong(id); } catch {}
    song ??= {id, title, data, added: Date.now(), position: 0};
    Object.assign(song, {duration: parsed.duration, barCount: parsed.bars.length, lastPlayed: Date.now()});
    openSong(song);
    try {
      await putSong(song);
    } catch {
      status(`${title} plays, but this browser cannot keep it in your songs (a private window, or storage turned off).`);
    }
  } catch (error) {
    status(error.message);
  }
}

const trashIcon = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/></svg>';

function songRow(title, details, current, open, remove) {
  const item = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'songRow';
  if (current) button.setAttribute('aria-current', 'true');
  const name = document.createElement('strong'), meta = document.createElement('span');
  name.textContent = title;
  meta.className = 'muted';
  meta.textContent = details;
  button.append(name, meta);
  button.onclick = open;
  item.append(button);
  if (remove) {
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'icon';
    removeButton.innerHTML = trashIcon;
    removeButton.setAttribute('aria-label', `Remove ${title} from your songs`);
    removeButton.title = 'Remove from your songs (the file on your computer stays)';
    removeButton.onclick = remove;
    item.append(removeButton);
  }
  return item;
}

// Fills the Songs sheet: the songs kept, most recently played first, then the demo.
async function showSongs() {
  let songs = [];
  try {
    songs = await allSongs();
    $('libraryNote').textContent = songs.length ? '' : 'Songs you open are kept here, in this browser.';
  } catch {
    $('libraryNote').textContent = 'This browser cannot keep songs (a private window, or storage turned off). Files you open still play.';
  }
  songs.sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0));
  const dialog = $('libraryDialog');
  const rows = songs.map(song => {
    const details = [formatTime(song.duration ?? 0), `played ${whenPlayed(song.lastPlayed ?? song.added)}`];
    if (song.position > 0 && song.bar > 1 && song.position < (song.duration ?? 0) - 1) details.push(`stopped at bar ${song.bar}`);
    return songRow(song.title, details.join(', '), song.id === state.songId, async () => {
      dialog.close();
      if (song.id === state.songId) return;
      await savePosition();
      openSong(await getSong(song.id) ?? song);
    }, async () => {
      try {
        await deleteSong(song.id);
        try { if (localStorage.getItem(LAST_SONG) === song.id) rememberLast(null); } catch {}
        status(`${song.title} removed from your songs. The file on your computer is untouched.`);
      } catch (error) {
        status(`Could not remove ${song.title}: ${error.message}`);
      }
      showSongs();
    });
  });
  rows.push(songRow('A little warm-up', 'Built-in demo, 0:08', !state.songId, async () => {
    dialog.close();
    if (!state.songId) return;
    await savePosition();
    loadDemo();
    rememberLast(null);
  }));
  $('songList').replaceChildren(...rows);
}

// Files dragged over the page: a hint, and the dropped MIDI file plays. The page never opens the file itself.
function initDrop() {
  const hint = $('dropHint');
  let depth = 0;
  const hasFiles = event => [...(event.dataTransfer?.types ?? [])].includes('Files');
  addEventListener('dragenter', event => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    depth++;
    hint.hidden = !state.noticeAccepted;
  });
  addEventListener('dragover', event => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = state.noticeAccepted ? 'copy' : 'none';
  });
  addEventListener('dragleave', event => {
    if (!hasFiles(event)) return;
    depth = Math.max(0, depth - 1);
    if (!depth) hint.hidden = true;
  });
  addEventListener('drop', event => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    depth = 0;
    hint.hidden = true;
    if (!state.noticeAccepted) return;
    const files = [...event.dataTransfer.files], file = files.find(f => /\.midi?$/i.test(f.name)) ?? files[0];
    if (!file) return;
    $('libraryDialog').close();
    openFile(file);
  });
}

export async function initLibrary() {
  loadDemo();
  const dialog = $('libraryDialog');
  $('openLibrary').onclick = () => {
    if (!state.noticeAccepted) return;
    showSongs();
    dialog.showModal();
  };
  $('closeLibrary').onclick = () => dialog.close();
  closeOnBackdropClick(dialog);
  $('loadMidi').onclick = () => $('file').click();
  $('file').onchange = event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    dialog.close();
    openFile(file);
  };
  initDrop();
  setInterval(savePosition, 5000);
  addEventListener('pagehide', savePosition);
  document.addEventListener('visibilitychange', () => { if (document.hidden) savePosition(); });

  // The song open when the page was left, paused where it was
  let last = null;
  try { last = localStorage.getItem(LAST_SONG); } catch {}
  if (!last) return;
  try {
    const song = await getSong(last);
    if (song && !state.songId && !state.playing && !state.position) openSong(song);
  } catch {}
}
