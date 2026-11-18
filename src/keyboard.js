import {fitSong} from './fit.js';
import {noteName} from './midi.js';
import {$, status} from './dom.js';
import {state} from './state.js';
import {pause, play} from './transport.js';

// The player's keyboard: which pitches its keys play, and fitting songs onto it.
// The range is detected by pressing the leftmost and rightmost keys, and remembered in this browser.
const STORAGE_KEY = 'keyboardRange';
let detecting = null; // 'low' or 'high' while detecting the range
let detectedLow = 0;

export const fitEnabled = () => Boolean(state.keyboard) && $('fitSong').checked;

const rangeText = ({low, high}) => `${noteName(low)} to ${noteName(high)} (${high - low + 1} keys)`;

function showRange(text = state.keyboard ? `Your keys: ${rangeText(state.keyboard)}.` : 'Not detected yet.') {
  $('keyboardRange').textContent = text;
}

function loadRange() {
  try {
    const range = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Number.isInteger(range?.low) && Number.isInteger(range?.high) && range.low < range.high) state.keyboard = range;
  } catch {}
}

function saveRange() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.keyboard)); } catch {}
}

function describeFit({shift, folded}) {
  const parts = [];
  const octaves = Math.abs(shift / 12);
  if (shift) parts.push(`moved ${octaves} octave${octaves > 1 ? 's' : ''} ${shift > 0 ? 'up' : 'down'}`);
  if (folded) parts.push(`${folded} note${folded > 1 ? 's' : ''} brought onto your keys`);
  return parts.length ? `Fitted to your keys: ${parts.join(', ')}.` : 'The song fits your keys as written.';
}

// Derives the song that is played from the loaded one. Returns a sentence describing the fit, or '' when off.
export function applyFit() {
  const {sourceSong, keyboard, selected} = state;
  if (!sourceSong) return '';
  if (!fitEnabled()) { state.song = sourceSong; return ''; }
  const fit = fitSong(sourceSong, selected, keyboard.low, keyboard.high);
  state.song = fit.song;
  return describeFit(fit);
}

// Applies the fit again, pausing and resuming playback around it.
function refit() {
  const resume = state.playing;
  pause();
  const message = applyFit();
  if (resume) play();
  return message;
}

// Called for every key pressed. Returns true when the press was used for the keyboard range rather than the song.
export function keyboardNote(pitch) {
  if (detecting === 'low') {
    detectedLow = pitch;
    detecting = 'high';
    showRange(`Leftmost key: ${noteName(pitch)}. Now press the rightmost key.`);
    return true;
  }
  if (detecting === 'high') {
    if (pitch <= detectedLow) {
      showRange(`${noteName(pitch)} is not right of ${noteName(detectedLow)}. Press the rightmost key.`);
      return true;
    }
    detecting = null;
    state.keyboard = {low: detectedLow, high: pitch};
    saveRange();
    showRange();
    status(`Keyboard detected: ${rangeText(state.keyboard)}. ${refit()}`);
    return true;
  }
  const keyboard = state.keyboard;
  if (!keyboard || (pitch >= keyboard.low && pitch <= keyboard.high)) return false;
  // A key outside the known range: the keyboard was moved by octaves with its + / − buttons.
  const shift = pitch < keyboard.low ? -12 * Math.ceil((keyboard.low - pitch) / 12) : 12 * Math.ceil((pitch - keyboard.high) / 12);
  state.keyboard = {low: keyboard.low + shift, high: keyboard.high + shift};
  saveRange();
  showRange();
  status(`Your keyboard now plays ${rangeText(state.keyboard)}. ${fitEnabled() ? refit() : ''}`);
  return true;
}

export function initKeyboard() {
  loadRange();
  showRange();
  $('detectRange').onclick = () => {
    if (!state.input) { showRange('Connect your keyboard input first, then try again.'); return; }
    detecting = 'low';
    showRange('Press the leftmost key on your piano.');
  };
  $('settingsDialog').addEventListener('close', () => {
    if (detecting) { detecting = null; showRange(); }
  });
  $('fitSong').onchange = () => {
    const message = refit();
    if (message) status(message);
    else status($('fitSong').checked ? 'Detect your keyboard to fit songs to it.' : 'Songs play at their written pitch.');
  };
}
