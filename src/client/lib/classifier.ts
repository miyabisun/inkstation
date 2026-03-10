import type { StrokePoint, BulletSymbol } from "$client/lib/types";

function distance(a: StrokePoint, b: StrokePoint): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function strokeLength(points: StrokePoint[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += distance(points[i - 1], points[i]);
  }
  return len;
}

function angle(a: StrokePoint, b: StrokePoint): number {
  return Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);
}

function isAngleHorizontal(points: StrokePoint[]): boolean {
  if (points.length < 2) return false;
  const a = angle(points[0], points[points.length - 1]);
  return Math.abs(a) < 20 || Math.abs(a - 180) < 20 || Math.abs(a + 180) < 20;
}

function isClosedShape(points: StrokePoint[]): boolean {
  if (points.length < 5) return false;
  const start = points[0];
  const end = points[points.length - 1];
  const len = strokeLength(points);
  return distance(start, end) < len * 0.3;
}

function segmentsIntersect(
  p1: StrokePoint,
  p2: StrokePoint,
  p3: StrokePoint,
  p4: StrokePoint,
): boolean {
  const d1 = direction(p3, p4, p1);
  const d2 = direction(p3, p4, p2);
  const d3 = direction(p1, p2, p3);
  const d4 = direction(p1, p2, p4);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  return false;
}

function direction(a: StrokePoint, b: StrokePoint, c: StrokePoint): number {
  return (c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x);
}

function hasRightAngleShape(allPoints: StrokePoint[][]): boolean {
  if (allPoints.length < 2) return false;
  for (let i = 0; i < allPoints.length - 1; i++) {
    const a1 = angle(allPoints[i][0], allPoints[i][allPoints[i].length - 1]);
    const a2 = angle(allPoints[i + 1][0], allPoints[i + 1][allPoints[i + 1].length - 1]);
    const diff = Math.abs(a1 - a2);
    if (diff > 30 && diff < 150) return true;
  }
  return false;
}

export function classifyBullet(strokeSets: StrokePoint[][]): BulletSymbol {
  if (strokeSets.length === 0) return "·";

  let totalLength = 0;
  for (const set of strokeSets) {
    totalLength += strokeLength(set);
  }

  if (totalLength < 10) return "·";

  if (strokeSets.length === 1) {
    const points = strokeSets[0];
    if (isClosedShape(points)) return "o";
    if (isAngleHorizontal(points)) return "-";
    return "·";
  }

  if (strokeSets.length === 2) {
    const s1 = strokeSets[0];
    const s2 = strokeSets[1];

    if (s1.length >= 2 && s2.length >= 2) {
      if (segmentsIntersect(s1[0], s1[s1.length - 1], s2[0], s2[s2.length - 1])) return "×";
    }

    if (hasRightAngleShape(strokeSets)) return ">";
    return "·";
  }

  return "·";
}

export function detectTransition(
  prev: BulletSymbol,
  current: BulletSymbol,
): BulletSymbol | null {
  if (prev === "·" && current === "×") return "×";
  return null;
}
