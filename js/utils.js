/**
 * Shared utility functions.
 */

/**
 * Format seconds as m:ss.t
 */
export function formatTime(sec) {
    if (!isFinite(sec)) return "0:00.0";
    const m = Math.floor(sec / 60);
    const s = sec - m * 60;
    return m + ":" + (s < 10 ? "0" : "") + s.toFixed(1);
}

/**
 * Apply a logarithmic (exponential-amplitude) fade-in and fade-out envelope
 * to a GainNode's gain AudioParam.
 *
 * This is the single source of truth for fade shape -- edit FADE_DUR or SILENCE
 * here to affect both live playback preview and the offline processing export.
 *
 * @param {GainNode} gainNode   - The node whose gain will be automated.
 * @param {number}   regionDur  - Duration of the audio region in seconds.
 * @param {number}   timeOffset - Absolute context time at which the region starts.
 *                                Pass 0 for an OfflineAudioContext; pass
 *                                ctx.currentTime for a live AudioContext.
 */
export function applyFadeEnvelope(gainNode, regionDur, timeOffset) {
    const FADE_DUR = 1.0; // seconds -- change here to adjust both preview and export
    const SILENCE = 0.0001; // ~-80 dB; exponentialRamp cannot reach exactly 0

    const t0 = timeOffset;
    const fadeIn = Math.min(FADE_DUR, regionDur / 2);
    const fadeOut = Math.max(regionDur - FADE_DUR, regionDur / 2);

    gainNode.gain.setValueAtTime(SILENCE, t0);
    gainNode.gain.linearRampToValueAtTime(1, t0 + fadeIn);
    // gainNode.gain.exponentialRampToValueAtTime(1, t0 + fadeIn);
    gainNode.gain.setValueAtTime(1, t0 + fadeOut);
    gainNode.gain.linearRampToValueAtTime(SILENCE, t0 + regionDur);
    // gainNode.gain.exponentialRampToValueAtTime(SILENCE, t0 + regionDur);
}
