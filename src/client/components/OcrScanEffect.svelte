<script lang="ts">
  interface Props {
    active: boolean;
    boundingBox: { left: number; top: number; width: number; height: number };
  }

  let { active, boundingBox }: Props = $props();
</script>

{#if active}
  <div
    class="scan-overlay"
    style:left="{boundingBox.left}px"
    style:top="{boundingBox.top}px"
    style:width="{boundingBox.width}px"
    style:height="{boundingBox.height}px"
  >
    <div class="scan-line"></div>
  </div>
{/if}

<style>
  .scan-overlay {
    position: absolute;
    overflow: hidden;
    pointer-events: none;
    z-index: 30;
    border: 1px solid rgba(74, 144, 217, 0.3);
    border-radius: 4px;
    background: rgba(74, 144, 217, 0.05);
  }

  .scan-line {
    position: absolute;
    left: 0;
    width: 100%;
    height: 2px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(74, 144, 217, 0.8) 50%,
      transparent 100%
    );
    box-shadow: 0 0 8px rgba(74, 144, 217, 0.6);
    animation: scan 1.5s ease-in-out infinite;
  }

  @keyframes scan {
    0% { top: 0; }
    100% { top: 100%; }
  }
</style>
