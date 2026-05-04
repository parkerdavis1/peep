<script lang="ts">
  import { appState } from '$lib/state.svelte.ts';
  import { initSpectrogram, render, updateTimeBar } from '$lib/spectrogram.ts';
  import { initPlayback, updateMarker, updateTimeDisplay } from '$lib/playback.ts';

  let { wrapperEl = $bindable<HTMLElement | undefined>(undefined) }: { wrapperEl?: HTMLElement } = $props();

  // Plain let refs — set by bind:this synchronously during mount, before any $effect runs
  let canvasEl: HTMLCanvasElement;
  let innerEl: HTMLElement;
  let freqAxisEl: HTMLElement;
  let timeRulerEl: HTMLElement;
  let handleLeftEl: HTMLElement;
  let handleRightEl: HTMLElement;
  let playbackCursorEl: HTMLElement;

  let markerLeftPx = $derived(appState.markerPos * appState.spectrogramTotalWidth);
  let trimLeftWidth = $derived(appState.trimStart * appState.spectrogramTotalWidth);
  let trimRightWidth = $derived((1 - appState.trimEnd) * appState.spectrogramTotalWidth);
  let handleLeftLeft = $derived(appState.trimStart * appState.spectrogramTotalWidth - 2);
  let handleRightLeft = $derived(appState.trimEnd * appState.spectrogramTotalWidth - 2);

  let dragging: 'left' | 'right' | null = null;

  // Single effect: init (idempotent) + render on data/zoom change.
  // bind:this has already set all refs by the time this first runs.
  $effect(() => {
    if (!canvasEl || !innerEl || !wrapperEl || !timeRulerEl || !freqAxisEl || !playbackCursorEl) return;

    const ctx = canvasEl.getContext('2d')!;
    initSpectrogram({ canvas: canvasEl, canvasCtx: ctx, inner: innerEl, wrapper: wrapperEl, timeRuler: timeRulerEl, freqAxis: freqAxisEl });
    initPlayback(playbackCursorEl, wrapperEl, innerEl);

    const data = appState.spectrogramData;
    void appState.zoomLevel; // track as reactive dep

    if (!data) return;
    render();
    updateTimeBar();
  });

  // Pointer drag handlers
  function handlePointerMove(e: PointerEvent) {
    if (!dragging) return;
    const rect = innerEl.getBoundingClientRect();
    const totalWidth = appState.spectrogramTotalWidth || wrapperEl?.clientWidth || 0;
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / totalWidth));
    const MIN_GAP = 0.005;
    if (dragging === 'left') {
      appState.trimStart = Math.min(frac, appState.trimEnd - MIN_GAP);
    } else {
      appState.trimEnd = Math.max(frac, appState.trimStart + MIN_GAP);
      if (appState.markerPos > appState.trimEnd) {
        appState.markerPos = appState.trimStart;
      }
    }
    updateMarker();
    updateTimeDisplay();
  }

  function handlePointerUp() {
    dragging = null;
  }

  function handlePointerDownLeft(e: PointerEvent) {
    handleLeftEl.setPointerCapture(e.pointerId);
    e.preventDefault();
    dragging = 'left';
  }

  function handlePointerDownRight(e: PointerEvent) {
    handleRightEl.setPointerCapture(e.pointerId);
    e.preventDefault();
    dragging = 'right';
  }

  function handleInnerClick(e: MouseEvent) {
    if (appState.isPlaying) return;
    if (!appState.audioBuffer) return;
    if ((e.target as HTMLElement).classList.contains('trim-handle')) return;
    const totalWidth = appState.spectrogramTotalWidth || wrapperEl?.clientWidth || 0;
    const rect = innerEl.getBoundingClientRect();
    const rawFrac = (e.clientX - rect.left) / totalWidth;
    appState.markerPos = Math.max(appState.trimStart, Math.min(appState.trimEnd, rawFrac));
    updateMarker();
    updateTimeDisplay();
  }

  function handleInnerKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      handleInnerClick(e as unknown as MouseEvent);
    }
  }

  function handleScroll() {
    updateTimeBar();
  }
</script>

<svelte:document onpointermove={handlePointerMove} onpointerup={handlePointerUp} />

<div class="spectrogram-wrapper">
  <div class="freq-axis" bind:this={freqAxisEl}></div>
  <div class="spectrogram-scroll-wrap" bind:this={wrapperEl} onscroll={handleScroll}>
    <div class="time-ruler" bind:this={timeRulerEl}></div>
    <div
      class="spectrogram-inner"
      bind:this={innerEl}
      role="button"
      tabindex="0"
      onclick={handleInnerClick}
      onkeydown={handleInnerKeydown}
    >
      <canvas bind:this={canvasEl}></canvas>
      <div class="trim-overlay-left" style:width="{trimLeftWidth}px"></div>
      <div class="trim-overlay-right" style:width="{trimRightWidth}px"></div>
      <div
        class="trim-handle"
        bind:this={handleLeftEl}
        role="slider"
        tabindex="0"
        aria-label="Trim start"
        aria-valuenow={appState.trimStart}
        aria-valuemin={0}
        aria-valuemax={1}
        style:left="{handleLeftLeft}px"
        onpointerdown={handlePointerDownLeft}
      ></div>
      <div
        class="trim-handle"
        bind:this={handleRightEl}
        role="slider"
        tabindex="0"
        aria-label="Trim end"
        aria-valuenow={appState.trimEnd}
        aria-valuemin={0}
        aria-valuemax={1}
        style:left="{handleRightLeft}px"
        onpointerdown={handlePointerDownRight}
      ></div>
      <div
        class="playback-marker"
        style:left="{markerLeftPx}px"
        style:display={appState.audioBuffer ? 'block' : 'none'}
      ></div>
      <div class="playback-cursor" bind:this={playbackCursorEl} style:display="none"></div>
    </div>
  </div>
</div>
<div class="time-bar">
  <span>{appState.timeStartText}</span>
  <span>{appState.timeEndText}</span>
</div>
