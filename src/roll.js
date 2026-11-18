import {upcoming} from './midi.js';
import {$, TRACK_COLORS} from './dom.js';
import {state} from './state.js';

// Canvas piano roll: notes fall towards an on-screen keyboard.
const canvas = $('canvas'), ctx = canvas.getContext('2d');
const KEY_HEIGHT = 78;
const isBlack = p => [1, 3, 6, 8, 10].includes(p % 12);

// Pitches shown: at least C3–B5, widened to every note of the selected tracks, starting and ending on white keys.
function keyRange() {
  let min = 48, max = 83;
  for (const n of state.song.notes) {
    if (state.selected.has(n.track)) { min = Math.min(min, n.pitch); max = Math.max(max, n.pitch); }
  }
  min = Math.max(0, min);
  max = Math.min(127, max);
  while (isBlack(min)) min--;
  while (isBlack(max)) max++;
  return [min, max];
}

// x and width of every key; white keys share `width` evenly.
function keyGeometry(min, max, width) {
  const whites = [];
  for (let p = min; p <= max; p++) if (!isBlack(p)) whites.push(p);
  const unit = width / whites.length, geometry = new Map();
  whites.forEach((p, i) => geometry.set(p, {x: i * unit, width: unit}));
  for (let p = min; p <= max; p++) {
    if (isBlack(p)) geometry.set(p, {x: geometry.get(p - 1).x + unit * .68, width: unit * .64});
  }
  return {whites, geometry};
}

// Draws song time `time`. `keys` are the pitches lit on the keyboard (sounding or held).
export function drawRoll(time, keys) {
  const rect = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = rect.width, h = rect.height, line = h - KEY_HEIGHT, ahead = Number($('ahead').value);
  const {song, selected, playing} = state;
  const hints = playing && $('anticipate').checked ? upcoming(song.notes, time, selected, .5, keys) : new Set();
  ctx.clearRect(0, 0, w, h);
  const [min, max] = keyRange();
  const {whites, geometry} = keyGeometry(min, max, w);

  // Lanes, and one line per second
  for (const p of whites) {
    const g = geometry.get(p);
    ctx.fillStyle = p % 12 === 0 ? '#1b292d' : '#141f25';
    ctx.fillRect(g.x, 0, g.width, line);
    ctx.strokeStyle = '#253237';
    ctx.strokeRect(g.x, 0, g.width, line);
  }
  for (let s = Math.ceil(time); s < time + ahead; s++) {
    const y = line - (s - time) / ahead * line;
    ctx.strokeStyle = '#2a393d';
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Falling notes
  for (const n of song.notes) {
    if (!selected.has(n.track) || n.end < time || n.start > time + ahead) continue;
    const g = geometry.get(n.pitch);
    if (!g) continue;
    const top = Math.max(0, line - (n.end - time) / ahead * line);
    const bottom = Math.min(line, line - (n.start - time) / ahead * line);
    if (bottom <= top) continue;
    ctx.fillStyle = TRACK_COLORS[n.track % TRACK_COLORS.length];
    ctx.globalAlpha = n.start <= time ? 1 : .8;
    ctx.beginPath();
    ctx.roundRect(g.x + 2, top, Math.max(1, g.width - 4), Math.max(2, bottom - top), 4);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Keyboard: white when lit, green for an upcoming hint
  ctx.fillStyle = '#8dbdff';
  ctx.fillRect(0, line - 2, w, 2);
  const keyColor = (p, idle) => keys.has(p) ? '#ffffff' : hints.has(p) ? '#007a00' : idle;
  for (const p of whites) {
    const g = geometry.get(p);
    ctx.fillStyle = keyColor(p, '#dfe6e0');
    ctx.fillRect(g.x + 1, line, g.width - 2, KEY_HEIGHT);
    if (p % 12 === 0) {
      ctx.fillStyle = '#4b6558';
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(`C${Math.floor(p / 12) - 1}`, g.x + g.width / 2, h - 10);
    }
  }
  for (let p = min; p <= max; p++) {
    if (!isBlack(p)) continue;
    const g = geometry.get(p);
    ctx.fillStyle = keyColor(p, '#111b20');
    ctx.fillRect(g.x, line, g.width, KEY_HEIGHT * .62);
  }
}
