/**
 * Spectrogram computation and canvas rendering.
 */
import State from './state.js';
import { fft } from './fft.js';
import { formatTime } from './utils.js';

const FFT_SIZE = 2048;
const HOP = 512;
const MAX_FREQ = 10000;

// DOM refs
const wrapper = document.getElementById('spectrogramWrapper');
const inner = document.getElementById('spectrogramInner');
const canvas = document.getElementById('spectrogram');
const ctx = canvas.getContext('2d');
const freqAxis = document.getElementById('freqAxis');
const timeStartEl = document.getElementById('timeStart');
const timeEndEl = document.getElementById('timeEnd');
const zoomLevelEl = document.getElementById('zoomLevel');

/**
 * Compute spectrogram data from the current audioBuffer.
 * Stores result in State.spectrogramData / Cols / Rows.
 */
function compute() {
  const buf = State.audioBuffer;
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
    win[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (FFT_SIZE - 1)));
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

  State.spectrogramData = data;
  State.spectrogramCols = numCols;
  State.spectrogramRows = maxBin;
}

/**
 * Render the pre-computed spectrogram to the canvas at current zoom level.
 */
function render() {
  const data = State.spectrogramData;
  if (!data) return;

  const cols = State.spectrogramCols;
  const rows = State.spectrogramRows;
  const canvasWidth = wrapper.clientWidth * State.zoomLevel;

  canvas.width = cols;
  canvas.height = rows;
  canvas.style.width = canvasWidth + 'px';
  inner.style.width = canvasWidth + 'px';

  // Find dB range for color mapping
  let minDb = 0, maxDb = -200;
  for (let i = 0; i < data.length; i++) {
    if (data[i] < minDb) minDb = data[i];
    if (data[i] > maxDb) maxDb = data[i];
  }
  if (minDb < -100) minDb = -100;
  if (maxDb < -10) maxDb = -10;
  const range = maxDb - minDb || 1;

  const imgData = ctx.createImageData(cols, rows);
  const pixels = imgData.data;

  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      let norm = (data[col * rows + row] - minDb) / range;
      if (norm < 0) norm = 0;
      if (norm > 1) norm = 1;

      const grey = Math.round((1 - norm) * 255);
      const y = rows - 1 - row; // low freq at bottom
      const idx = (y * cols + col) * 4;
      pixels[idx] = grey;
      pixels[idx + 1] = grey;
      pixels[idx + 2] = grey;
      pixels[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  zoomLevelEl.textContent = State.zoomLevel + 'x';
}

/**
 * Draw frequency axis tick labels (1k–10k).
 */
function updateFreqAxis() {
  const buf = State.audioBuffer;
  if (!buf) return;

  freqAxis.innerHTML = '';
  const maxFreq = Math.min(MAX_FREQ, buf.sampleRate / 2);
  const ticks = [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000];

  for (const freq of ticks) {
    if (freq > maxFreq) break;
    const pct = (1 - freq / maxFreq) * 100;
    const label = document.createElement('div');
    label.className = 'freq-label';
    label.style.top = pct + '%';
    label.textContent = (freq / 1000) + 'k';
    freqAxis.appendChild(label);
  }
}

/**
 * Update the time labels below the spectrogram based on scroll position.
 */
function updateTimeBar() {
  const buf = State.audioBuffer;
  if (!buf) return;
  const dur = buf.duration;
  const wrapperWidth = wrapper.clientWidth;
  const totalWidth = parseFloat(inner.style.width) || wrapperWidth;
  const scrollLeft = wrapper.scrollLeft;
  timeStartEl.textContent = formatTime((scrollLeft / totalWidth) * dur);
  timeEndEl.textContent = formatTime(((scrollLeft + wrapperWidth) / totalWidth) * dur);
}

wrapper.addEventListener('scroll', updateTimeBar);

export const Spectrogram = { compute, render, updateFreqAxis, updateTimeBar, wrapper, inner };
