<script lang="ts">
  let { children } = $props();
</script>

<svelte:head>
  <title>about peep</title>
</svelte:head>

<main class="about-main flow">
  {@render children()}
</main>
