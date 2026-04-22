/**
 * Spectrogram computation and canvas rendering.
 */
import State from "./state.ts"
import { fft } from "./fft.ts"
import { formatTime } from "./utils.ts"

const FFT_SIZE = 2048
const HOP = 512
const MAX_FREQ = 10000

// DOM refs
const wrapper = document.getElementById("spectrogramScrollWrap")!
const inner = document.getElementById("spectrogramInner")!
const canvas = document.getElementById("spectrogram") as HTMLCanvasElement
const canvasCtx = canvas.getContext("2d")!
const freqAxis = document.getElementById("freqAxis")!
const timeRuler = document.getElementById("timeRuler")!
const timeStartEl = document.getElementById("timeStart")!
const timeEndEl = document.getElementById("timeEnd")!
const zoomLevelEl = document.getElementById("zoomLevel")!

/**
 * Compute spectrogram data from the current audioBuffer.
 * Stores result in State.spectrogramData / Cols / Rows.
 */
function compute(): void {
    const buf = State.audioBuffer!
    const sr = buf.sampleRate
    const length = buf.length
    const numCh = buf.numberOfChannels

    // Mix to mono for display
    const mono = new Float32Array(length)
    for (let ch = 0; ch < numCh; ch++) {
        const chData = buf.getChannelData(ch)
        for (let i = 0; i < length; i++) {
            mono[i] += chData[i] / numCh
        }
    }

    const numCols = Math.floor((length - FFT_SIZE) / HOP) + 1
    const binHz = sr / FFT_SIZE
    const maxBin = Math.min(Math.ceil(MAX_FREQ / binHz), FFT_SIZE / 2)

    // Hann window (pre-compute once)
    const win = new Float32Array(FFT_SIZE)
    for (let i = 0; i < FFT_SIZE; i++) {
        win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)))
    }

    const data = new Float32Array(numCols * maxBin)
    const real = new Float32Array(FFT_SIZE)
    const imag = new Float32Array(FFT_SIZE)

    for (let col = 0; col < numCols; col++) {
        const offset = col * HOP
        for (let i = 0; i < FFT_SIZE; i++) {
            real[i] = mono[offset + i] * win[i]
            imag[i] = 0
        }

        fft(real, imag, FFT_SIZE)

        for (let bin = 0; bin < maxBin; bin++) {
            const mag = Math.sqrt(real[bin] * real[bin] + imag[bin] * imag[bin])
            data[col * maxBin + bin] = mag > 0 ? 20 * Math.log10(mag) : -100
        }
    }

    State.spectrogramData = data
    State.spectrogramCols = numCols
    State.spectrogramRows = maxBin
}

/**
 * Render the pre-computed spectrogram to the canvas at current zoom level.
 */
function render(): void {
    const data = State.spectrogramData
    if (!data) return

    const cols = State.spectrogramCols
    const rows = State.spectrogramRows
    const canvasWidth = wrapper.clientWidth * State.zoomLevel

    canvas.width = cols
    canvas.height = rows
    canvas.style.width = canvasWidth + "px"
    inner.style.width = canvasWidth + "px"
    timeRuler.style.width = canvasWidth + "px"

    // Find dB range for color mapping
    let minDb = 0,
        maxDb = -200
    for (let i = 0; i < data.length; i++) {
        if (data[i] < minDb) minDb = data[i]
        if (data[i] > maxDb) maxDb = data[i]
    }
    if (minDb < -60) minDb = -60
    if (maxDb < -10) maxDb = -10
    const range = maxDb - minDb || 1

    const imgData = canvasCtx.createImageData(cols, rows)
    const pixels = imgData.data

    for (let col = 0; col < cols; col++) {
        for (let row = 0; row < rows; row++) {
            let norm = (data[col * rows + row] - minDb) / range
            if (norm < 0) norm = 0
            if (norm > 1) norm = 1

            norm = Math.pow(norm, 1.2)

            const grey = Math.round((1 - norm) * 255)
            const y = rows - 1 - row // low freq at bottom
            const idx = (y * cols + col) * 4
            pixels[idx] = grey
            pixels[idx + 1] = grey
            pixels[idx + 2] = grey
            pixels[idx + 3] = 255
        }
    }

    canvasCtx.putImageData(imgData, 0, 0)
    zoomLevelEl.textContent = State.zoomLevel + "x"
    updateTimeRuler()
    updateFreqAxis()
}

