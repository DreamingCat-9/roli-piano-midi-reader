import {$, mainArea} from './dom.js';
import {state} from './state.js';

// Experimental-software notice. The player stays inert until it is accepted, and it cannot be dismissed otherwise.
// `onAccept` runs once it is accepted.
export function initNotice(onAccept) {
  const dialog = $('riskNotice');
  dialog.close();
  dialog.showModal();
  dialog.addEventListener('cancel', event => event.preventDefault());
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); }
  });
  dialog.addEventListener('close', () => {
    if (!state.noticeAccepted && !dialog.open) dialog.showModal();
  });
  $('riskAccept').onchange = event => { $('riskContinue').disabled = !event.target.checked; };
  $('riskForm').onsubmit = event => {
    event.preventDefault();
    if (!$('riskAccept').checked) return;
    state.noticeAccepted = true;
    mainArea().inert = false;
    dialog.close();
    $('connect').focus();
    onAccept?.();
  };
  $('riskLeave').onclick = () => location.replace('about:blank');
}
