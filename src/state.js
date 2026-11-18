// Shared player state. Modules read and update these fields directly, so every field is documented here.
export const state = {
  // Song
  song: null,                    // {notes, tracks, duration} from parseMidi()
  selected: new Set(),           // indexes of the tracks being played

  // Transport
  playing: false,
  position: 0,                   // song time (s) at `origin`
  origin: 0,                     // now() (ms) when `position` was last anchored
  rate: 1,                       // playback speed, 1 = 100 %
  practice: null,                // Practice while "Wait for my notes" is on

  // Devices
  midi: null,                    // MIDIAccess
  output: null,                  // Piano output: key lights and BLOCKS SysEx
  input: null,                   // keyboard input
  originalBrightness: new Map(), // output id -> brightness read on first connection

  // Interface
  noticeAccepted: false,         // the experimental-software notice was accepted
};

export const now = () => performance.now();
