<script lang="ts">
  import { appState } from "$lib/state.svelte.ts";
</script>

<div class="loading-overlay" class:visible={appState.isLoading}>
  <div class="loading-box">
    <div class="spinner"></div>
    <div>{appState.loadingText}</div>
  </div>
</div>
