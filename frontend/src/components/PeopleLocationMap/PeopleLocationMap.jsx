import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { loadBaiduMap } from "../BaiduSatelliteMap/baiduMapLoader";
import { getAreaLocalCenter } from "../BaiduSatelliteMap/mapGeometry";
import { createMapMarkerIcon } from "../BaiduSatelliteMap/mapMarkerIcons";
import MapFullscreenButton from "../BaiduSatelliteMap/MapFullscreenButton";
import { FONT_SIZES } from "../../constants/STYLES";
import { getCachedJson, loadCachedJson, PAGE_DATA_URLS } from "../../services/pageDataCache";

const MAP_CENTER = {
  lng: 121.671271,
  lat: 29.978283,
};

const LOCAL_ORIGIN = {
  x: 300,
  y: 220,
};

const LOCAL_COORDINATE_SCALE = {
  lng: 0.0000046,
  lat: 0.0000038,
};

const TRACK_COLORS = {
  line: "#2563eb",
  lineGlow: "#dbeafe",
  arrow: "#1d4ed8",
  arrowHalo: "#ffffff",
  turn: "#2563eb",
  start: "#64748b",
};

const AREA_COLORS = {
  danger: { stroke: "#dc2626", fill: "#ef4444", label: "#fecaca" },
  restricted: { stroke: "#d97706", fill: "#f59e0b", label: "#fef3c7" },
  prohibited: { stroke: "#7f1d1d", fill: "#b91c1c", label: "#fecaca" },
  normal: { stroke: "#15803d", fill: "#22c55e", label: "#dcfce7" },
};

function localToMap(point) {
  return {
    lng: MAP_CENTER.lng + (Number(point.x) - LOCAL_ORIGIN.x) * LOCAL_COORDINATE_SCALE.lng,
    lat: MAP_CENTER.lat - (Number(point.y) - LOCAL_ORIGIN.y) * LOCAL_COORDINATE_SCALE.lat,
  };
}

function getAreaLabelCoordinate(area) {
  return localToMap(getAreaLocalCenter(area));
}

const zoneAnchors = [
  {
    keyword: "A区",
    lng: MAP_CENTER.lng - 0.0012,
    lat: MAP_CENTER.lat + 0.00035,
  },
  {
    keyword: "B区",
    lng: MAP_CENTER.lng + 0.0002,
    lat: MAP_CENTER.lat - 0.00045,
  },
  {
    keyword: "C区",
    lng: MAP_CENTER.lng + 0.001,
    lat: MAP_CENTER.lat + 0.0003,
  },
  {
    keyword: "办公",
    lng: MAP_CENTER.lng - 0.00025,
    lat: MAP_CENTER.lat + 0.0009,
  },
];

function isFiniteCoordinate(value) {
  return value !== null && value !== "" && Number.isFinite(Number(value));
}

function toMapCoordinate(person, index) {
  const position = person.latest_position;

  if (isFiniteCoordinate(position?.x) && isFiniteCoordinate(position?.y)) {
    return {
      lng:
        MAP_CENTER.lng +
        (Number(position.x) - LOCAL_ORIGIN.x) * LOCAL_COORDINATE_SCALE.lng,
      lat:
        MAP_CENTER.lat -
        (Number(position.y) - LOCAL_ORIGIN.y) * LOCAL_COORDINATE_SCALE.lat,
    };
  }

  const zoneAnchor = zoneAnchors.find((anchor) =>
    person.location_zone?.includes(anchor.keyword)
  ) ?? {
    lng: MAP_CENTER.lng,
    lat: MAP_CENTER.lat,
  };
  const ring = Math.floor(index / 8) + 1;
  const angle = ((index % 8) / 8) * Math.PI * 2;
  const radius = 0.00016 * ring;

  return {
    lng: zoneAnchor.lng + Math.cos(angle) * radius,
    lat: zoneAnchor.lat + Math.sin(angle) * radius,
  };
}

function toTrackCoordinate(point) {
  if (!isFiniteCoordinate(point?.x) || !isFiniteCoordinate(point?.y)) {
    return null;
  }

  return {
    lng:
      MAP_CENTER.lng +
      (Number(point.x) - LOCAL_ORIGIN.x) * LOCAL_COORDINATE_SCALE.lng,
    lat:
      MAP_CENTER.lat -
      (Number(point.y) - LOCAL_ORIGIN.y) * LOCAL_COORDINATE_SCALE.lat,
    direction: isFiniteCoordinate(point.direction)
      ? Number(point.direction)
      : null,
  };
}

function getVisibleTrackPoints(person) {
  const track = Array.isArray(person.track) ? person.track : [];

  if (track.length <= 1) {
    return [];
  }

  return track.map(toTrackCoordinate).filter(Boolean);
}

