import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { loadBaiduMap } from "../BaiduSatelliteMap/baiduMapLoader";
import MapFullscreenButton from "../BaiduSatelliteMap/MapFullscreenButton";
import { getAreaLocalCenter } from "../BaiduSatelliteMap/mapGeometry";
import { createMapMarkerIcon, getMapAreaColors } from "../BaiduSatelliteMap/mapMarkerIcons";
import { useRuntimeDictionaries } from "../../services/runtimeDictionaries";

const MAP_CENTER = { lng: 121.671271, lat: 29.978283 };
const LOCAL_ORIGIN = { x: 300, y: 220 };
const LOCAL_SCALE = { lng: 0.0000046, lat: 0.0000038 };

function localToMap(point) {
  return {
    lng: MAP_CENTER.lng + (Number(point.x) - LOCAL_ORIGIN.x) * LOCAL_SCALE.lng,
    lat: MAP_CENTER.lat - (Number(point.y) - LOCAL_ORIGIN.y) * LOCAL_SCALE.lat,
  };
}

function validPoint(point) {
  return Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y));
}

function RiskEventTraceMap({ event, areas, activeIndex }) {
  const dictionaries = useRuntimeDictionaries();
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const bmapRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let mounted = true;
    const mapNode = mapNodeRef.current;
    setStatus("loading");
    mapNode?.replaceChildren();
    loadBaiduMap(import.meta.env.VITE_BAIDU_MAP_AK)
      .then((BMap) => {
        if (!mounted || !mapNode) return;
        const map = new BMap.Map(mapNode, { enableMapClick: false });
        map.centerAndZoom(new BMap.Point(MAP_CENTER.lng, MAP_CENTER.lat), 18);
        map.setMapType(window.BMAP_SATELLITE_MAP);
        map.enableDragging();
        map.disableScrollWheelZoom();
        map.disableDoubleClickZoom();
        map.disableKeyboard();
        map.addControl(new BMap.NavigationControl({ anchor: window.BMAP_ANCHOR_TOP_RIGHT, type: window.BMAP_NAVIGATION_CONTROL_ZOOM }));
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
      mapNode?.replaceChildren();
    };
  }, [isFullscreen]);

  useEffect(() => {
    const BMap = bmapRef.current;
    const map = mapRef.current;
    if (!BMap || !map || status !== "ready") return;
    map.clearOverlays();

    (areas ?? []).forEach((area) => {
      const colors = getMapAreaColors(area.type, dictionaries);
      let overlay;
      if (area.shape === "circle" && validPoint(area.center) && area.radius) {
        const center = localToMap(area.center);
        overlay = new BMap.Circle(new BMap.Point(center.lng, center.lat), Number(area.radius), {
          strokeColor: colors.stroke, strokeWeight: 2, strokeOpacity: 0.9,
          fillColor: colors.fill, fillOpacity: event?.area?.id === area.id ? 0.32 : 0.14,
        });
      } else {
        const points = (area.polygon ?? []).filter(validPoint).map((point) => {
          const mapped = localToMap(point);
          return new BMap.Point(mapped.lng, mapped.lat);
        });
        if (points.length < 3) return;
        overlay = new BMap.Polygon(points, {
          strokeColor: colors.stroke, strokeWeight: 2, strokeOpacity: 0.9,
          fillColor: colors.fill, fillOpacity: event?.area?.id === area.id ? 0.32 : 0.14,
        });
      }
      map.addOverlay(overlay);
      const center = localToMap(getAreaLocalCenter(area));
      const label = new BMap.Label(area.name, { position: new BMap.Point(center.lng, center.lat) });
      label.setStyle({ border: "0", color: colors.label, background: "transparent", fontSize: "10px", fontWeight: "700", textShadow: "0 1px 2px #0f172a" });
      map.addOverlay(label);
    });

    const track = (event?.track ?? []).filter(validPoint);
    const fallback = validPoint(event?.location) ? [event.location] : [];
    const sourcePoints = track.length ? track : fallback;
    const mapPoints = sourcePoints.map((point) => {
      const mapped = localToMap(point);
      return new BMap.Point(mapped.lng, mapped.lat);
    });
    if (!mapPoints.length) return;

    if (mapPoints.length > 1) {
      map.addOverlay(new BMap.Polyline(mapPoints, { strokeColor: "#e2e8f0", strokeWeight: 6, strokeOpacity: 0.9 }));
      const progressPoints = mapPoints.slice(0, Math.min(activeIndex + 1, mapPoints.length));
      if (progressPoints.length > 1) map.addOverlay(new BMap.Polyline(progressPoints, { strokeColor: "#f59e0b", strokeWeight: 4, strokeOpacity: 1 }));
      mapPoints.forEach((point, index) => {
        if (index % Math.max(1, Math.floor(mapPoints.length / 8)) !== 0 && index !== mapPoints.length - 1) return;
        map.addOverlay(new BMap.Circle(point, 2.6, { strokeColor: "#f59e0b", strokeWeight: 2, fillColor: "#ffffff", fillOpacity: 1 }));
      });
    }
    const markerPoint = mapPoints[Math.min(activeIndex, mapPoints.length - 1)];
    const markerKind = track.length ? "person" : event?.subject?.kind === "device" ? "device" : "alarm";
    map.addOverlay(new BMap.Marker(markerPoint, { icon: createMapMarkerIcon(BMap, { kind: markerKind, type: event?.subject?.meta, status: event?.level, selected: true, dictionarySnapshot: dictionaries }), title: event?.subject?.name || event?.type || "风险事件" }));
  }, [activeIndex, areas, dictionaries, event, revision, status]);

  return <MapWrapper data-map-fullscreen={isFullscreen}><MapCanvas ref={mapNodeRef} aria-label="风险事件轨迹回放地图" /><MapFullscreenButton isFullscreen={isFullscreen} onChange={setIsFullscreen} /><Legend><span><i />事件轨迹</span><span><i className="area" />风险区域</span></Legend>{status === "loading" ? <MapStatus>地图信息加载中</MapStatus> : null}{status === "error" ? <MapStatus>地图信息加载失败</MapStatus> : null}</MapWrapper>;
}

const MapWrapper = styled.div`position:relative;min-height:0;height:100%;overflow:hidden;background:#e8edf3;&[data-map-fullscreen="true"]{position:fixed;inset:0;z-index:1200;width:100vw;height:100vh}`;
const MapCanvas = styled.div`width:100%;height:100%;`;
const Legend = styled.div`position:absolute;left:12px;bottom:10px;z-index:5;display:flex;gap:12px;padding:6px 9px;border:1px solid hsl(218 16% 84%);border-radius:5px;background:hsl(0 0% 100% / .92);font-size:10px;span{display:flex;align-items:center;gap:5px}i{width:14px;height:3px;background:#f59e0b}.area{height:9px;border:2px solid #ef4444;background:#fee2e2}`;
const MapStatus = styled.div`position:absolute;inset:0;z-index:20;display:grid;place-items:center;color:white;background:hsl(218 28% 12% / .66);font-size:13px;font-weight:700;`;

export default RiskEventTraceMap;
