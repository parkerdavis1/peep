<script lang="ts">
  import { appState } from '$lib/state.svelte.ts';
  import { initSpectrogram, render, updateTimeBar } from '$lib/spectrogram.ts';
  import { initPlayback, updateMarker, updateTimeDisplay, stop } from '$lib/playback.ts';

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
  let trimEndPx = $derived(appState.trimEnd * appState.spectrogramTotalWidth);
  let handleLeftLeft = $derived(appState.trimStart * appState.spectrogramTotalWidth - 2);
  let handleRightLeft = $derived(appState.trimEnd * appState.spectrogramTotalWidth - 2);

  let threeSecondWidthPx = $derived(
    appState.audioBuffer && appState.audioBuffer.duration > 0
      ? (3 / appState.audioBuffer.duration) * appState.spectrogramTotalWidth
      : 0
  );

  let dragging = $state<'left' | 'right' | null>(null);

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
    
    // In vitest getBoundingClientRect on elements sometimes returns all 0s, 
    // so we handle it more robustly.
    const rect = innerEl.getBoundingClientRect();
    const innerLeft = rect.left;
    const totalWidth = appState.spectrogramTotalWidth || wrapperEl?.clientWidth || 1;
    
    const frac = Math.max(0, Math.min(1, (e.clientX - innerLeft) / totalWidth));
    const MIN_GAP = 0.005;
    if (dragging === 'left') {
      appState.trimStart = Math.min(frac, appState.trimEnd - MIN_GAP);
    } else {
      appState.trimEnd = Math.max(frac, appState.trimStart + MIN_GAP);
    }
  }

  function handlePointerUp() {
    if (dragging) {
      if (appState.markerPos < appState.trimStart) {
        appState.markerPos = appState.trimStart;
      } else if (appState.markerPos > appState.trimEnd) {
        appState.markerPos = appState.trimEnd;
      }
      updateMarker();
      updateTimeDisplay();
    }
    dragging = null;
  }

  function handlePointerDownLeft(e: PointerEvent) {
    if (appState.isPlaying) stop(true);
    if (handleLeftEl && handleLeftEl.setPointerCapture) handleLeftEl.setPointerCapture(e.pointerId);
    e.preventDefault();
    dragging = 'left';
  }

  function handlePointerDownRight(e: PointerEvent) {
    if (appState.isPlaying) stop(true);
    if (handleRightEl && handleRightEl.setPointerCapture) handleRightEl.setPointerCapture(e.pointerId);
    e.preventDefault();
    dragging = 'right';
  }

  function handleInnerClick(e: MouseEvent) {
    if (appState.isPlaying) return;
    if (!appState.audioBuffer) return;
    if ((e.target as HTMLElement).classList.contains('trim-handle')) return;
    
    // Ignore keyboard-triggered clicks (which have clientX=0, clientY=0 and detail=0)
    // as we handle Space explicitly for playback.
    if (e.clientX === 0 && e.clientY === 0 && e.detail === 0) return;
    if (typeof e.clientX !== 'number') return;
    
    const totalWidth = appState.spectrogramTotalWidth || wrapperEl?.clientWidth || 1;
    const rect = innerEl.getBoundingClientRect();
    const rawFrac = (e.clientX - rect.left) / totalWidth;
    
    if (isFinite(rawFrac) && !isNaN(rawFrac)) {
      appState.markerPos = Math.max(appState.trimStart, Math.min(appState.trimEnd, rawFrac));
      updateMarker();
      updateTimeDisplay();
    }
  }

  function handleInnerKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      // Space is handled globally for Play/Pause.
      // Keyboard events don't have coordinates, so we don't move the marker.
      e.preventDefault();
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
      
      {#if dragging === 'left' && threeSecondWidthPx > 0}
        <div
          class="buffer-indicator start-buffer"
          style:left="{trimLeftWidth}px"
          style:width="{threeSecondWidthPx}px"
        ></div>
      {/if}

      {#if dragging === 'right' && threeSecondWidthPx > 0}
        <div
          class="buffer-indicator end-buffer"
          style:left="{trimEndPx - threeSecondWidthPx}px"
          style:width="{threeSecondWidthPx}px"
        ></div>
      {/if}

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
