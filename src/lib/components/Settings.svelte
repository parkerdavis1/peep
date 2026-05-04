<script lang="ts">
  import { appState } from '$lib/state.svelte.ts';

  function handleHpFreqInput() {
    if (appState.filterNode) {
      appState.filterNode.frequency.value = appState.hpFreq;
    }
  }
</script>

<div class="settings">
  <div class="setting-row">
    <span class="setting-label">High-pass filter</span>
    <div class="setting-control">
      <input type="range" id="hpFreq" min="50" max="500" step="10"
             bind:value={appState.hpFreq}
             oninput={handleHpFreqInput} />
      <span class="setting-value">{appState.hpFreq} Hz</span>
      <input type="checkbox" id="hpEnabled" bind:checked={appState.hpEnabled} />
    </div>
  </div>
  <div class="setting-row">
    <span class="setting-label">Normalize to &minus;3 dB</span>
    <div class="setting-control">
      <input type="checkbox" id="normalizeEnabled" bind:checked={appState.normalizeEnabled} />
    </div>
  </div>
  <div class="setting-row">
    <span class="setting-label">Fade in / out</span>
    <div class="setting-control">
      <input type="range" id="fadeDuration" min="0.5" max="5" step="0.5"
             bind:value={appState.fadeDuration}
             disabled={!appState.fadeEnabled} />
      <span class="setting-value">{appState.fadeDuration.toFixed(1)} s</span>
      <input type="checkbox" id="fadeEnabled" bind:checked={appState.fadeEnabled} />
    </div>
  </div>
</div>
