<script lang="ts">
  interface Props {
    direction: "prev" | "next" | null;
  }

  let { direction }: Props = $props();

  const navLabel = $derived(
    direction === "prev" ? "← 前日" :
    direction === "next" ? "翌日 →" :
    null
  );
</script>

{#if navLabel}
  <div class="nav-overlay">
    <span class="nav-label">{navLabel}</span>
  </div>
{/if}

<style>
  .nav-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.2);
    z-index: 100;
    pointer-events: none;
  }

  .nav-label {
    font-size: 2rem;
    font-weight: bold;
    color: white;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  }
</style>
