import { formatTime } from "$lib/utils/format.ts";

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

  // Track playback time directly to drive reactivity
  playbackSec = $state(0);

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

  // Scroll tracking for UI derived state
  scrollLeftPx = $state(0);
  wrapperWidthPx = $state(0);

  // Derived state for UI
  timeDisplayText = $derived.by(() => {
    if (!this.audioBuffer) return "0:00.0 / 0:00.0";
    const dur = this.audioBuffer.duration;

    // When playing, use the high-precision playbackSec, otherwise use the marker
    const sec = this.isPlaying ? this.playbackSec : this.markerPos * dur;
    const regionStart = this.trimStart * dur;
    const regionDur = this.trimEnd * dur - regionStart;

    return (
      formatTime(Math.max(0, sec - regionStart)) + " / " + formatTime(regionDur)
    );
  });

  timeStartText = $derived.by(() => {
    if (!this.audioBuffer || this.spectrogramTotalWidth === 0) return "0:00.0";
    const dur = this.audioBuffer.duration;
    return formatTime((this.scrollLeftPx / this.spectrogramTotalWidth) * dur);
  });

  timeEndText = $derived.by(() => {
    if (!this.audioBuffer || this.spectrogramTotalWidth === 0) return "0:00.0";
    const dur = this.audioBuffer.duration;
    return formatTime(
      ((this.scrollLeftPx + this.wrapperWidthPx) / this.spectrogramTotalWidth) *
        dur,
    );
  });

  playheadFrac = $derived.by(() => {
    if (!this.audioBuffer || this.audioBuffer.duration <= 0)
      return this.markerPos;
    return Math.max(
      0,
      Math.min(1, this.playbackSec / this.audioBuffer.duration),
    );
  });

  /**
   * Ensure AudioContext exists and is running.
   * Must be called from a user gesture on iOS.
   */
  async ensureAudioCtx(): Promise<void> {
    if (!this.audioCtx || this.audioCtx.state === "closed") {
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
      await this.audioCtx.resume();
    }
  }
}

export const appState = new AppState();
