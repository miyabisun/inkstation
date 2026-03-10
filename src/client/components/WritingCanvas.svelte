<script lang="ts">
  import { onDestroy } from "svelte";
  import type { StrokePoint } from "$client/lib/types";
  import { isPenInput, toStrokePoint } from "$client/lib/stroke";
  import { generateSvg } from "$client/lib/svg";

  interface Props {
    width?: number;
    height?: number;
    onStrokeComplete?: (svgContent: string) => void;
  }

  let {
    width = 300,
    height = 32,
    onStrokeComplete,
  }: Props = $props();

  let canvas: HTMLDivElement;
  let currentPoints = $state<StrokePoint[]>([]);
  let strokes = $state<StrokePoint[][]>([]);
  let timeout: ReturnType<typeof setTimeout> | null = null;

  onDestroy(() => {
    if (timeout) clearTimeout(timeout);
  });

  function handlePointerDown(e: PointerEvent) {
    if (!isPenInput(e)) return;
    e.preventDefault();
    currentPoints = [toStrokePoint(e)];
    canvas.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isPenInput(e) || currentPoints.length === 0) return;
    e.preventDefault();
    currentPoints = [...currentPoints, toStrokePoint(e)];
  }

  function handlePointerUp(e: PointerEvent) {
    if (!isPenInput(e) || currentPoints.length === 0) return;
    strokes = [...strokes, [...currentPoints]];
    currentPoints = [];
    resetTimeout();
  }

  function resetTimeout() {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(finalize, 2000);
  }

  function finalize() {
    if (strokes.length === 0) return;

    const svgStrokes = strokes.map((points) => ({ points }));
    const svgContent = generateSvg(svgStrokes, width, height);

    onStrokeComplete?.(svgContent);
    strokes = [];
  }
</script>

<div
  class="writing-canvas"
  bind:this={canvas}
  role="application"
  aria-label="手書き入力エリア"
  style:width="{width}px"
  style:height="{height}px"
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
>
  {#if strokes.length > 0 || currentPoints.length > 0}
    <svg {width} {height} viewBox="0 0 {width} {height}">
      {#each strokes as stroke}
        {#if stroke.length > 1}
          <path
            d={"M " +
              stroke
                .map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
                .join(" L ")}
            stroke="#1a1a1a"
            stroke-width="2"
            fill="none"
            stroke-linecap="round"
          />
        {/if}
      {/each}
      {#if currentPoints.length > 1}
        <path
          d={"M " +
            currentPoints
              .map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
              .join(" L ")}
          stroke="#1a1a1a"
          stroke-width="2"
          fill="none"
          stroke-linecap="round"
        />
      {/if}
    </svg>
  {/if}
</div>

<style>
  .writing-canvas {
    position: absolute;
    top: 0;
    left: 0;
    touch-action: none;
    cursor: crosshair;
  }

  svg {
    display: block;
  }
</style>
