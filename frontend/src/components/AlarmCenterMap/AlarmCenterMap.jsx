import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { loadBaiduMap } from "../BaiduSatelliteMap/baiduMapLoader";
import MapFullscreenButton from "../BaiduSatelliteMap/MapFullscreenButton";
import { getAreaLocalCenter } from "../BaiduSatelliteMap/mapGeometry";

const MAP_CENTER = { lng: 121.671271, lat: 29.978283 };
const LOCAL_ORIGIN = { x: 300, y: 220 };
const LOCAL_SCALE = { lng: 0.0000046, lat: 0.0000038 };

function localToMap(point) {
  return {
    lng: MAP_CENTER.lng + (Number(point?.x ?? 300) - LOCAL_ORIGIN.x) * LOCAL_SCALE.lng,
    lat: MAP_CENTER.lat - (Number(point?.y ?? 220) - LOCAL_ORIGIN.y) * LOCAL_SCALE.lat,
  };
}

function addTextMarker(BMap, map, point, text, tone, title) {
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

function AlarmCenterMap({ detail, isDataLoading, hasDataError, mapType }) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const bmapRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const [revision, setRevision] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

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

    const area = detail.area;
    if (area) {
      let overlay;
      if (area.shape === "circle" && area.center && area.radius) {
        const center = localToMap(area.center);
        overlay = new BMap.Circle(new BMap.Point(center.lng, center.lat), area.radius, {
          strokeColor: "#ef4444", strokeWeight: 3, strokeOpacity: 1,
          fillColor: "#ef4444", fillOpacity: 0.28,
        });
      } else {
        const points = (area.polygon ?? []).map((point) => {
          const coordinate = localToMap(point);
          return new BMap.Point(coordinate.lng, coordinate.lat);
        });
        if (points.length >= 3) {
          overlay = new BMap.Polygon(points, {
            strokeColor: "#ef4444", strokeWeight: 3, strokeOpacity: 1,
            fillColor: "#ef4444", fillOpacity: 0.28,
          });
        }
      }
      if (overlay) map.addOverlay(overlay);
      const center = localToMap(getAreaLocalCenter(area));
      const areaLabel = new BMap.Label(area.name, {
        position: new BMap.Point(center.lng, center.lat),
        offset: new BMap.Size(-52, -52),
      });
      areaLabel.setStyle({
        border: "0", color: "#fff", background: "transparent", fontSize: "12px",
        fontWeight: "800", textShadow: "0 1px 3px #111827", whiteSpace: "nowrap",
      });
      map.addOverlay(areaLabel);
    }

    (detail.resources ?? []).forEach((resource) => {
      if (resource.location?.x == null || resource.location?.y == null) return;
      const isCamera = resource.type?.includes("摄像");
      addTextMarker(BMap, map, resource.location, isCamera ? "摄" : "设", "#1677ff", resource.name);
    });
    if (detail.subject?.kind === "person" && detail.position?.x != null) {
      addTextMarker(BMap, map, detail.position, "人", "#10b981", detail.subject.name);
    }
    addTextMarker(BMap, map, detail.location, "!", "#ef4444", detail.type);
    const alarmPoint = localToMap(detail.location);
    map.panTo(new BMap.Point(alarmPoint.lng, alarmPoint.lat));
  }, [detail, revision]);

  const overlayStatus = hasDataError || status === "error"
    ? "地图信息加载失败"
    : isDataLoading || status === "loading"
      ? "地图信息加载中"
      : null;

  return (
    <MapFrame data-map-fullscreen={isFullscreen}>
      <MapCanvas ref={mapNodeRef} aria-label="告警定位地图" />
      <MapFullscreenButton isFullscreen={isFullscreen} onChange={setIsFullscreen} />
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
const MapStatus = styled.div`
  position: absolute; inset: 0; z-index: 20; display: grid; place-items: center;
  color: #fff; background: rgba(15, 23, 42, 0.66); font-size: 13px; font-weight: 700;
  pointer-events: auto; cursor: wait;
`;

export default AlarmCenterMap;
