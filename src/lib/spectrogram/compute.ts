import { appState } from "$lib/state.svelte.ts";
import { fft } from "$lib/spectrogram/fft.ts";

const FFT_SIZE = 2048;
const HOP = 512;
const MAX_FREQ = 10000;

export const RULER_H = 20; // matches .time-ruler height in px
export const SPEC_H = 200; // matches canvas/spectrogram-inner height in px

export function compute(): void {
  const buf = appState.audioBuffer!;
  const sr = buf.sampleRate;
  const length = buf.length;
  const numCh = buf.numberOfChannels;

  // Mix to mono for display
  const mono = new Float32Array(length);
  for (let ch = 0; ch < numCh; ch++) {
    const chData = buf.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      mono[i] += chData[i] / numCh;
    }
  }

  const numCols = Math.floor((length - FFT_SIZE) / HOP) + 1;
  const binHz = sr / FFT_SIZE;
  const maxBin = Math.min(Math.ceil(MAX_FREQ / binHz), FFT_SIZE / 2);

  // Hann window (pre-compute once)
  const win = new Float32Array(FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i++) {
    win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
  }

  const data = new Float32Array(numCols * maxBin);
  const real = new Float32Array(FFT_SIZE);
  const imag = new Float32Array(FFT_SIZE);

  for (let col = 0; col < numCols; col++) {
    const offset = col * HOP;
    for (let i = 0; i < FFT_SIZE; i++) {
      real[i] = mono[offset + i] * win[i];
      imag[i] = 0;
    }

    fft(real, imag, FFT_SIZE);

    for (let bin = 0; bin < maxBin; bin++) {
      const mag = Math.sqrt(real[bin] * real[bin] + imag[bin] * imag[bin]);
      data[col * maxBin + bin] = mag > 0 ? 20 * Math.log10(mag) : -100;
    }
  }

  appState.spectrogramData = data;
  appState.spectrogramCols = numCols;
  appState.spectrogramRows = maxBin;
}

export function render(canvas: HTMLCanvasElement, canvasWidth: number): void {
  const data = appState.spectrogramData;
  if (!data) return;

  const cols = appState.spectrogramCols;
  const rows = appState.spectrogramRows;

  canvas.width = cols;
  canvas.height = rows;
  canvas.style.width = canvasWidth + "px";

  const canvasCtx = canvas.getContext("2d")!;

  // Find dB range for color mapping
  let minDb = 0;
  let maxDb = -200;
  for (let i = 0; i < data.length; i++) {
    if (data[i] < minDb) minDb = data[i];
    if (data[i] > maxDb) maxDb = data[i];
  }
  if (minDb < -60) minDb = -60;
  if (maxDb < -10) maxDb = -10;
  const range = maxDb - minDb || 1;

  const imgData = canvasCtx.createImageData(cols, rows);
  const pixels = imgData.data;

  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      let norm = (data[col * rows + row] - minDb) / range;
      if (norm < 0) norm = 0;
      if (norm > 1) norm = 1;

      norm = Math.pow(norm, 1.2);

      const grey = Math.round((1 - norm) * 255);
      const y = rows - 1 - row; // low freq at bottom
      const idx = (y * cols + col) * 4;
      pixels[idx] = grey;
      pixels[idx + 1] = grey;
      pixels[idx + 2] = grey;
      pixels[idx + 3] = 255;
    }
  }

  canvasCtx.putImageData(imgData, 0, 0);
}
