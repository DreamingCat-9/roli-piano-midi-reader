import {onsets} from './midi.js';
import {lightChanges} from './lights.js';
import {status} from './dom.js';
import {state, now} from './state.js';

// Lights the Piano's keys by sending the song's notes to its MIDI output,
// a little ahead of time with timestamps so the lights stay in time.
// With a lead time, a key lights up that long before its note so the hand can get there: dimmer (a lower note-on
// velocity, if the Piano shows it) until the note starts, or at full brightness then a blink when it starts.
let lit = new Map();  // pitch -> {at: timestamp its light was switched on, velocity}
let scheduledTo = 0;  // song time up to which light changes have been sent

export const DIM_VELOCITY = 24;

const timestampAt = t => state.origin + (t - state.position) / state.rate * 1000;

// Velocity of each pitch lit at song time `t`: `earlyVelocity` from `lead` seconds before its note starts, then full
// until it is let go.
function litAt(notes, t, selected, lead, earlyVelocity) {
  const levels = new Map();
  for (const n of notes) {
    if (!selected.has(n.track) || t < n.start - lead || t >= n.end) continue;
    levels.set(n.pitch, Math.max(levels.get(n.pitch) ?? 0, t >= n.start ? 127 : earlyVelocity));
  }
  return levels;
}

function send(next, timestamp, struck) {
  const change = lightChanges(lit, next, timestamp, struck);
  if (state.output) for (const m of change.messages) state.output.send(m.data, m.at);
  lit = change.lit;
}

// Sends every light change between the last call and song time `until`, keys lighting `lead` seconds of song early
// at `earlyVelocity`. Throws if the output rejects a message.
export function scheduleLights(time, until, lead = 0, earlyVelocity = 127) {
  const {song, selected} = state;
  if (scheduledTo < time) {
    send(litAt(song.notes, time, selected, lead, earlyVelocity), now());
    scheduledTo = time;
  }
  const boundaries = new Set();
  for (const n of song.notes) {
    if (!selected.has(n.track)) continue;
    for (const t of [n.start - lead, n.start, n.end]) if (t > scheduledTo && t <= until) boundaries.add(t);
  }
  let from = scheduledTo;
  for (const t of [...boundaries].sort((a, b) => a - b)) {
    send(litAt(song.notes, t, selected, lead, earlyVelocity), timestampAt(t), onsets(song.notes, from, t, selected));
    from = t;
  }
  scheduledTo = until;
}

// While Wait for my notes waits and keys light early at full brightness ("Blinking"), the keys to play now keep
// blinking, so they stand apart from the ones lit ahead. Called on every tick; once a key is played, or the wait
// ends, it shows the song again.
const BLINK = 300; // ms on, then off
const blinking = new Set();
let blinkOn = null;    // whether the blinking keys were last switched on
let blinkChord = null; // the chord they blink for, and since when (they start on)
let blinkSince = 0;
export function blinkWaiting(enabled) {
  const {output, practice} = state;
  if (!output) { blinking.clear(); return; }
  const due = enabled && practice?.waiting ? practice.missing : new Set();
  if (due.size && blinkChord !== practice.next) { blinkChord = practice.next; blinkSince = now(); }
  const on = Math.floor((now() - blinkSince) / BLINK) % 2 === 0;
  for (const p of blinking) {
    if (due.has(p)) continue;
    output.send(lit.has(p) ? [0x90, p, lit.get(p).velocity] : [0x80, p, 0]);
    blinking.delete(p);
  }
  for (const p of due) {
    if (blinking.has(p) && blinkOn === on) continue;
    output.send(on ? [0x90, p, 127] : [0x80, p, 0]);
    blinking.add(p);
  }
  blinkOn = on;
}

// The Piano switches a key's light off when the key is released, even while the song still lights it.
// So a released key that should be lit is lit again, shortly after the Piano has switched it off.
const RELIGHT_DELAY = 30; // ms
export function relightAfterRelease(pitch) {
  const {output} = state, light = lit.get(pitch);
  if (!output || !light || light.at > now()) return;
  try {
    output.send([0x90, pitch, light.velocity], now() + RELIGHT_DELAY);
  } catch (e) {
    status(`MIDI connection lost: ${e.message}`);
  }
}

// Lights `pitches` very dim, medium and full for 3 seconds, to see whether the Piano shows the difference.
export async function testBrightness(pitches) {
  const {output} = state;
  if (!output) return false;
  const velocities = [DIM_VELOCITY, 64, 127];
  pitches.forEach((p, i) => output.send([0x90, p, velocities[i]]));
  await new Promise(resolve => setTimeout(resolve, 3000));
  for (const p of pitches) output.send([0x80, p, 0]);
  return true;
}

// Schedules again from song time `position`, including notes that start exactly there.
export function restartLights(position) {
  scheduledTo = position - 0.000001;
}

// Cancels queued light messages and switches every key light off.
export function silenceLights() {
  const {output} = state;
  if (output) {
    try {
      if (typeof output.clear === 'function') output.clear();
      for (let p = 0; p < 128; p++) output.send([0x80, p, 0]);
    } catch (e) {
      status(`MIDI connection lost: ${e.message}`);
    }
  }
  lit.clear();
  blinking.clear();
}
