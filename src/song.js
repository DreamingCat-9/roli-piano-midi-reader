import {parseMidi} from './midi.js';
import {$, status, TRACK_COLORS} from './dom.js';
import {state} from './state.js';
import {pause, play} from './transport.js';
import {applyFit} from './keyboard.js';

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export function loadSong(song, title) {
  pause();
  state.sourceSong = song;
  state.position = 0;
  state.selected = new Set(song.tracks.map((_, i) => i));
  const fit = applyFit();
  $('title').textContent = title;
  $('seek').max = song.duration;
  const list = $('tracks');
  list.replaceChildren();
  song.tracks.forEach((track, i) => {
    const label = document.createElement('label');
    label.className = 'check';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = true;
    box.addEventListener('change', () => {
      const resume = state.playing;
      pause();
      if (box.checked) state.selected.add(i);
      else state.selected.delete(i);
      applyFit(); // the best octave depends on the tracks played
      if (resume) play();
    });
    label.append(box, document.createTextNode(track.name || `Track ${i + 1}`));
    label.style.color = TRACK_COLORS[i % TRACK_COLORS.length];
    list.append(label);
  });
  status(`${song.notes.length} notes · ${song.tracks.length} tracks · Files stay on your computer.${fit ? ` ${fit}` : ''}`);
}

export function loadDemo() {
  const notes = [];
  [60, 64, 67, 72, 71, 67, 64, 62, 65, 69, 74, 72, 69, 65, 64, 60]
    .forEach((pitch, i) => notes.push({pitch, start: i * .5, end: i * .5 + .42, track: 0, velocity: 100}));
  [48, 53, 55, 48]
    .forEach((pitch, i) => notes.push({pitch, start: i * 2, end: i * 2 + 1.8, track: 1, velocity: 80}));
  loadSong({notes, tracks: [{name: 'Melody'}, {name: 'Left hand'}], duration: 8.5}, 'A little warm-up');
}

export function initSongControls() {
  $('loadMidi').onclick = () => $('file').click();
  $('file').onchange = async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > MAX_FILE_SIZE) throw Error('Please use a MIDI file smaller than 20 MB.');
      loadSong(parseMidi(await file.arrayBuffer()), file.name.replace(/\.midi?$/i, ''));
    } catch (error) {
      status(error.message);
    }
    event.target.value = '';
  };
}
