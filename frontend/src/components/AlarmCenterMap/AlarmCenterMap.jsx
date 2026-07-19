import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { loadBaiduMap } from "../BaiduSatelliteMap/baiduMapLoader";
import MapFullscreenButton from "../BaiduSatelliteMap/MapFullscreenButton";
import { getAreaLocalCenter } from "../BaiduSatelliteMap/mapGeometry";
import { createMapMarkerIcon, MAP_AREA_COLORS } from "../BaiduSatelliteMap/mapMarkerIcons";
import { getCachedJson, loadCachedJson, PAGE_DATA_URLS } from "../../services/pageDataCache";

const MAP_CENTER = { lng: 121.671271, lat: 29.978283 };
const LOCAL_ORIGIN = { x: 300, y: 220 };
const LOCAL_SCALE = { lng: 0.0000046, lat: 0.0000038 };

function localToMap(point) {
  return {
    lng: MAP_CENTER.lng + (Number(point?.x ?? 300) - LOCAL_ORIGIN.x) * LOCAL_SCALE.lng,
    lat: MAP_CENTER.lat - (Number(point?.y ?? 220) - LOCAL_ORIGIN.y) * LOCAL_SCALE.lat,
  };
}

function addAlarmMarker(BMap, map, point, text, tone, title) {
  const coordinate = localToMap(point);
  const label = new BMap.Label(text, {
    position: new BMap.Point(coordinate.lng, coordinate.lat),
    offset: new BMap.Size(-13, -13),
  });
  label.setStyle({
    width: "26px",
    height: "26px",
    border: "2px solid rgba(255,255,255,.85)",
    borderRadius: "50%",
    color: "#fff",
    background: tone,
    boxShadow: "0 3px 9px rgba(15,23,42,.32)",
    fontSize: "12px",
    fontWeight: "800",
    lineHeight: "22px",
    textAlign: "center",
    cursor: "default",
  });
  label.setTitle(title);
  map.addOverlay(label);
}

function addEntityMarker(BMap, map, point, entity) {
  const coordinate = localToMap(point);
  const marker = new BMap.Marker(new BMap.Point(coordinate.lng, coordinate.lat), {
    icon: createMapMarkerIcon(BMap, entity),
    title: entity.title,
  });
  map.addOverlay(marker);
}

function addAreaOverlay(BMap, map, area, isAlarmArea) {
  const areaColors = MAP_AREA_COLORS[area.type] ?? MAP_AREA_COLORS.normal;
  const colors = isAlarmArea
    ? areaColors
    : { stroke: "#64748b", fill: "#94a3b8", label: "#e2e8f0" };
  let overlay;

  if (area.shape === "circle" && area.center && area.radius) {
    const center = localToMap(area.center);
    overlay = new BMap.Circle(
      new BMap.Point(center.lng, center.lat),
      Number(area.radius),
      {
        strokeColor: colors.stroke,
        strokeWeight: isAlarmArea ? 3 : 2,
        strokeOpacity: isAlarmArea ? 1 : 0.82,
        fillColor: colors.fill,
        fillOpacity: isAlarmArea ? 0.34 : 0.14,
      }
    );
  } else {
    const points = (area.polygon ?? []).map((point) => {
      const coordinate = localToMap(point);
      return new BMap.Point(coordinate.lng, coordinate.lat);
    });
    if (points.length >= 3) {
      overlay = new BMap.Polygon(points, {
        strokeColor: colors.stroke,
        strokeWeight: isAlarmArea ? 3 : 2,
        strokeOpacity: isAlarmArea ? 1 : 0.82,
        fillColor: colors.fill,
        fillOpacity: isAlarmArea ? 0.34 : 0.14,
      });
    }
  }

  if (!overlay) return;
  map.addOverlay(overlay);

  const center = localToMap(getAreaLocalCenter(area));
  const areaLabel = new BMap.Label(area.name, {
    position: new BMap.Point(center.lng, center.lat),
    offset: new BMap.Size(0, isAlarmArea ? -18 : -10),
  });
  areaLabel.setStyle({
    padding: "0",
    border: "0",
    color: colors.label,
    background: "transparent",
    boxShadow: "none",
    fontSize: isAlarmArea ? "12px" : "10px",
    fontWeight: isAlarmArea ? "800" : "700",
    lineHeight: "1",
    textShadow: "0 1px 3px #111827",
    whiteSpace: "nowrap",
    transform: "translateX(-50%)",
  });
  map.addOverlay(areaLabel);
}

