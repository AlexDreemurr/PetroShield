import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { API_BASE_URL } from "../../config/api";
import { loadBaiduMap } from "./baiduMapLoader";

const MAP_CENTER = { lng: 121.671271, lat: 29.978283 };
const LOCAL_ORIGIN = { x: 300, y: 220 };
const LOCAL_SCALE = { lng: 0.0000046, lat: 0.0000038 };
const AREA_COLORS = {
  danger: { stroke: "#ef4444", fill: "#f87171" },
  restricted: { stroke: "#f59e0b", fill: "#fbbf24" },
  prohibited: { stroke: "#991b1b", fill: "#dc2626" },
  normal: { stroke: "#16a34a", fill: "#4ade80" },
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
  if (area.center) return localToMap(area.center);
  const polygon = Array.isArray(area.polygon) ? area.polygon : [];
  if (polygon.length === 0) return MAP_CENTER;
  return localToMap({
    x: polygon.reduce((sum, point) => sum + Number(point.x), 0) / polygon.length,
    y: polygon.reduce((sum, point) => sum + Number(point.y), 0) / polygon.length,
  });
}

function createMarkerIcon(BMap, kind, status) {
  const isPerson = kind === "person";
  const color = isPerson
    ? status === "离线" ? "#94a3b8" : "#1677ff"
    : status === "离线" ? "#94a3b8" : "#10b981";
  const shape = isPerson
    ? '<circle cx="16" cy="16" r="11"/><circle cx="16" cy="13" r="3" fill="white"/><path d="M10 23c1.5-3.4 3.8-5 6-5s4.5 1.6 6 5" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"/>'
    : '<rect x="6" y="6" width="20" height="20" rx="4"/><rect x="11" y="10" width="10" height="8" rx="1" fill="white"/><circle cx="16" cy="22" r="1.7" fill="white"/>';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g fill="${color}" stroke="white" stroke-width="3">${shape}</g></svg>`;
  return new BMap.Icon(
    `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    new BMap.Size(32, 32),
    { imageSize: new BMap.Size(32, 32), anchor: new BMap.Size(16, 16) }
  );
}

function addLabel(BMap, map, text, coordinate, color, offset = new BMap.Size(13, -22)) {
  const label = new BMap.Label(text, {
    position: new BMap.Point(coordinate.lng, coordinate.lat),
    offset,
  });
  label.setStyle({
    padding: "1px 6px",
    border: `1px solid ${color}55`,
    borderRadius: "4px",
    color: "#1f2937",
    background: "rgba(255,255,255,.88)",
    fontSize: "10px",
    fontWeight: "600",
    whiteSpace: "nowrap",
  });
  map.addOverlay(label);
}

function BaiduSatelliteMap({ layers }) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const bmapRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const [mapData, setMapData] = useState({ people: [], devices: [], areas: [] });

  useEffect(() => {
    let isMounted = true;
    Promise.allSettled([
      fetch(`${API_BASE_URL}/people/locations`).then((response) => response.ok ? response.json() : Promise.reject()),
      fetch(`${API_BASE_URL}/devices/overview`).then((response) => response.ok ? response.json() : Promise.reject()),
      fetch(`${API_BASE_URL}/risk-control/overview`).then((response) => response.ok ? response.json() : Promise.reject()),
    ]).then(([peopleResult, deviceResult, areaResult]) => {
      if (!isMounted) return;
      setMapData({
        people: peopleResult.status === "fulfilled" ? peopleResult.value.items ?? [] : [],
        devices: deviceResult.status === "fulfilled" ? deviceResult.value.items ?? [] : [],
        areas: areaResult.status === "fulfilled" ? areaResult.value.items ?? [] : [],
      });
    });
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    let isMounted = true;
    loadBaiduMap(import.meta.env.VITE_BAIDU_MAP_AK)
      .then((BMap) => {
        if (!isMounted || !mapNodeRef.current) return;
        const map = new BMap.Map(mapNodeRef.current, { enableMapClick: false });
        map.centerAndZoom(new BMap.Point(MAP_CENTER.lng, MAP_CENTER.lat), 18);
        map.setMapType(window.BMAP_SATELLITE_MAP);
        map.enableDragging();
        map.enableScrollWheelZoom(true);
        map.addControl(new BMap.NavigationControl({
          anchor: window.BMAP_ANCHOR_TOP_RIGHT,
          type: window.BMAP_NAVIGATION_CONTROL_ZOOM,
        }));
        map.addControl(new BMap.ScaleControl({ anchor: window.BMAP_ANCHOR_BOTTOM_LEFT }));
        bmapRef.current = BMap;
        mapRef.current = map;
        setStatus("ready");
      })
      .catch(() => isMounted && setStatus("error"));
    return () => { isMounted = false; };
  }, []);

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
            strokeColor: colors.stroke, strokeWeight: 2, strokeOpacity: 0.95,
            fillColor: colors.fill, fillOpacity: 0.22,
          });
        } else {
          const points = (area.polygon ?? []).map((point) => {
            const coordinate = localToMap(point);
            return new BMap.Point(coordinate.lng, coordinate.lat);
          });
          if (points.length < 3) return;
          overlay = new BMap.Polygon(points, {
            strokeColor: colors.stroke, strokeWeight: 2, strokeOpacity: 0.95,
            fillColor: colors.fill, fillOpacity: 0.22,
          });
        }
        map.addOverlay(overlay);
        addLabel(BMap, map, area.name, getAreaCenter(area), colors.stroke, new BMap.Size(-24, -9));
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
  }, [layers, mapData, status]);

  return (
    <MapWrapper>
      <MapCanvas ref={mapNodeRef} aria-label="厂区人员、设备与风险区域百度卫星地图" />
      <MapLegend aria-label="地图图例">
        <span><i data-kind="person" />人员 {mapData.people.length}</span>
        <span><i data-kind="device" />设备 {mapData.devices.length}</span>
        <span><i data-kind="area" />区域 {mapData.areas.length}</span>
      </MapLegend>
      {status === "loading" ? <MapStatus>地图加载中...</MapStatus> : null}
      {status === "error" ? <MapStatus>地图加载失败，请检查 VITE_BAIDU_MAP_AK</MapStatus> : null}
    </MapWrapper>
  );
}

const MapWrapper = styled.div`
  position: relative; flex: 1; min-height: 0; margin-top: 10px; overflow: hidden;
  border: 1px solid hsl(214 34% 84%); border-radius: 6px; background: hsl(216 23% 95%);
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
  position: absolute; inset: 0; display: grid; place-items: center; padding: 16px;
  color: hsl(218 10% 45%); background: hsl(216 23% 95% / 0.82);
  font-size: 0.875rem; text-align: center; pointer-events: none;
`;

export default BaiduSatelliteMap;