function createTrackPoint(BMap, coordinate) {
  return new BMap.Point(coordinate.lng, coordinate.lat);
}

function addPolyline(BMap, map, coordinates, options) {
  map.addOverlay(
    new BMap.Polyline(
      coordinates.map((coordinate) => createTrackPoint(BMap, coordinate)),
      options
    )
  );
}

function rotateVector(vector, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return {
    lng: vector.lng * cos - vector.lat * sin,
    lat: vector.lng * sin + vector.lat * cos,
  };
}

function addTrackArrowOverlay(BMap, map, previousPoint, centerPoint, nextPoint, arrowLength) {
  const vector = {
    lng: nextPoint.lng - previousPoint.lng,
    lat: nextPoint.lat - previousPoint.lat,
  };
  const tangentLength = Math.hypot(vector.lng, vector.lat);

  if (tangentLength <= 0) {
    return;
  }

  const unit = {
    lng: vector.lng / tangentLength,
    lat: vector.lat / tangentLength,
  };
  const shaftHalfLength = arrowLength / 2;
  const headLength = arrowLength * 0.48;
  const headAngle = (36 * Math.PI) / 180;
  const tail = {
    lng: centerPoint.lng - unit.lng * shaftHalfLength,
    lat: centerPoint.lat - unit.lat * shaftHalfLength,
  };
  const tip = {
    lng: centerPoint.lng + unit.lng * shaftHalfLength,
    lat: centerPoint.lat + unit.lat * shaftHalfLength,
  };
  const leftHeadVector = rotateVector(
    {
      lng: -unit.lng * headLength,
      lat: -unit.lat * headLength,
    },
    headAngle
  );
  const rightHeadVector = rotateVector(
    {
      lng: -unit.lng * headLength,
      lat: -unit.lat * headLength,
    },
    -headAngle
  );
  const leftHead = {
    lng: tip.lng + leftHeadVector.lng,
    lat: tip.lat + leftHeadVector.lat,
  };
  const rightHead = {
    lng: tip.lng + rightHeadVector.lng,
    lat: tip.lat + rightHeadVector.lat,
  };
  const baseOptions = {
    strokeOpacity: 0.96,
    enableMassClear: true,
  };

  addPolyline(BMap, map, [tail, tip], {
    ...baseOptions,
    strokeColor: TRACK_COLORS.arrowHalo,
    strokeWeight: 4,
  });
  addPolyline(BMap, map, [leftHead, tip, rightHead], {
    ...baseOptions,
    strokeColor: TRACK_COLORS.arrowHalo,
    strokeWeight: 4,
  });
  addPolyline(BMap, map, [tail, tip], {
    ...baseOptions,
    strokeColor: TRACK_COLORS.arrow,
    strokeWeight: 2,
  });
  addPolyline(BMap, map, [leftHead, tip, rightHead], {
    ...baseOptions,
    strokeColor: TRACK_COLORS.arrow,
    strokeWeight: 2,
  });
}

function createPersonIcon(BMap, person, isSelected) {
  return createMapMarkerIcon(BMap, {
    kind: "person",
    status: person.status,
    selected: isSelected,
  });
}

