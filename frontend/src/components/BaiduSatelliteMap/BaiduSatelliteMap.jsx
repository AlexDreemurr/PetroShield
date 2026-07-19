import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import styled from "styled-components";
import { ArrowRight, X } from "lucide-react";
import { loadBaiduMap } from "./baiduMapLoader";
import { getAreaLocalCenter } from "./mapGeometry";
import { createMapMarkerIcon, MAP_AREA_COLORS } from "./mapMarkerIcons";
import MapFullscreenButton from "./MapFullscreenButton";
import { getCachedJson, loadCachedJson, PAGE_DATA_URLS } from "../../services/pageDataCache";

const MAP_CENTER = { lng: 121.671271, lat: 29.978283 };
const LOCAL_ORIGIN = { x: 300, y: 220 };
const LOCAL_SCALE = { lng: 0.0000046, lat: 0.0000038 };
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

function addAreaLabel(BMap, map, text, coordinate, color, onClick) {
  const point = new BMap.Point(coordinate.lng, coordinate.lat);

  function ClickableAreaLabel() {}
  ClickableAreaLabel.prototype = new BMap.Overlay();
  ClickableAreaLabel.prototype.initialize = function initialize(mapInstance) {
    this.map = mapInstance;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.setAttribute("aria-label", `查看区域：${text}`);
    Object.assign(button.style, {
      position: "absolute",
      zIndex: "100000",
      padding: "0",
      border: "0",
      color,
      background: "transparent",
      boxShadow: "none",
      fontSize: "10px",
      fontWeight: "700",
      whiteSpace: "nowrap",
      transform: "translate(-50%, -100%)",
      textShadow: "0 1px 2px rgba(15, 23, 42, 0.95)",
      cursor: "pointer",
    });
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      onClick();
    });
    mapInstance.getPanes().floatPane.appendChild(button);
    this.button = button;
    return button;
  };
  ClickableAreaLabel.prototype.draw = function draw() {
    const pixel = this.map.pointToOverlayPixel(point);
    this.button.style.left = `${pixel.x}px`;
    this.button.style.top = `${pixel.y - 18}px`;
  };

  map.addOverlay(new ClickableAreaLabel());
}

