<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { SvelteSet } from "svelte/reactivity";
  import type { Row, ServerMessage } from "$client/lib/types";
  import { BULLET_STATUS, updateRowRecursive, type BulletSymbol } from "$client/lib/types";
  import { pageStore, MAX_ROWS } from "$client/lib/stores/page.svelte";
  import { undoStore } from "$client/lib/stores/undo.svelte";
  import { connectionStore } from "$client/lib/stores/connection.svelte";
  import { wsClient } from "$client/lib/ws";
  import { getCurrentPageDate, addDays } from "$client/lib/date";
  import {
    classifyGesture,
    isTwoFingerTouch,
    getTwoFingerMidpoint,
    type TouchState,
  } from "$client/lib/gestures";
  import TopBar from "../components/TopBar.svelte";
  import RowComponent from "../components/Row.svelte";
  import WritingCanvas from "../components/WritingCanvas.svelte";
  import BulletArea from "../components/BulletArea.svelte";
  import PostOcrText from "../components/PostOcrText.svelte";
  import NavigationLabels from "../components/NavigationLabels.svelte";
  import OfflineBanner from "../components/OfflineBanner.svelte";
  import Calendar from "../components/Calendar.svelte";
  import OcrScanEffect from "../components/OcrScanEffect.svelte";

  let currentDate = $state(getCurrentPageDate());
  let showCalendar = $state(false);
  let ocrWaitingRows = new SvelteSet<number>();
  let noteDates = $state<string[]>([]);
  let navDirection = $state<"prev" | "next" | null>(null);
  let notebookEl = $state<HTMLDivElement | null>(null);

  // Two-finger gesture state
  let touchState = $state<TouchState | null>(null);

  const page = $derived(pageStore.page);
  const loading = $derived(pageStore.loading);
  const connected = $derived(connectionStore.connected);

  function send(msg: unknown) {
    wsClient.send(msg as Record<string, unknown>);
  }

  function loadPage(date: string) {
    currentDate = date;
    undoStore.reset();
    pageStore.loadPage(date, send);
  }

  function navigatePrev() {
    loadPage(addDays(currentDate, -1));
  }

  function navigateNext() {
    const today = getCurrentPageDate();
    if (currentDate < today) {
      loadPage(addDays(currentDate, 1));
    }
  }

  function handleDateTap() {
    if (!showCalendar) {
      wsClient.send({ type: "list-pages" });
    }
    showCalendar = !showCalendar;
  }

  function handleCalendarSelect(date: string) {
    showCalendar = false;
    loadPage(date);
  }

  function handleBulletClick(row: Row) {
    if (!page) return;
    undoStore.pushUndo(page);

    const bullets: BulletSymbol[] = ["·", "×", "-", ">", "o"];
    const idx = bullets.indexOf(row.bullet);
    const nextBullet = bullets[(idx + 1) % bullets.length];

    const updatedRows = updateRowRecursive(page.rows, row.id, (r) => ({
      ...r,
      bullet: nextBullet,
      status: BULLET_STATUS[nextBullet],
    }));
    pageStore.updatePage(currentDate, { ...page, rows: updatedRows }, send);
  }

  function addRow() {
    if (!page) return;
    undoStore.pushUndo(page);
    pageStore.createRow(currentDate, "·", 0, send);
  }

  function handleStrokeComplete(rowId: number, svg: string) {
    if (!page) return;
    undoStore.pushUndo(page);
    pageStore.editRow(currentDate, rowId, "add", svg, send);
    ocrWaitingRows.add(rowId);
  }

  function handleUndo() {
    undoStore.undo(send);
  }

  function handleRedo() {
    undoStore.redo(send);
  }

  function handleServerMessage(msg: ServerMessage) {
    pageStore.handleMessage(msg);

    if (msg.type === "page-list") {
      noteDates = msg.dates;
    } else if (msg.type === "ocr-result") {
      ocrWaitingRows.delete(msg.rowId);
      wsClient.acknowledge(msg.id);
    } else if (msg.type === "row-created") {
      wsClient.acknowledge(msg.id);
    } else if (msg.type === "page-updated") {
      wsClient.acknowledge(msg.id);
    }
  }

  // Two-finger gesture handlers
  function handleTouchStart(e: TouchEvent) {
    if (isTwoFingerTouch(e)) {
      const mid = getTwoFingerMidpoint(e);
      touchState = {
        startX: mid.x,
        startY: mid.y,
        startTime: Date.now(),
      };
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (!touchState) return;
    if (e.touches.length >= 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const midX = (t1.clientX + t2.clientX) / 2;
      const dx = midX - touchState.startX;
      if (dx < -30) {
        navDirection = "next";
      } else if (dx > 30) {
        navDirection = "prev";
      } else {
        navDirection = null;
      }
    }
  }

  function handleTouchEnd(e: TouchEvent) {
    if (touchState && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0];
      const result = classifyGesture(touchState, touch.clientX, touch.clientY);

      switch (result) {
        case "nav-prev":
          navigatePrev();
          break;
        case "nav-next":
          navigateNext();
          break;
      }
      navDirection = null;
      touchState = null;
    }
  }

  let unsubscribe: (() => void) | null = null;

  onMount(() => {
    unsubscribe = wsClient.subscribe(handleServerMessage);
    connectionStore.init();
    loadPage(currentDate);
  });

  onDestroy(() => {
    unsubscribe?.();
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="page-view"
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
>
  <TopBar
    date={currentDate}
    canUndo={undoStore.canUndo}
    canRedo={undoStore.canRedo}
    onDateTap={handleDateTap}
    onUndo={handleUndo}
    onRedo={handleRedo}
  />

  <OfflineBanner {connected} />

  {#if showCalendar}
    <Calendar
      currentDate={currentDate}
      {noteDates}
      onSelectDate={handleCalendarSelect}
      onClose={() => (showCalendar = false)}
    />
  {/if}

  <div class="notebook" bind:this={notebookEl}>
    {#if loading}
      <div class="loading">読み込み中...</div>
    {:else if page}
      {#each page.rows as row (row.id)}
        <div class="row-container">
          <BulletArea
            bullet={row.bullet}
            onclassified={() => handleBulletClick(row)}
          />

          <div class="row-content">
            <RowComponent {row} />

            {#if row.ocr_text}
              <PostOcrText {row} />
            {/if}

            <WritingCanvas
              onStrokeComplete={(svg) => handleStrokeComplete(row.id, svg)}
            />

            {#if ocrWaitingRows.has(row.id)}
              <OcrScanEffect
                active={true}
                boundingBox={{ left: 0, top: 0, width: 300, height: 32 }}
              />
            {/if}
          </div>
        </div>
      {/each}

      {#if page.rows.length < MAX_ROWS}
        <button class="add-row" onclick={addRow}>+ 行を追加</button>
      {:else}
        <div class="row-limit-label">上限 {MAX_ROWS} 行に達しました</div>
      {/if}
    {:else}
      <div class="empty-state">ページが見つかりません</div>
    {/if}
  </div>

  <NavigationLabels direction={navDirection} />
</div>

<style>
  .page-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    position: relative;
    overflow: hidden;
  }

  .notebook {
    flex: 1;
    position: relative;
    overflow-y: auto;
    background-color: var(--color-bg);
    background-image: linear-gradient(var(--color-line) 1px, transparent 1px);
    background-size: 100% 2rem;
    padding-left: 3rem;
  }

  .notebook::before {
    content: "";
    position: absolute;
    top: 0;
    left: 2.5rem;
    width: 2px;
    height: 100%;
    background: var(--color-margin);
    z-index: 1;
  }

  .row-container {
    position: relative;
    display: flex;
    align-items: stretch;
    min-height: 2rem;
  }

  .row-content {
    flex: 1;
    position: relative;
    min-width: 0;
  }

  .add-row {
    display: block;
    width: 100%;
    padding: 0.5rem;
    background: none;
    border: none;
    border-top: 1px dashed var(--color-line);
    color: var(--color-accent);
    cursor: pointer;
    font-size: 0.875rem;
    text-align: left;
  }

  .row-limit-label {
    text-align: center;
    color: #999;
    font-size: 0.75rem;
    padding: 0.5rem;
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #999;
    font-size: 0.875rem;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #999;
    font-size: 0.875rem;
  }
</style>
