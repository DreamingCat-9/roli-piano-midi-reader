import {fitSong} from './fit.js';
import {holdTimes} from './hands.js';
import {$} from './dom.js';
import {state} from './state.js';
import {pause, play} from './transport.js';

// What is played, built from the loaded song: the notes of the hand being practised (state.song), lit and waited
// for, and the other hand's notes (state.accompaniment). Both are fitted to the player's keys when that is on.
// In state.song a note's `end` is when to let go; `ring`, when set, is the later written end it is heard until.

export const fitEnabled = () => Boolean(state.keyboard) && $('fitSong').checked;
// 'both', 'right' or 'left', from the Hands choice in the transport bar
export const practisedHand = () => document.querySelector('input[name="hand"]:checked')?.value ?? 'both';

function describeFit({shift, folded}) {
  const parts = [];
  const octaves = Math.abs(shift / 12);
  if (shift) parts.push(`moved ${octaves} octave${octaves > 1 ? 's' : ''} ${shift > 0 ? 'up' : 'down'}`);
  if (folded) parts.push(`${folded} note${folded > 1 ? 's' : ''} brought onto your keys`);
  return parts.length ? `Fitted to your keys: ${parts.join(', ')}.` : 'The song fits your keys as written.';
}

// Returns a sentence describing the fit, or '' when the song is not fitted.
export function arrange() {
  const {sourceSong, selected, keyboard} = state;
  if (!sourceSong) return '';
  const hand = practisedHand();
  const isPractised = n => hand === 'both' || n.hand === hand;
  const fit = fitEnabled() ? fitSong(sourceSong, n => selected.has(n.track) && isPractised(n), keyboard.low, keyboard.high) : null;
  const notes = fit ? fit.song.notes : sourceSong.notes;
  // Notes still sounding once their hand has moved out of reach are let go: lit and shown as held only until then
  state.song = {...sourceSong, notes: holdTimes(notes.filter(isPractised), selected)};
  state.accompaniment = notes.filter(n => !isPractised(n));
  state.score = null; // scored notes changed: the next Play starts a new run
  return fit ? describeFit(fit) : '';
}

// Arranges again, pausing and resuming playback around it.
export function rearrange() {
  const resume = state.playing;
  pause();
  const message = arrange();
  if (resume) play();
  return message;
}
