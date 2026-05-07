import { appState } from "$lib/state.svelte.ts";
import { applyFadeEnvelope } from "$lib/audio/fade.ts";

/**
 * Clamp and update marker position in state.
 */
export function updateMarker(): void {
  if (!appState.audioBuffer) return;
  appState.markerPos = Math.max(
    appState.trimStart,
    Math.min(appState.trimEnd, appState.markerPos),
  );
}

export async function start(): Promise<void> {
  const buf = appState.audioBuffer;
  if (!buf) return;

  stop();
  await appState.ensureAudioCtx();

  const ctx = appState.audioCtx!;
  // Guard: if context still isn't running after resume attempt, bail out
  if (ctx.state !== "running") return;

  const dur = buf.duration;

  let clampedMarker = appState.markerPos;
  if (!isFinite(clampedMarker) || isNaN(clampedMarker)) {
    clampedMarker = appState.trimStart;
  }

  // If the marker is outside the trim bounds (or very close to the end), restart from trimStart
  const marginSec = 0.01;
  const marginFrac = dur > 0 ? marginSec / dur : 0;
  if (
    clampedMarker < appState.trimStart ||
    clampedMarker >= appState.trimEnd - marginFrac
  ) {
    clampedMarker = appState.trimStart;
    appState.markerPos = clampedMarker;
  } else {
    clampedMarker = Math.max(
      appState.trimStart,
      Math.min(appState.trimEnd, clampedMarker),
    );
  }

  const startSec = clampedMarker * dur;
  const trimStartSec = appState.trimStart * dur;
  const fullRegionDur = appState.trimEnd * dur - trimStartSec;
  const remainingDur = appState.trimEnd * dur - startSec;
  const offsetInRegion = startSec - trimStartSec;

  // Guard against zero-length region
  if (remainingDur <= 0.01) return;

  const source = ctx.createBufferSource();
  source.buffer = buf;
  appState.sourceNode = source;

  let lastNode: AudioNode = source;

  // Live HP filter
  if (appState.hpEnabled) {
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = appState.hpFreq;
    filter.Q.value = 0.707;
    lastNode.connect(filter);
    lastNode = filter;
    appState.filterNode = filter;
  }

  // Fade in / out
  const fadeGain = ctx.createGain();
  applyFadeEnvelope(
    fadeGain,
    fullRegionDur,
    ctx.currentTime,
    appState.fadeDuration,
    appState.fadeEnabled,
    offsetInRegion,
  );
  lastNode.connect(fadeGain);
  appState.fadeNode = fadeGain;

  if (appState.normalizeEnabled) {
    let peak = 0;
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < data.length; i++) {
        const abs = Math.abs(data[i]);
        if (abs > peak) peak = abs;
      }
    }
    const normalizeGain = ctx.createGain();
    if (peak > 0) normalizeGain.gain.value = Math.pow(10, -3 / 20) / peak;
    fadeGain.connect(normalizeGain);
    normalizeGain.connect(ctx.destination);
    appState.normalizeNode = normalizeGain;
  } else {
    fadeGain.connect(ctx.destination);
  }

  source.start(0, startSec, remainingDur);
  appState.playStartTime = ctx.currentTime;
  appState.playOffset = startSec;
  appState.isPlaying = true;
  appState.playbackSec = startSec;

  // Natural end: reset marker to trimStart
  source.onended = () => {
    if (appState.sourceNode === source) {
      appState.markerPos = appState.trimStart;
      stop();
    }
  };

  animate();
}

/**
 * Stop playback.
 * @param savePosition  When true, saves the current playback position to appState.markerPos.
 */
export function stop(savePosition = false): void {
  if (
    savePosition &&
    appState.isPlaying &&
    appState.audioCtx &&
    appState.audioBuffer
  ) {
    const elapsed = appState.audioCtx.currentTime - appState.playStartTime;
    const currentSec = appState.playOffset + elapsed;
    const dur = appState.audioBuffer.duration;
    appState.markerPos = Math.max(
      appState.trimStart,
      Math.min(appState.trimEnd, currentSec / dur),
    );
  }

  appState.isPlaying = false;

  if (appState.animFrameId) {
    cancelAnimationFrame(appState.animFrameId);
    appState.animFrameId = null;
  }
  if (appState.sourceNode) {
    try {
      appState.sourceNode.stop();
    } catch (_) {}
    try {
      appState.sourceNode.disconnect();
    } catch (_) {}
    appState.sourceNode = null;
  }
  if (appState.filterNode) {
    try {
      appState.filterNode.disconnect();
    } catch (_) {}
    appState.filterNode = null;
  }
  if (appState.fadeNode) {
    try {
      appState.fadeNode.disconnect();
    } catch (_) {}
    appState.fadeNode = null;
  }
  if (appState.normalizeNode) {
    try {
      appState.normalizeNode.disconnect();
    } catch (_) {}
    appState.normalizeNode = null;
  }

  updateMarker();
}

export async function toggle(): Promise<void> {
  await appState.ensureAudioCtx();
  if (appState.isPlaying) {
    stop(true);
  } else {
    await start();
  }
}

export async function rewind(): Promise<void> {
  if (!appState.audioBuffer) return;
  const wasPlaying = appState.isPlaying;
  stop();
  appState.markerPos = appState.trimStart;
  updateMarker();
  if (wasPlaying) {
    await start();
  }
}

function animate(): void {
  if (!appState.isPlaying) {
    return;
  }

  const ctx = appState.audioCtx!;
  const elapsed = ctx.currentTime - appState.playStartTime;
  appState.playbackSec = appState.playOffset + elapsed;

  appState.animFrameId = requestAnimationFrame(animate);
}
