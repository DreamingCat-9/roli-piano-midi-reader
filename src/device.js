import {readBrightness, setBrightness, resetLights} from './lights.js';
import {$, status} from './dom.js';
import {state} from './state.js';
import {pause} from './transport.js';
import {receiveMidi, clearLive} from './live.js';

// Web MIDI access and the choice of Piano output (lights) and keyboard input.

// Ports being opened. Opening a port fires a state change, and the refresh it triggers must keep them selected.
const opening = {output: null, input: null};

function refreshOutputs() {
  const previous = state.output?.id ?? opening.output;
  const available = [...state.midi.outputs.values()].filter(p => p.state === 'connected');
  const select = $('output');
  select.replaceChildren();
  select.add(new Option(available.length ? 'Choose your ROLI Piano output' : 'No MIDI outputs detected', ''));
  select.disabled = !available.length;
  for (const port of available) select.add(new Option(port.name || port.id, port.id));
  if (previous && available.some(p => p.id === previous)) select.value = previous;
  else if (state.output) {
    pause();
    state.output = null;
    $('disconnect').disabled = true;
  }
  if (!state.output) {
    $('connection').textContent = available.length
      ? `${available.length} MIDI output(s) found. Select your Piano.`
      : 'MIDI permission granted, but the browser sees no outputs. Check the Piano in Windows Device Manager for a driver error, then reconnect USB and click Refresh MIDI devices.';
  }
}

function refreshInputs() {
  const previous = state.input?.id ?? opening.input;
  const available = [...state.midi.inputs.values()].filter(p => p.state === 'connected');
  const select = $('input');
  select.replaceChildren();
  select.add(new Option(available.length ? 'Choose keyboard input' : 'No MIDI inputs detected', ''));
  for (const port of available) select.add(new Option(port.name || port.id, port.id));
  select.disabled = !available.length;
  if (previous && available.some(p => p.id === previous)) { select.value = previous; return; }
  if (state.input) state.input.onmidimessage = null;
  state.input = null;
  clearLive();
  const roli = available.find(p => /ROLI|LUMI/i.test(p.name));
  if (roli) {
    select.value = roli.id;
    chooseInput();
  }
}

const refreshPorts = () => {
  refreshOutputs();
  refreshInputs();
};

async function chooseInput() {
  clearLive();
  if (state.input) state.input.onmidimessage = null;
  state.input = null;
  const candidate = state.midi?.inputs.get($('input').value);
  if (!candidate) return;
  opening.input = candidate.id;
  try {
    await candidate.open();
    state.input = candidate;
    candidate.onmidimessage = receiveMidi;
    const tip = state.keyboard ? '' : ' Then use Settings → Detect my keys so songs fit your keyboard.';
    status(`Keyboard audio ready: ${candidate.name}. Play a key to hear it.${tip}`);
  } catch (e) {
    status(`Could not open MIDI input: ${e.message}`);
  } finally {
    if (opening.input === candidate.id) opening.input = null;
  }
}

// Opens the output, then (with SysEx) remembers the Piano's brightness the first time and restores it.
async function chooseOutput() {
  pause();
  state.output = null;
  const candidate = state.midi?.outputs.get($('output').value);
  if (!candidate) return;
  opening.output = candidate.id;
  try {
    await candidate.open();
    state.output = candidate;
    if (state.midi.sysexEnabled) {
      await chooseInput();
      const {originalBrightness} = state;
      if (!originalBrightness.has(candidate.id)) {
        const value = await readBrightness(candidate, state.input);
        originalBrightness.set(candidate.id, value > 0 ? value : 100);
      }
      await setBrightness(candidate, originalBrightness.get(candidate.id));
    }
    $('connection').textContent = `Connected: ${state.output.name}`;
    $('disconnect').disabled = false;
    status('Piano ready. Press Play to light the keys.');
  } catch (e) {
    status(`Could not open MIDI output: ${e.message}`);
  } finally {
    if (opening.output === candidate.id) opening.output = null;
  }
}

async function connect() {
  const connection = $('connection');
  if (!navigator.requestMIDIAccess) {
    connection.textContent = 'Web MIDI is unavailable in this browser. Use desktop Chrome at localhost or HTTPS.';
    status(connection.textContent);
    return;
  }
  const button = $('connect');
  button.disabled = true;
  button.textContent = 'Checking MIDI devices…';
  connection.textContent = 'Waiting for browser MIDI permission…';
  try {
    state.midi = await navigator.requestMIDIAccess({sysex: true});
    refreshPorts();
    state.midi.onstatechange = refreshPorts;
    const roli = [...state.midi.outputs.values()].find(p => p.state === 'connected' && /ROLI Piano/i.test(p.name));
    if (roli) {
      $('output').value = roli.id;
      await chooseOutput();
    } else status(connection.textContent);
  } catch (e) {
    connection.textContent = `MIDI access failed: ${e.message}. Check this site's MIDI permission in Chrome.`;
    status(connection.textContent);
  } finally {
    button.disabled = false;
    button.textContent = state.midi ? 'Refresh MIDI devices' : 'Connect ROLI Piano';
  }
}

// Releases every light and turns the backlight off before closing the ports.
async function disconnect() {
  const button = $('disconnect');
  button.disabled = true;
  button.textContent = 'Clearing lights…';
  const {midi} = state, oldOutput = state.output, oldInput = state.input;
  const stateHandler = midi?.onstatechange;
  if (midi) midi.onstatechange = null; // close events must not auto-open the input again
  if (oldInput) oldInput.onmidimessage = null;
  pause();
  clearLive();
  state.output = null;
  state.input = null;
  const controls = ['connect', 'output', 'input', 'play'];
  for (const id of controls) $(id).disabled = true;
  try {
    await resetLights(oldOutput);
    if (oldOutput && state.midi.sysexEnabled) await setBrightness(oldOutput, 0);
    await oldInput?.close();
    await oldOutput?.close();
    $('output').value = '';
    $('input').value = '';
    $('connection').textContent = 'Disconnected';
    status('Lighting note releases sent. Connect again to resume.');
  } catch (e) {
    state.output = oldOutput;
    state.input = oldInput;
    if (oldInput) oldInput.onmidimessage = receiveMidi;
    button.disabled = false;
    status(`Could not finish clearing lights: ${e.message}. Try Disconnect again.`);
  } finally {
    button.textContent = 'Disconnect & clear lights';
    for (const id of controls) $(id).disabled = false;
    if (state.midi) state.midi.onstatechange = stateHandler;
  }
}

export function initDevice() {
  $('connect').onclick = connect;
  $('output').onchange = chooseOutput;
  $('input').onchange = chooseInput;
  $('disconnect').onclick = disconnect;
}
