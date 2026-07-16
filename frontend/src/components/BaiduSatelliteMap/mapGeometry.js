function averagePoint(points) {
  if (points.length === 0) return { x: 300, y: 220 };
  return {
    x: points.reduce((sum, point) => sum + Number(point.x), 0) / points.length,
    y: points.reduce((sum, point) => sum + Number(point.y), 0) / points.length,
  };
}

export function getAreaLocalCenter(area) {
  if (area.shape === "circle" && area.center) return area.center;

  const points = Array.isArray(area.polygon) ? area.polygon : [];
  if (points.length < 3) return averagePoint(points);

  let twiceArea = 0;
  let weightedX = 0;
  let weightedY = 0;
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    const cross = Number(point.x) * Number(next.y) - Number(next.x) * Number(point.y);
    twiceArea += cross;
    weightedX += (Number(point.x) + Number(next.x)) * cross;
    weightedY += (Number(point.y) + Number(next.y)) * cross;
  });

  if (Math.abs(twiceArea) < 0.000001) return averagePoint(points);
  return {
    x: weightedX / (3 * twiceArea),
    y: weightedY / (3 * twiceArea),
  };
}
