/**
 * UI helpers: loading overlay, settings bindings, keyboard shortcuts.
 */
import State from "./state.ts"
import { Playback } from "./playback.ts"
import { zoomIn, zoomOut } from "./app.ts"

const loadingOverlay = document.getElementById("loadingOverlay")!
const loadingText = document.getElementById("loadingText")!
const hpFreq = document.getElementById("hpFreq") as HTMLInputElement
const hpValue = document.getElementById("hpValue")!
const fadeDuration = document.getElementById("fadeDuration") as HTMLInputElement
const fadeValue = document.getElementById("fadeValue")!
const fadeEnabledEl = document.getElementById("fadeEnabled") as HTMLInputElement

function showLoading(text: string): void {
    loadingText.textContent = text || "Processing..."
    loadingOverlay.classList.add("visible")
}

function hideLoading(): void {
    loadingOverlay.classList.remove("visible")
}

// ---- HP frequency slider live update ----
hpFreq.addEventListener("input", () => {
    hpValue.textContent = hpFreq.value + " Hz"
    if (State.filterNode) {
        State.filterNode.frequency.value = parseFloat(hpFreq.value)
    }
})

// ---- Fade duration slider live update ----
fadeDuration.addEventListener("input", () => {
    fadeValue.textContent = parseFloat(fadeDuration.value).toFixed(1) + " s"
})

// Disable slider when fade is unchecked
fadeEnabledEl.addEventListener("change", () => {
    fadeDuration.disabled = !fadeEnabledEl.checked
})

// ---- Initialise display values from current slider positions ----
hpValue.textContent = hpFreq.value + " Hz"
fadeValue.textContent = parseFloat(fadeDuration.value).toFixed(1) + " s"

// ---- Keyboard shortcuts ----
document.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
        e.preventDefault()
        Playback.toggle()
    }
    if (!State.audioBuffer) return

    const NUDGE = 0.005
    if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
        // If during playback, do nothing
        if (State.isPlaying) return
        console.log("ARROW LEFT OR RIGHT")
        const dir = e.code === "ArrowRight" ? 1 : -1

        State.markerPos = Math.max(
            0,
            Math.min(1, State.markerPos + dir * NUDGE),
        )

        Playback.updateMarker()
    }

    if (e.code === "ArrowUp") {
        e.preventDefault()
        zoomIn()
    }
    if (e.code === "ArrowDown") {
        e.preventDefault()
        zoomOut()
    }
})

export const UI = { showLoading, hideLoading }
