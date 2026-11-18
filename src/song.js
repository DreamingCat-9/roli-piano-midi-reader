import {$, status} from './dom.js';
import {state} from './state.js';
import {pause, play} from './transport.js';
import {arrange} from './arrange.js';
import {withHands} from './hands.js';
import {clearLoop} from './loop.js';

// Loads a parsed song (parseMidi) to play from the start. `id` is its id in the library, null for the demo.
export function loadSong(song, title, id = null) {
  pause();
  state.sourceSong = withHands(song);
  state.songId = id;
  state.position = 0;
  state.selected = new Set(song.tracks.map((_, i) => i));
  const fit = arrange();
  clearLoop();
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
      arrange(); // the best octave depends on the tracks played
      if (resume) play();
    });
    label.append(box, document.createTextNode(track.name || `Track ${i + 1}`));
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
  loadSong({notes, tracks: [{name: 'Melody'}, {name: 'Left hand'}], duration: 8.5, bars: [0, 2, 4, 6, 8]}, 'A little warm-up');
}

