import { expect, test, describe, beforeEach, vi } from "vitest";
import { process, encodeWAV } from "./processing";
import { formatTime } from "$lib/utils/format.ts";
import { applyFadeEnvelope } from "$lib/audio/fade.ts";
import { appState } from "$lib/state.svelte.ts";

describe("Audio Utilities", () => {
  test("formatTime formats seconds properly", () => {
    expect(formatTime(0)).toBe("0:00.0");
    expect(formatTime(9.5)).toBe("0:09.5");
    expect(formatTime(65.123)).toBe("1:05.1");
    expect(formatTime(120)).toBe("2:00.0");
    expect(formatTime(Infinity)).toBe("0:00.0");
    expect(formatTime(NaN)).toBe("0:00.0");
  });

  test("applyFadeEnvelope sets correct scheduling for enabled fades", () => {
    // Mock a GainNode with its gain AudioParam
    const setValueAtTime = vi.fn();
    const linearRampToValueAtTime = vi.fn();
    const gainNode = {
      gain: {
        setValueAtTime,
        linearRampToValueAtTime,
      },
    } as unknown as GainNode;

    // 10 second region, 1s fade, started exactly at context time 5
    applyFadeEnvelope(gainNode, 10, 5, 1, true, 0);

    expect(setValueAtTime).toHaveBeenCalledWith(0.0001, 5); // Start at silence
    expect(linearRampToValueAtTime).toHaveBeenCalledWith(1, 6); // Ramp to 1 after 1 second
    expect(setValueAtTime).toHaveBeenCalledWith(1, 14); // Hold at 1 until 9th second (context time 14)
    expect(linearRampToValueAtTime).toHaveBeenCalledWith(0.0001, 15); // Ramp to silence at end (context time 15)
  });

  test("applyFadeEnvelope disables fades correctly", () => {
    const setValueAtTime = vi.fn();
    const linearRampToValueAtTime = vi.fn();
    const gainNode = {
      gain: {
        setValueAtTime,
        linearRampToValueAtTime,
      },
    } as unknown as GainNode;

    applyFadeEnvelope(gainNode, 10, 5, 1, false, 0);

    // If disabled, just hold it at 1
    expect(setValueAtTime).toHaveBeenCalledWith(1, 5);
    expect(linearRampToValueAtTime).not.toHaveBeenCalled();
  });
});

describe("Audio Processing Pipeline", () => {
  beforeEach(() => {
    // Mock a 2-second AudioBuffer at 44100 Hz
    const ctx = new OfflineAudioContext(1, 44100 * 2, 44100);
    const buffer = ctx.createBuffer(1, 44100 * 2, 44100);
    // Fill with dummy data (0.5 max amplitude)
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = 0.5;
    }

    appState.audioBuffer = buffer;
    appState.trimStart = 0;
    appState.trimEnd = 1;
    appState.hpEnabled = false;
    appState.fadeEnabled = false;
    appState.normalizeEnabled = false;
  });

  test("process() correctly trims audio", async () => {
    // Trim to middle 1 second (25% to 75% of 2 seconds)
    appState.trimStart = 0.25;
    appState.trimEnd = 0.75;

    const result = await process();
    // Result should be exactly 1 second long (44100 samples)
    expect(result.duration).toBeCloseTo(1.0, 3);
    expect(result.length).toBe(44100);
  });

  test("process() normalizes to -3 dB", async () => {
    appState.normalizeEnabled = true;

    const result = await process();
    const data = result.getChannelData(0);

    let maxPeak = 0;
    for (let i = 0; i < data.length; i++) {
      if (Math.abs(data[i]) > maxPeak) maxPeak = Math.abs(data[i]);
    }

    // -3 dB is approx 0.707 linear amplitude
    const target = Math.pow(10, -3 / 20);
    expect(maxPeak).toBeCloseTo(target, 4);
  });
});

// ---------------------------------------------------------------------------
// WAV header helpers (shared across encoding tests)
// ---------------------------------------------------------------------------

function readString(view: DataView, offset: number, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(offset + i));
  return s;
}

function makeFilledBuffer(numSamples: number, value: number): AudioBuffer {
  const ctx = new OfflineAudioContext(1, numSamples, 44100);
  const buffer = ctx.createBuffer(1, numSamples, 44100);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < numSamples; i++) data[i] = value;
  return buffer;
}

