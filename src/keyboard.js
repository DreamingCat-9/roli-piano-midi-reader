import {noteName} from './midi.js';
import {$, status} from './dom.js';
import {state} from './state.js';
import {fitEnabled, rearrange} from './arrange.js';
import {showPianoStatus} from './pianoStatus.js';
import {knownKeyboard} from './fit.js';

// The player's keyboard: which pitches its keys play. Songs are fitted onto it by arrange.js.
// The range is detected by pressing the leftmost and rightmost keys, and remembered in this browser.
const STORAGE_KEY = 'keyboardRange';
let detecting = null; // 'low' or 'high' while detecting the range
let detectedLow = 0;

const rangeText = ({low, high}) => `${noteName(low)} to ${noteName(high)} (${high - low + 1} keys)`;

function showRange(text = state.keyboard ? `Your keys: ${rangeText(state.keyboard)}.` : 'Not detected yet. A ROLI Piano\'s 49 keys are taken when it links.') {
  $('keyboardRange').textContent = text;
  showPianoStatus();
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

// A Piano linked while no range is known: when its port name tells its keys (a ROLI Piano: 49 keys, C2 to C6),
// they become the range, so the screen draws its keys at once. If it plays another octave (+ / −), the first key
// played outside the range moves it, as below. Returns a sentence for the status line, or ''.
export function assumeKeyboard(portName) {
  const keys = state.keyboard ? null : knownKeyboard(portName);
  if (!keys) return '';
  state.keyboard = keys;
  saveRange();
  showRange();
  return `Its ${keys.high - keys.low + 1} keys are drawn, ${noteName(keys.low)} to ${noteName(keys.high)}; if it plays another octave, play any key and the player follows. ${rearrange()}`.trim();
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
    status(`Keyboard detected: ${rangeText(state.keyboard)}. ${rearrange()}`);
    return true;
  }
  const keyboard = state.keyboard;
  if (!keyboard || (pitch >= keyboard.low && pitch <= keyboard.high)) return false;
  // A key outside the known range: the keyboard was moved by octaves with its + / − buttons.
  const shift = pitch < keyboard.low ? -12 * Math.ceil((keyboard.low - pitch) / 12) : 12 * Math.ceil((pitch - keyboard.high) / 12);
  state.keyboard = {low: keyboard.low + shift, high: keyboard.high + shift};
  saveRange();
  showRange();
  status(`Your keyboard now plays ${rangeText(state.keyboard)}. ${fitEnabled() ? rearrange() : ''}`);
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
    const message = rearrange();
    if (message) status(message);
    else status($('fitSong').checked ? 'Detect your keyboard to fit songs to it.' : 'Songs play at their written pitch.');
  };
}
