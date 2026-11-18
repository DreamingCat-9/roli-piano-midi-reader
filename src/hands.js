// Which hand plays each note.
// With several tracks holding notes, each track goes to one hand: those whose average pitch is at or above the song's
// average are the right hand. A single track is split at middle C.
export const SPLIT_PITCH = 60;

const average = pitches => pitches.reduce((sum, p) => sum + p, 0) / pitches.length;

export function withHands(song) {
  const byTrack = new Map();
  for (const n of song.notes) {
    if (!byTrack.has(n.track)) byTrack.set(n.track, []);
    byTrack.get(n.track).push(n.pitch);
  }
  let handOf;
  if (byTrack.size > 1) {
    const songAverage = average(song.notes.map(n => n.pitch));
    const trackHand = new Map([...byTrack].map(([track, pitches]) => [track, average(pitches) >= songAverage ? 'right' : 'left']));
    handOf = n => trackHand.get(n.track);
  } else handOf = n => n.pitch >= SPLIT_PITCH ? 'right' : 'left';
  return {...song, notes: song.notes.map(n => ({...n, hand: handOf(n)}))};
}
