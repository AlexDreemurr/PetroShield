import React, { useId } from "react";
import styled from "styled-components";

function buildSmoothPath(points) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const clampY = (value) => Math.min(maxY, Math.max(minY, value));

  return points.slice(0, -1).reduce((path, point, index) => {
    const previous = points[index - 1] ?? point;
    const next = points[index + 1];
    const following = points[index + 2] ?? next;
    const control1X = point.x + (next.x - previous.x) / 6;
    const control1Y = clampY(point.y + (next.y - previous.y) / 6);
    const control2X = next.x - (following.x - point.x) / 6;
    const control2Y = clampY(next.y - (following.y - point.y) / 6);
    return `${path} C ${control1X} ${control1Y} ${control2X} ${control2Y} ${next.x} ${next.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
}

function MiniAreaSparkline({ values, color, className }) {
  const gradientId = `spark-${useId().replaceAll(":", "")}`;
  const width = 180;
  const height = 34;
  const padding = 3;
  const normalizedValues = (values?.length ? values : [0]).map((value) =>
    Number.isFinite(Number(value)) ? Number(value) : 0
  );
  const maxValue = Math.max(...normalizedValues);
  const minValue = Math.min(...normalizedValues);
  const range = Math.max(maxValue - minValue, 1);
  const points = normalizedValues.map((value, index) => ({
    x: padding + (index / Math.max(normalizedValues.length - 1, 1)) * (width - padding * 2),
    y: padding + ((maxValue - value) / range) * (height - padding * 2 - 3),
  }));
  const linePath = buildSmoothPath(points);
  const areaPath = `${linePath} L ${points.at(-1).x} ${height - 1} L ${points[0].x} ${height - 1} Z`;

  return (
    <SparkSvg className={className} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path d={linePath} fill="none" stroke={color} />
    </SparkSvg>
  );
}

const SparkSvg = styled.svg`
  display: block;
  width: 100%;
  height: 34px;
  overflow: visible;

  path:last-child {
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }
`;

export default MiniAreaSparkline;
