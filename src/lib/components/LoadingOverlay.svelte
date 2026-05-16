<script lang="ts">
  import { appState } from "$lib/state.svelte.ts";
  import PeepBird from "$lib/components/PeepBird.svelte";
</script>

<div class="loading-overlay" class:visible={appState.isLoading}>
  <div class="loading-box">
    <PeepBird size={48} class="peep-logo" />
    <div>{appState.loadingText}</div>
  </div>
</div>
