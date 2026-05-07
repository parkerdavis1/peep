/**
 * Shared reactive application state (Svelte 5 runes).
 * All components and lib modules read/write from this single object.
 */

class AppState {
  // Audio
  audioCtx: AudioContext | null = null;
  audioBuffer = $state<AudioBuffer | null>(null);
  fileName = $state("");
  fileInfoText = $state("");

  // Playback (audio graph nodes — not reactive, updated imperatively)
  isPlaying = $state(false);
  sourceNode: AudioBufferSourceNode | null = null;
  filterNode: BiquadFilterNode | null = null;
  fadeNode: GainNode | null = null;
  normalizeNode: GainNode | null = null;
  playStartTime = 0;
  playOffset = 0;
  animFrameId: number | null = null;
  playbackSec = $state(0);
  playheadFrac = $derived.by(() => {
    if (!this.audioBuffer || this.audioBuffer.duration <= 0)
      return this.markerPos;
    return Math.max(
      0,
      Math.min(1, this.playbackSec / this.audioBuffer.duration),
    );
  });

  // Trim (fractions 0–1 of total duration)
  trimStart = $state(0);
  trimEnd = $state(1);

  // Marker position (fraction 0–1 of total duration)
  markerPos = $state(0);

  // Zoom
  zoomLevel = $state(1);
  readonly MAX_ZOOM = 32;

  // Spectrogram (pre-computed — large data, not deeply reactive)
  spectrogramData = $state.raw<Float32Array | null>(null);
  spectrogramCols = 0;
  spectrogramRows = 0;
  // Total pixel width of the rendered spectrogram (set by render())
  spectrogramTotalWidth = $state(0);

  // Settings
  hpEnabled = $state(true);
  hpFreq = $state(100);
  normalizeEnabled = $state(true);
  fadeEnabled = $state(true);
  fadeDuration = $state(1.0);

  // UI
  isLoading = $state(false);
  loadingText = $state("Processing...");
  timeDisplayText = $state("0:00.0 / 0:00.0");
  timeStartText = $state("0:00.0");
  timeEndText = $state("0:00.0");

  /**
   * Ensure AudioContext exists and is running.
   * Must be called from a user gesture on iOS.
   */
  ensureAudioCtx(): void {
    if (!this.audioCtx) {
      const AudioCtx =
        window.AudioContext ??
        (
          window as Window & {
            webkitAudioContext?: typeof AudioContext;
          }
        ).webkitAudioContext!;
      this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx.state === "suspended") {
      void this.audioCtx.resume();
    }
  }
}

export const appState = new AppState();
