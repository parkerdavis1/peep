/**
 * Audio playback with live HP filter preview.
 */
import State from './state.js';
import { formatTime, applyFadeEnvelope } from './utils.js';

const playBtn = document.getElementById('playBtn');
const timeDisplay = document.getElementById('timeDisplay');
const playbackCursor = document.getElementById('playbackCursor');
const hpEnabled = document.getElementById('hpEnabled');
const hpFreq = document.getElementById('hpFreq');
const wrapper = document.getElementById('spectrogramWrapper');
const inner = document.getElementById('spectrogramInner');

function start() {
  const buf = State.audioBuffer;
  if (!buf) return;

  stop();
  State.ensureAudioCtx();

  const ctx = State.audioCtx;
  const dur = buf.duration;
  const startSec = State.trimStart * dur;
  const regionDur = State.trimEnd * dur - startSec;

  const source = ctx.createBufferSource();
  source.buffer = buf;
  State.sourceNode = source;

  let lastNode = source;

  // Live HP filter
  if (hpEnabled.checked) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = parseFloat(hpFreq.value);
    filter.Q.value = 0.707;
    lastNode.connect(filter);
    lastNode = filter;
    State.filterNode = filter;
  }

  // Fade in / out — shape defined in utils.js applyFadeEnvelope
  const fadeGain = ctx.createGain();
  applyFadeEnvelope(fadeGain, regionDur, ctx.currentTime);
  lastNode.connect(fadeGain);
  fadeGain.connect(ctx.destination);
  State.fadeNode = fadeGain;

  source.start(0, startSec, regionDur);
  State.playStartTime = ctx.currentTime;
  State.playOffset = startSec;
  State.isPlaying = true;
  playBtn.innerHTML = '&#9646;&#9646;';

  source.onended = () => { if (State.isPlaying) stop(); };

  playbackCursor.style.display = 'block';
  animate();
}

function stop() {
  State.isPlaying = false;
  playBtn.innerHTML = '&#9654;';
  playbackCursor.style.display = 'none';

  if (State.animFrameId) {
    cancelAnimationFrame(State.animFrameId);
    State.animFrameId = null;
  }
  if (State.sourceNode) {
    try { State.sourceNode.stop(); } catch (_) {}
    try { State.sourceNode.disconnect(); } catch (_) {}
    State.sourceNode = null;
  }
  if (State.filterNode) {
    try { State.filterNode.disconnect(); } catch (_) {}
    State.filterNode = null;
  }
  if (State.fadeNode) {
    try { State.fadeNode.disconnect(); } catch (_) {}
    State.fadeNode = null;
  }
}

function animate() {
  if (!State.isPlaying) return;

  const ctx = State.audioCtx;
  const buf = State.audioBuffer;
  const dur = buf.duration;
  const elapsed = ctx.currentTime - State.playStartTime;
  const currentSec = State.playOffset + elapsed;
  const frac = currentSec / dur;

  // Cursor position
  const totalWidth = parseFloat(inner.style.width) || wrapper.clientWidth;
  playbackCursor.style.left = (frac * totalWidth) + 'px';

  // Time display
  const regionStart = State.trimStart * dur;
  const regionDur = State.trimEnd * dur - regionStart;
  timeDisplay.textContent = formatTime(currentSec - regionStart) + ' / ' + formatTime(regionDur);

  // Auto-scroll
  const cursorPx = frac * totalWidth;
  const wrapperWidth = wrapper.clientWidth;
  const scrollLeft = wrapper.scrollLeft;
  if (cursorPx < scrollLeft || cursorPx > scrollLeft + wrapperWidth) {
    wrapper.scrollLeft = cursorPx - wrapperWidth / 3;
  }

  State.animFrameId = requestAnimationFrame(animate);
}

function toggle() {
  State.ensureAudioCtx();
  if (State.isPlaying) { stop(); } else { start(); }
}

playBtn.addEventListener('click', toggle);

export const Playback = { start, stop, toggle };
