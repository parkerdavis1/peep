/**
 * Shared application state.
 * All modules read/write from this single object to avoid globals.
 */
const State = {
  audioCtx: null,
  audioBuffer: null,   // original decoded AudioBuffer
  fileName: '',

  // Playback
  isPlaying: false,
  sourceNode: null,
  filterNode: null,
  playStartTime: 0,
  playOffset: 0,
  animFrameId: null,

  // Trim (fractions 0–1 of total duration)
  trimStart: 0,
  trimEnd: 1,

  // Zoom
  zoomLevel: 1,
  MAX_ZOOM: 32,

  // Spectrogram (pre-computed)
  spectrogramData: null,  // Float32Array of dB magnitudes (cols × rows)
  spectrogramCols: 0,
  spectrogramRows: 0,

  /**
   * Ensure AudioContext exists and is running.
   * Must be called from a user gesture on iOS.
   */
  ensureAudioCtx() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  },
};

export default State;
