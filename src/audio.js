import {Piano} from './piano.js';
import {onsets} from './midi.js';
import {$} from './dom.js';
import {state} from './state.js';

// One audio context and sampler shared by the song and the live keyboard.
// Voice keys start with 'song:' or 'live:' so each side can be silenced on its own.
let audioContext = null, piano = null;
const songVoices = new Map(); // pitch -> true while the song plays it
let heardTo = 0;              // song time up to which note onsets have been voiced

export const audioEnabled = () => $('audio').checked;

// Creates the audio context on first use and loads the selected instrument. Needs a prior user gesture.
export async function enableAudio() {
  if (!state.noticeAccepted || !audioEnabled()) return;
  audioContext ??= new AudioContext();
  piano ??= new Piano(audioContext);
  await audioContext.resume();
  const name = $('instrument').value;
  if (piano.instrument !== name) {
    $('instrumentStatus').textContent = 'Loading instrument samples…';
    await piano.load(name);
    $('instrumentStatus').textContent = `${$('instrument').selectedOptions[0].text} ready`;
  }
}

// Keeps the song voices in step with `keys`, the pitches sounding at song time `time`.
// Runs every animation frame; a pitch struck again while it sounds is restarted.
export function updateSongVoices(keys, time) {
  if (!audioEnabled() || !state.playing || !piano || state.practice) keys = new Set();
  const struck = keys.size && time > heardTo ? onsets(state.song.notes, heardTo, time, state.selected) : new Set();
  heardTo = time;
  for (const p of songVoices.keys()) {
    if (!keys.has(p)) { piano?.stop(`song:${p}`); songVoices.delete(p); }
  }
  for (const p of keys) {
    if (!songVoices.has(p) || struck.has(p)) { piano.start(`song:${p}`, p, 90); songVoices.set(p, true); }
  }
}

export function silenceSong() {
  piano?.clear('song:');
  songVoices.clear();
}

export function silenceAll() {
  piano?.clear();
  songVoices.clear();
}

export function startLiveVoice(key, pitch, velocity) {
  if (audioEnabled() && audioContext?.state === 'running') piano.start(key, pitch, velocity);
}

export const stopVoice = key => piano?.stop(key);

export const clearLiveVoices = () => piano?.clear('live:');
