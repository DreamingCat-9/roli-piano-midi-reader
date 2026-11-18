import {fitSong} from './fit.js';
import {$} from './dom.js';
import {state} from './state.js';
import {pause, play} from './transport.js';

// What is played, built from the loaded song: the notes of the hand being practised (state.song), lit and waited
// for, and the other hand's notes (state.accompaniment). Both are fitted to the player's keys when that is on.

export const fitEnabled = () => Boolean(state.keyboard) && $('fitSong').checked;
export const practisedHand = () => $('hand').value; // 'both', 'right' or 'left'

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
  state.song = {...sourceSong, notes: notes.filter(isPractised)};
  state.accompaniment = notes.filter(n => !isPractised(n));
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