// ---- Freq axis constants ----
const RULER_H = 20 // matches .time-ruler height in px
const SPEC_H = 200 // matches canvas/spectrogram-inner height in px

// ---- Time ruler constants ----
const MIN_TICK_PX = 3 // minimum px between tick marks before switching to coarser interval
const MIN_LABEL_PX = 55 // minimum px between labels
const TICK_CANDIDATES = [1, 2, 5, 10, 30, 60]
const LABEL_CANDIDATES = [1, 2, 5, 10, 15, 30, 60, 120]

function formatTickLabel(t: number): string {
    const totalSec = Math.round(t)
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    return m + ":" + (s < 10 ? "0" : "") + s
}

/**
 * Regenerate the time ruler ticks to match the current zoom / duration.
 * Called from render() so it always stays in sync.
 */
function updateTimeRuler(): void {
    const buf = State.audioBuffer
    if (!buf) return

    const dur = buf.duration
    const totalWidth = parseFloat(inner.style.width) || wrapper.clientWidth
    const pxPerSec = totalWidth / dur

    // Pick the coarsest tick interval that still keeps marks >= MIN_TICK_PX apart.
    // Defaults to the finest (1 s) whenever there is enough room.
    const tickInterval =
        TICK_CANDIDATES.find((c) => c * pxPerSec >= MIN_TICK_PX) ??
        TICK_CANDIDATES[TICK_CANDIDATES.length - 1]

    // Label interval must be a multiple of tickInterval so labels always
    // land on a tick mark.  Pick the smallest that keeps labels >= MIN_LABEL_PX apart.
    const labelCandidates = LABEL_CANDIDATES.filter(
        (n) => n % tickInterval === 0,
    )
    const labelInterval =
        labelCandidates.find((c) => c * pxPerSec >= MIN_LABEL_PX) ??
        labelCandidates[labelCandidates.length - 1] ??
        tickInterval

    timeRuler.innerHTML = ""

    const numTicks = Math.floor(dur / tickInterval)
    for (let i = 0; i <= numTicks; i++) {
        const t = i * tickInterval
        const x = (t / dur) * totalWidth
        const isLabeled = t % labelInterval === 0

        const tick = document.createElement("div")
        tick.className = isLabeled ? "time-tick major" : "time-tick"
        tick.style.left = Math.round(x) + "px"

        if (isLabeled) {
            const label = document.createElement("span")
            label.textContent = formatTickLabel(t)
            tick.appendChild(label)
        }

        timeRuler.appendChild(tick)
    }
}

/**
 * Draw frequency axis tick labels (1k–10k), positioned absolutely
 * so they align accurately with the spectrogram canvas.
 */
function updateFreqAxis(): void {
    const buf = State.audioBuffer
    if (!buf) return

    freqAxis.innerHTML = ""
    const maxFreq = Math.min(MAX_FREQ, buf.sampleRate / 2)
    const ticks = [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000]

    for (const freq of ticks) {
        if (freq > maxFreq) break
        const top = RULER_H + (1 - freq / maxFreq) * SPEC_H
        const label = document.createElement("div")
        label.className = "freq-label"
        label.style.top = top + "px"
        label.textContent = freq / 1000 + "k"
        freqAxis.appendChild(label)
    }
}

/**
 * Update the time labels below the spectrogram based on scroll position.
 */
function updateTimeBar(): void {
    const buf = State.audioBuffer
    if (!buf) return
    const dur = buf.duration
    const wrapperWidth = wrapper.clientWidth
    const totalWidth = parseFloat(inner.style.width) || wrapperWidth
    const scrollLeft = wrapper.scrollLeft
    timeStartEl.textContent = formatTime((scrollLeft / totalWidth) * dur)
    timeEndEl.textContent = formatTime(
        ((scrollLeft + wrapperWidth) / totalWidth) * dur,
    )
}

wrapper.addEventListener("scroll", updateTimeBar)

export const Spectrogram = {
    compute,
    render,
    updateFreqAxis,
    updateTimeBar,
    wrapper,
    inner,
}
