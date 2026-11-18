import {upcoming, noteName} from './midi.js';
import {$, TRACK_COLORS} from './dom.js';
import {state} from './state.js';
import {fitEnabled} from './arrange.js';

// Canvas piano roll: notes fall towards an on-screen keyboard.
//
// It speaks the Piano's own language, light, in the colour of the hand that plays: amber right, cyan left.
// - a falling note has a solid head, the moment to press, and a translucent tail, how long to hold;
// - on the keyboard a key to press now is tinted and ringed (the ring pulses while Wait for me waits), a key to hold
//   is tinted; while waiting, a label over the hit line says which keys to play;
// - a key you press fills with its hand's colour and sends a beam of light up the roll, coral when it is not in
//   the music.
const canvas = $('canvas'), ctx = canvas.getContext('2d');
const HEAD = 12;            // px, solid head of a falling note
const STRIKE_WINDOW = .15;  // s at 100 % speed: how long a key reads "press now" in normal playback
const BEAM = .5;            // share of the roll's height a beam of light climbs
const FONT = '"Instrument Sans", system-ui, sans-serif';
const COLORS = {
  lane: '#1b1626', octave: '#2a2338', second: '#221c2e', hit: '#f2ece4', bed: '#0f0c16',
  white: '#ece6dc', black: '#241e2e', cLabel: '#5e5770', ink: '#1b1626', idle: '#ffffff', wrong: '#ff6b5e',
};
const HAND_COLORS = {right: '#ffb547', left: '#5ed4e6'};
const isBlack = p => [1, 3, 6, 8, 10].includes(p % 12);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const alpha = (hex, a) => `rgba(${rgb(hex).join(',')},${a})`;
const mix = (from, to, amount) => {
  const a = rgb(from), b = rgb(to);
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * amount)).join(',')})`;
};
const noteColor = n => HAND_COLORS[n.hand] ?? TRACK_COLORS[n.track % TRACK_COLORS.length];

// Pitches shown: the player's keyboard when the song is fitted to it; otherwise at least C3–B5, widened to every
// note of the selected tracks. Always starts and ends on white keys.
function keyRange() {
  let min = 48, max = 83;
  if (fitEnabled()) ({low: min, high: max} = state.keyboard);
  else for (const n of [...state.song.notes, ...state.accompaniment]) {
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

// Colour of each pitch sounding now, and the keys to press now.
function keyStates(time, playing) {
  const {song, selected, practice, rate} = state;
  const colorOf = new Map(), strike = new Set();
  if (!playing) return {colorOf, strike};
  for (const n of song.notes) {
    if (!selected.has(n.track) || n.start > time || n.end <= time) continue;
    if (!colorOf.has(n.pitch)) colorOf.set(n.pitch, noteColor(n));
    if (!practice && time - n.start < STRIKE_WINDOW * rate) strike.add(n.pitch);
  }
  if (practice?.waiting) for (const p of practice.missing) strike.add(p);
  return {colorOf, strike};
}

function roundRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function label(text, x, y, size, color, weight = 700) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fontStretch = 'semi-condensed';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
}

// While Wait for me waits: "Play E4 G4" just above the hit line, beside the keys to play (right of them when it
// fits, so it never covers their notes), in their hand's colour.
function drawCoach(keys, geometry, colorOf, line, width) {
  const shown = keys.filter(p => geometry.has(p)).sort((a, b) => a - b);
  if (!shown.length) return;
  const colors = new Set(shown.map(p => colorOf.get(p) ?? COLORS.hit));
  const color = colors.size === 1 ? [...colors][0] : COLORS.hit;
  const text = `Play ${shown.map(noteName).join(' ')}`;
  ctx.font = `700 17px ${FONT}`;
  ctx.fontStretch = 'normal';
  const textWidth = ctx.measureText(text).width, pillWidth = textWidth + 32, pillHeight = 36;
  const first = geometry.get(shown[0]), last = geometry.get(shown.at(-1)), gap = 12;
  const right = last.x + last.width + gap, left = first.x - gap - pillWidth;
  const x = right + pillWidth <= width - 8 ? right : Math.max(8, left), y = line - pillHeight - 14;
  ctx.fillStyle = color;
  roundRect(x, y, pillWidth, pillHeight, pillHeight / 2);
  ctx.fill();
  ctx.fillStyle = COLORS.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + 16, y + pillHeight / 2 + 1);
}

// Draws song time `time`. `sounding` are the song's pitches sounding now, `pressed` the keys held down.
export function drawRoll(time, sounding, pressed) {
  const rect = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = rect.width, h = rect.height, ahead = Number($('ahead').value);
  const keyHeight = Math.round(Math.min(140, Math.max(84, h * .18))), line = h - keyHeight;
  const {song, selected, playing, practice} = state;
  const active = new Set([...sounding, ...pressed]);
  const hints = playing && $('anticipate').checked ? upcoming(song.notes, time, selected, .5, active) : new Set();
  const {colorOf, strike} = keyStates(time, playing);
  const waiting = Boolean(practice?.waiting);
  const pulse = waiting && !reducedMotion.matches ? .55 + .45 * Math.sin(performance.now() / 160) : 1;
  ctx.clearRect(0, 0, w, h);
  const [min, max] = keyRange();
  const {whites, geometry} = keyGeometry(min, max, w);

  // The roll: a line at each octave's C, a faint line each second
  ctx.fillStyle = COLORS.lane;
  ctx.fillRect(0, 0, w, line);
  ctx.lineWidth = 1;
  ctx.strokeStyle = COLORS.second;
  for (let s = Math.ceil(time); s < time + ahead; s++) {
    const y = Math.round(line - (s - time) / ahead * line) + .5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.strokeStyle = COLORS.octave;
  for (const p of whites) {
    if (p % 12 || p === min) continue;
    const x = Math.round(geometry.get(p).x) + .5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, line);
    ctx.stroke();
  }

  // Falling notes. The other hand's notes, when practising one hand, are drawn as faint outlines behind. A note let
  // go before its written end shows the rest, where it only rings, as a faint glow above its tail.
  const y = t => line - (t - time) / ahead * line;
  const drawNote = (n, faint) => {
    if (!selected.has(n.track) || (n.ring ?? n.end) < time || n.start > time + ahead) return;
    const g = geometry.get(n.pitch);
    if (!g) return;
    const color = noteColor(n), x = g.x + g.width * .12, width = Math.max(2, g.width * .76);
    if (n.ring !== undefined) {
      const ringTop = Math.max(0, y(n.ring)), ringBottom = Math.min(line, y(Math.max(n.end, time)));
      if (ringBottom > ringTop) {
        ctx.fillStyle = alpha(color, .1);
        roundRect(x + 3, ringTop, Math.max(1, width - 6), ringBottom - ringTop, 3);
        ctx.fill();
      }
    }
    if (n.end < time) return;
    const top = Math.max(0, y(n.end)) + 1;
    const bottom = Math.min(line, y(n.start)) - 1;
    if (bottom <= top) return;
    const height = Math.max(2, bottom - top), radius = Math.min(7, width / 3);
    if (faint) {
      ctx.fillStyle = alpha(color, .06);
      roundRect(x, top, width, height, radius);
      ctx.fill();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = alpha(color, .45);
      ctx.lineWidth = 1.5;
      roundRect(x + .75, top + .75, width - 1.5, height - 1.5, radius);
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }
    const started = n.start <= time;
    // Tail: how long to hold. Brighter once the note sounds.
    ctx.fillStyle = alpha(color, started ? .5 : .2);
    roundRect(x, top, width, height, radius);
    ctx.fill();
    ctx.strokeStyle = alpha(color, started ? 1 : .85);
    ctx.lineWidth = 1.5;
    roundRect(x + .75, top + .75, width - 1.5, height - 1.5, radius);
    ctx.stroke();
    // Head: the moment to press, until it reaches the keys
    if (!started) {
      const head = Math.min(HEAD, height);
      ctx.fillStyle = color;
      roundRect(x, bottom - head, width, head, radius);
      ctx.fill();
    }
  };
  for (const n of state.accompaniment) drawNote(n, true);
  for (const n of song.notes) drawNote(n, false);

  // Beams of light from the keys you press: the hand's colour, coral for a key not in the music, white when stopped
  const pressedColor = p => !playing ? COLORS.idle : sounding.has(p) || strike.has(p) ? colorOf.get(p) ?? COLORS.idle : COLORS.wrong;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of pressed) {
    const g = geometry.get(p);
    if (!g) continue;
    const color = pressedColor(p);
    const beam = ctx.createLinearGradient(0, line, 0, line * (1 - BEAM));
    beam.addColorStop(0, alpha(color, .7));
    beam.addColorStop(.35, alpha(color, .25));
    beam.addColorStop(1, alpha(color, 0));
    ctx.fillStyle = beam;
    ctx.fillRect(g.x, line * (1 - BEAM), g.width, line * BEAM);
  }
  ctx.restore();

  // Keyboard
  ctx.fillStyle = COLORS.bed;
  ctx.fillRect(0, line, w, keyHeight);
  const keyFill = (p, idle) => {
    const color = colorOf.get(p) ?? COLORS.idle;
    if (pressed.has(p)) return pressedColor(p);
    if (strike.has(p)) return mix(idle, color, waiting ? .45 : .8);
    if (sounding.has(p)) return mix(idle, color, .45);
    if (hints.has(p)) return mix(idle, COLORS.idle, .5);
    return idle;
  };
  const drawKey = (p, g, height, idle) => {
    const black = isBlack(p), inset = black ? 0 : 1, x = g.x + inset, width = g.width - inset * 2;
    const down = pressed.has(p) ? 3 : 0; // a pressed key sinks a little
    ctx.fillStyle = keyFill(p, idle);
    roundRect(x, line + down, width, height - down, [0, 0, black ? 4 : 6, black ? 4 : 6]);
    ctx.fill();
    if (strike.has(p) && !pressed.has(p)) {
      ctx.strokeStyle = alpha(colorOf.get(p) ?? COLORS.idle, pulse);
      ctx.lineWidth = 4;
      roundRect(x + 2, line + 2, width - 4, height - 4, [0, 0, 5, 5]);
      ctx.stroke();
    }
    const size = Math.round(Math.min(16, Math.max(11, width * .34)));
    if ((waiting && strike.has(p)) || pressed.has(p)) label(noteName(p), x + width / 2, line + height - 12, size, COLORS.ink);
    else if (!black && p % 12 === 0) label(noteName(p), x + width / 2, line + height - 12, 11, COLORS.cLabel, 600);
  };
  for (const p of whites) drawKey(p, geometry.get(p), keyHeight, COLORS.white);
  for (let p = min; p <= max; p++) {
    if (isBlack(p)) drawKey(p, geometry.get(p), keyHeight * .62, COLORS.black);
  }

  // The hit line, with a flare over each key you press
  ctx.fillStyle = waiting ? HAND_COLORS.right : alpha(COLORS.hit, .75);
  ctx.fillRect(0, line - 3, w, 3);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of pressed) {
    const g = geometry.get(p);
    if (!g) continue;
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.fillRect(g.x - 2, line - 3, g.width + 4, 3);
  }
  ctx.restore();
  if (waiting) drawCoach([...practice.missing], geometry, colorOf, line, w);
}
