/**
 * Audio playback with live HP filter preview and marker support.
 */
import State from "./state.ts";
import { formatTime, applyFadeEnvelope } from "./utils.ts";

const playBtn = document.getElementById("playBtn")!;
const rewindBtn = document.getElementById("rewindBtn")!;
const timeDisplay = document.getElementById("timeDisplay")!;
const playbackCursor = document.getElementById("playbackCursor")!;
const playbackMarker = document.getElementById("playbackMarker")!;
const hpEnabled = document.getElementById("hpEnabled") as HTMLInputElement;
const hpFreq = document.getElementById("hpFreq") as HTMLInputElement;
const normalizeEnabled = document.getElementById(
    "normalizeEnabled",
) as HTMLInputElement;
const fadeEnabled = document.getElementById("fadeEnabled") as HTMLInputElement;
const fadeDuration = document.getElementById(
    "fadeDuration",
) as HTMLInputElement;
const wrapper = document.getElementById("spectrogramWrapper")!;
const inner = document.getElementById("spectrogramInner")!;

/**
 * Reposition the orange marker element to reflect State.markerPos.
 * Clamps to [trimStart, trimEnd] and hides when no audio is loaded.
 */
function updateMarker(): void {
    if (!State.audioBuffer) {
        playbackMarker.style.display = "none";
        return;
    }

    // Clamp marker to the current trim region
    State.markerPos = Math.max(
        State.trimStart,
        Math.min(State.trimEnd, State.markerPos),
    );

    const totalWidth = parseFloat(inner.style.width) || wrapper.clientWidth;
    playbackMarker.style.left = State.markerPos * totalWidth + "px";
    playbackMarker.style.display = "block";
}

function start(): void {
    const buf = State.audioBuffer;
    if (!buf) return;

    stop();
    State.ensureAudioCtx();

    const ctx = State.audioCtx!;
    const dur = buf.duration;

    // Clamp marker to trim region before using it as the start point
    const clampedMarker = Math.max(
        State.trimStart,
        Math.min(State.trimEnd, State.markerPos),
    );
    const startSec = clampedMarker * dur;
    const trimStartSec = State.trimStart * dur;
    const fullRegionDur = State.trimEnd * dur - trimStartSec;
    const remainingDur = State.trimEnd * dur - startSec;
    const offsetInRegion = startSec - trimStartSec;

    // Guard against zero-length region (marker at trimEnd)
    if (remainingDur <= 0.01) return;

    const source = ctx.createBufferSource();
    source.buffer = buf;
    State.sourceNode = source;

    let lastNode: AudioNode = source;

    // Live HP filter
    if (hpEnabled.checked) {
        const filter = ctx.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.value = parseFloat(hpFreq.value);
        filter.Q.value = 0.707;
        lastNode.connect(filter);
        lastNode = filter;
        State.filterNode = filter;
    }

    // Fade in / out — shape defined in utils.ts applyFadeEnvelope
    const fadeGain = ctx.createGain();
    applyFadeEnvelope(
        fadeGain,
        fullRegionDur,
        ctx.currentTime,
        parseFloat(fadeDuration.value),
        fadeEnabled.checked,
        offsetInRegion,
    );
    lastNode.connect(fadeGain);
    State.fadeNode = fadeGain;

    if (normalizeEnabled.checked) {
        const buf = State.audioBuffer!;
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
        State.normalizeNode = normalizeGain;
    } else {
        fadeGain.connect(ctx.destination);
    }

    source.start(0, startSec, remainingDur);
    State.playStartTime = ctx.currentTime;
    State.playOffset = startSec;
    State.isPlaying = true;
    playBtn.innerHTML = "&#9646;&#9646;";

    // Natural end: reset marker to trimStart so next play starts from the beginning
    source.onended = () => {
        if (State.isPlaying) {
            State.markerPos = State.trimStart;
            stop();
        }
    };

    playbackCursor.style.display = "block";
    animate();
}

/**
 * Stop playback.
 * @param savePosition  When true, saves the current playback
 *                      position to State.markerPos (user-initiated pause).
 */
function stop(savePosition = false): void {
    if (
        savePosition &&
        State.isPlaying &&
        State.audioCtx &&
        State.audioBuffer
    ) {
        const elapsed = State.audioCtx.currentTime - State.playStartTime;
        const currentSec = State.playOffset + elapsed;
        const dur = State.audioBuffer.duration;
        State.markerPos = Math.max(
            State.trimStart,
            Math.min(State.trimEnd, currentSec / dur),
        );
    }

    State.isPlaying = false;
    playBtn.innerHTML = "&#9654;";
    playbackCursor.style.display = "none";

    if (State.animFrameId) {
        cancelAnimationFrame(State.animFrameId);
        State.animFrameId = null;
    }
    if (State.sourceNode) {
        try {
            State.sourceNode.stop();
        } catch (_) {}
        try {
            State.sourceNode.disconnect();
        } catch (_) {}
        State.sourceNode = null;
    }
    if (State.filterNode) {
        try {
            State.filterNode.disconnect();
        } catch (_) {}
        State.filterNode = null;
    }
    if (State.fadeNode) {
        try {
            State.fadeNode.disconnect();
        } catch (_) {}
        State.fadeNode = null;
    }
    if (State.normalizeNode) {
        try {
            State.normalizeNode.disconnect();
        } catch (_) {}
        State.normalizeNode = null;
    }

    updateMarker();
}

function animate(): void {
    if (!State.isPlaying) return;

    const ctx = State.audioCtx!;
    const buf = State.audioBuffer!;
    const dur = buf.duration;
    const elapsed = ctx.currentTime - State.playStartTime;
    const currentSec = State.playOffset + elapsed;
    const frac = currentSec / dur;

    // Cursor position
    const totalWidth = parseFloat(inner.style.width) || wrapper.clientWidth;
    playbackCursor.style.left = frac * totalWidth + "px";

    // Time display
    const regionStart = State.trimStart * dur;
    const regionDur = State.trimEnd * dur - regionStart;
    timeDisplay.textContent =
        formatTime(currentSec - regionStart) + " / " + formatTime(regionDur);

    // Auto-scroll
    const cursorPx = frac * totalWidth;
    const wrapperWidth = wrapper.clientWidth;
    const scrollLeft = wrapper.scrollLeft;
    if (cursorPx < scrollLeft || cursorPx > scrollLeft + wrapperWidth) {
        wrapper.scrollLeft = cursorPx - wrapperWidth / 3;
    }

    State.animFrameId = requestAnimationFrame(animate);
}

function toggle(): void {
    State.ensureAudioCtx();
    // Pass savePosition=true so pausing records the current playback position
    if (State.isPlaying) {
        stop(true);
    } else {
        start();
    }
}

playBtn.addEventListener("click", toggle);

// Rewind button: move marker to the start of the trim region
rewindBtn.addEventListener("click", () => {
    if (!State.audioBuffer) return;
    State.markerPos = State.trimStart;
    updateMarker();
});

// Click on the spectrogram to place the marker (only when paused)
inner.addEventListener("click", (e) => {
    if (State.isPlaying) return;
    if (!State.audioBuffer) return;
    // Ignore clicks on trim handles
    if ((e.target as HTMLElement).classList.contains("trim-handle")) return;

    const rect = inner.getBoundingClientRect();
    const totalWidth = parseFloat(inner.style.width) || wrapper.clientWidth;
    const rawFrac = (e.clientX - rect.left) / totalWidth;
    State.markerPos = Math.max(
        State.trimStart,
        Math.min(State.trimEnd, rawFrac),
    );
    updateMarker();
});

export const Playback = { start, stop, toggle, updateMarker };