function AlarmCenterMap({ detail, isDataLoading, hasDataError, mapType }) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const bmapRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const [revision, setRevision] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const initialAreaPayload = getCachedJson(PAGE_DATA_URLS.areas);
  const [riskAreas, setRiskAreas] = useState(initialAreaPayload?.items ?? []);
  const [areaStatus, setAreaStatus] = useState(initialAreaPayload ? "ready" : "loading");
  const [showOtherAreas, setShowOtherAreas] = useState(true);

  useEffect(() => {
    let mounted = true;
    const cachedPayload = getCachedJson(PAGE_DATA_URLS.areas);
    setAreaStatus(cachedPayload ? "ready" : "loading");
    loadCachedJson(PAGE_DATA_URLS.areas, { force: Boolean(cachedPayload) })
      .then((payload) => {
        if (!mounted) return;
        setRiskAreas(payload.items ?? []);
        setAreaStatus("ready");
      })
      .catch(() => {
        if (!mounted) return;
        setRiskAreas([]);
        if (!cachedPayload) setAreaStatus("error");
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const node = mapNodeRef.current;
    setStatus("loading");
    node?.replaceChildren();
    loadBaiduMap(import.meta.env.VITE_BAIDU_MAP_AK)
      .then((BMap) => {
        if (!mounted || !node) return;
        const map = new BMap.Map(node, { enableMapClick: false });
        map.centerAndZoom(new BMap.Point(MAP_CENTER.lng, MAP_CENTER.lat), 18);
        map.setMapType(window.BMAP_NORMAL_MAP);
        map.enableDragging();
        map.disableScrollWheelZoom();
        map.disableDoubleClickZoom();
        map.disableKeyboard();
        map.addControl(new BMap.NavigationControl({
          anchor: window.BMAP_ANCHOR_TOP_RIGHT,
          type: window.BMAP_NAVIGATION_CONTROL_ZOOM,
        }));
        bmapRef.current = BMap;
        mapRef.current = map;
        setRevision((value) => value + 1);
        setStatus("ready");
      })
      .catch(() => mounted && setStatus("error"));
    return () => {
      mounted = false;
      mapRef.current = null;
      bmapRef.current = null;
      node?.replaceChildren();
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setMapType(
      mapType === "satellite" ? window.BMAP_SATELLITE_MAP : window.BMAP_NORMAL_MAP
    );
  }, [mapType, revision]);

  useEffect(() => {
    const BMap = bmapRef.current;
    const map = mapRef.current;
    if (!BMap || !map || !detail) return;
    map.clearOverlays();

    const alarmArea = detail.area;
    if (showOtherAreas) {
      riskAreas
        .filter(
          (area) =>
            area.enabled !== false &&
            area.id !== alarmArea?.id
        )
        .forEach((area) => addAreaOverlay(BMap, map, area, false));
    }
    if (alarmArea) addAreaOverlay(BMap, map, alarmArea, true);

    (detail.resources ?? []).forEach((resource) => {
      if (resource.location?.x == null || resource.location?.y == null) return;
      addEntityMarker(BMap, map, resource.location, {
        kind: "device", type: resource.type, status: resource.status, title: resource.name,
      });
    });
    if (detail.subject?.kind === "person" && detail.position?.x != null) {
      addEntityMarker(BMap, map, detail.position, {
        kind: "person", status: detail.subject.status, title: detail.subject.name,
      });
    } else if (detail.subject?.kind === "device" && detail.location?.x != null) {
      addEntityMarker(BMap, map, detail.location, {
        kind: "device", type: detail.subject.type, status: detail.subject.status, title: detail.subject.name,
      });
    }
    addAlarmMarker(BMap, map, detail.location, "!", "#ef4444", detail.type);
    const alarmPoint = localToMap(detail.location);
    map.panTo(new BMap.Point(alarmPoint.lng, alarmPoint.lat));
  }, [detail, revision, riskAreas, showOtherAreas]);

  const overlayStatus = hasDataError || status === "error" || areaStatus === "error"
    ? "地图信息加载失败"
    : isDataLoading || status === "loading" || areaStatus === "loading"
      ? "地图信息加载中"
      : null;

  return (
    <MapFrame data-map-fullscreen={isFullscreen}>
      <MapCanvas ref={mapNodeRef} aria-label="告警定位地图" />
      <MapFullscreenButton isFullscreen={isFullscreen} onChange={setIsFullscreen} />
      <MapOptions>
        <MapToggle>
          <input
            type="checkbox"
            checked={showOtherAreas}
            onChange={(event) => setShowOtherAreas(event.target.checked)}
          />
          <span>显示其他区域</span>
        </MapToggle>
      </MapOptions>
      {overlayStatus && <MapStatus>{overlayStatus}</MapStatus>}
    </MapFrame>
  );
}

const MapFrame = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: #e9eef5;
  &[data-map-fullscreen="true"] { position: fixed; inset: 0; z-index: 1200; width: 100vw; height: 100vh; }
`;
const MapCanvas = styled.div`width: 100%; height: 100%;`;
const MapOptions = styled.div`
  position: absolute;
  left: 12px;
  top: 52px;
  z-index: 2;
`;
const MapToggle = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 9px;
  border: 1px solid hsl(220 13% 86%);
  border-radius: 6px;
  color: hsl(218 15% 24%);
  background: hsl(0 0% 100% / 0.92);
  box-shadow: 0 8px 18px hsl(220 20% 10% / 0.13);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;

  input {
    width: 14px;
    height: 14px;
    accent-color: #1677ff;
  }
`;
const MapStatus = styled.div`
  position: absolute; inset: 0; z-index: 20; display: grid; place-items: center;
  color: #fff; background: rgba(15, 23, 42, 0.66); font-size: 13px; font-weight: 700;
  pointer-events: auto; cursor: wait;
`;

export default AlarmCenterMap;
