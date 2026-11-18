import {$, status, mainArea} from './dom.js';
import {state} from './state.js';
import {resetLights, setBrightness} from './lights.js';
import {enableAudio} from './audio.js';
import {current, pause, play, seekTo} from './transport.js';
import {clearLive} from './live.js';
import {rearrange} from './arrange.js';

// Transport buttons, seek bar, keyboard shortcuts, fullscreen and page lifecycle.
const formatTime = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const playerPanel = () => document.querySelector('.player');

export function showTime(time) {
  $('time').textContent = `${formatTime(time)} / ${formatTime(state.song.duration)}`;
  if (document.activeElement !== $('seek')) $('seek').value = time;
}

// Stops, rewinds and switches the key lights and backlight off. Play restores the brightness.
async function stop() {
  pause();
  state.position = 0;
  clearLive();
  const main = mainArea();
  main.inert = true;
  try {
    await resetLights(state.output);
    if (state.output && state.midi?.sysexEnabled) await setBrightness(state.output, 0);
    status('Stopped. Key lights cleared; Play restores brightness.');
  } catch (e) {
    status(`Stopped, but could not clear all lights: ${e.message}`);
  } finally {
    main.inert = false;
    $('stop').focus();
  }
}

// ← / → seek 5 s, with Shift 1 s, unless a dialog or form control has the focus.
function seekWithArrowKeys(event) {
  if (!state.noticeAccepted || $('settingsDialog').open || $('instrumentDialog').open || mainArea().inert) return;
  if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  if (event.target instanceof Element && event.target.closest('input,select,textarea,[contenteditable="true"],[role="slider"]')) return;
  event.preventDefault();
  seekTo(current() + (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 1 : 5));
}

function changeHand() {
  const hand = $('hand').value, other = hand === 'right' ? 'left' : 'right';
  const fit = rearrange();
  if (hand === 'both') { status(`Practising both hands. ${fit}`.trim()); return; }
  const notes = state.song.notes.filter(n => state.selected.has(n.track)).length;
  const along = $('otherHand').checked ? `The ${other} hand plays along.` : `The ${other} hand is shown faintly.`;
  status(notes ? `Practising the ${hand} hand (${notes} notes). ${along} ${fit}`.trim() : `This song has no ${hand}-hand notes in the selected tracks.`);
}

async function toggleFullscreen() {
  const panel = playerPanel();
  try {
    if (document.fullscreenElement === panel) await document.exitFullscreen();
    else if (panel.requestFullscreen) await panel.requestFullscreen();
    else status('Fullscreen is unavailable in this browser.');
  } catch (e) {
    status(`Could not enter fullscreen: ${e.message}`);
  }
}

export function initControls() {
  $('play').onclick = play;
  $('stop').onclick = stop;
  $('seek').oninput = () => seekTo(Number($('seek').value));
  $('hand').onchange = changeHand;
  $('fullscreen').onclick = toggleFullscreen;
  document.addEventListener('fullscreenchange', () => {
    const active = document.fullscreenElement === playerPanel();
    $('fullscreen').textContent = active ? 'Exit fullscreen' : '⛶ Fullscreen';
    $('fullscreen').setAttribute('aria-pressed', String(active));
  });
  document.addEventListener('keydown', seekWithArrowKeys);
  // Browsers only start audio after a user gesture.
  document.addEventListener('pointerdown', () => {
    enableAudio().catch(e => status(`Audio unavailable: ${e.message}`));
  });
  // Playback pauses in background tabs, where timers are throttled. "Wait for my notes" keeps waiting:
  // the player watches the Piano, and Chrome on Windows also reports a window covered by another one as hidden.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden || state.practice) return;
    clearLive();
    if (state.playing) {
      pause();
      status('Paused while the tab is hidden. Press Play to continue.');
    }
  });
  window.addEventListener('pagehide', () => {
    pause();
    clearLive();
  });
}
