import { expect, test, describe, beforeEach, afterEach } from "vitest";
import { mount, unmount } from "svelte";
import { tick } from "svelte";
import Settings from "./Settings.svelte";
import { appState } from "$lib/state.svelte";

describe("Settings Component", () => {
  let target: HTMLElement;
  let component: any;

  beforeEach(() => {
    // Reset relevant state
    appState.hpEnabled = true;
    appState.hpFreq = 100;
    appState.normalizeEnabled = true;
    appState.fadeEnabled = true;
    appState.fadeDuration = 1.0;
    appState.filterNode = null;

    target = document.createElement("div");
    document.body.appendChild(target);
  });

  afterEach(() => {
    if (component) {
      unmount(component);
      component = undefined;
    }
    document.body.removeChild(target);
  });

  test("toggles High-pass filter via checkbox", async () => {
    component = mount(Settings, { target });

    const checkbox = target.querySelector("#hpEnabled") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    checkbox.click();
    await tick();

    expect(appState.hpEnabled).toBe(false);
  });

  test("updates High-pass freq via range input and updates active filter node", async () => {
    // Mock an active filter node
    appState.filterNode = {
      frequency: { value: 100 },
    } as any;

    component = mount(Settings, { target });

    const range = target.querySelector("#hpFreq") as HTMLInputElement;
    range.value = "200";

    // In Svelte 5, bind:value relies on input events, but range sometimes needs change too,
    // and the component has oninput={handleHpFreqInput}
    range.dispatchEvent(new Event("input", { bubbles: true }));
    range.dispatchEvent(new Event("change", { bubbles: true }));
    await tick();

    expect(appState.hpFreq).toBe(200);
    expect(appState.filterNode!.frequency.value).toBe(200);
  });

  test("toggles Normalize via checkbox", async () => {
    component = mount(Settings, { target });

    const checkbox = target.querySelector(
      "#normalizeEnabled",
    ) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    checkbox.click();
    await tick();

    expect(appState.normalizeEnabled).toBe(false);
  });

  test("toggles Fade via checkbox and updates range disabled state", async () => {
    component = mount(Settings, { target });

    const checkbox = target.querySelector("#fadeEnabled") as HTMLInputElement;
    const range = target.querySelector("#fadeDuration") as HTMLInputElement;

    expect(checkbox.checked).toBe(true);
    expect(range.disabled).toBe(false);

    checkbox.click();
    await tick();

    expect(appState.fadeEnabled).toBe(false);
    expect(range.disabled).toBe(true);
  });

  test("updates Fade duration via range input", async () => {
    component = mount(Settings, { target });

    const range = target.querySelector("#fadeDuration") as HTMLInputElement;
    range.value = "0.5";
    // It binds using `bind:value` which usually reacts to 'input' event
    range.dispatchEvent(new Event("input"));
    await tick();

    expect(appState.fadeDuration).toBe(0.5);
  });
});
