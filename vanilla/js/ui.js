/**
 * UI helpers: loading overlay, settings bindings, keyboard shortcuts.
 */
import State from './state.js';
import { Playback } from './playback.js';
import { Trim } from './trim.js';

const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const hpFreq = document.getElementById('hpFreq');
const hpValue = document.getElementById('hpValue');

function showLoading(text) {
  loadingText.textContent = text || 'Processing...';
  loadingOverlay.classList.add('visible');
}

function hideLoading() {
  loadingOverlay.classList.remove('visible');
}

// ---- HP frequency slider live update ----
hpFreq.addEventListener('input', () => {
  hpValue.textContent = hpFreq.value + ' Hz';
  if (State.filterNode) {
    State.filterNode.frequency.value = parseFloat(hpFreq.value);
  }
});

// ---- Keyboard shortcuts ----
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    Playback.toggle();
  }
  if (!State.audioBuffer) return;

  const NUDGE = 0.001;
  if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
    const dir = e.code === 'ArrowRight' ? 1 : -1;
    if (e.shiftKey) {
      State.trimStart = Math.max(0, Math.min(State.trimEnd - 0.005, State.trimStart + dir * NUDGE));
    } else {
      State.trimEnd = Math.max(State.trimStart + 0.005, Math.min(1, State.trimEnd + dir * NUDGE));
    }
    Trim.updateUI();
  }
});

export const UI = { showLoading, hideLoading };
