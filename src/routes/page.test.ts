import { expect, test, describe, beforeEach, afterEach, vi } from "vitest";
import { mount, unmount } from "svelte";
import { tick } from "svelte";
import Page from "./+page.svelte";
import { appState } from "$lib/state.svelte";

// We can't spy on ESM exports directly in vitest browser mode,
// but we can mock the entire module if we needed to.
// For this UI test, we can actually just let the real functions run,
// EXCEPT we don't want to actually download a file. We can mock URL.createObjectURL
// and HTMLAnchorElement.prototype.click to prevent real downloads.

describe("Application Flow", () => {
  let target: HTMLElement;
  let component: any;

  beforeEach(() => {
    // Mock window and document properties if needed by vitest/browser
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });

    // Prevent actual file downloads
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    // Provide a fake AudioContext for processing and state
    class AudioContextMock {
      state = "running";
      currentTime = 0;
      resume = vi.fn();
      decodeAudioData = vi
        .fn()
        .mockResolvedValue(
          new AudioBuffer({ length: 44100, sampleRate: 44100 }),
        );
      createBufferSource = vi.fn().mockReturnValue({
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
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
    }
    window.AudioContext = AudioContextMock as any;

    class OfflineAudioContextMock {
      createBufferSource = vi
        .fn()
        .mockReturnValue({ connect: vi.fn(), start: vi.fn() });
      createGain = vi.fn().mockReturnValue({
        gain: {
          value: 1,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      });
      createBiquadFilter = vi.fn().mockReturnValue({
        frequency: { value: 0 },
        Q: { value: 0 },
        connect: vi.fn(),
      });
      startRendering = vi
        .fn()
        .mockResolvedValue(
          new AudioBuffer({ length: 44100, sampleRate: 44100 }),
        );
      destination = {};
    }
    window.OfflineAudioContext = OfflineAudioContextMock as any;

    // Reset state
    appState.audioBuffer = null;
    appState.zoomLevel = 1;
    appState.isPlaying = false;
    appState.spectrogramData = null; // Prevent compute from actually doing heavy lifting

    target = document.createElement("div");
    document.body.appendChild(target);
  });

  afterEach(() => {
    if (component) {
      unmount(component);
      component = undefined;
    }
    if (document.body.contains(target)) {
      document.body.removeChild(target);
    }
    vi.restoreAllMocks();
  });

  test("renders splash screen initially", () => {
    component = mount(Page, { target });

    const splash = target.querySelector(".splash");
    expect(splash).not.toBeNull();
    expect(splash?.textContent).toContain("Open WAV File");
  });

  test("transitions to editor and handles zoom when audio buffer is loaded", async () => {
    component = mount(Page, { target });

    // Load fake buffer
    appState.audioBuffer = new AudioBuffer({
      length: 44100,
      sampleRate: 44100,
    });
    await tick();

    // Editor should now be visible
    const spectrogramSection = target.querySelector(".spectrogram-section");
    expect(spectrogramSection).not.toBeNull();

    const zoomLevelText = target.querySelector(".zoom-level") as HTMLElement;
    expect(zoomLevelText.textContent).toBe("1x");

    // Click zoom in button
    const zoomInBtn = Array.from(target.querySelectorAll(".zoom-btn")).find(
      (b) => b.textContent === "+",
    ) as HTMLButtonElement;
    zoomInBtn.click();
    await tick();

    expect(appState.zoomLevel).toBe(2);
    expect(zoomLevelText.textContent).toBe("2x");

    // Click zoom out button
    const zoomOutBtn = Array.from(target.querySelectorAll(".zoom-btn")).find(
      (b) => b.textContent === "−",
    ) as HTMLButtonElement;
    zoomOutBtn.click();
    await tick();

    expect(appState.zoomLevel).toBe(1);
    expect(zoomLevelText.textContent).toBe("1x");
  });

  test("handles save workflow without throwing", async () => {
    component = mount(Page, { target });
    appState.audioBuffer = new AudioBuffer({
      length: 44100,
      sampleRate: 44100,
    });
    appState.fileName = "test_audio";

    // Setup enough context so ensureAudioCtx doesn't blow up
    appState.audioCtx = new window.AudioContext();
    await tick();

    const saveBtn = target.querySelector(".save-btn") as HTMLButtonElement;
    saveBtn.click();

    // The save process is async and sets loading state
    await tick();

    // Let the setTimeout inside handleSave resolve and the promise chain finish
    await new Promise((r) => setTimeout(r, 100));
    await tick();

    // If we get here without an alert/error, the mocked process/encode workflow succeeded
    expect(appState.isLoading).toBe(false);
  });

  test("handles keyboard shortcuts", async () => {
    component = mount(Page, { target });
    appState.audioBuffer = new AudioBuffer({
      length: 44100,
      sampleRate: 44100,
    });
    appState.markerPos = 0.5;
    appState.trimStart = 0;
    appState.trimEnd = 1;
    await tick();

    const rightArrow = new KeyboardEvent("keydown", {
      code: "ArrowRight",
      bubbles: true,
    });
    document.dispatchEvent(rightArrow);
    await tick();
    expect(appState.markerPos).toBeCloseTo(0.505, 3);

    const leftArrow = new KeyboardEvent("keydown", {
      code: "ArrowLeft",
      bubbles: true,
    });
    document.dispatchEvent(leftArrow);
    await tick();
    expect(appState.markerPos).toBeCloseTo(0.5, 3);

    // Up/Down arrows control zoom
    const upArrow = new KeyboardEvent("keydown", {
      code: "ArrowUp",
      bubbles: true,
    });
    document.dispatchEvent(upArrow);
    await tick();
    expect(appState.zoomLevel).toBe(2);

    const downArrow = new KeyboardEvent("keydown", {
      code: "ArrowDown",
      bubbles: true,
    });
    document.dispatchEvent(downArrow);
    await tick();
    expect(appState.zoomLevel).toBe(1);
  });
});
