import type { StrokePoint } from "$client/lib/types";
import { pressureToWidth, smoothPoints } from "$client/lib/stroke";

export interface SvgStroke {
  points: StrokePoint[];
  color?: string;
}

export function generateSvgPath(points: StrokePoint[]): string {
  if (points.length === 0) return "";
  const smoothed = smoothPoints(points);

  let d = `M ${smoothed[0].x.toFixed(1)} ${smoothed[0].y.toFixed(1)}`;
  for (let i = 1; i < smoothed.length; i++) {
    d += ` L ${smoothed[i].x.toFixed(1)} ${smoothed[i].y.toFixed(1)}`;
  }
  return d;
}

export function generateSvg(
  strokes: SvgStroke[],
  width: number,
  height: number,
): string {
  const paths = strokes
    .map((stroke) => {
      if (stroke.points.length === 0) return "";
      const d = generateSvgPath(stroke.points);
      const avgPressure =
        stroke.points.reduce((sum, p) => sum + p.pressure, 0) /
        stroke.points.length;
      const sw = pressureToWidth(avgPressure);
      const raw = stroke.color ?? "#1a1a1a";
      const color = /^#[0-9a-fA-F]{3,8}$/.test(raw) ? raw : "#1a1a1a";
      return `<path d="${d}" stroke="${color}" stroke-width="${sw}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .filter(Boolean)
    .join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${paths}
</svg>`;
}

export function generateSvgFilename(
  date: string,
  seq: number,
  rowId: number,
  action: string,
): string {
  return `${date}_${String(seq).padStart(4, "0")}_${rowId}_${action}.svg`;
}
