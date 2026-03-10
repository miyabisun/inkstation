<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    x: number;
    y: number;
    onclose?: () => void;
    children?: Snippet;
  }

  let { x, y, onclose, children }: Props = $props();
</script>

<div class="callout" style:left="{x}px" style:top="{y - 40}px">
  <div class="callout-content">
    {#if children}{@render children()}{/if}
  </div>
  <button class="callout-close" onclick={() => onclose?.()}>×</button>
  <div class="callout-arrow"></div>
</div>

<style>
  .callout {
    position: absolute;
    background: white;
    border: 1px solid var(--color-line);
    border-radius: 6px;
    padding: 0.5rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    z-index: 50;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .callout-content {
    min-width: 60px;
    min-height: 32px;
  }

  .callout-close {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    color: #999;
    padding: 0 0.25rem;
  }

  .callout-arrow {
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 6px solid white;
  }
</style>