function BaiduSatelliteMap({ layers, alarms = [] }) {
  const navigate = useNavigate();
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const bmapRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const initialPeople = getCachedJson(PAGE_DATA_URLS.people);
  const initialDevices = getCachedJson(PAGE_DATA_URLS.devices);
  const initialAreas = getCachedJson(PAGE_DATA_URLS.areas);
  const hasInitialData = initialPeople && initialDevices && initialAreas;
  const [dataStatus, setDataStatus] = useState(hasInitialData ? "ready" : "loading");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapRevision, setMapRevision] = useState(0);
  const [mapData, setMapData] = useState({
    people: initialPeople?.items ?? [],
    devices: initialDevices?.items ?? [],
    areas: initialAreas?.items ?? [],
  });
  const [selectedFeature, setSelectedFeature] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const cachedPeople = getCachedJson(PAGE_DATA_URLS.people);
    const cachedDevices = getCachedJson(PAGE_DATA_URLS.devices);
    const cachedAreas = getCachedJson(PAGE_DATA_URLS.areas);
    const hasCachedData = cachedPeople && cachedDevices && cachedAreas;
    if (hasCachedData) setDataStatus("ready");
    Promise.all([
      loadCachedJson(PAGE_DATA_URLS.people, { force: Boolean(cachedPeople) }),
      loadCachedJson(PAGE_DATA_URLS.devices, { force: Boolean(cachedDevices) }),
      loadCachedJson(PAGE_DATA_URLS.areas, { force: Boolean(cachedAreas) }),
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
        if (isMounted && !hasCachedData) setDataStatus("error");
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
    const visibleAreas = layers.areas
      ? mapData.areas.filter((area) => area.enabled !== false)
      : [];

    if (layers.areas) {
      visibleAreas.forEach((area) => {
        const colors = MAP_AREA_COLORS[area.type] ?? MAP_AREA_COLORS.normal;
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
        overlay.addEventListener("click", () => {
          setSelectedFeature({ kind: "area", item: area });
        });
      });
    }

    if (layers.devices) {
      mapData.devices.forEach((device, index) => {
        const coordinate = getEntityCoordinate(device, index, device.area_name);
        const marker = new BMap.Marker(new BMap.Point(coordinate.lng, coordinate.lat), {
          icon: createMapMarkerIcon(BMap, { kind: "device", type: device.type, status: device.realtime?.status }),
          title: device.name,
        });
        map.addOverlay(marker);
        marker.addEventListener("click", () => {
          setSelectedFeature({ kind: "device", item: device });
        });
      });
    }

    if (layers.people) {
      mapData.people.forEach((person, index) => {
        const coordinate = getEntityCoordinate(person, index, person.location_zone);
        const marker = new BMap.Marker(new BMap.Point(coordinate.lng, coordinate.lat), {
          icon: createMapMarkerIcon(BMap, { kind: "person", status: person.status }),
          title: person.name,
        });
        map.addOverlay(marker);
        marker.addEventListener("click", () => {
          setSelectedFeature({ kind: "person", item: person });
        });
      });
    }

    if (layers.alarms) {
      alarms.forEach((alarm, index) => {
        const coordinate = getEntityCoordinate(alarm, index, alarm.location?.area_name);
        const marker = new BMap.Marker(new BMap.Point(coordinate.lng, coordinate.lat), {
          icon: createMapMarkerIcon(BMap, { kind: "alarm", status: alarm.level }),
          title: alarm.title || alarm.type || "告警",
        });
        map.addOverlay(marker);
        marker.addEventListener("click", () => setSelectedFeature({ kind: "alarm", item: alarm }));
      });
    }

    visibleAreas.forEach((area) => {
      const colors = MAP_AREA_COLORS[area.type] ?? MAP_AREA_COLORS.normal;
      addAreaLabel(BMap, map, area.name, getAreaCenter(area), colors.label, () => {
        setSelectedFeature({ kind: "area", item: area });
      });
    });
  }, [alarms, layers, mapData, mapRevision, status]);

  useEffect(() => {
    if (!selectedFeature) return;
    const layerKey = {
      person: "people",
      device: "devices",
      area: "areas",
      alarm: "alarms",
    }[selectedFeature.kind];
    if (!layers[layerKey]) setSelectedFeature(null);
  }, [layers, selectedFeature]);

  const selectedItem = selectedFeature?.item;
  const selectedKind = selectedFeature?.kind;
  const selectedMeta = selectedKind === "person"
    ? {
        eyebrow: "人员",
        title: selectedItem?.name,
        lines: [selectedItem?.department, selectedItem?.position, selectedItem?.location_zone],
        status: selectedItem?.status,
        action: "查看人员",
        target: `/people-management?person_id=${encodeURIComponent(selectedItem?.id ?? "")}`,
      }
    : selectedKind === "device"
      ? {
          eyebrow: "设备",
          title: selectedItem?.name,
          lines: [selectedItem?.type, selectedItem?.area_name],
          status: selectedItem?.realtime?.status ?? selectedItem?.status,
          action: "查看设备",
          target: `/device-management?device_id=${encodeURIComponent(selectedItem?.id ?? "")}`,
        }
      : selectedKind === "area"
        ? {
            eyebrow: "风险区域",
            title: selectedItem?.name,
            lines: [
              `人员 ${selectedItem?.people_count ?? 0} · 设备 ${selectedItem?.device_count ?? 0}`,
              `当前告警 ${selectedItem?.alert_count ?? 0}`,
            ],
            status: selectedItem?.enabled === false ? "已停用" : "已启用",
            action: "查看区域",
            target: `/risk-control?area_id=${encodeURIComponent(selectedItem?.id ?? "")}`,
          }
        : selectedKind === "alarm"
          ? {
              eyebrow: "告警",
              title: selectedItem?.title || selectedItem?.type,
              lines: [selectedItem?.description, selectedItem?.meta],
              status: `${selectedItem?.level || "一般"} · ${selectedItem?.status || "待处理"}`,
              action: "查看告警",
              target: `/alarm-center?alarm_id=${encodeURIComponent(selectedItem?.id ?? "")}`,
            }
        : null;

  return (
    <MapWrapper data-map-fullscreen={isFullscreen}>
      <MapCanvas ref={mapNodeRef} aria-label="厂区人员、设备、风险区域与告警百度卫星地图" />
      <MapFullscreenButton isFullscreen={isFullscreen} onChange={setIsFullscreen} />
      <MapLegend aria-label="地图图例">
        <span><i data-kind="person" />人员 {mapData.people.length}</span>
        <span><i data-kind="device" />设备 {mapData.devices.length}</span>
        <span><i data-kind="area" />区域 {mapData.areas.length}</span>
        <span><i data-kind="alarm" />告警 {alarms.length}</span>
      </MapLegend>
      {selectedMeta && (
        <FeaturePopover role="dialog" aria-label={`${selectedMeta.eyebrow}简介`}>
          <FeatureHeader>
            <span>{selectedMeta.eyebrow}</span>
            <button type="button" aria-label="关闭简介" onClick={() => setSelectedFeature(null)}>
              <X size={14} />
            </button>
          </FeatureHeader>
          <FeatureTitle>{selectedMeta.title || "未命名"}</FeatureTitle>
          <FeatureStatus>{selectedMeta.status || "状态未知"}</FeatureStatus>
          <FeatureDetails>
            {selectedMeta.lines.filter(Boolean).map((line, index) => (
              <span key={`${line}-${index}`}>{line}</span>
            ))}
          </FeatureDetails>
          <FeatureAction type="button" onClick={() => navigate(selectedMeta.target)}>
            {selectedMeta.action}<ArrowRight size={14} />
          </FeatureAction>
        </FeaturePopover>
      )}
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
  i[data-kind="alarm"] { border-radius: 50%; background: #ef4444; box-shadow: 0 0 0 2px #fee2e2; }
`;
const FeaturePopover = styled.div`
  position: absolute;
  left: 12px;
  bottom: 12px;
  z-index: 4;
  width: 224px;
  padding: 11px 12px 12px;
  border: 1px solid hsl(216 18% 82%);
  border-radius: 6px;
  color: hsl(218 22% 22%);
  background: hsl(0 0% 100% / 0.96);
  box-shadow: 0 12px 30px hsl(220 25% 10% / 0.2);
`;
const FeatureHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: hsl(215 16% 48%);
  font-size: 10px;
  font-weight: 700;

  button {
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    border: 0;
    color: hsl(215 16% 48%);
    background: transparent;
    cursor: pointer;
  }
`;
const FeatureTitle = styled.strong`
  display: block;
  margin-top: 2px;
  overflow: hidden;
  color: hsl(218 24% 18%);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
const FeatureStatus = styled.span`
  display: inline-flex;
  width: fit-content;
  margin-top: 7px;
  padding: 2px 6px;
  border-radius: 3px;
  color: hsl(211 84% 38%);
  background: hsl(211 90% 95%);
  font-size: 10px;
  font-weight: 700;
`;
const FeatureDetails = styled.div`
  min-height: 32px;
  margin-top: 7px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  color: hsl(215 14% 42%);
  font-size: 10px;
  line-height: 1.35;
`;
const FeatureAction = styled.button`
  width: 100%;
  height: 30px;
  margin-top: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border: 0;
  border-radius: 4px;
  color: #fff;
  background: #1677ff;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;

  &:hover { background: #0f68e8; }
`;
const MapStatus = styled.div`
  position: absolute; inset: 0; z-index: 20; display: grid; place-items: center; padding: 16px;
  color: white; background: hsl(218 28% 12% / 0.66);
  font-size: 0.875rem; font-weight: 700; text-align: center; pointer-events: auto; cursor: wait;
`;

export default BaiduSatelliteMap;
