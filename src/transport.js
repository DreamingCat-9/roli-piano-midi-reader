import {Practice} from './practice.js';
import {noteName} from './midi.js';
import {setBrightness} from './lights.js';
import {$, status} from './dom.js';
import {state, now} from './state.js';
import {enableAudio, audioEnabled, silenceSong} from './audio.js';
import {scheduleLights, restartLights, silenceLights} from './keyLights.js';
import {updateButtonApi} from './pianoButtons.js';

const LOOKAHEAD = 0.12; // seconds of song sent to the Piano ahead of time, at 100 % speed

// Current song time. While practising it stops at the chord the player still has to play.
export function current() {
  const {playing, song, practice, position, origin, rate} = state;
  if (!playing) return position;
  return Math.min(song.duration, practice?.next?.time ?? Infinity, position + (now() - origin) / 1000 * rate);
}

const setPlayLabel = () => { $('play').textContent = state.playing ? 'Ⅱ Pause' : '▶ Play'; };

function silence() {
  silenceLights();
  silenceSong();
}

// Clears lights and audio, then resumes scheduling (and practice) from the current position.
function restartFromPosition() {
  silence();
  state.practice = $('stepMode').checked ? new Practice(state.song.notes, state.selected, state.position) : null;
  restartLights(state.position);
}

export function pause() {
  state.position = current();
  state.playing = false;
  state.practice = null;
  silence();
  setPlayLabel();
}

export async function play() {
  if (state.playing) { pause(); return; }
  const {song} = state;
  if (!song.notes.length) { status('This file has no notes to play.'); return; }
  if (state.position >= song.duration) state.position = 0;
  if (audioEnabled()) await enableAudio();
  const {output, midi} = state;
  if (output && midi?.sysexEnabled) await setBrightness(output, state.originalBrightness.get(output.id) ?? 100);
  state.origin = now();
  state.playing = true;
  restartFromPosition();
  setPlayLabel();
}

export function seekTo(time) {
  const resume = state.playing;
  state.position = Math.max(0, Math.min(state.song.duration, time));
  state.origin = now();
  state.playing = resume && state.position < state.song.duration;
  restartFromPosition();
  $('seek').value = state.position;
  setPlayLabel();
  updateButtonApi();
  if (state.playing) tick();
}

export function showRequired() {
  const {practice} = state;
  if (!practice?.waiting) return;
  const names = [...practice.missing].map(noteName);
  status(`Waiting for: ${names.join(', ')}. Play these notes on your keyboard.`);
}

// Seconds of song before a chord in which a key played for it counts ("Count notes played early").
const earlyWindow = () => Number($('earlyWindow').value) * state.rate;

// A key played on the keyboard. While practising, it counts towards the chord being waited for, or towards a chord
// coming within the early window.
export function pressPracticeNote(pitch) {
  const {practice} = state;
  if (!state.playing || !practice) return;
  // The timer may not have noticed the chord yet (it fires at most once a second on a hidden page).
  practice.arrive(current());
  if (practice.waiting && practice.missing.has(pitch)) {
    const frozen = current();
    if (practice.press(pitch)) {
      state.position = frozen;
      state.origin = now();
      status('Correct. Continue to the next notes.');
      tick(); // light what comes next now instead of on the next timer tick
    } else showRequired();
    return;
  }
  practice.pressEarly(pitch, current(), earlyWindow());
  if (practice.waiting) showRequired();
}

// Runs every 25 ms: sends upcoming key lights, stops practice without a keyboard, and ends the song.
export function tick() {
  if (!state.playing) return;
  const {song, practice, rate} = state;
  if (practice && !state.input) {
    pause();
    status('Keyboard input disconnected. Reconnect it to continue practice.');
    return;
  }
  const time = current();
  // A hidden page only gets about one timer tick per second, so practice then sends every light up to the next chord.
  const lookahead = practice && document.hidden ? Infinity : LOOKAHEAD * rate;
  const until = Math.min(song.duration, practice?.next?.time ?? Infinity, time + lookahead);
  if (practice?.arrive(time)) showRequired();
  try {
    scheduleLights(time, until);
  } catch (e) {
    pause();
    status(`Could not send MIDI: ${e.message}`);
  }
  if (time >= song.duration && !state.practice?.waiting) {
    pause();
    state.position = song.duration;
  }
}
