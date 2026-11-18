import {noteName} from './midi.js';
import {$} from './dom.js';
import {state} from './state.js';

// The Piano pill in the top bar: whether the Piano is linked, and the keys songs are fitted to. It opens Your Piano.
export function showPianoStatus() {
  const linked = Boolean(state.output), {keyboard} = state;
  $('pianoPill').classList.toggle('linked', linked);
  $('pianoState').textContent = linked ? 'Piano linked' : state.midi ? 'No Piano linked' : 'Connect Piano';
  $('pianoRange').textContent = keyboard ? `${noteName(keyboard.low)}–${noteName(keyboard.high)}` : '';
}
