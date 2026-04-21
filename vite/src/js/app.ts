import "../styles.css"
/**
 * Main application entry point.
 * Wires together: file loading, spectrogram, zoom, and save.
 */
import State from "./state.ts"
import { Spectrogram } from "./spectrogram.ts"
import { Trim } from "./trim.ts"
import { Playback } from "./playback.ts"
import { Processing } from "./processing.ts"
import { UI } from "./ui.ts"

const fileInput = document.getElementById("fileInput") as HTMLInputElement
const fileInfo = document.getElementById("fileInfo")!
const spectrogramSection = document.getElementById("spectrogramSection")!
const zoomInBtn = document.getElementById("zoomIn")!
const zoomOutBtn = document.getElementById("zoomOut")!
const saveBtn = document.getElementById("saveBtn")!

// ---- File Loading ----
fileInput.addEventListener("change", async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return

    // Make sure the file is less than 100mb
    if (file.size > 200 * 1024 * 1024) {
        alert("File is too large (max 200 MB)")
        return
    }

    State.ensureAudioCtx()
    Playback.stop()

    State.fileName = file.name.replace(/\.wav$/i, "")
    fileInfo.textContent =
        file.name + " (" + (file.size / 1024 / 1024).toFixed(1) + " MB)"
    UI.showLoading("Decoding audio...")

    try {
        const arrayBuf = await file.arrayBuffer()
        State.audioBuffer = await State.audioCtx!.decodeAudioData(arrayBuf)

        State.trimStart = 0
        State.trimEnd = 1
        State.markerPos = 0
        State.zoomLevel = 1

        UI.showLoading("Computing spectrogram...")
        await new Promise((r) => setTimeout(r, 50))

        Spectrogram.compute()
        spectrogramSection.classList.add("visible")

        // Wait one frame so the section is visible and wrapper.clientWidth is valid
        await new Promise((r) => requestAnimationFrame(r))

        Spectrogram.render()
        Trim.updateUI()
        Playback.updateMarker()
        Spectrogram.updateFreqAxis()
        Spectrogram.updateTimeBar()
        UI.hideLoading()
    } catch (err) {
        UI.hideLoading()
        alert("Error loading file: " + (err as Error).message)
        console.error(err)
    }
})

// ---- Zoom ----
function applyZoom(oldZoom: number): void {
    const wrapper = Spectrogram.wrapper
    const wrapperWidth = wrapper.clientWidth
    const oldScroll = wrapper.scrollLeft
    const oldTotal = wrapperWidth * oldZoom
    const centerFrac = (oldScroll + wrapperWidth / 2) / oldTotal

    Spectrogram.render()
    Trim.updateUI()
    Playback.updateMarker()

    const newTotal = wrapperWidth * State.zoomLevel
    wrapper.scrollLeft = centerFrac * newTotal - wrapperWidth / 2
    Spectrogram.updateTimeBar()
}

export function zoomIn(): void {
    if (State.zoomLevel >= State.MAX_ZOOM) return
    const old = State.zoomLevel
    State.zoomLevel = Math.min(State.zoomLevel * 2, State.MAX_ZOOM)
    applyZoom(old)
}

export function zoomOut(): void {
    if (State.zoomLevel <= 1) return
    const old = State.zoomLevel
    State.zoomLevel = Math.max(State.zoomLevel / 2, 1)
    applyZoom(old)
}

zoomInBtn.addEventListener("click", zoomIn)

zoomOutBtn.addEventListener("click", zoomOut)

// ---- Process & Save ----
saveBtn.addEventListener("click", async () => {
    if (!State.audioBuffer) return
    State.ensureAudioCtx()
    Playback.stop()
    UI.showLoading("Processing audio...")
    await new Promise((r) => setTimeout(r, 50))

    try {
        const rendered = await Processing.process()
        const blob = Processing.encodeWAV(rendered)
        Processing.downloadBlob(blob, State.fileName + "_edited.wav")
        UI.hideLoading()
    } catch (err) {
        UI.hideLoading()
        alert("Processing error: " + (err as Error).message)
        console.error(err)
    }
})

// Rerender spectrogram on window resize (debounced) and preserve center position
let __spectrogramResizeTimer: number | null = null
window.addEventListener("resize", () => {
    if (!State.audioBuffer) return

    const wrapper = Spectrogram.wrapper
    const oldWidth = wrapper.clientWidth
    const oldScroll = wrapper.scrollLeft
    const oldTotal = oldWidth * State.zoomLevel
    const centerFrac = oldTotal ? (oldScroll + oldWidth / 2) / oldTotal : 0.5

    if (__spectrogramResizeTimer !== null) {
        window.clearTimeout(__spectrogramResizeTimer)
    }

    // Wait for resize to settle before re-rendering
    __spectrogramResizeTimer = window.setTimeout(() => {
        // Re-render canvas to match new layout
        Spectrogram.render()
        Trim.updateUI()
        Playback.updateMarker()
        Spectrogram.updateFreqAxis()

        // Restore scroll so center stays focused
        const newWidth = wrapper.clientWidth
        const newTotal = newWidth * State.zoomLevel
        wrapper.scrollLeft = centerFrac * newTotal - newWidth / 2

        Spectrogram.updateTimeBar()
        __spectrogramResizeTimer = null
    }, 150)
})