function PeopleLocationMap({
  people,
  selectedPersonId,
  onPersonSelect,
  showTrack = true,
  className,
  isDataLoading = false,
  hasDataError = false,
}) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const bmapRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const [showAllPeople, setShowAllPeople] = useState(true);
  const [showPersonNames, setShowPersonNames] = useState(true);
  const [showAllAreas, setShowAllAreas] = useState(true);
  const initialAreaPayload = getCachedJson(PAGE_DATA_URLS.areas);
  const [riskAreas, setRiskAreas] = useState(initialAreaPayload?.items ?? []);
  const [areaStatus, setAreaStatus] = useState(initialAreaPayload ? "ready" : "loading");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapRevision, setMapRevision] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const cachedPayload = getCachedJson(PAGE_DATA_URLS.areas);
    loadCachedJson(PAGE_DATA_URLS.areas, { force: Boolean(cachedPayload) })
      .then((payload) => {
        if (isMounted) {
          setRiskAreas(payload.items ?? []);
          setAreaStatus("ready");
        }
      })
      .catch(() => {
        if (isMounted) {
          setRiskAreas([]);
          if (!cachedPayload) setAreaStatus("error");
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const ak = import.meta.env.VITE_BAIDU_MAP_AK;
    const mapNode = mapNodeRef.current;
    setStatus("loading");
    mapNode?.replaceChildren();

    loadBaiduMap(ak)
      .then((BMap) => {
        if (!isMounted || !mapNode) {
          return;
        }

        const center = new BMap.Point(MAP_CENTER.lng, MAP_CENTER.lat);
        const map = new BMap.Map(mapNode, {
          enableMapClick: false,
        });

        map.centerAndZoom(center, 18);
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
        if (isMounted) {
          setStatus("error");
        }
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

    if (!BMap || !map) {
      return;
    }

    map.clearOverlays();

    if (showAllAreas) {
      riskAreas.filter((area) => area.enabled !== false).forEach((area) => {
        const colors = AREA_COLORS[area.type] ?? AREA_COLORS.normal;
        let overlay;
        if (area.shape === "circle" && area.center && area.radius) {
          const coordinate = localToMap(area.center);
          overlay = new BMap.Circle(
            new BMap.Point(coordinate.lng, coordinate.lat),
            Number(area.radius),
            {
              strokeColor: colors.stroke,
              strokeWeight: 3,
              strokeOpacity: 1,
              fillColor: colors.fill,
              fillOpacity: 0.34,
            }
          );
        } else {
          const points = (area.polygon ?? []).map((point) => {
            const coordinate = localToMap(point);
            return new BMap.Point(coordinate.lng, coordinate.lat);
          });
          if (points.length < 3) return;
          overlay = new BMap.Polygon(points, {
            strokeColor: colors.stroke,
            strokeWeight: 3,
            strokeOpacity: 1,
            fillColor: colors.fill,
            fillOpacity: 0.34,
          });
        }
        map.addOverlay(overlay);

        const labelCoordinate = getAreaLabelCoordinate(area);
        const label = new BMap.Label(area.name, {
          position: new BMap.Point(labelCoordinate.lng, labelCoordinate.lat),
          offset: new BMap.Size(0, 0),
        });
        label.setStyle({
          padding: "0",
          border: "0",
          color: colors.label,
          background: "transparent",
          boxShadow: "none",
          fontSize: "10px",
          fontWeight: "700",
          whiteSpace: "nowrap",
          transform: "translate(-50%, -50%)",
          textShadow: "0 1px 2px rgba(15, 23, 42, 0.95)",
        });
        map.addOverlay(label);
      });
    }

    const selectedPerson = people.find(
      (person) => person.id === selectedPersonId
    );
    const visiblePeople = showAllPeople
      ? people
      : people.filter((person) => person.id === selectedPersonId);
    const markerPoints = visiblePeople.map((person) => ({
      person,
      coordinate: toMapCoordinate(
        person,
        people.findIndex((candidate) => candidate.id === person.id)
      ),
    }));

    if (showTrack && selectedPerson) {
      const trackCoordinates = getVisibleTrackPoints(selectedPerson);

      if (trackCoordinates.length > 1) {
        const trackPoints = trackCoordinates.map(
          (coordinate) => new BMap.Point(coordinate.lng, coordinate.lat)
        );
        const trackHalo = new BMap.Polyline(trackPoints, {
          strokeColor: TRACK_COLORS.lineGlow,
          strokeWeight: 8,
          strokeOpacity: 0.82,
        });
        const trackLine = new BMap.Polyline(trackPoints, {
          strokeColor: TRACK_COLORS.line,
          strokeWeight: 4,
          strokeOpacity: 0.94,
        });
        const startPoint = trackPoints[0];
        const endPoint = trackPoints[trackPoints.length - 1];

        map.addOverlay(trackHalo);
        map.addOverlay(trackLine);

        const lngExtent = Math.max(...trackPoints.map((point) => point.lng)) - Math.min(...trackPoints.map((point) => point.lng));
        const latExtent = Math.max(...trackPoints.map((point) => point.lat)) - Math.min(...trackPoints.map((point) => point.lat));
        const arrowLength = Math.min(Math.max(Math.hypot(lngExtent, latExtent) * 0.032, 0.00005), 0.00016);
        const neighborOffset = Math.max(2, Math.floor(trackPoints.length * 0.015));

        [0.28, 0.52, 0.76].forEach((ratio) => {
          const centerIndex = Math.round((trackPoints.length - 1) * ratio);
          const previousIndex = Math.max(0, centerIndex - neighborOffset);
          const nextIndex = Math.min(trackPoints.length - 1, centerIndex + neighborOffset);

          addTrackArrowOverlay(
            BMap,
            map,
            trackPoints[previousIndex],
            trackPoints[centerIndex],
            trackPoints[nextIndex],
            arrowLength
          );
        });

        map.addOverlay(
          new BMap.Circle(startPoint, 3.5, {
            strokeColor: TRACK_COLORS.start,
            strokeWeight: 1,
            strokeOpacity: 0.8,
            fillColor: TRACK_COLORS.start,
            fillOpacity: 0.9,
          })
        );
        map.addOverlay(
          new BMap.Circle(endPoint, 4.5, {
            strokeColor: TRACK_COLORS.line,
            strokeWeight: 2,
            strokeOpacity: 0.95,
            fillColor: TRACK_COLORS.line,
            fillOpacity: 0.95,
          })
        );
      }
    }

    markerPoints.forEach(({ person, coordinate }) => {
      const isSelected = person.id === selectedPersonId;
      const point = new BMap.Point(coordinate.lng, coordinate.lat);
      const marker = new BMap.Marker(point, {
        icon: createPersonIcon(BMap, person, isSelected),
      });
      if (showPersonNames) {
        const label = new BMap.Label(person.name, {
          offset: new BMap.Size(14, -24),
        });

        label.setStyle({
          padding: "1px 7px",
          border: "1px solid rgba(22, 119, 255, 0.25)",
          borderRadius: "999px",
          color: "#1f2937",
          background: "rgba(255, 255, 255, 0.88)",
          boxShadow: "0 6px 14px rgba(15, 23, 42, 0.16)",
          fontSize: FONT_SIZES.peopleMapLabel,
          lineHeight: "16px",
          transform: "translateX(-50%)",
          whiteSpace: "nowrap",
        });

        marker.setLabel(label);
      }
      marker.addEventListener("click", () => onPersonSelect(person));
      map.addOverlay(marker);
    });

    if (selectedPerson) {
      const selectedIndex = people.findIndex(
        (person) => person.id === selectedPerson.id
      );
      const coordinate = toMapCoordinate(selectedPerson, selectedIndex);
      map.panTo(new BMap.Point(coordinate.lng, coordinate.lat));
    }
  }, [
    onPersonSelect,
    mapRevision,
    people,
    selectedPersonId,
    riskAreas,
    status,
    showAllPeople,
    showAllAreas,
    showPersonNames,
    showTrack,
  ]);

  return (
    <MapFrame data-map-fullscreen={isFullscreen} className={className}>
      <MapCanvas ref={mapNodeRef} aria-label="人员定位百度卫星地图" />
      <MapFullscreenButton isFullscreen={isFullscreen} onChange={setIsFullscreen} />
      <MapOptions>
        <MapToggle>
          <input
            type="checkbox"
            checked={showAllPeople}
            onChange={(event) => setShowAllPeople(event.target.checked)}
          />
          <span>显示所有人员</span>
        </MapToggle>
        <MapToggle>
          <input
            type="checkbox"
            checked={showPersonNames}
            onChange={(event) => setShowPersonNames(event.target.checked)}
          />
          <span>显示姓名</span>
        </MapToggle>
        <MapToggle>
          <input
            type="checkbox"
            checked={showAllAreas}
            onChange={(event) => setShowAllAreas(event.target.checked)}
          />
          <span>显示所有区域</span>
        </MapToggle>
      </MapOptions>
      {status === "error" || areaStatus === "error" || hasDataError ? (
        <MapStatus>地图信息加载失败</MapStatus>
      ) : status === "loading" || areaStatus === "loading" || isDataLoading ? (
        <MapStatus>地图信息加载中</MapStatus>
      ) : null}
    </MapFrame>
  );
}

const MapFrame = styled.div`
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid hsl(220 13% 88%);
  border-radius: 8px;
  background: hsl(216 23% 95%);
  &[data-map-fullscreen="true"] { position: fixed; inset: 0; z-index: 1200; width: 100vw; height: 100vh; border: 0; border-radius: 0; }
`;

const MapCanvas = styled.div`
  width: 100%;
  height: 100%;
  min-height: 0;
`;

const MapOptions = styled.div`
  position: absolute;
  left: 52px;
  top: 12px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const MapToggle = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid hsl(220 13% 86%);
  border-radius: 6px;
  padding: 6px 9px;
  color: hsl(218 15% 24%);
  background: hsl(0 0% 100% / 0.92);
  box-shadow: 0 8px 18px hsl(220 20% 10% / 0.13);
  font-size: ${FONT_SIZES.peopleDetailLabel};
  font-weight: 700;
  cursor: pointer;

  input {
    width: 14px;
    height: 14px;
    accent-color: hsl(214 92% 56%);
  }
`;

const MapStatus = styled.div`
  position: absolute;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  padding: 16px;
  color: white;
  background: hsl(218 28% 12% / 0.66);
  font-size: ${FONT_SIZES.peopleMapStatus};
  font-weight: 700;
  text-align: center;
  pointer-events: auto;
  cursor: wait;
`;

export default PeopleLocationMap;
