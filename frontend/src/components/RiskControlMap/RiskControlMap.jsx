import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { loadBaiduMap } from "../BaiduSatelliteMap/baiduMapLoader";
import { getAreaLocalCenter } from "../BaiduSatelliteMap/mapGeometry";
import MapFullscreenButton from "../BaiduSatelliteMap/MapFullscreenButton";
import { getMapAreaColors } from "../BaiduSatelliteMap/mapMarkerIcons";
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

function mapToLocal(point) {
  return {
    x: Math.round(
      LOCAL_ORIGIN.x + (point.lng - MAP_CENTER.lng) / LOCAL_SCALE.lng
    ),
    y: Math.round(
      LOCAL_ORIGIN.y - (point.lat - MAP_CENTER.lat) / LOCAL_SCALE.lat
    ),
  };
}

function getAreaCenter(area) {
  return localToMap(getAreaLocalCenter(area));
}

function RiskControlMap({
  areas,
  selectedAreaId,
  onAreaSelect,
  drawMode,
  onDrawComplete,
  confirmDrawToken,
  onDraftPointCountChange,
  isDataLoading = false,
  hasDataError = false,
}) {
  const dictionaries = useRuntimeDictionaries();
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const bmapRef = useRef(null);
  const draftOverlaysRef = useRef([]);
  const draftPointsRef = useRef([]);
  const circleCenterRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapRevision, setMapRevision] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const mapNode = mapNodeRef.current;
    setStatus("loading");
    mapNode?.replaceChildren();

    loadBaiduMap(import.meta.env.VITE_BAIDU_MAP_AK)
      .then((BMap) => {
        if (!isMounted || !mapNode) return;

        const map = new BMap.Map(mapNode, {
          enableMapClick: false,
        });
        map.centerAndZoom(new BMap.Point(MAP_CENTER.lng, MAP_CENTER.lat), 18);
        map.setMapType(window.BMAP_SATELLITE_MAP);
        map.enableDragging();
        map.disableScrollWheelZoom();
        map.disableDoubleClickZoom();
        map.disableKeyboard();
        map.addControl(
          new BMap.NavigationControl({
            anchor: window.BMAP_ANCHOR_TOP_RIGHT,
            type: window.BMAP_NAVIGATION_CONTROL_ZOOM,
          })
        );
        map.addControl(
          new BMap.ScaleControl({
            anchor: window.BMAP_ANCHOR_BOTTOM_LEFT,
          })
        );

        bmapRef.current = BMap;
        mapRef.current = map;
        setMapRevision((value) => value + 1);
        setStatus("ready");
      })
      .catch(() => {
        if (isMounted) setStatus("error");
      });

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

    areas.forEach((area) => {
      const colors = getMapAreaColors(area.type, dictionaries);
      const isSelected = area.id === selectedAreaId;
      let overlay;

      if (area.shape === "circle" && area.center && area.radius) {
        const center = localToMap(area.center);
        overlay = new BMap.Circle(
          new BMap.Point(center.lng, center.lat),
          area.radius,
          {
            strokeColor: colors.stroke,
            strokeWeight: isSelected ? 4 : 3,
            strokeOpacity: 1,
            fillColor: colors.fill,
            fillOpacity: isSelected ? 0.46 : 0.34,
          }
        );
      } else {
        const points = (area.polygon ?? []).map((point) => {
          const coordinate = localToMap(point);
          return new BMap.Point(coordinate.lng, coordinate.lat);
        });
        overlay = new BMap.Polygon(points, {
          strokeColor: colors.stroke,
          strokeWeight: isSelected ? 4 : 3,
          strokeOpacity: 1,
          fillColor: colors.fill,
          fillOpacity: isSelected ? 0.46 : 0.34,
        });
      }

      if (!drawMode) {
        overlay.addEventListener("click", () => onAreaSelect(area.id));
      }
      map.addOverlay(overlay);

      const center = getAreaCenter(area);
      const label = new BMap.Label(area.name, {
        position: new BMap.Point(center.lng, center.lat),
        offset: new BMap.Size(0, 0),
      });
      label.setStyle({
        border: "0",
        padding: "0",
        color: colors.label,
        background: "transparent",
        boxShadow: "none",
        fontSize: "11px",
        fontWeight: isSelected ? "800" : "700",
        lineHeight: "14px",
        textAlign: "center",
        whiteSpace: "nowrap",
        transform: "translate(-50%, -50%)",
        textShadow: "0 1px 2px rgba(15, 23, 42, 0.95)",
        cursor: "pointer",
      });
      if (!drawMode) {
        label.addEventListener("click", () => onAreaSelect(area.id));
      }
      map.addOverlay(label);
    });
  }, [areas, dictionaries, drawMode, mapRevision, onAreaSelect, selectedAreaId, status]);

  useEffect(() => {
    const BMap = bmapRef.current;
    const map = mapRef.current;
    if (!BMap || !map || !drawMode) return undefined;

    draftPointsRef.current = [];
    circleCenterRef.current = null;
    onDraftPointCountChange(0);
    map.disableDoubleClickZoom();

    const clearDraft = () => {
      draftOverlaysRef.current.forEach((overlay) => map.removeOverlay(overlay));
      draftOverlaysRef.current = [];
    };

    const drawPolygonPreview = () => {
      clearDraft();
      draftPointsRef.current.forEach((point) => {
        const marker = new BMap.Circle(point, 3.5, {
          strokeColor: "#ffffff",
          strokeWeight: 2,
          strokeOpacity: 1,
          fillColor: "#1677ff",
          fillOpacity: 1,
        });
        map.addOverlay(marker);
        draftOverlaysRef.current.push(marker);
      });

      if (draftPointsRef.current.length >= 2) {
        const polygon = new BMap.Polygon(draftPointsRef.current, {
          strokeColor: "#1677ff",
          strokeWeight: 3,
          strokeOpacity: 0.95,
          fillColor: "#60a5fa",
          fillOpacity: 0.24,
        });
        map.addOverlay(polygon);
        draftOverlaysRef.current.push(polygon);
      }
    };

    const getMapPoint = (event) => {
      const rect = mapNodeRef.current.getBoundingClientRect();
      return map.pixelToPoint(
        new BMap.Pixel(event.clientX - rect.left, event.clientY - rect.top)
      );
    };

    const handleClick = (event) => {
      if (event.detail > 1) return;
      const point = getMapPoint(event);

      if (drawMode === "polygon") {
        draftPointsRef.current = [...draftPointsRef.current, point];
        onDraftPointCountChange(draftPointsRef.current.length);
        drawPolygonPreview();
        return;
      }

      if (!circleCenterRef.current) {
        circleCenterRef.current = point;
        clearDraft();
        const centerMarker = new BMap.Circle(point, 4, {
          strokeColor: "#1677ff",
          strokeWeight: 3,
          fillColor: "#60a5fa",
          fillOpacity: 0.28,
        });
        map.addOverlay(centerMarker);
        draftOverlaysRef.current = [centerMarker];
        return;
      }

      const radius = Math.max(
        5,
        Math.round(map.getDistance(circleCenterRef.current, point))
      );
      const center = mapToLocal(circleCenterRef.current);
      clearDraft();
      onDrawComplete({ shape: "circle", center, radius });
    };

    const mapNode = mapNodeRef.current;
    mapNode.addEventListener("click", handleClick);

    return () => {
      mapNode.removeEventListener("click", handleClick);
      clearDraft();
    };
  }, [drawMode, mapRevision, onDraftPointCountChange, onDrawComplete, status]);

  useEffect(() => {
    if (
      !confirmDrawToken ||
      drawMode !== "polygon" ||
      draftPointsRef.current.length < 3
    ) {
      return;
    }

    onDrawComplete({
      shape: "polygon",
      polygon: draftPointsRef.current.map(mapToLocal),
    });
  }, [confirmDrawToken, drawMode, onDrawComplete]);

  useEffect(() => {
    const BMap = bmapRef.current;
    const map = mapRef.current;
    const area = areas.find((item) => item.id === selectedAreaId);
    if (!BMap || !map || !area) return;

    const center = getAreaCenter(area);
    map.panTo(new BMap.Point(center.lng, center.lat));
  }, [areas, mapRevision, selectedAreaId, status]);

  return (
    <MapFrame data-map-fullscreen={isFullscreen}>
      <MapCanvas ref={mapNodeRef} aria-label="风险区域电子围栏地图" />
      <MapFullscreenButton isFullscreen={isFullscreen} onChange={setIsFullscreen} />
      {status === "error" || hasDataError ? (
        <MapStatus>地图信息加载失败</MapStatus>
      ) : status === "loading" || isDataLoading ? (
        <MapStatus>地图信息加载中</MapStatus>
      ) : null}
      {drawMode && status === "ready" && !isDataLoading && !hasDataError ? (
        <DrawHint>
          {drawMode === "polygon"
            ? "单击添加边界点，完成后点击确认创建"
            : "依次单击圆心与边界点完成绘制"}
        </DrawHint>
      ) : null}
    </MapFrame>
  );
}

const MapFrame = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: hsl(216 23% 94%);
  &[data-map-fullscreen="true"] { position: fixed; inset: 0; z-index: 1200; width: 100vw; height: 100vh; }
`;

const MapCanvas = styled.div`
  width: 100%;
  height: 100%;
`;

const MapStatus = styled.div`
  position: absolute;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  color: white;
  background: hsl(218 28% 12% / 0.66);
  font-size: 0.8125rem;
  font-weight: 700;
  pointer-events: auto;
  cursor: wait;
`;

const DrawHint = styled.div`
  position: absolute;
  top: 12px;
  left: 50%;
  z-index: 3;
  padding: 7px 12px;
  border: 1px solid hsl(217 91% 76%);
  border-radius: 5px;
  color: hsl(218 73% 34%);
  background: hsl(214 100% 97% / 0.96);
  box-shadow: 0 4px 14px hsl(218 42% 20% / 0.16);
  font-size: 0.75rem;
  transform: translateX(-50%);
  white-space: nowrap;
`;

export default RiskControlMap;
