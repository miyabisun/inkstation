<script lang="ts">
  interface Props {
    connected: boolean;
  }

  let { connected }: Props = $props();
</script>

{#if !connected}
  <div class="offline-banner">
    オフライン — 変更はローカルに保存されます
  </div>
{/if}

<style>
  .offline-banner {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.375rem 1rem;
    background: var(--color-offline, #d32f2f);
    color: white;
    font-size: 0.75rem;
    font-family: var(--font-mono);
    z-index: 20;
  }
</style>
