// Which hand plays each note, and how long each note needs a finger.

export const SPLIT_PITCH = 60; // middle C
export const REACH = 12;       // semitones a hand can hold while playing on: an octave
export const FINGERS = 5;

const average = pitches => pitches.reduce((sum, p) => sum + p, 0) / pitches.length;
const quartile = (sorted, q) => sorted[Math.floor(q * (sorted.length - 1))];

// Tracks look like hands when, from the highest to the lowest, each sits mostly above the next: the lower quartile
// of its pitches is not below the upper quartile of the next one. Instruments sharing a register do not.
function tracksLookLikeHands(byTrack) {
  const tracks = [...byTrack.values()].map(pitches => [...pitches].sort((a, b) => a - b)).sort((a, b) => average(b) - average(a));
  return tracks.every((pitches, i) => i === 0 || quartile(tracks[i - 1], .25) >= quartile(pitches, .75));
}

// With several tracks that look like hands, each track goes to one hand: those whose average pitch is at or above
// the song's average are the right hand. Otherwise notes are split at middle C.
export function withHands(song) {
  const byTrack = new Map();
  for (const n of song.notes) {
    if (!byTrack.has(n.track)) byTrack.set(n.track, []);
    byTrack.get(n.track).push(n.pitch);
  }
  let handOf = n => n.pitch >= SPLIT_PITCH ? 'right' : 'left';
  if (byTrack.size > 1 && tracksLookLikeHands(byTrack)) {
    const songAverage = average(song.notes.map(n => n.pitch));
    const trackHand = new Map([...byTrack].map(([track, pitches]) => [track, average(pitches) >= songAverage ? 'right' : 'left']));
    handOf = n => trackHand.get(n.track);
  }
  return {...song, notes: song.notes.map(n => ({...n, hand: handOf(n)}))};
}

// A note stops needing a finger once its hand plays a note out of reach of it, more than an octave away, or starts a
// chord that leaves no finger for it (the oldest notes are let go first). It keeps sounding, as under the sustain
// pedal, but no longer has to be held. Such a note gets `end` = when to let go and `ring` = its written end.
// Only notes of the `selected` tracks count.
export function holdTimes(notes, selected, reach = REACH, fingers = FINGERS) {
  const byHand = new Map();
  for (const n of notes) {
    if (!selected.has(n.track)) continue;
    if (!byHand.has(n.hand)) byHand.set(n.hand, []);
    byHand.get(n.hand).push(n);
  }
  const letGo = new Map();
  for (const handNotes of byHand.values()) {
    handNotes.sort((a, b) => a.start - b.start);
    handNotes.forEach((n, i) => {
      for (let j = i + 1; j < handNotes.length && handNotes[j].start < n.end; j++) {
        const next = handNotes[j];
        if (next.start > n.start + 1e-6 && Math.abs(next.pitch - n.pitch) > reach) { letGo.set(n, next.start); break; }
      }
    });
    // Chord by chord, with the notes still held, make room for the new ones
    const stillHeld = (n, t) => (letGo.get(n) ?? n.end) > t + 1e-6;
    let held = [];
    for (let i = 0; i < handNotes.length;) {
      const t = handNotes[i].start;
      let j = i;
      while (j < handNotes.length && handNotes[j].start <= t + 1e-6) j++;
      held = held.filter(n => stillHeld(n, t)).sort((a, b) => a.start - b.start);
      const excess = held.length + (j - i) - fingers;
      if (excess > 0) for (const n of held.slice(0, excess)) letGo.set(n, t);
      held = held.filter(n => stillHeld(n, t)).concat(handNotes.slice(i, j));
      i = j;
    }
  }
  return notes.map(n => letGo.has(n) ? {...n, end: letGo.get(n), ring: n.end} : n);
}
