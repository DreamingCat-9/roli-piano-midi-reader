import {$, status, closeOnBackdropClick} from './dom.js';
import {state} from './state.js';
import {enableAudio, silenceAll} from './audio.js';
import {pause, play} from './transport.js';
import {clearLive} from './live.js';
import {updateButtonApi} from './pianoButtons.js';

// Settings dialog and instrument picker.
const INSTRUMENT_ICONS = {acoustic_grand_piano: '🎹', electric_piano_1: '🎛️', drawbar_organ: '🎼', music_box: '🎁', xylophone: '🥁'};
const instrumentCards = () => [...document.querySelectorAll('[data-instrument]')];

function updateInstrumentButton() {
  const select = $('instrument');
  $('instrumentName').textContent = select.selectedOptions[0].text;
  $('instrumentIcon').textContent = INSTRUMENT_ICONS[select.value];
  for (const card of instrumentCards()) card.setAttribute('aria-pressed', String(card.dataset.instrument === select.value));
}

async function changeInstrument() {
  updateInstrumentButton();
  const resume = state.playing;
  pause();
  clearLive();
  $('instrument').disabled = true;
  try {
    await enableAudio();
    if (resume) await play();
  } catch (e) {
    $('instrumentStatus').textContent = 'Could not load this instrument. Select it again to retry.';
    status(e.message);
  } finally {
    $('instrument').disabled = false;
  }
}

function initInstrumentPicker() {
  const dialog = $('instrumentDialog');
  $('openInstrument').onclick = () => { if (state.noticeAccepted) dialog.showModal(); };
  for (const id of ['closeInstrument', 'doneInstrument']) $(id).onclick = () => dialog.close();
  closeOnBackdropClick(dialog);
  $('instrument').onchange = changeInstrument;
  for (const card of instrumentCards()) {
    card.onclick = async () => {
      if ($('instrument').disabled) return;
      $('instrument').value = card.dataset.instrument;
      dialog.close();
      const cards = instrumentCards();
      cards.forEach(button => button.disabled = true);
      try {
        await changeInstrument();
      } finally {
        cards.forEach(button => button.disabled = false);
      }
    };
  }
}

function initSettingsDialog() {
  const dialog = $('settingsDialog');
  $('openSettings').onclick = () => { if (state.noticeAccepted) dialog.showModal(); };
  for (const id of ['closeSettings', 'doneSettings']) $(id).onclick = () => dialog.close();
  closeOnBackdropClick(dialog);

  $('audio').onchange = () => {
    if (!$('audio').checked) silenceAll();
    else enableAudio().catch(e => status(e.message));
  };
  $('buttonSeek').onchange = () => {
    updateButtonApi();
    if (!$('buttonSeek').checked) return;
    status(state.input && state.output
      ? 'Piano left / right arrows seek 5 seconds. Their native program-change function may also occur.'
      : 'Connect the Piano input and output to use its buttons.');
  };
  $('stepMode').onchange = () => {
    const resume = state.playing;
    pause();
    if ($('stepMode').checked && !state.input) {
      status('Connect a keyboard input before starting Wait for my notes.');
      return;
    }
    if (resume) play();
  };
  $('lightEarly').onchange = () => {
    const resume = state.playing;
    pause(); // the lights already sent were timed for the old setting
    if (resume) play();
  };
  $('speed').oninput = () => {
    const resume = state.playing;
    pause();
    state.rate = Number($('speed').value) / 100;
    $('speedLabel').textContent = `${Math.round(state.rate * 100)}%`;
    if (resume) play();
  };
}

export function initSettings() {
  initSettingsDialog();
  initInstrumentPicker();
}
