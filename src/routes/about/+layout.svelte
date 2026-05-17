<script lang="ts">
  let { children } = $props();
  import { ArrowLeft } from "@lucide/svelte";
  import PeepBird from "$lib/components/PeepBird.svelte";
</script>

<svelte:head>
  <title>About Peep</title>
</svelte:head>

<main class="about-main flow">
  <a href="/" class="back-link">
    <ArrowLeft size={16} />
    Back to peep
  </a>
  <div class="bird">
    <PeepBird size={128} class="peep-logo" />
  </div>
  {@render children()}
</main>

<style>
  .back-link {
    display: flex;
    align-items: center;
    gap: 0.25em;
  }

  .bird {
    float: right;
  }
</style>
