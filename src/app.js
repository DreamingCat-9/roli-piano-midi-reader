// Entry point: wires the modules together and starts the player.
//
//   state.js        shared player state
//   transport.js    play, pause, seek, practice and the 25 ms tick
//   keyLights.js    schedules the song's key lights on the Piano
//   audio.js        song and keyboard audio (samples via piano.js)
//   live.js         keyboard input: notes, sustain, Piano arrow buttons
//   device.js       Web MIDI access, output and input selection, disconnect (the Your Piano sheet)
//   pianoStatus.js  the Piano pill in the top bar
//   song.js         loading a song (or the demo), track list
//   library.js      your songs, kept in this browser: open, remove, resume where you stopped, drop a file
//   loop.js         looping a range of bars
//   keyboard.js     the player's key range
//   arrange.js      what is played: the practised hand (hands.js), fitted to the keys (fit.js)
//   roll.js         canvas piano roll
//   settings.js     settings dialog and instrument picker
//   controls.js     transport buttons, shortcuts, fullscreen, page lifecycle
//   notice.js       experimental-software notice
//
// midi.js, hands.js, fit.js, piano.js, lights.js, buttons.js and practice.js hold the DOM-free logic covered by
// test.mjs.
import {sounding} from './midi.js';
import {state} from './state.js';
import {initNotice} from './notice.js';
import {initSettings} from './settings.js';
import {initLoop} from './loop.js';
import {initLibrary} from './library.js';
import {initKeyboard} from './keyboard.js';
import {initDevice, autoConnect} from './device.js';
import {initControls, showTime} from './controls.js';
import {current, tick} from './transport.js';
import {updateButtonApi} from './pianoButtons.js';
import {updateSongVoices} from './audio.js';
import {pressedPitches} from './live.js';
import {drawRoll} from './roll.js';

function frame() {
  const time = current();
  updateSongVoices(time);
  drawRoll(time, state.playing ? sounding(state.song.notes, time, state.selected) : new Set(), pressedPitches());
  showTime(time);
  requestAnimationFrame(frame);
}

initNotice(autoConnect); // the Piano links by itself once the notice is accepted
initSettings();
initKeyboard();
initDevice();
initControls();
initLoop();
setInterval(updateButtonApi, 1000);
setInterval(tick, 25);
initLibrary(); // the demo, then the last song played, where it was left
frame();
