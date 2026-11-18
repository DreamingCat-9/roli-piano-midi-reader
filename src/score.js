import {barAt} from './midi.js';

// The numbers of the end-of-song report: notes played on time, wrong notes and long waits, bar by bar.
// A Score covers one run through the song, from where Play was pressed to the end, in one mode:
// - in normal playback, a note is on time when its key is pressed within ON_TIME seconds (real time) of it;
// - with Wait for me, a chord's notes are on time when it was played early, or within QUICK seconds of the song
//   reaching it.
export const ON_TIME = .25;   // s
export const QUICK = 1;       // s
export const LONG_WAIT = 3;   // s
export const GOOD = 90;       // % of a bar on time from which it needs no more work

export class Score {
  // `notes`: the notes being played (selected tracks, practised hand); `bars`: bar start times; `from`: song time
  // where the run starts; `waiting`: whether Wait for me is on.
  constructor(notes, selected, bars, from = 0, waiting = false) {
    this.waiting = waiting;
    this.from = from;
    this.bars = bars?.length ? bars : [0];
    this.notes = notes.filter(n => selected.has(n.track) && n.start >= from - 1e-6 && n.end > n.start);
    this.counts = this.bars.map(() => ({total: 0, good: 0, wrong: 0}));
    if (!waiting) for (const n of this.notes) this.counts[barAt(this.bars, n.start)].total++;
    this.hit = new Set();
    this.wrong = 0;
    this.longWaits = 0;
    this.presses = 0;    // keys played during the run
    this.playedMs = 0;   // real time spent playing
  }

  // Normal playback: a key pressed at song time `time`. It counts for the nearest note of that pitch within
  // `tolerance` seconds of song (ON_TIME times the speed) not counted yet; otherwise it is a wrong note.
  press(pitch, time, tolerance) {
    this.presses++;
    let best = null;
    for (const n of this.notes) {
      if (n.pitch !== pitch || this.hit.has(n) || Math.abs(n.start - time) > tolerance + 1e-9) continue;
      if (!best || Math.abs(n.start - time) < Math.abs(best.start - time)) best = n;
    }
    if (!best) { this.#wrong(time); return false; }
    this.hit.add(best);
    this.counts[barAt(this.bars, best.start)].good++;
    return true;
  }

  // Wait for me: a key that counted for a chord, and one that did not, at song time `time`.
  rightKey() { this.presses++; }
  wrongKey(time) {
    this.presses++;
    this.#wrong(time);
  }

  #wrong(time) {
    this.wrong++;
    this.counts[barAt(this.bars, time)].wrong++;
  }

  // Wait for me: the chord at song time `time`, of `size` keys, done `waited` seconds after the song reached it
  // (0 when played early).
  chord(time, size, waited) {
    const bar = this.counts[barAt(this.bars, time)];
    bar.total += size;
    if (waited <= QUICK) bar.good += size;
    if (waited > LONG_WAIT) this.longWaits++;
  }

  // The report: totals, each bar from the first one played ({number, total, good, wrong, accuracy}, accuracy in % or
  // null for a bar without notes or wrong keys), and the bars that need the most work ({from, to}, indexes) or null.
  summary() {
    const first = barAt(this.bars, this.from);
    const bars = this.counts.map((c, i) => ({
      number: i + 1, ...c,
      accuracy: c.total + c.wrong ? Math.round(c.good / (c.total + c.wrong) * 100) : null,
    })).slice(first);
    const total = bars.reduce((sum, b) => sum + b.total, 0), good = bars.reduce((sum, b) => sum + b.good, 0);
    return {total, good, wrong: this.wrong, longWaits: this.longWaits, playedMs: this.playedMs, bars, hardest: hardest(bars, first)};
  }
}

// The weakest bar, with the neighbours about as weak (under 70 % when it is, else under GOOD), up to four bars:
// the passage to practise next.
export const WEAK = 70;
function hardest(bars, first) {
  const below = limit => i => bars[i]?.accuracy != null && bars[i].accuracy < limit ? bars[i].accuracy : Infinity;
  let worst = -1;
  const needsWork = below(GOOD);
  bars.forEach((b, i) => { if (needsWork(i) < (worst < 0 ? Infinity : needsWork(worst))) worst = i; });
  if (worst < 0) return null;
  const weak = below(bars[worst].accuracy < WEAK ? WEAK : GOOD);
  let from = worst, to = worst;
  while (to - from < 3) {
    const left = weak(from - 1), right = weak(to + 1);
    if (left === Infinity && right === Infinity) break;
    if (left <= right) from--;
    else to++;
  }
  return {from: from + first, to: to + first};
}
