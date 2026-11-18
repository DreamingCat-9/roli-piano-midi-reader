// Fitting a song onto the player's keyboard, whose keys play the pitches low..high.

const OCTAVE_SHIFTS = [0, -12, 12, -24, 24, -36, 36, -48, 48]; // in order of preference for ties

const onKeys = (pitch, low, high) => pitch >= low && pitch <= high;

// Moves a pitch by whole octaves until it lies in low..high (which must span at least an octave).
export function foldPitch(pitch, low, high) {
  while (pitch < low) pitch += 12;
  while (pitch > high) pitch -= 12;
  return pitch;
}

// `played` is the set of selected tracks, or a function telling whether a note is one the player plays.
const playedTest = played => typeof played === 'function' ? played : n => played.has(n.track);

// Octave shift, in semitones, that puts the most played notes on the keys.
export function bestOctaveShift(notes, played, low, high) {
  const isPlayed = playedTest(played);
  let best = 0, bestCount = -1;
  for (const shift of OCTAVE_SHIFTS) {
    let count = 0;
    for (const n of notes) if (isPlayed(n) && onKeys(n.pitch + shift, low, high)) count++;
    if (count > bestCount) { best = shift; bestCount = count; }
  }
  return best;
}

// The song shifted by whole octaves to suit the keys. Played notes that still miss the keys are moved onto them by
// octaves, so each can be lit and played; the other notes keep their place relative to the music.
// `folded` counts the moved notes.
export function fitSong(song, played, low, high) {
  const isPlayed = playedTest(played);
  const shift = bestOctaveShift(song.notes, isPlayed, low, high);
  const canFold = high - low >= 11;
  let folded = 0;
  const notes = song.notes.map(n => {
    let pitch = n.pitch + shift;
    if (canFold && isPlayed(n) && !onKeys(pitch, low, high)) {
      pitch = foldPitch(pitch, low, high);
      folded++;
    } else pitch = foldPitch(pitch, 0, 127);
    return pitch === n.pitch ? n : {...n, pitch};
  });
  return {song: {...song, notes}, shift, folded};
}
