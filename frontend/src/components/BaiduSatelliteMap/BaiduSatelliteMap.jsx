import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { loadBaiduMap } from "./baiduMapLoader";

const BAIDU_MAP_CENTER = {
  lng: 121.671271,
  lat: 29.978283,
};

const BAIDU_MAP_ZOOM = 18;
function BaiduSatelliteMap() {
  const mapRef = useRef(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let isMounted = true;
    const ak = import.meta.env.VITE_BAIDU_MAP_AK;

    loadBaiduMap(ak)
      .then((BMap) => {
        if (!isMounted || !mapRef.current) {
          return;
        }

        const center = new BMap.Point(BAIDU_MAP_CENTER.lng, BAIDU_MAP_CENTER.lat);
        const map = new BMap.Map(mapRef.current, {
          enableMapClick: false,
        });

        map.centerAndZoom(center, BAIDU_MAP_ZOOM);
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
        map.addOverlay(new BMap.Marker(center));

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

  return (
    <MapWrapper>
      <MapCanvas ref={mapRef} aria-label="厂区百度卫星地图" />
      {status === "loading" ? <MapStatus>地图加载中...</MapStatus> : null}
      {status === "error" ? (
        <MapStatus>地图加载失败，请检查 VITE_BAIDU_MAP_AK</MapStatus>
      ) : null}
    </MapWrapper>
  );
}

const MapWrapper = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  margin-top: 10px;
  overflow: hidden;
  border: 1px solid hsl(214 34% 84%);
  border-radius: 6px;
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

export default BaiduSatelliteMap;
