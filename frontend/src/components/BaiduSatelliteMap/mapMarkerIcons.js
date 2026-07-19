function getMarkerColor(kind, status) {
  if (status === "离线") return "#94a3b8";
  if (kind === "alarm") return "#ef4444";
  return kind === "person" ? "#1677ff" : "#10b981";
}

function getDeviceShape(type, color) {
  const normalizedType = String(type ?? "");
  const shell = `<rect x="6" y="6" width="20" height="20" rx="4" fill="${color}" stroke="white" stroke-width="1.5"/>`;

  if (normalizedType.includes("摄像")) {
    return `${shell}<rect x="10" y="12" width="9" height="8" rx="1.5" fill="none" stroke="white" stroke-width="1.8"/><path d="m19 14 4-2v8l-4-2" fill="none" stroke="white" stroke-width="1.8" stroke-linejoin="round"/>`;
  }
  if (normalizedType.includes("气")) {
    return `${shell}<path d="M16 10c3.5 4 5 6.5 5 9a5 5 0 0 1-10 0c0-2 1-4 3-6-.1 2 1 3 2 3 1.5-1.5 1.5-3.5 0-6Z" fill="none" stroke="white" stroke-width="1.7" stroke-linejoin="round"/>`;
  }
  if (normalizedType.includes("温度")) {
    return `${shell}<path d="M14 11a2 2 0 0 1 4 0v7.2a4 4 0 1 1-4 0Z" fill="none" stroke="white" stroke-width="1.7"/><path d="M16 14v7" stroke="white" stroke-width="1.7" stroke-linecap="round"/>`;
  }
  if (normalizedType.includes("门禁")) {
    return `${shell}<path d="M11 22V10h10v12M11 22h12" fill="none" stroke="white" stroke-width="1.7"/><circle cx="18" cy="16" r="1" fill="white"/>`;
  }
  if (normalizedType.includes("仪表") || normalizedType.includes("压力")) {
    return `${shell}<circle cx="16" cy="16" r="6" fill="none" stroke="white" stroke-width="1.7"/><path d="m16 16 3-3M12 20h8" stroke="white" stroke-width="1.7" stroke-linecap="round"/>`;
  }
  return `${shell}<rect x="11" y="11" width="10" height="10" rx="1.5" fill="none" stroke="white" stroke-width="1.7"/><path d="M13 7.5v3M19 7.5v3M13 21.5v3M19 21.5v3M7.5 13h3M7.5 19h3M21.5 13h3M21.5 19h3" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round"/><circle cx="16" cy="16" r="2" fill="white"/>`;
}

export function createMapMarkerIcon(BMap, { kind, status, type, selected = false }) {
  const color = getMarkerColor(kind, status);
  const selectedRing = selected
    ? '<circle cx="16" cy="16" r="14.5" fill="none" stroke="#facc15" stroke-width="3"/>'
    : "";
  const shape = kind === "alarm"
    ? `<path d="M16 3.5a10 10 0 0 0-10 10c0 7.2 10 15 10 15s10-7.8 10-15a10 10 0 0 0-10-10Z" fill="${color}" stroke="white" stroke-width="1.5"/><path d="M16 8.5v7" stroke="white" stroke-width="2.4" stroke-linecap="round"/><circle cx="16" cy="20" r="1.5" fill="white"/>`
    : kind === "person"
    ? `<circle cx="16" cy="16" r="11" fill="${color}" stroke="white" stroke-width="1.5"/><circle cx="16" cy="13" r="3" fill="white"/><path d="M10 23c1.5-3.4 3.8-5 6-5s4.5 1.6 6 5" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round"/>`
    : getDeviceShape(type, color);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${selectedRing}${shape}</svg>`;

  return new BMap.Icon(
    `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    new BMap.Size(32, 32),
    { imageSize: new BMap.Size(32, 32), anchor: new BMap.Size(16, 16) }
  );
}

export const MAP_AREA_COLORS = {
  danger: { stroke: "#dc2626", fill: "#ef4444", label: "#fecaca" },
  restricted: { stroke: "#d97706", fill: "#f59e0b", label: "#fef3c7" },
  prohibited: { stroke: "#7f1d1d", fill: "#b91c1c", label: "#fecaca" },
  normal: { stroke: "#15803d", fill: "#22c55e", label: "#dcfce7" },
};
