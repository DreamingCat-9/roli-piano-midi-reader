import {decodeNote} from './piano.js';
import {buttonEvents} from './buttons.js';
import {$, mainArea} from './dom.js';
import {state} from './state.js';
import {startLiveVoice, stopVoice, clearLiveVoices} from './audio.js';
import {current, seekTo, pressPracticeNote} from './transport.js';
import {keyboardNote} from './keyboard.js';
import {relightAfterRelease} from './keyLights.js';

// What the player does on the keyboard: notes, sustain pedal and the Piano's arrow buttons.
const SYSEX = 0xf0, CONTROL_CHANGE = 0xb0;
const SUSTAIN = 64, ALL_SOUND_OFF = 120, ALL_NOTES_OFF = 123;
const ARROW_LEFT = 3, ARROW_RIGHT = 4; // BLOCKS button ids
const BUTTON_SEEK = 5;                 // seconds per arrow press

// 'live:channel:pitch' -> decoded note; `down` turns false when the key is released under sustain.
const held = new Map();
const pedal = new Set(); // channels whose sustain pedal is down

// Keys physically down (not those only kept sounding by the sustain pedal).
export const pressedPitches = () => new Set([...held.values()].filter(n => n.down).map(n => n.pitch));

export function clearLive() {
  held.clear();
  pedal.clear();
  clearLiveVoices();
}

export function receiveMidi(event) {
  const data = event.data;
  if (data[0] === SYSEX) { handleButtons(data); return; }
  if ((data[0] & 0xf0) === CONTROL_CHANGE) { handleControl(data[0] & 15, data[1], data[2]); return; }
  const n = decodeNote(data);
  if (!n) return;
  const key = `live:${n.channel}:${n.pitch}`;
  if (n.on) {
    held.set(key, {...n, down: true});
    startLiveVoice(key, n.pitch, n.velocity);
    if (!keyboardNote(n.pitch)) pressPracticeNote(n.pitch);
  } else {
    relightAfterRelease(n.pitch);
    const note = held.get(key);
    if (note && pedal.has(n.channel)) note.down = false;
    else { held.delete(key); stopVoice(key); }
  }
}

function handleButtons(data) {
  if (!$('buttonSeek').checked || !state.noticeAccepted || mainArea().inert) return;
  for (const button of buttonEvents(data)) {
    if (button.down && (button.id === ARROW_LEFT || button.id === ARROW_RIGHT)) {
      seekTo(current() + (button.id === ARROW_RIGHT ? BUTTON_SEEK : -BUTTON_SEEK));
    }
  }
}

function handleControl(channel, controller, value) {
  if (controller === SUSTAIN) {
    if (value >= 64) { pedal.add(channel); return; }
    pedal.delete(channel);
    for (const [key, n] of held) {
      if (n.channel === channel && !n.down) { stopVoice(key); held.delete(key); }
    }
  } else if (controller === ALL_SOUND_OFF || controller === ALL_NOTES_OFF) clearLive();
}
