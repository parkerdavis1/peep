/**
 * Shared utility functions.
 */

/**
 * Format seconds as m:ss.t
 */
export function formatTime(sec: number): string {
    if (!isFinite(sec)) return "0:00.0"
    const m = Math.floor(sec / 60)
    const s = sec - m * 60
    return m + ":" + (s < 10 ? "0" : "") + s.toFixed(1)
}

/**
 * Apply a logarithmic (exponential-amplitude) fade-in and fade-out envelope
 * to a GainNode's gain AudioParam.
 *
 * This is the single source of truth for fade shape -- edit fadeDur or SILENCE
 * here to affect both live playback preview and the offline processing export.
 *
 * @param gainNode    - The node whose gain will be automated.
 * @param regionDur   - Duration of the audio region in seconds.
 * @param timeOffset  - Absolute context time at which the region starts.
 *                      Pass 0 for an OfflineAudioContext; pass
 *                      ctx.currentTime for a live AudioContext.
 * @param fadeDur     - Duration of each fade in seconds (default 1.0).
 * @param fadeEnabled - When false, gain stays at 1 throughout (no fade).
 */
export function applyFadeEnvelope(
    gainNode: GainNode,
    regionDur: number,
    timeOffset: number,
    fadeDur: number = 1.0,
    fadeEnabled: boolean = true,
    offsetInRegion: number = 0, // seconds into the full trim region where playback starts
): void {
    const SILENCE = 0.0001 // ~-80 dB; linearRamp cannot reach exactly 0
    const t0 = timeOffset
    const remainingDur = regionDur - offsetInRegion

    if (!fadeEnabled) {
        gainNode.gain.setValueAtTime(1, t0)
        return
    }

    const fadeIn = Math.min(fadeDur, regionDur / 2)
    const fadeOutStart = Math.max(regionDur - fadeDur, regionDur / 2)

    // What gain value is in effect at the playhead's position in the envelope?
    let gainAtOffset: number
    if (offsetInRegion <= 0) {
        gainAtOffset = SILENCE
    } else if (offsetInRegion < fadeIn) {
        gainAtOffset = SILENCE + (1 - SILENCE) * (offsetInRegion / fadeIn)
    } else if (offsetInRegion <= fadeOutStart) {
        gainAtOffset = 1
    } else {
        const fadeProg =
            (offsetInRegion - fadeOutStart) / (regionDur - fadeOutStart)
        gainAtOffset = 1 - (1 - SILENCE) * fadeProg
    }

    // Schedule gain starting from the playhead's position in the envelope
    gainNode.gain.setValueAtTime(gainAtOffset, t0)

    // Complete the fade-in if we're still in it
    if (offsetInRegion < fadeIn) {
        gainNode.gain.linearRampToValueAtTime(1, t0 + (fadeIn - offsetInRegion))
    }

    // Hold at 1 until the fade-out begins (if fade-out hasn't started yet)
    if (offsetInRegion < fadeOutStart) {
        gainNode.gain.setValueAtTime(1, t0 + (fadeOutStart - offsetInRegion))
    }

    // Fade out to silence at the trim end
    gainNode.gain.linearRampToValueAtTime(SILENCE, t0 + remainingDur)
}
