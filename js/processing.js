/**
 * Audio processing pipeline and WAV encoding.
 */
import State from './state.js';

const hpEnabled = document.getElementById('hpEnabled');
const hpFreq = document.getElementById('hpFreq');
const normalizeEnabled = document.getElementById('normalizeEnabled');

/**
 * Process the audio: trim, HP filter, fade in/out, normalize.
 * @returns {Promise<AudioBuffer>} The rendered result.
 */
async function process() {
  const buf = State.audioBuffer;
  const sr = buf.sampleRate;
  const dur = buf.duration;
  const numCh = buf.numberOfChannels;

  const startSec = State.trimStart * dur;
  const endSec = State.trimEnd * dur;
  const regionDur = endSec - startSec;
  const regionSamples = Math.round(regionDur * sr);
  const startSample = Math.round(startSec * sr);

  // Create trimmed buffer
  const trimmed = new AudioBuffer({
    numberOfChannels: numCh,
    length: regionSamples,
    sampleRate: sr,
  });
  for (let ch = 0; ch < numCh; ch++) {
    const src = buf.getChannelData(ch);
    const dst = trimmed.getChannelData(ch);
    for (let i = 0; i < regionSamples; i++) {
      dst[i] = src[startSample + i];
    }
  }

  // Offline render: filter + fades
  const offline = new OfflineAudioContext(numCh, regionSamples, sr);
  const source = offline.createBufferSource();
  source.buffer = trimmed;

  let lastNode = source;

  if (hpEnabled.checked) {
    const hp = offline.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = parseFloat(hpFreq.value);
    hp.Q.value = 0.707;
    lastNode.connect(hp);
    lastNode = hp;
  }

  // Fade in / out (1 second each)
  const fadeDur = 1.0;
  const gain = offline.createGain();
  gain.gain.setValueAtTime(0, 0);
  gain.gain.linearRampToValueAtTime(1, Math.min(fadeDur, regionDur / 2));
  const fadeOutStart = Math.max(regionDur - fadeDur, regionDur / 2);
  gain.gain.setValueAtTime(1, fadeOutStart);
  gain.gain.linearRampToValueAtTime(0, regionDur);

  lastNode.connect(gain);
  gain.connect(offline.destination);
  source.start(0);

  const rendered = await offline.startRendering();

  // Normalize to -3 dB
  if (normalizeEnabled.checked) {
    const target = Math.pow(10, -3 / 20);
    let peak = 0;
    for (let ch = 0; ch < rendered.numberOfChannels; ch++) {
      const d = rendered.getChannelData(ch);
      for (let i = 0; i < d.length; i++) {
        const abs = Math.abs(d[i]);
        if (abs > peak) peak = abs;
      }
    }
    if (peak > 0) {
      const g = target / peak;
      for (let ch = 0; ch < rendered.numberOfChannels; ch++) {
        const d = rendered.getChannelData(ch);
        for (let i = 0; i < d.length; i++) d[i] *= g;
      }
    }
  }

  return rendered;
}

// ---- WAV Encoding ----

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Encode an AudioBuffer to a 16-bit PCM WAV Blob.
 */
function encodeWAV(buffer) {
  const sr = buffer.sampleRate;
  const numCh = buffer.numberOfChannels;
  const numSamples = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const byteRate = sr * blockAlign;
  const dataSize = numSamples * blockAlign;
  const totalSize = 44 + dataSize;

  const arrayBuf = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuf);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);   // PCM
  view.setUint16(22, numCh, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);  // bits per sample

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const channels = [];
  for (let ch = 0; ch < numCh; ch++) channels.push(buffer.getChannelData(ch));

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      let s = channels[ch][i];
      if (s > 1) s = 1;
      if (s < -1) s = -1;
      view.setInt16(offset, s * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuf], { type: 'audio/wav' });
}

/**
 * Trigger a file download from a Blob.
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

export const Processing = { process, encodeWAV, downloadBlob };
