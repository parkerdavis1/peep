/**
 * Trim handle interaction (drag to set trim region).
 */
import State from './state.ts';
import { Playback } from './playback.ts';

const inner = document.getElementById('spectrogramInner')!;
const wrapper = document.getElementById('spectrogramWrapper')!;
const trimLeftOverlay = document.getElementById('trimLeft')!;
const trimRightOverlay = document.getElementById('trimRight')!;
const handleLeft = document.getElementById('handleLeft')!;
const handleRight = document.getElementById('handleRight')!;

let dragging: 'left' | 'right' | null = null;

function getPointerFrac(clientX: number): number {
  const rect = inner.getBoundingClientRect();
  const totalWidth = parseFloat(inner.style.width) || wrapper.clientWidth;
  return Math.max(0, Math.min(1, (clientX - rect.left) / totalWidth));
}

/**
 * Sync overlay widths and handle positions to current trim state.
 */
function updateUI(): void {
  if (!State.audioBuffer) return;
  const totalWidth = parseFloat(inner.style.width) || wrapper.clientWidth;
  const leftPx = State.trimStart * totalWidth;
  const rightPx = State.trimEnd * totalWidth;

  trimLeftOverlay.style.width = leftPx + 'px';
  trimRightOverlay.style.width = (totalWidth - rightPx) + 'px';
  handleLeft.style.left = (leftPx - 2) + 'px';
  handleRight.style.left = (rightPx - 2) + 'px';
}

// --- Pointer events ---
handleLeft.addEventListener('pointerdown', (e) => {
  handleLeft.setPointerCapture(e.pointerId);
  e.preventDefault();
  dragging = 'left';
});

handleRight.addEventListener('pointerdown', (e) => {
  handleRight.setPointerCapture(e.pointerId);
  e.preventDefault();
  dragging = 'right';
});

document.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const frac = getPointerFrac(e.clientX);
  const MIN_GAP = 0.005;
  if (dragging === 'left') {
    State.trimStart = Math.min(frac, State.trimEnd - MIN_GAP);
  } else {
    State.trimEnd = Math.max(frac, State.trimStart + MIN_GAP);
  }
  updateUI();
  Playback.updateMarker();
});

document.addEventListener('pointerup', () => { dragging = null; });

export const Trim = { updateUI };
