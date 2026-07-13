import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { loadBaiduMap } from "../BaiduSatelliteMap/baiduMapLoader";

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

function getStatusTone(status) {
  if (["离线"].includes(status)) {
    return "gray";
  }

  if (["异常", "风险", "禁止进入"].includes(status)) {
    return "red";
  }

  return "blue";
}

function getToneColor(tone) {
  return {
    blue: "#1677ff",
    red: "#ef4444",
    gray: "#8b95a5",
  }[tone];
}

function toMapCoordinate(person, index) {
  const position = person.latest_position;

  if (position?.x != null && position?.y != null) {
    return {
      lng:
        MAP_CENTER.lng +
        (Number(position.x) - LOCAL_ORIGIN.x) * LOCAL_COORDINATE_SCALE.lng,
      lat:
        MAP_CENTER.lat -
        (Number(position.y) - LOCAL_ORIGIN.y) * LOCAL_COORDINATE_SCALE.lat,
    };
  }

  const zoneAnchor =
    zoneAnchors.find((anchor) => person.location_zone?.includes(anchor.keyword)) ??
    {
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
  return {
    lng:
      MAP_CENTER.lng +
      (Number(point.x) - LOCAL_ORIGIN.x) * LOCAL_COORDINATE_SCALE.lng,
    lat:
      MAP_CENTER.lat -
      (Number(point.y) - LOCAL_ORIGIN.y) * LOCAL_COORDINATE_SCALE.lat,
  };
}

function createPersonIcon(BMap, person, isSelected) {
  const tone = getStatusTone(person.status);
  const color = getToneColor(tone);
  const size = isSelected ? 34 : 28;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="14" fill="${color}" stroke="white" stroke-width="4"/>
      <circle cx="18" cy="15" r="4" fill="white"/>
      <path d="M10 27c1.8-4.2 5-6.3 8-6.3s6.2 2.1 8 6.3" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"/>
    </svg>
  `;

  return new BMap.Icon(
    `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    new BMap.Size(size, size),
    {
      imageSize: new BMap.Size(size, size),
      anchor: new BMap.Size(size / 2, size / 2),
    }
  );
}

function PeopleLocationMap({
  people,
  selectedPersonId,
  onPersonSelect,
  className,
}) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const bmapRef = useRef(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let isMounted = true;
    const ak = import.meta.env.VITE_BAIDU_MAP_AK;

    loadBaiduMap(ak)
      .then((BMap) => {
        if (!isMounted || !mapNodeRef.current) {
          return;
        }

        const center = new BMap.Point(MAP_CENTER.lng, MAP_CENTER.lat);
        const map = new BMap.Map(mapNodeRef.current, {
          enableMapClick: false,
        });

        map.centerAndZoom(center, 18);
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
        if (isMounted) {
          setStatus("error");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const BMap = bmapRef.current;
    const map = mapRef.current;

    if (!BMap || !map) {
      return;
    }

    map.clearOverlays();

    const markerPoints = people.map((person, index) => ({
      person,
      coordinate: toMapCoordinate(person, index),
    }));

    markerPoints.forEach(({ person, coordinate }) => {
      const isSelected = person.id === selectedPersonId;
      const point = new BMap.Point(coordinate.lng, coordinate.lat);
      const marker = new BMap.Marker(point, {
        icon: createPersonIcon(BMap, person, isSelected),
      });
      const label = new BMap.Label(person.name, {
        offset: new BMap.Size(14, -24),
      });

      label.setStyle({
        padding: "3px 7px",
        border: "1px solid rgba(22, 119, 255, 0.25)",
        borderRadius: "999px",
        color: "#1f2937",
        background: "rgba(255, 255, 255, 0.88)",
        boxShadow: "0 6px 14px rgba(15, 23, 42, 0.16)",
        fontSize: "12px",
        lineHeight: "16px",
      });

      marker.setLabel(label);
      marker.addEventListener("click", () => onPersonSelect(person));
      map.addOverlay(marker);
    });

    const selectedPerson = people.find((person) => person.id === selectedPersonId);

    if (selectedPerson?.track?.length > 1) {
      const trackPoints = selectedPerson.track.map((point) => {
        const coordinate = toTrackCoordinate(point);
        return new BMap.Point(coordinate.lng, coordinate.lat);
      });
      const polyline = new BMap.Polyline(trackPoints, {
        strokeColor: "#1677ff",
        strokeWeight: 4,
        strokeOpacity: 0.78,
      });

      map.addOverlay(polyline);
    }

    if (selectedPerson) {
      const selectedIndex = people.findIndex(
        (person) => person.id === selectedPerson.id
      );
      const coordinate = toMapCoordinate(selectedPerson, selectedIndex);
      map.panTo(new BMap.Point(coordinate.lng, coordinate.lat));
    }
  }, [onPersonSelect, people, selectedPersonId]);

  return (
    <MapFrame className={className}>
      <MapCanvas ref={mapNodeRef} aria-label="人员定位百度卫星地图" />
      {status === "loading" ? <MapStatus>地图加载中...</MapStatus> : null}
      {status === "error" ? (
        <MapStatus>地图加载失败，请检查 VITE_BAIDU_MAP_AK</MapStatus>
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
`;

const MapCanvas = styled.div`
  width: 100%;
  height: 100%;
  min-height: 0;
`;

const MapStatus = styled.div`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 16px;
  color: hsl(218 10% 45%);
  background: hsl(216 23% 95% / 0.82);
  font-size: 0.875rem;
  text-align: center;
  pointer-events: none;
`;

export default PeopleLocationMap;
