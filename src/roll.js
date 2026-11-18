import {upcoming, noteName} from './midi.js';
import {$, TRACK_COLORS} from './dom.js';
import {state} from './state.js';
import {fitEnabled} from './arrange.js';

// Canvas piano roll: notes fall towards an on-screen keyboard.
//
// It speaks the Piano's own language, light:
// - a falling note has a solid head, the moment to press, and a translucent tail, how long to hold;
// - on the keyboard a key to press now is filled and ringed (the ring pulses while Wait for my notes waits),
//   a key to hold is tinted;
// - a key you press sends a beam of light up the roll, in the note's colour, or coral when it is not in the music.
const canvas = $('canvas'), ctx = canvas.getContext('2d');
const KEY_HEIGHT = 78;
const HEAD = 10;            // px, solid head of a falling note
const STRIKE_WINDOW = .15;  // s at 100 % speed: how long a key reads "press now" in normal playback
const BEAM = .55;           // share of the roll's height a beam of light climbs
const WRONG = '#ff6b5e';
const isBlack = p => [1, 3, 6, 8, 10].includes(p % 12);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const alpha = (hex, a) => `rgba(${rgb(hex).join(',')},${a})`;
const mix = (from, to, amount) => {
  const a = rgb(from), b = rgb(to);
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * amount)).join(',')})`;
};
const trackColor = track => TRACK_COLORS[track % TRACK_COLORS.length];

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
    if (!colorOf.has(n.pitch)) colorOf.set(n.pitch, trackColor(n.track));
    if (!practice && time - n.start < STRIKE_WINDOW * rate) strike.add(n.pitch);
  }
  if (practice?.waiting) for (const p of practice.missing) strike.add(p);
  return {colorOf, strike};
}

function roundRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

// Draws song time `time`. `sounding` are the song's pitches sounding now, `pressed` the keys held down.
export function drawRoll(time, sounding, pressed) {
  const rect = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = rect.width, h = rect.height, line = h - KEY_HEIGHT, ahead = Number($('ahead').value);
  const {song, selected, playing, practice} = state;
  const active = new Set([...sounding, ...pressed]);
  const hints = playing && $('anticipate').checked ? upcoming(song.notes, time, selected, .5, active) : new Set();
  const {colorOf, strike} = keyStates(time, playing);
  const waiting = Boolean(practice?.waiting);
  const pulse = waiting && !reducedMotion.matches ? .55 + .45 * Math.sin(performance.now() / 160) : 1;
  ctx.clearRect(0, 0, w, h);
  const [min, max] = keyRange();
  const {whites, geometry} = keyGeometry(min, max, w);

  // Lanes, and one line per second
  for (const p of whites) {
    const g = geometry.get(p);
    ctx.fillStyle = p % 12 === 0 ? '#1b292d' : '#141f25';
    ctx.fillRect(g.x, 0, g.width, line);
    ctx.strokeStyle = '#253237';
    ctx.lineWidth = 1;
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

  // Falling notes. The other hand's notes, when practising one hand, are drawn faintly behind. A note let go before
  // its written end shows the rest, where it only rings, as a faint glow above its tail.
  const y = t => line - (t - time) / ahead * line;
  const drawNote = (n, faint) => {
    if (!selected.has(n.track) || (n.ring ?? n.end) < time || n.start > time + ahead) return;
    const g = geometry.get(n.pitch);
    if (!g) return;
    const color = trackColor(n.track), x = g.x + 2, width = Math.max(1, g.width - 4);
    if (n.ring !== undefined) {
      const ringTop = Math.max(0, y(n.ring)), ringBottom = Math.min(line, y(Math.max(n.end, time)));
      if (ringBottom > ringTop) {
        ctx.fillStyle = alpha(color, .1);
        roundRect(x + 3, ringTop, Math.max(1, width - 6), ringBottom - ringTop, 3);
        ctx.fill();
      }
    }
    if (n.end < time) return;
    const top = Math.max(0, y(n.end));
    const bottom = Math.min(line, y(n.start));
    if (bottom <= top) return;
    const height = Math.max(2, bottom - top);
    if (faint) {
      ctx.fillStyle = alpha(color, .16);
      roundRect(x, top, width, height, 4);
      ctx.fill();
      return;
    }
    const started = n.start <= time;
    // Tail: how long to hold. Brighter once the note sounds.
    ctx.fillStyle = alpha(color, started ? .6 : .24);
    roundRect(x, top, width, height, 4);
    ctx.fill();
    ctx.strokeStyle = alpha(color, started ? 1 : .7);
    ctx.lineWidth = 1.5;
    roundRect(x + .75, top + .75, width - 1.5, height - 1.5, 3.5);
    ctx.stroke();
    // Head: the moment to press, until it reaches the keys
    if (!started) {
      const head = Math.min(HEAD, height);
      ctx.fillStyle = color;
      roundRect(x, bottom - head, width, head, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.fillRect(x + 3, bottom - 2, Math.max(0, width - 6), 1.5);
    }
  };
  for (const n of state.accompaniment) drawNote(n, true);
  for (const n of song.notes) drawNote(n, false);

  // Beams of light from the keys you press: the note's colour, coral for a key not in the music, white when stopped
  const pressedColor = p => !playing ? '#ffffff' : sounding.has(p) || strike.has(p) ? colorOf.get(p) ?? '#ffffff' : WRONG;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of pressed) {
    const g = geometry.get(p);
    if (!g) continue;
    const color = pressedColor(p);
    const beam = ctx.createLinearGradient(0, line, 0, line * (1 - BEAM));
    beam.addColorStop(0, alpha(color, .8));
    beam.addColorStop(.35, alpha(color, .3));
    beam.addColorStop(1, alpha(color, 0));
    ctx.fillStyle = beam;
    ctx.fillRect(g.x, line * (1 - BEAM), g.width, line * BEAM);
  }
  ctx.restore();

  // Keyboard
  ctx.fillStyle = waiting ? '#cfe3ff' : '#8dbdff';
  ctx.fillRect(0, line - 2, w, 2);
  const keyFill = (p, idle, height) => {
    const color = colorOf.get(p) ?? '#ffffff';
    if (pressed.has(p)) {
      // Glowing from the top: white where the beam leaves the key, the note's colour (or coral) below
      const glow = ctx.createLinearGradient(0, line, 0, line + height);
      glow.addColorStop(0, '#ffffff');
      glow.addColorStop(.45, pressedColor(p));
      glow.addColorStop(1, pressedColor(p));
      return glow;
    }
    if (strike.has(p)) return color;
    if (sounding.has(p)) return mix(idle, color, .6);
    if (hints.has(p)) return '#007a00';
    return idle;
  };
  const drawKey = (p, g, height, idle, labelColor) => {
    const inset = isBlack(p) ? 0 : 1, x = g.x + inset, width = g.width - inset * 2;
    const down = pressed.has(p) ? 3 : 0; // a pressed key sinks a little
    ctx.fillStyle = keyFill(p, idle, height);
    ctx.fillRect(x, line + down, width, height - down);
    if (pressed.has(p)) {
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fillRect(x, line, width, down);
    }
    if (strike.has(p) && !pressed.has(p)) {
      ctx.strokeStyle = `rgba(16,23,28,${.35 + .45 * pulse})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 3, line + 3, width - 6, height - 6);
    }
    if (waiting && strike.has(p)) {
      ctx.fillStyle = labelColor;
      ctx.font = '600 11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(noteName(p), x + width / 2, line + height - 10);
    } else if (!isBlack(p) && p % 12 === 0) {
      ctx.fillStyle = '#4b6558';
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(`C${Math.floor(p / 12) - 1}`, x + width / 2, line + height - 10);
    }
  };
  for (const p of whites) drawKey(p, geometry.get(p), KEY_HEIGHT, '#dfe6e0', '#10171c');
  for (let p = min; p <= max; p++) {
    if (isBlack(p)) drawKey(p, geometry.get(p), KEY_HEIGHT * .62, '#111b20', '#10171c');
  }

  // On the hit line: a target over each key to press, a flare over each key you press
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of strike) {
    const g = geometry.get(p);
    if (!g || pressed.has(p)) continue;
    ctx.fillStyle = alpha(colorOf.get(p) ?? '#ffffff', pulse);
    ctx.fillRect(g.x - 2, line - 6, g.width + 4, 6);
  }
  for (const p of pressed) {
    const g = geometry.get(p);
    if (!g) continue;
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.fillRect(g.x - 2, line - 3, g.width + 4, 3);
  }
  ctx.restore();
}
