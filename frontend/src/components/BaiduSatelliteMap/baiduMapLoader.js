const BAIDU_MAP_CALLBACK = "__petroshieldBaiduMapLoaded";

let baiduMapLoaderPromise = null;

export function loadBaiduMap(ak) {
  if (window.BMap) {
    return Promise.resolve(window.BMap);
  }

  if (!ak) {
    return Promise.reject(new Error("VITE_BAIDU_MAP_AK is not configured"));
  }

  if (baiduMapLoaderPromise) {
    return baiduMapLoaderPromise;
  }

  baiduMapLoaderPromise = new Promise((resolve, reject) => {
    window[BAIDU_MAP_CALLBACK] = () => {
      if (window.BMap) {
        resolve(window.BMap);
      } else {
        reject(new Error("Baidu Map script loaded without BMap"));
      }
    };

    const existingScript = document.querySelector(
      'script[data-petroshield-baidu-map="true"]'
    );

    if (existingScript) {
      existingScript.addEventListener("error", () => {
        reject(new Error("Failed to load Baidu Map script"));
      });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://api.map.baidu.com/api?v=3.0&ak=${encodeURIComponent(
      ak
    )}&callback=${BAIDU_MAP_CALLBACK}`;
    script.async = true;
    script.defer = true;
    script.dataset.petroshieldBaiduMap = "true";
    script.onerror = () => {
      baiduMapLoaderPromise = null;
      reject(new Error("Failed to load Baidu Map script"));
    };
    document.head.appendChild(script);
  });

  return baiduMapLoaderPromise;
}
