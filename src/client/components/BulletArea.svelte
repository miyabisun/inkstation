<script lang="ts">
  import { onDestroy } from "svelte";
  import type { StrokePoint, BulletSymbol } from "$client/lib/types";
  import { isPenInput, toStrokePoint } from "$client/lib/stroke";

  interface Props {
    bullet: BulletSymbol;
    onclassified?: (symbol: BulletSymbol) => void;
  }

  let { bullet, onclassified }: Props = $props();

  let strokeSets = $state<StrokePoint[][]>([]);
  let currentPoints = $state<StrokePoint[]>([]);
  let resetTimer: ReturnType<typeof setTimeout> | null = null;

  onDestroy(() => {
    if (resetTimer) clearTimeout(resetTimer);
  });

  function handlePointerDown(e: PointerEvent) {
    if (!isPenInput(e)) return;
    e.preventDefault();
    e.stopPropagation();
    currentPoints = [toStrokePoint(e)];
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isPenInput(e) || currentPoints.length === 0) return;
    e.preventDefault();
    currentPoints = [...currentPoints, toStrokePoint(e)];
  }

  function handlePointerUp(e: PointerEvent) {
    if (!isPenInput(e) || currentPoints.length === 0) return;
    strokeSets = [...strokeSets, [...currentPoints]];
    currentPoints = [];

    // Simple classification: just notify with current bullet for now
    // Full classifier can be implemented separately
    onclassified?.(bullet);

    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      strokeSets = [];
    }, 1500);
  }
</script>

<div
  class="bullet-area"
  role="button"
  tabindex="0"
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
>
  {bullet}
</div>

<style>
  .bullet-area {
    width: 1.5rem;
    height: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    touch-action: none;
    cursor: pointer;
    user-select: none;
  }
</style>
