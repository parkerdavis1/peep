<script lang="ts">
  import { appState } from "$lib/state.svelte.ts";
  import * as Playback from "$lib/audio/playback.ts";
  import * as SpectrogramLib from "$lib/spectrogram/compute.ts";
  import * as Processing from "$lib/audio/processing.ts";
  import { parseWavFormat } from "$lib/audio/wavFormat.ts";
  import SpectrogramComponent from "$lib/components/Spectrogram.svelte";
  import PlaybackControls from "$lib/components/PlaybackControls.svelte";
  import Settings from "$lib/components/Settings.svelte";
  import LoadingOverlay from "$lib/components/LoadingOverlay.svelte";
  import { FileHeadphone } from "@lucide/svelte";
  import { teardownAudioCtx } from "$lib/audio/playback.ts";
  import PeepBird from "$lib/components/PeepBird.svelte";

  const title = "peep";

  // Whether a file is loaded and the editor should be shown
  let fileLoaded = $derived(appState.audioBuffer !== null);

  function handleVisibilityChange() {
    if (document.visibilityState === "hidden") {
      Playback.stop(true);
      teardownAudioCtx(appState);
    }
  }

  async function handleFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 200 * 1024 * 1024) {
      alert("File is too large (max 200 MB)");
      return;
    }
    Playback.stop();
    appState.fileName = file.name.replace(/\.[^/.]+$/, "");
    appState.fileInfoText = file.name;
    appState.loadingText = "Loading audio...";
    appState.isLoading = true;

    try {
      const arrayBuf = await file.arrayBuffer();
      // If no view transitions available, just do the stuff...
      if (!document.startViewTransition) {
        await loadSpectrogram(arrayBuf);
        return;
      }
      // But if you got view transitions, come on let's GO
      document.startViewTransition(async () => await loadSpectrogram(arrayBuf));
    } catch (err) {
      appState.isLoading = false;
      alert("Error loading file: " + (err as Error).message);
      console.error(err);
    }
  }

  async function loadSpectrogram(arrayBuf: ArrayBuffer) {
    // Detect source bit depth before decodeAudioData discards it.
    // Falls back to 16-bit PCM for non-WAV (MP3, M4A) or unrecognised formats.
    const fmt = parseWavFormat(arrayBuf);
    appState.inputBitDepth  = fmt?.bitDepth   ?? 16;
    appState.inputIsFloat   = fmt?.isFloat    ?? false;
    appState.inputSampleRate = fmt?.sampleRate ?? 44100;

    // Create (or recreate) AudioContext at the file's native sample rate so
    // Safari doesn't resample during decodeAudioData.
    await appState.ensureAudioCtx(appState.inputSampleRate);

    appState.audioBuffer = await appState.audioCtx!.decodeAudioData(arrayBuf);
    appState.trimStart = 0;
    appState.trimEnd = 1;
    appState.markerPos = 0;
    appState.zoomLevel = 1;

    appState.loadingText = "Computing spectrogram...";
    // Yield to let the browser paint the loading message before blocking compute()
    await new Promise<void>((r) => setTimeout(r, 0));

    SpectrogramLib.compute();
    Playback.updateMarker();
    appState.isLoading = false;
  }

  function zoomIn(): void {
    if (!appState.audioBuffer) return;
    if (appState.zoomLevel >= appState.MAX_ZOOM) return;
    appState.zoomLevel = Math.min(appState.zoomLevel * 2, appState.MAX_ZOOM);
  }

  function zoomOut(): void {
    if (!appState.audioBuffer) return;
    if (appState.zoomLevel <= 1) return;
    appState.zoomLevel = Math.max(appState.zoomLevel / 2, 1);
  }

  async function handleSave(): Promise<void> {
    if (!appState.audioBuffer) return;
    appState.ensureAudioCtx();
    Playback.stop();
    appState.loadingText = "Processing audio...";
    appState.isLoading = true;
    await new Promise((r) => setTimeout(r, 50));

    try {
      const rendered = await Processing.process();
      const blob = Processing.encodeWAV(rendered, appState.inputBitDepth, appState.inputIsFloat);
      Processing.downloadBlob(blob, appState.fileName + "_edited.wav");
      appState.isLoading = false;
    } catch (err) {
      appState.isLoading = false;
      alert("Processing error: " + (err as Error).message);
      console.error(err);
    }
  }

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.code === "Space") {
      e.preventDefault();
      Playback.toggle();
    }
    if (!appState.audioBuffer) return;
    const NUDGE = 0.005;
    if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
      if (appState.isPlaying) return;
      const dir = e.code === "ArrowRight" ? 1 : -1;
      appState.markerPos = Math.max(
        0,
        Math.min(1, appState.markerPos + dir * NUDGE),
      );
      Playback.updateMarker();
    }
    if (e.code === "ArrowUp") {
      e.preventDefault();
      zoomIn();
    }
    if (e.code === "ArrowDown") {
      e.preventDefault();
      zoomOut();
    }
  };
</script>

<svelte:head>
  <title>peep</title>
</svelte:head>

<svelte:document
  onkeydown={handleKeydown}
  onvisibilitychange={handleVisibilityChange}
/>

<!-- Hidden file input, triggered by labels in both splash and editor -->
<input
  type="file"
  id="fileInput"
  accept=".wav,.mp3,.m4a,audio/wav,audio/mpeg,audio/mp4,audio/x-m4a"
  onchange={handleFileChange}
  style="display: none"
/>

<div class="page">
  {#if !fileLoaded}
    <div class="splash">
      <div class="title-container">
        <h1 class="font-title">{title}</h1>
        <PeepBird size={90} />
      </div>
      <p class="sub-title">A web app to simplify audio editing for eBird</p>
      <label for="fileInput" class="file-button">Open Audio File</label>
    </div>
  {/if}

  {#if fileLoaded}
    <div class="container">
      <header>
        <div class="title-container">
          <h1 class="font-title">{title}</h1>
          <PeepBird size={46} />
        </div>

        <div class="file-section">
          <label
            for="fileInput"
            class="file-button header-button"
            title="Load new file"><FileHeadphone /></label
          >
        </div>
      </header>
      <div class="spectrogram-section">
        <SpectrogramComponent />
        <div class="below-spectrogram">
          <div class="time-display">{appState.timeDisplayText}</div>

          <div class="file-info">{appState.fileInfoText}</div>
        </div>

        <div class="playback-controls-container">
          <PlaybackControls />
          <div class="zoom-controls">
            <button class="zoom-btn" onclick={zoomOut}>
              <span>&minus;</span>
            </button>
            <span class="zoom-level">{appState.zoomLevel}x</span>
            <button class="zoom-btn" onclick={zoomIn}>
              <span>+</span>
            </button>
          </div>
        </div>
        <Settings />
        <div class="save-section">
          <button class="save-btn" onclick={handleSave}>Export</button>
        </div>
      </div>
    </div>
  {/if}

  <div class="about-link-wrap">
    <a href="/about" class="about-link no-underline">About</a>
  </div>
</div>

<LoadingOverlay />
