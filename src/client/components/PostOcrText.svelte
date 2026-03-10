<script lang="ts">
  import type { StrokePoint, Row } from "$client/lib/types";
  import { isPenInput, toStrokePoint } from "$client/lib/stroke";
  import { isHorizontalStroke, isVerticalStroke } from "$client/lib/text-editing";
  import CalloutBubble from "./CalloutBubble.svelte";

  interface Props {
    row: Row;
    charWidth?: number;
    lineHeight?: number;
    onupdate?: (text: string) => void;
  }

  let { row, charWidth = 10, lineHeight = 20, onupdate }: Props = $props();

  let currentPoints = $state<StrokePoint[]>([]);
  let strikethroughIndices = $state<number[]>([]);
  let insertPos = $state(-1);
  let showBubble = $state(false);

  const strikethroughSet = $derived(new Set(strikethroughIndices));

  function findStrikethroughChars(points: StrokePoint[]): number[] {
    const minX = Math.min(points[0].x, points[points.length - 1].x);
    const maxX = Math.max(points[0].x, points[points.length - 1].x);
    const chars = [...row.ocr_text];
    const indices: number[] = [];
    for (let i = 0; i < chars.length; i++) {
      const cx = i * charWidth + charWidth / 2;
      if (cx >= minX && cx <= maxX) indices.push(i);
    }
    return indices;
  }

  function findInsertPosition(points: StrokePoint[]): number {
    const x = (points[0].x + points[points.length - 1].x) / 2;
    return Math.round(x / charWidth);
  }

  function handlePointerDown(e: PointerEvent) {
    if (!isPenInput(e)) return;
    e.preventDefault();
    currentPoints = [toStrokePoint(e)];
    strikethroughIndices = [];
    insertPos = -1;
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isPenInput(e) || currentPoints.length === 0) return;
    e.preventDefault();
    currentPoints = [...currentPoints, toStrokePoint(e)];

    if (currentPoints.length > 3 && isHorizontalStroke(currentPoints)) {
      strikethroughIndices = findStrikethroughChars(currentPoints);
    }
  }

  function handlePointerUp(e: PointerEvent) {
    if (!isPenInput(e) || currentPoints.length === 0) return;

    if (isHorizontalStroke(currentPoints)) {
      const indices = findStrikethroughChars(currentPoints);
      if (indices.length > 0) {
        const chars = [...row.ocr_text];
        const indexSet = new Set(indices);
        const newText = chars.filter((_, i) => !indexSet.has(i)).join("");
        onupdate?.(newText);
      }
    } else if (isVerticalStroke(currentPoints)) {
      insertPos = findInsertPosition(currentPoints);
      if (insertPos >= 0) {
        showBubble = true;
      }
    }

    currentPoints = [];
    strikethroughIndices = [];
  }

  function handleInsert(text: string) {
    if (insertPos >= 0) {
      const before = row.ocr_text.slice(0, insertPos);
      const after = row.ocr_text.slice(insertPos);
      onupdate?.(before + text + after);
    }
    showBubble = false;
    insertPos = -1;
  }
</script>

<div
  class="post-ocr-text"
  role="textbox"
  tabindex="0"
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
>
  {#each [...row.ocr_text] as char, i}
    <span
      class="char"
      class:strikethrough={strikethroughSet.has(i)}
      style:width="{charWidth}px"
    >
      {char}
    </span>
  {/each}

  {#if insertPos >= 0}
    <div
      class="insert-caret"
      style:left="{insertPos * charWidth}px"
    ></div>
  {/if}

  {#if showBubble}
    <CalloutBubble
      x={insertPos * charWidth}
      y={0}
      onclose={() => { showBubble = false; insertPos = -1; }}
    >
      <div class="insert-area">挿入テキスト入力エリア</div>
    </CalloutBubble>
  {/if}
</div>

<style>
  .post-ocr-text {
    position: relative;
    display: flex;
    align-items: center;
    height: 100%;
    touch-action: none;
  }

  .char {
    display: inline-block;
    text-align: center;
    font-family: var(--font-mono);
  }

  .char.strikethrough {
    background: rgba(232, 112, 112, 0.3);
    text-decoration: line-through;
    text-decoration-color: var(--color-margin);
  }

  .insert-caret {
    position: absolute;
    top: 0;
    width: 2px;
    height: 100%;
    background: var(--color-accent);
    animation: blink 1s step-end infinite;
  }

  @keyframes blink {
    50% { opacity: 0; }
  }

  .insert-area {
    font-size: 0.75rem;
    color: #666;
  }
</style>
