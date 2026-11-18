// Fitting a song onto the player's keyboard, whose keys play the pitches low..high.

const OCTAVE_SHIFTS = [0, -12, 12, -24, 24, -36, 36, -48, 48]; // in order of preference for ties

const onKeys = (pitch, low, high) => pitch >= low && pitch <= high;

// Moves a pitch by whole octaves until it lies in low..high (which must span at least an octave).
export function foldPitch(pitch, low, high) {
  while (pitch < low) pitch += 12;
  while (pitch > high) pitch -= 12;
  return pitch;
}

// Octave shift, in semitones, that puts the most notes of the selected tracks on the keys.
export function bestOctaveShift(notes, selected, low, high) {
  let best = 0, bestCount = -1;
  for (const shift of OCTAVE_SHIFTS) {
    let count = 0;
    for (const n of notes) if (selected.has(n.track) && onKeys(n.pitch + shift, low, high)) count++;
    if (count > bestCount) { best = shift; bestCount = count; }
  }
  return best;
}

// The song shifted by whole octaves to suit the keys, with the notes that still miss them moved into range by
// octaves, so every note can be lit and played. `folded` counts the moved notes of the selected tracks.
export function fitSong(song, selected, low, high) {
  const shift = bestOctaveShift(song.notes, selected, low, high);
  const canFold = high - low >= 11;
  let folded = 0;
  const notes = song.notes.map(n => {
    let pitch = n.pitch + shift;
    if (canFold && !onKeys(pitch, low, high)) {
      pitch = foldPitch(pitch, low, high);
      if (selected.has(n.track)) folded++;
    } else pitch = foldPitch(pitch, 0, 127);
    return pitch === n.pitch ? n : {...n, pitch};
  });
  return {song: {...song, notes}, shift, folded};
}