describe("WAV Encoding", () => {
  // ---- 16-bit PCM ----

  test("encodeWAV generates valid 16-bit PCM WAV blob", async () => {
    const ctx = new OfflineAudioContext(1, 44100, 44100);
    const buffer = ctx.createBuffer(1, 44100, 44100); // 1 sec, mono

    const blob = encodeWAV(buffer, 16, false);
    expect(blob.type).toBe("audio/wav");
    expect(blob.size).toBe(44 + 44100 * 2); // 44 bytes header + (44100 samples * 1 channel * 2 bytes/sample)

    const arrayBuffer = await blob.arrayBuffer();
    const view = new DataView(arrayBuffer);

    expect(readString(view, 0, 4)).toBe("RIFF");
    expect(readString(view, 8, 4)).toBe("WAVE");
    expect(view.getUint16(20, true)).toBe(1);  // PCM format code
    expect(view.getUint16(34, true)).toBe(16); // bits per sample
  });

  test("encodeWAV 16-bit PCM encodes sample value 0.5 correctly", async () => {
    const buffer = makeFilledBuffer(1, 0.5);
    const blob = encodeWAV(buffer, 16, false);
    const view = new DataView(await blob.arrayBuffer());
    // 0.5 * 0x7fff = 16383.5 → rounded toward zero = 16383
    expect(view.getInt16(44, true)).toBe(Math.trunc(0.5 * 0x7fff));
  });

  // ---- 24-bit PCM ----

  test("encodeWAV generates valid 24-bit PCM WAV blob", async () => {
    const ctx = new OfflineAudioContext(1, 44100, 44100);
    const buffer = ctx.createBuffer(1, 44100, 44100);

    const blob = encodeWAV(buffer, 24, false);
    expect(blob.type).toBe("audio/wav");
    expect(blob.size).toBe(44 + 44100 * 3); // 3 bytes per sample

    const arrayBuffer = await blob.arrayBuffer();
    const view = new DataView(arrayBuffer);

    expect(readString(view, 0, 4)).toBe("RIFF");
    expect(readString(view, 8, 4)).toBe("WAVE");
    expect(view.getUint16(20, true)).toBe(1);  // PCM format code
    expect(view.getUint16(34, true)).toBe(24); // bits per sample
  });

  test("encodeWAV 24-bit PCM encodes sample value 0.5 correctly", async () => {
    const buffer = makeFilledBuffer(1, 0.5);
    const blob = encodeWAV(buffer, 24, false);
    const view = new DataView(await blob.arrayBuffer());
    // Read 3 little-endian bytes at offset 44 and reconstruct signed int24
    const lo = view.getUint8(44);
    const mid = view.getUint8(45);
    const hi = view.getUint8(46);
    let int24 = lo | (mid << 8) | (hi << 16);
    // Sign-extend from 24-bit
    if (int24 & 0x800000) int24 |= ~0xffffff;
    // 0.5 * 0x7fffff = 4194303.5 → Math.round = 4194304
    expect(int24).toBe(Math.round(0.5 * 0x7fffff));
  });

  // ---- 32-bit IEEE float ----

  test("encodeWAV generates valid 32-bit float WAV blob", async () => {
    const ctx = new OfflineAudioContext(1, 44100, 44100);
    const buffer = ctx.createBuffer(1, 44100, 44100);

    const blob = encodeWAV(buffer, 32, true);
    expect(blob.type).toBe("audio/wav");
    expect(blob.size).toBe(44 + 44100 * 4); // 4 bytes per sample

    const arrayBuffer = await blob.arrayBuffer();
    const view = new DataView(arrayBuffer);

    expect(readString(view, 0, 4)).toBe("RIFF");
    expect(readString(view, 8, 4)).toBe("WAVE");
    expect(view.getUint16(20, true)).toBe(3);  // IEEE float format code
    expect(view.getUint16(34, true)).toBe(32); // bits per sample
  });

  test("encodeWAV 32-bit float preserves exact sample values", async () => {
    const buffer = makeFilledBuffer(1, 0.5);
    const blob = encodeWAV(buffer, 32, true);
    const view = new DataView(await blob.arrayBuffer());
    // Float32 write is exact for 0.5
    expect(view.getFloat32(44, true)).toBe(0.5);
  });

  // ---- 32-bit integer PCM ----

  test("encodeWAV generates valid 32-bit integer PCM WAV blob", async () => {
    const ctx = new OfflineAudioContext(1, 44100, 44100);
    const buffer = ctx.createBuffer(1, 44100, 44100);

    const blob = encodeWAV(buffer, 32, false);
    expect(blob.type).toBe("audio/wav");
    expect(blob.size).toBe(44 + 44100 * 4); // 4 bytes per sample

    const arrayBuffer = await blob.arrayBuffer();
    const view = new DataView(arrayBuffer);

    expect(readString(view, 0, 4)).toBe("RIFF");
    expect(readString(view, 8, 4)).toBe("WAVE");
    expect(view.getUint16(20, true)).toBe(1);  // PCM format code
    expect(view.getUint16(34, true)).toBe(32); // bits per sample
  });

  test("encodeWAV 32-bit integer PCM encodes sample value 0.5 correctly", async () => {
    const buffer = makeFilledBuffer(1, 0.5);
    const blob = encodeWAV(buffer, 32, false);
    const view = new DataView(await blob.arrayBuffer());
    // 0.5 * 0x7fffffff = 1073741823.5 → Math.round = 1073741824
    expect(view.getInt32(44, true)).toBe(Math.round(0.5 * 0x7fffffff));
  });
});

describe("WAV Encoding — sample rate header", () => {
  test.each([44100, 48000, 88200, 96000])(
    "encodeWAV writes correct sample rate %i Hz to WAV header",
    async (sampleRate) => {
      const ctx = new OfflineAudioContext(1, sampleRate, sampleRate);
      const buffer = ctx.createBuffer(1, sampleRate, sampleRate);
      const blob = encodeWAV(buffer, 16, false);
      const view = new DataView(await blob.arrayBuffer());
      // WAV nSamplesPerSec field (offset 24)
      expect(view.getUint32(24, true)).toBe(sampleRate);
      // WAV nAvgBytesPerSec field (offset 28) — 16-bit mono = 2 bytes/sample
      expect(view.getUint32(28, true)).toBe(sampleRate * 2);
      // Total blob size matches: 44-byte header + (sampleRate samples × 2 bytes)
      expect(blob.size).toBe(44 + sampleRate * 2);
    },
  );
});
