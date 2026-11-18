import {Piano} from './piano.js';
import {onsets, sounding, ringing} from './midi.js';
import {$} from './dom.js';
import {state} from './state.js';

// One audio context and sampler shared by the song, the other hand's accompaniment and the live keyboard.
// Voice keys start with 'song:', 'acc:' or 'live:' so each can be silenced on its own.
let audioContext = null, piano = null;
// A group of voices following some notes: `voices` maps pitch -> true while it sounds,
// `heardTo` is the song time up to which note onsets have been voiced.
const voiceGroup = (prefix, velocity) => ({prefix, velocity, voices: new Map(), heardTo: 0});
const song = voiceGroup('song:', 90), accompaniment = voiceGroup('acc:', 70);

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

// Keeps a voice group in step with `keys`, the pitches of `notes` sounding at song time `time`.
// A pitch struck again while it sounds is restarted.
function follow(group, notes, keys, time) {
  const struck = keys.size && time > group.heardTo ? onsets(notes, group.heardTo, time, state.selected) : new Set();
  group.heardTo = time;
  for (const p of group.voices.keys()) {
    if (!keys.has(p)) { piano?.stop(group.prefix + p); group.voices.delete(p); }
  }
  for (const p of keys) {
    if (!group.voices.has(p) || struck.has(p)) { piano.start(group.prefix + p, p, group.velocity); group.voices.set(p, true); }
  }
}

// Runs every animation frame for song time `time`. The practised notes are heard in normal playback, until their
// written end even when let go earlier, and are silent while practising. The other hand, when practising one,
// plays along softer if "Play the other hand" is on.
export function updateSongVoices(time) {
  const on = audioEnabled() && state.playing && piano;
  follow(song, state.song.notes, on && !state.practice ? ringing(state.song.notes, time, state.selected) : new Set(), time);
  const accompanied = on && $('otherHand').checked && state.accompaniment.length;
  follow(accompaniment, state.accompaniment, accompanied ? sounding(state.accompaniment, time, state.selected) : new Set(), time);
}

export function silenceSong() {
  piano?.clear('song:');
  piano?.clear('acc:');
  song.voices.clear();
  accompaniment.voices.clear();
}

export function silenceAll() {
  piano?.clear();
  song.voices.clear();
  accompaniment.voices.clear();
}

export function startLiveVoice(key, pitch, velocity) {
  if (audioEnabled() && audioContext?.state === 'running') piano.start(key, pitch, velocity);
}

export const stopVoice = key => piano?.stop(key);

export const clearLiveVoices = () => piano?.clear('live:');
