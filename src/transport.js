import {Practice} from './practice.js';
import {noteName, loopTimes} from './midi.js';
import {setBrightness} from './lights.js';
import {$, status} from './dom.js';
import {state, now} from './state.js';
import {enableAudio, audioEnabled, silenceSong} from './audio.js';
import {scheduleLights, restartLights, silenceLights, blinkWaiting, DIM_VELOCITY} from './keyLights.js';
import {updateButtonApi} from './pianoButtons.js';
import {Score, ON_TIME} from './score.js';

const LOOKAHEAD = 0.12; // seconds of song sent to the Piano ahead of time, at 100 % speed

// `songEnd(score)` runs when the song plays to its end, with the Score of the run (report.js shows it).
export const hooks = {songEnd: null};

let playingSince = 0; // now() when playback last started, to add up the time played
let arrivedAt = 0;    // now() when the song reached the chord Wait for me waits for

// Starts scoring a run from the current position, unless one is going on in the same mode.
function scoreRun(fresh = false) {
  const waiting = $('stepMode').checked, {song, selected, position} = state;
  if (fresh || state.score?.waiting !== waiting) state.score = new Score(song.notes, selected, song.bars, position, waiting);
}

// Practice.arrive, noting when the song reached a chord to wait for (from the song's clock: the timer may notice
// late on a hidden page).
function arrive(practice, time) {
  const was = practice.waiting, waiting = practice.arrive(time);
  if (waiting && !was) arrivedAt = Math.max(playingSince, state.origin + (practice.next.time - state.position) / state.rate * 1000);
  return waiting;
}

// Current song time. While practising it stops at the chord the player still has to play.
export function current() {
  const {playing, song, practice, position, origin, rate} = state;
  if (!playing) return position;
  return Math.min(song.duration, practice?.next?.time ?? Infinity, position + (now() - origin) / 1000 * rate);
}

const setPlayLabel = () => {
  $('play').classList.toggle('playing', state.playing); // shows the pause icon
  $('play').setAttribute('aria-label', state.playing ? 'Pause' : 'Play');
};

function silence() {
  silenceLights();
  silenceSong();
}

// Clears lights and audio, then resumes scheduling (and practice) from the current position.
function restartFromPosition() {
  silence();
  state.practice = $('stepMode').checked ? new Practice(state.song.notes, state.selected, state.position) : null;
  if (state.practice) {
    state.practice.onChord = (group, early) => state.score?.chord(group.time, group.pitches.size, early ? 0 : (now() - arrivedAt) / 1000);
  }
  restartLights(state.position);
}

export function pause() {
  state.position = current();
  if (state.playing && state.score) state.score.playedMs += now() - playingSince;
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
  state.origin = playingSince = now();
  state.playing = true;
  scoreRun();
  restartFromPosition();
  setPlayLabel();
}

export function seekTo(time) {
  const resume = state.playing;
  if (resume && state.score) state.score.playedMs += now() - playingSince;
  state.position = Math.max(0, Math.min(state.song.duration, time));
  state.origin = playingSince = now();
  state.playing = resume && state.position < state.song.duration;
  // A run is scored from where it starts: seeking (or a loop going back) starts a new one
  if (state.playing) scoreRun(true);
  else state.score = null;
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
  const {practice, score} = state;
  if (!state.playing) return;
  if (!practice) { score?.press(pitch, current(), ON_TIME * state.rate); return; }
  // The timer may not have noticed the chord yet (it fires at most once a second on a hidden page).
  arrive(practice, current());
  if (practice.waiting && practice.missing.has(pitch)) {
    score?.rightKey();
    const frozen = current();
    if (practice.press(pitch)) {
      state.position = frozen;
      state.origin = now();
      status('Correct. Continue to the next notes.');
      tick(); // light what comes next now instead of on the next timer tick
    } else showRequired();
    return;
  }
  if (practice.pressEarly(pitch, current(), earlyWindow())) score?.rightKey();
  else score?.wrongKey(current());
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
  // A loop goes back to its first bar once its last bar is over (while practising, once the next chord is past it)
  const loop = loopTimes(song, state.loop);
  if (loop && time >= loop.end - 1e-6) {
    seekTo(loop.start);
    return;
  }
  // A hidden page only gets about one timer tick per second, so practice then sends every light up to the next chord.
  const lookahead = practice && document.hidden ? Infinity : LOOKAHEAD * rate;
  const until = Math.min(song.duration, loop?.end ?? Infinity, practice?.next?.time ?? Infinity, time + lookahead);
  if (practice && arrive(practice, time)) showRequired();
  const lead = Number($('lightEarly').value) * rate; // "Light keys early", in real seconds at any speed
  const dim = $('earlyStyle').value === 'dim';      // keys lit early dimmer, or at full brightness with blinking
  try {
    scheduleLights(time, until, lead, dim ? DIM_VELOCITY : 127);
    blinkWaiting(lead > 0 && !dim);
  } catch (e) {
    pause();
    status(`Could not send MIDI: ${e.message}`);
  }
  if (time >= song.duration && !state.practice?.waiting) {
    pause();
    state.position = song.duration;
    const {score} = state;
    state.score = null;
    hooks.songEnd?.(score);
  }
}
