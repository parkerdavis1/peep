import { expect, test, describe, beforeEach, afterEach, vi } from "vitest";
import { mount, unmount } from "svelte";
import { tick } from "svelte";
import PlaybackControls from "./PlaybackControls.svelte";
import { appState } from "$lib/state.svelte";

describe("PlaybackControls Component", () => {
  let target: HTMLElement;
  let component: any;

  beforeEach(() => {
    // Mock necessary state
    appState.isPlaying = false;
    appState.trimStart = 0.2;
    appState.markerPos = 0.5;

    target = document.createElement("div");
    document.body.appendChild(target);

    // Instead of spying on the module, we'll verify the side effects on the state
    // since we know what those functions do.
    // (ESM modules can't easily be spied on in Vitest browser mode)
    // Set some initial state that would be changed by the real functions
    appState.audioCtx = {
      state: "running",
      currentTime: 0,
      resume: vi.fn(),
      createBufferSource: vi.fn().mockReturnValue({
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
      }),
      createGain: vi.fn().mockReturnValue({
        gain: {
          value: 1,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      }),
    } as any;
    appState.audioBuffer = { duration: 10 } as any;
  });

  afterEach(() => {
    if (component) {
      unmount(component);
      component = undefined;
    }
    document.body.removeChild(target);
    vi.restoreAllMocks();
  });

  test("clicking play button toggles playback state", async () => {
    component = mount(PlaybackControls, { target });
    const playBtn = target.querySelector(".play-btn") as HTMLButtonElement;

    // Initial state is paused (shows play icon ▶)
    expect(playBtn).toHaveAttribute("aria-label", "Play");

    // Set realistic appState for start()
    appState.hpEnabled = false;

    // Click play
    playBtn.click();

    // Wait for async toggle/start to complete
    await new Promise((r) => setTimeout(r, 0));
    await tick();

    expect(appState.isPlaying).toBe(true);

    // Button should update to pause icon (⏸ which is ▮▮)
    expect(playBtn).toHaveAttribute("aria-label", "Pause");
  });

  test("clicking rewind button calls rewind and updates state", async () => {
    component = mount(PlaybackControls, { target });
    const rewindBtn = target.querySelector(".rewind-btn") as HTMLButtonElement;

    // Force marker away from trimStart to observe the change
    appState.markerPos = 0.5;

    rewindBtn.click();
    await tick();

    expect(appState.markerPos).toBe(0.2); // Resets to trimStart
  });
});
