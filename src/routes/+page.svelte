<script lang="ts">
  import { onMount } from 'svelte';
  import { appState } from '$lib/state.svelte.ts';
  import * as Playback from '$lib/playback.ts';
  import * as SpectrogramLib from '$lib/spectrogram.ts';
  import * as Processing from '$lib/processing.ts';
  import SpectrogramComponent from '$lib/components/Spectrogram.svelte';
  import PlaybackControls from '$lib/components/PlaybackControls.svelte';
  import Settings from '$lib/components/Settings.svelte';
  import LoadingOverlay from '$lib/components/LoadingOverlay.svelte';
    import { FileHeadphone } from '@lucide/svelte';
    import Peep from '$lib/components/Peep.svelte';
    import Peep2 from '$lib/components/Peep2.svelte';

  let spectrogramWrapperEl: HTMLElement | undefined = $state();

  const title = 'Peep'

  // Whether a file is loaded and the editor should be shown
  let fileLoaded = $derived(appState.audioBuffer !== null);

  async function handleFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 200 * 1024 * 1024) {
      alert('File is too large (max 200 MB)');
      return;
    }
    appState.ensureAudioCtx();
    Playback.stop();
    appState.fileName = file.name.replace(/\.wav$/i, '');
    appState.fileInfoText = file.name + ' (' + (file.size / 1024 / 1024).toFixed(1) + ' MB)';
    appState.loadingText = 'Decoding audio...';
    appState.isLoading = true;

    try {
      const arrayBuf = await file.arrayBuffer();
      appState.audioBuffer = await appState.audioCtx!.decodeAudioData(arrayBuf);
      appState.trimStart = 0;
      appState.trimEnd = 1;
      appState.markerPos = 0;
      appState.zoomLevel = 1;

      appState.loadingText = 'Computing spectrogram...';
      // Yield to let the browser paint the loading message before blocking compute()
      await new Promise<void>((r) => setTimeout(r, 0));

      SpectrogramLib.compute();
      Playback.updateMarker();
      Playback.updateTimeDisplay();
      appState.isLoading = false;
    } catch (err) {
      appState.isLoading = false;
      alert('Error loading file: ' + (err as Error).message);
      console.error(err);
    }
  }

  function zoomIn(): void {
    if (!appState.audioBuffer) return;
    if (appState.zoomLevel >= appState.MAX_ZOOM) return;
    appState.zoomLevel = Math.min(appState.zoomLevel * 2, appState.MAX_ZOOM);
    applyZoom();
  }

  function zoomOut(): void {
    if (!appState.audioBuffer) return;
    if (appState.zoomLevel <= 1) return;
    appState.zoomLevel = Math.max(appState.zoomLevel / 2, 1);
    applyZoom();
  }

  function applyZoom(): void {
    if (!spectrogramWrapperEl) return;
    const wrapper = spectrogramWrapperEl;
    const wrapperWidth = wrapper.clientWidth;
    const playheadFrac =
      appState.isPlaying && appState.audioCtx
        ? Math.max(
            0,
            Math.min(
              1,
              (appState.playOffset + (appState.audioCtx.currentTime - appState.playStartTime)) /
                buf.duration
            )
          )
        : appState.markerPos;

    // rAF fires after Svelte's microtask flush (which calls render() via $effect),
    // so spectrogramTotalWidth is up-to-date by the time we correct scroll
    requestAnimationFrame(() => {
      const newTotal = wrapperWidth * appState.zoomLevel;
      wrapper.scrollLeft = playheadFrac * newTotal - wrapperWidth / 2;
      SpectrogramLib.updateTimeBar();
    });
  }

  async function handleSave(): Promise<void> {
    if (!appState.audioBuffer) return;
    appState.ensureAudioCtx();
    Playback.stop();
    appState.loadingText = 'Processing audio...';
    appState.isLoading = true;
    await new Promise((r) => setTimeout(r, 50));

    try {
      const rendered = await Processing.process();
      const blob = Processing.encodeWAV(rendered);
      Processing.downloadBlob(blob, appState.fileName + '_edited.wav');
      appState.isLoading = false;
    } catch (err) {
      appState.isLoading = false;
      alert('Processing error: ' + (err as Error).message);
      console.error(err);
    }
  }

  onMount(() => {
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    const handleResize = () => {
      if (!appState.audioBuffer || !spectrogramWrapperEl) return;
      const wrapper = spectrogramWrapperEl;
      const oldWidth = wrapper.clientWidth;
      const oldTotal = oldWidth * appState.zoomLevel;
      const centerFrac = oldTotal ? (wrapper.scrollLeft + oldWidth / 2) / oldTotal : 0.5;

      if (resizeTimer !== null) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        SpectrogramLib.render();
        Playback.updateMarker();
        const newWidth = wrapper.clientWidth;
        const newTotal = newWidth * appState.zoomLevel;
        wrapper.scrollLeft = centerFrac * newTotal - newWidth / 2;
        SpectrogramLib.updateTimeBar();
        resizeTimer = null;
      }, 150);
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        Playback.toggle();
      }
      if (!appState.audioBuffer) return;
      const NUDGE = 0.005;
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        if (appState.isPlaying) return;
        const dir = e.code === 'ArrowRight' ? 1 : -1;
        appState.markerPos = Math.max(0, Math.min(1, appState.markerPos + dir * NUDGE));
        Playback.updateMarker();
        Playback.updateTimeDisplay();
      }
      if (e.code === 'ArrowUp') {
        e.preventDefault();
        zoomIn();
      }
      if (e.code === 'ArrowDown') {
        e.preventDefault();
        zoomOut();
      }
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('keydown', handleKeydown);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('keydown', handleKeydown);
    };
  });
</script>

<svelte:head>
  <title>{title}</title>
</svelte:head>

<!-- Hidden file input, triggered by labels in both splash and editor -->
<input
  type="file"
  id="fileInput"
  accept=".wav,audio/wav"
  onchange={handleFileChange}
  style="display: none"
/>

{#if !fileLoaded}
  <div class="splash">
    <Peep2  />
    <p>A web application to simplify audio editing for upload to eBird</p>
    <label for="fileInput" class="file-button">Open WAV File</label>
  </div>
{/if}

{#if fileLoaded}
  <div class="container">
      <header>
          <Peep2 size={5}/>

        <div class="file-section">
        <label for="fileInput" class="file-button header-button" title="Upload new file"><FileHeadphone /></label>
        </div>
      </header>
        <div class="file-info">{appState.fileInfoText}</div>
    <div class="spectrogram-section">
      <SpectrogramComponent bind:wrapperEl={spectrogramWrapperEl} />
      <div class="playback-controls-container">
        <div class="zoom-controls">
          <button class="zoom-btn" onclick={zoomOut}>&minus;</button>
          <span class="zoom-level">{appState.zoomLevel}x</span>
          <button class="zoom-btn" onclick={zoomIn}>+</button>
        </div>
        <PlaybackControls />
      </div>
      <Settings />
      <div class="save-section">
        <button class="save-btn" onclick={handleSave}>Save</button>
      </div>
    </div>
  </div>
{/if}

<LoadingOverlay />
