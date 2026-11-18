// Entry point: wires the modules together and starts the player.
//
//   state.js        shared player state
//   transport.js    play, pause, seek, practice and the 25 ms tick
//   keyLights.js    schedules the song's key lights on the Piano
//   audio.js        song and keyboard audio (samples via piano.js)
//   live.js         keyboard input: notes, sustain, Piano arrow buttons
//   device.js       Web MIDI access, output and input selection, disconnect
//   song.js         loading MIDI files and the demo, track list
//   keyboard.js     the player's key range, and fitting songs onto it (fit.js)
//   roll.js         canvas piano roll
//   settings.js     settings dialog and instrument picker
//   controls.js     transport buttons, shortcuts, fullscreen, page lifecycle
//   notice.js       experimental-software notice
//
// midi.js, fit.js, piano.js, lights.js, buttons.js and practice.js hold the DOM-free logic covered by test.mjs.
import {sounding} from './midi.js';
import {state} from './state.js';
import {initNotice} from './notice.js';
import {initSettings} from './settings.js';
import {initSongControls, loadDemo} from './song.js';
import {initKeyboard} from './keyboard.js';
import {initDevice} from './device.js';
import {initControls, showTime} from './controls.js';
import {current, tick} from './transport.js';
import {updateButtonApi} from './pianoButtons.js';
import {updateSongVoices} from './audio.js';
import {heldPitches} from './live.js';
import {drawRoll} from './roll.js';

function frame() {
  const time = current();
  const keys = state.playing ? sounding(state.song.notes, time, state.selected) : new Set();
  updateSongVoices(keys, time);
  for (const pitch of heldPitches()) keys.add(pitch);
  drawRoll(time, keys);
  showTime(time);
  requestAnimationFrame(frame);
}

initNotice();
initSettings();
initKeyboard();
initSongControls();
initDevice();
initControls();
setInterval(updateButtonApi, 1000);
setInterval(tick, 25);
loadDemo();
frame();
