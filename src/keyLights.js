import {sounding, onsets} from './midi.js';
import {lightChanges} from './lights.js';
import {status} from './dom.js';
import {state, now} from './state.js';

// Lights the Piano's keys by sending the song's notes to its MIDI output,
// a little ahead of time with timestamps so the lights stay in time.
let lit = new Map();  // pitch -> timestamp its light was switched on
let scheduledTo = 0;  // song time up to which light changes have been sent

const timestampAt = t => state.origin + (t - state.position) / state.rate * 1000;

function send(next, timestamp, struck) {
  const change = lightChanges(lit, next, timestamp, struck);
  if (state.output) for (const m of change.messages) state.output.send(m.data, m.at);
  lit = change.lit;
}

// Sends every light change between the last call and song time `until`. Throws if the output rejects a message.
export function scheduleLights(time, until) {
  const {song, selected} = state;
  if (scheduledTo < time) {
    send(sounding(song.notes, time, selected), now());
    scheduledTo = time;
  }
  const boundaries = new Set();
  for (const n of song.notes) {
    if (!selected.has(n.track)) continue;
    if (n.start > scheduledTo && n.start <= until) boundaries.add(n.start);
    if (n.end > scheduledTo && n.end <= until) boundaries.add(n.end);
  }
  let from = scheduledTo;
  for (const t of [...boundaries].sort((a, b) => a - b)) {
    send(sounding(song.notes, t, selected), timestampAt(t), onsets(song.notes, from, t, selected));
    from = t;
  }
  scheduledTo = until;
}

// The Piano switches a key's light off when the key is released, even while the song still lights it.
// So a released key that should be lit is lit again, shortly after the Piano has switched it off.
const RELIGHT_DELAY = 30; // ms
export function relightAfterRelease(pitch) {
  const {output} = state, since = lit.get(pitch);
  if (!output || since === undefined || since > now()) return;
  try {
    output.send([0x90, pitch, 127], now() + RELIGHT_DELAY);
  } catch (e) {
    status(`MIDI connection lost: ${e.message}`);
  }
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
}
