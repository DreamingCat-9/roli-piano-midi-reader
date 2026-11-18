import {$, status} from './dom.js';
import {state} from './state.js';
import {barAt, loopTimes} from './midi.js';
import {current, seekTo} from './transport.js';

// Loop: plays a few bars again and again, to practise a hard passage. The transport bar's Loop button loops the
// four bars from the one playing; the bar numbers beside it change the range. transport.js does the looping.
const LENGTH = 4; // bars looped by the Loop button

const barCount = () => state.song?.bars?.length || 1;

// Shows the loop on its controls and as a band on the seek bar.
export function showLoop() {
  const {loop, song} = state, range = song ? loopTimes(song, loop) : null, duration = song?.duration || 1;
  $('loop').setAttribute('aria-pressed', String(Boolean(loop)));
  $('loopBars').hidden = !loop;
  $('loopFrom').max = $('loopTo').max = barCount();
  if (loop) {
    $('loopFrom').value = loop.from + 1;
    $('loopTo').value = loop.to + 1;
  }
  $('seek').style.setProperty('--loop-start', `${range ? range.start / duration * 100 : 0}%`);
  $('seek').style.setProperty('--loop-end', `${range ? range.end / duration * 100 : 0}%`);
}

// Loops bars `from` to `to` (indexes, inclusive), and goes to the first when the song is outside them.
export function setLoop(from, to) {
  const last = barCount() - 1;
  from = Math.min(Math.max(0, Math.round(from) || 0), last);
  to = Math.min(Math.max(from, Math.round(to) || 0), last);
  state.loop = {from, to};
  showLoop();
  const range = loopTimes(state.song, state.loop), time = current();
  if (time < range.start || time >= range.end) seekTo(range.start);
  status(from === to ? `Looping bar ${from + 1}.` : `Looping bars ${from + 1} to ${to + 1}.`);
}

export function clearLoop() {
  state.loop = null;
  showLoop();
}

export function initLoop() {
  $('loop').onclick = () => {
    if (state.loop) {
      clearLoop();
      status('Loop off: the song plays to the end.');
      return;
    }
    const bar = barAt(state.song.bars ?? [0], current());
    setLoop(bar, bar + LENGTH - 1);
  };
  // Bar numbers as shown: from 1. Moving one end past the other moves both.
  const from = () => Number($('loopFrom').value) - 1, to = () => Number($('loopTo').value) - 1;
  $('loopFrom').onchange = () => setLoop(from(), Math.max(from(), to()));
  $('loopTo').onchange = () => setLoop(Math.min(from(), to()), to());
  showLoop();
}
