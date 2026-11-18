export const $ = id => document.getElementById(id);

export const TRACK_COLORS = ['#ffcf87', '#8dbdff', '#d6acff', '#ffd18b', '#ff9dab'];

// Message line under the transport controls.
export const status = text => { $('status').textContent = text; };

// <main> is inert until the notice is accepted, and while Stop clears the lights.
export const mainArea = () => document.querySelector('main');

// Closes a modal dialog when its backdrop is clicked.
export function closeOnBackdropClick(dialog) {
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  });
}
