<script lang="ts">
  import type { Row } from "$client/lib/types";

  interface Props {
    row: Row;
    indent?: number;
  }

  let { row, indent = 0 }: Props = $props();

  const indentPx = $derived(indent * 30);
</script>

<div class="row" style:padding-left="{indentPx}px">
  <div class="row-drag-handle">⠿</div>
  <div class="row-bullet">
    {row.bullet}
  </div>
  <div class="row-text" class:empty={!row.ocr_text}>
    {#if row.ocr_text}
      {row.ocr_text}
    {:else}
      <em>手書き入力待ち...</em>
    {/if}
  </div>
</div>

<style>
  .row {
    display: flex;
    align-items: center;
    height: 2rem;
    line-height: 2rem;
    position: relative;
    font-family: var(--font-mono);
    font-size: 0.875rem;
  }

  .row-drag-handle {
    width: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: grab;
    color: #999;
    font-size: 0.75rem;
    flex-shrink: 0;
    user-select: none;
  }

  .row-bullet {
    width: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 1rem;
  }

  .row-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .row-text.empty {
    color: #999;
    font-style: italic;
  }
</style>
