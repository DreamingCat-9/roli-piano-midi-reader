import {apiCommand} from './buttons.js';
import {$, status} from './dom.js';
import {state} from './state.js';

// Switches the Piano to BLOCKS API mode so its arrow buttons report presses over SysEx.
// Sent every second and after each seek to keep the mode active.
export function updateButtonApi() {
  const {output, input, midi} = state;
  if (!$('buttonSeek').checked || !output || !input || !midi?.sysexEnabled) return;
  try {
    output.send(apiCommand(0));
    output.send(apiCommand(3));
  } catch (e) {
    status(`Keyboard button connection failed: ${e.message}`);
  }
}
