import type { StrokePoint } from "$client/lib/types";

export function pressureToWidth(pressure: number): number {
  if (pressure < 0.2) return 1;
  if (pressure < 0.4) return 2;
  if (pressure < 0.6) return 3;
  if (pressure < 0.8) return 4;
  return 5;
}

export function smoothPoints(points: StrokePoint[]): StrokePoint[] {
  if (points.length < 3) return points;
  const smoothed: StrokePoint[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    smoothed.push({
      x: (points[i - 1].x + points[i].x + points[i + 1].x) / 3,
      y: (points[i - 1].y + points[i].y + points[i + 1].y) / 3,
      pressure: points[i].pressure,
      timestamp: points[i].timestamp,
    });
  }
  smoothed.push(points[points.length - 1]);
  return smoothed;
}

export function isPenInput(event: PointerEvent): boolean {
  return event.pointerType === "pen";
}

export function toStrokePoint(e: PointerEvent): StrokePoint {
  return {
    x: e.offsetX,
    y: e.offsetY,
    pressure: e.pressure,
    timestamp: Date.now(),
  };
}
