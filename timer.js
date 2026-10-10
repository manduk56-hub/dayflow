(function(root) {
  class Countdown {
    constructor(seconds, saved = null, now = Date.now) {
      this.now = now;
      this.setDuration(seconds);
      if (saved && saved.durationSeconds === seconds
        && ['idle','running','paused','finished'].includes(saved.status)
        && Number.isFinite(saved.remainingMs) && saved.remainingMs >= 0 && saved.remainingMs <= seconds * 1000
        && (saved.status !== 'running' || (Number.isFinite(saved.deadline) && saved.deadline <= now() + seconds * 1000))) {
        this.status = saved.status;
        this.remainingMs = saved.remainingMs;
        this.deadline = saved.status === 'running' ? saved.deadline : null;
        this.tick();
      }
    }
    setDuration(seconds) {
      if (!Number.isInteger(seconds) || seconds < 1 || seconds > 10800) throw new Error('타이머 시간은 1~180분으로 설정해주세요.');
      this.durationSeconds = seconds;
      this.reset();
    }
    reset() {
      this.status = 'idle';
      this.remainingMs = this.durationSeconds * 1000;
      this.deadline = null;
    }
    start() {
      if (this.status === 'running') return;
      if (this.status === 'finished') this.reset();
      this.deadline = this.now() + this.remainingMs;
      this.status = 'running';
    }
    pause() {
      this.tick();
      if (this.status !== 'running') return;
      this.status = 'paused';
      this.deadline = null;
    }
    tick() {
      if (this.status === 'running') {
        this.remainingMs = Math.max(0, Math.min(this.durationSeconds * 1000, this.deadline - this.now()));
        if (!this.remainingMs) { this.status = 'finished'; this.deadline = null; return true; }
      }
      return false;
    }
    get secondsLeft() { return Math.ceil(this.remainingMs / 1000); }
    snapshot() {
      return { durationSeconds:this.durationSeconds, remainingMs:this.remainingMs, status:this.status, deadline:this.deadline };
    }
  }
  class Stopwatch {
    constructor(saved = null, now = Date.now) {
      this.now = now;
      this.reset();
      if (saved && ['idle','running','paused'].includes(saved.status)
        && Number.isFinite(saved.accumulatedMs) && saved.accumulatedMs >= 0
        && (saved.status !== 'running' || Number.isFinite(saved.startedAt))) {
        this.status = saved.status;
        this.accumulatedMs = saved.accumulatedMs;
        this.startedAt = saved.status === 'running' ? saved.startedAt : null;
        this.tick();
      }
    }
    reset() { this.status='idle'; this.accumulatedMs=0; this.elapsedMs=0; this.startedAt=null; }
    start() {
      if (this.status==='running') return;
      this.startedAt=this.now(); this.status='running';
    }
    pause() {
      this.tick();
      if (this.status!=='running') return;
      this.accumulatedMs=this.elapsedMs; this.startedAt=null; this.status='paused';
    }
    tick() {
      this.elapsedMs=this.accumulatedMs+(this.status==='running'?Math.max(0,this.now()-this.startedAt):0);
      return false;
    }
    get secondsElapsed() { return Math.floor(this.elapsedMs/1000); }
    snapshot() { return {status:this.status,accumulatedMs:this.accumulatedMs,startedAt:this.startedAt}; }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { Countdown, Stopwatch };
  else root.DayflowTimer = { Countdown, Stopwatch };
})(typeof globalThis !== 'undefined' ? globalThis : this);
