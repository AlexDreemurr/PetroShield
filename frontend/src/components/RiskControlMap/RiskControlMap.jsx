import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { loadBaiduMap } from "../BaiduSatelliteMap/baiduMapLoader";

const MAP_CENTER = { lng: 121.671271, lat: 29.978283 };
const LOCAL_ORIGIN = { x: 300, y: 220 };
const LOCAL_SCALE = { lng: 0.0000046, lat: 0.0000038 };

const toneColors = {
  danger: { stroke: "#ef4444", fill: "#ef4444" },
  restricted: { stroke: "#f59e0b", fill: "#f59e0b" },
  prohibited: { stroke: "#dc2626", fill: "#991b1b" },
  normal: { stroke: "#22c55e", fill: "#22c55e" },
};

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
  if (area.center) {
    return localToMap(area.center);
  }

  const points = area.polygon ?? [];
  const total = points.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
    { x: 0, y: 0 }
  );

  return localToMap({
    x: total.x / Math.max(points.length, 1),
    y: total.y / Math.max(points.length, 1),
  });
}

function RiskControlMap({
  areas,
  selectedAreaId,
  onAreaSelect,
  drawMode,
  onDrawComplete,
  confirmDrawToken,
  onDraftPointCountChange,
}) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const bmapRef = useRef(null);
  const draftOverlaysRef = useRef([]);
  const draftPointsRef = useRef([]);
  const circleCenterRef = useRef(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let isMounted = true;

    loadBaiduMap(import.meta.env.VITE_BAIDU_MAP_AK)
      .then((BMap) => {
        if (!isMounted || !mapNodeRef.current) return;

        const map = new BMap.Map(mapNodeRef.current, {
          enableMapClick: false,
        });
        map.centerAndZoom(new BMap.Point(MAP_CENTER.lng, MAP_CENTER.lat), 18);
        map.setMapType(window.BMAP_SATELLITE_MAP);
        map.enableDragging();
        map.enableScrollWheelZoom(true);
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
        setStatus("ready");
      })
      .catch(() => {
        if (isMounted) setStatus("error");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const BMap = bmapRef.current;
    const map = mapRef.current;
    if (!BMap || !map) return;

    map.clearOverlays();

    areas.forEach((area) => {
      const colors = toneColors[area.type] ?? toneColors.normal;
      const isSelected = area.id === selectedAreaId;
      let overlay;

      if (area.shape === "circle" && area.center && area.radius) {
        const center = localToMap(area.center);
        overlay = new BMap.Circle(
          new BMap.Point(center.lng, center.lat),
          area.radius,
          {
            strokeColor: colors.stroke,
            strokeWeight: isSelected ? 4 : 2,
            strokeOpacity: 0.96,
            fillColor: colors.fill,
            fillOpacity: isSelected ? 0.34 : 0.22,
          }
        );
      } else {
        const points = (area.polygon ?? []).map((point) => {
          const coordinate = localToMap(point);
          return new BMap.Point(coordinate.lng, coordinate.lat);
        });
        overlay = new BMap.Polygon(points, {
          strokeColor: colors.stroke,
          strokeWeight: isSelected ? 4 : 2,
          strokeOpacity: 0.96,
          fillColor: colors.fill,
          fillOpacity: isSelected ? 0.34 : 0.22,
        });
      }

      if (!drawMode) {
        overlay.addEventListener("click", () => onAreaSelect(area.id));
      }
      map.addOverlay(overlay);

      const center = getAreaCenter(area);
      const label = new BMap.Label(area.name, {
        position: new BMap.Point(center.lng, center.lat),
        offset: new BMap.Size(-42, -12),
      });
      label.setStyle({
        width: "84px",
        border: isSelected ? `1px solid ${colors.stroke}` : "1px solid #cbd5e1",
        borderRadius: "4px",
        padding: "3px 5px",
        color: "#0f172a",
        background: "rgba(255,255,255,.92)",
        boxShadow: "0 2px 8px rgba(15,23,42,.14)",
        fontSize: "11px",
        lineHeight: "16px",
        textAlign: "center",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        cursor: "pointer",
      });
      if (!drawMode) {
        label.addEventListener("click", () => onAreaSelect(area.id));
      }
      map.addOverlay(label);
    });
  }, [areas, drawMode, onAreaSelect, selectedAreaId, status]);

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
      map.enableDoubleClickZoom();
      clearDraft();
    };
  }, [drawMode, onDraftPointCountChange, onDrawComplete, status]);

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
  }, [areas, selectedAreaId]);

  return (
    <MapFrame>
      <MapCanvas ref={mapNodeRef} aria-label="风险区域电子围栏地图" />
      {status === "loading" ? <MapStatus>地图加载中...</MapStatus> : null}
      {status === "error" ? (
        <MapStatus>地图加载失败，请检查 VITE_BAIDU_MAP_AK</MapStatus>
      ) : null}
      {drawMode ? (
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
`;

const MapCanvas = styled.div`
  width: 100%;
  height: 100%;
`;

const MapStatus = styled.div`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: hsl(218 10% 42%);
  background: hsl(216 23% 95% / 0.86);
  font-size: 0.8125rem;
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
