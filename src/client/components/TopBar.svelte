<script lang="ts">
  interface Props {
    date: string;
    canUndo: boolean;
    canRedo: boolean;
    onUndo?: () => void;
    onRedo?: () => void;
    onDateTap?: () => void;
  }

  let { date, canUndo, canRedo, onUndo, onRedo, onDateTap }: Props = $props();
</script>

<header class="topbar">
  <div class="topbar-left">
    <button class="date" onclick={() => onDateTap?.()}>{date}</button>
  </div>
  <div class="topbar-right">
    <button class="icon-btn" onclick={() => onUndo?.()} disabled={!canUndo} title="元に戻す">↶</button>
    <button class="icon-btn" onclick={() => onRedo?.()} disabled={!canRedo} title="やり直す">↷</button>
  </div>
</header>

<style>
  .topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--color-line);
    background: var(--color-bg);
    z-index: 10;
  }

  .topbar-left {
    display: flex;
    gap: 0.75rem;
    align-items: baseline;
  }

  .date {
    font-weight: bold;
    font-size: 1rem;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text);
    padding: 0;
  }

  .topbar-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .icon-btn {
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0.25rem;
    color: var(--color-text);
  }

  .icon-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }
</style>
