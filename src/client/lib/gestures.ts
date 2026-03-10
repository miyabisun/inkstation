export type GestureResult = "scroll" | "nav-prev" | "nav-next" | "none";

const NAV_ANGLE_THRESHOLD = 20;

export interface TouchState {
  startX: number;
  startY: number;
  startTime: number;
}

export function classifyGesture(
  start: TouchState,
  endX: number,
  endY: number,
): GestureResult {
  const dx = endX - start.startX;
  const dy = endY - start.startY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < 30) return "none";

  const angleDeg = Math.abs(Math.atan2(dy, dx) * (180 / Math.PI));

  // Horizontal gesture (within ±20° of horizontal)
  if (angleDeg <= NAV_ANGLE_THRESHOLD || angleDeg >= 180 - NAV_ANGLE_THRESHOLD) {
    return dx > 0 ? "nav-prev" : "nav-next";
  }

  return "scroll";
}

export function isTwoFingerTouch(e: TouchEvent): boolean {
  return e.touches.length === 2;
}

export function getTwoFingerMidpoint(e: TouchEvent): { x: number; y: number } {
  const t1 = e.touches[0];
  const t2 = e.touches[1];
  return {
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  };
}
