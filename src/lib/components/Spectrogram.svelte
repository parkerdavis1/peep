<script lang="ts">
  import { appState } from "$lib/state.svelte.ts";
  import { render, SPEC_H, RULER_H } from "$lib/spectrogram/compute.ts";
  import { updateMarker, stop } from "$lib/audio/playback.ts";

  let {
    wrapperEl = $bindable<HTMLElement | undefined>(undefined),
  }: { wrapperEl?: HTMLElement } = $props();

  let canvasEl: HTMLCanvasElement;
  let innerEl: HTMLElement;
  let handleLeftEl: HTMLElement;
  let handleRightEl: HTMLElement;

  let dragging = $state<"left" | "right" | null>(null);

  // Sync scroll left and width to global state for time bar
  function handleScroll() {
    if (wrapperEl) {
      appState.scrollLeftPx = wrapperEl.scrollLeft;
    }
  }

  // Automatically sync wrapper width on resize
  $effect(() => {
    if (wrapperEl) {
      const resizeObserver = new ResizeObserver((entries) => {
        appState.wrapperWidthPx = entries[0].contentRect.width;
      });
      resizeObserver.observe(wrapperEl);
      return () => resizeObserver.disconnect();
    }
  });

  // Calculate canvas total width reactively
  $effect(() => {
    if (wrapperEl && appState.wrapperWidthPx > 0) {
      appState.spectrogramTotalWidth =
        appState.wrapperWidthPx * appState.zoomLevel;
    }
  });

  // Re-render canvas when data or zoom changes
  $effect(() => {
    if (
      canvasEl &&
      appState.spectrogramData &&
      appState.spectrogramTotalWidth > 0
    ) {
      render(canvasEl, appState.spectrogramTotalWidth);
    }
  });

  // Auto-scroll cursor when playing
  $effect(() => {
    if (appState.isPlaying && wrapperEl) {
      const cursorPx = appState.playheadFrac * appState.spectrogramTotalWidth;
      const wrapperWidth = appState.wrapperWidthPx;
      const scrollLeft = wrapperEl.scrollLeft;
      if (cursorPx < scrollLeft || cursorPx > scrollLeft + wrapperWidth) {
        wrapperEl.scrollLeft = cursorPx - wrapperWidth / 3;
      }
    }
  });

  // Keep scroll position centered when zooming
  let prevZoom = $state(1);
  $effect(() => {
    const currentZoom = appState.zoomLevel;
    if (currentZoom !== prevZoom && wrapperEl && appState.wrapperWidthPx > 0) {
      const wrapperWidth = appState.wrapperWidthPx;
      const oldTotal = wrapperWidth * prevZoom;
      const newTotal = wrapperWidth * currentZoom;

      const centerFrac =
        oldTotal > 0
          ? (wrapperEl.scrollLeft + wrapperWidth / 2) / oldTotal
          : 0.5;

      // Update state for next time
      prevZoom = currentZoom;

      // Schedule scroll update
      requestAnimationFrame(() => {
        if (wrapperEl) {
          wrapperEl.scrollLeft = centerFrac * newTotal - wrapperWidth / 2;
          handleScroll(); // ensure state is synced
        }
      });
    }
  });

  let markerLeftPx = $derived(
    appState.markerPos * appState.spectrogramTotalWidth,
  );
  let playheadLeftPx = $derived(
    appState.playheadFrac * appState.spectrogramTotalWidth,
  );
  let trimLeftWidth = $derived(
    appState.trimStart * appState.spectrogramTotalWidth,
  );
  let trimRightWidth = $derived(
    (1 - appState.trimEnd) * appState.spectrogramTotalWidth,
  );
  let trimEndPx = $derived(appState.trimEnd * appState.spectrogramTotalWidth);
  let handleLeftLeft = $derived(
    appState.trimStart * appState.spectrogramTotalWidth - 2,
  );
  let handleRightLeft = $derived(
    appState.trimEnd * appState.spectrogramTotalWidth - 2,
  );

  let threeSecondWidthPx = $derived(
    appState.audioBuffer && appState.audioBuffer.duration > 0
      ? (3 / appState.audioBuffer.duration) * appState.spectrogramTotalWidth
      : 0,
  );

  // Time Ruler Ticks Calculation
  const TICK_CANDIDATES = [1, 5, 10, 30, 60];
  const LABEL_CANDIDATES = [1, 5, 10, 15, 30, 60, 120];
  const MIN_TICK_PX = 3;
  const MIN_LABEL_PX = 55;

  let timeTicks = $derived.by(() => {
    const buf = appState.audioBuffer;
    if (!buf || appState.spectrogramTotalWidth <= 0) return [];

    const dur = buf.duration;
    const totalWidth = appState.spectrogramTotalWidth;
    const pxPerSec = totalWidth / dur;

    const tickInterval =
      TICK_CANDIDATES.find((c) => c * pxPerSec >= MIN_TICK_PX) ??
      TICK_CANDIDATES[TICK_CANDIDATES.length - 1];

    const labelCandidates = LABEL_CANDIDATES.filter(
      (n) => n % tickInterval === 0,
    );
    const labelInterval =
      labelCandidates.find((c) => c * pxPerSec >= MIN_LABEL_PX) ??
      labelCandidates[labelCandidates.length - 1] ??
      tickInterval;

    const numTicks = Math.floor(dur / tickInterval);
    const ticks = [];

    for (let i = 0; i <= numTicks; i++) {
      const t = i * tickInterval;
      const x = (t / dur) * totalWidth;
      const isLabeled = t % labelInterval === 0;

      let label = "";
      if (isLabeled) {
        const totalSec = Math.round(t);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        label = m + ":" + (s < 10 ? "0" : "") + s;
      }

      ticks.push({ left: Math.round(x), isLabeled, label });
    }
    return ticks;
  });

  // Freq Axis Calculation
  const MAX_FREQ = 10000;
  let freqTicks = $derived.by(() => {
    const buf = appState.audioBuffer;
    if (!buf) return [];

    const maxFreq = Math.min(MAX_FREQ, buf.sampleRate / 2);
    const ticksArr = [
      1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000,
    ];

    return ticksArr
      .filter((freq) => freq <= maxFreq)
      .map((freq) => ({
        top: RULER_H + (1 - freq / maxFreq) * SPEC_H,
        label: freq / 1000 + "k",
      }));
  });

  function handlePointerMove(e: PointerEvent) {
    if (!dragging || !innerEl) return;

    const rect = innerEl.getBoundingClientRect();
    const innerLeft = rect.left;
    const totalWidth =
      appState.spectrogramTotalWidth || appState.wrapperWidthPx || 1;

    const frac = Math.max(0, Math.min(1, (e.clientX - innerLeft) / totalWidth));
    const MIN_GAP = 0.005;

    if (dragging === "left") {
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
    }
    dragging = null;
  }

  function handlePointerDownLeft(e: PointerEvent) {
    if (appState.isPlaying) stop(true);
    if (handleLeftEl && handleLeftEl.setPointerCapture)
      handleLeftEl.setPointerCapture(e.pointerId);
    e.preventDefault();
    dragging = "left";
  }

  function handlePointerDownRight(e: PointerEvent) {
    if (appState.isPlaying) stop(true);
    if (handleRightEl && handleRightEl.setPointerCapture)
      handleRightEl.setPointerCapture(e.pointerId);
    e.preventDefault();
    dragging = "right";
  }

  function handleInnerClick(e: MouseEvent) {
    if (appState.isPlaying) return;
    if (!appState.audioBuffer) return;
    if ((e.target as HTMLElement).classList.contains("trim-handle")) return;

    if (e.clientX === 0 && e.clientY === 0 && e.detail === 0) return;
    if (typeof e.clientX !== "number") return;

    const totalWidth =
      appState.spectrogramTotalWidth || appState.wrapperWidthPx || 1;
    const rect = innerEl.getBoundingClientRect();
    const rawFrac = (e.clientX - rect.left) / totalWidth;

    if (isFinite(rawFrac) && !isNaN(rawFrac)) {
      appState.markerPos = Math.max(
        appState.trimStart,
        Math.min(appState.trimEnd, rawFrac),
      );
      updateMarker();
    }
  }
