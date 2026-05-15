<script lang="ts">
  // import "../../about.css";
  let { children } = $props();
</script>

<svelte:head>
  <link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/water.css@2/out/water.css"
  />
</svelte:head>

<main class="about-main">
  {@render children()}
</main>
