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

describe("WAV Encoding", () => {
  test("encodeWAV generates valid 16-bit PCM WAV blob", async () => {
    const ctx = new OfflineAudioContext(1, 44100, 44100);
    const buffer = ctx.createBuffer(1, 44100, 44100); // 1 sec, mono

    const blob = encodeWAV(buffer);
    expect(blob.type).toBe("audio/wav");
    expect(blob.size).toBe(44 + 44100 * 2); // 44 bytes header + (44100 samples * 1 channel * 2 bytes/sample)

    const arrayBuffer = await blob.arrayBuffer();
    const view = new DataView(arrayBuffer);

    // Check RIFF header
    const riff = String.fromCharCode(
      view.getUint8(0),
      view.getUint8(1),
      view.getUint8(2),
      view.getUint8(3),
    );
    expect(riff).toBe("RIFF");

    // Check WAVE format
    const wave = String.fromCharCode(
      view.getUint8(8),
      view.getUint8(9),
      view.getUint8(10),
      view.getUint8(11),
    );
    expect(wave).toBe("WAVE");
  });
});
