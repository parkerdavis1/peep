/**
 * Audio processing pipeline and WAV encoding.
 * Reads settings from appState instead of DOM inputs.
 */
import { appState } from "$lib/state.svelte.ts";
import { applyFadeEnvelope } from "$lib/audio/fade.ts";
import { downloadBlob } from "$lib/utils/blob.ts";

/**
 * Process the audio: trim, HP filter, fade in/out, normalize.
 * @returns The rendered result.
 */
export async function process(): Promise<AudioBuffer> {
  const buf = appState.audioBuffer!;
  const sr = buf.sampleRate;
  const dur = buf.duration;
  const numCh = buf.numberOfChannels;

  const startSec = appState.trimStart * dur;
  const endSec = appState.trimEnd * dur;
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

  let lastNode: AudioNode = source;

  if (appState.hpEnabled) {
    const hp = offline.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = appState.hpFreq;
    hp.Q.value = 0.707;
    lastNode.connect(hp);
    lastNode = hp;
  }

  // Fade in / out
  const gain = offline.createGain();
  applyFadeEnvelope(
    gain,
    regionDur,
    0,
    appState.fadeDuration,
    appState.fadeEnabled,
  );

  lastNode.connect(gain);
  gain.connect(offline.destination);
  source.start(0);

  const rendered = await offline.startRendering();

  // Normalize to -3 dB
  if (appState.normalizeEnabled) {
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

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Encode an AudioBuffer to a WAV Blob.
 *
 * @param buffer    The rendered AudioBuffer to encode.
 * @param bitDepth  Output bit depth: 16, 24, or 32.
 * @param isFloat   When true and bitDepth is 32, writes 32-bit IEEE float
 *                  (format code 3). Otherwise writes integer PCM (format code 1).
 */
export function encodeWAV(
  buffer: AudioBuffer,
  bitDepth: number,
  isFloat: boolean,
): Blob {
  const sr = buffer.sampleRate;
  const numCh = buffer.numberOfChannels;
  const numSamples = buffer.length;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numCh * bytesPerSample;
  const byteRate = sr * blockAlign;
  const dataSize = numSamples * blockAlign;
  const totalSize = 44 + dataSize;

  // format code: 3 = IEEE float, 1 = integer PCM
  const formatCode = isFloat && bitDepth === 32 ? 3 : 1;

  const arrayBuf = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuf);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, totalSize - 8, true);
  writeString(view, 8, "WAVE");

  // fmt chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, formatCode, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numCh; ch++) channels.push(buffer.getChannelData(ch));

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      let s = channels[ch][i];
      // Clamp to [-1, 1] for integer formats (float can exceed this range)
      if (formatCode === 1) {
        if (s > 1) s = 1;
        if (s < -1) s = -1;
      }

      if (bitDepth === 16) {
        view.setInt16(offset, Math.trunc(s * 0x7fff), true);
        offset += 2;
      } else if (bitDepth === 24) {
        // DataView has no setInt24 — write 3 bytes little-endian manually
        const int24 = Math.round(s * 0x7fffff);
        view.setUint8(offset, int24 & 0xff);
        view.setUint8(offset + 1, (int24 >> 8) & 0xff);
        view.setUint8(offset + 2, (int24 >> 16) & 0xff);
        offset += 3;
      } else if (bitDepth === 32 && isFloat) {
        view.setFloat32(offset, s, true);
        offset += 4;
      } else {
        // 32-bit integer PCM
        view.setInt32(offset, Math.round(s * 0x7fffffff), true);
        offset += 4;
      }
    }
  }

  return new Blob([arrayBuf], { type: "audio/wav" });
}

export { downloadBlob };