</script>

<svelte:document
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
/>

<div class="spectrogram-wrapper">
  <div class="freq-axis">
    {#each freqTicks as tick}
      <div class="freq-label" style:top="{tick.top}px">{tick.label}</div>
    {/each}
  </div>

  <div
    class="spectrogram-scroll-wrap"
    bind:this={wrapperEl}
    onscroll={handleScroll}
  >
    <div class="time-ruler" style:width="{appState.spectrogramTotalWidth}px">
      {#each timeTicks as tick}
        <div
          class="time-tick {tick.isLabeled ? 'major' : ''}"
          style:left="{tick.left}px"
        >
          {#if tick.isLabeled}
            <span>{tick.label}</span>
          {/if}
        </div>
      {/each}
    </div>

    <div
      class="spectrogram-inner"
      bind:this={innerEl}
      style:width="{appState.spectrogramTotalWidth}px"
      role="button"
      tabindex="0"
      onclick={handleInnerClick}
      onkeydown={(e) => {
        if (e.key === "Enter") handleInnerClick(e as any);
      }}
    >
      <canvas bind:this={canvasEl}></canvas>

      <div class="trim-overlay-left" style:width="{trimLeftWidth}px"></div>
      <div class="trim-overlay-right" style:width="{trimRightWidth}px"></div>

      {#if dragging === "left" && threeSecondWidthPx > 0}
        <div
          class="buffer-indicator start-buffer"
          style:left="{trimLeftWidth}px"
          style:width="{threeSecondWidthPx}px"
        ></div>
      {/if}

      {#if dragging === "right" && threeSecondWidthPx > 0}
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

      <!-- Static Marker (visible when stopped) -->
      <div
        class="playback-marker"
        style:left="{markerLeftPx}px"
        style:display={appState.audioBuffer && !appState.isPlaying
          ? "block"
          : "none"}
      ></div>

      <!-- Moving Cursor (visible when playing) -->
      <div
        class="playback-cursor"
        style:left="{playheadLeftPx}px"
        style:display={appState.isPlaying ? "block" : "none"}
      ></div>
    </div>
  </div>
</div>
<div class="time-bar">
  <span>{appState.timeStartText}</span>
  <span>{appState.timeEndText}</span>
</div>
