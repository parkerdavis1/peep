import { expect, test, describe, beforeEach, afterEach, vi } from "vitest";
import { updateMarker, start, stop, rewind } from "./playback";
import { appState } from "$lib/state.svelte.ts";

describe("Playback Logic", () => {
  beforeEach(() => {
    // Mock AudioContext and AudioBuffer
    class AudioContextMock {
      state = "running";
      currentTime = 0;
      resume = vi.fn();
      listeners: Record<string, Function[]> = {};
      addEventListener = vi.fn((event, cb) => {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(cb);
      });
      dispatchEvent = (event: string) => {
        if (this.listeners[event]) {
          this.listeners[event].forEach((cb) => cb());
        }
      };
      createBufferSource = vi.fn().mockReturnValue({
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
      });
      createBiquadFilter = vi.fn().mockReturnValue({
        frequency: { value: 0 },
        Q: { value: 0 },
        connect: vi.fn(),
        disconnect: vi.fn(),
      });
      createGain = vi.fn().mockReturnValue({
        gain: {
          value: 1,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      });
      destination = {};
    }

    window.AudioContext = AudioContextMock as any;

    const bufferMock = {
      duration: 10,
      numberOfChannels: 1,
      getChannelData: vi.fn().mockReturnValue(new Float32Array(44100)),
    } as unknown as AudioBuffer;

    appState.audioCtx = null;
    appState.audioBuffer = bufferMock;
    appState.trimStart = 0.2; // 2 seconds
    appState.trimEnd = 0.8; // 8 seconds
    appState.markerPos = 0.5; // 5 seconds
    appState.isPlaying = false;
  });

  afterEach(() => {
    stop();
  });

  test("updateMarker clamps to trim regions", () => {
    appState.markerPos = 0.1; // Before trim start
    updateMarker();
    expect(appState.markerPos).toBe(0.2);

    appState.markerPos = 0.9; // After trim end
    updateMarker();
    expect(appState.markerPos).toBe(0.8);

    appState.markerPos = 0.5; // Inside region
    updateMarker();
    expect(appState.markerPos).toBe(0.5);
  });

  test("timeDisplayText calculates correctly based on trim region", () => {
    // Region is 2s to 8s (6s duration)
    // Marker is at 0.5 (5s absolute)

    // Offset is 5s - 2s = 3s. Duration is 6s.
    expect(appState.timeDisplayText).toBe("0:03.0 / 0:06.0");

    // Update explicitly
    appState.markerPos = 0.2; // Exact start of trim
    expect(appState.timeDisplayText).toBe("0:00.0 / 0:06.0");
  });

  test("start() initializes audio nodes based on settings", async () => {
    appState.hpEnabled = true;
    appState.fadeEnabled = true;
    appState.normalizeEnabled = true;

    await start();

    expect(appState.isPlaying).toBe(true);
    expect(appState.sourceNode).not.toBeNull();
    expect(appState.filterNode).not.toBeNull();
    expect(appState.fadeNode).not.toBeNull();
    expect(appState.normalizeNode).not.toBeNull();
  });

  test("start() respects disabled settings", async () => {
    appState.hpEnabled = false;
    appState.fadeEnabled = false; // Still creates node, but envelope doesn't ramp
    appState.normalizeEnabled = false;

    await start();

    expect(appState.isPlaying).toBe(true);
    expect(appState.filterNode).toBeNull();
    expect(appState.normalizeNode).toBeNull();
    // Fade node is always created to handle routing, but application logic checks it
    expect(appState.fadeNode).not.toBeNull();
  });

  test("stop() cleans up nodes and stops playing", async () => {
    await start();
    expect(appState.isPlaying).toBe(true);

    const sourceNode = appState.sourceNode;
    stop();

    expect(appState.isPlaying).toBe(false);
    expect(sourceNode?.stop).toHaveBeenCalled();
    expect(sourceNode?.disconnect).toHaveBeenCalled();
    expect(appState.sourceNode).toBeNull();
  });

  test("rewind() moves marker to trimStart", async () => {
    appState.markerPos = 0.5;
    await rewind();
    expect(appState.markerPos).toBe(0.2); // trimStart
    expect(appState.isPlaying).toBe(false); // Should stop if not playing
  });

  test("rewind() while playing restarts playback from trimStart", async () => {
    appState.isPlaying = true; // Fake state for rewind to detect "wasPlaying"
    // Actually start so we have a context
    await start();
    appState.markerPos = 0.5;

    await rewind();

    expect(appState.markerPos).toBe(0.2); // Resets
    expect(appState.isPlaying).toBe(true); // Restarts
  });

  test("playback does not go beyond trim handles", async () => {
    appState.markerPos = 0.5; // Starts in the middle
    appState.trimStart = 0.2;
    appState.trimEnd = 0.8;

    await start();

    // sourceNode is set during start()
    const sourceNode = appState.sourceNode as any;

    // The duration is 10s.
    // Start sec: 0.5 * 10 = 5s
    // Trim end: 0.8 * 10 = 8s
    // Remaining duration should be 3s.
    expect(sourceNode.start).toHaveBeenCalledWith(0, 5, 3);
  });

  test("playback restarts from trimStart if marker is outside trim bounds", async () => {
    // Test marker before trimStart
    appState.trimStart = 0.2;
    appState.trimEnd = 0.8;
    appState.markerPos = 0.1;
    await start();

    let sourceNode = appState.sourceNode as any;
    expect(sourceNode.start).toHaveBeenCalledWith(0, 2, 6);
    expect(appState.markerPos).toBe(0.2);

    stop();

    // Test marker exactly at or after trimEnd
    appState.markerPos = 0.85;
    await start();

    sourceNode = appState.sourceNode as any;
    expect(sourceNode.start).toHaveBeenCalledWith(0, 2, 6);
    expect(appState.markerPos).toBe(0.2);
  });

  test("stop(true) is called if AudioContext state changes to interrupted while playing", async () => {
    await start();
    expect(appState.isPlaying).toBe(true);

    const ctx = appState.audioCtx as any;
    ctx.state = "interrupted";
    ctx.dispatchEvent("statechange");

    expect(appState.isPlaying).toBe(false);
  });

  test("zombie detector stops playback if real time advances but audio time is frozen", async () => {
    vi.useFakeTimers();

    // Mock performance.now to control real time
    let perfTime = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => perfTime);

    // Fake window.requestAnimationFrame
    let rAFCallback: FrameRequestCallback | null = null;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      rAFCallback = cb;
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {
      rAFCallback = null;
    });

    await start();
    expect(appState.isPlaying).toBe(true);

    expect(rAFCallback).not.toBeNull();

    // Advance real time by 600ms, but DO NOT advance ctx.currentTime
    perfTime += 600;

    // Call the rAF callback with the new timestamp to simulate the next frame
    rAFCallback!(perfTime);

    expect(appState.isPlaying).toBe(false);

    vi.useRealTimers();
    vi.restoreAllMocks();
  });
});
