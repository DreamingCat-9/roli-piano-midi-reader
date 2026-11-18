// "Wait for my notes": the song stops at each chord (notes starting together) until every one of its keys is played.
// A key played a little before its chord arrives counts for it, so arriving there does not wait for it again.
export class Practice {
  constructor(notes, selected, time = 0) {
    this.groups = [];
    for (const n of [...notes].sort((a, b) => a.start - b.start)) {
      if (!selected.has(n.track) || n.start < time - 1e-6 || n.end <= n.start) continue;
      let group = this.groups.at(-1);
      if (!group || Math.abs(group.time - n.start) > 1e-6) {
        group = {time: n.start, pitches: new Set(), early: new Set()};
        this.groups.push(group);
      }
      group.pitches.add(n.pitch);
    }
    this.index = 0;
    this.waiting = false;
    this.missing = new Set();
  }

  get next() { return this.groups[this.index]; }

  // At song time `time`, starts waiting for the next chord once it is due. Keys already played early are not
  // waited for; a chord played entirely early is passed without stopping.
  arrive(time) {
    while (this.next && time >= this.next.time && !this.waiting) {
      this.missing = new Set([...this.next.pitches].filter(p => !this.next.early.has(p)));
      if (this.missing.size) this.waiting = true;
      else this.index++;
    }
    return this.waiting;
  }

  // A key played while waiting. Returns true when it completes the chord.
  press(pitch) {
    if (!this.waiting || !this.missing.has(pitch)) return false;
    this.missing.delete(pitch);
    if (this.missing.size) return false;
    this.index++;
    this.waiting = false;
    return true;
  }

  // A key played at song time `time` for a coming chord, at most `window` seconds of song ahead.
  // Returns true when it counts for one: the first coming chord that needs it and has not had it yet.
  pressEarly(pitch, time, window) {
    for (let i = this.waiting ? this.index + 1 : this.index; i < this.groups.length; i++) {
      const group = this.groups[i];
      if (group.time > time + window + 1e-6) return false;
      if (group.pitches.has(pitch) && !group.early.has(pitch)) {
        group.early.add(pitch);
        return true;
      }
    }
    return false;
  }
}
