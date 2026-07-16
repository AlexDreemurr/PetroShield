import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { API_BASE_URL } from "../../config/api";
import { loadBaiduMap } from "./baiduMapLoader";
import { getAreaLocalCenter } from "./mapGeometry";
import MapFullscreenButton from "./MapFullscreenButton";

const MAP_CENTER = { lng: 121.671271, lat: 29.978283 };
const LOCAL_ORIGIN = { x: 300, y: 220 };
const LOCAL_SCALE = { lng: 0.0000046, lat: 0.0000038 };
const AREA_COLORS = {
  danger: { stroke: "#dc2626", fill: "#ef4444", label: "#fecaca" },
  restricted: { stroke: "#d97706", fill: "#f59e0b", label: "#fef3c7" },
  prohibited: { stroke: "#7f1d1d", fill: "#b91c1c", label: "#fecaca" },
  normal: { stroke: "#15803d", fill: "#22c55e", label: "#dcfce7" },
};
const ZONE_ANCHORS = [
  { keyword: "A区", lng: MAP_CENTER.lng - 0.0012, lat: MAP_CENTER.lat + 0.00035 },
  { keyword: "B区", lng: MAP_CENTER.lng + 0.0002, lat: MAP_CENTER.lat - 0.00045 },
  { keyword: "C区", lng: MAP_CENTER.lng + 0.001, lat: MAP_CENTER.lat + 0.0003 },
  { keyword: "办公", lng: MAP_CENTER.lng - 0.00025, lat: MAP_CENTER.lat + 0.0009 },
];

function localToMap(point) {
  return {
    lng: MAP_CENTER.lng + (Number(point.x) - LOCAL_ORIGIN.x) * LOCAL_SCALE.lng,
    lat: MAP_CENTER.lat - (Number(point.y) - LOCAL_ORIGIN.y) * LOCAL_SCALE.lat,
  };
}

