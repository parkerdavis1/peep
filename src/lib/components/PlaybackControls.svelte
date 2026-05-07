<script lang="ts">
  import { appState } from '$lib/state.svelte.ts';
  import { toggle, rewind } from '$lib/playback.ts';
    import { Pause, Play } from '@lucide/svelte';
</script>

<div class="playback-controls">
  <button class="rewind-btn" onclick={rewind}>&#9664;</button>
  <button class="play-btn" onclick={toggle}>
    {#if appState.isPlaying}<Pause />{:else}<Play />{/if}
  </button>
  <div class="time-display">{appState.timeDisplayText}</div>
</div>
