/**
 * Shared application state.
 * All modules read/write from this single object to avoid globals.
 */

interface AppState {
  audioCtx: AudioContext | null;
  audioBuffer: AudioBuffer | null;
  fileName: string;

  // Playback
  isPlaying: boolean;
  sourceNode: AudioBufferSourceNode | null;
  filterNode: BiquadFilterNode | null;
  fadeNode: GainNode | null;
  normalizeNode: GainNode | null;
  playStartTime: number;
  playOffset: number;
  animFrameId: number | null;

  // Trim (fractions 0–1 of total duration)
  trimStart: number;
  trimEnd: number;

  // Marker position (fraction 0–1 of total duration); set to trimStart on load
  markerPos: number;

  // Zoom
  zoomLevel: number;
  MAX_ZOOM: number;

  // Spectrogram (pre-computed)
  spectrogramData: Float32Array | null;
  spectrogramCols: number;
  spectrogramRows: number;

  ensureAudioCtx(): void;
}

const State: AppState = {
  audioCtx: null,
  audioBuffer: null,
  fileName: '',

  // Playback
  isPlaying: false,
  sourceNode: null,
  filterNode: null,
  fadeNode: null,
  normalizeNode: null,
  playStartTime: 0,
  playOffset: 0,
  animFrameId: null,

  // Trim (fractions 0–1 of total duration)
  trimStart: 0,
  trimEnd: 1,

  // Marker position (fraction 0–1 of total duration); set to trimStart on load
  markerPos: 0,

  // Zoom
  zoomLevel: 1,
  MAX_ZOOM: 32,

  // Spectrogram (pre-computed)
  spectrogramData: null,
  spectrogramCols: 0,
  spectrogramRows: 0,

  /**
   * Ensure AudioContext exists and is running.
   * Must be called from a user gesture on iOS.
   */
  ensureAudioCtx() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext ??
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!;
      this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  },
};

export default State;