function parsePosition(value) {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getEntityCoordinate(entity, index, zoneName) {
  const position = parsePosition(entity.latest_position ?? entity.location);
  if (Number.isFinite(Number(position?.x)) && Number.isFinite(Number(position?.y))) {
    return localToMap(position);
  }
  const anchor = ZONE_ANCHORS.find((item) => zoneName?.includes(item.keyword)) ?? MAP_CENTER;
  const ring = Math.floor(index / 8) + 1;
  const angle = ((index % 8) / 8) * Math.PI * 2;
  const radius = 0.00014 * ring;
  return {
    lng: anchor.lng + Math.cos(angle) * radius,
    lat: anchor.lat + Math.sin(angle) * radius,
  };
}

function getAreaCenter(area) {
  return localToMap(getAreaLocalCenter(area));
}

function createMarkerIcon(BMap, kind, status) {
  const isPerson = kind === "person";
  const color = isPerson
    ? status === "离线" ? "#94a3b8" : "#1677ff"
    : status === "离线" ? "#94a3b8" : "#10b981";
  const shape = isPerson
    ? `<circle cx="16" cy="16" r="11" fill="${color}" stroke="white" stroke-width="1.5"/><circle cx="16" cy="13" r="3" fill="white"/><path d="M10 23c1.5-3.4 3.8-5 6-5s4.5 1.6 6 5" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round"/>`
    : `<rect x="6" y="6" width="20" height="20" rx="4" fill="${color}" stroke="white" stroke-width="1.5"/><rect x="11" y="11" width="10" height="10" rx="1.5" fill="none" stroke="white" stroke-width="1.7"/><path d="M13 7.5v3M19 7.5v3M13 21.5v3M19 21.5v3M7.5 13h3M7.5 19h3M21.5 13h3M21.5 19h3" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round"/><circle cx="16" cy="16" r="2" fill="white"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${shape}</svg>`;
  return new BMap.Icon(
    `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    new BMap.Size(32, 32),
    { imageSize: new BMap.Size(32, 32), anchor: new BMap.Size(16, 16) }
  );
}

function addAreaLabel(BMap, map, text, coordinate, color) {
  const label = new BMap.Label(text, {
    position: new BMap.Point(coordinate.lng, coordinate.lat),
    offset: new BMap.Size(0, 0),
  });
  label.setStyle({
    padding: "0",
    border: "0",
    color,
    background: "transparent",
    boxShadow: "none",
    fontSize: "10px",
    fontWeight: "700",
    whiteSpace: "nowrap",
    transform: "translate(-50%, -50%)",
    textShadow: "0 1px 2px rgba(15, 23, 42, 0.95)",
  });
  map.addOverlay(label);
}

function BaiduSatelliteMap({ layers }) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const bmapRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const [dataStatus, setDataStatus] = useState("loading");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapRevision, setMapRevision] = useState(0);
  const [mapData, setMapData] = useState({ people: [], devices: [], areas: [] });

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      fetch(`${API_BASE_URL}/people/locations`).then((response) => response.ok ? response.json() : Promise.reject()),
      fetch(`${API_BASE_URL}/devices/overview`).then((response) => response.ok ? response.json() : Promise.reject()),
      fetch(`${API_BASE_URL}/risk-control/overview`).then((response) => response.ok ? response.json() : Promise.reject()),
    ])
      .then(([peoplePayload, devicePayload, areaPayload]) => {
        if (!isMounted) return;
        setMapData({
          people: peoplePayload.items ?? [],
          devices: devicePayload.items ?? [],
          areas: areaPayload.items ?? [],
        });
        setDataStatus("ready");
      })
      .catch(() => {
        if (isMounted) setDataStatus("error");
      });
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const mapNode = mapNodeRef.current;
    setStatus("loading");
    mapNode?.replaceChildren();
    loadBaiduMap(import.meta.env.VITE_BAIDU_MAP_AK)
      .then((BMap) => {
        if (!isMounted || !mapNode) return;
        const map = new BMap.Map(mapNode, { enableMapClick: false });
        map.centerAndZoom(new BMap.Point(MAP_CENTER.lng, MAP_CENTER.lat), 18);
        map.setMapType(window.BMAP_SATELLITE_MAP);
        map.enableDragging();
        map.disableScrollWheelZoom();
        map.disableDoubleClickZoom();
        map.disableKeyboard();
        map.addControl(new BMap.NavigationControl({
          anchor: window.BMAP_ANCHOR_TOP_RIGHT,
          type: window.BMAP_NAVIGATION_CONTROL_ZOOM,
        }));
        map.addControl(new BMap.ScaleControl({ anchor: window.BMAP_ANCHOR_BOTTOM_LEFT }));
        bmapRef.current = BMap;
        mapRef.current = map;
        setMapRevision((value) => value + 1);
        setStatus("ready");
      })
      .catch(() => isMounted && setStatus("error"));
    return () => {
      isMounted = false;
      mapRef.current = null;
      bmapRef.current = null;
      mapNode?.replaceChildren();
    };
  }, [isFullscreen]);

  useEffect(() => {
    const BMap = bmapRef.current;
    const map = mapRef.current;
    if (!BMap || !map) return;
    map.clearOverlays();

    if (layers.areas) {
      mapData.areas.filter((area) => area.enabled !== false).forEach((area) => {
        const colors = AREA_COLORS[area.type] ?? AREA_COLORS.normal;
        let overlay;
        if (area.shape === "circle" && area.center && area.radius) {
          const center = localToMap(area.center);
          overlay = new BMap.Circle(new BMap.Point(center.lng, center.lat), Number(area.radius), {
            strokeColor: colors.stroke, strokeWeight: 3, strokeOpacity: 1,
            fillColor: colors.fill, fillOpacity: 0.34,
          });
        } else {
          const points = (area.polygon ?? []).map((point) => {
            const coordinate = localToMap(point);
            return new BMap.Point(coordinate.lng, coordinate.lat);
          });
          if (points.length < 3) return;
          overlay = new BMap.Polygon(points, {
            strokeColor: colors.stroke, strokeWeight: 3, strokeOpacity: 1,
            fillColor: colors.fill, fillOpacity: 0.34,
          });
        }
        map.addOverlay(overlay);
        addAreaLabel(BMap, map, area.name, getAreaCenter(area), colors.label);
      });
    }

    if (layers.devices) {
      mapData.devices.forEach((device, index) => {
        const coordinate = getEntityCoordinate(device, index, device.area_name);
        const marker = new BMap.Marker(new BMap.Point(coordinate.lng, coordinate.lat), {
          icon: createMarkerIcon(BMap, "device", device.realtime?.status),
          title: device.name,
        });
        map.addOverlay(marker);
      });
    }

    if (layers.people) {
      mapData.people.forEach((person, index) => {
        const coordinate = getEntityCoordinate(person, index, person.location_zone);
        const marker = new BMap.Marker(new BMap.Point(coordinate.lng, coordinate.lat), {
          icon: createMarkerIcon(BMap, "person", person.status),
          title: person.name,
        });
        map.addOverlay(marker);
      });
    }
  }, [layers, mapData, mapRevision, status]);

  return (
    <MapWrapper data-map-fullscreen={isFullscreen}>
      <MapCanvas ref={mapNodeRef} aria-label="厂区人员、设备与风险区域百度卫星地图" />
      <MapFullscreenButton isFullscreen={isFullscreen} onChange={setIsFullscreen} />
      <MapLegend aria-label="地图图例">
        <span><i data-kind="person" />人员 {mapData.people.length}</span>
        <span><i data-kind="device" />设备 {mapData.devices.length}</span>
        <span><i data-kind="area" />区域 {mapData.areas.length}</span>
      </MapLegend>
      {status === "error" || dataStatus === "error" ? <MapStatus>地图信息加载失败</MapStatus> : null}
      {status !== "error" && dataStatus !== "error" && (status === "loading" || dataStatus === "loading") ? <MapStatus>地图信息加载中</MapStatus> : null}
    </MapWrapper>
  );
}

const MapWrapper = styled.div`
  position: relative; flex: 1; min-height: 0; margin-top: 10px; overflow: hidden;
  border: 1px solid hsl(214 34% 84%); border-radius: 6px; background: hsl(216 23% 95%);
  &[data-map-fullscreen="true"] { position: fixed; inset: 0; z-index: 1200; width: 100vw; height: 100vh; margin: 0; border: 0; border-radius: 0; }
`;
const MapCanvas = styled.div`width: 100%; height: 100%; min-height: 0;`;
const MapLegend = styled.div`
  position: absolute; right: 10px; bottom: 10px; z-index: 2; display: flex; gap: 9px;
  border: 1px solid hsl(220 13% 86%); border-radius: 5px; padding: 5px 8px;
  color: hsl(218 14% 30%); background: hsl(0 0% 100% / .9); font-size: .625rem;
  span { display: inline-flex; align-items: center; gap: 4px; }
  i { width: 8px; height: 8px; border-radius: 50%; background: #1677ff; }
  i[data-kind="device"] { border-radius: 2px; background: #10b981; }
  i[data-kind="area"] { border: 2px solid #ef4444; background: #fca5a5; }
`;
const MapStatus = styled.div`
  position: absolute; inset: 0; z-index: 20; display: grid; place-items: center; padding: 16px;
  color: white; background: hsl(218 28% 12% / 0.66);
  font-size: 0.875rem; font-weight: 700; text-align: center; pointer-events: auto; cursor: wait;
`;

export default BaiduSatelliteMap;
