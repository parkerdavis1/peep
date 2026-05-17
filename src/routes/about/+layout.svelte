<script lang="ts">
  let { children } = $props();
  import { ArrowLeft } from "@lucide/svelte";
</script>

<svelte:head>
  <title>about peep</title>
</svelte:head>

<main class="about-main flow">
  <a href="/" class="back-link">
    <ArrowLeft size={16} />
    Back to peep
  </a>
  {@render children()}
</main>

<style>
  .back-link {
    display: flex;
    align-items: center;
    gap: 0.25em;
  }
</style>
