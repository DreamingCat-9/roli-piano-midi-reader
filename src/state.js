// Shared player state. Modules read and update these fields directly, so every field is documented here.
export const state = {
  // Song
  sourceSong: null,              // {notes, tracks, duration, bars} as loaded by parseMidi(); bars = start times
  song: null,                    // what is played (lit, waited for): the practised hand, fitted to the keyboard if on
  accompaniment: [],             // notes of the other hand when practising one: drawn faintly, heard if wanted
  selected: new Set(),           // indexes of the tracks being played
  songId: null,                  // the song's id in the library (library.js), null for the demo
  loop: null,                    // {from, to}: bar indexes (inclusive) played again and again, or null

  // Transport
  playing: false,
  position: 0,                   // song time (s) at `origin`
  origin: 0,                     // now() (ms) when `position` was last anchored
  rate: 1,                       // playback speed, 1 = 100 %
  practice: null,                // Practice while "Wait for me" is on

  // Devices
  midi: null,                    // MIDIAccess
  output: null,                  // Piano output: key lights and BLOCKS SysEx
  input: null,                   // keyboard input
  keyboard: null,                // {low, high}: pitches of the keyboard's leftmost and rightmost keys, once detected
  originalBrightness: new Map(), // output id -> brightness read on first connection

  // Interface
  noticeAccepted: false,         // the experimental-software notice was accepted
};

export const now = () => performance.now();
