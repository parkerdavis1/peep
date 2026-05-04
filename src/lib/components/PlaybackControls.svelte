<script lang="ts">
  import { appState } from '$lib/state.svelte.ts';
  import { toggle, rewind } from '$lib/playback.ts';
</script>

<div class="playback-controls">
  <button class="rewind-btn" onclick={rewind}>&#9664;</button>
  <button class="play-btn" onclick={toggle}>
    {#if appState.isPlaying}&#9646;&#9646;{:else}&#9654;{/if}
  </button>
  <div class="time-display">{appState.timeDisplayText}</div>
</div>
