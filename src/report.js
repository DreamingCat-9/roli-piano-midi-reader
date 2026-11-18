import {$, closeOnBackdropClick} from './dom.js';
import {state} from './state.js';
import {hooks, play, seekTo} from './transport.js';
import {setLoop} from './loop.js';
import {practisedHand} from './arrange.js';
import {GOOD, WEAK, ON_TIME, QUICK, LONG_WAIT} from './score.js';

// The end-of-song report: how the run went, bar by bar, and a button to practise the bars that need it most, as a
// loop at a slower speed. It appears when a song played on the keyboard reaches its end.
const HANDS = {both: 'Both hands', right: 'Right hand', left: 'Left hand'};
const formatTime = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
const barColor = accuracy => accuracy >= GOOD ? 'good' : accuracy >= WEAK ? 'fair' : 'weak';
const barsText = (from, to) => from === to ? `bar ${from + 1}` : `bars ${from + 1} to ${to + 1}`;
const slower = percent => percent > 75 ? 75 : percent > 50 ? 50 : percent; // the next speed preset down

function fact(value, label) {
  const item = document.createElement('div'), number = document.createElement('strong'), text = document.createElement('span');
  number.textContent = value;
  text.textContent = label;
  item.append(number, text);
  return item;
}

function chart(report) {
  const {bars, hardest} = report, first = bars[0]?.number ?? 1;
  const columns = bars.map(bar => {
    const column = document.createElement('div'), track = document.createElement('div'), label = document.createElement('span');
    column.className = 'reportColumn';
    track.className = 'reportTrack';
    if (bar.accuracy != null) {
      const fill = document.createElement('div');
      fill.className = `reportFill ${barColor(bar.accuracy)}`;
      fill.style.height = `${Math.max(4, bar.accuracy)}%`;
      fill.title = `Bar ${bar.number}: ${bar.accuracy}% (${bar.good} of ${bar.total} notes on time${bar.wrong ? `, ${bar.wrong} wrong` : ''})`;
      track.append(fill);
    }
    label.textContent = bars.length <= 24 || bar.number % 4 === 1 || bar.number === first ? bar.number : '';
    column.append(track, label);
    return column;
  });
  const grid = $('reportChart');
  grid.style.gridTemplateColumns = `repeat(${bars.length}, minmax(${bars.length > 32 ? 12 : 18}px, 1fr))`;
  if (hardest) {
    const mark = document.createElement('div');
    mark.className = 'reportHardest';
    mark.style.gridColumn = `${hardest.from + 2 - first} / ${hardest.to + 3 - first}`;
    mark.textContent = hardest.from === hardest.to ? `Bar ${hardest.from + 1}` : `Bars ${hardest.from + 1}–${hardest.to + 1}`;
    columns.push(mark);
  }
  grid.replaceChildren(...columns);
  const weak = bars.filter(b => b.accuracy != null);
  grid.setAttribute('aria-label', `Notes on time per bar: ${weak.map(b => `bar ${b.number} ${b.accuracy}%`).join(', ')}.`);
}

function showReport(score) {
  if (!score || !state.input || !score.presses) return; // nothing played on the keyboard: nothing to report
  const report = score.summary();
  if (!report.total) return;
  const {hardest} = report, percent = Math.round(state.rate * 100);
  const firstBar = report.bars[0]?.number ?? 1;
  $('reportTitle').textContent = $('title').textContent;
  $('reportContext').textContent = [HANDS[practisedHand()], `${percent}% speed`, score.waiting ? 'Wait for me on' : '', firstBar > 1 ? `from bar ${firstBar}` : '']
    .filter(Boolean).join(', ');
  $('reportResult').textContent = `You played ${report.good} of ${report.total} notes on time.`;
  $('reportRule').textContent = score.waiting
    ? `On time: played early, or within ${QUICK} second of the song reaching it.`
    : `On time: played within ${ON_TIME * 1000} ms of the note, at your speed.`;
  const facts = [fact(report.wrong, report.wrong === 1 ? 'wrong note' : 'wrong notes')];
  if (score.waiting) facts.push(fact(report.longWaits, `waits over ${LONG_WAIT} seconds`));
  facts.push(fact(formatTime(report.playedMs), 'playing'));
  $('reportFacts').replaceChildren(...facts);
  chart(report);
  $('reportHint').textContent = hardest
    ? `${barsText(hardest.from, hardest.to).replace(/^b/, 'B')} had the fewest notes on time.`
    : `Every bar had ${GOOD}% or more of its notes on time.`;
  const practise = $('practiseHard');
  practise.hidden = !hardest;
  if (hardest) {
    const speed = slower(percent);
    practise.textContent = `Practise ${barsText(hardest.from, hardest.to)}${speed < percent ? ` at ${speed}%` : ''}`;
    practise.onclick = () => {
      $('reportDialog').close();
      if (speed < percent) {
        $('speed').value = speed;
        $('speed').oninput(); // also checks the speed preset
      }
      setLoop(hardest.from, hardest.to);
      play();
    };
  }
  $('replay').classList.toggle('primary', !hardest);
  $('replay').onclick = () => {
    $('reportDialog').close();
    seekTo(score.from);
    play();
  };
  $('reportDialog').showModal();
}

export function initReport() {
  hooks.songEnd = showReport;
  const dialog = $('reportDialog');
  $('closeReport').onclick = $('doneReport').onclick = () => dialog.close();
  closeOnBackdropClick(dialog);
}
