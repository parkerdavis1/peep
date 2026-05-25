<script lang="ts">
  import { onNavigate } from "$app/navigation";
  import "../app.css";
  import metadata from "$lib/metadata.json";

  let { children } = $props();

  onNavigate((navigation) => {
    if (!document.startViewTransition) return;

    return new Promise((resolve) => {
      document.startViewTransition(async () => {
        resolve();
        await navigation.complete;
      });
    });
  });
</script>

<svelte:head>
  <meta name="description" content={metadata.description} />
  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content={metadata.url} />
  <meta property="og:locale" content="en_US" />
  <meta property="og:title" content={metadata.title} />
  <meta property="og:description" content={metadata.description} />
  <meta property="og:image" content="/peep-social.png" />
</svelte:head>

{@render children()}
